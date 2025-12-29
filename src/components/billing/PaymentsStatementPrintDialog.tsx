/**
 * PaymentsStatementPrintDialog - كشف الدفعات والإيصالات
 * ✅ يستخدم نظام الطباعة الموحد (Unified Print Engine)
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { usePrintSettingsByType } from '@/store/printSettingsStore';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { getPrintLayoutConfig } from '@/lib/printLayoutHelper';
import {
  generateBasePrintCSS,
  generateDocumentHeader,
  generateDocumentFooter,
  formatArabicNumber,
  formatDate,
  openPrintWindow,
  type DocumentHeaderData,
} from '@/lib/printHtmlGenerator';

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
  entry_type: string;
  contract_number: number | null;
  distributed_payment_id: string | null;
  remaining_debt: number;
}

interface PaymentsStatementPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: Payment[];
}

export function PaymentsStatementPrintDialog({
  open,
  onOpenChange,
  payments,
}: PaymentsStatementPrintDialogProps) {
  
  // ✅ استخدام إعدادات الطباعة الموحدة
  const { settings: printSettings } = usePrintSettingsByType(DOCUMENT_TYPES.PAYMENT_RECEIPT);
  
  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receipt': 'إيصال',
      'payment': 'دفعة',
      'invoice': 'فاتورة',
      'debt': 'دين',
      'account_payment': 'دفعة حساب',
      'general_credit': 'رصيد عام',
    };
    return labels[type] || type;
  };

  const totalReceipts = payments.filter(p => p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment').length;
  const totalAmount = payments.reduce((sum, p) => {
    if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment' || p.entry_type === 'general_credit') {
      return sum + p.amount;
    }
    return sum;
  }, 0);

  const handlePrint = async () => {
    // ✅ الحصول على config من النظام الموحد
    const config = getPrintLayoutConfig(printSettings);
    
    // تحميل الشعار
    let logoDataUri = '';
    if (config.showLogo && config.logoPath) {
      try {
        const response = await fetch(config.logoPath);
        const blob = await response.blob();
        logoDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    }

    const statementNumber = `PAY-${Date.now()}`;
    const statementDate = new Date().toLocaleDateString('ar-LY');

    // بيانات الهيدر
    const headerData: DocumentHeaderData = {
      titleEn: 'PAYMENTS STATEMENT',
      titleAr: 'كشف الدفعات والإيصالات',
      documentNumber: statementNumber,
      date: statementDate,
      additionalDetails: [
        { label: 'عدد المعاملات', value: totalReceipts.toString() },
      ],
    };

    // ملخص الإحصائيات
    const summaryHtml = `
      <div class="summary-section" style="margin-bottom: 25px;">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-value neutral">${formatArabicNumber(totalReceipts)}</div>
            <div class="summary-label">عدد المعاملات</div>
          </div>
          <div class="summary-item">
            <div class="summary-value positive">${formatArabicNumber(totalAmount)} د.ل</div>
            <div class="summary-label">إجمالي المبالغ</div>
          </div>
        </div>
      </div>
    `;

    // جدول الدفعات
    const tableHtml = `
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 15%">العميل</th>
            <th style="width: 10%">النوع</th>
            <th style="width: 12%">المبلغ</th>
            <th style="width: 10%">التاريخ</th>
            <th style="width: 10%">رقم العقد</th>
            <th style="width: 10%">الطريقة</th>
            <th style="width: 10%">المرجع</th>
            <th style="width: 10%">المتبقي</th>
            <th style="width: 8%">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map((payment, index) => {
            const isCredit = payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment' || payment.entry_type === 'general_credit';
            
            return `
              <tr>
                <td>${index + 1}</td>
                <td style="font-weight: 700;">${payment.customer_name}</td>
                <td>
                  <span style="
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 10px;
                    background: ${isCredit ? '#d1fae5' : '#fee2e2'};
                    color: ${isCredit ? '#065f46' : '#991b1b'};
                    border: 1px solid ${isCredit ? '#10b981' : '#dc2626'};
                  ">
                    ${getEntryTypeLabel(payment.entry_type)}
                  </span>
                </td>
                <td class="${isCredit ? 'credit-cell' : 'debit-cell'}">${formatArabicNumber(payment.amount)} د.ل</td>
                <td>${formatDate(payment.paid_at)}</td>
                <td>${payment.contract_number || '—'}</td>
                <td>${payment.method || '—'}</td>
                <td style="font-size: 10px;">${payment.reference || '—'}</td>
                <td class="balance-cell" style="color: ${payment.remaining_debt > 0 ? '#dc2626' : '#059669'}">
                  ${formatArabicNumber(payment.remaining_debt)} د.ل
                </td>
                <td style="font-size: 10px; color: #666;">${payment.notes || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // توليد HTML الكامل
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${config.direction}" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف الدفعات والإيصالات</title>
        <style>
          ${generateBasePrintCSS(config)}
        </style>
      </head>
      <body>
        <div class="print-container">
          ${generateDocumentHeader(config, headerData, logoDataUri)}
          ${summaryHtml}
          ${tableHtml}
          ${generateDocumentFooter(config)}
        </div>
        
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 500);
          });
        </script>
      </body>
      </html>
    `;

    openPrintWindow(htmlContent, `كشف_الدفعات_${statementNumber}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="print:hidden flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">كشف الدفعات والإيصالات</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="default" className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* معاينة الكشف */}
        <div className="bg-card rounded-lg p-4 border">
          {/* ملخص */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary">{formatArabicNumber(totalReceipts)}</div>
              <div className="text-sm text-muted-foreground">عدد المعاملات</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{formatArabicNumber(totalAmount)} د.ل</div>
              <div className="text-sm text-muted-foreground">إجمالي المبالغ</div>
            </div>
          </div>

          {/* جدول المعاينة */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-center">#</th>
                  <th className="p-2 text-right">العميل</th>
                  <th className="p-2 text-center">النوع</th>
                  <th className="p-2 text-center">المبلغ</th>
                  <th className="p-2 text-center">التاريخ</th>
                  <th className="p-2 text-center">رقم العقد</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((payment, index) => {
                  const isCredit = payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment' || payment.entry_type === 'general_credit';
                  
                  return (
                    <tr key={payment.id} className="border-b">
                      <td className="p-2 text-center">{index + 1}</td>
                      <td className="p-2 text-right font-medium">{payment.customer_name}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {getEntryTypeLabel(payment.entry_type)}
                        </span>
                      </td>
                      <td className={`p-2 text-center font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {formatArabicNumber(payment.amount)} د.ل
                      </td>
                      <td className="p-2 text-center">{formatDate(payment.paid_at)}</td>
                      <td className="p-2 text-center">{payment.contract_number || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payments.length > 10 && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                ... و {payments.length - 10} معاملة أخرى
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
