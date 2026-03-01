import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as UIDialog from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wallet, Plus, Edit, Trash2, DollarSign, Calendar, User, FileText, CheckCircle, XCircle, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  employee?: Employee;
}

interface InstallationTeam {
  id: string;
  team_name: string;
}

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
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
  employee?: Employee;
}

// Helper: format date as dd/MM/yyyy Gregorian
function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch { return d; }
}

export default function Salaries() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [installationTeams, setInstallationTeams] = useState<InstallationTeam[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Operating expenses data for linked employee
  const [operatingExpenses, setOperatingExpenses] = useState<any[]>([]);
  const [operatingWithdrawals, setOperatingWithdrawals] = useState<any[]>([]);
  const [operatingStats, setOperatingStats] = useState({
    totalExpenses: 0,
    totalWithdrawals: 0,
    totalRevenue: 0,
    remainingBalance: 0
  });
  // Installation team earnings per team_id
  const [teamEarnings, setTeamEarnings] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('active');
  const [salaryType, setSalaryType] = useState('monthly');
  const [installationTeamId, setInstallationTeamId] = useState<string>('none');
  const [linkedToOperatingExpenses, setLinkedToOperatingExpenses] = useState(false);
  
  // Manual task states
  const [selectedEmployeeForTask, setSelectedEmployeeForTask] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operatingCost, setOperatingCost] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  
  // Payroll states
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    return date.toISOString().slice(0, 10);
  });

  // Advance states
  const [selectedEmployeeForAdvance, setSelectedEmployeeForAdvance] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadOperatingExpensesData = async () => {
    try {
      // Load withdrawals
      const { data: withdrawalsData, error: wError } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      if (!wError && withdrawalsData) {
        setOperatingWithdrawals(withdrawalsData);
      }

      // Calculate total withdrawals
      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      // Load closures
      const { data: closuresData } = await supabase
        .from('period_closures')
        .select('*')
        .order('closure_date', { ascending: false });

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

      // Get contracts with operating fee
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
      const totalOperatingFees = uncoveredContracts.reduce((sum, c) => {
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

      const contractsCount = uncoveredContracts.length;

      // Calculate remaining balance
      const remainingBalance = totalOperatingFees - totalWithdrawals;

      setOperatingStats({
        totalExpenses: 0,
        totalWithdrawals,
        totalRevenue: totalOperatingFees,
        remainingBalance
      });
      
      // Store contracts count for display
      setOperatingExpenses([{ count: contractsCount }] as any);
    } catch (error) {
      console.error('Error loading operating expenses data:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (employeesError) {
        console.error('خطأ في تحميل الموظفين:', employeesError);
        toast.error('فشل في تحميل الموظفين');
      } else {
        setEmployees(employeesData || []);
      }
      
      // Load operating expenses data
      await loadOperatingExpensesData();

      // Load installation teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (!teamsError && teamsData) {
        setInstallationTeams(teamsData);
      }

      // Load installation team account totals
      const { data: teamAccountsData } = await supabase
        .from('installation_team_accounts')
        .select('team_id, amount');
      
      if (teamAccountsData) {
        const earningsMap: Record<string, number> = {};
        teamAccountsData.forEach((row: any) => {
          const tid = row.team_id;
          earningsMap[tid] = (earningsMap[tid] || 0) + (Number(row.amount) || 0);
        });
        setTeamEarnings(earningsMap);
      }

      // Load payroll runs
      const { data: payrollData, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!payrollError && payrollData) {
        setPayrollRuns(payrollData);
      }

      // Load recent payroll items with employee info
      const { data: itemsData, error: itemsError } = await supabase
        .from('payroll_items')
        .select(`
          *,
          employee:employees(name, position)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!itemsError && itemsData) {
        setPayrollItems(itemsData as any);
      }

      // Load advances
      const { data: advancesData, error: advancesError } = await supabase
        .from('employee_advances')
        .select(`
          *,
          employee:employees(name)
        `)
        .order('request_date', { ascending: false })
        .limit(20);

      if (!advancesError && advancesData) {
        setAdvances(advancesData);
      }

      // Load manual tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('employee_manual_tasks')
        .select(`
          *,
          employee:employees(name)
        `)
        .order('task_date', { ascending: false })
        .limit(50);

      if (!tasksError && tasksData) {
        setManualTasks(tasksData as any);
      }

    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPosition('');
    setEmail('');
    setPhone('');
    setBaseSalary('');
    setHireDate(new Date().toISOString().slice(0, 10));
    setStatus('active');
    setSalaryType('monthly');
    setInstallationTeamId('none');
    setLinkedToOperatingExpenses(false);
    setEditingEmployee(null);
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setName(employee.name);
      setPosition(employee.position || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setBaseSalary(employee.base_salary?.toString() || '0');
      setHireDate(employee.hire_date || new Date().toISOString().slice(0, 10));
      setStatus(employee.status || 'active');
      setSalaryType(employee.salary_type || 'monthly');
      setInstallationTeamId(employee.installation_team_id || 'none');
      setLinkedToOperatingExpenses(employee.linked_to_operating_expenses || false);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم الموظف');
      return;
    }

    // التحقق من الراتب فقط للموظفين بنظام الراتب الشهري
    if (salaryType === 'monthly' && (!baseSalary || parseFloat(baseSalary) <= 0)) {
      toast.error('يرجى إدخال راتب صحيح');
      return;
    }

    try {
      // Check if installation team is already assigned to another employee
      if (installationTeamId && installationTeamId !== 'none') {
        let teamQuery = supabase
          .from('employees')
          .select('id, name')
          .eq('installation_team_id', installationTeamId);

        if (editingEmployee) {
          teamQuery = teamQuery.neq('id', editingEmployee.id);
        }

        const { data: existingEmployee } = await teamQuery.maybeSingle();

        if (existingEmployee) {
          toast.error(`هذه الفرقة مرتبطة بالفعل بالموظف: ${existingEmployee.name}`);
          return;
        }
      }

      // Check if operating expenses is already linked to another employee
      if (linkedToOperatingExpenses) {
        let expensesQuery = supabase
          .from('employees')
          .select('id, name')
          .eq('linked_to_operating_expenses', true);

        if (editingEmployee) {
          expensesQuery = expensesQuery.neq('id', editingEmployee.id);
        }

        const { data: existingExpenseEmployee } = await expensesQuery.maybeSingle();

        if (existingExpenseEmployee) {
          toast.error(`مستحقات التشغيل مرتبطة بالفعل بالموظف: ${existingExpenseEmployee.name}`);
          return;
        }
      }

      const employeeData = {
        name: name.trim(),
        position: position.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        base_salary: salaryType === 'monthly' ? parseFloat(baseSalary) : 0,
        salary_type: salaryType,
        hire_date: hireDate,
        status: status,
        installation_team_id: (installationTeamId && installationTeamId !== 'none') ? installationTeamId : null,
        linked_to_operating_expenses: linkedToOperatingExpenses,
        updated_at: new Date().toISOString(),
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) {
          console.error('خطأ في تحديث الموظف:', error);
          if (error.code === '23505') {
            toast.error('هذه الفرقة مرتبطة بموظف آخر');
          } else {
            toast.error('فشل في تحديث الموظف');
          }
        } else {
          toast.success('تم تحديث الموظف بنجاح');
          handleCloseDialog();
          await loadData();
          await loadOperatingExpensesData();
        }
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);

        if (error) {
          console.error('خطأ في إضافة الموظف:', error);
          if (error.code === '23505') {
            toast.error('هذه الفرقة مرتبطة بموظف آخر');
          } else {
            toast.error('فشل في إضافة الموظف');
          }
        } else {
          toast.success('تم إضافة الموظف بنجاح');
          handleCloseDialog();
          await loadData();
          await loadOperatingExpensesData();
        }
      }
    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('خطأ في حذف الموظف:', error);
        toast.error('فشل في حذف الموظف');
      } else {
        toast.success('تم حذف الموظف بنجاح');
        loadData();
      }
    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    }
  };

  const totalSalaries = employees
    .filter(e => e.status === 'active')
    .reduce((sum, e) => sum + (e.base_salary || 0), 0);

  const activeEmployees = employees.filter(e => e.status === 'active').length;

  const totalPaidPayroll = payrollItems
    .filter(item => item.paid)
    .reduce((sum, item) => sum + (item.net_salary || 0), 0);

  const totalAdvances = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (a.remaining || 0), 0);

  const handleCreatePayroll = async () => {
    try {
      // Create payroll run
      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          period_start: periodStart,
          period_end: periodEnd,
          status: 'draft'
        })
        .select()
        .single();

      if (runError) throw runError;

      // Create payroll items for all active employees
      const activeEmployees = employees.filter(e => e.status === 'active');
      
      for (const employee of activeEmployees) {
        // Calculate deductions (advances for this period)
        const { data: employeeAdvances } = await supabase
          .from('employee_advances')
          .select('remaining')
          .eq('employee_id', employee.id)
          .eq('status', 'approved');

        const totalDeductions = employeeAdvances?.reduce((sum, a) => sum + a.remaining, 0) || 0;

        await supabase.from('payroll_items').insert({
          payroll_id: payrollRun.id,
          employee_id: employee.id,
          basic_salary: employee.base_salary,
          allowances: 0,
          overtime_amount: 0,
          deductions: totalDeductions,
          net_salary: employee.base_salary - totalDeductions,
          paid: false
        });
      }

      toast.success('تم إنشاء دورة الرواتب بنجاح');
      setPayrollDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating payroll:', error);
      toast.error('فشل في إنشاء دورة الرواتب');
    }
  };

  const handleMarkPayrollPaid = async (payrollId: string) => {
    try {
      await supabase
        .from('payroll_runs')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payrollId);

      await supabase
        .from('payroll_items')
        .update({ paid: true })
        .eq('payroll_id', payrollId);

      toast.success('تم تسجيل الرواتب كمدفوعة');
      loadData();
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      toast.error('فشل في تحديث حالة الرواتب');
    }
  };

  const handleAddAdvance = async () => {
    if (!selectedEmployeeForAdvance || !advanceAmount || parseFloat(advanceAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول بشكل صحيح');
      return;
    }

    try {
      await supabase.from('employee_advances').insert({
        employee_id: selectedEmployeeForAdvance,
        amount: parseFloat(advanceAmount),
        remaining: parseFloat(advanceAmount),
        reason: advanceReason.trim() || null,
        status: 'approved'
      });

      toast.success('تم إضافة السلفة بنجاح');
      setAdvanceDialogOpen(false);
      setSelectedEmployeeForAdvance('');
      setAdvanceAmount('');
      setAdvanceReason('');
      loadData();
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error('فشل في إضافة السلفة');
    }
  };

  const handleAddManualTask = async () => {
    if (!selectedEmployeeForTask || !taskDescription.trim() || !operatingCost || parseFloat(operatingCost) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await supabase.from('employee_manual_tasks').insert({
        employee_id: selectedEmployeeForTask,
        task_description: taskDescription.trim(),
        task_date: taskDate,
        operating_cost: parseFloat(operatingCost),
        notes: taskNotes.trim() || null,
        status: 'pending'
      });

      toast.success('تم إضافة العمل اليدوي بنجاح');
      setTaskDialogOpen(false);
      setSelectedEmployeeForTask('');
      setTaskDescription('');
      setTaskDate(new Date().toISOString().slice(0, 10));
      setOperatingCost('');
      setTaskNotes('');
      loadData();
    } catch (error) {
      console.error('Error adding manual task:', error);
      toast.error('فشل في إضافة العمل اليدوي');
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
      loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('فشل في تحديث حالة العمل');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العمل؟')) return;

    try {
      await supabase
        .from('employee_manual_tasks')
        .delete()
        .eq('id', taskId);

      toast.success('تم حذف العمل بنجاح');
      loadData();
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

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة الرواتب والموظفين</h1>
          <p className="text-muted-foreground mt-1">متابعة وإدارة الموظفين والرواتب</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة موظف
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرواتب الشهرية</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalSalaries.toLocaleString('ar-LY')} د.ل
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الموظفين النشطين</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeEmployees}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المدفوع</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalPaidPayroll.toLocaleString('ar-LY')} د.ل
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">دورات الرواتب</CardTitle>
            <FileText className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {payrollRuns.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">الموظفين</TabsTrigger>
          <TabsTrigger value="manual-tasks">الأعمال اليدوية</TabsTrigger>
          <TabsTrigger value="payroll">دورات الرواتب</TabsTrigger>
          <TabsTrigger value="payments">سجل المدفوعات</TabsTrigger>
          <TabsTrigger value="advances">السلف والخصومات</TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                قائمة الموظفين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الوظيفة</TableHead>
                    <TableHead className="text-right">نوع الراتب</TableHead>
                    <TableHead className="text-right">فرقة التركيب</TableHead>
                    <TableHead className="text-right">مستحقات التشغيل</TableHead>
                    <TableHead className="text-right">الراتب / المستحقات</TableHead>
                    <TableHead className="text-right">تاريخ التعيين</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        لا يوجد موظفين مسجلين
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => {
                      const team = installationTeams.find(t => t.id === employee.installation_team_id);
                      return (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.position || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={employee.salary_type === 'monthly' ? 'default' : 'secondary'}>
                              {employee.salary_type === 'monthly' ? 'راتب شهري' : employee.salary_type === 'hourly' ? 'بالعمل' : employee.salary_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {team ? (
                              <Badge variant="outline">{team.team_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {employee.linked_to_operating_expenses ? (
                              <Badge variant="default" className="bg-orange-600">مرتبط</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {employee.salary_type === 'monthly' 
                              ? `${(employee.base_salary || 0).toLocaleString('ar-LY')} د.ل`
                              : employee.installation_team_id && teamEarnings[employee.installation_team_id] != null
                                ? <span className="font-medium text-blue-600 dark:text-blue-400">{Math.round(teamEarnings[employee.installation_team_id]).toLocaleString('ar-LY')} د.ل</span>
                                : employee.linked_to_operating_expenses
                                  ? <span className="font-medium text-orange-600 dark:text-orange-400">{Math.round(operatingStats.totalRevenue).toLocaleString('ar-LY')} د.ل</span>
                                  : <span className="text-muted-foreground text-sm">بالعمل</span>
                            }
                          </TableCell>
                          <TableCell>{fmtDate(employee.hire_date)}</TableCell>
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
                                onClick={() => navigate(`/admin/employees/${employee.id}`)}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenDialog(employee)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(employee.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Tasks Tab */}
        <TabsContent value="manual-tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                الأعمال اليدوية
              </CardTitle>
              <Button onClick={() => setTaskDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة عمل يدوي
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">إجمالي مستحقات التشغيل</p>
                <p className="text-2xl font-bold text-primary">
                  {manualTasks
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + (t.operating_cost || 0), 0)
                    .toLocaleString('ar-LY')} د.ل
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">تكلفة التشغيل</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        لا توجد أعمال يدوية مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    manualTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          {(task.employee as any)?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {task.task_description}
                          {task.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>
                          )}
                        </TableCell>
                        <TableCell>{fmtDate(task.task_date)}</TableCell>
                        <TableCell className="font-medium">
                          {(task.operating_cost || 0).toLocaleString('ar-LY')} د.ل
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

        {/* Payroll Runs Tab */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                دورات الرواتب
              </CardTitle>
              <Button onClick={() => setPayrollDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                إنشاء دورة رواتب جديدة
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفترة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">تاريخ الاعتماد</TableHead>
                    <TableHead className="text-right">تاريخ الدفع</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        لا توجد دورات رواتب مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          {fmtDate(run.period_start)} - {fmtDate(run.period_end)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              run.status === 'paid' ? 'default' : 
                              run.status === 'approved' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {run.status === 'paid' ? 'مدفوع' : run.status === 'approved' ? 'معتمد' : 'مسودة'}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmtDate(run.created_at)}</TableCell>
                        <TableCell>{fmtDate(run.approved_at)}</TableCell>
                        <TableCell>{fmtDate(run.paid_at)}</TableCell>
                        <TableCell>
                          {run.status !== 'paid' && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkPayrollPaid(run.id)}
                              className="gap-1"
                            >
                              <CheckCircle className="h-4 w-4" />
                              تسجيل كمدفوع
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                سجل مدفوعات الرواتب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الوظيفة</TableHead>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        لا توجد مدفوعات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {(item.employee as any)?.name || '-'}
                        </TableCell>
                        <TableCell>{(item.employee as any)?.position || '-'}</TableCell>
                        <TableCell>{(item.basic_salary || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{(item.allowances || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{(item.deductions || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="font-bold">{(item.net_salary || 0).toLocaleString('ar-LY')} د.ل</TableCell>
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

        {/* Advances Tab */}
        <TabsContent value="advances">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Advances Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  السلف
                </CardTitle>
                <Button onClick={() => setAdvanceDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة سلفة
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">إجمالي السلف المستحقة</p>
                  <p className="text-2xl font-bold text-red-600">{totalAdvances.toLocaleString('ar-LY')} د.ل</p>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {advances.filter(a => a.status === 'approved' && a.remaining > 0).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد سلف مستحقة</p>
                  ) : (
                    advances
                      .filter(a => a.status === 'approved' && a.remaining > 0)
                      .map((advance) => (
                        <div key={advance.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{(advance.employee as any)?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(advance.request_date)}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {advance.remaining.toLocaleString('ar-LY')} د.ل
                            </Badge>
                          </div>
                          {advance.reason && (
                            <p className="text-sm text-muted-foreground">{advance.reason}</p>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  ملخص السلف والخصومات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">إجمالي السلف</p>
                  <p className="text-xl font-bold">
                    {advances
                      .filter(a => a.status === 'approved')
                      .reduce((sum, a) => sum + a.amount, 0)
                      .toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">المتبقي من السلف</p>
                  <p className="text-xl font-bold text-red-600">
                    {totalAdvances.toLocaleString('ar-LY')} د.ل
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">المسدد من السلف</p>
                  <p className="text-xl font-bold text-green-600">
                    {(advances
                      .filter(a => a.status === 'approved')
                      .reduce((sum, a) => sum + a.amount, 0) - totalAdvances)
                      .toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <UIDialog.Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <UIDialog.DialogContent className="max-w-2xl">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              {editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'}
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">اسم الموظف *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم الموظف"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">الوظيفة</label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="أدخل الوظيفة"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">البريد الإلكتروني</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">رقم الهاتف</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {salaryType === 'monthly' && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">الراتب الأساسي *</label>
                  <Input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              <div className={`grid gap-2 ${salaryType === 'hourly' ? 'col-span-2' : ''}`}>
                <label className="text-sm font-medium">تاريخ التعيين *</label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">الحالة</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">نوع الراتب</label>
                <Select value={salaryType} onValueChange={setSalaryType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">راتب شهري</SelectItem>
                    <SelectItem value="hourly">بالعمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">فريق التركيب</label>
              <Select value={installationTeamId} onValueChange={setInstallationTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر فريق التركيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فريق</SelectItem>
                  {installationTeams.map((team) => {
                    const assignedEmployee = employees.find(e => e.installation_team_id === team.id && e.id !== editingEmployee?.id);
                    return (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                        disabled={!!assignedEmployee}
                      >
                        {team.team_name}
                        {assignedEmployee && ` (مرتبط بـ ${assignedEmployee.name})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">ربط بمستحقات التشغيل</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="operating-expenses"
                    checked={linkedToOperatingExpenses}
                    onChange={(e) => setLinkedToOperatingExpenses(e.target.checked)}
                    disabled={(() => {
                      const linkedEmployee = employees.find(emp => 
                        emp.linked_to_operating_expenses && 
                        emp.id !== editingEmployee?.id
                      );
                      return !!linkedEmployee;
                    })()}
                    className="w-4 h-4"
                  />
                  <label htmlFor="operating-expenses" className="text-sm text-muted-foreground cursor-pointer">
                    {(() => {
                      const linkedEmployee = employees.find(emp => 
                        emp.linked_to_operating_expenses && 
                        emp.id !== editingEmployee?.id
                      );
                      if (linkedEmployee) {
                        return `(مرتبط بـ ${linkedEmployee.name})`;
                      }
                      return 'تمثل مستحقات التشغيل وسحوباتها';
                    })()}
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                عند التفعيل، يتم ربط هذا الموظف بحساب مستحقات التشغيل. لا يمكن ربط أكثر من موظف واحد.
              </p>
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit}>
              {editingEmployee ? 'تحديث' : 'إضافة'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Payroll Creation Dialog */}
      <UIDialog.Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إنشاء دورة رواتب جديدة</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">بداية الفترة</label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">نهاية الفترة</label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">سيتم إنشاء رواتب لـ:</p>
              <p className="text-lg font-bold">{activeEmployees} موظف نشط</p>
              <p className="text-sm text-muted-foreground mt-2">
                إجمالي الرواتب: {totalSalaries.toLocaleString('ar-LY')} د.ل
              </p>
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setPayrollDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreatePayroll}>
              إنشاء دورة الرواتب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Advance Dialog */}
      <UIDialog.Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة سلفة جديدة</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={selectedEmployeeForAdvance} onValueChange={setSelectedEmployeeForAdvance}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => e.status === 'active')
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.position || 'بدون وظيفة'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ *</label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">السبب</label>
              <Textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="أدخل سبب السلفة (اختياري)"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddAdvance}>
              إضافة السلفة
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Manual Task Dialog */}
      <UIDialog.Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة عمل يدوي</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={selectedEmployeeForTask} onValueChange={setSelectedEmployeeForTask}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => e.status === 'active' && e.salary_type === 'per_job')
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.position || 'بدون وظيفة'}
                      </SelectItem>
                     ))}
                  {employees.filter(e => e.status === 'active' && e.salary_type === 'hourly').length === 0 && (
                    <SelectItem value="no-employees" disabled>
                      لا يوجد موظفين بنظام العمل
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

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
            <Button onClick={handleAddManualTask}>
              إضافة العمل
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
