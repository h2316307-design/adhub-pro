/**
 * PurchaseInvoicePrint - فاتورة المشتريات بنفس تصميم الفاتورة المجمعة
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { loadPrintLogo } from '@/lib/printLogo';

// =====================================================
// الأنواع
// =====================================================

interface PurchaseItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string;
  supplierName: string;
  supplierId?: string;
  supplierPhone?: string;
  supplierCompany?: string;
  items: PurchaseItem[];
  discount?: number;
  totalAmount: number;
  notes?: string;
}

// =====================================================
// دالة توليد HTML الفاتورة
// =====================================================

function generatePurchaseInvoiceHTML(
  data: PurchaseInvoiceData,
  logoDataUri: string
): string {
  const invoiceDate = data.invoiceDate 
    ? format(new Date(data.invoiceDate), 'dd MMMM yyyy', { locale: ar })
    : format(new Date(), 'dd MMMM yyyy', { locale: ar });

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const discount = data.discount || 0;
  const totalAmount = data.totalAmount;

  // توليد صفوف الجدول
  const itemsRows = data.items.map((item, index) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${index + 1}</td>
      <td style="text-align: right; padding: 8px 12px;">
        <strong>${item.description}</strong>
      </td>
      <td style="text-align: center;"><strong>${item.quantity}</strong></td>
      <td style="text-align: center;">${item.unitPrice.toLocaleString('ar-LY')} د.ل</td>
      <td style="text-align: center; background: #f0f9ff;"><strong>${item.total.toLocaleString('ar-LY')} د.ل</strong></td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مشتريات - ${data.supplierName}</title>
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

    .supplier-section {
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
      font-size: 10px;
    }

    .items-table th {
      background: #1e40af;
      color: #fff;
      font-weight: bold;
      padding: 8px 6px;
      text-align: center;
      border: 1px solid #1e40af;
      font-size: 10px;
    }

    .items-table td {
      padding: 8px 6px;
      border: 1px solid #93c5fd;
      text-align: center;
      vertical-align: middle;
    }

    .items-table tbody tr:nth-child(even) {
      background: #f0f9ff;
    }

    .cost-section {
      background: #f0f9ff;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      border: 2px solid #93c5fd;
    }

    .cost-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #93c5fd;
    }

    .cost-label {
      font-size: 11px;
      color: #1e40af;
      font-weight: bold;
    }

    .cost-value {
      font-size: 13px;
      font-weight: bold;
      color: #1e40af;
    }

    .discount-row {
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .discount-label {
      color: #dc2626;
    }

    .discount-value {
      color: #dc2626;
    }

    .total-section {
      background: #1e40af;
      color: white;
      padding: 12px;
      text-align: center;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
    }

    .notes-section {
      background: #fffbeb;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      border: 1px solid #fcd34d;
    }

    .notes-title {
      font-size: 11px;
      color: #92400e;
      font-weight: bold;
      margin-bottom: 6px;
    }

    .notes-content {
      font-size: 10px;
      color: #78350f;
      line-height: 1.5;
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
  <div class="page">
    <div class="content-wrapper">
      <div class="page-header">
        <div class="invoice-info">
          <div class="invoice-title">${data.invoiceName || 'فاتورة مشتريات'}</div>
          <div class="invoice-subtitle">Purchase Invoice</div>
          <div class="invoice-details">
            <div><strong>رقم الفاتورة:</strong> #${data.invoiceNumber}</div>
            <div><strong>التاريخ:</strong> ${invoiceDate}</div>
          </div>
        </div>
        <div class="company-info">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="شعار الشركة" class="company-logo">` : ''}
        </div>
      </div>

      <div class="supplier-section">
        <div class="section-title">بيانات المورد</div>
        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">اسم المورد:</div>
            <div class="info-value">${data.supplierName}</div>
          </div>
          ${data.supplierCompany ? `
          <div class="info-box">
            <div class="info-label">الشركة:</div>
            <div class="info-value">${data.supplierCompany}</div>
          </div>
          ` : ''}
          ${data.supplierPhone ? `
          <div class="info-box">
            <div class="info-label">رقم الهاتف:</div>
            <div class="info-value">${data.supplierPhone}</div>
          </div>
          ` : ''}
          ${data.supplierId ? `
          <div class="info-box">
            <div class="info-label">رقم التعريف:</div>
            <div class="info-value">${data.supplierId}</div>
          </div>
          ` : ''}
          <div class="info-box">
            <div class="info-label">تاريخ الفاتورة:</div>
            <div class="info-value">${invoiceDate}</div>
          </div>
        </div>
      </div>

      <div class="items-section">
        <div class="section-title" style="background: #1e40af;">بنود الفاتورة</div>
        <table class="items-table" style="border-color: #1e40af;">
          <thead>
            <tr>
              <th style="width: 8%; background: #1e40af;">#</th>
              <th style="width: 42%; background: #1e40af;">الوصف</th>
              <th style="width: 12%; background: #1e40af;">الكمية</th>
              <th style="width: 18%; background: #1e40af;">سعر الوحدة</th>
              <th style="width: 20%; background: #1e40af;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>

      <div class="cost-section">
        <div class="section-title">ملخص الفاتورة</div>
        
        <div class="cost-row">
          <span class="cost-label">المجموع الفرعي:</span>
          <span class="cost-value">${subtotal.toLocaleString('ar-LY')} د.ل</span>
        </div>
        
        ${discount > 0 ? `
        <div class="cost-row discount-row">
          <span class="cost-label discount-label">الخصم:</span>
          <span class="cost-value discount-value">- ${discount.toLocaleString('ar-LY')} د.ل</span>
        </div>
        ` : ''}
        
        <div class="total-section">
          الإجمالي المطلوب: ${totalAmount.toLocaleString('ar-LY')} دينار ليبي
        </div>
      </div>

      ${data.notes ? `
      <div class="notes-section">
        <div class="notes-title">ملاحظات:</div>
        <div class="notes-content">${data.notes}</div>
      </div>
      ` : ''}
    </div>

    <div class="page-footer">
      <div class="footer-text">
        <strong>شكراً لتعاملكم معنا</strong> | هذه الفاتورة تم إنشاؤها تلقائياً من نظام إدارة اللوحات
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// =====================================================
// دالة الطباعة الرئيسية
// =====================================================

export async function printPurchaseInvoice(
  data: PurchaseInvoiceData
): Promise<void> {
  // تحميل الشعار
  const logoDataUri = await loadPrintLogo();

  // توليد HTML الكامل
  const htmlContent = generatePurchaseInvoiceHTML(data, logoDataUri);

  // فتح نافذة الطباعة
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    toast.error('يرجى السماح بفتح النوافذ المنبثقة');
    return;
  }

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 900);
  };

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

// =====================================================
// Hook للاستخدام في المكونات
// =====================================================

export function usePurchaseInvoicePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: PurchaseInvoiceData) => {
    setIsPrinting(true);
    try {
      await printPurchaseInvoice(data);
    } catch (error) {
      console.error('Error printing purchase invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
