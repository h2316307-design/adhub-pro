/**
 * Users Management Page - Role-Based Permission System
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * To change a user's permissions, change their role via the role change dialog.
 * The "صلاحيات" (permissions) button has been removed as it's no longer relevant.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import MultiSelect from '@/components/ui/multi-select';
import { useAuth } from '@/contexts/AuthContext';
import { Users as UsersIcon, Shield, Key, UserPlus, Search, RefreshCw, UserCheck, UserX, Edit, Info } from 'lucide-react';
import { EditUserDialog } from '@/components/users/EditUserDialog';

interface Role {
  id: string;
  name: string;
  display_name: string;
  permissions: string[];
}

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  roleDisplayName?: string;
  created_at: string | null;
  allowed_clients?: string[] | null;
  price_tier?: string | null;
  approved?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  rolePermissions?: string[]; // Permissions from role (read-only display)
}

export default function Users() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const { profile, isAdmin } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 20;
  const [savingId, setSavingId] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<string[]>([]);
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  
  // Dialog states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [viewPermissionsOpen, setViewPermissionsOpen] = useState(false);
  const [viewingUserPermissions, setViewingUserPermissions] = useState<string[]>([]);
  const [viewingUserName, setViewingUserName] = useState<string>('');

  // تحميل الأدوار المتاحة
  const loadAvailableRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, display_name, permissions')
        .order('name', { ascending: true });

      if (!error && data) {
        setAvailableRoles(data.map((r: any) => ({
          id: r.id,
          name: r.name,
          display_name: r.display_name,
          permissions: r.permissions || []
        })));
      }
    } catch (e) {
      console.error('Failed to load roles:', e);
    }
  };

  // تحميل فئات الأسعار ديناميكياً
  const loadPricingCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_categories')
        .select('name')
        .order('name', { ascending: true });

      if (!error && Array.isArray(data)) {
        const categories = data.map((item: any) => item.name);
        const staticCategories = ['عادي', 'المدينة', 'مسوق', 'شركات'];
        const allCategories = Array.from(new Set([...staticCategories, ...categories]));
        setPricingCategories(allCategories);
      } else {
        setPricingCategories(['عادي', 'المدينة', 'مسوق', 'شركات']);
      }
    } catch (e) {
      console.error('Failed to load pricing categories:', e);
      setPricingCategories(['عادي', 'المدينة', 'مسوق', 'شركات']);
    }
  };

  // تحميل العملاء
  const loadClients = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('name')
        .order('name', { ascending: true });
      
      if (data) {
        setAllClients(data.map(c => c.name));
      }
    } catch (e) {
      console.error('Failed to load clients:', e);
    }
  };

  const fetchPage = async (pageIndex: number) => {
    setLoading(true);
    setError(null);
    const from = (pageIndex - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      // جلب البيانات من profiles
      let query = supabase
        .from('profiles')
        .select('id, name, email, username, phone, company, created_at, approved, status, price_tier, allowed_clients', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const resp = await query;

      if (resp.error) {
        setError(resp.error.message);
        setRows([]);
        setCount(0);
        setLoading(false);
        return;
      }

      // جلب الأدوار لكل مستخدم - الصلاحيات تُشتق من الدور
      const profilesWithDetails = await Promise.all(
        (resp.data || []).map(async (prof) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', prof.id)
            .maybeSingle();

          const roleName = roleData?.role || 'user';
          
          // Get role display name and permissions from availableRoles
          const roleInfo = availableRoles.find(r => r.name === roleName);

          return {
            ...prof,
            role: roleName,
            roleDisplayName: roleInfo?.display_name || roleName,
            status: prof.status as 'pending' | 'approved' | 'rejected',
            rolePermissions: roleInfo?.permissions || [], // Role-based permissions (read-only)
          };
        })
      );

      setRows(profilesWithDetails);
      setCount(resp.count || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableRoles();
    loadPricingCategories();
    loadClients();
  }, []);

  useEffect(() => {
    if (availableRoles.length > 0) {
      fetchPage(page);
    }
  }, [page, availableRoles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (availableRoles.length > 0) {
        fetchPage(1);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleSaveUser = async (row: ProfileRow) => {
    setSavingId(row.id);
    try {
      // تحديث البروفايل
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          price_tier: row.price_tier,
          allowed_clients: row.allowed_clients,
        })
        .eq('id', row.id);

      if (profileError) throw profileError;

      toast.success('تم حفظ التعديلات بنجاح');
      fetchPage(page);
    } catch (error: any) {
      toast.error(`فشل حفظ التعديلات: ${error.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleApproveUser = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status,
          approved: status === 'approved',
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          approved_by: status === 'approved' ? profile?.id : null,
        })
        .eq('id', userId);

      if (error) throw error;

      // إذا تم قبول المستخدم، أضف له دور user افتراضي
      if (status === 'approved') {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingRole) {
          await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'user' });
        }
      }

      toast.success(status === 'approved' ? 'تم قبول المستخدم' : 'تم رفض المستخدم');
      fetchPage(page);
    } catch (error: any) {
      toast.error(`فشل تحديث الحالة: ${error.message}`);
    }
  };

  const handleOpenRoleModal = async (userId: string) => {
    setSelectedUserId(userId);
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    setSelectedRole(data?.role || 'user');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUserId) return;

    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUserId)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update({ role: selectedRole as any })
          .eq('user_id', selectedUserId);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: selectedUserId, role: selectedRole as any });
      }

      toast.success('تم تحديث الدور بنجاح - الصلاحيات الجديدة سارية الآن');
      setRoleModalOpen(false);
      fetchPage(page);
    } catch (error: any) {
      toast.error(`فشل تحديث الدور: ${error.message}`);
    }
  };

  const handleViewPermissions = (user: ProfileRow) => {
    setViewingUserName(user.name || 'المستخدم');
    setViewingUserPermissions(user.rolePermissions || []);
    setViewPermissionsOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordTargetId) return;
    if (!passwordNew) {
      toast.error('ادخل كلمة المرور');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }
    if (passwordNew.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || '';
      const resp = await fetch(`https://atqjaiebixuzomrfwilu.supabase.co/functions/v1/admin-set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: passwordTargetId, password: passwordNew })
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        toast.error(json?.error || 'فشل تحديث كلمة المرور');
      } else {
        toast.success('تم تحديث كلمة المرور');
        setPasswordModalOpen(false);
        setPasswordTargetId(null);
        setPasswordNew('');
        setPasswordConfirm('');
      }
    } catch (e) {
      console.error('set password error', e);
      toast.error('فشل تحديث كلمة المرور');
    }
  };

  const getRoleBadge = (role: string | null, displayName?: string) => {
    const label = displayName || role || 'غير محدد';
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-600">{label}</Badge>;
      case 'user':
        return <Badge variant="secondary">{label}</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">قيد المراجعة</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">موافق عليه</Badge>;
      case 'rejected':
        return <Badge variant="destructive">مرفوض</Badge>;
      default:
        return <Badge variant="outline">غير محدد</Badge>;
    }
  };

  // Get selected role info for display
  const selectedRoleInfo = availableRoles.find(r => r.name === selectedRole);

  // إحصائيات المستخدمين
  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const approvedCount = rows.filter(r => r.status === 'approved').length;
  const adminCount = rows.filter(r => r.role === 'admin').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <UsersIcon className="h-8 w-8" />
            إدارة المستخدمين
          </h1>
          <p className="text-muted-foreground">إدارة المستخدمين والأدوار - الصلاحيات مبنية على الدور فقط</p>
        </div>
        <Button onClick={() => fetchPage(page)} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
              <UsersIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الموافقة</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <UserPlus className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">مستخدمون نشطون</p>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">مدراء النظام</p>
                <p className="text-2xl font-bold text-red-600">{adminCount}</p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>قائمة المستخدمين</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو البريد أو الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">جاري التحميل...</div>
          ) : error ? (
            <div className="text-destructive text-center py-8">خطأ: {error}</div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">لا يوجد مستخدمون</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>فئة الأسعار</TableHead>
                    <TableHead>الصلاحيات (من الدور)</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name || '—'}</span>
                          {r.username && <span className="text-sm text-primary">@{r.username}</span>}
                          <span className="text-sm text-muted-foreground">{r.email || '—'}</span>
                          {r.phone && <span className="text-xs text-muted-foreground">{r.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell>{getRoleBadge(r.role, r.roleDisplayName)}</TableCell>
                      <TableCell>
                        <Select
                          value={r.price_tier || ''}
                          onValueChange={(val) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, price_tier: val } : x))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="اختر الفئة" />
                          </SelectTrigger>
                          <SelectContent>
                            {pricingCategories.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewPermissions(r)}
                          className="gap-1"
                        >
                          <Info className="h-4 w-4" />
                          {r.rolePermissions?.length || 0} صلاحية
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {r.status === 'pending' && (
                            <>
                              <Button size="sm" onClick={() => handleApproveUser(r.id, 'approved')} className="bg-green-600 hover:bg-green-700">
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleApproveUser(r.id, 'rejected')}>
                                <UserX className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <>
                              <Button size="sm" onClick={() => handleSaveUser(r)} disabled={savingId === r.id}>
                                حفظ
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingUser(r);
                                setEditUserOpen(true);
                              }} title="تعديل البيانات">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleOpenRoleModal(r.id)} title="تغيير الدور">
                                <Shield className="h-4 w-4" />
                              </Button>
                              {/* Removed individual permissions button - permissions are role-based only */}
                              {isAdmin && (
                                <Button size="sm" variant="outline" onClick={() => { 
                                  setPasswordTargetId(r.id); 
                                  setPasswordNew(''); 
                                  setPasswordConfirm(''); 
                                  setPasswordModalOpen(true); 
                                }}>
                                  <Key className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {count > PAGE_SIZE && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const pageNum = page <= 3 ? i + 1 : page - 2 + i;
                    if (pageNum > totalPages || pageNum < 1) return null;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          isActive={page === pageNum}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password change modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              تغيير كلمة المرور
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input 
                type="password" 
                placeholder="أدخل كلمة المرور الجديدة" 
                value={passwordNew} 
                onChange={(e) => setPasswordNew(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور</Label>
              <Input 
                type="password" 
                placeholder="أعد إدخال كلمة المرور" 
                value={passwordConfirm} 
                onChange={(e) => setPasswordConfirm(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>إلغاء</Button>
              <Button onClick={handleChangePassword}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role change modal - Enhanced with all available roles */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              تغيير دور المستخدم
            </DialogTitle>
            <DialogDescription>
              تغيير الدور هو الطريقة الوحيدة لمنح أو سحب الصلاحيات
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show selected role permissions */}
            {selectedRoleInfo && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <Label className="text-sm font-medium">صلاحيات هذا الدور ({selectedRoleInfo.permissions.length}):</Label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {selectedRoleInfo.permissions.length > 0 ? (
                    selectedRoleInfo.permissions.map((perm) => (
                      <Badge key={perm} variant="outline" className="text-xs">
                        {perm}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">لا توجد صلاحيات لهذا الدور</span>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              عند تغيير الدور، سيحصل المستخدم على جميع صلاحيات الدور الجديد فوراً.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoleModalOpen(false)}>إلغاء</Button>
              <Button onClick={handleSaveRole}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Permissions Modal (read-only) */}
      <Dialog open={viewPermissionsOpen} onOpenChange={setViewPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              صلاحيات {viewingUserName}
            </DialogTitle>
            <DialogDescription>
              الصلاحيات مُشتقة من الدور المُعين - لتغيير الصلاحيات، غيّر الدور
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2">
              {viewingUserPermissions.length > 0 ? (
                viewingUserPermissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-sm">
                    {perm}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground">لا توجد صلاحيات لهذا المستخدم</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewPermissionsOpen(false)}>إغلاق</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editUserOpen}
        onOpenChange={setEditUserOpen}
        user={editingUser}
        onUserUpdated={() => fetchPage(page)}
      />
    </div>
  );
}
