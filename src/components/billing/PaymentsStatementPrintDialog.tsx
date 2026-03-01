/**
 * PaymentsStatementPrintDialog - كشف الدفعات والإيصالات
 * ✅ يستخدم نظام الطباعة الموحد (Measurements Style) مع الشعار
 * ✅ يدعم تحديد الفترة الزمنية (من - إلى)
 * ✅ يدعم تجميع الدفعات الموزعة مع بيانات العهدة
 */

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Printer, Calendar, Filter, ChevronDown, ChevronRight, Wallet, User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  openMeasurementsPrintWindow, 
  MeasurementsHTMLOptions,
} from '@/print-engine/universal/generateMeasurementsHTML';
import { createMeasurementsConfigFromSettings } from '@/print-engine/universal/measurementsConfig';
import { PrintColumn } from '@/print-engine/universal/types';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { usePrintTheme } from '@/print-engine';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  balance_after?: number;
  ad_type?: string | null;
  // حقول إضافية للتفاصيل
  source_bank?: string | null;
  destination_bank?: string | null;
  transfer_reference?: string | null;
  collected_via_intermediary?: boolean;
  collector_name?: string | null;
  intermediary_commission?: number | null;
  transfer_fee?: number | null;
  net_amount?: number | null;
  commission_notes?: string | null;
  composite_task_id?: string | null;
}

interface CustodyInfo {
  employee_name: string;
  initial_amount: number;
  current_balance: number;
}

