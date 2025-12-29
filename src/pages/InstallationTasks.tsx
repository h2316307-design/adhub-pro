import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  Users, 
  Package,
  Printer,
  PaintBucket,
  Search,
  Filter,
  CalendarIcon,
  Trash2,
  Merge,
  RotateCcw,
  Edit,
  ArrowRight,
  FileText,
  Layers
} from 'lucide-react';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';
import { TaskDesignManager } from '@/components/tasks/TaskDesignManager';
import { BulkDesignAssigner } from '@/components/tasks/BulkDesignAssigner';
import { TaskCompletionDialog } from '@/components/tasks/TaskCompletionDialog';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { CreatePrintTaskFromInstallation } from '@/components/tasks/CreatePrintTaskFromInstallation';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import { MergeTeamTasksDialog } from '@/components/tasks/MergeTeamTasksDialog';
import { EditTaskTypeDialog } from '@/components/tasks/EditTaskTypeDialog';
import { TransferBillboardsDialog } from '@/components/tasks/TransferBillboardsDialog';
import { PrintAllContractBillboardsDialog } from '@/components/tasks/PrintAllContractBillboardsDialog';
import BillboardPrintSettingsDialog from '@/components/billboards/BillboardPrintSettingsDialog';
import { TaskCardWrapper } from '@/components/tasks/TaskCardWrapper';

interface InstallationTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  task_type?: 'installation' | 'reinstallation';
  created_at: string;
  print_task_id?: string | null;
  cutout_task_id?: string | null;
  print_tasks?: { id: string; status: string } | null;
  cutout_tasks?: { id: string; status: string } | null;
  installation_teams?: { team_name: string };
}

interface InstallationTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  installation_date: string | null;
  design_face_a: string | null;
  design_face_b: string | null;
  installed_image_url: string | null;
  installed_image_face_a_url: string | null;
  installed_image_face_b_url: string | null;
  selected_design_id: string | null;
  has_cutout: boolean | null;
  customer_installation_cost: number;
}

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

