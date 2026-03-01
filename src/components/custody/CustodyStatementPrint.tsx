import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml } from '@/lib/unifiedPrintFragments';
interface CustodyStatementPrintProps {
  accountId: string;
}

export function CustodyStatementPrint({ accountId }: CustodyStatementPrintProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      // Load account details
      const { data: account, error: accError } = await supabase
        .from('custody_accounts')
        .select(`
          *,
          employee:employees(name, position)
        `)
        .eq('id', accountId)
        .single();

      if (accError) throw accError;

      // Load transactions
      const { data: transactions, error: txError } = await supabase
        .from('custody_transactions')
        .select('*')
        .eq('custody_account_id', accountId)
        .order('transaction_date', { ascending: true });

      if (txError) throw txError;

      // Load expenses
      const { data: expenses, error: expError } = await supabase
        .from('custody_expenses')
        .select('*')
        .eq('custody_account_id', accountId)
        .order('expense_date', { ascending: true });

      if (expError) throw expError;

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        alert('يرجى السماح بفتح النوافذ المنبثقة');
        return;
      }

      const html = await generateStatementHTML(account, transactions || [], expenses || []);
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('فشل في إنشاء الكشف');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePrint} 
      variant="outline" 
      size="sm" 
      className="gap-1"
      disabled={loading}
    >
      <FileText className="h-4 w-4" />
      {loading ? 'جاري التحميل...' : 'كشف العهدة'}
    </Button>
  );
}

