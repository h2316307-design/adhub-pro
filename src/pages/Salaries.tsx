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
import { Loader2, Wallet, Plus, Edit, Trash2, DollarSign, Calendar, User, FileText } from 'lucide-react';
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
  created_at: string;
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

export default function Salaries() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('active');

  useEffect(() => {
    loadData();
  }, []);

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

    if (!baseSalary || parseFloat(baseSalary) <= 0) {
      toast.error('يرجى إدخال راتب صحيح');
      return;
    }

    try {
      const employeeData = {
        name: name.trim(),
        position: position.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        base_salary: parseFloat(baseSalary),
        hire_date: hireDate,
        status: status,
        updated_at: new Date().toISOString(),
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) {
          console.error('خطأ في تحديث الموظف:', error);
          toast.error('فشل في تحديث الموظف');
        } else {
          toast.success('تم تحديث الموظف بنجاح');
          handleCloseDialog();
          loadData();
        }
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);

        if (error) {
          console.error('خطأ في إضافة الموظف:', error);
          toast.error('فشل في إضافة الموظف');
        } else {
          toast.success('تم إضافة الموظف بنجاح');
          handleCloseDialog();
          loadData();
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
          <TabsTrigger value="payroll">دورات الرواتب</TabsTrigger>
          <TabsTrigger value="payments">سجل المدفوعات</TabsTrigger>
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
                        <TableCell>{(employee.base_salary || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ar-LY') : '-'}</TableCell>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                دورات الرواتب
              </CardTitle>
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
                          {new Date(run.period_start).toLocaleDateString('ar-LY')} - {new Date(run.period_end).toLocaleDateString('ar-LY')}
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
                        <TableCell>{new Date(run.created_at).toLocaleDateString('ar-LY')}</TableCell>
                        <TableCell>{run.approved_at ? new Date(run.approved_at).toLocaleDateString('ar-LY') : '-'}</TableCell>
                        <TableCell>{run.paid_at ? new Date(run.paid_at).toLocaleDateString('ar-LY') : '-'}</TableCell>
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

              <div className="grid gap-2">
                <label className="text-sm font-medium">تاريخ التعيين *</label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
            </div>

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
    </div>
  );
}
