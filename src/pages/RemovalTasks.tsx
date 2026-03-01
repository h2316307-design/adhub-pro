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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  ChevronUp,
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
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { RemovalStatsDialog } from '@/components/reports/RemovalStatsDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { ExpiredContractsAlert, AddRemovalTaskDialog, RemovalTaskCard, ManualRemovalTaskDialog, RemovalTaskItemCard } from '@/components/removal';
import { RemovalTasksBoard } from '@/components/removal/RemovalTasksBoard';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

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
    customerName: string;
    billboards: any[];
  } | null>(null);
  const [billboardPrintOpen, setBillboardPrintOpen] = useState(false);
  const [selectedPrintTeam, setSelectedPrintTeam] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  
  // Print all options (Unified)
  const [unifiedPrintDialogOpen, setUnifiedPrintDialogOpen] = useState(false);
  const [unifiedPrintData, setUnifiedPrintData] = useState<{
    teamId: string;
    teamName: string;
    items: BillboardPrintItem[];
    billboards: Record<number, any>;
    teams: Record<string, any>;
  } | null>(null);
  
  // Legacy print all options
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [printAllTeamId, setPrintAllTeamId] = useState<string | null>(null);
  const [printImageType, setPrintImageType] = useState<'default' | 'installed'>('default');
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printOptionsDialogOpen, setPrintOptionsDialogOpen] = useState(false);
  
  // Collapsible teams
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  
  // Multi-task selection for bulk printing
  const [selectedTasksForPrint, setSelectedTasksForPrint] = useState<Set<string>>(new Set());
  const [multiTaskPrintDialogOpen, setMultiTaskPrintDialogOpen] = useState(false);
  
  // Board pagination - lifted to preserve page on re-render
  const [boardPage, setBoardPage] = useState(1);
  
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
      const { data, error } = await supabase.from('installation_teams').select('id, team_name, sizes, cities');
      if (error) throw error;
      return data as any[];
    },
  });

  // ✅ إنشاء مهام تلقائية للعقود المنتهية مع منع التكرار - باستخدام ref لمنع التنفيذ المتكرر
  const autoTasksCreatedRef = useState<Set<number>>(() => new Set())[0];
  const isCreatingTasksRef = useState<boolean>(false);
  
  useEffect(() => {
    const createAutoRemovalTasks = async () => {
      // منع التنفيذ المتزامن
      if (isCreatingTasksRef) return;
      if (!expiredContracts || expiredContracts.length === 0 || !tasks || !teams || teams.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // جمع جميع أرقام العقود التي لها مهام موجودة (معلقة أو قيد التنفيذ)
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
      
      // ✅ جلب جميع العقود النشطة للتحقق من اللوحات المؤجرة حالياً
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('billboard_ids')
        .gt('"End Date"', todayStr);
      
      const billboardsInActiveContracts = new Set<number>();
      (activeContracts || []).forEach(contract => {
        if (contract.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => billboardsInActiveContracts.add(id));
        }
      });

      let tasksCreated = false;

      for (const contract of expiredContracts) {
        // ✅ تخطي العقد إذا تم معالجته مسبقاً في هذه الجلسة
        if (autoTasksCreatedRef.has(contract.Contract_Number)) continue;
        
        // ✅ تخطي العقد إذا كانت له مهمة موجودة بالفعل
        if (existingTaskContractIds.has(contract.Contract_Number)) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // ✅ التحقق من أن العقد منتهي فعلاً (ليس ساري)
        if (contract['End Date']) {
          const endDate = new Date(contract['End Date']);
          endDate.setHours(0, 0, 0, 0);
          if (endDate > today) {
            // العقد لا يزال ساري، تخطيه
            autoTasksCreatedRef.add(contract.Contract_Number);
            continue;
          }
        }

        // استخرج اللوحات من العقد
        if (!contract.billboard_ids) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }
        
        const billboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        if (billboardIds.length === 0) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // جلب اللوحات من العقد المنتهي فقط
        const { data: contractBillboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIds);

        if (billError || !contractBillboards || contractBillboards.length === 0) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // ✅ تصفية اللوحات: فقط المنتهي عقدها وغير المؤجرة حالياً لعقد ساري آخر
        const availableBillboards = contractBillboards.filter(billboard => {
          // استبعاد اللوحات الموجودة بالفعل في مهام معلقة
          if (billboardsInPendingTasks.has(billboard.ID)) return false;
          
          // ✅ استبعاد اللوحات المؤجرة في عقود نشطة أخرى
          if (billboardsInActiveContracts.has(billboard.ID)) return false;
          
          const rentEndDate = billboard.Rent_End_Date;
          
          // ✅ إذا كانت اللوحة من نفس العقد المنتهي
          if (!rentEndDate) return false;
          const endDate = new Date(rentEndDate);
          endDate.setHours(0, 0, 0, 0);
          return endDate <= today; // العقد منتهي إذا تاريخ نهايته اليوم أو قبله
        });

        // ضع علامة على أنه تم معالجة هذا العقد
        autoTasksCreatedRef.add(contract.Contract_Number);

        if (availableBillboards.length === 0) continue;

        // تجميع اللوحات حسب الفريق المناسب (مقاس + مدينة مثل trigger قاعدة البيانات)
        const teamsByTeamId: Record<string, { teamId: string; billboards: number[] }> = {};

        for (const billboard of availableBillboards) {
          const size = billboard.Size;
          const city = billboard.City;
          
          // ابحث عن الفريق المناسب: المقاس يطابق + (لا قيود مدن أو المدينة ضمن القائمة)
          const suitableTeam = teams.find(team => {
            const teamSizes: string[] = team.sizes || [];
            const teamCities: string[] = team.cities || [];
            const sizeMatch = teamSizes.includes(size);
            const cityMatch = teamCities.length === 0 || teamCities.includes(city);
            return sizeMatch && cityMatch;
          });

          // إذا لم يجد فريقاً مناسباً بالمدينة، ابحث بالمقاس فقط
          const fallbackTeam = !suitableTeam
            ? teams.find(team => {
                const teamSizes: string[] = team.sizes || [];
                return teamSizes.includes(size);
              })
            : null;

          const assignedTeam = suitableTeam || fallbackTeam;
          if (!assignedTeam) continue; // تجاهل اللوحات التي لا يوجد لها فريق مناسب

          const teamId = assignedTeam.id;
          if (!teamsByTeamId[teamId]) {
            teamsByTeamId[teamId] = { teamId, billboards: [] };
          }
          teamsByTeamId[teamId].billboards.push(billboard.ID);
        }

        // إنشاء مهمة لكل فريق
        for (const teamData of Object.values(teamsByTeamId) as { teamId: string; billboards: number[] }[]) {
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

          tasksCreated = true;
          const taskId = newTask.id;

          // إضافة اللوحات للمهمة مع نسخ التصاميم وصور التركيب
          for (const billboardId of teamData.billboards) {
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

      // إعادة تحميل المهام بعد الإنشاء فقط إذا تم إنشاء مهام جديدة
      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      }
      
      // ✅ تنظيف اللوحات المؤجرة حالياً من مهام الإزالة المعلقة
      await cleanupRentedBillboardsFromRemovalTasks();
    };
    
    // وظيفة تنظيف اللوحات المؤجرة من مهام الإزالة
    const cleanupRentedBillboardsFromRemovalTasks = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // جلب جميع عناصر الإزالة المعلقة مع معلومات المهمة
        const { data: pendingItems } = await supabase
          .from('removal_task_items')
          .select('id, billboard_id, task_id')
          .eq('status', 'pending');
        
        if (!pendingItems || pendingItems.length === 0) return;
        
        // جلب المهام المعلقة فقط
        const taskIds = [...new Set(pendingItems.map(item => item.task_id))];
        const { data: tasks } = await supabase
          .from('removal_tasks')
          .select('id, status')
          .in('id', taskIds)
          .in('status', ['pending', 'in_progress']);
        
        if (!tasks || tasks.length === 0) return;
        
        const activeTaskIds = tasks.map(t => t.id);
        const activeItems = pendingItems.filter(item => activeTaskIds.includes(item.task_id));
        
        if (activeItems.length === 0) return;
        
        // جلب بيانات اللوحات
        const billboardIds = activeItems.map(item => item.billboard_id);
        const { data: billboards } = await supabase
          .from('billboards')
          .select('ID, Status, Contract_Number, Rent_End_Date')
          .in('ID', billboardIds);
        
        if (!billboards) return;
        
        // تحديد اللوحات المؤجرة حالياً
        const rentedBillboardIds = billboards
          .filter(b => {
            const status = (b.Status || '').toString().trim();
            const rentEndDate = b.Rent_End_Date;
            
            // إذا كانت مؤجرة أو محجوزة مع عقد نشط
            if (status === 'مؤجر' || status === 'rented' || status === 'محجوز' || status === 'Rented') {
              if (rentEndDate) {
                const endDate = new Date(rentEndDate);
                endDate.setHours(0, 0, 0, 0);
                return endDate > today; // لا يزال نشطاً
              }
              // إذا لا يوجد تاريخ انتهاء لكن الحالة مؤجر، نعتبره نشط
              if (b.Contract_Number) return true;
            }
            return false;
          })
          .map(b => b.ID);
        
        if (rentedBillboardIds.length === 0) return;
        
        // حذف عناصر الإزالة للوحات المؤجرة
        const itemsToDelete = activeItems
          .filter(item => rentedBillboardIds.includes(item.billboard_id))
          .map(item => item.id);
        
        if (itemsToDelete.length > 0) {
          await supabase
            .from('removal_task_items')
            .delete()
            .in('id', itemsToDelete);
          
          console.log(`✅ تم حذف ${itemsToDelete.length} لوحة مؤجرة من مهام الإزالة`);
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
        }
      } catch (error) {
        console.error('خطأ في تنظيف اللوحات المؤجرة:', error);
      }
    };

    createAutoRemovalTasks();
  }, [expiredContracts?.length, teams?.length]);

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
          const billboardStatus = (billboard.Status || '').toString().trim();
          
          // ✅ استبعاد اللوحات المؤجرة بالفعل (حالة مؤجر أو محجوز مع عقد نشط)
          if (billboardStatus === 'مؤجر' || billboardStatus === 'rented' || billboardStatus === 'Rented' || billboardStatus === 'محجوز') {
            // تحقق من أن العقد لا يزال نشطاً
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              endDate.setHours(0, 0, 0, 0);
              if (endDate > today) {
                // العقد لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // ✅ إذا كانت اللوحة مؤجرة لعقد آخر نشط، استبعدها تماماً
          if (currentContractNumber && !contractNums.includes(String(currentContractNumber))) {
            // تحقق من أن العقد الآخر منتهي
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              if (endDate > today) {
                // العقد الآخر لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // ✅ إذا كانت مرتبطة بأحد العقود المحددة، تحقق من الانتهاء
          if (contractNums.includes(String(currentContractNumber))) {
            if (!rentEndDate) return false; // لا يوجد تاريخ = لا تضمها
            const endDate = new Date(rentEndDate);
            return endDate <= today; // فقط إذا انتهى العقد فعلاً (اليوم أو قبله)
          }
          
          // ✅ إذا لم يكن هناك عقد حالي، لا تضمها (قد تكون متاحة لكن ليست من العقود المحددة)
          return false;
        });
        
        setAvailableBillboards(filteredBillboards);
      }
    }
  };

  const { data: rawTaskItems = [] } = useQuery({
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

  // جلب التصاميم من مهام التركيب للوحات - مطابقة بالعقد واللوحة
  const itemBillboardIds = rawTaskItems.map((i) => i.billboard_id).filter(Boolean);
  
  // بناء خريطة task_id -> contract_id من مهام الإزالة
  const removalTaskContractMap = useMemo(() => {
    const m = new Map<string, number>();
    (tasks || []).forEach((t: any) => {
      m.set(t.id, t.contract_id);
    });
    return m;
  }, [tasks]);

  const { data: installationDesigns = [] } = useQuery({
    queryKey: ['installation-designs-for-removal', itemBillboardIds.join(','), Array.from(removalTaskContractMap.values()).join(',')],
    enabled: itemBillboardIds.length > 0 && removalTaskContractMap.size > 0,
    queryFn: async () => {
      const contractIds = [...new Set(Array.from(removalTaskContractMap.values()).filter(Boolean))];
      if (contractIds.length === 0) return [];
      
      // الخطوة 1: جلب مهام التركيب المرتبطة بالعقود
      const { data: installTasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id')
        .in('contract_id', contractIds);
      if (tasksError) throw tasksError;
      if (!installTasks?.length) return [];
      
      const installTaskIds = installTasks.map(t => t.id);
      const taskContractMap: Record<string, number> = {};
      installTasks.forEach(t => { taskContractMap[t.id] = t.contract_id; });
      
      // الخطوة 2: جلب عناصر التركيب مع التصاميم
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, task_id')
        .in('task_id', installTaskIds)
        .in('billboard_id', itemBillboardIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // إضافة contract_id لكل عنصر
      return (data || []).map(d => ({
        ...d,
        contract_id: taskContractMap[d.task_id] || null
      }));
    },
  });

  // دمج التصاميم من مهام التركيب في عناصر الإزالة - مطابقة بالعقد واللوحة
  const allTaskItems = useMemo(() => {
    if (!installationDesigns.length) return rawTaskItems;
    
    // بناء خريطة: `contract_id-billboard_id` -> أحدث تصميم من التركيب
    const designMap = new Map<string, any>();
    installationDesigns.forEach((d: any) => {
      const contractId = d.contract_id;
      if (!contractId) return;
      const key = `${contractId}-${d.billboard_id}`;
      if (!designMap.has(key)) {
        designMap.set(key, d);
      }
    });
    
    return rawTaskItems.map(item => {
      if (item.design_face_a || item.design_face_b) return item;
      const contractId = removalTaskContractMap.get(item.task_id);
      if (!contractId) return item;
      const installDesign = designMap.get(`${contractId}-${item.billboard_id}`);
      if (!installDesign) return item;
      return {
        ...item,
        design_face_a: installDesign.design_face_a || item.design_face_a,
        design_face_b: installDesign.design_face_b || item.design_face_b,
        installed_image_url: item.installed_image_url || installDesign.installed_image_face_a_url || null,
      };
    });
  }, [rawTaskItems, installationDesigns, removalTaskContractMap]);

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

  // Map task_id to task for quick lookup
  const taskById = useMemo(() => {
    const m: Record<string, any> = {};
    (tasks || []).forEach((t: any) => {
      m[t.id] = t;
    });
    return m;
  }, [tasks]);

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

  // حذف المهام المكررة
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      // تجميع المهام حسب contract_id + team_id
      const taskGroups: Record<string, RemovalTask[]> = {};
      
      for (const task of tasks) {
        if (task.status !== 'pending' && task.status !== 'in_progress') continue;
        const key = `${task.contract_id}-${task.team_id}`;
        if (!taskGroups[key]) taskGroups[key] = [];
        taskGroups[key].push(task);
      }
      
      // حذف المهام المكررة (الاحتفاظ بالأقدم فقط)
      const tasksToDelete: string[] = [];
      for (const group of Object.values(taskGroups)) {
        if (group.length > 1) {
          // ترتيب حسب تاريخ الإنشاء (الأقدم أولاً)
          group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          // حذف كل المهام ما عدا الأولى (الأقدم)
          for (let i = 1; i < group.length; i++) {
            tasksToDelete.push(group[i].id);
          }
        }
      }
      
      if (tasksToDelete.length === 0) {
        throw new Error('لا توجد مهام مكررة');
      }
      
      // حذف عناصر المهام أولاً
      for (const taskId of tasksToDelete) {
        await supabase
          .from('removal_task_items')
          .delete()
          .eq('task_id', taskId);
      }
      
      // ثم حذف المهام
      const { error } = await supabase
        .from('removal_tasks')
        .delete()
        .in('id', tasksToDelete);
      
      if (error) throw error;
      
      return tasksToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`تم حذف ${count} مهمة مكررة`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المهام المكررة');
    },
  });

  // تنظيف اللوحات المؤجرة من مهام الإزالة
  const cleanupRentedMutation = useMutation({
    mutationFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // جلب جميع عناصر الإزالة المعلقة
      const { data: pendingItems } = await supabase
        .from('removal_task_items')
        .select('id, billboard_id, task_id')
        .eq('status', 'pending');
      
      if (!pendingItems || pendingItems.length === 0) {
        throw new Error('لا توجد عناصر إزالة معلقة');
      }
      
      // جلب المهام المعلقة فقط
      const taskIds = [...new Set(pendingItems.map(item => item.task_id))];
      const { data: activeTasks } = await supabase
        .from('removal_tasks')
        .select('id, status')
        .in('id', taskIds)
        .in('status', ['pending', 'in_progress']);
      
      if (!activeTasks || activeTasks.length === 0) {
        throw new Error('لا توجد مهام نشطة');
      }
      
      const activeTaskIds = activeTasks.map(t => t.id);
      const activeItems = pendingItems.filter(item => activeTaskIds.includes(item.task_id));
      
      if (activeItems.length === 0) {
        throw new Error('لا توجد عناصر في مهام نشطة');
      }
      
      // جلب بيانات اللوحات
      const billboardIds = activeItems.map(item => item.billboard_id);
      const { data: billboards } = await supabase
        .from('billboards')
        .select('ID, Status, Contract_Number, Rent_End_Date')
        .in('ID', billboardIds);
      
      if (!billboards) {
        throw new Error('لم يتم العثور على اللوحات');
      }
      
      // تحديد اللوحات المؤجرة حالياً
      const rentedBillboardIds = billboards
        .filter(b => {
          const status = (b.Status || '').toString().trim();
          const rentEndDate = b.Rent_End_Date;
          
          // إذا كانت مؤجرة أو محجوزة مع عقد نشط
          if (status === 'مؤجر' || status === 'rented' || status === 'محجوز' || status === 'Rented') {
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              endDate.setHours(0, 0, 0, 0);
              return endDate >= today; // لا يزال نشطاً
            }
            // إذا لا يوجد تاريخ انتهاء لكن الحالة مؤجر، نعتبره نشط
            if (b.Contract_Number) return true;
          }
          return false;
        })
        .map(b => b.ID);
      
      if (rentedBillboardIds.length === 0) {
        throw new Error('لا توجد لوحات مؤجرة في مهام الإزالة');
      }
      
      // حذف عناصر الإزالة للوحات المؤجرة
      const itemsToDelete = activeItems
        .filter(item => rentedBillboardIds.includes(item.billboard_id))
        .map(item => item.id);
      
      if (itemsToDelete.length > 0) {
        const { error } = await supabase
          .from('removal_task_items')
          .delete()
          .in('id', itemsToDelete);
        
        if (error) throw error;
      }
      
      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`تم حذف ${count} لوحة مؤجرة من مهام الإزالة`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تنظيف اللوحات المؤجرة');
    },
  });

  // التراجع عن إزالة لوحة
  const undoRemovalMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('removal_task_items')
        .update({
          status: 'pending',
          completed_at: null,
          removal_date: null,
          notes: null,
          removed_image_url: null
        })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // تحديث حالة المهمة إذا لزم الأمر
      const item = allTaskItems.find(i => i.id === itemId);
      if (item) {
        await supabase
          .from('removal_tasks')
          .update({ status: 'pending' })
          .eq('id', item.task_id);
      }
    },
    onSuccess: () => {
      toast.success('تم التراجع عن الإزالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error('فشل التراجع: ' + error.message);
    },
  });

  // حساب عدد المهام المكررة
  const duplicateTasksCount = useMemo(() => {
    const taskGroups: Record<string, number> = {};
    let count = 0;
    
    for (const task of tasks) {
      if (task.status !== 'pending' && task.status !== 'in_progress') continue;
      const key = `${task.contract_id}-${task.team_id}`;
      taskGroups[key] = (taskGroups[key] || 0) + 1;
    }
    
    for (const groupCount of Object.values(taskGroups)) {
      if (groupCount > 1) count += groupCount - 1;
    }
    
    return count;
  }, [tasks]);

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
        customerName: contract?.['Customer Name'] || '',
        billboards: taskBillboards.map(b => ({
          ...b,
          design_face_a: taskItems.find(ti => ti.billboard_id === b.ID)?.design_face_a,
          design_face_b: taskItems.find(ti => ti.billboard_id === b.ID)?.design_face_b,
          installed_image_url: taskItems.find(ti => ti.billboard_id === b.ID)?.installed_image_url
        }))
      });
      setBillboardPrintOpen(true);
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
        const level = String(b.Level || '');
        const faces = String(b.Faces_Count || '');
        const coords = String(b.GPS_Coordinates || '');
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        
        // إضافة التصميم والصورة المركبة إذا كانت موجودة
        const designFaceA = itemData?.design_face_a || b.design_face_a || '';
        const designFaceB = itemData?.design_face_b || b.design_face_b || '';
        const installedImage = itemData?.installed_image_url || '';
        const removedImage = itemData?.removed_image_url || '';
        
        return { id, name, image, municipality, district, landmark, size, level, faces, mapLink, designFaceA, designFaceB, installedImage, removedImage };
      };

      // جلب بيانات الترتيب من الجداول
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizeOrderMap = new Map<string, number>();
      (sizesRes.data || []).forEach((s: any) => sizeOrderMap.set(s.name, s.sort_order ?? 999));
      
      const municipalityOrderMap = new Map<string, number>();
      (municipalitiesRes.data || []).forEach((m: any) => municipalityOrderMap.set(m.name, m.sort_order ?? 999));
      
      const levelOrderMap = new Map<string, number>();
      (levelsRes.data || []).forEach((l: any) => levelOrderMap.set(l.level_code, l.sort_order ?? 999));

      const normalized = billboards.map((b) => {
        const itemData = taskItems.find(ti => ti.billboard_id === b.ID);
        return norm(b, itemData);
      }).sort((a, b) => {
        // ترتيب حسب المقاس ثم البلدية ثم المستوى
        const sizeOrderA = sizeOrderMap.get(a.size) ?? 999;
        const sizeOrderB = sizeOrderMap.get(b.size) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        const municipalityOrderA = municipalityOrderMap.get(a.municipality) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(b.municipality) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        const levelOrderA = levelOrderMap.get(a.level) ?? 999;
        const levelOrderB = levelOrderMap.get(b.level) ?? 999;
        return levelOrderA - levelOrderB;
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

  // حساب IDs العقود الموجودة في مهام (بما في ذلك المكتملة) - يجب أن تكون قبل أي return
  const existingTaskContractIds = useMemo(() => {
    return new Set(
      tasks.flatMap(t => t.contract_ids || [t.contract_id])
    );
  }, [tasks]);

  const existingTaskBillboardIds = useMemo(() => {
    return new Set(
      allTaskItems
        .filter(item => {
          const task = taskById[item.task_id];
          return task && (task.status === 'pending' || task.status === 'in_progress');
        })
        .map(item => item.billboard_id)
    );
  }, [allTaskItems, taskById]);

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
    <div className="container mx-auto p-3 sm:p-4 md:p-6 pb-16 space-y-4 md:space-y-6" dir="rtl">
      {/* تنبيه العقود المنتهية */}
      <ExpiredContractsAlert
        teams={teams}
        existingTaskContractIds={existingTaskContractIds}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">مهام إزالة الدعاية</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">إدارة مهام إزالة الدعاية للعقود المنتهية</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setStatsDialogOpen(true)} 
            variant="outline" 
            size="sm"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">تقرير</span> الإحصائيات
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
                  
                  const firstTeamId = tasksToMerge[0].team_id;
                  if (!tasksToMerge.every(t => t.team_id === firstTeamId)) {
                    toast.error('يجب أن تكون جميع المهام لنفس الفريق');
                    return;
                  }
                  
                  const allContractIds = new Set<number>();
                  tasksToMerge.forEach(task => {
                    if (task.contract_ids && Array.isArray(task.contract_ids)) {
                      task.contract_ids.forEach(id => allContractIds.add(id));
                    } else {
                      allContractIds.add(task.contract_id);
                    }
                  });
                  
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
                  
                  for (const task of tasksToMerge) {
                    const taskItems = itemsByTask[task.id] || [];
                    
                    for (const item of taskItems) {
                      await supabase
                        .from('removal_task_items')
                        .update({ task_id: mergedTask.id })
                        .eq('id', item.id);
                    }
                    
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
              size="sm"
              className="gap-1.5 text-xs sm:text-sm"
            >
              دمج {selectedTasks.size} مهام
            </Button>
          )}
          {duplicateTasksCount > 0 && (
            <Button 
              onClick={() => cleanupDuplicatesMutation.mutate()}
              disabled={cleanupDuplicatesMutation.isPending}
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">حذف</span> {duplicateTasksCount} مكررة
            </Button>
          )}
          <Button 
            onClick={() => cleanupRentedMutation.mutate()}
            disabled={cleanupRentedMutation.isPending}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{cleanupRentedMutation.isPending ? 'جاري التنظيف...' : 'تنظيف المؤجرة'}</span>
            <span className="sm:hidden">{cleanupRentedMutation.isPending ? 'تنظيف...' : 'تنظيف'}</span>
          </Button>
          <Button onClick={() => setManualOpen(true)} size="sm" className="gap-1.5 text-xs sm:text-sm">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">إنشاء مهمة إزالة يدوية</span>
            <span className="sm:hidden">إضافة مهمة</span>
          </Button>
        </div>
      </div>

      {/* ── Hybrid Visual Board ── */}
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
        pendingTasks={tasks.filter(task => {
          const taskItemsList = itemsByTask[task.id] || [];
          return taskItemsList.some(i => i.status === 'pending');
        }).length}
        completedTasks={tasks.filter(task => {
          const taskItemsList = itemsByTask[task.id] || [];
          return taskItemsList.length > 0 && taskItemsList.every(i => i.status === 'completed');
        }).length}
        totalItems={allTaskItems.length}
        completedItems={allTaskItems.filter(i => i.status === 'completed').length}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        }}
        onAddTask={() => setManualOpen(true)}
        onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
        onPrintTask={(task, items) => {
          const contract = contractByNumber[task.contract_id];
          const team = teamById[task.team_id];
          const printItems: BillboardPrintItem[] = items.map((item: any) => ({
            id: item.id,
            billboard_id: item.billboard_id,
            design_face_a: item.design_face_a || null,
            design_face_b: item.design_face_b || null,
            installed_image_face_a_url: item.installed_image_url || null,
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
        }}
        onUndoRemoval={(itemId) => undoRemovalMutation.mutate(itemId)}
        onCompleteAll={(taskId) => {
          const taskItems = (itemsByTask[taskId] || []).filter((i: any) => i.status !== 'completed');
          if (taskItems.length === 0) {
            toast.info('جميع اللوحات مكتملة بالفعل');
            return;
          }
          const newSet = new Set<string>();
          taskItems.forEach((i: any) => newSet.add(i.id));
          setSelectedItems(newSet);
          setSelectedTeamId(taskId);
          setRemovalDate(new Date());
        }}
        selectedItems={selectedItems}
        onToggleItem={(itemId, taskId) => {
          const newSet = new Set(selectedItems);
          if (newSet.has(itemId)) {
            newSet.delete(itemId);
          } else {
            newSet.add(itemId);
            setSelectedTeamId(taskId);
          }
          setSelectedItems(newSet);
        }}
        onToggleSelectAll={(taskId) => toggleSelectAll(taskId)}
      />

      {/* Floating Selection Bar for Removal Completion */}
      <AnimatePresence>
        {selectedItems.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-red-600 text-white px-6 py-4 shadow-2xl rounded-2xl flex items-center gap-4 flex-wrap justify-center">
              <Badge variant="secondary" className="bg-white text-red-700 text-lg px-4 py-2">{selectedItems.size} لوحة محددة</Badge>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                    <CalendarIcon className="h-4 w-4" />
                    {removalDate ? format(removalDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ الإزالة'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={removalDate} onSelect={setRemovalDate} locale={ar} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Button 
                onClick={() => completeItemsMutation.mutate()} 
                disabled={!removalDate || completeItemsMutation.isPending} 
                className="gap-2 bg-white text-red-700 hover:bg-white/90"
              >
                <CheckCircle2 className="h-4 w-4" />
                {completeItemsMutation.isPending ? 'جاري...' : 'تأكيد الإزالة'}
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setSelectedItems(new Set()); setSelectedTeamId(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen} modal={true}>
        <DialogContent className="sm:max-w-md">
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
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="individual">لوحات منفصلة</SelectItem>
                  <SelectItem value="table">جدول شامل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>نوع الصور</Label>
              <Select value={printImageType} onValueChange={(v: any) => setPrintImageType(v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="default">الصور الافتراضية</SelectItem>
                  <SelectItem value="installed">صور التركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-designs"
                checked={includeDesigns}
                onCheckedChange={(checked) => setIncludeDesigns(!!checked)}
              />
              <Label htmlFor="include-designs" className="cursor-pointer">
                تضمين التصميمات
              </Label>
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

      {/* Print All Team Billboards Dialog */}
      <Dialog open={printAllDialogOpen} onOpenChange={setPrintAllDialogOpen} modal={true}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>طباعة جميع لوحات الفريق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم طباعة جميع اللوحات المعلقة للفريق المحدد
            </p>

            <div>
              <Label>نوع الصور</Label>
              <Select value={printImageType} onValueChange={(v: any) => setPrintImageType(v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="default">الصور الافتراضية للوحات</SelectItem>
                  <SelectItem value="installed">صور التركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-designs-all"
                checked={includeDesigns}
                onCheckedChange={(checked) => setIncludeDesigns(!!checked)}
              />
              <Label htmlFor="include-designs-all" className="cursor-pointer">
                تضمين التصميمات
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPrintAllDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={() => {
                if (printAllTeamId) {
                  // Get all pending items for this team
                  const teamTasks = filteredTasksByTeam[printAllTeamId] || [];
                  const teamTaskIds = teamTasks.map(t => t.id);
                  const teamItems = allTaskItems.filter(item => 
                    teamTaskIds.includes(item.task_id) && item.status === 'pending'
                  );
                  
                  if (teamItems.length === 0) {
                    toast.error('لا توجد لوحات معلقة للطباعة');
                    return;
                  }

                  const billboardsForPrint = teamItems.map(item => {
                    const billboard = billboardById[item.billboard_id];
                    return {
                      ...billboard,
                      ...(printImageType === 'installed' && item.installed_image_url ? {
                        Image_URL: item.installed_image_url
                      } : {}),
                      design_face_a: includeDesigns ? item.design_face_a : null,
                      design_face_b: includeDesigns ? item.design_face_b : null
                    };
                  }).filter(Boolean);

                  setBillboardPrintData({
                    contractNumber: 'إزالة - جميع اللوحات',
                    customerName: '',
                    billboards: billboardsForPrint
                  });
                  setBillboardPrintOpen(true);
                  setPrintAllDialogOpen(false);
                  toast.success(`تم تجهيز ${billboardsForPrint.length} لوحة للطباعة`);
                }
              }}>
                طباعة الكل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billboard Bulk Print Dialog */}
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
            customerName: billboardPrintData.customerName || 'إزالة'
          }}
        />
      )}

      {/* Removal Stats Dialog */}
      <RemovalStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
      />

      {/* Unified Print All Dialog */}
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
          title={`طباعة لوحات الإزالة - ${unifiedPrintData.teamName}`}
        />
      )}

      {/* Manual Removal Task Dialog */}
      <ManualRemovalTaskDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        teams={teams}
        existingTaskBillboardIds={existingTaskBillboardIds}
      />
    </div>
  );
}
