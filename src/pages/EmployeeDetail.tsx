import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as UIDialog from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ArrowRight, Plus, DollarSign, Calendar, 
  FileText, CheckCircle, TrendingUp, Wallet, Edit, Trash2,
  BarChart3, PieChart, Activity, Printer, Wrench, Users
} from 'lucide-react';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface Employee {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  hire_date: string;
  base_salary: number;
  salary_type: string;
  installation_team_id?: string | null;
  linked_to_operating_expenses?: boolean;
  created_at: string;
}

interface ManualTask {
  id: string;
  employee_id: string;
  task_description: string;
  task_date: string;
  operating_cost: number;
  notes: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface PayrollItem {
  id: string;
  employee_id: string;
  payroll_id: string;
  basic_salary: number;
  allowances: number;
  overtime_amount: number;
  deductions: number;
  net_salary: number;
  paid: boolean;
  created_at: string;
}

interface Advance {
  id: string;
  employee_id: string;
  amount: number;
  remaining: number;
  reason: string | null;
  status: string;
  request_date: string;
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goToExpenses = () => navigate('/admin/expenses');
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [installationTeam, setInstallationTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { confirm: systemConfirm } = useSystemDialog();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<any>(null);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<any>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operatingCost, setOperatingCost] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [senderName, setSenderName] = useState('');
  
  // Operating expenses data
  const [operatingStats, setOperatingStats] = useState({
    totalContracts: 0,
    totalOperatingFees: 0,
    totalWithdrawals: 0,
    remainingBalance: 0,
    withdrawalsCount: 0
  });
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [editingClosure, setEditingClosure] = useState<any>(null);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);

  // Team accounts data
  const [teamAccounts, setTeamAccounts] = useState<any[]>([]);
  const [teamAccountsStats, setTeamAccountsStats] = useState({ pending: 0, paid: 0, total: 0 });

  useEffect(() => {
    if (id) {
      loadEmployeeData();
    }
  }, [id]);

  const loadOperatingExpensesData = async () => {
    try {
      // Load withdrawals
      const { data: withdrawalsData } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      setWithdrawals(withdrawalsData || []);

      // Load closures - جميع التساكير (مثل صفحة مستحقات التشغيل Expenses.tsx)
      const { data: closuresData } = await supabase
        .from('period_closures')
        .select('*')
        .order('created_at', { ascending: false });
      
      setClosures(closuresData || []);

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

      // Get operating fees from contracts with Total Rent
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Total Rent", installation_cost, print_cost, operating_fee_rate');
      
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

      // ✅ حساب النسبة المتحصلة فعلياً من سعر الإيجار فقط
      const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
        const feeRate = Number(c.operating_fee_rate) || 0;
        const rentCost = Number(c['Total Rent']) || 0;
        const installCost = Number(c.installation_cost) || 0;
        const printCost = Number(c.print_cost) || 0;
        const totalAmount = rentCost + installCost + printCost;
        const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
        const rentPaidEstimate = totalAmount > 0 ? totalPaid * (rentCost / totalAmount) : 0;
        const collectedFeeAmount = Math.round(rentPaidEstimate * (feeRate / 100));
        return sum + collectedFeeAmount;
      }, 0);

      // حساب إجمالي السحوبات
      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const contractsCount = uncoveredContracts.length;
      const remainingBalance = totalOperatingDues - totalWithdrawals;

