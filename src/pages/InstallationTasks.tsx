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
  Filter,
  PaintBucket,
  Image as ImageIcon,
  Trash2,
  Camera
} from 'lucide-react';
import { BillboardPrintIndividual } from '@/components/contracts/BillboardPrintIndividual';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';

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
  installed_image_url: string | null;
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
    designData?: any[] | null;
    taskItems?: any[];
  } | null>(null);
  const [selectedPrintTeam, setSelectedPrintTeam] = useState<string>('all');
  const [newDesignFaceA, setNewDesignFaceA] = useState<string>('');
  const [newDesignFaceB, setNewDesignFaceB] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedTaskForDesign, setSelectedTaskForDesign] = useState<string | null>(null);
  const [taskDesigns, setTaskDesigns] = useState<Record<string, { designFaceA: string; designFaceB: string }>>({});
  // ✅ NEW: تخصيص تصميم لوحة واحدة
  const [singleBillboardDesignDialog, setSingleBillboardDesignDialog] = useState(false);
  const [selectedBillboardForDesign, setSelectedBillboardForDesign] = useState<{itemId: string; billboardId: number; billboardName: string} | null>(null);
  const [singleDesignFaceA, setSingleDesignFaceA] = useState('');
  const [singleDesignFaceB, setSingleDesignFaceB] = useState('');
  const [singleInstalledImageUrl, setSingleInstalledImageUrl] = useState('');
  // ✅ NEW: فلتر سريع للمعلقة فقط
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['installation-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_tasks')
        .select(`*`)
        .gte('created_at', '2025-10-01T00:00:00Z') // فقط المهام من شهر 10/2025
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

  // ✅ FIX: استعلام فريد لمنع التكرار + دمج المهام المتشابهة
  const { data: allTaskItems = [] } = useQuery({
    queryKey: ['all-installation-task-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // ✅ FIX: إزالة التكرارات الكاملة (نفس task_id و billboard_id و status)
      // للحفاظ على اللوحات المكتملة والمعلقة منفصلة
      const uniqueItems = data?.filter((item, index, self) =>
        index === self.findIndex(t => 
          t.task_id === item.task_id && 
          t.billboard_id === item.billboard_id &&
          t.status === item.status
        )
      ) || [];
      
      return uniqueItems as InstallationTaskItem[];
    },
  });

  const billboardIds = allTaskItems.map((i) => i.billboard_id).filter(Boolean);
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-task', billboardIds.join(',')],
    enabled: billboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
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

      // ✅ NEW: التحقق من وجود مهام معلقة بالفعل لنفس اللوحات
      const { data: existingTasks } = await supabase
        .from('installation_task_items')
        .select('billboard_id, task_id, installation_tasks!inner(status, contract_id)')
        .in('billboard_id', selectedBillboards)
        .in('installation_tasks.contract_id', selectedContractNumbers.map(n => Number(n)))
        .eq('status', 'pending');

      if (existingTasks && existingTasks.length > 0) {
        const existingBillboards = existingTasks.map(t => t.billboard_id);
        const duplicates = selectedBillboards.filter(id => existingBillboards.includes(id));
        
        if (duplicates.length > 0) {
          throw new Error(`توجد مهام تركيب معلقة بالفعل لهذه اللوحات: ${duplicates.join(', ')}`);
        }
      }

      // جلب التصاميم من العقود إذا لم يتم تحديد تصاميم جديدة
      let designFaceA = newDesignFaceA || null;
      let designFaceB = newDesignFaceB || null;

      // إذا لم يتم تحديد تصاميم جديدة، نحاول جلبها من العقد الأول
      if (!designFaceA && !designFaceB && selectedContractNumbers.length > 0) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('design_data')
          .eq('Contract_Number', Number(selectedContractNumbers[0]))
          .single();
        
        if (contractData && contractData.design_data) {
          try {
            const designsData = typeof contractData.design_data === 'string' 
              ? JSON.parse(contractData.design_data) 
              : contractData.design_data;
            
            if (Array.isArray(designsData) && designsData.length > 0) {
              designFaceA = designsData[0]?.designFaceA || designsData[0]?.design_face_a;
              designFaceB = designsData[0]?.designFaceB || designsData[0]?.design_face_b;
            }
          } catch (e) {
            console.error('Error parsing design_data:', e);
          }
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

  // ✅ NEW: حذف المهام المكررة لعقد معين
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // حذف بنود المهمة أولاً
      const { error: itemsError } = await supabase
        .from('installation_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      // ثم حذف المهمة نفسها
      const { error: taskError } = await supabase
        .from('installation_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-installation-task-items'] });
    },
    onError: (error) => {
      toast.error('خطأ في حذف المهمة: ' + error.message);
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
      // ✅ FIXED: استخدام التصاميم من installation_task_items بدلاً من العقد
      const designData = taskItems.map(item => ({
        billboardId: String(item.billboard_id),
        faceA: item.design_face_a || '',
        faceB: item.design_face_b || '',
        billboardName: billboardById[item.billboard_id]?.Billboard_Name || ''
      }));
      
      setBillboardPrintData({
        contractNumber: contract?.Contract_Number || task.contract_id,
        billboards: taskBillboards,
        designData: designData,
        taskItems: taskItems // ✅ NEW: تمرير بيانات مهام التركيب
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

  // ✅ تجميع المهام حسب الفرقة (بدلاً من العقد)
  const tasksByTeam = useMemo(() => {
    const grouped: Record<string, InstallationTask[]> = {};
    tasks.forEach(task => {
      const teamId = task.team_id || 'unknown';
      if (!grouped[teamId]) {
        grouped[teamId] = [];
      }
      grouped[teamId].push(task);
    });
    return grouped;
  }, [tasks]);

  // ترتيب الفرق حسب أحدث مهمة
  const sortedTeams = useMemo(() => {
    return Object.keys(tasksByTeam).sort((a, b) => {
      const tasksA = tasksByTeam[a] || [];
      const tasksB = tasksByTeam[b] || [];
      
      const latestA = tasksA.length > 0 
        ? Math.max(...tasksA.map(t => new Date(t.created_at).getTime()))
        : 0;
      const latestB = tasksB.length > 0 
        ? Math.max(...tasksB.map(t => new Date(t.created_at).getTime()))
        : 0;
      
      return latestB - latestA;
    });
  }, [tasksByTeam]);

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

    // ✅ NEW: فلتر المعلقة فقط
    if (showPendingOnly) {
      filtered = filtered.filter(task => {
        const items = itemsByTask[task.id] || [];
        return items.some(item => item.status === 'pending');
      });
    }

    return filtered;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractByNumber, showPendingOnly, itemsByTask]);

  // تجميع المهام المفلترة حسب الفرقة
  const filteredTasksByTeam = useMemo(() => {
    const grouped: Record<string, InstallationTask[]> = {};
    filteredTasks.forEach(task => {
      const teamId = task.team_id || 'unknown';
      if (!grouped[teamId]) {
        grouped[teamId] = [];
      }
      grouped[teamId].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  // ترتيب الفرق المفلترة
  const filteredSortedTeams = useMemo(() => {
    return Object.keys(filteredTasksByTeam).sort((a, b) => {
      const tasksA = filteredTasksByTeam[a] || [];
      const tasksB = filteredTasksByTeam[b] || [];
      
      const latestA = tasksA.length > 0 
        ? Math.max(...tasksA.map(t => new Date(t.created_at).getTime()))
        : 0;
      const latestB = tasksB.length > 0 
        ? Math.max(...tasksB.map(t => new Date(t.created_at).getTime()))
        : 0;
      
      return latestB - latestA;
    });
  }, [filteredTasksByTeam]);

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

  // ✅ NEW: فتح dialog لتعديل التصاميم
  const openDesignDialog = async (taskId: string) => {
    setSelectedTaskForDesign(taskId);
    
    // جلب التصاميم الحالية من قاعدة البيانات
    const taskItems = itemsByTask[taskId] || [];
    if (taskItems.length > 0) {
      const firstItem = taskItems[0];
      setTaskDesigns(prev => ({
        ...prev,
        [taskId]: {
          designFaceA: firstItem.design_face_a || '',
          designFaceB: firstItem.design_face_b || ''
        }
      }));
    }
    
    setDesignDialogOpen(true);
  };

  // ✅ NEW: حفظ التصاميم لجميع لوحات المهمة
  const saveTaskDesignsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskForDesign) return;
      
      const taskItems = itemsByTask[selectedTaskForDesign] || [];
      const designs = taskDesigns[selectedTaskForDesign];
      
      if (!designs) {
        throw new Error('لم يتم تحديد التصاميم');
      }

      // تحديث جميع اللوحات في المهمة بنفس التصميم
      const updates = taskItems.map(item => ({
        id: item.id,
        task_id: item.task_id,
        billboard_id: item.billboard_id,
        design_face_a: designs.designFaceA || null,
        design_face_b: designs.designFaceB || null,
        status: item.status,
        installation_date: item.installation_date,
        completed_at: item.completed_at,
        notes: item.notes
      }));

      const { error } = await supabase
        .from('installation_task_items')
        .upsert(updates);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حفظ التصاميم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['all-installation-task-items'] });
      setDesignDialogOpen(false);
      setSelectedTaskForDesign(null);
    },
    onError: (error) => {
      toast.error('خطأ في حفظ التصاميم: ' + error.message);
    },
  });

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

  // ✅ NEW: حفظ تصميم لوحة واحدة فقط
  const saveSingleBillboardDesignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBillboardForDesign) {
        throw new Error('لم يتم تحديد اللوحة');
      }

      const { error } = await supabase
        .from('installation_task_items')
        .update({
          design_face_a: singleDesignFaceA || null,
          design_face_b: singleDesignFaceB || null,
          installed_image_url: singleInstalledImageUrl || null
        })
        .eq('id', selectedBillboardForDesign.itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حفظ بيانات اللوحة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['all-installation-task-items'] });
      setSingleBillboardDesignDialog(false);
      setSelectedBillboardForDesign(null);
      setSingleDesignFaceA('');
      setSingleDesignFaceB('');
      setSingleInstalledImageUrl('');
    },
    onError: (error) => {
      toast.error('خطأ في حفظ البيانات: ' + error.message);
    },
  });

  // ✅ NEW: فتح dialog لتخصيص تصميم لوحة واحدة
  const openSingleBillboardDesignDialog = async (itemId: string, billboardId: number) => {
    const item = allTaskItems.find(i => i.id === itemId);
    const billboard = billboardById[billboardId];
    
    if (!item || !billboard) return;

    setSelectedBillboardForDesign({
      itemId,
      billboardId,
      billboardName: billboard.Billboard_Name || `لوحة #${billboardId}`
    });

    setSingleDesignFaceA(item.design_face_a || '');
    setSingleDesignFaceB(item.design_face_b || '');
    setSingleInstalledImageUrl(item.installed_image_url || '');
    setSingleBillboardDesignDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3">
            <h1 className="text-5xl font-extrabold bg-gradient-to-l from-primary via-accent to-primary bg-clip-text text-transparent">
              مهام التركيب
            </h1>
            <p className="text-lg text-muted-foreground flex items-center gap-2">
              <Package className="h-5 w-5" />
              إدارة ومتابعة مهام تركيب اللوحات الإعلانية
            </p>
          </div>
          <Button 
            onClick={() => setManualOpen(true)}
            size="lg"
            className="gap-3 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
          >
            <Package className="h-5 w-5" />
            إضافة مهمة تركيب
          </Button>
        </div>

        {/* 🔍 البحث والفلترة */}
        <Card className="p-4 border-none shadow-lg bg-card/50 backdrop-blur-sm">
          {/* ✅ NEW: زر فلتر سريع للمعلقة فقط */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            <Button
              variant={showPendingOnly ? 'default' : 'outline'}
              size="lg"
              onClick={() => setShowPendingOnly(!showPendingOnly)}
              className="gap-2"
            >
              <Clock className="h-5 w-5" />
              {showPendingOnly ? 'عرض الكل' : 'المعلقة فقط'}
            </Button>
            {showPendingOnly && (
              <Badge variant="secondary" className="text-base px-3 py-1">
                {filteredTasks.reduce((sum, task) => {
                  const items = itemsByTask[task.id] || [];
                  return sum + items.filter(i => i.status === 'pending').length;
                }, 0)} لوحة معلقة
              </Badge>
            )}
          </div>

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
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Tasks List - Grouped by Team with Contract Grouping */}
                <Accordion type="multiple" className="space-y-4">
                  {filteredSortedTeams.map((teamId) => {
                    const teamTasks = filteredTasksByTeam[teamId] || [];
                    const team = teamById[teamId];
                    
                    // تجميع المهام حسب العقد داخل الفريق
                    const tasksByContractInTeam: Record<number, InstallationTask[]> = {};
                    teamTasks.forEach(task => {
                      if (!tasksByContractInTeam[task.contract_id]) {
                        tasksByContractInTeam[task.contract_id] = [];
                      }
                      tasksByContractInTeam[task.contract_id].push(task);
                    });

                    const contractIdsInTeam = Object.keys(tasksByContractInTeam).map(Number);
                    
                    // حساب إحصائيات الفريق
                    const totalItems = teamTasks.reduce((sum, task) => {
                      const items = itemsByTask[task.id] || [];
                      return sum + items.length;
                    }, 0);
                    
                    const completedItemsCount = teamTasks.reduce((sum, task) => {
                      const items = itemsByTask[task.id] || [];
                      return sum + items.filter(i => i.status === 'completed').length;
                    }, 0);

                    const pendingItemsCount = totalItems - completedItemsCount;

                    // جمع كل اللوحات المعلقة للفريق (بدون تكرار)
                    const allPendingItemsMap = new Map<string, InstallationTaskItem>();
                    teamTasks.forEach(task => {
                      const items = itemsByTask[task.id] || [];
                      items.filter(i => i.status === 'pending').forEach(item => {
                        // استخدام billboard_id كمفتاح فريد لتجنب التكرار
                        allPendingItemsMap.set(item.id, item);
                      });
                    });
                    const allPendingItems = Array.from(allPendingItemsMap.values());

                    // التحقق من التحديد الكلي
                    const allTeamItemsSelected = allPendingItems.length > 0 && allPendingItems.every(item => selectedItems.has(item.id));

                    return (
                      <AccordionItem 
                        key={teamId} 
                        value={`team-${teamId}`}
                        className="border-2 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                      >
                        <AccordionTrigger className="hover:no-underline px-6 py-5 bg-gradient-to-r from-primary/10 via-primary/5 to-background hover:from-primary/15 hover:via-primary/8 hover:to-background/50">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center ring-4 ring-primary/20 shadow-lg">
                                <Users className="h-8 w-8 text-primary" />
                              </div>
                              <div className="space-y-1 text-right">
                                <h3 className="text-2xl font-bold">{team?.team_name || 'فرقة غير محددة'}</h3>
                                <div className="flex items-center gap-3 text-sm">
                                  <Badge variant="secondary" className="gap-1 text-sm px-3 py-1">
                                    <Package className="h-4 w-4" />
                                    {contractIdsInTeam.length} عقد
                                  </Badge>
                                  <Badge variant="outline" className="gap-1 text-sm px-3 py-1">
                                    {totalItems} لوحة
                                  </Badge>
                                  <Badge 
                                    variant={pendingItemsCount === 0 ? 'default' : 'secondary'} 
                                    className="gap-1 text-sm px-3 py-1"
                                  >
                                    <Clock className="h-4 w-4" />
                                    {pendingItemsCount} معلق
                                  </Badge>
                                  <Badge variant="default" className="gap-1 text-sm px-3 py-1 bg-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {completedItemsCount} مكتمل
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {allPendingItems.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(selectedItems);
                                    if (allTeamItemsSelected) {
                                      allPendingItems.forEach(item => newSet.delete(item.id));
                                    } else {
                                      allPendingItems.forEach(item => newSet.add(item.id));
                                      if (teamTasks.length > 0) {
                                        setSelectedTeamId(teamTasks[0].id);
                                      }
                                    }
                                    setSelectedItems(newSet);
                                  }}
                                  className="gap-2 px-6"
                                >
                                  {allTeamItemsSelected ? (
                                    <><Square className="h-5 w-5" /> إلغاء الكل</>
                                  ) : (
                                    <><CheckSquare className="h-5 w-5" /> تحديد الكل</>
                                  )}
                                </Button>
                              )}
                              <ChevronDown className="h-6 w-6 text-muted-foreground transition-transform" />
                            </div>
                          </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="px-6 py-6">
                          {/* Tasks grouped by Contract */}
                          <div className="space-y-6">
                            {contractIdsInTeam.map((contractId) => {
                              const contractTasks = tasksByContractInTeam[contractId] || [];
                              const contract = contractByNumber[contractId];
                              
                              // جمع كل اللوحات من جميع مهام هذا العقد (بدون تكرار)
                              const contractItemsMap = new Map<number, InstallationTaskItem>();
                              contractTasks.forEach(task => {
                                const items = itemsByTask[task.id] || [];
                                items.forEach(item => {
                                  // استخدام billboard_id كمفتاح فريد
                                  if (!contractItemsMap.has(item.billboard_id)) {
                                    contractItemsMap.set(item.billboard_id, item);
                                  }
                                });
                              });
                              
                              const allContractItems = Array.from(contractItemsMap.values());
                              const pendingItems = allContractItems.filter(i => i.status === 'pending');
                              const completedItems = allContractItems.filter(i => i.status === 'completed');

                              return (
                                <div key={contractId} className="space-y-4 p-5 bg-muted/20 rounded-xl border-2 w-full max-w-full overflow-x-hidden">
                                  {/* Contract Header */}
                                  <div className="flex items-center justify-between p-4 bg-background rounded-lg border-2 border-primary/20 shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <Package className="h-6 w-6 text-primary" />
                                      <div>
                                        <p className="text-xl font-bold">عقد #{contractId}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {contract?.['Customer Name'] || 'غير محدد'} • {contract?.['Ad Type'] || 'غير محدد'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {contractTasks.map((task) => (
                                        <div key={task.id} className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                                deleteTaskMutation.mutate(task.id);
                                              }
                                            }}
                                            className="text-destructive hover:text-destructive h-9"
                                            title="حذف المهمة"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openDesignDialog(task.id)}
                                            title="إدارة التصاميم"
                                            className="h-9"
                                          >
                                            <PaintBucket className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handlePrintTask(task.id)}
                                            className="h-9"
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                          {getStatusBadge(task.status)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Pending Billboards in larger grid */}
                                  {pendingItems.length > 0 && (
                                    <div className="space-y-4 w-full">
                                      <div className="flex items-center justify-between px-2">
                                        <h4 className="text-base font-bold text-orange-600 flex items-center gap-2">
                                          <Clock className="h-5 w-5" />
                                          قيد الانتظار ({pendingItems.length})
                                        </h4>
                                      </div>
                                      <div className="grid w-full max-w-full gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {pendingItems.map((item) => {
                                          const billboard = billboardById[item.billboard_id];
                                          const relatedTask = contractTasks.find(t => {
                                            const items = itemsByTask[t.id] || [];
                                            return items.some(i => i.billboard_id === item.billboard_id);
                                          });
                                          
                                          return (
                                             <BillboardTaskCard
                                               key={item.id}
                                               item={item}
                                               billboard={billboard}
                                               isSelected={selectedItems.has(item.id)}
                                               isCompleted={false}
                                               onSelectionChange={(checked) => {
                                                 const newSet = new Set(selectedItems);
                                                 if (checked) {
                                                   newSet.add(item.id);
                                                   if (relatedTask) {
                                                     setSelectedTeamId(relatedTask.id);
                                                   }
                                                 } else {
                                                   newSet.delete(item.id);
                                                 }
                                                 setSelectedItems(newSet);
                                               }}
                                               onEditDesign={() => openSingleBillboardDesignDialog(item.id, item.billboard_id)}
                                             />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Completed Billboards - Enhanced */}
                                  {completedItems.length > 0 && (
                                    <div className="space-y-4 mt-6 w-full">
                                      <h4 className="text-base font-bold text-green-600 flex items-center gap-2 px-2">
                                        <CheckCircle2 className="h-5 w-5" />
                                        مكتمل ({completedItems.length})
                                      </h4>
                                       <div className="grid w-full max-w-full gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {completedItems.map((item) => {
                                          const billboard = billboardById[item.billboard_id];
                                          return (
                                             <BillboardTaskCard
                                               key={item.id}
                                               item={item}
                                               billboard={billboard}
                                               isSelected={false}
                                               isCompleted={true}
                                               onSelectionChange={() => {}}
                                               onEditDesign={() => openSingleBillboardDesignDialog(item.id, item.billboard_id)}
                                             />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
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
              designData={billboardPrintData.designData}
              taskItems={billboardPrintData.taskItems}
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
              <img src={imagePreview} alt="معاينة" className="w-full h-auto rounded-lg" />
            )}
          </DialogContent>
        </Dialog>

        {/* ✅ NEW: Design Management Dialog */}
        <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <PaintBucket className="h-6 w-6 text-primary" />
                إدارة تصاميم اللوحات
              </DialogTitle>
            </DialogHeader>
            
            {selectedTaskForDesign && (
              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-bold">
                      {teamById[tasks.find(t => t.id === selectedTaskForDesign)?.team_id || '']?.team_name || 'فرقة غير محددة'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    عدد اللوحات: {(itemsByTask[selectedTaskForDesign] || []).length}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">تصميم الوجه الأمامي (A)</Label>
                      {taskDesigns[selectedTaskForDesign]?.designFaceA && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = taskDesigns[selectedTaskForDesign]?.designFaceA;
                            if (url) window.open(url, '_blank');
                          }}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          معاينة
                        </Button>
                      )}
                    </div>
                    <Input
                      type="url"
                      placeholder="https://example.com/design-front.jpg"
                      value={taskDesigns[selectedTaskForDesign]?.designFaceA || ''}
                      onChange={(e) => {
                        setTaskDesigns(prev => ({
                          ...prev,
                          [selectedTaskForDesign]: {
                            ...prev[selectedTaskForDesign],
                            designFaceA: e.target.value
                          }
                        }));
                      }}
                      className="h-12"
                    />
                    {taskDesigns[selectedTaskForDesign]?.designFaceA && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                        <img
                          src={taskDesigns[selectedTaskForDesign].designFaceA}
                          alt="معاينة الوجه الأمامي"
                          className="w-full h-full object-contain bg-muted"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">تصميم الوجه الخلفي (B)</Label>
                      {taskDesigns[selectedTaskForDesign]?.designFaceB && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = taskDesigns[selectedTaskForDesign]?.designFaceB;
                            if (url) window.open(url, '_blank');
                          }}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          معاينة
                        </Button>
                      )}
                    </div>
                    <Input
                      type="url"
                      placeholder="https://example.com/design-back.jpg"
                      value={taskDesigns[selectedTaskForDesign]?.designFaceB || ''}
                      onChange={(e) => {
                        setTaskDesigns(prev => ({
                          ...prev,
                          [selectedTaskForDesign]: {
                            ...prev[selectedTaskForDesign],
                            designFaceB: e.target.value
                          }
                        }));
                      }}
                      className="h-12"
                    />
                    {taskDesigns[selectedTaskForDesign]?.designFaceB && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                        <img
                          src={taskDesigns[selectedTaskForDesign].designFaceB}
                          alt="معاينة الوجه الخلفي"
                          className="w-full h-full object-contain bg-muted"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-5 w-5 text-primary mt-0.5" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-primary">نصائح للتصاميم:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>استخدم روابط مباشرة للصور من Supabase Storage أو خدمات التخزين السحابية</li>
                        <li>تأكد من أن الصور بجودة عالية للطباعة الواضحة</li>
                        <li>سيتم تطبيق هذه التصاميم على جميع اللوحات في هذه المهمة</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDesignDialogOpen(false);
                      setSelectedTaskForDesign(null);
                    }}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => saveTaskDesignsMutation.mutate()}
                    disabled={saveTaskDesignsMutation.isPending}
                    className="flex-1 gap-2"
                  >
                    <PaintBucket className="h-4 w-4" />
                    {saveTaskDesignsMutation.isPending ? 'جاري الحفظ...' : 'حفظ التصاميم'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ✅ NEW: Single Billboard Design Dialog */}
        <Dialog open={singleBillboardDesignDialog} onOpenChange={setSingleBillboardDesignDialog}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <PaintBucket className="h-6 w-6 text-accent" />
                تخصيص تصميم اللوحة
              </DialogTitle>
            </DialogHeader>
            
            {selectedBillboardForDesign && (
              <div className="space-y-6">
                <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-accent" />
                    <span className="font-bold text-accent">
                      {selectedBillboardForDesign.billboardName}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    رقم اللوحة: #{selectedBillboardForDesign.billboardId}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">تصميم الوجه الأمامي (A)</Label>
                      {singleDesignFaceA && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(singleDesignFaceA, '_blank')}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          معاينة
                        </Button>
                      )}
                    </div>
                    <Input
                      type="url"
                      placeholder="https://example.com/design-front.jpg"
                      value={singleDesignFaceA}
                      onChange={(e) => setSingleDesignFaceA(e.target.value)}
                      className="h-12"
                    />
                    {singleDesignFaceA && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                        <img
                          src={singleDesignFaceA}
                          alt="معاينة الوجه الأمامي"
                          className="w-full h-full object-contain bg-muted"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">تصميم الوجه الخلفي (B)</Label>
                      {singleDesignFaceB && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(singleDesignFaceB, '_blank')}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          معاينة
                        </Button>
                      )}
                    </div>
                    <Input
                      type="url"
                      placeholder="https://example.com/design-back.jpg"
                      value={singleDesignFaceB}
                      onChange={(e) => setSingleDesignFaceB(e.target.value)}
                      className="h-12"
                    />
                    {singleDesignFaceB && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                        <img
                          src={singleDesignFaceB}
                          alt="معاينة الوجه الخلفي"
                          className="w-full h-full object-contain bg-muted"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* ✅ NEW: حقل صورة اللوحة بعد التركيب */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="h-5 w-5 text-green-600" />
                      <Label className="text-base font-semibold text-green-600">صورة اللوحة بعد التركيب</Label>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">ستظهر هذه الصورة في التقارير المطبوعة بدلاً من الصورة الأصلية</p>
                      {singleInstalledImageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(singleInstalledImageUrl, '_blank')}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          معاينة
                        </Button>
                      )}
                    </div>
                    <Input
                      type="url"
                      placeholder="https://example.com/installed-billboard.jpg"
                      value={singleInstalledImageUrl}
                      onChange={(e) => setSingleInstalledImageUrl(e.target.value)}
                      className="h-12"
                    />
                    {singleInstalledImageUrl && (
                      <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-green-300">
                        <img
                          src={singleInstalledImageUrl}
                          alt="معاينة اللوحة بعد التركيب"
                          className="w-full h-full object-contain bg-muted"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                    <p className="mb-2">💡 <strong>ملاحظة:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>سيتم تطبيق هذا التصميم على هذه اللوحة فقط</li>
                      <li>يمكنك تخصيص تصميم مختلف لكل لوحة على حدة</li>
                      <li>التصميم سيظهر في الطباعة الفردية للوحات</li>
                      <li><strong className="text-green-600">صورة اللوحة بعد التركيب ستحل محل الصورة الأصلية في التقارير</strong></li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSingleBillboardDesignDialog(false);
                      setSelectedBillboardForDesign(null);
                      setSingleDesignFaceA('');
                      setSingleDesignFaceB('');
                      setSingleInstalledImageUrl('');
                    }}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => saveSingleBillboardDesignMutation.mutate()}
                    disabled={saveSingleBillboardDesignMutation.isPending}
                    className="flex-1 gap-2 bg-accent hover:bg-accent/90"
                  >
                    <PaintBucket className="h-4 w-4" />
                    {saveSingleBillboardDesignMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
