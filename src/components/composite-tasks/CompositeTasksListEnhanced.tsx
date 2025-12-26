import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ChevronDown,
  ChevronUp,
  FileText,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { EnhancedCompositeTaskCard } from './EnhancedCompositeTaskCard';
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
        .select(`*`)
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
      return (data || []) as CompositeTaskWithDetails[];
    },
  });

  // Group tasks by contract
  const groupedTasks = useMemo(() => {
    const groups = new Map<number, GroupedTasks>();
    
    compositeTasks.forEach(task => {
      if (!task.contract_id) return;
      
      if (!groups.has(task.contract_id)) {
        groups.set(task.contract_id, {
          contractId: task.contract_id,
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
    });
    
    return Array.from(groups.values()).sort((a, b) => b.contractId - a.contractId);
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

  // Update costs mutation
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

      const { error } = await supabase
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

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث التكاليف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
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
            <Card key={group.contractId} className="overflow-hidden border-border/50 hover:shadow-md transition-all">
              <Collapsible 
                open={expandedContracts.has(group.contractId)}
                onOpenChange={() => toggleContract(group.contractId)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          {expandedContracts.has(group.contractId) ? (
                            <ChevronUp className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            <span className="text-foreground">{group.customerName}</span>
                            <Badge variant="outline" className="border-primary/30 text-primary">عقد #{group.contractId}</Badge>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{group.tasks.length} مهمة</Badge>
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <div className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                          <span className="text-muted-foreground text-xs">إيراد: </span>
                          <span className="font-semibold text-primary">{group.totalCustomer.toLocaleString('ar-LY')}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/20">
                          <span className="text-muted-foreground text-xs">تكلفة: </span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">{group.totalCompany.toLocaleString('ar-LY')}</span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg border ${group.totalProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                          <span className="text-muted-foreground text-xs">ربح: </span>
                          <span className={`font-semibold ${group.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {group.totalProfit.toLocaleString('ar-LY')}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteContractId(group.contractId);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0 space-y-3 bg-muted/10">
                    {group.tasks.map((task) => (
                      <EnhancedCompositeTaskCard
                        key={task.id}
                        task={task}
                        onEditCosts={handleEditCosts}
                        onDelete={() => refetch()}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
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
