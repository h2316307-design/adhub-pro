import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye } from 'lucide-react';
import { ContractData } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { groupRepeatingPayments, Installment } from '@/utils/paymentGrouping';

// دالة تنسيق التاريخ للعرض
const formatDateForPrint = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// دالة لتحويل الأرقام إلى عربية لحل مشكلة RTL
const toArabicNumbers = (str: string): string => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (d) => arabicNums[parseInt(d)]);
};

// علامة عربية تساعد على تثبيت اتجاه النص عند بداية السطر بأرقام/تواريخ
const ALM = '\u061C';
const rtlSafe = (text: string) => `${ALM}${text}`;

// دالة تنسيق ملخص الدفعات للطباعة - تُرجع مصفوفة أسطر
// القاعدة المطلوبة:
// - دائماً اعرض أول 3 دفعات بالتفصيل
// - بعد ذلك: اجمع الدفعات المتبقية إن كانت متكررة (نفس المبلغ) لتصبح مختصرة
const formatPaymentsForPrintLines = (
  installmentsData: string | null,
  detailCount: number = 3
): string[] => {
  if (!installmentsData) return ['دفعة واحدة عند التوقيع'];

  try {
    const raw: any[] = JSON.parse(installmentsData);
    const installments: Installment[] = Array.isArray(raw) ? raw : [];
    if (installments.length === 0) return ['دفعة واحدة عند التوقيع'];

    const currencySymbol = 'د.ل';

    const normalize = (inst: any, idx: number): Installment => {
      const amount = Number(inst?.amount ?? 0) || 0;
      const paymentType = String(inst?.paymentType ?? inst?.type ?? inst?.payment_type ?? '').trim();
      const description = String(inst?.description ?? inst?.desc ?? '').trim();
      const dueDate = String(inst?.dueDate ?? inst?.due_date ?? '').trim();
      return {
        amount,
        paymentType,
        description: description || `الدفعة ${idx + 1}`,
        dueDate
      };
    };

    const normalized = installments.map(normalize);
    const head = normalized.slice(0, Math.min(detailCount, normalized.length));
    const tail = normalized.slice(Math.min(detailCount, normalized.length));

    const lines: string[] = [];

    // 1) أول 3 دفعات تفصيلاً
    head.forEach((inst, index) => {
      const dateFormatted = formatDateForPrint(inst.dueDate);
      const amount = Number(inst.amount).toLocaleString('ar-LY');
      const typeLabel = inst.paymentType ? `(${inst.paymentType})` : '';
      const descLabel = inst.description ? `- ${inst.description}` : '';
      lines.push(
        rtlSafe(
          `الدفعة ${toArabicNumbers(String(index + 1))}: ${toArabicNumbers(amount)} ${currencySymbol} ${typeLabel} ${descLabel} - تاريخ: ${toArabicNumbers(dateFormatted)}`
            .replace(/\s+/g, ' ')
            .trim()
        )
      );
    });

    // 2) باقي الدفعات مختصرة (تجميع المتكرر)
    if (tail.length > 0) {
      const tailGroups = groupRepeatingPayments(tail);
      tailGroups.forEach((g) => {
        if (g.isGrouped) {
          const total = (Number(g.amount.replace(/,/g, '')) * g.count).toLocaleString('ar-LY');
          lines.push(
            rtlSafe(
              `باقي الدفعات: ${toArabicNumbers(String(g.count))} دفعات × ${toArabicNumbers(g.amount)} ${currencySymbol} = ${toArabicNumbers(total)} ${currencySymbol} (من ${toArabicNumbers(formatDateForPrint(g.startDate))} إلى ${toArabicNumbers(formatDateForPrint(g.endDate))})`
            )
          );
        } else {
          const inst = g.originalInstallments[0];
          lines.push(
            rtlSafe(
              `باقي الدفعات: ${toArabicNumbers(Number(inst.amount).toLocaleString('ar-LY'))} ${currencySymbol} ${inst.paymentType ? `(${inst.paymentType})` : ''} - تاريخ: ${toArabicNumbers(formatDateForPrint(inst.dueDate))}`
            )
          );
        }
      });
    }

    return lines;
  } catch (e) {
    console.error('Error parsing installments for print:', e);
    return ['دفعة واحدة عند التوقيع'];
  }
};

// دالة تنسيق ملخص الدفعات للطباعة - تُرجع نص واحد
const formatPaymentsForPrint = (installmentsData: string | null): string => {
  return formatPaymentsForPrintLines(installmentsData).join(' | ');
};

interface ContractPrintDialogProps {
  contract: ContractData;
  trigger?: React.ReactNode;
}

