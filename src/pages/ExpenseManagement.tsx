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
  ArrowRight
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
    remainingBalance: 0
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [showExpenseReceiptDialog, setShowExpenseReceiptDialog] = useState(false);
  const [selectedExpenseForReceipt, setSelectedExpenseForReceipt] = useState<Expense | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [editingClosure, setEditingClosure] = useState<PeriodClosure | null>(null);

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

      // Load period closures - جميع التساكير (مثل صفحة Expenses.tsx)
      const { data: closuresData, error: cError } = await supabase
        .from('period_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (cError) {
        console.error('Error loading closures:', cError);
      } else if (closuresData) {
        setClosures(closuresData);
      }

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

      // Calculate withdrawals and remaining balance
      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

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

      // دالة للتحقق إذا كان العقد مغطى بتسكير
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

      // Get operating fees from contracts
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Total Rent", operating_fee_rate');
      
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
      const uncoveredContracts = (contractsData || []).filter(c => {
        const contractNum = c.Contract_Number;
        const isExcluded = excludedSet.has(String(contractNum));
        const isClosed = isContractCoveredByClosure(contractNum);
        return !isExcluded && !isClosed;
      });

      // حساب النسبة المتحصلة فعلياً (مثل صفحة الموظف)
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
        remainingBalance
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

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);
        
        if (error) throw error;
        toast.success('تم تحديث المصروف');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData]);
        
        if (error) throw error;
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
        notes: ''
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('فشل في حفظ المصروف');
    }
  };

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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="withdrawals" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="withdrawals">سجل المسحوبات</TabsTrigger>
            <TabsTrigger value="closures">سجل التسكيرات</TabsTrigger>
            <TabsTrigger value="expenses">المصروفات</TabsTrigger>
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
                <CardTitle>المصروفات والنفقات</CardTitle>
                <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingExpense(null);
                      setNewExpense({
                        description: '',
                        amount: 0,
                        category: '',
                        expense_date: new Date().toISOString().split('T')[0],
                        payment_method: '',
                        notes: ''
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة مصروف
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>الوصف</Label>
                        <Input
                          value={editingExpense ? editingExpense.description : newExpense.description}
                          onChange={(e) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, description: e.target.value });
                            } else {
                              setNewExpense({ ...newExpense, description: e.target.value });
                            }
                          }}
                          placeholder="وصف المصروف"
                        />
                      </div>
                      <div>
                        <Label>المبلغ</Label>
                        <Input
                          type="number"
                          value={editingExpense ? editingExpense.amount : newExpense.amount}
                          onChange={(e) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, amount: Number(e.target.value) });
                            } else {
                              setNewExpense({ ...newExpense, amount: Number(e.target.value) });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>الفئة</Label>
                        <Select
                          value={editingExpense ? editingExpense.category : newExpense.category}
                          onValueChange={(value) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, category: value });
                            } else {
                              setNewExpense({ ...newExpense, category: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الفئة" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>التاريخ</Label>
                        <Input
                          type="date"
                          value={editingExpense ? editingExpense.expense_date : newExpense.expense_date}
                          onChange={(e) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, expense_date: e.target.value });
                            } else {
                              setNewExpense({ ...newExpense, expense_date: e.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label>طريقة الدفع</Label>
                        <Select
                          value={editingExpense ? editingExpense.payment_method : newExpense.payment_method}
                          onValueChange={(value) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, payment_method: value });
                            } else {
                              setNewExpense({ ...newExpense, payment_method: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر طريقة الدفع" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>اسم المستلم</Label>
                          <Input
                            value={editingExpense ? editingExpense.receiver_name : newExpense.receiver_name}
                            onChange={(e) => {
                              if (editingExpense) {
                                setEditingExpense({ ...editingExpense, receiver_name: e.target.value });
                              } else {
                                setNewExpense({ ...newExpense, receiver_name: e.target.value });
                              }
                            }}
                            placeholder="اسم المستلم"
                          />
                        </div>
                        <div>
                          <Label>اسم المسلم</Label>
                          <Input
                            value={editingExpense ? editingExpense.sender_name : newExpense.sender_name}
                            onChange={(e) => {
                              if (editingExpense) {
                                setEditingExpense({ ...editingExpense, sender_name: e.target.value });
                              } else {
                                setNewExpense({ ...newExpense, sender_name: e.target.value });
                              }
                            }}
                            placeholder="اسم المسلم"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={editingExpense ? editingExpense.notes : newExpense.notes}
                          onChange={(e) => {
                            if (editingExpense) {
                              setEditingExpense({ ...editingExpense, notes: e.target.value });
                            } else {
                              setNewExpense({ ...newExpense, notes: e.target.value });
                            }
                          }}
                          placeholder="ملاحظات إضافية"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>
                          إلغاء
                        </Button>
                        <Button onClick={saveExpense}>
                          {editingExpense ? 'تحديث' : 'إضافة'}
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
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">طريقة الدفع</TableHead>
                      <TableHead className="text-right">المستلم/المسلم</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          لا توجد مصروفات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ar })}</TableCell>
                          <TableCell className="font-medium">{expense.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="font-bold">{expense.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell>{expense.payment_method}</TableCell>
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">المستلم:</span> 
                                <span className="font-medium">{expense.receiver_name || 'غير محدد'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">المسلم:</span> 
                                <span className="font-medium">{expense.sender_name || 'غير محدد'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedExpenseForReceipt(expense);
                                  setShowExpenseReceiptDialog(true);
                                }}
                                title="طباعة إيصال"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setShowExpenseDialog(true);
                                }}
                                title="تعديل"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteExpense(expense.id)}
                                title="حذف"
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

          {/* Employees Tab */}
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
