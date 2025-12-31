import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { Wrench, Printer, Scissors, FileText, Edit, Eye, TrendingUp, FileOutput, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeProfitCard } from './CompositeProfitCard';
import { PrintTaskInvoice } from '../tasks/PrintTaskInvoice';
import { CutoutTaskInvoice } from '../tasks/CutoutTaskInvoice';
import { CompositeTaskInvoicePrint } from './CompositeTaskInvoicePrint';
import { TaskCardWrapper } from '../tasks/TaskCardWrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [loadingCutout, setLoadingCutout] = useState(false);
  const [printTaskData, setPrintTaskData] = useState<any>(null);
  const [cutoutTaskData, setCutoutTaskData] = useState<any>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showCutoutDialog, setShowCutoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ adTypes?: { contractId: number; adType: string }[]; contractIds?: number[] } | null>(null);
  const [designImages, setDesignImages] = useState<Array<{ url: string; face: 'a' | 'b' }>>([]);

  // جلب معلومات العقود وأنواع الإعلان وصور التصميم
  useEffect(() => {
    const fetchContractInfo = async () => {
      try {
        let contractIds: number[] = [];
        
        // جلب contract_ids من مهمة التركيب إذا كانت مدمجة
        if (task.installation_task_id) {
          const { data: installTask } = await supabase
            .from('installation_tasks')
            .select('contract_ids, contract_id')
            .eq('id', task.installation_task_id)
            .single();
          
          contractIds = installTask?.contract_ids && installTask.contract_ids.length > 0 
            ? installTask.contract_ids 
            : [installTask?.contract_id || task.contract_id];
          
          // جلب أنواع الإعلان من جميع العقود
          const { data: contracts } = await supabase
            .from('Contract')
            .select('"Contract_Number", "Ad Type"')
            .in('Contract_Number', contractIds);
          
          setContractInfo({
            adTypes: contracts?.map(c => ({ 
              contractId: c.Contract_Number, 
              adType: c['Ad Type'] || 'غير محدد' 
            })) || [],
            contractIds: contractIds?.filter(Boolean) as number[]
          });
        } else {
          // جلب نوع الإعلان من العقد مباشرة
          contractIds = [task.contract_id];
          
          const { data: contract } = await supabase
            .from('Contract')
            .select('"Ad Type"')
            .eq('Contract_Number', task.contract_id)
            .single();
          
          setContractInfo({
            adTypes: [{ contractId: task.contract_id, adType: contract?.['Ad Type'] || 'غير محدد' }],
            contractIds: [task.contract_id]
          });
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

  const handlePrintPrintInvoice = async () => {
    if (!task.print_task_id) return;
    
    setLoadingPrint(true);
    try {
      // Load print task with printer info and items in parallel
      const [printTaskResult, itemsResult] = await Promise.all([
        supabase
          .from('print_tasks')
          .select(`*, printer:printers!print_tasks_printer_id_fkey(name)`)
          .eq('id', task.print_task_id)
          .single(),
        supabase
          .from('print_task_items')
          .select('*')
          .eq('task_id', task.print_task_id)
      ]);

      if (printTaskResult.error) throw printTaskResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const printTask = printTaskResult.data;
      const items = itemsResult.data || [];

      // Group items by design
      const designGroups = items.reduce((acc: any[], item: any) => {
        const faceA = item.design_face_a;
        const faceB = item.design_face_b;

        if (faceA) {
          acc.push({
            design: faceA,
            face: 'a',
            size: `${item.width}×${item.height}`,
            quantity: item.quantity,
            area: item.area,
            width: item.width,
            height: item.height,
            billboards: [item.billboard_id],
            hasCutout: item.has_cutout,
            cutoutCount: item.cutout_count || 0,
            cutoutImageUrl: item.cutout_image_url
          });
        }

        if (faceB) {
          acc.push({
            design: faceB,
            face: 'b',
            size: `${item.width}×${item.height}`,
            quantity: item.quantity,
            area: item.area,
            width: item.width,
            height: item.height,
            billboards: [item.billboard_id],
            hasCutout: item.has_cutout,
            cutoutCount: item.cutout_count || 0,
            cutoutImageUrl: item.cutout_image_url
          });
        }

        return acc;
      }, []);

      const totalArea = items.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
      
      // Load cutout task items to get accurate cutout count (not duplicated per billboard)
      let totalCutouts = 0;
      if (task.cutout_task_id) {
        const { data: cutoutItems } = await supabase
          .from('cutout_task_items')
          .select('quantity')
          .eq('task_id', task.cutout_task_id);
        
        if (cutoutItems) {
          totalCutouts = cutoutItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        }
      }

      setPrintTaskData({
        designGroups,
        pricePerMeter: totalArea > 0 ? task.company_print_cost / totalArea : 0,
        totalArea,
        totalCutouts,
        printerName: (printTask as any).printer?.name || 'غير محدد',
        cutoutPricePerUnit: totalCutouts > 0 ? task.company_cutout_cost / totalCutouts : 0,
        cutoutPrinterName: (printTask as any).cutout_printer?.name || 'غير محدد'
      });

      setShowPrintDialog(true);
    } catch (error) {
      console.error('Error loading print task:', error);
      toast.error('فشل في تحميل بيانات مهمة الطباعة');
    } finally {
      setLoadingPrint(false);
    }
  };

  const handlePrintCutoutInvoice = async () => {
    // Load cutout data from cutout_task_items table
    if (!task.cutout_task_id) {
      toast.error('لا توجد مهمة قص مرتبطة');
      return;
    }
    
    setLoadingCutout(true);
    try {
      // Load cutout task with items and printer info
      const [cutoutTaskResult, cutoutItemsResult] = await Promise.all([
        supabase
          .from('cutout_tasks')
          .select(`*, printer:printers!cutout_tasks_printer_id_fkey(name)`)
          .eq('id', task.cutout_task_id)
          .single(),
        supabase
          .from('cutout_task_items')
          .select('*')
          .eq('task_id', task.cutout_task_id)
      ]);

      if (cutoutTaskResult.error) throw cutoutTaskResult.error;
      if (cutoutItemsResult.error) throw cutoutItemsResult.error;

      const cutoutTask = cutoutTaskResult.data;
      const cutoutItems = cutoutItemsResult.data || [];

      if (cutoutItems.length === 0) {
        toast.error('لا توجد مجسمات في هذه المهمة');
        setLoadingCutout(false);
        return;
      }

      // Get design images from print_task_items if available
      let designImages: Record<number, { face_a?: string; face_b?: string }> = {};
      if (task.print_task_id) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.print_task_id);
        
        if (printItems) {
          printItems.forEach((item: any) => {
            designImages[item.billboard_id] = {
              face_a: item.design_face_a,
              face_b: item.design_face_b
            };
          });
        }
      }

      // Map cutout items with their design images
      const designGroups = cutoutItems.map((item: any) => {
        const designs = designImages[item.billboard_id] || {};
        // Extract size from description like "مجسم 10x4 - وجه أمامي"
        const sizeMatch = item.description?.match(/(\d+)x(\d+)/i);
        const width = sizeMatch ? parseInt(sizeMatch[1]) : 0;
        const height = sizeMatch ? parseInt(sizeMatch[2]) : 0;
        const isFaceA = item.description?.includes('أمامي');
        
        return {
          design: isFaceA ? designs.face_a : designs.face_b || '',
          face: isFaceA ? 'a' : 'b',
          size: `${width}×${height}`,
          quantity: item.quantity,
          area: width * height,
          width,
          height,
          billboards: [item.billboard_id],
          hasCutout: true,
          cutoutCount: item.quantity,
          cutoutImageUrl: item.cutout_image_url,
          description: item.description,
          unitCost: item.unit_cost,
          totalCost: item.total_cost
        };
      });

      const totalCutouts = cutoutTask.total_quantity || cutoutItems.reduce((sum: number, item: any) => 
        sum + item.quantity, 0);

      setCutoutTaskData({
        designGroups,
        cutoutPricePerUnit: cutoutTask.unit_cost || (totalCutouts > 0 ? task.company_cutout_cost / totalCutouts : 0),
        totalCutouts,
        totalCost: cutoutTask.total_cost || task.company_cutout_cost,
        cutoutPrinterName: (cutoutTask as any).printer?.name || 'غير محدد'
      });

      setShowCutoutDialog(true);
    } catch (error) {
      console.error('Error loading cutout task:', error);
      toast.error('فشل في تحميل بيانات مهمة القص');
    } finally {
      setLoadingCutout(false);
    }
  };

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

  // استخراج أول صورة تصميم لعرضها على الكارت المطوي
  const firstDesignImage = designImages.length > 0 ? designImages[0].url : null;
  
  // تحديد حالة الإكمال بناءً على حالة المهمة
  const isCompleted = task.status === 'completed';
  const isPartiallyCompleted = task.status === 'in_progress';

  return (
    <TaskCardWrapper
      designImage={firstDesignImage}
      isCompleted={isCompleted}
      isPartiallyCompleted={isPartiallyCompleted}
      completionPercentage={isPartiallyCompleted ? 50 : isCompleted ? 100 : 0}
    >
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
          <div className="text-left text-sm text-muted-foreground">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </div>
        </div>

        {/* صور التصميم (مثل كروت مهام التركيب) */}
        {designImages.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm font-semibold text-foreground">تصاميم اللوحات</span>
              <span className="text-xs text-muted-foreground">({designImages.length})</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {designImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => window.open(img.url, '_blank')}
                  className="group relative aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted/20 text-left"
                >
                  <img
                    src={img.url}
                    alt={`تصميم اللوحة ${img.face === 'a' ? 'الوجه الأمامي' : 'الوجه الخلفي'}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-60" />
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur"
                  >
                    {img.face === 'a' ? 'الوجه أ' : 'الوجه ب'}
                  </Badge>
                </button>
              ))}
            </div>
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

        {/* تحليل الربحية */}
        <CompositeProfitCard
          customerTotal={task.customer_total}
          companyTotal={task.company_total}
          netProfit={task.net_profit}
          profitPercentage={task.profit_percentage}
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CompositeTaskInvoicePrint task={task} />
              
              {task.print_task_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrintPrintInvoice}
                  disabled={loadingPrint}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loadingPrint ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4 mr-2" />
                  )}
                  {loadingPrint ? 'جاري التحميل...' : 'فاتورة المطبعة'}
                </Button>
              )}

              {hasCutouts && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrintCutoutInvoice}
                  disabled={loadingCutout}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {loadingCutout ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Scissors className="h-4 w-4 mr-2" />
                  )}
                  {loadingCutout ? 'جاري التحميل...' : 'فاتورة القص'}
                </Button>
              )}
            </div>
          </div>

          {/* أزرار الإدارة */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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

        {/* Print Invoice Dialog */}
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>فاتورة الطباعة للمطبعة</DialogTitle>
            </DialogHeader>
            {printTaskData && (
              <PrintTaskInvoice
                designGroups={printTaskData.designGroups}
                pricePerMeter={printTaskData.pricePerMeter}
                cutoutPricePerUnit={printTaskData.cutoutPricePerUnit}
                printerName={printTaskData.printerName}
                cutoutPrinterName={printTaskData.cutoutPrinterName}
                totalArea={printTaskData.totalArea}
                totalCutouts={printTaskData.totalCutouts}
                showPrices={true}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Cutout Invoice Dialog */}
        <Dialog open={showCutoutDialog} onOpenChange={setShowCutoutDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>فاتورة القص للمطبعة</DialogTitle>
            </DialogHeader>
            {cutoutTaskData && (
              <CutoutTaskInvoice
                designGroups={cutoutTaskData.designGroups}
                cutoutPricePerUnit={cutoutTaskData.cutoutPricePerUnit}
                totalCutouts={cutoutTaskData.totalCutouts}
                cutoutPrinterName={cutoutTaskData.cutoutPrinterName}
                showPrices={true}
              />
            )}
          </DialogContent>
        </Dialog>

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
    </TaskCardWrapper>
  );
};
