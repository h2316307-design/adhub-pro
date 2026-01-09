import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, FileText, Wrench, Scissors, Building2, EyeOff, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import {
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
} from '@/types/invoice-templates';

const UNIFIED_SETTINGS_KEY = 'unified_invoice_templates_settings';

export type InvoiceType = 'customer' | 'print_vendor' | 'cutout_vendor' | 'installation_team';

interface InvoiceItem {
  designImage?: string;
  face: 'a' | 'b';
  sizeName: string;
  width: number;
  height: number;
  quantity: number;
  area: number;
  // تكاليف منفصلة لكل خدمة
  printCost: number;
  installationCost: number;
  cutoutCost: number;
  totalCost: number;
  billboardName?: string;
}

interface UnifiedTaskInvoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CompositeTaskWithDetails;
  invoiceType: InvoiceType;
  invoiceData?: {
    items: InvoiceItem[];
    vendorName?: string;
    teamName?: string;
    pricePerMeter?: number;
    cutoutPricePerUnit?: number;
    totalArea?: number;
    totalCutouts?: number;
    totalCost?: number;
  };
}

export function UnifiedTaskInvoice({
  open,
  onOpenChange,
  task,
  invoiceType,
  invoiceData,
}: UnifiedTaskInvoiceProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shared, setShared] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individual, setIndividual] = useState<IndividualInvoiceSettings>(DEFAULT_INDIVIDUAL_SETTINGS);
  const [showCosts, setShowCosts] = useState(true);
  const [data, setData] = useState<typeof invoiceData>(invoiceData);
  const [displayMode, setDisplayMode] = useState<'detailed' | 'summary'>('detailed');
  const [contractIds, setContractIds] = useState<number[]>([task.contract_id].filter(Boolean));

  // Load settings, contracts, and data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // ✅ استنتاج العقود الفعلية من اللوحات (في حال مهمة تركيب مدموجة بين عقدين)
        if (task.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .eq('task_id', task.installation_task_id);

          const unique = new Set<number>();
          (installItems || []).forEach((row: any) => {
            const n = row.billboard?.Contract_Number;
            if (n) unique.add(Number(n));
          });

          const derived = Array.from(unique).filter(Boolean).sort((a, b) => a - b);
          setContractIds(derived.length > 0 ? derived : [task.contract_id].filter(Boolean));
        } else {
          setContractIds([task.contract_id].filter(Boolean));
        }

        // Load unified settings
        const { data: unifiedData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', UNIFIED_SETTINGS_KEY)
          .maybeSingle();

        if (unifiedData?.setting_value) {
          const allSettings: AllInvoiceSettings = JSON.parse(unifiedData.setting_value);
          if (allSettings.shared) {
            setShared({ ...DEFAULT_SHARED_SETTINGS, ...allSettings.shared });
          }
          if (allSettings.individual && allSettings.individual['sizes_invoice']) {
            setIndividual({ ...DEFAULT_INDIVIDUAL_SETTINGS, ...allSettings.individual['sizes_invoice'] });
          }
        }

        // If no data provided, load based on invoice type
        if (!invoiceData) {
          await loadInvoiceData();
        } else {
          setData(invoiceData);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open, invoiceType, task.id, task.installation_task_id, task.contract_id]);

  const loadInvoiceData = async () => {
    const items: InvoiceItem[] = [];
    let vendorName = '';
    let teamName = '';
    let pricePerMeter = 0;
    let cutoutPricePerUnit = 0;
    let totalArea = 0;
    let totalCutouts = 0;
    let totalCost = 0;

    try {
      // Load sizes map
      const { data: sizesData } = await supabase.from('sizes').select('name, width, height, installation_price, sort_order');
      const sizesMap: Record<string, { width: number; height: number; installationPrice: number; sortOrder: number }> = {};
      sizesData?.forEach((s: any) => {
        sizesMap[s.name] = { width: s.width || 0, height: s.height || 0, installationPrice: s.installation_price || 0, sortOrder: s.sort_order ?? 999 };
      });

      // جلب صور التصميم من مصادر مختلفة
      let designImages: Record<number, { face_a?: string; face_b?: string }> = {};
      
      // من print_task_items
      if (task.print_task_id) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.print_task_id);
        printItems?.forEach((item: any) => {
          if (item.billboard_id) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }
      
      // من installation_task_items
      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.installation_task_id);
        installItems?.forEach((item: any) => {
          if (item.billboard_id && !designImages[item.billboard_id]) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }

      // ===============================================
      // فواتير المطبعة والقص والتركيب - تستخدم نفس منطق فاتورة الزبون
      // لكن مع التكاليف الأساسية (company costs)
      // ===============================================
      if (invoiceType === 'print_vendor' || invoiceType === 'cutout_vendor' || invoiceType === 'installation_team') {
        // تحديد التكلفة الإجمالية حسب نوع الفاتورة
        if (invoiceType === 'print_vendor') {
          totalCost = task.company_print_cost || 0;
        } else if (invoiceType === 'cutout_vendor') {
          totalCost = task.company_cutout_cost || 0;
        }
        // ملاحظة: فاتورة التركيب ستحسب الإجمالي من جدول المقاسات لاحقاً

        // جلب اسم المورد/الفرقة
        if (invoiceType === 'print_vendor' && task.print_task_id) {
          const { data: printTask } = await supabase
            .from('print_tasks')
            .select('*, printer:printers!print_tasks_printer_id_fkey(name)')
            .eq('id', task.print_task_id)
            .single();
          vendorName = (printTask as any)?.printer?.name || 'غير محدد';
        } else if (invoiceType === 'cutout_vendor' && task.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('*, printer:printers!cutout_tasks_printer_id_fkey(name)')
            .eq('id', task.cutout_task_id)
            .single();
          vendorName = (cutoutTask as any)?.printer?.name || 'غير محدد';
        } else if (invoiceType === 'installation_team' && task.installation_task_id) {
          const { data: installTask } = await supabase
            .from('installation_tasks')
            .select('*, team:installation_teams(team_name)')
            .eq('id', task.installation_task_id)
            .single();
          teamName = (installTask as any)?.team?.team_name || 'غير محدد';
        }

        // جلب بيانات من installation_task_items (مثل فاتورة الزبون)
        if (task.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout)')
            .eq('task_id', task.installation_task_id);

          if (installItems && installItems.length > 0) {
            // حساب المساحة الكلية
            totalArea = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };
              
              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }
              
              const hasDesignA = item.design_face_a || item.billboard?.design_face_a;
              const hasDesignB = item.design_face_b || item.billboard?.design_face_b;
              const facesCount = (hasDesignA ? 1 : 0) + (hasDesignB ? 1 : 0) || 1;
              
              const areaForItem = (sizeInfo.width * sizeInfo.height) || 0;
              totalArea += areaForItem * facesCount;
            });

            // حساب سعر المتر للطباعة
            pricePerMeter = totalArea > 0 ? (task.company_print_cost || 0) / totalArea : 0;

            // حساب إجمالي أسعار التركيب من sizesMap
            let totalSizesInstallationPrice = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
              totalSizesInstallationPrice += sizeInfo.installationPrice || 0;
            });
            
            const installCostRatio = totalSizesInstallationPrice > 0 
              ? (task.company_installation_cost || 0) / totalSizesInstallationPrice 
              : 0;

            // حساب تكلفة القص
            const totalCutoutCost = task.company_cutout_cost || 0;
            let cutoutBillboardIds = new Set<number>();

            if (task.cutout_task_id && totalCutoutCost > 0) {
              const { data: cutoutItems } = await supabase
                .from('cutout_task_items')
                .select('billboard_id')
                .eq('task_id', task.cutout_task_id);

              (cutoutItems || []).forEach((ci: any) => {
                if (ci?.billboard_id != null) cutoutBillboardIds.add(Number(ci.billboard_id));
              });
            }

            if (cutoutBillboardIds.size === 0) {
              installItems
                .filter((it: any) => it.billboard?.has_cutout === true)
                .forEach((it: any) => {
                  const id = it.billboard?.ID ?? it.billboard_id;
                  if (id != null) cutoutBillboardIds.add(Number(id));
                });
            }

            const cutoutCostPerCutoutBillboard = cutoutBillboardIds.size > 0 ? totalCutoutCost / cutoutBillboardIds.size : 0;
            totalCutouts = cutoutBillboardIds.size;

            // إضافة كل عنصر
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
              
              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }
              
              const billboardId = item.billboard?.ID || item.billboard_id;
              const designs = designImages[billboardId] || {};
              
              const faceAImage = item.design_face_a || designs.face_a || item.billboard?.design_face_a;
              const faceBImage = item.design_face_b || designs.face_b || item.billboard?.design_face_b;
              const areaPerFace = sizeInfo.width * sizeInfo.height;
              const hasCutout = cutoutBillboardIds.has(Number(billboardId)) || item.billboard?.has_cutout === true;
              const facesCountForBillboard = faceBImage ? 2 : 1;
              
              // حساب التكاليف حسب نوع الفاتورة
              let printCostPerFace = 0;
              let installCostPerFace = 0;
              let cutoutCostPerFace = 0;

              if (invoiceType === 'print_vendor') {
                printCostPerFace = areaPerFace * pricePerMeter;
              } else if (invoiceType === 'installation_team') {
                // ✅ استخدام installation_price مباشرة من جدول المقاسات + التكاليف الإضافية
                const baseInstallPrice = sizeInfo.installationPrice || 0;
                const additionalCostForItem = item.additional_cost || 0;
                const facesCount = item.billboard?.Faces_Count || 2;
                
                // نصف السعر للوحات ذات وجه واحد
                let adjustedInstallPrice = baseInstallPrice;
                if (facesCount === 1) {
                  adjustedInstallPrice = baseInstallPrice / 2;
                }
                
                // إضافة التكاليف الإضافية للوحة (موزعة على الأوجه)
                installCostPerFace = (adjustedInstallPrice + additionalCostForItem) / facesCountForBillboard;
              } else if (invoiceType === 'cutout_vendor') {
                cutoutCostPerFace = hasCutout ? (cutoutCostPerCutoutBillboard / facesCountForBillboard) : 0;
              }

              const displaySizeName = hasCutout
                ? `${billboardSize || 'غير محدد'} (مجسم)`
                : (billboardSize || 'غير محدد');

              // الوجه الأمامي
              items.push({
                designImage: faceAImage,
                face: 'a',
                sizeName: displaySizeName,
                width: sizeInfo.width || 0,
                height: sizeInfo.height || 0,
                quantity: 1,
                area: areaPerFace,
                printCost: printCostPerFace,
                installationCost: installCostPerFace,
                cutoutCost: cutoutCostPerFace,
                totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFace,
                billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
              });

              // الوجه الخلفي إذا وجد
              if (faceBImage) {
                items.push({
                  designImage: faceBImage,
                  face: 'b',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: installCostPerFace,
                  cutoutCost: cutoutCostPerFace,
                  totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFace,
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                });
              }
            });

            // ترتيب حسب sort_order
            items.sort((a, b) => {
              const sortA = sizesMap[a.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              const sortB = sizesMap[b.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              if (sortA !== sortB) return sortA - sortB;
              return a.face === 'a' ? -1 : 1;
            });

            // فلترة العناصر بدون تكلفة (للقص مثلاً)
            if (invoiceType === 'cutout_vendor') {
              const filtered = items.filter(item => item.cutoutCost > 0);
              items.length = 0;
              items.push(...filtered);
            }

            // ✅ لفاتورة التركيب: حساب الإجمالي من مجموع العناصر
            if (invoiceType === 'installation_team') {
              totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
            }
          }
        }

        // Fallback: إذا لم توجد عناصر ولكن توجد تكلفة (للطباعة والقص فقط)
        if (items.length === 0 && totalCost > 0 && invoiceType !== 'installation_team') {
          const serviceName = invoiceType === 'print_vendor' ? 'خدمة الطباعة (مجمّعة)' 
            : 'خدمة القص (مجمّعة)';
          
          items.push({
            designImage: undefined,
            face: 'a',
            sizeName: serviceName,
            width: 0,
            height: 0,
            quantity: 1,
            area: invoiceType === 'print_vendor' ? 1 : 0,
            printCost: invoiceType === 'print_vendor' ? totalCost : 0,
            installationCost: 0,
            cutoutCost: invoiceType === 'cutout_vendor' ? totalCost : 0,
            totalCost: totalCost,
            billboardName: invoiceType === 'print_vendor' ? 'طباعة' : 'قص مجسمات',
          });
        }

      } else if (invoiceType === 'customer') {
        // ===============================================
        // DEBUG: تتبع بيانات المهمة
        // ===============================================
        console.log('Customer Invoice - Task Data:', {
          id: task.id,
          installation_task_id: task.installation_task_id,
          print_task_id: task.print_task_id,
          cutout_task_id: task.cutout_task_id,
          customer_print_cost: task.customer_print_cost,
          customer_installation_cost: task.customer_installation_cost,
          customer_cutout_cost: task.customer_cutout_cost,
        });

        // Customer invoice - جلب بيانات من installation_task_items للحصول على اللوحات
        if (task.installation_task_id) {
          // استخدام العلاقة الصريحة لتجنب خطأ PGRST201 - مع جلب has_cutout
          const { data: installItems, error: installError } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, design_face_a, design_face_b, has_cutout)')
            .eq('task_id', task.installation_task_id);

          console.log('Installation Items Query Result:', { installItems, installError });

          if (installItems && installItems.length > 0) {
            // حساب المساحة الكلية أولاً مع استخراج الأبعاد من نص المقاس
            totalArea = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };
              
              // إذا لم يكن المقاس موجوداً في sizesMap، استخرج الأبعاد من نص المقاس
              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }
              
              // حساب عدد الأوجه من الصور الموجودة
              const hasDesignA = item.design_face_a || item.billboard?.design_face_a;
              const hasDesignB = item.design_face_b || item.billboard?.design_face_b;
              const facesCount = (hasDesignA ? 1 : 0) + (hasDesignB ? 1 : 0) || 1;
              
              const areaForItem = (sizeInfo.width * sizeInfo.height) || 0;
              totalArea += areaForItem * facesCount;
            });
            
            pricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;

            // ✅ حساب تكلفة التركيب لكل لوحة بناءً على installation_price من جدول sizes (مثل مهمة التركيب)
            // أولاً: حساب إجمالي أسعار التركيب من sizesMap
            let totalSizesInstallationPrice = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
              totalSizesInstallationPrice += sizeInfo.installationPrice || 0;
            });
            
            // حساب نسبة التكلفة الفعلية إلى أسعار المقاسات (للتوزيع النسبي)
            const totalInstallCost = task.customer_installation_cost || 0;
            const installCostRatio = totalSizesInstallationPrice > 0 ? totalInstallCost / totalSizesInstallationPrice : 0;

            // ✅ حساب تكلفة القص فقط للوحات التي لديها عناصر قص فعلية (cutout_task_items)
            const totalCutoutCost = task.customer_cutout_cost || 0;
            let cutoutBillboardIds = new Set<number>();

            if (task.cutout_task_id && totalCutoutCost > 0) {
              const { data: cutoutItems, error: cutoutItemsError } = await supabase
                .from('cutout_task_items')
                .select('billboard_id')
                .eq('task_id', task.cutout_task_id);

              console.log('Cutout items query (customer invoice):', { cutoutItems, cutoutItemsError });

              (cutoutItems || []).forEach((ci: any) => {
                if (ci?.billboard_id != null) cutoutBillboardIds.add(Number(ci.billboard_id));
              });
            }

            // فولباك: لو لم توجد عناصر قص، استخدم has_cutout من اللوحات
            if (cutoutBillboardIds.size === 0) {
              installItems
                .filter((it: any) => it.billboard?.has_cutout === true)
                .forEach((it: any) => {
                  const id = it.billboard?.ID ?? it.billboard_id;
                  if (id != null) cutoutBillboardIds.add(Number(id));
                });
            }

            const cutoutCostPerCutoutBillboard = cutoutBillboardIds.size > 0 ? totalCutoutCost / cutoutBillboardIds.size : 0;

            console.log('Cutout calculation (customer invoice):', {
              totalCutoutCost,
              cutoutBillboards: cutoutBillboardIds.size,
              cutoutCostPerCutoutBillboard,
            });

            // إضافة كل عنصر كصف في الفاتورة
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
              
              // إذا لم يكن المقاس موجوداً في sizesMap، استخرج الأبعاد من نص المقاس
              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }
              
              const billboardId = item.billboard?.ID || item.billboard_id;
              const designs = designImages[billboardId] || {};
              
              const faceAImage = item.design_face_a || designs.face_a || item.billboard?.design_face_a;
              const faceBImage = item.design_face_b || designs.face_b || item.billboard?.design_face_b;
              const areaPerFace = sizeInfo.width * sizeInfo.height;
              
              // ✅ تحديد إذا كانت اللوحة بها مجسم (يعتمد على عناصر القص الفعلية أو علامة has_cutout)
              const hasCutout = cutoutBillboardIds.has(Number(billboardId)) || item.billboard?.has_cutout === true;

              // ✅ توزيع تكلفة القص على الأوجه (حتى تظهر للوجهين بدون مضاعفة الإجمالي)
              const facesCountForBillboard = faceBImage ? 2 : 1;
              const cutoutCostPerFaceForBillboard = hasCutout ? (cutoutCostPerCutoutBillboard / facesCountForBillboard) : 0;

              // حساب تكلفة الطباعة لهذا العنصر
              const printCostPerFace = areaPerFace * pricePerMeter;

              // ✅ حساب تكلفة التركيب بناءً على installation_price من المقاس (موزعة نسبياً)
              const baseInstallPrice = sizeInfo.installationPrice || 0;
              const itemInstallCost = baseInstallPrice * installCostRatio;
              
              // ✅ توزيع تكلفة التركيب على الأوجه - كل وجه يأخذ نصيبه
              const installCostPerFace = itemInstallCost / facesCountForBillboard;

              // ✅ إنشاء اسم المقاس مع إضافة "مجسم" إذا كانت اللوحة بها مجسم
              const displaySizeName = hasCutout
                ? `${billboardSize || 'غير محدد'} (مجسم)`
                : (billboardSize || 'غير محدد');

              // دائماً أضف العنصر الأول (الوجه الأمامي)
              items.push({
                designImage: faceAImage,
                face: 'a',
                sizeName: displaySizeName,
                width: sizeInfo.width || 0,
                height: sizeInfo.height || 0,
                quantity: 1,
                area: areaPerFace,
                printCost: printCostPerFace,
                installationCost: installCostPerFace,
                cutoutCost: cutoutCostPerFaceForBillboard,
                totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFaceForBillboard,
                billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
              });

              // إضافة الوجه الثاني إذا كان موجوداً - مع نفس تكلفة التركيب للوجه
              if (faceBImage) {
                items.push({
                  designImage: faceBImage,
                  face: 'b',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: installCostPerFace, // ✅ نفس تكلفة الوجه الأمامي
                  cutoutCost: cutoutCostPerFaceForBillboard,
                  totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFaceForBillboard,
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                });
              }
            });

            // ✅ ترتيب العناصر حسب sort_order من إعدادات المقاسات
            items.sort((a, b) => {
              const sortA = sizesMap[a.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              const sortB = sizesMap[b.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              if (sortA !== sortB) return sortA - sortB;
              // ترتيب ثانوي: الوجه A قبل B
              return a.face === 'a' ? -1 : 1;
            });

            console.log('Generated Invoice Items:', items);
          }
        } else if (task.print_task_id) {
          // فولباك: من print_task_items
          const { data: printItems } = await supabase
            .from('print_task_items')
            .select('*')
            .eq('task_id', task.print_task_id);

          totalArea = printItems?.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0) || 0;
          pricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;

          printItems?.forEach((item: any) => {
            const itemPrintCost = item.area * item.quantity * pricePerMeter;
            if (item.design_face_a) {
              items.push({
                designImage: item.design_face_a,
                face: 'a',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                printCost: itemPrintCost,
                installationCost: 0,
                cutoutCost: 0,
                totalCost: itemPrintCost,
              });
            }
            if (item.design_face_b) {
              items.push({
                designImage: item.design_face_b,
                face: 'b',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                printCost: itemPrintCost,
                installationCost: 0,
                cutoutCost: 0,
                totalCost: itemPrintCost,
              });
            }
          });
        }

        // Load cutout data
        if (task.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('total_quantity')
            .eq('id', task.cutout_task_id)
            .single();
          totalCutouts = cutoutTask?.total_quantity || 0;
          cutoutPricePerUnit = totalCutouts > 0 ? (task.customer_cutout_cost || 0) / totalCutouts : 0;
        }

        totalCost = task.customer_total || 0;

        // ===============================================
        // CRITICAL: Virtual Items Fallback للفواتير الفارغة
        // إذا لم توجد عناصر حقيقية ولكن توجد تكاليف، ننشئ عناصر افتراضية
        // ===============================================
        if (items.length === 0 && invoiceType === 'customer') {
          const hasPrintCost = (task.customer_print_cost || 0) > 0;
          const hasInstallCost = (task.customer_installation_cost || 0) > 0;
          const hasCutoutCost = (task.customer_cutout_cost || 0) > 0;

          if (hasPrintCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة الطباعة (مجمّعة)',
              width: 0,
              height: 0,
              quantity: 1,
              area: totalArea || 1,
              printCost: task.customer_print_cost || 0,
              installationCost: 0,
              cutoutCost: 0,
              totalCost: task.customer_print_cost || 0,
              billboardName: 'طباعة',
            });
          }

          if (hasInstallCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة التركيب (مجمّعة)',
              width: 0,
              height: 0,
              quantity: 1,
              area: 0,
              printCost: 0,
              installationCost: task.customer_installation_cost || 0,
              cutoutCost: 0,
              totalCost: task.customer_installation_cost || 0,
              billboardName: 'تركيب',
            });
          }

          if (hasCutoutCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة القص (مجمّعة)',
              width: 0,
              height: 0,
              quantity: totalCutouts || 1,
              area: 0,
              printCost: 0,
              installationCost: 0,
              cutoutCost: task.customer_cutout_cost || 0,
              totalCost: task.customer_cutout_cost || 0,
              billboardName: 'قص مجسمات',
            });
          }
        }
      }

      setData({
        items,
        vendorName,
        teamName,
        pricePerMeter,
        cutoutPricePerUnit,
        totalArea,
        totalCutouts,
        totalCost,
      });
    } catch (error) {
      console.error('Error loading invoice data:', error);
      toast.error('فشل في تحميل بيانات الفاتورة');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    const fontFamily = shared.fontFamily || 'Doran';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${getInvoiceTitle()}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; background: #fff; }
          
          .print-container {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            background: #fff;
          }
          
          @media print {
            @page { size: A4; margin: 15mm; }
            .print-container { width: 100%; min-height: auto; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${printContent}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 800);
  };

  const getInvoiceTitle = () => {
    const contractLabel = contractIds.length > 1
      ? `عقود #${contractIds.join(', #')}`
      : `عقد #${contractIds[0] ?? ''}`;

    const customerName = task.customer_name || '';
    const invoiceDate = format(new Date(), 'yyyy-MM-dd');
    const facesCount = data?.items?.length || 0;
    const totalCost = data?.totalCost || task.customer_total || 0;

    // بناء عنوان الفاتورة بناءً على الخدمات المتوفرة فعلياً
    const services: string[] = [];
    if (task.print_task_id || (task.customer_print_cost && task.customer_print_cost > 0)) services.push('طباعة');
    if (task.cutout_task_id || (task.customer_cutout_cost && task.customer_cutout_cost > 0)) services.push('قص');
    if (task.installation_task_id || (task.customer_installation_cost && task.customer_installation_cost > 0)) services.push('تركيب');

    const servicesText = services.length > 0 ? services.join(' و') : 'خدمات';

    let recipientName = customerName;
    if (invoiceType === 'print_vendor' || invoiceType === 'cutout_vendor') {
      recipientName = data?.vendorName || 'المطبعة';
    } else if (invoiceType === 'installation_team') {
      recipientName = data?.teamName || 'الفرقة';
    }

    return `فاتورة ${servicesText} | ${recipientName} | ${contractLabel} | ${invoiceDate} | ${facesCount} وجه | ${totalCost.toLocaleString()} د.ل`;
  };

  const getInvoiceIcon = () => {
    switch (invoiceType) {
      case 'customer': return <FileText className="h-5 w-5 text-primary" />;
      case 'print_vendor': return <Printer className="h-5 w-5 text-blue-600" />;
      case 'cutout_vendor': return <Scissors className="h-5 w-5 text-purple-600" />;
      case 'installation_team': return <Wrench className="h-5 w-5 text-green-600" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getRecipientInfo = () => {
    switch (invoiceType) {
      case 'customer':
        return { label: 'العميل', name: task.customer_name || 'غير محدد' };
      case 'print_vendor':
        return { label: 'المطبعة', name: data?.vendorName || 'غير محدد' };
      case 'cutout_vendor':
        return { label: 'ورشة القص', name: data?.vendorName || 'غير محدد' };
      case 'installation_team':
        return { label: 'فرقة التركيب', name: data?.teamName || 'غير محدد' };
      default:
        return { label: 'المستلم', name: 'غير محدد' };
    }
  };

  const primaryColor = individual.primaryColor || '#D4AF37';
  const secondaryColor = individual.secondaryColor || '#1a1a2e';
  const tableHeaderBg = individual.tableHeaderBgColor || '#D4AF37';
  const tableHeaderText = individual.tableHeaderTextColor || '#ffffff';
  const tableBorder = individual.tableBorderColor || '#D4AF37';
  const tableRowEven = individual.tableRowEvenColor || '#f8f9fa';
  const tableRowOdd = individual.tableRowOddColor || '#ffffff';
  const tableText = individual.tableTextColor || '#333333';
  const totalBg = individual.totalBgColor || '#D4AF37';
  const totalText = individual.totalTextColor || '#ffffff';

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const recipient = getRecipientInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0">
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {getInvoiceIcon()}
              </div>
              <div>
                <DialogTitle className="text-lg">{getInvoiceTitle()}</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>
                    {contractIds.length > 1 ? `فاتورة عقود رقم ${contractIds.join(', ')}` : `فاتورة عقد رقم ${contractIds[0] ?? ''}`}
                  </DialogDescription>
                </VisuallyHidden>
                <p className="text-sm text-muted-foreground">
                  {contractIds.length > 1 ? `عقود #${contractIds.join(', #')}` : `عقد #${contractIds[0] ?? ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* زر التبديل بين العرض التفصيلي والمجمّع - لفاتورة الزبون فقط */}
              {invoiceType === 'customer' && (
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                  <Button
                    variant={displayMode === 'detailed' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('detailed')}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    تفصيلي
                  </Button>
                  <Button
                    variant={displayMode === 'summary' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('summary')}
                    className="gap-1"
                  >
                    <EyeOff className="h-4 w-4" />
                    مجمّع
                  </Button>
                </div>
              )}
              {invoiceType !== 'customer' && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="showCosts"
                    checked={showCosts}
                    onCheckedChange={setShowCosts}
                  />
                  <Label htmlFor="showCosts" className="text-sm cursor-pointer flex items-center gap-1">
                    {showCosts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showCosts ? 'إظهار التكلفة' : 'إخفاء التكلفة'}
                  </Label>
                </div>
              )}
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(95vh-80px)]">
          <div className="p-6 flex justify-center bg-muted/30">
            <div
              ref={printRef}
              className="bg-white shadow-2xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
                backgroundColor: '#fff',
                fontFamily: `${shared.fontFamily || 'Doran'}, 'Noto Sans Arabic', Arial, sans-serif`,
                padding: '15mm',
                direction: 'rtl',
                color: tableText,
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '3px solid #1a1a1a',
              }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}>
                    {invoiceType === 'customer' ? (() => {
                      const hasPrint = (task.customer_print_cost || 0) > 0;
                      const hasInstall = (task.customer_installation_cost || 0) > 0;
                      const hasCutout = (task.customer_cutout_cost || 0) > 0;
                      const parts: string[] = [];
                      if (hasPrint) parts.push('طباعة');
                      if (hasInstall) parts.push('تركيب');
                      if (hasCutout) parts.push('قص');
                      return parts.length > 0 ? `فاتورة ${parts.join(' و ')}` : 'فاتورة';
                    })() : 
                     invoiceType === 'print_vendor' ? 'فاتورة طباعة' :
                     invoiceType === 'cutout_vendor' ? 'فاتورة قص مجسمات' : 'فاتورة تركيب'}
                  </h1>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.8 }}>
                    <div>التاريخ: {format(new Date(task.created_at), 'dd MMMM yyyy', { locale: ar })}</div>
                    <div>رقم العقد: #{task.contract_id}</div>
                  </div>
                </div>

                {shared.showLogo && shared.logoPath && (
                  <img
                    src={shared.logoPath}
                    alt="Logo"
                    style={{ height: '100px', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Recipient Info */}
              <div style={{
                background: 'linear-gradient(135deg, #f5f5f5, #ffffff)',
                padding: '20px',
                marginBottom: '24px',
                borderRadius: '12px',
                borderRight: '5px solid #1a1a1a',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{recipient.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a' }}>{recipient.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    {invoiceType === 'print_vendor' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {(data?.totalArea || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>م² إجمالي</div>
                      </div>
                    )}
                    {invoiceType === 'cutout_vendor' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {data?.totalCutouts || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>مجسم</div>
                      </div>
                    )}
                    {invoiceType === 'installation_team' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {data?.items?.length || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>لوحة</div>
                      </div>
                    )}
                    {showCosts && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {(data?.totalCost || 0).toLocaleString('ar-LY')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>د.ل</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ ملخص المقاسات والمجسمات - لجميع أنواع الفواتير */}
              {data?.items && data.items.length > 0 && (() => {
                // حساب عدد الأوجه لكل مقاس
                const sizeCounts: Record<string, number> = {};
                let totalCutouts = 0;
                
                data.items.forEach(item => {
                  // إزالة "(مجسم)" من اسم المقاس للتجميع
                  const baseSizeName = item.sizeName.replace(' (مجسم)', '');
                  sizeCounts[baseSizeName] = (sizeCounts[baseSizeName] || 0) + 1;
                  
                  // حساب المجسمات (فقط للوجه الأول لتجنب العد المزدوج)
                  if (item.sizeName.includes('(مجسم)') && item.face === 'a') {
                    totalCutouts++;
                  }
                });

                return (
                  <div style={{
                    background: '#f8f9fa',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#495057' }}>ملخص:</span>
                      {Object.entries(sizeCounts).map(([size, count]) => (
                        <span key={size} style={{
                          background: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#333',
                          border: '1px solid #dee2e6',
                        }}>
                          {count} وجه - {size}
                        </span>
                      ))}
                      {totalCutouts > 0 && (
                        <span style={{
                          background: '#fff3cd',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#856404',
                          border: '1px solid #ffc107',
                          fontWeight: 'bold',
                        }}>
                          🔷 {totalCutouts} مجسم
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Items Table - يظهر فقط في العرض التفصيلي أو لغير فواتير الزبون */}
              {(displayMode === 'detailed' || invoiceType !== 'customer') && (() => {
                // حساب الأعمدة المتوفرة
                const hasPrintCost = (task.customer_print_cost || 0) > 0;
                const hasInstallCost = (task.customer_installation_cost || 0) > 0;
                const hasCutoutCost = (task.customer_cutout_cost || 0) > 0;
                const totalArea = data?.items?.reduce((sum, item) => sum + (item.area || 0), 0) || 0;
                const pricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;
                
                return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a1a' }}>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '5%' }}>#</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '12%' }}>التصميم</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>اللوحة</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المقاس</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المساحة</th>
                      {/* أعمدة التكاليف المنفصلة لفاتورة الزبون - تظهر فقط إذا كانت غير فارغة */}
                      {invoiceType === 'customer' && showCosts && (
                        <>
                          {hasPrintCost && (
                            <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>
                              الطباعة
                              <div style={{ fontSize: '8px', opacity: 0.8 }}>({pricePerMeter.toFixed(2)} د.ل/م²)</div>
                            </th>
                          )}
                          {hasInstallCost && (
                            <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>التركيب</th>
                          )}
                          {hasCutoutCost && (
                            <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>القص</th>
                          )}
                          <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>الإجمالي</th>
                        </>
                      )}
                      {/* عمود السعر لغير فواتير الزبون */}
                      {invoiceType !== 'customer' && showCosts && (
                        <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>الإجمالي</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items?.map((item, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f5f5f5' : '#ffffff' }}>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '0', border: '1px solid #ccc', textAlign: 'center' }}>
                          {item.designImage ? (
                            <img
                              src={item.designImage}
                              alt="تصميم"
                              style={{ width: '100%', height: '55px', objectFit: 'contain', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span style={{ color: '#999', fontSize: '9px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                          {item.billboardName || '-'}
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold' }}>{item.sizeName}</div>
                          <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                            {item.face === 'a' ? 'أمامي' : 'خلفي'}
                          </div>
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope' }}>
                          {item.area.toFixed(2)} م²
                        </td>
                        {/* أعمدة التكاليف المنفصلة لفاتورة الزبون */}
                        {invoiceType === 'customer' && showCosts && (
                          <>
                            {hasPrintCost && (
                              <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a' }}>
                                {item.printCost > 0 ? `${item.printCost.toFixed(0)} د.ل` : '-'}
                              </td>
                            )}
                            {hasInstallCost && (
                              <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a' }}>
                                {item.installationCost > 0 ? `${item.installationCost.toFixed(0)} د.ل` : '-'}
                              </td>
                            )}
                            {hasCutoutCost && (
                              <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a' }}>
                                {item.cutoutCost > 0 ? `${item.cutoutCost.toFixed(0)} د.ل` : '-'}
                              </td>
                            )}
                            <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', backgroundColor: '#e5e5e5' }}>
                              {item.totalCost.toFixed(0)} د.ل
                            </td>
                          </>
                        )}
                        {/* عمود الإجمالي لغير فواتير الزبون */}
                        {invoiceType !== 'customer' && showCosts && (
                          <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a' }}>
                            {item.totalCost.toFixed(2)} د.ل
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {/* صف الإجمالي */}
                  {invoiceType === 'customer' && showCosts && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                        <td colSpan={5} style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff' }}>
                          الإجمالي
                        </td>
                        {hasPrintCost && (
                          <td style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff' }}>
                            {(task.customer_print_cost || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        {hasInstallCost && (
                          <td style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff' }}>
                            {(task.customer_installation_cost || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        {hasCutoutCost && (
                          <td style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff' }}>
                            {(task.customer_cutout_cost || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        <td style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000' }}>
                          {(task.customer_total || 0).toFixed(0)} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                );
              })()}

              {/* Summary View - العرض المجمّع لفاتورة الزبون - جدول مع عمود تكلفة واحد */}
              {displayMode === 'summary' && invoiceType === 'customer' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a1a' }}>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '5%' }}>#</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '15%' }}>التصميم</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>اللوحة</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المقاس</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المساحة</th>
                      <th style={{ padding: '10px 6px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '15%' }}>التكلفة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items?.map((item, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f5f5f5' : '#ffffff' }}>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '0', border: '1px solid #ccc', textAlign: 'center' }}>
                          {item.designImage ? (
                            <img
                              src={item.designImage}
                              alt="تصميم"
                              style={{ width: '100%', height: '55px', objectFit: 'contain', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span style={{ color: '#999', fontSize: '9px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                          {item.billboardName || '-'}
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold' }}>{item.sizeName}</div>
                          <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                            {item.face === 'a' ? 'أمامي' : 'خلفي'}
                          </div>
                          {/* ✅ إظهار شارة مجسم إذا كان العنصر يحتوي على تكلفة قص */}
                          {item.cutoutCost > 0 && (
                            <div style={{ 
                              fontSize: '9px', 
                              color: '#9333ea', 
                              fontWeight: 'bold',
                              marginTop: '3px',
                              padding: '2px 6px',
                              backgroundColor: '#f3e8ff',
                              borderRadius: '4px',
                              display: 'inline-block'
                            }}>
                              🔷 مجسم
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope' }}>
                          {item.area.toFixed(2)} م²
                        </td>
                        <td style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', backgroundColor: '#e5e5e5' }}>
                          {item.totalCost.toFixed(0)} د.ل
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                      <td colSpan={5} style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff' }}>
                        الإجمالي المطلوب
                      </td>
                      <td style={{ padding: '12px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000' }}>
                        {(task.customer_total || 0).toFixed(0)} د.ل
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* Total Section - يظهر فقط في العرض التفصيلي */}
              {showCosts && displayMode === 'detailed' && (
                <div style={{
                  background: 'linear-gradient(135deg, #1a1a1a, #000)',
                  padding: '20px',
                  textAlign: 'center',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '14px', color: '#fff', opacity: 0.9, marginBottom: '6px' }}>
                    الإجمالي المستحق
                  </div>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#fff',
                    fontFamily: 'Manrope',
                  }}>
                    {(data?.totalCost || 0).toLocaleString('ar-LY')}
                    <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{
                marginTop: '30px',
                paddingTop: '15px',
                borderTop: `1px solid ${tableBorder}`,
                textAlign: 'center',
                fontSize: '10px',
                color: '#666',
              }}>
                {shared.footerText || 'شكراً لتعاملكم معنا'}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
