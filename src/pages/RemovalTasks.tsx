import { useState, useMemo, useEffect } from 'react';
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
  Trash2,
  Camera,
  BarChart3
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillboardPrintIndividual } from '@/components/contracts/BillboardPrintIndividual';
import { RemovalStatsDialog } from '@/components/reports/RemovalStatsDialog';

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
  design_face_a?: string | null;
  design_face_b?: string | null;
  billboards?: any;
}

export default function RemovalTasks() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [removalDate, setRemovalDate] = useState<Date | undefined>(new Date());
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
    printMode?: 'installation' | 'removal';
  } | null>(null);
  const [selectedPrintTeam, setSelectedPrintTeam] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['removal-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('removal_tasks')
        .select(`*`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RemovalTask[];
    },
  });

  // جلب جميع العقود المنتهية تلقائياً
  const { data: expiredContracts = [] } = useQuery({
    queryKey: ['expired-contracts-auto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date"')
        .lte('"End Date"', new Date().toISOString())
        .gte('"End Date"', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('installation_teams').select('id, team_name');
      if (error) throw error;
      return data as any[];
    },
  });

  // ✅ إنشاء مهام تلقائية للعقود المنتهية مع منع التكرار
  useEffect(() => {
    const createAutoRemovalTasks = async () => {
      if (!expiredContracts || expiredContracts.length === 0 || !tasks || !teams || teams.length === 0) return;

      // جمع جميع أرقام العقود التي لها مهام موجودة (معلقة أو قيد التنفيذ أو مكتملة)
      const existingTaskContractIds = new Set(
        tasks
          .filter(t => t.status === 'pending' || t.status === 'in_progress')
          .flatMap(t => t.contract_ids || [t.contract_id])
      );

      // جمع جميع اللوحات الموجودة في المهام المعلقة أو قيد التنفيذ
      const { data: existingTaskItems } = await supabase
        .from('removal_task_items')
        .select('billboard_id, removal_tasks!inner(status)')
        .in('removal_tasks.status', ['pending', 'in_progress']);
      
      const billboardsInPendingTasks = new Set(existingTaskItems?.map(item => item.billboard_id) || []);

      for (const contract of expiredContracts) {
        // ✅ تخطي العقد إذا كانت له مهمة موجودة بالفعل
        if (existingTaskContractIds.has(contract.Contract_Number)) {
          continue;
        }

        // استخرج اللوحات من العقد
        if (!contract.billboard_ids) continue;
        const billboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        if (billboardIds.length === 0) continue;

        // جلب اللوحات من العقد المنتهي فقط
        const { data: contractBillboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIds);

        if (billError || !contractBillboards || contractBillboards.length === 0) continue;

        // ✅ تصفية اللوحات: فقط المنتهي عقدها وغير المؤجرة حالياً
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const availableBillboards = contractBillboards.filter(billboard => {
          // استبعاد اللوحات الموجودة بالفعل في مهام معلقة
          if (billboardsInPendingTasks.has(billboard.ID)) return false;
          
          // ✅ التحقق الصارم من حالة الإيجار
          const currentContractNumber = billboard.Contract_Number;
          const rentEndDate = billboard.Rent_End_Date;
          
          // إذا كانت اللوحة مؤجرة لعقد آخر نشط، استبعدها
          if (currentContractNumber && currentContractNumber !== contract.Contract_Number) {
            // تحقق إذا كان العقد الحالي نشط
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              if (endDate >= today) {
                // العقد الآخر لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // إذا كانت اللوحة من نفس العقد المنتهي
          if (!currentContractNumber || currentContractNumber === contract.Contract_Number) {
            // تحقق من أن العقد فعلاً انتهى
            if (!rentEndDate) return false; // لا يوجد تاريخ = لا تضمها
            
            const endDate = new Date(rentEndDate);
            // متاح فقط إذا انتهى العقد فعلاً
            return endDate < today;
          }
          
          return false;
        });

        if (availableBillboards.length === 0) continue;

        // تجميع اللوحات حسب الفريق المناسب
        const teamsBySize: Record<string, { teamId: string; billboards: number[] }> = {};

        for (const billboard of availableBillboards) {
          const size = billboard.Size;
          
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

        // إنشاء مهمة لكل فريق
        for (const teamData of Object.values(teamsBySize)) {
          const { data: newTask, error: insertError } = await supabase
            .from('removal_tasks')
            .insert({
              contract_id: contract.Contract_Number,
              contract_ids: [contract.Contract_Number],
              team_id: teamData.teamId,
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error('Failed to create auto task:', insertError);
            continue;
          }

          const taskId = newTask.id;

          // إضافة اللوحات للمهمة مع نسخ التصاميم وصور التركيب
          for (const billboardId of teamData.billboards) {
            // جلب التصاميم وصور التركيب من installation_task_items
            const { data: installationItems } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b, installed_image_url')
              .eq('billboard_id', billboardId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            await supabase
              .from('removal_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                design_face_a: installationItems?.design_face_a || null,
                design_face_b: installationItems?.design_face_b || null,
                installed_image_url: installationItems?.installed_image_url || null
              });
          }
        }
      }

      // إعادة تحميل المهام بعد الإنشاء
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
    };

    createAutoRemovalTasks();
  }, [expiredContracts, tasks, queryClient]);

  // جلب العقود المنتهية من شهر 10/2025
  // جلب العقود المنتهية وإنشاء مهام تلقائية
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['expired-contracts-for-removal', manualOpen],
    enabled: manualOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date"')
        .lte('"End Date"', new Date().toISOString())
        .gte('"End Date"', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return contracts;
    
    const searchLower = contractSearchTerm.toLowerCase();
    return contracts.filter((c: any) => 
      String(c.Contract_Number).includes(searchLower) ||
      c['Customer Name']?.toLowerCase().includes(searchLower) ||
      c['Ad Type']?.toLowerCase().includes(searchLower)
    );
  }, [contracts, contractSearchTerm]);

  const handleContractsChange = async (contractNums: string[]) => {
    setSelectedContractNumbers(contractNums);
    setSelectedBillboards([]);
    
    if (contractNums.length === 0) {
      setAvailableBillboards([]);
      return;
    }

    const allBillboardIds: number[] = [];
    for (const contractNum of contractNums) {
      const contract = contracts.find((c: any) => String(c.Contract_Number) === contractNum);
      if (contract?.billboard_ids) {
        const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        allBillboardIds.push(...ids);
      }
    }

    if (allBillboardIds.length > 0) {
      // جلب جميع اللوحات المرتبطة بالعقود المحددة
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', allBillboardIds);
      
      if (!error && billboards) {
        // ✅ تصفية اللوحات: فقط المنتهي عقدها وغير المؤجرة حالياً
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const filteredBillboards = billboards.filter(billboard => {
          const currentContractNumber = billboard.Contract_Number;
          const rentEndDate = billboard.Rent_End_Date;
          
          // ✅ إذا كانت اللوحة مؤجرة لعقد آخر نشط، استبعدها تماماً
          if (currentContractNumber && !contractNums.includes(String(currentContractNumber))) {
            // تحقق من أن العقد الآخر منتهي
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              if (endDate >= today) {
                // العقد الآخر لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // ✅ إذا كانت مرتبطة بأحد العقود المحددة، تحقق من الانتهاء
          if (contractNums.includes(String(currentContractNumber))) {
            if (!rentEndDate) return false; // لا يوجد تاريخ = لا تضمها
            const endDate = new Date(rentEndDate);
            return endDate < today; // فقط إذا انتهى العقد فعلاً
          }
          
          // ✅ إذا لم يكن هناك عقد حالي، لا تضمها (قد تكون متاحة لكن ليست من العقود المحددة)
          return false;
        });
        
        setAvailableBillboards(filteredBillboards);
      }
    }
  };

  const { data: allTaskItems = [] } = useQuery({
    queryKey: ['all-removal-task-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('removal_task_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const uniqueItems = data?.filter((item, index, self) =>
        index === self.findIndex(t => 
          t.task_id === item.task_id && 
          t.billboard_id === item.billboard_id &&
          t.status === item.status
        )
      ) || [];
      
      return uniqueItems as RemovalTaskItem[];
    },
  });

  const billboardIds = allTaskItems.map((i) => i.billboard_id).filter(Boolean);
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-removal-task', billboardIds.join(',')],
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
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date"')
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

        // ✅ تحقق من عدم وجود مهام معلقة لنفس اللوحات
        const { data: existingTasks } = await supabase
        .from('removal_task_items')
        .select('billboard_id, task_id, removal_tasks!inner(status)')
        .in('billboard_id', selectedBillboards)
        .in('removal_tasks.status', ['pending', 'in_progress']);

      if (existingTasks && existingTasks.length > 0) {
        const existingBillboards = existingTasks.map(t => t.billboard_id);
        const duplicates = selectedBillboards.filter(id => existingBillboards.includes(id));
        
        if (duplicates.length > 0) {
          throw new Error(`توجد مهام إزالة معلقة بالفعل لهذه اللوحات: ${duplicates.join(', ')}`);
        }
      }

      const billboardsData = availableBillboards.filter(b => selectedBillboards.includes(b.ID));
      const teamsBySize: Record<string, { teamId: string; billboards: number[] }> = {};

      for (const billboard of billboardsData) {
        const size = billboard.Size;
        
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

      for (const teamData of Object.values(teamsBySize)) {
        const contractIdsArray = selectedContractNumbers.map(n => Number(n));
        
        const { data: newTask, error: insertError } = await supabase
          .from('removal_tasks')
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

        for (const billboardId of teamData.billboards) {
          // جلب التصاميم وصور التركيب من installation_task_items
          const { data: installationItems } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b, installed_image_url')
            .eq('billboard_id', billboardId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { error: itemError } = await supabase
            .from('removal_task_items')
            .insert({
              task_id: taskId,
              billboard_id: billboardId,
              status: 'pending',
              design_face_a: installationItems?.design_face_a || null,
              design_face_b: installationItems?.design_face_b || null,
              installed_image_url: installationItems?.installed_image_url || null
            });

          if (itemError) throw itemError;
        }
      }
    },
    onSuccess: async () => {
      toast.success('تم إنشاء مهام الإزالة بنجاح');
      
      await queryClient.refetchQueries({ queryKey: ['removal-tasks'] });
      await queryClient.refetchQueries({ queryKey: ['all-removal-task-items'] });
      
      setManualOpen(false);
      setSelectedContractNumbers([]);
      setContractSearchTerm('');
      setSelectedBillboards([]);
      setAvailableBillboards([]);
    },
    onError: (error) => {
      toast.error('فشل إنشاء المهام: ' + error.message);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: itemsError } = await supabase
        .from('removal_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      const { error: taskError } = await supabase
        .from('removal_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error) => {
      toast.error('خطأ في حذف المهمة: ' + error.message);
    },
  });

  const completeItemsMutation = useMutation({
    mutationFn: async () => {
      if (!removalDate || selectedItems.size === 0) {
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
          removal_date: format(removalDate, 'yyyy-MM-dd'),
          notes: notes || null,
        };
      });

      const { error } = await supabase
        .from('removal_task_items')
        .upsert(updates);
      
      if (error) throw error;

      if (selectedTeamId) {
        const taskItemsForTeam = itemsByTask[selectedTeamId] || [];
        const remainingItems = taskItemsForTeam.filter(
          item => !selectedItems.has(item.id) && item.status !== 'completed'
        );
        
        if (remainingItems.length === 0) {
          const { error: taskError } = await supabase
            .from('removal_tasks')
            .update({ status: 'completed' })
            .eq('id', selectedTeamId);
          
          if (taskError) throw taskError;
        }
      }

      // تحديث حالة اللوحات إلى available بعد الإزالة
      const billboardIds = Array.from(selectedItems).map(itemId => {
        const item = allTaskItems.find(i => i.id === itemId);
        return item?.billboard_id;
      }).filter(Boolean);

      if (billboardIds.length > 0) {
        await supabase
          .from('billboards')
          .update({ 
            Status: 'available',
            Contract_Number: null,
            Customer_Name: null,
            Ad_Type: null,
            Rent_Start_Date: null,
            Rent_End_Date: null
          })
          .in('ID', billboardIds);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة الإزالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['billboards'] });
      setSelectedItems(new Set());
      setNotes('');
      setSelectedTeamId('');
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة الإزالة: ' + error.message);
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
      setBillboardPrintData({
        contractNumber: contract?.Contract_Number || task.contract_id,
        billboards: taskBillboards,
        taskItems: taskItems,
        printMode: 'removal'
      });
      setPrintDialogOpen(false);
    } else {
      await printTableRemoval(taskBillboards, contract, task);
    }
  };

  const printTableRemoval = async (billboards: any[], contract: any, task: any) => {
    try {
      const team = teamById[task.team_id || ''];
      const teamName = team?.team_name || 'فريق غير محدد';
      
      // جلب بيانات المهمة
      const taskItems = itemsByTask[task.id] || [];

      // جمع أنواع الدعاية من اللوحات
      const adTypes = new Set(taskItems.map(item => {
        const b = billboardById[item.billboard_id];
        return b?.Ad_Type || 'غير محدد';
      }).filter(Boolean));
      const adTypesStr = Array.from(adTypes).join(' - ');

      const norm = (b: any, itemData?: any) => {
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
        
        // إضافة التصميم والصورة المركبة إذا كانت موجودة
        const designFaceA = itemData?.design_face_a || b.design_face_a || '';
        const designFaceB = itemData?.design_face_b || b.design_face_b || '';
        const installedImage = itemData?.installed_image_url || '';
        const removedImage = itemData?.removed_image_url || '';
        
        return { id, name, image, municipality, district, landmark, size, faces, mapLink, designFaceA, designFaceB, installedImage, removedImage };
      };

      const normalized = billboards.map((b) => {
        // إيجاد بيانات المهمة المقابلة للوحة
        const itemData = taskItems.find(ti => ti.billboard_id === b.ID);
        return norm(b, itemData);
      });
      const ROWS_PER_PAGE = 8; // تقليل عدد الصفوف لإضافة التصاميم

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="contract-header">
                  <p style="font-size: 14px; font-weight: 700; color: #dc2626; margin-bottom: 12px; text-decoration: underline;">إزالة دعاية - ${teamName}</p>
                  <p style="font-size: 12px; font-weight: 700; color: #dc2626; margin-bottom: 8px;"><strong>أرقام العقود:</strong> ${contractNumbers}</p>
                  <p><strong>أنواع الدعاية:</strong> ${adTypesStr}</p>
                  <p><strong>اسم الزبون:</strong> ${contract?.['Customer Name'] || 'غير محدد'}</p>
                </div>
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:28mm" />
                      <col style="width:14mm" />
                      <col style="width:14mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:14mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td class="c-img">${r.designFaceA ? `<img src="${r.designFaceA}" alt="تصميم أ" onerror="this.style.display='none'" />` : ''}</td>
                            <td class="c-img">${r.designFaceB ? `<img src="${r.designFaceB}" alt="تصميم ب" onerror="this.style.display='none'" />` : ''}</td>
                            <td class="c-img">${r.installedImage ? `<img src="${r.installedImage}" alt="صورة تركيب" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">خريطة</a>` : ''}</td>
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

      // جمع أرقام العقود وأنواع الدعاية
      const contractIds = task.contract_ids || [task.contract_id];
      const contractNumbers = contractIds.map(id => `#${id}`).join(' - ');

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>إزالة دعاية - ${teamName} - عقود ${contractNumbers} - ${adTypesStr}</title>
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
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 7px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 22mm; max-height: 22mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 0.5mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 22mm; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 21mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer}
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
      toast.success(`تم تحضير ${billboards.length} لوحة للطباعة`);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة الإزالة');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { variant: 'secondary', label: 'معلق', icon: Clock },
      in_progress: { variant: 'default', label: 'قيد الإزالة', icon: Clock },
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

  const itemsByTask = useMemo(() => {
    const grouped: Record<string, RemovalTaskItem[]> = {};
    allTaskItems.forEach(item => {
      if (!grouped[item.task_id]) {
        grouped[item.task_id] = [];
      }
      grouped[item.task_id].push(item);
    });
    return grouped;
  }, [allTaskItems]);

  const tasksByTeam = useMemo(() => {
    const grouped: Record<string, RemovalTask[]> = {};
    tasks.forEach(task => {
      const teamId = task.team_id || 'unknown';
      if (!grouped[teamId]) {
        grouped[teamId] = [];
      }
      grouped[teamId].push(task);
    });
    return grouped;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterTeam !== 'all') {
      filtered = filtered.filter(task => task.team_id === filterTeam);
    }

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

    if (showPendingOnly) {
      filtered = filtered.filter(task => {
        const items = itemsByTask[task.id] || [];
        return items.some(item => item.status === 'pending');
      });
    }

    return filtered;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractByNumber, showPendingOnly, itemsByTask]);

  const filteredTasksByTeam = useMemo(() => {
    const grouped: Record<string, RemovalTask[]> = {};
    filteredTasks.forEach(task => {
      const teamId = task.team_id || 'unknown';
      if (!grouped[teamId]) {
        grouped[teamId] = [];
      }
      grouped[teamId].push(task);
    });
    return grouped;
  }, [filteredTasks]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 pb-16 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مهام إزالة الدعاية</h1>
          <p className="text-muted-foreground">إدارة مهام إزالة الدعاية للعقود المنتهية</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setStatsDialogOpen(true)} 
            variant="outline" 
            className="gap-2"
          >
            <BarChart3 className="h-5 w-5" />
            تقرير الإحصائيات
          </Button>
          {selectedTasks.size > 0 && (
            <Button 
              onClick={async () => {
                if (!confirm(`هل تريد دمج ${selectedTasks.size} مهام مختارة؟`)) return;
                
                try {
                  const selectedTasksList = Array.from(selectedTasks);
                  const tasksToMerge = tasks.filter(t => selectedTasksList.includes(t.id));
                  
                  if (tasksToMerge.length < 2) {
                    toast.error('يجب اختيار مهمتين على الأقل للدمج');
                    return;
                  }
                  
                  // التحقق من أن جميع المهام لنفس الفريق
                  const firstTeamId = tasksToMerge[0].team_id;
                  if (!tasksToMerge.every(t => t.team_id === firstTeamId)) {
                    toast.error('يجب أن تكون جميع المهام لنفس الفريق');
                    return;
                  }
                  
                  // جمع جميع أرقام العقود
                  const allContractIds = new Set<number>();
                  tasksToMerge.forEach(task => {
                    if (task.contract_ids && Array.isArray(task.contract_ids)) {
                      task.contract_ids.forEach(id => allContractIds.add(id));
                    } else {
                      allContractIds.add(task.contract_id);
                    }
                  });
                  
                  // إنشاء المهمة المدمجة
                  const { data: mergedTask, error: mergeError } = await supabase
                    .from('removal_tasks')
                    .insert({
                      contract_id: Array.from(allContractIds)[0],
                      contract_ids: Array.from(allContractIds),
                      team_id: firstTeamId,
                      status: 'pending',
                      created_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                  
                  if (mergeError) throw mergeError;
                  
                  // نقل جميع عناصر المهام إلى المهمة المدمجة
                  for (const task of tasksToMerge) {
                    const taskItems = itemsByTask[task.id] || [];
                    
                    for (const item of taskItems) {
                      await supabase
                        .from('removal_task_items')
                        .update({ task_id: mergedTask.id })
                        .eq('id', item.id);
                    }
                    
                    // حذف المهمة القديمة
                    await supabase
                      .from('removal_tasks')
                      .delete()
                      .eq('id', task.id);
                  }
                  
                  toast.success(`تم دمج ${selectedTasks.size} مهام بنجاح`);
                  setSelectedTasks(new Set());
                  queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
                  queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
                } catch (error: any) {
                  toast.error('فشل دمج المهام: ' + error.message);
                }
              }} 
              variant="outline" 
              className="gap-2"
            >
              دمج {selectedTasks.size} مهام
            </Button>
          )}
          <Button onClick={() => setManualOpen(true)} className="gap-2">
            <Package className="h-5 w-5" />
            إنشاء مهمة إزالة يدوية
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم العقد أو الزبون..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">معلق</SelectItem>
              <SelectItem value="in_progress">قيد الإزالة</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger>
              <SelectValue placeholder="الفريق" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفرق</SelectItem>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.team_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={showPendingOnly}
              onCheckedChange={(checked) => setShowPendingOnly(checked as boolean)}
              id="pending-only"
            />
            <Label htmlFor="pending-only" className="cursor-pointer">
              المعلقة فقط
            </Label>
          </div>
        </div>
      </Card>

      {/* Completion Actions */}
      {selectedItems.size > 0 && (
        <Card className="p-4 bg-primary/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Badge variant="default" className="text-lg px-4 py-2">
                {selectedItems.size} لوحة محددة
              </Badge>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {removalDate ? format(removalDate, 'PPP', { locale: ar }) : 'اختر تاريخ الإزالة'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={removalDate}
                    onSelect={setRemovalDate}
                    locale={ar}
                  />
                </PopoverContent>
              </Popover>

              <Textarea
                placeholder="ملاحظات الإزالة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="max-w-md"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => completeItemsMutation.mutate()}
                disabled={completeItemsMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                تأكيد الإزالة
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedItems(new Set());
                  setNotes('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tasks List with Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            المهام غير المكتملة
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            المهام المكتملة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-4">
              {filteredSortedTeams.filter(teamId => {
                const teamTasks = filteredTasksByTeam[teamId] || [];
                return teamTasks.some(task => {
                  const items = itemsByTask[task.id] || [];
                  return items.some(item => item.status === 'pending');
                });
              }).length === 0 ? (
                <Card className="p-8 text-center">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">لا توجد مهام معلقة حالياً</p>
                </Card>
              ) : (
                filteredSortedTeams
                  .filter(teamId => {
                    const teamTasks = filteredTasksByTeam[teamId] || [];
                    return teamTasks.some(task => {
                      const items = itemsByTask[task.id] || [];
                      return items.some(item => item.status === 'pending');
                    });
                  })
                  .map((teamId) => {
              const teamTasks = filteredTasksByTeam[teamId] || [];
              const team = teamById[teamId] || { team_name: 'فريق غير محدد' };

              return (
                <Card key={teamId} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-6 w-6 text-red-600" />
                      <div>
                        <h3 className="text-lg font-semibold">{team.team_name}</h3>
                        <p className="text-sm text-muted-foreground">{teamTasks.length} مهمة</p>
                      </div>
                    </div>
                  </div>

                  <Accordion type="multiple" className="space-y-2">
                    {teamTasks.map((task) => {
                      const taskItems = itemsByTask[task.id] || [];
                      const contract = contractByNumber[task.contract_id];
                      const pendingCount = taskItems.filter(i => i.status === 'pending').length;
                      const completedCount = taskItems.filter(i => i.status === 'completed').length;

                      return (
                        <AccordionItem key={task.id} value={task.id} className="border rounded-lg">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedTasks.has(task.id)}
                                  onCheckedChange={() => toggleTaskSelection(task.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">عقد #{task.contract_id}</span>
                                    {getStatusBadge(task.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {contract?.['Customer Name']} - {contract?.['Ad Type']}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    تاريخ الإنتهاء: {contract?.['End Date'] ? format(new Date(contract['End Date']), 'PPP', { locale: ar }) : 'غير محدد'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm">
                                  <Badge variant="secondary" className="mr-2">
                                    {taskItems.length} لوحة
                                  </Badge>
                                  <Badge variant="default" className="mr-2">
                                    {completedCount} مكتمل
                                  </Badge>
                                  <Badge variant="destructive">
                                    {pendingCount} معلق
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintTask(task.id);
                                    }}
                                    className="gap-1"
                                  >
                                    <Printer className="h-4 w-4" />
                                    طباعة
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                        deleteTaskMutation.mutate(task.id);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pt-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between mb-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleSelectAll(task.id)}
                                  className="gap-2"
                                >
                                  {taskItems.filter(i => i.status === 'pending').every(item => selectedItems.has(item.id)) ? (
                                    <>
                                      <Square className="h-4 w-4" />
                                      إلغاء التحديد
                                    </>
                                  ) : (
                                    <>
                                      <CheckSquare className="h-4 w-4" />
                                      تحديد الكل
                                    </>
                                  )}
                                </Button>
                              </div>

                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                 {taskItems.map((item) => {
                                   const billboard = billboardById[item.billboard_id];
                                   if (!billboard) return null;

                                   return (
                                     <Card
                                       key={item.id}
                                       className={`p-3 transition-all ${
                                         item.status === 'completed'
                                           ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800'
                                           : selectedItems.has(item.id)
                                           ? 'bg-primary/10 border-primary'
                                           : 'hover:border-primary/50'
                                       }`}
                                     >
                                       <div className="space-y-3">
                                         <div className="flex items-start gap-3">
                                           {item.status === 'pending' && (
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
                                             />
                                           )}
                                           
                                           <div className="flex-1 min-w-0">
                                             <div className="flex items-center gap-2 mb-2">
                                               <h4 className="font-semibold text-base truncate">
                                                 {billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                                               </h4>
                                               {item.status === 'completed' ? (
                                                 <Badge variant="default" className="gap-1 bg-green-600">
                                                   <CheckCircle2 className="h-3 w-3" />
                                                   مكتمل
                                                 </Badge>
                                               ) : (
                                                 <Badge variant="secondary" className="gap-1">
                                                   <Clock className="h-3 w-3" />
                                                   معلق
                                                 </Badge>
                                               )}
                                             </div>
                                             
                                             <div className="space-y-1 text-sm text-muted-foreground">
                                               <p className="flex items-center gap-1">
                                                 <MapPin className="h-3 w-3" />
                                                 {billboard.Municipality} - {billboard.District}
                                               </p>
                                               <p className="truncate">{billboard.Nearest_Landmark}</p>
                                               <p>المقاس: {billboard.Size} | الوجوه: {billboard.Faces_Count}</p>
                                             </div>

                                             {item.status === 'completed' && (
                                               <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs">
                                                 <p className="font-medium text-green-800 dark:text-green-200">
                                                   تم الإزالة: {item.removal_date ? format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد'}
                                                 </p>
                                                 {item.notes && (
                                                   <p className="text-green-700 dark:text-green-300 mt-1">
                                                     {item.notes}
                                                   </p>
                                                 )}
                                               </div>
                                             )}
                                           </div>
                                         </div>

                                         <div className="grid grid-cols-2 gap-2">
                                           {billboard.Image_URL && (
                                             <div className="space-y-1">
                                               <p className="text-xs font-medium">صورة اللوحة</p>
                                               <img
                                                 src={billboard.Image_URL}
                                                 alt={billboard.Billboard_Name}
                                                 className="w-full h-24 object-cover rounded border"
                                               />
                                             </div>
                                           )}
                                           
                                           {item.design_face_a && (
                                             <div className="space-y-1">
                                               <p className="text-xs font-medium">التصميم - وجه أ</p>
                                               <img
                                                 src={item.design_face_a}
                                                 alt="التصميم"
                                                 className="w-full h-24 object-cover rounded border"
                                               />
                                             </div>
                                           )}
                                           
                                           {item.design_face_b && (
                                             <div className="space-y-1">
                                               <p className="text-xs font-medium">التصميم - وجه ب</p>
                                               <img
                                                 src={item.design_face_b}
                                                 alt="التصميم"
                                                 className="w-full h-24 object-cover rounded border"
                                               />
                                             </div>
                                           )}
                                           
                                           {item.removed_image_url && (
                                             <div className="space-y-1">
                                               <p className="text-xs font-medium text-red-600">صورة بعد الإزالة</p>
                                               <img
                                                 src={item.removed_image_url}
                                                 alt="بعد الإزالة"
                                                 className="w-full h-24 object-cover rounded border border-red-300"
                                               />
                                             </div>
                                           )}
                                         </div>

                                         {billboard.GPS_Coordinates && (
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => window.open(`https://www.google.com/maps?q=${billboard.GPS_Coordinates}`, '_blank')}
                                             className="w-full gap-1"
                                           >
                                             <Navigation className="h-4 w-4" />
                                             فتح الموقع في الخريطة
                                           </Button>
                                         )}
                                       </div>
                                     </Card>
                                   );
                                 })}
                               </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </Card>
              );
            })
          )}
         </div>
      </ScrollArea>
    </TabsContent>

    <TabsContent value="completed">
      <ScrollArea className="h-[calc(100vh-450px)]">
        <div className="space-y-4">
          {filteredSortedTeams.filter(teamId => {
            const teamTasks = filteredTasksByTeam[teamId] || [];
            return teamTasks.some(task => {
              const items = itemsByTask[task.id] || [];
              return items.every(item => item.status === 'completed');
            });
          }).length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">لا توجد مهام مكتملة حالياً</p>
            </Card>
          ) : (
            filteredSortedTeams
              .filter(teamId => {
                const teamTasks = filteredTasksByTeam[teamId] || [];
                return teamTasks.some(task => {
                  const items = itemsByTask[task.id] || [];
                  return items.every(item => item.status === 'completed');
                });
              })
              .map((teamId) => {
                const teamTasks = filteredTasksByTeam[teamId] || [];
                const team = teamById[teamId] || { team_name: 'فريق غير محدد' };

                return (
                  <Card key={teamId} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                        <div>
                          <h3 className="text-lg font-semibold">{team.team_name}</h3>
                          <p className="text-sm text-muted-foreground">{teamTasks.length} مهمة</p>
                        </div>
                      </div>
                    </div>

                    <Accordion type="multiple" className="space-y-2">
                      {teamTasks.map((task) => {
                        const taskItems = itemsByTask[task.id] || [];
                        const completedItems = taskItems.filter(i => i.status === 'completed');
                        
                        if (completedItems.length === 0) return null;
                        
                        const contract = contractByNumber[task.contract_id];

                        return (
                          <AccordionItem key={task.id} value={task.id} className="border rounded-lg bg-green-50 dark:bg-green-950/20">
                            <AccordionTrigger className="px-4 hover:no-underline">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">عقد #{task.contract_id}</span>
                                      {getStatusBadge('completed')}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {contract?.['Customer Name']} - {contract?.['Ad Type']}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <Badge variant="default" className="bg-green-600">
                                    {completedItems.length} لوحة مكتملة
                                  </Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pt-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {completedItems.map((item) => {
                                  const billboard = billboardById[item.billboard_id];
                                  if (!billboard) return null;

                                  return (
                                    <Card key={item.id} className="p-3 bg-white dark:bg-card border-green-300">
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-base">
                                          {billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                                        </h4>
                                        <div className="text-sm text-muted-foreground">
                                          <p>{billboard.Municipality} - {billboard.District}</p>
                                          <p className="text-green-600 font-medium">
                                            تم الإزالة: {item.removal_date ? format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد'}
                                          </p>
                                        </div>
                                      </div>
                                    </Card>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </Card>
                );
              })
          )}
        </div>
      </ScrollArea>
    </TabsContent>
  </Tabs>

      {/* Manual Task Creation Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إنشاء مهمة إزالة يدوية</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>البحث عن العقود المنتهية (من 10/2025)</Label>
              <div className="relative mt-2">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث برقم العقد أو اسم الزبون..."
                  value={contractSearchTerm}
                  onChange={(e) => setContractSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <Label>العقود المنتهية المتاحة</Label>
              <ScrollArea className="h-[200px] border rounded-md p-2 mt-2">
                <div className="space-y-2">
                  {contractsLoading ? (
                    <p className="text-center text-muted-foreground py-4">جاري التحميل...</p>
                  ) : filteredContracts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد عقود منتهية</p>
                  ) : (
                    filteredContracts.map((contract: any) => (
                      <div
                        key={contract.Contract_Number}
                        className={`p-3 border rounded cursor-pointer hover:bg-accent ${
                          selectedContractNumbers.includes(String(contract.Contract_Number))
                            ? 'bg-primary/10 border-primary'
                            : ''
                        }`}
                        onClick={() => {
                          const numStr = String(contract.Contract_Number);
                          const newSelected = selectedContractNumbers.includes(numStr)
                            ? selectedContractNumbers.filter(n => n !== numStr)
                            : [...selectedContractNumbers, numStr];
                          handleContractsChange(newSelected);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">عقد #{contract.Contract_Number}</p>
                            <p className="text-sm text-muted-foreground">
                              {contract['Customer Name']} - {contract['Ad Type']}
                            </p>
                            <p className="text-xs text-red-600">
                              انتهى: {contract['End Date'] ? format(new Date(contract['End Date']), 'PPP', { locale: ar }) : 'غير محدد'}
                            </p>
                          </div>
                          <Checkbox
                            checked={selectedContractNumbers.includes(String(contract.Contract_Number))}
                            onCheckedChange={() => {}}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {availableBillboards.length > 0 && (
              <div>
                <Label>اللوحات المتاحة للإزالة</Label>
                <ScrollArea className="h-[200px] border rounded-md p-2 mt-2">
                  <div className="space-y-2">
                    {availableBillboards.map((billboard) => (
                      <div
                        key={billboard.ID}
                        className={`p-3 border rounded cursor-pointer hover:bg-accent ${
                          selectedBillboards.includes(billboard.ID)
                            ? 'bg-primary/10 border-primary'
                            : ''
                        }`}
                        onClick={() => {
                          const newSelected = selectedBillboards.includes(billboard.ID)
                            ? selectedBillboards.filter(id => id !== billboard.ID)
                            : [...selectedBillboards, billboard.ID];
                          setSelectedBillboards(newSelected);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {billboard.Image_URL && (
                            <img
                              src={billboard.Image_URL}
                              alt={billboard.Billboard_Name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{billboard.Billboard_Name || `لوحة #${billboard.ID}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {billboard.Municipality} - {billboard.Size}
                            </p>
                          </div>
                          <Checkbox
                            checked={selectedBillboards.includes(billboard.ID)}
                            onCheckedChange={() => {}}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setManualOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => createManualTasksMutation.mutate()}
                disabled={
                  createManualTasksMutation.isPending ||
                  selectedContractNumbers.length === 0 ||
                  selectedBillboards.length === 0
                }
              >
                إنشاء مهمة الإزالة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>خيارات الطباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>نوع الطباعة</Label>
              <Select value={printType} onValueChange={(v: any) => setPrintType(v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">لوحات منفصلة</SelectItem>
                  <SelectItem value="table">جدول شامل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={executePrint}>
                طباعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billboard Print Individual */}
      {billboardPrintData && (
        <BillboardPrintIndividual
          contractNumber={billboardPrintData.contractNumber}
          billboards={billboardPrintData.billboards}
          designData={billboardPrintData.designData}
          taskItems={billboardPrintData.taskItems}
          printMode={billboardPrintData.printMode || 'installation'}
        />
      )}

      {/* Removal Stats Dialog */}
      <RemovalStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
      />
    </div>
  );
}
