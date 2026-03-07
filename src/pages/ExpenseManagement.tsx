// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { 
  TrendingDown, 
  Users, 
  Calendar,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  RefreshCw,
  Download,
  Wallet,
  TrendingUp,
  Printer,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';

interface ExpenseStats {
  totalExpenses: number;
  monthlyExpenses: number;
  totalSalaries: number;
  activeEmployees: number;
  totalWithdrawals: number;
  remainingBalance: number;
  unpaidExpenses: number;
  employeeDues: number;
}

interface Employee {
  id: string;
  name: string;
  position: string;
  base_salary: number;
  hire_date: string;
  status: string;
  phone?: string;
  email?: string;
  created_at?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  payment_status: string;
  paid_date?: string;
  employee_id?: string;
  notes?: string;
  receiver_name?: string;
  sender_name?: string;
  created_at?: string;
}

interface ExpenseCategory {
  id: number;
  name: string;
  code?: string;
}

interface EmployeeCreditEntry {
  id: string;
  employee_id: string;
  expense_id?: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description: string;
  payment_method?: string;
  reference_number?: string;
  entry_date: string;
  notes?: string;
}

interface EmployeeDue {
  employee_id: string;
  employee_name: string;
  position: string;
  total_credit: number;
  total_debit: number;
  balance: number;
}

interface Withdrawal {
  id: number;
  amount: number;
  date: string;
  method: string;
  note?: string;
  notes?: string;
  type?: string;
  contract_id?: number;
  user_id?: string;
  created_at?: string;
}

interface PeriodClosure {
  id: number;
  closure_date: string;
  period_start?: string;
  period_end?: string;
  closure_type?: string;
  total_amount?: number;
  total_withdrawn?: number;
  remaining_balance?: number;
  total_contracts?: number;
  notes?: string;
  created_at?: string;
  contract_start?: number;
  contract_end?: number;
}

const paymentMethods = [
  'نقدي',
  'تحويل بنكي',
  'شيك',
  'بطاقة ائتمان'
];

