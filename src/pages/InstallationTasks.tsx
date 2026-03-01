import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadToImgbb } from '@/services/imgbbService';
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
  Layers,
  Camera,
  Link2,
  Sparkles,
  X,
  Upload,
  Loader2,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';
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
import { EnhancedAddInstallationTaskDialog } from '@/components/installation/EnhancedAddInstallationTaskDialog';
import { MobileTaskCard } from '@/components/installation/MobileTaskCard';
import { AddBillboardsToTaskDialog } from '@/components/installation/AddBillboardsToTaskDialog';
import { InstallationTasksTable } from '@/components/installation/InstallationTasksTable';
import { InstallationTaskDetail } from '@/components/installation/InstallationTaskDetail';

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
  faces_to_install: number | null;
  customer_installation_cost: number;
  additional_cost?: number;
  additional_cost_notes?: string | null;
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
  const [uploadingInstalledA, setUploadingInstalledA] = useState(false);
  const [uploadingInstalledB, setUploadingInstalledB] = useState(false);
  const [installedUploadMethod, setInstalledUploadMethod] = useState<'url' | 'file'>('file');
  const [pasteTargetFace, setPasteTargetFace] = useState<'A' | 'B'>('A');
  // Bulk completion
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showTaskCompletionDialog, setShowTaskCompletionDialog] = useState(false);
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
  const [selectedContractForPrint, setSelectedContractForPrint] = useState<{ contractNumber: number; customerName: string; adType?: string; taskId?: string } | null>(null);
  
  // Print settings dialog state
  const [printSettingsDialogTaskId, setPrintSettingsDialogTaskId] = useState<string | null>(null);
  
  // Create composite task for installation only
  const [createCompositeDialogOpen, setCreateCompositeDialogOpen] = useState(false);
  const [selectedTaskForComposite, setSelectedTaskForComposite] = useState<{ taskId: string; contractId: number; customerName: string; customerId: string | null } | null>(null);
  
  // Bulk date assignment
  const [selectedItemsForDate, setSelectedItemsForDate] = useState<string[]>([]);
  const [selectedTaskIdForBulk, setSelectedTaskIdForBulk] = useState<string | null>(null);
  
  // Multi-task selection for bulk printing
  const [selectedTasksForPrint, setSelectedTasksForPrint] = useState<Set<string>>(new Set());
  const [multiTaskPrintDialogOpen, setMultiTaskPrintDialogOpen] = useState(false);
  
  // Board pagination - lifted to preserve page on re-render
  const [boardPage, setBoardPage] = useState(1);
  
  // Floating selection bar date
  const [floatingInstallationDate, setFloatingInstallationDate] = useState<Date | undefined>(undefined);
  const [completionInstallationDate, setCompletionInstallationDate] = useState<Date | undefined>(new Date());
  
  // Add billboards to task dialog
  const [addBillboardsDialogOpen, setAddBillboardsDialogOpen] = useState(false);
  const [selectedTaskForAddBillboards, setSelectedTaskForAddBillboards] = useState<{
    taskId: string;
    contractId: number;
    contractIds?: number[];
    existingBillboardIds: number[];
  } | null>(null);
  
  // ✅ Helper: عند إكمال جميع عناصر مهمة التركيب، يتم تلقائياً تحديث حالة مهام الطباعة والقص المرتبطة
  const autoCompleteLinkedTasks = async (taskId: string) => {
    try {
      // تحقق من أن جميع العناصر في مهمة التركيب مكتملة
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('status')
        .eq('task_id', taskId);
      
      if (!items || items.length === 0) return;
      const allCompleted = items.every(i => i.status === 'completed');
      if (!allCompleted) return;

      // البحث عن المهمة المجمعة المرتبطة
      const { data: composites } = await supabase
        .from('composite_tasks')
        .select('id, print_task_id, cutout_task_id')
        .eq('installation_task_id', taskId);

      if (!composites || composites.length === 0) {
        // بحث بديل: من installation_tasks مباشرة
        const { data: installTask } = await supabase
          .from('installation_tasks')
          .select('print_task_id, cutout_task_id')
          .eq('id', taskId)
          .single();
        
        if (installTask) {
          if (installTask.print_task_id) {
            await supabase.from('print_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', installTask.print_task_id);
          }
          if (installTask.cutout_task_id) {
            await supabase.from('cutout_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', installTask.cutout_task_id);
          }
        }
        return;
      }

      for (const ct of composites) {
        if (ct.print_task_id) {
          await supabase.from('print_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', ct.print_task_id);
        }
        if (ct.cutout_task_id) {
          await supabase.from('cutout_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', ct.cutout_task_id);
        }
        // تحديث حالة المهمة المجمعة أيضاً
        await supabase.from('composite_tasks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', ct.id);
      }

      // تحديث حالة مهمة التركيب نفسها
      await supabase.from('installation_tasks').update({ status: 'completed' }).eq('id', taskId);

      console.log(`✅ Auto-completed linked tasks for installation ${taskId}`);
    } catch (error) {
      console.error('Error auto-completing linked tasks:', error);
    }
  };

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
            // جلب بيانات العقد الكاملة مع التصاميم ومعلومات التسعير
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
                billboard_prices,
                print_cost,
                include_installation_in_price,
                include_print_in_billboard_price
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

            // ✅ استخراج بيانات اللوحة الفردية من billboard_prices
            let individualBillboardData: any = null;
            let individualPrice = 0;
            let individualDiscount = 0;
            let individualPrintCost = 0;
            let individualInstallationCost = 0;
            let pricingCategory = '';
            let pricingMode = '';
            
            if (contract.billboard_prices) {
              try {
                const prices = typeof contract.billboard_prices === 'string' 
                  ? JSON.parse(contract.billboard_prices) 
                  : contract.billboard_prices;
                
                const billboardPriceData = Array.isArray(prices) 
                  ? prices.find((p: any) => p.billboardId?.toString() === item.billboard_id.toString())
                  : null;
                
                if (billboardPriceData) {
                  individualBillboardData = billboardPriceData;
                  individualPrice = billboardPriceData.priceBeforeDiscount || billboardPriceData.contractPrice || 0;
                  individualDiscount = billboardPriceData.discountPerBillboard || 0;
                  individualPrintCost = billboardPriceData.printCost || 0;
                  individualInstallationCost = billboardPriceData.installationCost || 0;
                  pricingCategory = billboardPriceData.pricingCategory || '';
                  pricingMode = billboardPriceData.pricingMode || '';
                }
              } catch (e) {
                console.error('Error parsing billboard_prices:', e);
              }
            }

            // Fallback للحساب النسبي إذا لم نجد بيانات فردية
            if (individualPrice === 0) {
              const billboardIds = contract.billboard_ids ? contract.billboard_ids.split(',').map((id: string) => id.trim()) : [];
              const billboardCount = billboardIds.length || 1;
              const totalRent = contract['Total Rent'] || contract.Total || billboard.Price || 0;
              individualPrice = totalRent / billboardCount;
              individualDiscount = (contract.Discount || 0) / billboardCount;
              individualInstallationCost = ((contract.installation_enabled && contract.installation_cost) || 0) / billboardCount;
              individualPrintCost = (contract.print_cost || 0) / billboardCount;
            }
            
            // ✅ استخدام تكلفة التركيب من installation_task_items إذا كانت موجودة (الأولوية الأعلى)
            if (item.customer_installation_cost && item.customer_installation_cost > 0) {
              individualInstallationCost = item.customer_installation_cost;
            }
            
            // حساب المبلغ النهائي
            const finalAmount = individualPrice - individualDiscount + individualInstallationCost + individualPrintCost;
            const discountPercentage = individualPrice > 0 ? (individualDiscount / individualPrice) * 100 : 0;

            // حساب المدة
            const durationDays = contract.Duration ? parseInt(String(contract.Duration)) : 0;

            // جلب اسم الفريق
            const task = tasks.find(t => t.id === item.task_id);
            const teamName = task?.team_id ? teamById[task.team_id]?.team_name || '' : '';

            // تحديد تاريخ التركيب النهائي
            const finalInstallationDate = installationDate || item.installation_date || new Date().toISOString().split('T')[0];

            // ✅ حفظ في التاريخ مع جميع المعلومات المالية الكاملة من العقد
            const { error: historyError } = await supabase.from('billboard_history').insert({
              billboard_id: item.billboard_id,
              contract_number: contract.Contract_Number,
              customer_name: contract['Customer Name'] || '',
              ad_type: contract['Ad Type'] || '',
              start_date: contract['Contract Date'] || billboard.Rent_Start_Date,
              end_date: contract['End Date'] || billboard.Rent_End_Date,
              duration_days: durationDays,
              
              // ✅ المعلومات المالية الفردية للوحة
              rent_amount: finalAmount,
              billboard_rent_price: billboard.Price || individualPrice,
              discount_amount: individualDiscount,
              discount_percentage: Math.round(discountPercentage * 100) / 100,
              installation_cost: individualInstallationCost,
              total_before_discount: individualPrice,
              
              // ✅ معلومات جديدة من العقد
              print_cost: individualPrintCost,
              include_installation_in_price: contract.include_installation_in_price || false,
              include_print_in_price: contract.include_print_in_billboard_price || false,
              pricing_category: pricingCategory,
              pricing_mode: pricingMode,
              contract_total: contract.Total || 0,
              contract_total_rent: contract['Total Rent'] || 0,
              contract_discount: contract.Discount || 0,
              individual_billboard_data: individualBillboardData,
              
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
                  discount: individualDiscount,
                  installation: individualInstallationCost,
                  print: individualPrintCost
                }
              });
            }
          } catch (itemError) {
            console.error(`Error processing item ${item.id}:`, itemError);
          }
        }
      }

      // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
      if (result === 'completed' && selectedTaskIdForCompletion) {
        await autoCompleteLinkedTasks(selectedTaskIdForCompletion);
      }

      toast.success(`تم ${result === 'completed' ? 'إكمال' : 'تحديث'} ${selectedItemsForCompletion.length} لوحة`);
      setShowCompletionDialog(false);
      setSelectedItemsForCompletion([]);
      setSelectedTaskIdForCompletion(null);
      // إبطال الكاش لضمان تحديث البيانات فوراً
      queryClient.invalidateQueries({ queryKey: ['installation-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['billboards-for-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
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
    queryKey: ['installation-task-items', taskIds.join(',')],
    enabled: taskIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });
      
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
    staleTime: 0,
    gcTime: 0,
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

  // ✅ استخراج العقود الفعلية لكل مهمة من لوحاتها (لحل مشكلة ظهور عقد واحد فقط)
  const derivedContractIdsByTaskId = useMemo(() => {
    const map = new Map<string, number[]>();
    const sets = new Map<string, Set<number>>();

    allTaskItems.forEach((item: any) => {
      const taskId = item.task_id as string;
      const contractNo = billboardById[item.billboard_id]?.Contract_Number;
      if (!taskId || !contractNo) return;
      if (!sets.has(taskId)) sets.set(taskId, new Set());
      sets.get(taskId)!.add(Number(contractNo));
    });

    sets.forEach((set, taskId) => {
      map.set(taskId, Array.from(set).filter(Boolean).sort((a, b) => a - b));
    });

    return map;
  }, [allTaskItems, billboardById]);

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

  // Fetch contracts - include derived contract ids from billboards
  const contractIds = useMemo(() => {
    const ids = new Set<number>();

    tasks.forEach((t: any) => {
      if (t.contract_id) ids.add(t.contract_id);
      if (t.contract_ids && Array.isArray(t.contract_ids)) {
        t.contract_ids.forEach((id: number) => ids.add(id));
      }
      const derived = derivedContractIdsByTaskId.get(t.id);
      derived?.forEach((id) => ids.add(id));
    });

    return [...ids];
  }, [tasks, derivedContractIdsByTaskId]);
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
  const { data: installationPricing = [], data: sizesRawData } = useQuery({
    queryKey: ['installation-pricing-combined'],
    queryFn: async () => {
      // ✅ Primary: Fetch from sizes table (has installation_price column + sort_order)
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('name, installation_price, sort_order')
        .order('sort_order', { ascending: true });
      
      if (!sizesError && sizesData && sizesData.length > 0) {
        return sizesData.map((s: any) => ({
          size: s.name,
          install_price: s.installation_price,
          sort_order: s.sort_order ?? 999,
        }));
      }
      
      // ✅ Fallback: Fetch from installation_print_pricing table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('installation_print_pricing')
        .select('size, install_price');
      
      if (fallbackError) throw fallbackError;
      return (fallbackData || []).map((s: any) => ({ ...s, sort_order: 999 }));
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

  // Create map of size -> sort_order from sizes table
  const sizeOrderMap = useMemo(() => {
    const map: Record<string, number> = {};
    installationPricing.forEach((pricing: any) => {
      const order = pricing.sort_order ?? 999;
      map[pricing.size] = order;
      const parts = pricing.size?.split('x');
      if (parts?.length === 2) {
        map[`${parts[1]}x${parts[0]}`] = order;
      }
    });
    return map;
  }, [installationPricing]);

  // Create map of billboard ID -> installation price (based on billboard size and faces)
  // ✅ السعر الأساسي في جدول sizes هو لوجهين (2 faces)
  // - وجه واحد = السعر / 2
  // - وجهين = السعر الأساسي
  // - 3 أوجه أو أكثر = السعر * (عدد الأوجه / 2)
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
      // ✅ حساب السعر حسب عدد الأوجه الفعلي
      // السعر الأساسي هو لوجهين (2 faces)
      const faces = b.Faces_Count || 2;
      let finalPrice: number;
      if (faces === 1) {
        // وجه واحد = نصف السعر
        finalPrice = Math.round(basePrice / 2);
      } else if (faces === 2) {
        // وجهين = السعر الأساسي
        finalPrice = basePrice;
      } else {
        // أكثر من وجهين = السعر * (عدد الأوجه / 2)
        finalPrice = Math.round(basePrice * (faces / 2));
      }
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
      setSelectedBillboardIds(contractBillboards.map((b: any) => b.ID));
    } else {
      setSelectedBillboardIds([]);
    }
  }, [contractBillboards.length, selectedContract?.billboard_ids]);

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
    
    // Apply filters based on actual completion of items, not task.status
    if (filterStatus !== 'all' && allTaskItems.length > 0) {
      filteredTasks = filteredTasks.filter(t => {
        const taskItems = allTaskItems.filter(item => item.task_id === t.id);
        
        // إذا لم يكن هناك عناصر للمهمة، اعتبرها غير مكتملة
        if (taskItems.length === 0) {
          return filterStatus === 'pending';
        }
        
        const completedItems = taskItems.filter(item => item.status === 'completed').length;
        const isFullyCompleted = completedItems === taskItems.length;
        
        if (filterStatus === 'completed') {
          return isFullyCompleted;
        } else if (filterStatus === 'pending') {
          return !isFullyCompleted;
        }
        return true;
      });
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
    mutationFn: async (vars: {
      contractId: number;
      billboardIds: number[];
      teamId: string | null;
      taskType: 'installation' | 'reinstallation';
    }) => {
      const { contractId, billboardIds, teamId, taskType } = vars;

      if (!contractId) throw new Error('يرجى اختيار عقد');
      if (!billboardIds || billboardIds.length === 0) throw new Error('يرجى اختيار لوحة واحدة على الأقل');

      // If team is selected, create manual task for specific team
      if (teamId) {
        let taskId: string | undefined;

        // For reinstallation: always create a new task (allow multiple per contract)
        if (taskType === 'reinstallation') {
          // Get next reinstallation number for this contract
          const { data: existingReinstalls } = await supabase
            .from('installation_tasks')
            .select('reinstallation_number')
            .eq('contract_id', contractId)
            .eq('task_type', 'reinstallation')
            .order('reinstallation_number', { ascending: false })
            .limit(1);
          
          const nextNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;

          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: contractId,
              team_id: teamId,
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextNumber,
            })
            .select()
            .single();

          if (taskError) throw taskError;
          taskId = newTask.id;
        } else {
          // For normal installation: reuse existing task if found
          const { data: existingTask } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', teamId)
            .eq('task_type', 'installation')
            .maybeSingle();

          taskId = existingTask?.id;

          if (!taskId) {
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                team_id: teamId,
                status: 'pending',
                task_type: 'installation',
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }
        }

        // Fetch Faces_Count for selected billboards to set default faces_to_install
        const { data: bbFacesData } = await supabase
          .from('billboards')
          .select('ID, Faces_Count')
          .in('ID', billboardIds);
        const facesMap: Record<number, number> = {};
        (bbFacesData || []).forEach((b: any) => { facesMap[b.ID] = b.Faces_Count || 2; });

        // Add task items for selected billboards only
        for (const billboardId of billboardIds) {
          const { data: existing } = await supabase
            .from('installation_task_items')
            .select('id')
            .eq('task_id', taskId)
            .eq('billboard_id', billboardId)
            .maybeSingle();

          if (!existing) {
            const { error: itemError } = await supabase
              .from('installation_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                faces_to_install: facesMap[billboardId] || 2,
              });
            if (itemError) throw itemError;
          }
        }

        return;
      }

      // No team selected = auto-distribute selected billboards to teams based on sizes
      const { data: teamsData, error: teamsError } = await supabase
        .from('installation_teams')
        .select('*');
      if (teamsError) throw teamsError;
      if (!teamsData || teamsData.length === 0) throw new Error('لا توجد فرق تركيب متاحة');

      const { data: billboardsData, error: bbError } = await supabase
        .from('billboards')
        .select('ID, Size, City, Faces_Count')
        .in('ID', billboardIds);
      if (bbError) throw bbError;
      const autoFacesMap: Record<number, number> = {};
      (billboardsData || []).forEach((b: any) => { autoFacesMap[b.ID] = b.Faces_Count || 2; });

      // Group billboards by team based on size AND city
      const billboardsByTeam: Record<string, number[]> = {};
      for (const bb of billboardsData || []) {
        const size = (bb as any).Size as string | null;
        const city = (bb as any).City as string | null;
        const id = (bb as any).ID as number;
        if (!size) continue;

        // Find team that matches BOTH size AND city (if team has cities defined)
        const team = teamsData.find((t: any) => {
          const sizeMatch = Array.isArray(t.sizes) && t.sizes.includes(size);
          if (!sizeMatch) return false;
          
          // If team has cities defined, check if billboard's city is in team's cities
          if (Array.isArray(t.cities) && t.cities.length > 0 && city) {
            return t.cities.includes(city);
          }
          // If team has no cities defined, it accepts all cities
          return true;
        });
        if (!team) continue;

        if (!billboardsByTeam[team.id]) billboardsByTeam[team.id] = [];
        billboardsByTeam[team.id].push(id);
      }

      // Create tasks for each team
      // Get next reinstallation number if needed
      let nextReinstallNumber = 0;
      if (taskType === 'reinstallation') {
        const { data: existingReinstalls } = await supabase
          .from('installation_tasks')
          .select('reinstallation_number')
          .eq('contract_id', contractId)
          .eq('task_type', 'reinstallation')
          .order('reinstallation_number', { ascending: false })
          .limit(1);
        nextReinstallNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;
      }

      for (const [autoTeamId, autoBillboardIds] of Object.entries(billboardsByTeam)) {
        let taskId: string | undefined;

        if (taskType === 'reinstallation') {
          // Always create new task for reinstallation
          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: contractId,
              team_id: autoTeamId,
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextReinstallNumber,
            })
            .select()
            .single();

          if (taskError) throw taskError;
          taskId = newTask.id;
        } else {
          const { data: existingTask } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', autoTeamId)
            .eq('task_type', 'installation')
            .maybeSingle();

          taskId = existingTask?.id;

          if (!taskId) {
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                team_id: autoTeamId,
                status: 'pending',
                task_type: 'installation',
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }
        }

        for (const billboardId of autoBillboardIds) {
          const { data: existing } = await supabase
            .from('installation_task_items')
            .select('id')
            .eq('task_id', taskId)
            .eq('billboard_id', billboardId)
            .maybeSingle();

          if (!existing) {
            const { error: itemError } = await supabase
              .from('installation_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                faces_to_install: autoFacesMap[billboardId] || 2,
              });
            if (itemError) throw itemError;
          }
        }
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.teamId ? 'تم إضافة المهمة بنجاح' : 'تم توزيع المهام على الفرق تلقائياً');
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
    mutationFn: async ({ itemId, date, notes, taskId }: { itemId: string; date: string; notes?: string; taskId?: string }) => {
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          status: 'completed',
          installation_date: date,
          notes: notes || null
        })
        .eq('id', itemId);

      if (error) throw error;
      
      // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
      if (taskId) {
        await autoCompleteLinkedTasks(taskId);
      }
    },
    onSuccess: () => {
      toast.success('تم إكمال اللوحة');
      refetchTaskItems();
      queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
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
      // Check if composite task already exists for this installation task OR contract
      const { data: existingByTask } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('installation_task_id', taskId)
        .maybeSingle();

      if (existingByTask) {
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

      const compositeData = {
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
      };

      // Check if there's an existing composite task for this contract that can be updated
      const { data: existingByContract } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('contract_id', contractId)
        .is('installation_task_id', null)
        .maybeSingle();

      if (existingByContract) {
        // Update existing composite task with installation task
        const { data: compositeTask, error } = await supabase
          .from('composite_tasks')
          .update(compositeData)
          .eq('id', existingByContract.id)
          .select()
          .single();

        if (error) throw error;
        return compositeTask;
      }

      // Create new composite task
      const { data: compositeTask, error } = await supabase
        .from('composite_tasks')
        .insert(compositeData)
        .select()
        .single();

      if (error) throw error;
      return compositeTask;
    },
    onSuccess: () => {
      toast.success('تم إنشاء المهمة المجمعة للتركيب بنجاح');
      setCreateCompositeDialogOpen(false);
      setSelectedTaskForComposite(null);
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
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

  // ── New UI state ──
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTaskObj = useMemo(() => selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null, [selectedTaskId, tasks]);
  const selectedTaskItemsList = useMemo(() => selectedTaskId ? allTaskItems.filter(i => i.task_id === selectedTaskId) : [], [selectedTaskId, allTaskItems]);
  const selectedTaskDesigns = useMemo(() => selectedTaskId ? (designsByTask[selectedTaskId] || []) : [], [selectedTaskId, designsByTask]);
  const selectedTaskContract = useMemo(() => selectedTaskObj ? contractById[selectedTaskObj.contract_id] : null, [selectedTaskObj, contractById]);
  const selectedTeam = useMemo(() => selectedTaskObj ? teamById[selectedTaskObj.team_id] : null, [selectedTaskObj, teamById]);
  const selectedDerivedContractIds = useMemo(() => {
    if (!selectedTaskObj) return [];
    return derivedContractIdsByTaskId.get(selectedTaskObj.id) || (selectedTaskObj.contract_ids || []);
  }, [selectedTaskObj, derivedContractIdsByTaskId]);
  const selectedIsMergedTask = selectedDerivedContractIds.length > 1;

  return (
    <div className="flex flex-col min-h-full">
      <AnimatePresence mode="wait">
        {/* ── DETAIL VIEW ── */}
        {selectedTaskId && selectedTaskObj ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex flex-col min-h-full"
          >
            <InstallationTaskDetail
              task={selectedTaskObj}
              taskItems={selectedTaskItemsList}
              taskDesigns={selectedTaskDesigns}
              contract={selectedTaskContract}
              team={selectedTeam}
              billboardById={billboardById}
              contractById={contractById}
              installationPricingByBillboard={installationPricingByBillboard}
              sizeOrderMap={sizeOrderMap}
              selectedItemsForCompletion={selectedItemsForCompletion}
              selectedItemsForDate={selectedItemsForDate}
              showCompletionDialog={showCompletionDialog}
              selectedTaskIdForCompletion={selectedTaskIdForCompletion}
              isMergedTask={selectedIsMergedTask}
              derivedContractIds={selectedDerivedContractIds}
              onBack={() => setSelectedTaskId(null)}
              onManageDesigns={() => { setSelectedTaskForDesign(selectedTaskId); setDesignDialogOpen(true); }}
              onDistributeDesigns={() => {
                if (selectedTaskDesigns.length === 0) { toast.info('يرجى إضافة تصاميم أولاً'); setSelectedTaskForDesign(selectedTaskId); setDesignDialogOpen(true); return; }
                setSelectedTaskForDesign(selectedTaskId); setBulkDesignDialogOpen(true);
              }}
              onEditTaskType={() => { setSelectedTaskForEdit({ id: selectedTaskId, taskType: selectedTaskObj.task_type || 'installation' }); setEditTaskTypeDialogOpen(true); }}
              onTransferBillboards={() => { setSelectedTaskForTransfer({ taskId: selectedTaskId, teamId: selectedTaskObj.team_id, teamName: selectedTeam?.team_name || 'غير محدد', contractId: selectedTaskObj.contract_id }); setTransferDialogOpen(true); }}
              onPrintAll={() => { setSelectedContractForPrint({ contractNumber: selectedTaskObj.contract_id, customerName: selectedTaskContract?.['Customer Name'] || 'غير محدد', adType: selectedTaskContract?.['Ad Type'] || '' }); setPrintAllDialogOpen(true); }}
              onDelete={() => { if (window.confirm('هل أنت متأكد من حذف مهمة التركيب؟')) { deleteTaskMutation.mutate(selectedTaskId); setSelectedTaskId(null); } }}
              onCreatePrintTask={() => { setSelectedTaskForPrint(selectedTaskId); setCreatePrintTaskDialogOpen(true); }}
              onCompleteBillboards={() => { setSelectedTaskIdForCompletion(selectedTaskId); setSelectedItemsForCompletion([]); setShowCompletionDialog(true); }}
              onSetInstallationDate={() => { setSelectedTaskIdForBulk(selectedTaskId); setSelectedItemsForDate(selectedTaskItemsList.map(i => i.id)); }}
              onAddBillboards={() => { setSelectedTaskForAddBillboards({ taskId: selectedTaskId, contractId: selectedTaskObj.contract_id, contractIds: selectedDerivedContractIds, existingBillboardIds: selectedTaskItemsList.map(i => i.billboard_id) }); setAddBillboardsDialogOpen(true); }}
              onCreateCompositeTask={selectedTaskObj.task_type === 'reinstallation' ? () => { setSelectedTaskForComposite({ taskId: selectedTaskId, contractId: selectedTaskObj.contract_id, customerName: selectedTaskContract?.['Customer Name'] || 'غير محدد', customerId: (selectedTaskContract as any)?.customer_id || null }); setCreateCompositeDialogOpen(true); } : undefined}
              onUnmerge={selectedIsMergedTask ? async () => {
                if (!confirm('هل تريد التراجع عن دمج هذه المهمة؟')) return;
                try {
                  const { data: items } = await supabase.from('installation_task_items').select('*').eq('task_id', selectedTaskId);
                  const itemsByContract: Record<number, any[]> = {};
                  items?.forEach(item => { const contractNo = billboardById[item.billboard_id]?.Contract_Number; if (contractNo) { if (!itemsByContract[contractNo]) itemsByContract[contractNo] = []; itemsByContract[contractNo].push(item); } });
                  await supabase.from('installation_task_items').delete().eq('task_id', selectedTaskId);
                  await supabase.from('installation_tasks').delete().eq('id', selectedTaskId);
                  for (const [cId, cItems] of Object.entries(itemsByContract)) {
                    const { data: newTask } = await supabase.from('installation_tasks').insert({ contract_id: Number(cId), team_id: selectedTaskObj.team_id, status: 'pending' }).select().single();
                    if (newTask) await supabase.from('installation_task_items').insert(cItems.map(({ id, created_at, ...rest }) => ({ ...rest, task_id: newTask.id })));
                  }
                  toast.success('تم التراجع عن الدمج'); setSelectedTaskId(null); handleRefreshAll();
                } catch (err: any) { toast.error('فشل في التراجع عن الدمج: ' + err.message); }
              } : undefined}
              onDeletePrintTask={selectedTaskObj.print_task_id ? async () => {
                if (!confirm('هل أنت متأكد من حذف مهمة الطباعة؟')) return;
                try {
                  await supabase.from('print_task_items').delete().eq('task_id', selectedTaskObj.print_task_id);
                  await supabase.from('print_tasks').delete().eq('id', selectedTaskObj.print_task_id);
                  await supabase.from('installation_tasks').update({ print_task_id: null }).eq('id', selectedTaskId);
                  toast.success('تم حذف مهمة الطباعة'); queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
                } catch { toast.error('فشل في حذف مهمة الطباعة'); }
              } : undefined}
              onNavigateToPrint={() => window.location.href = '/admin/print-tasks'}
              onNavigateToCutout={() => window.location.href = '/admin/cutout-tasks'}
              onSelectionChange={(itemId, checked) => {
                if (showCompletionDialog && selectedTaskIdForCompletion === selectedTaskId) {
                  if (checked) setSelectedItemsForCompletion(prev => [...prev, itemId]);
                  else setSelectedItemsForCompletion(prev => prev.filter(id => id !== itemId));
                } else {
                  if (checked) { setSelectedItemsForDate(prev => [...prev, itemId]); if (!selectedTaskIdForBulk) setSelectedTaskIdForBulk(selectedTaskId); }
                  else setSelectedItemsForDate(prev => prev.filter(id => id !== itemId));
                }
              }}
              onUncomplete={(itemId) => uncompleteItemMutation.mutate({ itemId, taskId: selectedTaskId })}
              onDeleteItem={async (itemId) => {
                try { await supabase.from('installation_task_items').delete().eq('id', itemId); toast.success('تم حذف اللوحة من المهمة'); refetchTaskItems(); }
                catch (err: any) { toast.error('فشل في حذف اللوحة: ' + err.message); }
              }}
              onAddInstalledImage={(item) => { setSelectedItemForImage(item); setInstalledImageUrl(item.installed_image_url || ''); setInstalledImageFaceAUrl(item.installed_image_face_a_url || ''); setInstalledImageFaceBUrl(item.installed_image_face_b_url || ''); setImageDialogOpen(true); }}
              onPrintBillboard={(taskId) => { setPrintTaskId(taskId); setPrintDialogOpen(true); }}
              onRefreshItems={refetchTaskItems}
            />

            {/* Floating Selection Bar for Completion */}
            <AnimatePresence>
              {showCompletionDialog && selectedTaskIdForCompletion === selectedTaskId && (() => {
                const pendingItems = selectedTaskItemsList.filter(i => i.status !== 'completed');
                const allSelected = pendingItems.length > 0 && pendingItems.every(i => selectedItemsForCompletion.includes(i.id));
                return (
                <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                  <div className="bg-emerald-600 text-white px-6 py-4 shadow-2xl rounded-2xl flex items-center gap-4 flex-wrap justify-center">
                    <Badge variant="secondary" className="bg-white text-emerald-700 text-lg px-4 py-2">{selectedItemsForCompletion.length} / {pendingItems.length}</Badge>
                    <Button 
                      variant="ghost" 
                      className="text-white hover:bg-white/20 gap-2 text-sm"
                      onClick={() => {
                        if (allSelected) {
                          setSelectedItemsForCompletion([]);
                        } else {
                          setSelectedItemsForCompletion(pendingItems.map(i => i.id));
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="secondary" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                          <CalendarIcon className="h-4 w-4" />
                          {completionInstallationDate ? format(completionInstallationDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ التركيب'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar mode="single" selected={completionInstallationDate} onSelect={setCompletionInstallationDate} locale={ar} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button 
                      onClick={() => {
                        if (selectedItemsForCompletion.length === 0) {
                          toast.error('يرجى تحديد لوحة واحدة على الأقل');
                          return;
                        }
                        const dateStr = completionInstallationDate ? format(completionInstallationDate, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
                        handleCompleteMultiple('completed', '', undefined, dateStr);
                      }} 
                      disabled={selectedItemsForCompletion.length === 0} 
                      className="gap-2 bg-white text-emerald-700 hover:bg-white/90"
                    >
                      <CheckCircle2 className="h-4 w-4" />إكمال اللوحات
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setShowCompletionDialog(false); setSelectedItemsForCompletion([]); setSelectedTaskIdForCompletion(null); setCompletionInstallationDate(new Date()); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Floating Selection Bar for Installation Date */}
            <AnimatePresence>
              {selectedItemsForDate.length > 0 && (
                <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                  <div className="bg-primary text-primary-foreground px-6 py-4 shadow-2xl rounded-2xl flex items-center gap-4 flex-wrap justify-center">
                    <Badge variant="secondary" className="bg-white text-primary text-lg px-4 py-2">{selectedItemsForDate.length} لوحة محددة</Badge>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="secondary" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                          <CalendarIcon className="h-4 w-4" />
                          {floatingInstallationDate ? format(floatingInstallationDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ التركيب'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={floatingInstallationDate} onSelect={setFloatingInstallationDate} locale={ar} /></PopoverContent>
                    </Popover>
                    <Button onClick={async () => {
                      if (!floatingInstallationDate || selectedItemsForDate.length === 0) { toast.error('يرجى تحديد التاريخ واللوحات'); return; }
                      try {
                        const { error } = await supabase.from('installation_task_items').update({ installation_date: format(floatingInstallationDate, 'yyyy-MM-dd') }).in('id', selectedItemsForDate);
                        if (error) throw error;
                        // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
                        if (selectedTaskIdForBulk) await autoCompleteLinkedTasks(selectedTaskIdForBulk);
                        toast.success(`تم تحديد تاريخ التركيب لـ ${selectedItemsForDate.length} لوحة`);
                        setSelectedItemsForDate([]); setFloatingInstallationDate(undefined); setSelectedTaskIdForBulk(null); refetchTaskItems();
                        queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
                      } catch { toast.error('فشل في تحديد تاريخ التركيب'); }
                    }} disabled={!floatingInstallationDate} className="gap-2 bg-white text-primary hover:bg-white/90">
                      <CheckCircle2 className="h-4 w-4" />تأكيد التركيب
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setSelectedItemsForDate([]); setFloatingInstallationDate(undefined); setSelectedTaskIdForBulk(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── TABLE VIEW ── */
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 overflow-auto p-6"
          >
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">مهام التركيب</h1>
            <p className="text-sm text-muted-foreground mt-0.5">إدارة ومتابعة مهام تركيب اللوحات الإعلانية</p>
          </div>
          <InstallationTasksTable
            tasks={tasks}
            allTaskItems={allTaskItems}
            billboardById={billboardById}
            contractById={contractById}
            teamById={teamById}
            teams={teams}
            designsByTask={designsByTask}
            installationPricingByBillboard={installationPricingByBillboard}
            derivedContractIdsByTaskId={derivedContractIdsByTaskId}
            isLoading={isLoading}
            stats={stats}
            page={boardPage}
            onPageChange={setBoardPage}
            onOpenTask={(taskId) => setSelectedTaskId(taskId)}
            onAddTask={() => setAddTaskDialogOpen(true)}
            onRefresh={handleRefreshAll}
            onPrintTask={(taskId) => { setPrintTaskId(taskId); setPrintDialogOpen(true); }}
            onPrintAll={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              setSelectedContractForPrint({ contractNumber: t.contract_id, customerName: contractById[t.contract_id]?.['Customer Name'] || 'غير محدد', adType: contractById[t.contract_id]?.['Ad Type'] || '', taskId });
              setPrintAllDialogOpen(true);
            }}
            onDistributeDesigns={(taskId) => {
              if (!designsByTask[taskId]?.length) { setSelectedTaskForDesign(taskId); setDesignDialogOpen(true); return; }
              setSelectedTaskForDesign(taskId); setBulkDesignDialogOpen(true);
            }}
            onManageDesigns={(taskId) => {
              setSelectedTaskForDesign(taskId);
              setDesignDialogOpen(true);
            }}
            onAddBillboard={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              const derivedIds = derivedContractIdsByTaskId.get(taskId) || t.contract_ids || [];
              setSelectedTaskForAddBillboards({ taskId, contractId: t.contract_id, contractIds: derivedIds, existingBillboardIds: allTaskItems.filter(i => i.task_id === taskId).map(i => i.billboard_id) });
              setAddBillboardsDialogOpen(true);
            }}
            onDeleteTask={(taskId) => { deleteTaskMutation.mutate(taskId); }}
            onEditTask={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              setSelectedTaskForEdit({ id: taskId, taskType: t.task_type || 'installation' });
              setEditTaskTypeDialogOpen(true);
            }}
            onCompleteAllBillboards={(taskId) => {
              const taskItems = allTaskItems.filter(i => i.task_id === taskId && i.status !== 'completed');
              if (taskItems.length === 0) {
                toast.info('جميع اللوحات مكتملة بالفعل');
                return;
              }
              setSelectedTaskId(taskId);
              setSelectedTaskIdForCompletion(taskId);
              setSelectedItemsForCompletion(taskItems.map(i => i.id));
              setShowCompletionDialog(true);
              setCompletionInstallationDate(new Date());
            }}
          />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DIALOGS (shared) ── */}

      {/* Add Task Dialog - Enhanced Version */}
      <EnhancedAddInstallationTaskDialog
        open={addTaskDialogOpen}
        onOpenChange={setAddTaskDialogOpen}
        taskType={taskType}
        onTaskTypeChange={setTaskType}
        teams={teams as any}
        isSubmitting={createTaskMutation.isPending}
        onSubmit={({ contractIds, customerId, billboardIds, teamAssignments }) => {
          // إذا كان هناك تعيينات للفرق، ننشئ مهمة لكل فرقة
          if (teamAssignments.length > 0) {
            teamAssignments.forEach(assignment => {
              createTaskMutation.mutate({
                contractId: contractIds[0],
                billboardIds: assignment.billboardIds,
                teamId: assignment.teamId,
                taskType,
              });
            });
          } else {
            // بدون تعيينات - توزيع تلقائي
            createTaskMutation.mutate({
              contractId: contractIds[0],
              billboardIds,
              teamId: null,
              taskType,
            });
          }
        }}
      />

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
              contractNumber={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t?.contract_id;
              })()}
              customerName={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t ? (contractById[t.contract_id]?.['Customer Name'] || t.customer_name || '') : '';
              })()}
              adType={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t ? (contractById[t.contract_id]?.['Ad Type'] || '') : '';
              })()}
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
        // ✅ استخدام contract_id المخزن في المهمة مباشرة (وليس من بيانات اللوحة القديمة)
        const taskContractId = currentTask?.contract_id;
        const contract = taskContractId ? contractById[taskContractId] : null;
        const customerName = contract?.['Customer Name'] || currentTask?.customer_name || '';
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

      {/* Add Installed Image Dialog - with imgbb upload */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              إضافة صور التركيب
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              ارفع صور التركيب أو أدخل الروابط مباشرة
            </p>
          </DialogHeader>
          {(() => {
            // Build folder path and image name for installed photos
            const getUploadContext = (face: 'A' | 'B') => {
              const nameParts: string[] = [];
              let folderPath = 'installation-photos';
              
              if (selectedItemForImage) {
                const taskItem = allTaskItems.find(i => i.id === selectedItemForImage.id);
                const taskId = taskItem?.task_id || '';
                const taskCode = `re${taskId.substring(0, 6)}`;
                const taskObj = tasks.find(t => t.id === taskId);
                const contract = taskObj ? contractById[taskObj.contract_id] : null;
                const billboard = billboardById[selectedItemForImage.billboard_id];
                const contractNum = taskObj?.contract_id ? `C${taskObj.contract_id}` : '';
                const customerName = contract?.['Customer Name'] || '';
                
                // Folder: installation-photos/{contractNum}_{taskCode}_{customerName}
                const folderName = [contractNum, taskCode, customerName].filter(Boolean).join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-');
                folderPath = `installation-photos/${folderName}`;
                
                // Image name: {billboardName}_{contractNum}_{taskCode}_face-{A/B}
                if (billboard?.Billboard_Name) nameParts.push(billboard.Billboard_Name);
                if (contractNum) nameParts.push(contractNum);
                nameParts.push(taskCode);
              }
              nameParts.push(`face-${face}`);
              const imageName = nameParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-');
              return { imageName, folderPath };
            };

            // Keep backward compat
            const buildInstalledImageName = (face: 'A' | 'B') => getUploadContext(face).imageName;

            const handleInstalledFileUpload = async (file: File, face: 'A' | 'B') => {
              if (!file) return;
              const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
              if (!validTypes.includes(file.type)) {
                toast.error('يرجى اختيار ملف صورة صحيح');
                return;
              }
              if (file.size > 10 * 1024 * 1024) {
                toast.error('حجم الملف يجب أن لا يتجاوز 10MB');
                return;
              }
              const setUploading = face === 'A' ? setUploadingInstalledA : setUploadingInstalledB;
              setUploading(true);
              try {
                const { imageName, folderPath } = getUploadContext(face);
                const imageUrl = await uploadToImgbb(file, imageName, folderPath);
                if (face === 'A') setInstalledImageFaceAUrl(imageUrl);
                else setInstalledImageFaceBUrl(imageUrl);
                toast.success(`تم رفع صورة الوجه ${face === 'A' ? 'الأمامي' : 'الخلفي'} بنجاح`);
              } catch (error) {
                console.error('Upload error:', error);
                toast.error('فشل رفع الصورة. تأكد من إعداد مفتاح API في الإعدادات.');
              } finally {
                setUploading(false);
              }
            };

            const handlePasteFromClipboard = async (targetFace: 'A' | 'B') => {
              try {
                const clipboardItems = await navigator.clipboard.read();
                let imageFile: File | null = null;
                
                for (const item of clipboardItems) {
                  const imageType = item.types.find(t => t.startsWith('image/'));
                  if (imageType) {
                    const blob = await item.getType(imageType);
                    imageFile = new File([blob], `pasted-image.${imageType.split('/')[1]}`, { type: imageType });
                    break;
                  }
                }

                if (imageFile) {
                  await handleInstalledFileUpload(imageFile, targetFace);
                } else {
                  // Try text (URL)
                  const text = await navigator.clipboard.readText();
                  if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                    if (targetFace === 'A') setInstalledImageFaceAUrl(text);
                    else setInstalledImageFaceBUrl(text);
                    toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
                  } else {
                    toast.error('لا توجد صورة أو رابط في الحافظة');
                  }
                }
              } catch (err) {
                // Fallback to text only
                try {
                  const text = await navigator.clipboard.readText();
                  if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                    if (targetFace === 'A') setInstalledImageFaceAUrl(text);
                    else setInstalledImageFaceBUrl(text);
                    toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
                  } else {
                    toast.error('لا توجد صورة أو رابط في الحافظة');
                  }
                } catch {
                  toast.error('لا يمكن الوصول إلى الحافظة');
                }
              }
            };

            const renderInstalledFaceInput = (face: 'A' | 'B') => {
              const url = face === 'A' ? installedImageFaceAUrl : installedImageFaceBUrl;
              const setUrl = face === 'A' ? setInstalledImageFaceAUrl : setInstalledImageFaceBUrl;
              const uploading = face === 'A' ? uploadingInstalledA : uploadingInstalledB;
              const label = face === 'A' ? 'الوجه الأمامي' : 'الوجه الخلفي (اختياري)';
              const colorClass = face === 'A' ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20';
              const dotColor = face === 'A' ? 'bg-emerald-500' : 'bg-blue-500';
              const badgeColor = face === 'A' ? 'bg-emerald-600' : 'bg-blue-600';
              const isActive = pasteTargetFace === face;

              return (
                <div 
                  className={`p-4 rounded-lg border-2 transition-all ${isActive ? 'border-primary ring-2 ring-primary/20' : `border-dashed ${colorClass}`} space-y-3 cursor-pointer`}
                  onClick={() => setPasteTargetFace(face)}
                  onPaste={async (e) => {
                    e.preventDefault();
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                          await handleInstalledFileUpload(file, face);
                          return;
                        }
                      }
                    }
                    // Fallback: check for URL text
                    const text = e.clipboardData?.getData('text');
                    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                      setUrl(text);
                      toast.success(`تم لصق رابط في ${label}`);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                      <Label className="font-bold">{label}</Label>
                      {isActive && <Badge variant="outline" className="text-[10px] h-5 border-primary text-primary">هدف اللصق</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handlePasteFromClipboard(face); }} className="text-xs h-7 px-2" title="لصق من الحافظة">
                        <span className="text-[10px]">📋</span>
                        لصق
                      </Button>
                      <Button size="sm" variant={installedUploadMethod === 'file' ? 'default' : 'outline'} onClick={(e) => { e.stopPropagation(); setInstalledUploadMethod('file'); }} className="text-xs h-7 px-2">
                        <Upload className="h-3 w-3 ml-1" />
                        رفع
                      </Button>
                      <Button size="sm" variant={installedUploadMethod === 'url' ? 'default' : 'outline'} onClick={(e) => { e.stopPropagation(); setInstalledUploadMethod('url'); }} className="text-xs h-7 px-2">
                        <LinkIcon className="h-3 w-3 ml-1" />
                        رابط
                      </Button>
                    </div>
                  </div>

                  {installedUploadMethod === 'url' ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex-1 relative">
                        <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="الصق رابط الصورة هنا..."
                          dir="ltr"
                          className="pr-10 font-mono text-sm"
                          onFocus={() => setPasteTargetFace(face)}
                        />
                      </div>
                      {url && (
                        <Button variant="ghost" size="icon" onClick={() => setUrl('')} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`installed-file-${face}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleInstalledFileUpload(file, face);
                          e.target.value = '';
                        }}
                      />
                      <div
                        onClick={() => !uploading && document.getElementById(`installed-file-${face}`)?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file && !uploading) handleInstalledFileUpload(file, face);
                        }}
                        className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                            <span className="text-xs text-muted-foreground">جاري الرفع...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">اسحب الصورة أو انقر أو الصق (Ctrl+V)</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {url && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border bg-background">
                      <img src={url} alt={`معاينة ${label}`} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                      <Badge className={`absolute top-2 right-2 ${badgeColor}`}>{label}</Badge>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {renderInstalledFaceInput('A')}
                {renderInstalledFaceInput('B')}

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
                    className="flex-1 gap-2"
                    disabled={(!installedImageFaceAUrl && !installedImageFaceBUrl) || uploadingInstalledA || uploadingInstalledB}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    حفظ الصور
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
            );
          })()}
        </DialogContent>
      </Dialog>

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
          allTaskItems={allTaskItems.filter(item => {
            // جلب جميع عناصر المهام لنفس العقد (كل الفرق)
            const itemTask = tasks.find(t => t.id === item.task_id);
            if (!itemTask) return false;
            return itemTask.contract_id === selectedContractForPrint.contractNumber || 
                   (itemTask.contract_ids && itemTask.contract_ids.includes(selectedContractForPrint.contractNumber));
          })}
          tasks={tasks.filter(t => 
            t.contract_id === selectedContractForPrint.contractNumber || 
            (t.contract_ids && t.contract_ids.includes(selectedContractForPrint.contractNumber))
          )}
          billboards={billboardById}
          teams={teamById}
          designsByTask={designsByTask}
          taskId={selectedContractForPrint.taskId}
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

      {/* Multi-Task Print Dialog - طباعة المهام المحددة */}
      {multiTaskPrintDialogOpen && selectedTasksForPrint.size > 0 && (() => {
        // جمع جميع اللوحات من المهام المحددة
        const selectedTasks = tasks.filter(t => selectedTasksForPrint.has(t.id));
        const selectedItems = allTaskItems.filter(item => 
          selectedTasks.some(t => t.id === item.task_id)
        );
        
        // الحصول على معلومات الفريق (أول فريق)
        const firstTask = selectedTasks[0];
        const team = teamById[firstTask?.team_id];
        
        // جمع أسماء الزبائن
        const customerNames = [...new Set(
          selectedTasks.map(t => contractById[t.contract_id]?.['Customer Name'] || 'غير محدد')
        )].join(' - ');
        
        return (
          <PrintAllContractBillboardsDialog
            open={multiTaskPrintDialogOpen}
            onOpenChange={(open) => {
              setMultiTaskPrintDialogOpen(open);
              if (!open) {
                setSelectedTasksForPrint(new Set());
              }
            }}
            contractNumber={firstTask?.contract_id || 0}
            customerName={customerNames}
            allTaskItems={selectedItems}
            tasks={selectedTasks}
            billboards={billboardById}
            teams={teamById}
            designsByTask={designsByTask}
          />
        );
      })()}

      {/* Add Billboards to Task Dialog */}
      {selectedTaskForAddBillboards && (
        <AddBillboardsToTaskDialog
          open={addBillboardsDialogOpen}
          onOpenChange={setAddBillboardsDialogOpen}
          taskId={selectedTaskForAddBillboards.taskId}
          contractId={selectedTaskForAddBillboards.contractId}
          contractIds={selectedTaskForAddBillboards.contractIds}
          existingBillboardIds={selectedTaskForAddBillboards.existingBillboardIds}
          onSuccess={() => {
            refetchTaskItems();
            setSelectedTaskForAddBillboards(null);
          }}
        />
      )}

      {/* Task Completion Dialog for bulk billboard completion */}
      <TaskCompletionDialog
        open={showTaskCompletionDialog}
        onOpenChange={(open) => {
          setShowTaskCompletionDialog(open);
          if (!open) {
            // Don't close the selection bar, just the dialog
          }
        }}
        selectedCount={selectedItemsForCompletion.length}
        onComplete={(result, notes, reason, installationDate) => {
          setShowTaskCompletionDialog(false);
          handleCompleteMultiple(result, notes, reason, installationDate);
        }}
      />
    </div>
  );
}