export function ContractPrintDialog({ contract, trigger }: ContractPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Function to get billboard image from contract
  const getBillboardImage = (contract: ContractData): string => {
    if (!contract?.billboards || contract.billboards.length === 0) {
      return '';
    }
    
    for (const billboard of contract.billboards) {
      const image = billboard.image || billboard.Image || billboard.billboard_image || (billboard as any).Image_URL || (billboard as any)['@IMAGE'] || (billboard as any).image_url;
      if (image && typeof image === 'string' && image.trim() !== '') {
        return image;
      }
    }
    
    return '';
  };

  // Function to extract contract data
  const extractContractData = (contract: ContractData) => {
    const contractNumber = contract.Contract_Number || contract.id || '';
    const customerName = contract.customer_name || contract['Customer Name'] || '';
    const adType = contract.ad_type || contract['Ad Type'] || 'عقد إيجار لوحات إعلانية';
    const startDate = contract.start_date || contract['Contract Date'] || '';
    const endDate = contract.end_date || contract['End Date'] || '';
    const totalCost = contract.rent_cost || contract['Total Rent'] || (contract as any).Total || 0;
    
    // ✅ استخراج معلومات التخفيض من جميع المصادر الممكنة
    const contractAny = contract as any;
    
    // البحث في جميع الحقول المحتملة للتخفيض
    let discountNum = 0;
    
    // 1. حقل Discount المباشر (من حفظ العقد)
    if (contractAny.Discount !== undefined && contractAny.Discount !== null) {
      discountNum = Number(contractAny.Discount);
    } else if (contractAny.discount !== undefined && contractAny.discount !== null) {
      discountNum = Number(contractAny.discount);
    }
    
    // 2. حساب التخفيض من level_discounts إذا كان موجوداً ولم يكن هناك تخفيض مباشر
    if (discountNum === 0 && contractAny.level_discounts && typeof contractAny.level_discounts === 'object') {
      // هذا تخفيض حسب المستوى - نحسب إجمالي التخفيض
      const levelDiscounts = contractAny.level_discounts as Record<string, number>;
      const billboards = contract.billboards || [];
      
      if (billboards.length > 0 && Object.keys(levelDiscounts).length > 0) {
        let totalDiscountAmount = 0;
        
        billboards.forEach((billboard: any) => {
          const level = billboard.level || billboard.Level || billboard.billboard_level || '';
          const discountPercent = levelDiscounts[level] || 0;
          const billboardPrice = Number(billboard.price_after_discount || billboard.total_price || billboard.price || 0);
          
          if (discountPercent > 0 && billboardPrice > 0) {
            // إعادة حساب السعر الأصلي قبل الخصم
            const originalPrice = billboardPrice / (1 - discountPercent / 100);
            totalDiscountAmount += originalPrice - billboardPrice;
          }
        });
        
        discountNum = totalDiscountAmount;
      }
    }
    
    // 3. حساب التخفيض من الفرق بين السعر الكلي والمجموع
    if (discountNum === 0 && contract.billboards && contract.billboards.length > 0) {
      const billboardsTotal = contract.billboards.reduce((sum: number, b: any) => {
        return sum + Number(b.total_price_before_discount || b.price_before_discount || 0);
      }, 0);
      
      if (billboardsTotal > 0 && billboardsTotal > totalCost) {
        discountNum = billboardsTotal - totalCost;
      }
    }
    
    let discountText = '';
    
    // التحقق من أن الخصم ليس تكلفة الطباعة
    const printCostEnabled = Boolean(
      contractAny.print_cost_enabled === true ||
      contractAny.print_cost_enabled === 1 ||
      contractAny.print_cost_enabled === 'true' ||
      contractAny.print_cost_enabled === '1'
    );
    const printCost = Number(contractAny.print_cost ?? 0);
    
    // إذا لم يكن الخصم يساوي تكلفة الطباعة، نعتبره خصماً حقيقياً
    if (discountNum > 0 && !isNaN(discountNum) && !(printCostEnabled && printCost > 0 && discountNum === printCost)) {
      discountText = `بعد خصم ${Math.round(discountNum).toLocaleString('ar-LY')} دينار ليبي`;
    }
    
    // Get installments data
    const installmentsData = (contract as any).installments_data || null;
    const paymentsText = formatPaymentsForPrint(installmentsData);
    const paymentsLines = formatPaymentsForPrintLines(installmentsData);
    
    // Calculate duration in days
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${durationDays}`;
    }
    
    // Format price
    const formattedPrice = `${totalCost.toLocaleString('ar-LY')}`;
    
    // Format dates with Arabic month names
    const formatArabicDate = (dateString: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      const day = toArabicNumbers(String(date.getDate()));
      const month = arabicMonths[date.getMonth()];
      const year = toArabicNumbers(String(date.getFullYear()));
      return rtlSafe(`${day} ${month} ${year}`);
    };
    const formattedStartDate = startDate ? formatArabicDate(startDate) : formatArabicDate(new Date().toISOString());
    const formattedEndDate = endDate ? formatArabicDate(endDate) : '';
    
    // Get year from start date
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    
    // Get billboard count
    const billboardCount = contract.billboards ? contract.billboards.length : 0;
    const billboardInfo = billboardCount > 0 ? ` (${billboardCount} لوحة إعلانية)` : '';
    
    return {
      contractNumber: contractNumber.toString(),
      customerName: customerName,
      adType: adType + billboardInfo,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      price: formattedPrice,
      duration: duration,
      year: year.toString(),
      companyName: '',
      phoneNumber: '',
      billboardImage: getBillboardImage(contract),
      payments: paymentsText,
      paymentsLines: paymentsLines,
      discountText: discountText // ✅ إضافة نص التخفيض
    };
  };

  const handlePrintContract = async () => {
    try {
      setIsGenerating(true);

      // Extract contract data
      const contractData = extractContractData(contract);

      // Normalize billboards and build table pages for printing
      const billboards: any[] = Array.isArray(contract.billboards) ? contract.billboards : [];

      // Get contract dates for billboards
      const contractStartDate = contract.start_date || contract['Contract Date'] || '';
      const contractEndDate = contract.end_date || contract['End Date'] || '';

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(
          b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? ''
        );
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.Rent ?? b.rent_cost ?? b['Total Rent'];
        const price =
          typeof priceVal === 'number'
            ? `${priceVal.toLocaleString('ar-LY')} د.ل`
            : (typeof priceVal === 'string' && priceVal.trim() !== '' ? priceVal : '');
        
        // Get end date - ALWAYS use contract end date for consistency
        const endDateRaw = contractEndDate || b.Rent_End_Date || b.rent_end_date || b.end_date || '';
        const endDate = endDateRaw ? formatDateForPrint(endDateRaw) : '';
        
        // حساب عدد الأيام من تواريخ العقد مباشرة (المصدر الوحيد للحقيقة)
        // نستخدم تواريخ العقد فقط وليس بيانات اللوحة لضمان التزامن
        let daysCount = '';
        if (contractStartDate && contractEndDate) {
          const start = new Date(contractStartDate);
          const end = new Date(contractEndDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            daysCount = days > 0 ? String(days) : '';
          }
        }
        // Fallback فقط إذا لم تتوفر تواريخ العقد
        if (!daysCount && !contractStartDate && !contractEndDate) {
          const startDateRaw = b.Rent_Start_Date || b.rent_start_date || b.start_date || '';
          const endDateRaw = b.Rent_End_Date || b.rent_end_date || b.end_date || '';
          if (startDateRaw && endDateRaw) {
            const start = new Date(startDateRaw);
            const end = new Date(endDateRaw);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              daysCount = days > 0 ? String(days) : '';
            }
          }
        }
        
        let coords: string = String(
          b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? ''
        );
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        return { id, image, municipality, district, landmark, size, faces, price, endDate, daysCount, mapLink };
      };

      const normalizedRows = billboards.map(normalizeBillboard);

      // Build installments table HTML - flow-based for auto pagination
      const installmentsData = (contract as any).installments_data || null;
      let installmentsTableHtml = '';
      if (installmentsData) {
        try {
          const installments: Installment[] = JSON.parse(installmentsData);
          if (installments && installments.length > 0) {
            installmentsTableHtml = `
              <div class="flow-table-section">
                <h2 class="table-title">جدول الدفعات</h2>
                <table class="flow-table payments-table" dir="rtl">
                  <thead>
                    <tr>
                      <th style="width: 15%;">رقم الدفعة</th>
                      <th style="width: 25%;">المبلغ</th>
                      <th style="width: 25%;">تاريخ الاستحقاق</th>
                      <th style="width: 20%;">نوع الدفعة</th>
                      <th style="width: 15%;">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${installments.map((inst, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${Number(inst.amount).toLocaleString('ar-LY')} د.ل</td>
                        <td>${formatDateForPrint(inst.dueDate)}</td>
                        <td>${inst.paymentType || ''}</td>
                        <td>${inst.description || ''}</td>
                      </tr>
                    `).join('')}
                    <tr class="total-row">
                      <td>الإجمالي</td>
                      <td>${installments.reduce((sum, i) => sum + Number(i.amount), 0).toLocaleString('ar-LY')} د.ل</td>
                      <td colspan="3">عدد الدفعات: ${installments.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }
        } catch (e) {
          console.error('Error building installments table:', e);
        }
      }

      // Build billboards table - single flow-based table for auto pagination by Chrome
      const billboardsTableHtml = normalizedRows.length
        ? `
          <div class="flow-table-section">
            <h2 class="table-title">جدول اللوحات الإعلانية</h2>
            <table class="flow-table billboards-table" dir="rtl">
              <thead>
                <tr>
                  <th style="width: 5%;">رقم</th>
                  <th style="width: 10%;">صورة</th>
                  <th style="width: 10%;">البلدية</th>
                  <th style="width: 10%;">المنطقة</th>
                  <th style="width: 15%;">المعلم</th>
                  <th style="width: 8%;">المقاس</th>
                  <th style="width: 6%;">الوجوه</th>
                  <th style="width: 12%;">السعر</th>
                  <th style="width: 10%;">تاريخ الانتهاء</th>
                  <th style="width: 6%;">الأيام</th>
                  <th style="width: 8%;">الموقع</th>
                </tr>
              </thead>
              <tbody>
                ${normalizedRows.map((r) => `
                  <tr>
                    <td class="cell-center">${r.id}</td>
                    <td class="cell-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                    <td>${r.municipality}</td>
                    <td>${r.district}</td>
                    <td class="cell-wrap">${r.landmark}</td>
                    <td class="cell-center">${r.size}</td>
                    <td class="cell-center">${r.faces}</td>
                    <td class="cell-center">${r.price}</td>
                    <td class="cell-center">${r.endDate}</td>
                    <td class="cell-center">${r.daysCount}</td>
                    <td class="cell-center">${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">خريطة</a>` : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
        : '';

      // Combine billboards table + installments table
      const allTablesHtml = billboardsTableHtml + installmentsTableHtml;

      // Create HTML content for printing using the main6 design
      const installationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== 'false';
      const printEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === 'true';
      const flagsHtml = `
        <div style="margin:16px 0; font-size:18px;">
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#eef6ff; color:#0b63c5; margin-left:8px;">${installationEnabled ? 'مع التركيب' : 'بدون تركيب'}</span>
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#f5f5f5; color:#444;">${printEnabled ? 'شاملة الطباعة' : 'غير شاملة الطباعة'}</span>
        </div>`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
            }

            /* ========== صفحة العقد الأولى (خلفية + SVG) ========== */
            .contract-page {
              position: relative;
              width: 210mm;
              height: 297mm;
              overflow: hidden;
              page-break-after: always;
            }

            .template-image,
            .overlay-svg {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            }

            .overlay-svg {
              z-index: 10;
              pointer-events: none;
            }

            /* ========== قسم الجداول - Flow-based للتجزئة التلقائية ========== */
            .flow-table-section {
              width: 100%;
              padding: 15mm 10mm;
              page-break-before: always;
            }

            .table-title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #004aad;
              margin-bottom: 15px;
              padding: 10px;
              background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%);
              border-radius: 8px;
            }

            /* ========== الجدول - Flow Layout ========== */
            .flow-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 11px;
            }

            .flow-table thead {
              display: table-header-group;
            }

            .flow-table tbody {
              display: table-row-group;
            }

            .flow-table tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .flow-table th {
              background: #004aad !important;
              color: white !important;
              padding: 8px 4px;
              border: 1px solid #003388;
              text-align: center;
              font-weight: bold;
              white-space: nowrap;
            }

            .flow-table td {
              border: 1px solid #ddd;
              padding: 6px 4px;
              vertical-align: middle;
              text-align: center;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            .flow-table tbody tr:nth-child(even) {
              background: #f9f9f9;
            }

            .flow-table tbody tr:hover {
              background: #f0f7ff;
            }

            .flow-table .cell-center {
              text-align: center;
            }

            .flow-table .cell-wrap {
              text-align: right;
              word-wrap: break-word;
              max-width: 100px;
            }

            .flow-table .cell-img img {
              width: 60px;
              height: 40px;
              object-fit: cover;
              border-radius: 4px;
              display: block;
              margin: 0 auto;
            }

            .flow-table .total-row {
              background: #e8f4fd !important;
              font-weight: bold;
            }

            .flow-table a {
              color: #004aad;
              text-decoration: none;
              font-size: 10px;
            }

            /* ========== أنماط الطباعة ========== */
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              @page {
                size: A4;
                margin: 10mm;
              }

              html, body {
                width: 210mm;
                margin: 0;
                padding: 0;
              }

              /* صفحة العقد الأولى */
              .contract-page {
                width: 210mm;
                height: 297mm;
                margin: 0;
                padding: 0;
                page-break-after: always;
                page-break-inside: avoid;
              }

              /* قسم الجداول */
              .flow-table-section {
                display: block;
                position: static;
                width: 100%;
                padding: 5mm;
                page-break-before: always;
              }

              /* الجدول - Chrome auto pagination */
              .flow-table {
                width: 100%;
                table-layout: fixed;
                border-collapse: collapse;
              }

              .flow-table thead {
                display: table-header-group;
              }

              .flow-table tr {
                break-inside: avoid;
                page-break-inside: avoid;
              }

              .flow-table th {
                background: #004aad !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .controls {
                display: none !important;
              }
            }

            /* ========== شاشة العرض ========== */
            @media screen {
              body {
                padding: 20px;
                background: #f5f5f5;
              }

              .contract-page {
                margin: 0 auto 30px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                background: white;
              }

              .flow-table-section {
                max-width: 210mm;
                margin: 0 auto 30px;
                background: white;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                border-radius: 8px;
              }

              .controls {
                text-align: center;
                margin: 20px 0;
              }

              .controls button {
                padding: 12px 30px;
                font-size: 16px;
                background: #004aad;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-family: inherit;
              }

              .controls button:hover {
                background: #003388;
              }
            }
          </style>
        </head>
        <body>
          ${flagsHtml}
          <div class="contract-page">
            <!-- Background image -->
            <img src="/contract-template.png" alt="الإشعار الأصلي" class="template-image" />

            <!-- Overlay SVG -->
            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Header: إجراً لمواقع إعلانية رقم: 1098 سنة -->
              <text
                x="1750"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}
              </text>

              <!-- التاريخ: -->
              <text
                x="440"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                التاريخ: ${contractData.startDate}
              </text>

              <!-- نوع الإعلان -->
              <text
                x="2050"
                y="915"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                نوع الإعلان: ${contractData.adType}.
              </text>

              <!-- الطرف الأول -->
              <text
                x="2220"
                y="1140"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الطرف الأول:
              </text>
              <text
                x="1500"
                y="1140"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                <!-- Company info from settings -->
              </text>
              <text
                x="1960"
                y="1200"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يمثلها السيد جمال أحمد زحيل (المدير العام).
              </text>

              <!-- الطرف الثاني -->
              <text
                x="2210"
                y="1380"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الطرف الثاني:
              </text>
              <text
                x="1920"
                y="1380"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                ${contractData.customerName}.
              </text>
              <text
                x="1970"
                y="1440"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.
              </text>

              <!-- المقدمة -->
              <text
                x="2250"
                y="1630"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                المقدمة:
              </text>
              <text
                x="1290"
                y="1630"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>

              <!-- البند الأول -->
              <text
                x="2240"
                y="1715"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الأول:
              </text>
              <text
                x="1190"
                y="1715"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .
              </text>
              <text
                x="2095"
                y="1775"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                المذكور في المادة السادسة
              </text>

              <!-- البند الثاني -->
              <text
                x="2230"
                y="1890"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثاني:
              </text>
              <text
                x="1170"
                y="1890"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text
                x="1850"
                y="1950"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الأخير تكاليف التغيير الناتجة عن الأحوال ال��وية أو الحوادث.
              </text>

              <!-- البند الثالث -->
              <text
                x="2225"
                y="2065"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثالث:
              </text>
              <text
                x="1240"
                y="2065"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text
                x="1890"
                y="2125"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>

              <!-- البند الرابع -->
              <text
                x="2235"
                y="2240"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الرابع:
              </text>
              <text
                x="1190"
                y="2240"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ ��حق.
              </text>
              <text
                x="1530"
                y="2300"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>

              <!-- البند الخامس – contract amount with payments -->
              <text
                x="2225"
                y="2410"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الخامس:
              </text>
              <text
                x="1180"
                y="2410"
                font-family="Doran, sans-serif"
                font-size="38"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; unicode-bidi: plaintext; text-align: center"
              >
                ${rtlSafe(`قيمة العقد ${toArabicNumbers(contractData.price)} دينار ليبي${contractData.discountText ? ' ' + contractData.discountText : ''}. جدول الدفعات:`)}
              </text>
              ${contractData.paymentsLines.map((line: string, idx: number) => `
              <text
                x="1200"
                y="${2470 + (idx * 50)}"
                font-family="Doran, sans-serif"
                font-size="32"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; unicode-bidi: plaintext; text-align: center"
              >
                ${rtlSafe(line)}
              </text>
              `).join('')}
              <text
                x="1640"
                y="${2470 + (contractData.paymentsLines.length * 50) + 30}"
                font-family="Doran, sans-serif"
                font-size="36"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; unicode-bidi: bidi-override; text-align: center"
              >
                وإذا تأخر السداد عن ${toArabicNumbers('30')} يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>

              <!-- البند السادس – duration -->
              <text
                x="2210"
                y="2620"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند السادس:
              </text>
              <text
                x="1150"
                y="2620"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              style="direction: rtl; unicode-bidi: bidi-override; text-align: center"
              >
                مدة العقد ${toArabicNumbers(contractData.duration)} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text
                x="1800"
                y="2680"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; unicode-bidi: bidi-override; text-align: center"
              >
                انتهائه بمدة لا تقل عن ${toArabicNumbers('15')} يومًا وفق شروط يتم الاتفاق عليها .
              </text>

              <!-- البند السابع -->
              <text
                x="2220"
                y="2780"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; unicode-bidi: bidi-override; text-align: center"
              >
                البند السابع:
              </text>
              <text
                x="1150"
                y="2780"
                font-family="Doran, sans-serif"
                font-size="40"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي
              </text>
              <text
                x="2200"
                y="2840"
                font-family="Doran, sans-serif"
                font-size="40"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                وملزم للطرفين.
              </text>
            </svg>

            <!-- Print button - hidden in print -->
            <div class="controls print-hide">
              <button onclick="window.print()">طباعة</button>
            </div>
          </div>
          
          <!-- Tables section - flow-based for Chrome auto-pagination -->

          ${allTablesHtml}
        </body>
        </html>
      `;

      // Create a new window and write the HTML content
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');

      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for images to load, then focus and show print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 1000);
        };
      } else {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      }

    } catch (error) {
      console.error('Error opening print window:', error);
      alert('حدث خطأ أثناء فتح نافذة الطباعة: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      toast.info('جاري إنشاء ملف PDF...');

      // استخدام نفس منطق handlePrintContract تماماً
      const contractData = extractContractData(contract);

      // Normalize billboards and build table pages (نفس المنطق من handlePrintContract)
      const billboards: any[] = Array.isArray(contract.billboards) ? contract.billboards : [];

      // Get contract dates for billboards
      const contractStartDate = contract.start_date || contract['Contract Date'] || '';
      const contractEndDate = contract.end_date || contract['End Date'] || '';

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(
          b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? ''
        );
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.Rent ?? b.rent_cost ?? b['Total Rent'];
        const price =
          typeof priceVal === 'number'
            ? `${priceVal.toLocaleString('ar-LY')} د.ل`
            : (typeof priceVal === 'string' && priceVal.trim() !== '' ? priceVal : '');
        
        // Get end date - ALWAYS use contract end date for consistency
        const endDateRaw = contractEndDate || b.Rent_End_Date || b.rent_end_date || b.end_date || '';
        const endDate = endDateRaw ? formatDateForPrint(endDateRaw) : '';
        
        // حساب عدد الأيام من تواريخ العقد مباشرة (المصدر الوحيد للحقيقة)
        // نستخدم تواريخ العقد فقط وليس بيانات اللوحة لضمان التزامن
        let daysCount = '';
        if (contractStartDate && contractEndDate) {
          const start = new Date(contractStartDate);
          const end = new Date(contractEndDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            daysCount = days > 0 ? String(days) : '';
          }
        }
        // Fallback فقط إذا لم تتوفر تواريخ العقد
        if (!daysCount && !contractStartDate && !contractEndDate) {
          const startDateRaw = b.Rent_Start_Date || b.rent_start_date || b.start_date || '';
          const endDateRaw = b.Rent_End_Date || b.rent_end_date || b.end_date || '';
          if (startDateRaw && endDateRaw) {
            const start = new Date(startDateRaw);
            const end = new Date(endDateRaw);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              daysCount = days > 0 ? String(days) : '';
            }
          }
        }
        
        let coords: string = String(
          b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? ''
        );
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        return { id, image, municipality, district, landmark, size, faces, price, endDate, daysCount, mapLink };
      };

      const normalizedRows = billboards.map(normalizeBillboard);

      // Build installments table HTML - flow-based
      const installmentsData = (contract as any).installments_data || null;
      let installmentsTableHtml = '';
      if (installmentsData) {
        try {
          const installments: Installment[] = JSON.parse(installmentsData);
          if (installments && installments.length > 0) {
            installmentsTableHtml = `
              <div class="flow-table-section">
                <h2 class="table-title">جدول الدفعات</h2>
                <table class="flow-table payments-table" dir="rtl">
                  <thead>
                    <tr>
                      <th style="width: 15%;">رقم الدفعة</th>
                      <th style="width: 25%;">المبلغ</th>
                      <th style="width: 25%;">تاريخ الاستحقاق</th>
                      <th style="width: 20%;">نوع الدفعة</th>
                      <th style="width: 15%;">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${installments.map((inst, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${Number(inst.amount).toLocaleString('ar-LY')} د.ل</td>
                        <td>${formatDateForPrint(inst.dueDate)}</td>
                        <td>${inst.paymentType || ''}</td>
                        <td>${inst.description || ''}</td>
                      </tr>
                    `).join('')}
                    <tr class="total-row">
                      <td>الإجمالي</td>
                      <td>${installments.reduce((sum, i) => sum + Number(i.amount), 0).toLocaleString('ar-LY')} د.ل</td>
                      <td colspan="3">عدد الدفعات: ${installments.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }
        } catch (e) {
          console.error('Error building installments table:', e);
        }
      }

      // Build billboards table - single flow-based table
      const billboardsTableHtml = normalizedRows.length
        ? `
          <div class="flow-table-section">
            <h2 class="table-title">جدول اللوحات الإعلانية</h2>
            <table class="flow-table billboards-table" dir="rtl">
              <thead>
                <tr>
                  <th style="width: 5%;">رقم</th>
                  <th style="width: 10%;">صورة</th>
                  <th style="width: 10%;">البلدية</th>
                  <th style="width: 10%;">المنطقة</th>
                  <th style="width: 15%;">المعلم</th>
                  <th style="width: 8%;">المقاس</th>
                  <th style="width: 6%;">الوجوه</th>
                  <th style="width: 12%;">السعر</th>
                  <th style="width: 10%;">تاريخ الانتهاء</th>
                  <th style="width: 6%;">الأيام</th>
                  <th style="width: 8%;">الموقع</th>
                </tr>
              </thead>
              <tbody>
                ${normalizedRows.map((r) => `
                  <tr>
                    <td class="cell-center">${r.id}</td>
                    <td class="cell-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                    <td>${r.municipality}</td>
                    <td>${r.district}</td>
                    <td class="cell-wrap">${r.landmark}</td>
                    <td class="cell-center">${r.size}</td>
                    <td class="cell-center">${r.faces}</td>
                    <td class="cell-center">${r.price}</td>
                    <td class="cell-center">${r.endDate}</td>
                    <td class="cell-center">${r.daysCount}</td>
                    <td class="cell-center">${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">خريطة</a>` : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
        : '';

      // Combine billboards table + installments table
      const allTablesHtml = billboardsTableHtml + installmentsTableHtml;

      // نفس الـflags من handlePrintContract
      const installationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== 'false';
      const printEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === 'true';
      const flagsHtml = `
        <div style="margin:16px 0; font-size:18px;">
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#eef6ff; color:#0b63c5; margin-left:8px;">${installationEnabled ? 'مع التركيب' : 'بدون تركيب'}</span>
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#f5f5f5; color:#444;">${printEnabled ? 'شاملة الطباعة' : 'غير شاملة الطباعة'}</span>
        </div>`;

      // ✅ نفس HTML من handlePrintContract تماماً - flow-based للتجزئة التلقائية
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
            }

            /* صفحة العقد الأولى */
            .contract-page {
              position: relative;
              width: 210mm;
              height: 297mm;
              overflow: hidden;
              page-break-after: always;
            }

            .template-image,
            .overlay-svg {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            }

            .overlay-svg {
              z-index: 10;
              pointer-events: none;
            }

            /* قسم الجداول - Flow-based */
            .flow-table-section {
              width: 100%;
              padding: 15mm 10mm;
              page-break-before: always;
            }

            .table-title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #004aad;
              margin-bottom: 15px;
              padding: 10px;
              background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%);
              border-radius: 8px;
            }

            .flow-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 11px;
            }

            .flow-table thead {
              display: table-header-group;
            }

            .flow-table tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .flow-table th {
              background: #004aad !important;
              color: white !important;
              padding: 8px 4px;
              border: 1px solid #003388;
              text-align: center;
              font-weight: bold;
            }

            .flow-table td {
              border: 1px solid #ddd;
              padding: 6px 4px;
              vertical-align: middle;
              text-align: center;
              word-wrap: break-word;
            }

            .flow-table tbody tr:nth-child(even) {
              background: #f9f9f9;
            }

            .flow-table .cell-center { text-align: center; }
            .flow-table .cell-wrap { text-align: right; word-wrap: break-word; max-width: 100px; }
            .flow-table .cell-img img { width: 60px; height: 40px; object-fit: cover; border-radius: 4px; display: block; margin: 0 auto; }
            .flow-table .total-row { background: #e8f4fd !important; font-weight: bold; }
            .flow-table a { color: #004aad; text-decoration: none; font-size: 10px; }

            @media print {
              @page { size: A4; margin: 10mm; }
              html, body { width: 210mm; margin: 0; padding: 0; }
              .contract-page { width: 210mm; height: 297mm; page-break-after: always; page-break-inside: avoid; }
              .flow-table-section { display: block; position: static; width: 100%; padding: 5mm; page-break-before: always; }
              .flow-table { width: 100%; table-layout: fixed; }
              .flow-table thead { display: table-header-group; }
              .flow-table tr { break-inside: avoid; page-break-inside: avoid; }
              .flow-table th { background: #004aad !important; color: white !important; }
            }
          </style>
        </head>
        <body>
          ${flagsHtml}
          <div class="contract-page">
            <img src="/contract-template.png" alt="الإشعار الأصلي" class="template-image" />
            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <text x="1750" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}
              </text>
              <text x="440" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                التاريخ: ${contractData.startDate}
              </text>
              <text x="2050" y="915" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                نوع الإعلان: ${contractData.adType}.
              </text>
              <text x="2220" y="1140" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الأول:
              </text>
              <text x="1500" y="1140" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                <!-- Company info from settings -->
              </text>
              <text x="1960" y="1200" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يمثلها السيد جمال أحمد زحيل (المدير العام).
              </text>
              <text x="2210" y="1380" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الثاني:
              </text>
              <text x="1920" y="1380" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                ${contractData.customerName}.
              </text>
              <text x="1970" y="1440" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.
              </text>
              <text x="2250" y="1630" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                المقدمة:
              </text>
              <text x="1290" y="1630" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>
              <text x="2240" y="1715" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الأول:
              </text>
              <text x="1190" y="1715" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .
              </text>
              <text x="2095" y="1775" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                المذكور في المادة السادسة
              </text>
              <text x="2230" y="1890" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثاني:
              </text>
              <text x="1170" y="1890" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text x="1850" y="1950" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.
              </text>
              <text x="2225" y="2065" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثالث:
              </text>
              <text x="1240" y="2065" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text x="1890" y="2125" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>
              <text x="2235" y="2240" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الرابع:
              </text>
              <text x="1190" y="2240" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق.
              </text>
              <text x="1530" y="2300" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>
              <text x="2225" y="2410" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الخامس:
              </text>
              <text x="1180" y="2410" font-family="Doran, sans-serif" font-size="38" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                قيمة العقد ${contractData.price} دينار ليبي${contractData.discountText ? ' ' + contractData.discountText : ''}. جدول الدفعات:
              </text>
              </text>
              ${contractData.paymentsLines.map((line: string, idx: number) => `
              <text x="1200" y="${2470 + (idx * 50)}" font-family="Doran, sans-serif" font-size="32" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                ${line}
              </text>
              `).join('')}
              <text x="1640" y="${2470 + (contractData.paymentsLines.length * 50) + 30}" font-family="Doran, sans-serif" font-size="36" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>
              <text x="2210" y="2620" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند السادس:
              </text>
              <text x="1150" y="2620" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text x="1800" y="2680" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها .
              </text>
              <text x="2220" y="2780" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند السابع:
              </text>
              <text x="1150" y="2780" font-family="Doran, sans-serif" font-size="40" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                في حال اعتراض الجهات الرسمية على محتوى الإعلان، يتحمل الطرف الثاني المسؤولية الكاملة ويلتزم بتصحيحه فورًا.
              </text>
              <text x="2220" y="2870" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثامن:
              </text>
              <text x="1190" y="2870" font-family="Doran, sans-serif" font-size="40" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يُمنع استخدام المساحات لأغراض غير مشروعة أو مخالفة للقانون، وفي حال المخالفة يحق للطرف الأول إلغاء العقد دون رد المبلغ.
              </text>
              <text x="2230" y="2960" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند التاسع:
              </text>
              <text x="1170" y="2960" font-family="Doran, sans-serif" font-size="40" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يحق لأي طرف إلغاء العقد قبل انتهاء المدة بإخطار كتابي قبل 15 يومًا على الأقل، ويتحمل الطرف المُلغي أي خسائر مادية.
              </text>
              <text x="2220" y="3050" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند العاشر:
              </text>
              <text x="1220" y="3050" font-family="Doran, sans-serif" font-size="40" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يتم حل أي خلاف وديًا بين الطرفين أولاً، وفي حال عدم التوصل لحل يتم اللجوء إلى المحكمة المختصة في ليبيا.
              </text>
              <text x="540" y="3180" font-family="Doran, sans-serif" font-weight="bold" font-size="50" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الثاني:
              </text>
              <text x="1950" y="3180" font-family="Doran, sans-serif" font-weight="bold" font-size="50" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الأول:
              </text>
            </svg>
          </div>
          ${allTablesHtml}
        </body>
        </html>
      `;

      // ======= 🎯 استخدام نفس طريقة الطباعة لإنشاء PDF =======
      // استخدم html2canvas + jsPDF للحصول على نتائج مماثلة للطباعة
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;

      // إنشاء container مؤقت
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.fontFamily = 'Noto Sans Arabic, Doran, Arial, sans-serif';
      container.style.direction = 'rtl';
      container.innerHTML = htmlContent;
      
      document.body.appendChild(container);

      // انتظار تحميل الخطوط والصور (زيادة الوقت)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ======= 🎨 معالجة الصفحة الأولى (بيانات العقد) =======
      const firstPage = container.querySelector('.template-container') as HTMLElement;
      if (!firstPage) {
        document.body.removeChild(container);
        throw new Error('لم يتم العثور على محتوى العقد');
      }

      // إنشاء PDF بأبعاد A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // تحويل الصفحة الأولى إلى صورة
      const firstCanvas = await html2canvas(firstPage, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123
      });
      
      const firstImgData = firstCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(firstImgData, 'JPEG', 0, 0, 210, 297);

      // ======= 📊 معالجة صفحات الجداول (اللوحات) =======
      const tablePages = container.querySelectorAll('.template-container:not(:first-child)');
      for (let i = 0; i < tablePages.length; i++) {
        const tablePage = tablePages[i] as HTMLElement;
        
        pdf.addPage('a4', 'portrait');
        
        const tableCanvas = await html2canvas(tablePage, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123
        });
        
        const tableImgData = tableCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(tableImgData, 'JPEG', 0, 0, 210, 297);
      }

      // ======= 💾 حفظ الملف =======
      pdf.save(`عقد-${contractData.contractNumber}.pdf`);

      // تنظيف
      document.body.removeChild(container);

      toast.success('تم تحميل ملف PDF بنجاح');
    } catch (error) {
      console.error('خطأ في تحميل PDF:', error);
      toast.error('حدث خطأ أثناء تحميل PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            طباعة العقد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>طباعة عقد إيجار اللوحات الإعلانية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>اختر الإجراء المناسب:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>معاينة:</strong> عرض العقد قبل الطباعة أو التحميل</li>
              <li><strong>تحميل PDF:</strong> حفظ العقد كملف PDF</li>
            </ul>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleDownloadPDF}
              disabled={isDownloading || isGenerating}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'جاري التحميل...' : 'تحميل PDF'}
            </Button>
            <Button
              onClick={handlePrintContract}
              disabled={isGenerating || isDownloading}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isGenerating ? 'جاري التحضير...' : 'معاينة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
