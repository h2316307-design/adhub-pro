import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, X, Filter, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { usePrintTheme, formatArabicNumber, formatDate } from '@/print-engine';
import {
  PrintColumn,
  PrintTotalsItem,
  PrintDocumentData,
  mapPrintThemeToMeasurementsConfig,
  openMeasurementsPrintWindow,
  MeasurementsHTMLOptions,
} from '@/print-engine/universal';

interface Contract {
  id: string;
  contract_number: string;
  customer_name: string;
  ad_type: string;
  feePercent: number;
  fullFeeAmount: number;
  collectedFeeAmount: number;
  rent_cost: number;
  installation_cost: number;
  print_cost: number;
  total_amount: number;
  total_paid: number;
  collectionPercentage: number;
  start_date: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
}

interface PeriodClosure {
  id: number;
  period_start?: string;
  period_end?: string;
  contract_start?: string;
  contract_end?: string;
  closure_date: string;
  closure_type: 'period' | 'contract_range';
  total_contracts: number;
  total_amount: number;
  total_withdrawn: number;
  remaining_balance: number;
  notes?: string;
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Faces_Count: number;
  City: string;
  District: string;
  Level: string;
  Contract_Number: number;
  Price: number;
}

interface OperatingDuesPrintDialogProps {
  open: boolean;
  onClose: () => void;
  contracts: Contract[];
  withdrawals: Withdrawal[];
  closures: PeriodClosure[];
  excludedIds: Set<string>;
  totals: {
    totalContracts: number;
    poolTotal: number;
    totalWithdrawn: number;
    remainingPool: number;
  };
}

// =====================================================
// Table Mapping Functions
// =====================================================

function getContractsTableColumns(): PrintColumn[] {
  return [
    { key: 'index', header: '#', width: '3%', align: 'center' },
    { key: 'contract_number', header: 'رقم العقد', width: '7%', align: 'center' },
    { key: 'customer_name', header: 'اسم العميل', width: '12%', align: 'right' },
    { key: 'ad_type', header: 'نوع الإعلان', width: '8%', align: 'center' },
    { key: 'start_date', header: 'تاريخ العقد', width: '8%', align: 'center' },
    { key: 'fee_percent', header: 'النسبة %', width: '6%', align: 'center' },
    { key: 'rent_cost', header: 'سعر الإيجار', width: '9%', align: 'center' },
    { key: 'installation_print', header: 'التركيب والطباعة', width: '9%', align: 'center' },
    { key: 'total_amount', header: 'الإجمالي', width: '9%', align: 'center' },
    { key: 'total_paid', header: 'المدفوع', width: '9%', align: 'center' },
    { key: 'collection_percent', header: 'نسبة التحصيل', width: '7%', align: 'center' },
    { key: 'full_fee', header: 'النسبة الكاملة', width: '8%', align: 'center' },
    { key: 'collected_fee', header: 'النسبة المتحصلة', width: '8%', align: 'center' },
  ];
}

function getWithdrawalsTableColumns(): PrintColumn[] {
  return [
    { key: 'index', header: '#', width: '8%', align: 'center' },
    { key: 'date', header: 'التاريخ', width: '20%', align: 'center' },
    { key: 'amount', header: 'المبلغ', width: '25%', align: 'center' },
    { key: 'method', header: 'طريقة السحب', width: '20%', align: 'center' },
    { key: 'note', header: 'ملاحظات', width: '27%', align: 'right' },
  ];
}

