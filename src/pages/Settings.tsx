// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Monitor, Layers, Tag, Save, X, MapPin, RefreshCw, DollarSign, Ruler, Image, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardSize {
  id: number;
  name: string;
  width: number;
  height: number;
  description?: string;
  installation_price: number;
  sort_order: number;
  created_at: string;
}

interface BillboardFaces {
  id: number;
  name: string;
  count: number;
  description?: string;
  created_at: string;
}

interface BillboardType {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

interface Municipality {
  id: number;
  name: string;
  code: string;
  logo_url?: string;
  sort_order: number;
  created_at: string;
}

export default function BillboardSettings() {
  const [sizes, setSizes] = useState<BillboardSize[]>([]);
  const [faces, setFaces] = useState<BillboardFaces[]>([]);
  const [types, setTypes] = useState<BillboardType[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Dialog states
  const [sizeDialog, setSizeDialog] = useState(false);
  const [faceDialog, setFaceDialog] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false);
  const [municipalityDialog, setMunicipalityDialog] = useState(false);
  
  // Form states - Updated to include sort_order
  const [sizeForm, setSizeForm] = useState({ 
    id: 0, 
    name: '', 
    width: 0, 
    height: 0, 
    description: '', 
    installation_price: 0,
    sort_order: 999
  });
  const [faceForm, setFaceForm] = useState({ id: 0, name: '', count: 1, description: '' });
  const [typeForm, setTypeForm] = useState({ id: 0, name: '', description: '', color: '#3B82F6' });
  const [municipalityForm, setMunicipalityForm] = useState({ id: 0, name: '', code: '', logo_url: '', sort_order: 999 });
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  
  const [editMode, setEditMode] = useState(false);

  // ✅ Check if sort_order is unique for sizes
  const isSortOrderUnique = async (sortOrder: number, excludeId?: number): Promise<boolean> => {
    try {
      let query = supabase
        .from('sizes')
        .select('id')
        .eq('sort_order', sortOrder);
      
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking sort order uniqueness:', error);
      return false;
    }
  };

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 بدء تحميل بيانات إعدادات اللوحات...');
      
      // ✅ Load sizes from sizes table with sort_order
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (sizesError) {
        console.error('❌ خطأ في تحميل الأحجام من جدول sizes:', sizesError);
        toast.error('فشل في تحميل أحجام اللوحات');
      } else {
        console.log('✅ تم تحميل الأحجام من جدول sizes:', sizesData?.length || 0, 'حجم');
        setSizes(sizesData || []);
      }

      // Load faces from billboard_faces table
      const { data: facesData, error: facesError } = await supabase
        .from('billboard_faces')
        .select('*')
        .order('id', { ascending: true });

      if (facesError) {
        console.error('❌ خطأ في تحميل الأوجه:', facesError);
        toast.error('فشل في تحميل عدد الأوجه');
      } else {
        console.log('✅ تم تحميل الأوجه:', facesData?.length || 0, 'نوع');
        setFaces(facesData || []);
      }

      // Load types from billboard_types table
      const { data: typesData, error: typesError } = await supabase
        .from('billboard_types')
        .select('*')
        .order('id', { ascending: true });

      if (typesError) {
        console.error('❌ خطأ في تحميل الأنواع:', typesError);
        toast.error('فشل في تحميل أنواع اللوحات');
      } else {
        console.log('✅ تم تحميل الأنواع:', typesData?.length || 0, 'نوع');
        setTypes(typesData || []);
      }

      // Load municipalities
      const { data: municipalitiesData, error: municipalitiesError } = await supabase
        .from('municipalities')
        .select('*')
        .order('sort_order', { ascending: true });

      if (municipalitiesError) {
        console.error('❌ خطأ في تحميل البلديات:', municipalitiesError);
        toast.error('فشل في تحميل البلديات');
      } else {
        console.log('✅ تم تحميل البلديات:', municipalitiesData?.length || 0, 'بلدية');
        setMunicipalities(municipalitiesData || []);
      }

      console.log('🎉 تم الانتهاء من تحميل جميع بيانات الإعدادات');

    } catch (error) {
      console.error('💥 خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync municipalities from billboards table
  const syncMunicipalitiesFromBillboards = async () => {
    setSyncing(true);
    try {
      console.log('Starting sync process...');
      
      // Get unique municipalities from billboards
      const { data: billboardData, error: billboardError } = await supabase
        .from('billboards')
        .select('Municipality')
        .not('Municipality', 'is', null);

      if (billboardError) {
        console.error('Billboard error:', billboardError);
        throw billboardError;
      }

      const uniqueMunicipalities = [...new Set(
        (billboardData || [])
          .map((b: any) => b.Municipality)
          .filter(Boolean)
          .map((m: string) => m.trim())
      )];

      // Get existing municipalities
      const { data: existingMunicipalities, error: existingError } = await supabase
        .from('municipalities')
        .select('name');

      if (existingError) {
        throw existingError;
      }

      const existingNames = new Set((existingMunicipalities || []).map((m: any) => m.name));

      // Find new municipalities to add
      const newMunicipalities = uniqueMunicipalities.filter(name => !existingNames.has(name));

      if (newMunicipalities.length === 0) {
        toast.success('جميع البلديات موجودة بالفعل');
        return;
      }

      // Add new municipalities
      const municipalitiesToInsert = newMunicipalities.map((name, index) => ({
        name: name,
        code: `AUTO-${String(municipalities.length + index + 1).padStart(3, '0')}`
      }));

      const { error: insertError } = await supabase
        .from('municipalities')
        .insert(municipalitiesToInsert);

      if (insertError) {
        throw insertError;
      }

      toast.success(`تم إضافة ${newMunicipalities.length} بلدية جديدة`);
      await loadData(); // Reload the list

    } catch (error: any) {
      console.error('Error syncing municipalities:', error);
      toast.error(`فشل في مزامنة البلديات: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setSyncing(false);
    }
  };

  // ✅ Size functions - Updated to include sort_order validation
  const handleSizeSubmit = async () => {
    try {
      if (!sizeForm.name || sizeForm.width <= 0 || sizeForm.height <= 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (sizeForm.installation_price < 0) {
        toast.error('سعر التركيب لا يمكن أن يكون سالباً');
        return;
      }

      // ✅ Check if sort_order is unique
      const isUnique = await isSortOrderUnique(sizeForm.sort_order, editMode ? sizeForm.id : undefined);
      if (!isUnique) {
        toast.error(`رقم الترتيب ${sizeForm.sort_order} مستخدم بالفعل. يرجى اختيار رقم آخر.`);
        return;
      }

      if (editMode) {
        const { error } = await supabase
          .from('sizes')
          .update({
            name: sizeForm.name,
            width: sizeForm.width,
            height: sizeForm.height,
            description: sizeForm.description,
            installation_price: sizeForm.installation_price,
            sort_order: sizeForm.sort_order
          })
          .eq('id', sizeForm.id);

        if (error) throw error;
        toast.success('تم تحديث الحجم بنجاح');
      } else {
        const { error } = await supabase
          .from('sizes')
          .insert({
            name: sizeForm.name,
            width: sizeForm.width,
            height: sizeForm.height,
            description: sizeForm.description,
            installation_price: sizeForm.installation_price,
            sort_order: sizeForm.sort_order
          });

        if (error) throw error;
        toast.success('تم إضافة الحجم بنجاح');
      }

      setSizeDialog(false);
      setSizeForm({ id: 0, name: '', width: 0, height: 0, description: '', installation_price: 0, sort_order: 999 });
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Error saving size:', error);
      toast.error('حدث خطأ في حفظ الحجم');
    }
  };

  const handleSizeEdit = (size: BillboardSize) => {
    setSizeForm({
      id: size.id,
      name: size.name,
      width: size.width,
      height: size.height,
      description: size.description || '',
      installation_price: size.installation_price || 0,
      sort_order: size.sort_order || 999
    });
    setEditMode(true);
    setSizeDialog(true);
  };

  const handleSizeDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('sizes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف الحجم بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting size:', error);
      toast.error('حدث خطأ في حذف الحجم');
    }
  };

  // Face functions
  const handleFaceSubmit = async () => {
    try {
      if (!faceForm.name || faceForm.count <= 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (editMode) {
        const { error } = await supabase
          .from('billboard_faces')
          .update({
            name: faceForm.name,
            count: faceForm.count,
            description: faceForm.description
          })
          .eq('id', faceForm.id);

        if (error) throw error;
        toast.success('تم تحديث عدد الأوجه بنجاح');
      } else {
        const { error } = await supabase
          .from('billboard_faces')
          .insert({
            name: faceForm.name,
            count: faceForm.count,
            description: faceForm.description
          });

        if (error) throw error;
        toast.success('تم إضافة عدد الأوجه بنجاح');
      }

      setFaceDialog(false);
      setFaceForm({ id: 0, name: '', count: 1, description: '' });
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Error saving face:', error);
      toast.error('حدث خطأ في حفظ عدد الأوجه');
    }
  };

  const handleFaceEdit = (face: BillboardFaces) => {
    setFaceForm({
      id: face.id,
      name: face.name,
      count: face.count,
      description: face.description || ''
    });
    setEditMode(true);
    setFaceDialog(true);
  };

  const handleFaceDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('billboard_faces')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف عدد الأوجه بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting face:', error);
      toast.error('حدث خطأ في حذف عدد الأوجه');
    }
  };

  // Type functions
  const handleTypeSubmit = async () => {
    try {
      if (!typeForm.name) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (editMode) {
        const { error } = await supabase
          .from('billboard_types')
          .update({
            name: typeForm.name,
            description: typeForm.description,
            color: typeForm.color
          })
          .eq('id', typeForm.id);

        if (error) throw error;
        toast.success('تم تحديث النوع بنجاح');
      } else {
        const { error } = await supabase
          .from('billboard_types')
          .insert({
            name: typeForm.name,
            description: typeForm.description,
            color: typeForm.color
          });

        if (error) throw error;
        toast.success('تم إضافة النوع بنجاح');
      }

      setTypeDialog(false);
      setTypeForm({ id: 0, name: '', description: '', color: '#3B82F6' });
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Error saving type:', error);
      toast.error('حدث خطأ في حفظ النوع');
    }
  };

  const handleTypeEdit = (type: BillboardType) => {
    setTypeForm({
      id: type.id,
      name: type.name,
      description: type.description || '',
      color: type.color || '#3B82F6'
    });
    setEditMode(true);
    setTypeDialog(true);
  };

  const handleTypeDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('billboard_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف النوع بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting type:', error);
      toast.error('حدث خطأ في حذف النوع');
    }
  };

  // Municipality functions
  const isMunicipalitySortOrderUnique = async (sortOrder: number, excludeId?: number): Promise<boolean> => {
    try {
      let query = supabase
        .from('municipalities')
        .select('id')
        .eq('sort_order', sortOrder);
      
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking municipality sort order uniqueness:', error);
      return false;
    }
  };

  const handleMunicipalitySubmit = async () => {
    try {
      if (!municipalityForm.name.trim() || !municipalityForm.code.trim()) {
        toast.error('يرجى إدخال اسم البلدية والكود');
        return;
      }

      // التحقق من عدم تكرار الترتيب
      const isUnique = await isMunicipalitySortOrderUnique(municipalityForm.sort_order, editMode ? municipalityForm.id : undefined);
      if (!isUnique) {
        toast.error(`رقم الترتيب ${municipalityForm.sort_order} مستخدم بالفعل. يرجى اختيار رقم آخر.`);
        return;
      }

      if (editMode) {
        const { error } = await supabase
          .from('municipalities')
          .update({
            name: municipalityForm.name.trim(),
            code: municipalityForm.code.trim(),
            logo_url: municipalityForm.logo_url.trim() || null,
            sort_order: municipalityForm.sort_order
          })
          .eq('id', municipalityForm.id);

        if (error) throw error;
        toast.success('تم تحديث البلدية بنجاح');
      } else {
        const { error } = await supabase
          .from('municipalities')
          .insert({
            name: municipalityForm.name.trim(),
            code: municipalityForm.code.trim(),
            logo_url: municipalityForm.logo_url.trim() || null,
            sort_order: municipalityForm.sort_order
          });

        if (error) throw error;
        toast.success('تم إضافة البلدية بنجاح');
      }

      setMunicipalityDialog(false);
      setMunicipalityForm({ id: 0, name: '', code: '', logo_url: '', sort_order: 999 });
      setLogoPreviewError(false);
      setEditMode(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving municipality:', error);
      toast.error(`فشل في حفظ البلدية: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  const handleMunicipalityEdit = (municipality: Municipality) => {
    setMunicipalityForm({
      id: municipality.id,
      name: municipality.name,
      code: municipality.code,
      logo_url: municipality.logo_url || '',
      sort_order: municipality.sort_order || 999
    });
    setLogoPreviewError(false);
    setEditMode(true);
    setMunicipalityDialog(true);
  };

  const handleMunicipalityDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('municipalities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف البلدية بنجاح');
      loadData();
    } catch (error: any) {
      console.error('Error deleting municipality:', error);
      toast.error(`فشل في حذف البلدية: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل إعدادات اللوحات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header">إعدادات اللوحات الإعلانية</h1>
          <p className="text-muted">إدارة أحجام وأنواع وأوجه اللوحات الإعلانية والبلديات مع ترتيب المقاسات</p>
        </div>
        <Button onClick={loadData} variant="outline">
          تحديث البيانات
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sizes" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="sizes" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            أحجام اللوحات ({sizes.length})
          </TabsTrigger>
          <TabsTrigger value="faces" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            عدد الأوجه ({faces.length})
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            أنواع اللوحات ({types.length})
          </TabsTrigger>
          <TabsTrigger value="municipalities" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            البلديات ({municipalities.length})
          </TabsTrigger>
        </TabsList>

        {/* ✅ Sizes Tab - Updated with sort_order */}
        <TabsContent value="sizes">
          <Card className="expenses-preview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="expenses-preview-title">
                  <Ruler className="inline-block ml-2 h-5 w-5" />
                  إدارة أحجام اللوحات ({sizes.length} حجم)
                </CardTitle>
                <Dialog open={sizeDialog} onOpenChange={setSizeDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setSizeForm({ id: 0, name: '', width: 0, height: 0, description: '', installation_price: 0, sort_order: 999 });
                        setEditMode(false);
                      }}
                      className="btn-primary"
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة حجم جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="expenses-dialog-content">
                    <DialogHeader>
                      <DialogTitle>
                        {editMode ? 'تعديل الحجم' : 'إضافة حجم جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="expenses-dialog-form">
                      <div>
                        <Label className="expenses-form-label">اسم الحجم *</Label>
                        <Input
                          value={sizeForm.name}
                          onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })}
                          placeholder="مثال: 13x5، 12x4، 10x4"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="expenses-form-label">العرض (متر) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={sizeForm.width || ''}
                            onChange={(e) => setSizeForm({ ...sizeForm, width: parseFloat(e.target.value) || 0 })}
                            placeholder="3.0"
                          />
                        </div>
                        <div>
                          <Label className="expenses-form-label">الارتفاع (متر) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={sizeForm.height || ''}
                            onChange={(e) => setSizeForm({ ...sizeForm, height: parseFloat(e.target.value) || 0 })}
                            placeholder="4.0"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="expenses-form-label">
                          ترتيب المقاس *
                          <span className="text-xs text-muted-foreground block mt-1">
                            رقم الترتيب يجب أن يكون فريد (لا يمكن تكراره)
                          </span>
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={sizeForm.sort_order}
                          onChange={(e) => setSizeForm({ ...sizeForm, sort_order: parseInt(e.target.value) || 999 })}
                          placeholder="رقم الترتيب (1-999)"
                        />
                      </div>
                      <div>
                        <Label className="expenses-form-label">سعر التركيب (د.ل)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={sizeForm.installation_price || ''}
                            onChange={(e) => setSizeForm({ ...sizeForm, installation_price: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="expenses-form-label">الوصف</Label>
                        <Input
                          value={sizeForm.description}
                          onChange={(e) => setSizeForm({ ...sizeForm, description: e.target.value })}
                          placeholder="وصف اختياري للحجم"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleSizeSubmit} className="flex-1">
                          <Save className="h-4 w-4 ml-1" />
                          {editMode ? 'تحديث' : 'إضافة'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setSizeDialog(false)}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 ml-1" />
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {sizes.length === 0 ? (
                <div className="expenses-empty-state">
                  <p>لا توجد أحجام مضافة</p>
                </div>
              ) : (
                <div className="expenses-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الترتيب</TableHead>
                        <TableHead className="text-right">اسم الحجم</TableHead>
                        <TableHead className="text-right">الأبعاد</TableHead>
                        <TableHead className="text-right">المساحة</TableHead>
                        <TableHead className="text-right">سعر التركيب</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sizes.map((size) => (
                        <TableRow key={size.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-bold text-blue">
                              {size.sort_order}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{size.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {size.width} × {size.height} متر
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {(size.width * size.height).toFixed(1)} م²
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              {(size.installation_price || 0).toLocaleString('ar-LY')} د.ل
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {size.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSizeEdit(size)}
                                className="card-hover"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف الحجم "{size.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleSizeDelete(size.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faces Tab */}
        <TabsContent value="faces">
          <Card className="expenses-preview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="expenses-preview-title">
                  <Layers className="inline-block ml-2 h-5 w-5" />
                  إدارة عدد الأوجه ({faces.length} نوع)
                </CardTitle>
                <Dialog open={faceDialog} onOpenChange={setFaceDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setFaceForm({ id: 0, name: '', count: 1, description: '' });
                        setEditMode(false);
                      }}
                      className="btn-primary"
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة عدد أوجه جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="expenses-dialog-content">
                    <DialogHeader>
                      <DialogTitle>
                        {editMode ? 'تعديل عدد الأوجه' : 'إضافة عدد أوجه جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="expenses-dialog-form">
                      <div>
                        <Label className="expenses-form-label">اسم النوع *</Label>
                        <Input
                          value={faceForm.name}
                          onChange={(e) => setFaceForm({ ...faceForm, name: e.target.value })}
                          placeholder="مثال: وجه واحد، وجهين، ثلاثة أوجه"
                        />
                      </div>
                      <div>
                        <Label className="expenses-form-label">عدد الأوجه *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={faceForm.count || ''}
                          onChange={(e) => setFaceForm({ ...faceForm, count: parseInt(e.target.value) || 1 })}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label className="expenses-form-label">الوصف</Label>
                        <Input
                          value={faceForm.description}
                          onChange={(e) => setFaceForm({ ...faceForm, description: e.target.value })}
                          placeholder="وصف اختياري لعدد الأوجه"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleFaceSubmit} className="flex-1">
                          <Save className="h-4 w-4 ml-1" />
                          {editMode ? 'تحديث' : 'إضافة'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setFaceDialog(false)}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 ml-1" />
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {faces.length === 0 ? (
                <div className="expenses-empty-state">
                  <p>لا توجد أنواع أوجه مضافة</p>
                </div>
              ) : (
                <div className="expenses-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم النوع</TableHead>
                        <TableHead className="text-right">عدد الأوجه</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faces.map((face) => (
                        <TableRow key={face.id}>
                          <TableCell className="font-medium">{face.name}</TableCell>
                          <TableCell>
                            <Badge variant="default">
                              {face.count} {face.count === 1 ? 'وجه' : face.count === 2 ? 'وجهين' : 'أوجه'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {face.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFaceEdit(face)}
                                className="card-hover"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف نوع الأوجه "{face.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleFaceDelete(face.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types">
          <Card className="expenses-preview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="expenses-preview-title">
                  <Tag className="inline-block ml-2 h-5 w-5" />
                  إدارة أنواع اللوحات ({types.length} نوع)
                </CardTitle>
                <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setTypeForm({ id: 0, name: '', description: '', color: '#3B82F6' });
                        setEditMode(false);
                      }}
                      className="btn-primary"
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة نوع جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="expenses-dialog-content">
                    <DialogHeader>
                      <DialogTitle>
                        {editMode ? 'تعديل النوع' : 'إضافة نوع جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="expenses-dialog-form">
                      <div>
                        <Label className="expenses-form-label">اسم النوع *</Label>
                        <Input
                          value={typeForm.name}
                          onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                          placeholder="مثال: LED، تقليدي، رقمي"
                        />
                      </div>
                      <div>
                        <Label className="expenses-form-label">لون التمييز</Label>
                        <Input
                          type="color"
                          value={typeForm.color}
                          onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="expenses-form-label">الوصف</Label>
                        <Input
                          value={typeForm.description}
                          onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                          placeholder="وصف اختياري للنوع"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleTypeSubmit} className="flex-1">
                          <Save className="h-4 w-4 ml-1" />
                          {editMode ? 'تحديث' : 'إضافة'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setTypeDialog(false)}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 ml-1" />
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {types.length === 0 ? (
                <div className="expenses-empty-state">
                  <p>لا توجد أنواع مضافة</p>
                </div>
              ) : (
                <div className="expenses-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم النوع</TableHead>
                        <TableHead className="text-right">اللون</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {types.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: type.color }}
                              />
                              <Badge 
                                variant="outline"
                                style={{ 
                                  borderColor: type.color,
                                  color: type.color 
                                }}
                              >
                                {type.name}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {type.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTypeEdit(type)}
                                className="card-hover"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف النوع "{type.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleTypeDelete(type.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Municipalities Tab */}
        <TabsContent value="municipalities">
          <Card className="expenses-preview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="expenses-preview-title">
                  <MapPin className="inline-block ml-2 h-5 w-5" />
                  إدارة البلديات ({municipalities.length} بلدية)
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={syncMunicipalitiesFromBillboards}
                    disabled={syncing}
                    variant="outline"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ml-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'جاري المزامنة...' : 'مزامنة من اللوحات'}
                  </Button>
                  <Dialog open={municipalityDialog} onOpenChange={setMunicipalityDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setMunicipalityForm({ id: 0, name: '', code: '', logo_url: '', sort_order: municipalities.length + 1 });
                          setLogoPreviewError(false);
                          setEditMode(false);
                        }}
                        className="btn-primary"
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة بلدية جديدة
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="expenses-dialog-content">
                      <DialogHeader>
                        <DialogTitle>
                          {editMode ? 'تعديل البلدية' : 'إضافة بلدية جديدة'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="expenses-dialog-form space-y-4">
                        <div>
                          <Label className="expenses-form-label">اسم البلدية *</Label>
                          <Input
                            value={municipalityForm.name}
                            onChange={(e) => setMunicipalityForm({ ...municipalityForm, name: e.target.value })}
                            placeholder="مثال: الرياض، جدة، الدمام"
                          />
                        </div>
                        <div>
                          <Label className="expenses-form-label">كود البلدية *</Label>
                          <Input
                            value={municipalityForm.code}
                            onChange={(e) => setMunicipalityForm({ ...municipalityForm, code: e.target.value })}
                            placeholder="مثال: RYD، JED، DMM"
                          />
                        </div>
                        <div>
                          <Label className="expenses-form-label">الترتيب *</Label>
                          <Input
                            type="number"
                            value={municipalityForm.sort_order}
                            onChange={(e) => setMunicipalityForm({ ...municipalityForm, sort_order: parseInt(e.target.value) || 999 })}
                            placeholder="مثال: 1، 2، 3"
                            min={1}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            الترتيبات المستخدمة: {municipalities.filter(m => m.id !== municipalityForm.id).map(m => m.sort_order).sort((a,b) => a-b).slice(0, 10).join(', ')}{municipalities.length > 10 ? '...' : ''}
                          </p>
                        </div>
                        <div>
                          <Label className="expenses-form-label flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            رابط شعار البلدية
                          </Label>
                          <Input
                            value={municipalityForm.logo_url}
                            onChange={(e) => {
                              setMunicipalityForm({ ...municipalityForm, logo_url: e.target.value });
                              setLogoPreviewError(false);
                            }}
                            placeholder="https://example.com/logo.svg أو .png أو .jpg"
                            className="text-left dir-ltr"
                          />
                          {municipalityForm.logo_url && (
                            <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                              <Label className="text-xs text-muted-foreground mb-2 block">معاينة الشعار:</Label>
                              {logoPreviewError ? (
                                <div className="flex items-center justify-center h-16 text-destructive text-sm">
                                  <X className="h-4 w-4 ml-1" />
                                  فشل تحميل الصورة - تأكد من صحة الرابط
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <img
                                    src={municipalityForm.logo_url}
                                    alt="معاينة الشعار"
                                    className="max-h-16 max-w-full object-contain"
                                    onError={() => setLogoPreviewError(true)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button onClick={handleMunicipalitySubmit} className="flex-1">
                            <Save className="h-4 w-4 ml-1" />
                            {editMode ? 'تحديث' : 'إضافة'}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setMunicipalityDialog(false)}
                            className="flex-1"
                          >
                            <X className="h-4 w-4 ml-1" />
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {municipalities.length === 0 ? (
                <div className="expenses-empty-state">
                  <p>لا توجد بلديات مضافة. استخدم زر المزامنة لإضافة البلديات من اللوحات الموجودة.</p>
                </div>
              ) : (
                <div className="expenses-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الشعار</TableHead>
                        <TableHead className="text-right w-16">الترتيب</TableHead>
                        <TableHead className="text-right">اسم البلدية</TableHead>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">تاريخ الإضافة</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {municipalities.map((municipality) => (
                        <TableRow key={municipality.id}>
                          <TableCell className="font-bold text-primary text-center">
                            {municipality.sort_order}
                          </TableCell>
                          <TableCell>
                            {municipality.logo_url ? (
                              <div className="w-10 h-10 rounded-md border bg-background flex items-center justify-center overflow-hidden">
                                <img
                                  src={municipality.logo_url}
                                  alt={`شعار ${municipality.name}`}
                                  className="max-w-full max-h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                <Image className="h-5 w-5 text-muted-foreground hidden" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-md border bg-muted/50 flex items-center justify-center">
                                <Image className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{municipality.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{municipality.code}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(municipality.created_at).toLocaleDateString('ar-SA')}
                          </TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMunicipalityEdit(municipality)}
                                className="card-hover"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف البلدية "{municipality.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleMunicipalityDelete(municipality.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}