import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Save, MapPin, Ruler, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
  created_at?: string;
  updated_at?: string;
}

export default function InstallationTeams() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">فرق التركيبات</h2>
          <p className="text-muted-foreground text-sm">إدارة فرق التركيب وتخصيصاتها</p>
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
                  <TableHead>المقاسات المتخصصة</TableHead>
                  <TableHead>المدن المتخصصة</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{t.team_name}</TableCell>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('ar-LY') : '-'}
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
                ))}
                {teams.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      لا توجد فرق تركيب مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editMode ? 'تعديل فرقة' : 'إضافة فرقة جديدة'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Team Name */}
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

          {/* Footer */}
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

      {/* Delete Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الفرقة؟ سيتم فقدان البيانات نهائياً.
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
