import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';
import { BillboardImage } from '@/components/BillboardImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';

interface BillboardEditDialogProps {
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  editing: any;
  setEditing: (editing: any) => void;
  editForm: any;
  setEditForm: (form: any) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  imagePreview: string;
  setImagePreview: (preview: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploadingImage: boolean;
  generateImageName: (name: string) => string;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
  billboards: any[]; // ✅ NEW: Add billboards prop for district suggestions
  setMunicipalities: (municipalities: any[]) => void;
  setDbMunicipalities: (municipalities: string[]) => void;
  loadBillboards: () => Promise<void>;
  uploadImageToFolder: (file: File, fileName: string) => Promise<boolean>;
  addMunicipalityIfNew: (name: string, municipalities: any[], setMunicipalities: any, setDbMunicipalities: any) => Promise<void>;
}

export const BillboardEditDialog: React.FC<BillboardEditDialogProps> = ({
  editOpen,
  setEditOpen,
  editing,
  setEditing,
  editForm,
  setEditForm,
  saving,
  setSaving,
  imagePreview,
  setImagePreview,
  selectedFile,
  setSelectedFile,
  uploadingImage,
  generateImageName,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
  billboards = [], // ✅ NEW: Default empty array
  setMunicipalities,
  setDbMunicipalities,
  loadBillboards,
  uploadImageToFolder,
  addMunicipalityIfNew
}) => {
  // ✅ NEW: State for district input and suggestions
  const [districtInput, setDistrictInput] = useState('');
  const [showDistrictSuggestions, setShowDistrictSuggestions] = useState(false);

  // State for partners list from database
  const [partners, setPartners] = useState<Array<{id: string, name: string}>>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  // ✅ NEW: Get unique districts from all billboards
  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    billboards.forEach(billboard => {
      const district = billboard.District || billboard.district;
      if (district && String(district).trim()) {
        districts.add(String(district).trim());
      }
    });
    return Array.from(districts).sort();
  }, [billboards]);

  // ✅ NEW: Filter districts based on input
  const filteredDistricts = useMemo(() => {
    if (!districtInput.trim()) return availableDistricts;
    return availableDistricts.filter(district => 
      district.toLowerCase().includes(districtInput.toLowerCase())
    );
  }, [availableDistricts, districtInput]);

  // Enhanced openEdit function with proper value matching and multiple column name attempts
  const openEdit = (bb: any) => {
    try {
      console.log('Opening edit for billboard:', bb);
      console.log('Available data arrays:', {
        levels: levels,
        faces: faces,
        billboardTypes: billboardTypes
      });
      
      // Try multiple possible column names for faces count
      const facesCountRaw = bb.Faces_Count || bb.faces_count || bb.faces || bb.Number_of_Faces || bb.Faces || bb['Number of Faces'] || bb.face_count || bb.FacesCount || '';
      const facesCount = String(facesCountRaw || '');
      
      // Try multiple possible column names for billboard type
      const billboardType = bb.billboard_type || bb.Billboard_Type || bb.type || bb.Type || bb.board_type || bb.BoardType || bb.ad_type || bb.Ad_Type || '';
      
      // Try multiple possible column names for level
      const level = bb.Level || bb.level || bb.LEVEL || bb.grade || bb.Grade || bb.tier || bb.Tier || '';
      
      // Try multiple possible column names for size
      const size = bb.Size || bb.size || bb.SIZE || bb.dimensions || bb.Dimensions || bb.billboard_size || bb.Billboard_Size || '';
      
      // Try multiple possible column names for municipality
      const municipality = bb.Municipality || bb.municipality || bb.MUNICIPALITY || bb.city_council || bb.City_Council || bb.council || bb.Council || '';
      
      // ✅ NEW: Get district value
      const district = bb.District || bb.district || bb.area || bb.Area || '';
      
      console.log('Extracted values:', {
        facesCount,
        billboardType,
        level,
        size,
        municipality,
        district
      });
      
      // ✅ FIXED: Check if values exist in arrays using both count and face_count
      console.log('Value matching check:', {
        levelExists: levels.includes(level),
        facesExists: faces.some(f => String(f.count) === facesCount || String(f.face_count) === facesCount),
        typeExists: billboardTypes.includes(billboardType)
      });
      
      setEditing(bb);
      setEditForm({
        Billboard_Name: bb.Billboard_Name || bb.name || bb.billboard_name || bb.Name || '',
        City: bb.City || bb.city || bb.CITY || '',
        Municipality: municipality,
        District: district,
        Nearest_Landmark: bb.Nearest_Landmark || bb.location || bb.landmark || bb.Location || bb.nearest_landmark || '',
        GPS_Coordinates: bb.GPS_Coordinates || bb.gps_coordinates || bb.coords || bb.coordinates || bb.GPS || bb.lat_lng || '',
        Faces_Count: facesCount,
        Size: size,
        Status: bb.Status || bb.status || 'available',
        Level: level,
        Contract_Number: bb.contractNumber || bb.Contract_Number || bb.contract_number || '',
        Customer_Name: bb.clientName || bb.Customer_Name || bb.customer_name || bb.client_name || '',
        Ad_Type: bb.adType || bb.Ad_Type || bb.ad_type || bb.advertisement_type || '',
        Image_URL: bb.Image_URL || bb.image || bb.image_url || bb.imageUrl || '',
        image_name: bb.image_name || bb.Image_Name || bb.imageName || '',
        billboard_type: billboardType,
        is_partnership: !!bb.is_partnership,
        partner_companies: bb.partner_companies || bb.partners || bb.partner_company || [],
        capital: bb.capital || bb.Capital || 0,
        capital_remaining: bb.capital_remaining || bb.capitalRemaining || bb.remaining_capital || bb.capital || 0
      });
      
      // ✅ NEW: Set district input
      setDistrictInput(district);
      
      const imageName = bb.image_name || bb.Image_Name || bb.imageName;
      const imageUrl = bb.Image_URL || bb.image || bb.image_url || bb.imageUrl;
      setImagePreview(imageName ? `/image/${imageName}` : (imageUrl || ''));
      
      setEditOpen(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      toast.error('حدث خطأ في فتح نافذة التعديل');
    }
  };

  // Handle image selection
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة صحيح');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        setImagePreview(preview);
      };
      reader.readAsDataURL(file);

      const safeName = editForm.Billboard_Name || '';
      const imageName = generateImageName(safeName);

      setSelectedFile(file);
      setEditForm((prev: any) => ({ 
        ...prev, 
        image_name: imageName,
        Image_URL: prev.Image_URL || `/image/${imageName}`
      }));

      toast.success(`تم اختيار الصورة: ${file.name}. سيتم رفعها عند الحفظ.`);
    }
  };

  // ✅ NEW: Handle district input change
  const handleDistrictInputChange = (value: string) => {
    setDistrictInput(value);
    setEditForm((prev: any) => ({ ...prev, District: value }));
    setShowDistrictSuggestions(value.length > 0);
  };

  // ✅ NEW: Handle district suggestion selection
  const handleDistrictSuggestionSelect = (district: string) => {
    setDistrictInput(district);
    setEditForm((prev: any) => ({ ...prev, District: district }));
    setShowDistrictSuggestions(false);
  };

  // Save edit function
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const id = editing.ID ?? editing.id;
    const { City, Municipality, District, Nearest_Landmark, GPS_Coordinates, Faces_Count, Size, Level, Image_URL, image_name, billboard_type, is_partnership, partner_companies, capital, capital_remaining } = editForm as any;
    
    await addMunicipalityIfNew(Municipality, municipalities, setMunicipalities, setDbMunicipalities);
    
    if (selectedFile && image_name) {
      const uploadSuccess = await uploadImageToFolder(selectedFile, image_name);
      if (!uploadSuccess) {
        setSaving(false);
        return;
      }
    }
    
    const payload: any = { 
      City, 
      Municipality, 
      District, 
      Nearest_Landmark, 
      GPS_Coordinates: GPS_Coordinates || null,
      Faces_Count: Faces_Count ? parseInt(String(Faces_Count)) : null,
      Size, 
      Level, 
      Image_URL,
      image_name,
      billboard_type,
      is_partnership: !!is_partnership, 
      partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean), 
      capital: Number(capital)||0, 
      capital_remaining: Number(capital_remaining)||Number(capital)||0 
    };

    console.log('🔧 Saving edit payload:', payload);

    const { error } = await supabase.from('billboards').update(payload).eq('ID', Number(id));

    if (error) {
      console.error('❌ Error saving edit:', error);
      toast.error(`فشل حفظ التعديلات: ${error.message}`);
    } else {
      toast.success('تم حفظ التعديلات');
      try {
        await loadBillboards();
      } catch {}
      setEditOpen(false);
      setEditing(null);
      setImagePreview('');
      setSelectedFile(null);
    }
    setSaving(false);
  };

  // Load partners from database
  useEffect(() => {
    const loadPartners = async () => {
      setLoadingPartners(true);
      try {
        const { data, error } = await supabase
          .from('partners')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setPartners(data || []);
      } catch (error) {
        console.error('Error loading partners:', error);
        toast.error('فشل تحميل قائمة الشركاء');
      } finally {
        setLoadingPartners(false);
      }
    };

    if (editOpen) {
      loadPartners();
    }
  }, [editOpen]);

  // Update image name when billboard name changes
  useEffect(() => {
    if (editForm.Billboard_Name && selectedFile && editForm.image_name && !editForm.image_name.includes(editForm.Billboard_Name)) {
      const imageName = generateImageName(editForm.Billboard_Name);
      setEditForm((prev: any) => ({ ...prev, image_name: imageName, Image_URL: `/image/${imageName}` }));
    }
  }, [editForm.Billboard_Name, selectedFile]);

  // Auto-open edit dialog when editing prop changes
  useEffect(() => {
    if (editing && !editOpen) {
      openEdit(editing);
    }
  }, [editing]);

  const districts = [...new Set(municipalities.map(m => m.district).filter(Boolean))];

  return (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">تعديل اللوحة</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-foreground">الاسم (غير قابل للتعديل)</Label>
            <Input 
              value={editForm.Billboard_Name || ''} 
              disabled 
              className="bg-muted cursor-not-allowed text-sm text-muted-foreground border-border"
              title="اسم اللوحة غير قابل للتعديل"
            />
          </div>
          <div>
            <Label className="text-foreground">المدينة</Label>
            <Select value={editForm.City || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, City: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {citiesList.filter(c => c && String(c).trim()).map((c) => (
                  <SelectItem key={c} value={c as string} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">البلدية</Label>
            <Select value={editForm.Municipality || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Municipality: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر البلدية" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {municipalities.filter(m => m && m.id && m.name && String(m.name).trim()).map((m) => (
                  <SelectItem key={m.id} value={m.name} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label className="text-foreground">أقرب معلم</Label>
            <Input 
              className="text-sm bg-input border-border text-foreground" 
              value={editForm.Nearest_Landmark || ''} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} 
            />
          </div>
          <div className="relative">
            <Label className="text-foreground">المنطقة</Label>
            <Input 
              className="text-sm bg-input border-border text-foreground" 
              value={districtInput} 
              onChange={(e) => handleDistrictInputChange(e.target.value)}
              onFocus={() => setShowDistrictSuggestions(districtInput.length > 0)}
              onBlur={() => setTimeout(() => setShowDistrictSuggestions(false), 200)}
              placeholder="اكتب لعرض المناطق المتاحة" 
            />
            {/* ✅ NEW: District suggestions dropdown */}
            {showDistrictSuggestions && filteredDistricts.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-lg">
                {filteredDistricts.map((district) => (
                  <div
                    key={district}
                    className="cursor-pointer px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    onMouseDown={() => handleDistrictSuggestionSelect(district)}
                  >
                    {district}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-foreground">الإحداثيات</Label>
            <Input 
              className="text-sm bg-input border-border text-foreground" 
              value={editForm.GPS_Coordinates || ''} 
              onChange={(e) => setEditForm((p: any) => ({ ...p, GPS_Coordinates: e.target.value }))} 
              placeholder="lat, lng" 
            />
          </div>
          <div>
            <Label className="text-foreground">عدد الأوجه</Label>
            <Select value={String(editForm.Faces_Count || '')} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Faces_Count: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر عدد الأوجه">
                  {editForm.Faces_Count ? 
                    faces.find(f => String(f.count) === String(editForm.Faces_Count) || String(f.face_count) === String(editForm.Faces_Count))?.name || editForm.Faces_Count
                    : "اختر عدد الأوجه"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {faces.filter(face => face && face.id && (face.count != null || face.face_count != null)).map((face) => {
                  // ✅ FIXED: Use both count and face_count fields
                  const faceCount = face.count || face.face_count;
                  return (
                    <SelectItem key={face.id} value={String(faceCount)} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                      {face.name} ({faceCount} {faceCount === 1 ? 'وجه' : faceCount === 2 ? 'وجهين' : 'أوجه'})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">المقاس</Label>
            <Select value={editForm.Size || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Size: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر المقاس" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {sizes.filter(s => s && s.id && s.name && String(s.name).trim()).map((s) => (
                  <SelectItem key={s.id} value={s.name} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">المستوى</Label>
            <Select value={editForm.Level || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Level: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر المستوى">
                  {editForm.Level || "اختر المستوى"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {levels.filter(lv => lv && String(lv).trim()).length > 0 ? (
                  levels.filter(lv => lv && String(lv).trim()).map((lv) => (
                    <SelectItem key={lv} value={lv} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                      {lv}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="placeholder" disabled className="text-muted-foreground">لا توجد مستويات متاحة</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">نوع اللوحة</Label>
            <Select value={editForm.billboard_type || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, billboard_type: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر نوع اللوحة">
                  {editForm.billboard_type || "اختر نوع اللوحة"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {billboardTypes.filter(type => type && String(type).trim()).length > 0 ? (
                  billboardTypes.filter(type => type && String(type).trim()).map((type) => (
                    <SelectItem key={type} value={type} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                      {type}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="placeholder" disabled className="text-muted-foreground">لا توجد أنواع لوحات متاحة</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Compact Image Upload Section */}
          <div className="lg:col-span-3">
            <Label className="flex items-center gap-2 text-sm text-foreground">
              <Upload className="h-4 w-4" />
              صورة اللوحة
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={uploadingImage}
                  className="text-sm bg-input border-border text-foreground"
                />
                <Input
                  placeholder="رابط الصورة (احتياطي)"
                  value={editForm.Image_URL || ''}
                  onChange={(e) => setEditForm((p: any) => ({ ...p, Image_URL: e.target.value }))}
                  className="text-sm bg-input border-border text-foreground"
                />
              </div>
              {imagePreview && (
                <div className="w-full h-32 bg-muted rounded-lg overflow-hidden border border-border">
                  <BillboardImage 
                    billboard={editForm}
                    className="w-full h-full object-cover"
                    alt="معاينة الصورة"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-foreground">لوحة شراكة</Label>
              <input 
                type="checkbox" 
                checked={!!editForm.is_partnership} 
                onChange={(e)=> setEditForm((p:any)=>({...p, is_partnership: e.target.checked}))} 
                className="accent-primary"
              />
            </div>
          </div>

          {editForm.is_partnership && (
            <>
              <div className="lg:col-span-2">
                <Label className="text-sm text-foreground">الشركات المشاركة</Label>
                {loadingPartners ? (
                  <div className="text-sm text-muted-foreground">جاري تحميل الشركاء...</div>
                ) : (
                  <Select
                    value={Array.isArray(editForm.partner_companies) && editForm.partner_companies.length > 0 ? editForm.partner_companies[0] : ''}
                    onValueChange={(v) => {
                      const currentPartners = Array.isArray(editForm.partner_companies) ? editForm.partner_companies : [];
                      if (v && !currentPartners.includes(v)) {
                        setEditForm((p: any) => ({ ...p, partner_companies: [...currentPartners, v] }));
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm bg-input border-border text-foreground">
                      <SelectValue placeholder="اختر الشركات المشاركة">
                        {Array.isArray(editForm.partner_companies) && editForm.partner_companies.length > 0
                          ? editForm.partner_companies.join(', ')
                          : 'اختر الشركات المشاركة'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {partners.map((partner) => (
                        <SelectItem
                          key={partner.id}
                          value={partner.name}
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {Array.isArray(editForm.partner_companies) && editForm.partner_companies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editForm.partner_companies.map((partner: string, idx: number) => (
                      <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm">
                        <span>{partner}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPartners = editForm.partner_companies.filter((_: any, i: number) => i !== idx);
                            setEditForm((p: any) => ({ ...p, partner_companies: newPartners }));
                          }}
                          className="ml-1 text-destructive hover:text-destructive/80"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm text-foreground">رأس مال اللوحة</Label>
                <Input 
                  className="text-sm bg-input border-border text-foreground" 
                  type="number" 
                  value={editForm.capital || 0} 
                  onChange={(e)=> setEditForm((p:any)=>({...p, capital: Number(e.target.value)}))} 
                />
              </div>
              <div className="lg:col-span-2">
                <Label className="text-sm text-foreground">المتبقي من رأس المال</Label>
                <Input 
                  className="text-sm bg-input border-border text-foreground" 
                  type="number" 
                  value={editForm.capital_remaining || editForm.capital || 0} 
                  onChange={(e)=> setEditForm((p:any)=>({...p, capital_remaining: Number(e.target.value)}))} 
                />
              </div>
            </>
          )}

        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => {
            setEditOpen(false);
            setImagePreview('');
            setSelectedFile(null);
          }} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">إلغاء</Button>
          <Button onClick={saveEdit} disabled={saving || uploadingImage} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? 'جارٍ الحفظ...' : uploadingImage ? 'جاري رفع الصورة...' : 'حفظ'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};