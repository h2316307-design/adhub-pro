import { QuickRemovalDialog } from '@/components/removal/QuickRemovalDialog';
import { removalPrintImages, verifiedRemovalDesignSource, matchesRemovalDesignBillboard, isRemovalDesignEnabled } from '@/services/removalPrintImages';
import { excludePreviouslyCompletedRemovals } from '@/services/removalTaskHistory';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cleanupRentedRemovalItems, readRemovalPages } from '@/services/removalCleanupService';
import { resolveBillboardAvailability } from '@/services/billboardAvailabilityService';
import { findOptimalTeamForRemoval } from '@/utils/teamAssignment';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// Icons (Strict Lucide Vector Icons Only - No Emojis)
import {
  ShieldAlert,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  Printer,
  Search,
  Filter,
  RotateCcw,
  Merge,
  Package,
  Calendar as CalendarIcon,
  X,
  Camera,
  BarChart3,
  MessageCircle,
  Wrench,
  ChevronDown,
  ExternalLink,
  Eye,
  Users,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
} from 'lucide-react';

// Modals & Boards
import { ExpiredContractsAlert } from '@/components/removal/ExpiredContractsAlert';
import { ManualRemovalTaskDialog } from '@/components/removal/ManualRemovalTaskDialog';
import { RemovalTasksBoard } from '@/components/removal/RemovalTasksBoard';
import { RemovalStatsDialog } from '@/components/reports/RemovalStatsDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { SendTeamInstallationReportDialog } from '@/components/installation/SendTeamInstallationReportDialog';

interface RemovalTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  Contract?: any;
  installation_teams?: any;
}

interface RemovalTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  completed_at: string | null;
  removal_date: string | null;
  notes: string | null;
  removed_image_url: string | null;
  installed_image_url?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  design_face_a?: string | null;
  design_face_b?: string | null;
}

interface CleanupReportData {
  checked: number;
  removed: Array<{
    id: string;
    task_id: string;
    billboard_id: number | string;
    name: string;
    contracts: string;
    reason?: string;
  }>;
  emptyTasksRemoved?: number;
}

