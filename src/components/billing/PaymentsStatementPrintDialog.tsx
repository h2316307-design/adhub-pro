import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";

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
  
  const handlePrint = () => {
    const printContent = document.getElementById('payments-statement-print');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف الدفعات والإيصالات</title>
        ${printContent.querySelector('style')?.outerHTML || ''}
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-LY');
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ar-LY');
  };

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

        <div id="payments-statement-print" className="bg-white">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;900&display=swap');
            
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              body {
                margin: 0;
                padding: 0;
              }
              
              #payments-statement-print {
                width: 100% !important;
                max-width: 210mm !important;
                padding: 0 !important;
                margin: 0 auto !important;
                font-size: 11px !important;
                margin: 0 !important;
              }
            }
            
            #payments-statement-print {
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              color: #1f2937;
              line-height: 1.6;
              background: white;
              padding: 40px;
            }
            
            .statement-header {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
              color: white;
              padding: 30px;
              border-radius: 12px;
              text-align: center;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .statement-title {
              font-size: 32px;
              font-weight: 900;
              margin-bottom: 8px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            
            .statement-subtitle {
              font-size: 16px;
              opacity: 0.95;
              font-weight: 600;
            }
            
            .company-logo {
              text-align: center;
              margin-bottom: 20px;
            }
            
            .company-logo img {
              max-width: 200px;
              height: auto;
            }
            
            .summary-section {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
              color: white;
              padding: 25px;
              border-radius: 12px;
              margin-bottom: 30px;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .summary-item {
              text-align: center;
            }
            
            .summary-label {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 8px;
              opacity: 0.95;
            }
            
            .summary-value {
              font-size: 28px;
              font-weight: 900;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            
            .payments-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            
            .payments-table thead {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
              color: white;
            }
            
            .payments-table th {
              padding: 10px 8px;
              text-align: center;
              font-weight: 700;
              font-size: 11px;
              border: 1px solid #374151;
            }
            
            .payments-table td {
              padding: 8px 6px;
              text-align: center;
              border: 1px solid #e5e7eb;
              font-size: 10px;
            }
            
            @media print {
              .payments-table th {
                padding: 6px 4px;
                font-size: 9px;
              }
              
              .payments-table td {
                padding: 5px 3px;
                font-size: 8px;
              }
            }
            
            .payments-table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            
            .payments-table tbody tr:hover {
              background: #f3f4f6;
            }
            
            .entry-type-badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 12px;
            }
            
            .entry-type-receipt {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #10b981;
            }
            
            .entry-type-debt {
              background: #fee2e2;
              color: #991b1b;
              border: 1px solid #dc2626;
            }
            
            .amount-cell {
              font-weight: 900;
              font-size: 15px;
            }
            
            .amount-credit {
              color: #059669;
            }
            
            .amount-debit {
              color: #dc2626;
            }
            
            .footer {
              background: #f9fafb;
              border-top: 3px solid #1f2937;
              padding: 20px;
              text-align: center;
              margin-top: 40px;
              border-radius: 8px;
            }
            
            .footer-date {
              color: #6b7280;
              font-size: 13px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            
            .footer-text {
              color: #9ca3af;
              font-size: 11px;
              font-weight: 500;
            }
          `}</style>

          <div className="company-logo">
            <img src="/logofares.svg" alt="شعار الشركة" />
          </div>

          <div className="statement-header">
            <div className="statement-title">كشف الدفعات والإيصالات</div>
            <div className="statement-subtitle">بيان شامل بجميع المعاملات المالية</div>
          </div>

          <div className="summary-section">
            <div className="summary-item">
              <div className="summary-label">عدد المعاملات</div>
              <div className="summary-value">{totalReceipts}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">إجمالي المبالغ</div>
              <div className="summary-value">{formatCurrency(totalAmount)} د.ل</div>
            </div>
          </div>

          <table className="payments-table">
            <thead>
              <tr>
                <th style={{width: '5%'}}>#</th>
                <th style={{width: '15%'}}>العميل</th>
                <th style={{width: '10%'}}>النوع</th>
                <th style={{width: '12%'}}>المبلغ</th>
                <th style={{width: '10%'}}>التاريخ</th>
                <th style={{width: '10%'}}>رقم العقد</th>
                <th style={{width: '10%'}}>الطريقة</th>
                <th style={{width: '10%'}}>المرجع</th>
                <th style={{width: '10%'}}>المتبقي</th>
                <th style={{width: '8%'}}>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => {
                const isCredit = payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment' || payment.entry_type === 'general_credit';
                
                return (
                  <tr key={payment.id}>
                    <td>{index + 1}</td>
                    <td style={{fontWeight: '700'}}>{payment.customer_name}</td>
                    <td>
                      <span className={`entry-type-badge ${isCredit ? 'entry-type-receipt' : 'entry-type-debt'}`}>
                        {getEntryTypeLabel(payment.entry_type)}
                      </span>
                    </td>
                    <td className={`amount-cell ${isCredit ? 'amount-credit' : 'amount-debit'}`}>
                      {formatCurrency(payment.amount)} د.ل
                    </td>
                    <td style={{fontWeight: '600'}}>{formatDate(payment.paid_at)}</td>
                    <td>{payment.contract_number || '—'}</td>
                    <td>{payment.method || '—'}</td>
                    <td style={{fontSize: '12px'}}>{payment.reference || '—'}</td>
                    <td className="amount-cell" style={{color: payment.remaining_debt > 0 ? '#dc2626' : '#059669'}}>
                      {formatCurrency(payment.remaining_debt)} د.ل
                    </td>
                    <td style={{fontSize: '11px', color: '#6b7280'}}>{payment.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="footer">
            <div className="footer-date">
              تاريخ الطباعة: {formatDate(new Date().toISOString())} | الوقت: {new Date().toLocaleTimeString('ar-LY')}
            </div>
            <div className="footer-text">
              شكراً لتعاملكم معنا | هذا البيان صادر آلياً من نظام الإدارة
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
