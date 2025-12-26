import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Printer, Clock, CheckCircle2, XCircle, ListFilter, Trash2 } from 'lucide-react';
import { PrintTaskList } from '@/components/print-tasks/PrintTaskList';
import { PrintTaskDetails } from '@/components/print-tasks/PrintTaskDetails';
import { CreateManualPrintTask } from '@/components/print-tasks/CreateManualPrintTask';
import { toast } from 'sonner';

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

  // Fetch print tasks
  const { data: tasks = [], isLoading, refetch } = useQuery({
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

  // حذف المهام المكررة
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      // البحث عن المهام المكررة (غير المرتبطة بمهام مجمعة)
      const { data: duplicates, error: fetchError } = await supabase
        .from('print_tasks')
        .select('id, contract_id, is_composite, created_at')
        .eq('is_composite', false)
        .order('created_at', { ascending: true });
      
      if (fetchError) throw fetchError;
      
      // تجميع حسب العقد
      const contractTasks: Record<number, string[]> = {};
      duplicates?.forEach(task => {
        if (task.contract_id) {
          if (!contractTasks[task.contract_id]) {
            contractTasks[task.contract_id] = [];
          }
          contractTasks[task.contract_id].push(task.id);
        }
      });
      
      // حذف المهام المكررة (الاحتفاظ بالأحدث فقط)
      const tasksToDelete: string[] = [];
      Object.values(contractTasks).forEach(taskIds => {
        if (taskIds.length > 1) {
          // حذف كل المهام ما عدا الأخيرة
          tasksToDelete.push(...taskIds.slice(0, -1));
        }
      });
      
      if (tasksToDelete.length === 0) {
        return { deleted: 0 };
      }
      
      // حذف العناصر المرتبطة أولاً
      await supabase
        .from('print_task_items')
        .delete()
        .in('task_id', tasksToDelete);
      
      // حذف المهام
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

  // حساب عدد المهام المكررة
  const duplicateCount = tasks.filter(t => !t.is_composite).reduce((acc, task) => {
    const key = task.contract_id?.toString() || '';
    if (!acc.seen[key]) {
      acc.seen[key] = true;
    } else {
      acc.count++;
    }
    return acc;
  }, { seen: {} as Record<string, boolean>, count: 0 }).count;

  // حساب الإحصائيات
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    totalArea: tasks.reduce((sum, t) => sum + (t.total_area || 0), 0),
    totalCost: tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  مهام الطباعة
                </h1>
                <p className="text-sm text-muted-foreground">إدارة ومتابعة مهام طباعة اللوحات الإعلانية</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
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
            <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
            <Button 
              onClick={() => setCreateManualDialogOpen(true)} 
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              إنشاء مهمة يدوية
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المهام</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary">
                  <ListFilter className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">معلقة</p>
                  <p className="text-2xl font-bold text-orange">{stats.pending}</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/50">
                  <Clock className="h-5 w-5 text-orange" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">قيد التنفيذ</p>
                  <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">مكتملة</p>
                  <p className="text-2xl font-bold text-green">{stats.completed}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                  <CheckCircle2 className="h-5 w-5 text-green" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">إجمالي المساحة</p>
                <p className="text-xl font-bold text-foreground">{stats.totalArea.toFixed(0)} م²</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">إجمالي التكلفة</p>
                <p className="text-xl font-bold text-foreground">{stats.totalCost.toLocaleString()} د.ل</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">تصفية حسب الحالة:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'الكل', color: 'bg-secondary hover:bg-secondary/80 text-foreground' },
                  { value: 'pending', label: 'معلق', color: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-950/50 dark:hover:bg-orange-950 dark:text-orange-400' },
                  { value: 'in_progress', label: 'قيد التنفيذ', color: 'bg-primary/10 hover:bg-primary/20 text-primary' },
                  { value: 'completed', label: 'مكتمل', color: 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-950/50 dark:hover:bg-green-950 dark:text-green-400' },
                  { value: 'cancelled', label: 'ملغي', color: 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/50 dark:hover:bg-red-950 dark:text-red-400' },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant="ghost"
                    size="sm"
                    className={`${filter.color} ${filterStatus === filter.value ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                    onClick={() => setFilterStatus(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks List */}
          <Card className="border border-border bg-card lg:col-span-1 overflow-hidden">
            <CardHeader className="bg-secondary/50 border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                قائمة المهام
                <Badge variant="secondary" className="mr-auto">{tasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <PrintTaskList
                tasks={tasks}
                selectedTaskId={selectedTask?.id || null}
                onSelectTask={(task) => setSelectedTask(task)}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Task Details */}
          <Card className="border border-border bg-card lg:col-span-2 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                تفاصيل المهمة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
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