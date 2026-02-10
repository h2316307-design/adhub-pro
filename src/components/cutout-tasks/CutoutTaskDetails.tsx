import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, User, Calendar, Package, Trash2, Printer, Building2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CutoutCostSummary } from './CutoutCostSummary';

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
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(task?.printer_id || null);

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

      {/* Pricing Section - New Summary Component */}
      <CutoutCostSummary
        taskId={task.id}
        items={items}
        customerTotalAmount={displayCustomerAmount}
        unitCost={displayUnitCost}
        totalCost={displayTotalCost}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['cutout-task-items'] });
        }}
      />

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
