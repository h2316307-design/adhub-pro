import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string | null;
  onPermissionsUpdated: () => void;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
}

export function UserPermissionsDialog({ open, onOpenChange, userId, userName, onPermissionsUpdated }: UserPermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('user');

  useEffect(() => {
    if (open && userId) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // جلب كل الأدوار المتاحة
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('created_at');
      
      if (rolesError) throw rolesError;
      setRoles((rolesData || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        display_name: r.display_name,
        description: r.description,
        permissions: r.permissions || [],
      })));

      // جلب دور المستخدم الحالي
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      setSelectedRole(userRole?.role || 'user');
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // تحديث دور المستخدم
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: selectedRole } as any, { onConflict: 'user_id,role' });

      if (error) {
        // إذا كان هناك دور سابق مختلف، نحذفه ونضيف الجديد
        await supabase.from('user_roles').delete().eq('user_id', userId);
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: selectedRole } as any);
        if (insertError) throw insertError;
      }

      toast.success('تم تحديث دور المستخدم بنجاح');
      onPermissionsUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'فشل في حفظ الدور');
    } finally {
      setSaving(false);
    }
  };

  const currentRole = roles.find(r => r.name === selectedRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            إدارة دور المستخدم
            {userName && <Badge variant="outline">{userName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>اختر الدور</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر دوراً" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.display_name} ({role.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentRole?.description && (
                <p className="text-sm text-muted-foreground">{currentRole.description}</p>
              )}
            </div>

            {currentRole && (
              <div className="space-y-2">
                <Label>صلاحيات هذا الدور</Label>
                <div className="flex flex-wrap gap-1 p-3 rounded-lg border bg-muted/30 max-h-48 overflow-y-auto">
                  {currentRole.permissions
                    .filter(p => !p.endsWith('_edit'))
                    .map(perm => (
                      <Badge key={perm} variant="outline" className="text-xs">
                        {perm}
                        {currentRole.permissions.includes(`${perm}_edit`) && (
                          <span className="text-primary mr-1">+ تعديل</span>
                        )}
                      </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  عدد الصلاحيات: {currentRole.permissions.filter(p => !p.endsWith('_edit')).length} عرض، {currentRole.permissions.filter(p => p.endsWith('_edit')).length} تعديل
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              💡 لتعديل صلاحيات الدور نفسه، اذهب إلى صفحة <strong>إدارة الأدوار</strong>
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ الدور'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
