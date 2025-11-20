import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, CheckCircle2, Clock, XCircle, AlertCircle, Upload, Image as ImageIcon, FileText } from 'lucide-react';

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
  design_face_a: string | null;
  design_face_b: string | null;
  billboards?: any;
}

export default function PrintTasks() {
  const [selectedTask, setSelectedTask] = useState<PrintTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PrintTaskItem | null>(null);
  const [designFiles, setDesignFiles] = useState<{ faceA: File | null; faceB: File | null }>({ faceA: null, faceB: null });
  const [printSummaryDialogOpen, setPrintSummaryDialogOpen] = useState(false);
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
          id,
          task_id,
          billboard_id,
          description,
          width,
          height,
          area,
          quantity,
          unit_cost,
          total_cost,
          status,
          design_face_a,
          design_face_b,
          billboards("ID", "Billboard_Name", "Size", Image_URL)
        `)
        .eq('task_id', selectedTask.id)
        .order('id');
      
      if (error) throw error;
      
      return (data || []) as PrintTaskItem[];
    },
    enabled: !!selectedTask?.id,
  });

  const handleDesignUpload = async (itemId: string, face: 'A' | 'B', file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${itemId}_face_${face}_${Date.now()}.${fileExt}`;
      
      // رفع الملف إلى مجلد مؤقت
      const formData = new FormData();
      formData.append('file', file);
      
      // حفظ رابط التصميم في قاعدة البيانات
      const designUrl = URL.createObjectURL(file);
      const column = face === 'A' ? 'design_face_a' : 'design_face_b';
      
      const { error } = await supabase
        .from('print_task_items')
        .update({ [column]: designUrl })
        .eq('id', itemId);
      
      if (error) throw error;
      
      toast.success(`تم رفع تصميم الوجه ${face} بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
    } catch (error) {
      console.error('Error uploading design:', error);
      toast.error('فشل في رفع التصميم');
    }
  };

  const openDesignDialog = (item: PrintTaskItem) => {
    setSelectedItem(item);
    setDesignDialogOpen(true);
  };

  const generatePrintSummary = () => {
    if (!taskItems.length) return null;
    
    // تجميع حسب المقاس
    const sizeGroups = taskItems.reduce((acc, item) => {
      const size = item.billboards?.Size || 'غير محدد';
      if (!acc[size]) {
        acc[size] = { quantity: 0, area: 0, items: [] };
      }
      acc[size].quantity += item.quantity;
      acc[size].area += (item.area || 0) * item.quantity;
      acc[size].items.push(item);
      return acc;
    }, {} as Record<string, { quantity: number; area: number; items: PrintTaskItem[] }>);

    // تجميع حسب التصميم
    const designGroups = taskItems.reduce((acc, item) => {
      const hasDesignA = !!item.design_face_a;
      const hasDesignB = !!item.design_face_b;
      const designKey = hasDesignA && hasDesignB ? 'وجهين' : hasDesignA ? 'وجه A' : hasDesignB ? 'وجه B' : 'بدون تصميم';
      
      if (!acc[designKey]) {
        acc[designKey] = { quantity: 0, area: 0 };
      }
      acc[designKey].quantity += item.quantity;
      acc[designKey].area += (item.area || 0) * item.quantity;
      return acc;
    }, {} as Record<string, { quantity: number; area: number }>);

    return { sizeGroups, designGroups };
  };

  const printTaskSummary = () => {
    const summary = generatePrintSummary();
    if (!summary) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ملخص مهمة الطباعة</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #333; }
          .section { margin: 30px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .total { background-color: #e8f5e9; font-weight: bold; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>ملخص مهمة الطباعة</h1>
        <p><strong>العميل:</strong> ${selectedTask?.customer_name || '-'}</p>
        <p><strong>رقم الفاتورة:</strong> ${selectedTask?.printed_invoices?.invoice_number || '-'}</p>
        <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        
        <div class="section">
          <h2>التجميع حسب المقاس</h2>
          <table>
            <thead>
              <tr>
                <th>المقاس</th>
                <th>الكمية</th>
                <th>المساحة الإجمالية (م²)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(summary.sizeGroups).map(([size, data]) => `
                <tr>
                  <td>${size}</td>
                  <td>${data.quantity}</td>
                  <td>${data.area.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>التجميع حسب التصميم</h2>
          <table>
            <thead>
              <tr>
                <th>نوع التصميم</th>
                <th>الكمية</th>
                <th>المساحة الإجمالية (م²)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(summary.designGroups).map(([design, data]) => `
                <tr>
                  <td>${design}</td>
                  <td>${data.quantity}</td>
                  <td>${data.area.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>تفاصيل البنود</h2>
          <table>
            <thead>
              <tr>
                <th>رقم اللوحة</th>
                <th>المقاس</th>
                <th>الكمية</th>
                <th>المساحة</th>
                <th>التصميم</th>
              </tr>
            </thead>
            <tbody>
              ${taskItems.map(item => `
                <tr>
                  <td>#${item.billboard_id || '-'}</td>
                  <td>${item.billboards?.Size || '-'}</td>
                  <td>${item.quantity}</td>
                  <td>${item.area?.toFixed(2) || '-'} م²</td>
                  <td>${item.design_face_a && item.design_face_b ? 'وجهين' : item.design_face_a ? 'وجه A' : item.design_face_b ? 'وجه B' : '-'}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="2">الإجمالي</td>
                <td>${taskItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td>${taskItems.reduce((sum, item) => sum + (item.area || 0) * item.quantity, 0).toFixed(2)} م²</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <button onclick="window.print()" style="padding: 10px 20px; margin: 20px 0; font-size: 16px;">طباعة</button>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

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
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'in_progress' })}
                  disabled={selectedTask.status === 'in_progress' || selectedTask.status === 'completed'}
                >
                  <Printer className="ml-2 h-4 w-4" />
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
                  variant="secondary"
                  onClick={printTaskSummary}
                >
                  <FileText className="ml-2 h-4 w-4" />
                  طباعة ملخص المهمة
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

              {/* ملخص التصاميم للمطبعة */}
              {taskItems.length > 0 && (
                <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                    <ImageIcon className="h-5 w-5" />
                    ملخص التصاميم المطلوبة للمطبعة
                  </h3>
                  
                  <div className="space-y-6">
                    {(() => {
                      // تجميع التصاميم حسب الصورة والمقاس
                      const designsMap = new Map<string, {
                        faceType: string;
                        imageUrl: string;
                        sizes: Map<string, { quantity: number; billboards: string[] }>;
                      }>();

                      taskItems.forEach(item => {
                        const size = item.billboards?.Size || 'غير محدد';
                        const billboardName = item.billboards?.Billboard_Name || `لوحة #${item.billboard_id}`;

                        // معالجة الوجه A
                        if (item.design_face_a) {
                          const key = `${item.design_face_a}_A`;
                          if (!designsMap.has(key)) {
                            designsMap.set(key, {
                              faceType: 'الوجه الأمامي',
                              imageUrl: item.design_face_a,
                              sizes: new Map()
                            });
                          }
                          const design = designsMap.get(key)!;
                          if (!design.sizes.has(size)) {
                            design.sizes.set(size, { quantity: 0, billboards: [] });
                          }
                          const sizeData = design.sizes.get(size)!;
                          sizeData.quantity += item.quantity;
                          sizeData.billboards.push(billboardName);
                        }

                        // معالجة الوجه B
                        if (item.design_face_b) {
                          const key = `${item.design_face_b}_B`;
                          if (!designsMap.has(key)) {
                            designsMap.set(key, {
                              faceType: 'الوجه الخلفي',
                              imageUrl: item.design_face_b,
                              sizes: new Map()
                            });
                          }
                          const design = designsMap.get(key)!;
                          if (!design.sizes.has(size)) {
                            design.sizes.set(size, { quantity: 0, billboards: [] });
                          }
                          const sizeData = design.sizes.get(size)!;
                          sizeData.quantity += item.quantity;
                          sizeData.billboards.push(billboardName);
                        }
                      });

                      return Array.from(designsMap.entries()).map(([key, design], idx) => (
                        <div key={key} className="bg-background rounded-lg p-4 border-2 border-primary/30 shadow-sm">
                          <div className="flex items-start gap-4">
                            {/* صورة التصميم */}
                            <div className="flex-shrink-0 w-48">
                              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary/40 shadow-md">
                                <img
                                  src={design.imageUrl}
                                  alt={`تصميم ${idx + 1}`}
                                  className="w-full h-full object-contain bg-muted"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "https://via.placeholder.com/300x300?text=تصميم";
                                  }}
                                />
                                <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs font-bold">
                                  تصميم #{idx + 1}
                                </div>
                              </div>
                              <Badge className="mt-2 w-full justify-center" variant="secondary">
                                {design.faceType}
                              </Badge>
                            </div>

                            {/* تفاصيل المقاسات والكميات */}
                            <div className="flex-1 space-y-3">
                              <h4 className="font-bold text-base text-primary border-b-2 border-primary/20 pb-2">
                                المطلوب طباعته:
                              </h4>
                              
                              <div className="grid gap-3">
                                {Array.from(design.sizes.entries()).map(([size, data]) => (
                                  <div key={size} className="bg-muted/50 rounded-lg p-3 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-3">
                                        <Badge variant="default" className="text-base px-3 py-1">
                                          مقاس: {size}
                                        </Badge>
                                        <Badge variant="outline" className="text-base px-3 py-1 bg-accent/20 border-accent">
                                          الكمية: {data.quantity} نسخة
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">
                                      <span className="font-semibold">اللوحات:</span> {data.billboards.join(' • ')}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* إجمالي هذا التصميم */}
                              <div className="bg-primary/10 rounded-lg p-3 border-2 border-primary/30">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-primary">إجمالي هذا التصميم:</span>
                                  <Badge className="text-base px-4 py-1 bg-primary">
                                    {Array.from(design.sizes.values()).reduce((sum, s) => sum + s.quantity, 0)} نسخة
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* إجمالي كل التصاميم */}
                  <div className="mt-6 bg-gradient-to-r from-primary to-accent rounded-lg p-4 text-primary-foreground shadow-lg">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>إجمالي جميع النسخ المطلوبة:</span>
                      <span className="text-2xl">
                        {taskItems.reduce((sum, item) => {
                          let count = 0;
                          if (item.design_face_a) count += item.quantity;
                          if (item.design_face_b) count += item.quantity;
                          return sum + count;
                        }, 0)} نسخة
                      </span>
                    </div>
                  </div>
                </Card>
              )}

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
                              {(item.design_face_a || item.design_face_b) && (
                                <div className="flex gap-2 items-center">
                                  <span>التصاميم:</span>
                                  {item.design_face_a && (
                                    <Badge variant="secondary" className="gap-1">
                                      <ImageIcon className="h-3 w-3" />
                                      وجه A
                                    </Badge>
                                  )}
                                  {item.design_face_b && (
                                    <Badge variant="secondary" className="gap-1">
                                      <ImageIcon className="h-3 w-3" />
                                      وجه B
                                    </Badge>
                                  )}
                                </div>
                              )}
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
                        
                        {/* عرض التصاميم */}
                        {(item.design_face_a || item.design_face_b) && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {item.design_face_a && (
                              <div className="border rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">تصميم الوجه A</p>
                                <img
                                  src={item.design_face_a}
                                  alt="تصميم الوجه A"
                                  className="w-full h-24 object-cover rounded"
                                />
                              </div>
                            )}
                            {item.design_face_b && (
                              <div className="border rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">تصميم الوجه B</p>
                                <img
                                  src={item.design_face_b}
                                  alt="تصميم الوجه B"
                                  className="w-full h-24 object-cover rounded"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 mt-3 flex-wrap">
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
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openDesignDialog(item)}
                          >
                            <Upload className="h-4 w-4 ml-2" />
                            إضافة تصاميم
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

      {/* Dialog لإضافة التصاميم */}
      <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>إضافة تصاميم الطباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              اللوحة: #{selectedItem?.billboard_id} - {selectedItem?.billboards?.Billboard_Name}
            </div>

            {/* وجه A */}
            <div className="space-y-2">
              <Label htmlFor="design-face-a">تصميم الوجه A</Label>
              {selectedItem?.design_face_a && (
                <div className="mb-2">
                  <img
                    src={selectedItem.design_face_a}
                    alt="تصميم الوجه A"
                    className="w-full h-48 object-cover rounded border"
                  />
                </div>
              )}
              <Input
                id="design-face-a"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && selectedItem) {
                    handleDesignUpload(selectedItem.id, 'A', file);
                  }
                }}
              />
            </div>

            {/* وجه B */}
            <div className="space-y-2">
              <Label htmlFor="design-face-b">تصميم الوجه B</Label>
              {selectedItem?.design_face_b && (
                <div className="mb-2">
                  <img
                    src={selectedItem.design_face_b}
                    alt="تصميم الوجه B"
                    className="w-full h-48 object-cover rounded border"
                  />
                </div>
              )}
              <Input
                id="design-face-b"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && selectedItem) {
                    handleDesignUpload(selectedItem.id, 'B', file);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDesignDialogOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
