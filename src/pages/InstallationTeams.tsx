import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  created_at?: string;
  updated_at?: string;
}

export default function InstallationTeams() {
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [current, setCurrent] = useState<Partial<InstallationTeam>>({});
  const [sizesInput, setSizesInput] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('installation_teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTeams((data as any) || []);
      // load sizes as well (if not loaded)
      if ((availableSizes || []).length === 0) {
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
    } catch (error: any) {
      console.error('Error loading installation teams:', error);
      toast.error('فشل في تحميل فرق التركيب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const openCreate = () => {
    setEditMode(false);
    setCurrent({ team_name: '', sizes: [] });
    setSizesInput('');
    setSelectedSizes(new Set());
    setDialogOpen(true);
  };

  const openEdit = (team: InstallationTeam) => {
    setEditMode(true);
    setCurrent({ ...team });
    const s = Array.isArray(team.sizes) ? team.sizes : [];
    setSizesInput(s.join(', '));
    setSelectedSizes(new Set(s));
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
        sizes: Array.from(selectedSizes).length > 0 ? Array.from(selectedSizes) : (
          sizesInput && typeof sizesInput === 'string' ? sizesInput.split(',').map(s => s.trim()).filter(Boolean) : []
        )
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">فرقة التركيبات</h2>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> إضافة فرقة
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة فرق التركيب</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>اسم الفرقة</TableHead>
                  <TableHead>المقاسات</TableHead>
                  <TableHead>إنشاء</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{t.team_name}</TableCell>
                    <TableCell>{Array.isArray(t.sizes) ? t.sizes.join(', ') : String(t.sizes)}</TableCell>
                    <TableCell>{t.created_at ? new Date(t.created_at).toLocaleString('ar-LY') : ''}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => confirmDelete(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? 'تعديل فرقة' : 'إضافة فرقة'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>اسم الفرقة</Label>
              <Input value={current?.team_name || ''} onChange={(e) => setCurrent(c => ({ ...c, team_name: e.target.value }))} />
            </div>

            <div>
              <Label>اختر المقاسات التي تستطيع الفرقة تركيبها</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto mt-2 p-2 border rounded">
                {availableSizes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">جاري تحميل المقاسات...</div>
                ) : (
                  availableSizes.map((sz) => {
                    const checked = selectedSizes.has(sz);
                    return (
                      <label key={sz} className="flex items-center gap-2 text-sm">
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
                        />
                        <span>{sz}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="mr-2">إلغاء</Button>
              <Button onClick={handleSave}><Save className="h-4 w-4" /> حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه الفرقة؟ سيتم فقدان البيانات نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
