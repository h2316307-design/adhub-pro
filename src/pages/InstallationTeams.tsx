import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Save, MapPin, Ruler, Building2, Users, UserPlus, UserMinus, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
  created_at?: string;
  updated_at?: string;
}

interface TeamEmployee {
  id: string;
  name: string;
  position: string;
  phone: string;
  status: string;
}

export default function InstallationTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [current, setCurrent] = useState<Partial<InstallationTeam>>({});
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamEmployee[]>>({});
  const [allEmployees, setAllEmployees] = useState<TeamEmployee[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Team accounts summary
  const [teamAccountsSummary, setTeamAccountsSummary] = useState<Record<string, { pending: number; paid: number; total: number }>>({});

  const loadTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('installation_teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTeams((data as any) || []);
      
      // Load sizes
      if (availableSizes.length === 0) {
        try {
          const { data: sdata, error: serror } = await (supabase as any)
            .from('sizes')
            .select('name')
            .order('sort_order', { ascending: true });

          if (!serror && Array.isArray(sdata)) {
            setAvailableSizes(sdata.map((r: any) => String(r.name)));
          }
        } catch (e) {
          console.warn('Failed to load sizes for installation teams:', e);
        }
      }

      // Load cities
      if (availableCities.length === 0) {
        try {
          const { data: cdata, error: cerror } = await supabase
            .from('billboards')
            .select('City')
            .not('City', 'is', null);

          if (!cerror && Array.isArray(cdata)) {
            const uniqueCities = [...new Set(cdata.map((r: any) => String(r.City)).filter(Boolean))].sort();
            setAvailableCities(uniqueCities);
          }
        } catch (e) {
          console.warn('Failed to load cities for installation teams:', e);
        }
      }

      // Load team members
      await loadTeamMembers();
      // Load team accounts
      await loadTeamAccounts((data as any) || []);
    } catch (error: any) {
      console.error('Error loading installation teams:', error);
      toast.error('فشل في تحميل فرق التركيب');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, position, phone, status, installation_team_id')
      .not('installation_team_id', 'is', null)
      .eq('status', 'active');

    const grouped: Record<string, TeamEmployee[]> = {};
    (employees || []).forEach((emp: any) => {
      if (!grouped[emp.installation_team_id]) grouped[emp.installation_team_id] = [];
      grouped[emp.installation_team_id].push(emp);
    });
    setTeamMembers(grouped);
  };

  const loadTeamAccounts = async (teamsList: InstallationTeam[]) => {
    const summaries: Record<string, { pending: number; paid: number; total: number }> = {};
    for (const team of teamsList) {
      const { data } = await supabase
        .from('installation_team_accounts')
        .select('amount, status')
        .eq('team_id', team.id);
      
      const pending = (data || []).filter(d => d.status === 'pending').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const paid = (data || []).filter(d => d.status === 'paid').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      summaries[team.id] = { pending, paid, total: pending + paid };
    }
    setTeamAccountsSummary(summaries);
  };

  const loadAvailableEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, name, position, phone, status')
      .eq('status', 'active')
      .is('installation_team_id', null)
      .order('name');
    setAllEmployees((data || []) as TeamEmployee[]);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const openCreate = () => {
    setEditMode(false);
    setCurrent({ team_name: '', sizes: [], cities: [] });
    setSelectedSizes(new Set());
    setSelectedCities(new Set());
    setDialogOpen(true);
  };

  const openEdit = (team: InstallationTeam) => {
    setEditMode(true);
    setCurrent({ ...team });
    setSelectedSizes(new Set(Array.isArray(team.sizes) ? team.sizes : []));
    setSelectedCities(new Set(Array.isArray(team.cities) ? team.cities : []));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!current?.team_name) {
        toast.error('يرجى إدخال اسم الفرقة');
        return;
      }

      const payload = {
        team_name: current.team_name,
        sizes: Array.from(selectedSizes),
        cities: Array.from(selectedCities)
      };

      if (editMode && current.id) {
        const { error } = await (supabase as any)
          .from('installation_teams')
          .update(payload)
          .eq('id', current.id);
        if (error) throw error;
        toast.success('تم تحديث الفرقة بنجاح');
      } else {
        const { error } = await (supabase as any)
          .from('installation_teams')
          .insert(payload);
        if (error) throw error;
        toast.success('تم إضافة الفرقة بنجاح');
      }

      setDialogOpen(false);
      loadTeams();
    } catch (error: any) {
      console.error('Error saving team:', error);
      toast.error('فشل في حفظ الفرقة');
    }
  };

  const confirmDelete = (id: string) => {
    setToDeleteId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!toDeleteId) return;
    try {
      // Remove team assignment from employees first
      await supabase
        .from('employees')
        .update({ installation_team_id: null })
        .eq('installation_team_id', toDeleteId);

      const { error } = await (supabase as any)
        .from('installation_teams')
        .delete()
        .eq('id', toDeleteId);
      if (error) throw error;
      toast.success('تم حذف الفرقة');
      setConfirmOpen(false);
      setToDeleteId(null);
      loadTeams();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error('فشل في حذف الفرقة');
    }
  };

  const openAssignDialog = (teamId: string) => {
    setAssignTeamId(teamId);
    setSelectedEmployeeId('');
    loadAvailableEmployees();
    setAssignDialogOpen(true);
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeId || !assignTeamId) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ installation_team_id: assignTeamId })
        .eq('id', selectedEmployeeId);
      if (error) throw error;
      toast.success('تم إضافة الموظف للفرقة');
      setAssignDialogOpen(false);
      loadTeamMembers();
      loadAvailableEmployees();
    } catch (error: any) {
      toast.error('فشل في إضافة الموظف');
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ installation_team_id: null })
        .eq('id', employeeId);
      if (error) throw error;
      toast.success('تم إزالة الموظف من الفرقة');
      loadTeamMembers();
    } catch (error: any) {
      toast.error('فشل في إزالة الموظف');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">فرق التركيبات</h2>
          <p className="text-muted-foreground text-sm">إدارة فرق التركيب وتخصيصاتها وأعضائها</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> إضافة فرقة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            قائمة فرق التركيب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>اسم الفرقة</TableHead>
                  <TableHead>الأعضاء</TableHead>
                  <TableHead>المقاسات المتخصصة</TableHead>
                  <TableHead>المدن المتخصصة</TableHead>
                  <TableHead>الحساب المالي</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t, idx) => {
                  const members = teamMembers[t.id] || [];
                  const account = teamAccountsSummary[t.id] || { pending: 0, paid: 0, total: 0 };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{t.team_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {members.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {members.map(m => (
                                <Badge key={m.id} variant="secondary" className="text-xs gap-1 group cursor-pointer" onClick={() => navigate(`/admin/employees/${m.id}`)}>
                                  <Users className="h-3 w-3" />
                                  {m.name}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveEmployee(m.id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                                    title="إزالة من الفرقة"
                                  >
                                    <UserMinus className="h-3 w-3 text-destructive" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">لا يوجد أعضاء</span>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => openAssignDialog(t.id)}>
                            <UserPlus className="h-3 w-3" /> إضافة موظف
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(t.sizes) && t.sizes.length > 0 ? (
                            t.sizes.slice(0, 3).map(size => (
                              <Badge key={size} variant="secondary" className="text-xs">
                                <Ruler className="h-3 w-3 ml-1" />
                                {size}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">جميع المقاسات</span>
                          )}
                          {Array.isArray(t.sizes) && t.sizes.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{t.sizes.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(t.cities) && t.cities.length > 0 ? (
                            t.cities.slice(0, 3).map(city => (
                              <Badge key={city} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                <MapPin className="h-3 w-3 ml-1" />
                                {city}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">جميع المدن</span>
                          )}
                          {Array.isArray(t.cities) && t.cities.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{t.cities.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-amber-500" />
                            <span className="text-muted-foreground">معلق:</span>
                            <span className="font-semibold text-amber-600">{account.pending.toLocaleString('ar-LY')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-emerald-500" />
                            <span className="text-muted-foreground">مدفوع:</span>
                            <span className="font-semibold text-emerald-600">{account.paid.toLocaleString('ar-LY')}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDelete(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {teams.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      لا توجد فرق تركيب مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Team Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editMode ? 'تعديل فرقة' : 'إضافة فرقة جديدة'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            <div className="space-y-2">
              <Label className="font-semibold">اسم الفرقة *</Label>
              <Input 
                value={current?.team_name || ''} 
                onChange={(e) => setCurrent(c => ({ ...c, team_name: e.target.value }))}
                placeholder="أدخل اسم الفرقة"
                className="text-lg"
              />
            </div>

            {/* Sizes Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  المقاسات المتخصصة
                </Label>
                <span className="text-xs text-muted-foreground">
                  {selectedSizes.size > 0 ? `${selectedSizes.size} محدد` : 'جميع المقاسات'}
                </span>
              </div>
              <ScrollArea className="h-[140px] border rounded-lg p-3">
                <div className="grid grid-cols-3 gap-2">
                  {availableSizes.length === 0 ? (
                    <div className="col-span-3 text-sm text-muted-foreground text-center py-4">
                      جاري تحميل المقاسات...
                    </div>
                  ) : (
                    availableSizes.map((sz) => {
                      const checked = selectedSizes.has(sz);
                      return (
                        <label 
                          key={sz} 
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm",
                            checked 
                              ? "bg-primary/10 border-primary text-primary" 
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedSizes(prev => {
                                const next = new Set(Array.from(prev));
                                if (e.target.checked) next.add(sz); else next.delete(sz);
                                return next;
                              });
                            }}
                            className="accent-primary"
                          />
                          <span>{sz}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Cities Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  المدن المتخصصة
                </Label>
                <span className="text-xs text-muted-foreground">
                  {selectedCities.size > 0 ? `${selectedCities.size} محدد` : 'جميع المدن'}
                </span>
              </div>
              <ScrollArea className="h-[140px] border rounded-lg p-3">
                <div className="grid grid-cols-3 gap-2">
                  {availableCities.length === 0 ? (
                    <div className="col-span-3 text-sm text-muted-foreground text-center py-4">
                      جاري تحميل المدن...
                    </div>
                  ) : (
                    availableCities.map((city) => {
                      const checked = selectedCities.has(city);
                      return (
                        <label 
                          key={city} 
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm",
                            checked 
                              ? "bg-blue-50 border-blue-400 text-blue-700" 
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedCities(prev => {
                                const next = new Set(Array.from(prev));
                                if (e.target.checked) next.add(city); else next.delete(city);
                                return next;
                              });
                            }}
                            className="accent-blue-600"
                          />
                          <span>{city}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                💡 إذا لم تختر أي مدينة، ستتمكن الفرقة من التركيب في جميع المدن
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} className="min-w-[100px]">
              <Save className="h-4 w-4 ml-2" />
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Employee Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              إضافة موظف للفرقة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اختر الموظف</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظف..." />
                </SelectTrigger>
                <SelectContent>
                  {allEmployees.length === 0 ? (
                    <SelectItem value="_none" disabled>لا يوجد موظفين متاحين</SelectItem>
                  ) : (
                    allEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.position || 'موظف'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleAssignEmployee} disabled={!selectedEmployeeId}>
                <UserPlus className="h-4 w-4 ml-2" />
                إضافة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الفرقة؟ سيتم إلغاء ربط جميع الموظفين المرتبطين بها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
