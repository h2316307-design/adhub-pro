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

export function CompositeTaskInvoicePrint({ task }: CompositeTaskInvoicePrintProps) {
  const [taskDetails, setTaskDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // خيار إظهار التفاصيل
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
      const rawContractIds = installResult.data?.contract_ids && (installResult.data.contract_ids as number[]).length > 0
        ? (installResult.data.contract_ids as number[])
        : [installResult.data?.contract_id || task.contract_id];
      
      const uniqueContractIds: number[] = [...new Set(rawContractIds.filter((id): id is number => id != null && typeof id === 'number'))];
      
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
      if (installResult.data?.installation_task_items?.length > 0) {
        const installItems = installResult.data.installation_task_items;
        const billboardIds = installItems
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size, Billboard_Name, design_face_a, design_face_b, Image_URL')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.installationBillboards = {};
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              const contractDesign = contractDesignMap[String(b.ID)] || {};
              
              // استخدام التصميم من العقد أولاً، ثم من اللوحة، ثم صورة اللوحة
              const designA = contractDesign.designFaceA || b.design_face_a || contractDesign.billboardImage || b.Image_URL;
              const designB = contractDesign.designFaceB || b.design_face_b;
              
              details.installationBillboards[b.ID] = {
                name: b.Billboard_Name,
                size: b.Size,
                width: sizeInfo?.width,
                height: sizeInfo?.height,
                design_face_a: designA,
                design_face_b: designB,
                location: contractDesign.billboardLocation
              };
            });
          }
        }
        
        // بناء قائمة عناصر التركيب مع بيانات اللوحات
        details.installationItems = installItems.map((item: any) => {
          const billboard = details.installationBillboards?.[item.billboard_id] || {};
          return {
            ...item,
            billboard_name: billboard.name,
            billboard_size: billboard.size,
            width: billboard.width,
            height: billboard.height,
            design_face_a: item.design_face_a || billboard.design_face_a,
            design_face_b: item.design_face_b || billboard.design_face_b,
            location: billboard.location
          };
        });
      }
      
      // إذا وجدت عناصر الطباعة، نجلب بيانات اللوحات للحصول على المقاسات الفعلية
      if (printResult.data?.print_task_items?.length > 0) {
        const billboardIds = printResult.data.print_task_items
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.billboardSizes = {};
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              details.billboardSizes[b.ID] = sizeInfo || { width: null, height: null };
            });
          }
        }
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

    const invoiceHTML = generateInvoiceHTML(task, taskDetails, showDetails, logo);

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

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">خيارات الطباعة</h4>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox 
                id="showDetails" 
                checked={showDetails}
                onCheckedChange={(checked) => setShowDetails(checked as boolean)}
              />
              <Label htmlFor="showDetails" className="text-sm cursor-pointer">
                إظهار التفاصيل (طباعة، قص، تركيب)
              </Label>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button 
        onClick={handlePrint} 
        variant="outline" 
        size="sm"
        disabled={loading || !taskDetails}
      >
        <Printer className="h-4 w-4 mr-2" />
        {loading ? 'جاري التحميل...' : 'طباعة فاتورة الزبون'}
      </Button>
    </div>
  );
}

