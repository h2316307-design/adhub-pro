import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface DesignGroup {
  design: string;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  billboards: number[];
  width: number;
  height: number;
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutImageUrl?: string;
}

interface PrintTaskInvoiceProps {
  designGroups: DesignGroup[];
  pricePerMeter: number;
  cutoutPricePerUnit: number;
  printerName?: string;
  cutoutPrinterName?: string;
  totalArea: number;
  totalCutouts: number;
  showPrices?: boolean;
}

export function PrintTaskInvoice({
  designGroups,
  pricePerMeter,
  cutoutPricePerUnit,
  printerName,
  cutoutPrinterName,
  totalArea,
  totalCutouts,
  showPrices = true
}: PrintTaskInvoiceProps) {
  const printCost = totalArea * pricePerMeter;
  const cutoutsCost = totalCutouts * cutoutPricePerUnit;
  const totalCost = printCost + cutoutsCost;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة مهمة طباعة</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white;
            color: #000;
            font-size: 11px;
            line-height: 1.3;
            overflow: hidden;
          }
          
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          .invoice-container {
            width: 210mm;
            height: 297mm;
            padding: 12mm;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          
          .invoice-info {
            text-align: left;
            direction: ltr;
            order: 2;
          }
          
          .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #000;
            margin-bottom: 8px;
          }
          
          .invoice-subtitle {
            font-size: 13px;
            color: #666;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .invoice-details {
            font-size: 11px;
            color: #666;
            line-height: 1.5;
          }
          
          .company-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
            order: 1;
          }
          
          .company-logo {
            max-width: 400px;
            height: auto;
            object-fit: contain;
            margin-bottom: 5px;
          }
          
          .company-details {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
          }

          .printer-section {
            background: #f8f9fa;
            padding: 18px;
            border-radius: 8px;
            margin-bottom: 18px;
            border: 2px solid #000;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #000;
            margin-bottom: 12px;
            text-align: center;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }

          .info-box {
            background: white;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
          }

          .info-label {
            font-size: 11px;
            color: #000;
            font-weight: bold;
            margin-bottom: 4px;
          }

          .info-value {
            font-size: 13px;
            color: #000;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
          }

          .items-table th {
            background: #000;
            color: #fff;
            font-weight: bold;
            padding: 10px;
            text-align: center;
            border: 1px solid #000;
          }

          .items-table td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: center;
            vertical-align: middle;
          }

          .items-table tbody tr:nth-child(even) {
            background: #f8f9fa;
          }

          .design-image {
            max-width: 60px;
            max-height: 60px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          .cutout-badge {
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            margin-top: 4px;
          }

          .summary-section {
            margin-top: auto;
            padding: 18px;
            background: #f8f9fa;
            border: 2px solid #000;
            border-radius: 8px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 15px;
          }

          .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 4px;
            border: 1px solid #ddd;
          }

          .summary-label {
            font-weight: bold;
            font-size: 12px;
          }

          .summary-value {
            font-weight: bold;
            font-size: 14px;
            color: #000;
          }

          .total-row {
            grid-column: 1 / -1;
            background: #000;
            color: white;
            padding: 12px;
            text-align: center;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            margin-top: 10px;
          }

          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #000;
            text-align: center;
            font-size: 11px;
            color: #666;
          }

          @media print {
            html, body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .invoice-container {
              page-break-after: avoid;
            }

            .items-table {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
              <div class="company-details">
                <div><strong>شركة فارس للدعاية والإعلان</strong></div>
                <div>الهاتف: +218 91 234 5678</div>
                <div>البريد: info@fares-ads.ly</div>
              </div>
            </div>
            <div class="invoice-info">
              <div class="invoice-title">فاتورة طباعة</div>
              <div class="invoice-subtitle">Print Task Invoice</div>
              <div class="invoice-details">
                <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}</div>
                <div><strong>رقم الفاتورة:</strong> PT-${Date.now()}</div>
              </div>
            </div>
          </div>

          <div class="printer-section">
            <div class="section-title">معلومات المطبعة</div>
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">المطبعة الرئيسية:</div>
                <div class="info-value">${printerName || 'غير محدد'}</div>
              </div>
              ${totalCutouts > 0 ? `
              <div class="info-box">
                <div class="info-label">مطبعة المجسمات:</div>
                <div class="info-value">${cutoutPrinterName || printerName || 'غير محدد'}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">التصميم</th>
                <th style="width: 100px;">المقاس</th>
                <th>الوجه</th>
                <th style="width: 80px;">الكمية</th>
                <th style="width: 80px;">المساحة/وحدة</th>
                <th style="width: 100px;">إجمالي المساحة</th>
                ${showPrices ? '<th style="width: 100px;">التكلفة</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${designGroups.map(group => `
                <tr>
                  <td>
                    ${group.design ? `<img src="${group.design}" class="design-image" onerror="this.style.display='none'" />` : '-'}
                    ${group.hasCutout && group.cutoutImageUrl ? `<br><img src="${group.cutoutImageUrl}" class="design-image" style="margin-top: 4px;" onerror="this.style.display='none'" />` : ''}
                    ${group.hasCutout ? '<div class="cutout-badge">مجسم ×' + (group.cutoutCount || 0) + '</div>' : ''}
                  </td>
                  <td><strong>${group.size}</strong></td>
                  <td>${group.face === 'a' ? 'أمامي' : 'خلفي'}</td>
                  <td><strong>×${group.quantity}</strong></td>
                  <td>${group.area.toFixed(2)} م²</td>
                  <td><strong>${(group.area * group.quantity).toFixed(2)} م²</strong></td>
                  ${showPrices ? `<td><strong>${(group.area * group.quantity * pricePerMeter).toFixed(2)} د.ل</strong></td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${showPrices ? `
          <div class="summary-section">
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">إجمالي المساحة:</span>
                <span class="summary-value">${totalArea.toFixed(2)} م²</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">سعر المتر:</span>
                <span class="summary-value">${pricePerMeter.toFixed(2)} د.ل</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">تكلفة الطباعة:</span>
                <span class="summary-value">${printCost.toFixed(2)} د.ل</span>
              </div>
              ${totalCutouts > 0 ? `
              <div class="summary-item">
                <span class="summary-label">عدد المجسمات:</span>
                <span class="summary-value">${totalCutouts}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">سعر المجسم:</span>
                <span class="summary-value">${cutoutPricePerUnit.toFixed(2)} د.ل</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">تكلفة المجسمات:</span>
                <span class="summary-value">${cutoutsCost.toFixed(2)} د.ل</span>
              </div>
              ` : ''}
            </div>
            <div class="total-row">
              الإجمالي الكلي: ${totalCost.toFixed(2)} دينار ليبي
            </div>
          </div>
          ` : ''}

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
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">معاينة فاتورة الطباعة</h3>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة فاتورة المطبعة
        </Button>
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground mb-2">
          سيتم طباعة فاتورة بصيغة A4 تحتوي على {designGroups.length} تصميم
        </div>
      </div>
    </div>
  );
}
