import { executedInstallationFaces } from '@/lib/campaignInstallationFaces';
import { getAvailableFacesCount } from '@/lib/installationFaces';
import { loadCampaignFacePlan } from '@/services/campaignInstallation';
import { sortTeamsByPriority, installationTeamCoversBillboard } from '@/utils/teamAssignment';
import { pickInstallationTeam, loadPreviousTeams } from '@/utils/smartTeamAssignment';
import { installationContractIsActive, blockedInstallationBillboards } from '@/lib/installationContractSelection';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, Check, FileText, Image as ImageIcon, Loader2, MapPin, Plus, RefreshCw, Search, Users, Wrench, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useBillboardStatuses } from '@/hooks/useBillboardStatuses';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';
import { assignBillboardsToContracts, buildTaskName } from '@/services/installationTaskContracts';

interface InstallationTeam { id: string; team_name: string; sizes: string[]; cities: string[]; priority?: number; friend_company_ids?: string[] | null; friend_company_id?: string | null }
interface TeamAssignment { teamId: string; teamName: string; billboardIds: number[] }
interface Customer { id: string; name: string; company: string | null }
interface ContractRow {
  Contract_Number: number;
  'Customer Name': string;
  customer_id: string | null;
  'Ad Type': string;
  'Contract Date': string;
  'End Date': string;
  billboard_ids: string;
  billboards_released?: boolean;
}

interface EnhancedAddInstallationTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: 'installation' | 'reinstallation';
  onTaskTypeChange: (type: 'installation' | 'reinstallation') => void;
  onSubmit: (data: {
    campaign?: boolean;
    contractIds: number[];
    customerId: string | null;
    billboardIds: number[];
    teamAssignments: TeamAssignment[];
    task_name?: string;
    acceptedInactiveContractIds?: number[];
  }) => void;
  isSubmitting: boolean;
  teams: InstallationTeam[];
}

const today = () => new Date().toISOString().slice(0, 10);

