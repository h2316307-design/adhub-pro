import { Button } from '@/components/ui/button';
import { Printer, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { loadPrintLogo } from '@/lib/printLogo';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CompositeTaskInvoicePrintProps {
  task: CompositeTaskWithDetails;
}

// دالة لتوليد عنوان الفاتورة ديناميكياً بناءً على المكونات
function generateDynamicInvoiceTitle(task: CompositeTaskWithDetails, details: any): { ar: string; en: string } {
  const hasPrint = (task.customer_print_cost || 0) > 0 || (details?.print?.print_task_items?.length > 0);
  const hasInstallation = (task.customer_installation_cost || 0) > 0 || (details?.installationItems?.length > 0);
  const hasCutout = (task.customer_cutout_cost || 0) > 0 || (details?.totalCutouts > 0);
  
  const components: string[] = [];
  const componentsEn: string[] = [];
  
  if (hasPrint) {
    components.push('طباعة');
    componentsEn.push('Print');
  }
  if (hasInstallation) {
    components.push('تركيب');
    componentsEn.push('Installation');
  }
  if (hasCutout) {
    components.push('قص');
    componentsEn.push('Cutout');
  }
  
  if (components.length === 0) {
    return { ar: 'فاتورة', en: 'Invoice' };
  }
  
  const arTitle = `فاتورة ${components.join(' و')}`;
  const enTitle = `${componentsEn.join(' & ')} Invoice`;
  
  return { ar: arTitle, en: enTitle };
}

export function CompositeTaskInvoicePrint({ task }: CompositeTaskInvoicePrintProps) {
  const [taskDetails, setTaskDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // خيار إظهار التفاصيل
  const [displayMode, setDisplayMode] = useState<'detailed' | 'summary'>('detailed'); // نوع العرض
  const [logoDataUri, setLogoDataUri] = useState<string>('');

  useEffect(() => {
    loadTaskDetails();
    // تحميل الشعار
    loadPrintLogo().then(setLogoDataUri);
  }, [task.id]);

  const loadTaskDetails = async () => {
    setLoading(true);
    try {
      const details: any = {
        installation: null,
        print: null,
        cutout: null,
        cutoutTask: null,
        cutoutItemsByBillboard: {},
        sizesMap: {},
        installationItems: [],
        contractsInfo: [] // معلومات جميع العقود
      };

      // تحميل جميع البيانات بشكل متوازي
      const [installResult, installItemsResult, printResult, cutoutItemsResult, cutoutTaskResult, sizesResult] = await Promise.all([
        task.installation_task_id 
          ? supabase
              .from('installation_tasks')
              .select('*, contract_ids')
              .eq('id', task.installation_task_id)
              .single()
          : Promise.resolve({ data: null }),
        // جلب عناصر التركيب بشكل منفصل
        task.installation_task_id 
          ? supabase
              .from('installation_task_items')
              .select('*')
              .eq('task_id', task.installation_task_id)
          : Promise.resolve({ data: null }),
        task.print_task_id 
          ? supabase
              .from('print_tasks')
              .select('*, print_task_items(*)')
              .eq('id', task.print_task_id)
              .single()
          : Promise.resolve({ data: null }),
        task.cutout_task_id
          ? supabase
              .from('cutout_task_items')
              .select('*')
              .eq('task_id', task.cutout_task_id)
          : Promise.resolve({ data: null }),
        task.cutout_task_id
          ? supabase
              .from('cutout_tasks')
              .select('customer_total_amount, total_quantity, unit_cost, total_cost')
              .eq('id', task.cutout_task_id)
              .single()
          : Promise.resolve({ data: null }),
        // جلب المقاسات الفعلية من جدول sizes
        supabase
          .from('sizes')
          .select('id, name, width, height')
      ]);

      // إنشاء خريطة المقاسات بالاسم
      if (sizesResult.data) {
        sizesResult.data.forEach((size: any) => {
          details.sizesMap[size.name] = { width: size.width, height: size.height };
        });
      }

      details.installation = installResult.data;
      // إضافة عناصر التركيب للمهمة
      if (details.installation && installItemsResult.data) {
        details.installation.installation_task_items = installItemsResult.data;
      }
      details.print = printResult.data;
      details.cutoutTask = cutoutTaskResult.data;
      
      // جلب معلومات جميع العقود (أرقام العقود وأنواع الإعلان)
      // ✅ الاعتماد على عقود اللوحات الفعلية من installation_task_items (بدلاً من contract_ids الفارغة)
      let uniqueContractIds: number[] = [];

      if (task.installation_task_id) {
        const { data: installContracts } = await supabase
          .from('installation_task_items')
          .select('billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
          .eq('task_id', task.installation_task_id);

        const set = new Set<number>();
        (installContracts || []).forEach((row: any) => {
          const n = row.billboard?.Contract_Number;
          if (n) set.add(Number(n));
        });
        uniqueContractIds = Array.from(set);
      }

      if (uniqueContractIds.length === 0) {
        const rawContractIds = installResult.data?.contract_ids && (installResult.data.contract_ids as number[]).length > 0
          ? (installResult.data.contract_ids as number[])
          : [installResult.data?.contract_id || task.contract_id];

        uniqueContractIds = [...new Set(rawContractIds.filter((id): id is number => id != null && typeof id === 'number'))];
      }
      
      if (uniqueContractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('"Contract_Number", "Ad Type", design_data')
          .in('Contract_Number', uniqueContractIds);
        
        details.contractsInfo = contractsData?.map((c: any) => ({
          contractId: c.Contract_Number,
          adType: c['Ad Type'] || 'غير محدد'
        })) || [];
      }
      
      // جلب بيانات العقد للحصول على design_data من جميع العقود
      let contractDesignMap: Record<string, any> = {};
      for (const contractId of uniqueContractIds) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('design_data')
          .eq('Contract_Number', contractId)
          .single();
        
        if (contractData?.design_data) {
          const designData = typeof contractData.design_data === 'string' 
            ? JSON.parse(contractData.design_data) 
            : contractData.design_data;
          
          if (Array.isArray(designData)) {
            designData.forEach((d: any) => {
              contractDesignMap[d.billboardId] = {
                designFaceA: d.designFaceA,
                designFaceB: d.designFaceB,
                billboardImage: d.billboardImage,
                billboardLocation: d.billboardLocation
              };
            });
          }
        }
      }
      
      // جلب بيانات اللوحات لعناصر التركيب (عند عدم وجود طباعة)
      const installItems = details.installation?.installation_task_items || installItemsResult.data || [];
      if (installItems.length > 0) {
        const billboardIds = installItems
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size, Billboard_Name, design_face_a, design_face_b, Image_URL, Nearest_Landmark, GPS_Coordinates')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.installationBillboards = {};
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              const contractDesign = contractDesignMap[String(b.ID)] || {};
              
              // استخراج المقاس من النص إذا لم يوجد في sizesMap
              let width = sizeInfo?.width;
              let height = sizeInfo?.height;
              if (!width || !height) {
                const sizeMatch = b.Size?.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  width = parseInt(sizeMatch[1]);
                  height = parseInt(sizeMatch[2]);
                }
              }
              
              // استخدام التصميم من العقد أولاً، ثم من اللوحة، ثم صورة اللوحة
              const designA = contractDesign.designFaceA || b.design_face_a || contractDesign.billboardImage || b.Image_URL;
              const designB = contractDesign.designFaceB || b.design_face_b;
              
              details.installationBillboards[b.ID] = {
                name: b.Billboard_Name,
                size: b.Size,
                width: width,
                height: height,
                design_face_a: designA,
                design_face_b: designB,
                location: contractDesign.billboardLocation,
                // ✅ إضافة البيانات الجديدة
                billboard_image: b.Image_URL,
                nearest_landmark: b.Nearest_Landmark,
                gps_coordinates: b.GPS_Coordinates
              };
            });
          }
        }
        
        // بناء قائمة عناصر التركيب مع بيانات اللوحات
        details.installationItems = installItems.map((item: any) => {
          const billboard = details.installationBillboards?.[item.billboard_id] || {};
          
          // استخراج المقاس من billboard.Size إذا لم يكن موجوداً
          let width = billboard.width;
          let height = billboard.height;
          if (!width || !height) {
            const sizeStr = item.billboard?.Size || billboard.size;
            const sizeMatch = sizeStr?.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
              width = parseInt(sizeMatch[1]);
              height = parseInt(sizeMatch[2]);
            }
          }
          
          return {
            ...item,
            billboard_name: billboard.name || item.billboard?.Billboard_Name,
            billboard_size: billboard.size || item.billboard?.Size,
            width: width,
            height: height,
            design_face_a: item.design_face_a || billboard.design_face_a,
            design_face_b: item.design_face_b || billboard.design_face_b,
            location: billboard.location,
            // ✅ إضافة البيانات الجديدة
            billboard_image: billboard.billboard_image,
            nearest_landmark: billboard.nearest_landmark,
            gps_coordinates: billboard.gps_coordinates
          };
        });
      }
      
      // إذا وجدت عناصر الطباعة، نجلب بيانات اللوحات للحصول على المقاسات الفعلية والبيانات الإضافية
      if (printResult.data?.print_task_items?.length > 0) {
        const billboardIds = printResult.data.print_task_items
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size, Image_URL, Nearest_Landmark, GPS_Coordinates')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.billboardSizes = {};
            details.billboardExtras = {}; // ✅ بيانات إضافية للوحات
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              details.billboardSizes[b.ID] = sizeInfo || { width: null, height: null };
              details.billboardExtras[b.ID] = {
                billboard_image: b.Image_URL,
                nearest_landmark: b.Nearest_Landmark,
                gps_coordinates: b.GPS_Coordinates
              };
            });
          }
        }
        
        // ✅ إضافة البيانات الإضافية لعناصر الطباعة
        printResult.data.print_task_items = printResult.data.print_task_items.map((item: any) => {
          const extras = details.billboardExtras?.[item.billboard_id] || {};
          return {
            ...item,
            billboard_image: extras.billboard_image,
            nearest_landmark: extras.nearest_landmark,
            gps_coordinates: extras.gps_coordinates
          };
        });
      }
      
      // حساب سعر المجسم للزبون من cutout_tasks
      if (cutoutTaskResult.data) {
        const ct = cutoutTaskResult.data;
        details.totalCutouts = ct.total_quantity || 0;
        // سعر المجسم للزبون = إجمالي الزبون / عدد المجسمات
        details.customerCutoutUnitPrice = details.totalCutouts > 0 
          ? (ct.customer_total_amount || 0) / details.totalCutouts 
          : 0;
        // سعر المجسم للشركة
        details.companyCutoutUnitPrice = ct.unit_cost || 0;
      }
      
      // تجميع بيانات المجسمات حسب billboard_id من cutout_task_items
      if (cutoutItemsResult.data) {
        const cutoutItems = cutoutItemsResult.data as any[];
        cutoutItems.forEach((item: any) => {
          if (!details.cutoutItemsByBillboard[item.billboard_id]) {
            details.cutoutItemsByBillboard[item.billboard_id] = { count: 0, unitCost: item.unit_cost || 0 };
          }
          details.cutoutItemsByBillboard[item.billboard_id].count += item.quantity;
        });
      }
      
      setTaskDetails(details);
    } catch (error) {
      console.error('Error loading task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!taskDetails) return;

    // تحميل الشعار قبل الطباعة
    const logo = logoDataUri || await loadPrintLogo();

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة');
      return;
    }

    const invoiceHTML = generateInvoiceHTML(task, taskDetails, showDetails, logo, displayMode);

    // ✅ انتظر تحميل الصور (خصوصاً الشعار) قبل الطباعة
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 900);
    };

    printWindow.document.open();
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
  };

  // ✅ التحقق من وجود بنود فعلية أو تكاليف (للسماح بإنشاء عناصر افتراضية)
  const hasItems = taskDetails && (
    (taskDetails.print?.print_task_items?.length > 0) ||
    (taskDetails.installationItems?.length > 0) ||
    (taskDetails.totalCutouts > 0) ||
    // ✅ السماح بالطباعة إذا كانت هناك تكاليف (ستُنشأ عناصر افتراضية)
    (task.customer_print_cost || 0) > 0 ||
    (task.customer_installation_cost || 0) > 0 ||
    (task.customer_cutout_cost || 0) > 0
  );

  // توليد عنوان الفاتورة
  const invoiceTitle = taskDetails ? generateDynamicInvoiceTitle(task, taskDetails) : { ar: 'فاتورة', en: 'Invoice' };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm border-b pb-2">خيارات الطباعة</h4>
            
            {/* نوع العرض */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">نوع العرض:</Label>
              <div className="flex gap-2">
                <Button
                  variant={displayMode === 'detailed' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setDisplayMode('detailed')}
                >
                  تفصيلي
                </Button>
                <Button
                  variant={displayMode === 'summary' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setDisplayMode('summary')}
                >
                  مجمّع
                </Button>
              </div>
            </div>
            
            {/* إظهار أعمدة التفاصيل */}
            {displayMode === 'detailed' && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="showDetails" 
                  checked={showDetails}
                  onCheckedChange={(checked) => setShowDetails(checked as boolean)}
                />
                <Label htmlFor="showDetails" className="text-sm cursor-pointer">
                  إظهار أعمدة التكاليف التفصيلية
                </Label>
              </div>
            )}

            {/* معاينة العنوان */}
            <div className="pt-2 border-t">
              <Label className="text-xs font-medium text-muted-foreground">عنوان الفاتورة:</Label>
              <p className="text-sm font-semibold mt-1">{invoiceTitle.ar}</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Button 
        onClick={handlePrint} 
        variant="outline" 
        size="sm"
        disabled={loading || !taskDetails || !hasItems}
        title={!hasItems ? 'لا توجد بنود في هذه الفاتورة' : ''}
      >
        <Printer className="h-4 w-4 mr-2" />
        {loading ? 'جاري التحميل...' : !hasItems ? 'لا توجد بنود' : 'طباعة فاتورة الزبون'}
      </Button>
    </div>
  );
}

