import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Plus, Edit, Trash2, Save, Users } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  users_count?: number;
  created_at: string;
}

const availablePermissions = [
  { id: 'dashboard', label: 'لوحة التحكم', description: 'عرض لوحة التحكم الرئيسية' },
  { id: 'billboards', label: 'اللوحات الإعلانية', description: 'إدارة اللوحات الإعلانية' },
  { id: 'contracts', label: 'العقود', description: 'إدارة العقود' },
  { id: 'offers', label: 'العروض', description: 'إدارة العروض' },
  { id: 'customers', label: 'العملاء', description: 'إدارة العملاء' },
  { id: 'customer_billing', label: 'حسابات العملاء', description: 'عرض وإدارة حسابات العملاء' },
  { id: 'reports', label: 'التقارير', description: 'عرض التقارير والإحصائيات' },
  { id: 'tasks', label: 'المهام اليومية', description: 'إدارة المهام اليومية' },
  { id: 'installation_tasks', label: 'مهام التركيب', description: 'إدارة مهام التركيب' },
  { id: 'removal_tasks', label: 'مهام الإزالة', description: 'إدارة مهام الإزالة' },
  { id: 'print_tasks', label: 'مهام الطباعة', description: 'إدارة مهام الطباعة' },
  { id: 'cutout_tasks', label: 'مهام المجسمات', description: 'إدارة مهام المجسمات' },
  { id: 'composite_tasks', label: 'المهام المجمعة', description: 'إدارة المهام المجمعة' },
  { id: 'expenses', label: 'المصروفات', description: 'إدارة المصروفات' },
  { id: 'salaries', label: 'الرواتب', description: 'إدارة رواتب الموظفين' },
  { id: 'custody', label: 'العهد المالية', description: 'إدارة العهد المالية' },
  { id: 'revenue', label: 'الإيرادات', description: 'عرض تقارير الإيرادات' },
  { id: 'payments', label: 'الدفعات', description: 'إدارة الدفعات والإيصالات' },
  { id: 'overdue_payments', label: 'الدفعات المتأخرة', description: 'عرض الدفعات المتأخرة' },
  { id: 'printers', label: 'المطابع', description: 'إدارة المطابع' },
  { id: 'printer_accounts', label: 'حسابات المطابع', description: 'إدارة حسابات المطابع' },
  { id: 'installation_teams', label: 'فرق التركيب', description: 'إدارة فرق التركيب' },
  { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', description: 'إدارة حسابات فرق التركيب' },
  { id: 'friend_billboards', label: 'لوحات الأصدقاء', description: 'إدارة لوحات الأصدقاء' },
  { id: 'friend_accounts', label: 'حسابات الأصدقاء', description: 'إدارة حسابات الأصدقاء' },
  { id: 'shared_billboards', label: 'اللوحات المشتركة', description: 'إدارة اللوحات المشتركة' },
  { id: 'shared_companies', label: 'الشركات المشاركة', description: 'إدارة الشركات المشاركة' },
  { id: 'municipality_stickers', label: 'ملصقات البلديات', description: 'إدارة ملصقات البلديات' },
  { id: 'extended_billboards', label: 'اللوحات الممددة', description: 'عرض اللوحات الممددة' },
  { id: 'delayed_billboards', label: 'اللوحات المتأخرة', description: 'عرض اللوحات المتأخرة' },
  { id: 'billboard_cleanup', label: 'تنظيف اللوحات', description: 'تنظيف اللوحات المنتهية' },
  { id: 'billboard_maintenance', label: 'صيانة اللوحات', description: 'إدارة صيانة اللوحات' },
  { id: 'booking_requests', label: 'طلبات الحجز', description: 'إدارة طلبات الحجز' },
  { id: 'users', label: 'المستخدمون', description: 'إدارة المستخدمين' },
  { id: 'roles', label: 'الأدوار', description: 'إدارة الأدوار والصلاحيات' },
  { id: 'pricing', label: 'التسعير', description: 'إدارة أسعار الإيجار' },
  { id: 'pricing_factors', label: 'معاملات التسعير', description: 'إدارة معاملات التسعير' },
  { id: 'settings', label: 'الإعدادات', description: 'الوصول للإعدادات العامة' },
  { id: 'database_backup', label: 'النسخ الاحتياطي', description: 'إدارة النسخ الاحتياطي' },
  { id: 'messaging_settings', label: 'إعدادات المراسلات', description: 'إعدادات الرسائل' },
  { id: 'currency_settings', label: 'إعدادات العملة', description: 'إعدادات العملة' },
  { id: 'pdf_templates', label: 'قوالب PDF', description: 'إدارة قوالب PDF' },
  { id: 'print_design', label: 'تصميم الطباعة', description: 'إدارة تصميم الطباعة' },
  { id: 'contract_terms', label: 'بنود العقد', description: 'إدارة بنود العقد' },
  { id: 'system_settings', label: 'إعدادات النظام', description: 'إعدادات النظام المتقدمة' },
];

export default function RolesManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[],
  });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // جلب عدد المستخدمين لكل دور
      const rolesWithCount: Role[] = await Promise.all(
        (data || []).map(async (role: any) => {
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', role.name as any);
          
          return {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            permissions: role.permissions || [],
            users_count: count || 0,
            created_at: role.created_at,
          };
        })
      );

      setRoles(rolesWithCount);
    } catch (error: any) {
      console.error('Error fetching roles:', error);
      toast.error('فشل في تحميل الأدوار');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: [],
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast.error('يرجى إدخال اسم الدور والاسم المعروض');
      return;
    }

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            display_name: formData.display_name,
            description: formData.description || null,
            permissions: formData.permissions,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('تم تحديث الدور بنجاح');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            name: formData.name.toLowerCase().replace(/\s+/g, '_'),
            display_name: formData.display_name,
            description: formData.description || null,
            permissions: formData.permissions,
          } as any);

        if (error) throw error;
        toast.success('تم إنشاء الدور بنجاح');
      }

      setDialogOpen(false);
      fetchRoles();
    } catch (error: any) {
      toast.error(`فشل في حفظ الدور: ${error.message}`);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.name === 'admin' || role.name === 'user') {
      toast.error('لا يمكن حذف الأدوار الأساسية');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف دور "${role.display_name}"؟`)) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', role.id as any);

      if (error) throw error;
      toast.success('تم حذف الدور بنجاح');
      fetchRoles();
    } catch (error: any) {
      toast.error(`فشل في حذف الدور: ${error.message}`);
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const selectAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: availablePermissions.map(p => p.id),
    }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8" />
            إدارة الأدوار والصلاحيات
          </h1>
          <p className="text-muted-foreground">تعريف الأدوار وتحديد صلاحياتها</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة دور جديد
        </Button>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>الأدوار المتاحة</CardTitle>
          <CardDescription>قائمة بجميع الأدوار وصلاحياتها</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">الصلاحيات</TableHead>
                  <TableHead className="text-right">عدد المستخدمين</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={role.name === 'admin' ? 'destructive' : 'secondary'}>
                          {role.display_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({role.name})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {role.permissions.slice(0, 5).map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {availablePermissions.find(p => p.id === perm)?.label || perm}
                          </Badge>
                        ))}
                        {role.permissions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 5} أخرى
                          </Badge>
                        )}
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">لا توجد صلاحيات</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{role.users_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {role.name !== 'admin' && role.name !== 'user' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? `تعديل دور: ${editingRole.display_name}` : 'إضافة دور جديد'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الدور (بالإنجليزية)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: editor"
                  disabled={!!editingRole}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">الاسم المعروض</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="مثال: محرر"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="وصف اختياري للدور..."
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">الصلاحيات</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllPermissions}>
                    تحديد الكل
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllPermissions}>
                    إلغاء الكل
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-4 border rounded-lg">
                {availablePermissions.map((perm) => (
                  <div
                    key={perm.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.permissions.includes(perm.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => togglePermission(perm.id)}
                  >
                    <Checkbox
                      checked={formData.permissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                تم تحديد {formData.permissions.length} من {availablePermissions.length} صلاحية
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 ml-2" />
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}