import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, FileText, Wrench, Scissors, EyeOff, Eye } from 'lucide-react';
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
  designImageB?: string; // تصميم الوجه الخلفي للتجميع
  face: 'a' | 'b' | 'both'; // إضافة 'both' للتجميع
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
  // بيانات جديدة
  billboardImage?: string; // صورة اللوحة
  nearestLandmark?: string; // أقرب نقطة دالة
  district?: string; // المنطقة
  city?: string; // المدينة
  facesCount?: number; // عدد الأوجه للتجميع
  // بيانات تفصيلية للسعر
  installationPricePerPiece?: number; // سعر التركيب للقطعة
  installationPricePerMeter?: number; // سعر التركيب للمتر
  installationCalculationType?: 'piece' | 'meter'; // طريقة حساب التركيب
  billboardId?: number; // معرف اللوحة للتجميع
  billboardType?: string; // نوع اللوحة (برجية عادية، تيبول، إلخ)
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
  const [showPriceDetails, setShowPriceDetails] = useState(true); // إظهار/إخفاء تفاصيل السعر
  const [data, setData] = useState<typeof invoiceData>(invoiceData);
  const [displayMode, setDisplayMode] = useState<'detailed' | 'summary'>('detailed');
  const [separateFaces, setSeparateFaces] = useState(true); // فصل الأوجه إلى صفين منفصلين
  const [contractIds, setContractIds] = useState<number[]>([task.contract_id].filter(Boolean));
  const [showSignatureSection, setShowSignatureSection] = useState(true); // إظهار/إخفاء الختم والتوقيع
  const [showInstalledImages, setShowInstalledImages] = useState(false); // إظهار صور التركيب بدل الصورة الافتراضية
  const [showBackFaceImages, setShowBackFaceImages] = useState(false); // إظهار صور الوجه الخلفي أيضاً
  const [installedImagesMap, setInstalledImagesMap] = useState<Record<number, { face_a?: string; face_b?: string }>>({}); // خريطة صور التركيب

  // Load settings, contracts, and data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // ✅ استنتاج العقود الفعلية من اللوحات (في حال مهمة تركيب مدموجة بين عقدين)
        // وجلب صور التركيب أيضاً
        if (task.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .eq('task_id', task.installation_task_id);

          const unique = new Set<number>();
          const installedImages: Record<number, { face_a?: string; face_b?: string }> = {};
          
          (installItems || []).forEach((row: any) => {
            const n = row.billboard?.Contract_Number;
            if (n) unique.add(Number(n));
            
            // جلب صور التركيب
            if (row.billboard_id) {
              installedImages[row.billboard_id] = {
                face_a: row.installed_image_face_a_url || undefined,
                face_b: row.installed_image_face_b_url || undefined,
              };
            }
          });

          setInstalledImagesMap(installedImages);
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
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark)')
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
              const faceBImageRaw = item.design_face_b || designs.face_b || item.billboard?.design_face_b;

              // ✅ جلب عدد الأوجه الفعلي من بيانات اللوحة (المصدر الوحيد لتحديد rowSpan وعدد الصفوف)
              // ملاحظة: قد تكون هناك صورة/تصميم للوجه الخلفي محفوظة، لكن إذا كانت اللوحة وجه واحد فلا يجب إنشاء صف ثاني.
              const actualFacesCount = item.billboard?.Faces_Count || 1;
              const hasBackFace = actualFacesCount >= 2;
              const faceBImage = hasBackFace ? faceBImageRaw : undefined;

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

              // ✅ الوجه الخلفي: يتم إنشاؤه إذا كانت اللوحة ذات وجهين (Faces_Count >= 2)
              // حتى لو لم يكن هناك تصميم للوجه الخلفي - لضمان صحة rowSpan في الجدول
              if (hasBackFace) {
                items.push({
                  designImage: faceBImage || undefined,
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
          // استخدام العلاقة الصريحة لتجنب خطأ PGRST201 - مع جلب has_cutout وبيانات اللوحة + بيانات التسعير
          const { data: installItems, error: installError } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark, District, City, billboard_type)')
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
              const faceBImageRaw = item.design_face_b || designs.face_b || item.billboard?.design_face_b;

              // ✅ عدد الأوجه الفعلي من بيانات اللوحة
              const actualFacesCount = item.billboard?.Faces_Count || 1;
              const hasBackFace = actualFacesCount >= 2;
              const faceBImage = hasBackFace ? faceBImageRaw : undefined;

              const areaPerFace = sizeInfo.width * sizeInfo.height;
              
              // ✅ تحديد إذا كانت اللوحة بها مجسم (يعتمد على عناصر القص الفعلية أو علامة has_cutout)
              const hasCutout = cutoutBillboardIds.has(Number(billboardId)) || item.billboard?.has_cutout === true;

              // ✅ توزيع تكلفة القص على الأوجه (حتى تظهر للوجهين بدون مضاعفة الإجمالي)
              // يعتمد على عدد الأوجه الفعلي من بيانات اللوحة، وليس على وجود التصميم.
              const facesCountForBillboard = hasBackFace ? 2 : 1;
              const cutoutCostPerFaceForBillboard = hasCutout ? (cutoutCostPerCutoutBillboard / facesCountForBillboard) : 0;

              // حساب تكلفة الطباعة لهذا العنصر
              const printCostPerFace = areaPerFace * pricePerMeter;

              // ✅ جلب صورة اللوحة وأقرب نقطة دالة والمنطقة والمدينة ونوع اللوحة
              const billboardImage = item.billboard?.Image_URL || '';
              const nearestLandmark = item.billboard?.Nearest_Landmark || '';
              const district = item.billboard?.District || '';
              const city = item.billboard?.City || '';
              const billboardType = item.billboard?.billboard_type || '';

              // ✅ قراءة طريقة الحساب الفعلية من installation_task_items
              const itemPricingType = item.pricing_type || 'piece';
              const itemPricePerMeter = item.price_per_meter || 0;
              const itemCustomerInstallationCost = item.customer_installation_cost || 0;
              
              // ✅ تحديد طريقة حساب التركيب (بالقطعة أم بالمتر) من البيانات الفعلية
              const isInstallByMeter = itemPricingType === 'meter' && itemPricePerMeter > 0;
              
              // ✅ حساب المساحة الكلية للوحة (لكلا الوجهين)
              const totalBillboardArea = areaPerFace * facesCountForBillboard;
              
              // ✅ حساب التكلفة بناءً على طريقة الحساب المختارة
              let actualItemInstallCost: number;
              if (isInstallByMeter) {
                // ✅ حساب بالمتر: السعر لكل متر × المساحة الكلية
                actualItemInstallCost = itemPricePerMeter * totalBillboardArea;
                console.log(`📐 حساب بالمتر للوحة ${billboardId}: ${itemPricePerMeter} د.ل/م² × ${totalBillboardArea.toFixed(2)} م² = ${actualItemInstallCost.toFixed(2)} د.ل`);
              } else if (itemCustomerInstallationCost > 0) {
                // استخدام التكلفة المخزنة مباشرة إذا كانت موجودة
                actualItemInstallCost = itemCustomerInstallationCost;
              } else {
                // فولباك: الحساب التناسبي القديم
                const baseInstallPrice = sizeInfo.installationPrice || 0;
                actualItemInstallCost = baseInstallPrice * installCostRatio;
              }
              
              // ✅ توزيع تكلفة التركيب على الأوجه - كل وجه يأخذ نصيبه
              const installCostPerFace = actualItemInstallCost / facesCountForBillboard;

              // ✅ إنشاء اسم المقاس مع إضافة "مجسم" إذا كانت اللوحة بها مجسم
              const displaySizeName = hasCutout
                ? `${billboardSize || 'غير محدد'} (مجسم)`
                : (billboardSize || 'غير محدد');

              const installPricePerPieceValue = !isInstallByMeter ? actualItemInstallCost : undefined;
              const installPricePerMeterValue = isInstallByMeter ? itemPricePerMeter : undefined;
              const installCalculationType = isInstallByMeter ? 'meter' : 'piece';

              // ✅ دائماً إنشاء صفين منفصلين للوجه الأمامي والخلفي
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
                cutoutCost: hasCutout ? cutoutCostPerCutoutBillboard / facesCountForBillboard : 0,
                totalCost: printCostPerFace + installCostPerFace + (hasCutout ? cutoutCostPerCutoutBillboard / facesCountForBillboard : 0),
                billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                billboardImage,
                nearestLandmark,
                district,
                city,
                facesCount: actualFacesCount,
                billboardId,
                installationPricePerPiece: installPricePerPieceValue,
                installationPricePerMeter: installPricePerMeterValue,
                installationCalculationType: installCalculationType,
                billboardType,
              });

              // ✅ الوجه الخلفي: يتم إنشاؤه إذا كانت اللوحة ذات وجهين (Faces_Count >= 2)
              // حتى لو لم يكن هناك تصميم للوجه الخلفي - لضمان صحة rowSpan في الجدول
              if (hasBackFace) {
                items.push({
                  designImage: faceBImage || undefined, // قد يكون null إذا لم يوجد تصميم
                  designImageB: undefined,
                  face: 'b',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: installCostPerFace,
                  cutoutCost: hasCutout ? cutoutCostPerCutoutBillboard / facesCountForBillboard : 0,
                  totalCost: printCostPerFace + installCostPerFace + (hasCutout ? cutoutCostPerCutoutBillboard / facesCountForBillboard : 0),
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                  billboardImage,
                  nearestLandmark,
                  district,
                  city,
                  facesCount: actualFacesCount,
                  billboardId,
                  installationPricePerPiece: installPricePerPieceValue,
                  installationPricePerMeter: installPricePerMeterValue,
                  installationCalculationType: installCalculationType,
                  billboardType,
                });
              }
            });

            // ✅ ترتيب العناصر حسب sort_order من إعدادات المقاسات ثم حسب معرف اللوحة
            items.sort((a, b) => {
              const sortA = sizesMap[a.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              const sortB = sizesMap[b.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              if (sortA !== sortB) return sortA - sortB;
              // ترتيب اللوحات ذات نفس المقاس حسب معرف اللوحة
              if (a.billboardId && b.billboardId && a.billboardId !== b.billboardId) {
                return a.billboardId - b.billboardId;
              }
              // الوجه الأمامي قبل الخلفي
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

        // ✅ حساب الإجمالي الفعلي من مجموع تكاليف العناصر (بدلاً من القيمة المخزنة)
        // هذا يضمن دقة الإجمالي حتى لو كانت طريقة الحساب مختلفة (بالمتر/بالقطعة)
        if (items.length > 0) {
          totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
          console.log(`✅ إجمالي فاتورة الزبون المحسوب: ${totalCost.toFixed(2)} د.ل (من ${items.length} عناصر)`);
        } else {
          // فولباك: استخدام القيمة المخزنة إذا لم توجد عناصر
          totalCost = task.customer_total || 0;
        }

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
    // الحصول على اسم الشركة من بيانات العميل المحملة
    const companyName = task.customer?.company;
    const customerName = task.customer?.name || task.customer_name;
    
    // Debug log
    console.log('Task customer data:', { 
      customer: task.customer, 
      customer_name: task.customer_name,
      companyName,
      customerName 
    });
    
    switch (invoiceType) {
      case 'customer':
        // إظهار اسم الشركة أولاً، ثم اسم الزبون كـ fallback
        return { label: 'الشركة', name: companyName || customerName || 'غير محدد' };
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

  // ✅ تعريف متغيرات حساب الأعمدة على مستوى المكون
  const hasPrintCost = (task.customer_print_cost || 0) > 0;
  const hasInstallCost = (task.customer_installation_cost || 0) > 0;
  const hasCutoutCost = (task.customer_cutout_cost || 0) > 0;
  
  // ✅ حساب الإجمالي الديناميكي بناءً على الأعمدة المرئية فقط
  const calculateDynamicTotal = () => {
    return data?.items?.reduce((sum, item) => sum + 
      (hasPrintCost ? (item.printCost || 0) : 0) + 
      (hasInstallCost ? (item.installationCost || 0) : 0) + 
      (hasCutoutCost ? (item.cutoutCost || 0) : 0), 0) || 0;
  };
  const dynamicTotal = calculateDynamicTotal();

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
                <>
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
                  {/* زر إظهار/إخفاء تفاصيل السعر */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showPriceDetails"
                      checked={showPriceDetails}
                      onCheckedChange={setShowPriceDetails}
                    />
                    <Label htmlFor="showPriceDetails" className="text-sm cursor-pointer">
                      تفاصيل السعر
                    </Label>
                  </div>
                  {/* زر إظهار صور التركيب */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showInstalledImages"
                      checked={showInstalledImages}
                      onCheckedChange={setShowInstalledImages}
                    />
                    <Label htmlFor="showInstalledImages" className="text-sm cursor-pointer">
                      صور التركيب
                    </Label>
                  </div>
                  {/* زر إظهار صور الوجه الخلفي */}
                  {showInstalledImages && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showBackFaceImages"
                        checked={showBackFaceImages}
                        onCheckedChange={setShowBackFaceImages}
                      />
                      <Label htmlFor="showBackFaceImages" className="text-sm cursor-pointer">
                        الوجه الخلفي
                      </Label>
                    </div>
                  )}
                  {/* زر إظهار/إخفاء الختم والتوقيع */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showSignatureSection"
                      checked={showSignatureSection}
                      onCheckedChange={setShowSignatureSection}
                    />
                    <Label htmlFor="showSignatureSection" className="text-sm cursor-pointer">
                      الختم والتوقيع
                    </Label>
                  </div>
                </>
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
                    <div>
                      {contractIds.length > 1 
                        ? `أرقام العقود: ${contractIds.map(id => `#${id}`).join(', ')}`
                        : `رقم العقد: #${contractIds[0] ?? task.contract_id ?? ''}`
                      }
                    </div>
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
                  </div>
                </div>
              </div>

              {/* ✅ ملخص المقاسات والمجسمات - لجميع أنواع الفواتير */}
              {data?.items && data.items.length > 0 && (() => {
                // حساب عدد اللوحات لكل مقاس (مع احتساب الأوجه)
                // لأن كل وجه الآن في صف منفصل، نجمع حسب billboardId
                const billboardsSeen = new Set<number>();
                const sizeCounts: Record<string, { billboards: number; faces: number }> = {};
                let totalCutouts = 0;
                const cutoutBillboardsSeen = new Set<number>();
                
                data.items.forEach(item => {
                  const baseSizeName = item.sizeName.replace(' (مجسم)', '');
                  if (!sizeCounts[baseSizeName]) {
                    sizeCounts[baseSizeName] = { billboards: 0, faces: 0 };
                  }
                  
                  // عدد الأوجه
                  sizeCounts[baseSizeName].faces += 1;
                  
                  // عدد اللوحات (لا نحسب نفس اللوحة مرتين)
                  if (item.billboardId && !billboardsSeen.has(item.billboardId)) {
                    sizeCounts[baseSizeName].billboards += 1;
                    billboardsSeen.add(item.billboardId);
                  } else if (!item.billboardId) {
                    sizeCounts[baseSizeName].billboards += 1;
                  }
                  
                  // حساب المجسمات (لا نحسب نفس اللوحة مرتين)
                  if (item.sizeName.includes('(مجسم)') && item.billboardId && !cutoutBillboardsSeen.has(item.billboardId)) {
                    totalCutouts++;
                    cutoutBillboardsSeen.add(item.billboardId);
                  } else if (item.sizeName.includes('(مجسم)') && !item.billboardId) {
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>ملخص:</span>
                      {Object.entries(sizeCounts).map(([size, counts]) => (
                        <span key={size} style={{
                          background: '#fff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#333',
                          border: '1px solid #dee2e6',
                        }}>
                          {counts.billboards} لوحة ({counts.faces} وجه) - {size}
                        </span>
                      ))}
                      {totalCutouts > 0 && (
                        <span style={{
                          background: '#fff3cd',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
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
                
                // ✅ تجميع العناصر حسب اللوحة للدمج في الجدول
                // نحتاج لتحديد اللوحات ذات الوجهين ودمج الخلايا المشتركة
                const billboardGroups: Map<number, InvoiceItem[]> = new Map();
                data?.items?.forEach(item => {
                  if (item.billboardId) {
                    const group = billboardGroups.get(item.billboardId) || [];
                    group.push(item);
                    billboardGroups.set(item.billboardId, group);
                  }
                });
                
                // تحديد أي صف هو أول صف في مجموعة اللوحة
                const isFirstInGroup = (item: InvoiceItem, idx: number): boolean => {
                  if (!item.billboardId) return true;
                  const items = data?.items || [];
                  for (let i = 0; i < idx; i++) {
                    if (items[i].billboardId === item.billboardId) return false;
                  }
                  return true;
                };
                
                // الحصول على عدد الأوجه لكل لوحة من بيانات اللوحة الفعلية
                const getFaceCount = (billboardId: number | undefined, items: InvoiceItem[]): number => {
                  if (!billboardId) return 1;
                  // جلب عدد الأوجه من أول عنصر يحمل نفس معرف اللوحة
                  const item = items.find(i => i.billboardId === billboardId);
                  return item?.facesCount || 1;
                };
                
                return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a1a' }}>
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '4%' }}>#</th>
                      {invoiceType === 'customer' && (
                        <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '14%' }}>صورة اللوحة</th>
                      )}
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>اللوحة</th>
                      {invoiceType === 'customer' && (
                        <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '18%' }}>الموقع</th>
                      )}
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المقاس</th>
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '10%' }}>الوجه</th>
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '12%' }}>التصميم</th>
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>المساحة</th>
                      {/* أعمدة التكاليف المنفصلة لفاتورة الزبون - تظهر فقط إذا كانت غير فارغة */}
                      {invoiceType === 'customer' && showCosts && (
                        <>
                          {hasPrintCost && (
                            <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>
                              الطباعة
                              {showPriceDetails && <div style={{ fontSize: '8px', opacity: 0.8 }}>({pricePerMeter.toFixed(2)} د.ل/م²)</div>}
                            </th>
                          )}
                          {hasInstallCost && (
                            <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>
                              التركيب
                            </th>
                          )}
                          {hasCutoutCost && (
                            <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>القص</th>
                          )}
                          <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>الإجمالي</th>
                        </>
                      )}
                      {/* عمود السعر لغير فواتير الزبون */}
                      {invoiceType !== 'customer' && showCosts && (
                        <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center' }}>الإجمالي</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let billboardCounter = 0;
                      const seenBillboards = new Set<number>();
                      
                      return data?.items?.map((item, idx) => {
                        const isFirst = isFirstInGroup(item, idx);
                        const faceCount = getFaceCount(item.billboardId, data?.items || []);
                        
                        // تحديث عداد اللوحات
                        if (item.billboardId && !seenBillboards.has(item.billboardId)) {
                          billboardCounter++;
                          seenBillboards.add(item.billboardId);
                        } else if (!item.billboardId) {
                          billboardCounter++;
                        }
                        
                        return (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f5f5f5' : '#ffffff' }}>
                          {/* رقم اللوحة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                              {billboardCounter}
                            </td>
                          )}
                          {/* صورة اللوحة - لفاتورة الزبون فقط */}
                          {invoiceType === 'customer' && (() => {
                            // ✅ عند تفعيل showBackFaceImages: يتم عرض صورة لكل وجه (بدون rowSpan)
                            // عند عدم التفعيل: يتم دمج الخلية (rowSpan) وعرض صورة الوجه الأمامي فقط
                            const installedImageA = item.billboardId ? installedImagesMap[item.billboardId]?.face_a : undefined;
                            const installedImageB = item.billboardId ? installedImagesMap[item.billboardId]?.face_b : undefined;
                            
                            if (showBackFaceImages) {
                              // عرض صورة منفصلة لكل وجه
                              const displayImage = item.face === 'a' 
                                ? (showInstalledImages && installedImageA ? installedImageA : item.billboardImage)
                                : (showInstalledImages && installedImageB ? installedImageB : item.designImage);
                              
                              return (
                                <td style={{ padding: '4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                                  {displayImage ? (
                                    <img
                                      src={displayImage}
                                      alt={item.face === 'a' ? "صورة الوجه الأمامي" : "صورة الوجه الخلفي"}
                                      style={{ 
                                        width: '100%', 
                                        maxWidth: '100%',
                                        height: 'auto',
                                        maxHeight: '60px', 
                                        objectFit: 'contain', 
                                        borderRadius: '4px',
                                        border: 'none',
                                        outline: 'none',
                                        boxShadow: 'none',
                                      }}
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                  )}
                                </td>
                              );
                            } else if (isFirst) {
                              // دمج الخلية وعرض صورة الوجه الأمامي فقط
                              const displayImage = showInstalledImages && installedImageA ? installedImageA : item.billboardImage;
                              
                              return (
                                <td rowSpan={faceCount} style={{ padding: '4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                                  {displayImage ? (
                                    <img
                                      src={displayImage}
                                      alt={showInstalledImages && installedImageA ? "صورة التركيب" : "صورة اللوحة"}
                                      style={{ 
                                        width: '100%', 
                                        maxWidth: '100%',
                                        height: 'auto',
                                        maxHeight: faceCount > 1 ? '90px' : '60px', 
                                        objectFit: 'contain', 
                                        borderRadius: '4px',
                                        border: 'none',
                                        outline: 'none',
                                        boxShadow: 'none',
                                      }}
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                  )}
                                </td>
                              );
                            }
                            return null;
                          })()}
                          {/* اسم اللوحة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', fontSize: '9px', verticalAlign: 'middle' }}>
                              {item.billboardName || '-'}
                            </td>
                          )}
                          {/* الموقع (أقرب نقطة دالة + المنطقة + المدينة) - لفاتورة الزبون فقط - يُدمج للوحات ذات الوجهين */}
                          {invoiceType === 'customer' && isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'right', fontSize: '8px', color: '#333', verticalAlign: 'middle', lineHeight: '1.4' }}>
                              {item.nearestLandmark && (
                                <div style={{ marginBottom: '2px' }}>{item.nearestLandmark}</div>
                              )}
                              {(item.district || item.city) && (
                                <div style={{ fontSize: '7px', color: '#666' }}>
                                  {[item.district, item.city].filter(Boolean).join(' - ')}
                                </div>
                              )}
                              {!item.nearestLandmark && !item.district && !item.city && '-'}
                            </td>
                          )}
                          {/* المقاس - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '9px' }}>{item.sizeName}</div>
                              {/* ✅ إظهار نوع اللوحة تحت المقاس */}
                              {item.billboardType && (
                                <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>
                                  <span style={{ 
                                    background: item.billboardType === 'تيبول' ? '#fff8e1' : '#f3e5f5', 
                                    padding: '1px 4px', 
                                    borderRadius: '3px',
                                    color: item.billboardType === 'تيبول' ? '#f57c00' : '#7b1fa2',
                                  }}>{item.billboardType}</span>
                                </div>
                              )}
                              <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>
                                <span style={{ 
                                  background: '#e3f2fd', 
                                  padding: '1px 4px', 
                                  borderRadius: '3px',
                                  color: '#1565c0',
                                  fontWeight: 'bold'
                                }}>{faceCount === 1 ? 'وجه واحد' : faceCount === 2 ? 'وجهين' : `${faceCount} أوجه`}</span>
                              </div>
                            </td>
                          )}
                          {/* الوجه - منفصل لكل صف */}
                          <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontSize: '8px' }}>
                            {item.face === 'a' ? (
                              <span style={{ background: '#e8f5e9', padding: '2px 6px', borderRadius: '3px', color: '#2e7d32' }}>أمامي</span>
                            ) : (
                              <span style={{ background: '#fff3e0', padding: '2px 6px', borderRadius: '3px', color: '#ef6c00' }}>خلفي</span>
                            )}
                          </td>
                          {/* التصميم - منفصل لكل صف */}
                          <td style={{ padding: '2px', border: '1px solid #ccc', textAlign: 'center' }}>
                            {item.designImage ? (
                              <img
                                src={item.designImage}
                                alt="تصميم"
                                style={{ width: '100%', height: '45px', objectFit: 'contain', border: 'none', outline: 'none', boxShadow: 'none' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                            )}
                          </td>
                          {/* المساحة - منفصل لكل صف */}
                          <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontSize: '9px' }}>
                            {item.area.toFixed(2)} م²
                          </td>
                          {/* أعمدة التكاليف المنفصلة لفاتورة الزبون */}
                          {invoiceType === 'customer' && showCosts && (
                            <>
                              {hasPrintCost && (
                                <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a', fontSize: '9px' }}>
                                  {item.printCost > 0 ? `${item.printCost.toFixed(0)} د.ل` : '-'}
                                </td>
                              )}
                              {hasInstallCost && (
                                <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a', fontSize: '9px' }}>
                                  <div>{item.installationCost > 0 ? `${item.installationCost.toFixed(0)} د.ل` : '-'}</div>
                                  {showPriceDetails && item.installationCost > 0 && (
                                    <div style={{ fontSize: '7px', color: '#666', marginTop: '2px' }}>
                                      {item.installationCalculationType === 'meter' 
                                        ? `${item.installationPricePerMeter?.toFixed(2) || 0} د.ل/م²`
                                        : `سعر القطعة`
                                      }
                                    </div>
                                  )}
                                </td>
                              )}
                              {hasCutoutCost && (
                                <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', color: '#1a1a1a', fontSize: '9px' }}>
                                  {item.cutoutCost > 0 ? `${item.cutoutCost.toFixed(0)} د.ل` : '-'}
                                </td>
                              )}
                              <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', backgroundColor: '#e5e5e5', fontSize: '9px' }}>
                                {((hasPrintCost ? (item.printCost || 0) : 0) + 
                                  (hasInstallCost ? (item.installationCost || 0) : 0) + 
                                  (hasCutoutCost ? (item.cutoutCost || 0) : 0)).toFixed(0)} د.ل
                              </td>
                            </>
                          )}
                          {/* عمود الإجمالي لغير فواتير الزبون */}
                          {invoiceType !== 'customer' && showCosts && (
                            <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', fontSize: '9px' }}>
                              {item.totalCost.toFixed(2)} د.ل
                            </td>
                          )}
                        </tr>
                      )})
                    })()}
                  </tbody>
                  {/* صف الإجمالي - لفاتورة الزبون */}
                  {invoiceType === 'customer' && showCosts && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                        {/* عدد الأعمدة الثابتة: # + صورة اللوحة + اللوحة + أقرب نقطة + المقاس + الوجه + التصميم + المساحة = 8 */}
                        <td colSpan={8} style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff', fontSize: '11px' }}>
                          الإجمالي
                        </td>
                        {hasPrintCost && (
                          <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff', fontSize: '10px' }}>
                            {(data?.items?.reduce((sum, item) => sum + (item.printCost || 0), 0) || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        {hasInstallCost && (
                          <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff', fontSize: '10px' }}>
                            {(data?.items?.reduce((sum, item) => sum + (item.installationCost || 0), 0) || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        {hasCutoutCost && (
                          <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', color: '#fff', fontSize: '10px' }}>
                            {(data?.items?.reduce((sum, item) => sum + (item.cutoutCost || 0), 0) || 0).toFixed(0)} د.ل
                          </td>
                        )}
                        <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000', fontSize: '11px' }}>
                          {(data?.items?.reduce((sum, item) => sum + 
                              (hasPrintCost ? (item.printCost || 0) : 0) + 
                              (hasInstallCost ? (item.installationCost || 0) : 0) + 
                              (hasCutoutCost ? (item.cutoutCost || 0) : 0), 0) || 0).toFixed(0)} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  )}
                  {/* صف الإجمالي - لفواتير المطبعة والقص والفرقة */}
                  {invoiceType !== 'customer' && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                        {showCosts ? (
                          <>
                            {/* عدد الأعمدة: # + اللوحة + المقاس + الوجه + التصميم + المساحة = 6 */}
                            <td colSpan={6} style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff', fontSize: '11px' }}>
                              الإجمالي
                            </td>
                            <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000', fontSize: '11px' }}>
                              {(data?.items?.reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0).toFixed(0)} د.ل
                            </td>
                          </>
                        ) : (
                          <>
                            {/* بدون سعر - عرض إجمالي الأمتار فقط */}
                            <td colSpan={5} style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff', fontSize: '11px' }}>
                              إجمالي المساحة
                            </td>
                            <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000', fontSize: '11px' }}>
                              {(data?.items?.reduce((sum, item) => sum + (item.area || 0), 0) || 0).toFixed(2)} م²
                            </td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  )}
                </table>
                );
              })()}

              {/* Summary View - العرض المجمّع لفاتورة الزبون - مع دمج الصفوف للوحات ذات الوجهين */}
              {displayMode === 'summary' && invoiceType === 'customer' && (() => {
                // تجميع العناصر حسب اللوحة للدمج في الجدول
                const billboardGroups: Map<number, InvoiceItem[]> = new Map();
                data?.items?.forEach(item => {
                  if (item.billboardId) {
                    const group = billboardGroups.get(item.billboardId) || [];
                    group.push(item);
                    billboardGroups.set(item.billboardId, group);
                  }
                });
                
                // تحديد أي صف هو أول صف في مجموعة اللوحة
                const isFirstInGroup = (item: InvoiceItem, idx: number): boolean => {
                  if (!item.billboardId) return true;
                  const items = data?.items || [];
                  for (let i = 0; i < idx; i++) {
                    if (items[i].billboardId === item.billboardId) return false;
                  }
                  return true;
                };
                
                // الحصول على عدد الأوجه لكل لوحة من بيانات اللوحة الفعلية
                const getFaceCount = (billboardId: number | undefined, items: InvoiceItem[]): number => {
                  if (!billboardId) return 1;
                  // جلب عدد الأوجه من أول عنصر يحمل نفس معرف اللوحة
                  const item = items.find(i => i.billboardId === billboardId);
                  return item?.facesCount || 1;
                };

                return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a1a' }}>
                      <th style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', width: '4%' }}>#</th>
                      {/* مجموعة بيانات اللوحة: الصورة + اسم اللوحة + أقرب نقطة */}
                      <th colSpan={3} style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#2a2a2a' }}>بيانات اللوحة</th>
                      {/* مجموعة التصاميم والمقاس */}
                      <th colSpan={2} style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#3a3a3a' }}>التصميم والمقاس</th>
                      {/* مجموعة التكلفة */}
                      <th colSpan={2} style={{ padding: '8px 4px', color: '#fff', border: '1px solid #333', textAlign: 'center', backgroundColor: '#1a1a1a' }}>التكلفة</th>
                    </tr>
                    <tr style={{ backgroundColor: '#333' }}>
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px' }}></th>
                      {/* أعمدة بيانات اللوحة */}
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px', width: '12%' }}>الصورة</th>
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px' }}>اسم اللوحة</th>
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px', width: '15%' }}>أقرب نقطة دالة</th>
                      {/* أعمدة التصميم والمقاس */}
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px', width: '14%' }}>التصميم</th>
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px' }}>المقاس</th>
                      {/* أعمدة التكلفة */}
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px' }}>المساحة</th>
                      <th style={{ padding: '6px 4px', color: '#ccc', border: '1px solid #444', textAlign: 'center', fontSize: '9px', width: '12%' }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let billboardCounter = 0;
                      const seenBillboards = new Set<number>();
                      
                      return data?.items?.map((item, idx) => {
                        const isFirst = isFirstInGroup(item, idx);
                        const faceCount = getFaceCount(item.billboardId, data?.items || []);
                        
                        // تحديث عداد اللوحات
                        if (item.billboardId && !seenBillboards.has(item.billboardId)) {
                          billboardCounter++;
                          seenBillboards.add(item.billboardId);
                        } else if (!item.billboardId) {
                          billboardCounter++;
                        }
                        
                        return (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f5f5f5' : '#ffffff' }}>
                          {/* رقم اللوحة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                              {billboardCounter}
                            </td>
                          )}
                          {/* صورة اللوحة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '4px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fafafa' }}>
                              {(() => {
                                const installedImageA = item.billboardId ? installedImagesMap[item.billboardId]?.face_a : undefined;
                                const displayImage = showInstalledImages && installedImageA ? installedImageA : item.billboardImage;
                                
                                return displayImage ? (
                                  <img
                                    src={displayImage}
                                    alt={showInstalledImages && installedImageA ? "صورة التركيب" : "صورة اللوحة"}
                                    style={{ 
                                      width: '100%', 
                                      maxHeight: faceCount > 1 ? '80px' : '55px', 
                                      objectFit: 'contain', 
                                      borderRadius: '4px',
                                      border: 'none',
                                      outline: 'none',
                                      boxShadow: 'none',
                                    }}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                );
                              })()}
                            </td>
                          )}
                          {/* اسم اللوحة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', fontSize: '9px', backgroundColor: '#fafafa', verticalAlign: 'middle' }}>
                              {item.billboardName || '-'}
                            </td>
                          )}
                          {/* أقرب نقطة دالة - يُدمج للوحات ذات الوجهين */}
                          {isFirst && (
                            <td rowSpan={faceCount} style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontSize: '8px', color: '#555', backgroundColor: '#fafafa', lineHeight: '1.3', verticalAlign: 'middle' }}>
                              {item.nearestLandmark || '-'}
                            </td>
                          )}
                          {/* التصميم - منفصل لكل وجه */}
                          <td style={{ padding: '2px', border: '1px solid #ccc', textAlign: 'center', backgroundColor: idx % 2 === 0 ? '#f8f8f8' : '#fefefe' }}>
                            {item.designImage ? (
                              <img
                                src={item.designImage}
                                alt="تصميم"
                                style={{ width: '100%', height: '45px', objectFit: 'contain', border: 'none', outline: 'none', boxShadow: 'none' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                            )}
                          </td>
                          {/* المقاس والوجه - منفصل لكل وجه */}
                          <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', backgroundColor: idx % 2 === 0 ? '#f8f8f8' : '#fefefe' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '9px' }}>{item.sizeName}</div>
                            <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>
                              {item.face === 'a' ? (
                                <span style={{ background: '#e8f5e9', padding: '2px 6px', borderRadius: '3px', color: '#2e7d32' }}>أمامي</span>
                              ) : item.face === 'b' ? (
                                <span style={{ background: '#fff3e0', padding: '2px 6px', borderRadius: '3px', color: '#ef6c00' }}>خلفي</span>
                              ) : (
                                <span style={{ background: '#e3f2fd', padding: '1px 4px', borderRadius: '3px', color: '#1565c0', fontWeight: 'bold' }}>وجهين</span>
                              )}
                            </div>
                            {item.cutoutCost > 0 && (
                              <div style={{ 
                                fontSize: '8px', 
                                color: '#9333ea', 
                                fontWeight: 'bold',
                                marginTop: '2px',
                                padding: '1px 4px',
                                backgroundColor: '#f3e8ff',
                                borderRadius: '3px',
                                display: 'inline-block'
                              }}>
                                🔷 مجسم
                              </div>
                            )}
                          </td>
                          {/* المساحة - منفصل لكل وجه */}
                          <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontSize: '9px' }}>
                            {item.area.toFixed(2)} م²
                          </td>
                          {/* الإجمالي - منفصل لكل وجه */}
                          <td style={{ padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', backgroundColor: '#e5e5e5', fontSize: '10px' }}>
                            {item.totalCost.toFixed(0)} د.ل
                          </td>
                        </tr>
                      )})
                    })()}
                  </tbody>
                  <tfoot>
                    {/* صف المجموع الفرعي (إذا يوجد خصم) */}
                    {invoiceType === 'customer' && (task.discount_amount || 0) > 0 && (
                      <>
                        <tr style={{ backgroundColor: '#2a2a2a', fontWeight: 'bold' }}>
                          <td colSpan={7} style={{ padding: '8px 6px', border: '1px solid #333', textAlign: 'center', color: '#ccc', fontSize: '10px' }}>
                            المجموع الفرعي
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#ccc', backgroundColor: '#333', fontSize: '10px' }}>
                            {((task.customer_total || 0) + (task.discount_amount || 0)).toFixed(0)} د.ل
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#1a3d1a', fontWeight: 'bold' }}>
                          <td colSpan={7} style={{ padding: '8px 6px', border: '1px solid #333', textAlign: 'center', color: '#4ade80', fontSize: '10px' }}>
                            الخصم {task.discount_reason ? `(${task.discount_reason})` : ''}
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#4ade80', backgroundColor: '#1a3d1a', fontSize: '10px' }}>
                            - {(task.discount_amount || 0).toFixed(0)} د.ل
                          </td>
                        </tr>
                      </>
                    )}
                    <tr style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                      <td colSpan={7} style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', color: '#fff', fontSize: '11px' }}>
                        الإجمالي المطلوب
                      </td>
                      <td style={{ padding: '10px 6px', border: '1px solid #333', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#fff', backgroundColor: '#000', fontSize: '11px' }}>
                        {(task.customer_total || 0).toFixed(0)} د.ل
                      </td>
                    </tr>
                  </tfoot>
                </table>
                );
              })()}

              {/* Total Section - يظهر فقط في العرض التفصيلي */}
              {showCosts && displayMode === 'detailed' && (
                <div style={{
                  background: 'linear-gradient(135deg, #1a1a1a, #000)',
                  padding: '20px',
                  textAlign: 'center',
                  borderRadius: '8px',
                }}>
                  {/* عرض المجموع الفرعي والخصم لفاتورة الزبون */}
                  {invoiceType === 'customer' && (task.discount_amount || 0) > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        gap: '20px',
                        fontSize: '14px',
                        color: '#fff',
                        opacity: 0.85,
                        marginBottom: '8px'
                      }}>
                        <span>المجموع الفرعي:</span>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 'bold' }}>
                          {((task.customer_total || 0) + (task.discount_amount || 0)).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        gap: '20px',
                        fontSize: '14px',
                        color: '#4ade80',
                        marginBottom: '8px'
                      }}>
                        <span>الخصم{task.discount_reason ? ` (${task.discount_reason})` : ''}:</span>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 'bold' }}>
                          - {(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '8px', paddingTop: '12px' }}>
                        <div style={{ fontSize: '14px', color: '#fff', opacity: 0.9, marginBottom: '6px' }}>
                          الإجمالي المستحق
                        </div>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: 'bold',
                          color: '#fff',
                          fontFamily: 'Manrope',
                        }}>
                          {(task.customer_total || 0).toLocaleString('ar-LY')}
                          <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* عرض الإجمالي مباشرة إذا لا يوجد خصم */}
                  {(invoiceType !== 'customer' || !(task.discount_amount || 0)) && (
                    <>
                      <div style={{ fontSize: '14px', color: '#fff', opacity: 0.9, marginBottom: '6px' }}>
                        الإجمالي المستحق
                      </div>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#fff',
                        fontFamily: 'Manrope',
                      }}>
                        {invoiceType === 'customer' 
                          ? dynamicTotal.toLocaleString('ar-LY')
                          : (data?.totalCost || 0).toLocaleString('ar-LY')
                        }
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Signature and Stamp Section - قسم الختم والتوقيع */}
              {showSignatureSection && (
                <div style={{
                  marginTop: '40px',
                  paddingTop: '20px',
                  borderTop: '2px dashed #ccc',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}>
                    {/* الختم */}
                    <div style={{
                      flex: 1,
                      textAlign: 'center',
                      paddingLeft: '20px',
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333',
                        marginBottom: '60px',
                      }}>
                        الختم
                      </div>
                      <div style={{
                        borderTop: '2px solid #333',
                        width: '120px',
                        margin: '0 auto',
                      }}></div>
                    </div>
                    
                    {/* التوقيع */}
                    <div style={{
                      flex: 1,
                      textAlign: 'center',
                      paddingRight: '20px',
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333',
                        marginBottom: '60px',
                      }}>
                        التوقيع
                      </div>
                      <div style={{
                        borderTop: '2px solid #333',
                        width: '120px',
                        margin: '0 auto',
                      }}></div>
                    </div>
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