function mapContractsToTableRows(contracts: Contract[]): Record<string, any>[] {
  return contracts.map((c, index) => ({
    index: index + 1,
    contract_number: c.contract_number,
    customer_name: c.customer_name,
    ad_type: c.ad_type || '—',
    start_date: c.start_date ? formatDate(c.start_date) : '—',
    fee_percent: `${c.feePercent.toFixed(c.feePercent % 1 === 0 ? 0 : 2)}%`,
    rent_cost: `${formatArabicNumber(c.rent_cost)} د.ل`,
    installation_print: `${formatArabicNumber(c.installation_cost + c.print_cost)} د.ل`,
    total_amount: `${formatArabicNumber(c.total_amount)} د.ل`,
    total_paid: `${formatArabicNumber(c.total_paid)} د.ل`,
    collection_percent: `${c.collectionPercentage.toFixed(c.collectionPercentage % 1 === 0 ? 0 : 2)}%`,
    full_fee: `${formatArabicNumber(c.fullFeeAmount)} د.ل`,
    collected_fee: `${formatArabicNumber(c.collectedFeeAmount)} د.ل`,
  }));
}

function mapWithdrawalsToTableRows(withdrawals: Withdrawal[]): Record<string, any>[] {
  return withdrawals.map((w, index) => ({
    index: index + 1,
    date: formatDate(w.date),
    amount: `${formatArabicNumber(w.amount)} د.ل`,
    method: w.method || 'نقدي',
    note: w.note || '—',
  }));
}

function getOperatingDuesTotals(
  totals: { poolTotal: number; totalWithdrawn: number; remainingPool: number },
  contractsCount: number
): PrintTotalsItem[] {
  return [
    {
      label: 'عدد العقود',
      value: `${contractsCount}`,
      bold: true,
    },
    {
      label: 'إجمالي النسب المستحقة',
      value: `${formatArabicNumber(totals.poolTotal)} د.ل`,
      bold: true,
    },
    {
      label: 'إجمالي المسحوبات',
      value: `${formatArabicNumber(totals.totalWithdrawn)} د.ل`,
      bold: true,
    },
    {
      label: 'الرصيد المتبقي',
      value: `${formatArabicNumber(totals.remainingPool)} د.ل`,
      highlight: true,
      bold: true,
    },
  ];
}

