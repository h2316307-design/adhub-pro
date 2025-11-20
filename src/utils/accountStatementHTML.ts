// ✅ دالة مشتركة لتوليد HTML كشف الحساب (تُستخدم للطباعة والإرسال كـ PDF)

interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
  notes: string;
  method?: string;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  writtenName: string;
}

interface Statistics {
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

interface CustomerData {
  name: string;
  id: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface GenerateAccountStatementHTMLParams {
  customerData: CustomerData;
  allTransactions: Transaction[];
  statistics: Statistics;
  currency: Currency;
  startDate?: string;
  endDate?: string;
  statementNumber?: string;
  statementDate?: string;
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export function generateAccountStatementHTML({
  customerData,
  allTransactions,
  statistics,
  currency,
  startDate,
  endDate,
  statementNumber,
  statementDate,
}: GenerateAccountStatementHTMLParams): string {
  const periodStart = startDate ? new Date(startDate).toLocaleDateString('ar-LY') : 'غير محدد';
  const periodEnd = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : 'غير محدد';
  const finalStatementDate = statementDate || new Date().toLocaleDateString('ar-LY');
  const finalStatementNumber = statementNumber || `STMT-${Date.now()}`;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>كشف حساب ${customerData.name}</title>
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
          font-size: 12px;
          line-height: 1.4;
          overflow: hidden;
        }
        
        .statement-container {
          width: 210mm;
          height: 297mm;
          padding: 15mm;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        
        .statement-info {
          text-align: left;
          direction: ltr;
          order: 2;
        }
        
        .statement-title {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        
        .statement-details {
          font-size: 12px;
          color: #666;
          line-height: 1.6;
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
          display: block;
          margin-right: 0;
        }
        
        .company-details {
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          font-weight: 400;
          text-align: right;
        }
        
        .customer-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 0;
          margin-bottom: 25px;
          border-right: 4px solid #000;
        }
        
        .customer-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #000;
        }
        
        .customer-details {
          font-size: 13px;
          line-height: 1.6;
        }
        
        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
          table-layout: fixed;
        }
        
        .transactions-table th {
          background: #000;
          color: white;
          padding: 12px 8px;
          text-align: center;
          font-weight: bold;
          border: 1px solid #000;
          font-size: 11px;
          height: 40px;
        }
        
        .transactions-table td {
          padding: 8px 6px;
          text-align: center;
          border: 1px solid #ddd;
          font-size: 10px;
          vertical-align: middle;
          height: 30px;
        }
        
        .transactions-table tbody tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .debit {
          color: #dc2626;
          font-weight: bold;
        }
        
        .credit {
          color: #16a34a;
          font-weight: bold;
        }
        
        .balance {
          font-weight: bold;
        }
        
        .summary-section {
          margin-top: auto;
          border-top: 2px solid #000;
          padding-top: 20px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 14px;
        }

        .summary-row.total-debits {
          font-size: 16px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 10px;
        }

        .summary-row.total-credits {
          font-size: 16px;
          font-weight: bold;
          color: #16a34a;
          margin-bottom: 10px;
        }
        
        .summary-row.balance {
          font-size: 20px;
          font-weight: bold;
          background: #000;
          color: white;
          padding: 20px 25px;
          border-radius: 0;
          margin-top: 15px;
          border: none;
        }
        
        .currency {
          font-weight: bold;
          color: #FFD700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }
        
        .footer {
          margin-top: 25px;
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
          
          .statement-container {
            width: 210mm !important;
            height: 297mm !important;
            padding: 15mm !important;
          }
          
          @page {
            size: A4 portrait;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="statement-container">
        <div class="header">
          <div class="company-info">
            <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
            <div class="company-details">
              طرابلس – طريق المطار، حي الزهور<br>
              هاتف: 0912612255
            </div>
          </div>
          
          <div class="statement-info">
            <div class="statement-title">كشف حساب</div>
            <div class="statement-details">
              رقم الكشف: ${finalStatementNumber}<br>
              التاريخ: ${finalStatementDate}<br>
              الفترة: ${periodStart} - ${periodEnd}
            </div>
          </div>
        </div>
        
        <div class="customer-info">
          <div class="customer-title">بيانات العميل</div>
          <div class="customer-details">
            <strong>الاسم:</strong> ${customerData.name}<br>
            ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
            ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
            ${customerData.email ? `<strong>البريد الإلكتروني:</strong> ${customerData.email}<br>` : ''}
            <strong>رقم العميل:</strong> ${customerData.id}
          </div>
        </div>
        
        <table class="transactions-table">
          <thead>
            <tr>
              <th style="width: 8%">#</th>
              <th style="width: 12%">التاريخ</th>
              <th style="width: 20%">البيان</th>
              <th style="width: 12%">المرجع</th>
              <th style="width: 12%">مدين</th>
              <th style="width: 12%">دائن</th>
              <th style="width: 12%">الرصيد</th>
              <th style="width: 12%">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${allTransactions.map((transaction, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY') : '—'}</td>
                <td style="text-align: right; padding-right: 8px;">${transaction.description}</td>
                <td>${transaction.reference}</td>
                <td class="debit">${transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—'}</td>
                <td class="credit">${transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—'}</td>
                <td class="balance">${currency.symbol} ${formatArabicNumber(transaction.balance)}</td>
                <td style="text-align: right; padding-right: 8px;">${transaction.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary-section">
          <div class="summary-row total-debits">
            <span>إجمالي المدين:</span>
            <span>${currency.symbol} ${formatArabicNumber(statistics.totalDebits)}</span>
          </div>
          <div class="summary-row total-credits">
            <span>إجمالي الدائن:</span>
            <span>- ${currency.symbol} ${formatArabicNumber(statistics.totalCredits)}</span>
          </div>
          <div class="summary-row balance" style="background: ${statistics.balance > 0 ? '#000' : '#065f46'};">
            <span>الرصيد النهائي:</span>
            <span class="currency">${currency.symbol} ${formatArabicNumber(Math.abs(statistics.balance))}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}</span>
          </div>
          <div style="margin-top: 15px; font-size: 13px; color: #666; text-align: center;">
            الرصيد بالكلمات: ${formatArabicNumber(Math.abs(statistics.balance))} ${currency.writtenName}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}
          </div>
        </div>
        
        <div class="footer">
          شكراً لتعاملكم معنا | Thank you for your business<br>
          هذا كشف حساب إلكتروني ولا يحتاج إلى ختم أو توقيع
        </div>
      </div>
    </body>
    </html>
  `;
}
