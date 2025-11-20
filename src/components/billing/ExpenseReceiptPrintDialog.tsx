import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: any;
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export default function ExpenseReceiptPrintDialog({ 
  open, 
  onOpenChange, 
  expense 
}: ExpenseReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = async () => {
    if (!expense) {
      toast.error('لا توجد بيانات للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      const receiptDate = expense.expense_date 
        ? new Date(expense.expense_date).toLocaleDateString('ar-LY')
        : new Date().toLocaleDateString('ar-LY');
      const receiptNumber = expense.receipt_number || `EXP-${Date.now()}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>إيصال استلام - ${receiptNumber}</title>
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
            
            .receipt-container {
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
            
            .receipt-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin-bottom: 8px;
            }
            
            .receipt-details {
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
            
            .expense-section {
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
              font-size: 12px;
              color: #333;
              font-weight: normal;
            }
            
            .amount-section {
              background: #000;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 18px;
              text-align: center;
            }
            
            .amount-label {
              font-size: 14px;
              margin-bottom: 8px;
            }
            
            .amount-value {
              font-size: 28px;
              font-weight: bold;
            }
            
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 40px;
              padding-top: 20px;
            }
            
            .signature-box {
              text-align: center;
            }
            
            .signature-line {
              border-top: 2px solid #000;
              margin-top: 60px;
              padding-top: 10px;
              font-weight: bold;
            }
            
            .footer {
              margin-top: auto;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .receipt-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 12mm !important;
              }
              
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-info">
                <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                <div class="company-details">
                  طرابلس – طريق المطار، حي الزهور<br>
                  هاتف: 0912612255
                </div>
              </div>
              
              <div class="receipt-info">
                <div class="receipt-title">إيصال استلام</div>
                <div class="receipt-details">
                  رقم الإيصال: ${receiptNumber}<br>
                  التاريخ: ${receiptDate}<br>
                  العملة: دينار ليبي
                </div>
              </div>
            </div>
            
            <div class="amount-section">
              <div class="amount-label">المبلغ المستلم</div>
              <div class="amount-value">${formatArabicNumber(expense.amount)} د.ل</div>
            </div>
            
            <div class="expense-section">
              <div class="section-title">تفاصيل المصروف</div>
              <div class="info-grid">
                <div class="info-box">
                  <div class="info-label">الوصف:</div>
                  <div class="info-value">${expense.description || 'غير محدد'}</div>
                </div>
                <div class="info-box">
                  <div class="info-label">الفئة:</div>
                  <div class="info-value">${expense.category || 'غير محدد'}</div>
                </div>
                <div class="info-box">
                  <div class="info-label">طريقة الدفع:</div>
                  <div class="info-value">${expense.payment_method || 'نقدي'}</div>
                </div>
                <div class="info-box">
                  <div class="info-label">التاريخ:</div>
                  <div class="info-value">${receiptDate}</div>
                </div>
                ${expense.notes ? `
                <div class="info-box" style="grid-column: 1 / -1;">
                  <div class="info-label">ملاحظات:</div>
                  <div class="info-value">${expense.notes}</div>
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="signatures">
              <div class="signature-box">
                <div class="signature-line">
                  المسلم (${expense.sender_name || 'المدير'})
                </div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  المستلم (${expense.receiver_name || '...................'})
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>شركة الفارس الذهبي للدعاية والإعلان</p>
              <p>طرابلس – طريق المطار، حي الزهور | هاتف: 0912612255</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        toast.error('فشل فتح نافذة الطباعة');
        setIsGenerating(false);
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setIsGenerating(false);
        }, 500);
      };

    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('حدث خطأ أثناء الطباعة');
      setIsGenerating(false);
    }
  };

  if (!expense) return null;

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-2xl">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="text-right">طباعة إيصال استلام</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>

        <div className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">المبلغ:</p>
              <p className="font-bold text-lg">{formatArabicNumber(expense.amount)} د.ل</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الوصف:</p>
              <p className="font-medium">{expense.description || 'غير محدد'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">المستلم:</p>
              <p className="font-medium">{expense.receiver_name || 'غير محدد'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">المسلم:</p>
              <p className="font-medium">{expense.sender_name || 'المدير'}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <X className="ml-2 h-4 w-4" />
            إغلاق
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isGenerating}
          >
            <Printer className="ml-2 h-4 w-4" />
            {isGenerating ? 'جاري الطباعة...' : 'طباعة'}
          </Button>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
