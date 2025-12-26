import { useState, useEffect, memo } from 'react';
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
import { Loader2, FileText, PrinterIcon, ShoppingCart, DollarSign, Sparkles, AlertCircle, Wallet, Plus, X, UserCheck, Wrench, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Employee {
  id: string;
  name: string;
  position: string;
  installation_team_id?: string;
}

interface EmployeeBalance {
  employeeId: string;
  teamId: string | null;
  teamName: string | null;
  pendingAmount: number; // مستحقات التركيب
}

interface CustodyDistribution {
  employeeId: string;
  amount: number;
}

interface EmployeePaymentDistribution {
  employeeId: string;
  amount: number;
  paymentType: 'from_balance' | 'advance'; // سحب من الرصيد أو سلفة
}

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
}

interface DistributableItem {
  id: string | number;
  type: 'contract' | 'printed_invoice' | 'sales_invoice' | 'composite_task';
  displayName: string;
  adType?: string; // ✅ نوع الإعلان للعقود
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  selected: boolean;
  allocatedAmount: number;
}

// مكون البطاقة المحسّن مع الترقيم
const ItemCard = memo(({ 
  item, 
  index,
  onSelect, 
  onAmountChange 
}: { 
  item: DistributableItem;
  index: number;
  onSelect: (id: string | number, selected: boolean) => void;
  onAmountChange: (id: string | number, value: string) => void;
}) => {
  const paymentPercent = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
  
  return (
    <Card 
      className={`transition-all duration-300 overflow-hidden ${
        item.selected 
          ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/30' 
          : 'border-border/50 hover:border-primary/40 hover:bg-accent/20 hover:shadow-md'
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-xl text-sm font-bold transition-all ${
              item.selected 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {index + 1}
            </div>
            <Checkbox
              checked={item.selected}
              onCheckedChange={(checked) => onSelect(item.id, checked as boolean)}
              className="h-5 w-5"
            />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <span className="font-bold text-foreground">{item.displayName}</span>
              {item.selected && (
                <Badge className="bg-primary/20 text-primary border-0 text-xs">✓ محدد</Badge>
              )}
            </div>
            {item.adType && (
              <div className="text-sm text-muted-foreground">
                نوع الإعلان: <Badge variant="outline" className="text-xs">{item.adType}</Badge>
              </div>
            )}
            
            {/* شريط التقدم المحسن */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-accent/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      paymentPercent >= 100 
                        ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                        : paymentPercent >= 50 
                          ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                          : "bg-gradient-to-r from-amber-500 to-orange-400"
                    }`}
                    style={{ width: `${Math.min(paymentPercent, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground min-w-[40px] text-left">
                  {paymentPercent.toFixed(0)}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 rounded-lg bg-accent/30">
                <span className="text-muted-foreground block text-xs">الإجمالي</span>
                <span className="font-bold text-foreground">{item.totalAmount.toFixed(0)}</span>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-500/10">
                <span className="text-muted-foreground block text-xs">المدفوع</span>
                <span className="font-bold text-green-500">{item.paidAmount.toFixed(0)}</span>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-500/10">
                <span className="text-muted-foreground block text-xs">المتبقي</span>
                <span className="font-bold text-red-500">{item.remainingAmount.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
        {item.selected && (
          <div className="pt-3 border-t border-primary/20 bg-gradient-to-r from-primary/5 to-transparent -mx-4 px-4 -mb-3 pb-4 rounded-b-lg">
            <Label className="text-sm font-semibold mb-2 block text-primary flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              المبلغ المخصص
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={item.remainingAmount}
                  value={item.allocatedAmount || ''}
                  onChange={(e) => onAmountChange(item.id, e.target.value)}
                  placeholder="0.00"
                  className="text-right text-lg font-semibold h-11 pr-4 pl-12 bg-background/80"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
                  د.ل
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAmountChange(item.id, String(item.remainingAmount))}
                className="whitespace-nowrap h-11 px-4 bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
              >
                كامل المبلغ
              </Button>
            </div>
            {item.allocatedAmount > 0 && (
              <div className="flex items-center gap-2 mt-2 text-sm p-2 rounded-lg bg-accent/30">
                <span className="text-muted-foreground">المتبقي بعد الدفع:</span>
                <span className={`font-bold ${
                  item.remainingAmount - item.allocatedAmount <= 0 ? "text-green-500" : "text-amber-500"
                }`}>
                  {(item.remainingAmount - item.allocatedAmount).toFixed(2)} د.ل
                </span>
                {item.remainingAmount - item.allocatedAmount <= 0 && (
                  <Badge className="bg-green-500/20 text-green-500 border-0 text-xs">مسدد بالكامل</Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export function EnhancedDistributePaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
  purchaseInvoice = null,
  editMode = false,
  editingDistributedPaymentId = null,
  editingPayments = []
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
        .select('employee_id, initial_amount')
        .eq('source_payment_id', distributedPaymentId);
      
      if (!custodiesError && custodies && custodies.length > 0) {
        setEnableCustodyOption(true);
        setConvertToCustody(true);
        const custodyDists: CustodyDistribution[] = custodies.map(c => ({
          employeeId: c.employee_id,
          amount: Number(c.initial_amount) || 0
        }));
        setCustodyDistributions(custodyDists);
        const totalCustody = custodies.reduce((sum, c) => sum + (Number(c.initial_amount) || 0), 0);
        setCustodyOptionAmount(String(totalCustody));
      }
    } catch (error) {
      console.error('Error loading edit mode employee data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      if (editMode && editingPayments && editingPayments.length > 0) {
        // تحميل بيانات التعديل
        const totalAmt = editingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        setTotalAmount(String(totalAmt));
        setPaymentMethod(editingPayments[0]?.method || 'نقدي');
        setPaymentReference(editingPayments[0]?.reference || '');
        setPaymentNotes(editingPayments[0]?.notes || '');
        setPaymentDate(editingPayments[0]?.paid_at ? new Date(editingPayments[0].paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        
        // ✅ تحميل بيانات التحويل البنكي
        setSourceBank(editingPayments[0]?.source_bank || '');
        setDestinationBank(editingPayments[0]?.destination_bank || '');
        setTransferReference(editingPayments[0]?.transfer_reference || '');
        
        // تحميل بيانات الموظفين المرتبطة
        const distPaymentId = editingPayments[0]?.distributed_payment_id;
        if (distPaymentId) {
          loadEditModeEmployeeData(distPaymentId);
        }
      } else {
        setTotalAmount(purchaseInvoice ? String(availableCredit) : '');
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
      loadDistributableItems();
    }
  }, [open, customerId, editMode, purchaseInvoice]);


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
          // جلب العقود مع نسبة التشغيل
          const { data: contracts, error: contractsError } = await supabase
            .from('Contract')
            .select('Contract_Number, "Total Rent", installation_cost, print_cost, operating_fee_rate');

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

          // حساب النسبة المتحصلة فعلياً (مثل صفحة مستحقات التشغيل)
          const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
            const feeRate = Number(c.operating_fee_rate) || 0;
            const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
            const collectedFeeAmount = Math.round(totalPaid * (feeRate / 100));
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
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId)
        .eq('locked', false);

      if (printedError) {
        console.error('Error fetching printed invoices:', printedError);
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
              displayName: `فاتورة طباعة #${invoice.invoice_number}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
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
        .select('id, invoice_number, total_amount, paid_amount')
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
              displayName: `فاتورة مبيعات #${invoice.invoice_number}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
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
            const accountNumber = generateCustodyAccountNumber();
            const employee = employees.find(e => e.id === distribution.employeeId);
            
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

  const contracts = items.filter(i => i.type === 'contract');
  const printedInvoices = items.filter(i => i.type === 'printed_invoice');
  const salesInvoices = items.filter(i => i.type === 'sales_invoice');
  const compositeTasks = items.filter(i => i.type === 'composite_task');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col z-50 bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-2xl overflow-hidden">
        {/* Header محسّن */}
        <DialogHeader className="border-b border-border/50 pb-4 bg-gradient-to-l from-primary/5 to-transparent -mx-6 -mt-6 px-6 pt-6 rounded-t-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                توزيع دفعة متعددة العناصر
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <span>العميل:</span>
                <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/30">
                  {customerName}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 gap-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
            {/* قسم إدخال بيانات الدفعة */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/5 overflow-hidden">
              <CardContent className="p-5 space-y-5">
                {/* ملخص التوزيع المحسّن */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-lg shadow-primary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/20">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">المبلغ الكلي</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {inputAmountNum.toLocaleString("ar-LY")}
                      <span className="text-sm font-normal mr-1">د.ل</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border shadow-lg ${
                    totalAllocated > 0 
                      ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30 shadow-green-500/10"
                      : "bg-gradient-to-br from-accent/30 to-accent/10 border-border/50"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${totalAllocated > 0 ? "bg-green-500/20" : "bg-muted"}`}>
                        <CheckCircle className={`h-4 w-4 ${totalAllocated > 0 ? "text-green-400" : "text-muted-foreground"}`} />
                      </div>
                      <span className="text-sm text-muted-foreground">الموزع</span>
                    </div>
                    <div className={`text-2xl font-bold ${totalAllocated > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {totalAllocated.toLocaleString("ar-LY")}
                      <span className="text-sm font-normal mr-1">د.ل</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border shadow-lg ${
                    Math.abs(remainingToAllocate) < 0.01
                      ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30 shadow-green-500/10"
                      : remainingToAllocate < 0
                        ? "bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30 shadow-red-500/10"
                        : "bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30 shadow-amber-500/10"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${
                        Math.abs(remainingToAllocate) < 0.01 ? "bg-green-500/20" : remainingToAllocate < 0 ? "bg-red-500/20" : "bg-amber-500/20"
                      }`}>
                        {Math.abs(remainingToAllocate) < 0.01 ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <AlertCircle className={`h-4 w-4 ${remainingToAllocate < 0 ? "text-red-400" : "text-amber-400"}`} />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">المتبقي</span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      Math.abs(remainingToAllocate) < 0.01 ? "text-green-400" : remainingToAllocate < 0 ? "text-red-400" : "text-amber-400"
                    }`}>
                      {remainingToAllocate.toLocaleString("ar-LY")}
                      <span className="text-sm font-normal mr-1">د.ل</span>
                    </div>
                  </div>
                </div>

                {/* شريط التقدم */}
                {inputAmountNum > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">نسبة التوزيع</span>
                      <span className={`font-bold ${totalAllocated >= inputAmountNum ? "text-green-400" : "text-primary"}`}>
                        {((totalAllocated / inputAmountNum) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 bg-accent/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          totalAllocated >= inputAmountNum 
                            ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                            : "bg-gradient-to-r from-primary to-primary/70"
                        }`}
                        style={{ width: `${Math.min((totalAllocated / inputAmountNum) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      المبلغ الكلي للدفعة <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        placeholder="أدخل المبلغ الكلي"
                        className="text-lg font-semibold text-right h-12 pr-4 pl-12 bg-background/80"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground bg-accent/50 px-2 py-1 rounded">
                        د.ل
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">طريقة الدفع</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-12 bg-background/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="نقدي">💵 نقدي</SelectItem>
                        <SelectItem value="شيك">📝 شيك</SelectItem>
                        <SelectItem value="تحويل بنكي">🏦 تحويل بنكي</SelectItem>
                        <SelectItem value="بطاقة ائتمان">💳 بطاقة ائتمان</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">تاريخ الدفعة</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="h-12 bg-background/80"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">المرجع / رقم الشيك</Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="اختياري"
                    className="bg-background/80"
                  />
                </div>
                
                {/* ✅ حقول التحويل البنكي */}
                {paymentMethod === 'تحويل بنكي' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        المصرف المحول منه
                      </Label>
                      <Input
                        value={sourceBank}
                        onChange={(e) => setSourceBank(e.target.value)}
                        placeholder="مثال: مصرف الجمهورية"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        المصرف المحول إليه
                      </Label>
                      <Input
                        value={destinationBank}
                        onChange={(e) => setDestinationBank(e.target.value)}
                        placeholder="مثال: مصرف التجارة والتنمية"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        رقم العملية التحويلية
                      </Label>
                      <Input
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="رقم إيصال التحويل"
                        className="bg-background"
                      />
                    </div>
                  </div>
                )}
                
                {/* ✅ قسم عمولات الوسيط */}
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="via-intermediary"
                      checked={collectedViaIntermediary}
                      onCheckedChange={(checked) => setCollectedViaIntermediary(checked as boolean)}
                    />
                    <Label htmlFor="via-intermediary" className="text-base font-semibold cursor-pointer">
                      تم التحصيل عبر وسيط
                    </Label>
                  </div>
                  
                  {collectedViaIntermediary && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-primary/20">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            المحصل (المستلم من الزبون) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={collectorName}
                            onChange={(e) => setCollectorName(e.target.value)}
                            placeholder="اسم المحصل"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            المسلم له <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            placeholder="اسم المستلم"
                            className="bg-background"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            مكان التسليم <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={deliveryLocation}
                            onChange={(e) => setDeliveryLocation(e.target.value)}
                            placeholder="مكان تسليم المبلغ"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            تاريخ القبض <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={collectionDate}
                            onChange={(e) => setCollectionDate(e.target.value)}
                            className="bg-background"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm">عمولة الوسيط (د.ل)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={intermediaryCommission}
                            onChange={(e) => setIntermediaryCommission(e.target.value)}
                            placeholder="0.00"
                            className="text-right"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">عمولة التحويل (د.ل)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={transferFee}
                            onChange={(e) => setTransferFee(e.target.value)}
                            placeholder="0.00"
                            className="text-right"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">ملاحظات العمولات</Label>
                        <Input
                          value={commissionNotes}
                          onChange={(e) => setCommissionNotes(e.target.value)}
                          placeholder="تفاصيل إضافية عن العمولات"
                        />
                      </div>
                      <div className="p-3 bg-background rounded-lg border border-primary/30">
                        <div className="text-sm space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                            <span className="font-semibold">{inputAmountNum.toFixed(2)} د.ل</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>عمولة الوسيط:</span>
                            <span className="font-semibold">-{(parseFloat(intermediaryCommission) || 0).toFixed(2)} د.ل</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>عمولة التحويل:</span>
                            <span className="font-semibold">-{(parseFloat(transferFee) || 0).toFixed(2)} د.ل</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-primary/20 text-lg font-bold text-primary">
                            <span>الصافي:</span>
                            <span>{(inputAmountNum - (parseFloat(intermediaryCommission) || 0) - (parseFloat(transferFee) || 0)).toFixed(2)} د.ل</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* قسم توزيع الدفعة */}
                <div className="space-y-3 border-t pt-3">
                  <h3 className="text-base font-bold text-primary mb-3">توزيع الدفعة:</h3>
                  
                  <div className="grid gap-4">
                    {/* دفع لموظف */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="enable-employee"
                          checked={enableEmployee}
                          onCheckedChange={(checked) => {
                            setEnableEmployee(checked as boolean);
                            if (!checked) setEmployeePaymentDistributions([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
                          }}
                        />
                        <Label htmlFor="enable-employee" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600" />
                          دفع لموظف
                        </Label>
                      </div>
                      {enableEmployee && (
                        <div className="mr-6 space-y-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-green-700 dark:text-green-400">
                              توزيع على الموظفين
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addEmployeePaymentDistribution}
                              className="gap-1 border-green-300"
                            >
                              <Plus className="h-4 w-4" />
                              إضافة موظف
                            </Button>
                          </div>
                          {loadingEmployees ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {employeePaymentDistributions.map((distribution, index) => {
                                const balance = getEmployeeBalance(distribution.employeeId);
                                return (
                                  <div key={index} className="p-3 bg-white dark:bg-background rounded-lg border border-green-200 dark:border-green-700 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1">
                                        <Select
                                          value={distribution.employeeId}
                                          onValueChange={(value) => updateEmployeePaymentDistribution(index, 'employeeId', value)}
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue placeholder="اختر الموظف" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {employees.map((employee) => {
                                              const empBalance = getEmployeeBalance(employee.id);
                                              return (
                                                <SelectItem key={employee.id} value={employee.id}>
                                                  <div className="flex items-center justify-between w-full gap-4">
                                                    <span>{employee.name} - {employee.position || 'موظف'}</span>
                                                    {empBalance && empBalance.pendingAmount > 0 && (
                                                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                                        رصيد: {empBalance.pendingAmount.toFixed(0)} د.ل
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {employeePaymentDistributions.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeEmployeePaymentDistribution(index)}
                                          className="h-8 w-8 text-red-500 hover:text-red-700"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {/* عرض رصيد الموظف وخيارات الدفع */}
                                    {distribution.employeeId && (
                                      <div className="space-y-2">
                                        {balance && balance.pendingAmount > 0 ? (
                                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded border border-green-300 dark:border-green-700">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                                رصيد مستحقات ({balance.teamName || 'الفريق'})
                                              </span>
                                              <Badge className="bg-green-600 text-white">
                                                {balance.pendingAmount.toFixed(2)} د.ل
                                              </Badge>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant={distribution.paymentType === 'from_balance' ? 'default' : 'outline'}
                                                onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'from_balance')}
                                                className="flex-1 text-xs"
                                              >
                                                سحب من الرصيد
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant={distribution.paymentType === 'advance' ? 'default' : 'outline'}
                                                onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'advance')}
                                                className="flex-1 text-xs"
                                              >
                                                سلفة جديدة
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                                            <span className="text-sm text-amber-700 dark:text-amber-400">
                                              ⚠️ لا يوجد رصيد مستحقات - سيتم تسجيل كسلفة
                                            </span>
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1">
                                            <Input
                                              type="number"
                                              value={distribution.amount || ''}
                                              onChange={(e) => updateEmployeePaymentDistribution(index, 'amount', e.target.value)}
                                              placeholder="المبلغ"
                                              className="h-9 text-left"
                                              dir="ltr"
                                            />
                                          </div>
                                          <span className="text-xs text-muted-foreground">د.ل</span>
                                          {balance && balance.pendingAmount > 0 && distribution.paymentType === 'from_balance' && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() => updateEmployeePaymentDistribution(index, 'amount', Math.min(balance.pendingAmount, parseFloat(totalAmount) || 0))}
                                              className="text-xs"
                                            >
                                              كامل الرصيد
                                            </Button>
                                          )}
                                        </div>
                                        
                                        {distribution.paymentType === 'from_balance' && balance && distribution.amount > balance.pendingAmount && (
                                          <div className="text-xs text-red-600">
                                            تحذير: المبلغ أكبر من الرصيد المتاح ({balance.pendingAmount.toFixed(2)} د.ل)
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <div className="flex justify-between pt-2 border-t border-green-200">
                                <span className="text-sm text-green-700">إجمالي الموظفين:</span>
                                <span className="font-bold text-green-700">{getTotalEmployeePaymentAmount().toFixed(2)} د.ل</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* عهدة / تسليم */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="enable-custody-option"
                          checked={enableCustodyOption}
                          onCheckedChange={(checked) => {
                            setEnableCustodyOption(checked as boolean);
                            if (!checked) setCustodyOptionAmount('');
                            if (checked && !convertToCustody) setConvertToCustody(true);
                            if (!checked) setConvertToCustody(false);
                          }}
                        />
                        <Label htmlFor="enable-custody-option" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-amber-600" />
                          عهدة / تسليم
                        </Label>
                      </div>
                      {enableCustodyOption && (
                        <div className="mr-6">
                          <Input
                            type="number"
                            step="0.01"
                            value={custodyOptionAmount}
                            onChange={(e) => setCustodyOptionAmount(e.target.value)}
                            placeholder="مبلغ العهدة"
                            className="text-right"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ملخص التوزيع */}
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                      <span className="font-semibold">{inputAmountNum.toFixed(2)} د.ل</span>
                    </div>
                    {enableEmployee && getTotalEmployeePaymentAmount() > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">دفع للموظفين:</span>
                        <span className="font-semibold">{getTotalEmployeePaymentAmount().toFixed(2)} د.ل</span>
                      </div>
                    )}
                    {enableCustodyOption && custodyOptionAmount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-600">العهدة:</span>
                        <span className="font-semibold">{parseFloat(custodyOptionAmount || '0').toFixed(2)} د.ل</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-bold">الموزع:</span>
                      <span className={`font-bold text-lg ${
                        (getTotalEmployeePaymentAmount() + parseFloat(custodyOptionAmount || '0')).toFixed(2) === inputAmountNum.toFixed(2)
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {(getTotalEmployeePaymentAmount() + parseFloat(custodyOptionAmount || '0')).toFixed(2)} د.ل
                      </span>
                    </div>
                    {(getTotalEmployeePaymentAmount() + parseFloat(custodyOptionAmount || '0')).toFixed(2) !== inputAmountNum.toFixed(2) && inputAmountNum > 0 && (
                      <p className="text-xs text-red-600">
                        ⚠️ المبلغ الموزع لا يساوي المبلغ الإجمالي
                      </p>
                    )}
                  </div>
                </div>
                
                {/* تفاصيل توزيع العهدة */}
                {enableCustodyOption && convertToCustody && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          توزيع العهدة على الموظفين
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustodyDistribution}
                          className="gap-1 border-amber-300"
                        >
                          <Plus className="h-4 w-4" />
                          إضافة موظف
                        </Button>
                      </div>

                      {loadingEmployees ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {custodyDistributions.map((distribution, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-white dark:bg-background rounded border border-amber-200 dark:border-amber-700">
                              <div className="flex-1">
                                <Select
                                  value={distribution.employeeId}
                                  onValueChange={(value) => updateCustodyDistribution(index, 'employeeId', value)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="اختر الموظف" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {employees.map((employee) => (
                                      <SelectItem key={employee.id} value={employee.id}>
                                        {employee.name} - {employee.position || 'موظف'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-32">
                                <Input
                                  type="number"
                                  value={distribution.amount || ''}
                                  onChange={(e) => updateCustodyDistribution(index, 'amount', e.target.value)}
                                  placeholder="المبلغ"
                                  className="h-9 text-left"
                                  dir="ltr"
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">د.ل</span>
                              {custodyDistributions.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeCustodyDistribution(index)}
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ملخص توزيع العهدة */}
                      {custodyDistributions.some(d => d.amount > 0) && (
                        <div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm">
                          <span className="text-amber-700 dark:text-amber-300">إجمالي العهد:</span>
                          <span className="font-bold text-amber-800 dark:text-amber-200">
                            {custodyDistributions.reduce((sum, d) => sum + d.amount, 0).toLocaleString('ar-LY')} د.ل
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-base font-semibold">ملاحظات</Label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="ملاحظات إضافية (اختياري)"
                  />
                </div>

                {/* زر التوزيع التلقائي المحسن */}
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={handleAutoDistribute}
                    className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold shadow-lg shadow-primary/20"
                    disabled={!totalAmount || items.filter(i => i.selected).length === 0}
                  >
                    <Sparkles className="h-5 w-5 ml-2" />
                    توزيع تلقائي ذكي
                  </Button>
                  <Button
                    onClick={() => {
                      const allItems = items.map(item => ({ ...item, selected: true }));
                      setItems(allItems);
                    }}
                    variant="outline"
                    className="gap-2 border-border/50 hover:bg-accent"
                  >
                    <CheckCircle className="h-4 w-4" />
                    تحديد الكل
                  </Button>
                  <Button
                    onClick={() => {
                      const allItems = items.map(item => ({ ...item, selected: false, allocatedAmount: 0 }));
                      setItems(allItems);
                    }}
                    variant="outline"
                    className="gap-2 border-border/50 hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                    إلغاء التحديد
                  </Button>
                </div>

                {items.filter(i => i.selected).length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                    <AlertCircle className="h-5 w-5" />
                    <span>اختر العناصر من الأقسام أدناه ثم اضغط على التوزيع التلقائي</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الأقسام */}
            <Tabs defaultValue="contracts" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-muted">
                <TabsTrigger value="contracts" className="gap-2 text-xs">
                  <FileText className="h-4 w-4" />
                  <span>العقود</span>
                  <Badge variant="secondary">{contracts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="printed" className="gap-2 text-xs">
                  <PrinterIcon className="h-4 w-4" />
                  <span>الطباعة</span>
                  <Badge variant="secondary">{printedInvoices.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2 text-xs">
                  <ShoppingCart className="h-4 w-4" />
                  <span>المبيعات</span>
                  <Badge variant="secondary">{salesInvoices.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="composite" className="gap-2 text-xs">
                  <Wrench className="h-4 w-4" />
                  <span>المجمعة</span>
                  <Badge variant="secondary">{compositeTasks.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {contracts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد عقود مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({contracts.length} عقد)
                    </div>
                    {contracts.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="printed" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {printedInvoices.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <PrinterIcon className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد فواتير طباعة مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({printedInvoices.length} فاتورة)
                    </div>
                    {printedInvoices.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {salesInvoices.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <ShoppingCart className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد فواتير مبيعات مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({salesInvoices.length} فاتورة)
                    </div>
                    {salesInvoices.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="composite" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {compositeTasks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Wrench className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد مهام مجمعة مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      تركيب + طباعة + قص ({compositeTasks.length} مهمة)
                    </div>
                    {compositeTasks.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="border-t border-border/50 pt-4 bg-gradient-to-r from-accent/20 to-transparent -mx-6 -mb-6 px-6 pb-6 mt-2">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={distributing}
              className="flex-1 h-12 border-border/50 hover:bg-accent"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleDistribute}
              disabled={distributing || items.filter(i => i.selected && i.allocatedAmount > 0).length === 0 || Math.abs(remainingToAllocate) > 0.01}
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold shadow-lg shadow-primary/20"
            >
              {distributing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جاري التوزيع...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  تأكيد التوزيع ({items.filter(i => i.selected && i.allocatedAmount > 0).length} عنصر)
                </span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
