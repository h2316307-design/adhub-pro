/**
 * AccountStatementPrint - كشف الحساب
 * 
 * ✅ BLACK/GRAY formal theme
 * ✅ Logo: /logofares.svg (45px max)
 * ✅ Date filtering with opening balance
 * ✅ Compact A4-friendly layout
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { usePrintTheme, formatArabicNumber, formatDate } from '@/print-engine';
import {
  PrintColumn,
  PrintTotalsItem,
  PrintPartyData,
  PrintDocumentData,
  mapPrintThemeToMeasurementsConfig,
  openMeasurementsPrintWindow,
  MeasurementsHTMLOptions,
} from '@/print-engine/universal';

// =====================================================
// Types
// =====================================================

interface Transaction {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  notes: string;
  type: string;
}

interface Statistics {
  totalContracts: number;
  activeContracts: number;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  totalPayments: number;
}

interface CustomerData {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface Currency {
  code: string;
  symbol: string;
  writtenName: string;
}

export interface PrintAccountStatementOptions {
  customerData: CustomerData;
  transactions: Transaction[];
  statistics: Statistics;
  currency: Currency;
  startDate?: string;
  endDate?: string;
}

// =====================================================
// Date Filtering Logic - THE FIX
// =====================================================

interface FilterResult {
  filteredTransactions: Transaction[];
  openingBalance: number;
}

function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate?: string,
  endDate?: string
): FilterResult {
  // If no dates provided, return all transactions
  if (!startDate && !endDate) {
    return { filteredTransactions: transactions, openingBalance: 0 };
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  // Set time to start/end of day for accurate comparison
  if (start) {
    start.setHours(0, 0, 0, 0);
  }
  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  // Calculate opening balance from transactions BEFORE the start date
  let openingBalance = 0;
  const filteredTransactions: Transaction[] = [];

  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.date);
    transactionDate.setHours(12, 0, 0, 0); // Normalize to noon

    if (start && transactionDate < start) {
      // Transaction is BEFORE our range - add to opening balance
      openingBalance += transaction.debit - transaction.credit;
    } else if (
      (!start || transactionDate >= start) &&
      (!end || transactionDate <= end)
    ) {
      // Transaction is WITHIN our range
      filteredTransactions.push(transaction);
    }
    // Transactions after end date are ignored
  }

  return { filteredTransactions, openingBalance };
}

function recalculateStatistics(
  transactions: Transaction[],
  openingBalance: number
): Statistics {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const t of transactions) {
    totalDebits += t.debit;
    totalCredits += t.credit;
  }

  const balance = openingBalance + totalDebits - totalCredits;

  return {
    totalContracts: 0,
    activeContracts: 0,
    totalDebits,
    totalCredits,
    balance,
    totalPayments: transactions.filter(t => t.credit > 0).length,
  };
}

// =====================================================
// Table Mapping
// =====================================================

function mapTransactionsToTableRows(
  transactions: Transaction[],
  currency: Currency,
  openingBalance: number
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];

  // Add opening balance row if exists
  if (openingBalance !== 0) {
    rows.push({
      index: '—',
      date: '—',
      description: 'رصيد سابق (مُرحّل)',
      reference: '—',
      debit: openingBalance > 0 ? `${currency.symbol} ${formatArabicNumber(openingBalance)}` : '—',
      credit: openingBalance < 0 ? `${currency.symbol} ${formatArabicNumber(Math.abs(openingBalance))}` : '—',
      balance: `${currency.symbol} ${formatArabicNumber(openingBalance)}`,
      notes: '',
    });
  }

  // Add transaction rows with running balance
  let runningBalance = openingBalance;
  transactions.forEach((transaction, index) => {
    runningBalance += transaction.debit - transaction.credit;
    rows.push({
      index: index + 1,
      date: formatDate(transaction.date),
      description: transaction.description,
      reference: transaction.reference,
      debit: transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—',
      credit: transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—',
      balance: `${currency.symbol} ${formatArabicNumber(runningBalance)}`,
      notes: transaction.notes !== '—' ? transaction.notes : '',
    });
  });

  return rows;
}

function getStatementTableColumns(): PrintColumn[] {
  return [
    { key: 'index', header: '#', width: '4%', align: 'center' },
    { key: 'date', header: 'التاريخ', width: '10%', align: 'center' },
    { key: 'description', header: 'البيان', width: '26%', align: 'right' },
    { key: 'reference', header: 'المرجع', width: '10%', align: 'center' },
    { key: 'debit', header: 'مدين', width: '12%', align: 'center' },
    { key: 'credit', header: 'دائن', width: '12%', align: 'center' },
    { key: 'balance', header: 'الرصيد', width: '14%', align: 'center' },
    { key: 'notes', header: 'ملاحظات', width: '12%', align: 'right' },
  ];
}

function getStatementTotals(
  statistics: Statistics,
  currency: Currency,
  openingBalance: number
): PrintTotalsItem[] {
  const items: PrintTotalsItem[] = [];

  // Show opening balance if it exists
  if (openingBalance !== 0) {
    items.push({
      label: 'الرصيد السابق (مُرحّل)',
      value: `${currency.symbol} ${formatArabicNumber(Math.abs(openingBalance))} ${openingBalance < 0 ? '(دائن)' : '(مدين)'}`,
      bold: true,
    });
  }

  items.push({
    label: 'إجمالي المدين',
    value: `${currency.symbol} ${formatArabicNumber(statistics.totalDebits)}`,
    bold: true,
  });

  items.push({
    label: 'إجمالي الدائن',
    value: `${currency.symbol} ${formatArabicNumber(statistics.totalCredits)}`,
    bold: true,
  });

  items.push({
    label: statistics.balance > 0 
      ? 'الرصيد النهائي (مستحق على العميل)' 
      : statistics.balance < 0 
        ? 'الرصيد النهائي (رصيد دائن للعميل)' 
        : 'الرصيد النهائي (مسدد بالكامل)',
    value: `${currency.symbol} ${formatArabicNumber(Math.abs(statistics.balance))}`,
    highlight: true,
    bold: true,
  });

  return items;
}

// =====================================================
// Main Print Function
// =====================================================

export async function printAccountStatement(
  theme: any,
  options: PrintAccountStatementOptions
): Promise<void> {
  const { customerData, transactions, statistics, currency, startDate, endDate } = options;

  // ✅ STEP 1: Filter transactions by date range
  const { filteredTransactions, openingBalance } = filterTransactionsByDateRange(
    transactions,
    startDate,
    endDate
  );

  // ✅ STEP 2: Recalculate statistics for filtered data
  const filteredStatistics = recalculateStatistics(filteredTransactions, openingBalance);

  const statementDate = new Date().toLocaleDateString('ar-LY');
  const statementNumber = `STMT-${Date.now()}`;
  
  // ✅ STEP 3: Format period dates for header (CLEARLY VISIBLE)
  const periodStart = startDate 
    ? new Date(startDate).toLocaleDateString('ar-LY') 
    : 'بداية السجل';
  const periodEnd = endDate 
    ? new Date(endDate).toLocaleDateString('ar-LY') 
    : 'حتى الآن';

  // ✅ Use BLACK/GRAY config (ignores theme colors)
  const config = mapPrintThemeToMeasurementsConfig(theme);

  // Document header with period dates
  const documentData: PrintDocumentData = {
    title: `كشف حساب العميل: ${customerData.name}`,
    documentNumber: `تاريخ الطباعة: ${statementDate}`,
    date: '',
    additionalInfo: [
      { label: 'الفترة من', value: periodStart },
      { label: 'إلى', value: periodEnd },
    ]
  };

  // Customer data
  const partyData: PrintPartyData = {
    title: 'بيانات العميل',
    name: customerData.name,
    company: customerData.company,
    phone: customerData.phone,
    email: customerData.email,
  };

  // Statistics cards
  const statisticsCards = [
    { label: 'حركة', value: filteredTransactions.length, unit: '' },
    { label: 'دفعة', value: filteredStatistics.totalPayments, unit: '' },
  ];

  // Print options
  const printOptions: MeasurementsHTMLOptions = {
    config,
    documentData,
    partyData,
    columns: getStatementTableColumns(),
    rows: mapTransactionsToTableRows(filteredTransactions, currency, openingBalance),
    totals: getStatementTotals(filteredStatistics, currency, openingBalance),
    totalsTitle: 'ملخص الرصيد',
    notes: `الرصيد بالكلمات: ${formatArabicNumber(Math.abs(filteredStatistics.balance))} ${currency.writtenName} ${filteredStatistics.balance < 0 ? '(رصيد دائن)' : filteredStatistics.balance === 0 ? '(مسدد بالكامل)' : ''}`,
    statisticsCards,
  };

  // Open print window
  openMeasurementsPrintWindow(printOptions, `كشف حساب ${customerData.name}`);
  toast.success(`تم فتح كشف الحساب للطباعة بنجاح بعملة ${currency.code}!`);
}

// =====================================================
// Hook
// =====================================================

export function useAccountStatementPrint() {
  const { theme, isLoading } = usePrintTheme(DOCUMENT_TYPES.MEASUREMENTS_INVOICE);
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (options: PrintAccountStatementOptions) => {
    if (isLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    setIsPrinting(true);
    try {
      await printAccountStatement(theme, options);
    } catch (error) {
      console.error('Error printing account statement:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading };
}
