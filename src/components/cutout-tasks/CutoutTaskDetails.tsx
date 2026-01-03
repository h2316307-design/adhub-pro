import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, User, Calendar, Package, Edit2, Save, X, Trash2, Printer, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(task?.printer_id || null);
  
  // Update local state when task changes
  const [customerTotalAmount, setCustomerTotalAmount] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // جلب قائمة المطابع
  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // تحديث المطبعة المختارة عند تغيير المهمة
  React.useEffect(() => {
    setSelectedPrinterId(task?.printer_id || null);
  }, [task?.printer_id]);

  // Sync state with task and load from composite_tasks if values are 0
  React.useEffect(() => {
    const loadPrices = async () => {
      if (!task) return;
      
      let custAmount = task.customer_total_amount || 0;
      let compCost = task.total_cost || 0;
      
      // إذا كانت القيم صفر، نحاول جلبها من composite_task المرتبط
      if ((custAmount === 0 || compCost === 0) && task.id) {
        const { data: compositeTask } = await supabase
          .from('composite_tasks')
          .select('customer_cutout_cost, company_cutout_cost')
          .eq('cutout_task_id', task.id)
          .single();
        
        if (compositeTask) {
          custAmount = compositeTask.customer_cutout_cost || custAmount;
          compCost = compositeTask.company_cutout_cost || compCost;
        }
      }
      
      if (!editingPrices) {
        setCustomerTotalAmount(custAmount);
        setUnitCost(task.unit_cost || 0);
        setTotalCost(compCost);
      }
    };
    
    loadPrices();
  }, [task, editingPrices]);

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
      
      // تحديث cutout_tasks
      const { error } = await supabase
        .from('cutout_tasks')
        .update({
          customer_total_amount: customerTotalAmount,
          unit_cost: unitCost,
          total_cost: totalCost
        })
        .eq('id', task.id);
      
      if (error) throw error;
      
      // مزامنة مع composite_tasks إذا كان مرتبط (وتحديث الإجماليات لمنع اختلاف الأرقام)
      const { data: compositeTask, error: compositeError } = await supabase
        .from('composite_tasks')
        .select(
          'id, customer_installation_cost, customer_print_cost, company_installation_cost, company_print_cost, discount_amount'
        )
        .eq('cutout_task_id', task.id)
        .maybeSingle();

      if (compositeError) throw compositeError;

      if (compositeTask?.id) {
        const customerInstall = Number(compositeTask.customer_installation_cost) || 0;
        const customerPrint = Number(compositeTask.customer_print_cost) || 0;
        const companyInstall = Number(compositeTask.company_installation_cost) || 0;
        const companyPrint = Number(compositeTask.company_print_cost) || 0;
        const discountAmount = Number(compositeTask.discount_amount) || 0;

        const customerSubtotal = customerInstall + customerPrint + customerTotalAmount;
        const customerTotal = customerSubtotal - discountAmount;
        const companyTotal = companyInstall + companyPrint + totalCost;
        const netProfit = customerTotal - companyTotal;
        const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

        const { error: updateCompositeError } = await supabase
          .from('composite_tasks')
          .update({
            customer_cutout_cost: customerTotalAmount,
            company_cutout_cost: totalCost,
            customer_total: customerTotal,
            company_total: companyTotal,
            net_profit: netProfit,
            profit_percentage: profitPercentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', compositeTask.id);

        if (updateCompositeError) throw updateCompositeError;
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث الأسعار بنجاح');
      setEditingPrices(false);
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الأسعار: ' + error.message);
    }
  });

  // تحديث المطبعة
  const updatePrinterMutation = useMutation({
    mutationFn: async (printerId: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('cutout_tasks')
        .update({ printer_id: printerId })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديد المطبعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديد المطبعة: ' + error.message);
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

  // استخدام القيم من المهمة مباشرة
  const displayCustomerAmount = task.customer_total_amount || 0;
  const displayUnitCost = task.unit_cost || 0;
  const displayTotalCost = task.total_cost || 0;
  const profit = displayCustomerAmount - displayTotalCost;

  // دالة طباعة الفاتورة
  const handlePrintInvoice = (showPrices: boolean) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة');
      return;
    }

    const baseUrl = window.location.origin;
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة قص المجسمات</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 210mm; height: 297mm;
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl; text-align: right;
            background: white; color: #000;
            font-size: 11px; line-height: 1.3;
          }
          @page { size: A4 portrait; margin: 0; }
          .invoice-container { width: 210mm; min-height: 297mm; padding: 12mm; display: flex; flex-direction: column; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .company-logo { max-width: 350px; height: auto; }
          .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
          .section { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #000; }
          .section-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .info-box { background: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd; text-align: center; }
          .info-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: bold; }
          .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .items-table th { background: #000; color: #fff; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #000; }
          .items-table td { padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; }
          .items-table tbody tr:nth-child(even) { background: #f8f9fa; }
          .design-image { max-width: 80px; max-height: 80px; object-fit: contain; margin: 0 auto; display: block; border: 1px solid #ddd; border-radius: 4px; }
          .total-row { background: #000; color: white; padding: 15px; text-align: center; border-radius: 6px; font-size: 18px; font-weight: bold; margin-top: 15px; }
          .footer { margin-top: auto; padding-top: 15px; border-top: 2px solid #000; text-align: center; font-size: 11px; color: #666; }
          @media print { html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div>
              <img src="${baseUrl}/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
            </div>
            <div style="text-align: left;">
              <div class="invoice-title">فاتورة قص المجسمات</div>
              <div style="color: #666;">التاريخ: ${new Date().toLocaleDateString('ar-LY')}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">معلومات المهمة</div>
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">العميل</div>
                <div class="info-value">${task.customer_name || 'غير محدد'}</div>
              </div>
              <div class="info-box">
                <div class="info-label">المطبعة</div>
                <div class="info-value">${task.printers?.name || 'غير محدد'}</div>
              </div>
              <div class="info-box">
                <div class="info-label">إجمالي الكمية</div>
                <div class="info-value">${task.total_quantity} قطعة</div>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>صورة المجسم</th>
                <th>الوصف</th>
                <th>الكمية</th>
                ${showPrices ? '<th>سعر الوحدة</th><th>الإجمالي</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.cutout_image_url ? `<img src="${item.cutout_image_url}" class="design-image" onerror="this.style.display='none'" />` : '-'}</td>
                  <td>${item.description || 'مجسم'}</td>
                  <td><strong>${item.quantity}</strong></td>
                  ${showPrices ? `<td>${(displayUnitCost).toLocaleString()} د.ل</td><td><strong>${(item.quantity * displayUnitCost).toLocaleString()} د.ل</strong></td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${showPrices ? `
          <div class="section">
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">إجمالي القطع</div>
                <div class="info-value">${task.total_quantity}</div>
              </div>
              <div class="info-box">
                <div class="info-label">سعر الوحدة</div>
                <div class="info-value">${displayUnitCost.toLocaleString()} د.ل</div>
              </div>
              <div class="info-box">
                <div class="info-label">التكلفة الإجمالية</div>
                <div class="info-value">${displayTotalCost.toLocaleString()} د.ل</div>
              </div>
            </div>
            <div class="total-row">
              الإجمالي المستحق: ${displayCustomerAmount.toLocaleString()} دينار ليبي
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <div><strong>شكراً لتعاملكم معنا</strong></div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

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

      {/* Printer Selection Card - يظهر عندما لا يوجد مطبعة محددة */}
      {!task.printer_id && (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Building2 className="h-5 w-5" />
              اختر المطبعة لهذه المهمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select
                value={selectedPrinterId || ''}
                onValueChange={(value) => setSelectedPrinterId(value)}
              >
                <SelectTrigger className="flex-1 bg-white dark:bg-slate-800">
                  <SelectValue placeholder="اختر المطبعة..." />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (selectedPrinterId) {
                    updatePrinterMutation.mutate(selectedPrinterId);
                  }
                }}
                disabled={!selectedPrinterId || updatePrinterMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                تأكيد
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                {task.printer_id ? (
                  <p className="font-medium">{task.printers?.name || 'غير محدد'}</p>
                ) : (
                  <Select
                    value={selectedPrinterId || ''}
                    onValueChange={(value) => {
                      setSelectedPrinterId(value);
                      updatePrinterMutation.mutate(value);
                    }}
                    disabled={updatePrinterMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue placeholder="اختر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                  <span className="font-bold text-lg text-blue-600">{displayCustomerAmount.toLocaleString()} د.ل</span>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-200">
                  <span className="text-muted-foreground text-sm block mb-1">سعر الوحدة</span>
                  <span className="font-bold text-lg text-orange-600">{displayUnitCost.toLocaleString()} د.ل</span>
                </div>
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <span className="text-muted-foreground text-sm block mb-1">التكلفة الإجمالية</span>
                  <span className="font-bold text-lg text-red-600">{displayTotalCost.toLocaleString()} د.ل</span>
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
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => handlePrintInvoice(false)}
              variant="outline"
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              طباعة للمطبعة (بدون أسعار)
            </Button>
            <Button 
              onClick={() => handlePrintInvoice(true)}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              طباعة فاتورة كاملة
            </Button>
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
