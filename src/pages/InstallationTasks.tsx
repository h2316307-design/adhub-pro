import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Users, 
  Package, 
  ChevronDown, 
  MapPin, 
  Navigation, 
  ZoomIn, 
  Printer, 
  CheckSquare, 
  Square,
  X,
  Search,
  Filter
} from 'lucide-react';
import { BillboardPrintIndividual } from '@/components/contracts/BillboardPrintIndividual';

interface InstallationTask {
  id: string;
  contract_id: number;
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  Contract?: any;
  installation_teams?: any;
}

interface InstallationTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  completed_at: string | null;
  installation_date: string | null;
  notes: string | null;
  design_face_a: string | null;
  design_face_b: string | null;
  billboards?: any;
}

export default function InstallationTasks() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [installDate, setInstallDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedBillboards, setSelectedBillboards] = useState<number[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<any[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  const [printType, setPrintType] = useState<'individual' | 'table'>('individual');
  const [billboardPrintData, setBillboardPrintData] = useState<{
    contractNumber: string | number;
    billboards: any[];
    designFaceA?: string | null;
    designFaceB?: string | null;
  } | null>(null);
  const [selectedPrintTeam, setSelectedPrintTeam] = useState<string>('all');
  const [newDesignFaceA, setNewDesignFaceA] = useState<string>('');
  const [newDesignFaceB, setNewDesignFaceB] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['installation-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_tasks')
        .select(`*`)
        .order('created_at', { ascending: false }); // الأحدث أولاً
      
      if (error) throw error;
      return data as InstallationTask[];
    },
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts-for-installation', manualOpen],
    enabled: manualOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", installation_enabled, billboard_ids, "Ad Type", "Contract Date", "End Date"')
        .order('Contract_Number', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // تصفية العقود بناءً على البحث
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return contracts;
    
    const searchLower = contractSearchTerm.toLowerCase();
    return contracts.filter((c: any) => 
      String(c.Contract_Number).includes(searchLower) ||
      c['Customer Name']?.toLowerCase().includes(searchLower) ||
      c['Ad Type']?.toLowerCase().includes(searchLower)
    );
  }, [contracts, contractSearchTerm]);

  // Load billboards when contracts are selected
  const handleContractsChange = async (contractNums: string[]) => {
    setSelectedContractNumbers(contractNums);
    setSelectedBillboards([]);
    
    if (contractNums.length === 0) {
      setAvailableBillboards([]);
      return;
    }

    // جمع جميع اللوحات من العقود المختارة
    const allBillboardIds: number[] = [];
    for (const contractNum of contractNums) {
      const contract = contracts.find((c: any) => String(c.Contract_Number) === contractNum);
      if (contract?.billboard_ids) {
        const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        allBillboardIds.push(...ids);
      }
    }

    if (allBillboardIds.length > 0) {
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', allBillboardIds);
      
      if (!error && billboards) {
        setAvailableBillboards(billboards);
      }
    }
  };

  const { data: allTaskItems = [] } = useQuery({
    queryKey: ['all-installation-task-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .order('billboard_id');
      
      if (error) throw error;
      return data as InstallationTaskItem[];
    },
  });

  const billboardIds = allTaskItems.map((i) => i.billboard_id).filter(Boolean);
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-task', billboardIds.join(',')],
    enabled: billboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Size", "Municipality", "District", "Nearest_Landmark", "GPS_Coordinates", Image_URL')
        .in('ID', billboardIds);
      if (error) throw error;
      return data as any[];
    },
  });

  const billboardById = useMemo(() => {
    const m: Record<number, any> = {};
    (billboardsDetails || []).forEach((b: any) => {
      m[b.ID] = b;
    });
    return m;
  }, [billboardsDetails]);

  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('installation_teams').select('id, team_name');
      if (error) throw error;
      return data as any[];
    },
  });

  const teamById = useMemo(() => {
    const m: Record<string, any> = {};
    (teams || []).forEach((t: any) => {
      m[t.id] = t;
    });
    return m;
  }, [teams]);

  const contractIds = tasks.map((t) => t.contract_id).filter(Boolean);
  const { data: taskContracts = [] } = useQuery({
    queryKey: ['contracts-by-number', contractIds.join(',')],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date"')
        .in('Contract_Number', contractIds as number[]);
      if (error) throw error;
      return data as any[];
    },
  });

  const contractByNumber = useMemo(() => {
    const m: Record<number, any> = {};
    (taskContracts || []).forEach((c: any) => {
      m[c.Contract_Number] = c;
    });
    return m;
  }, [taskContracts]);

  const createManualTasksMutation = useMutation({
    mutationFn: async () => {
      if (selectedContractNumbers.length === 0 || selectedBillboards.length === 0) {
        throw new Error('يرجى اختيار العقود واللوحات');
      }

      // جلب التصاميم من العقود إذا لم يتم تحديد تصاميم جديدة
      let designFaceA = newDesignFaceA || null;
      let designFaceB = newDesignFaceB || null;

      // إذا لم يتم تحديد تصاميم جديدة، نحاول جلبها من العقد الأول
      if (!designFaceA && !designFaceB && selectedContractNumbers.length > 0) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('design_face_a_path, design_face_b_path')
          .eq('Contract_Number', Number(selectedContractNumbers[0]))
          .single();
        
        if (contractData) {
          designFaceA = contractData.design_face_a_path;
          designFaceB = contractData.design_face_b_path;
        }
      }

      // Get teams for selected billboards
      const billboardsData = availableBillboards.filter(b => selectedBillboards.includes(b.ID));
      const teamsBySize: Record<string, { teamId: string; billboards: number[] }> = {};

      for (const billboard of billboardsData) {
        const size = billboard.Size;
        
        // Find team for this size
        const { data: suitableTeam } = await supabase
          .from('installation_teams')
          .select('id')
          .contains('sizes', [size])
          .limit(1)
          .single();

        const teamId = suitableTeam?.id || teams[0]?.id;
        
        if (!teamsBySize[teamId]) {
          teamsBySize[teamId] = { teamId, billboards: [] };
        }
        teamsBySize[teamId].billboards.push(billboard.ID);
      }

      // Create tasks for each team
      for (const teamData of Object.values(teamsBySize)) {
        const contractIdsArray = selectedContractNumbers.map(n => Number(n));
        
        // إنشاء مهمة جديدة مع timestamp فريد (للتعامل مع إعادة التركيب)
        const { data: newTask, error: insertError } = await supabase
          .from('installation_tasks')
          .insert({
            contract_id: contractIdsArray[0],
            contract_ids: contractIdsArray,
            team_id: teamData.teamId,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) throw insertError;
        const taskId = newTask.id;

        // إضافة اللوحات إلى المهمة مع التصاميم
        for (const billboardId of teamData.billboards) {
          const { error: itemError } = await supabase
            .from('installation_task_items')
            .insert({
              task_id: taskId,
              billboard_id: billboardId,
              status: 'pending',
              design_face_a: designFaceA,
              design_face_b: designFaceB
            });

          if (itemError) throw itemError;
        }
      }
    },
    onSuccess: async () => {
      toast.success('تم إنشاء مهام التركيب بنجاح');
      
      // إعادة تحميل البيانات فوراً
      await queryClient.refetchQueries({ queryKey: ['installation-tasks'] });
      await queryClient.refetchQueries({ queryKey: ['all-installation-task-items'] });
      
      setManualOpen(false);
      setSelectedContractNumbers([]);
      setContractSearchTerm('');
      setSelectedBillboards([]);
      setAvailableBillboards([]);
      setNewDesignFaceA('');
      setNewDesignFaceB('');
    },
    onError: (error) => {
      toast.error('فشل إنشاء المهام: ' + error.message);
    },
  });

  const completeItemsMutation = useMutation({
    mutationFn: async () => {
      if (!installDate || selectedItems.size === 0) {
        throw new Error('يرجى اختيار التاريخ واللوحات');
      }

      const updates = Array.from(selectedItems).map(itemId => {
        const item = allTaskItems.find(i => i.id === itemId);
        return {
          id: itemId,
          task_id: item?.task_id || selectedTeamId || '',
          billboard_id: item?.billboard_id || 0,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          installation_date: format(installDate, 'yyyy-MM-dd'),
          notes: notes || null,
        };
      });

      const { error } = await supabase
        .from('installation_task_items')
        .upsert(updates);
      
      if (error) throw error;

      // Check if all items completed, update task status
      if (selectedTeamId) {
        const taskItemsForTeam = itemsByTask[selectedTeamId] || [];
        const remainingItems = taskItemsForTeam.filter(
          item => !selectedItems.has(item.id) && item.status !== 'completed'
        );
        
        if (remainingItems.length === 0) {
          const { error: taskError } = await supabase
            .from('installation_tasks')
            .update({ status: 'completed' })
            .eq('id', selectedTeamId);
          
          if (taskError) throw taskError;
        }
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة التركيب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-installation-task-items'] });
      setSelectedItems(new Set());
      setNotes('');
      setSelectedTeamId('');
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة التركيب: ' + error.message);
    },
  });

  const handlePrintTask = async (taskId: string) => {
    setPrintTaskId(taskId);
    setPrintDialogOpen(true);
  };

  const executePrint = async () => {
    if (!printTaskId) return;
    
    const taskItems = itemsByTask[printTaskId] || [];
    const taskBillboards = taskItems.map(item => billboardById[item.billboard_id]).filter(Boolean);
    
    if (taskBillboards.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    const task = tasks.find(t => t.id === printTaskId);
    const contract = task ? contractByNumber[task.contract_id] : null;

    if (printType === 'individual') {
      // استخدام نفس مكون الطباعة من صفحة العقود
      // جلب التصاميم من أول item في المهمة
      const firstItem = taskItems[0];
      const contractDesignA = firstItem?.design_face_a || null;
      const contractDesignB = firstItem?.design_face_b || null;
      
      setBillboardPrintData({
        contractNumber: contract?.Contract_Number || task.contract_id,
        billboards: taskBillboards,
        designFaceA: contractDesignA,
        designFaceB: contractDesignB
      });
      setPrintDialogOpen(false);
    } else {
      await printTableInstallation(taskBillboards, contract, task);
    }
  };

  // طباعة جدول التركيب - نفس كود Contracts.tsx
  const printTableInstallation = async (billboards: any[], contract: any, task: any) => {
    try {
      const team = teamById[task.team_id || ''];
      const teamName = team?.team_name || 'فريق غير محدد';
      const teamSizes: string[] = Array.isArray(team?.sizes) ? team.sizes : [];

      // تصفية اللوحات حسب فريق التركيب إذا تم تحديد فريق
      let filtered = billboards;
      if (selectedPrintTeam !== 'all' && teamSizes.length > 0) {
        filtered = billboards.filter((b: any) => {
          const size = String(b.Size || '');
          return teamSizes.includes(size);
        });
      }

      if (!filtered.length) {
        toast.warning('لا توجد لوحات ضمن المقاسات المختارة');
        return;
      }

      const norm = (b: any) => {
        const id = String(b.ID || '');
        const name = String(b.Billboard_Name || id);
        const image = String(b.Image_URL || '');
        const municipality = String(b.Municipality || '');
        const district = String(b.District || '');
        const landmark = String(b.Nearest_Landmark || '');
        const size = String(b.Size || '');
        const faces = String(b.Faces_Count || '');
        const coords = String(b.GPS_Coordinates || '');
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = filtered.map(norm);
      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="contract-header">
                  <p style="font-size: 12px; font-weight: 700; color: #0066cc; margin-bottom: 8px;"><strong>فرقة التركيب:</strong> ${teamName}</p>
                  <p><strong>رقم العقد:</strong> ${contract?.Contract_Number || task.contract_id}</p>
                  <p><strong>نوع الإعلان:</strong> ${contract?.['Ad Type'] || 'غير محدد'}</p>
                  <p><strong>اسم الزبون:</strong> ${contract?.['Customer Name'] || 'غير محدد'}</p>
                </div>
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف تركيب - المهمة</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .contract-header { position: absolute; top: 33mm; right: 13mm; z-index: 30; font-family: 'Doran', 'Noto Sans Arabic', sans-serif; font-size: 10px; text-align: right; }
            .contract-header p { margin: 0; padding: 1px 0; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 15.5mm; max-height: 15.5mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 15.5mm; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 14.5mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); 
      w.document.close(); 
      w.focus(); 
      setTimeout(() => w.print(), 600);
      setPrintDialogOpen(false);
      toast.success(`تم تحضير ${filtered.length} لوحة للطباعة`);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة التركيب');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { variant: 'secondary', label: 'معلق', icon: Clock },
      in_progress: { variant: 'default', label: 'قيد التركيب', icon: Clock },
      completed: { variant: 'default', label: 'مكتمل', icon: CheckCircle2 },
      cancelled: { variant: 'destructive', label: 'ملغي', icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const tasksByContract = useMemo(() => {
    const grouped: Record<number, InstallationTask[]> = {};
    tasks.forEach(task => {
      if (!grouped[task.contract_id]) {
        grouped[task.contract_id] = [];
      }
      grouped[task.contract_id].push(task);
    });
    return grouped;
  }, [tasks]);

  const itemsByTask = useMemo(() => {
    const grouped: Record<string, InstallationTaskItem[]> = {};
    allTaskItems.forEach(item => {
      if (!grouped[item.task_id]) {
        grouped[item.task_id] = [];
      }
      grouped[item.task_id].push(item);
    });
    return grouped;
  }, [allTaskItems]);

  // ✅ حل إبداعي: ترتيب العقود حسب أحدث مهمة فيها (الأحدث أولاً)
  const sortedContracts = useMemo(() => {
    return Object.keys(tasksByContract)
      .map(Number)
      .sort((a, b) => {
        const tasksA = tasksByContract[a] || [];
        const tasksB = tasksByContract[b] || [];
        
        // الحصول على أحدث created_at لكل عقد
        const latestA = tasksA.length > 0 
          ? Math.max(...tasksA.map(t => new Date(t.created_at).getTime()))
          : 0;
        const latestB = tasksB.length > 0 
          ? Math.max(...tasksB.map(t => new Date(t.created_at).getTime()))
          : 0;
        
        // ترتيب تنازلي (الأحدث أولاً)
        return latestB - latestA;
      });
  }, [tasksByContract]);

  // 🔍 فلترة المهام بناءً على البحث والفلاتر
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // فلترة حسب الحالة
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    // فلترة حسب الفريق
    if (filterTeam !== 'all') {
      filtered = filtered.filter(task => task.team_id === filterTeam);
    }

    // فلترة حسب البحث (رقم العقد أو اسم الزبون)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(task => {
        const contract = contractByNumber[task.contract_id];
        return (
          String(task.contract_id).includes(searchLower) ||
          contract?.['Customer Name']?.toLowerCase().includes(searchLower) ||
          contract?.['Ad Type']?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractByNumber]);

  // إعادة تنظيم المهام المفلترة حسب العقود
  const filteredTasksByContract = useMemo(() => {
    const grouped: Record<number, InstallationTask[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.contract_id]) {
        grouped[task.contract_id] = [];
      }
      grouped[task.contract_id].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  // ترتيب العقود المفلترة
  const filteredSortedContracts = useMemo(() => {
    return Object.keys(filteredTasksByContract)
      .map(Number)
      .sort((a, b) => {
        const tasksA = filteredTasksByContract[a] || [];
        const tasksB = filteredTasksByContract[b] || [];
        
        const latestA = tasksA.length > 0 
          ? Math.max(...tasksA.map(t => new Date(t.created_at).getTime()))
          : 0;
        const latestB = tasksB.length > 0 
          ? Math.max(...tasksB.map(t => new Date(t.created_at).getTime()))
          : 0;
        
        return latestB - latestA;
      });
  }, [filteredTasksByContract]);

  const toggleSelectAll = (taskId: string) => {
    const taskItems = itemsByTask[taskId] || [];
    const pendingItems = taskItems.filter(i => i.status === 'pending');
    
    const allSelected = pendingItems.every(item => selectedItems.has(item.id));
    
    const newSet = new Set(selectedItems);
    if (allSelected) {
      pendingItems.forEach(item => newSet.delete(item.id));
    } else {
      pendingItems.forEach(item => newSet.add(item.id));
      setSelectedTeamId(taskId);
    }
    setSelectedItems(newSet);
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTasks(newSet);
  };

  const toggleSelectAllTasksInContract = (contractId: number) => {
    const contractTasks = tasksByContract[contractId] || [];
    const pendingTasks = contractTasks.filter(task => {
      const taskItems = itemsByTask[task.id] || [];
      return taskItems.some(item => item.status === 'pending');
    });

    const allSelected = pendingTasks.every(task => selectedTasks.has(task.id));
    
    const newSet = new Set(selectedTasks);
    if (allSelected) {
      pendingTasks.forEach(task => newSet.delete(task.id));
    } else {
      pendingTasks.forEach(task => newSet.add(task.id));
    }
    setSelectedTasks(newSet);
  };

  const completeTasksMutation = useMutation({
    mutationFn: async () => {
      if (!installDate || selectedTasks.size === 0) {
        throw new Error('يرجى اختيار التاريخ والمهام');
      }

      const allUpdates: any[] = [];
      
      for (const taskId of Array.from(selectedTasks)) {
        const taskItems = itemsByTask[taskId] || [];
        const pendingItems = taskItems.filter(i => i.status === 'pending');
        
        const updates = pendingItems.map(item => ({
          id: item.id,
          task_id: item.task_id,
          billboard_id: item.billboard_id,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          installation_date: format(installDate, 'yyyy-MM-dd'),
          notes: notes || null,
        }));
        
        allUpdates.push(...updates);
      }

      if (allUpdates.length > 0) {
        const { error } = await supabase
          .from('installation_task_items')
          .upsert(allUpdates);
        
        if (error) throw error;
      }

      // Update task statuses to completed
      for (const taskId of Array.from(selectedTasks)) {
        const { error: taskError } = await supabase
          .from('installation_tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
        
        if (taskError) throw taskError;
      }
    },
    onSuccess: () => {
      toast.success(`تم تحديث ${selectedTasks.size} مهمة كمكتملة`);
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-installation-task-items'] });
      setSelectedTasks(new Set());
      setNotes('');
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة التركيب: ' + error.message);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              مهام التركيب
            </h1>
            <p className="text-muted-foreground mt-2">إدارة ومتابعة مهام تركيب اللوحات الإعلانية</p>
          </div>
          <Button 
            onClick={() => setManualOpen(true)}
            size="lg"
            className="gap-2"
          >
            <Package className="h-5 w-5" />
            إضافة مهمة تركيب
          </Button>
        </div>

        {/* 🔍 البحث والفلترة */}
        <Card className="p-4 border-none shadow-lg bg-card/50 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* حقل البحث */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم العقد أو اسم الزبون..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* فلتر الحالة */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="جميع الحالات" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر الفريق */}
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <SelectValue placeholder="جميع الفرق" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفرق</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* عرض نتائج الفلترة */}
          {(searchTerm || filterStatus !== 'all' || filterTeam !== 'all') && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>عرض {filteredTasks.length} من {tasks.length} مهمة</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterTeam('all');
                }}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 ml-1" />
                إلغاء الفلاتر
              </Button>
            </div>
          )}
        </Card>

        {/* Dialog: Add Installation Task */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl">إنشاء مهمة تركيب جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="contract_search">البحث واختيار العقود *</Label>
                
                {/* حقل البحث */}
                <Input
                  id="contract_search"
                  placeholder="ابحث برقم العقد أو اسم الزبون أو نوع الإعلان..."
                  value={contractSearchTerm}
                  onChange={(e) => setContractSearchTerm(e.target.value)}
                  className="h-12"
                />

                {/* قائمة العقود المتاحة */}
                {contractsLoading ? (
                  <div className="text-sm text-muted-foreground py-4">جارِ تحميل العقود...</div>
                ) : (
                  <ScrollArea className="h-[300px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {filteredContracts.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-8">
                          لا توجد عقود تطابق البحث
                        </div>
                      ) : (
                        filteredContracts.map((c: any) => {
                          const contractNum = String(c.Contract_Number);
                          const isSelected = selectedContractNumbers.includes(contractNum);
                          
                          return (
                            <div
                              key={c.Contract_Number}
                              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => {
                                setSelectedContractNumbers(prev =>
                                  prev.includes(contractNum)
                                    ? prev.filter(n => n !== contractNum)
                                    : [...prev, contractNum]
                                );
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {}}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">عقد #{c.Contract_Number}</span>
                                  {c['Ad Type'] && (
                                    <Badge variant="outline" className="text-xs">{c['Ad Type']}</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {c['Customer Name'] || '-'}
                                </div>
                                {c['End Date'] && (
                                  <div className="text-xs text-muted-foreground">
                                    ينتهي: {format(new Date(c['End Date']), 'PPP', { locale: ar })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}

                {/* عرض العقود المختارة */}
                {selectedContractNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                    <Label className="w-full text-xs text-muted-foreground">العقود المختارة:</Label>
                    {selectedContractNumbers.map(num => {
                      const contract = contracts.find((c: any) => String(c.Contract_Number) === num);
                      return (
                        <Badge key={num} variant="secondary" className="gap-1">
                          عقد #{num}
                          {contract?.['Customer Name'] && ` - ${contract['Customer Name']}`}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContractNumbers(prev => prev.filter(n => n !== num));
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* زر تحميل اللوحات */}
                {selectedContractNumbers.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => handleContractsChange(selectedContractNumbers)}
                    className="w-full"
                  >
                    تحميل لوحات العقود المختارة ({selectedContractNumbers.length})
                  </Button>
                )}
              </div>

              {availableBillboards.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">اختر اللوحات المطلوب تركيبها</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedBillboards.length === availableBillboards.length) {
                          setSelectedBillboards([]);
                        } else {
                          setSelectedBillboards(availableBillboards.map(b => b.ID));
                        }
                      }}
                    >
                      {selectedBillboards.length === availableBillboards.length ? (
                        <><Square className="h-4 w-4 ml-2" /> إلغاء التحديد</>
                      ) : (
                        <><CheckSquare className="h-4 w-4 ml-2" /> تحديد الكل</>
                      )}
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[300px] border rounded-lg p-3">
                    <div className="space-y-3">
                      {availableBillboards.map((billboard) => (
                        <div 
                          key={billboard.ID}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedBillboards.includes(billboard.ID) 
                              ? 'border-primary bg-primary/10 shadow-md' 
                              : 'border-border hover:border-primary/50 hover:shadow-sm'
                          }`}
                          onClick={() => {
                            setSelectedBillboards(prev =>
                              prev.includes(billboard.ID)
                                ? prev.filter(id => id !== billboard.ID)
                                : [...prev, billboard.ID]
                            );
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={selectedBillboards.includes(billboard.ID)}
                              onCheckedChange={() => {}}
                              className="mt-1"
                            />
                            
                            {billboard.Image_URL && (
                              <img
                                src={billboard.Image_URL}
                                alt="Billboard"
                                className="w-24 h-20 object-cover rounded-lg border"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg';
                                }}
                              />
                            )}
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-lg">#{billboard.ID}</p>
                                <Badge variant="secondary">{billboard.Size}</Badge>
                                {billboard.Faces_Count && (
                                  <Badge variant="outline" className="text-xs">
                                    {billboard.Faces_Count} وجه
                                  </Badge>
                                )}
                              </div>
                              
                              {billboard.Billboard_Name && (
                                <p className="text-sm font-medium">{billboard.Billboard_Name}</p>
                              )}
                              
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {billboard.Municipality && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>{billboard.Municipality}</span>
                                    {billboard.District && <span> - {billboard.District}</span>}
                                  </div>
                                )}
                                
                                {billboard.Nearest_Landmark && (
                                  <div className="flex items-center gap-1">
                                    <Navigation className="h-3 w-3" />
                                    <span>{billboard.Nearest_Landmark}</span>
                                  </div>
                                )}
                                
                                {billboard.GPS_Coordinates && (
                                  <div className="flex items-center gap-1 text-primary">
                                    <MapPin className="h-3 w-3" />
                                    <span className="font-mono">{billboard.GPS_Coordinates}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="text-sm text-muted-foreground">
                    تم اختيار {selectedBillboards.length} من {availableBillboards.length} لوحة
                  </div>
                </div>
              )}

              {/* قسم التصاميم الجديدة (اختياري) */}
              {selectedBillboards.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">تصاميم الإعلانات (اختياري)</Label>
                    <Badge variant="outline" className="text-xs">
                      سيتم استخدام تصاميم العقد إذا لم يتم تحديد تصاميم جديدة
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="design_face_a" className="text-sm">رابط تصميم الوجه الأمامي</Label>
                      <Input
                        id="design_face_a"
                        type="url"
                        placeholder="https://example.com/design-front.jpg"
                        value={newDesignFaceA}
                        onChange={(e) => setNewDesignFaceA(e.target.value)}
                        className="h-10"
                      />
                      {newDesignFaceA && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                          <img
                            src={newDesignFaceA}
                            alt="معاينة الوجه الأمامي"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="design_face_b" className="text-sm">رابط تصميم الوجه الخلفي</Label>
                      <Input
                        id="design_face_b"
                        type="url"
                        placeholder="https://example.com/design-back.jpg"
                        value={newDesignFaceB}
                        onChange={(e) => setNewDesignFaceB(e.target.value)}
                        className="h-10"
                      />
                      {newDesignFaceB && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                          <img
                            src={newDesignFaceB}
                            alt="معاينة الوجه الخلفي"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 نصيحة: يمكنك استخدام روابط التصاميم من Supabase Storage أو أي خدمة تخزين أخرى
                  </p>
                </div>
              )}

              <Button
                onClick={() => createManualTasksMutation.mutate()}
                disabled={selectedContractNumbers.length === 0 || selectedBillboards.length === 0 || createManualTasksMutation.isPending}
                className="w-full h-12"
                size="lg"
              >
                {createManualTasksMutation.isPending ? 'جارِ الإنشاء...' : `إنشاء مهمة تركيب (${selectedContractNumbers.length} عقد، ${selectedBillboards.length} لوحة)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Print Options */}
        <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>خيارات الطباعة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant={printType === 'individual' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setPrintType('individual')}
                >
                  لوحات منفصلة
                </Button>
                <Button
                  variant={printType === 'table' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setPrintType('table')}
                >
                  جدول
                </Button>
              </div>
              <Button onClick={executePrint} className="w-full">
                <Printer className="h-4 w-4 ml-2" />
                طباعة
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-muted-foreground">جارِ تحميل المهام...</p>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">لا توجد مهام تركيب</p>
              <p className="text-sm text-muted-foreground mt-2">ابدأ بإنشاء مهمة تركيب جديدة</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <Search className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">لا توجد نتائج للبحث</p>
              <p className="text-sm text-muted-foreground mt-2">جرب تغيير معايير البحث أو الفلترة</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterTeam('all');
                }}
              >
                إلغاء الفلاتر
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="p-6 space-y-4">
                <Accordion type="multiple" className="space-y-4">
                  {filteredSortedContracts.map((contractId) => {
                    const contractTasks = filteredTasksByContract[contractId];
                    const contract = contractByNumber[contractId];
                    const totalItems = contractTasks.reduce((sum, task) => 
                      sum + (itemsByTask[task.id]?.length || 0), 0
                    );
                    const completedItems = contractTasks.reduce((sum, task) => 
                      sum + (itemsByTask[task.id]?.filter(i => i.status === 'completed').length || 0), 0
                    );

                    const pendingTasksInContract = contractTasks.filter(task => {
                      const taskItems = itemsByTask[task.id] || [];
                      return taskItems.some(item => item.status === 'pending');
                    });
                    const allContractTasksSelected = pendingTasksInContract.every(task => selectedTasks.has(task.id));

                    return (
                      <AccordionItem 
                        key={contractId} 
                        value={`contract-${contractId}`}
                        className="border rounded-xl bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                      >
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Package className="h-6 w-6 text-primary" />
                              </div>
                              <div className="text-right space-y-1">
                                <h3 className="text-lg font-bold">عقد #{contractId}</h3>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-muted-foreground">
                                    {contract?.['Customer Name'] || 'غير محدد'}
                                  </span>
                                  {contract?.['Ad Type'] && (
                                    <>
                                      <span className="text-muted-foreground">•</span>
                                      <Badge variant="outline" className="text-xs">
                                        {contract['Ad Type']}
                                      </Badge>
                                    </>
                                  )}
                                  {contract?.['Contract Date'] && (
                                    <>
                                      <span className="text-muted-foreground">•</span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(contract['Contract Date']), 'PPP', { locale: ar })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {pendingTasksInContract.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectAllTasksInContract(contractId);
                                  }}
                                  className="gap-2"
                                >
                                  {allContractTasksSelected ? (
                                    <><Square className="h-4 w-4" /> إلغاء تحديد الكل</>
                                  ) : (
                                    <><CheckSquare className="h-4 w-4" /> تحديد كل المهام</>
                                  )}
                                </Button>
                              )}
                              <Badge variant="secondary" className="gap-1">
                                <Users className="h-3 w-3" />
                                {contractTasks.length} فرقة
                              </Badge>
                              <Badge variant={completedItems === totalItems ? 'default' : 'outline'} className="gap-1">
                                {completedItems}/{totalItems} مكتمل
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-4">
                          <Accordion type="multiple" className="space-y-3">
                            {contractTasks.map((task) => {
                              const team = teamById[task.team_id || ''];
                              const taskItems = itemsByTask[task.id] || [];
                              const pendingItems = taskItems.filter(i => i.status === 'pending');
                              const completedItems = taskItems.filter(i => i.status === 'completed');
                              const allPendingSelected = pendingItems.every(item => selectedItems.has(item.id));

                              const isTaskSelected = selectedTasks.has(task.id);
                              const hasPendingItems = pendingItems.length > 0;

                              return (
                                <AccordionItem
                                  key={task.id}
                                  value={`task-${task.id}`}
                                  className={`border rounded-lg transition-all ${
                                    isTaskSelected 
                                      ? 'bg-primary/10 border-primary/50' 
                                      : 'bg-muted/30'
                                  }`}
                                >
                                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-3">
                                        {hasPendingItems && (
                                          <Checkbox
                                            checked={isTaskSelected}
                                            onCheckedChange={() => toggleTaskSelection(task.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 w-5"
                                          />
                                        )}
                                        <Users className="h-5 w-5 text-primary" />
                                        <div className="text-right">
                                          <p className="font-semibold">{team?.team_name || 'فرقة غير محددة'}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {taskItems.length} لوحة
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrintTask(task.id);
                                          }}
                                        >
                                          <Printer className="h-4 w-4" />
                                        </Button>
                                        {getStatusBadge(task.status)}
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-4 pb-3">
                                    <div className="space-y-4 mt-3">
                                      {/* Pending Items */}
                                      {pendingItems.length > 0 && (
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-orange-600 flex items-center gap-2">
                                              <Clock className="h-4 w-4" />
                                              قيد الانتظار ({pendingItems.length})
                                            </h4>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => toggleSelectAll(task.id)}
                                            >
                                              {allPendingSelected ? (
                                                <><Square className="h-4 w-4 ml-1" /> إلغاء التحديد</>
                                              ) : (
                                                <><CheckSquare className="h-4 w-4 ml-1" /> تحديد الكل</>
                                              )}
                                            </Button>
                                          </div>
                                          {pendingItems.map((item) => {
                                            const billboard = billboardById[item.billboard_id];
                                            return (
                                              <div key={item.id} className="flex items-start gap-3 p-4 bg-background rounded-lg border hover:border-primary/50 transition-colors">
                                                <Checkbox
                                                  checked={selectedItems.has(item.id)}
                                                  onCheckedChange={(checked) => {
                                                    const newSet = new Set(selectedItems);
                                                    if (checked) {
                                                      newSet.add(item.id);
                                                      setSelectedTeamId(task.id);
                                                    } else {
                                                      newSet.delete(item.id);
                                                    }
                                                    setSelectedItems(newSet);
                                                  }}
                                                  className="mt-1"
                                                />
                                                <div className="flex-1 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <p className="font-bold text-lg">#{item.billboard_id}</p>
                                                    {billboard?.GPS_Coordinates && (
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 gap-1"
                                                        onClick={() => window.open(`https://www.google.com/maps?q=${billboard.GPS_Coordinates}`, '_blank')}
                                                      >
                                                        <Navigation className="h-3 w-3" />
                                                        إحداثيات
                                                      </Button>
                                                    )}
                                                  </div>
                                                  <p className="text-sm font-medium">
                                                    {billboard?.Billboard_Name || '-'}
                                                  </p>
                                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <Badge variant="secondary">{billboard?.Size || '-'}</Badge>
                                                    {billboard?.Municipality && (
                                                      <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {billboard.Municipality}
                                                      </span>
                                                    )}
                                                    {billboard?.Nearest_Landmark && (
                                                      <>
                                                        <span>•</span>
                                                        <span>{billboard.Nearest_Landmark}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                                {billboard?.Image_URL && (
                                                  <div className="relative group">
                                                    <img
                                                      src={billboard.Image_URL}
                                                      alt="صورة اللوحة"
                                                      className="w-20 h-14 object-cover rounded cursor-pointer"
                                                      onClick={() => setImagePreview(billboard.Image_URL)}
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                      <ZoomIn className="h-5 w-5 text-white" />
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Completed Items */}
                                      {completedItems.length > 0 && (
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-semibold text-green-600 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" />
                                            مكتمل ({completedItems.length})
                                          </h4>
                                          {completedItems.map((item) => {
                                            const billboard = billboardById[item.billboard_id];
                                            return (
                                              <div key={item.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                                                <div className="flex items-start gap-3">
                                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                                                  <div className="flex-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                      <p className="font-bold text-lg">#{item.billboard_id}</p>
                                                      {billboard?.GPS_Coordinates && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-8 gap-1"
                                                          onClick={() => window.open(`https://www.google.com/maps?q=${billboard.GPS_Coordinates}`, '_blank')}
                                                        >
                                                          <Navigation className="h-3 w-3" />
                                                          إحداثيات
                                                        </Button>
                                                      )}
                                                    </div>
                                                    <p className="text-sm font-medium">
                                                      {billboard?.Billboard_Name || '-'}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                      <Badge variant="secondary">{billboard?.Size || '-'}</Badge>
                                                      {billboard?.Municipality && (
                                                        <span className="flex items-center gap-1">
                                                          <MapPin className="h-3 w-3" />
                                                          {billboard.Municipality}
                                                        </span>
                                                      )}
                                                      {billboard?.Nearest_Landmark && (
                                                        <>
                                                          <span>•</span>
                                                          <span>{billboard.Nearest_Landmark}</span>
                                                        </>
                                                      )}
                                                    </div>
                                                    <p className="text-xs text-green-700 font-medium">
                                                      تم التركيب: {item.installation_date ? format(new Date(item.installation_date), 'PPP', { locale: ar }) : '-'}
                                                    </p>
                                                    {item.notes && (
                                                      <p className="text-xs mt-1 p-2 bg-white rounded border">
                                                        {item.notes}
                                                      </p>
                                                    )}
                                                  </div>
                                                  {billboard?.Image_URL && (
                                                    <div className="relative group">
                                                      <img
                                                        src={billboard.Image_URL}
                                                        alt="صورة اللوحة"
                                                        className="w-20 h-14 object-cover rounded cursor-pointer"
                                                        onClick={() => setImagePreview(billboard.Image_URL)}
                                                      />
                                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                        <ZoomIn className="h-5 w-5 text-white" />
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Floating Action Panel - Individual Items */}
        {selectedItems.size > 0 && (
          <Card className="fixed bottom-6 left-1/2 -translate-x-1/2 p-4 shadow-2xl border-2 border-primary/20 w-[90%] max-w-2xl bg-background/95 backdrop-blur-sm" dir="rtl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">تأكيد التركيب</h3>
                <Badge className="text-base px-3 py-1">
                  {selectedItems.size} لوحة محددة
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">تاريخ التركيب</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {installDate ? format(installDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={installDate}
                        onSelect={setInstallDate}
                        locale={ar}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm mb-2 block">ملاحظات</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أضف ملاحظات حول التركيب..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedItems(new Set());
                    setNotes('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => completeItemsMutation.mutate()}
                  disabled={completeItemsMutation.isPending}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  تأكيد التركيب
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Floating Action Panel - Complete Tasks */}
        {selectedTasks.size > 0 && (
          <Card className="fixed bottom-6 left-1/2 -translate-x-1/2 p-4 shadow-2xl border-2 border-primary/20 w-[90%] max-w-2xl bg-background/95 backdrop-blur-sm" dir="rtl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">تأكيد تركيب المهام</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {selectedTasks.size} مهمة
                  </Badge>
                  <Badge className="text-base px-3 py-1">
                    {Array.from(selectedTasks).reduce((sum, taskId) => {
                      const items = itemsByTask[taskId] || [];
                      return sum + items.filter(i => i.status === 'pending').length;
                    }, 0)} لوحة
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">تاريخ التركيب</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {installDate ? format(installDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={installDate}
                        onSelect={setInstallDate}
                        locale={ar}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm mb-2 block">ملاحظات</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أضف ملاحظات حول التركيب..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedTasks(new Set());
                    setNotes('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => completeTasksMutation.mutate()}
                  disabled={completeTasksMutation.isPending}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  تأكيد التركيب الكامل
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Billboard Print Individual Component */}
        {billboardPrintData && (
          <div style={{ display: 'none' }}>
            <BillboardPrintIndividual
              contractNumber={billboardPrintData.contractNumber}
              billboards={billboardPrintData.billboards}
              designFaceA={billboardPrintData.designFaceA}
              designFaceB={billboardPrintData.designFaceB}
            />
          </div>
        )}

        {/* Image Preview Dialog */}
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>معاينة الصورة</DialogTitle>
            </DialogHeader>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="معاينة"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