      setOperatingStats({
        totalContracts: contractsCount,
        totalOperatingFees: totalOperatingDues,
        totalWithdrawals: totalWithdrawals,
        remainingBalance: remainingBalance,
        withdrawalsCount: (withdrawalsData || []).length
      });
    } catch (error) {
      console.error('Error loading operating expenses:', error);
    }
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      
      // Load employee
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);
      
      // Load operating expenses data if linked
      if (employeeData.linked_to_operating_expenses) {
        await loadOperatingExpensesData();
      }

      // Load installation team if exists
      if (employeeData.installation_team_id) {
        const { data: teamData } = await supabase
          .from('installation_teams')
          .select('*')
          .eq('id', employeeData.installation_team_id)
          .single();
        
        if (teamData) setInstallationTeam(teamData);

        // Load team accounts
        const { data: accountsData } = await supabase
          .from('installation_team_accounts')
          .select('*, billboard:billboards!installation_team_accounts_billboard_id_fkey(Billboard_Name, Size)')
          .eq('team_id', employeeData.installation_team_id)
          .order('installation_date', { ascending: false });
        
        const accounts = accountsData || [];
        setTeamAccounts(accounts);
        const pending = accounts.filter((a: any) => a.status === 'pending').reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
        const paid = accounts.filter((a: any) => a.status === 'paid').reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
        setTeamAccountsStats({ pending, paid, total: pending + paid });
      }

      // Load manual tasks
      const { data: tasksData } = await supabase
        .from('employee_manual_tasks')
        .select('*')
        .eq('employee_id', id)
        .order('task_date', { ascending: false });
      
      if (tasksData) setManualTasks(tasksData);

      // Load payroll items
      const { data: payrollData } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('employee_id', id)
        .order('created_at', { ascending: false });
      
      if (payrollData) setPayrollItems(payrollData);

      // Load advances
      const { data: advancesData } = await supabase
        .from('employee_advances')
        .select('*')
        .eq('employee_id', id)
        .order('request_date', { ascending: false });
      
      if (advancesData) setAdvances(advancesData);

    } catch (error) {
      console.error('خطأ في تحميل بيانات الموظف:', error);
      toast.error('فشل في تحميل بيانات الموظف');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskDescription.trim() || !operatingCost || parseFloat(operatingCost) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await supabase.from('employee_manual_tasks').insert({
        employee_id: id,
        task_description: taskDescription.trim(),
        task_date: taskDate,
        operating_cost: parseFloat(operatingCost),
        notes: taskNotes.trim() || null,
        status: 'pending'
      });

      toast.success('تم إضافة العمل اليدوي بنجاح');
      setTaskDialogOpen(false);
      setTaskDescription('');
      setTaskDate(new Date().toISOString().slice(0, 10));
      setOperatingCost('');
      setTaskNotes('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('فشل في إضافة العمل اليدوي');
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const amount = parseFloat(paymentAmount);
    
    // التحقق من عدم تجاوز الرصيد المتاح
    const isTeam = !!employee?.installation_team_id;
    const isOperating = employee?.linked_to_operating_expenses === true;
    
    let availableBalance = 0;
    if (isOperating) {
      availableBalance = operatingStats.remainingBalance;
    } else if (isTeam) {
      const pendingAdvances = advances
        .filter(a => a.status === 'approved')
        .reduce((sum, a) => sum + (a.remaining || 0), 0);
      availableBalance = teamAccountsStats.pending - pendingAdvances;
    }
    
    if ((isTeam || isOperating) && amount > availableBalance) {
      toast.error(`لا يمكن السحب أكثر من الرصيد المتاح (${Math.round(availableBalance).toLocaleString('ar-LY')} د.ل)`);
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (isOperating) {
        // سحب من مستحقات التشغيل
        const { error } = await supabase
          .from('expenses_withdrawals')
          .insert({
            amount,
            date: paymentDate,
            method: paymentMethod || null,
            note: paymentNotes || null,
            notes: paymentNotes || null,
            receiver_name: receiverName || employee?.name || null,
            sender_name: senderName || null,
            user_id: userData?.user?.id || null
          });
        if (error) throw error;
      } else if (isTeam) {
        // سحب من مستحقات فرقة التركيب - تسجيل كسلفة/سحب
        const { error } = await supabase
          .from('employee_advances')
          .insert({
            employee_id: id,
            amount,
            remaining: 0, // مدفوعة بالكامل (سحب وليس سلفة)
            reason: `سحب من مستحقات الفرقة${paymentNotes ? ' - ' + paymentNotes : ''}`,
            status: 'approved',
            request_date: paymentDate
          });
        if (error) throw error;

        // تحديث حالة حسابات الفرقة المعلقة إلى مدفوع بمقدار المبلغ المسحوب
        let remainingToMark = amount;
        const pendingAccounts = teamAccounts
          .filter((a: any) => a.status === 'pending')
          .sort((a: any, b: any) => new Date(a.installation_date).getTime() - new Date(b.installation_date).getTime());
        
        for (const account of pendingAccounts) {
          if (remainingToMark <= 0) break;
          const accountAmount = Number(account.amount) || 0;
          if (accountAmount <= remainingToMark) {
            await supabase
              .from('installation_team_accounts')
              .update({ status: 'paid' })
              .eq('id', account.id);
            remainingToMark -= accountAmount;
          } else {
            break;
          }
        }
      }

      toast.success('تم تسجيل السحب بنجاح');
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('');
      setPaymentNotes('');
      setReceiverName('');
      setSenderName('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error adding withdrawal:', error);
      toast.error('فشل في تسجيل السحب');
    }
  };

  const handleEditWithdrawal = async () => {
    if (!editingWithdrawal || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .update({
          amount: parseFloat(paymentAmount),
          date: paymentDate,
          method: paymentMethod || null,
          note: paymentNotes || null,
          receiver_name: receiverName || null,
          sender_name: senderName || null
        })
        .eq('id', editingWithdrawal.id);

      if (error) throw error;

      toast.success('تم تعديل السحب بنجاح');
      setWithdrawalDialogOpen(false);
      setEditingWithdrawal(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('');
      setPaymentNotes('');
      setReceiverName('');
      setSenderName('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error editing withdrawal:', error);
      toast.error('فشل في تعديل السحب');
    }
  };

  const handleMarkTaskComplete = async (taskId: string) => {
    try {
      await supabase
        .from('employee_manual_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      toast.success('تم تسجيل العمل كمكتمل');
      loadEmployeeData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('فشل في تحديث حالة العمل');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا العمل؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      await supabase
        .from('employee_manual_tasks')
        .delete()
        .eq('id', taskId);

      toast.success('تم حذف العمل بنجاح');
      loadEmployeeData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('فشل في حذف العمل');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">الموظف غير موجود</p>
          <Button onClick={() => navigate('/admin/salaries')} className="mt-4">
            العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  // Calculate statistics - للموظف المرتبط بمستحقات التشغيل استخدم القيم مباشرة
  const isLinkedToOperating = employee.linked_to_operating_expenses === true;
  const isLinkedToTeam = !!employee.installation_team_id;

  // إجمالي المستحقات
  const totalDue = isLinkedToOperating 
    ? operatingStats.totalOperatingFees
    : isLinkedToTeam
      ? teamAccountsStats.total
      : employee.salary_type === 'monthly' 
        ? employee.base_salary 
        : manualTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.operating_cost || 0), 0);

  // المدفوع - للفرقة: المبالغ المدفوعة من حساب الفرقة + السلف
  const totalPaid = isLinkedToOperating
    ? operatingStats.totalWithdrawals
    : isLinkedToTeam
      ? teamAccountsStats.paid + advances.filter(a => a.status === 'approved').reduce((sum, a) => sum + ((a.amount || 0) - (a.remaining || 0)), 0)
      : payrollItems.filter(p => p.paid).reduce((sum, p) => sum + (p.net_salary || 0), 0);

  // السلف
  const totalAdvances = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (a.remaining || 0), 0);

  // الرصيد الصافي
  const netBalance = isLinkedToOperating 
    ? operatingStats.remainingBalance 
    : isLinkedToTeam
      ? teamAccountsStats.pending - totalAdvances
      : totalDue - totalPaid - totalAdvances;

  // Prepare chart data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const month = date.toLocaleString('ar-LY', { month: 'short' });
    
    const tasksInMonth = manualTasks.filter(t => {
      const taskMonth = new Date(t.task_date).getMonth();
      const taskYear = new Date(t.task_date).getFullYear();
      return taskMonth === date.getMonth() && taskYear === date.getFullYear() && t.status === 'completed';
    });
    
    const paymentsInMonth = payrollItems.filter(p => {
      const payMonth = new Date(p.created_at).getMonth();
      const payYear = new Date(p.created_at).getFullYear();
      return payMonth === date.getMonth() && payYear === date.getFullYear() && p.paid;
    });

    return {
      month,
      earned: tasksInMonth.reduce((sum, t) => sum + t.operating_cost, 0),
      paid: paymentsInMonth.reduce((sum, p) => sum + p.net_salary, 0)
    };
  });

  const statusData = [
    { name: 'مكتمل', value: manualTasks.filter(t => t.status === 'completed').length, color: '#10b981' },
    { name: 'معلق', value: manualTasks.filter(t => t.status === 'pending').length, color: '#f59e0b' }
  ];

  const COLORS = ['#10b981', '#f59e0b'];

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/salaries')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{employee.name}</h1>
            <p className="text-muted-foreground mt-1">
              {employee.position || 'موظف'} • {employee.status === 'active' ? 'نشط' : 'غير نشط'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTaskDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة عمل يدوي
          </Button>
          {(isLinkedToOperating || isLinkedToTeam) && (
            <Button onClick={() => {
              setPaymentAmount('');
              setPaymentDate(new Date().toISOString().slice(0, 10));
              setPaymentMethod('');
              setPaymentNotes('');
              setReceiverName(employee.name);
              setSenderName('');
              setPaymentDialogOpen(true);
            }} variant="secondary" className="gap-2">
              <Wallet className="h-4 w-4" />
              سحب من الحساب
            </Button>
          )}
          <Button onClick={() => {
            setEditingAdvance(null);
            setAdvanceAmount('');
            setAdvanceReason('');
            setAdvanceDialogOpen(true);
          }} variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" />
            إضافة سلفة
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">نوع الراتب</p>
                <Badge variant={employee.salary_type === 'monthly' ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                  {employee.salary_type === 'monthly' ? 'راتب شهري' : 'بالعمل'}
                </Badge>
              </div>
              
              {employee.installation_team_id && installationTeam && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">فرقة التركيب</p>
                  <Badge variant="outline" className="text-lg px-4 py-1">
                    {installationTeam.team_name}
                  </Badge>
                </div>
              )}

              {employee.linked_to_operating_expenses && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">مستحقات التشغيل</p>
                  <Badge className="text-lg px-4 py-1 bg-orange-600">
                    مرتبط
                  </Badge>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">تاريخ التعيين</p>
                <p className="text-lg font-medium">
                  {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ar-LY') : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستحقات</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalDue.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLinkedToOperating 
                ? `من ${operatingStats.totalContracts} عقد`
                : isLinkedToTeam
                  ? `من ${teamAccounts.length} تركيبة`
                  : employee.salary_type === 'monthly' ? 'الراتب الشهري' : 'من الأعمال المكتملة'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المدفوع</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalPaid.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLinkedToOperating 
                ? `من ${operatingStats.withdrawalsCount} مسحوبة`
                : isLinkedToTeam
                  ? `${teamAccounts.filter((a: any) => a.status === 'paid').length} مدفوعة`
                  : `من ${payrollItems.filter(p => p.paid).length} دفعة`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">السلف المستحقة</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalAdvances.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {advances.filter(a => a.status === 'approved' && a.remaining > 0).length} سلفة نشطة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الرصيد الصافي</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {netBalance.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netBalance >= 0 ? 'مستحق للموظف' : 'دين على الموظف'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operating Expenses Section - Show only if linked */}
      {employee.linked_to_operating_expenses && (
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <Wallet className="h-5 w-5" />
              إدارة مستحقات التشغيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
                هذا الموظف مرتبط بحساب مصروفات التشغيل. يمكنك إدارة جميع العقود والسحوبات وإغلاقات الفترة من الصفحة المخصصة.
              </p>
              
              {/* Operating Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">إجمالي العقود</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {operatingStats.totalContracts}
                  </p>
                </div>
                
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">المجموع العام</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {operatingStats.totalOperatingFees.toLocaleString('ar-LY')} د.ل
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">نسبة على العمل</p>
                </div>
                
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">المسحوب</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {operatingStats.totalWithdrawals.toLocaleString('ar-LY')} د.ل
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    {operatingStats.withdrawalsCount} مسحوبة
                  </p>
                </div>
                
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">الرصيد المتبقي</p>
                  <p className={`text-2xl font-bold ${operatingStats.remainingBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {operatingStats.remainingBalance.toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </div>
              
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">إدارة العقود</p>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">عرض وتحليل النسب والرسوم</p>
                </div>
                
                <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">السحوبات</p>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">تسجيل وإدارة المصروفات</p>
                </div>
                
                <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">إغلاق الفترة</p>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">تسكير الحساب دورياً</p>
                  {closures.length > 0 && closures[0].closure_type === 'contract_range' && (
                    <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/50 rounded text-xs">
                      <p className="font-semibold text-orange-900 dark:text-orange-100">آخر تسكير:</p>
                      <p className="text-orange-700 dark:text-orange-300">
                        عقود {closures[0].contract_start} - {closures[0].contract_end}
                      </p>
                      <p className="text-orange-600 dark:text-orange-400">
                        {new Date(closures[0].closure_date).toLocaleDateString('ar-LY')}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">التقارير</p>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">طباعة الكشوفات المالية</p>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/admin/expenses')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg"
                size="lg"
              >
                <Wallet className="h-5 w-5" />
                فتح صفحة مصروفات التشغيل الكاملة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Installations & Accounts Section */}
      {employee.installation_team_id && installationTeam && (
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Wrench className="h-5 w-5" />
              حسابات فرقة التركيب - {installationTeam.team_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Team Account Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">إجمالي التركيبات</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {teamAccountsStats.total.toLocaleString('ar-LY')} د.ل
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{teamAccounts.length} تركيب</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-1">معلق الدفع</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {teamAccountsStats.pending.toLocaleString('ar-LY')} د.ل
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {teamAccounts.filter(a => a.status === 'pending').length} تركيب معلق
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">المدفوع</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {teamAccountsStats.paid.toLocaleString('ar-LY')} د.ل
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    {teamAccounts.filter(a => a.status === 'paid').length} تركيب مدفوع
                  </p>
                </div>
              </div>

              {/* Combined Report: Earnings vs Withdrawals */}
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  التقرير المالي المشترك
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">إيرادات الفرقة</p>
                    <p className="text-lg font-bold text-blue-600">{teamAccountsStats.total.toLocaleString('ar-LY')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">السحوبات + السلف</p>
                    <p className="text-lg font-bold text-red-600">{(totalPaid + totalAdvances).toLocaleString('ar-LY')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">الصافي</p>
                    <p className={`text-lg font-bold ${(teamAccountsStats.pending - totalAdvances) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(teamAccountsStats.pending - totalAdvances).toLocaleString('ar-LY')}
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => navigate('/admin/installation-team-accounts')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg"
                size="lg"
              >
                <Wrench className="h-5 w-5" />
                فتح صفحة حسابات فرق التركيب
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              الأرباح والمدفوعات (آخر 6 أشهر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="earned" name="المكتسب" fill="hsl(var(--primary))" />
                <Bar dataKey="paid" name="المدفوع" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              حالة الأعمال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={employee.installation_team_id ? "team_accounts" : "tasks"} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="tasks">الأعمال اليدوية</TabsTrigger>
          <TabsTrigger value="advances">السلف</TabsTrigger>
          <TabsTrigger value="payments">سجل المدفوعات</TabsTrigger>
          {isLinkedToOperating && (
            <>
              <TabsTrigger value="withdrawals">سحوبات التشغيل</TabsTrigger>
              <TabsTrigger value="closures">التسكيرات</TabsTrigger>
            </>
          )}
          {employee.installation_team_id && (
            <TabsTrigger value="team_accounts">حسابات الفرقة</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                الأعمال اليدوية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">التكلفة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        لا توجد أعمال يدوية مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    manualTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          {task.task_description}
                          {task.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>
                          )}
                        </TableCell>
                        <TableCell>{new Date(task.task_date).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell className="font-medium">
                          {task.operating_cost.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell>
                          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                            {task.status === 'completed' ? 'مكتمل' : 'معلق'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {task.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkTaskComplete(task.id)}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTask(task.id)}
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

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                سجل السحوبات
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  {withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        لا توجد مسحوبات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>{new Date(withdrawal.date).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell className="font-bold">{withdrawal.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{withdrawal.method || '—'}</TableCell>
                        <TableCell>{withdrawal.note || '—'}</TableCell>
                        <TableCell>
                          {withdrawal.receiver_name && withdrawal.sender_name
                            ? `${withdrawal.receiver_name} / ${withdrawal.sender_name}`
                            : withdrawal.receiver_name || withdrawal.sender_name || '—'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingWithdrawal(withdrawal);
                                setPaymentAmount(withdrawal.amount.toString());
                                setPaymentDate(withdrawal.date);
                                setPaymentMethod(withdrawal.method || '');
                                setPaymentNotes(withdrawal.note || '');
                                setReceiverName(withdrawal.receiver_name || '');
                                setSenderName(withdrawal.sender_name || '');
                                setWithdrawalDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setReceiptDialogOpen(true);
                              }}
                            >
                              <Printer className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا السحب؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                try {
                                  await supabase
                                    .from('expenses_withdrawals')
                                    .delete()
                                    .eq('id', withdrawal.id);
                                  toast.success('تم حذف السحب بنجاح');
                                  loadEmployeeData();
                                } catch (error) {
                                  toast.error('فشل في حذف السحب');
                                }
                              }}
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

        <TabsContent value="closures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                سجل التسكيرات
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  {closures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        لا توجد تسكيرات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    closures.map((closure) => (
                      <TableRow key={closure.id}>
                        <TableCell>{new Date(closure.closure_date).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell>
                          <Badge variant={closure.closure_type === 'period' ? 'default' : 'secondary'}>
                            {closure.closure_type === 'period' ? 'فترة زمنية' : 'نطاق عقود'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {closure.closure_type === 'period' && closure.period_start && closure.period_end ? 
                            `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}` :
                            closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ?
                            `${closure.contract_start} - ${closure.contract_end}` :
                            '—'
                          }
                        </TableCell>
                        <TableCell>{closure.total_contracts}</TableCell>
                        <TableCell>{closure.total_amount.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{closure.total_withdrawn.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{closure.remaining_balance.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{closure.notes || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingClosure(closure);
                                setClosureDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا التسكير؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                try {
                                  await supabase
                                    .from('period_closures')
                                    .delete()
                                    .eq('id', closure.id);
                                  toast.success('تم حذف التسكير بنجاح');
                                  loadEmployeeData();
                                } catch (error) {
                                  toast.error('فشل في حذف التسكير');
                                }
                              }}
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

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                سجل المدفوعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الراتب الأساسي</TableHead>
                    <TableHead className="text-right">البدلات</TableHead>
                    <TableHead className="text-right">الخصومات</TableHead>
                    <TableHead className="text-right">صافي الراتب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        لا توجد مدفوعات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.created_at).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell>{item.basic_salary.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{item.allowances.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{item.deductions.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="font-bold">{item.net_salary.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>
                          <Badge variant={item.paid ? 'default' : 'secondary'}>
                            {item.paid ? 'مدفوع' : 'معلق'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                السلف
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                إجمالي السلف المتبقية: <span className="font-bold text-red-600">{totalAdvances.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        لا توجد سلف مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    advances.map((advance: any) => (
                      <TableRow key={advance.id}>
                        <TableCell>{new Date(advance.request_date).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell>{advance.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className={advance.remaining > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {advance.remaining.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell>{advance.reason || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={advance.status === 'approved' ? 'default' : 'secondary'}>
                            {advance.status === 'approved' ? 'معتمد' : advance.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {advance.distributed_payment_id ? (
                            <Badge variant="outline" className="text-xs">دفعة موزعة</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">يدوي</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingAdvance(advance);
                                setAdvanceAmount(advance.amount.toString());
                                setAdvanceReason(advance.reason || '');
                                setAdvanceDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه السلفة؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                try {
                                  await supabase
                                    .from('employee_advances')
                                    .delete()
                                    .eq('id', advance.id);
                                  toast.success('تم حذف السلفة بنجاح');
                                  loadEmployeeData();
                                } catch (error) {
                                  toast.error('فشل في حذف السلفة');
                                }
                              }}
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

        {/* Team Accounts Tab */}
        {employee.installation_team_id && (
          <TabsContent value="team_accounts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  تركيبات الفرقة ({teamAccounts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اللوحة</TableHead>
                      <TableHead className="text-right">المقاس</TableHead>
                      <TableHead className="text-right">العقد</TableHead>
                      <TableHead className="text-right">تاريخ التركيب</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا توجد تركيبات مسجلة للفرقة
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamAccounts.map((account: any) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">
                            {account.billboard?.Billboard_Name || `لوحة #${account.billboard_id}`}
                          </TableCell>
                          <TableCell>{account.billboard?.Size || '-'}</TableCell>
                          <TableCell className="font-mono">#{account.contract_id}</TableCell>
                          <TableCell>
                            {account.installation_date
                              ? new Date(account.installation_date).toLocaleDateString('ar-LY')
                              : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {(Number(account.amount) || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.status === 'paid' ? 'default' : 'secondary'}>
                              {account.status === 'paid' ? 'مدفوع' : 'معلق'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add Task Dialog */}
      <UIDialog.Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة عمل يدوي</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">وصف العمل *</label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="أدخل وصف العمل"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">التاريخ *</label>
                <Input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">تكلفة التشغيل *</label>
                <Input
                  type="number"
                  value={operatingCost}
                  onChange={(e) => setOperatingCost(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="أدخل ملاحظات إضافية (اختياري)"
                rows={2}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddTask}>
              إضافة العمل
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Payment Dialog */}
      <UIDialog.Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              {employee?.installation_team_id ? 'سحب من مستحقات الفرقة' : employee?.linked_to_operating_expenses ? 'تسجيل سحب جديد' : 'دفع للموظف'}
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            {/* عرض الرصيد المتاح */}
            {(employee?.linked_to_operating_expenses || employee?.installation_team_id) && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">الرصيد المتاح للسحب:</span>
                  <span className={`font-bold text-lg ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.round(netBalance).toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                max={netBalance > 0 ? netBalance : undefined}
              />
              {paymentAmount && parseFloat(paymentAmount) > netBalance && netBalance > 0 && (
                <p className="text-xs text-destructive">المبلغ يتجاوز الرصيد المتاح</p>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {(employee?.linked_to_operating_expenses || employee?.installation_team_id) && (
              <>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">طريقة السحب</label>
                  <Input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="نقدي، تحويل بنكي، شيك..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">اسم المستلم</label>
                    <Input
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="اسم المستلم"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">اسم المسلم</label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="اسم المسلم"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handlePayment}>
              حفظ السحب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Receipt Print Dialog */}
      {selectedWithdrawal && (
        <ExpenseReceiptPrintDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          expense={{
            ...selectedWithdrawal,
            description: 'سحب من مستحقات نسبة العقود',
            expense_date: selectedWithdrawal.date,
            category: 'مستحقات نسبة العقود',
            payment_method: selectedWithdrawal.method || '',
            notes: selectedWithdrawal.note || '',
            receipt_number: `W-${selectedWithdrawal.id.toString().substring(0, 8)}`
          }}
        />
      )}

      {/* Edit Withdrawal Dialog */}
      <UIDialog.Dialog open={withdrawalDialogOpen} onOpenChange={(open) => {
        setWithdrawalDialogOpen(open);
        if (!open) {
          setEditingWithdrawal(null);
          setPaymentAmount('');
          setPaymentDate(new Date().toISOString().slice(0, 10));
          setPaymentMethod('');
          setPaymentNotes('');
          setReceiverName('');
          setSenderName('');
        }
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل السحب</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">طريقة السحب</label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="نقدي، تحويل بنكي، شيك..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">اسم المستلم</label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="اسم المستلم"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">اسم المسلم</label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="اسم المسلم"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setWithdrawalDialogOpen(false);
              setEditingWithdrawal(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={handleEditWithdrawal}>
              حفظ التعديلات
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Add/Edit Advance Dialog */}
      <UIDialog.Dialog open={advanceDialogOpen} onOpenChange={(open) => {
        setAdvanceDialogOpen(open);
        if (!open) {
          setEditingAdvance(null);
          setAdvanceAmount('');
          setAdvanceReason('');
        }
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>{editingAdvance ? 'تعديل السلفة' : 'إضافة سلفة جديدة'}</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">السبب</label>
              <Textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="سبب السلفة"
                rows={2}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setAdvanceDialogOpen(false);
              setEditingAdvance(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={async () => {
              if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
                toast.error('يرجى إدخال مبلغ صحيح');
                return;
              }
              try {
                const newAmount = parseFloat(advanceAmount);
                if (editingAdvance) {
                  const diff = newAmount - editingAdvance.amount;
                  const newRemaining = Math.max(0, editingAdvance.remaining + diff);
                  await supabase
                    .from('employee_advances')
                    .update({
                      amount: newAmount,
                      remaining: newRemaining,
                      reason: advanceReason || null
                    })
                    .eq('id', editingAdvance.id);
                  toast.success('تم تعديل السلفة بنجاح');
                } else {
                  await supabase
                    .from('employee_advances')
                    .insert({
                      employee_id: id,
                      amount: newAmount,
                      remaining: newAmount,
                      reason: advanceReason || null,
                      status: 'approved',
                      request_date: new Date().toISOString().slice(0, 10)
                    });
                  toast.success('تم إضافة السلفة بنجاح');
                }
                setAdvanceDialogOpen(false);
                setEditingAdvance(null);
                setAdvanceAmount('');
                setAdvanceReason('');
                loadEmployeeData();
              } catch (error) {
                toast.error('فشل في حفظ السلفة');
              }
            }}>
              {editingAdvance ? 'حفظ التعديلات' : 'إضافة السلفة'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Edit Closure Dialog */}
      <UIDialog.Dialog open={closureDialogOpen} onOpenChange={(open) => {
        setClosureDialogOpen(open);
        if (!open) setEditingClosure(null);
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل التسكير</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          {editingClosure && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">تاريخ التسكير</label>
                <Input
                  type="date"
                  value={editingClosure.closure_date}
                  onChange={(e) => setEditingClosure({ ...editingClosure, closure_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">نوع التسكير</label>
                <Badge variant="secondary">
                  {editingClosure.closure_type === 'contract_range' ? 'نطاق عقود' : 'فترة زمنية'}
                </Badge>
              </div>

              {editingClosure.closure_type === 'contract_range' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">من عقد رقم</label>
                    <Input
                      type="number"
                      value={editingClosure.contract_start || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, contract_start: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">إلى عقد رقم</label>
                    <Input
                      type="number"
                      value={editingClosure.contract_end || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, contract_end: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              {editingClosure.closure_type === 'period' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">من تاريخ</label>
                    <Input
                      type="date"
                      value={editingClosure.period_start || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, period_start: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">إلى تاريخ</label>
                    <Input
                      type="date"
                      value={editingClosure.period_end || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, period_end: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <Textarea
                  value={editingClosure.notes || ''}
                  onChange={(e) => setEditingClosure({ ...editingClosure, notes: e.target.value })}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                />
              </div>
            </div>
          )}

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setClosureDialogOpen(false);
              setEditingClosure(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={async () => {
              if (!editingClosure) return;
              try {
                const { error } = await supabase
                  .from('period_closures')
                  .update({
                    closure_date: editingClosure.closure_date,
                    contract_start: editingClosure.contract_start,
                    contract_end: editingClosure.contract_end,
                    period_start: editingClosure.period_start,
                    period_end: editingClosure.period_end,
                    notes: editingClosure.notes
                  })
                  .eq('id', editingClosure.id);
                
                if (error) throw error;
                toast.success('تم تعديل التسكير بنجاح');
                setClosureDialogOpen(false);
                setEditingClosure(null);
                loadEmployeeData();
              } catch (error) {
                toast.error('فشل في تعديل التسكير');
              }
            }}>
              حفظ التعديلات
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
