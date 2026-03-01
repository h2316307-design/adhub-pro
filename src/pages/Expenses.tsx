// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, DollarSign, Plus, Calculator, TrendingUp, TrendingDown, Lock, Calendar, Hash, Printer, Edit, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';
import { OperatingDuesPrintDialog } from '@/components/billing/OperatingDuesPrintDialog';

interface Contract {
  id: string;
  contract_number: string;
  customer_name: string;
  ad_type: string;
  feePercent: number;
  feePercentInstallation: number;
  feePercentPrint: number;
  feeAmount: number;
  fullFeeAmount: number;
  collectedFeeAmount: number;
  rent_cost: number;
  installation_cost: number;
  print_cost: number;
  include_operating_in_installation: boolean;
  include_operating_in_print: boolean;
  total_amount: number;
  total_paid: number;
  collectionPercentage: number;
  start_date: string;
  status: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
  receiver_name?: string;
  sender_name?: string;
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

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeContract = (record: any): Contract => {
  const contractNumberRaw = record?.Contract_Number ?? record?.contract_number ?? record?.id ?? record?.ID ?? '';
  const contractNumber = contractNumberRaw ? String(contractNumberRaw) : '';
  
  const rentCost = toNumber(record?.['Total Rent'] ?? record?.rent_cost ?? 0);
  const installationCost = toNumber(record?.installation_cost ?? 0);
  const printCost = toNumber(record?.print_cost ?? 0);
  
  const includeOperatingInInstallation = record?.include_operating_in_installation === true;
  const includeOperatingInPrint = record?.include_operating_in_print === true;
  
  const totalAmount = rentCost + installationCost + printCost;
  
  const totalPaid = toNumber(record?.['Total Paid'] ?? 0);
  const collectionPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  
  // ✅ نسبة الإيجار
  const feePercent = toNumber(record?.operating_fee_rate);
  const normalizedFeePercent = Math.round(feePercent * 100) / 100;
  
  // ✅ نسب مستقلة للتركيب والطباعة
  const feePercentInstallation = toNumber(record?.operating_fee_rate_installation || feePercent);
  const feePercentPrint = toNumber(record?.operating_fee_rate_print || feePercent);
  
  // ✅ حساب القيمة الكاملة للنسبة بنسب مستقلة
  let fullFeeAmount = Math.round(rentCost * (normalizedFeePercent / 100));
  if (includeOperatingInInstallation) fullFeeAmount += Math.round(installationCost * (feePercentInstallation / 100));
  if (includeOperatingInPrint) fullFeeAmount += Math.round(printCost * (feePercentPrint / 100));
  
  // ✅ حساب النسبة المتحصلة فعلياً (مع تحديد أقصى 100%)
  const paymentRatio = totalAmount > 0 ? Math.min(1, totalPaid / totalAmount) : 0;
  let collectedFeeAmount = Math.round(rentCost * paymentRatio * (normalizedFeePercent / 100));
  if (includeOperatingInInstallation) collectedFeeAmount += Math.round(installationCost * paymentRatio * (feePercentInstallation / 100));
  if (includeOperatingInPrint) collectedFeeAmount += Math.round(printCost * paymentRatio * (feePercentPrint / 100));
  
  const feeAmount = collectedFeeAmount;

  const fallbackIdSource = record?.Contract_Number ?? record?.contract_number ?? record?.id ?? record?.ID;
  const id = fallbackIdSource ? String(fallbackIdSource) : `contract-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    contract_number: contractNumber,
    customer_name: record?.['Customer Name'] ?? record?.customer_name ?? '',
    ad_type: record?.['Ad Type'] ?? record?.ad_type ?? '',
    feePercent: normalizedFeePercent,
    feePercentInstallation,
    feePercentPrint,
    feeAmount,
    fullFeeAmount,
    collectedFeeAmount,
    rent_cost: rentCost,
    installation_cost: installationCost,
    print_cost: printCost,
    include_operating_in_installation: includeOperatingInInstallation,
    include_operating_in_print: includeOperatingInPrint,
    total_amount: totalAmount,
    total_paid: totalPaid,
    collectionPercentage: Math.round(collectionPercentage * 100) / 100,
    start_date: record?.['Contract Date'] ?? record?.start_date ?? record?.['Start Date'] ?? '',
    status: record?.status ?? 'active',
  };
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toLocaleString('ar-LY', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
};

interface RecentPayment {
  id: string;
  contract_number: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  fee_rate: number;
  fee_amount: number;
}

export default function OperatingExpenses() {
  const navigate = useNavigate();
  const { confirm: systemConfirm } = useSystemDialog();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  
  // Dialog states
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [showWithdrawalReceiptDialog, setShowWithdrawalReceiptDialog] = useState(false);
  const [selectedWithdrawalForReceipt, setSelectedWithdrawalForReceipt] = useState<Withdrawal | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  
  // Form states
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [withdrawalDate, setWithdrawalDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>('');
  const [withdrawalNotes, setWithdrawalNotes] = useState<string>('');
  const [withdrawalReceiverName, setWithdrawalReceiverName] = useState<string>('');
  const [withdrawalSenderName, setWithdrawalSenderName] = useState<string>('');
  
  // Period closure form
  const [closureDate, setClosureDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [closureType, setClosureType] = useState<'period' | 'contract_range'>('period');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [contractStart, setContractStart] = useState<string>('');
  const [contractEnd, setContractEnd] = useState<string>('');
  const [closureNotes, setClosureNotes] = useState<string>('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contracts - ترتيب تنازلي حسب رقم العقد
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });

      if (contractsError) {
        console.error('خطأ في تحميل العقود:', contractsError);
        toast.error('فشل في تحميل العقود');
      } else {
        // ✅ فقط العقود من 1086 وما بعدها (النسبة مفعّلة من هذا العقد)
        let mappedContracts = (contractsData || [])
          .map(normalizeContract)
          .filter(c => {
            const num = parseInt(c.contract_number, 10);
            return !isNaN(num) && num >= 1086;
          });

        // ✅ احتساب المدفوع فعلياً لكل عقد من جدول customer_payments (إيصالات + دفعات حساب + دفعات عامة)
        try {
          const { data: paymentsData } = await (supabase as any)
            .from('customer_payments')
            .select('id, contract_number, amount, entry_type, paid_at, customer_name')
            .order('paid_at', { ascending: false });

          const paidByContract: Record<string, number> = {};
          const validPayments: any[] = [];
          
          (paymentsData || []).forEach((p: any) => {
            const type = String(p.entry_type || '');
            // ✅ احتساب جميع أنواع الدفعات: receipt, account_payment, payment
            if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
              const key = String(p.contract_number || '');
              if (!key) return; // تجاهل الدفعات العامة بدون رقم عقد
              paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
              validPayments.push(p);
            }
          });

          // جلب آخر 10 دفعات مع حساب النسبة لكل منها
          const contractFeeRates: Record<string, number> = {};
          mappedContracts.forEach(c => {
            contractFeeRates[c.contract_number] = c.feePercent;
          });

          const recentPaymentsList = validPayments.slice(0, 10).map(p => {
            const feeRate = contractFeeRates[String(p.contract_number)] || 0;
            const amount = Number(p.amount) || 0;
            const feeAmount = Math.round(amount * (feeRate / 100));
            return {
              id: p.id,
              contract_number: String(p.contract_number),
              customer_name: p.customer_name || '',
              amount,
              paid_at: p.paid_at,
              fee_rate: feeRate,
              fee_amount: feeAmount
            };
          });
          setRecentPayments(recentPaymentsList);

          // تحديث العقود بقيم المدفوع المحسوبة وإعادة حساب النسبة والمتجمع للنسبة
          mappedContracts = mappedContracts.map((c) => {
            const paid = paidByContract[String(c.contract_number)] || 0;
            const collectionPct = c.total_amount > 0 ? (paid / c.total_amount) * 100 : 0;
            // ✅ حساب النسبة مع نسب مستقلة للتركيب والطباعة
            const paymentRatio = c.total_amount > 0 ? Math.min(1, paid / c.total_amount) : 0;
            let collectedFee = Math.round(c.rent_cost * paymentRatio * (c.feePercent / 100));
            if (c.include_operating_in_installation) collectedFee += Math.round(c.installation_cost * paymentRatio * (c.feePercentInstallation / 100));
            if (c.include_operating_in_print) collectedFee += Math.round(c.print_cost * paymentRatio * (c.feePercentPrint / 100));
            return {
              ...c,
              total_paid: paid,
              collectionPercentage: Math.round(collectionPct * 100) / 100,
              collectedFeeAmount: collectedFee,
            };
          });
        } catch (e) {
          console.warn('تعذر تحميل الدفعات، سيتم الاعتماد على Total Paid من جدول العقود فقط', e);
        }

        mappedContracts.sort((a, b) => {
          const numA = parseInt(a.contract_number, 10);
          const numB = parseInt(b.contract_number, 10);
          const safeA = Number.isFinite(numA) ? numA : 0;
          const safeB = Number.isFinite(numB) ? numB : 0;
          return safeB - safeA;
        });

        setContracts(mappedContracts);
      }

      // Load withdrawals
      try {
        const { data: withdrawalsData } = await supabase
          .from('expenses_withdrawals')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (Array.isArray(withdrawalsData)) {
          const mappedWithdrawals = withdrawalsData.map((w: any) => ({
            id: w.id?.toString() || `w-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            amount: Number(w.amount) || 0,
            date: (w.date || w.created_at || new Date().toISOString()).slice(0, 10),
            method: w.method || undefined,
            note: w.note || undefined
          }));
          setWithdrawals(mappedWithdrawals);
        }
      } catch (error) {
        console.error('خطأ في تحميل السحوبات:', error);
      }

      // Load period closures
      try {
        const { data: closuresData } = await supabase
          .from('period_closures')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (Array.isArray(closuresData)) {
          setClosures(closuresData);
        }
      } catch (error) {
        console.error('خطأ في تحميل إغلاقات الفترات:', error);
      }

      // Load exclusions
      try {
        const { data: flagsData } = await supabase
          .from('expenses_flags')
          .select('contract_id, excluded');
        
        if (Array.isArray(flagsData)) {
          const excludedSet = new Set<string>();
          flagsData.forEach((flag: any) => {
            if (flag.excluded && flag.contract_id != null) {
              excludedSet.add(String(flag.contract_id));
            }
          });
          setExcludedIds(excludedSet);
        }
      } catch (error) {
        console.error('خطأ في تحميل حالات الاستبعاد:', error);
      }

    } catch (error) {
      console.error('خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // Check if contract is in any closed period
  const isContractClosed = (contract: Contract) => {
    return closures.some(closure => {
      if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
        const contractDate = new Date(contract.start_date);
        const closureStart = new Date(closure.period_start);
        const closureEnd = new Date(closure.period_end);
        return contractDate >= closureStart && contractDate <= closureEnd;
      } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
        const contractNum = parseInt(contract.contract_number, 10) || 0;
        const rangeStart = parseInt(closure.contract_start, 10) || 0;
        const rangeEnd = parseInt(closure.contract_end, 10) || 0;
        return contractNum >= rangeStart && contractNum <= rangeEnd;
      }
      return false;
    });
  };

  // Get contracts in range that are not closed
  const getContractsInRange = () => {
    return contracts.filter(contract => {
      if (isContractClosed(contract) || excludedIds.has(contract.id.toString())) {
        return false;
      }

      // Apply current filter
      if (closureType === 'period' && periodStart && periodEnd) {
        const contractDate = new Date(contract.start_date);
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        return contractDate >= start && contractDate <= end;
      } else if (closureType === 'contract_range' && contractStart && contractEnd) {
        const contractNum = contract.contract_number;
        return contractNum >= contractStart && contractNum <= contractEnd;
      }
      
      return false;
    });
  };

  // ✅ إعادة حساب قيم التسكيرات ديناميكياً بنظام FIFO
  const computedClosures = useMemo(() => {
    if (closures.length === 0 || contracts.length === 0) return closures;

    // ترتيب جميع العقود من الأقدم للأحدث
    const allContractsSorted = [...contracts]
      .filter(c => !excludedIds.has(c.id.toString()))
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const totalWithdrawalsAll = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // تحديد أي عقد ينتمي لأي تسكيرة
    const closureForContract = (contract: Contract): PeriodClosure | null => {
      return closures.find(closure => {
        if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
          const contractDate = new Date(contract.start_date);
          return contractDate >= new Date(closure.period_start!) && contractDate <= new Date(closure.period_end!);
        } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
          const cNum = parseInt(contract.contract_number, 10) || 0;
          const rStart = parseInt(closure.contract_start!, 10) || 0;
          const rEnd = parseInt(closure.contract_end!, 10) || 0;
          return cNum >= rStart && cNum <= rEnd;
        }
        return false;
      }) || null;
    };

    // توزيع المسحوبات بنظام FIFO على جميع العقود (مغلقة ومفتوحة)
    const withdrawnPerClosure: Record<number, number> = {};
    const totalAmountPerClosure: Record<number, number> = {};
    closures.forEach(cl => {
      withdrawnPerClosure[cl.id] = 0;
      totalAmountPerClosure[cl.id] = 0;
    });

    // حساب إجمالي النسبة المتحصلة لكل تسكيرة
    allContractsSorted.forEach(contract => {
      const cl = closureForContract(contract);
      if (cl) {
        totalAmountPerClosure[cl.id] += contract.collectedFeeAmount;
      }
    });

    // توزيع FIFO: الأقدم أولاً
    let remainingWithdrawals = totalWithdrawalsAll;
    for (const contract of allContractsSorted) {
      if (contract.collectedFeeAmount <= 0 || remainingWithdrawals <= 0) continue;
      const allocatable = Math.min(remainingWithdrawals, contract.collectedFeeAmount);
      const cl = closureForContract(contract);
      if (cl) {
        withdrawnPerClosure[cl.id] += allocatable;
      }
      remainingWithdrawals -= allocatable;
    }

    return closures.map(cl => ({
      ...cl,
      total_amount: totalAmountPerClosure[cl.id] ?? cl.total_amount,
      total_withdrawn: withdrawnPerClosure[cl.id] ?? 0,
      remaining_balance: (totalAmountPerClosure[cl.id] ?? cl.total_amount) - (withdrawnPerClosure[cl.id] ?? 0),
    }));
  }, [contracts, withdrawals, closures, excludedIds]);

  // ✅ حساب توزيع المسحوبات على كل عقد بنظام FIFO
  const fifoAllocationPerContract = useMemo(() => {
    const allocation = new Map<string, number>();
    const unclosed = contracts
      .filter(c => {
        if (excludedIds.has(c.id.toString())) return false;
        return !closures.some(closure => {
          if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
            const d = new Date(c.start_date);
            return d >= new Date(closure.period_start) && d <= new Date(closure.period_end);
          } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
            const n = parseInt(c.contract_number, 10) || 0;
            return n >= (parseInt(closure.contract_start, 10) || 0) && n <= (parseInt(closure.contract_end, 10) || 0);
          }
          return false;
        });
      })
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const totalW = withdrawals.reduce((s, w) => s + w.amount, 0);
    const consumed = computedClosures.reduce((s, cl) => s + (cl.total_withdrawn || 0), 0);
    let remaining = Math.max(0, totalW - consumed);

    for (const c of unclosed) {
      if (remaining <= 0 || c.collectedFeeAmount <= 0) {
        allocation.set(c.contract_number, 0);
        continue;
      }
      const alloc = Math.min(remaining, c.collectedFeeAmount);
      allocation.set(c.contract_number, alloc);
      remaining -= alloc;
    }
    return allocation;
  }, [contracts, withdrawals, closures, excludedIds, computedClosures]);

  // ✅ اشتقاق العقود المسددة من التوزيع الفعلي - لا تكرار للمنطق
  const settledContractIds = useMemo(() => {
    const settled = new Set<string>();
    for (const contract of contracts) {
      const allocated = fifoAllocationPerContract.get(contract.contract_number) || 0;
      // العقد مسدد فقط إذا: 1) مدفوع بالكامل من الزبون 2) مغطى بالكامل من المسحوبات
      if (contract.collectionPercentage >= 100 && allocated >= contract.collectedFeeAmount && contract.collectedFeeAmount > 0) {
        settled.add(contract.contract_number);
      }
    }
    return settled;
  }, [contracts, fifoAllocationPerContract]);


  // Calculate totals with dependency on closures
  const totals = useMemo(() => {
    // Filter uncovered contracts (not closed and not excluded)
    const uncoveredContracts = contracts.filter(contract => {
      const id = contract.id.toString();
      
      // Skip excluded contracts
      if (excludedIds.has(id)) {
        return false;
      }
      
      // Skip closed contracts
      const isClosed = closures.some(closure => {
        if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
          const contractDate = new Date(contract.start_date);
          const closureStart = new Date(closure.period_start);
          const closureEnd = new Date(closure.period_end);
          return contractDate >= closureStart && contractDate <= closureEnd;
        } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
          const contractNum = parseInt(contract.contract_number, 10);
          const closureStart = parseInt(closure.contract_start, 10);
          const closureEnd = parseInt(closure.contract_end, 10);
          return contractNum >= closureStart && contractNum <= closureEnd;
        }
        return false;
      });
      
      return !isClosed;
    });
    
    const totalContracts = uncoveredContracts.length;
    
    // Calculate pool total from uncovered contracts
    const poolTotal = uncoveredContracts.reduce((sum, contract) => {
      return sum + contract.collectedFeeAmount;
    }, 0);

    const totalWithdrawnAll = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    // ✅ جميع المسحوبات تبدأ من عقد 1086 - لا يوجد مسحوبات قبلها
    const effectiveWithdrawals = totalWithdrawnAll;
    // ✅ الرصيد المتبقي = مجموع النسب المفتوحة - المسحوبات
    const remainingPool = Math.max(0, poolTotal - effectiveWithdrawals);

    return {
      totalContracts,
      poolTotal,
      totalWithdrawn: totalWithdrawnAll,
      effectiveWithdrawals,
      remainingPool
    };
  }, [contracts, withdrawals, closures, excludedIds, computedClosures]);

  // Add withdrawal
  const addWithdrawal = async () => {
    if (!withdrawalAmount) {
      toast.error('يرجى إدخال مبلغ السحب');
      return;
    }

    if (!withdrawalDate) {
      toast.error('يرجى تحديد تاريخ السحب');
      return;
    }

    try {
      const amount = parseFloat(withdrawalAmount);
      
      // استخدام user_id من الجلسة الحالية
      const { data: { user } } = await supabase.auth.getUser();
      
      const withdrawalData = {
        amount,
        date: withdrawalDate,
        method: withdrawalMethod || null,
        note: withdrawalNotes || null,
        receiver_name: withdrawalReceiverName || null,
        sender_name: withdrawalSenderName || null,
        user_id: user?.id || null
      };

      if (editingWithdrawal) {
        // تحديث السحب الحالي
        const { data, error } = await supabase
          .from('expenses_withdrawals')
          .update(withdrawalData)
          .eq('id', editingWithdrawal.id)
          .select()
          .single();

        if (error) {
          toast.error(`فشل في تحديث السحب: ${error.message}`);
          return;
        }

        const updatedWithdrawal: Withdrawal = {
          id: data.id.toString(),
          amount: data.amount,
          date: data.date,
          method: data.method,
          note: data.note,
          receiver_name: data.receiver_name,
          sender_name: data.sender_name
        };

        setWithdrawals(prev => prev.map(w => w.id === updatedWithdrawal.id ? updatedWithdrawal : w));
        toast.success('تم تحديث السحب بنجاح');
      } else {
        // إضافة سحب جديد
        let data;
        const { data: insertData, error } = await supabase
          .from('expenses_withdrawals')
          .insert([withdrawalData])
          .select()
          .single();

        if (error) {
          console.error('خطأ في إضافة السحب:', error);
          
          // إذا كانت المشكلة في RLS، نحاول بدون user_id
          if (error.message?.includes('row-level security')) {
            const simpleData = {
              amount,
              date: withdrawalDate,
              method: withdrawalMethod || null,
              note: withdrawalNotes || null,
              receiver_name: withdrawalReceiverName || null,
              sender_name: withdrawalSenderName || null
            };
            
            const { data: retryData, error: retryError } = await supabase
              .from('expenses_withdrawals')
              .insert([simpleData])
              .select()
              .single();
              
            if (retryError) {
              toast.error(`فشل في إضافة السحب: ${retryError.message}`);
              return;
            }
            
            data = retryData;
          } else {
            toast.error(`حدث خطأ في إضافة السحب: ${error.message}`);
            return;
          }
        } else {
          data = insertData;
        }

        const newWithdrawal: Withdrawal = {
          id: data.id.toString(),
          amount: data.amount,
          date: data.date,
          method: data.method,
          note: data.note,
          receiver_name: data.receiver_name,
          sender_name: data.sender_name
        };

        setWithdrawals(prev => [newWithdrawal, ...prev]);
        toast.success('تم إضافة السحب بنجاح');
      }
      
      // Reset form
      setWithdrawalOpen(false);
      setEditingWithdrawal(null);
      setWithdrawalAmount('');
      setWithdrawalDate(new Date().toISOString().slice(0,10));
      setWithdrawalMethod('');
      setWithdrawalNotes('');
      setWithdrawalReceiverName('');
      setWithdrawalSenderName('');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Delete withdrawal
  const deleteWithdrawal = async (id: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا السحب؟', variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error(`فشل في حذف السحب: ${error.message}`);
        return;
      }

      setWithdrawals(prev => prev.filter(w => w.id !== id));
      toast.success('تم حذف السحب بنجاح');
    } catch (error) {
      console.error('خطأ في حذف السحب:', error);
      toast.error('حدث خطأ في حذف السحب');
    }
  };

  // Close period or contract range
  const closePeriodOrRange = async () => {
    if (!closureDate) {
      toast.error('يرجى تحديد تاريخ التسكير');
      return;
    }

    if (closureType === 'period') {
      if (!periodStart || !periodEnd) {
        toast.error('يرجى تحديد بداية ونهاية الفترة');
        return;
      }
      if (new Date(periodStart) >= new Date(periodEnd)) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
      }
    } else {
      if (!contractStart || !contractEnd) {
        toast.error('يرجى تحديد رقم العقد الأول والأخير');
        return;
      }
      if (contractStart >= contractEnd) {
        toast.error('رقم العقد الأول يجب أن يكون أصغر من رقم العقد الأخير');
        return;
      }
    }

    // Get contracts in this range
    const contractsInRange = getContractsInRange();
    
    if (contractsInRange.length === 0) {
      toast.error('لا توجد عقود في النطاق المحدد أو جميع العقود مسكرة مسبقاً');
      return;
    }

    // Calculate totals for this range
    const totalAmount = contractsInRange.reduce((sum, contract) => {
      // ✅ استخدام النسبة المتحصلة فعلياً
      return sum + contract.collectedFeeAmount;
    }, 0);

    // ✅ حساب المسحوبات المخصصة لهذه الفترة بنظام FIFO
    // جلب جميع العقود غير المسكّرة مرتبة من الأقدم للأحدث
    const allUnclosedSorted = contracts
      .filter(c => !isContractClosed(c) && !excludedIds.has(c.id.toString()))
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const closingContractNumbers = new Set(contractsInRange.map(c => c.contract_number));
    const totalAllWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    // طرح المسحوبات المستهلكة من الإغلاقات السابقة
    const previouslyConsumed = computedClosures.reduce((sum, cl) => sum + (cl.total_withdrawn || 0), 0);
    let availableForFifo = Math.max(0, totalAllWithdrawals - previouslyConsumed);

    let withdrawnForClosing = 0;
    for (const contract of allUnclosedSorted) {
      if (contract.collectedFeeAmount <= 0 || availableForFifo <= 0) continue;
      const allocatable = Math.min(availableForFifo, contract.collectedFeeAmount);
      if (closingContractNumbers.has(contract.contract_number)) {
        withdrawnForClosing += allocatable;
      }
      availableForFifo -= allocatable;
    }

    const totalWithdrawn = withdrawnForClosing;
    const remainingBalance = totalAmount - totalWithdrawn;

    try {
      const closureData = {
        closure_type: closureType,
        period_start: closureType === 'period' ? periodStart : null,
        period_end: closureType === 'period' ? periodEnd : null,
        contract_start: closureType === 'contract_range' ? contractStart : null,
        contract_end: closureType === 'contract_range' ? contractEnd : null,
        closure_date: closureDate,
        total_contracts: contractsInRange.length,
        total_amount: totalAmount,
        total_withdrawn: totalWithdrawn,
        remaining_balance: remainingBalance,
        notes: closureNotes || null
      };

      const { data, error } = await supabase
        .from('period_closures')
        .insert([closureData])
        .select()
        .single();

      if (error) {
        console.error('خطأ في الإغلاق:', error);
        toast.error(`حدث خطأ في الإغلاق: ${error.message}`);
        return;
      }

      // Update closures state immediately to trigger recalculation
      setClosures(prev => [data, ...prev]);
      
      // Reset form
      setClosureOpen(false);
      setClosureDate(new Date().toISOString().slice(0,10));
      setPeriodStart('');
      setPeriodEnd('');
      setContractStart('');
      setContractEnd('');
      setClosureNotes('');
      
      const typeText = closureType === 'period' ? 'الفترة' : 'نطاق العقود';
      toast.success(`تم إغلاق ${typeText} بنجاح (${contractsInRange.length} عقد)`);
      
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Toggle exclusion
  const toggleExclusion = async (contractId: string, exclude: boolean) => {
    try {
      const { error } = await supabase
        .from('expenses_flags')
        .upsert({ contract_id: contractId, excluded: exclude });

      if (error) {
        console.error('خطأ في تحديث حالة الاستبعاد:', error);
        toast.error('تعذر تحديث حالة العقد');
        return;
      }

      const newExcludedIds = new Set(excludedIds);
      if (exclude) {
        newExcludedIds.add(contractId);
      } else {
        newExcludedIds.delete(contractId);
      }
      setExcludedIds(newExcludedIds);
      
      toast.success(exclude ? 'تم استبعاد العقد من الحسبة' : 'تم إرجاع العقد إلى الحسبة');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Get unique contract numbers for dropdown
  const contractNumbers = useMemo(() => {
    return contracts
      .map(c => c.contract_number)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na; // ترتيب تنازلي
        return b.localeCompare(a);
      });
  }, [contracts]);

  if (loading) {
    return (
      <div className="expenses-loading">
        <Loader2 className="expenses-loading-spinner" />
        <span>جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      {/* Back Button */}
      <div className="mb-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/expense-management')}
          className="flex items-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          الرجوع لصفحة الموظف
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="expenses-stats-grid">
        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">إجمالي العقود</p>
                <p className="expenses-stat-value font-manrope font-semibold">{totals.totalContracts}</p>
              </div>
              <Calculator className="expenses-stat-icon stat-blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">المجموع العام</p>
                <p className="expenses-stat-value font-manrope font-semibold">{totals.poolTotal.toLocaleString()} د.ل</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                  مجموع نسب التشغيل المحصّلة للعقود النشطة (من 1086)
                </p>
              </div>
              <TrendingUp className="expenses-stat-icon stat-green" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">المسحوب</p>
                <p className="expenses-stat-value font-manrope font-semibold">{totals.totalWithdrawn.toLocaleString()} د.ل</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                  إجمالي المسحوبات من مستحقات التشغيل (من عقد 1086)
                </p>
              </div>
              <TrendingDown className="expenses-stat-icon stat-red" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">الرصيد المتبقي</p>
                <p className="expenses-stat-value font-manrope font-semibold">{totals.remainingPool.toLocaleString()} د.ل</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                  المجموع العام − المسحوب الفعّال = المتبقي للسحب
                </p>
              </div>
              <DollarSign className="expenses-stat-icon stat-purple" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments - آخر 10 دفعات زادت الرصيد */}
      {recentPayments.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              آخر 10 مدفوعات زادت رصيد مستحقات التشغيل
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم العقد</TableHead>
                    <TableHead className="text-right">اسم العميل</TableHead>
                    <TableHead className="text-right">تاريخ الدفع</TableHead>
                    <TableHead className="text-right">مبلغ الدفعة</TableHead>
                    <TableHead className="text-right">النسبة %</TableHead>
                    <TableHead className="text-right">الزيادة في المستحقات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-right font-manrope font-semibold">{payment.contract_number}</TableCell>
                      <TableCell className="text-right">{payment.customer_name || '—'}</TableCell>
                      <TableCell className="text-right font-manrope">
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-manrope font-semibold text-green-600">
                        {payment.amount.toLocaleString()} د.ل
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-manrope">{payment.fee_rate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-manrope font-bold text-primary">
                        +{payment.fee_amount.toLocaleString()} د.ل
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="expenses-actions">
        <Button onClick={() => {
          setEditingWithdrawal(null);
          setWithdrawalOpen(true);
        }} className="expenses-action-btn">
          <Plus className="h-4 w-4" />
          تسجيل سحب جديد
        </Button>
        <Button onClick={() => setClosureOpen(true)} variant="outline" className="expenses-action-btn">
          <Lock className="h-4 w-4" />
          تسكير حساب
        </Button>
        <Button onClick={() => setShowPrintDialog(true)} variant="outline" className="expenses-action-btn">
          <Printer className="h-4 w-4" />
          طباعة كشف
        </Button>
      </div>

      {/* Preview */}
      {((closureType === 'period' && periodStart && periodEnd) || 
        (closureType === 'contract_range' && contractStart && contractEnd)) && (
        <Card className="expenses-preview-card">
          <CardHeader>
            <CardTitle className="expenses-preview-title">
              معاينة {closureType === 'period' ? 'الفترة' : 'نطاق العقود'} المحدد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="expenses-preview-grid">
              {(() => {
                const contractsInRange = getContractsInRange();
                const totalAmount = contractsInRange.reduce((sum, contract) => {
                  // ✅ استخدام النسبة المتحصلة فعلياً
                  return sum + contract.collectedFeeAmount;
                }, 0);
                
                return (
                  <>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">عدد العقود</p>
                      <p className="expenses-preview-value">{contractsInRange.length}</p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">إجمالي المبلغ</p>
                      <p className="expenses-preview-value">{totalAmount.toLocaleString()} د.ل</p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">
                        {closureType === 'period' ? 'من تاريخ' : 'من عقد'}
                      </p>
                      <p className="expenses-preview-text">
                        {closureType === 'period' 
                          ? new Date(periodStart).toLocaleDateString('ar-LY')
                          : contractStart
                        }
                      </p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">
                        {closureType === 'period' ? 'إلى تاريخ' : 'إلى عقد'}
                      </p>
                      <p className="expenses-preview-text">
                        {closureType === 'period' 
                          ? new Date(periodEnd).toLocaleDateString('ar-LY')
                          : contractEnd
                        }
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>مستحقات التشغيل - العقود وحالة الحسبة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">اسم العميل</TableHead>
                  <TableHead className="text-right">نوع الإعلان</TableHead>
                  <TableHead className="text-right">تاريخ العقد</TableHead>
                  <TableHead className="text-right">النسبة %</TableHead>
                  <TableHead className="text-right">سعر الإيجار</TableHead>
                  <TableHead className="text-right">التركيب</TableHead>
                  <TableHead className="text-right">الطباعة</TableHead>
                  <TableHead className="text-right">الإجمالي الكلي</TableHead>
                  <TableHead className="text-right">المدفوع</TableHead>
                  <TableHead className="text-right">نسبة التحصيل</TableHead>
                  <TableHead className="text-right">قيمة النسبة الكاملة</TableHead>
                  <TableHead className="text-right">النسبة المتحصلة</TableHead>
                  <TableHead className="text-right">المسحوب</TableHead>
                  <TableHead className="text-right">نسبة السحب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => {
                  const id = contract.id.toString();
                  const excluded = excludedIds.has(id);
                  const closed = isContractClosed(contract);
                  
                  const formattedPercent = formatPercent(contract.feePercent);
                  const formattedRentCost = contract.rent_cost.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedInstallCost = contract.installation_cost.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedPrintCost = contract.print_cost.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedTotal = contract.total_amount.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedPaid = contract.total_paid.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedCollectionPct = formatPercent(contract.collectionPercentage);
                  const formattedFullFee = contract.fullFeeAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
                  const formattedCollectedFee = contract.collectedFeeAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 });

                  const isFullyPaid = contract.collectionPercentage >= 100;
                  const isPartialPaid = contract.collectionPercentage > 0 && contract.collectionPercentage < 100;
                  const contractWithdrawn = fifoAllocationPerContract.get(contract.contract_number) || 0;
                  // ✅ نسبة السحب من القيمة المتحصلة فعلياً (حسب نسبة السداد)
                  const contractWithdrawnPct = contract.collectedFeeAmount > 0 ? Math.min(100, (contractWithdrawn / contract.collectedFeeAmount) * 100) : 0;
                  // ✅ العقد يعتبر مسدد فقط إذا كان مدفوع بالكامل فعلياً + تمت تغطيته بالمسحوبات
                  const isSettledByWithdrawals = isFullyPaid && settledContractIds.has(contract.contract_number);

                  // تحديد لون الصف بناءً على الحالة
                  const hasNoPaid = contract.total_paid === 0;
                  const hasZeroRent = contract.rent_cost === 0;

                  let rowClassName = '';
                  if (isSettledByWithdrawals) {
                    rowClassName = 'bg-blue-50 dark:bg-blue-950/30';
                  } else if (hasZeroRent) {
                    rowClassName = 'bg-white dark:bg-white/10';
                  } else if (hasNoPaid) {
                    rowClassName = 'bg-red-100 dark:bg-red-900/40';
                  } else if (isFullyPaid) {
                    rowClassName = 'bg-green-50 dark:bg-green-950/30';
                  } else if (isPartialPaid) {
                    rowClassName = 'bg-orange-50 dark:bg-orange-950/30';
                  }

                  return (
                    <TableRow 
                      key={id} 
                      className={rowClassName}
                    >
                      <TableCell className="expenses-contract-number text-right font-manrope font-semibold">{contract.contract_number}</TableCell>
                      <TableCell className="text-right">{contract.customer_name}</TableCell>
                      <TableCell className="text-right">{contract.ad_type || '—'}</TableCell>
                      <TableCell className="text-right font-manrope">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar-LY') : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-manrope">{formattedPercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-manrope font-semibold">{formattedRentCost} د.ل</TableCell>
                      <TableCell className="text-right text-muted-foreground font-manrope">
                        {formattedInstallCost} د.ل
                        {contract.include_operating_in_installation && (
                          <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0">{contract.feePercentInstallation}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-manrope">
                        {formattedPrintCost} د.ل
                        {contract.include_operating_in_print && (
                          <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0">{contract.feePercentPrint}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold font-manrope">{formattedTotal} د.ل</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 font-manrope">{formattedPaid} د.ل</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={isFullyPaid ? "default" : isPartialPaid ? "secondary" : "outline"}
                          className={`font-manrope ${
                            isFullyPaid ? 'bg-green-600 hover:bg-green-700' : 
                            isPartialPaid ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
                          }`}
                        >
                          {formattedCollectionPct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-manrope">{formattedFullFee} د.ل</TableCell>
                      <TableCell className={`text-right font-semibold font-manrope ${
                        excluded || closed ? 'expenses-amount-excluded' : 
                        (contract.collectedFeeAmount > 0 && contract.total_amount > 100) ? 'text-red-600 dark:text-red-500' : 
                        'expenses-amount-calculated'
                      }`}>
                        {formattedCollectedFee} د.ل
                      </TableCell>
                      <TableCell className="text-right font-manrope font-semibold">
                        {(!closed && !excluded && contractWithdrawn > 0) 
                          ? `${contractWithdrawn.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل` 
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(!closed && !excluded && contract.collectedFeeAmount > 0) ? (
                          <Badge 
                            variant={contractWithdrawnPct >= 99.9 ? "default" : contractWithdrawnPct > 0 ? "secondary" : "outline"}
                            className={`font-manrope gap-1 ${
                              contractWithdrawnPct >= 99.9 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 
                              contractWithdrawnPct > 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
                            }`}
                          >
                            {contractWithdrawnPct >= 99.9 && <CheckCircle2 className="h-3 w-3" />}
                            {contractWithdrawnPct >= 99.9 ? '100%' : `${contractWithdrawnPct.toFixed(0)}%`}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {closed ? (
                            <Badge variant="destructive">مسكر</Badge>
                          ) : excluded ? (
                            <Badge variant="secondary">مستبعد</Badge>
                          ) : (
                            <Badge variant="default">ضمن الحسبة</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="expenses-actions-cell justify-end">
                          {!closed && (
                            excluded ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleExclusion(id, false)}
                              >
                                إرجاع
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => toggleExclusion(id, true)}
                              >
                                استبعاد
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals History */}
      <Card>
        <CardHeader>
          <CardTitle>سجل السحوبات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الطريقة</TableHead>
                  <TableHead className="text-right">البيان</TableHead>
                  <TableHead className="text-right">المستلم/المسلم</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map(withdrawal => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="text-right">{new Date(withdrawal.date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="expenses-amount-calculated text-right">
                      {withdrawal.amount.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-right">{withdrawal.method || '—'}</TableCell>
                    <TableCell className="text-right">{withdrawal.note || '—'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {withdrawal.receiver_name && (
                        <div><span className="font-semibold">المستلم:</span> {withdrawal.receiver_name}</div>
                      )}
                      {withdrawal.sender_name && (
                        <div><span className="font-semibold">المسلم:</span> {withdrawal.sender_name}</div>
                      )}
                      {!withdrawal.receiver_name && !withdrawal.sender_name && '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedWithdrawalForReceipt(withdrawal);
                            setShowWithdrawalReceiptDialog(true);
                          }}
                          title="طباعة إيصال"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingWithdrawal(withdrawal);
                            setWithdrawalOpen(true);
                          }}
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteWithdrawal(withdrawal.id)}
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {withdrawals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="expenses-empty-state">
                      لا توجد سحوبات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Closures History */}
      <Card>
        <CardHeader>
          <CardTitle>سجل التسكيرات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">تاريخ التسكير</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">عدد العقود</TableHead>
                  <TableHead className="text-right">إجمالي المبلغ</TableHead>
                  <TableHead className="text-right">المسحوب</TableHead>
                  <TableHead className="text-right">المتبقي</TableHead>
                  <TableHead className="text-right">الملاحظات</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedClosures.map(closure => (
                  <TableRow key={closure.id}>
                    <TableCell className="text-right">{new Date(closure.closure_date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={closure.closure_type === 'period' ? 'default' : 'secondary'}>
                        {closure.closure_type === 'period' ? 'فترة زمنية' : 'نطاق عقود'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {closure.closure_type === 'period' && closure.period_start && closure.period_end ? 
                        `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}` :
                        closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ?
                        `${closure.contract_start} - ${closure.contract_end}` :
                        '—'
                      }
                    </TableCell>
                    <TableCell className="text-right">{closure.total_contracts}</TableCell>
                    <TableCell className="text-right">{closure.total_amount.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.total_withdrawn.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.remaining_balance.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.notes || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه التسكيرة؟', variant: 'destructive', confirmText: 'حذف' })) return;
                            try {
                              const { error } = await supabase
                                .from('period_closures')
                                .delete()
                                .eq('id', closure.id);
                              
                              if (error) {
                                toast.error('فشل في حذف التسكيرة');
                                return;
                              }
                              
                              setClosures(prev => prev.filter(c => c.id !== closure.id));
                              toast.success('تم حذف التسكيرة بنجاح');
                            } catch (error) {
                              toast.error('حدث خطأ في حذف التسكيرة');
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {closures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="expenses-empty-state">
                      لا توجد تسكيرات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Withdrawal Dialog */}
      <UIDialog.Dialog open={withdrawalOpen} onOpenChange={(open) => {
        setWithdrawalOpen(open);
        if (!open) {
          setEditingWithdrawal(null);
          setWithdrawalAmount('');
          setWithdrawalDate(new Date().toISOString().slice(0,10));
          setWithdrawalMethod('');
          setWithdrawalNotes('');
          setWithdrawalReceiverName('');
          setWithdrawalSenderName('');
        } else if (editingWithdrawal) {
          setWithdrawalAmount(editingWithdrawal.amount.toString());
          setWithdrawalDate(editingWithdrawal.date);
          setWithdrawalMethod(editingWithdrawal.method || '');
          setWithdrawalNotes(editingWithdrawal.note || '');
          setWithdrawalReceiverName(editingWithdrawal.receiver_name || '');
          setWithdrawalSenderName(editingWithdrawal.sender_name || '');
        }
      }}>
        <UIDialog.DialogContent className="expenses-dialog-content">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>{editingWithdrawal ? 'تعديل السحب' : 'تسجيل سحب جديد'}</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل تفاصيل السحب من المجموع العام
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">مبلغ السحب (د.ل)</label>
              <Input
                type="number"
                placeholder="أدخل مبلغ السحب"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">تاريخ السحب</label>
              <Input
                type="date"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">طريقة السحب</label>
              <Input
                placeholder="نقدي، تحويل بنكي، شيك..."
                value={withdrawalMethod}
                onChange={(e) => setWithdrawalMethod(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="expenses-form-label">اسم المستلم</label>
                <Input
                  placeholder="اسم المستلم"
                  value={withdrawalReceiverName}
                  onChange={(e) => setWithdrawalReceiverName(e.target.value)}
                />
              </div>
              <div>
                <label className="expenses-form-label">اسم المسلم (المدير)</label>
                <Input
                  placeholder="اسم المسلم"
                  value={withdrawalSenderName}
                  onChange={(e) => setWithdrawalSenderName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="expenses-form-label">ملاحظات</label>
              <Textarea
                placeholder="أدخل أي ملاحظات إضافية"
                value={withdrawalNotes}
                onChange={(e) => setWithdrawalNotes(e.target.value)}
              />
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={addWithdrawal}>
              {editingWithdrawal ? 'تحديث' : 'حفظ السحب'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Closure Dialog */}
      <UIDialog.Dialog open={closureOpen} onOpenChange={setClosureOpen}>
        <UIDialog.DialogContent className="max-w-lg">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تسكير حساب</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              ا��تر طريقة التسكير: بالفترة الزمنية أو بنطاق أرقام العقود
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">تاريخ التسكير</label>
              <Input
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">نوع التسكير</label>
              <Select value={closureType} onValueChange={(value: 'period' | 'contract_range') => setClosureType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      تسكير بالفترة الزمنية
                    </div>
                  </SelectItem>
                  <SelectItem value="contract_range">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      تسكير بنطاق أرقام العقود
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closureType === 'period' ? (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">بداية الفترة</label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="expenses-form-label">نهاية الفترة</label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">من رقم العقد</label>
                  <Select value={contractStart} onValueChange={setContractStart}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأول" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractNumbers.map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="expenses-form-label">إلى رقم العقد</label>
                  <Select value={contractEnd} onValueChange={setContractEnd}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأخير" />
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

            <div>
              <label className="expenses-form-label">ملاحظات التسكير</label>
              <Textarea
                placeholder="أدخل ملاحظات حول التسكير"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
              />
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setClosureOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={closePeriodOrRange} variant="destructive">
              تسكير الحساب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Withdrawal Receipt Print Dialog */}
      {selectedWithdrawalForReceipt && (
        <ExpenseReceiptPrintDialog
          open={showWithdrawalReceiptDialog}
          onOpenChange={setShowWithdrawalReceiptDialog}
          expense={{
            ...selectedWithdrawalForReceipt,
            description: 'سحب من مستحقات التشغيل',
            expense_date: selectedWithdrawalForReceipt.date,
            category: 'مستحقات التشغيل',
            payment_method: selectedWithdrawalForReceipt.method || '',
            notes: selectedWithdrawalForReceipt.note || '',
            receipt_number: `W-${selectedWithdrawalForReceipt.id.substring(0, 8)}`
          }}
        />
      )}

      {/* Operating Dues Print Dialog */}
      <OperatingDuesPrintDialog
        open={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        contracts={contracts}
        withdrawals={withdrawals}
        closures={computedClosures}
        excludedIds={excludedIds}
        totals={totals}
        settledContractIds={settledContractIds}
      />
    </div>
  );
}
