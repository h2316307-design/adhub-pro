import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  RefreshCw, 
  Printer, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Trash2,
  AlertTriangle,
  FileText,
  TrendingUp,
  Layers,
  Loader2,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PrintTaskList } from '@/components/print-tasks/PrintTaskList';
import { PrintTaskDetails } from '@/components/print-tasks/PrintTaskDetails';
import { CreateManualPrintTask } from '@/components/print-tasks/CreateManualPrintTask';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrintTask {
  id: string;
  invoice_id: string | null;
  contract_id: number | null;
  customer_id: string | null;
  customer_name: string | null;
  printer_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_area: number;
  total_cost: number;
  customer_total_amount: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_composite: boolean;
  printers?: { name: string } | null;
  printed_invoices?: { invoice_number: string } | null;
}

export default function PrintTasks() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<PrintTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [createManualDialogOpen, setCreateManualDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['print-tasks', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('print_tasks')
        .select(`
          *,
          printers!print_tasks_printer_id_fkey(name),
          printed_invoices!print_tasks_invoice_id_fkey(invoice_number)
        `)
        .order('created_at', { ascending: false });
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as any as PrintTask[];
    },
  });

  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const { data: duplicates, error: fetchError } = await supabase
        .from('print_tasks')
        .select('id, contract_id, is_composite, created_at')
        .eq('is_composite', false)
        .order('created_at', { ascending: true });
      
      if (fetchError) throw fetchError;
      
      const contractTasks: Record<number, string[]> = {};
      duplicates?.forEach(task => {
        if (task.contract_id) {
          if (!contractTasks[task.contract_id]) {
            contractTasks[task.contract_id] = [];
          }
          contractTasks[task.contract_id].push(task.id);
        }
      });
      
      const tasksToDelete: string[] = [];
      Object.values(contractTasks).forEach(taskIds => {
        if (taskIds.length > 1) {
          tasksToDelete.push(...taskIds.slice(0, -1));
        }
      });
      
      if (tasksToDelete.length === 0) {
        return { deleted: 0 };
      }
      
      await supabase
        .from('print_task_items')
        .delete()
        .in('task_id', tasksToDelete);
      
      const { error: deleteError } = await supabase
        .from('print_tasks')
        .delete()
        .in('id', tasksToDelete);
      
      if (deleteError) throw deleteError;
      
      return { deleted: tasksToDelete.length };
    },
    onSuccess: (data) => {
      toast.success(`تم حذف ${data.deleted} مهمة مكررة`);
      refetch();
    },
    onError: (error) => {
      toast.error('فشل في حذف المهام المكررة');
      console.error(error);
    }
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
  };

  const handleTaskCreated = () => {
    refetch();
  };

  const duplicateCount = tasks.filter(t => !t.is_composite).reduce((acc, task) => {
    const key = task.contract_id?.toString() || '';
    if (!acc.seen[key]) {
      acc.seen[key] = true;
    } else {
      acc.count++;
    }
    return acc;
  }, { seen: {} as Record<string, boolean>, count: 0 }).count;

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    noPrinter: tasks.filter(t => !t.printer_id).length,
    totalArea: tasks.reduce((sum, t) => sum + (t.total_area || 0), 0),
    totalCost: tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0),
    totalRevenue: tasks.reduce((sum, t) => sum + (t.customer_total_amount || 0), 0),
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      task.customer_name?.toLowerCase().includes(search) ||
      task.contract_id?.toString().includes(search) ||
      task.printers?.name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/25">
              <Printer className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                مهام الطباعة
              </h1>
              <p className="text-muted-foreground mt-1">
                إدارة ومتابعة مهام طباعة اللوحات الإعلانية
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {duplicateCount > 0 && (
              <Button 
                onClick={() => cleanupDuplicatesMutation.mutate()} 
                variant="destructive" 
                size="sm" 
                className="gap-2"
                disabled={cleanupDuplicatesMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                حذف المكررة ({duplicateCount})
              </Button>
            )}
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={isFetching}
              className="gap-2 border-border/50"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              تحديث
            </Button>
            <Button 
              onClick={() => setCreateManualDialogOpen(true)} 
              size="sm"
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
            >
              <Plus className="h-4 w-4" />
              إنشاء مهمة جديدة
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/10 group-hover:from-slate-500/10 group-hover:to-slate-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المهام</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-500/10 group-hover:bg-slate-500/20 transition-colors">
                  <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10 group-hover:from-amber-500/10 group-hover:to-amber-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">معلقة</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 group-hover:from-blue-500/10 group-hover:to-blue-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">قيد التنفيذ</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 group-hover:from-emerald-500/10 group-hover:to-emerald-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">مكتملة</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/10 group-hover:from-purple-500/10 group-hover:to-purple-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">المساحة الكلية</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.totalArea.toFixed(0)} <span className="text-xs font-normal">م²</span>
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-teal-600/10 group-hover:from-teal-500/10 group-hover:to-teal-600/15 transition-colors" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الإيرادات</p>
                  <p className="text-lg font-bold text-teal-600 dark:text-teal-400">
                    {stats.totalRevenue.toLocaleString()} <span className="text-xs font-normal">د.ل</span>
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                  <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warning for tasks without printer */}
        {stats.noPrinter > 0 && (
          <Card className="border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    يوجد {stats.noPrinter} مهمة بدون تحديد مطبعة
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    يرجى تحديد المطبعة لكل مهمة لإضافتها في حسابات المطابع
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tasks List Panel */}
          <Card className="lg:col-span-4 border-border/50 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-b border-border/50 pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  قائمة المهام
                </CardTitle>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                  {filteredTasks.length}
                </Badge>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو رقم العقد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-background/50"
                />
              </div>
              
              {/* Filter Tabs */}
              <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                <TabsList className="grid w-full grid-cols-4 h-9 bg-background/50">
                  <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    الكل
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                    معلق
                  </TabsTrigger>
                  <TabsTrigger value="in_progress" className="text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    جاري
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                    مكتمل
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px]">
                <div className="p-3">
                  <PrintTaskList
                    tasks={filteredTasks}
                    selectedTaskId={selectedTask?.id || null}
                    onSelectTask={(task) => setSelectedTask(task)}
                    isLoading={isLoading}
                  />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Task Details Panel */}
          <Card className="lg:col-span-8 border-border/50 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                تفاصيل المهمة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <PrintTaskDetails task={selectedTask} />
            </CardContent>
          </Card>
        </div>

        {/* Create Manual Task Dialog */}
        <CreateManualPrintTask
          open={createManualDialogOpen}
          onOpenChange={setCreateManualDialogOpen}
          onSuccess={handleTaskCreated}
        />
      </div>
    </div>
  );
}
