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

// صلاحيات الوصول (مشاهدة) - كل صفحة لها صلاحية وصول
const availablePermissions = [
  // الصفحات الأساسية
  { id: 'dashboard', label: 'لوحة التحكم', description: 'عرض لوحة التحكم الرئيسية', hasEdit: false },
  { id: 'contracts', label: 'العقود', description: 'عرض وإدارة العقود', hasEdit: true },
  { id: 'offers', label: 'العروض', description: 'عرض وإدارة العروض', hasEdit: true },
  // إدارة اللوحات
  { id: 'billboards', label: 'اللوحات الإعلانية', description: 'عرض اللوحات الإعلانية', hasEdit: true },
  { id: 'extended_billboards', label: 'اللوحات الممددة', description: 'عرض اللوحات الممددة', hasEdit: false },
  { id: 'municipality_stickers', label: 'ملصقات البلديات', description: 'عرض ملصقات البلديات', hasEdit: true },
  { id: 'municipality_stats', label: 'إحصائيات البلديات', description: 'عرض إحصائيات البلديات', hasEdit: false },
  { id: 'municipality_rent_prices', label: 'أسعار إيجار البلديات', description: 'عرض أسعار إيجار البلديات', hasEdit: true },
  { id: 'municipality_organizer', label: 'تنظيم لوحات البلدية', description: 'تنظيم لوحات البلدية', hasEdit: true },
  { id: 'billboard_cleanup', label: 'تنظيف اللوحات', description: 'تنظيف اللوحات المنتهية', hasEdit: true },
  { id: 'billboard_maintenance', label: 'صيانة اللوحات', description: 'صيانة اللوحات', hasEdit: true },
  { id: 'shared_billboards', label: 'اللوحات المشتركة', description: 'عرض اللوحات المشتركة', hasEdit: true },
  { id: 'shared_companies', label: 'الشركات المشاركة', description: 'عرض الشركات المشاركة', hasEdit: true },
  { id: 'friend_billboards', label: 'لوحات الأصدقاء', description: 'عرض لوحات الأصدقاء', hasEdit: true },
  { id: 'friend_accounts', label: 'حسابات الأصدقاء', description: 'عرض حسابات الأصدقاء', hasEdit: true },
  // إدارة العملاء
  { id: 'customers', label: 'العملاء', description: 'عرض العملاء', hasEdit: true },
  { id: 'customer_billing', label: 'حسابات العملاء', description: 'عرض حسابات العملاء', hasEdit: true },
  { id: 'customer_merge', label: 'دمج العملاء', description: 'دمج العملاء المكررين', hasEdit: true },
  // الإدارة المالية
  { id: 'overdue_payments', label: 'الدفعات المتأخرة', description: 'عرض الدفعات المتأخرة', hasEdit: false },
  { id: 'payments', label: 'الدفعات', description: 'عرض الدفعات والإيصالات', hasEdit: true },
  { id: 'printed_invoices_page', label: 'فواتير الطباعة', description: 'عرض فواتير الطباعة', hasEdit: true },
  { id: 'printer_accounts', label: 'حسابات المطابع', description: 'عرض حسابات المطابع', hasEdit: true },
  { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', description: 'عرض حسابات فرق التركيب', hasEdit: true },
  { id: 'salaries', label: 'الرواتب', description: 'عرض رواتب الموظفين', hasEdit: true },
  { id: 'custody', label: 'العهد المالية', description: 'عرض العهد المالية', hasEdit: true },
  { id: 'revenue', label: 'الإيرادات', description: 'عرض تقارير الإيرادات', hasEdit: false },
  { id: 'expenses', label: 'المصروفات', description: 'عرض المصروفات', hasEdit: true },
  // التسعير
  { id: 'pricing', label: 'أسعار الإيجار', description: 'عرض أسعار الإيجار', hasEdit: true },
  { id: 'pricing_factors', label: 'معاملات التسعير', description: 'عرض معاملات التسعير', hasEdit: true },
  // إدارة المهام
  { id: 'tasks', label: 'المهام اليومية', description: 'عرض المهام اليومية', hasEdit: true },
  { id: 'installation_tasks', label: 'مهام التركيب', description: 'عرض مهام التركيب', hasEdit: true },
  { id: 'delayed_billboards', label: 'اللوحات المتأخرة', description: 'عرض اللوحات المتأخرة', hasEdit: false },
  { id: 'removal_tasks', label: 'مهام الإزالة', description: 'عرض مهام الإزالة', hasEdit: true },
  { id: 'print_tasks', label: 'مهام الطباعة', description: 'عرض مهام الطباعة', hasEdit: true },
  { id: 'cutout_tasks', label: 'مهام المجسمات', description: 'عرض مهام المجسمات', hasEdit: true },
  { id: 'composite_tasks', label: 'المهام المجمعة', description: 'عرض المهام المجمعة', hasEdit: true },
  // أخرى
  { id: 'booking_requests', label: 'طلبات الحجز', description: 'عرض طلبات الحجز', hasEdit: true },
  { id: 'users', label: 'المستخدمون', description: 'عرض المستخدمين', hasEdit: true },
  { id: 'roles', label: 'الأدوار', description: 'عرض الأدوار والصلاحيات', hasEdit: true },
  { id: 'installation_teams', label: 'فرق التركيب', description: 'عرض فرق التركيب', hasEdit: true },
  { id: 'printers', label: 'المطابع', description: 'عرض المطابع', hasEdit: true },
  { id: 'reports', label: 'التقارير', description: 'عرض التقارير والإحصائيات', hasEdit: false },
  { id: 'kpi_dashboard', label: 'مؤشرات الأداء', description: 'عرض لوحة مؤشرات الأداء', hasEdit: false },
  { id: 'profitability_reports', label: 'تقارير الربحية', description: 'عرض تقارير الربحية', hasEdit: false },
  { id: 'smart_distribution', label: 'التوزيع الذكي', description: 'عرض التوزيع الذكي', hasEdit: false },
  // الإعدادات
  { id: 'settings', label: 'الإعدادات العامة', description: 'الوصول للإعدادات العامة', hasEdit: true },
  { id: 'system_settings', label: 'إعدادات النظام', description: 'إعدادات النظام المتقدمة', hasEdit: true },
  { id: 'print_design', label: 'تصميم الطباعة', description: 'تصميم قوالب الطباعة', hasEdit: true },
  { id: 'print_design_new', label: 'إعدادات الطباعة الموحدة', description: 'إعدادات الطباعة الموحدة', hasEdit: true },
  { id: 'billboard_print_settings', label: 'إعدادات طباعة اللوحات', description: 'إعدادات طباعة اللوحات', hasEdit: true },
  { id: 'quick_print_settings', label: 'إعدادات الطباعة السريعة', description: 'إعدادات الطباعة السريعة', hasEdit: true },
  { id: 'pdf_templates', label: 'قوالب PDF', description: 'عرض قوالب PDF', hasEdit: true },
  { id: 'contract_terms', label: 'بنود العقد', description: 'عرض بنود العقد', hasEdit: true },
  { id: 'messaging_settings', label: 'إعدادات المراسلات', description: 'إعدادات الرسائل', hasEdit: true },
  { id: 'currency_settings', label: 'إعدادات العملة', description: 'إعدادات العملة', hasEdit: true },
  { id: 'database_backup', label: 'النسخ الاحتياطي', description: 'النسخ الاحتياطي لقاعدة البيانات', hasEdit: true },
];

// الصلاحيات التي تدعم التعديل (سيتم إنشاء صلاحية _edit لكل منها)
const editablePermissions = availablePermissions.filter(p => p.hasEdit);

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
    // تحديد كل صلاحيات المشاهدة + التعديل
    const allPerms = [
      ...availablePermissions.map(p => p.id),
      ...editablePermissions.map(p => `${p.id}_edit`)
    ];
    setFormData(prev => ({
      ...prev,
      permissions: allPerms,
    }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [],
    }));
  };

  // تحديد كل صلاحيات التعديل
  const selectAllEditPermissions = () => {
    const editPerms = editablePermissions.map(p => `${p.id}_edit`);
    setFormData(prev => ({
      ...prev,
      permissions: [...new Set([...prev.permissions, ...editPerms])],
    }));
  };

  // إلغاء كل صلاحيات التعديل
  const clearAllEditPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.filter(p => !p.endsWith('_edit')),
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

            {/* صلاحيات المشاهدة */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">صلاحيات المشاهدة (الوصول للصفحات)</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllPermissions}>
                    تحديد الكل
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllPermissions}>
                    إلغاء الكل
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-4 border rounded-lg">
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
                تم تحديد {formData.permissions.filter(p => !p.endsWith('_edit')).length} من {availablePermissions.length} صلاحية مشاهدة
              </p>
            </div>

            {/* صلاحيات التعديل */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">صلاحيات التعديل (إضافة/تعديل/حذف)</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllEditPermissions}>
                    تحديد كل التعديل
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllEditPermissions}>
                    إلغاء كل التعديل
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-4 border rounded-lg bg-muted/30">
                {editablePermissions.map((perm) => {
                  const editPermId = `${perm.id}_edit`;
                  const hasViewPermission = formData.permissions.includes(perm.id);
                  return (
                    <div
                      key={editPermId}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.permissions.includes(editPermId)
                          ? 'bg-green-500/10 border-green-500'
                          : hasViewPermission 
                            ? 'hover:bg-muted' 
                            : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (hasViewPermission) {
                          togglePermission(editPermId);
                        }
                      }}
                    >
                      <Checkbox
                        checked={formData.permissions.includes(editPermId)}
                        disabled={!hasViewPermission}
                        onCheckedChange={() => {
                          if (hasViewPermission) {
                            togglePermission(editPermId);
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          تعديل {perm.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hasViewPermission ? 'السماح بالتعديل والحذف' : 'يجب تفعيل المشاهدة أولاً'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-muted-foreground">
                تم تحديد {formData.permissions.filter(p => p.endsWith('_edit')).length} من {editablePermissions.length} صلاحية تعديل
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