async function generateStatementHTML(account: any, transactions: any[], expenses: any[]): Promise<string> {
  const styles = await getMergedInvoiceStylesAsync('custody');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = styles.logoPath || '/logofares.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

  const statementFooterText = `${styles.footerText || 'تاريخ الطباعة:'} ${new Date().toLocaleString('ar-LY')}<br/>${styles.companyName} ${styles.companySubtitle}`;
  const statementStyles = { ...styles, footerText: statementFooterText };

  // ✅ تصفية المعاملات لاستبعاد نوع 'expense' لأنها ستُضاف من جدول المصروفات
  const filteredTransactions = transactions.filter(t => t.transaction_type !== 'expense');
  
  // Combine and sort all movements
  const allMovements = [
    ...filteredTransactions.map(t => ({
      date: t.transaction_date,
      type: t.transaction_type,
      description: t.description || '-',
      debit: t.transaction_type === 'withdrawal' ? t.amount : 0,
      credit: t.transaction_type === 'deposit' ? t.amount : 0,
      receipt: t.receipt_number || '-'
    })),
    ...expenses.map(e => ({
      date: e.expense_date,
      type: 'expense',
      description: `${e.expense_category}: ${e.description}`,
      debit: e.amount,
      credit: 0,
      receipt: e.receipt_number || '-'
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let runningBalance = account.initial_amount;
  const movementsWithBalance = allMovements.map(m => {
    const movement = { ...m, balance: runningBalance };
    runningBalance = runningBalance + m.credit - m.debit;
    return movement;
  });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف العهدة - ${account.account_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      font-family: ${styles.fontFamily || "'Noto Sans Arabic', Arial, sans-serif"};
      direction: rtl;
      text-align: right;
      background: white;
      color: ${styles.customerSectionTextColor};
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.3;
    }
    
    @page { size: A4 portrait; margin: 10mm; }
    .page { width: 190mm; padding: 0; }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid ${styles.primaryColor};
      padding-bottom: 12px;
    }

    ${unifiedHeaderFooterCss(statementStyles)}
    
    .account-section {
      background: ${hexToRgba(styles.customerSectionBgColor, 50)};
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      border: 2px solid ${styles.primaryColor};
    }
    
    .section-title {
      font-size: ${styles.headerFontSize}px;
      font-weight: bold;
      color: ${styles.tableHeaderTextColor};
      margin-bottom: 10px;
      text-align: center;
      background: ${styles.tableHeaderBgColor};
      padding: 6px;
      border-radius: 4px;
    }
    
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .info-box { background: white; padding: 6px; border-radius: 4px; border: 1px solid ${styles.tableBorderColor}; text-align: center; }
    .info-label { font-size: 9px; color: #666; font-weight: bold; margin-bottom: 3px; }
    .info-value { font-size: ${styles.bodyFontSize}px; color: ${styles.customerSectionTextColor}; font-weight: bold; }
    
    .movements-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 15px; }
    .movements-table th {
      background: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      font-weight: bold;
      padding: 6px 4px;
      text-align: center;
      border: 1px solid ${styles.tableBorderColor};
      font-size: 9px;
    }
    .movements-table td { padding: 5px 3px; border: 1px solid ${styles.tableBorderColor}; text-align: center; vertical-align: middle; }
    .movements-table tbody tr:nth-child(even) { background: ${hexToRgba(styles.tableRowEvenColor, 100)}; }
    .movements-table tbody tr:nth-child(odd) { background: ${hexToRgba(styles.tableRowOddColor, 100)}; }
    
    .debit-amount { color: #dc2626; font-weight: bold; }
    .credit-amount { color: #16a34a; font-weight: bold; }
    .balance-cell { font-weight: bold; background: #fef3c7; }
    
    .summary-section {
      background: ${hexToRgba(styles.customerSectionBgColor, 50)};
      padding: 12px;
      border-radius: 6px;
      margin-top: 15px;
      border: 2px solid ${styles.primaryColor};
    }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .summary-box { background: white; padding: 10px; border-radius: 4px; border: 1px solid ${styles.tableBorderColor}; text-align: center; }
    .summary-label { font-size: 9px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: ${styles.headerFontSize}px; font-weight: bold; color: ${styles.customerSectionTextColor}; }
    
    .final-balance {
      background: ${styles.totalBgColor};
      color: ${styles.totalTextColor};
      padding: 15px;
      text-align: center;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
      margin-top: 15px;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid ${styles.primaryColor};
      text-align: center;
      font-size: 8px;
      color: ${styles.footerTextColor};
    }
    
    @media print {
      html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${unifiedHeaderHtml({
      styles: statementStyles,
      fullLogoUrl,
      metaLinesHtml: 'كشف حساب عهدة مالية<br/>Account Statement',
      titleEn: 'CUSTODY STATEMENT',
    })}
    
    <div class="account-section">
      <div class="section-title">بيانات العهدة</div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">رقم العهدة</div>
          <div class="info-value">${account.account_number}</div>
        </div>
        <div class="info-box">
          <div class="info-label">اسم الموظف</div>
          <div class="info-value">${account.employee?.name || '-'}</div>
        </div>
        <div class="info-box">
          <div class="info-label">الوظيفة</div>
          <div class="info-value">${account.employee?.position || '-'}</div>
        </div>
        <div class="info-box">
          <div class="info-label">تاريخ الاستلام</div>
          <div class="info-value">${new Date(account.assigned_date).toLocaleDateString('ar-LY')}</div>
        </div>
      </div>
    </div>
    
    <table class="movements-table">
      <thead>
        <tr>
          <th style="width: 12%;">التاريخ</th>
          <th style="width: 12%;">النوع</th>
          <th style="width: 30%;">البيان</th>
          <th style="width: 10%;">رقم الإيصال</th>
          <th style="width: 12%;">مدين</th>
          <th style="width: 12%;">دائن</th>
          <th style="width: 12%;">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #fef3c7; font-weight: bold;">
          <td>${new Date(account.assigned_date).toLocaleDateString('ar-LY')}</td>
          <td>رصيد افتتاحي</td>
          <td>المبلغ المستلم</td>
          <td>-</td>
          <td>-</td>
          <td class="credit-amount">${account.initial_amount.toLocaleString('ar-LY')}</td>
          <td class="balance-cell">${account.initial_amount.toLocaleString('ar-LY')}</td>
        </tr>
        ${movementsWithBalance.map(m => `
        <tr>
          <td>${new Date(m.date).toLocaleDateString('ar-LY')}</td>
          <td>${m.type === 'deposit' ? 'إيداع' : m.type === 'withdrawal' ? 'سحب' : 'مصروف'}</td>
          <td style="text-align: right;">${m.description}</td>
          <td>${m.receipt}</td>
          <td class="debit-amount">${m.debit > 0 ? m.debit.toLocaleString('ar-LY') : '-'}</td>
          <td class="credit-amount">${m.credit > 0 ? m.credit.toLocaleString('ar-LY') : '-'}</td>
          <td class="balance-cell">${m.balance.toLocaleString('ar-LY')}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="summary-section">
      <div class="section-title">ملخص الحركات</div>
      <div class="summary-grid">
        <div class="summary-box">
          <div class="summary-label">المبلغ الأولي</div>
          <div class="summary-value">${account.initial_amount.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي الإيداعات</div>
          <div class="summary-value" style="color: #16a34a;">
            ${transactions.filter(t => t.transaction_type === 'deposit').reduce((s, t) => s + t.amount, 0).toLocaleString('ar-LY')} د.ل
          </div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي السحوبات</div>
          <div class="summary-value" style="color: #dc2626;">
            ${transactions.filter(t => t.transaction_type === 'withdrawal').reduce((s, t) => s + t.amount, 0).toLocaleString('ar-LY')} د.ل
          </div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي المصروفات</div>
          <div class="summary-value" style="color: #dc2626;">
            ${expenses.reduce((s, e) => s + e.amount, 0).toLocaleString('ar-LY')} د.ل
          </div>
        </div>
      </div>
    </div>
    
    <div class="final-balance">
      الرصيد الحالي: ${account.current_balance.toLocaleString('ar-LY')} دينار ليبي
    </div>
    
    ${unifiedFooterHtml(statementStyles)}
  </div>
  
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}
