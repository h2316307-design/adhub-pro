import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { Wrench, Printer, Scissors, FileText, Edit, Eye, TrendingUp, FileOutput, Loader2, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeProfitCard } from './CompositeProfitCard';
import { UnifiedTaskInvoice, InvoiceType } from './UnifiedTaskInvoice';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnhancedCompositeTaskCardProps {
  task: CompositeTaskWithDetails;
  onEditCosts?: (task: CompositeTaskWithDetails) => void;
  onViewInvoice?: (task: CompositeTaskWithDetails) => void;
  onDelete?: () => void;
}

export const EnhancedCompositeTaskCard: React.FC<EnhancedCompositeTaskCardProps> = ({
  task,
  onEditCosts,
  onViewInvoice,
  onDelete
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ adTypes?: { contractId: number; adType: string }[]; contractIds?: number[] } | null>(null);
  const [designImages, setDesignImages] = useState<Array<{ url: string; face: 'a' | 'b' }>>([]);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [currentInvoiceType, setCurrentInvoiceType] = useState<InvoiceType>('customer');
  const [calculatedInstallCost, setCalculatedInstallCost] = useState<number>(0);

  const openInvoice = (type: InvoiceType) => {
    setCurrentInvoiceType(type);
    setInvoiceDialogOpen(true);
  };

  // جلب معلومات العقود وأنواع الإعلان وصور التصميم
  useEffect(() => {
    const fetchContractInfo = async () => {
      try {
        let contractIds: number[] = [];
        
        // جلب العقود الفعلية من اللوحات في مهمة التركيب
        if (task.installation_task_id) {
          // جلب أرقام العقود الفعلية من اللوحات المرتبطة بالمهمة
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .eq('task_id', task.installation_task_id);
          
          if (installItems && installItems.length > 0) {
            // جمع أرقام العقود الفريدة من اللوحات
            const uniqueContracts = new Set<number>();
            installItems.forEach((item: any) => {
              if (item.billboard?.Contract_Number) {
                uniqueContracts.add(item.billboard.Contract_Number);
              }
            });
            contractIds = Array.from(uniqueContracts).filter(Boolean);
          }
          
          // إذا لم نجد عقود من اللوحات، نستخدم contract_id المخزن
          if (contractIds.length === 0) {
            contractIds = [task.contract_id].filter(Boolean);
          }
          
          // جلب أنواع الإعلان من جميع العقود
          if (contractIds.length > 0) {
            const { data: contracts } = await supabase
              .from('Contract')
              .select('"Contract_Number", "Ad Type"')
              .in('Contract_Number', contractIds);
            
            setContractInfo({
              adTypes: contracts?.map(c => ({ 
                contractId: c.Contract_Number, 
                adType: c['Ad Type'] || 'غير محدد' 
              })) || [],
              contractIds: contractIds
            });
          } else {
            setContractInfo({ adTypes: [], contractIds: [] });
          }
        } else {
          // جلب نوع الإعلان من العقد مباشرة
          contractIds = [task.contract_id].filter(Boolean);
          
          if (contractIds.length > 0) {
            const { data: contract } = await supabase
              .from('Contract')
              .select('"Ad Type"')
              .eq('Contract_Number', task.contract_id)
              .single();
            
            setContractInfo({
              adTypes: [{ contractId: task.contract_id, adType: contract?.['Ad Type'] || 'غير محدد' }],
              contractIds: [task.contract_id]
            });
          } else {
            setContractInfo({ adTypes: [], contractIds: [] });
          }
        }

        // جلب صور التصميم من مصادر مختلفة
        const images: Array<{ url: string; face: 'a' | 'b' }> = [];
        const seen = new Set<string>();
        
        // أولاً: حاول جلب من print_task_items إذا كانت مهمة الطباعة موجودة
        if (task.print_task_id) {
          const { data: printItems } = await supabase
            .from('print_task_items')
            .select('design_face_a, design_face_b')
            .eq('task_id', task.print_task_id);
          
          if (printItems) {
            printItems.forEach((item: any) => {
              if (item.design_face_a && !seen.has(item.design_face_a)) {
                seen.add(item.design_face_a);
                images.push({ url: item.design_face_a, face: 'a' });
              }
              if (item.design_face_b && !seen.has(item.design_face_b)) {
                seen.add(item.design_face_b);
                images.push({ url: item.design_face_b, face: 'b' });
              }
            });
          }
        }
        
        // ثانياً: جلب صور التصميم من مهمة التركيب (installation_task_items)
        if (images.length === 0 && task.installation_task_id) {
          const { data: taskItems } = await supabase
            .from('installation_task_items')
            .select('billboard_id, design_face_a, design_face_b')
            .eq('task_id', task.installation_task_id);

          if (taskItems && taskItems.length > 0) {
            // 1) أولاً: استخدام التصميمات المحفوظة في عناصر مهمة التركيب
            taskItems.forEach((item: any) => {
              if (item.design_face_a && !seen.has(item.design_face_a)) {
                seen.add(item.design_face_a);
                images.push({ url: item.design_face_a, face: 'a' });
              }
              if (item.design_face_b && !seen.has(item.design_face_b)) {
                seen.add(item.design_face_b);
                images.push({ url: item.design_face_b, face: 'b' });
              }
            });

            // 2) إذا لا تزال لا توجد صور، فولباك: جلب من جدول اللوحات باستخدام billboard_id
            if (images.length === 0) {
              const billboardIds = taskItems.map((item: any) => item.billboard_id).filter(Boolean);

              if (billboardIds.length > 0) {
                const { data: billboards } = await supabase
                  .from('billboards')
                  .select('design_face_a, design_face_b')
                  .in('ID', billboardIds);

                if (billboards) {
                  billboards.forEach((b: any) => {
                    if (b.design_face_a && !seen.has(b.design_face_a)) {
                      seen.add(b.design_face_a);
                      images.push({ url: b.design_face_a, face: 'a' });
                    }
                    if (b.design_face_b && !seen.has(b.design_face_b)) {
                      seen.add(b.design_face_b);
                      images.push({ url: b.design_face_b, face: 'b' });
                    }
                  });
                }
              }
            }
          }
        }
        
        // ثالثاً: فولباك من العقد مباشرة إذا لم توجد صور
        if (images.length === 0 && contractIds.length > 0) {
          const { data: billboards } = await supabase
            .from('billboards')
            .select('design_face_a, design_face_b')
            .in('Contract_Number', contractIds);
          
          if (billboards) {
            billboards.forEach((b: any) => {
              if (b.design_face_a && !seen.has(b.design_face_a)) {
                seen.add(b.design_face_a);
                images.push({ url: b.design_face_a, face: 'a' });
              }
              if (b.design_face_b && !seen.has(b.design_face_b)) {
                seen.add(b.design_face_b);
                images.push({ url: b.design_face_b, face: 'b' });
              }
            });
          }
        }
        
        setDesignImages(images.slice(0, 4)); // حد أقصى 4 صور
      } catch (error) {
        console.error('Error fetching contract info:', error);
      }
    };
    
    fetchContractInfo();
  }, [task.installation_task_id, task.contract_id, task.print_task_id]);

  // ✅ حساب تكلفة التركيب من جدول المقاسات (installation_price) + التكاليف الإضافية
  useEffect(() => {
    const calculateInstallCost = async () => {
      if (!task.installation_task_id) {
        setCalculatedInstallCost(0);
        return;
      }

      try {
        // جلب بيانات اللوحات من installation_task_items مع التكاليف الإضافية
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('faces_to_install, billboard:billboards!installation_task_items_billboard_id_fkey(Size, Faces_Count), additional_cost')
          .eq('task_id', task.installation_task_id);

        if (!installItems || installItems.length === 0) {
          setCalculatedInstallCost(0);
          return;
        }

        // جلب أسعار التركيب من جدول المقاسات
        const { data: sizesData } = await supabase
          .from('sizes')
          .select('name, installation_price');

        const sizesMap: Record<string, number> = {};
        sizesData?.forEach((s: any) => {
          sizesMap[s.name] = s.installation_price || 0;
        });

        // حساب إجمالي تكلفة التركيب + التكاليف الإضافية
        let total = 0;
        installItems.forEach((item: any) => {
          const billboardSize = item.billboard?.Size;
          // استخدام faces_to_install من مهمة التركيب بدل Faces_Count من اللوحة
          const facesCount = item.faces_to_install || item.billboard?.Faces_Count || 2;
          let installPrice = sizesMap[billboardSize] || 0;
          
          // نصف السعر للوحات ذات وجه واحد
          if (facesCount === 1) {
            installPrice = installPrice / 2;
          }
          
          total += installPrice;
          // إضافة التكاليف الإضافية
          total += item.additional_cost || 0;
        });

        setCalculatedInstallCost(total);
      } catch (error) {
        console.error('Error calculating install cost:', error);
        setCalculatedInstallCost(0);
      }
    };

    calculateInstallCost();
  }, [task.installation_task_id]);

  // Using UnifiedTaskInvoice now - old handlers removed

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'قيد الانتظار', variant: 'outline' },
      in_progress: { label: 'قيد التنفيذ', variant: 'default' },
      completed: { label: 'مكتمل', variant: 'secondary' },
      cancelled: { label: 'ملغي', variant: 'destructive' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTaskTypeBadge = (type: string) => {
    if (type === 'new_installation') {
      return <Badge className="bg-blue-500">تركيب جديد (شامل)</Badge>;
    }
    return <Badge className="bg-orange-500">إعادة تركيب</Badge>;
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // حذف سجلات customer_payments المرتبطة بفواتير الطباعة والقص
      if (task.print_task_id) {
        const { data: printTask } = await supabase
          .from('print_tasks')
          .select('invoice_id')
          .eq('id', task.print_task_id)
          .single();
        
        if (printTask?.invoice_id) {
          // حذف سجلات الدفع المرتبطة بالفاتورة
          await supabase
            .from('customer_payments')
            .delete()
            .eq('printed_invoice_id', printTask.invoice_id);
          
          // حذف بنود مهمة الطباعة
          await supabase
            .from('print_task_items')
            .delete()
            .eq('task_id', task.print_task_id);
          
          // حذف مهمة الطباعة
          await supabase
            .from('print_tasks')
            .delete()
            .eq('id', task.print_task_id);
          
          // حذف الفاتورة
          await supabase
            .from('printed_invoices')
            .delete()
            .eq('id', printTask.invoice_id);
        }
      }

      if (task.cutout_task_id) {
        const { data: cutoutTask } = await supabase
          .from('cutout_tasks')
          .select('invoice_id')
          .eq('id', task.cutout_task_id)
          .single();
        
        if (cutoutTask?.invoice_id) {
          // حذف سجلات الدفع المرتبطة بالفاتورة
          await supabase
            .from('customer_payments')
            .delete()
            .eq('printed_invoice_id', cutoutTask.invoice_id);
          
          // حذف بنود مهمة القص
          await supabase
            .from('cutout_task_items')
            .delete()
            .eq('task_id', task.cutout_task_id);
          
          // حذف مهمة القص
          await supabase
            .from('cutout_tasks')
            .delete()
            .eq('id', task.cutout_task_id);
          
          // حذف الفاتورة
          await supabase
            .from('printed_invoices')
            .delete()
            .eq('id', cutoutTask.invoice_id);
        }
      }

      // حذف الفاتورة الموحدة إذا وجدت
      if (task.combined_invoice_id) {
        await supabase
          .from('customer_payments')
          .delete()
          .eq('printed_invoice_id', task.combined_invoice_id);
        
        await supabase
          .from('printed_invoices')
          .delete()
          .eq('id', task.combined_invoice_id);
      }

      // Clear the references to related tasks
      const { error: updateError } = await supabase
        .from('composite_tasks')
        .update({
          installation_task_id: null,
          print_task_id: null,
          cutout_task_id: null,
          combined_invoice_id: null
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Now delete the composite task
      const { error: deleteError } = await supabase
        .from('composite_tasks')
        .delete()
        .eq('id', task.id);

      if (deleteError) throw deleteError;

      toast.success('تم حذف المهمة المجمعة وجميع الفواتير المرتبطة بها');
      setShowDeleteDialog(false);
      if (onDelete) onDelete();
    } catch (error) {
      console.error('Error deleting composite task:', error);
      toast.error('فشل في حذف المهمة المجمعة');
    } finally {
      setDeleting(false);
    }
  };

  // Check if task has cutouts
  const hasCutouts = task.customer_cutout_cost > 0 || task.company_cutout_cost > 0;

  // تحديد حالة الإكمال بناءً على حالة المهمة
  const isCompleted = task.status === 'completed';
  const isPartiallyCompleted = task.status === 'in_progress';

  // لا نظهر التصميم هنا لأنه يظهر في CollapsibleGroupCard
  return (
    <div className={`relative rounded-lg transition-all duration-300 ${
      isCompleted 
        ? 'ring-2 ring-green-500/50 bg-green-50/30 dark:bg-green-950/20' 
        : isPartiallyCompleted 
          ? 'ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20' 
          : ''
    }`}>
      <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-lg text-foreground">
              {task.customer_name || 'غير محدد'} - 
              {contractInfo?.contractIds && contractInfo.contractIds.length > 1 ? (
                <span> عقود #{contractInfo.contractIds.join(', #')}</span>
              ) : (
                <span> عقد #{task.contract_id}</span>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              {getTaskTypeBadge(task.task_type)}
              {getStatusBadge(task.status)}
              {contractInfo?.adTypes && contractInfo.adTypes.length > 0 && (
                contractInfo.adTypes.length === 1 ? (
                  <Badge variant="secondary" className="bg-muted">{contractInfo.adTypes[0].adType}</Badge>
                ) : (
                  contractInfo.adTypes.map((info, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs bg-muted">
                      #{info.contractId}: {info.adType}
                    </Badge>
                  ))
                )
              )}
              {task.invoice_generated && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <FileText className="h-3 w-3 mr-1" />
                  فاتورة صادرة
                </Badge>
              )}
            </div>
          </div>
          {/* المستحق على الزبون - بارز في الهيدر */}
          <div className="flex flex-col items-end gap-1">
            <div className="text-[11px] text-muted-foreground">المستحق على الزبون</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {(task.customer_total || (task.customer_installation_cost + task.customer_print_cost + task.customer_cutout_cost)).toLocaleString('ar-LY')} د.ل
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
            </div>
          </div>
        </div>

        {/* عدد صور التصميم فقط - الصور تظهر في الجانب */}
        {designImages.length > 1 && (
          <div className="pt-2">
            <Badge variant="outline" className="text-xs">
              {designImages.length} تصميم
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* المهام المرتبطة - تكلفة الزبون */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            التكاليف المحسوبة على الزبون
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* مهمة التركيب */}
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">التركيب</div>
                <div className="text-lg font-bold text-primary">
                  {task.customer_installation_cost.toLocaleString('ar-LY')} د.ل
                </div>
                {task.task_type === 'new_installation' && task.customer_installation_cost === 0 && (
                  <div className="text-xs text-muted-foreground">شامل مع العقد</div>
                )}
              </div>
            </div>

            {/* مهمة الطباعة */}
            {task.print_task_id && (
              <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                <div className="p-1.5 rounded-lg bg-accent/10">
                  <Printer className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">الطباعة</div>
                  <div className="text-lg font-bold text-accent">
                    {task.customer_print_cost.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              </div>
            )}

            {/* مهمة القص */}
            {hasCutouts && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <Scissors className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">القص</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {task.customer_cutout_cost.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* إجمالي تكلفة الزبون */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-foreground">
                إجمالي المستحق على الزبون
              </span>
              <span className="text-2xl font-bold text-primary">
                {(task.customer_total || (task.customer_installation_cost + task.customer_print_cost + task.customer_cutout_cost)).toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>
        </div>

        {/* الخصم */}
        {(task.discount_amount || 0) > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-700 dark:text-red-400">
                خصم {task.discount_reason && <span className="text-xs">({task.discount_reason})</span>}
              </span>
              <span className="font-bold text-red-600">- {(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>
        )}

        {/* تحليل الربحية - استخدام القيم المخزنة من قاعدة البيانات */}
        <CompositeProfitCard
          customerTotal={task.customer_total || 0}
          companyTotal={task.company_total || 0}
          netProfit={task.net_profit || 0}
          profitPercentage={task.profit_percentage || 0}
          taskType={task.task_type}
          companyInstallationCost={task.company_installation_cost || 0}
        />

        {/* ملاحظات */}
        {task.notes && (
          <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
            {task.notes}
          </div>
        )}

        {/* الإجراءات */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          {/* أزرار الطباعة - بارزة وواضحة */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3 border border-border/30">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
              <FileOutput className="h-4 w-4 text-primary" />
              طباعة الفواتير
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* فاتورة الزبون */}
              <Button
                variant="default"
                size="sm"
                onClick={() => openInvoice('customer')}
                className="bg-primary hover:bg-primary/90"
              >
                <FileText className="h-4 w-4 mr-2" />
                فاتورة الزبون
              </Button>
              
              {/* فاتورة المطبعة */}
              {task.print_task_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('print_vendor')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  فاتورة المطبعة
                </Button>
              )}

              {/* فاتورة القص */}
              {hasCutouts && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('cutout_vendor')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  فاتورة القص
                </Button>
              )}

              {/* فاتورة التركيب */}
              {task.installation_task_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('installation_team')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  فاتورة الفرقة
                </Button>
              )}
            </div>
          </div>

          {/* أزرار الإدارة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {onEditCosts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditCosts(task)}
              >
                <Edit className="h-4 w-4 mr-2" />
                تعديل التكاليف
              </Button>
            )}

            {task.combined_invoice_id && onViewInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInvoice(task)}
              >
                <Eye className="h-4 w-4 mr-2" />
                عرض الفاتورة
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              حذف
            </Button>
          </div>
        </div>

        {/* Unified Invoice Dialog */}
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={task}
          invoiceType={currentInvoiceType}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه المهمة المجمعة؟ هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  'حذف'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
      </Card>
    </div>
  );
};