function generateInvoiceHTML(task: CompositeTaskWithDetails, details: any, showDetails: boolean = true, logoDataUri: string = ''): string {
  const invoiceDate = task.invoice_date 
    ? format(new Date(task.invoice_date), 'dd MMMM yyyy', { locale: ar })
    : format(new Date(), 'dd MMMM yyyy', { locale: ar });

  const printItems = details.print?.print_task_items || [];
  const installationItems = details.installationItems || [];
  
  // تحديد إذا كانت فاتورة تركيب فقط (بدون طباعة)
  const isInstallationOnly = printItems.length === 0 && installationItems.length > 0;
  
  // العناصر المستخدمة في الفاتورة
  const invoiceItems = isInstallationOnly ? installationItems : printItems;
  
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

  // دالة تجميع العناصر المتشابهة (نفس التصميم + المقاس + نوع الوجه + وجود مجسمات)
  const groupSimilarItems = (items: any[], isInstallOnly: boolean) => {
    const grouped: Record<string, any> = {};
    
    items.forEach((item: any) => {
      const billboardSize = details.billboardSizes?.[item.billboard_id];
      const displayWidth = billboardSize?.width || item.width;
      const displayHeight = billboardSize?.height || item.height;
      const sizeKey = `${displayWidth}×${displayHeight}`;
      
      const isBackFace = item.design_face_b && !item.design_face_a;
      const designImage = isBackFace ? item.design_face_b : item.design_face_a;
      const faceLabel = isBackFace ? 'خلفي' : 'أمامي';
      const hasCutout = (item.cutout_quantity || 0) > 0;
      
      // مفتاح التجميع: التصميم + المقاس + نوع الوجه + وجود مجسمات
      const groupKey = `${designImage || 'no-design'}_${sizeKey}_${faceLabel}_${hasCutout}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          designImage,
          faceLabel,
          displayWidth,
          displayHeight,
          sizeKey,
          items: [],
          totalQuantity: 0,
          totalArea: 0,
          totalCutouts: 0,
          totalCost: 0
        };
      }
      
      const itemArea = item.area * item.quantity;
      grouped[groupKey].items.push(item);
      grouped[groupKey].totalQuantity += item.quantity;
      grouped[groupKey].totalArea += itemArea;
      grouped[groupKey].totalCutouts += (item.cutout_quantity || 0);
    });
    
    return Object.values(grouped);
  };

  // دالة إنشاء جدول العناصر
  const generateItemsTable = (items: any[], isInstallOnly: boolean, showDetails: boolean = true) => {
    const sectionTitle = isInstallOnly ? 'تفاصيل التركيب' : 'تفاصيل الطباعة والمجسمات';
    
    let headerColumns = '';
    if (isInstallOnly) {
      headerColumns = `
        <th style="width: 50px;">التصميم</th>
        <th style="width: 150px;">اللوحة</th>
        <th style="width: 70px;">المقاس</th>
        <th style="width: 100px;">تكلفة التركيب</th>
      `;
    } else if (showDetails) {
      // عرض كل الأعمدة عند تفعيل التفاصيل
      headerColumns = `
        <th style="width: 50px;">التصميم</th>
        <th style="width: 70px;">المقاس</th>
        <th style="width: 40px;">الكمية</th>
        <th style="width: 60px;">المساحة</th>
        <th style="width: 60px;">سعر المتر</th>
        <th style="width: 70px;">تكلفة الطباعة</th>
        <th style="width: 50px;">المجسمات</th>
        <th style="width: 70px;">تكلفة القص</th>
        <th style="width: 80px;">الإجمالي</th>
      `;
    } else {
      // عرض مختصر: إخفاء تكلفة الطباعة والقص وسعر المتر والمجسمات
      headerColumns = `
        <th style="width: 70px;">التصميم</th>
        <th style="width: 90px;">المقاس</th>
        <th style="width: 60px;">الكمية</th>
        <th style="width: 80px;">المساحة</th>
        <th style="width: 120px;">الإجمالي</th>
      `;
    }
    
    let rows = '';
    
    if (isInstallOnly) {
      // للتركيب: نعرض كل عنصر بشكل منفصل
      rows = items.map((item: any) => {
        const designImage = item.design_face_a || item.design_face_b;
        const faceLabel = item.design_face_b && !item.design_face_a ? 'خلفي' : 'أمامي';
        const itemCost = item.customer_installation_cost || installationCostPerItem;
        
        return `
          <tr>
            <td>
              ${designImage ? '<img src="' + designImage + '" class="design-image" onerror="this.style.display=\'none\'" />' : '-'}
              ${designImage ? '<div style="font-size:7px;color:#666;text-align:center;margin-top:2px;">' + faceLabel + '</div>' : ''}
            </td>
            <td><strong>${item.billboard_name || 'لوحة'}</strong></td>
            <td><strong>${(item.width || '-') + '×' + (item.height || '-')} م</strong></td>
            <td><strong>${Number(itemCost).toFixed(2)} د.ل</strong></td>
          </tr>
        `;
      }).join('');
    } else {
      // للطباعة: تجميع العناصر المتشابهة
      const groupedItems = groupSimilarItems(items, isInstallOnly);
      
      rows = groupedItems.map((group: any) => {
        const printCost = group.totalArea * pricePerMeter;
        const cutoutCostForGroup = group.totalCutouts * cutoutPricePerUnit;
        const itemTotal = printCost + cutoutCostForGroup;
        
        if (showDetails) {
          return `
            <tr>
              <td>
                ${group.designImage ? '<img src="' + group.designImage + '" class="design-image" onerror="this.style.display=\'none\'" />' : '-'}
                ${group.designImage ? '<div style="font-size:7px;color:#666;text-align:center;margin-top:2px;">' + group.faceLabel + '</div>' : ''}
              </td>
              <td><strong>${group.displayWidth}×${group.displayHeight} م</strong></td>
              <td><strong>×${group.totalQuantity}</strong></td>
              <td>${group.totalArea.toFixed(2)} م²</td>
              <td>${pricePerMeter.toFixed(2)} د.ل</td>
              <td><strong>${printCost.toFixed(2)} د.ل</strong></td>
              <td>
                ${group.totalCutouts > 0 
                  ? '<div class="cutout-badge">×' + group.totalCutouts + '</div>' 
                  : '<span class="no-cutout">لا يوجد</span>'}
              </td>
              <td>
                ${group.totalCutouts > 0 
                  ? '<strong>' + cutoutCostForGroup.toFixed(2) + ' د.ل</strong><br><span style="font-size:7px;color:#666">(' + cutoutPricePerUnit.toFixed(2) + ' د.ل × ' + group.totalCutouts + ')</span>' 
                  : '<span class="no-cutout">-</span>'}
              </td>
              <td><strong>${itemTotal.toFixed(2)} د.ل</strong></td>
            </tr>
          `;
        } else {
          // عرض مبسط بدون تفاصيل الطباعة والقص
          return `
            <tr>
              <td>
                ${group.designImage ? '<img src="' + group.designImage + '" class="design-image" onerror="this.style.display=\'none\'" />' : '-'}
                ${group.designImage ? '<div style="font-size:7px;color:#666;text-align:center;margin-top:2px;">' + group.faceLabel + '</div>' : ''}
              </td>
              <td><strong>${group.displayWidth}×${group.displayHeight} م</strong></td>
              <td><strong>×${group.totalQuantity}</strong></td>
              <td>${group.totalArea.toFixed(2)} م²</td>
              <td><strong>${itemTotal.toFixed(2)} د.ل</strong></td>
            </tr>
          `;
        }
      }).join('');
    }
    
    return `
      <div class="items-section">
        <div class="section-title">${sectionTitle}</div>
        <table class="items-table">
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
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
    }
    
    .invoice-info {
      text-align: left;
      direction: ltr;
    }
    
    .invoice-title {
      font-size: 22px;
      font-weight: bold;
      color: #000;
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
      border: 2px solid #000;
    }

    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: white;
      margin-bottom: 10px;
      text-align: center;
      background: #000;
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
      background: #000;
      color: #fff;
      font-weight: bold;
      padding: 6px 4px;
      text-align: center;
      border: 1px solid #000;
      font-size: 9px;
    }

    .items-table td {
      padding: 5px 3px;
      border: 1px solid #ddd;
      text-align: center;
      vertical-align: middle;
    }

    .items-table tbody tr:nth-child(even) {
      background: #f8f9fa;
    }

    .design-image {
      max-width: 40px;
      max-height: 40px;
      object-fit: contain;
      margin: 0 auto;
      display: block;
      border: 1px solid #ddd;
      border-radius: 3px;
    }

    .cutout-badge {
      display: inline-block;
      background: #fee2e2;
      color: #dc2626;
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
      background: #f8f9fa;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 10px;
      border: 2px solid #ddd;
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
      border: 1px solid #ddd;
      text-align: center;
    }

    .cost-label {
      font-size: 8px;
      color: #666;
      margin-bottom: 2px;
    }

    .cost-value {
      font-size: 12px;
      font-weight: bold;
      color: #000;
    }

    .total-section {
      background: #000;
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
      border-top: 2px solid #000;
      text-align: center;
      font-size: 8px;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-number {
      background: #000;
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
          <div class="invoice-title">فاتورة مجمعة</div>
          <div class="invoice-subtitle">Composite Task Invoice</div>
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
            <div style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 10px;">
              <strong>#${c.contractId}:</strong> ${c.adType}
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${pageItems.length > 0 ? generateItemsTable(pageItems, isInstallationOnly, showDetails) : ''}

      ${pageIndex === totalPages - 1 ? `
      <div class="cost-section">
        ${showDetails ? `
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