export default function ExpenseManagement() {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<ExpenseStats>({
    totalExpenses: 0,
    monthlyExpenses: 0,
    totalSalaries: 0,
    activeEmployees: 0,
    totalWithdrawals: 0,
    remainingBalance: 0,
    unpaidExpenses: 0,
    employeeDues: 0
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employeeDues, setEmployeeDues] = useState<EmployeeDue[]>([]);
  const [creditEntries, setCreditEntries] = useState<EmployeeCreditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [showExpenseReceiptDialog, setShowExpenseReceiptDialog] = useState(false);
  const [showPayEmployeeDialog, setShowPayEmployeeDialog] = useState(false);
  const [selectedExpenseForReceipt, setSelectedExpenseForReceipt] = useState<Expense | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [editingClosure, setEditingClosure] = useState<PeriodClosure | null>(null);
  
  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  
  // Pay employee form
  const [payEmployeeId, setPayEmployeeId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('نقدي');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    name: '',
    position: '',
    base_salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
    phone: '',
    email: ''
  });

  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    payment_status: 'unpaid',
    employee_id: '',
    notes: '',
    receiver_name: '',
    sender_name: ''
  });

  const [newWithdrawal, setNewWithdrawal] = useState<Partial<Withdrawal>>({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'نقدي',
    note: '',
    type: 'individual'
  });

  const [newClosure, setNewClosure] = useState<Partial<PeriodClosure>>({
    closure_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    closure_type: 'contract_range',
    notes: '',
    contract_start: undefined,
    contract_end: undefined
  });

  const loadData = async () => {
    try {
      setLoading(true);

      // Load employees
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (empError) {
        console.error('Error loading employees:', empError);
      } else if (employeesData) {
        setEmployees(employeesData);
      }

      // Load expenses
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expError) {
        console.error('Error loading expenses:', expError);
      } else if (expensesData) {
        setExpenses(expensesData);
      }

      // Load expense categories
      const { data: categoriesData, error: catError } = await supabase
        .from('expense_categories')
        .select('*');

      if (!catError && categoriesData) {
        setCategories(categoriesData);
      }

      // Load withdrawals
      const { data: withdrawalsData, error: wError } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      if (wError) {
        console.error('Error loading withdrawals:', wError);
      } else if (withdrawalsData) {
        setWithdrawals(withdrawalsData);
      }

      // Load period closures
      const { data: closuresData, error: cError } = await supabase
        .from('period_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (cError) {
        console.error('Error loading closures:', cError);
      } else if (closuresData) {
        setClosures(closuresData);
      }

      // Load employee credit entries
      const { data: creditData } = await supabase
        .from('employee_credit_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      
      if (creditData) {
        setCreditEntries(creditData);
      }

      // Calculate employee dues
      const duesMap: Record<string, EmployeeDue> = {};
      (creditData || []).forEach((entry: any) => {
        if (!duesMap[entry.employee_id]) {
          const emp = (employeesData || []).find(e => e.id === entry.employee_id);
          duesMap[entry.employee_id] = {
            employee_id: entry.employee_id,
            employee_name: emp?.name || 'غير معروف',
            position: emp?.position || '',
            total_credit: 0,
            total_debit: 0,
            balance: 0
          };
        }
        if (entry.entry_type === 'credit') {
          duesMap[entry.employee_id].total_credit += Number(entry.amount) || 0;
        } else {
          duesMap[entry.employee_id].total_debit += Number(entry.amount) || 0;
        }
      });
      Object.values(duesMap).forEach(d => { d.balance = d.total_credit - d.total_debit; });
      setEmployeeDues(Object.values(duesMap).filter(d => d.balance !== 0 || d.total_credit > 0));

      // Calculate stats
      const totalExpenses = (expensesData || [])
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyExpenses = (expensesData || [])
        .filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          return expenseDate.getMonth() === currentMonth && 
                 expenseDate.getFullYear() === currentYear;
        })
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

      const totalSalaries = (employeesData || [])
        .filter(emp => emp.status === 'active')
        .reduce((sum, emp) => sum + (Number(emp.base_salary) || 0), 0);

      const activeEmployees = (employeesData || [])
        .filter(emp => emp.status === 'active').length;

      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const unpaidExpenses = (expensesData || [])
        .filter(e => e.payment_status !== 'paid')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const totalEmployeeDues = Object.values(duesMap)
        .reduce((sum, d) => sum + Math.max(0, d.balance), 0);

      // Load excluded contracts
      const { data: flagsData } = await supabase
        .from('expenses_flags')
        .select('contract_id, excluded');
      
      const excludedSet = new Set<string>();
      (flagsData || []).forEach((flag: any) => {
        if (flag.excluded && flag.contract_id != null) {
          excludedSet.add(String(flag.contract_id));
        }
      });

      const isContractCoveredByClosure = (contractNumber: number): boolean => {
        if (!closuresData || closuresData.length === 0) return false;
        return closuresData.some((closure: any) => {
          if (closure.closure_type === 'contract_range') {
            const start = Number(closure.contract_start) || 0;
            const end = Number(closure.contract_end) || 0;
            return contractNumber >= start && contractNumber <= end;
          }
          return false;
        });
      };

      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Total Rent", operating_fee_rate');
      
      const { data: paymentsData } = await supabase
        .from('customer_payments')
        .select('contract_number, amount, entry_type')
        .order('created_at', { ascending: true });

      const paidByContract: Record<string, number> = {};
      (paymentsData || []).forEach((p: any) => {
        const type = String(p.entry_type || '');
        if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
          const key = String(p.contract_number || '');
          if (!key) return;
          paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
        }
      });
      
      const uncoveredContracts = (contractsData || []).filter(c => {
        const contractNum = c.Contract_Number;
        const isExcluded = excludedSet.has(String(contractNum));
        const isClosed = isContractCoveredByClosure(contractNum);
        return !isExcluded && !isClosed;
      });

      const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
        const feeRate = Number(c.operating_fee_rate) || 0;
        const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
        const collectedFeeAmount = Math.round(totalPaid * (feeRate / 100));
        return sum + collectedFeeAmount;
      }, 0);

      const remainingBalance = totalOperatingDues - totalWithdrawals;

      setStats({
        totalExpenses,
        monthlyExpenses,
        totalSalaries,
        activeEmployees,
        totalWithdrawals,
        remainingBalance,
        unpaidExpenses,
        employeeDues: totalEmployeeDues
      });

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveEmployee = async () => {
    try {
      const employeeData = editingEmployee || newEmployee;
      
      if (!employeeData.name || !employeeData.position || !employeeData.base_salary) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);
        
        if (error) throw error;
        toast.success('تم تحديث بيانات الموظف');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);
        
        if (error) throw error;
        toast.success('تم إضافة الموظف بنجاح');
      }

      setShowEmployeeDialog(false);
      setEditingEmployee(null);
      setNewEmployee({
        name: '',
        position: '',
        base_salary: 0,
        hire_date: new Date().toISOString().split('T')[0],
        status: 'active',
        phone: '',
        email: ''
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('فشل في حفظ بيانات الموظف');
    }
  };

  const saveExpense = async () => {
    try {
      const expenseData = editingExpense || newExpense;
      
      if (!expenseData.description || !expenseData.amount || !expenseData.category) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      // Clean up empty employee_id
      const dataToSave = {
        ...expenseData,
        employee_id: expenseData.employee_id || null,
        payment_status: expenseData.payment_status || 'unpaid',
        paid_date: expenseData.payment_status === 'paid' ? (expenseData.paid_date || new Date().toISOString().split('T')[0]) : null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(dataToSave)
          .eq('id', editingExpense.id);
        
        if (error) throw error;
        toast.success('تم تحديث المصروف');
      } else {
        const { data: insertedData, error } = await supabase
          .from('expenses')
          .insert([dataToSave])
          .select()
          .single();
        
        if (error) throw error;
        
        // ✅ قيد محاسبي آلي: إذا تم تحديد موظف، أضف رصيد دائن
        if (insertedData && dataToSave.employee_id) {
          // Get current balance for this employee
          const { data: lastEntry } = await supabase
            .from('employee_credit_entries')
            .select('balance_after')
            .eq('employee_id', dataToSave.employee_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          const currentBalance = lastEntry?.balance_after || 0;
          const newBalance = currentBalance + Number(dataToSave.amount);

          await supabase.from('employee_credit_entries').insert({
            employee_id: dataToSave.employee_id,
            expense_id: insertedData.id,
            entry_type: 'credit',
            amount: Number(dataToSave.amount),
            balance_after: newBalance,
            description: `مصروف: ${dataToSave.description}`,
            entry_date: dataToSave.expense_date,
            notes: `تم إضافة رصيد تلقائي - صرف الموظف من حسابه الخاص`
          });
          
          toast.success('تم إضافة رصيد دائن للموظف تلقائياً');
        }
        
        toast.success('تم إضافة المصروف بنجاح');
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      setNewExpense({
        description: '',
        amount: 0,
        category: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        payment_status: 'unpaid',
        employee_id: '',
        notes: '',
        receiver_name: '',
        sender_name: ''
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('فشل في حفظ المصروف');
    }
  };

  // ✅ تسكير المصروف (Mark as Paid)
  const markExpenseAsPaid = async (expense: Expense, method: string = 'نقدي') => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          payment_status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          payment_method: method
        })
        .eq('id', expense.id);
      
      if (error) throw error;
      toast.success('تم تسكير المصروف بنجاح');
      loadData();
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      toast.error('فشل في تسكير المصروف');
    }
  };

  // ✅ سداد مستحقات موظف
  const payEmployeeDue = async () => {
    if (!payEmployeeId || !payAmount || Number(payAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { data: lastEntry } = await supabase
        .from('employee_credit_entries')
        .select('balance_after')
        .eq('employee_id', payEmployeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentBalance = lastEntry?.balance_after || 0;
      const newBalance = currentBalance - Number(payAmount);

      const { error } = await supabase.from('employee_credit_entries').insert({
        employee_id: payEmployeeId,
        entry_type: 'debit',
        amount: Number(payAmount),
        balance_after: newBalance,
        description: 'سداد مستحقات للموظف',
        payment_method: payMethod,
        reference_number: payReference || null,
        entry_date: new Date().toISOString().split('T')[0],
        notes: payNotes || null
      });

      if (error) throw error;
      toast.success('تم سداد المستحقات بنجاح');
      setShowPayEmployeeDialog(false);
      setPayEmployeeId('');
      setPayAmount('');
      setPayMethod('نقدي');
      setPayReference('');
      setPayNotes('');
      loadData();
    } catch (error) {
      console.error('Error paying employee:', error);
      toast.error('فشل في سداد المستحقات');
    }
  };

  // ✅ طباعة كشف المصروفات
  const printExpenseStatement = () => {
    const filtered = filteredExpenses;
    if (filtered.length === 0) {
      toast.error('لا توجد مصروفات للطباعة');
      return;
    }

    const totalAmount = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidAmount = filtered.filter(e => e.payment_status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0);
    const unpaidAmount = totalAmount - paidAmount;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف المصروفات</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Noto Sans Arabic', sans-serif; direction: rtl; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1a365d; padding-bottom: 15px; }
          .header h1 { color: #1a365d; font-size: 24px; margin-bottom: 5px; }
          .header p { color: #666; font-size: 13px; }
          .filters-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; display: flex; gap: 20px; flex-wrap: wrap; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #1a365d; color: white; padding: 10px 8px; text-align: right; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .totals { display: flex; justify-content: space-around; background: #f1f5f9; border-radius: 8px; padding: 15px; margin-top: 20px; }
          .total-item { text-align: center; }
          .total-value { font-size: 18px; font-weight: 700; color: #1a365d; }
          .total-label { font-size: 11px; color: #666; margin-top: 4px; }
          .paid { color: #16a34a; }
          .unpaid { color: #dc2626; }
          .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #999; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { text-align: center; width: 30%; }
          .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>كشف المصروفات</h1>
          <p>تاريخ الطباعة: ${format(new Date(), 'dd/MM/yyyy', { locale: ar })}</p>
          ${filterDateFrom || filterDateTo ? `<p>الفترة: ${filterDateFrom || '...'} إلى ${filterDateTo || '...'}</p>` : ''}
        </div>
        
        <div class="filters-info">
          <span><strong>عدد المصروفات:</strong> ${filtered.length}</span>
          ${filterCategory !== 'all' ? `<span><strong>الصنف:</strong> ${filterCategory}</span>` : ''}
          ${filterStatus !== 'all' ? `<span><strong>الحالة:</strong> ${filterStatus === 'paid' ? 'مسدد' : 'غير مسدد'}</span>` : ''}
          ${filterEmployee !== 'all' ? `<span><strong>الموظف:</strong> ${employees.find(e => e.id === filterEmployee)?.name || ''}</span>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>الوصف</th>
              <th>الصنف</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>الموظف</th>
              <th>طريقة الدفع</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((e, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${format(new Date(e.expense_date), 'dd/MM/yyyy')}</td>
                <td>${e.description}</td>
                <td>${e.category}</td>
                <td style="font-weight:700">${Number(e.amount).toLocaleString('ar-LY')} د.ل</td>
                <td class="${e.payment_status === 'paid' ? 'paid' : 'unpaid'}">${e.payment_status === 'paid' ? '✓ مسدد' : '✗ غير مسدد'}</td>
                <td>${e.employee_id ? (employees.find(emp => emp.id === e.employee_id)?.name || '-') : '-'}</td>
                <td>${e.payment_method || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-item">
            <div class="total-value">${totalAmount.toLocaleString('ar-LY')} د.ل</div>
            <div class="total-label">إجمالي المصروفات</div>
          </div>
          <div class="total-item">
            <div class="total-value paid">${paidAmount.toLocaleString('ar-LY')} د.ل</div>
            <div class="total-label">المسدد</div>
          </div>
          <div class="total-item">
            <div class="total-value unpaid">${unpaidAmount.toLocaleString('ar-LY')} د.ل</div>
            <div class="total-label">غير المسدد</div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box"><div class="sig-line">المحاسب</div></div>
          <div class="sig-box"><div class="sig-line">المدير المالي</div></div>
          <div class="sig-box"><div class="sig-line">المدير العام</div></div>
        </div>

        <div class="footer">
          <p>هذا مستند إلكتروني ولا يحتاج إلى ختم أو توقيع</p>
        </div>
        
        <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 500));</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // ✅ المصروفات المفلترة
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterStatus !== 'all' && e.payment_status !== filterStatus) return false;
      if (filterEmployee !== 'all' && e.employee_id !== filterEmployee) return false;
      if (filterDateFrom && e.expense_date < filterDateFrom) return false;
      if (filterDateTo && e.expense_date > filterDateTo) return false;
      return true;
    });
  }, [expenses, filterCategory, filterStatus, filterEmployee, filterDateFrom, filterDateTo]);

  const deleteEmployee = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف الموظف');
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('فشل في حذف الموظف');
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف المصروف');
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('فشل في حذف المصروف');
    }
  };

  const saveWithdrawal = async () => {
    try {
      const withdrawalData = editingWithdrawal || newWithdrawal;
      
      if (!withdrawalData.amount || withdrawalData.amount <= 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        return;
      }

      if (editingWithdrawal) {
        const { error } = await supabase
          .from('expenses_withdrawals')
          .update(withdrawalData)
          .eq('id', editingWithdrawal.id);
        
        if (error) throw error;
        toast.success('تم تحديث السحب');
      } else {
        const { error } = await supabase
          .from('expenses_withdrawals')
          .insert([withdrawalData]);
        
        if (error) throw error;
        toast.success('تم إضافة السحب بنجاح');
      }

      setShowWithdrawalDialog(false);
      setEditingWithdrawal(null);
      setNewWithdrawal({
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'نقدي',
        note: '',
        type: 'individual'
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving withdrawal:', error);
      toast.error('فشل في إضافة السحب: ' + (error as Error).message);
    }
  };

  const deleteWithdrawal = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا السحب؟')) return;
    
    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف السحب');
      loadData();
    } catch (error) {
      console.error('Error deleting withdrawal:', error);
      toast.error('فشل في حذف السحب');
    }
  };

  const saveClosure = async () => {
    try {
      const closureData = editingClosure || newClosure;
      
      // التحقق حسب نوع التسكير
      if (!closureData.closure_date) {
        toast.error('يرجى تحديد تاريخ التسكير');
        return;
      }
      
      if (closureData.closure_type === 'contract_range') {
        if (!closureData.contract_start || !closureData.contract_end) {
          toast.error('يرجى تحديد نطاق العقود (من - إلى)');
          return;
        }
      } else {
        if (!closureData.period_start || !closureData.period_end) {
          toast.error('يرجى تحديد الفترة الزمنية (من - إلى)');
          return;
        }
      }

      if (editingClosure) {
        const { error } = await supabase
          .from('period_closures')
          .update(closureData)
          .eq('id', editingClosure.id);
        
        if (error) throw error;
        toast.success('تم تحديث التسكير');
      } else {
        const { error } = await supabase
          .from('period_closures')
          .insert([closureData]);
        
        if (error) throw error;
        toast.success('تم إضافة التسكير بنجاح');
      }

      setShowClosureDialog(false);
      setEditingClosure(null);
      setNewClosure({
        closure_date: new Date().toISOString().split('T')[0],
        period_start: '',
        period_end: '',
        closure_type: 'contract_range',
        notes: '',
        contract_start: undefined,
        contract_end: undefined
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving closure:', error);
      toast.error('فشل في حفظ التسكير: ' + (error as Error).message);
    }
  };

  const deleteClosure = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا التسكير؟')) return;
    
    try {
      const { error } = await supabase
        .from('period_closures')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف التسكير');
      loadData();
    } catch (error) {
      console.error('Error deleting closure:', error);
      toast.error('فشل في حذف التسكير');
    }
  };

  const exportData = () => {
    if (expenses.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const csvData = expenses.map(expense => ({
      'التاريخ': format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ar }),
      'الوصف': expense.description,
      'المبلغ': expense.amount,
      'الفئة': expense.category,
      'طريقة الدفع': expense.payment_method,
      'ملاحظات': expense.notes || ''
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) {
      return categories.map(c => c.name);
    }
    // Default categories if none in database
    return [
      'مرتبات',
      'إيجارات',
      'كهرباء وماء',
      'صيانة',
      'وقود ومواصلات',
      'مواد خام',
      'تسويق وإعلان',
      'مصاريف إدارية',
      'أخرى'
    ];
  }, [categories]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-primary">إدارة المصروفات والمرتبات</h1>
              <p className="text-muted-foreground mt-1">تتبع المصروفات والموظفين والمرتبات</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportData}>
              <Download className="h-4 w-4 ml-2" />
              تصدير التقرير
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">إجمالي المصروفات</CardTitle>
              <div className="p-2 bg-red-500/10 rounded-full">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {stats.totalExpenses.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">إجمالي المسحوبات</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-full">
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                {stats.totalWithdrawals.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">الرصيد المتبقي</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {stats.remainingBalance.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">مصروفات الشهر</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {stats.monthlyExpenses.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">إجمالي المرتبات</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-full">
                <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                {stats.totalSalaries.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/20 border-cyan-200 dark:border-cyan-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">الموظفين النشطين</CardTitle>
              <div className="p-2 bg-cyan-500/10 rounded-full">
                <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
                {stats.activeEmployees}
              </div>
            </CardContent>
          </Card>

          {/* New: Unpaid Expenses Card */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">غير مسددة</CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-full">
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                {stats.unpaidExpenses.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          {/* New: Employee Dues Card */}
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20 border-rose-200 dark:border-rose-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-300">مستحقات موظفين</CardTitle>
              <div className="p-2 bg-rose-500/10 rounded-full">
                <UserCheck className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
                {stats.employeeDues.toLocaleString('ar-LY')} د.ل
              </div>
              {stats.employeeDues > 5000 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-rose-600">
                  <AlertTriangle className="h-3 w-3" /> تراكم مستحقات!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="expenses">المصروفات</TabsTrigger>
            <TabsTrigger value="employee-dues">مستحقات الموظفين</TabsTrigger>
            <TabsTrigger value="withdrawals">سجل المسحوبات</TabsTrigger>
            <TabsTrigger value="closures">سجل التسكيرات</TabsTrigger>
            <TabsTrigger value="employees">الموظفين</TabsTrigger>
          </TabsList>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>المسحوبات والسحوبات</CardTitle>
                <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingWithdrawal(null);
                      setNewWithdrawal({
                        amount: 0,
                        date: new Date().toISOString().split('T')[0],
                        method: 'نقدي',
                        note: '',
                        type: 'individual'
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة سحب
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingWithdrawal ? 'تعديل السحب' : 'إضافة سحب جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>المبلغ</Label>
                        <Input
                          type="number"
                          value={editingWithdrawal ? editingWithdrawal.amount : newWithdrawal.amount}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, amount: Number(e.target.value) });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, amount: Number(e.target.value) });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>التاريخ</Label>
                        <Input
                          type="date"
                          value={editingWithdrawal ? editingWithdrawal.date : newWithdrawal.date}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, date: e.target.value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, date: e.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label>طريقة الدفع</Label>
                        <Select
                          value={editingWithdrawal ? editingWithdrawal.method : newWithdrawal.method}
                          onValueChange={(value) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, method: value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, method: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={editingWithdrawal ? (editingWithdrawal.note || editingWithdrawal.notes) : (newWithdrawal.note || '')}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, note: e.target.value, notes: e.target.value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, note: e.target.value, notes: e.target.value });
                            }
                          }}
                          placeholder="ملاحظات إضافية"
                        />
                      </div>
                      <Button onClick={saveWithdrawal} className="w-full">
                        حفظ
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الطريقة</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          لا توجد مسحوبات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            {format(new Date(withdrawal.date), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell className="font-bold text-destructive">
                            {Number(withdrawal.amount).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{withdrawal.method}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {withdrawal.note || withdrawal.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingWithdrawal(withdrawal);
                                  setShowWithdrawalDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteWithdrawal(withdrawal.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Closures Tab */}
          <TabsContent value="closures">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>سجل تسكير الفترات</CardTitle>
                <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingClosure(null);
                      setNewClosure({
                        closure_date: new Date().toISOString().split('T')[0],
                        period_start: '',
                        period_end: '',
                        closure_type: 'contract_range',
                        notes: '',
                        contract_start: undefined,
                        contract_end: undefined
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة تسكير
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingClosure ? 'تعديل التسكير' : 'إضافة تسكير جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>تاريخ التسكير</Label>
                          <Input
                            type="date"
                            value={editingClosure ? editingClosure.closure_date : newClosure.closure_date}
                            onChange={(e) => {
                              if (editingClosure) {
                                setEditingClosure({ ...editingClosure, closure_date: e.target.value });
                              } else {
                                setNewClosure({ ...newClosure, closure_date: e.target.value });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label>نوع التسكير</Label>
                          <Select
                            value={editingClosure ? editingClosure.closure_type : newClosure.closure_type}
                            onValueChange={(value) => {
                              if (editingClosure) {
                                setEditingClosure({ ...editingClosure, closure_type: value });
                              } else {
                                setNewClosure({ ...newClosure, closure_type: value });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contract_range">نطاق عقود</SelectItem>
                              <SelectItem value="period">فترة زمنية</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* حقول نطاق العقود */}
                      {(editingClosure?.closure_type === 'contract_range' || (!editingClosure && newClosure.closure_type === 'contract_range')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>من عقد رقم</Label>
                            <Input
                              type="number"
                              value={editingClosure ? (editingClosure.contract_start || '') : (newClosure.contract_start || '')}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, contract_start: value });
                                } else {
                                  setNewClosure({ ...newClosure, contract_start: value });
                                }
                              }}
                              placeholder="مثال: 1000"
                            />
                          </div>
                          <div>
                            <Label>إلى عقد رقم</Label>
                            <Input
                              type="number"
                              value={editingClosure ? (editingClosure.contract_end || '') : (newClosure.contract_end || '')}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, contract_end: value });
                                } else {
                                  setNewClosure({ ...newClosure, contract_end: value });
                                }
                              }}
                              placeholder="مثال: 1100"
                            />
                          </div>
                        </div>
                      )}

                      {/* حقول الفترة الزمنية */}
                      {(editingClosure?.closure_type === 'period' || (!editingClosure && newClosure.closure_type === 'period')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>من تاريخ</Label>
                            <Input
                              type="date"
                              value={editingClosure ? editingClosure.period_start : newClosure.period_start}
                              onChange={(e) => {
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, period_start: e.target.value });
                                } else {
                                  setNewClosure({ ...newClosure, period_start: e.target.value });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label>إلى تاريخ</Label>
                            <Input
                              type="date"
                              value={editingClosure ? editingClosure.period_end : newClosure.period_end}
                              onChange={(e) => {
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, period_end: e.target.value });
                                } else {
                                  setNewClosure({ ...newClosure, period_end: e.target.value });
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={editingClosure ? editingClosure.notes : newClosure.notes}
                          onChange={(e) => {
                            if (editingClosure) {
                              setEditingClosure({ ...editingClosure, notes: e.target.value });
                            } else {
                              setNewClosure({ ...newClosure, notes: e.target.value });
                            }
                          }}
                          placeholder="ملاحظات إضافية عن التسكير"
                          rows={3}
                        />
                      </div>

                      <Button onClick={saveClosure} className="w-full">
                        حفظ التسكير
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاريخ التسكير</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>النطاق</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          لا توجد تسكيرات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      closures.map((closure) => (
                        <TableRow key={closure.id}>
                          <TableCell>
                            {format(new Date(closure.closure_date), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {closure.closure_type === 'period' ? 'فترة زمنية' :
                               closure.closure_type === 'contract_range' ? 'نطاق عقود' :
                               closure.closure_type === 'monthly' ? 'شهري' :
                               closure.closure_type === 'yearly' ? 'سنوي' : closure.closure_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ? (
                              <span className="font-medium">
                                عقود {closure.contract_start} - {closure.contract_end}
                              </span>
                            ) : closure.period_start && closure.period_end ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">
                                  من: {format(new Date(closure.period_start), 'dd/MM/yyyy', { locale: ar })}
                                </span>
                                <span className="text-sm">
                                  إلى: {format(new Date(closure.period_end), 'dd/MM/yyyy', { locale: ar })}
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {closure.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingClosure(closure);
                                  setShowClosureDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteClosure(closure.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>المصروفات والنفقات ({filteredExpenses.length})</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={printExpenseStatement}>
                    <FileText className="h-4 w-4 ml-2" />
                    طباعة الكشف
                  </Button>
                  <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingExpense(null);
                        setNewExpense({
                          description: '', amount: 0, category: '',
                          expense_date: new Date().toISOString().split('T')[0],
                          payment_method: '', payment_status: 'unpaid', employee_id: '',
                          notes: '', receiver_name: '', sender_name: ''
                        });
                      }}>
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة مصروف
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>الوصف *</Label>
                          <Input value={editingExpense ? editingExpense.description : newExpense.description}
                            onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, description: e.target.value}) : setNewExpense({...newExpense, description: e.target.value})}
                            placeholder="وصف المصروف" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>المبلغ *</Label>
                            <Input type="number" value={editingExpense ? editingExpense.amount : newExpense.amount}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, amount: Number(e.target.value)}) : setNewExpense({...newExpense, amount: Number(e.target.value)})}
                              placeholder="0" />
                          </div>
                          <div>
                            <Label>التاريخ</Label>
                            <Input type="date" value={editingExpense ? editingExpense.expense_date : newExpense.expense_date}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, expense_date: e.target.value}) : setNewExpense({...newExpense, expense_date: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>الفئة *</Label>
                            <Select value={editingExpense ? editingExpense.category : newExpense.category}
                              onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, category: v}) : setNewExpense({...newExpense, category: v})}>
                              <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                              <SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>حالة السداد</Label>
                            <Select value={editingExpense ? editingExpense.payment_status : newExpense.payment_status}
                              onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, payment_status: v}) : setNewExpense({...newExpense, payment_status: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unpaid">غير مسدد</SelectItem>
                                <SelectItem value="paid">مسدد</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>طريقة الدفع</Label>
                            <Select value={editingExpense ? editingExpense.payment_method : newExpense.payment_method}
                              onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, payment_method: v}) : setNewExpense({...newExpense, payment_method: v})}>
                              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                              <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>الموظف الذي صرف من حسابه</Label>
                            <Select value={editingExpense ? (editingExpense.employee_id || '') : (newExpense.employee_id || '')}
                              onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, employee_id: v === 'none' ? '' : v}) : setNewExpense({...newExpense, employee_id: v === 'none' ? '' : v})}>
                              <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- بدون --</SelectItem>
                                {employees.filter(e => e.status === 'active').map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">إذا صرف الموظف من جيبه، سيُضاف له رصيد دائن تلقائياً</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>اسم المستلم</Label>
                            <Input value={editingExpense ? editingExpense.receiver_name : newExpense.receiver_name}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, receiver_name: e.target.value}) : setNewExpense({...newExpense, receiver_name: e.target.value})}
                              placeholder="اسم المستلم" />
                          </div>
                          <div>
                            <Label>اسم المسلم</Label>
                            <Input value={editingExpense ? editingExpense.sender_name : newExpense.sender_name}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, sender_name: e.target.value}) : setNewExpense({...newExpense, sender_name: e.target.value})}
                              placeholder="اسم المسلم" />
                          </div>
                        </div>
                        <div>
                          <Label>ملاحظات</Label>
                          <Textarea value={editingExpense ? editingExpense.notes : newExpense.notes}
                            onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, notes: e.target.value}) : setNewExpense({...newExpense, notes: e.target.value})}
                            placeholder="ملاحظات إضافية" rows={2} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>إلغاء</Button>
                          <Button onClick={saveExpense}>{editingExpense ? 'تحديث' : 'إضافة'}</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs">من تاريخ</Label>
                    <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">إلى تاريخ</Label>
                    <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">الصنف</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الحالة</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="paid">مسدد</SelectItem>
                        <SelectItem value="unpaid">غير مسدد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الموظف</Label>
                    <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          لا توجد مصروفات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ar })}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{expense.description}</TableCell>
                          <TableCell><Badge variant="outline">{expense.category}</Badge></TableCell>
                          <TableCell className="font-bold">{expense.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell>
                            {expense.payment_status === 'paid' ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 ml-1" /> مسدد
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="cursor-pointer" onClick={() => markExpenseAsPaid(expense)}>
                                <Clock className="h-3 w-3 ml-1" /> غير مسدد
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {expense.employee_id ? (employees.find(e => e.id === expense.employee_id)?.name || '-') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedExpenseForReceipt(expense); setShowExpenseReceiptDialog(true); }} title="طباعة">
                                <Printer className="h-4 w-4" />
                              </Button>
                              {expense.payment_status !== 'paid' && (
                                <Button size="sm" variant="ghost" onClick={() => markExpenseAsPaid(expense)} title="تسكير">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => { setEditingExpense(expense); setShowExpenseDialog(true); }} title="تعديل">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteExpense(expense.id)} title="حذف">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Dues Tab */}
          <TabsContent value="employee-dues">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>مستحقات الموظفين</CardTitle>
                <Dialog open={showPayEmployeeDialog} onOpenChange={setShowPayEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button><DollarSign className="h-4 w-4 ml-2" />سداد مستحقات</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>سداد مستحقات لموظف</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>الموظف</Label>
                        <Select value={payEmployeeId} onValueChange={setPayEmployeeId}>
                          <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                          <SelectContent>
                            {employeeDues.filter(d => d.balance > 0).map(d => (
                              <SelectItem key={d.employee_id} value={d.employee_id}>
                                {d.employee_name} (مستحق: {d.balance.toLocaleString('ar-LY')} د.ل)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>المبلغ</Label>
                        <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <Label>طريقة الدفع</Label>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>رقم المرجع</Label>
                        <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="اختياري" />
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="ملاحظات" rows={2} />
                      </div>
                      <Button onClick={payEmployeeDue} className="w-full">سداد</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {employeeDues.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">لا توجد مستحقات للموظفين</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">الوظيفة</TableHead>
                        <TableHead className="text-right">إجمالي الدائن</TableHead>
                        <TableHead className="text-right">إجمالي المسدد</TableHead>
                        <TableHead className="text-right">الرصيد المستحق</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeDues.map(d => (
                        <TableRow key={d.employee_id}>
                          <TableCell className="font-medium">{d.employee_name}</TableCell>
                          <TableCell>{d.position || '-'}</TableCell>
                          <TableCell>{d.total_credit.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell>{d.total_debit.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="font-bold">
                            <span className={d.balance > 0 ? 'text-destructive' : 'text-green-600'}>
                              {d.balance.toLocaleString('ar-LY')} د.ل
                            </span>
                          </TableCell>
                          <TableCell>
                            {d.balance > 0 ? (
                              <Badge variant="destructive">مستحق</Badge>
                            ) : d.balance === 0 ? (
                              <Badge className="bg-green-100 text-green-700">مسدد</Badge>
                            ) : (
                              <Badge variant="secondary">دائن</Badge>
                            )}
                            {d.balance > 5000 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" /> تنبيه: تراكم مستحقات
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="employees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>إدارة الموظفين</CardTitle>
                <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingEmployee(null);
                      setNewEmployee({
                        name: '',
                        position: '',
                        base_salary: 0,
                        hire_date: new Date().toISOString().split('T')[0],
                        status: 'active',
                        phone: '',
                        email: ''
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة موظف
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingEmployee ? 'تعديل الموظف' : 'إضافة موظف جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>الاسم</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.name : newEmployee.name}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, name: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, name: e.target.value });
                            }
                          }}
                          placeholder="اسم الموظف"
                        />
                      </div>
                      <div>
                        <Label>الوظيفة</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.position : newEmployee.position}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, position: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, position: e.target.value });
                            }
                          }}
                          placeholder="الوظيفة"
                        />
                      </div>
                      <div>
                        <Label>الراتب الأساسي</Label>
                        <Input
                          type="number"
                          value={editingEmployee ? editingEmployee.base_salary : newEmployee.base_salary}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, base_salary: Number(e.target.value) });
                            } else {
                              setNewEmployee({ ...newEmployee, base_salary: Number(e.target.value) });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>تاريخ التعيين</Label>
                        <Input
                          type="date"
                          value={editingEmployee ? editingEmployee.hire_date : newEmployee.hire_date}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, hire_date: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, hire_date: e.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label>رقم الهاتف</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.phone : newEmployee.phone}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, phone: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, phone: e.target.value });
                            }
                          }}
                          placeholder="09xxxxxxxx"
                        />
                      </div>
                      <div>
                        <Label>البريد الإلكتروني</Label>
                        <Input
                          type="email"
                          value={editingEmployee ? editingEmployee.email : newEmployee.email}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, email: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, email: e.target.value });
                            }
                          }}
                          placeholder="example@email.com"
                        />
                      </div>
                      <div>
                        <Label>الحالة</Label>
                        <Select
                          value={editingEmployee ? editingEmployee.status : newEmployee.status}
                          onValueChange={(value) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, status: value });
                            } else {
                              setNewEmployee({ ...newEmployee, status: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">نشط</SelectItem>
                            <SelectItem value="inactive">غير نشط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                          إلغاء
                        </Button>
                        <Button onClick={saveEmployee}>
                          {editingEmployee ? 'تحديث' : 'إضافة'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الوظيفة</TableHead>
                      <TableHead className="text-right">الراتب الأساسي</TableHead>
                      <TableHead className="text-right">تاريخ التعيين</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا يوجد موظفين مسجلين
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.position || '-'}</TableCell>
                          <TableCell className="font-bold">
                            {(employee.base_salary || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>
                            {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ar-LY') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                              {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingEmployee(employee);
                                  setShowEmployeeDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteEmployee(employee.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Print Dialog */}
      {selectedExpenseForReceipt && (
        <ExpenseReceiptPrintDialog
          open={showExpenseReceiptDialog}
          onOpenChange={setShowExpenseReceiptDialog}
          expense={selectedExpenseForReceipt}
        />
      )}
    </div>
  );
}