export default function InstallationTasks() {
  const queryClient = useQueryClient();
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [taskType, setTaskType] = useState<'installation' | 'reinstallation'>('installation');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedTaskForDesign, setSelectedTaskForDesign] = useState<string | null>(null);
  const [bulkDesignDialogOpen, setBulkDesignDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  const [createPrintTaskDialogOpen, setCreatePrintTaskDialogOpen] = useState(false);
  const [selectedTaskForPrint, setSelectedTaskForPrint] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedItemForImage, setSelectedItemForImage] = useState<InstallationTaskItem | null>(null);
  const [installedImageUrl, setInstalledImageUrl] = useState<string>('');
  const [installedImageFaceAUrl, setInstalledImageFaceAUrl] = useState<string>('');
  const [installedImageFaceBUrl, setInstalledImageFaceBUrl] = useState<string>('');
  
  // Bulk completion
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [selectedItemsForCompletion, setSelectedItemsForCompletion] = useState<string[]>([]);
  const [selectedTaskIdForCompletion, setSelectedTaskIdForCompletion] = useState<string | null>(null);
  
  // Merge tasks dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedTeamForMerge, setSelectedTeamForMerge] = useState<{ id: string; name: string } | null>(null);
  const [selectedCustomerForMerge, setSelectedCustomerForMerge] = useState<string | null>(null);
  const [tasksToMerge, setTasksToMerge] = useState<any[]>([]);
  
  // Edit task type dialog
  const [editTaskTypeDialogOpen, setEditTaskTypeDialogOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<{ id: string; taskType: 'installation' | 'reinstallation' } | null>(null);
  
  // Transfer billboards dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedTaskForTransfer, setSelectedTaskForTransfer] = useState<{ taskId: string; teamId: string; teamName: string; contractId: number } | null>(null);
  
  // Print all contract billboards dialog
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [selectedContractForPrint, setSelectedContractForPrint] = useState<{ contractNumber: number; customerName: string } | null>(null);
  
  // Print settings dialog state
  const [printSettingsDialogTaskId, setPrintSettingsDialogTaskId] = useState<string | null>(null);
  
  // Create composite task for installation only
  const [createCompositeDialogOpen, setCreateCompositeDialogOpen] = useState(false);
  const [selectedTaskForComposite, setSelectedTaskForComposite] = useState<{ taskId: string; contractId: number; customerName: string; customerId: string | null } | null>(null);
  
  // Bulk date assignment (keep for backward compatibility)
  const [bulkDateDialogOpen, setBulkDateDialogOpen] = useState(false);
  const [selectedItemsForDate, setSelectedItemsForDate] = useState<string[]>([]);
  const [bulkInstallationDate, setBulkInstallationDate] = useState<string>('');
  const [selectedTaskIdForBulk, setSelectedTaskIdForBulk] = useState<string | null>(null);
  
  // Handle completion of multiple billboards
  const handleCompleteMultiple = async (result: 'completed' | 'not_completed', notes: string, reason?: string, installationDate?: string) => {
    if (selectedItemsForCompletion.length === 0) {
      toast.error('لم يتم تحديد أي لوحات');
      return;
    }

    try {
      // تحضير الملاحظات (دمج الملاحظات مع السبب إذا كان غير مكتمل)
      const finalNotes = result === 'not_completed' && reason 
        ? `${notes}\nسبب عدم الإنجاز: ${reason}` 
        : notes;

      // ✅ FIX: تحديث حالة العناصر أولاً
      const updateData: any = {
        status: result === 'completed' ? 'completed' : 'pending',
        notes: finalNotes || null,
        completed_at: result === 'completed' ? new Date().toISOString() : null,
      };

      // ✅ FIX: إضافة تاريخ التركيب فقط إذا كان موجوداً وصالحاً
      if (result === 'completed' && installationDate && installationDate.trim() !== '') {
        updateData.installation_date = installationDate;
      }

      const { error: updateError } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .in('id', selectedItemsForCompletion);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // ✅ حفظ السجل في billboard_history عند إكمال المهمة
      if (result === 'completed') {
        const itemsToSave = allTaskItems.filter(item => selectedItemsForCompletion.includes(item.id));
        
        for (const item of itemsToSave) {
          const billboard = billboardById[item.billboard_id];
          if (!billboard?.Contract_Number) {
            console.warn(`Billboard ${item.billboard_id} has no contract number`);
            continue;
          }

          try {
            // جلب بيانات العقد الكاملة مع التصاميم
            const { data: contract, error: contractError } = await supabase
              .from('Contract')
              .select(`
                Contract_Number, 
                "Customer Name", 
                "Ad Type", 
                "Total Rent",
                Total, 
                Discount, 
                installation_cost, 
                installation_enabled, 
                design_data, 
                "Contract Date", 
                "End Date", 
                Duration,
                billboard_ids,
                billboard_prices
              `)
              .eq('Contract_Number', billboard.Contract_Number)
              .single();

            if (contractError || !contract) {
              console.error(`Failed to fetch contract ${billboard.Contract_Number}:`, contractError);
              continue;
            }

            // ✅ FIX: استخراج التصاميم من عدة مصادر (بالترتيب الصحيح)
            let designA = '';
            let designB = '';

            // 1. محاولة الحصول على التصميم من task item (الأولوية الأعلى)
            if (item.design_face_a) designA = item.design_face_a;
            if (item.design_face_b) designB = item.design_face_b;

            // 2. محاولة الحصول على التصميم من اللوحة نفسها
            if (!designA && billboard.design_face_a) designA = billboard.design_face_a;
            if (!designB && billboard.design_face_b) designB = billboard.design_face_b;

            // 3. محاولة الحصول على التصميم من design_data في العقد
            if (contract.design_data && (!designA || !designB)) {
              try {
                const designs = Array.isArray(contract.design_data) 
                  ? contract.design_data 
                  : [contract.design_data];
                
                for (const designItem of designs) {
                  if (designItem && typeof designItem === 'object' && !Array.isArray(designItem)) {
                    const design = designItem as any; // Type assertion for Json object
                    if (!designA && (design.face_a_url || design.faceAUrl || design.designA)) {
                      designA = String(design.face_a_url || design.faceAUrl || design.designA || '');
                    }
                    if (!designB && (design.face_b_url || design.faceBUrl || design.designB)) {
                      designB = String(design.face_b_url || design.faceBUrl || design.designB || '');
                    }
                  }
                }
              } catch (e) {
                console.warn('Error parsing design_data:', e);
              }
            }

            // ✅ حساب المبالغ المالية بدقة
            const billboardPrice = billboard.Price || 0;
            const totalRent = contract['Total Rent'] || contract.Total || billboardPrice;
            const discountAmount = contract.Discount || 0;
            
            // حساب نسبة التخفيض
            const discountPercentage = totalRent > 0 ? (discountAmount / totalRent) * 100 : 0;
            
            const installationCost = (contract.installation_enabled && contract.installation_cost) || 0;
            const totalBeforeDiscount = totalRent + installationCost;
            const finalAmount = totalBeforeDiscount - discountAmount;

            // حساب المدة
            const durationDays = contract.Duration ? parseInt(String(contract.Duration)) : 0;

            // جلب اسم الفريق
            const task = tasks.find(t => t.id === item.task_id);
            const teamName = task?.team_id ? teamById[task.team_id]?.team_name || '' : '';

            // تحديد تاريخ التركيب النهائي
            const finalInstallationDate = installationDate || item.installation_date || new Date().toISOString().split('T')[0];

            // ✅ حفظ في التاريخ مع جميع المعلومات المالية
            const { error: historyError } = await supabase.from('billboard_history').insert({
              billboard_id: item.billboard_id,
              contract_number: contract.Contract_Number,
              customer_name: contract['Customer Name'] || '',
              ad_type: contract['Ad Type'] || '',
              start_date: contract['Contract Date'] || billboard.Rent_Start_Date,
              end_date: contract['End Date'] || billboard.Rent_End_Date,
              duration_days: durationDays,
              
              // ✅ المعلومات المالية الكاملة
              rent_amount: finalAmount, // المبلغ النهائي بعد التخفيض
              billboard_rent_price: billboardPrice, // سعر اللوحة الأساسي
              discount_amount: discountAmount, // مبلغ التخفيض
              discount_percentage: Math.round(discountPercentage * 100) / 100, // نسبة التخفيض
              installation_cost: installationCost, // تكلفة التركيب
              total_before_discount: totalBeforeDiscount, // المبلغ الكلي قبل التخفيض
              
              installation_date: finalInstallationDate,
              design_face_a_url: designA || null,
              design_face_b_url: designB || null,
              installed_image_face_a_url: item.installed_image_face_a_url || null,
              installed_image_face_b_url: item.installed_image_face_b_url || null,
              team_name: teamName,
              notes: finalNotes || '',
            });

            if (historyError) {
              console.error('Failed to save history for billboard', item.billboard_id, ':', historyError);
            } else {
              console.log(`✅ History saved for billboard ${item.billboard_id} with designs:`, {
                designA: designA ? 'Yes' : 'No',
                designB: designB ? 'Yes' : 'No',
                financials: {
                  rent: finalAmount,
                  discount: discountAmount,
                  installation: installationCost
                }
              });
            }
          } catch (itemError) {
            console.error(`Error processing item ${item.id}:`, itemError);
          }
        }
      }

      toast.success(`تم ${result === 'completed' ? 'إكمال' : 'تحديث'} ${selectedItemsForCompletion.length} لوحة`);
      setShowCompletionDialog(false);
      setSelectedItemsForCompletion([]);
      setSelectedTaskIdForCompletion(null);
      refetchTaskItems();
    } catch (error) {
      console.error('Error completing tasks:', error);
      toast.error(`فشل في تحديث اللوحات: ${error.message || 'خطأ غير معروف'}`);
    }
  };
  
  // Fetch installation tasks (from Oct 2025 onwards)
  const { data: tasks = [], isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['installation-tasks'],
    queryFn: async () => {
      const oct2025 = new Date('2025-10-01');
      
      const { data: allTasks, error } = await supabase
        .from('installation_tasks')
        .select(`
          *,
          print_tasks!installation_tasks_print_task_id_fkey(id, status),
          cutout_tasks!installation_tasks_cutout_task_id_fkey(id, status)
        `)
        .gte('created_at', oct2025.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`📋 Loaded ${allTasks?.length || 0} installation tasks`);
      
      return allTasks as any[];
    },
  });

  // Fetch task items
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: allTaskItems = [], refetch: refetchTaskItems } = useQuery({
    queryKey: ['installation-task-items', taskIds.length],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds)
        .order('status', { ascending: true });
      
      if (error) throw error;
      return data as InstallationTaskItem[];
    },
  });

  // Fetch billboards
  const billboardIds = useMemo(() => 
    [...new Set(allTaskItems.map(i => i.billboard_id))],
    [allTaskItems]
  );
  const { data: billboards = [], isLoading: billboardsLoading } = useQuery({
    queryKey: ['billboards-for-tasks', billboardIds.length, billboardIds.join(',')],
    enabled: billboardIds.length > 0,
    queryFn: async () => {
      // جلب اللوحات على دفعات لتجنب مشاكل الحد الأقصى
      const batchSize = 100;
      const allBillboards: any[] = [];
      
      for (let i = 0; i < billboardIds.length; i += batchSize) {
        const batch = billboardIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', batch);
        
        if (error) throw error;
        if (data) allBillboards.push(...data);
      }
      
      console.log(`📋 Loaded ${allBillboards.length} billboards for ${billboardIds.length} IDs`);
      return allBillboards;
    },
  });

  const billboardById = useMemo(() => {
    const map: Record<number, any> = {};
    billboards.forEach(b => { map[b.ID] = b; });
    return map;
  }, [billboards]);

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const teamById = useMemo(() => {
    const map: Record<string, any> = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  // Fetch contracts - include all contract_ids from merged tasks
  const contractIds = useMemo(() => {
    const ids = new Set<number>();
    tasks.forEach(t => {
      if (t.contract_id) ids.add(t.contract_id);
      if (t.contract_ids && Array.isArray(t.contract_ids)) {
        t.contract_ids.forEach((id: number) => ids.add(id));
      }
    });
    return [...ids];
  }, [tasks]);
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-tasks', ...contractIds],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", billboard_ids')
        .in('Contract_Number', contractIds);
      
      if (error) throw error;
      return data;
    },
  });

  const contractById = useMemo(() => {
    const map: Record<number, any> = {};
    contracts.forEach(c => { map[c.Contract_Number] = c; });
    return map;
  }, [contracts]);

  // Fetch all task designs
  const { data: allTaskDesigns = [], refetch: refetchDesigns } = useQuery({
    queryKey: ['task-designs', taskIds.length],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_designs')
        .select('*')
        .in('task_id', taskIds)
        .order('design_order', { ascending: true });
      
      if (error) throw error;
      return data as TaskDesign[];
    },
  });

  const designsByTask = useMemo(() => {
    const map: Record<string, TaskDesign[]> = {};
    allTaskDesigns.forEach(d => {
      if (!map[d.task_id]) map[d.task_id] = [];
      map[d.task_id].push(d);
    });
    return map;
  }, [allTaskDesigns]);

  // Fetch installation pricing from both sizes table (primary) and installation_print_pricing (fallback)
  const { data: installationPricing = [] } = useQuery({
    queryKey: ['installation-pricing-combined'],
    queryFn: async () => {
      // ✅ Primary: Fetch from sizes table (has installation_price column)
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('name, installation_price');
      
      if (!sizesError && sizesData && sizesData.length > 0) {
        console.log('✅ Loaded installation pricing from sizes table:', sizesData.length, 'entries');
        return sizesData.map((s: any) => ({
          size: s.name,
          install_price: s.installation_price
        }));
      }
      
      // ✅ Fallback: Fetch from installation_print_pricing table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('installation_print_pricing')
        .select('size, install_price');
      
      if (fallbackError) throw fallbackError;
      console.log('⚠️ Using fallback installation_print_pricing table:', fallbackData?.length, 'entries');
      return fallbackData || [];
    },
  });

  // Create map of size -> installation price (supports multiple formats)
  const installationPriceBySize = useMemo(() => {
    const map: Record<string, number> = {};
    installationPricing.forEach((pricing: any) => {
      const price = pricing.install_price || pricing.installation_price || 0;
      map[pricing.size] = price;
      // ✅ Also add reversed format (8x3 -> 3x8)
      const parts = pricing.size?.split('x');
      if (parts?.length === 2) {
        map[`${parts[1]}x${parts[0]}`] = price;
      }
    });
    return map;
  }, [installationPricing]);

  // Create map of billboard ID -> installation price (based on billboard size and faces)
  const installationPricingByBillboard = useMemo(() => {
    const map: Record<number, number> = {};
    billboards.forEach((b: any) => {
      // ✅ Try exact match first, then reversed format
      let basePrice = installationPriceBySize[b.Size] || 0;
      if (basePrice === 0 && b.Size) {
        const parts = b.Size.split('x');
        if (parts.length === 2) {
          basePrice = installationPriceBySize[`${parts[1]}x${parts[0]}`] || 0;
        }
      }
      // ✅ إذا كانت اللوحة وجه واحد، السعر يكون النصف
      const faces = b.Faces_Count || 2;
      const finalPrice = faces === 1 ? Math.round(basePrice / 2) : basePrice;
      map[b.ID] = finalPrice;
    });
    return map;
  }, [billboards, installationPriceBySize]);

  // Available contracts for manual task creation
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  
  const { data: availableContracts = [] } = useQuery({
    queryKey: ['available-contracts', taskType],
    enabled: addTaskDialogOpen,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", "Contract Date", billboard_ids');
      
      // إذا كان نوع المهمة "إعادة تركيب"، اعرض جميع العقود الساريه المفعول
      if (taskType === 'reinstallation') {
        query = query.gte('"End Date"', today);
      }
      
      const { data, error } = await query.order('Contract_Number', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get billboards for selected contract
  const selectedContract = useMemo(() => {
    if (selectedContractIds.length === 0) return null;
    return availableContracts.find(c => c.Contract_Number === selectedContractIds[0]);
  }, [selectedContractIds, availableContracts]);

  const { data: contractBillboards = [] } = useQuery({
    queryKey: ['contract-billboards', selectedContract?.billboard_ids],
    enabled: !!selectedContract?.billboard_ids,
    queryFn: async () => {
      if (!selectedContract?.billboard_ids) return [];
      const ids = selectedContract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', ids);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select all billboards when contract changes
  useEffect(() => {
    if (contractBillboards.length > 0) {
      setSelectedBillboardIds(contractBillboards.map(b => b.ID));
    } else {
      setSelectedBillboardIds([]);
    }
  }, [contractBillboards]);

  // Filter contracts by search term
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return availableContracts;
    const search = contractSearchTerm.toLowerCase();
    return availableContracts.filter(c => 
      String(c.Contract_Number).includes(search) ||
      c['Customer Name']?.toLowerCase().includes(search) ||
      c['Ad Type']?.toLowerCase().includes(search)
    );
  }, [availableContracts, contractSearchTerm]);

  // Group tasks by team for display
  const tasksByTeam = useMemo(() => {
    const map: Record<string, InstallationTask[]> = {};
    
    let filteredTasks = tasks;
    
    // Apply filters
    if (filterStatus !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
    }
    if (filterTeam !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.team_id === filterTeam);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(t => {
        const contract = contractById[t.contract_id];
        const taskBillboards = allTaskItems
          .filter(item => item.task_id === t.id)
          .map(item => billboardById[item.billboard_id])
          .filter(Boolean);
        
        return (
          String(t.contract_id).includes(search) ||
          contract?.['Customer Name']?.toLowerCase().includes(search) ||
          contract?.['Ad Type']?.toLowerCase().includes(search) ||
          taskBillboards.some(b => 
            b?.Billboard_Name?.toLowerCase().includes(search) ||
            b?.Municipality?.toLowerCase().includes(search) ||
            b?.District?.toLowerCase().includes(search) ||
            String(b?.ID || '').includes(search)
          )
        );
      });
    }

    filteredTasks.forEach(task => {
      const teamId = task.team_id || 'no-team';
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push(task);
    });

    return map;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractById, allTaskItems, billboardById]);

  // Create manual task or re-trigger auto-creation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (selectedContractIds.length === 0) {
        throw new Error('يرجى اختيار عقد واحد على الأقل');
      }

      if (selectedBillboardIds.length === 0) {
        throw new Error('يرجى اختيار لوحة واحدة على الأقل');
      }

      // If team is selected, create manual task for specific team
      if (selectedTeamId) {
        for (const contractId of selectedContractIds) {
          // Check if task already exists
          const { data: existingTask } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', selectedTeamId)
            .maybeSingle();

          let taskId = existingTask?.id;

          if (!taskId) {
            // Create new task
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                team_id: selectedTeamId,
                status: 'pending',
                task_type: taskType === 'reinstallation' ? 'reinstallation' : 'installation'
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }

          // Add task items for selected billboards only
          for (const billboardId of selectedBillboardIds) {
            // Check if already exists
            const { data: existing } = await supabase
              .from('installation_task_items')
              .select('id')
              .eq('task_id', taskId)
              .eq('billboard_id', billboardId)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('installation_task_items')
                .insert({
                  task_id: taskId,
                  billboard_id: billboardId,
                  status: 'pending'
                });
            }
          }
        }
      } else {
        // No team selected = auto-distribute selected billboards to teams based on sizes
        for (const contractId of selectedContractIds) {
          // Get teams and their sizes
          const { data: teamsData } = await supabase
            .from('installation_teams')
            .select('*');
          
          if (!teamsData || teamsData.length === 0) {
            throw new Error('لا توجد فرق تركيب متاحة');
          }

          // Group billboards by team based on size
          const billboardsByTeam: Record<string, number[]> = {};
          
          for (const billboardId of selectedBillboardIds) {
            const billboard = contractBillboards.find(b => b.ID === billboardId);
            if (!billboard) continue;

            // Find team that handles this size
            const team = teamsData.find(t => t.sizes && t.sizes.includes(billboard.Size));
            
            if (team) {
              if (!billboardsByTeam[team.id]) billboardsByTeam[team.id] = [];
              billboardsByTeam[team.id].push(billboardId);
            }
          }

          // Create tasks for each team
          for (const [teamId, billboardIds] of Object.entries(billboardsByTeam)) {
            const { data: existingTask } = await supabase
              .from('installation_tasks')
              .select('id')
              .eq('contract_id', contractId)
              .eq('team_id', teamId)
              .maybeSingle();

            let taskId = existingTask?.id;

            if (!taskId) {
              const { data: newTask, error: taskError } = await supabase
                .from('installation_tasks')
                .insert({
                  contract_id: contractId,
                  team_id: teamId,
                  status: 'pending',
                  task_type: taskType === 'reinstallation' ? 'reinstallation' : 'installation'
                })
                .select()
                .single();

              if (taskError) throw taskError;
              taskId = newTask.id;
            }

            // Add task items
            for (const billboardId of billboardIds) {
              const { data: existing } = await supabase
                .from('installation_task_items')
                .select('id')
                .eq('task_id', taskId)
                .eq('billboard_id', billboardId)
                .maybeSingle();

              if (!existing) {
                await supabase
                  .from('installation_task_items')
                  .insert({
                    task_id: taskId,
                    billboard_id: billboardId,
                    status: 'pending'
                  });
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success(selectedTeamId ? 'تم إضافة المهمة بنجاح' : 'تم توزيع المهام على الفرق تلقائياً');
      setAddTaskDialogOpen(false);
      setSelectedContractIds([]);
      setSelectedTeamId('');
      setContractSearchTerm('');
      setSelectedBillboardIds([]);
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إضافة المهمة');
    },
  });

  // Complete task item
  const completeItemMutation = useMutation({
    mutationFn: async ({ itemId, date, notes }: { itemId: string; date: string; notes?: string }) => {
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          status: 'completed',
          installation_date: date,
          notes: notes || null
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إكمال اللوحة');
      refetchTaskItems();
    },
  });

  // Uncomplete task item (التراجع عن إكمال لوحة)
  const uncompleteItemMutation = useMutation({
    mutationFn: async ({ itemId, taskId }: { itemId: string; taskId: string }) => {
      // Update the item to pending
      const { error: itemError } = await supabase
        .from('installation_task_items')
        .update({ 
          status: 'pending',
          installation_date: null 
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Check if any items are still pending
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('status')
        .eq('task_id', taskId);

      const hasPending = items?.some(i => i.status === 'pending');

      // Update task status if needed
      if (hasPending) {
        await supabase
          .from('installation_tasks')
          .update({ status: 'in_progress' })
          .eq('id', taskId);
      }
    },
    onSuccess: () => {
      toast.success('تم التراجع عن إكمال اللوحة');
      refetchTaskItems();
    },
  });

  // Create composite task for installation only (for reinstallation tasks)
  const createCompositeTaskMutation = useMutation({
    mutationFn: async ({ taskId, contractId, customerName, customerId }: { taskId: string; contractId: number; customerName: string; customerId: string | null }) => {
      // Check if composite task already exists for this installation task
      const { data: existing } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('installation_task_id', taskId)
        .maybeSingle();

      if (existing) {
        throw new Error('توجد مهمة مجمعة مرتبطة بهذه المهمة بالفعل');
      }

      // Get contract data
      const { data: contract } = await supabase
        .from('Contract')
        .select('installation_cost, customer_id, "Customer Name"')
        .eq('Contract_Number', contractId)
        .single();

      // Get task items with customer_installation_cost already set
      const { data: taskItemsData } = await supabase
        .from('installation_task_items')
        .select('billboard_id, customer_installation_cost')
        .eq('task_id', taskId);

      // Calculate customer installation cost from task items (this is the value set by TaskTotalCostSummary)
      let customerInstallationCost = 0;
      if (taskItemsData) {
        customerInstallationCost = taskItemsData.reduce((sum, item) => 
          sum + (item.customer_installation_cost || 0), 0
        );
      }

      // Company cost is from contract
      const companyInstallationCost = contract?.installation_cost || 0;
      const finalCustomerId = customerId || contract?.customer_id;
      const finalCustomerName = customerName || contract?.['Customer Name'] || 'غير محدد';

      // Create composite task with installation only
      const { data: compositeTask, error } = await supabase
        .from('composite_tasks')
        .insert({
          contract_id: contractId,
          customer_id: finalCustomerId,
          customer_name: finalCustomerName,
          task_type: 'reinstallation',
          installation_task_id: taskId,
          print_task_id: null,
          cutout_task_id: null,
          customer_installation_cost: customerInstallationCost,
          company_installation_cost: companyInstallationCost,
          customer_print_cost: 0,
          company_print_cost: 0,
          customer_cutout_cost: 0,
          company_cutout_cost: 0,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return compositeTask;
    },
    onSuccess: () => {
      toast.success('تم إنشاء المهمة المجمعة للتركيب بنجاح');
      setCreateCompositeDialogOpen(false);
      setSelectedTaskForComposite(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إنشاء المهمة المجمعة');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Delete task items first
      const { error: itemsError } = await supabase
        .from('installation_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      // Delete task
      const { error: taskError } = await supabase
        .from('installation_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة');
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المهمة');
    },
  });

  const handleRefreshAll = () => {
    refetchTasks();
    refetchTaskItems();
    refetchDesigns();
  };

  // Stats - count tasks as completed if ALL their items are completed
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const totalBillboards = allTaskItems.length;
    const completedBillboards = allTaskItems.filter(i => i.status === 'completed').length;
    
    // Count tasks where ALL items are completed as completed tasks
    const completedTasks = tasks.filter(task => {
      const taskItemsList = allTaskItems.filter(i => i.task_id === task.id);
      return taskItemsList.length > 0 && taskItemsList.every(i => i.status === 'completed');
    }).length;
    
    // Pending tasks are those that have at least one pending item or task status is pending
    const pendingTasks = tasks.filter(task => {
      const taskItemsList = allTaskItems.filter(i => i.task_id === task.id);
      return taskItemsList.some(i => i.status === 'pending') || task.status === 'pending';
    }).length;

    return { totalTasks, pendingTasks, completedTasks, totalBillboards, completedBillboards };
  }, [tasks, allTaskItems]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">مهام التركيب</h1>
          <p className="text-muted-foreground">إدارة مهام التركيب وإعادة التركيب - يتم إنشاء المهام تلقائياً وتحديثها عند تعديل العقود</p>
        </div>
        <Button onClick={() => setAddTaskDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة مهمة
        </Button>
      </div>

      {/* Info Alert */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">النظام الديناميكي للمهام</p>
              <p className="text-xs text-muted-foreground">
                • يتم إنشاء المهام تلقائياً من العقود (رقم 1161 فصاعداً)
                <br />
                • يتم توزيع اللوحات على الفرق حسب المقاسات المخصصة لكل فريق
                <br />
                • عند إضافة أو حذف لوحة من العقد، يتم تحديث المهام فوراً
                <br />
                • يمكنك إضافة مهمة يدوياً لفريق محدد أو توزيعها تلقائياً على جميع الفرق
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">معلقة</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">اللوحات</p>
                <p className="text-2xl font-bold">{stats.totalBillboards}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">لوحات مركبة</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedBillboards}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="رقم العقد، العميل، رقم اللوحة، المدينة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter-status">الحالة</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-team">الفريق</Label>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger id="filter-team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.team_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleRefreshAll} className="w-full">
                تحديث
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks grouped by team */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : Object.keys(tasksByTeam).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد مهام</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(tasksByTeam).map(([teamId, teamTasks]) => {
            const team = teamById[teamId];
            const teamItems = allTaskItems.filter(item => 
              teamTasks.some(t => t.id === item.task_id)
            );
            const completedItemsCount = teamItems.filter(i => i.status === 'completed').length;
            const pendingItemsCount = teamItems.filter(i => i.status === 'pending').length;
            const teamCompletionPercentage = teamItems.length > 0 
              ? Math.round((completedItemsCount / teamItems.length) * 100) 
              : 0;
            
            // حساب تكلفة التركيب الإجمالية للفريق
            const teamTotalInstallCost = teamItems.reduce((sum, item) => {
              const price = installationPricingByBillboard[item.billboard_id] || 0;
              return sum + price;
            }, 0);
            
            // عدد المهام المكتملة بالكامل
            const fullyCompletedTasks = teamTasks.filter(task => {
              const taskItemsList = allTaskItems.filter(i => i.task_id === task.id);
              const taskCompleted = taskItemsList.filter(i => i.status === 'completed').length;
              return taskItemsList.length > 0 && taskCompleted === taskItemsList.length;
            }).length;

            return (
              <Collapsible key={teamId} defaultOpen>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                     <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="relative">
                             <Users className="h-6 w-6 text-primary" />
                             {teamCompletionPercentage === 100 && (
                               <CheckCircle2 className="h-3 w-3 text-green-500 absolute -top-1 -right-1" />
                             )}
                           </div>
                           <div className="text-right">
                             <CardTitle className="text-lg flex items-center gap-2">
                               {team?.team_name || 'فريق غير محدد'}
                               {teamCompletionPercentage === 100 && (
                                 <Badge className="bg-green-500 text-white text-xs">مكتمل</Badge>
                               )}
                             </CardTitle>
                             {/* ملخص الفريق */}
                             <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                               <span className="flex items-center gap-1">
                                 <Package className="h-3.5 w-3.5" />
                                 {teamTasks.length} مهمة
                               </span>
                               <span className="text-muted-foreground/50">|</span>
                               <span>{teamItems.length} لوحة</span>
                               <span className="text-muted-foreground/50">|</span>
                               <span className="text-green-600 dark:text-green-400">
                                 {completedItemsCount} مكتملة
                               </span>
                               {pendingItemsCount > 0 && (
                                 <>
                                   <span className="text-muted-foreground/50">|</span>
                                   <span className="text-orange-600 dark:text-orange-400">
                                     {pendingItemsCount} معلقة
                                   </span>
                                 </>
                               )}
                               {fullyCompletedTasks > 0 && (
                                 <>
                                   <span className="text-muted-foreground/50">|</span>
                                   <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                     {fullyCompletedTasks}/{teamTasks.length} مهام مكتملة
                                   </Badge>
                                 </>
                               )}
                               {teamTotalInstallCost > 0 && (
                                 <>
                                   <span className="text-muted-foreground/50">|</span>
                                   <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                     التكلفة: {teamTotalInstallCost.toLocaleString('ar-LY')} د.ل
                                   </Badge>
                                 </>
                               )}
                             </div>
                             {/* شريط تقدم الفريق */}
                             <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                               <div 
                                 className={`h-full transition-all duration-500 rounded-full ${
                                   teamCompletionPercentage === 100 
                                     ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                     : teamCompletionPercentage > 0 
                                       ? 'bg-gradient-to-r from-orange-400 to-amber-500'
                                       : 'bg-muted-foreground/20'
                                 }`}
                                 style={{ width: `${teamCompletionPercentage}%` }}
                               />
                             </div>
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           {/* زر دمج المهام */}
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               // Group tasks by customer
                               const customerGroups: Record<string, any[]> = {};
                               teamTasks.forEach(task => {
                                 const contract = contractById[task.contract_id];
                                 const customerId = contract?.customer_id || 'unknown';
                                 if (!customerGroups[customerId]) {
                                   customerGroups[customerId] = [];
                                 }
                                 const taskItems = allTaskItems.filter(i => i.task_id === task.id);
                                  customerGroups[customerId].push({
                                    id: task.id,
                                    contract_id: task.contract_id,
                                    customer_name: contract?.['Customer Name'] || 'غير محدد',
                                    billboard_count: taskItems.length,
                                    task_type: task.task_type,
                                    ad_type: contract?.['Ad Type'] || ''
                                  });
                               });
                               
                               // Find customers with multiple tasks
                               const customersWithMultipleTasks = Object.entries(customerGroups)
                                 .filter(([_, tasks]) => tasks.length > 1);
                               
                               if (customersWithMultipleTasks.length === 0) {
                                 toast.error('لا يوجد زبائن لديهم أكثر من مهمة في هذا الفريق');
                                 return;
                               }
                               
                               // For simplicity, take the first customer with multiple tasks
                               const [customerId, tasks] = customersWithMultipleTasks[0];
                               setSelectedTeamForMerge({ id: teamId, name: team?.team_name || 'فريق غير محدد' });
                               setSelectedCustomerForMerge(customerId);
                               setTasksToMerge(tasks);
                               setMergeDialogOpen(true);
                             }}
                             className="text-xs"
                           >
                             <Merge className="h-3 w-3 mr-1" />
                             دمج المهام
                           </Button>
                           <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
                         </div>
                       </div>
                     </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {teamTasks.map(task => {
                        const contract = contractById[task.contract_id];
                        const taskItems = allTaskItems.filter(i => i.task_id === task.id);
                        const taskDesigns = designsByTask[task.id] || [];
                        const completedItems = taskItems.filter(i => i.status === 'completed').length;
                        
                        // حساب تكلفة تركيب الفرقة من سعر اللوحة مباشرة
                        const totalInstallCost = taskItems.reduce((sum, item) => {
                          const price = installationPricingByBillboard[item.billboard_id] || 0;
                          return sum + price;
                        }, 0);

                        // Check if this is a merged task
                        const isMergedTask = task.contract_ids && task.contract_ids.length > 1;
                        
                        // حساب نسبة الإكمال
                        const completionPercentage = taskItems.length > 0 
                          ? Math.round((completedItems / taskItems.length) * 100) 
                          : 0;
                        const isFullyCompleted = completedItems === taskItems.length && taskItems.length > 0;
                        const isPartiallyCompleted = completedItems > 0 && completedItems < taskItems.length;
                        
                        // استخراج صورة التصميم من عناصر المهمة
                        const designItem = taskItems.find(item => item.design_face_a || item.design_face_b);
                        const designImage = designItem?.design_face_a || designItem?.design_face_b;
                        
                        return (
                          <Collapsible key={task.id}>
                            <TaskCardWrapper 
                              designImage={designImage}
                              isCompleted={isFullyCompleted}
                              isPartiallyCompleted={isPartiallyCompleted}
                              completionPercentage={completionPercentage}
                            >
                              <CardHeader className="space-y-0 relative z-10 py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="text-right space-y-1">
                       <div className="flex items-center gap-2 flex-wrap">
                        {/* عرض جميع العقود للمهام المدمجة */}
                        {isMergedTask && task.contract_ids ? (
                          <>
                            {task.contract_ids.map((contractId: number, index: number) => {
                              const mergedContract = contractById[contractId];
                              return (
                                <div key={contractId} className="flex items-center gap-1">
                                  <Badge variant="outline" className="font-bold bg-primary/10">
                                    #{contractId}
                                  </Badge>
                                  {mergedContract?.['Ad Type'] && (
                                    <Badge variant="secondary" className="text-xs">
                                      {mergedContract['Ad Type']}
                                    </Badge>
                                  )}
                                  {index < task.contract_ids.length - 1 && (
                                    <span className="text-muted-foreground mx-1">+</span>
                                  )}
                                </div>
                              );
                            })}
                            <Badge className="bg-orange-500 text-white text-xs">مدمجة</Badge>
                            {task.task_type === 'reinstallation' ? (
                              <Badge className="bg-amber-600 text-white text-xs">إعادة تركيب</Badge>
                            ) : (
                              <Badge className="bg-green-600 text-white text-xs">تركيب جديد</Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="font-bold">
                              #{task.contract_id}
                            </Badge>
                            {contract?.['Ad Type'] && (
                              <Badge variant="secondary">
                                {contract['Ad Type']}
                              </Badge>
                            )}
                            {task.task_type === 'reinstallation' && (
                              <Badge className="bg-amber-600 text-white text-xs">إعادة تركيب</Badge>
                            )}
                          </>
                        )}
                        <span className="font-bold">
                          {contract?.['Customer Name'] || 'غير محدد'}
                        </span>
                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{taskItems.length} لوحة</span>
                                        
                                        {/* حالة الإكتمال */}
                                        {isFullyCompleted ? (
                                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md shadow-green-500/30 gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            مكتملة بالكامل
                                          </Badge>
                                        ) : isPartiallyCompleted ? (
                                          <Badge className="bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-md shadow-orange-400/30 gap-1">
                                            <Clock className="h-3 w-3" />
                                            {completedItems}/{taskItems.length} ({completionPercentage}%)
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-muted-foreground">
                                            لم تبدأ بعد
                                          </Badge>
                                        )}
                                        
                                        {totalInstallCost > 0 && (
                                          <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 backdrop-blur-sm">
                                            تكلفة التركيب: {totalInstallCost.toLocaleString('ar-LY')} د.ل
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForDesign(task.id);
                                        setDesignDialogOpen(true);
                                      }}
                                    >
                                      <PaintBucket className="h-4 w-4 mr-2" />
                                      إدارة التصاميم
                                    </Button>
                                    {/* زر توزيع التصاميم - يظهر دائمًا */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`${taskDesigns.length === 0 ? 'border-dashed border-muted-foreground/50 text-muted-foreground' : 'bg-primary/10 border-primary/30'}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (taskDesigns.length === 0) {
                                          toast.info('يرجى إضافة تصاميم أولاً من زر "إدارة التصاميم"');
                                          setSelectedTaskForDesign(task.id);
                                          setDesignDialogOpen(true);
                                          return;
                                        }
                                        setSelectedTaskForDesign(task.id);
                                        setBulkDesignDialogOpen(true);
                                      }}
                                    >
                                      <Layers className="h-4 w-4 mr-2" />
                                      توزيع التصاميم
                                      {taskDesigns.length === 0 && (
                                        <Badge variant="outline" className="mr-2 text-[9px] px-1.5 py-0 font-normal">
                                          أضف تصاميم
                                        </Badge>
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPrintTaskId(task.id);
                                        setPrintDialogOpen(true);
                                      }}
                                    >
                                      <Printer className="h-4 w-4 mr-2" />
                                      طباعة
                                    </Button>
                                    {/* زر طباعة اللوحات المنفصلة - يفتح نافذة منبثقة */}
                                    <BillboardPrintSettingsDialog
                                      open={printSettingsDialogTaskId === task.id}
                                      onOpenChange={(open) => setPrintSettingsDialogTaskId(open ? task.id : null)}
                                      taskId={task.id}
                                    >
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-primary/10 border-primary/30"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        طباعة منفصلة
                                      </Button>
                                    </BillboardPrintSettingsDialog>
                                    {/* زر تعديل نوع المهمة */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForEdit({
                                          id: task.id,
                                          taskType: task.task_type || 'installation'
                                        });
                                        setEditTaskTypeDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      تعديل النوع
                                    </Button>
                                    {/* زر نقل اللوحات */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForTransfer({
                                          taskId: task.id,
                                          teamId: task.team_id,
                                          teamName: team?.team_name || 'غير محدد',
                                          contractId: task.contract_id
                                        });
                                        setTransferDialogOpen(true);
                                      }}
                                    >
                                      <ArrowRight className="h-4 w-4 mr-2" />
                                      نقل لوحات
                                    </Button>
                                    {/* زر طباعة جميع لوحات العقد */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedContractForPrint({
                                          contractNumber: task.contract_id,
                                          customerName: contract?.['Customer Name'] || 'غير محدد'
                                        });
                                        setPrintAllDialogOpen(true);
                                      }}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      طباعة الكل
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('هل أنت متأكد من حذف مهمة التركيب؟ سيتم حذف جميع البيانات المرتبطة بها.')) {
                                          deleteTaskMutation.mutate(task.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      حذف
                                    </Button>
                                    
                                    {/* أزرار مهام الطباعة والمجسمات */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* مهمة الطباعة */}
                                      {task.print_tasks ? (
                                        <Badge 
                                          variant={
                                            task.print_tasks.status === 'completed' ? 'default' : 
                                            task.print_tasks.status === 'in_progress' ? 'secondary' : 
                                            'destructive'
                                          }
                                          className={`cursor-pointer ${
                                            task.print_tasks.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : 
                                            task.print_tasks.status === 'in_progress' ? 'bg-orange-500 hover:bg-orange-600' : 
                                            'bg-red-500 hover:bg-red-600'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.location.href = '/admin/print-tasks';
                                          }}
                                        >
                                          <Printer className="h-3 w-3 ml-1" />
                                          طباعة ({
                                            task.print_tasks.status === 'completed' ? 'مكتملة' : 
                                            task.print_tasks.status === 'in_progress' ? 'قيد التنفيذ' : 
                                            'معلقة'
                                          })
                                        </Badge>
                                      ) : null}

                                      {/* مهمة المجسمات */}
                                      {task.cutout_tasks ? (
                                        <Badge 
                                          variant={
                                            task.cutout_tasks.status === 'completed' ? 'default' : 
                                            task.cutout_tasks.status === 'in_progress' ? 'secondary' : 
                                            'destructive'
                                          }
                                          className={`cursor-pointer ${
                                            task.cutout_tasks.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : 
                                            task.cutout_tasks.status === 'in_progress' ? 'bg-orange-500 hover:bg-orange-600' : 
                                            'bg-red-500 hover:bg-red-600'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.location.href = '/admin/cutout-tasks';
                                          }}
                                        >
                                          <Package className="h-3 w-3 ml-1" />
                                          مجسمات ({
                                            task.cutout_tasks.status === 'completed' ? 'مكتملة' : 
                                            task.cutout_tasks.status === 'in_progress' ? 'قيد التنفيذ' : 
                                            'معلقة'
                                          })
                                        </Badge>
                                      ) : null}
                                      
                                      {/* زر إنشاء مهام جديد */}
                                      {!task.print_tasks && !task.cutout_tasks && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="bg-primary/10"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTaskForPrint(task.id);
                                            setCreatePrintTaskDialogOpen(true);
                                          }}
                                        >
                                          <Printer className="h-4 w-4 mr-2" />
                                          إنشاء مهام
                                        </Button>
                                      )}
                                      
                                      {/* زر حذف مهمة الطباعة */}
                                      {task.print_task_id && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="border-red-500 text-red-500 hover:bg-red-50"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('هل أنت متأكد من حذف مهمة الطباعة؟')) {
                                              try {
                                                // Delete print task items first
                                                const { error: itemsError } = await supabase
                                                  .from('print_task_items')
                                                  .delete()
                                                  .eq('task_id', task.print_task_id);
                                                
                                                if (itemsError) throw itemsError;
                                                
                                                // Delete print task
                                                const { error: taskError } = await supabase
                                                  .from('print_tasks')
                                                  .delete()
                                                  .eq('id', task.print_task_id);
                                                
                                                if (taskError) throw taskError;
                                                
                                                // Update installation task
                                                const { error: updateError } = await supabase
                                                  .from('installation_tasks')
                                                  .update({ print_task_id: null })
                                                  .eq('id', task.id);
                                                
                                                if (updateError) throw updateError;
                                                
                                                toast.success('تم حذف مهمة الطباعة بنجاح');
                                                queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
                                                queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
                                              } catch (error) {
                                                console.error('Error deleting print task:', error);
                                                toast.error('فشل في حذف مهمة الطباعة');
                                              }
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          حذف مهمة الطباعة
                                        </Button>
                                      )}
                                      
                                      {/* زر إنشاء مهمة مجمعة للتركيب فقط - لإعادة التركيب */}
                                      {task.task_type === 'reinstallation' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="bg-amber-50 border-amber-500 text-amber-700 hover:bg-amber-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTaskForComposite({
                                              taskId: task.id,
                                              contractId: task.contract_id,
                                              customerName: contract?.['Customer Name'] || 'غير محدد',
                                              customerId: contract?.customer_id || null
                                            });
                                            setCreateCompositeDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          مهمة مجمعة
                                        </Button>
                                      )}
                                    </div>
                                  {taskItems.filter(i => i.status !== 'completed').length > 0 && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedTaskIdForCompletion(task.id);
                                          setSelectedItemsForCompletion([]);
                                          setShowCompletionDialog(true);
                                        }}
                                      >
                                        <CheckCircle2 className="h-4 w-4 ml-2" />
                                        إكمال اللوحات
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedTaskIdForBulk(task.id);
                                          setSelectedItemsForDate([]);
                                          setBulkInstallationDate('');
                                          setBulkDateDialogOpen(true);
                                        }}
                                      >
                                        <CalendarIcon className="h-4 w-4 ml-2" />
                                        تحديد تاريخ تركيب
                                      </Button>
                                    </>
                                   )}
                                   {isMergedTask && (
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       className="text-orange-600 hover:text-orange-700"
                                       onClick={async (e) => {
                                         e.stopPropagation();
                                         if (confirm('هل تريد التراجع عن دمج هذه المهمة؟ سيتم إنشاء مهام منفصلة لكل عقد.')) {
                                           try {
                                             // Get all items
                                             const { data: items, error: itemsError } = await supabase
                                               .from('installation_task_items')
                                               .select('*')
                                               .eq('task_id', task.id);
                                             
                                             if (itemsError) throw itemsError;
                                             
                                             // Group items by contract
                                             const itemsByContract: Record<number, any[]> = {};
                                             items?.forEach(item => {
                                               const billboard = billboardById[item.billboard_id];
                                               const contractId = billboard?.Contract_Number;
                                               if (contractId) {
                                                 if (!itemsByContract[contractId]) itemsByContract[contractId] = [];
                                                 itemsByContract[contractId].push(item);
                                               }
                                             });
                                             
                                             // Delete items from merged task
                                             const { error: deleteItemsError } = await supabase
                                               .from('installation_task_items')
                                               .delete()
                                               .eq('task_id', task.id);
                                             
                                             if (deleteItemsError) throw deleteItemsError;
                                             
                                             // Delete merged task
                                             const { error: deleteTaskError } = await supabase
                                               .from('installation_tasks')
                                               .delete()
                                               .eq('id', task.id);
                                             
                                             if (deleteTaskError) throw deleteTaskError;
                                             
                                             // Create new tasks for each contract
                                             for (const [contractId, contractItems] of Object.entries(itemsByContract)) {
                                               const { data: newTask, error: taskError } = await supabase
                                                 .from('installation_tasks')
                                                 .insert({
                                                   contract_id: Number(contractId),
                                                   team_id: task.team_id,
                                                   status: 'pending'
                                                 })
                                                 .select()
                                                 .single();
                                               
                                               if (taskError) throw taskError;
                                               
                                               // Add items to new task
                                               const updates = contractItems.map(item => {
                                                 const { id, created_at, ...itemWithoutId } = item;
                                                 return {
                                                   ...itemWithoutId,
                                                   task_id: newTask.id
                                                 };
                                               });
                                               
                                               const { error: insertError } = await supabase
                                                 .from('installation_task_items')
                                                 .insert(updates);
                                               
                                               if (insertError) throw insertError;
                                             }
                                             
                                             toast.success(`تم التراجع عن الدمج وإنشاء ${Object.keys(itemsByContract).length} مهمة منفصلة`);
                                             handleRefreshAll();
                                           } catch (error: any) {
                                             console.error('Error unmerging task:', error);
                                             toast.error('فشل في التراجع عن الدمج: ' + error.message);
                                           }
                                         }
                                       }}
                                     >
                                       <RotateCcw className="h-4 w-4 mr-2" />
                                       التراجع عن الدمج
                                     </Button>
                                   )}
                                   <Button
                                       variant="outline"
                                       size="sm"
                                       className="text-destructive hover:text-destructive"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                           deleteTaskMutation.mutate(task.id);
                                         }
                                       }}
                                     >
                                       <Trash2 className="h-4 w-4 mr-2" />
                                       حذف
                                     </Button>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </div>
                              </CardHeader>
                              <CollapsibleContent>
                                <CardContent className="pt-0 space-y-4">
                                  {/* ملخص تكاليف المهمة */}
                                  <TaskTotalCostSummary
                                    taskId={task.id}
                                    taskItems={taskItems}
                                    installationPrices={installationPricingByBillboard}
                                    billboards={billboardById}
                                    onRefresh={refetchTaskItems}
                                  />
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {taskItems.map(item => {
                                      const billboard = billboardById[item.billboard_id];
                                      const installationPrice = installationPricingByBillboard[item.billboard_id] || 0;
                                      return (
                                         <BillboardTaskCard
                                          key={item.id}
                                          item={item}
                                          billboard={billboard}
                                          installationPrice={installationPrice}
                                           isSelected={
                                             selectedItemsForCompletion.includes(item.id) || 
                                             selectedItemsForDate.includes(item.id)
                                           }
                                           isCompleted={item.status === 'completed'}
                                           taskDesigns={taskDesigns}
                                           onDelete={item.status !== 'completed' ? async () => {
                                             try {
                                               const { error } = await supabase
                                                 .from('installation_task_items')
                                                 .delete()
                                                 .eq('id', item.id);
                                               
                                               if (error) throw error;
                                               
                                               toast.success('تم حذف اللوحة من المهمة');
                                               refetchTaskItems();
                                             } catch (error: any) {
                                               console.error('Error deleting item:', error);
                                               toast.error('فشل في حذف اللوحة: ' + error.message);
                                             }
                                           } : undefined}
                                            onSelectionChange={(checked) => {
                                              // التحديد فقط - لا يتم فتح النافذة أو الإكمال تلقائياً
                                              if (item.status === 'completed') {
                                                toast.info('هذه اللوحة مكتملة بالفعل');
                                                return;
                                              }
                                              
                                              // التحديد للـ completion dialog
                                              if (showCompletionDialog && selectedTaskIdForCompletion === task.id) {
                                                if (checked) {
                                                  setSelectedItemsForCompletion(prev => [...prev, item.id]);
                                                } else {
                                                  setSelectedItemsForCompletion(prev => prev.filter(id => id !== item.id));
                                                }
                                              }
                                              // التحديد للـ date dialog  
                                              else if (bulkDateDialogOpen && selectedTaskIdForBulk === task.id) {
                                                if (checked) {
                                                  setSelectedItemsForDate(prev => [...prev, item.id]);
                                                  if (!selectedTaskIdForBulk) {
                                                    setSelectedTaskIdForBulk(task.id);
                                                  }
                                                } else {
                                                  setSelectedItemsForDate(prev => prev.filter(id => id !== item.id));
                                                }
                                              }
                                            }}
                                          onUncomplete={item.status === 'completed' ? () => {
                                            uncompleteItemMutation.mutate({ itemId: item.id, taskId: task.id });
                                          } : undefined}
                                          onEditDesign={() => {
                                            setSelectedTaskForDesign(item.task_id);
                                            setDesignDialogOpen(true);
                                          }}
                                          onPrint={() => {
                                            setPrintTaskId(item.task_id);
                                            setPrintDialogOpen(true);
                                          }}
                                          onAddInstalledImage={() => {
                                            setSelectedItemForImage(item);
                                            setInstalledImageUrl(item.installed_image_url || '');
                                            setInstalledImageFaceAUrl(item.installed_image_face_a_url || '');
                                            setInstalledImageFaceBUrl(item.installed_image_face_b_url || '');
                                            setImageDialogOpen(true);
                                          }}
                                          onRefresh={refetchTaskItems}
                                        />
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </TaskCardWrapper>
                          </Collapsible>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={addTaskDialogOpen} onOpenChange={setAddTaskDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">إضافة مهمة تركيب</DialogTitle>
            <p className="text-sm text-muted-foreground">
              اختر العقد واللوحات والفريق لإنشاء مهمة تركيب جديدة
            </p>
          </DialogHeader>
          <div className="space-y-6">
            {/* نوع المهمة */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">نوع المهمة</Label>
              <Select value={taskType} onValueChange={(v: any) => setTaskType(v)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">تركيب جديد</SelectItem>
                  <SelectItem value="reinstallation">إعادة تركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* البحث والعقد */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">اختيار العقد</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث برقم العقد أو اسم العميل..."
                  value={contractSearchTerm}
                  onChange={(e) => setContractSearchTerm(e.target.value)}
                  className="pr-10 h-11"
                />
              </div>
              <Select
                value={selectedContractIds[0]?.toString() || ''}
                onValueChange={(v) => setSelectedContractIds([parseInt(v)])}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="اختر عقداً..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredContracts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {contractSearchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد عقود متاحة'}
                    </div>
                  ) : (
                    filteredContracts.map(contract => (
                      <SelectItem key={contract.Contract_Number} value={contract.Contract_Number.toString()}>
                        <div className="flex flex-col items-start py-1">
                          <span className="font-bold text-base">#{contract.Contract_Number} - {contract['Customer Name']}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {contract['Ad Type'] && <span>{contract['Ad Type']}</span>}
                            {contract['Contract Date'] && (
                              <>
                                <span>•</span>
                                <span>تاريخ العقد: {new Date(contract['Contract Date']).toLocaleDateString('ar-LY')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedContract && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  عدد اللوحات في العقد: {contractBillboards.length} لوحة
                </div>
              )}
            </div>

            {/* اختيار اللوحات */}
            {selectedContract && contractBillboards.length > 0 && (
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">اللوحات المتاحة ({contractBillboards.length})</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBillboardIds(contractBillboards.map(b => b.ID))}
                      className="h-8 text-xs"
                    >
                      اختيار الكل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBillboardIds([])}
                      className="h-8 text-xs"
                    >
                      إلغاء الكل
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {contractBillboards.map(billboard => (
                    <label
                      key={billboard.ID}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedBillboardIds.includes(billboard.ID)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBillboardIds.includes(billboard.ID)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBillboardIds([...selectedBillboardIds, billboard.ID]);
                          } else {
                            setSelectedBillboardIds(selectedBillboardIds.filter(id => id !== billboard.ID));
                          }
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{billboard.Billboard_Name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {billboard.Size} • {billboard.Municipality || billboard.District}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-center text-muted-foreground">
                  محدد: {selectedBillboardIds.length} من {contractBillboards.length}
                </div>
              </div>
            )}

            {/* اختيار الفريق */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">الفريق</Label>
              <Select value={selectedTeamId || 'auto'} onValueChange={(v) => setSelectedTeamId(v === 'auto' ? '' : v)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">توزيع تلقائي</span>
                      <span className="text-xs text-muted-foreground">(حسب المقاسات)</span>
                    </div>
                  </SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">{team.team_name}</span>
                        <span className="text-xs text-muted-foreground">
                          المقاسات: {team.sizes?.join(', ') || 'جميع المقاسات'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedTeamId && (
                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-900">
                  ℹ️ سيتم توزيع اللوحات على الفرق المناسبة حسب المقاسات تلقائياً
                </p>
              )}
            </div>

            {/* الأزرار */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setAddTaskDialogOpen(false);
                  setContractSearchTerm('');
                  setSelectedBillboardIds([]);
                }}
              >
                إلغاء
              </Button>
              <Button 
                onClick={() => createTaskMutation.mutate()}
                disabled={createTaskMutation.isPending || selectedContractIds.length === 0 || selectedBillboardIds.length === 0}
                className="min-w-[120px]"
              >
                {createTaskMutation.isPending ? 'جاري الإضافة...' : `إضافة المهمة (${selectedBillboardIds.length} لوحة)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Design Manager Dialog */}
      {selectedTaskForDesign && (
        <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إدارة التصاميم</DialogTitle>
            </DialogHeader>
            <TaskDesignManager
              taskId={selectedTaskForDesign}
              designs={designsByTask[selectedTaskForDesign] || []}
              onDesignsUpdate={() => {
                refetchDesigns();
                refetchTaskItems();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Design Assigner Dialog */}
      {selectedTaskForDesign && (
        <BulkDesignAssigner
          open={bulkDesignDialogOpen}
          onOpenChange={setBulkDesignDialogOpen}
          taskItems={allTaskItems
            .filter(i => i.task_id === selectedTaskForDesign)
            .map(item => ({
              ...item,
              billboards: billboardById[item.billboard_id]
            }))}
          taskDesigns={designsByTask[selectedTaskForDesign] || []}
          onSuccess={() => {
            refetchTaskItems();
            setBulkDesignDialogOpen(false);
          }}
        />
      )}

      {/* Print Dialog */}
      {printTaskId && (() => {
        const currentTask = tasks.find(t => t.id === printTaskId);
        const taskBillboards = allTaskItems
          .filter(i => i.task_id === printTaskId)
          .map(i => billboardById[i.billboard_id])
          .filter(Boolean);
        const contract = contractById[currentTask?.contract_id || 0];
        const customerName = contract?.['Customer Name'] || '';
        const adType = contract?.['Ad Type'] || '';
        const teamName = teamById[currentTask?.team_id || '']?.team_name || '';
        
        return (
          <BillboardBulkPrintDialog
            open={printDialogOpen}
            onOpenChange={setPrintDialogOpen}
            billboards={taskBillboards.map(b => {
              const item = allTaskItems.find(i => i.billboard_id === b.ID && i.task_id === printTaskId);
              return {
                ...b,
                design_face_a: item?.design_face_a || b.design_face_a,
                design_face_b: item?.design_face_b || b.design_face_b,
                installed_image_face_a_url: item?.installed_image_face_a_url,
                installed_image_face_b_url: item?.installed_image_face_b_url,
                installed_image_url: item?.installed_image_url
              };
            })}
            contractInfo={{
              number: currentTask?.contract_id || 0,
              customerName: customerName,
              adType: adType
            }}
          />
        );
      })()}

      {/* Create Print Task Dialog */}
      {selectedTaskForPrint && (
        <CreatePrintTaskFromInstallation
          open={createPrintTaskDialogOpen}
          onOpenChange={setCreatePrintTaskDialogOpen}
          installationTaskId={selectedTaskForPrint}
          taskItems={allTaskItems.filter(i => i.task_id === selectedTaskForPrint)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
            toast.success('تم إنشاء مهمة الطباعة بنجاح');
          }}
        />
      )}

      {/* Add Installed Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة صور التركيب</DialogTitle>
            <p className="text-sm text-muted-foreground">أضف صور التركيب للوجه الأمامي والخلفي لتظهر في الطباعة فوق التصاميم</p>
          </DialogHeader>
          <div className="space-y-6">
            {/* صورة التركيب - الوجه الأمامي */}
            <div className="space-y-2">
              <Label htmlFor="installedImageFaceA" className="text-base font-semibold">صورة التركيب - الوجه الأمامي</Label>
              <Input
                id="installedImageFaceA"
                value={installedImageFaceAUrl}
                onChange={(e) => setInstalledImageFaceAUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
              {installedImageFaceAUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-green-500/30 bg-muted">
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                    الوجه الأمامي
                  </div>
                  <img
                    src={installedImageFaceAUrl}
                    alt="معاينة صورة التركيب - الوجه الأمامي"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
              )}
            </div>

            {/* صورة التركيب - الوجه الخلفي */}
            <div className="space-y-2">
              <Label htmlFor="installedImageFaceB" className="text-base font-semibold">صورة التركيب - الوجه الخلفي</Label>
              <Input
                id="installedImageFaceB"
                value={installedImageFaceBUrl}
                onChange={(e) => setInstalledImageFaceBUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
              {installedImageFaceBUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-500/30 bg-muted">
                  <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                    الوجه الخلفي
                  </div>
                  <img
                    src={installedImageFaceBUrl}
                    alt="معاينة صورة التركيب - الوجه الخلفي"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={async () => {
                  if (!selectedItemForImage) return;
                  
                  try {
                    const { error } = await supabase
                      .from('installation_task_items')
                      .update({ 
                        installed_image_url: installedImageUrl || null,
                        installed_image_face_a_url: installedImageFaceAUrl || null,
                        installed_image_face_b_url: installedImageFaceBUrl || null
                      })
                      .eq('id', selectedItemForImage.id);

                    if (error) throw error;
                    
                    toast.success('تم حفظ صور التركيب بنجاح');
                    setImageDialogOpen(false);
                    setSelectedItemForImage(null);
                    setInstalledImageUrl('');
                    setInstalledImageFaceAUrl('');
                    setInstalledImageFaceBUrl('');
                    refetchTaskItems();
                  } catch (error) {
                    console.error('Error saving images:', error);
                    toast.error('فشل في حفظ صور التركيب');
                  }
                }}
                className="flex-1"
              >
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImageDialogOpen(false);
                  setSelectedItemForImage(null);
                  setInstalledImageUrl('');
                  setInstalledImageFaceAUrl('');
                  setInstalledImageFaceBUrl('');
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Date Assignment Dialog */}
      <Dialog open={bulkDateDialogOpen} onOpenChange={setBulkDateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تحديد تاريخ التركيب</DialogTitle>
            <p className="text-sm text-muted-foreground">
              حدد اللوحات التي تريد تعيين تاريخ تركيب لها
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulkInstallationDate">تاريخ التركيب</Label>
              <Input
                id="bulkInstallationDate"
                type="date"
                value={bulkInstallationDate}
                onChange={(e) => setBulkInstallationDate(e.target.value)}
              />
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-2">
                اللوحات المحددة: {selectedItemsForDate.length}
              </p>
              {selectedItemsForDate.length === 0 && (
                <p className="text-muted-foreground">
                  قم بتحديد اللوحات من القائمة أعلاه
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkDateDialogOpen(false);
                  setSelectedItemsForDate([]);
                  setBulkInstallationDate('');
                  setSelectedTaskIdForBulk(null);
                }}
              >
                إلغاء
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedTaskIdForBulk) return;
                  const taskItems = allTaskItems.filter(i => 
                    i.task_id === selectedTaskIdForBulk && i.status !== 'completed'
                  );
                  setSelectedItemsForDate(taskItems.map(i => i.id));
                }}
              >
                تحديد الكل
              </Button>
              <Button
                onClick={async () => {
                  if (!bulkInstallationDate || selectedItemsForDate.length === 0) {
                    toast.error('يرجى تحديد التاريخ واللوحات');
                    return;
                  }

                  try {
                    const { error } = await supabase
                      .from('installation_task_items')
                      .update({ 
                        installation_date: bulkInstallationDate,
                        status: 'completed'
                      })
                      .in('id', selectedItemsForDate);

                    if (error) throw error;

                    toast.success(`تم تحديد تاريخ التركيب لـ ${selectedItemsForDate.length} لوحة`);
                    setBulkDateDialogOpen(false);
                    setSelectedItemsForDate([]);
                    setBulkInstallationDate('');
                    setSelectedTaskIdForBulk(null);
                    refetchTaskItems();
                  } catch (error) {
                    console.error('Error:', error);
                    toast.error('فشل في تحديد تاريخ التركيب');
                  }
                }}
                disabled={!bulkInstallationDate || selectedItemsForDate.length === 0}
              >
                حفظ التاريخ ({selectedItemsForDate.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Completion Dialog */}
      <TaskCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        onComplete={handleCompleteMultiple}
        selectedCount={selectedItemsForCompletion.length}
      />

      {/* Merge Tasks Dialog */}
      {selectedTeamForMerge && (
        <MergeTeamTasksDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          teamId={selectedTeamForMerge.id}
          teamName={selectedTeamForMerge.name}
          customerId={selectedCustomerForMerge || ''}
          tasks={tasksToMerge}
          onSuccess={() => {
            handleRefreshAll();
            setMergeDialogOpen(false);
            setSelectedTeamForMerge(null);
            setSelectedCustomerForMerge(null);
            setTasksToMerge([]);
          }}
        />
      )}

      {/* Edit Task Type Dialog */}
      {selectedTaskForEdit && (
        <EditTaskTypeDialog
          open={editTaskTypeDialogOpen}
          onOpenChange={setEditTaskTypeDialogOpen}
          taskId={selectedTaskForEdit.id}
          currentTaskType={selectedTaskForEdit.taskType}
          onSuccess={() => {
            handleRefreshAll();
            setSelectedTaskForEdit(null);
          }}
        />
      )}

      {/* Transfer Billboards Dialog */}
      {selectedTaskForTransfer && (
        <TransferBillboardsDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          sourceTaskId={selectedTaskForTransfer.taskId}
          sourceTeamId={selectedTaskForTransfer.teamId}
          sourceTeamName={selectedTaskForTransfer.teamName}
          taskItems={allTaskItems.filter(i => i.task_id === selectedTaskForTransfer.taskId)}
          billboards={billboardById}
          teams={teams}
          contractId={selectedTaskForTransfer.contractId}
          onSuccess={() => {
            handleRefreshAll();
            setSelectedTaskForTransfer(null);
          }}
        />
      )}

      {/* Print All Contract Billboards Dialog */}
      {selectedContractForPrint && (
        <PrintAllContractBillboardsDialog
          open={printAllDialogOpen}
          onOpenChange={setPrintAllDialogOpen}
          contractNumber={selectedContractForPrint.contractNumber}
          customerName={selectedContractForPrint.customerName}
          allTaskItems={allTaskItems}
          tasks={tasks}
          billboards={billboardById}
          teams={teamById}
          designsByTask={designsByTask}
        />
      )}

      {/* Create Composite Task Dialog for Installation Only */}
      <Dialog open={createCompositeDialogOpen} onOpenChange={setCreateCompositeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء مهمة مجمعة للتركيب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTaskForComposite && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم العقد:</span>
                    <span className="font-bold">#{selectedTaskForComposite.contractId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الزبون:</span>
                    <span className="font-bold">{selectedTaskForComposite.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نوع المهمة:</span>
                    <Badge className="bg-amber-600 text-white">إعادة تركيب</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  سيتم إنشاء مهمة مجمعة تحتوي على تكلفة التركيب فقط. يمكنك لاحقاً إضافة مهام الطباعة والقص من صفحة المهام المجمعة.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateCompositeDialogOpen(false);
                      setSelectedTaskForComposite(null);
                    }}
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedTaskForComposite) {
                        createCompositeTaskMutation.mutate({
                          taskId: selectedTaskForComposite.taskId,
                          contractId: selectedTaskForComposite.contractId,
                          customerName: selectedTaskForComposite.customerName,
                          customerId: selectedTaskForComposite.customerId
                        });
                      }
                    }}
                    disabled={createCompositeTaskMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {createCompositeTaskMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المهمة المجمعة'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
