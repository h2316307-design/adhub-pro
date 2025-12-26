import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield, LayoutDashboard, RectangleVertical, FileText, Users, BarChart3, ListTodo, Wallet, Settings, Printer, DollarSign, Building } from 'lucide-react';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string | null;
  onPermissionsUpdated: () => void;
}

interface PermissionGroup {
  name: string;
  icon: React.ReactNode;
  permissions: {
    value: string;
    label: string;
    description?: string;
  }[];
}

const permissionGroups: PermissionGroup[] = [
  {
    name: 'الصفحات الأساسية',
    icon: <LayoutDashboard className="h-4 w-4" />,
    permissions: [
      { value: 'dashboard', label: 'لوحة التحكم', description: 'عرض الإحصائيات والملخصات' },
      { value: 'billboards', label: 'اللوحات الإعلانية', description: 'عرض وإدارة اللوحات' },
      { value: 'contracts', label: 'العقود', description: 'عرض وإدارة العقود' },
      { value: 'customers', label: 'العملاء', description: 'عرض وإدارة العملاء' },
    ]
  },
  {
    name: 'المهام والتقارير',
    icon: <ListTodo className="h-4 w-4" />,
    permissions: [
      { value: 'tasks', label: 'مهام التركيب', description: 'عرض وإدارة مهام التركيب' },
      { value: 'print-tasks', label: 'مهام الطباعة', description: 'عرض وإدارة مهام الطباعة' },
      { value: 'removal-tasks', label: 'مهام الإزالة', description: 'عرض وإدارة مهام الإزالة' },
      { value: 'reports', label: 'التقارير', description: 'عرض التقارير والإحصائيات' },
    ]
  },
  {
    name: 'المالية والمصروفات',
    icon: <Wallet className="h-4 w-4" />,
    permissions: [
      { value: 'payments', label: 'المدفوعات', description: 'عرض وإدارة المدفوعات' },
      { value: 'expenses', label: 'المصروفات', description: 'عرض وإدارة المصروفات' },
      { value: 'salaries', label: 'الرواتب', description: 'عرض وإدارة الرواتب' },
      { value: 'revenue', label: 'الإيرادات', description: 'عرض تقارير الإيرادات' },
    ]
  },
  {
    name: 'الإعدادات والإدارة',
    icon: <Settings className="h-4 w-4" />,
    permissions: [
      { value: 'settings', label: 'الإعدادات', description: 'الوصول لإعدادات النظام' },
      { value: 'users', label: 'إدارة المستخدمين', description: 'إضافة وتعديل المستخدمين' },
      { value: 'pricing', label: 'إدارة الأسعار', description: 'تعديل جداول الأسعار' },
      { value: 'teams', label: 'فرق التركيب', description: 'إدارة فرق التركيب' },
    ]
  },
  {
    name: 'الشركاء والطباعة',
    icon: <Building className="h-4 w-4" />,
    permissions: [
      { value: 'printers', label: 'المطابع', description: 'إدارة المطابع' },
      { value: 'friend-companies', label: 'الشركات الصديقة', description: 'إدارة الشركات الصديقة' },
      { value: 'partners', label: 'الشراكات', description: 'إدارة الشراكات' },
      { value: 'offers', label: 'العروض', description: 'إنشاء وإدارة العروض' },
    ]
  },
];

export function UserPermissionsDialog({ open, onOpenChange, userId, userName, onPermissionsUpdated }: UserPermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (open && userId) {
      loadPermissions();
    }
  }, [open, userId]);

  const loadPermissions = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      if (error) throw error;
      setSelectedPermissions(data?.map(p => p.permission) || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error('فشل في تحميل الصلاحيات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions
      if (selectedPermissions.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(selectedPermissions.map(perm => ({
            user_id: userId,
            permission: perm,
          })));

        if (error) throw error;
      }

      toast.success('تم حفظ الصلاحيات بنجاح');
      onPermissionsUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast.error(error.message || 'فشل في حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const selectAll = () => {
    const allPermissions = permissionGroups.flatMap(g => g.permissions.map(p => p.value));
    setSelectedPermissions(allPermissions);
  };

  const clearAll = () => {
    setSelectedPermissions([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            إدارة صلاحيات المستخدم
            {userName && <Badge variant="outline">{userName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                اختر الصفحات والميزات التي يمكن للمستخدم الوصول إليها
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  تحديد الكل
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  إلغاء الكل
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.name} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {group.icon}
                    {group.name}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pr-6">
                    {group.permissions.map((permission) => (
                      <div
                        key={permission.value}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          selectedPermissions.includes(permission.value)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex-1">
                          <Label className="font-medium cursor-pointer">
                            {permission.label}
                          </Label>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={selectedPermissions.includes(permission.value)}
                          onCheckedChange={() => togglePermission(permission.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <Separator />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                الصلاحيات المحددة: <Badge>{selectedPermissions.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
