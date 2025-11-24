import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, User, Calendar, Package, DollarSign, Edit2, Save, X, Trash2, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CutoutTaskInvoice } from '@/components/tasks/CutoutTaskInvoice';

interface CutoutTask {
  id: string;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  priority: string;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  printers?: { name: string } | null;
  customer_total_amount?: number;
  printer_id?: string;
  installation_task_id?: string | null;
  invoice_id?: string | null;
}

interface CutoutTaskItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  cutout_image_url: string | null;
  status: string;
}

interface CutoutTaskDetailsProps {
  task: CutoutTask | null;
}

const statusLabels: Record<string, string> = {
  pending: 'معلق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي'
};

const priorityLabels: Record<string, string> = {
  low: 'منخفض',
  normal: 'عادي',
  high: 'عالي',
  urgent: 'عاجل'
};

export function CutoutTaskDetails({ task }: CutoutTaskDetailsProps) {
  const queryClient = useQueryClient();
  const [editingPrices, setEditingPrices] = useState(false);
  const [customerTotalAmount, setCustomerTotalAmount] = useState(task?.customer_total_amount || 0);
  const [unitCost, setUnitCost] = useState(task?.unit_cost || 0);
  const [totalCost, setTotalCost] = useState(task?.total_cost || 0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['cutout-task-items', task?.id],
    queryFn: async () => {
      if (!task?.id) return [];
      
      const { data, error } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as CutoutTaskItem[];
    },
    enabled: !!task?.id
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('cutout_tasks')
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الحالة: ' + error.message);
    }
  });

  const updatePricesMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('cutout_tasks')
        .update({
          customer_total_amount: customerTotalAmount,
          unit_cost: unitCost,
          total_cost: totalCost
        })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الأسعار بنجاح');
      setEditingPrices(false);
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الأسعار: ' + error.message);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      
      // First, clear the circular reference in installation_tasks
      await supabase
        .from('installation_tasks')
        .update({ cutout_task_id: null })
        .eq('cutout_task_id', task.id);
      
      // Delete the associated printed invoice if exists
      if (task.invoice_id) {
        await supabase
          .from('printed_invoices')
          .delete()
          .eq('id', task.invoice_id);
      }
      
      // Clear the invoice_id reference
      await supabase
        .from('cutout_tasks')
        .update({ installation_task_id: null, invoice_id: null })
        .eq('id', task.id);
      
      // Finally delete the task
      const { error } = await supabase
        .from('cutout_tasks')
        .delete()
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف مهمة المجسمات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في حذف المهمة: ' + error.message);
    }
  });

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Scissors className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>اختر مهمة لعرض التفاصيل</p>
        </div>
      </div>
    );
  }

  const profit = (customerTotalAmount || 0) - (totalCost || 0);

  // تحضير بيانات التصاميم للطباعة
  const designGroups = items.map(item => ({
    design: item.cutout_image_url || '',
    face: 'a' as const,
    size: 'قياس موحد',
    quantity: item.quantity,
    area: 0,
    billboards: [],
    width: 0,
    height: 0,
    hasCutout: true,
    cutoutCount: item.quantity,
    cutoutImageUrl: item.cutout_image_url || undefined
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold">تفاصيل المهمة</h2>
            <Badge>{statusLabels[task.status]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            تم الإنشاء: {new Date(task.created_at).toLocaleString('ar-LY')}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={task.status} onValueChange={(value) => updateStatusMutation.mutate(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">معلق</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                deleteTaskMutation.mutate();
              }
            }}
            disabled={deleteTaskMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            حذف المهمة
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">العميل</p>
                <p className="font-medium">{task.customer_name || 'بدون اسم'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Scissors className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">المطبعة</p>
                <p className="font-medium">{task.printers?.name || 'لم يتم التحديد'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الكمية</p>
                <p className="font-medium">{task.total_quantity} قطعة</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">الأولوية</p>
                <Badge>{priorityLabels[task.priority]}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Due Date */}
      {task.due_date && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">تاريخ الاستحقاق</p>
                <p className="font-medium">
                  {new Date(task.due_date).toLocaleDateString('ar-LY')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">التكاليف والأسعار</CardTitle>
          {!editingPrices && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomerTotalAmount(task.customer_total_amount || 0);
                setUnitCost(task.unit_cost || 0);
                setTotalCost(task.total_cost || 0);
                setEditingPrices(true);
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              تعديل الأسعار
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingPrices ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>سعر الزبون (إجمالي)</Label>
                  <Input
                    type="number"
                    value={customerTotalAmount}
                    onChange={(e) => setCustomerTotalAmount(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label>سعر الوحدة للمطبعة</Label>
                  <Input
                    type="number"
                    value={unitCost}
                    onChange={(e) => {
                      const newUnitCost = parseFloat(e.target.value) || 0;
                      setUnitCost(newUnitCost);
                      setTotalCost(newUnitCost * task.total_quantity);
                    }}
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label>التكلفة الإجمالية</Label>
                  <Input
                    type="number"
                    value={totalCost}
                    onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>

              <div>
                <Label>الربح (تلقائي)</Label>
                <Input
                  type="number"
                  value={profit}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => updatePricesMutation.mutate()}
                  disabled={updatePricesMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  حفظ التغييرات
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingPrices(false)}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <span className="text-muted-foreground text-sm block mb-1">سعر الزبون</span>
                  <span className="font-bold text-lg text-blue-600">{(customerTotalAmount || 0).toLocaleString()} د.ل</span>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-200">
                  <span className="text-muted-foreground text-sm block mb-1">سعر الوحدة</span>
                  <span className="font-bold text-lg text-orange-600">{(unitCost || 0).toLocaleString()} د.ل</span>
                </div>
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <span className="text-muted-foreground text-sm block mb-1">التكلفة الإجمالية</span>
                  <span className="font-bold text-lg text-red-600">{(totalCost || 0).toLocaleString()} د.ل</span>
                </div>
                <div className={`p-3 rounded border ${profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-100 border-red-300'}`}>
                  <span className="text-muted-foreground text-sm block mb-1">الربح</span>
                  <span className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profit.toLocaleString()} د.ل
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {task.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ملاحظات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{task.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Print Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الطباعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <CutoutTaskInvoice
              designGroups={designGroups}
              cutoutPricePerUnit={unitCost || 0}
              cutoutPrinterName={task.printers?.name}
              totalCutouts={task.total_quantity}
              showPrices={false}
            />
            <CutoutTaskInvoice
              designGroups={designGroups}
              cutoutPricePerUnit={unitCost || 0}
              cutoutPrinterName={task.printers?.name}
              totalCutouts={task.total_quantity}
              showPrices={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">عناصر المهمة</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              لا توجد عناصر لهذه المهمة
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.description || 'بدون وصف'}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-muted-foreground">
                            الكمية: <span className="font-medium text-foreground">{item.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            سعر الوحدة: <span className="font-medium text-foreground">{item.unit_cost.toFixed(2)} د.ل</span>
                          </span>
                          <span className="text-muted-foreground">
                            الإجمالي: <span className="font-medium text-foreground">{item.total_cost.toFixed(2)} د.ل</span>
                          </span>
                        </div>
                      </div>
                      <Badge>{statusLabels[item.status]}</Badge>
                    </div>

                    {/* Cutout Image */}
                    {item.cutout_image_url && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">صورة المجسم</p>
                        <div className="border rounded-lg p-3 bg-muted/50">
                          <img 
                            src={item.cutout_image_url} 
                            alt="صورة المجسم"
                            className="max-h-48 w-auto object-contain mx-auto rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