// دالة إنشاء صفحة فاتورة فارغة مع رسالة توضيحية
function generateEmptyInvoiceHTML(task: CompositeTaskWithDetails, invoiceTitle: { ar: string; en: string }, invoiceDate: string, logoDataUri: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceTitle.ar} - ${task.customer_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; text-align: right; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 20mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
    .logo { max-width: 150px; height: auto; }
    .title { font-size: 24px; font-weight: bold; }
    .empty-message { text-align: center; padding: 60px 20px; background: #f8f9fa; border: 2px dashed #ccc; border-radius: 10px; margin-top: 50px; }
    .empty-icon { font-size: 48px; margin-bottom: 20px; color: #999; }
    .empty-text { font-size: 18px; color: #666; line-height: 1.8; }
    .customer-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-label { color: #666; }
    .info-value { font-weight: bold; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">${invoiceTitle.ar}</div>
        <div style="font-size: 12px; color: #666;">${invoiceTitle.en}</div>
      </div>
      ${logoDataUri ? `<img src="${logoDataUri}" class="logo" alt="شعار الشركة">` : ''}
    </div>
    
    <div class="customer-info">
      <div class="info-row">
        <span class="info-label">العميل:</span>
        <span class="info-value">${task.customer_name || 'غير محدد'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم العقد:</span>
        <span class="info-value">#${task.contract_id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">التاريخ:</span>
        <span class="info-value">${invoiceDate}</span>
      </div>
    </div>
    
    <div class="empty-message">
      <div class="empty-icon">📋</div>
      <div class="empty-text">
        <strong>لا توجد بنود في هذه الفاتورة</strong><br><br>
        هذه المهمة لا تحتوي على عناصر طباعة أو تركيب أو قص.<br>
        يرجى التأكد من إضافة البنود المطلوبة قبل إنشاء الفاتورة.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// دالة توليد جدول العرض المجمّع (عمود تكلفة واحد لكل عنصر)
function generateSummarySection(task: CompositeTaskWithDetails, details: any, invoiceTitle: { ar: string; en: string }, pricePerMeter: number = 0): string {
  const totalAmount = (task.customer_total || 0) - (task.discount_amount || 0);
  
  const printItems = details.print?.print_task_items || [];
  const installationItems = details.installationItems || [];
  const isInstallationOnly = printItems.length === 0 && installationItems.length > 0;
  const items = isInstallationOnly ? installationItems : printItems;
  
  // سعر المتر للزبون
  const totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
  const customerPricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;
  
  // سعر المجسم للزبون
  const cutoutPricePerUnit = details.customerCutoutUnitPrice || 0;
  
  // سعر التركيب لكل لوحة
  const installationCostPerItem = installationItems.length > 0 
    ? (task.customer_installation_cost || 0) / installationItems.length 
    : 0;
  
  // تجميع العناصر المتشابهة مع تجميع الوجهين
  const groupSimilarItems = (items: any[]) => {
    const grouped: Record<string, any> = {};
    
    items.forEach((item: any) => {
      const billboardSize = details.billboardSizes?.[item.billboard_id];
      const displayWidth = billboardSize?.width || item.width;
      const displayHeight = billboardSize?.height || item.height;
      const sizeKey = `${displayWidth}×${displayHeight}`;
      
      const hasCutout = (item.cutout_quantity || 0) > 0;
      
      // ✅ تجميع بناءً على صورة اللوحة والإحداثيات
      const billboardImage = item.billboard_image || '';
      const gpsCoords = item.gps_coordinates || '';
      const nearestLandmark = item.nearest_landmark || '';
      
      const groupKey = `${billboardImage || 'no-image'}_${gpsCoords || 'no-gps'}_${sizeKey}_${hasCutout}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          billboardImage,
          nearestLandmark,
          displayWidth,
          displayHeight,
          sizeKey,
          items: [],
          designs: [],
          totalQuantity: 0,
          totalArea: 0,
          totalCutouts: 0
        };
      }
      
      // جمع التصاميم المختلفة
      if (item.design_face_a && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_a)) {
        grouped[groupKey].designs.push({ image: item.design_face_a, face: 'أمامي' });
      }
      if (item.design_face_b && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_b)) {
        grouped[groupKey].designs.push({ image: item.design_face_b, face: 'خلفي' });
      }
      
      const itemArea = (item.area || ((displayWidth || 0) * (displayHeight || 0))) * (item.quantity || 1);
      grouped[groupKey].items.push(item);
      grouped[groupKey].totalQuantity += (item.quantity || 1);
      grouped[groupKey].totalArea += itemArea;
      grouped[groupKey].totalCutouts += (item.cutout_quantity || 0);
    });
    
    return Object.values(grouped);
  };
  
  const groupedItems = groupSimilarItems(items);
  
  // بناء صفوف الجدول
  let rows = '';
  let rowIndex = 1;
  
  groupedItems.forEach((group: any) => {
    // حساب التكلفة الإجمالية للعنصر
    const printCost = group.totalArea * customerPricePerMeter;
    const cutoutCost = group.totalCutouts * cutoutPricePerUnit;
    const installCost = isInstallationOnly ? (group.items.reduce((sum: number, item: any) => {
      return sum + (item.customer_installation_cost || installationCostPerItem);
    }, 0)) : 0;
    const totalItemCost = printCost + cutoutCost + installCost;
    
    // عرض التصاميم المختلفة
    const designsHTML = group.designs.length > 0 
      ? group.designs.map((d: any) => `
          <div style="margin-bottom: 2px; position: relative; display: inline-block; width: 45%;">
            <img src="${d.image}" style="width: 100%; height: 35px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
          </div>
        `).join('')
      : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
    
    rows += `
      <tr>
        <td style="text-align: center; font-weight: bold; vertical-align: middle;">${rowIndex}</td>
        <td style="padding: 3px; vertical-align: middle;">
          ${group.billboardImage 
            ? `<img src="${group.billboardImage}" style="width: 100%; height: 45px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
            : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
        </td>
        <td style="padding: 2px; vertical-align: top;">${designsHTML}</td>
        <td style="vertical-align: middle; font-size: 7px; line-height: 1.2;">
          ${group.nearestLandmark 
            ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 35)}${group.nearestLandmark.length > 35 ? '...' : ''}</div>`
            : '<span style="color: #999;">-</span>'}
        </td>
        <td style="vertical-align: middle;">
          <div style="font-weight: bold; font-size: 9px;">${group.displayWidth}×${group.displayHeight}</div>
          <div style="font-size: 7px; color: #666;">متر</div>
        </td>
        <td style="vertical-align: middle;"><strong style="font-size: 10px;">×${group.totalQuantity}</strong></td>
        <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
        <td style="vertical-align: middle; background: #f0f9ff;">
          <strong style="font-size: 10px; color: #1e40af;">${totalItemCost.toFixed(0)}</strong>
          <div style="font-size: 7px; color: #666;">د.ل</div>
        </td>
      </tr>
    `;
    rowIndex++;
  });
  
  return `
    <div class="items-section">
      <div class="section-title" style="background: #1e40af;">بنود الفاتورة</div>
      <table class="items-table" style="border-color: #1e40af;">
        <thead>
          <tr>
            <th style="width: 25px; background: #1e40af;">#</th>
            <th style="width: 50px; background: #1e40af;">صورة اللوحة</th>
            <th style="width: 60px; background: #1e40af;">التصاميم</th>
            <th style="width: 80px; background: #1e40af;">أقرب نقطة دالة</th>
            <th style="width: 50px; background: #1e40af;">المقاس</th>
            <th style="width: 35px; background: #1e40af;">الكمية</th>
            <th style="width: 45px; background: #1e40af;">المساحة</th>
            <th style="width: 70px; background: #1e40af;">التكلفة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    
    ${(task.discount_amount || 0) > 0 ? `
    <div style="margin-top: 10px; padding: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; display: flex; justify-content: space-between;">
      <span style="color: #dc2626;">خصم ${task.discount_reason ? `(${task.discount_reason})` : ''}</span>
      <span style="color: #dc2626; font-weight: bold;">- ${(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل</span>
    </div>
    ` : ''}
    
    <div style="margin-top: 15px; background: #1e40af; color: white; padding: 12px; text-align: center; border-radius: 6px; font-size: 16px; font-weight: bold;">
      الإجمالي المطلوب: ${totalAmount.toLocaleString('ar-LY')} دينار ليبي
    </div>
  `;
}

function generateInvoiceHTML(task: CompositeTaskWithDetails, details: any, showDetails: boolean = true, logoDataUri: string = '', displayMode: 'detailed' | 'summary' = 'detailed'): string {
  // توليد عنوان الفاتورة ديناميكياً
  const invoiceTitle = generateDynamicInvoiceTitle(task, details);
  
  const invoiceDate = task.invoice_date 
    ? format(new Date(task.invoice_date), 'dd MMMM yyyy', { locale: ar })
    : format(new Date(), 'dd MMMM yyyy', { locale: ar });

  const printItems = details.print?.print_task_items || [];
  const installationItems = details.installationItems || [];
  
  // التحقق من وجود بنود فعلية
  const hasRealItems = printItems.length > 0 || installationItems.length > 0 || (details.totalCutouts || 0) > 0;
  
  // التحقق من وجود تكاليف (حتى لو لم تكن هناك عناصر فعلية)
  const hasCosts = (task.customer_print_cost || 0) > 0 || 
                   (task.customer_installation_cost || 0) > 0 || 
                   (task.customer_cutout_cost || 0) > 0;
  
  // ⚠️ قاعدة حرجة: يُمنع إنشاء فاتورة فارغة تماماً
  // إذا لم توجد عناصر فعلية ولا تكاليف، أعد صفحة رسالة
  if (!hasRealItems && !hasCosts) {
    return generateEmptyInvoiceHTML(task, invoiceTitle, invoiceDate, logoDataUri);
  }
  
  // ✅ إنشاء عناصر افتراضية (Virtual Items) إذا لم تكن هناك عناصر فعلية لكن توجد تكاليف
  // هذا يضمن أن الفاتورة لن تكون فارغة أبداً
  const virtualItems: any[] = [];
  if (!hasRealItems && hasCosts) {
    if ((task.customer_print_cost || 0) > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'print',
        description: 'الطباعة (مهمة مجمّعة)',
        description_en: 'Printing (Composite Task)',
        quantity: 1,
        unit_price: task.customer_print_cost,
        total: task.customer_print_cost
      });
    }
    if ((task.customer_installation_cost || 0) > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'installation',
        description: 'التركيب (مهمة مجمّعة)',
        description_en: 'Installation (Composite Task)',
        quantity: 1,
        unit_price: task.customer_installation_cost,
        total: task.customer_installation_cost
      });
    }
    if ((task.customer_cutout_cost || 0) > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'cutout',
        description: 'القص (مهمة مجمّعة)',
        description_en: 'Cutout (Composite Task)',
        quantity: 1,
        unit_price: task.customer_cutout_cost,
        total: task.customer_cutout_cost
      });
    }
  }
  
  // استخدام العناصر الافتراضية إذا لم تكن هناك عناصر حقيقية
  const useVirtualItems = virtualItems.length > 0;
  
  // تحديد إذا كانت فاتورة تركيب فقط (بدون طباعة)
  const isInstallationOnly = printItems.length === 0 && installationItems.length > 0;
  
  // العناصر المستخدمة في الفاتورة
  const invoiceItems = useVirtualItems ? virtualItems : (isInstallationOnly ? installationItems : printItems);
  
  // حساب إجمالي المساحة من print_task_items
  const totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
  
  // حساب إجمالي عدد المجسمات من cutout_tasks
  const totalCutouts = details.totalCutouts || 0;
  
  // حساب سعر المتر للزبون
  const pricePerMeter = totalArea > 0 ? task.customer_print_cost / totalArea : 0;
  
  // سعر المجسم الواحد للزبون (من cutout_tasks.customer_total_amount / total_quantity)
  const cutoutPricePerUnit = details.customerCutoutUnitPrice || 0;
  
  // حساب تكلفة التركيب لكل لوحة
  const installationCostPerItem = installationItems.length > 0 
    ? (task.customer_installation_cost || 0) / installationItems.length 
    : 0;

  // دالة تجميع العناصر المتشابهة مع تجميع الوجهين ذات نفس الصورة والإحداثيات
  const groupSimilarItems = (items: any[], isInstallOnly: boolean) => {
    const grouped: Record<string, any> = {};
    
    items.forEach((item: any) => {
      const billboardSize = details.billboardSizes?.[item.billboard_id];
      const displayWidth = billboardSize?.width || item.width;
      const displayHeight = billboardSize?.height || item.height;
      const sizeKey = `${displayWidth}×${displayHeight}`;
      
      const hasCutout = (item.cutout_quantity || 0) > 0;
      
      // ✅ تجميع الوجهين إذا كان لهما نفس صورة اللوحة ونفس الإحداثيات
      const billboardImage = item.billboard_image || item.billboard?.Image_URL || '';
      const gpsCoords = item.gps_coordinates || item.billboard?.GPS_Coordinates || '';
      const nearestLandmark = item.nearest_landmark || item.billboard?.Nearest_Landmark || '';
      
      // مفتاح التجميع الجديد: صورة اللوحة + الإحداثيات + المقاس + وجود مجسمات
      const groupKey = `${billboardImage || 'no-image'}_${gpsCoords || 'no-gps'}_${sizeKey}_${hasCutout}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          billboardImage,
          gpsCoords,
          nearestLandmark,
          displayWidth,
          displayHeight,
          sizeKey,
          items: [],
          designs: [], // قائمة التصاميم المختلفة
          totalQuantity: 0,
          totalArea: 0,
          totalCutouts: 0,
          totalCost: 0,
          billboardNames: new Set<string>()
        };
      }
      
      // جمع التصاميم المختلفة
      if (item.design_face_a && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_a)) {
        grouped[groupKey].designs.push({ image: item.design_face_a, face: 'أمامي' });
      }
      if (item.design_face_b && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_b)) {
        grouped[groupKey].designs.push({ image: item.design_face_b, face: 'خلفي' });
      }
      
      const itemArea = (item.area || ((displayWidth || 0) * (displayHeight || 0))) * (item.quantity || 1);
      grouped[groupKey].items.push(item);
      grouped[groupKey].totalQuantity += (item.quantity || 1);
      grouped[groupKey].totalArea += itemArea;
      grouped[groupKey].totalCutouts += (item.cutout_quantity || 0);
      
      // جمع أسماء اللوحات
      const billboardName = item.billboard_name || item.billboard?.Billboard_Name;
      if (billboardName) {
        grouped[groupKey].billboardNames.add(billboardName);
      }
    });
    
    // تحويل Set إلى Array
    return Object.values(grouped).map((g: any) => ({
      ...g,
      billboardNames: Array.from(g.billboardNames)
    }));
  };

  // دالة إنشاء جدول العناصر الافتراضية (Virtual Items)
  const generateVirtualItemsTable = (items: any[]): string => {
    return `
      <div class="items-section">
        <div class="section-title" style="background: #1e40af;">بنود الفاتورة</div>
        <table class="items-table" style="border-color: #1e40af;">
          <thead>
            <tr>
              <th style="width: 50%; background: #1e40af;">البند</th>
              <th style="width: 20%; background: #1e40af;">الكمية</th>
              <th style="width: 30%; background: #1e40af;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td style="text-align: right; padding: 12px;">
                  <strong>${item.description}</strong>
                  <br><span style="font-size: 9px; color: #666;">${item.description_en}</span>
                </td>
                <td style="text-align: center;"><strong>${item.quantity}</strong></td>
                <td style="text-align: center;"><strong>${Number(item.total).toLocaleString('ar-LY')} د.ل</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 9px; color: #856404;">
          ℹ️ هذه الفاتورة تم إنشاؤها من بيانات التكاليف الإجمالية. للحصول على تفاصيل اللوحات، يرجى مراجعة المهمة المجمّعة.
        </div>
      </div>
    `;
  };

  // تحديد الأعمدة المتوفرة (لإخفاء الفارغة)
  const hasPrintCost = (task.customer_print_cost || 0) > 0;
  const hasInstallationCost = (task.customer_installation_cost || 0) > 0;
  const hasCutoutCost = (task.customer_cutout_cost || 0) > 0;
  const hasAnyCutouts = invoiceItems.some((item: any) => (item.cutout_quantity || 0) > 0);

  // دالة إنشاء جدول العناصر
  const generateItemsTable = (items: any[], isInstallOnly: boolean, showDetails: boolean = true) => {
    // ✅ التحقق من العناصر الافتراضية أولاً
    if (items.length > 0 && items[0]?.type === 'virtual') {
      return generateVirtualItemsTable(items);
    }
    
    const sectionTitle = isInstallOnly ? 'تفاصيل التركيب' : 'تفاصيل الطباعة والمجسمات';
    
    let headerColumns = '';
    let rowIndex = 1;
    
    if (isInstallOnly) {
      // ✅ تحديث أعمدة التركيب لإضافة صورة اللوحة وأقرب نقطة دالة
      headerColumns = `
        <th style="width: 25px; background: #1e40af;">#</th>
        <th style="width: 55px; background: #1e40af;">صورة اللوحة</th>
        <th style="width: 70px; background: #1e40af;">التصاميم</th>
        <th style="width: 100px; background: #1e40af;">اللوحة</th>
        <th style="width: 90px; background: #1e40af;">أقرب نقطة دالة</th>
        <th style="width: 55px; background: #1e40af;">المقاس</th>
        <th style="width: 70px; background: #1e40af;">تكلفة التركيب</th>
      `;
    } else if (showDetails) {
      // ✅ بناء الأعمدة ديناميكياً مع إضافة صورة اللوحة وأقرب نقطة دالة
      headerColumns = `
        <th style="width: 25px; background: #1e40af;">#</th>
        <th style="width: 55px; background: #1e40af;">صورة اللوحة</th>
        <th style="width: 70px; background: #1e40af;">التصاميم</th>
        <th style="width: 90px; background: #1e40af;">أقرب نقطة دالة</th>
        <th style="width: 55px; background: #1e40af;">المقاس</th>
        <th style="width: 35px; background: #1e40af;">الكمية</th>
        <th style="width: 50px; background: #1e40af;">المساحة</th>
        ${hasPrintCost ? `<th style="width: 60px; background: #1e40af;">الطباعة<br><span style="font-size:6px;">(${pricePerMeter.toFixed(2)} د.ل/م²)</span></th>` : ''}
        ${hasAnyCutouts ? `<th style="width: 40px; background: #1e40af;">المجسمات</th>` : ''}
        ${hasCutoutCost && hasAnyCutouts ? `<th style="width: 55px; background: #1e40af;">تكلفة القص</th>` : ''}
        <th style="width: 65px; background: #1e40af;">الإجمالي</th>
      `;
    } else {
      // عرض مختصر مع صورة اللوحة
      headerColumns = `
        <th style="width: 25px; background: #1e40af;">#</th>
        <th style="width: 55px; background: #1e40af;">صورة اللوحة</th>
        <th style="width: 70px; background: #1e40af;">التصاميم</th>
        <th style="width: 90px; background: #1e40af;">أقرب نقطة دالة</th>
        <th style="width: 60px; background: #1e40af;">المقاس</th>
        <th style="width: 40px; background: #1e40af;">الكمية</th>
        <th style="width: 55px; background: #1e40af;">المساحة</th>
        <th style="width: 80px; background: #1e40af;">الإجمالي</th>
      `;
    }
    
    let rows = '';
    
    if (isInstallOnly) {
      // ✅ للتركيب: تجميع اللوحات ذات الوجهين مع نفس الصورة والإحداثيات
      const groupedItems = groupSimilarItems(items, isInstallOnly);
      
      rows = groupedItems.map((group: any, idx: number) => {
        // حساب إجمالي تكلفة التركيب للمجموعة
        const totalInstallCost = group.items.reduce((sum: number, item: any) => {
          return sum + (item.customer_installation_cost || installationCostPerItem);
        }, 0);
        
        // عرض التصاميم المختلفة
        const designsHTML = group.designs.length > 0 
          ? group.designs.map((d: any) => `
              <div style="margin-bottom: 3px; position: relative;">
                <img src="${d.image}" style="width: 100%; height: 45px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
                <span style="position: absolute; bottom: 1px; right: 1px; background: rgba(0,0,0,0.6); color: white; font-size: 6px; padding: 1px 3px; border-radius: 2px;">${d.face}</span>
              </div>
            `).join('')
          : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
        
        // أسماء اللوحات
        const billboardNamesStr = group.billboardNames.length > 0 
          ? group.billboardNames.slice(0, 2).join('، ') + (group.billboardNames.length > 2 ? ` +${group.billboardNames.length - 2}` : '')
          : 'لوحة';
        
        return `
          <tr>
            <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
            <td style="padding: 3px; vertical-align: middle;">
              ${group.billboardImage 
                ? `<img src="${group.billboardImage}" style="width: 100%; height: 55px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                : '<div style="text-align: center; color: #999; font-size: 8px;">بدون صورة</div>'}
            </td>
            <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
            <td style="vertical-align: middle;">
              <strong style="font-size: 10px;">${billboardNamesStr}</strong>
            </td>
            <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
              ${group.nearestLandmark 
                ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 50)}${group.nearestLandmark.length > 50 ? '...' : ''}</div>`
                : '<span style="color: #999;">-</span>'}
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: bold; font-size: 10px;">${group.displayWidth}×${group.displayHeight}</div>
              <div style="font-size: 7px; color: #666;">متر</div>
            </td>
            <td style="vertical-align: middle; background: #f0f9ff;">
              <strong style="font-size: 11px; color: #1e40af;">${Number(totalInstallCost).toLocaleString('ar-LY')}</strong>
              <div style="font-size: 7px; color: #666;">د.ل</div>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      // ✅ للطباعة: تجميع العناصر مع إضافة الأعمدة الجديدة
      const groupedItems = groupSimilarItems(items, isInstallOnly);
      
      rows = groupedItems.map((group: any, idx: number) => {
        const printCost = group.totalArea * pricePerMeter;
        const cutoutCostForGroup = group.totalCutouts * cutoutPricePerUnit;
        const itemTotal = printCost + cutoutCostForGroup;
        
        // عرض التصاميم المختلفة
        const designsHTML = group.designs.length > 0 
          ? group.designs.map((d: any) => `
              <div style="margin-bottom: 3px; position: relative;">
                <img src="${d.image}" style="width: 100%; height: 40px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
                <span style="position: absolute; bottom: 1px; right: 1px; background: rgba(0,0,0,0.6); color: white; font-size: 6px; padding: 1px 3px; border-radius: 2px;">${d.face}</span>
              </div>
            `).join('')
          : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
        
        if (showDetails) {
          return `
            <tr>
              <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
              <td style="padding: 3px; vertical-align: middle;">
                ${group.billboardImage 
                  ? `<img src="${group.billboardImage}" style="width: 100%; height: 50px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                  : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
              </td>
              <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
              <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
                ${group.nearestLandmark 
                  ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 40)}${group.nearestLandmark.length > 40 ? '...' : ''}</div>`
                  : '<span style="color: #999;">-</span>'}
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: bold; font-size: 10px;">${group.displayWidth}×${group.displayHeight}</div>
                <div style="font-size: 7px; color: #666;">متر</div>
              </td>
              <td style="vertical-align: middle;"><strong>×${group.totalQuantity}</strong></td>
              <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
              ${hasPrintCost ? `<td style="vertical-align: middle;"><strong style="font-size: 9px;">${printCost.toFixed(0)} د.ل</strong></td>` : ''}
              ${hasAnyCutouts ? `
              <td style="vertical-align: middle;">
                ${group.totalCutouts > 0 
                  ? '<div class="cutout-badge">×' + group.totalCutouts + '</div>' 
                  : '<span class="no-cutout">-</span>'}
              </td>
              ` : ''}
              ${hasCutoutCost && hasAnyCutouts ? `
              <td style="vertical-align: middle;">
                ${group.totalCutouts > 0 
                  ? '<strong style="font-size: 9px;">' + cutoutCostForGroup.toFixed(0) + ' د.ل</strong>' 
                  : '<span class="no-cutout">-</span>'}
              </td>
              ` : ''}
              <td style="vertical-align: middle; background: #f0f9ff;">
                <strong style="font-size: 10px; color: #1e40af;">${itemTotal.toFixed(0)}</strong>
                <div style="font-size: 7px; color: #666;">د.ل</div>
              </td>
            </tr>
          `;
        } else {
          // عرض مبسط مع الأعمدة الجديدة
          return `
            <tr>
              <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
              <td style="padding: 3px; vertical-align: middle;">
                ${group.billboardImage 
                  ? `<img src="${group.billboardImage}" style="width: 100%; height: 50px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                  : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
              </td>
              <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
              <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
                ${group.nearestLandmark 
                  ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 40)}${group.nearestLandmark.length > 40 ? '...' : ''}</div>`
                  : '<span style="color: #999;">-</span>'}
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: bold; font-size: 10px;">${group.displayWidth}×${group.displayHeight}</div>
                <div style="font-size: 7px; color: #666;">متر</div>
              </td>
              <td style="vertical-align: middle;"><strong>×${group.totalQuantity}</strong></td>
              <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
              <td style="vertical-align: middle; background: #f0f9ff;">
                <strong style="font-size: 10px; color: #1e40af;">${itemTotal.toFixed(0)}</strong>
                <div style="font-size: 7px; color: #666;">د.ل</div>
              </td>
            </tr>
          `;
        }
      }).join('');
    }
    
    return `
      <div class="items-section">
        <div class="section-title" style="background: #1e40af;">${sectionTitle}</div>
        <table class="items-table" style="border-color: #1e40af;">
          <thead>
            <tr>${headerColumns}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  // تقسيم العناصر إلى صفحات
  // كل صف في الجدول يأخذ حوالي 50px (13mm)
  // ارتفاع المحتوى المتاح في الصفحة: حوالي 200mm (بعد طرح الترويسة والهوامش)
  // قسم التكاليف يأخذ حوالي 120px (32mm)
  // إذاً يمكننا وضع حوالي 12-13 صف في الصفحة الأولى
  // وحوالي 15 صف في الصفحات التالية
  // ولكن الصفحة الأخيرة يجب أن تحتوي على عنصر واحد على الأقل مع قسم التكاليف
  
  const ITEMS_PER_FIRST_PAGE = 18;
  const ITEMS_PER_PAGE = 20;
  const MIN_ITEMS_ON_LAST_PAGE = 1;

  const pages: any[][] = [];
  let currentPage: any[] = [];

  invoiceItems.forEach((item: any, index: number) => {
    // حساب الحد الأقصى للعناصر في الصفحة الحالية
    // الصفحة الأولى لها حد أقصى مختلف
    const isFirstPage = pages.length === 0;
    const maxItems = isFirstPage ? ITEMS_PER_FIRST_PAGE : ITEMS_PER_PAGE;
    
    // عدد العناصر المتبقية
    const remainingItems = invoiceItems.length - index;
    
    // إذا وصلنا للحد الأقصى ولا يزال هناك عناصر كافية
    if (currentPage.length >= maxItems && remainingItems > MIN_ITEMS_ON_LAST_PAGE) {
      pages.push([...currentPage]);
      currentPage = [];
    }
    
    currentPage.push(item);
  });

  // إضافة الصفحة الأخيرة
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // إذا لم تكن هناك عناصر، نضيف صفحة فارغة
  if (pages.length === 0) {
    pages.push([]);
  }

  const totalPages = pages.length;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مجمعة - ${task.customer_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      font-family: 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
      font-size: 10px;
      line-height: 1.3;
    }
    
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    
    .page {
      width: 190mm;
      min-height: 277mm;
      padding: 0;
      page-break-after: always;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 12px;
    }
    
    .invoice-info {
      text-align: left;
      direction: ltr;
    }
    
    .invoice-title {
      font-size: 22px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 6px;
    }
    
    .invoice-subtitle {
      font-size: 12px;
      color: #666;
      font-weight: bold;
      margin-bottom: 6px;
    }
    
    .invoice-details {
      font-size: 10px;
      color: #666;
      line-height: 1.4;
    }
    
    .company-info {
      text-align: right;
    }
    
    .company-logo {
      max-width: 200px;
      height: auto;
      object-fit: contain;
    }

    .customer-section {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      border: 2px solid #1e40af;
    }

    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: white;
      margin-bottom: 10px;
      text-align: center;
      background: #1e40af;
      padding: 6px;
      border-radius: 4px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .info-box {
      background: white;
      padding: 6px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    .info-label {
      font-size: 9px;
      color: #666;
      font-weight: bold;
      margin-bottom: 3px;
    }

    .info-value {
      font-size: 11px;
      color: #000;
      font-weight: bold;
    }

    .items-section {
      margin-bottom: 15px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }

    .items-table th {
      background: #1e40af;
      color: #fff;
      font-weight: bold;
      padding: 6px 4px;
      text-align: center;
      border: 1px solid #1e40af;
      font-size: 9px;
    }

    .items-table td {
      padding: 5px 3px;
      border: 1px solid #93c5fd;
      text-align: center;
      vertical-align: middle;
    }

    .items-table tbody tr:nth-child(even) {
      background: #f0f9ff;
    }

    .design-image {
      max-width: 40px;
      max-height: 40px;
      object-fit: contain;
      margin: 0 auto;
      display: block;
      border: 1px solid #93c5fd;
      border-radius: 3px;
    }

    .cutout-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: bold;
      margin-top: 2px;
    }

    .no-cutout {
      color: #999;
      font-size: 8px;
    }

    .cost-section {
      background: #f0f9ff;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 10px;
      border: 2px solid #93c5fd;
    }

    .cost-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }

    .cost-item {
      background: white;
      padding: 6px;
      border-radius: 4px;
      border: 1px solid #93c5fd;
      text-align: center;
    }

    .cost-label {
      font-size: 8px;
      color: #1e40af;
      margin-bottom: 2px;
    }

    .cost-value {
      font-size: 12px;
      font-weight: bold;
      color: #1e40af;
    }

    .total-section {
      background: #1e40af;
      color: white;
      padding: 8px;
      text-align: center;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
    }

    .page-footer {
      position: fixed;
      bottom: 10mm;
      left: 10mm;
      right: 10mm;
      padding-top: 8px;
      border-top: 2px solid #1e40af;
      text-align: center;
      font-size: 8px;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-number {
      background: #1e40af;
      color: white;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
    }

    .footer-text {
      flex: 1;
      text-align: center;
    }

    .content-wrapper {
      padding-bottom: 50px;
      min-height: calc(277mm - 60px);
    }

    @media print {
      html, body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      
      .page {
        page-break-after: always;
        page-break-inside: avoid;
      }
      
      .items-table {
        page-break-inside: auto;
      }
      
      .items-table tr {
        page-break-inside: avoid;
      }
      
      .cost-section, .total-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${pages.map((pageItems: any[], pageIndex: number) => `
  <div class="page">
    <div class="content-wrapper">
      <div class="page-header">
        <div class="invoice-info">
          <div class="invoice-title">${invoiceTitle.ar}</div>
          <div class="invoice-subtitle">${invoiceTitle.en}</div>
          <div class="invoice-details">
            <div><strong>التاريخ:</strong> ${invoiceDate}</div>
            <div><strong>${details.contractsInfo?.length > 1 ? 'أرقام العقود:' : 'رقم العقد:'}</strong> ${details.contractsInfo?.length > 1 ? details.contractsInfo.map((c: any) => '#' + c.contractId).join(', ') : '#' + task.contract_id}</div>
            <div><strong>نوع المهمة:</strong> ${task.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}</div>
          </div>
        </div>
        <div class="company-info">
          <img src="${logoDataUri}" alt="شعار الشركة" class="company-logo">
        </div>
      </div>

      ${pageIndex === 0 ? `
      <div class="customer-section">
        <div class="section-title">معلومات العميل</div>
        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">اسم العميل:</div>
            <div class="info-value">${task.customer_name || 'غير محدد'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">${details.contractsInfo?.length > 1 ? 'أرقام العقود:' : 'رقم العقد:'}</div>
            <div class="info-value">${details.contractsInfo?.length > 1 ? details.contractsInfo.map((c: any) => '#' + c.contractId).join(', ') : '#' + task.contract_id}</div>
          </div>
          <div class="info-box">
            <div class="info-label">تاريخ الفاتورة:</div>
            <div class="info-value">${invoiceDate}</div>
          </div>
        </div>
        ${details.contractsInfo?.length > 0 ? `
        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${details.contractsInfo.map((c: any) => `
            <div style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; font-size: 10px; border: 1px solid #93c5fd;">
              <strong>#${c.contractId}:</strong> ${c.adType}
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${pageItems.length > 0 ? (displayMode === 'summary' ? generateSummarySection(task, details, invoiceTitle, pricePerMeter) : generateItemsTable(pageItems, isInstallationOnly, showDetails)) : ''}

      ${pageIndex === totalPages - 1 ? `
      <div class="cost-section">
        ${displayMode === 'detailed' && showDetails ? `
        <div class="section-title">ملخص التكاليف</div>
        <div class="cost-grid">
          ${task.customer_installation_cost > 0 || task.task_type === 'new_installation' ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة التركيب</div>
            <div class="cost-value">
              ${task.customer_installation_cost > 0 ? task.customer_installation_cost.toLocaleString('ar-LY') + ' د.ل' : 'مجاناً'}
            </div>
          </div>
          ` : ''}
          
          ${task.customer_print_cost > 0 ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة الطباعة (${totalArea.toFixed(2)} م² × ${pricePerMeter.toFixed(2)})</div>
            <div class="cost-value">${task.customer_print_cost.toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
          
          ${totalCutouts > 0 ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة القص (${totalCutouts} مجسم × ${cutoutPricePerUnit.toFixed(2)} د.ل)</div>
            <div class="cost-value">${task.customer_cutout_cost.toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
          
          ${(task.discount_amount || 0) > 0 ? `
          <div class="cost-item" style="border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px;">
            <div class="cost-label" style="color: #dc2626;">
              خصم ${task.discount_reason ? '(' + task.discount_reason + ')' : ''}
            </div>
            <div class="cost-value" style="color: #dc2626;">- ${(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div class="total-section">
          الإجمالي المطلوب: ${((task.customer_total || 0) - (task.discount_amount || 0)).toLocaleString('ar-LY')} دينار ليبي
        </div>
      </div>
      ` : ''}
    </div>

    <div class="page-footer">
      <div class="footer-text">
        <strong>شكراً لتعاملكم معنا</strong> | هذه الفاتورة تم إنشاؤها تلقائياً من نظام إدارة اللوحات
      </div>
      <div class="page-number">${totalPages > 1 ? `صفحة ${pageIndex + 1} من ${totalPages}` : ''}</div>
    </div>
  </div>
  `).join('')}
</body>
</html>
  `;
}
