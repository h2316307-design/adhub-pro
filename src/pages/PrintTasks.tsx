import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

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
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  printers?: any;
  printed_invoices?: any;
}

interface PrintTaskItem {
  id: string;
  task_id: string;
  billboard_id: number | null;
  description: string | null;
  width: number | null;
  height: number | null;
  area: number | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: 'pending' | 'printing' | 'completed';
  billboards?: any;
}

export default function PrintTasks() {
  const [selectedTask, setSelectedTask] = useState<PrintTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['print-tasks', filterStatus],
    queryFn: async () => {
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
      
      if (error) throw error;
      return data as PrintTask[];
    },
  });

  const { data: taskItems = [] } = useQuery({
    queryKey: ['print-task-items', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      const { data, error } = await supabase
        .from('print_task_items')
        .select(`
          *,
          billboards("ID", "Billboard_Name", "Size", Image_URL)
        `)
        .eq('task_id', selectedTask.id)
        .order('id');
      
      if (error) throw error;
      return data as PrintTaskItem[];
    },
    enabled: !!selectedTask?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: any = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('print_tasks')
        .update(updates)
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة المهمة: ' + error.message);
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { error } = await supabase
        .from('print_task_items')
        .update({ status })
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة البند بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة البند: ' + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { variant: 'secondary', label: 'معلق', icon: Clock },
      in_progress: { variant: 'default', label: 'قيد الطباعة', icon: Printer },
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

  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      low: { variant: 'secondary', label: 'منخفضة' },
      normal: { variant: 'outline', label: 'عادية' },
      high: { variant: 'default', label: 'عالية' },
      urgent: { variant: 'destructive', label: 'عاجلة' },
    };
    const config = variants[priority] || variants.normal;
    
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getItemStatusBadge = (status: string) => {
    const variants: any = {
      pending: { label: 'معلق', className: 'bg-gray-100 text-gray-800' },
      printing: { label: 'قيد الطباعة', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'مكتمل', className: 'bg-green-100 text-green-800' },
    };
    const config = variants[status] || variants.pending;
    
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مهام الطباعة</h1>
          <p className="text-muted-foreground">إدارة ومتابعة مهام طباعة فواتير اللوحات الإعلانية</p>
        </div>
      </div>

      {/* التصفية */}
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
              <SelectItem value="in_progress">قيد الطباعة</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* قائمة المهام */}
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-xl font-bold mb-4">المهام</h2>
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد مهام طباعة</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTask?.id === task.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">
                        {task.customer_name || 'بدون اسم'}
                      </span>
                      {getPriorityBadge(task.priority)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {task.printed_invoices?.invoice_number || `مهمة #${task.id.slice(0, 8)}`}
                      </span>
                      {getStatusBadge(task.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>المساحة: {task.total_area?.toFixed(2)} م²</div>
                      <div>التكلفة: {task.total_cost?.toLocaleString()} د.ل</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* تفاصيل المهمة */}
        <Card className="p-6 lg:col-span-2">
          {!selectedTask ? (
            <div className="text-center py-12 text-muted-foreground">
              اختر مهمة لعرض التفاصيل
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTask.customer_name || 'بدون اسم'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.printed_invoices?.invoice_number || `مهمة #${selectedTask.id.slice(0, 8)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(selectedTask.priority)}
                    {getStatusBadge(selectedTask.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>المطبعة:</strong> {selectedTask.printers?.name || '-'}
                  </div>
                  <div>
                    <strong>المساحة الإجمالية:</strong> {selectedTask.total_area?.toFixed(2)} م²
                  </div>
                  <div>
                    <strong>التكلفة الإجمالية:</strong> {selectedTask.total_cost?.toLocaleString()} د.ل
                  </div>
                  <div>
                    <strong>تاريخ الإنشاء:</strong> {format(new Date(selectedTask.created_at), 'PPP', { locale: ar })}
                  </div>
                  {selectedTask.due_date && (
                    <div>
                      <strong>تاريخ الاستحقاق:</strong> {format(new Date(selectedTask.due_date), 'PPP', { locale: ar })}
                    </div>
                  )}
                  {selectedTask.completed_at && (
                    <div>
                      <strong>تاريخ الإكمال:</strong> {format(new Date(selectedTask.completed_at), 'PPP', { locale: ar })}
                    </div>
                  )}
                </div>

                {selectedTask.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <strong className="text-sm block mb-1">ملاحظات:</strong>
                    <p className="text-sm">{selectedTask.notes}</p>
                  </div>
                )}
              </div>

              {/* تحديث الحالة */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'in_progress' })}
                  disabled={selectedTask.status === 'in_progress' || selectedTask.status === 'completed'}
                >
                  بدء الطباعة
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'completed' })}
                  disabled={selectedTask.status === 'completed'}
                >
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                  إكمال المهمة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'cancelled' })}
                  disabled={selectedTask.status === 'cancelled' || selectedTask.status === 'completed'}
                >
                  إلغاء المهمة
                </Button>
              </div>

              {/* بنود الطباعة */}
              <div>
                <h3 className="text-lg font-bold mb-3">بنود الطباعة</h3>
                {taskItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">لا توجد بنود</div>
                ) : (
                  <div className="space-y-3">
                    {taskItems.map(item => (
                      <div key={item.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {item.billboard_id && (
                                <span className="font-bold">#{item.billboard_id}</span>
                              )}
                              {item.billboards?.Billboard_Name && (
                                <span className="text-sm text-muted-foreground">
                                  {item.billboards.Billboard_Name}
                                </span>
                              )}
                            </div>
                            <div className="text-sm space-y-1">
                              {item.description && <div>{item.description}</div>}
                              {item.width && item.height && (
                                <div>المقاسات: {item.width} × {item.height} م ({item.area?.toFixed(2)} م²)</div>
                              )}
                              <div>الكمية: {item.quantity}</div>
                              <div>التكلفة: {item.total_cost?.toLocaleString()} د.ل</div>
                            </div>
                            <div className="mt-2">
                              {getItemStatusBadge(item.status)}
                            </div>
                          </div>
                          {item.billboards?.Image_URL && (
                            <img
                              src={item.billboards.Image_URL}
                              alt="صورة اللوحة"
                              className="w-24 h-16 object-cover rounded"
                            />
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, status: 'printing' })}
                            disabled={item.status !== 'pending'}
                          >
                            بدء الطباعة
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, status: 'completed' })}
                            disabled={item.status === 'completed'}
                          >
                            تم الطباعة
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
