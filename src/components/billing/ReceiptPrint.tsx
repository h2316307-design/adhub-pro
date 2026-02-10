/**
 * ReceiptPrint - إيصال الدفع باستخدام Print Engine الجديد
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

interface ReceiptData {
  receiptNumber: string;
  receiptDate: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerCompany?: string;
  amount: number;
  paymentMethod?: string;
  contractNumber?: number;
  reference?: string;
  notes?: string;
}

// =====================================================
// توليد محتوى الإيصال
// =====================================================

function generateReceiptContent(
  theme: PrintTheme,
  data: ReceiptData
): string {
  const paymentMethodAr = data.paymentMethod === 'cash' ? 'نقداً' 
    : data.paymentMethod === 'bank_transfer' ? 'تحويل بنكي'
    : data.paymentMethod === 'check' ? 'شيك'
    : data.paymentMethod || 'غير محدد';

  return `
    <div class="summary-section">
      <div class="summary-title">تفاصيل الدفعة</div>
      
      <table class="print-table" style="margin-top: 15px;">
        <tbody>
          <tr>
            <td style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-weight: 700; width: 30%;">المبلغ المستلم</td>
            <td style="text-align: center; font-size: 20px; font-weight: 700;">${formatArabicNumber(data.amount)} د.ل</td>
          </tr>
          <tr>
            <td style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-weight: 700;">طريقة الدفع</td>
            <td style="text-align: center;">${paymentMethodAr}</td>
          </tr>
          ${data.contractNumber ? `
          <tr>
            <td style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-weight: 700;">رقم العقد</td>
            <td style="text-align: center;">${data.contractNumber}</td>
          </tr>
          ` : ''}
          ${data.reference ? `
          <tr>
            <td style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-weight: 700;">المرجع</td>
            <td style="text-align: center;">${data.reference}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="amount-words" style="margin-top: 20px;">
        المبلغ بالكلمات: ${formatArabicNumber(data.amount)} دينار ليبي فقط لا غير
      </div>
    </div>

    ${data.notes ? `
    <div class="summary-section" style="margin-top: 20px;">
      <div class="summary-title">ملاحظات</div>
      <div style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-size: 12px; padding: 10px 0;">${data.notes}</div>
    </div>
    ` : ''}

    <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px;">
      <div style="text-align: center; flex: 1;">
        <div style="border-top: 1px solid ${theme.primaryColor}; padding-top: 10px; margin: 0 20px;">
          <strong>توقيع المستلم</strong>
        </div>
      </div>
      <div style="text-align: center; flex: 1;">
        <div style="border-top: 1px solid ${theme.primaryColor}; padding-top: 10px; margin: 0 20px;">
          <strong>توقيع المحاسب</strong>
        </div>
      </div>
    </div>
  `;
}

// =====================================================
// دالة الطباعة الرئيسية
// =====================================================

export async function printReceipt(
  theme: PrintTheme,
  data: ReceiptData
): Promise<void> {
  // تحميل الشعار
  const logoDataUri = theme.showLogo ? await loadLogoAsDataUri(theme.logoPath) : '';

  // بيانات الهيدر
  const headerData: DocumentHeaderData = {
    titleEn: 'PAYMENT RECEIPT',
    titleAr: 'إيصال استلام',
    documentNumber: data.receiptNumber,
    date: formatDate(data.receiptDate),
  };

  // بيانات العميل
  const partyData: PartyData = {
    title: 'بيانات الدافع',
    name: data.customerName,
    company: data.customerCompany,
    phone: data.customerPhone,
    id: data.customerId,
  };

  // توليد المحتوى
  const bodyContent = generateReceiptContent(theme, data);

  // توليد HTML الكامل باستخدام Print Engine
  const htmlContent = generatePrintDocument({
    theme,
    title: `إيصال استلام - ${data.customerName}`,
    headerData,
    logoDataUri,
    partyData,
    bodyContent
  });

  // فتح نافذة الطباعة
  openPrintWindow(htmlContent, `إيصال_${data.receiptNumber}`);
  toast.success('تم فتح الإيصال للطباعة بنجاح!');
}

// =====================================================
// Hook للاستخدام في المكونات
// =====================================================

export function useReceiptPrint() {
  const { theme, isLoading } = usePrintTheme(DOCUMENT_TYPES.PAYMENT_RECEIPT);
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: ReceiptData) => {
    if (isLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    setIsPrinting(true);
    try {
      await printReceipt(theme, data);
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading };
}
