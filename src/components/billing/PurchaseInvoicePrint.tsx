/**
 * PurchaseInvoicePrint - فاتورة المشتريات باستخدام Print Engine الموحد
 * 
 * ✅ تم ربطها بمحرك الطباعة الموحد (print-engine)
 * ✅ تدعم العناوين الديناميكية
 * ✅ تتعامل مع الحقول الفارغة بمرونة (Fallback Design)
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

interface PurchaseItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string; // ✅ عنوان ديناميكي
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
// توليد جدول البنود باستخدام print-engine CSS classes
// =====================================================

function generatePurchaseItemsTable(
  theme: PrintTheme,
  items: PurchaseItem[],
  discount: number,
  totalAmount: number
): string {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const rowsHtml = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="text-${theme.direction === 'rtl' ? 'right' : 'left'}">${item.description || ''}</td>
      <td>${item.quantity || 0}</td>
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
// دالة الطباعة الرئيسية - تستخدم print-engine
// =====================================================

export async function printPurchaseInvoice(
  theme: PrintTheme,
  data: PurchaseInvoiceData
): Promise<void> {
  // تحميل الشعار
  const logoDataUri = theme.showLogo ? await loadLogoAsDataUri(theme.logoPath) : '';

  // ✅ بيانات الهيدر - عنوان ديناميكي
  const headerData: DocumentHeaderData = {
    titleEn: 'PURCHASE INVOICE',
    titleAr: data.invoiceName || 'فاتورة مشتريات', // ✅ يستخدم المتغير الديناميكي
    documentNumber: data.invoiceNumber,
    date: formatDate(data.invoiceDate),
  };

  // ✅ بيانات المورد - تتعامل مع الحقول الفارغة بمرونة
  const partyData: PartyData = {
    title: 'بيانات المورد',
    name: data.supplierName || 'غير محدد',
    company: data.supplierCompany,
    phone: data.supplierPhone,
    id: data.supplierId,
  };

  // توليد المحتوى
  let bodyContent = generatePurchaseItemsTable(theme, data.items, data.discount || 0, data.totalAmount);

  // إضافة الملاحظات
  if (data.notes) {
    bodyContent += `
      <div class="summary-section" style="margin-top: 20px;">
        <div class="summary-title">ملاحظات</div>
        <div style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-size: 12px;">${data.notes}</div>
      </div>
    `;
  }

  // ✅ توليد HTML الكامل باستخدام Print Engine الموحد
  const htmlContent = generatePrintDocument({
    theme,
    title: `فاتورة مشتريات - ${data.supplierName}`,
    headerData,
    logoDataUri,
    partyData,
    bodyContent
  });

  // فتح نافذة الطباعة
  openPrintWindow(htmlContent, `فاتورة_مشتريات_${data.invoiceNumber}`);
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

// =====================================================
// Hook للاستخدام في المكونات
// =====================================================

export function usePurchaseInvoicePrint() {
  const { theme, isLoading } = usePrintTheme(DOCUMENT_TYPES.PURCHASE_INVOICE);
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: PurchaseInvoiceData) => {
    if (isLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    setIsPrinting(true);
    try {
      await printPurchaseInvoice(theme, data);
    } catch (error) {
      console.error('Error printing purchase invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading };
}