export function OperatingDuesPrintDialog({
  open,
  onClose,
  contracts,
  withdrawals,
  closures,
  excludedIds,
  totals
}: OperatingDuesPrintDialogProps) {
  const [filterType, setFilterType] = useState<'all' | 'contract_range' | 'date_range'>('all');
  const [contractFrom, setContractFrom] = useState<string>('');
  const [contractTo, setContractTo] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [billboardsByContract, setBillboardsByContract] = useState<Record<string, Billboard[]>>({});
  const [loading, setLoading] = useState(false);
  
  const { theme, isLoading: themeLoading } = usePrintTheme(DOCUMENT_TYPES.MEASUREMENTS_INVOICE);

  // Load billboards
  useEffect(() => {
    if (open) {
      loadBillboards();
    }
  }, [open]);

  const loadBillboards = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, City, District, Level, Contract_Number, Price');
      
      if (data) {
        const grouped: Record<string, Billboard[]> = {};
        data.forEach((b: any) => {
          if (b.Contract_Number) {
            const key = String(b.Contract_Number);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(b);
          }
        });
        setBillboardsByContract(grouped);
      }
    } catch (e) {
      console.error('Error loading billboards:', e);
    }
    setLoading(false);
  };

  const contractNumbers = useMemo(() => {
    return contracts
      .map(c => c.contract_number)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return b.localeCompare(a);
      });
  }, [contracts]);

  const isContractClosed = (contract: Contract) => {
    return closures.some(closure => {
      if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
        const contractDate = new Date(contract.start_date);
        const closureStart = new Date(closure.period_start);
        const closureEnd = new Date(closure.period_end);
        return contractDate >= closureStart && contractDate <= closureEnd;
      } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
        const contractNum = contract.contract_number;
        return contractNum >= closure.contract_start && contractNum <= closure.contract_end;
      }
      return false;
    });
  };

  const filteredContracts = useMemo(() => {
    let filtered = contracts.filter(c => !isContractClosed(c) && !excludedIds.has(c.contract_number));
    
    if (filterType === 'contract_range' && contractFrom && contractTo) {
      const from = parseInt(contractFrom);
      const to = parseInt(contractTo);
      filtered = filtered.filter(c => {
        const num = parseInt(c.contract_number);
        return num >= from && num <= to;
      });
    } else if (filterType === 'date_range' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      filtered = filtered.filter(c => {
        const date = new Date(c.start_date);
        return date >= from && date <= to;
      });
    }
    
    return filtered;
  }, [contracts, filterType, contractFrom, contractTo, dateFrom, dateTo, closures, excludedIds]);

  const filteredWithdrawals = useMemo(() => {
    if (filterType === 'date_range' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return withdrawals.filter(w => {
        const date = new Date(w.date);
        return date >= from && date <= to;
      });
    }
    return withdrawals;
  }, [withdrawals, filterType, dateFrom, dateTo]);

  const filteredTotals = useMemo(() => {
    const poolTotal = filteredContracts.reduce((sum, c) => sum + c.collectedFeeAmount, 0);
    const totalWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    
    return {
      totalContracts: filteredContracts.length,
      poolTotal,
      totalWithdrawn,
      remainingPool: poolTotal - totalWithdrawn
    };
  }, [filteredContracts, filteredWithdrawals]);

  const handlePrint = () => {
    if (themeLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    const filterText = filterType === 'contract_range' && contractFrom && contractTo 
      ? `من عقد ${contractFrom} إلى ${contractTo}`
      : filterType === 'date_range' && dateFrom && dateTo
      ? `من ${new Date(dateFrom).toLocaleDateString('ar-LY')} إلى ${new Date(dateTo).toLocaleDateString('ar-LY')}`
      : 'جميع العقود';

    const periodStart = filterType === 'date_range' && dateFrom 
      ? new Date(dateFrom).toLocaleDateString('ar-LY') 
      : filterType === 'contract_range' && contractFrom
      ? `عقد ${contractFrom}`
      : 'بداية السجل';
    
    const periodEnd = filterType === 'date_range' && dateTo 
      ? new Date(dateTo).toLocaleDateString('ar-LY') 
      : filterType === 'contract_range' && contractTo
      ? `عقد ${contractTo}`
      : 'حتى الآن';

    const config = mapPrintThemeToMeasurementsConfig(theme);
    const printDate = new Date().toLocaleDateString('ar-LY');

    // Document header
    const documentData: PrintDocumentData = {
      title: 'كشف مستحقات التشغيل',
      documentNumber: ``,
      date: '',
      additionalInfo: [
        { label: 'الفترة من', value: periodStart },
        { label: 'إلى', value: periodEnd },
      ]
    };

    // Statistics cards - include contracts count and print date
    const statisticsCards = [
      { label: 'عدد العقود', value: filteredTotals.totalContracts, unit: '' },
      { label: 'عدد السحوبات', value: filteredWithdrawals.length, unit: '' },
    ];

    // Build summary header HTML
    const summaryHeaderHtml = `
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="font-size: 18px; font-weight: bold; color: #1e293b; margin: 0;">ملخص كشف مستحقات التشغيل</h2>
          <span style="font-size: 12px; color: #64748b;">تاريخ الطباعة: ${printDate}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
          <div style="background: white; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">عدد العقود</div>
            <div style="font-size: 20px; font-weight: bold; color: #1e293b;">${filteredTotals.totalContracts}</div>
          </div>
          <div style="background: white; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">إجمالي النسب المستحقة</div>
            <div style="font-size: 16px; font-weight: bold; color: #059669;">${formatArabicNumber(filteredTotals.poolTotal)} د.ل</div>
          </div>
          <div style="background: white; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">إجمالي المسحوبات</div>
            <div style="font-size: 16px; font-weight: bold; color: #dc2626;">${formatArabicNumber(filteredTotals.totalWithdrawn)} د.ل</div>
          </div>
          <div style="background: white; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">الرصيد المتبقي</div>
            <div style="font-size: 16px; font-weight: bold; color: #2563eb;">${formatArabicNumber(filteredTotals.remainingPool)} د.ل</div>
          </div>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 4px; border-right: 4px solid #f59e0b;">
          <span style="font-size: 11px; color: #92400e; font-weight: 500;">ملاحظة: هذه النسبة محسوبة من غير تكاليف الطباعة أو التركيب</span>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
          <strong>فترة الكشف:</strong> ${periodStart} — ${periodEnd}
        </div>
      </div>
    `;

    // Print options for contracts
    const printOptions: MeasurementsHTMLOptions = {
      config,
      documentData,
      columns: getContractsTableColumns(),
      rows: mapContractsToTableRows(filteredContracts),
      totals: getOperatingDuesTotals(filteredTotals, filteredContracts.length),
      totalsTitle: 'ملخص المستحقات',
      notes: '',
      statisticsCards,
      customHeaderHtml: summaryHeaderHtml,
    };

    // Generate additional sections for withdrawals
    let additionalContent = '';
    
    if (filteredWithdrawals.length > 0) {
      const withdrawalRows = mapWithdrawalsToTableRows(filteredWithdrawals);
      const withdrawalCols = getWithdrawalsTableColumns();
      
      additionalContent = `
        <div style="margin-top: 30px; page-break-before: auto;">
          <h3 style="font-size: 14px; font-weight: bold; color: #111827; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #111827;">
            السحوبات (${filteredWithdrawals.length})
          </h3>
          <table class="print-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                ${withdrawalCols.map(col => `
                  <th style="width: ${col.width}; text-align: ${col.align}; background: #111827; color: white; padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">
                    ${col.header}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${withdrawalRows.map((row, idx) => `
                <tr style="background: ${idx % 2 === 0 ? 'white' : '#f9fafb'};">
                  ${withdrawalCols.map(col => `
                    <td style="text-align: ${col.align}; padding: 8px; border: 1px solid #e5e7eb; font-size: 10px;">
                      ${row[col.key]}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // If showing details, add billboard details for ALL contracts with billboards
    if (showDetails) {
      const contractsWithBillboards = filteredContracts.filter(c => {
        const bbs = billboardsByContract[c.contract_number];
        return bbs && bbs.length > 0;
      });

      if (contractsWithBillboards.length > 0) {
        additionalContent += `
          <div style="margin-top: 30px; page-break-before: always;">
            <h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #1e293b;">
              تفاصيل اللوحات لكل عقد (${contractsWithBillboards.length} عقد)
            </h3>
            ${contractsWithBillboards.map(c => {
              const billboards = billboardsByContract[c.contract_number] || [];
              
              // Group by level
              const byLevel: Record<string, any[]> = {};
              billboards.forEach((b: any) => {
                const level = b.Level || 'غير محدد';
                if (!byLevel[level]) byLevel[level] = [];
                byLevel[level].push(b);
              });
              
              const totalBillboardRent = billboards.reduce((sum: number, b: any) => sum + (b.Price || 0), 0);
              
              return `
                <div style="background: linear-gradient(to bottom, #f8fafc, #ffffff); padding: 15px; margin-bottom: 20px; border: 2px solid #e2e8f0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #1e293b;">
                    <div>
                      <span style="font-size: 14px; font-weight: bold; color: #1e293b;">العقد رقم: ${c.contract_number}</span>
                      <span style="font-size: 12px; color: #64748b; margin-right: 10px;">${c.customer_name}</span>
                    </div>
                    <div style="font-size: 11px; color: #475569;">
                      <span style="background: #dbeafe; padding: 3px 8px; border-radius: 4px; margin-left: 8px;">عدد اللوحات: ${billboards.length}</span>
                      <span style="background: #dcfce7; padding: 3px 8px; border-radius: 4px; margin-left: 8px;">الإيجار: ${formatArabicNumber(c.rent_cost)} د.ل</span>
                      <span style="background: #fef3c7; padding: 3px 8px; border-radius: 4px;">النسبة المستحقة: ${formatArabicNumber(c.collectedFeeAmount)} د.ل</span>
                    </div>
                  </div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                      <tr style="background: #1e293b; color: white;">
                        <th style="padding: 8px 10px; border: 1px solid #334155; text-align: center;">المستوى</th>
                        <th style="padding: 8px 10px; border: 1px solid #334155; text-align: center;">عدد اللوحات</th>
                        <th style="padding: 8px 10px; border: 1px solid #334155; text-align: center;">إيجار اللوحات</th>
                        <th style="padding: 8px 10px; border: 1px solid #334155; text-align: center;">النسبة (${c.feePercent}%)</th>
                        <th style="padding: 8px 10px; border: 1px solid #334155; text-align: center;">النسبة المتحصلة (${c.collectionPercentage.toFixed(0)}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(byLevel).map(([level, bbs], idx) => {
                        const levelRent = bbs.reduce((sum: number, b: any) => sum + (b.Price || 0), 0);
                        const fullLevelFee = levelRent * (c.feePercent / 100);
                        const collectedLevelFee = fullLevelFee * (c.collectionPercentage / 100);
                        return `
                          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 500;">${level}</td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${bbs.length}</td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${formatArabicNumber(levelRent)} د.ل</td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${formatArabicNumber(fullLevelFee)} د.ل</td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #059669;">${formatArabicNumber(collectedLevelFee)} د.ل</td>
                          </tr>
                        `;
                      }).join('')}
                      <tr style="background: #f1f5f9; font-weight: bold;">
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">الإجمالي</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${billboards.length}</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${formatArabicNumber(totalBillboardRent)} د.ل</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${formatArabicNumber(c.fullFeeAmount)} د.ل</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #059669;">${formatArabicNumber(c.collectedFeeAmount)} د.ل</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        additionalContent += `
          <div style="margin-top: 30px; padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center;">
            <span style="color: #dc2626; font-size: 12px;">لا توجد لوحات مرتبطة بالعقود المحددة</span>
          </div>
        `;
      }
    }

    // Open print window with additional content
    openMeasurementsPrintWindow(
      { ...printOptions, additionalContent },
      `كشف مستحقات التشغيل - ${filterText}`
    );
    toast.success('تم فتح الكشف للطباعة بنجاح!');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            طباعة كشف مستحقات التشغيل
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Note at the top */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            ⚠️ ملاحظة: هذه النسبة محسوبة من غير تكاليف الطباعة أو التركيب
          </p>
        </div>

        {/* Filter Options */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>خيارات التصفية</span>
          </div>
          
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="نوع التصفية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع العقود</SelectItem>
              <SelectItem value="contract_range">نطاق أرقام العقود</SelectItem>
              <SelectItem value="date_range">نطاق التواريخ</SelectItem>
            </SelectContent>
          </Select>

          {filterType === 'contract_range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">من عقد</label>
                <Select value={contractFrom} onValueChange={setContractFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العقد" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractNumbers.map(num => (
                      <SelectItem key={num} value={num}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">إلى عقد</label>
                <Select value={contractTo} onValueChange={setContractTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العقد" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractNumbers.map(num => (
                      <SelectItem key={num} value={num}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {filterType === 'date_range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">من تاريخ</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">إلى تاريخ</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">عدد العقود</div>
            <div className="text-lg font-bold">{filteredTotals.totalContracts}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">المجموع العام</div>
            <div className="text-lg font-bold text-green-600">{filteredTotals.poolTotal.toLocaleString()} د.ل</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">المسحوب</div>
            <div className="text-lg font-bold text-red-600">{filteredTotals.totalWithdrawn.toLocaleString()} د.ل</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">الرصيد المتبقي</div>
            <div className="text-lg font-bold">{filteredTotals.remainingPool.toLocaleString()} د.ل</div>
          </div>
        </div>

        {/* Show Details Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full"
          >
            {showDetails ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            {showDetails ? 'إخفاء تفاصيل اللوحات' : 'إظهار تفاصيل اللوحات لكل عقد'}
          </Button>
        </div>

        {/* Print Button */}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={handlePrint}
            disabled={loading || themeLoading}
          >
            <Printer className="h-4 w-4 ml-2" />
            {loading || themeLoading ? 'جاري التحميل...' : 'طباعة الكشف'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