function Step({ n, title, done, children, aside }: { n: number; title: string; done?: boolean; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <h3 className="text-sm font-bold">{title}</h3>
        {aside && <span className="mr-auto">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** إنشاء أمر تركيب أو إعادة تركيب: زبون ← عقود ← لوحات ← فرق، في شاشة واحدة */
export function EnhancedAddInstallationTaskDialog({
  open, onOpenChange, taskType, onTaskTypeChange, onSubmit, isSubmitting, teams,
}: EnhancedAddInstallationTaskDialogProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [acceptInactive, setAcceptInactive] = useState(false);
  const [selectAllActive, setSelectAllActive] = useState(false);
  const [contractIds, setContractIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [boardSearch, setBoardSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [taskName, setTaskName] = useState('');
  const [starting, setStarting] = useState(false);
  const [campaign, setCampaign] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerSearch(''); setCustomerId(null); setShowExpired(false); setAcceptInactive(false); setSelectAllActive(false); setContractIds([]); setSelectedIds([]);
      setBoardSearch(''); setCityFilter('all'); setSizeFilter('all'); setAssignments([]); setTaskName(''); setCampaign(false);
    }
  }, [open]);

  // ── الزبائن (بحث بالاسم أو بنوع الإعلان) ──
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-task'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('id, name, company').eq('is_customer', true).order('name').limit(1000);
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });
  const term = customerSearch.trim().toLowerCase();
  const { data: adTypeMatches = [] } = useQuery({
    queryKey: ['task-customer-adtype', term],
    enabled: open && !customerId && term.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from('Contract').select('customer_id, "Ad Type"').ilike('Ad Type', `%${term}%`).not('customer_id', 'is', null).limit(200);
      return (data || []) as any[];
    },
  });
  const customerResults = useMemo(() => {
    if (!term) return customers.slice(0, 12);
    const byAd = new Map<string, string>();
    adTypeMatches.forEach(r => r.customer_id && !byAd.has(r.customer_id) && byAd.set(r.customer_id, r['Ad Type']));
    return customers
      .filter(c => c.name?.toLowerCase().includes(term) || c.company?.toLowerCase().includes(term) || byAd.has(c.id))
      .slice(0, 20)
      .map(c => ({ ...c, matchedAd: !c.name?.toLowerCase().includes(term) ? byAd.get(c.id) : undefined }));
  }, [customers, term, adTypeMatches]);
  const customer = customers.find(c => c.id === customerId);

  // ── عقود الزبون ──
  const { data: allContracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['task-dialog-contracts', customerId],
    enabled: open && !!customerId,
    queryFn: async () => {
      const rows: ContractRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('Contract')
          .select('Contract_Number, "Customer Name", customer_id, "Ad Type", "End Date", "Contract Date", billboard_ids, billboards_released, "Renewal Status"')
          .eq('customer_id', customerId!).order('Contract_Number', { ascending: false }).range(offset, offset + 499);
        if (error) throw error; rows.push(...((data || []) as ContractRow[]));
        if (!data || data.length < 500) return rows;
      }
    },
  });
  // حالة التركيب لكل عقد (من السجل): لوحات التركيب الأول المركّبة/الإجمالي، وعدد عمليات إعادة التركيب
  const { data: installState = {}, isSuccess: installLoaded } = useQuery({
    queryKey: ['task-dialog-install-state', customerId, allContracts.length],
    enabled: open && allContracts.length > 0,
    queryFn: async () => {
      const nums = allContracts.map(c => c.Contract_Number);
      const { data: tasks, error } = await supabase.from('installation_tasks')
        .select('id, contract_id, contract_ids, task_type, reinstallation_number')
        .or(`contract_id.in.(${nums.join(',')}),contract_ids.ov.{${nums.join(',')}}`);
      if (error) throw error;
      const ids = (tasks || []).map((t: any) => t.id);
      const items: any[] = [];
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error: e2 } = await supabase.from('installation_task_items').select('*, billboard:billboards!installation_task_items_billboard_id_fkey(Faces_Count)').in('task_id', ids.slice(i, i + 150)).neq('status', 'replaced');
        if (e2) throw e2;
        items.push(...(data || []));
      }
      const m: Record<number, { hasFirst: boolean; total: number; done: number; photos: number; reinstalls: number; board: Record<number, { done: boolean; photo: boolean; faces: number[] }> }> = {};
      allContracts.forEach(c => {
        const cn = c.Contract_Number;
        const own = new Set(parseContractBillboardIds(c.billboard_ids));
        const mine = (tasks || []).filter((t: any) => Number(t.contract_id) === cn || (t.contract_ids || []).map(Number).includes(cn));
        const first = new Set(mine.filter((t: any) => t.task_type !== 'reinstallation').map((t: any) => t.id));
        const board: Record<number, { done: boolean; photo: boolean; faces: number[] }> = {};
        items.filter(i => first.has(i.task_id) && (!own.size || own.has(Number(i.billboard_id)))).forEach(i => {
          const prev = board[Number(i.billboard_id)] || { done: false, photo: false, faces: [] };
          const faces = [...new Set([...prev.faces, ...executedInstallationFaces(i, i.billboard)])];
          const done = faces.length >= getAvailableFacesCount(i.billboard);
          board[Number(i.billboard_id)] = {
            faces, done: prev.done || done,
            photo: prev.photo || (done && !!(i.installed_image_url || i.installed_image_face_a_url || i.installed_image_face_b_url)),
          };
        });
        const states = Object.values(board);
        m[cn] = {
          hasFirst: first.size > 0,
          total: states.length,
          done: states.filter(s => s.done).length,
          photos: states.filter(s => s.photo).length,
          board,
          reinstalls: new Set(mine.filter((t: any) => t.task_type === 'reinstallation').map((t: any) => t.reinstallation_number || t.id)).size,
        };
      });
      return m;
    },
  });
  const isInstalled = (cn: number) => (installState[cn]?.done || 0) > 0;
  const isExpired = (c: ContractRow) => !installationContractIsActive(c, today());
  const contracts = useMemo(() => allContracts.filter(c => (taskType === 'reinstallation' && showExpired) || !isExpired(c) || contractIds.includes(c.Contract_Number)).sort((a, b) => Number(isExpired(a)) - Number(isExpired(b))), [allContracts, showExpired, contractIds, taskType]);
  const expiredCount = allContracts.filter(isExpired).length;
  useEffect(() => {
    if (taskType === 'reinstallation') return;
    setShowExpired(false);
    setContractIds(ids => ids.filter(id => allContracts.some(contract => contract.Contract_Number === id && !isExpired(contract))));
    setAcceptInactive(false);
  }, [taskType]);


  // ── لوحات العقود المحددة ──
  const selectedContracts = useMemo(() => allContracts.filter(c => contractIds.includes(c.Contract_Number)), [allContracts, contractIds]);
  const { data: pausedRows = [], isLoading: loadingPaused, isSuccess: pausedLoaded } = useQuery({
    queryKey: ['task-dialog-paused', contractIds.join(',')],
    enabled: open && contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('paused_billboards' as any).select('billboard_id, contract_number').in('contract_number', contractIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const pausedSet = useMemo(() => new Set(pausedRows.map(r => Number(r.billboard_id))), [pausedRows]);
  const allBoardIds = useMemo(() => {
    const s = new Set<number>();
    selectedContracts.forEach(c => parseContractBillboardIds(c.billboard_ids).forEach(id => s.add(id)));
    pausedRows.forEach(r => s.add(Number(r.billboard_id)));
    return [...s];
  }, [selectedContracts, pausedRows]);
  const { data: boards = [], isLoading: loadingBoards } = useQuery({
    queryKey: ['task-dialog-boards', allBoardIds.join(',')],
    enabled: open && allBoardIds.length > 0,
    queryFn: async () => {
      const out: any[] = [];
      for (let i = 0; i < allBoardIds.length; i += 100) {
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, City, Municipality, District, Nearest_Landmark, Image_URL, Faces_Count, Level, friend_company_id')
          .in('ID', allBoardIds.slice(i, i + 100));
        if (error) throw error;
        out.push(...(data || []));
      }
      return out;
    },
  });
  const contractOf = useMemo(() => {
    const paused = pausedRows.map(r => ({ Contract_Number: r.contract_number, billboard_ids: String(r.billboard_id) }));
    const { byContract } = assignBillboardsToContracts(boards.map(b => Number(b.ID)), [...selectedContracts, ...paused] as any, [], today());
    const m = new Map<number, number>();
    byContract.forEach((ids, cid) => ids.forEach(id => m.set(id, cid)));
    return m;
  }, [boards, selectedContracts, pausedRows]);

  const { data: previousTeams = new Map<number, string>() } = useQuery({
    queryKey: ['task-dialog-previous-teams', allBoardIds.join(',')],
    enabled: open && allBoardIds.length > 0,
    queryFn: () => loadPreviousTeams(allBoardIds),
    staleTime: 60_000,
  });
  const { statusesByBillboard } = useBillboardStatuses(allBoardIds);
  const tornIds = useMemo(() => allBoardIds.filter(id => (statusesByBillboard[id] || []).some((s: any) => s.status_type === 'torn_ad')), [allBoardIds, statusesByBillboard]);

  const { data: currentContracts = [], isLoading: loadingCurrent, isSuccess: currentLoaded } = useQuery({
    queryKey: ['task-dialog-current-contracts'], enabled: open,
    queryFn: async () => {
      const rows: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('Contract').select('Contract_Number, "Contract Date", "End Date", billboard_ids, billboards_released, "Renewal Status"').gte('End Date', today()).order('Contract_Number').range(offset, offset + 499);
        if (error) throw error; rows.push(...(data || [])); if (!data || data.length < 500) return rows;
      }
    },
  });
  const conflicts = useMemo(() => blockedInstallationBillboards(currentContracts, contractIds, today()), [currentContracts, contractIds]);
  const eligible = (id: number) => currentLoaded && pausedLoaded && !loadingPaused && !pausedSet.has(id) && !conflicts.has(id);
  useEffect(() => { setAcceptInactive(false); }, [contractIds.join(',')]);
  useEffect(() => { if (currentLoaded) setSelectedIds(ids => ids.filter(id => !conflicts.has(id) && !pausedSet.has(id))); }, [conflicts, pausedSet, currentLoaded]);

  // تحديد افتراضي عند تحميل لوحات عقد جديد فقط (لا يمسح اختيارات المستخدم)
  const seenBoards = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!boards.length || !currentLoaded || !pausedLoaded || loadingPaused || !installLoaded) return;
    const fresh = boards.map(b => Number(b.ID)).filter(id => !seenBoards.current.has(id));
    if (!fresh.length) return;
    fresh.forEach(id => seenBoards.current.add(id));
    const preferTorn = taskType === 'reinstallation' && tornIds.length > 0;
    // تركيب جديد: اللوحات غير المركّبة فقط؛ إعادة التركيب: المركّبة فقط (حين تكون حالة التركيب معروفة)
    const fitsType = (id: number) => {
      const st = installState[contractOf.get(id) as number]?.board?.[id];
      if (campaign || !st) return true;
      return taskType === 'installation' ? !st.done : st.done;
    };
    const pick = fresh.filter(id => eligible(id) && fitsType(id) && installationContractIsActive(selectedContracts.find(contract => contract.Contract_Number === contractOf.get(id)) || {}, today()) && (selectAllActive || !preferTorn || tornIds.includes(id)));
    setSelectedIds(prev => [...new Set([...prev, ...pick])]);
  }, [boards, taskType, tornIds, pausedSet, conflicts, currentLoaded, pausedLoaded, loadingPaused, selectAllActive, contractOf, installLoaded, campaign]);
  useEffect(() => { if (!open) seenBoards.current = new Set(); }, [open]);

  const cities = useMemo(() => [...new Set(boards.map(b => b.City).filter(Boolean))].sort(), [boards]);
  const sizes = useMemo(() => [...new Set(boards.map(b => b.Size).filter(Boolean))], [boards]);
  const bq = boardSearch.trim().toLowerCase();
  const visibleGroups = useMemo(() => selectedContracts
    .map(c => ({
      contract: c,
      boards: sortBillboardsStandardSync(boards.filter(b =>
        contractOf.get(Number(b.ID)) === c.Contract_Number
        && (cityFilter === 'all' || b.City === cityFilter)
        && (sizeFilter === 'all' || b.Size === sizeFilter)
        && (!bq || [b.Billboard_Name, b.ID, b.Nearest_Landmark, b.Municipality, b.District].some(v => String(v ?? '').toLowerCase().includes(bq))))),
    }))
    .filter(g => g.boards.length), [selectedContracts, boards, contractOf, cityFilter, sizeFilter, bq]);

  const toggleContract = (id: number) => {
    setContractIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    if (contractIds.includes(id)) {
      const removed = new Set(boards.filter(b => contractOf.get(Number(b.ID)) === id).map(b => Number(b.ID)));
      setSelectedIds(p => p.filter(x => !removed.has(x)));
      removed.forEach(x => seenBoards.current.delete(x));
    }
    setAssignments([]);
  };
  const toggleBoard = (id: number) => { if (!eligible(id)) { toast.error(conflicts.has(id) ? `اللوحة مرتبطة بعقد نشط آخر #${conflicts.get(id)}` : 'اللوحة موقوفة أو التحقق لم يكتمل'); return; } setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); };
  const toggleMany = (requestedIds: number[]) => {
    const ids = requestedIds.filter(eligible);
    const all = ids.every(id => selectedIds.includes(id));
    setSelectedIds(p => all ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };

  // ── الفرق ──
  const selectedBoards = useMemo(() => boards.filter(b => selectedIds.includes(Number(b.ID))), [boards, selectedIds]);
  const teamFits = (team: InstallationTeam, b: any) =>
    installationTeamCoversBillboard(team, b.Size, b.City, b.friend_company_id);
  const rankedTeams = useMemo(() => sortTeamsByPriority(teams)
    .map(t => ({ team: t, fit: selectedBoards.filter(b => teamFits(t, b)).length })), [teams, selectedBoards]);
  const assignedIds = new Set(assignments.flatMap(a => a.billboardIds));
  const unassigned = selectedBoards.filter(b => !assignedIds.has(Number(b.ID)));
  const addTeam = (team: InstallationTeam) => {
    const ids = selectedBoards.filter(b => !assignedIds.has(Number(b.ID)) && teamFits(team, b)).map(b => Number(b.ID));
    if (!ids.length) { toast.info(`لا توجد لوحات متبقية تناسب ${team.team_name}`); return; }
    setAssignments(p => [...p, { teamId: team.id, teamName: team.team_name, billboardIds: ids }]);
  };
  const assignBoard = (team: InstallationTeam, id: number) => setAssignments(p => {
    const cleaned = p.map(a => ({ ...a, billboardIds: a.billboardIds.filter(x => x !== id) })).filter(a => a.billboardIds.length);
    const ex = cleaned.find(a => a.teamId === team.id);
    return ex ? cleaned.map(a => a.teamId === team.id ? { ...a, billboardIds: [...a.billboardIds, id] } : a) : [...cleaned, { teamId: team.id, teamName: team.team_name, billboardIds: [id] }];
  });
  /** سبب عدم وجود فرقة للوحة: المدينة أو المقاس غير مغطى */
  const noTeamReason = (b: any) => {
    const cityOk = teams.some((t: any) => !t.cities?.length || t.cities.includes(b.City));
    const sizeOk = teams.some((t: any) => !t.sizes?.length || t.sizes.includes(b.Size));
    if (!b.Size) return 'مقاس اللوحة غير محدد';
    if (!cityOk) return `لا توجد فرقة تغطي مدينة ${b.City || 'غير محددة'}`;
    if (!sizeOk) return `لا توجد فرقة لمقاس ${b.Size}`;
    return `لا توجد فرقة تغطي ${b.City || 'المدينة'} ومقاس ${b.Size} معاً`;
  };
  const autoAssign = () => {
    const next: TeamAssignment[] = [];
    const taken = new Set<number>();
    for (const board of selectedBoards) {
      const team = pickInstallationTeam(teams, board, previousTeams.get(Number(board.ID)));
      if (!team) continue;
      const id = Number(board.ID);
      const existing = next.find(a => a.teamId === team.id);
      if (existing) existing.billboardIds.push(id);
      else next.push({ teamId: team.id, teamName: team.team_name, billboardIds: [id] });
      taken.add(id);
    }
    setAssignments(next);
    if (taken.size < selectedBoards.length) toast.warning(`${selectedBoards.length - taken.size} لوحة لا تناسب أي فرقة`);
  };
  useEffect(() => {
    // لوحات أُلغي تحديدها تخرج من تعيينات الفرق
    setAssignments(p => p.map(a => ({ ...a, billboardIds: a.billboardIds.filter(id => selectedIds.includes(id)) })).filter(a => a.billboardIds.length));
  }, [selectedIds]);

  // ── الاسم والإرسال ──
  const usedContractIds = useMemo(() => {
    const counts = new Map<number, number>();
    selectedIds.forEach(id => { const c = contractOf.get(id); if (c) counts.set(c, (counts.get(c) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [selectedIds, contractOf]);
  const autoName = buildTaskName({
    adTypes: allContracts.filter(c => usedContractIds.includes(c.Contract_Number)).map(c => c['Ad Type']),
    customerName: customer?.name || selectedContracts[0]?.['Customer Name'] || '',
    taskType,
    contractIds: usedContractIds,
  });

  const submit = async () => {
    if (starting || isSubmitting) return;
    if (!currentLoaded || loadingCurrent || loadingPaused || selectedIds.some(id => !eligible(id))) { toast.error('انتظر التحقق من اللوحات، أو أزل اللوحات المرتبطة بعقود أخرى'); return; }
    const inactiveIds = selectedContracts.filter(contract => usedContractIds.includes(contract.Contract_Number) && isExpired(contract)).map(contract => contract.Contract_Number);
    if (inactiveIds.length && (taskType !== 'reinstallation' || !acceptInactive)) { toast.error('راجع اختيار العقود غير النشطة وأكّد مراجعتها'); return; }
    if (!selectedIds.length) { toast.error('اختر لوحة واحدة على الأقل'); return; }
    if (assignments.length && unassigned.length) { toast.error(`${unassigned.length} لوحة بدون فرقة: ${unassigned.slice(0, 5).map(b => b.Billboard_Name || b.ID).join('، ')}${unassigned.length > 5 ? '…' : ''} — القائمة أسفل قسم الفرق`); return; }
    if (!assignments.length) {
      const missing = selectedBoards.filter(board => !pickInstallationTeam(teams, board));
      if (missing.length) { toast.error(`لوحات بلا فرقة مناسبة: ${missing.map(board => `${board.Billboard_Name || board.ID} (${board.City || 'مدينة غير محددة'}، ${board.Size || 'مقاس غير محدد'})`).join('، ')}`); return; }
    }
    if (campaign && (!campaignPlan.isSuccess || campaignPlan.isFetching)) { toast.error('انتظر اكتمال مراجعة أوجه الحملة'); return; }
    setStarting(true);
    try { await onSubmit({ campaign, contractIds: usedContractIds, customerId, billboardIds: selectedIds, teamAssignments: assignments, task_name: taskName.trim() || autoName, acceptedInactiveContractIds: inactiveIds }); } finally { setStarting(false); }
  };

  const campaignPlan = useQuery({
    queryKey: ['campaign-face-plan', contractIds.join(','), selectedIds.join(',')],
    enabled: open && campaign && selectedIds.length > 0,
    queryFn: () => loadCampaignFacePlan(contractIds, selectedIds),
  });
  const loadingBoardsView = contractIds.length > 0 && (loadingBoards || (allBoardIds.length > 0 && boards.length === 0));

  return (
    <Dialog open={open} onOpenChange={value => { if (!starting && !isSubmitting) onOpenChange(value); }}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0" dir="rtl">
        <DialogHeader className="flex-row flex-wrap items-center gap-3 space-y-0 border-b border-border px-5 py-3 text-right">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base">مهمة {taskType === 'reinstallation' ? 'إعادة تركيب' : 'تركيب'} جديدة</DialogTitle>
            <DialogDescription className="text-xs">اختر الزبون وعقوده، ثم اللوحات. يمكن جمع لوحات من أكثر من عقد في مهمة واحدة.</DialogDescription>
          </div>
          <div role="radiogroup" aria-label="نوع المهمة" className="ml-8 flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {([['installation', 'تركيب جديد', Wrench], ['reinstallation', 'إعادة تركيب', RefreshCw]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={taskType === v} onClick={() => onTaskTypeChange(v)}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold', taskType === v ? 'bg-card shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-3.5 w-3.5" />{l}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ── الزبون والعقود ── */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-l">
            <Step n={1} title="الزبون" done={!!customer}>
              {customer ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{customer.name}</span>
                    {customer.company && <span className="block truncate text-xs text-muted-foreground">{customer.company}</span>}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setCustomerId(null); setContractIds([]); setSelectedIds([]); setAssignments([]); seenBoards.current = new Set(); }}>تغيير</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="اسم الزبون أو نوع الإعلان..." className="h-10 pr-9" />
                  </div>
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {customerResults.map((c: any) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setCustomerId(c.id)} className="w-full rounded-lg px-3 py-2 text-right hover:bg-muted">
                          <span className="block text-sm font-medium">{c.name}</span>
                          {(c.matchedAd || c.company) && <span className="block truncate text-xs text-muted-foreground">{c.matchedAd ? `إعلان: ${c.matchedAd}` : c.company}</span>}
                        </button>
                      </li>
                    ))}
                    {term && !customerResults.length && <li className="px-3 py-4 text-center text-xs text-muted-foreground">لا نتائج</li>}
                  </ul>
                </>
              )}
            </Step>

            {customer && (
              <Step n={2} title="العقود" done={contractIds.length > 0}
                aside={taskType === 'reinstallation' && expiredCount > 0 && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={showExpired} onCheckedChange={setShowExpired} className="scale-75" />عقود غير نشطة ({expiredCount})
                  </label>
                )}>
                {loadingContracts ? (
                  <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />جارٍ التحميل...</p>
                ) : contracts.length === 0 ? (
                  <p className="rounded-lg bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">لا توجد عقود سارية — فعّل «المنتهية» لعرضها</p>
                ) : (
                  <>
                  <Button variant="outline" className="mb-3 w-full min-h-10 cursor-pointer transition-all duration-200 hover:bg-primary/10" onClick={() => { setCampaign(true); setSelectAllActive(true); setContractIds(allContracts.filter(c => !isExpired(c)).map(c => c.Contract_Number)); setSelectedIds([]); setAssignments([]); seenBoards.current = new Set(); }}>جلب جميع لوحات العقود لحملة وتقسيمها حسب الأوجه</Button>
                  {campaign && <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <p>حملة واحدة من العقود المحددة؛ يُفصل الوجه الذي سبق تنفيذه عن الوجه غير المنفّذ. تكلفة الشركة تبقى محفوظة حتى عندما لا توجد تكلفة إضافية على الزبون.</p>
                    <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setCampaign(false)}>العودة للإنشاء العادي</Button>
                    {campaignPlan.isFetching ? <p role="status">جارٍ مراجعة سجل الأوجه…</p> : campaignPlan.isError ? <p role="alert">{(campaignPlan.error as Error).message}</p> : ['included', 'extra'].map(section => <div key={section} className="mt-3 border-t pt-2">
                      <h4 className="font-bold">{section === 'included' ? 'بدون تكلفة إضافية — مشمول بالعقد' : 'بتكلفة إضافية'}</h4>
                      {(campaignPlan.data || []).flatMap(row => (['first','repeat'] as const).filter(phase => row[phase].length && ((phase === 'first' && row.includedInstallation && row.includedPrint) === (section === 'included'))).map(phase => <p key={`${row.board.ID}-${phase}`} className="mt-1">عقد {row.contractNumber} · {row.board.Billboard_Name || row.board.ID} · الأوجه {row[phase].join('، ')} · {phase === 'repeat' ? 'سبق تركيبها' : `لم تُركّب — التركيب ${row.includedInstallation ? 'مشمول' : 'إضافي'}، الطباعة ${row.includedPrint ? 'مشمولة' : 'إضافية'}`}</p>))}
                    </div>)}
                  </div>}
                  <Button variant="outline" className="mb-3 w-full cursor-pointer text-xs" onClick={() => { setSelectAllActive(true); setContractIds(allContracts.filter(contract => !isExpired(contract)).map(contract => contract.Contract_Number)); setAssignments([]); setSelectedIds([]); seenBoards.current = new Set(); }}>اختيار جميع لوحات عقود الزبون النشطة</Button>
                  {(() => {
                    // كل عقد ساري فيه لوحات لم تُركّب بعد (غير مركّب كلياً أو جزئياً)؛ تُحدَّد لوحاته غير المركّبة فقط
                    const notInstalled = allContracts.filter(c => {
                      const s = installState[c.Contract_Number];
                      if (isExpired(c) || !s) return false;
                      const own = parseContractBillboardIds(c.billboard_ids);
                      return own.some(id => !s.board?.[id]?.done);
                    });
                    const pendingBoards = notInstalled.reduce((n, c) => n + parseContractBillboardIds(c.billboard_ids).filter(id => !installState[c.Contract_Number]?.board?.[id]?.done).length, 0);
                    return notInstalled.length > 0 && (
                      <Button variant="outline" className="mb-3 h-auto w-full cursor-pointer whitespace-normal border-amber-500/40 py-2 text-xs leading-snug text-amber-600 dark:text-amber-400"
                        onClick={() => { onTaskTypeChange('installation'); setSelectAllActive(true); setContractIds(notInstalled.map(c => c.Contract_Number)); setAssignments([]); setSelectedIds([]); seenBoards.current = new Set(); }}>
                        تركيب جديد للوحات غير المركّبة · {pendingBoards} لوحة من {notInstalled.length} عقود
                      </Button>
                    );
                  })()}
                  {taskType === 'reinstallation' && <p className="mb-2 text-[11px] text-muted-foreground">العقود الباهتة لم يُركَّب لها تركيب أول بعد — استخدم «تركيب جديد» لها.</p>}
                  <ul className="space-y-1.5">
                    {contracts.map(c => {
                      const on = contractIds.includes(c.Contract_Number);
                      const count = parseContractBillboardIds(c.billboard_ids).length;
                      const used = selectedIds.filter(id => contractOf.get(id) === c.Contract_Number).length;
                      return (
                        <li key={c.Contract_Number}>
                          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleContract(c.Contract_Number)}
                            className={cn('flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-right transition-colors', on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40', taskType === 'reinstallation' && !on && installState[c.Contract_Number] && !isInstalled(c.Contract_Number) && 'opacity-50')}>
                            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{on && <Check className="h-3 w-3" />}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm">
                                <b className="tabular-nums">#{c.Contract_Number}</b>
                                {isExpired(c) && <span className="rounded bg-muted px-1 text-xs text-muted-foreground">غير نشط · اختيار يدوي</span>}
                                {(() => {
                                  const s = installState[c.Contract_Number];
                                  if (!s) return null;
                                  return s.done > 0
                                    ? <span className="rounded bg-emerald-500/15 px-1 text-xs text-emerald-600 dark:text-emerald-400">مركّب {s.done}/{s.total} · صور {s.photos}/{s.done}{s.reinstalls ? ` · إعادة ×${s.reinstalls}` : ''}</span>
                                    : <span className="rounded bg-amber-500/15 px-1 text-xs text-amber-600 dark:text-amber-400">{s.hasFirst ? `لم يُركّب${s.total ? ` 0/${s.total}` : ''}` : 'بلا أمر تركيب'}</span>;
                                })()}
                              </span>
                              <span className="block truncate text-xs">{c['Ad Type'] || '—'}</span>
                              <span className="block text-xs text-muted-foreground tabular-nums">{String(c['Contract Date'] || '').slice(0, 10)} ← {String(c['End Date'] || '').slice(0, 10)} · {on ? `${used}/` : ''}{count} لوحة</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </Step>
            )}
          </div>

          {/* ── اللوحات والفرق ── */}
          <div className="flex min-h-0 flex-col">
            {contractIds.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <FileText className="h-10 w-10 opacity-30" />
                {customer ? 'اختر عقداً أو أكثر لعرض لوحاته' : 'ابدأ باختيار الزبون'}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>اللوحات
                  </span>
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={boardSearch} onChange={e => setBoardSearch(e.target.value)} placeholder="بحث..." className="h-9 pr-9" />
                  </div>
                  {cities.length > 1 && (
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">كل المدن</SelectItem>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {sizes.length > 1 && (
                    <Select value={sizeFilter} onValueChange={setSizeFilter}>
                      <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">كل المقاسات</SelectItem>{sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {tornIds.length > 0 && (
                    <Button variant="outline" size="sm" className="h-9 gap-1 border-amber-500/40 text-xs text-amber-500" onClick={() => setSelectedIds(p => [...new Set([...p, ...tornIds.filter(eligible)])])}>
                      <AlertTriangle className="h-3.5 w-3.5" />الممزقة ({tornIds.length})
                    </Button>
                  )}
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
                  {loadingBoardsView ? (
                    <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل اللوحات...</p>
                  ) : visibleGroups.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">لا توجد لوحات مطابقة</p>
                  ) : visibleGroups.map(({ contract: c, boards: list }) => {
                    const ids = list.map((b: any) => Number(b.ID));
                    const allSel = ids.every(id => selectedIds.includes(id));
                    return (
                      <section key={c.Contract_Number} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-bold">عقد #{c.Contract_Number}</h4>
                          <span className="truncate text-xs text-muted-foreground">{c['Ad Type']}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">· {ids.filter(id => selectedIds.includes(id)).length}/{ids.length}</span>
                          <div className="mr-auto flex gap-1">
                          {(() => {
                            const b = installState[c.Contract_Number]?.board || {};
                            const pending = ids.filter(id => b[id] && !b[id].done);
                            return pending.length > 0 && pending.length < ids.length && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400" onClick={() => setSelectedIds(p => [...new Set([...p.filter(x => !ids.includes(x)), ...pending.filter(eligible)])])}>غير المركّبة فقط ({pending.length})</Button>
                            );
                          })()}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleMany(ids)}>{allSel ? 'إلغاء الكل' : 'تحديد الكل'}</Button>
                          </div>
                        </div>
                        <ul className="grid gap-2 xl:grid-cols-2">
                          {list.map((b: any) => {
                            const id = Number(b.ID);
                            const on = selectedIds.includes(id);
                            const st = installState[c.Contract_Number]?.board?.[id];
                            const offType = !!st && (taskType === 'installation' ? st.done : !st.done);
                            return (
                              <li key={id}>
                                <div role="checkbox" aria-checked={on} aria-disabled={!eligible(id)} tabIndex={eligible(id) ? 0 : -1} onClick={() => toggleBoard(id)}
                                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleBoard(id); } }}
                                  className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors', on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40', offType && !on && 'opacity-50')}>
                                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                                  <span className="h-11 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                                    {b.Image_URL ? <img src={b.Image_URL} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="m-auto mt-3 h-5 w-5 text-muted-foreground/50" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                                      <span className="truncate">{b.Billboard_Name || `#${id}`}</span>
                                      <span className="rounded bg-muted px-1.5 text-xs font-bold" dir="ltr">{b.Size}</span>
                                      {st && (st.done
                                        ? <span className={cn('rounded px-1.5 text-xs', st.photo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>{st.photo ? 'مركّب · بصور' : 'مركّب · بلا صور'}</span>
                                        : <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-600 dark:text-amber-400">لم يُركّب</span>)}
                                      {tornIds.includes(id) && <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-500">ممزق</span>}
                                      {conflicts.has(id) && <span className="rounded bg-destructive/10 px-1 text-xs text-destructive">محجوبة · عقد نشط #{conflicts.get(id)}</span>}
                                      {pausedSet.has(id) && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">موقوفة</span>}
                                    </span>
                                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{[b.Nearest_Landmark, b.Municipality].filter(Boolean).join(' · ') || '—'}</span>
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>

                {/* ── الفرق ── */}
                <div className="space-y-2 border-t border-border bg-muted/10 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', assignments.length ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>4</span>
                      <Users className="h-4 w-4" />الفرق
                    </span>
                    <span className="text-xs text-muted-foreground">{assignments.length ? `${unassigned.length ? `${unassigned.length} لوحة بلا فرقة` : 'كل اللوحات معيّنة'}` : 'الأولوية لفرقة الشركة مالكة اللوحة، ثم الفرق التي تغطي المدينة والمقاس حسب الترتيب'}</span>
                    {selectedBoards.length > 0 && <Button variant="outline" size="sm" className="mr-auto h-8 text-xs" onClick={autoAssign}>توزيع تلقائي الآن</Button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {assignments.map(a => (
                      <span key={a.teamId} className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {a.teamName} · {a.billboardIds.length}
                        <button type="button" onClick={() => setAssignments(p => p.filter(x => x.teamId !== a.teamId))} aria-label={`إزالة ${a.teamName}`}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    {rankedTeams.filter(({ team }) => !assignments.some(a => a.teamId === team.id)).map(({ team, fit }) => (
                      <button key={team.id} type="button" onClick={() => addTeam(team)} disabled={!fit}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">
                        <Plus className="h-3 w-3" />{team.team_name}<span className="text-muted-foreground">({fit})</span>
                      </button>
                    ))}
                  </div>
                  {assignments.length > 0 && unassigned.length > 0 && (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                      <div className="text-xs font-bold text-destructive">لوحات بلا فرقة ({unassigned.length}) — اختر لها فرقة:</div>
                      {unassigned.map(b => {
                        const fits = sortTeamsByPriority(teams).filter(t => teamFits(t, b));
                        return (
                          <div key={b.ID} className="flex flex-wrap items-center gap-1.5 text-xs">
                            <b>{b.Billboard_Name || `#${b.ID}`}</b>
                            <span className="rounded bg-muted px-1" dir="ltr">{b.Size || '—'}</span>
                            <span className="text-muted-foreground">{b.City || 'مدينة غير محددة'} · عقد #{contractOf.get(Number(b.ID))}</span>
                            {fits.length
                              ? fits.map(t => <button key={t.id} type="button" onClick={() => assignBoard(t, Number(b.ID))} className="rounded border border-primary/40 px-1.5 py-0.5 text-primary hover:bg-primary/10">{t.team_name}</button>)
                              : <span className="text-destructive">{noTeamReason(b)} — راجع نطاق الفرق أو بيانات اللوحة</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {selectedContracts.some(contract => usedContractIds.includes(contract.Contract_Number) && isExpired(contract)) && <label className="mx-5 my-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"><Checkbox checked={acceptInactive} onCheckedChange={value => setAcceptInactive(value === true)} />راجعت لوحات العقود غير النشطة؛ هذه إعادة تركيب للزبون المحدد، واللوحات المرتبطة بعقد نشط آخر محجوبة.</label>}
        {usedContractIds.length > 1 && <p className="mx-5 mb-2 rounded-lg border border-primary/30 bg-primary/10 p-2 text-xs font-bold text-primary">أمر عمل مستقل من {usedContractIds.length} عقود: #{usedContractIds.join('، #')}</p>}
        <footer className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
          <Input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder={autoName || 'اسم المهمة (اختياري)'} className="h-10 min-w-[240px] flex-1 text-sm" aria-label="اسم المهمة" />
          <span className="text-xs text-muted-foreground">
            <b className="text-foreground">{selectedIds.length}</b> لوحة{usedContractIds.length > 1 && <> من <b className="text-orange-500">{usedContractIds.length} عقود</b> (أمر عمل)</>}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={!selectedIds.length || isSubmitting} className="gap-1.5">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}إنشاء المهمة
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
