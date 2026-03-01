/**
 * SalesInvoicePrint - فاتورة المبيعات باستخدام Print Engine الجديد
 * 
 * ⚠️ هذا المكون يستخدم Print Engine حصرياً
 * ❌ ممنوع أي hardcoded colors أو styles
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from '@/types/document-types';
import {
  usePrintTheme,
  generatePrintDocument,
  openPrintWindow,
  loadLogoAsDataUri,
  formatArabicNumber,
  formatDate,
  DocumentHeaderData,
  PartyData,
  PrintTheme
} from '@/print-engine';

// =====================================================
// الأنواع
// =====================================================

interface SalesItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SalesInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerCompany?: string;
  items: SalesItem[];
  discount?: number;
  totalAmount: number;
  notes?: string;
}

// =====================================================
// توليد جدول الأصناف
// =====================================================

function generateItemsTable(
  theme: PrintTheme,
  items: SalesItem[],
  discount: number,
  totalAmount: number
): string {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const rowsHtml = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="text-${theme.direction === 'rtl' ? 'right' : 'left'}">${item.description}</td>
      <td>${item.quantity}</td>
      <td>${formatArabicNumber(item.unitPrice)} د.ل</td>
      <td>${formatArabicNumber(item.total)} د.ل</td>
    </tr>
  `).join('');

  return `
    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 8%">#</th>
          <th style="width: 40%">الوصف</th>
          <th style="width: 15%">الكمية</th>
          <th style="width: 18%">سعر الوحدة</th>
          <th style="width: 19%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        
        <tr class="totals-row">
          <td colspan="4" style="text-align: ${theme.direction === 'rtl' ? 'left' : 'right'}; font-weight: 700;">المجموع الفرعي</td>
          <td>${formatArabicNumber(subtotal)} د.ل</td>
        </tr>
        ${discount > 0 ? `
        <tr class="totals-row">
          <td colspan="4" style="text-align: ${theme.direction === 'rtl' ? 'left' : 'right'}; font-weight: 700;">الخصم</td>
          <td class="credit-cell">- ${formatArabicNumber(discount)} د.ل</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td colspan="4" style="text-align: ${theme.direction === 'rtl' ? 'left' : 'right'};">الإجمالي النهائي</td>
          <td style="font-size: 18px;">${formatArabicNumber(totalAmount)} د.ل</td>
        </tr>
      </tbody>
    </table>
  `;
}

// =====================================================
// دالة الطباعة الرئيسية
// =====================================================

export async function printSalesInvoice(
  theme: PrintTheme,
  data: SalesInvoiceData
): Promise<void> {
  // تحميل الشعار
  const logoDataUri = theme.showLogo ? await loadLogoAsDataUri(theme.logoPath) : '';

  // بيانات الهيدر
  const headerData: DocumentHeaderData = {
    titleEn: 'SALES INVOICE',
    titleAr: data.invoiceName || 'فاتورة مبيعات',
    documentNumber: data.invoiceNumber,
    date: formatDate(data.invoiceDate),
  };

  // بيانات العميل
  const partyData: PartyData = {
    title: 'بيانات العميل',
    name: data.customerName,
    company: data.customerCompany,
    phone: data.customerPhone,
    id: data.customerId,
  };

  // توليد المحتوى
  let bodyContent = generateItemsTable(theme, data.items, data.discount || 0, data.totalAmount);

  // إضافة الملاحظات
  if (data.notes) {
    bodyContent += `
      <div class="summary-section" style="margin-top: 20px;">
        <div class="summary-title">ملاحظات</div>
        <div style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-size: 12px;">${data.notes}</div>
      </div>
    `;
  }

  // توليد HTML الكامل باستخدام Print Engine
  const htmlContent = generatePrintDocument({
    theme,
    title: `فاتورة مبيعات - ${data.customerName}`,
    headerData,
    logoDataUri,
    partyData,
    bodyContent
  });

  // فتح نافذة الطباعة
  openPrintWindow(htmlContent, `فاتورة_مبيعات_${data.invoiceNumber}`);
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

// =====================================================
// Hook للاستخدام في المكونات
// =====================================================

export function useSalesInvoicePrint() {
  const { theme, isLoading } = usePrintTheme(DOCUMENT_TYPES.SALES_INVOICE);
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: SalesInvoiceData) => {
    if (isLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    setIsPrinting(true);
    try {
      await printSalesInvoice(theme, data);
    } catch (error) {
      console.error('Error printing sales invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading };
}