interface GroupedPayment {
  id: string;
  totalAmount: number;
  customerName: string;
  paidAt: string;
  distributions: Payment[];
  custodyInfo?: CustodyInfo | null;
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
  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [custodyDataMap, setCustodyDataMap] = useState<Record<string, CustodyInfo>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortAscending, setSortAscending] = useState<boolean>(true); // الأقدم أولاً افتراضياً
  const { settings: printSettings } = usePrintTheme(DOCUMENT_TYPES.PAYMENT_RECEIPT);

  // ✅ جلب بيانات العهد
  useEffect(() => {
    const loadCustodyData = async () => {
      const distributedPaymentIds = [...new Set(payments.filter(p => p.distributed_payment_id).map(p => p.distributed_payment_id as string))];
      if (distributedPaymentIds.length === 0) return;
      
      try {
        const { data: custodyData } = await supabase
          .from('custody_accounts')
          .select(`id, source_payment_id, initial_amount, current_balance, employees(name)`)
          .in('source_payment_id', distributedPaymentIds);

        const custodyMap: Record<string, CustodyInfo> = {};
        if (custodyData) {
          custodyData.forEach((custody: any) => {
            if (custody.source_payment_id) {
              custodyMap[custody.source_payment_id] = {
                employee_name: custody.employees?.name || 'غير معروف',
                initial_amount: custody.initial_amount || 0,
                current_balance: custody.current_balance || 0,
              };
            }
          });
        }
        setCustodyDataMap(custodyMap);
      } catch (error) {
        console.error('Error loading custody data:', error);
      }
    };

    if (open) loadCustodyData();
  }, [open, payments]);

  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    if (!startDate && !endDate) return payments;

    return payments.filter(payment => {
      if (!payment.paid_at) return false;
      const paymentDate = startOfDay(parseISO(payment.paid_at));
      
      const start = startDate ? startOfDay(parseISO(startDate)) : null;
      const end = endDate ? endOfDay(parseISO(endDate)) : null;

      if (start && end) {
        return isWithinInterval(paymentDate, { start, end });
      } else if (start) {
        return paymentDate >= start;
      } else if (end) {
        return paymentDate <= end;
      }
      return true;
    });
  }, [payments, startDate, endDate]);

  // ✅ تجميع الدفعات الموزعة
  const { groupedPayments, standalonePayments } = useMemo(() => {
    const groups: Record<string, GroupedPayment> = {};
    const standalone: Payment[] = [];
    
    filteredPayments.forEach(payment => {
      if (payment.distributed_payment_id) {
        const groupId = payment.distributed_payment_id;
        if (!groups[groupId]) {
          groups[groupId] = {
            id: groupId,
            totalAmount: 0,
            customerName: payment.customer_name,
            paidAt: payment.paid_at,
            distributions: [],
            custodyInfo: custodyDataMap[groupId] || null
          };
        }
        groups[groupId].totalAmount += Number(payment.amount) || 0;
        groups[groupId].distributions.push(payment);
      } else {
        standalone.push(payment);
      }
    });

    return { groupedPayments: Object.values(groups), standalonePayments: standalone };
  }, [filteredPayments, custodyDataMap]);
  
  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receipt': 'إيصال',
      'payment': 'دفعة',
      'invoice': 'فاتورة',
      'debt': 'دين سابق',
      'account_payment': 'دفعة حساب',
      'general_credit': 'صادر عام',
      'general_debit': 'وارد عام',
      'purchase_invoice': 'فاتورة مشتريات',
      'sales_invoice': 'فاتورة مبيعات',
      'printed_invoice': 'فاتورة طباعة',
    };
    return labels[type] || type;
  };

  const isCredit = (type: string) => 
    ['receipt', 'payment', 'account_payment', 'general_credit'].includes(type);

  const totalCredits = filteredPayments.filter(p => isCredit(p.entry_type)).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalDebits = filteredPayments.filter(p => ['debt', 'general_debit'].includes(p.entry_type)).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `من ${format(parseISO(startDate), 'd MMMM yyyy', { locale: ar })} إلى ${format(parseISO(endDate), 'd MMMM yyyy', { locale: ar })}`;
    } else if (startDate) {
      return `من ${format(parseISO(startDate), 'd MMMM yyyy', { locale: ar })}`;
    } else if (endDate) {
      return `حتى ${format(parseISO(endDate), 'd MMMM yyyy', { locale: ar })}`;
    }
    return 'كل الفترات';
  };

  // ✅ دالة بناء تفاصيل الملاحظات الشاملة
  const buildPaymentDetails = (payment: Payment): string => {
    const details: string[] = [];
    
    // الملاحظات الأصلية
    if (payment.notes && payment.notes.trim()) {
      details.push(payment.notes);
    }
    
    // تفاصيل التحويل البنكي
    if (payment.method === 'تحويل بنكي') {
      const bankInfo: string[] = [];
      if (payment.source_bank) bankInfo.push(`من: ${payment.source_bank}`);
      if (payment.destination_bank) bankInfo.push(`إلى: ${payment.destination_bank}`);
      if (payment.transfer_reference) bankInfo.push(`رقم العملية: ${payment.transfer_reference}`);
      if (bankInfo.length > 0) {
        details.push(bankInfo.join(' | '));
      }
    }
    
    // عمولة الوسيط
    if (payment.collected_via_intermediary && payment.intermediary_commission && payment.intermediary_commission > 0) {
      let commissionText = `عمولة وسيط: ${payment.intermediary_commission.toLocaleString('ar-LY')} د.ل`;
      if (payment.collector_name) commissionText += ` (${payment.collector_name})`;
      details.push(commissionText);
    }
    
    // عمولة التحويل
    if (payment.transfer_fee && payment.transfer_fee > 0) {
      details.push(`عمولة تحويل: ${payment.transfer_fee.toLocaleString('ar-LY')} د.ل`);
    }
    
    // المبلغ الصافي بعد العمولات
    if (payment.net_amount && payment.net_amount !== payment.amount) {
      details.push(`الصافي: ${payment.net_amount.toLocaleString('ar-LY')} د.ل`);
    }
    
    // مستحقات موظف (مهمة مجمعة)
    if (payment.composite_task_id) {
      details.push(`مستحقات موظف / مهمة تركيب`);
    }
    
    // ملاحظات العمولات
    if (payment.commission_notes && payment.commission_notes.trim()) {
      details.push(payment.commission_notes);
    }
    
    return details.join('<br/>');
  };

  const handlePrint = async () => {
    try {
      const config = createMeasurementsConfigFromSettings(printSettings);
      config.header.title.text = 'كشف الدفعات والإيصالات';

      const columns: PrintColumn[] = [
        { key: 'index', header: '#', width: '3%', align: 'center' },
        { key: 'date', header: 'التاريخ', width: '8%', align: 'center' },
        { key: 'customer_name', header: 'العميل', width: '12%', align: 'right' },
        { key: 'type', header: 'النوع', width: '8%', align: 'center' },
        { key: 'ad_type', header: 'نوع الإعلان', width: '8%', align: 'center' },
        { key: 'amount', header: 'المبلغ', width: '10%', align: 'center' },
        { key: 'contract', header: 'العقد', width: '6%', align: 'center' },
        { key: 'method', header: 'الطريقة', width: '8%', align: 'center' },
        { key: 'remaining', header: 'المتبقي', width: '9%', align: 'center' },
        { key: 'notes', header: 'البيان والتفاصيل', width: '28%', align: 'right' },
      ];

      // ✅ إنشاء صفوف تتضمن الدفعات المجمعة والتوزيعات
      const rows: any[] = [];
      let index = 0;

      // ترتيب جميع العناصر حسب التاريخ (تصاعدي = الأقدم أولاً، تنازلي = الأحدث أولاً)
      const allItems: Array<{ type: 'group' | 'payment'; data: GroupedPayment | Payment; date: Date }> = [];
      groupedPayments.forEach(group => allItems.push({ type: 'group', data: group, date: new Date(group.paidAt) }));
      standalonePayments.forEach(payment => allItems.push({ type: 'payment', data: payment, date: new Date(payment.paid_at) }));
      allItems.sort((a, b) => sortAscending 
        ? a.date.getTime() - b.date.getTime()  // الأقدم أولاً
        : b.date.getTime() - a.date.getTime()  // الأحدث أولاً
      );

      allItems.forEach((item) => {
        if (item.type === 'group') {
          const group = item.data as GroupedPayment;
          const contractsList = [...new Set(group.distributions.filter(d => d.contract_number).map(d => d.contract_number))];
          const adTypes = [...new Set(group.distributions.filter(d => d.ad_type).map(d => d.ad_type))];
          const custodyInfo = group.custodyInfo;
          
          index++;
          
          // ✅ صف الدفعة المجمعة الرئيسي
          let groupTypeHtml = `<span style="
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            background: #f3e8ff;
            color: #7c3aed;
          ">مجمعة (${group.distributions.length})</span>`;
          
          if (custodyInfo) {
            groupTypeHtml += `<br/><span style="
              display: inline-block;
              margin-top: 3px;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 600;
              background: #fef3c7;
              color: #92400e;
              border: 1px solid #fbbf24;
            ">🏛️ عهدة - ${custodyInfo.employee_name}</span>`;
          }
          
          rows.push({
            index,
            date: group.paidAt ? new Date(group.paidAt).toLocaleDateString('ar-LY') : '—',
            customer_name: `<strong>${group.customerName}</strong>`,
            type: groupTypeHtml,
            ad_type: adTypes.length > 0 ? adTypes.slice(0, 2).join('، ') : '—',
            amount: `<span style="font-weight: 800; color: #7c3aed; font-size: 12px;">${group.totalAmount.toLocaleString('ar-LY')} د.ل</span>`,
            contract: contractsList.length > 0 ? contractsList.slice(0, 2).map(c => `#${c}`).join('، ') : '—',
            method: group.distributions[0]?.method || '—',
            remaining: `<span style="color: ${(group.distributions[0]?.remaining_debt || 0) > 0 ? '#dc2626' : '#059669'}; font-weight: 600;">${(group.distributions[0]?.remaining_debt || 0).toLocaleString('ar-LY')} د.ل</span>`,
            notes: '—',
            _isGroupHeader: true,
          });

          // ✅ معلومات العهدة إن وجدت
          if (custodyInfo) {
            rows.push({
              index: '',
              date: '',
              customer_name: `<span style="color: #92400e; font-size: 10px; padding-right: 20px;">📋 المبلغ: ${custodyInfo.initial_amount.toLocaleString('ar-LY')} د.ل | المتبقي: <strong style="color: ${custodyInfo.current_balance > 0 ? '#dc2626' : '#059669'}">${custodyInfo.current_balance.toLocaleString('ar-LY')} د.ل</strong></span>`,
              type: '',
              ad_type: '',
              amount: '',
              contract: '',
              method: '',
              remaining: '',
              notes: '',
              _isSubRow: true,
            });
          }

          // ✅ صفوف التوزيعات
          group.distributions.forEach((dist) => {
            rows.push({
              index: '↳',
              date: `<span style="color: #6b7280; font-size: 10px;">${new Date(dist.paid_at).toLocaleDateString('ar-LY')}</span>`,
              customer_name: '',
              type: `<span style="
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 9px;
                font-weight: 600;
                background: ${isCredit(dist.entry_type) ? '#d1fae5' : '#fee2e2'};
                color: ${isCredit(dist.entry_type) ? '#065f46' : '#991b1b'};
              ">${getEntryTypeLabel(dist.entry_type)}</span>`,
              ad_type: `<span style="font-size: 9px; color: #6b7280;">${dist.ad_type || '—'}</span>`,
              amount: `<span style="font-size: 11px;">${(Number(dist.amount) || 0).toLocaleString('ar-LY')} د.ل</span>`,
              contract: dist.contract_number ? `<span style="font-size: 10px; color: #3b82f6;">#${dist.contract_number}</span>` : '—',
              method: `<span style="font-size: 10px; color: #6b7280;">${dist.method || '—'}</span>`,
              remaining: '—',
              notes: buildPaymentDetails(dist) || '—',
              _isSubRow: true,
            });
          });

        } else {
          const payment = item.data as Payment;
          index++;
          const paymentDetails = buildPaymentDetails(payment);
          rows.push({
            index,
            date: payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—',
            customer_name: payment.customer_name,
            type: `<span style="
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              background: ${isCredit(payment.entry_type) ? '#d1fae5' : '#fee2e2'};
              color: ${isCredit(payment.entry_type) ? '#065f46' : '#991b1b'};
            ">${getEntryTypeLabel(payment.entry_type)}</span>`,
            ad_type: payment.ad_type || '—',
            amount: `<span style="font-weight: 700; color: ${isCredit(payment.entry_type) ? '#059669' : '#dc2626'}">${(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل</span>`,
            contract: payment.contract_number ? `#${payment.contract_number}` : '—',
            method: payment.method || '—',
            remaining: `<span style="color: ${(payment.remaining_debt || 0) > 0 ? '#dc2626' : '#059669'}; font-weight: 600;">${(payment.remaining_debt || 0).toLocaleString('ar-LY')} د.ل</span>`,
            notes: paymentDetails || '—',
          });
        }
      });

      const statisticsCards = [
        { label: 'عدد المعاملات', value: filteredPayments.length },
        { label: 'دفعات مجمعة', value: groupedPayments.length },
        { label: 'إجمالي الواردات', value: `${totalCredits.toLocaleString('ar-LY')}`, unit: 'د.ل' },
        { label: 'إجمالي الصادرات', value: `${totalDebits.toLocaleString('ar-LY')}`, unit: 'د.ل' },
      ];

      const additionalInfo = [];
      if (startDate || endDate) {
        additionalInfo.push({ label: 'الفترة', value: formatDateRange() });
      }

      const printOptions: MeasurementsHTMLOptions = {
        config,
        documentData: {
          title: 'كشف الدفعات والإيصالات',
          documentNumber: `PAY-${Date.now().toString().slice(-8)}`,
          date: new Date().toLocaleDateString('ar-LY'),
          additionalInfo,
        },
        columns,
        rows,
        statisticsCards,
        totals: [
          { label: 'إجمالي الواردات', value: `${totalCredits.toLocaleString('ar-LY')} د.ل`, highlight: true },
          { label: 'إجمالي الصادرات', value: `${totalDebits.toLocaleString('ar-LY')} د.ل` },
          { label: 'الصافي', value: `${(totalCredits - totalDebits).toLocaleString('ar-LY')} د.ل`, highlight: true },
        ],
        totalsTitle: 'ملخص الكشف',
      };

      openMeasurementsPrintWindow(printOptions, 'كشف الدفعات والإيصالات');
      toast.success('تم فتح الكشف للطباعة بنجاح');
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('فشل في فتح الطباعة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h2 className="text-2xl font-bold text-foreground">كشف الدفعات والإيصالات</h2>
          <Button onClick={() => onOpenChange(false)} variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ✅ قسم تحديد الفترة الزمنية */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 mb-6 border">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">تحديد الفترة الزمنية</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="startDate" className="text-sm text-muted-foreground mb-1 block">من تاريخ</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-sm text-muted-foreground mb-1 block">إلى تاريخ</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              {/* زر التحكم بترتيب التاريخ */}
              <Button 
                onClick={() => setSortAscending(!sortAscending)} 
                variant="outline" 
                className="gap-2"
                title={sortAscending ? 'الترتيب الحالي: الأقدم أولاً' : 'الترتيب الحالي: الأحدث أولاً'}
              >
                {sortAscending ? (
                  <>
                    <ArrowUp className="h-4 w-4" />
                    الأقدم أولاً
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4" />
                    الأحدث أولاً
                  </>
                )}
              </Button>
              {(startDate || endDate) && (
                <Button onClick={clearDateFilter} variant="outline" className="gap-2">
                  <X className="h-4 w-4" />
                  مسح
                </Button>
              )}
              <Button onClick={handlePrint} className="gap-2 bg-primary hover:bg-primary/90 flex-1">
                <Printer className="h-4 w-4" />
                طباعة الكشف
              </Button>
            </div>
          </div>
          {(startDate || endDate) && (
            <div className="mt-3 flex items-center gap-2 text-sm text-primary">
              <Filter className="h-4 w-4" />
              <span>{formatDateRange()} - {filteredPayments.length} معاملة</span>
            </div>
          )}
        </div>

        {/* ملخص الإحصائيات */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl p-5 text-center border border-blue-200 dark:border-blue-800">
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{filteredPayments.length}</div>
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">عدد المعاملات</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl p-5 text-center border border-green-200 dark:border-green-800">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{totalCredits.toLocaleString('ar-LY')} د.ل</div>
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">إجمالي الواردات</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-xl p-5 text-center border border-red-200 dark:border-red-800">
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">{totalDebits.toLocaleString('ar-LY')} د.ل</div>
            <div className="text-sm text-red-700 dark:text-red-300 font-medium">إجمالي الصادرات</div>
          </div>
        </div>

        {/* ✅ عرض الدفعات المجمعة والمستقلة */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="bg-slate-800 text-white p-3">
            <div className="grid grid-cols-8 gap-2 text-sm font-semibold">
              <div className="text-center">#</div>
              <div className="text-center">التاريخ</div>
              <div className="text-right">العميل</div>
              <div className="text-center">النوع</div>
              <div className="text-center">نوع الإعلان</div>
              <div className="text-center">المبلغ</div>
              <div className="text-center">العقد</div>
              <div className="text-center">المتبقي</div>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
            {/* الدفعات المجمعة */}
            {groupedPayments.slice(0, 10).map((group, groupIndex) => {
              const isExpanded = expandedGroups.has(group.id);
              const contractsList = [...new Set(group.distributions.filter(d => d.contract_number).map(d => d.contract_number))];
              
              return (
                <div key={group.id}>
                  {/* رأس الدفعة المجمعة */}
                  <div 
                    className={`grid grid-cols-8 gap-2 p-3 text-sm cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30 bg-purple-50/50 dark:bg-purple-950/20`}
                    onClick={() => setExpandedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })}
                  >
                    <div className="text-center text-muted-foreground font-medium flex items-center justify-center gap-1">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupIndex + 1}
                    </div>
                    <div className="text-center font-medium">{group.paidAt ? new Date(group.paidAt).toLocaleDateString('ar-LY') : '—'}</div>
                    <div className="text-right font-bold truncate text-foreground">{group.customerName}</div>
                    <div className="text-center flex flex-col gap-1">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                        مجمعة ({group.distributions.length})
                      </Badge>
                      {group.custodyInfo && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 text-xs gap-1">
                          <Wallet className="h-3 w-3" />عهدة
                        </Badge>
                      )}
                    </div>
                    {/* نوع الإعلان */}
                    <div className="text-center">
                      {(() => {
                        const adTypes = [...new Set(group.distributions.filter(d => d.ad_type).map(d => d.ad_type))];
                        if (adTypes.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                        return <Badge variant="outline" className="text-xs">{adTypes[0]}{adTypes.length > 1 ? ` +${adTypes.length - 1}` : ''}</Badge>;
                      })()}
                    </div>
                    <div className="text-center font-bold text-purple-700 dark:text-purple-300">
                      {group.totalAmount.toLocaleString('ar-LY')} د.ل
                    </div>
                    <div className="text-center text-primary font-medium text-xs">
                      {contractsList.length > 0 ? contractsList.slice(0, 2).map(c => `#${c}`).join('، ') : '—'}
                    </div>
                    <div className="text-center text-muted-foreground">—</div>
                  </div>
                  
                  {/* تفاصيل العهدة والتوزيعات */}
                  {isExpanded && (
                    <div className="bg-muted/30 border-r-4 border-purple-400">
                      {group.custodyInfo && (
                        <div className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-amber-600" />
                            <span className="text-muted-foreground">لدى:</span>
                            <span className="font-semibold">{group.custodyInfo.employee_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">المبلغ: </span>
                            <span className="font-bold text-amber-700">{group.custodyInfo.initial_amount.toLocaleString('ar-LY')} د.ل</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">المتبقي: </span>
                            <span className={`font-bold ${group.custodyInfo.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {group.custodyInfo.current_balance.toLocaleString('ar-LY')} د.ل
                            </span>
                          </div>
                        </div>
                      )}
                      {group.distributions.slice(0, 5).map((dist, distIndex) => (
                        <div key={dist.id} className={`grid grid-cols-8 gap-2 p-2 pr-6 text-xs ${distIndex % 2 === 0 ? 'bg-muted/20' : ''}`}>
                          <div className="text-center text-purple-400">↳</div>
                          <div className="text-center">{new Date(dist.paid_at).toLocaleDateString('ar-LY')}</div>
                          <div className="text-right text-muted-foreground">—</div>
                          <div className="text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${isCredit(dist.entry_type) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {getEntryTypeLabel(dist.entry_type)}
                            </span>
                          </div>
                          <div className="text-center text-muted-foreground text-xs">{dist.ad_type || '—'}</div>
                          <div className="text-center font-semibold">{(Number(dist.amount) || 0).toLocaleString('ar-LY')} د.ل</div>
                          <div className="text-center text-primary">{dist.contract_number ? `#${dist.contract_number}` : '—'}</div>
                          <div className="text-center text-muted-foreground">—</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* الدفعات المستقلة */}
            {standalonePayments.slice(0, Math.max(0, 15 - groupedPayments.length)).map((payment, index) => (
              <div key={payment.id} className={`grid grid-cols-8 gap-2 p-3 text-sm ${index % 2 === 0 ? 'bg-muted/30' : ''}`}>
                <div className="text-center text-muted-foreground font-medium">{groupedPayments.length + index + 1}</div>
                <div className="text-center font-medium">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}</div>
                <div className="text-right font-bold truncate text-foreground">{payment.customer_name}</div>
                <div className="text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    isCredit(payment.entry_type) 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                  }`}>
                    {getEntryTypeLabel(payment.entry_type)}
                  </span>
                </div>
                {/* نوع الإعلان */}
                <div className="text-center">
                  {payment.ad_type ? (
                    <Badge variant="outline" className="text-xs">{payment.ad_type}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
                <div className={`text-center font-bold ${isCredit(payment.entry_type) ? 'text-green-600' : 'text-red-600'}`}>
                  {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                </div>
                <div className="text-center text-primary font-medium">{payment.contract_number ? `#${payment.contract_number}` : '—'}</div>
                <div className={`text-center font-semibold ${(payment.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {(payment.remaining_debt || 0).toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            ))}
          </div>
          {filteredPayments.length > 15 && (
            <div className="text-center text-sm text-muted-foreground p-3 border-t bg-muted/30">
              ... و {filteredPayments.length - 15} معاملة أخرى
            </div>
          )}
        </div>

        {/* ملخص الكشف */}
        <div className="mt-6 bg-gradient-to-l from-slate-800 to-slate-700 rounded-xl p-4 border">
          <div className="flex justify-between items-center text-white">
            <div className="text-lg font-bold">الصافي</div>
            <div className={`text-2xl font-bold ${(totalCredits - totalDebits) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(totalCredits - totalDebits).toLocaleString('ar-LY')} د.ل
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
