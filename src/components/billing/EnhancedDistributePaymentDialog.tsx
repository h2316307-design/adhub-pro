import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, PrinterIcon, ShoppingCart, DollarSign, Sparkles, AlertCircle, Wallet, Plus, X, UserCheck, Wrench, CheckCircle, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Sub-components
import { DistributionSummaryBar } from './distribute-payment/DistributionSummaryBar';
import { PaymentInputSection } from './distribute-payment/PaymentInputSection';
import { IntermediarySection } from './distribute-payment/IntermediarySection';
import { EmployeeDistributionSection } from './distribute-payment/EmployeeDistributionSection';
import { CustodySection } from './distribute-payment/CustodySection';
import { ItemsTabsSection } from './distribute-payment/ItemsTabsSection';

import type { Employee, EmployeeBalance, CustodyDistribution, EmployeePaymentDistribution, DistributableItem } from './distribute-payment/types';
interface EnhancedDistributePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
  purchaseInvoice?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    used_as_payment: number;
  } | null;
  editMode?: boolean;
  editingDistributedPaymentId?: string | null;
  editingPayments?: any[];
  preSelectedContractIds?: number[];
  preFilledAmount?: number | null;
  sourceAccountPaymentId?: string | null;
}


export function EnhancedDistributePaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
  purchaseInvoice = null,
  editMode = false,
  editingDistributedPaymentId = null,
  editingPayments = [],
  preSelectedContractIds = [],
  preFilledAmount = null,
  sourceAccountPaymentId = null,
}: EnhancedDistributePaymentDialogProps) {
  const [items, setItems] = useState<DistributableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // ✅ NEW: حقول التحويل البنكي
  const [sourceBank, setSourceBank] = useState<string>('');
  const [destinationBank, setDestinationBank] = useState<string>('');
  const [transferReference, setTransferReference] = useState<string>('');
  
  // ✅ NEW: عمولات الوسيط والتحويل
  const [collectedViaIntermediary, setCollectedViaIntermediary] = useState(false);
  const [intermediaryCommission, setIntermediaryCommission] = useState<string>('0');
  const [transferFee, setTransferFee] = useState<string>('0');
  const [commissionNotes, setCommissionNotes] = useState<string>('');
  
  // ✅ NEW: بيانات الوسيط الأساسية
  const [collectorName, setCollectorName] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>('');
  
  // ✅ NEW: خيار تحويل كعهدة
  const [convertToCustody, setConvertToCustody] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [custodyDistributions, setCustodyDistributions] = useState<CustodyDistribution[]>([{ employeeId: '', amount: 0 }]);
  
  // ✅ NEW: خيارات توزيع الدفعة
  const [enableEmployee, setEnableEmployee] = useState(false);
  const [enableCustodyOption, setEnableCustodyOption] = useState(false);
  const [custodyOptionAmount, setCustodyOptionAmount] = useState('');
  
  // ✅ NEW: توزيع الدفع على الموظفين مع رصيد الموظف
  const [employeePaymentDistributions, setEmployeePaymentDistributions] = useState<EmployeePaymentDistribution[]>([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeBalance[]>([]);

  // ✅ Fix: useRef to avoid infinite loop from editingPayments reference changes
  const editingPaymentsRef = useRef(editingPayments);
  editingPaymentsRef.current = editingPayments;
  const abortControllerRef = useRef<AbortController | null>(null);

  const availableCredit = purchaseInvoice 
    ? purchaseInvoice.total_amount - purchaseInvoice.used_as_payment 
    : 0;

  // تحميل بيانات الموظفين المرتبطة بالدفعة عند التعديل
  const loadEditModeEmployeeData = async (distributedPaymentId: string) => {
    try {
      let distributions: EmployeePaymentDistribution[] = [];
      
      // 1. تحميل السلف المرتبطة
      const { data: advances, error: advancesError } = await supabase
        .from('employee_advances')
        .select('employee_id, amount')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (!advancesError && advances && advances.length > 0) {
        advances.forEach(a => {
          distributions.push({
            employeeId: a.employee_id,
            amount: Number(a.amount) || 0,
            paymentType: 'advance' as const
          });
        });
      }
      
      // 2. ✅ تحميل سحوبات الرصيد من expenses_withdrawals
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('expenses_withdrawals')
        .select('receiver_name, amount')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (!withdrawalsError && withdrawals && withdrawals.length > 0) {
        // جلب الموظف المرتبط بمصروفات التشغيل
        const { data: operatingEmployee } = await supabase
          .from('employees')
          .select('id, name')
          .eq('linked_to_operating_expenses', true)
          .single();
        
        if (operatingEmployee) {
          withdrawals.forEach(w => {
            distributions.push({
              employeeId: operatingEmployee.id,
              amount: Number(w.amount) || 0,
              paymentType: 'from_balance' as const
            });
          });
        }
      }
      
      if (distributions.length > 0) {
        setEnableEmployee(true);
        setEmployeePaymentDistributions(distributions);
      }
      
      // 3. تحميل العهد المرتبطة
      const { data: custodies, error: custodiesError } = await supabase
        .from('custody_accounts')
        .select('id, employee_id, initial_amount, created_at')
        .eq('source_payment_id', distributedPaymentId)
        .eq('source_type', 'distributed_payment')
        .order('created_at', { ascending: true });
      
      if (!custodiesError && custodies && custodies.length > 0) {
        setEnableCustodyOption(true);
        setConvertToCustody(true);
        // منع تكرار الموظفين في وضع التعديل إذا كانت هناك عهد مكررة لنفس الدفعة
        const seenEmployees = new Set<string>();
        const custodyDists: CustodyDistribution[] = [];
        for (const c of custodies) {
          if (!c.employee_id || seenEmployees.has(c.employee_id)) continue;
          seenEmployees.add(c.employee_id);
          custodyDists.push({
            employeeId: c.employee_id,
            amount: Number(c.initial_amount) || 0,
          });
        }
        setCustodyDistributions(custodyDists);
        const totalCustody = custodyDists.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        setCustodyOptionAmount(String(totalCustody));
      }
    } catch (error) {
      console.error('Error loading edit mode employee data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      // ✅ Fix: read from ref to avoid stale closure without causing infinite loop
      const currentEditingPayments = editingPaymentsRef.current;
      
      if (editMode && currentEditingPayments && currentEditingPayments.length > 0) {
        // تحميل بيانات التعديل
        const totalAmt = currentEditingPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setTotalAmount(String(totalAmt));
        setPaymentMethod(currentEditingPayments[0]?.method || 'نقدي');
        setPaymentReference(currentEditingPayments[0]?.reference || '');
        setPaymentNotes(currentEditingPayments[0]?.notes || '');
        setPaymentDate(currentEditingPayments[0]?.paid_at ? new Date(currentEditingPayments[0].paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        
        // ✅ تحميل بيانات التحويل البنكي
        setSourceBank(currentEditingPayments[0]?.source_bank || '');
        setDestinationBank(currentEditingPayments[0]?.destination_bank || '');
        setTransferReference(currentEditingPayments[0]?.transfer_reference || '');
        
        // تحميل بيانات الموظفين المرتبطة
        const distPaymentId = currentEditingPayments[0]?.distributed_payment_id;
        if (distPaymentId) {
          loadEditModeEmployeeData(distPaymentId);
        }
      } else {
        setTotalAmount(purchaseInvoice ? String(availableCredit) : (preFilledAmount ? String(preFilledAmount) : ''));
        setPaymentMethod(purchaseInvoice ? 'مقايضة' : 'نقدي');
        setPaymentReference('');
        setPaymentNotes(purchaseInvoice ? `مقايضة من فاتورة مشتريات ${purchaseInvoice.invoice_number}` : '');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        // Reset states only for new payment
        setEnableEmployee(false);
        setEnableCustodyOption(false);
        setCustodyOptionAmount('');
        setEmployeePaymentDistributions([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
        setCustodyDistributions([{ employeeId: '', amount: 0 }]);
        setConvertToCustody(false);
        // Reset bank transfer fields only for new payments
        setSourceBank('');
        setDestinationBank('');
        setTransferReference('');
      }
      setEmployeeBalances([]);
      
      // ✅ Fix: abort previous request to prevent race conditions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      loadDistributableItems();
    } else {
      // Cleanup on close
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
    // ✅ Fix: removed editingPayments from deps (use ref instead) to prevent infinite loop
  }, [open, customerId, editMode, purchaseInvoice, editingDistributedPaymentId]);




  // تحميل الموظفين عند تفعيل خيار العهدة أو الموظف
  useEffect(() => {
    if ((convertToCustody || enableEmployee)) {
      // دائماً أعد تحميل الأرصدة عند تفعيل الخيار
      loadEmployeesWithBalances();
    }
  }, [convertToCustody, enableEmployee]);

  // تحديث مبلغ العهدة عند تغيير المبلغ الكلي
  useEffect(() => {
    if (convertToCustody && custodyDistributions.length === 1) {
      const netAmount = inputAmountNum - (parseFloat(intermediaryCommission) || 0) - (parseFloat(transferFee) || 0);
      setCustodyDistributions([{ ...custodyDistributions[0], amount: netAmount }]);
    }
  }, [totalAmount, intermediaryCommission, transferFee, convertToCustody]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, installation_team_id')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('فشل في تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // تحميل الموظفين مع أرصدتهم مع احتساب التسكيرات
  const loadEmployeesWithBalances = async () => {
    setLoadingEmployees(true);
    try {
      // تحميل الموظفين
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id, name, position, installation_team_id, linked_to_operating_expenses')
        .eq('status', 'active')
        .order('name');

      if (empError) throw empError;
      setEmployees(employeesData || []);

      // تحميل التسكيرات
      const { data: closures, error: closuresError } = await supabase
        .from('period_closures')
        .select('*');

      if (closuresError) {
        console.error('Error loading closures:', closuresError);
      }

      // تحميل السحوبات
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('expenses_withdrawals')
        .select('*');

      if (withdrawalsError) {
        console.error('Error loading withdrawals:', withdrawalsError);
      }

      // تحميل العقود المستبعدة
      const { data: flagsData } = await supabase
        .from('expenses_flags')
        .select('contract_id, excluded');
      
      const excludedSet = new Set<string>();
      (flagsData || []).forEach((flag: any) => {
        if (flag.excluded && flag.contract_id != null) {
          excludedSet.add(String(flag.contract_id));
        }
      });

      // دالة للتحقق إذا كان العقد مغطى بالتسكير
      const isContractCoveredByClosure = (contractNumber: number) => {
        if (!closures || closures.length === 0) return false;
        return closures.some(closure => {
          if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
            return contractNumber >= Number(closure.contract_start) && contractNumber <= Number(closure.contract_end);
          }
          return false;
        });
      };

      // حساب رصيد كل موظف مع التسكيرات
      const balances: EmployeeBalance[] = [];
      
      for (const emp of employeesData || []) {
      // للموظفين المرتبطين بمصروفات التشغيل (بدون فريق)
        if (emp.linked_to_operating_expenses && !emp.installation_team_id) {
          // جلب العقود مع نسبة التشغيل ونسب التركيب والطباعة
          const { data: contracts, error: contractsError } = await supabase
            .from('Contract')
            .select('Contract_Number, "Total Rent", Total, installation_cost, print_cost, operating_fee_rate, operating_fee_rate_installation, operating_fee_rate_print, include_operating_in_installation, include_operating_in_print, "Total Paid"');

          if (contractsError) {
            console.error('Error loading contracts:', contractsError);
            continue;
          }

          // جلب المدفوعات الفعلية لكل عقد
          const { data: paymentsData } = await supabase
            .from('customer_payments')
            .select('contract_number, amount, entry_type')
            .order('created_at', { ascending: true });

          // حساب المدفوع لكل عقد
          const paidByContract: Record<string, number> = {};
          (paymentsData || []).forEach((p: any) => {
            const type = String(p.entry_type || '');
            if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
              const key = String(p.contract_number || '');
              if (!key) return;
              paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
            }
          });

          // فلترة العقود غير المغطاة بالتسكير وغير المستبعدة
          const uncoveredContracts = (contracts || []).filter(c => {
            const isExcluded = excludedSet.has(String(c.Contract_Number));
            const isClosed = isContractCoveredByClosure(c.Contract_Number);
            return !isExcluded && !isClosed;
          });

          // حساب النسبة المتحصلة فعلياً (نفس منطق صفحة مستحقات التشغيل Expenses.tsx)
          const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
            const rentCost = Number(c['Total Rent']) || 0;
            const installationCost = Number(c.installation_cost) || 0;
            const printCost = Number(c.print_cost) || 0;
            const feeRate = Number(c.operating_fee_rate) || 0;
            const feeRateInstallation = Number(c.operating_fee_rate_installation || feeRate) || 0;
            const feeRatePrint = Number(c.operating_fee_rate_print || feeRate) || 0;
            const includeInstallation = c.include_operating_in_installation === true;
            const includePrint = c.include_operating_in_print === true;

            const totalAmount = rentCost + installationCost + printCost;
            const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
            const paymentRatio = totalAmount > 0 ? Math.min(1, totalPaid / totalAmount) : 0;

            let collectedFeeAmount = Math.round(rentCost * paymentRatio * (feeRate / 100));
            if (includeInstallation) collectedFeeAmount += Math.round(installationCost * paymentRatio * (feeRateInstallation / 100));
            if (includePrint) collectedFeeAmount += Math.round(printCost * paymentRatio * (feeRatePrint / 100));

            return sum + collectedFeeAmount;
          }, 0);

          // حساب إجمالي السحوبات - نفس منطق صفحة الموظف
          // للموظف المرتبط بمصروفات التشغيل بدون فريق، نحتسب جميع السحوبات
          // (السحوبات القديمة قد لا تحتوي على receiver_name)
          const employeeWithdrawals = (withdrawals || [])
            .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

          const pendingAmount = Math.max(0, totalOperatingDues - employeeWithdrawals);

          console.log(`📊 حساب رصيد ${emp.name}:`, {
            totalOperatingDues,
            employeeWithdrawals,
            pendingAmount,
            uncoveredContractsCount: uncoveredContracts.length,
            withdrawalsCount: (withdrawals || []).filter(w => w.receiver_name === emp.name).length
          });

          balances.push({
            employeeId: emp.id,
            teamId: null,
            teamName: 'مصروفات التشغيل',
            pendingAmount: pendingAmount
          });
        }
        // للموظفين المرتبطين بمصروفات التشغيل مع فريق
        else if (emp.linked_to_operating_expenses && emp.installation_team_id) {
          // جلب حسابات الفريق
          const { data: teamAccounts, error: teamAccountsError } = await supabase
            .from('installation_team_accounts')
            .select('*, installation_teams(team_name)')
            .eq('team_id', emp.installation_team_id);

          if (teamAccountsError) {
            console.error('Error loading team accounts:', teamAccountsError);
            continue;
          }

          // فلترة العقود غير المغطاة بالتسكير
          const uncoveredAccounts = (teamAccounts || []).filter(account => 
            !isContractCoveredByClosure(account.contract_id)
          );

          // حساب إجمالي المستحقات من العقود غير المغطاة
          const totalPending = uncoveredAccounts
            .filter(a => a.status === 'pending')
            .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

          // حساب إجمالي السحوبات لهذا الموظف فقط
          const totalWithdrawalsForTeam = (withdrawals || [])
            .filter(w => w.receiver_name === emp.name)
            .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

          const teamName = teamAccounts?.[0]?.installation_teams?.team_name || 'الفريق';
          const pendingAmount = Math.max(0, totalPending - totalWithdrawalsForTeam);

          balances.push({
            employeeId: emp.id,
            teamId: emp.installation_team_id,
            teamName: teamName,
            pendingAmount: pendingAmount
          });
        }
        // للموظفين العاديين مع فريق
        else if (emp.installation_team_id) {
          // استخدام team_accounts_summary
          const { data: teamSummary, error: summaryError } = await supabase
            .from('team_accounts_summary')
            .select('*')
            .eq('team_id', emp.installation_team_id)
            .single();

          if (!summaryError && teamSummary) {
            balances.push({
              employeeId: emp.id,
              teamId: emp.installation_team_id,
              teamName: teamSummary.team_name,
              pendingAmount: Number(teamSummary.pending_amount) || 0
            });
          }
        }
      }
      
      console.log('📊 جميع أرصدة الموظفين:', balances);
      setEmployeeBalances(balances);

    } catch (error) {
      console.error('Error loading employees with balances:', error);
      toast.error('فشل في تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // الحصول على رصيد موظف محدد
  const getEmployeeBalance = (employeeId: string): EmployeeBalance | undefined => {
    return employeeBalances.find(b => b.employeeId === employeeId);
  };

  const addCustodyDistribution = () => {
    setCustodyDistributions([...custodyDistributions, { employeeId: '', amount: 0 }]);
  };

  const removeCustodyDistribution = (index: number) => {
    if (custodyDistributions.length > 1) {
      setCustodyDistributions(custodyDistributions.filter((_, i) => i !== index));
    }
  };

  const updateCustodyDistribution = (index: number, field: 'employeeId' | 'amount', value: string | number) => {
    const updated = [...custodyDistributions];
    if (field === 'employeeId') {
      updated[index].employeeId = value as string;
    } else {
      updated[index].amount = Number(value) || 0;
    }
    setCustodyDistributions(updated);
  };

  const generateCustodyAccountNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CUS-${timestamp}-${random}`;
  };

  // دوال إدارة توزيع الدفع على الموظفين
  const addEmployeePaymentDistribution = () => {
    setEmployeePaymentDistributions([...employeePaymentDistributions, { employeeId: '', amount: 0, paymentType: 'advance' }]);
  };

  const removeEmployeePaymentDistribution = (index: number) => {
    if (employeePaymentDistributions.length > 1) {
      setEmployeePaymentDistributions(employeePaymentDistributions.filter((_, i) => i !== index));
    }
  };

  const updateEmployeePaymentDistribution = (index: number, field: 'employeeId' | 'amount' | 'paymentType', value: string | number) => {
    const updated = [...employeePaymentDistributions];
    if (field === 'employeeId') {
      updated[index].employeeId = value as string;
      // عند تغيير الموظف، تحقق من رصيده وحدد نوع الدفع تلقائياً
      const balance = employeeBalances.find(b => b.employeeId === value);
      if (balance && balance.pendingAmount > 0) {
        updated[index].paymentType = 'from_balance';
      } else {
        updated[index].paymentType = 'advance';
      }
    } else if (field === 'amount') {
      updated[index].amount = Number(value) || 0;
    } else if (field === 'paymentType') {
      updated[index].paymentType = value as 'from_balance' | 'advance';
    }
    setEmployeePaymentDistributions(updated);
  };

  const getTotalEmployeePaymentAmount = () => {
    return employeePaymentDistributions.reduce((sum, d) => sum + d.amount, 0);
  };

  const loadDistributableItems = async () => {
    setLoading(true);
    try {
      const allItems: DistributableItem[] = [];

      // في وضع التعديل، جمع IDs العقود التي تم دفعها من الدفعة الموزعة
      const editingContractNumbers = new Set<number>();
      const editingPrintedInvoiceIds = new Set<string>();
      const editingSalesInvoiceIds = new Set<string>();
      const editingCompositeTaskIds = new Set<string>();
      
      if (editMode && editingPayments && editingPayments.length > 0) {
        editingPayments.forEach(p => {
          if (p.contract_number) editingContractNumbers.add(Number(p.contract_number));
          if (p.printed_invoice_id) editingPrintedInvoiceIds.add(p.printed_invoice_id);
          if (p.sales_invoice_id) editingSalesInvoiceIds.add(p.sales_invoice_id);
          if (p.composite_task_id) editingCompositeTaskIds.add(p.composite_task_id);
        });
      }

      // جلب العقود مع المدفوعات الفعلية من customer_payments
      const { data: contracts, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, Total, "Total Paid", "Customer Name", "Ad Type"')
        .eq('customer_id', customerId);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
      }

      if (contracts) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل عقد
        const { data: contractPayments } = await supabase
          .from('customer_payments')
          .select('contract_number, amount, entry_type')
          .eq('customer_id', customerId)
          .in('entry_type', ['receipt', 'payment', 'account_payment']);

        const paymentsByContract = new Map<number, number>();
        if (contractPayments) {
          contractPayments.forEach(p => {
            const contractNum = Number(p.contract_number);
            if (contractNum && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByContract.get(contractNum) || 0;
              paymentsByContract.set(contractNum, current + (Number(p.amount) || 0));
            }
          });
        }

        contracts.forEach(contract => {
          const total = Number(contract.Total) || 0;
          const contractNum = Number(contract.Contract_Number);
          const paid = paymentsByContract.get(contractNum) || 0;
          
          // ✅ إظهار العقد إذا كان له مبلغ متبقي أو كان جزءاً من الدفعة الموزعة المُحررة
          const isPartOfEditingPayment = editingContractNumbers.has(contractNum);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي حتى يمكن تعديله
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            const existingPayment = editingPayments.find(p => Number(p.contract_number) === contractNum);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: contractNum,
              type: 'contract',
              displayName: `عقد #${contractNum}${(remaining - editingAmount) <= 0.01 ? ' (مسدد بالكامل)' : ''}`,
              adType: contract['Ad Type'] || 'غير محدد',
              totalAmount: total,
              paidAmount: paid - editingAmount, // عرض المدفوع بدون المبلغ المُحرر
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير الطباعة غير المقفلة فقط
      const { data: printedInvoices, error: printedError } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, total_amount, paid_amount, notes')
        .eq('customer_id', customerId)
        .eq('locked', false);

      if (printedError) {
        console.error('Error fetching printed invoices:', printedError);
      }

      // ✅ جلب المهام المجمعة لاستبعاد فواتير الطباعة المرتبطة بها
      const compositeLinkedInvoiceIds = new Set<string>();
      const { data: compositeTasksForFilter } = await supabase
        .from('composite_tasks')
        .select('print_task_id, combined_invoice_id')
        .eq('customer_id', customerId);

      if (compositeTasksForFilter) {
        // استبعاد الفواتير الموحدة للمهام المجمعة
        compositeTasksForFilter.forEach(ct => {
          if (ct.combined_invoice_id) compositeLinkedInvoiceIds.add(ct.combined_invoice_id);
        });

        // استبعاد فواتير الطباعة المرتبطة بمهام طباعة ضمن مهام مجمعة
        const printTaskIds = compositeTasksForFilter.map(ct => ct.print_task_id).filter(Boolean) as string[];
        if (printTaskIds.length > 0) {
          const { data: printTasks } = await supabase
            .from('print_tasks')
            .select('invoice_id')
            .in('id', printTaskIds);
          printTasks?.forEach(pt => {
            if (pt.invoice_id) compositeLinkedInvoiceIds.add(pt.invoice_id);
          });
        }
      }

      if (printedInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة طباعة
        const { data: printedPayments } = await supabase
          .from('customer_payments')
          .select('printed_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('printed_invoice_id', 'is', null);

        const paymentsByPrintedInvoice = new Map<string, number>();
        if (printedPayments) {
          printedPayments.forEach(p => {
            if (p.printed_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByPrintedInvoice.get(p.printed_invoice_id) || 0;
              paymentsByPrintedInvoice.set(p.printed_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        printedInvoices.forEach(invoice => {
          // ✅ استبعاد الفواتير المرتبطة بمهام مجمعة
          if (compositeLinkedInvoiceIds.has(invoice.id)) return;
          
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsByPrintedInvoice.get(invoice.id) || 0;
          
          const isPartOfEditingPayment = editingPrintedInvoiceIds.has(invoice.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            const existingPayment = editingPayments.find(p => p.printed_invoice_id === invoice.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: invoice.id,
              type: 'printed_invoice',
              displayName: `فاتورة طباعة #${invoice.invoice_number}${invoice.notes ? ' - ' + invoice.notes : ''}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير المبيعات
      const { data: salesInvoices, error: salesError } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, paid_amount, invoice_name, notes')
        .eq('customer_id', customerId);

      if (salesError) {
        console.error('Error fetching sales invoices:', salesError);
      }

      if (salesInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة مبيعات
        const { data: salesPayments } = await supabase
          .from('customer_payments')
          .select('sales_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('sales_invoice_id', 'is', null);

        const paymentsBySalesInvoice = new Map<string, number>();
        if (salesPayments) {
          salesPayments.forEach(p => {
            if (p.sales_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsBySalesInvoice.get(p.sales_invoice_id) || 0;
              paymentsBySalesInvoice.set(p.sales_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        salesInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsBySalesInvoice.get(invoice.id) || 0;
          
          const isPartOfEditingPayment = editingSalesInvoiceIds.has(invoice.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            const existingPayment = editingPayments.find(p => p.sales_invoice_id === invoice.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: invoice.id,
              type: 'sales_invoice',
              displayName: `فاتورة مبيعات #${invoice.invoice_number}${invoice.invoice_name ? ' - ' + invoice.invoice_name : (invoice.notes ? ' - ' + invoice.notes : '')}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب المهام المجمعة (تركيب + طباعة + قص)
      const { data: compositeTasks, error: compositeError } = await supabase
        .from('composite_tasks')
        .select('id, contract_id, customer_total, paid_amount, customer_name, task_type, customer_installation_cost, customer_print_cost, customer_cutout_cost')
        .eq('customer_id', customerId);

      if (compositeError) {
        console.error('Error fetching composite tasks:', compositeError);
      }

      if (compositeTasks) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل مهمة مجمعة
        const { data: compositePayments } = await supabase
          .from('customer_payments')
          .select('composite_task_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('composite_task_id', 'is', null);

        const paymentsByCompositeTask = new Map<string, number>();
        if (compositePayments) {
          compositePayments.forEach(p => {
            if (p.composite_task_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByCompositeTask.get(p.composite_task_id) || 0;
              paymentsByCompositeTask.set(p.composite_task_id, current + (Number(p.amount) || 0));
            }
          });
        }

        compositeTasks.forEach(task => {
          const total = Number(task.customer_total) || 0;
          const paid = paymentsByCompositeTask.get(task.id) || Number(task.paid_amount) || 0;
          
          // وصف نوع المهمة
          const taskTypeLabel = task.task_type === 'reinstallation' ? 'إعادة تركيب' : 'تركيب جديد';
          const components = [];
          if (task.customer_installation_cost > 0) components.push('تركيب');
          if (task.customer_print_cost > 0) components.push('طباعة');
          if (task.customer_cutout_cost > 0) components.push('قص');
          
          const isPartOfEditingPayment = editingCompositeTaskIds.has(task.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            const existingPayment = editingPayments.find(p => p.composite_task_id === task.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: task.id,
              type: 'composite_task',
              displayName: `مهمة مجمعة #${task.contract_id} (${taskTypeLabel})${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              adType: components.join(' + '),
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // ✅ ترتيب من الأصغر للأكبر حسب رقم العقد
      allItems.sort((a, b) => Number(a.id) - Number(b.id));
      
      // في حالة التعديل، تحديد العناصر المحددة مسبقاً
      if (editMode && editingPayments && editingPayments.length > 0) {
        allItems.forEach(item => {
          const existingPayment = editingPayments.find(p => {
            if (item.type === 'contract') return Number(p.contract_number) === Number(item.id);
            if (item.type === 'printed_invoice') return p.printed_invoice_id === item.id;
            if (item.type === 'sales_invoice') return p.sales_invoice_id === item.id;
            if (item.type === 'composite_task') return p.composite_task_id === item.id;
            return false;
          });
          if (existingPayment) {
            item.selected = true;
            item.allocatedAmount = Number(existingPayment.amount) || 0;
          }
        });
      }

      // ✅ تطبيق العقود المحددة مسبقاً من صفحة حساب الزبون
      if (!editMode && preSelectedContractIds && preSelectedContractIds.length > 0) {
        const preSelectedSet = new Set(preSelectedContractIds);
        allItems.forEach(item => {
          if (item.type === 'contract' && preSelectedSet.has(Number(item.id))) {
            item.selected = true;
          }
        });
      }
      
      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItemById = (id: string | number, selected: boolean) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        return {
          ...it,
          selected,
          allocatedAmount: selected ? it.allocatedAmount : 0
        };
      }
      return it;
    }));
  };

  const handleAmountChangeById = (id: string | number, value: string) => {
    // السماح بالنص الفارغ أو القيم الصالحة فقط
    if (value === '') {
      setItems(prev => prev.map(it => {
        if (it.id === id) {
          return { ...it, allocatedAmount: 0 };
        }
        return it;
      }));
      return;
    }

    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return;

    setItems(prev => prev.map(it => {
      if (it.id === id) {
        const safeAmount = Math.min(Math.max(0, amount), it.remainingAmount);
        return { ...it, allocatedAmount: safeAmount };
      }
      return it;
    }));
  };

  const handleAutoDistribute = () => {
    const inputAmount = parseFloat(totalAmount) || 0;
    if (inputAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل');
      return;
    }

    let remainingToDistribute = inputAmount;
    const newItems = [...items];

    // توزيع تلقائي ذكي: يبدأ من الأصغر إلى الأكبر
    for (const item of newItems) {
      if (item.selected && remainingToDistribute > 0) {
        const amountToAllocate = Math.min(item.remainingAmount, remainingToDistribute);
        item.allocatedAmount = amountToAllocate;
        remainingToDistribute -= amountToAllocate;
      }
    }

    setItems(newItems);
    
    if (remainingToDistribute > 0) {
      toast.info(`تم توزيع ${inputAmount - remainingToDistribute} د.ل - يتبقى ${remainingToDistribute.toFixed(2)} د.ل`);
    } else {
      toast.success('تم التوزيع التلقائي بنجاح');
    }
  };

  const totalAllocated = items.reduce((sum, item) => sum + (item.selected ? item.allocatedAmount : 0), 0);
  const inputAmountNum = parseFloat(totalAmount) || 0;
  const remainingToAllocate = inputAmountNum - totalAllocated;

  const handleDistribute = async () => {
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);
    
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل وتخصيص مبلغ له');
      return;
    }

    if (inputAmountNum <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (Math.abs(remainingToAllocate) > 0.01) {
      toast.error(`المبلغ الموزع (${totalAllocated.toFixed(2)}) لا يساوي المبلغ الكلي (${inputAmountNum.toFixed(2)})`);
      return;
    }

    // التحقق من حقول الوسيط إذا كان مفعلاً
    if (collectedViaIntermediary) {
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع حقول الوسيط المطلوبة');
        return;
      }
    }

    // التحقق من صحة توزيع العهدة إذا كان مفعلاً
    if (convertToCustody) {
      const validDistributions = custodyDistributions.filter(d => d.employeeId && d.amount > 0);
      if (validDistributions.length === 0) {
        toast.error('يرجى اختيار موظف واحد على الأقل وتحديد مبلغ للعهدة');
        return;
      }
      
      // التحقق من عدم تكرار الموظفين
      const employeeIds = validDistributions.map(d => d.employeeId);
      const uniqueEmployeeIds = new Set(employeeIds);
      if (uniqueEmployeeIds.size !== employeeIds.length) {
        toast.error('لا يمكن تكرار نفس الموظف في أكثر من توزيع');
        return;
      }
    }

    setDistributing(true);
    
    try {
      // في حالة التعديل
      if (editMode && editingDistributedPaymentId) {
        // حذف الدفعات القديمة
        const { error: deleteError } = await supabase
          .from('customer_payments')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);

        if (deleteError) {
          console.error('Error deleting old payments:', deleteError);
          throw deleteError;
        }
        
        // ✅ حذف السلف القديمة المرتبطة
        const { error: deleteAdvancesError } = await supabase
          .from('employee_advances')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);
        
        if (deleteAdvancesError) {
          console.error('Error deleting old advances:', deleteAdvancesError);
        }
        
        // ✅ حذف السحوبات القديمة المرتبطة
        const { error: deleteWithdrawalsError } = await supabase
          .from('expenses_withdrawals')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);
        
        if (deleteWithdrawalsError) {
          console.error('Error deleting old withdrawals:', deleteWithdrawalsError);
        }
      }

      const distributedPaymentId = editMode && editingDistributedPaymentId ? editingDistributedPaymentId : `dist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const currentDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
      const paymentInserts = [];
      const errors = [];

      // تجهيز/تنظيف العهد الحالية للدفعة (مهم جداً لمنع تكرار العهد عند تعديل الدفعة)
      let existingCustodyAccounts: Array<{ id: string; employee_id: string; account_number: string; created_at: string | null }> = [];
      const movementCountByCustodyId: Record<string, number> = {};
      if (convertToCustody) {
        const { data: existingCustody, error: existingCustodyError } = await supabase
          .from('custody_accounts')
          .select('id, employee_id, account_number, created_at')
          .eq('source_payment_id', distributedPaymentId)
          .eq('source_type', 'distributed_payment');

        if (existingCustodyError) {
          console.error('Error fetching existing custody accounts:', existingCustodyError);
        } else if (existingCustody && existingCustody.length > 0) {
          existingCustodyAccounts = existingCustody as any;

          const custodyIds = existingCustodyAccounts.map(c => c.id);
          custodyIds.forEach(id => {
            movementCountByCustodyId[id] = 0;
          });

          // حساب عدد الحركات/المصروفات لكل عهدة
          const [{ data: txData }, { data: expData }] = await Promise.all([
            supabase.from('custody_transactions').select('id, custody_account_id').in('custody_account_id', custodyIds),
            supabase.from('custody_expenses').select('id, custody_account_id').in('custody_account_id', custodyIds),
          ]);

          (txData || []).forEach(t => {
            movementCountByCustodyId[t.custody_account_id] = (movementCountByCustodyId[t.custody_account_id] || 0) + 1;
          });
          (expData || []).forEach(e => {
            movementCountByCustodyId[e.custody_account_id] = (movementCountByCustodyId[e.custody_account_id] || 0) + 1;
          });

          // تنظيف العهد المكررة لنفس الموظف (نحذف فقط العهد بدون حركات)
          const byEmployee: Record<string, Array<{ id: string; employee_id: string; account_number: string; created_at: string | null }>> = {};
          existingCustodyAccounts.forEach(c => {
            if (!c.employee_id) return;
            if (!byEmployee[c.employee_id]) byEmployee[c.employee_id] = [];
            byEmployee[c.employee_id].push(c);
          });

          const idsToDelete: string[] = [];
          Object.values(byEmployee).forEach(list => {
            if (list.length <= 1) return;

            const withMovements = list.filter(c => (movementCountByCustodyId[c.id] || 0) > 0);
            // إذا كانت هناك أكثر من عهدة عليها حركات لنفس الموظف، لا نحذف تلقائياً لتجنب فقد البيانات
            if (withMovements.length > 1) return;

            const keep = withMovements.length === 1
              ? withMovements[0]
              : [...list].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];

            list.forEach(c => {
              if (c.id === keep.id) return;
              if ((movementCountByCustodyId[c.id] || 0) === 0) idsToDelete.push(c.id);
            });
          });

          if (idsToDelete.length > 0) {
            await supabase.from('custody_transactions').delete().in('custody_account_id', idsToDelete);
            await supabase.from('custody_expenses').delete().in('custody_account_id', idsToDelete);
            const { error: deleteDupCustodyError } = await supabase
              .from('custody_accounts')
              .delete()
              .in('id', idsToDelete);
            if (deleteDupCustodyError) {
              console.error('Error deleting duplicate custody accounts:', deleteDupCustodyError);
            } else {
              existingCustodyAccounts = existingCustodyAccounts.filter(c => !idsToDelete.includes(c.id));
            }
          }
        }
      }

      console.log('🔄 بدء توزيع الدفعة:', {
        totalAmount: inputAmountNum,
        selectedItems: selectedItems.length,
        distributedPaymentId
      });

      // حساب الصافي بعد العمولات
      const commissionAmount = (parseFloat(intermediaryCommission) || 0) + (parseFloat(transferFee) || 0);
      const netAmount = inputAmountNum - commissionAmount;

      // إدخال جميع الدفعات
      for (const item of selectedItems) {
        // الملاحظات بدون معلومات البنك (لأنها مخزنة في حقول منفصلة)
        let fullNotes = paymentNotes || `توزيع على ${item.displayName} من دفعة بمبلغ ${inputAmountNum.toFixed(2)} د.ل`;

        const paymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: item.allocatedAmount,
          paid_at: currentDate,
          method: paymentMethod || 'نقدي',
          reference: paymentMethod === 'تحويل بنكي' ? transferReference : (paymentReference || null),
          entry_type: 'payment',
          distributed_payment_id: distributedPaymentId,
          notes: fullNotes,
          collected_via_intermediary: collectedViaIntermediary,
          intermediary_commission: collectedViaIntermediary ? (parseFloat(intermediaryCommission) || 0) : 0,
          transfer_fee: collectedViaIntermediary ? (parseFloat(transferFee) || 0) : 0,
          net_amount: item.allocatedAmount,
          commission_notes: collectedViaIntermediary ? commissionNotes : null,
          collector_name: collectedViaIntermediary ? collectorName : null,
          receiver_name: collectedViaIntermediary ? receiverName : null,
          delivery_location: collectedViaIntermediary ? deliveryLocation : null,
          collection_date: collectedViaIntermediary ? collectionDate : null,
          source_bank: paymentMethod === 'تحويل بنكي' ? sourceBank : null,
          destination_bank: paymentMethod === 'تحويل بنكي' ? destinationBank : null,
          transfer_reference: paymentMethod === 'تحويل بنكي' ? transferReference : null
        };

        // إضافة purchase_invoice_id في حالة المقايضة
        if (purchaseInvoice) {
          paymentData.purchase_invoice_id = purchaseInvoice.id;
        }

        if (item.type === 'contract') {
          paymentData.contract_number = Number(item.id);
        } else if (item.type === 'printed_invoice') {
          paymentData.printed_invoice_id = String(item.id);
        } else if (item.type === 'sales_invoice') {
          paymentData.sales_invoice_id = String(item.id);
        } else if (item.type === 'composite_task') {
          paymentData.composite_task_id = String(item.id);
        }

        console.log(`💳 إضافة دفعة لـ ${item.displayName}:`, paymentData);

        const { error: paymentError, data: paymentResult } = await supabase
          .from('customer_payments')
          .insert(paymentData)
          .select();

        if (paymentError) {
          console.error(`❌ خطأ في إضافة دفعة ${item.displayName}:`, paymentError);
          errors.push(`فشل حفظ الدفعة لـ ${item.displayName}: ${paymentError.message}`);
          continue;
        }

        console.log(`✅ تم إضافة الدفعة لـ ${item.displayName}:`, paymentResult);
        paymentInserts.push({ item, paymentResult });
      }

      if (errors.length > 0) {
        toast.error(`حدثت أخطاء:\n${errors.join('\n')}`);
        setDistributing(false);
        return;
      }

      // تحديث المبالغ المدفوعة
      for (const { item } of paymentInserts) {
        try {
          if (item.type === 'contract') {
            const newPaidAmount = item.paidAmount + item.allocatedAmount;
            
            console.log(`📝 تحديث عقد #${item.id}:`, {
              oldPaid: item.paidAmount,
              allocated: item.allocatedAmount,
              newPaid: newPaidAmount
            });

            const { error: updateError } = await supabase
              .from('Contract')
              .update({
                'Total Paid': String(newPaidAmount)
              })
              .eq('Contract_Number', Number(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث العقد #${item.id}:`, updateError);
              errors.push(`فشل تحديث العقد #${item.id}: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث العقد #${item.id} بنجاح`);
            }
          } else if (item.type === 'printed_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            const isPaid = newPaid >= item.totalAmount;
            
            console.log(`📄 تحديث فاتورة طباعة ${item.id}:`, {
              newPaid,
              isPaid
            });

            const { error: updateError } = await supabase
              .from('printed_invoices')
              .update({
                paid_amount: newPaid,
                paid: isPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة طباعة:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة الطباعة بنجاح`);
            }
          } else if (item.type === 'sales_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            
            console.log(`🛒 تحديث فاتورة مبيعات ${item.id}:`, { newPaid });

            const { error: updateError } = await supabase
              .from('sales_invoices')
              .update({
                paid_amount: newPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة مبيعات:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة المبيعات بنجاح`);
            }
          } else if (item.type === 'composite_task') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            
            console.log(`🔧 تحديث مهمة مجمعة ${item.id}:`, { newPaid });

            const { error: updateError } = await supabase
              .from('composite_tasks')
              .update({
                paid_amount: newPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث مهمة مجمعة:`, updateError);
              errors.push(`فشل تحديث المهمة المجمعة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث المهمة المجمعة بنجاح`);
            }
          }
        } catch (err) {
          console.error(`❌ خطأ غير متوقع في تحديث ${item.displayName}:`, err);
          errors.push(`خطأ غير متوقع: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        toast.info(`تم توزيع الدفعة مع بعض التحذيرات:\n${errors.join('\n')}`);
      } else {
        console.log('✅ تم توزيع الدفعة بنجاح بالكامل');
        toast.success(`تم توزيع ${inputAmountNum.toFixed(2)} د.ل على ${selectedItems.length} عناصر بنجاح`);
      }
      
      // تحديث فاتورة المشتريات في حالة المقايضة
      if (purchaseInvoice) {
        const { error: purchaseUpdateError } = await supabase
          .from('purchase_invoices')
          .update({
            used_as_payment: purchaseInvoice.used_as_payment + totalAllocated
          })
          .eq('id', purchaseInvoice.id);

        if (purchaseUpdateError) {
          console.error('Error updating purchase invoice:', purchaseUpdateError);
          toast.info('تم توزيع الدفعة ولكن فشل تحديث فاتورة المشتريات');
        }
      }
      
      // إنشاء سلفات الموظفين أو سحب من الرصيد إذا كان الخيار مفعلاً
      if (enableEmployee) {
        const validEmployeeDistributions = employeePaymentDistributions.filter(d => d.employeeId && d.amount > 0);
        
        if (validEmployeeDistributions.length > 0) {
          for (const distribution of validEmployeeDistributions) {
            const employee = employees.find(e => e.id === distribution.employeeId);
            const balance = getEmployeeBalance(distribution.employeeId);
            
            // التحقق من نوع الدفع والرصيد
            if (distribution.paymentType === 'from_balance' && balance && balance.pendingAmount > 0) {
              // معرفة نوع الموظف
              const isOperatingExpenseEmployee = balance.teamName === 'مصروفات التشغيل' && !balance.teamId;
              
              if (isOperatingExpenseEmployee) {
                // سحب من مصروفات التشغيل - تسجيل في expenses_withdrawals
                const { error: withdrawalError } = await supabase
                  .from('expenses_withdrawals')
                  .insert({
                    amount: distribution.amount,
                    date: paymentDate,
                    type: 'individual',
                    method: paymentMethod,
                    notes: `سحب من رصيد مستحقات التشغيل - دفعة ${customerName}`,
                    receiver_name: employee?.name,
                    distributed_payment_id: distributedPaymentId
                  });
                
                if (withdrawalError) {
                  console.error('Error creating withdrawal:', withdrawalError);
                  toast.info(`فشل في تسجيل السحب لـ ${employee?.name}`);
                } else {
                  toast.success(`تم سحب ${distribution.amount.toFixed(2)} د.ل من رصيد ${employee?.name}`);
                }
              } else if (balance.teamId) {
                // سحب من مستحقات التركيب - تحديث حالة السجلات إلى "مدفوع"
                let remainingToWithdraw = distribution.amount;
                
                // جلب السجلات المعلقة للفريق
                const { data: pendingAccounts, error: fetchError } = await supabase
                  .from('installation_team_accounts')
                  .select('*')
                  .eq('team_id', balance.teamId)
                  .eq('status', 'pending')
                  .order('installation_date', { ascending: true });
                
                if (fetchError) {
                  console.error('Error fetching pending accounts:', fetchError);
                  toast.info(`فشل في سحب المستحقات لـ ${employee?.name}`);
                  continue;
                }
                
                if (pendingAccounts) {
                  for (const account of pendingAccounts) {
                    if (remainingToWithdraw <= 0) break;
                    
                    const accountAmount = Number(account.amount) || 0;
                    
                    if (accountAmount <= remainingToWithdraw) {
                      // سحب كامل المبلغ من هذا السجل
                      const { error: updateError } = await supabase
                        .from('installation_team_accounts')
                        .update({ 
                          status: 'paid',
                          notes: `${account.notes || ''}\nتم السحب بتاريخ ${paymentDate} من دفعة ${customerName}`
                        })
                        .eq('id', account.id);
                      
                      if (updateError) {
                        console.error('Error updating account:', updateError);
                      }
                      remainingToWithdraw -= accountAmount;
                    } else {
                      // سحب جزئي - نحتاج لإنشاء سجل جديد للباقي
                      // تحديث السجل الحالي ليعكس المبلغ المسحوب
                      const { error: updateError } = await supabase
                        .from('installation_team_accounts')
                        .update({ 
                          status: 'paid',
                          amount: remainingToWithdraw,
                          notes: `${account.notes || ''}\nسحب جزئي ${remainingToWithdraw} من ${accountAmount} بتاريخ ${paymentDate}`
                        })
                        .eq('id', account.id);
                      
                      // إنشاء سجل جديد للباقي
                      if (!updateError) {
                        await supabase
                          .from('installation_team_accounts')
                          .insert({
                            team_id: account.team_id,
                            task_item_id: account.task_item_id,
                            billboard_id: account.billboard_id,
                            contract_id: account.contract_id,
                            installation_date: account.installation_date,
                            amount: accountAmount - remainingToWithdraw,
                            status: 'pending',
                            notes: `متبقي من سحب جزئي`
                          });
                      }
                      remainingToWithdraw = 0;
                    }
                  }
                }
                
                toast.success(`تم سحب ${distribution.amount.toFixed(2)} د.ل من مستحقات ${employee?.name}`);
              }
            } else {
              // إنشاء سلفة جديدة
              const { error: advanceError } = await supabase
                .from('employee_advances')
                .insert({
                  employee_id: distribution.employeeId,
                  amount: distribution.amount,
                  remaining: distribution.amount,
                  reason: `سلفة من دفعة موزعة - ${customerName}`,
                  status: 'approved',
                  request_date: paymentDate,
                  distributed_payment_id: distributedPaymentId
                });

              if (advanceError) {
                console.error('Error creating employee advance:', advanceError);
                toast.info(`تم التوزيع ولكن فشل إنشاء سلفة لـ ${employee?.name}`);
              } else {
                toast.success(`تم إنشاء سلفة بقيمة ${distribution.amount.toFixed(2)} د.ل لـ ${employee?.name}`);
              }
            }
          }
        }
      }
      
      // إنشاء العهد إذا كان الخيار مفعلاً
      if (convertToCustody) {
        const validDistributions = custodyDistributions.filter(d => d.employeeId && d.amount > 0);
        
        if (validDistributions.length > 0) {
          for (const distribution of validDistributions) {
            const employee = employees.find(e => e.id === distribution.employeeId);

            // إذا كانت هناك عهدة موجودة بالفعل لنفس الدفعة ونفس الموظف: حدّثها (بدلاً من إنشاء عهدة جديدة مكررة)
            const existingForEmployee = existingCustodyAccounts.find(c => c.employee_id === distribution.employeeId);
            if (existingForEmployee) {
              const movementsCount = movementCountByCustodyId[existingForEmployee.id] || 0;
              
              // جلب البيانات الحالية للعهدة لحساب الفرق
              const { data: currentCustodyData } = await supabase
                .from('custody_accounts')
                .select('initial_amount, current_balance')
                .eq('id', existingForEmployee.id)
                .single();
              
              if (currentCustodyData) {
                const oldInitialAmount = Number(currentCustodyData.initial_amount) || 0;
                const oldCurrentBalance = Number(currentCustodyData.current_balance) || 0;
                const newAmount = Number(distribution.amount) || 0;
                
                // حساب الفرق بين المبلغ الجديد والقديم
                const amountDifference = newAmount - oldInitialAmount;
                
                // الرصيد الجديد = الرصيد الحالي + الفرق
                const newCurrentBalance = oldCurrentBalance + amountDifference;
                
                const { error: updateCustodyError } = await supabase
                  .from('custody_accounts')
                  .update({
                    initial_amount: newAmount,
                    current_balance: newCurrentBalance,
                  })
                  .eq('id', existingForEmployee.id);

                if (updateCustodyError) {
                  console.error('Error updating existing custody:', updateCustodyError);
                  toast.info(`تم التوزيع لكن فشل تحديث عهدة ${employee?.name || ''}`);
                } else if (amountDifference !== 0) {
                  console.log(`✅ تم تحديث عهدة ${employee?.name}: المبلغ الأولي من ${oldInitialAmount} إلى ${newAmount}، الرصيد الحالي من ${oldCurrentBalance} إلى ${newCurrentBalance}`);
                }
              }
              continue;
            }

            const accountNumber = generateCustodyAccountNumber();
            
            const { error: custodyError } = await supabase
              .from('custody_accounts')
              .insert({
                employee_id: distribution.employeeId,
                account_number: accountNumber,
                initial_amount: distribution.amount,
                current_balance: distribution.amount,
                status: 'active',
                source_payment_id: distributedPaymentId,
                source_type: 'distributed_payment',
                notes: `عهدة من دفعة موزعة - ${customerName} - ${employee?.name || ''}`
              });

            if (custodyError) {
              console.error('Error creating custody:', custodyError);
              toast.info(`تم التوزيع ولكن فشل إنشاء عهدة لـ ${employee?.name}`);
            }
          }
          toast.success(`تم إنشاء ${validDistributions.length} عهدة بنجاح`);
        }
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('❌ خطأ عام في توزيع الدفعة:', error);
      toast.error(`فشل في توزيع الدفعة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setDistributing(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col bg-card border-border/50 shadow-2xl overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border/50 p-4 bg-gradient-to-l from-primary/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                توزيع دفعة متعددة العناصر
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-2">
                <span>العميل:</span>
                <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/30 text-xs">
                  {customerName}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 gap-4 flex-1">
            <div className="p-4 rounded-full bg-primary/10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Right Panel - Fixed: Payment inputs + summary + options */}
            <div className="lg:w-[340px] shrink-0 border-l border-border/50 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-primary/5 to-transparent order-1 lg:order-2">
              {/* Distribution Summary */}
              <DistributionSummaryBar
                inputAmountNum={inputAmountNum}
                totalAllocated={totalAllocated}
                remainingToAllocate={remainingToAllocate}
              />

              {/* Payment Inputs */}
              <PaymentInputSection
                totalAmount={totalAmount}
                setTotalAmount={setTotalAmount}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentDate={paymentDate}
                setPaymentDate={setPaymentDate}
                paymentReference={paymentReference}
                setPaymentReference={setPaymentReference}
                paymentNotes={paymentNotes}
                setPaymentNotes={setPaymentNotes}
                sourceBank={sourceBank}
                setSourceBank={setSourceBank}
                destinationBank={destinationBank}
                setDestinationBank={setDestinationBank}
                transferReference={transferReference}
                setTransferReference={setTransferReference}
              />

              {/* Auto distribute button */}
              <Button
                onClick={handleAutoDistribute}
                className="w-full h-9 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold text-xs"
                disabled={!totalAmount || items.filter(i => i.selected).length === 0}
                size="sm"
              >
                <Sparkles className="h-4 w-4 ml-1.5" />
                توزيع تلقائي ذكي
              </Button>

              {items.filter(i => i.selected).length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>اختر العناصر ثم اضغط التوزيع</span>
                </div>
              )}

              {/* Collapsible sections */}
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <IntermediarySection
                  collectedViaIntermediary={collectedViaIntermediary}
                  setCollectedViaIntermediary={setCollectedViaIntermediary}
                  collectorName={collectorName}
                  setCollectorName={setCollectorName}
                  receiverName={receiverName}
                  setReceiverName={setReceiverName}
                  deliveryLocation={deliveryLocation}
                  setDeliveryLocation={setDeliveryLocation}
                  collectionDate={collectionDate}
                  setCollectionDate={setCollectionDate}
                  intermediaryCommission={intermediaryCommission}
                  setIntermediaryCommission={setIntermediaryCommission}
                  transferFee={transferFee}
                  setTransferFee={setTransferFee}
                  commissionNotes={commissionNotes}
                  setCommissionNotes={setCommissionNotes}
                  inputAmountNum={inputAmountNum}
                />

                <EmployeeDistributionSection
                  enableEmployee={enableEmployee}
                  setEnableEmployee={setEnableEmployee}
                  employeePaymentDistributions={employeePaymentDistributions}
                  addEmployeePaymentDistribution={addEmployeePaymentDistribution}
                  removeEmployeePaymentDistribution={removeEmployeePaymentDistribution}
                  updateEmployeePaymentDistribution={updateEmployeePaymentDistribution}
                  getTotalEmployeePaymentAmount={getTotalEmployeePaymentAmount}
                  employees={employees}
                  employeeBalances={employeeBalances}
                  loadingEmployees={loadingEmployees}
                  totalAmount={totalAmount}
                />

                <CustodySection
                  enableCustodyOption={enableCustodyOption}
                  setEnableCustodyOption={setEnableCustodyOption}
                  convertToCustody={convertToCustody}
                  setConvertToCustody={setConvertToCustody}
                  custodyOptionAmount={custodyOptionAmount}
                  setCustodyOptionAmount={setCustodyOptionAmount}
                  custodyDistributions={custodyDistributions}
                  addCustodyDistribution={addCustodyDistribution}
                  removeCustodyDistribution={removeCustodyDistribution}
                  updateCustodyDistribution={updateCustodyDistribution}
                  employees={employees}
                  loadingEmployees={loadingEmployees}
                />
              </div>
            </div>

            {/* Left Panel - Scrollable: Items tabs */}
            <div className="flex-1 overflow-y-auto p-4 order-2 lg:order-1 min-h-0">
              <ItemsTabsSection
                items={items}
                setItems={setItems}
                onSelect={handleSelectItemById}
                onAmountChange={handleAmountChangeById}
                remainingToAllocate={remainingToAllocate}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/50 p-3 bg-accent/10 shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={distributing}
              className="flex-1 h-10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleDistribute}
              disabled={distributing || items.filter(i => i.selected && i.allocatedAmount > 0).length === 0 || Math.abs(remainingToAllocate) > 0.01}
              className="flex-1 h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold"
            >
              {distributing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التوزيع...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  تأكيد التوزيع ({items.filter(i => i.selected && i.allocatedAmount > 0).length})
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
