import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, Printer, AlertCircle, Package, Edit2, Save, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CustomerInvoice } from './CustomerInvoice';
import { DesignDisplayCard } from './DesignDisplayCard';

interface PrintTaskItem {
  id: string;
  description: string;
  width: number;
  height: number;
  area: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean | null;
  cutout_quantity?: number;
  billboard_id?: number;
  billboards?: any;
  model_link?: string | null;
  status?: string;
}

interface DesignGroup {
  design: string | null;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  width: number;
  height: number;
}

interface PrintTaskDetailsProps {
  task: any;
}

export function PrintTaskDetails({ task }: PrintTaskDetailsProps) {
  const queryClient = useQueryClient();
  const [editingPrices, setEditingPrices] = useState(false);
  const [customerPricePerMeter, setCustomerPricePerMeter] = useState(0);
  const [printerPricePerMeter, setPrinterPricePerMeter] = useState(0);

  // مزامنة قيم الأسعار مع بيانات المهمة عند تغيير المهمة
  useEffect(() => {
    const loadPrices = async () => {
      if (!task) return;
      
      const totalArea = task.total_area || 1;
      let customerTotal = task.customer_total_amount || 0;
      let printerTotal = task.total_cost || 0;
      
      // إذا كانت القيم صفر، نحاول جلبها من composite_task المرتبط
      if ((customerTotal === 0 || printerTotal === 0) && task.id) {
        const { data: compositeTask } = await supabase
          .from('composite_tasks')
          .select('customer_print_cost, company_print_cost')
          .eq('print_task_id', task.id)
          .single();
        
        if (compositeTask) {
          customerTotal = compositeTask.customer_print_cost || customerTotal;
          printerTotal = compositeTask.company_print_cost || printerTotal;
        }
      }
      
      // حساب سعر المتر للمطبعة من الإجمالي
      const printerPerMeter = totalArea > 0 ? printerTotal / totalArea : 0;
      
      // إذا كان سعر الزبون صفر وسعر المطبعة موجود، نقترح سعر افتراضي (2x سعر المطبعة)
      let customerPerMeter = totalArea > 0 ? customerTotal / totalArea : 0;
      if (customerPerMeter === 0 && printerPerMeter > 0) {
        // نقترح سعر مبدئي بضعف سعر المطبعة لكن لا نحفظه تلقائياً
        customerPerMeter = printerPerMeter * 2;
      }
      
      setCustomerPricePerMeter(customerPerMeter);
      setPrinterPricePerMeter(printerPerMeter);
    };
    
    loadPrices();
  }, [task]);

  const { data: items = [] } = useQuery({
    queryKey: ['print-task-items', task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      if (!task?.id) return [];
      const { data, error } = await supabase
        .from('print_task_items')
        .select(`
          id,
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
          model_link,
          has_cutout,
          cutout_quantity,
          billboard_id,
          billboards("ID", "Billboard_Name", "Size")
        `)
        .eq('task_id', task.id)
        .order('id');
      
      if (error) throw error;
      return data as PrintTaskItem[];
    }
  });

  // Load cutout task items if available
  const { data: cutoutItems = [] } = useQuery({
    queryKey: ['cutout-task-items', task?.cutout_task_id],
    enabled: !!task?.cutout_task_id,
    queryFn: async () => {
      if (!task?.cutout_task_id) return [];
      const { data, error } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', task.cutout_task_id);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Create a map of billboard_id to cutout count
  const cutoutsByBillboard = useMemo(() => {
    const map = new Map();
    // Use cutout_quantity from print_task_items directly
    items.forEach((item: any) => {
      if (item.has_cutout && item.cutout_quantity && item.billboard_id) {
        if (!map.has(item.billboard_id)) {
          map.set(item.billboard_id, item.cutout_quantity);
        }
      }
    });
    return map;
  }, [items]);

  // Enrich items with cutout information
  const enrichedItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      cutout_quantity: item.cutout_quantity || cutoutsByBillboard.get(item.billboard_id) || 0
    }));
  }, [items, cutoutsByBillboard]);

  const designGroups = useMemo(() => {
    const groups: Record<string, DesignGroup> = {};

    enrichedItems.forEach(item => {
      const size = `${item.width}×${item.height}`;
      
      if (item.design_face_a) {
        const keyA = `${size}_${item.design_face_a}_a`;
        if (!groups[keyA]) {
          groups[keyA] = {
            design: item.design_face_a,
            face: 'a' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height
          };
        }
        groups[keyA].quantity += item.quantity;
      }

      if (item.design_face_b) {
        const keyB = `${size}_${item.design_face_b}_b`;
        if (!groups[keyB]) {
          groups[keyB] = {
            design: item.design_face_b,
            face: 'b' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height
          };
        }
        groups[keyB].quantity += item.quantity;
      }
    });

    return Object.values(groups);
  }, [enrichedItems]);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('print_tasks')
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الحالة: ' + error.message);
    }
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
    onError: (error: any) => {
      toast.error('فشل في تحديث الحالة: ' + error.message);
    }
  });

  const updatePricesMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      const totalArea = task.total_area || 0;
      const customerTotalAmount = customerPricePerMeter * totalArea;
      const totalCost = printerPricePerMeter * totalArea;
      
      // تحديث print_tasks
      const { error } = await supabase
        .from('print_tasks')
        .update({
          customer_total_amount: customerTotalAmount,
          total_cost: totalCost
        })
        .eq('id', task.id);
      
      if (error) throw error;
      
      // مزامنة مع composite_tasks إذا كان مرتبط (وتحديث الإجماليات لمنع اختلاف الأرقام)
      const { data: compositeTask, error: compositeError } = await supabase
        .from('composite_tasks')
        .select(
          'id, customer_installation_cost, customer_cutout_cost, company_installation_cost, company_cutout_cost, discount_amount'
        )
        .eq('print_task_id', task.id)
        .maybeSingle();

      if (compositeError) throw compositeError;

      if (compositeTask?.id) {
        const customerInstall = Number(compositeTask.customer_installation_cost) || 0;
        const customerCutout = Number(compositeTask.customer_cutout_cost) || 0;
        const companyInstall = Number(compositeTask.company_installation_cost) || 0;
        const companyCutout = Number(compositeTask.company_cutout_cost) || 0;
        const discountAmount = Number(compositeTask.discount_amount) || 0;

        const customerSubtotal = customerInstall + customerTotalAmount + customerCutout;
        const customerTotal = customerSubtotal - discountAmount;
        const companyTotal = companyInstall + totalCost + companyCutout;
        const netProfit = customerTotal - companyTotal;
        const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

        const { error: updateCompositeError } = await supabase
          .from('composite_tasks')
          .update({
            customer_print_cost: customerTotalAmount,
            company_print_cost: totalCost,
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
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الأسعار: ' + error.message);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      
      // Delete task items first
      const { error: itemsError } = await supabase
        .from('print_task_items')
        .delete()
        .eq('task_id', task.id);
      
      if (itemsError) throw itemsError;
      
      // Delete the task
      const { error: taskError } = await supabase
        .from('print_tasks')
        .delete()
        .eq('id', task.id);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف مهمة الطباعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في حذف المهمة: ' + error.message);
    }
  });

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>اختر مهمة لعرض التفاصيل</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Printer;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
      case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'in_progress': return 'قيد التنفيذ';
      case 'cancelled': return 'ملغي';
      default: return 'معلق';
    }
  };

  const StatusIcon = getStatusIcon(task.status);

  // Calculate designs from enriched items
  const designs = enrichedItems
    .flatMap(item => [
      { url: item.design_face_a, face: 'a' as const },
      { url: item.design_face_b, face: 'b' as const }
    ])
    .filter(d => d.url);

  const hasDesigns = designs.length > 0;
  
  // حساب الربح بشكل صحيح
  const totalArea = task?.total_area || 0;
  const customerTotalAmount = customerPricePerMeter * totalArea;
  const printerTotal = printerPricePerMeter * totalArea;
  const profit = customerTotalAmount - printerTotal;
  const profitPercentage = printerTotal > 0 ? ((profit / printerTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{task.customer_name || 'بدون اسم'}</h2>
            <p className="text-sm text-muted-foreground">
              {task.contract_id && `عقد رقم: ${task.contract_id} | `}
              {task.printed_invoices?.invoice_number || `مهمة #${task.id.slice(0, 8)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${getStatusColor(task.status)} gap-1 px-3 py-1`}>
            <StatusIcon className="h-4 w-4" />
            {getStatusLabel(task.status)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 border-red-200 dark:border-red-800"
            onClick={() => {
              if (window.confirm('هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.')) {
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

      {/* Basic Info Card */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">معلومات المهمة</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">المطبعة</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{task.printers?.name || '-'}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">المساحة الإجمالية</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{task.total_area?.toFixed(2)} م²</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">تاريخ الإنشاء</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}
              </span>
            </div>
            {task.completed_at && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1">تاريخ الإكمال</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {format(new Date(task.completed_at), 'dd/MM/yyyy', { locale: ar })}
                </span>
              </div>
            )}
          </div>
          
          {task.notes && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground block mb-1">ملاحظات</span>
              <p className="text-sm text-slate-600 dark:text-slate-300">{task.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Pricing Section */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b flex items-center justify-between">
          <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </span>
            التسعير والأرباح
          </h3>
          <Button
            variant={editingPrices ? "destructive" : "outline"}
            size="sm"
            onClick={() => {
              if (editingPrices) {
                const taskTotalArea = task?.total_area || 1;
                setCustomerPricePerMeter(taskTotalArea > 0 ? (task?.customer_total_amount || 0) / taskTotalArea : 0);
                setPrinterPricePerMeter(taskTotalArea > 0 ? (task?.total_cost || 0) / taskTotalArea : 0);
              }
              setEditingPrices(!editingPrices);
            }}
            className="gap-1"
          >
            {editingPrices ? (
              <>
                <X className="h-4 w-4" />
                إلغاء
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                تعديل الأسعار
              </>
            )}
          </Button>
        </div>
        <div className="p-4">
        {editingPrices ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>سعر المتر للزبون (د.ل/م²) *</Label>
                <Input
                  type="number"
                  value={customerPricePerMeter}
                  onChange={(e) => setCustomerPricePerMeter(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.5"
                />
                <span className="text-xs text-muted-foreground">
                  الإجمالي: {(customerPricePerMeter * totalArea).toLocaleString()} د.ل
                </span>
              </div>
              <div>
                <Label>سعر المتر للمطبعة (د.ل/م²)</Label>
                <Input
                  type="number"
                  value={printerPricePerMeter}
                  onChange={(e) => setPrinterPricePerMeter(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.5"
                />
                <span className="text-xs text-muted-foreground">
                  الإجمالي: {(printerPricePerMeter * totalArea).toLocaleString()} د.ل
                </span>
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
              <div>
                <Label>المساحة الإجمالية (م²)</Label>
                <Input
                  type="number"
                  value={totalArea.toFixed(2)}
                  disabled
                  className="bg-muted"
                />
              </div>
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
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* تحذير إذا لم يتم تحديد سعر الزبون */}
            {(task?.customer_total_amount === 0 || !task?.customer_total_amount) && printerPricePerMeter > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>لم يتم تحديد سعر الزبون - السعر المعروض مقترح (2x سعر المطبعة). يرجى تعديل السعر وحفظه.</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-800">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium block mb-1">سعر المتر للزبون</span>
                <span className="font-bold text-xl text-blue-700 dark:text-blue-300">{customerPricePerMeter.toFixed(2)}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400"> د.ل/م²</span>
                <div className="text-xs text-blue-500 dark:text-blue-400 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  الإجمالي: <span className="font-semibold">{customerTotalAmount.toLocaleString()}</span> د.ل
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">سعر المتر للمطبعة</span>
                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">{printerPricePerMeter.toFixed(2)}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400"> د.ل/م²</span>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  الإجمالي: <span className="font-semibold">{printerTotal.toLocaleString()}</span> د.ل
                </div>
              </div>
              
              <div className={`p-4 rounded-xl border ${profit >= 0 
                ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border-emerald-200 dark:border-emerald-800' 
                : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800'}`}>
                <span className={`text-xs font-medium block mb-1 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  الربح
                </span>
                <span className={`font-bold text-xl ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {profit.toLocaleString()}
                </span>
                <span className={`text-xs ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}> د.ل</span>
              </div>
              
              <div className={`p-4 rounded-xl border ${profitPercentage >= 0 
                ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-violet-200 dark:border-violet-800' 
                : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800'}`}>
                <span className={`text-xs font-medium block mb-1 ${profitPercentage >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                  نسبة الربح
                </span>
                <span className={`font-bold text-xl ${profitPercentage >= 0 ? 'text-violet-700 dark:text-violet-300' : 'text-red-700 dark:text-red-300'}`}>
                  {profitPercentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">المساحة الإجمالية</span>
                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">{totalArea.toFixed(2)}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400"> م²</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </Card>

      {/* Design Summary */}
      {hasDesigns && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">ملخص التصاميم المطلوبة:</h3>
          
          {designGroups.map((group, index) => (
            <DesignDisplayCard
              key={index}
              group={group}
              index={index}
              editMode={false}
            />
          ))}

          {/* Design Summary Stats */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">عدد التصاميم</div>
                  <div className="text-2xl font-bold">{designGroups.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">إجمالي الكمية</div>
                  <div className="text-2xl font-bold">{designGroups.reduce((sum, g) => sum + g.quantity, 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">إجمالي المساحة</div>
                  <div className="text-2xl font-bold text-primary">{items.reduce((sum, item) => sum + (item.area * item.quantity), 0).toFixed(2)} م²</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">سعر الزبون</div>
                  <div className="text-2xl font-bold text-primary">{customerTotalAmount.toLocaleString()} د.ل</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Update */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">تغيير الحالة:</label>
        <Select
          value={task.status}
          onValueChange={(value) => updateStatusMutation.mutate(value)}
          disabled={updateStatusMutation.isPending}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items */}
      <div>
        <h3 className="text-lg font-semibold mb-3">البنود ({items.length})</h3>
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold">{item.description}</span>
                    {item.billboards && (
                      <Badge variant="outline" className="text-xs">
                        لوحة #{item.billboards.ID}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3 text-sm text-muted-foreground mb-2">
                    <div>
                      <span className="block">المقاس</span>
                      <span className="font-semibold text-foreground">
                        {item.width} × {item.height}
                      </span>
                    </div>
                    <div>
                      <span className="block">المساحة</span>
                      <span className="font-semibold text-foreground">{item.area?.toFixed(2)} م²</span>
                    </div>
                    <div>
                      <span className="block">الكمية</span>
                      <span className="font-semibold text-foreground">{item.quantity}</span>
                    </div>
                    <div>
                      <span className="block">سعر الوحدة</span>
                      <span className="font-semibold text-foreground">{item.unit_cost} د.ل</span>
                    </div>
                    <div>
                      <span className="block">المجموع</span>
                      <span className="font-semibold text-primary">{item.total_cost?.toLocaleString()} د.ل</span>
                    </div>
                  </div>
                  {(item.design_face_a || item.design_face_b || item.model_link) && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-2 text-xs flex-wrap">
                        {item.design_face_a && (
                          <a 
                            href={item.design_face_a} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            التصميم الأمامي
                          </a>
                        )}
                        {item.design_face_b && (
                          <a 
                            href={item.design_face_b} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            التصميم الخلفي
                          </a>
                        )}
                        {item.has_cutout && (
                          <Badge variant="outline" className="text-xs">
                            يحتوي على مجسم
                          </Badge>
                        )}
                      </div>
                      {item.model_link && (
                        <div className="text-xs">
                          <a 
                            href={item.model_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            🔗 رابط المجسم
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Select
                  value={item.status}
                  onValueChange={(value) => 
                    updateItemStatusMutation.mutate({ itemId: item.id, status: value })
                  }
                  disabled={updateItemStatusMutation.isPending}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="printing">جاري الطباعة</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Invoice Buttons */}
      <Card className="p-6 space-y-4 border-2 border-primary bg-primary/5">
        <h3 className="text-lg font-bold">الفواتير</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button 
            onClick={() => {
              const printWindow = window.open('', '_blank', 'width=1200,height=800');
              if (!printWindow) {
                alert('يرجى السماح بفتح النوافذ المنبثقة');
                return;
              }

              const baseUrl = window.location.origin;
              const htmlContent = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>فاتورة المطبعة</title>
                  <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body { width: 210mm; height: 297mm; font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; text-align: right; background: white; color: #000; font-size: 11px; line-height: 1.3; overflow: hidden; }
                    @page { size: A4 portrait; margin: 0; }
                    .invoice-container { width: 210mm; height: 297mm; padding: 12mm; display: flex; flex-direction: column; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                    .invoice-info { text-align: left; direction: ltr; order: 2; }
                    .invoice-title { font-size: 24px; font-weight: bold; color: #000; margin-bottom: 8px; }
                    .invoice-subtitle { font-size: 13px; color: #666; font-weight: bold; margin-bottom: 8px; }
                    .invoice-details { font-size: 11px; color: #666; line-height: 1.5; }
                    .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                    .company-logo { max-width: 450px; height: auto; object-fit: contain; margin-bottom: 8px; }
                    .section-title { font-size: 16px; font-weight: bold; color: #000; margin-bottom: 12px; text-align: center; }
                    .printer-section { background: #f8f9fa; padding: 18px; border-radius: 8px; margin-bottom: 18px; border: 2px solid #000; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .info-box { background: white; padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
                    .info-label { font-size: 11px; color: #000; font-weight: bold; margin-bottom: 4px; }
                    .info-value { font-size: 13px; color: #000; }
                    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                    .items-table th { background: #000; color: #fff; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #000; }
                    .items-table td { padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; }
                    .items-table tbody tr:nth-child(even) { background: #f8f9fa; }
                    .items-table img { border: 1px solid #ddd; }
                    .model-image { max-width: 100%; height: auto; max-height: 200px; object-fit: contain; margin: 0 auto; display: block; border-radius: 4px; border: 2px solid #ddd; }
                    .summary-section { margin-top: auto; padding: 18px; background: #f8f9fa; border: 2px solid #000; border-radius: 8px; }
                    .summary-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 4px; border: 1px solid #ddd; margin-bottom: 8px; }
                    .summary-label { font-weight: bold; font-size: 12px; }
                    .summary-value { font-weight: bold; font-size: 14px; color: #000; }
                    .total-row { background: #000; color: white; padding: 12px; text-align: center; border-radius: 6px; font-size: 16px; font-weight: bold; margin-top: 10px; }
                    .footer { margin-top: 20px; padding-top: 15px; border-top: 2px solid #000; text-align: center; font-size: 11px; color: #666; }
                    @media print { html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                  </style>
                </head>
                <body>
                  <div class="invoice-container">
                    <div class="header">
                      <div class="company-info">
                        <img src="${baseUrl}/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                      </div>
                      <div class="invoice-info">
                        <div class="invoice-title">فاتورة المطبعة</div>
                        <div class="invoice-subtitle">Printer Invoice</div>
                        <div class="invoice-details">
                          <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}</div>
                          <div><strong>رقم الفاتورة:</strong> PR-${Date.now()}</div>
                        </div>
                      </div>
                    </div>

                    <div class="printer-section">
                      <div class="section-title">معلومات المطبعة</div>
                      <div class="info-grid">
                        <div class="info-box">
                          <div class="info-label">المطبعة:</div>
                          <div class="info-value">${task.printers?.name || 'غير محدد'}</div>
                        </div>
                      </div>
                    </div>

                    <table class="items-table">
                      <thead>
                        <tr>
                          <th style="width: 80px;">الصورة</th>
                          <th style="width: 80px;">المقاس</th>
                          <th style="width: 60px;">الوجه</th>
                          <th style="width: 50px;">مجسم</th>
                          <th style="width: 60px;">الكمية</th>
                          <th style="width: 80px;">المساحة/وحدة</th>
                          <th style="width: 100px;">إجمالي المساحة</th>
                          <th style="width: 100px;">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(() => {
                          const totalTaskArea = items.reduce((sum, item) => sum + (item.area * item.quantity), 0);
                          const taskCost = task.total_cost || 0;
                          const costPerSqm = totalTaskArea > 0 ? taskCost / totalTaskArea : 0;
                          
                          return items.map((item, idx) => {
                            const itemDesigns = [];
                            if (item.design_face_a) itemDesigns.push({ url: item.design_face_a, face: 'أمامي' });
                            if (item.design_face_b) itemDesigns.push({ url: item.design_face_b, face: 'خلفي' });
                            
                            return itemDesigns.map((design, dIdx) => {
                              const itemArea = item.area * item.quantity;
                              const itemCost = itemArea * costPerSqm;
                              
                              return `
                              <tr>
                                <td>
                                  ${design.url ? `<img src="${design.url}" alt="تصميم" style="max-width: 70px; max-height: 50px; object-fit: contain; margin: 0 auto; display: block; border-radius: 4px;" onerror="this.style.display='none'">` : '—'}
                                  ${item.model_link ? `<br/><a href="${item.model_link}" target="_blank" style="font-size: 7px; color: #0066cc;">🔗 مجسم</a>` : ''}
                                </td>
                                <td><strong>${item.width}×${item.height}</strong></td>
                                <td>${design.face}</td>
                                <td>${item.has_cutout ? '✓' : '—'}</td>
                                <td><strong>×${item.quantity}</strong></td>
                                <td>${item.area.toFixed(2)} م²</td>
                                <td><strong>${itemArea.toFixed(2)} م²</strong></td>
                                <td><strong>${itemCost.toLocaleString('ar-LY', { maximumFractionDigits: 2 })} د.ل</strong></td>
                              </tr>
                            `;
                            }).join('');
                          }).join('');
                        })()}
                      </tbody>
                    </table>

                    <div class="summary-section">
                      <div class="summary-item">
                        <span class="summary-label">إجمالي المساحة:</span>
                        <span class="summary-value">${items.reduce((sum, item) => sum + (item.area * item.quantity), 0).toFixed(2)} م²</span>
                      </div>
                      <div class="total-row">
                        تكلفة الطباعة: ${task.total_cost?.toLocaleString() || 0} دينار ليبي
                      </div>
                    </div>

                    <div class="footer">
                      <div><strong>شكراً لتعاملكم معنا</strong></div>
                      <div>هذه الفاتورة تم إنشاؤها تلقائياً من نظام إدارة اللوحات</div>
                    </div>
                  </div>
                </body>
                </html>
              `;

              printWindow.document.write(htmlContent);
              printWindow.document.close();
              
              setTimeout(() => {
                printWindow.focus();
                printWindow.print();
              }, 500);
            }}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة فاتورة المطبعة
          </Button>

          <CustomerInvoice
            customerName={task.customer_name}
            items={enrichedItems}
            customerPrice={customerTotalAmount}
            customerPricePerMeter={customerPricePerMeter}
            designs={designs}
            cutoutCost={0}
            cutoutPricePerUnit={0}
          />
        </div>
      </Card>
    </div>
  );
}