async function getLatestInstallationSnapshot(contractIds: number[], billboardId: number) {
  const normalizedContractIds = [...new Set(contractIds.map(Number).filter(Number.isFinite))];
  if (normalizedContractIds.length === 0) return null;

  const { data: installationTasks, error: tasksError } = await supabase
    .from('installation_tasks')
    .select('id')
    .in('contract_id', normalizedContractIds);
  if (tasksError) return null;

  const taskIds = (installationTasks || []).map((task: any) => task.id).filter(Boolean);
  if (taskIds.length === 0) return null;

  const { data, error } = await supabase
    .from('installation_task_items')
    .select('design_face_a, design_face_b, installed_image_url, installed_image_face_a_url, installed_image_face_b_url')
    .eq('billboard_id', billboardId)
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export default function RemovalTasks() {
  const [quickRemovalOpen, setQuickRemovalOpen] = useState(false);
  const queryClient = useQueryClient();

  // State
  const [boardPage, setBoardPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [removalDate, setRemovalDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Dialog Controls
  const [manualOpen, setManualOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [sendTeamDialogOpen, setSendTeamDialogOpen] = useState(false);
  const [cleanupReportOpen, setCleanupReportOpen] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<CleanupReportData | null>(null);
  const [printTeamDialogOpen, setPrintTeamDialogOpen] = useState(false);
  const [selectedTeamForPrint, setSelectedTeamForPrint] = useState<string>('');

  // Printing State
  const [unifiedPrintDialogOpen, setUnifiedPrintDialogOpen] = useState(false);
  const [unifiedPrintData, setUnifiedPrintData] = useState<{
    teamId: string;
    teamName: string;
    items: BillboardPrintItem[];
    billboards: Record<number, any>;
    teams: Record<string, any>;
    customerPhone?: string;
  } | null>(null);

  const [billboardPrintOpen, setBillboardPrintOpen] = useState(false);
  const [billboardPrintData, setBillboardPrintData] = useState<{
    contractNumber: string | number;
    customerName: string;
    billboards: any[];
  } | null>(null);

  // 1. Fetch Removal Tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['removal-tasks'],
    queryFn: async () => {
      return await readRemovalPages((from, to) => supabase
        .from('removal_tasks')
        .select('*')
        .order('created_at', { ascending: false }).order('id').range(from, to)) as RemovalTask[];
    },
  });

  // 2. Fetch Teams
  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const teamById = useMemo(() => {
    const m: Record<string, any> = {};
    teams.forEach((t) => {
      m[t.id] = t;
      m[String(t.id)] = t;
    });
    return m;
  }, [teams]);

  // 3. Fetch Raw Task Items
  const { data: rawTaskItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['all-removal-task-items'],
    queryFn: async () => {
      const data = await readRemovalPages((from, to) =>
        supabase.from('removal_task_items').select('*').order('id').range(from, to)
      );
      const unique = data?.filter((item, index, self) =>
        index === self.findIndex((t) => t.task_id === item.task_id && t.billboard_id === item.billboard_id && t.status === item.status)
      ) || [];
      return unique as RemovalTaskItem[];
    },
  });

  // Map task_id -> contract_id
  const removalTaskContractMap = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => {
      const cId = Number(t.contract_id);
      m.set(String(t.id), cId);
      m.set(t.id, cId);
    });
    return m;
  }, [tasks]);

  // 4. Fetch Installation Designs for Task Items
  const itemBillboardIds = useMemo(() => {
    return [...new Set(rawTaskItems.map((i) => Number(i.billboard_id)).filter((id) => Number.isFinite(id) && id > 0))];
  }, [rawTaskItems]);

  const { data: installationDesigns = [] } = useQuery({
    queryKey: ['installation-designs-for-removal-v5', itemBillboardIds.join(',')],
    enabled: itemBillboardIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select(`
          billboard_id,
          design_face_a,
          design_face_b,
          installed_image_url,
          installed_image_face_a_url,
          installed_image_face_b_url,
          task_id,
          created_at,
          selected_design_id,
          task_designs:selected_design_id(
            design_name,
            design_face_a_url,
            design_face_b_url
          )
        `)
        .in('billboard_id', itemBillboardIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const taskIds = [...new Set((data || []).map((item: any) => item.task_id).filter(Boolean))];
      if (taskIds.length === 0) return [];

      const { data: instTasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id')
        .in('id', taskIds);
      if (tasksError) throw tasksError;

      const contractByTask = new Map((instTasks || []).map((task: any) => [task.id, Number(task.contract_id)]));
      return (data || []).map((item: any) => ({
        ...item,
        design_face_a: item.selected_design_id ? (item.task_designs?.design_face_a_url || null) : (item.design_face_a || null),
        design_face_b: item.selected_design_id ? (item.task_designs?.design_face_b_url || null) : (item.design_face_b || null),
        contract_id: contractByTask.get(item.task_id) || null,
      }));
    },
  });

  // 5. Fetch Billboards Details
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-removal-tasks', itemBillboardIds.join(',')],
    enabled: itemBillboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('billboards').select('*').in('ID', itemBillboardIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const billboardById = useMemo(() => {
    const m: Record<string | number, any> = {};
    billboardsDetails.forEach((b: any) => {
      m[b.ID] = b;
      m[String(b.ID)] = b;
      m[Number(b.ID)] = b;
    });
    return m;
  }, [billboardsDetails]);

  // 6. Fetch Contract Details for Tasks (including design_data & billboard_ids)
  const contractIds = useMemo(() => {
    const ids: number[] = [];
    tasks.forEach((t) => {
      if (t.contract_id) ids.push(Number(t.contract_id));
      if (Array.isArray(t.contract_ids)) {
        t.contract_ids.forEach((id: any) => ids.push(Number(id)));
      }
    });
    return [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  }, [tasks]);

  const { data: taskContracts = [] } = useQuery({
    queryKey: ['contracts-for-removal-tasks', contractIds.join(',')],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", design_data, billboard_ids, installation_enabled')
        .in('Contract_Number', contractIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const contractByNumber = useMemo(() => {
    const m: Record<string | number, any> = {};
    taskContracts.forEach((c: any) => {
      const num = Number(c.Contract_Number);
      m[num] = c;
      m[String(c.Contract_Number)] = c;
    });
    return m;
  }, [taskContracts]);

  // 7. Merge designs with items (Multi-layer fallback: DB Item -> Installation Tasks -> Contract design_data -> Billboard)
  const allTaskItems = useMemo(() => {
    // A. Parse Contract.design_data for each contract
    const contractDesignMap = new Map<string, { design_face_a?: string | null; design_face_b?: string | null }>();
    taskContracts.forEach((c: any) => {
      if (c.installation_enabled === false) return;
      if (!c.design_data) return;
      try {
        let dd = typeof c.design_data === 'string' ? JSON.parse(c.design_data) : c.design_data;
        if (typeof dd === 'string') {
          try { dd = JSON.parse(dd); } catch {}
        }
        const cleanUrl = (val: any): string | null => {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:'))) {
              return trimmed;
            }
          }
          return null;
        };

        if (Array.isArray(dd)) {
          const contractBillboardIds = c.billboard_ids
            ? String(c.billboard_ids).split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0)
            : [];
          const contractBillboards = billboardsDetails.filter((b: any) => {
            if (contractBillboardIds.length > 0) {
              return contractBillboardIds.includes(Number(b.ID));
            }
            return true;
          });

          dd.forEach((d: any) => {
            if (!isRemovalDesignEnabled(d)) return;

            const faceA = cleanUrl(d.designFaceA) || cleanUrl(d.design_face_a) || cleanUrl(d.faceA) || cleanUrl(d.face_a) ||
                          cleanUrl(d.design_face_a_url) || cleanUrl(d.designFaceAUrl);

            const faceB = cleanUrl(d.designFaceB) || cleanUrl(d.design_face_b) || cleanUrl(d.faceB) || cleanUrl(d.face_b) ||
                          cleanUrl(d.design_face_b_url) || cleanUrl(d.designFaceBUrl);

            // Only map when the design actually contains an image
            if (!faceA && !faceB) return;

            contractBillboards.forEach((billboard: any) => {
              if (matchesRemovalDesignBillboard(d, billboard)) {
                contractDesignMap.set(`${Number(c.Contract_Number)}:${Number(billboard.ID)}`, {
                  design_face_a: faceA || null,
                  design_face_b: faceB || null,
                });
              }
            });
          });
        }
      } catch (err) {
        console.warn('Error parsing contract design_data:', err);
      }
    });

    // B. Build installation designs map
    const installDesignMap = new Map<string, any>();
    installationDesigns.forEach((d: any) => {
      const key = `${Number(d.contract_id)}:${Number(d.billboard_id)}`;
      if (!installDesignMap.has(key)) {
        installDesignMap.set(key, d);
      }
    });

    const cleanItemUrl = (val: any): string | null => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:'))) {
          return trimmed;
        }
      }
      return null;
    };

    return excludePreviouslyCompletedRemovals(rawTaskItems, tasks).map((item) => {
      const contractId = removalTaskContractMap.get(item.task_id) || removalTaskContractMap.get(String(item.task_id));
      const bId = Number(item.billboard_id);
      const cId = Number(contractId);
      const installDesign = contractId ? installDesignMap.get(`${cId}:${bId}`) : undefined;
      const contractDesign = contractId
        ? contractDesignMap.get(`${cId}:${bId}`)
        : undefined;

      const bStreetPhoto = (billboardById[bId]?.Image_URL || '').trim();
      const sanitizeDesign = (val: any): string | null => {
        const u = cleanItemUrl(val);
        if (!u) return null;
        if (bStreetPhoto && u === bStreetPhoto) return null;
        return u;
      };

      // Resolve only sources matched to this billboard and the removal contract.
      const photoUrls = [item.installed_image_url, item.installed_image_face_a_url, item.installed_image_face_b_url,
        installDesign?.installed_image_url, installDesign?.installed_image_face_a_url, installDesign?.installed_image_face_b_url];
      const cleanSource = (source: any) => {
        const images = removalPrintImages({
          design_face_a: sanitizeDesign(source?.design_face_a),
          design_face_b: sanitizeDesign(source?.design_face_b),
        }, billboardById[bId] || {}, true, photoUrls);
        return { design_face_a: images.faceA, design_face_b: images.faceB };
      };
      const sourceDesign = verifiedRemovalDesignSource(cleanSource(installDesign), cleanSource(contractDesign));
      const verifiedImages = removalPrintImages(sourceDesign, billboardById[bId] || {}, true, photoUrls);
      const finalFaceA = verifiedImages.faceA;
      const finalFaceB = verifiedImages.faceB;

      const finalInstalledUrl = cleanItemUrl(item.installed_image_url) ||
                                cleanItemUrl(installDesign?.installed_image_face_a_url) ||
                                cleanItemUrl(installDesign?.installed_image_url) ||
                                null;

      const finalInstalledFaceA = cleanItemUrl(item.installed_image_face_a_url) ||
                                  cleanItemUrl(installDesign?.installed_image_face_a_url) ||
                                  null;

      const finalInstalledFaceB = cleanItemUrl(item.installed_image_face_b_url) ||
                                  null;

      return {
        ...item,
        contract_id: contractId,
        design_face_a: finalFaceA,
        design_face_b: finalFaceB,
        installed_image_url: finalInstalledUrl,
        installed_image_face_a_url: finalInstalledFaceA,
        installed_image_face_b_url: finalInstalledFaceB,
      };
    });
  }, [rawTaskItems, tasks, installationDesigns, removalTaskContractMap, taskContracts, billboardById, billboardsDetails]);

  // Helper groupings
  const itemsByTask = useMemo(() => {
    const grouped: Record<string, RemovalTaskItem[]> = {};
    allTaskItems.forEach((item) => {
      if (!grouped[item.task_id]) grouped[item.task_id] = [];
      grouped[item.task_id].push(item);
    });
    return grouped;
  }, [allTaskItems]);

  const existingTaskContractIds = useMemo(() => {
    return new Set(
      tasks
        .filter((t) => t.status !== 'cancelled')
        .flatMap((t) => t.contract_ids || [t.contract_id])
    );
  }, [tasks]);

  const existingTaskBillboardIds = useMemo(() => {
    const activeTasks = new Set(tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').map((t) => t.id));
    return new Set(
      allTaskItems
        .filter((item) => activeTasks.has(item.task_id) && item.status === 'pending')
        .map((item) => item.billboard_id)
    );
  }, [tasks, allTaskItems]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeTasksList = tasks.filter((task) => (itemsByTask[task.id] || []).some((item) => item.status !== 'completed'));
    const pendingBillboardsCount = allTaskItems.filter((item) => item.status !== 'completed').length;
    const completedBillboardsCount = allTaskItems.filter((item) => item.status === 'completed').length;
    const activeTeamsCount = new Set(activeTasksList.map((t) => t.team_id).filter(Boolean)).size;

    return {
      activeTasksCount: activeTasksList.length,
      pendingBillboardsCount,
      completedBillboardsCount,
      activeTeamsCount,
    };
  }, [tasks, allTaskItems, itemsByTask]);

  // Calculate duplicate billboards in pending items
  const duplicateTasksCount = useMemo(() => {
    const billboardCount: Record<number, number> = {};
    let count = 0;
    for (const item of allTaskItems) {
      if (item.status === 'completed') continue;
      billboardCount[item.billboard_id] = (billboardCount[item.billboard_id] || 0) + 1;
    }
    for (const c of Object.values(billboardCount)) {
      if (c > 1) count += c - 1;
    }
    return count;
  }, [allTaskItems]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Creation of Tasks for Expired Contracts (Strict Rented Conflict Shield)
  // ─────────────────────────────────────────────────────────────────────────────
  const autoTasksCreatedRef = useState<Set<number>>(() => new Set())[0];

  const { data: expiredContracts = [] } = useQuery({
    queryKey: ['expired-contracts-auto-sync'],
    queryFn: async () => {
      const todayIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date", design_data')
        .lte('"End Date"', todayIso)
        .gte('"End Date"', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    const createAutoRemovalTasks = async () => {
      if (!expiredContracts.length || !teams.length || !tasks.length) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Fetch all active contracts (end date strictly > today, uncancelled)
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids, "End Date", billboards_released')
        .gt('"End Date"', todayStr);

      const billboardsInActiveContracts = new Set<number>();
      (activeContracts || []).forEach((c: any) => {
        if (c.billboards_released === true) return;
        if (c.billboard_ids) {
          const ids = String(c.billboard_ids).split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => billboardsInActiveContracts.add(id));
        }
      });

      const seenInNewerContracts = new Set<number>();
      billboardsInActiveContracts.forEach((id) => seenInNewerContracts.add(id));

      let tasksCreated = false;

      for (const contract of expiredContracts) {
        const cNum = Number(contract.Contract_Number);
        const billboardIds = contract.billboard_ids
          ? String(contract.billboard_ids).split(',').map((id: string) => parseInt(id.trim())).filter(Boolean)
          : [];

        if (autoTasksCreatedRef.has(cNum)) {
          billboardIds.forEach((id) => seenInNewerContracts.add(id));
          continue;
        }

        // Always register billboards of existing or newer contracts so older contracts can NEVER claim them
        if (existingTaskContractIds.has(cNum)) {
          billboardIds.forEach((id) => seenInNewerContracts.add(id));
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        if (contract['End Date']) {
          const endDate = new Date(contract['End Date']);
          endDate.setHours(0, 0, 0, 0);
          if (endDate > today) {
            billboardIds.forEach((id) => seenInNewerContracts.add(id));
            autoTasksCreatedRef.add(cNum);
            continue;
          }
        }

        if (billboardIds.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Billboards that have NOT been superseded by a newer contract
        const eligibleBillboardIds = billboardIds.filter((id) => !seenInNewerContracts.has(id));
        billboardIds.forEach((id) => seenInNewerContracts.add(id));

        if (eligibleBillboardIds.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Fetch billboard records
        const { data: contractBillboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', eligibleBillboardIds);

        if (billError || !contractBillboards || contractBillboards.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Strict filter: exclude billboards already in pending removal tasks or currently rented in active contracts
        const availableBillboards = contractBillboards.filter((billboard) => {
          if (existingTaskBillboardIds.has(billboard.ID)) return false;
          if (!excludePreviouslyCompletedRemovals([...rawTaskItems, { task_id: '__candidate', billboard_id: billboard.ID, status: 'pending' }], [...tasks, { id: '__candidate', contract_id: cNum, status: 'pending' }]).some(item => item.task_id === '__candidate')) return false;
          if (billboardsInActiveContracts.has(billboard.ID)) return false;
          return true;
        });

        autoTasksCreatedRef.add(cNum);
        if (availableBillboards.length === 0) continue;

        // Group billboards by team
        const teamsByTeamId: Record<string, { teamId: string; billboards: number[] }> = {};
        for (const billboard of availableBillboards) {
          const suitableTeam = findOptimalTeamForRemoval(teams, billboard.Size, billboard.City, billboard.friend_company_id);
          if (!suitableTeam) continue;
          const tId = suitableTeam.id;
          if (!teamsByTeamId[tId]) {
            teamsByTeamId[tId] = { teamId: tId, billboards: [] };
          }
          teamsByTeamId[tId].billboards.push(billboard.ID);
        }

        for (const teamData of Object.values(teamsByTeamId)) {
          const { data: newTask, error: insertError } = await supabase
            .from('removal_tasks')
            .insert({
              contract_id: cNum,
              contract_ids: [cNum],
              team_id: teamData.teamId,
              status: 'pending',
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError || !newTask) continue;
          tasksCreated = true;

          for (const billboardId of teamData.billboards) {
            const instSnap = await getLatestInstallationSnapshot([cNum], billboardId);
            await supabase.from('removal_task_items').insert({
              task_id: newTask.id,
              billboard_id: billboardId,
              status: 'pending',
              design_face_a: instSnap?.design_face_a || null,
              design_face_b: instSnap?.design_face_b || null,
              installed_image_url: instSnap?.installed_image_url || null,
            });
          }
        }
      }

      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      }
    };

    createAutoRemovalTasks();
  }, [expiredContracts.length, teams.length, tasks.length]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Clean Rented Billboards Mutation
  const cleanupRentedMutation = useMutation({
    mutationFn: cleanupRentedRemovalItems,
    onSuccess: (report) => {
      setCleanupReport(report);
      setCleanupReportOpen(true);
      setSelectedItems(new Set());
      if (report.removed.length > 0) {
        toast.success(`تم استبعاد ${report.removed.length} عنصر خارج المتاحة والقادمة من مهام الإزالة`);
      } else {
        toast.info('اكتمل الفحص: جميع العناصر المعلقة مطابقة لتصدير المتاحة والقادمة');
      }
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      toast.error(error.message || 'فشل في فحص وتنظيف اللوحات المؤجرة');
    },
  });

  // 2. Complete Items Mutation
  const completeItemsMutation = useMutation({
    mutationFn: async () => {
      if (!removalDate || selectedItems.size === 0) {
        throw new Error('يرجى تحديد تاريخ الإزالة واللوحات المطلوبة');
      }

      const updates = Array.from(selectedItems).map((itemId) => {
        const item = allTaskItems.find((i) => i.id === itemId);
        return {
          id: itemId,
          task_id: item?.task_id || selectedTeamId || '',
          billboard_id: item?.billboard_id || 0,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          removal_date: format(removalDate, 'yyyy-MM-dd'),
          notes: notes || null,
        };
      });

      const { error } = await supabase.from('removal_task_items').upsert(updates);
      if (error) throw error;

      // Update parent task if all items completed
      if (selectedTeamId) {
        const taskItemsForTeam = itemsByTask[selectedTeamId] || [];
        const remainingItems = taskItemsForTeam.filter((item) => !selectedItems.has(item.id) && item.status !== 'completed');
        if (remainingItems.length === 0) {
          await supabase.from('removal_tasks').update({ status: 'completed' }).eq('id', selectedTeamId);
        }
      }

      // Update billboards operational status to available
      const billboardIds = Array.from(selectedItems)
        .map((itemId) => {
          const item = allTaskItems.find((i) => i.id === itemId);
          return item?.billboard_id;
        })
        .filter(Boolean);

      if (billboardIds.length > 0) {
        await supabase
          .from('billboards')
          .update({
            Status: 'available',
            Contract_Number: null,
            Customer_Name: null,
            Ad_Type: null,
            Rent_Start_Date: null,
            Rent_End_Date: null,
          })
          .in('ID', billboardIds);
      }
    },
    onSuccess: () => {
      toast.success('تم توثيق إزالة اللوحات المحددة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['billboards'] });
      setSelectedItems(new Set());
      setNotes('');
      setSelectedTeamId('');
    },
    onError: (error: any) => {
      toast.error('خطأ في توثيق الإزالة: ' + error.message);
    },
  });

  // 3. Undo Removal Mutation
  const undoRemovalMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('removal_task_items')
        .update({
          status: 'pending',
          completed_at: null,
          removal_date: null,
          notes: null,
          removed_image_url: null,
        })
        .eq('id', itemId);
      if (error) throw error;

      const item = allTaskItems.find((i) => i.id === itemId);
      if (item) {
        await supabase.from('removal_tasks').update({ status: 'pending' }).eq('id', item.task_id);
      }
    },
    onSuccess: () => {
      toast.success('تم التراجع عن إزالة اللوحة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error('فشل التراجع: ' + error.message);
    },
  });

  // 4. Delete Single Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: itemsError } = await supabase.from('removal_task_items').delete().eq('task_id', taskId);
      if (itemsError) throw itemsError;

      const { error: taskError } = await supabase.from('removal_tasks').delete().eq('id', taskId);
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف مهمة الإزالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error('خطأ في حذف المهمة: ' + error.message);
    },
  });

  // 5. Clean Duplicates Mutation
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const pendingItems = allTaskItems.filter((i) => i.status === 'pending');
      if (pendingItems.length === 0) throw new Error('لا توجد عناصر معلقة');

      const byBillboard: Record<number, typeof pendingItems> = {};
      pendingItems.forEach((item) => {
        if (!byBillboard[item.billboard_id]) byBillboard[item.billboard_id] = [];
        byBillboard[item.billboard_id].push(item);
      });

      const taskTeamMap: Record<string, string> = {};
      tasks.forEach((t) => {
        taskTeamMap[t.id] = t.team_id;
      });
      const teamPriorityMap: Record<string, number> = {};
      teams.forEach((t) => {
        teamPriorityMap[t.id] = t.priority || 0;
      });

      const itemsToDelete: string[] = [];
      for (const [, items] of Object.entries(byBillboard)) {
        if (items.length <= 1) continue;
        items.sort((a, b) => {
          const prioA = teamPriorityMap[taskTeamMap[a.task_id] || ''] || 0;
          const prioB = teamPriorityMap[taskTeamMap[b.task_id] || ''] || 0;
          return prioB - prioA;
        });
        for (let i = 1; i < items.length; i++) {
          itemsToDelete.push(items[i].id);
        }
      }

      if (itemsToDelete.length === 0) throw new Error('لا توجد لوحات مكررة');

      const { error } = await supabase.from('removal_task_items').delete().in('id', itemsToDelete);
      if (error) throw error;

      // Delete any resulting empty tasks
      const affectedTaskIds = [...new Set(pendingItems.filter((i) => itemsToDelete.includes(i.id)).map((i) => i.task_id))];
      for (const tId of affectedTaskIds) {
        const { count } = await supabase.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('task_id', tId);
        if (count === 0) {
          await supabase.from('removal_tasks').delete().eq('id', tId);
        }
      }

      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`تم حذف ${count} لوحة مكررة بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المكررات');
    },
  });

  // 6. Merge Tasks for Same Team & Contract
  const mergeRemovalTasksMutation = useMutation({
    mutationFn: async () => {
      const groups: Record<string, any[]> = {};
      tasks.forEach((t: any) => {
        const key = `${t.team_id}_${t.contract_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      let mergedCount = 0;
      for (const [, groupTasks] of Object.entries(groups)) {
        if (groupTasks.length <= 1) continue;
        const keepTask = groupTasks[0];
        const tasksToRemove = groupTasks.slice(1);
        const removeIds = tasksToRemove.map((t: any) => t.id);

        await supabase.from('removal_task_items').update({ task_id: keepTask.id }).in('task_id', removeIds);
        await supabase.from('removal_tasks').delete().in('id', removeIds);
        mergedCount += removeIds.length;
      }
      return mergedCount;
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast.info('لا توجد مهام متفرقة تحتاج إلى تجميع');
      } else {
        toast.success(`تم تجميع ${count} مهمة متفرقة بنجاح`);
      }
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تجميع المهام');
    },
  });

  // 7. Redistribute Tasks to Optimal Teams
  const redistributeRemovalMutation = useMutation({
    mutationFn: async () => {
      const pendingItems = allTaskItems.filter((i) => i.status !== 'completed');
      if (pendingItems.length === 0) throw new Error('لا توجد عناصر معلقة لإعادة التوزيع');

      const { data: teamsData } = await supabase.from('installation_teams').select('*');
      if (!teamsData?.length) throw new Error('لا توجد فرق معرفة في النظام');

      const taskTeamMap: Record<string, string> = {};
      tasks.forEach((t: any) => {
        taskTeamMap[t.id] = t.team_id;
      });

      let movedCount = 0;
      for (const item of pendingItems) {
        const billboard = billboardById[item.billboard_id];
        if (!billboard) continue;

        const optimalTeam = findOptimalTeamForRemoval(teamsData, billboard.Size, billboard.City, billboard.friend_company_id);
        if (!optimalTeam) continue;

        const currentTeamId = taskTeamMap[item.task_id];
        if (currentTeamId !== optimalTeam.id) {
          const parentTask = tasks.find((t) => t.id === item.task_id);
          const contractId = parentTask?.contract_id;
          if (!contractId) continue;

          let targetTask = tasks.find((t) => t.team_id === optimalTeam.id && t.contract_id === contractId);
          if (!targetTask) {
            const { data: newTask } = await supabase
              .from('removal_tasks')
              .insert({ contract_id: contractId, team_id: optimalTeam.id, status: 'pending' })
              .select()
              .single();
            if (newTask) targetTask = newTask as any;
          }

          if (targetTask) {
            await supabase.from('removal_task_items').update({ task_id: targetTask.id }).eq('id', item.id);
            movedCount++;
          }
        }
      }

      // Cleanup empty tasks
      for (const task of tasks) {
        const { count } = await supabase.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('task_id', task.id);
        if (count === 0) {
          await supabase.from('removal_tasks').delete().eq('id', task.id);
        }
      }

      return movedCount;
    },
    onSuccess: (moved) => {
      toast.success(`اكتملت إعادة التوزيع: تم نقل ${moved} لوحة إلى الفرق الأنسب اختصاصياً وجغرافياً`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إعادة التوزيع');
    },
  });

  // 8. Bulk Complete Selected Tasks
  const handleBulkCompleteTasks = useCallback((taskIds: string[]) => {
    const newSet = new Set<string>();
    taskIds.forEach((taskId) => {
      const items = (itemsByTask[taskId] || []).filter((i) => i.status !== 'completed');
      items.forEach((i) => newSet.add(i.id));
    });

    if (newSet.size === 0) {
      toast.info('جميع اللوحات المحددة مكتملة بالفعل');
      return;
    }
    setSelectedItems(newSet);
    setSelectedTeamId(taskIds[0] || '');
    setRemovalDate(new Date());
  }, [itemsByTask]);

  // 9. Printing Handlers
  const handlePrintSingleTask = useCallback((task: any, items: any[]) => {
    const contract = contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)];
    const team = teamById[task.team_id] || teamById[String(task.team_id)];

    // استبعاد اللوحات التي تمت إزالتها سابقاً (طباعة اللوحات المعلقة فقط)
    const pendingItems = items.filter((item: any) => item.status !== 'completed');
    if (pendingItems.length === 0) {
      toast.info('جميع لوحات هذه المهمة تمت إزالتها بالفعل ولا توجد مهام معلقة للطباعة');
      return;
    }
    const targetItems = pendingItems;

    const printItems: BillboardPrintItem[] = targetItems.map((item: any) => ({
      id: item.id,
      billboard_id: Number(item.billboard_id),
      design_face_a: item.design_face_a || null,
      design_face_b: item.design_face_b || null,
      installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
      installed_image_face_b_url: item.installed_image_face_b_url || null,
      team_id: task.team_id,
      contract_number: task.contract_id,
      ad_type: contract?.['Ad Type'] || null,
    }));

    setUnifiedPrintData({
      teamId: task.team_id,
      teamName: team?.team_name || 'فريق غير محدد',
      items: printItems,
      billboards: billboardById,
      teams: teamById,
    });
    setUnifiedPrintDialogOpen(true);
  }, [contractByNumber, teamById, billboardById]);

  const handlePrintAllForTeam = useCallback((tId: string) => {
    const team = teamById[tId] || teamById[String(tId)];
    const teamName = team?.team_name || 'فريق غير محدد';
    const activeTeamTasks = tasks.filter((t) => t.team_id === tId && t.status !== 'cancelled' && t.status !== 'completed');
    const teamTaskIds = new Set(activeTeamTasks.map((t) => t.id));
    
    // طباعة اللوحات المعلقة فقط غير المكتملة
    const teamItems = allTaskItems.filter((item) => teamTaskIds.has(item.task_id) && item.status !== 'completed');

    if (teamItems.length === 0) {
      toast.error(`لا توجد لوحات معلقة للطباعة لفرقة "${teamName}"`);
      return;
    }

    const printItems: BillboardPrintItem[] = teamItems.map((item: any) => {
      const task = tasks.find((t) => t.id === item.task_id);
      const contract = task ? (contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)]) : null;
      const bb = billboardById[item.billboard_id] || billboardById[Number(item.billboard_id)];
      return {
        id: item.id,
        billboard_id: Number(item.billboard_id),
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
        installed_image_face_b_url: item.installed_image_face_b_url || null,
        team_id: tId,
        contract_number: task?.contract_id,
        ad_type: contract?.['Ad Type'] || bb?.Ad_Type || null,
      };
    });

    setUnifiedPrintData({
      teamId: tId,
      teamName,
      items: printItems,
      billboards: billboardById,
      teams: teamById,
    });
    setUnifiedPrintDialogOpen(true);
  }, [teamById, tasks, allTaskItems, contractByNumber, billboardById]);

  // طباعة جميع لوحات الإزالة المعلقة لجميع الفرق دفعة واحدة (استبعاد المكتملة والملغاة)
  const handlePrintAllPending = useCallback(() => {
    const activeTasks = new Set(tasks.filter((t) => t.status !== 'cancelled' && t.status !== 'completed').map((t) => t.id));
    const pendingItems = allTaskItems.filter((item) => item.status !== 'completed' && activeTasks.has(item.task_id));

    if (pendingItems.length === 0) {
      toast.error('لا توجد أي لوحات معلقة للطباعة');
      return;
    }

    const printItems: BillboardPrintItem[] = pendingItems.map((item: any) => {
      const task = tasks.find((t) => t.id === item.task_id);
      const contract = task ? (contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)]) : null;
      const bb = billboardById[item.billboard_id] || billboardById[Number(item.billboard_id)];
      return {
        id: item.id,
        billboard_id: Number(item.billboard_id),
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
        installed_image_face_b_url: item.installed_image_face_b_url || null,
        team_id: task?.team_id || '',
        contract_number: task?.contract_id,
        ad_type: contract?.['Ad Type'] || bb?.Ad_Type || null,
      };
    });

    setUnifiedPrintData({
      teamId: 'all',
      teamName: 'جميع الفرق',
      items: printItems,
      billboards: billboardById,
      teams: teamById,
    });
    setUnifiedPrintDialogOpen(true);
  }, [allTaskItems, tasks, contractByNumber, billboardById, teamById]);

  // Loading State
  const isLoading = tasksLoading || itemsLoading;

  return (
    <div className="container mx-auto max-w-[1800px] space-y-4 p-3 pb-28 sm:p-5 md:space-y-6 md:p-6" dir="rtl">
      <QuickRemovalDialog open={quickRemovalOpen} onOpenChange={setQuickRemovalOpen} items={allTaskItems} tasks={tasks} billboards={billboardById} contracts={contractByNumber} teams={teamById} />
      {/* ── Header ── */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/80 p-4 shadow-sm backdrop-blur-md md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-foreground md:text-2xl">
                  مهام إزالة الدعاية
                </h1>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[11px] font-bold text-primary">
                  النسخة المطورة
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground md:text-sm">
                متابعة العقود المنتهية، مطابقة تصدير المتاحة والقادمة، وتوثيق الإزالة للفرق الميدانية
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 md:mr-auto">
            <Button onClick={() => setQuickRemovalOpen(true)} disabled={isLoading} className="h-10 cursor-pointer gap-2 rounded-xl transition-all duration-200"><CheckSquare className="h-4 w-4" />الإزالة السريعة</Button>
            {/* 1. Primary Clean Button */}
            <Button
              onClick={() => cleanupRentedMutation.mutate()}
              disabled={cleanupRentedMutation.isPending}
              size="sm"
              className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${cleanupRentedMutation.isPending ? 'motion-safe:animate-spin' : ''}`} />
              {cleanupRentedMutation.isPending ? 'جاري الفحص...' : 'فحص وتنظيف المؤجرة'}
            </Button>

            {/* 2. Print All Pending Across All Teams Button */}
            <Button
              onClick={handlePrintAllPending}
              variant="default"
              size="sm"
              className="h-10 cursor-pointer gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition-all duration-200 hover:bg-amber-400 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              طباعة الكل (جميع الفرق)
            </Button>

            {/* 3. Print All For Specific Team Button */}
            <Button
              onClick={() => {
                if (teams.length > 0) {
                  const teamWithPending = teams.find((t) => {
                    const tTasks = tasks.filter((task) => task.team_id === t.id);
                    return allTaskItems.some((item) => tTasks.some((tk) => tk.id === item.task_id) && item.status !== 'completed');
                  });
                  setSelectedTeamForPrint(teamWithPending ? teamWithPending.id : teams[0]?.id || '');
                }
                setPrintTeamDialogOpen(true);
              }}
              variant="outline"
              size="sm"
              className="h-10 cursor-pointer gap-2 rounded-xl border-primary/30 bg-primary/10 px-4 text-xs font-black text-primary shadow-sm transition-all duration-200 hover:border-primary/50 hover:bg-primary/20 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              طباعة مهام فرقة معينة
            </Button>

            {/* 3. Manual Task Creation */}
            <Button
              onClick={() => setManualOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 cursor-pointer gap-2 rounded-xl border-border/50 bg-background/60 px-4 text-xs font-bold transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95"
            >
              <Package className="h-4 w-4 text-primary" />
              إضافة مهمة يدوية
            </Button>

            {/* 3. Maintenance Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 cursor-pointer gap-2 rounded-xl border-border/50 bg-background/60 px-3.5 text-xs font-bold transition-all duration-200 hover:border-primary/40 hover:bg-muted/40 active:scale-95"
                >
                  <Wrench className="h-4 w-4 text-primary" />
                  أدوات الصيانة
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl border-border/50 p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-2.5 py-1.5 text-xs text-muted-foreground font-bold">
                  أدوات المعالجة والتنظيم
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => cleanupRentedMutation.mutate()}
                  disabled={cleanupRentedMutation.isPending}
                  className="cursor-pointer gap-2.5 rounded-lg p-2 focus:bg-primary/10"
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold">تنظيف المؤجرة</span>
                    <span className="text-[10px] text-muted-foreground">مطابقة تصدير المتاحة والقادمة</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => redistributeRemovalMutation.mutate()}
                  disabled={redistributeRemovalMutation.isPending}
                  className="cursor-pointer gap-2.5 rounded-lg p-2 focus:bg-primary/10"
                >
                  <RotateCcw className="h-4 w-4 text-amber-500" />
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold">إعادة التوزيع الذكي</span>
                    <span className="text-[10px] text-muted-foreground">توجيه اللوحات للمقاس والمدينة الأنسب</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => mergeRemovalTasksMutation.mutate()}
                  disabled={mergeRemovalTasksMutation.isPending}
                  className="cursor-pointer gap-2.5 rounded-lg p-2 focus:bg-primary/10"
                >
                  <Merge className="h-4 w-4 text-indigo-500" />
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold">تجميع المهام المتفرقة</span>
                    <span className="text-[10px] text-muted-foreground">دمج مهام نفس الفريق والعقد</span>
                  </div>
                </DropdownMenuItem>

                {duplicateTasksCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => cleanupDuplicatesMutation.mutate()}
                      disabled={cleanupDuplicatesMutation.isPending}
                      className="cursor-pointer gap-2.5 rounded-lg p-2 focus:bg-destructive/10 text-destructive"
                    >
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-bold">حذف {duplicateTasksCount} مكررات</span>
                        <span className="text-[10px] opacity-80">إبقاء المهمة ذات الأولوية الأعلى فقط</span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 4. Stats Dialog */}
            <Button
              onClick={() => setStatsDialogOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 cursor-pointer gap-2 rounded-xl border-border/50 bg-background/60 px-3 text-xs font-bold transition-all duration-200 hover:border-primary/40 hover:bg-muted/40 active:scale-95"
            >
              <BarChart3 className="h-4 w-4 text-primary" />
              الإحصائيات
            </Button>

            {/* 5. Refresh */}
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
                queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
                toast.success('تم تحديث البيانات');
              }}
              variant="outline"
              size="icon"
              className="h-10 w-10 cursor-pointer rounded-xl border-border/50 bg-background/60 text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95"
              aria-label="تحديث مهام الإزالة"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Stats Summary Cards ── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="إحصائيات مهام الإزالة">
        <Card className="rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[11px] font-bold text-muted-foreground">لوحات بانتظار الإزالة</span>
              <div className="font-mono text-2xl font-black text-rose-500">
                {stats.pendingBillboardsCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[11px] font-bold text-muted-foreground">مهام نشطة</span>
              <div className="font-mono text-2xl font-black text-foreground">
                {stats.activeTasksCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[11px] font-bold text-muted-foreground">لوحات تم إزالتها</span>
              <div className="font-mono text-2xl font-black text-emerald-500">
                {stats.completedBillboardsCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[11px] font-bold text-muted-foreground">فرق لديها أعمال</span>
              <div className="font-mono text-2xl font-black text-foreground">
                {stats.activeTeamsCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </section>

      {/* ── Expired Contracts Alert Component ── */}
      <ExpiredContractsAlert
        teams={teams}
        existingTaskContractIds={existingTaskContractIds}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        }}
      />

      {/* ── Main Removal Visual Board ── */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/40">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">جاري تحميل بيانات الإزالة واللوحات...</p>
        </div>
      ) : (
        <RemovalTasksBoard
          tasks={tasks}
          allTaskItems={allTaskItems}
          billboardById={billboardById}
          contractByNumber={contractByNumber}
          teamById={teamById}
          teams={teams}
          isLoading={isLoading}
          page={boardPage}
          onPageChange={setBoardPage}
          totalTasks={tasks.length}
          pendingTasks={stats.activeTasksCount}
          completedTasks={tasks.length - stats.activeTasksCount}
          totalItems={allTaskItems.length}
          completedItems={stats.completedBillboardsCount}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
          }}
          onAddTask={() => setManualOpen(true)}
          onDeleteTask={(tId) => deleteTaskMutation.mutate(tId)}
          onPrintTask={handlePrintSingleTask}
          onUndoRemoval={(itemId) => undoRemovalMutation.mutate(itemId)}
          onCompleteAll={(tId) => {
            const taskItems = (itemsByTask[tId] || []).filter((i) => i.status !== 'completed');
            if (taskItems.length === 0) {
              toast.info('جميع اللوحات في هذه المهمة مكتملة بالفعل');
              return;
            }
            const newSet = new Set<string>();
            taskItems.forEach((i) => newSet.add(i.id));
            setSelectedItems(newSet);
            setSelectedTeamId(tId);
            setRemovalDate(new Date());
          }}
          selectedItems={selectedItems}
          onToggleItem={(itemId, tId) => {
            const next = new Set(selectedItems);
            if (next.has(itemId)) {
              next.delete(itemId);
            } else {
              next.add(itemId);
              setSelectedTeamId(tId);
            }
            setSelectedItems(next);
          }}
          onToggleSelectAll={(tId) => {
            const taskItems = (itemsByTask[tId] || []).filter((i) => i.status === 'pending');
            const allSelected = taskItems.every((item) => selectedItems.has(item.id));
            const next = new Set(selectedItems);
            if (allSelected) {
              taskItems.forEach((item) => next.delete(item.id));
            } else {
              taskItems.forEach((item) => next.add(item.id));
              setSelectedTeamId(tId);
            }
            setSelectedItems(next);
          }}
          onPrintAllTeam={handlePrintAllForTeam}
          onPrintAllPending={handlePrintAllPending}
          onSendWhatsApp={(task, items) => {
            const contract = contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)];
            const team = teamById[task.team_id] || teamById[String(task.team_id)];
            const teamPhone = team?.phone || team?.phone_number;
            const teamName = team?.team_name || 'فريق غير محدد';
            const firstBb = items[0] ? (billboardById[items[0].billboard_id] || billboardById[Number(items[0].billboard_id)]) : null;
            const customerName = contract?.['Customer Name'] || firstBb?.Customer_Name || 'غير محدد';
            const adType = contract?.['Ad Type'] || firstBb?.Ad_Type || '';

            // إرسال اللوحات المعلقة فقط للفرقة الميدانية
            const pendingItems = items.filter((item: any) => item.status !== 'completed');
            const targetItems = pendingItems.length > 0 ? pendingItems : items;

            const billboardDetails = targetItems
              .map((item: any) => {
                const bb = billboardById[item.billboard_id] || billboardById[Number(item.billboard_id)];
                const gps = bb?.GPS_Coordinates ? `\n  إحداثيات: ${bb.GPS_Coordinates}` : '';
                return `• ${bb?.Billboard_Name || `لوحة #${item.billboard_id}`} - ${bb?.City || ''} ${bb?.District || ''}${gps}`;
              })
              .join('\n');

            const message = `مهمة إزالة\n\nالزبون: ${customerName}\nنوع الإعلان: ${adType}\nعقد رقم: #${task.contract_id}\nعدد اللوحات: ${targetItems.length}\nالفرقة: ${teamName}\n\nاللوحات المطلوب إزالتها:\n${billboardDetails}`;

            if (teamPhone) {
              const cleanPhone = String(teamPhone).replace(/[^0-9+]/g, '').replace(/^\+/, '');
              window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
            } else {
              window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
            }
          }}
          onCompleteItem={(itemId, tId) => {
            const next = new Set<string>();
            next.add(itemId);
            setSelectedItems(next);
            setSelectedTeamId(tId);
            setRemovalDate(new Date());
          }}
          onBulkComplete={handleBulkCompleteTasks}
          onBulkPrint={(taskIds) => {
            const allItems: any[] = [];
            taskIds.forEach((tId) => {
              const task = tasks.find((t) => t.id === tId);
              if (!task) return;
              const items = itemsByTask[tId] || [];
              const pendingItems = items.filter((item) => item.status !== 'completed');
              pendingItems.forEach((item) => {
                const bb = billboardById[item.billboard_id] || billboardById[Number(item.billboard_id)];
                allItems.push({
                  id: item.id,
                  billboard_id: Number(item.billboard_id),
                  design_face_a: item.design_face_a || null,
                  design_face_b: item.design_face_b || null,
                  installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
                  installed_image_face_b_url: item.installed_image_face_b_url || null,
                  team_id: task.team_id,
                  contract_number: task.contract_id,
                  ad_type: (contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)])?.['Ad Type'] || bb?.Ad_Type || null,
                });
              });
            });

            if (allItems.length === 0) {
              toast.error('لا توجد لوحات معلقة للطباعة');
              return;
            }

            const uniqueTeamIds = Array.from(new Set(allItems.map((i) => i.team_id).filter(Boolean)));
            const singleTeam = uniqueTeamIds.length === 1 ? (teamById[uniqueTeamIds[0]] || teamById[String(uniqueTeamIds[0])]) : null;
            const printTeamName = singleTeam ? (singleTeam.team_name || 'فريق') : 'جميع الفرق المحددة';
            const printTeamId = uniqueTeamIds.length === 1 ? uniqueTeamIds[0] : 'all';

            setUnifiedPrintData({
              teamId: printTeamId,
              teamName: printTeamName,
              items: allItems,
              billboards: billboardById,
              teams: teamById,
            });
            setUnifiedPrintDialogOpen(true);
          }}
          onBulkDelete={(taskIds) => {
            taskIds.forEach((tId) => deleteTaskMutation.mutate(tId));
          }}
        />
      )}

      {/* ── Floating Action Bar for Confirming Removal ── */}
      <AnimatePresence>
        {selectedItems.size > 0 && (
          <motion.aside
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2"
            aria-label="شريط تأكيد الإزالة"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-primary/30 bg-card/95 p-3.5 text-foreground shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-9 rounded-xl border border-primary/30 bg-primary/10 px-3.5 text-xs font-black text-primary">
                  {selectedItems.size} لوحة محددة
                </Badge>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 cursor-pointer gap-2 rounded-xl border-border/50 bg-background/70 text-xs font-bold transition-all duration-200 hover:border-primary/40 active:scale-95"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      {removalDate ? format(removalDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ الإزالة'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar mode="single" selected={removalDate} onSelect={setRemovalDate} locale={ar} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => completeItemsMutation.mutate()}
                  disabled={!removalDate || completeItemsMutation.isPending}
                  className="h-9 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completeItemsMutation.isPending ? 'جاري الحفظ...' : 'تأكيد الإزالة'}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 cursor-pointer rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95"
                  onClick={() => {
                    setSelectedItems(new Set());
                    setSelectedTeamId('');
                  }}
                  aria-label="إلغاء التحديد"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Cleanup Report Dialog ── */}
      <Dialog open={cleanupReportOpen} onOpenChange={setCleanupReportOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-primary/30 bg-card p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/40 bg-primary/[0.04] p-5 text-right">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  تقرير فحص وتنظيف اللوحات المؤجرة
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                  استبعاد اللوحات غير الموجودة في تصدير المتاحة والقادمة؛ خيارات الإظهار التسويقي محفوظة
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-foreground">
              <div className="flex items-center justify-between font-bold">
                <span>إجمالي العناصر المعلقة المفحوصة:</span>
                <span className="font-mono text-primary">{cleanupReport?.checked ?? 0}</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-bold">
                <span>العناصر غير المطابقة المستبعدة:</span>
                <span className="font-mono text-emerald-500">{cleanupReport?.removed.length ?? 0}</span>
              </div>
              {cleanupReport?.emptyTasksRemoved !== undefined && cleanupReport.emptyTasksRemoved > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>المهام الفارغة المحذوفة تلقائياً:</span>
                  <span className="font-mono">{cleanupReport.emptyTasksRemoved}</span>
                </div>
              )}
            </div>

            {cleanupReport && cleanupReport.removed.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">قائمة اللوحات التي تم استبعادها لحمايتها:</Label>
                <ScrollArea className="h-60 rounded-xl border border-border/40 bg-background/50 p-3">
                  <ul className="space-y-2.5 text-xs">
                    {cleanupReport.removed.map((row) => (
                      <li key={row.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/60 p-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-foreground" dir="ltr">
                            {row.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          سبب الاستبعاد: <b className="text-primary">{row.reason || row.contracts}</b>
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/80 mb-2" />
                <p className="text-sm font-bold text-foreground">جميع العناصر المعلقة سليمة</p>
                <p className="text-xs mt-1">جميع العناصر المعلقة مطابقة لتصدير المتاحة والقادمة.</p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/30 bg-muted/10 p-4">
            <Button
              onClick={() => setCleanupReportOpen(false)}
              className="h-9 cursor-pointer rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground active:scale-95"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogs: Manual Task Creation ── */}
      <ManualRemovalTaskDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        teams={teams}
        existingTaskBillboardIds={existingTaskBillboardIds}
      />

      {/* ── Dialogs: Stats ── */}
      <RemovalStatsDialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen} />

      {/* ── Dialogs: Print All For Specific Team ── */}
      <Dialog open={printTeamDialogOpen} onOpenChange={setPrintTeamDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-primary/30 bg-card p-0 shadow-2xl" dir="rtl">
          <DialogHeader className="border-b border-border/40 bg-primary/[0.04] p-5 text-right">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  طباعة جميع مهام فرقة معينة
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                  اختر فرقة التركيب/الإزالة لمعاينة وتصدير كافة لوحاتها المعلقة دفعة واحدة عبر نموذج الطباعة الموحد
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">اختر الفرقة المطلوبة للطباعة:</Label>
              <ScrollArea className="h-72 rounded-xl border border-border/40 bg-background/40 p-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {teams.map((t) => {
                    const teamTasks = tasks.filter((task) => task.team_id === t.id);
                    const teamTaskIds = teamTasks.map((task) => task.id);
                    const pendingCount = allTaskItems.filter(
                      (item) => teamTaskIds.includes(item.task_id) && item.status !== 'completed'
                    ).length;
                    const isSelected = selectedTeamForPrint === t.id;

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTeamForPrint(t.id)}
                        className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/[0.08] shadow-md shadow-primary/10 ring-1 ring-primary/40'
                            : 'border-border/40 bg-card/60 hover:border-primary/30 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-foreground transition-colors group-hover:text-primary">
                              {t.team_name}
                            </h4>
                            {t.cities && (
                              <p className="text-[11px] text-muted-foreground">
                                {Array.isArray(t.cities) ? t.cities.join('، ') : t.cities}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`h-6 shrink-0 text-[11px] font-bold ${
                              pendingCount > 0
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border/60 bg-muted/50 text-muted-foreground'
                            }`}
                          >
                            {pendingCount} لوحة معلقة
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2 text-[11px] text-muted-foreground">
                          <span>{teamTasks.length} مهام إجمالية</span>
                          <Button
                            size="sm"
                            variant={isSelected ? 'default' : 'ghost'}
                            className="h-7 cursor-pointer gap-1.5 rounded-lg px-2.5 text-[11px] font-bold"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTeamForPrint(t.id);
                              setPrintTeamDialogOpen(false);
                              handlePrintAllForTeam(t.id);
                            }}
                          >
                            <Printer className="h-3 w-3" />
                            طباعة الكل
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between border-t border-border/30 bg-muted/10 p-4">
            <Button
              variant="outline"
              onClick={() => setPrintTeamDialogOpen(false)}
              className="h-9 cursor-pointer rounded-xl border-border/50 text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              disabled={!selectedTeamForPrint}
              onClick={() => {
                if (selectedTeamForPrint) {
                  setPrintTeamDialogOpen(false);
                  handlePrintAllForTeam(selectedTeamForPrint);
                }
              }}
              className="h-9 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              طباعة جميع مهام الفرقة المحددة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogs: Unified Print ── */}
      {unifiedPrintData && (
        <UnifiedPrintAllDialog
          open={unifiedPrintDialogOpen}
          onOpenChange={(open) => {
            setUnifiedPrintDialogOpen(open);
            if (!open) setUnifiedPrintData(null);
          }}
          contextType="removal"
          contextNumber={unifiedPrintData.teamName}
          customerName={unifiedPrintData.teamName}
          items={unifiedPrintData.items}
          billboards={unifiedPrintData.billboards}
          teams={unifiedPrintData.teams}
          showTeamFilter={true}
          customerPhone={unifiedPrintData.customerPhone}
          title={`طباعة لوحات الإزالة - ${unifiedPrintData.teamName}`}
        />
      )}

      {/* ── Dialogs: Billboard Bulk Print ── */}
      {billboardPrintData && (
        <BillboardBulkPrintDialog
          open={billboardPrintOpen}
          onOpenChange={(open) => {
            setBillboardPrintOpen(open);
            if (!open) setBillboardPrintData(null);
          }}
          billboards={billboardPrintData.billboards}
          contractInfo={{
            number: Number(billboardPrintData.contractNumber) || 0,
            customerName: billboardPrintData.customerName || 'إزالة',
          }}
        />
      )}

      {/* ── Dialogs: WhatsApp Report ── */}
      <SendTeamInstallationReportDialog
        open={sendTeamDialogOpen}
        onOpenChange={setSendTeamDialogOpen}
        tasks={tasks.filter((t) => selectedTasks.has(t.id))}
        allTaskItems={allTaskItems}
        billboardById={billboardById}
        teamById={teamById}
        contractById={contractByNumber}
        designsByTask={{}}
        teams={teams}
      />
    </div>
  );
}
