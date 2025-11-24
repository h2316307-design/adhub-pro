import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw } from 'lucide-react';
import { PrintTaskList } from '@/components/print-tasks/PrintTaskList';
import { PrintTaskDetails } from '@/components/print-tasks/PrintTaskDetails';
import { CreateManualPrintTask } from '@/components/print-tasks/CreateManualPrintTask';

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
  priority: 'low' | 'normal' | 'high' | 'urgent';
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
      console.log('📦 Fetching print tasks with filter:', filterStatus);
      
      let query = supabase
        .from('print_tasks')
        .select(`
          *,
          printers(name),
          printed_invoices(invoice_number)
        `)
        .order('created_at', { ascending: false });
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error fetching print tasks:', error);
        throw error;
      }
      
      console.log('✅ Print tasks loaded:', data?.length || 0, data);
      return (data || []) as any as PrintTask[];
    },
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
  };

  const handleTaskCreated = () => {
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مهام الطباعة</h1>
          <p className="text-muted-foreground">إدارة ومتابعة مهام طباعة اللوحات الإعلانية</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            تحديث
          </Button>
          <Button onClick={() => setCreateManualDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            إنشاء مهمة يدوية
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">إجمالي المهام</div>
          <div className="text-2xl font-bold">{tasks.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">قيد التنفيذ</div>
          <div className="text-2xl font-bold text-blue-600">
            {tasks.filter(t => t.status === 'in_progress').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">مكتملة</div>
          <div className="text-2xl font-bold text-green-600">
            {tasks.filter(t => t.status === 'completed').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">معلقة</div>
          <div className="text-2xl font-bold text-orange-600">
            {tasks.filter(t => t.status === 'pending').length}
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">تصفية حسب الحالة:</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="pending">معلق</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks List */}
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-xl font-bold mb-4">قائمة المهام</h2>
          <PrintTaskList
            tasks={tasks}
            selectedTaskId={selectedTask?.id || null}
            onSelectTask={(task) => setSelectedTask(task)}
            isLoading={isLoading}
          />
        </Card>

        {/* Task Details */}
        <Card className="p-6 lg:col-span-2">
          <PrintTaskDetails task={selectedTask} />
        </Card>
      </div>

      {/* Create Manual Task Dialog */}
      <CreateManualPrintTask
        open={createManualDialogOpen}
        onOpenChange={setCreateManualDialogOpen}
        onSuccess={handleTaskCreated}
      />
    </div>
  );
}
