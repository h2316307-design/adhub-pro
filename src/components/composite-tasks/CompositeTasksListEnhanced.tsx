import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Loader2, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  RefreshCw,
  Search,
  ChevronUp,
  FileText,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { EnhancedCompositeTaskCard } from './EnhancedCompositeTaskCard';
import { CollapsibleGroupCard } from './CollapsibleGroupCard';
import { EnhancedEditCompositeTaskCostsDialog } from './EnhancedEditCompositeTaskCostsDialog';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompositeTasksListEnhancedProps {
  customerId?: string;
  filter?: 'all' | 'pending' | 'completed';
}

interface GroupedTasks {
  contractId: number;
  /** عقود فعلية من اللوحات (قد تكون متعددة) */
  contractIds: number[];
  customerName: string;
  tasks: CompositeTaskWithDetails[];
  totalCustomer: number;
  totalCompany: number;
  totalProfit: number;
}

export const CompositeTasksListEnhanced: React.FC<CompositeTasksListEnhancedProps> = ({ 
  customerId,
  filter = 'all'
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState<CompositeTaskWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(new Set());
  const [deleteContractId, setDeleteContractId] = useState<number | null>(null);

  // Fetch composite tasks with related data
  const { data: compositeTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['composite-tasks', customerId, filter],
    queryFn: async () => {
      let query = supabase
        .from('composite_tasks')
        .select(`
          *,
          customer:customers(id, name, company, phone)
        `)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (filter === 'pending') {
        query = query.in('status', ['pending', 'in_progress']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching composite tasks:', error);
        throw error;
      }

      const tasks = (data || []) as CompositeTaskWithDetails[];

      // ✅ استخراج أرقام العقود الفعلية من اللوحات (لحل مشكلة مهام مدموجة بين عقدين)
      const installationTaskIds = Array.from(
        new Set(tasks.map(t => t.installation_task_id).filter((id): id is string => Boolean(id)))
      );

      if (installationTaskIds.length > 0) {
        const { data: installItems, error: installItemsError } = await supabase
          .from('installation_task_items')
          .select('task_id, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
          .in('task_id', installationTaskIds);

        if (installItemsError) {
          console.error('Error fetching installation_task_items for contract grouping:', installItemsError);
        } else {
          const map = new Map<string, Set<number>>();
          (installItems || []).forEach((row: any) => {
            const taskId = row.task_id as string;
            const contractNo = row.billboard?.Contract_Number;
            if (!taskId || !contractNo) return;
            if (!map.has(taskId)) map.set(taskId, new Set());
            map.get(taskId)!.add(Number(contractNo));
          });

          tasks.forEach((t: any) => {
            const set = t.installation_task_id ? map.get(t.installation_task_id) : undefined;
            const derived = set ? Array.from(set) : [];
            t._contractIds = derived.length > 0 ? derived : [t.contract_id].filter(Boolean);
          });
        }
      }

      // fallback إذا لا توجد مهمة تركيب
      tasks.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          t._contractIds = [t.contract_id].filter(Boolean);
        }
      });

      return tasks;
    },
  });

  /**
   * Group tasks by contract and sort them by created_at ASC within each group.
   * Tasks within a group should appear in the order they were created/added.
   */
  const groupedTasks = useMemo(() => {
    const groups = new Map<number, GroupedTasks>();

    compositeTasks.forEach((task: any) => {
      if (!task.contract_id) return;

      const taskContractIds: number[] = Array.isArray(task._contractIds) && task._contractIds.length > 0
        ? (task._contractIds as number[])
        : [task.contract_id];

      if (!groups.has(task.contract_id)) {
        groups.set(task.contract_id, {
          contractId: task.contract_id,
          contractIds: [],
          customerName: task.customer_name || 'غير معروف',
          tasks: [],
          totalCustomer: 0,
          totalCompany: 0,
          totalProfit: 0
        });
      }

      const group = groups.get(task.contract_id)!;
      group.tasks.push(task);
      group.totalCustomer += task.customer_total || 0;
      group.totalCompany += task.company_total || 0;
      group.totalProfit += task.net_profit || 0;

      // دمج العقود الفعلية ضمن المجموعة
      const merged = new Set<number>(group.contractIds);
      taskContractIds.forEach((id) => merged.add(Number(id)));
      group.contractIds = Array.from(merged).filter(Boolean).sort((a, b) => a - b);
    });

    // Sort tasks within each group by created_at ASC (earliest first)
    groups.forEach(group => {
      group.tasks.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Sort groups by most recent task creation date (newest first)
    return Array.from(groups.values()).sort((a, b) => {
      const latestA = Math.max(...a.tasks.map(t => new Date(t.created_at).getTime()));
      const latestB = Math.max(...b.tasks.map(t => new Date(t.created_at).getTime()));
      return latestB - latestA;
    });
  }, [compositeTasks]);

  // Filter by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedTasks;
    const search = searchTerm.toLowerCase();
    return groupedTasks.filter(group => 
      group.customerName.toLowerCase().includes(search) ||
      String(group.contractId).includes(search)
    );
  }, [groupedTasks, searchTerm]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalCustomer = compositeTasks.reduce((sum, t) => sum + (t.customer_total || 0), 0);
    const totalCompany = compositeTasks.reduce((sum, t) => sum + (t.company_total || 0), 0);
    const totalProfit = compositeTasks.reduce((sum, t) => sum + (t.net_profit || 0), 0);
    return { 
      totalCustomer, 
      totalCompany, 
      totalProfit, 
      tasksCount: compositeTasks.length,
      contractsCount: groupedTasks.length
    };
  }, [compositeTasks, groupedTasks]);

  const toggleContract = (contractId: number) => {
    setExpandedContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  // Update costs mutation - with sync to related tables
  const updateCostsMutation = useMutation({
    mutationFn: async (data: UpdateCompositeTaskCostsInput) => {
      const customerInstall = data.customer_installation_cost ?? 0;
      const companyInstall = data.company_installation_cost ?? 0;
      const customerPrint = data.customer_print_cost ?? 0;
      const companyPrint = data.company_print_cost ?? 0;
      const customerCutout = data.customer_cutout_cost ?? 0;
      const companyCutout = data.company_cutout_cost ?? 0;
      const discountAmount = data.discount_amount ?? 0;
      
      const customerSubtotal = customerInstall + customerPrint + customerCutout;
      const customerTotal = customerSubtotal - discountAmount;
      const companyTotal = companyInstall + companyPrint + companyCutout;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      // 1. تحديث composite_tasks
      const { error: compositeError } = await supabase
        .from('composite_tasks')
        .update({
          customer_installation_cost: customerInstall,
          company_installation_cost: companyInstall,
          customer_print_cost: customerPrint,
          company_print_cost: companyPrint,
          customer_cutout_cost: customerCutout,
          company_cutout_cost: companyCutout,
          discount_amount: discountAmount,
          discount_reason: data.discount_reason || null,
          customer_total: customerTotal,
          company_total: companyTotal,
          net_profit: netProfit,
          profit_percentage: profitPercentage,
          notes: data.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (compositeError) throw compositeError;

      // جلب المهمة للحصول على المعرفات المرتبطة
      const { data: taskData } = await supabase
        .from('composite_tasks')
        .select('print_task_id, cutout_task_id, combined_invoice_id, customer_name')
        .eq('id', data.id)
        .single();

      // 2. تحديث print_tasks إذا وجدت
      if (taskData?.print_task_id) {
        await supabase
          .from('print_tasks')
          .update({
            total_cost: companyPrint,
            customer_total_amount: customerPrint,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskData.print_task_id);
      }

      // 3. تحديث cutout_tasks إذا وجدت
      if (taskData?.cutout_task_id) {
        await supabase
          .from('cutout_tasks')
          .update({
            total_cost: companyCutout,
            customer_total_amount: customerCutout,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskData.cutout_task_id);
      }

      // 4. تحديث الفاتورة الموحدة إذا وجدت
      if (taskData?.combined_invoice_id) {
        await supabase
          .from('printed_invoices')
          .update({
            print_cost: companyPrint + companyCutout,
            total_amount: customerTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskData.combined_invoice_id);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث التكاليف ومزامنة جميع البيانات المرتبطة');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printed-invoices'] });
      setEditDialogOpen(false);
      setEditingTask(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تحديث التكاليف');
    }
  });

  // Delete all tasks for a contract
  const deleteContractTasksMutation = useMutation({
    mutationFn: async (contractId: number) => {
      // Get all composite tasks for this contract
      const { data: tasks } = await supabase
        .from('composite_tasks')
        .select('id, combined_invoice_id')
        .eq('contract_id', contractId);

      if (tasks && tasks.length > 0) {
        // Delete related customer payments
        const invoiceIds = tasks.map(t => t.combined_invoice_id).filter(Boolean);
        if (invoiceIds.length > 0) {
          await supabase
            .from('customer_payments')
            .delete()
            .in('printed_invoice_id', invoiceIds);
          
          // Delete invoices
          await supabase
            .from('printed_invoices')
            .delete()
            .in('id', invoiceIds);
        }

        // Delete composite tasks
        const { error } = await supabase
          .from('composite_tasks')
          .delete()
          .eq('contract_id', contractId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('تم حذف جميع مهام العقد بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      setDeleteContractId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المهام');
    }
  });

  const handleEditCosts = (task: CompositeTaskWithDetails) => {
    setEditingTask(task);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-card border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">العقود</p>
                <p className="text-xl font-bold text-foreground">{stats.contractsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">المهام</p>
                <p className="text-xl font-bold text-foreground">{stats.tasksCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/10">
                <Package className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الإيرادات</p>
                <p className="text-lg font-bold text-primary">{stats.totalCustomer.toLocaleString('ar-LY')}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">التكاليف</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.totalCompany.toLocaleString('ar-LY')}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingDown className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`bg-card border-border/50 hover:shadow-md transition-shadow`}>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">صافي الربح</p>
                <p className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stats.totalProfit.toLocaleString('ar-LY')}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${stats.totalProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم العقد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* Grouped Tasks List */}
      {filteredGroups.length === 0 ? (
        <Card className="p-6 md:p-8 text-center border-border/50">
          <Package className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-sm md:text-base text-muted-foreground">لا توجد مهام مجمعة</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <CollapsibleGroupCard
              key={group.contractId}
              group={group}
              isExpanded={expandedContracts.has(group.contractId)}
              onToggle={() => toggleContract(group.contractId)}
              onDelete={() => setDeleteContractId(group.contractId)}
            >
              {group.tasks.map((task) => (
                <EnhancedCompositeTaskCard
                  key={task.id}
                  task={task}
                  onEditCosts={handleEditCosts}
                  onDelete={() => refetch()}
                />
              ))}
            </CollapsibleGroupCard>
          ))}
        </div>
      )}

      {/* Edit Costs Dialog */}
      <EnhancedEditCompositeTaskCostsDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={(data) => updateCostsMutation.mutate(data)}
        isSaving={updateCostsMutation.isPending}
      />

      {/* Delete Contract Tasks Confirmation */}
      <AlertDialog open={deleteContractId !== null} onOpenChange={() => setDeleteContractId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف مهام العقد
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع المهام المجمعة والفواتير المرتبطة بالعقد #{deleteContractId}.
              <br />
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteContractId && deleteContractTasksMutation.mutate(deleteContractId)}
            >
              {deleteContractTasksMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              حذف جميع المهام
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompositeTasksListEnhanced;
