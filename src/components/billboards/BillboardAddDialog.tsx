import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardAddDialogProps {
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  addForm: any;
  setAddForm: (form: any) => void;
  adding: boolean;
  setAdding: (adding: boolean) => void;
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
  setSizes: (sizes: any[]) => void;
  setLevels: (levels: string[]) => void;
  setBillboardTypes: (types: string[]) => void;
  setDbMunicipalities: (municipalities: string[]) => void;
  setDbSizes: (sizes: string[]) => void;
  loadBillboards: () => Promise<void>;
  uploadImageToFolder: (file: File, fileName: string) => Promise<boolean>;
  addMunicipalityIfNew: (name: string, municipalities: any[], setMunicipalities: any, setDbMunicipalities: any) => Promise<void>;
  addSizeIfNew: (sizeName: string, level: string, sizes: any[], setSizes: any, setDbSizes: any) => Promise<void>;
  addLevelIfNew: (level: string, levels: string[], setLevels: any) => Promise<void>;
  addBillboardTypeIfNew: (typeName: string, billboardTypes: string[], setBillboardTypes: any) => Promise<void>;
}

export const BillboardAddDialog: React.FC<BillboardAddDialogProps> = ({
  addOpen,
  setAddOpen,
  addForm,
  setAddForm,
  adding,
  setAdding,
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
  setSizes,
  setLevels,
  setBillboardTypes,
  setDbMunicipalities,
  setDbSizes,
  loadBillboards,
  uploadImageToFolder,
  addMunicipalityIfNew,
  addSizeIfNew,
  addLevelIfNew,
  addBillboardTypeIfNew
}) => {
  // ✅ NEW: State for district input and suggestions
  const [districtInput, setDistrictInput] = useState('');
  const [showDistrictSuggestions, setShowDistrictSuggestions] = useState(false);

  // ✅ NEW: Partners options
  const [partnersOptions, setPartnersOptions] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    const loadPartners = async () => {
      try {
        const { data, error } = await supabase.from('partners').select('name').order('name');
        if (!error) {
          const opts = (data || [])
            .map((p: any) => String(p?.name || '').trim())
            .filter(Boolean)
            .map((name: string) => ({ label: name, value: name }));
          setPartnersOptions(opts);
        }
      } catch {}
    };
    if (addOpen && addForm.is_partnership) loadPartners();
  }, [addOpen, addForm.is_partnership]);

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
    if (!districtInput.trim()) return availableDistricts.slice(0, 10); // Show first 10 if no input
    return availableDistricts.filter(district => 
      district.toLowerCase().includes(districtInput.toLowerCase())
    ).slice(0, 10); // Limit to 10 suggestions
  }, [districtInput, availableDistricts]);

  // ✅ NEW: Handle district input change
  const handleDistrictChange = (value: string) => {
    setDistrictInput(value);
    setAddForm((p: any) => ({ ...p, District: value }));
    setShowDistrictSuggestions(true);
  };

  // ✅ NEW: Handle district suggestion selection
  const handleDistrictSelect = (district: string) => {
    setDistrictInput(district);
    setAddForm((p: any) => ({ ...p, District: district }));
    setShowDistrictSuggestions(false);
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

      const imageName = generateImageName(addForm.Billboard_Name || '');
      setSelectedFile(file);

      setAddForm((prev: any) => ({ 
        ...prev, 
        image_name: imageName,
        Image_URL: prev.Image_URL || `/image/${imageName}`
      }));

      toast.success(`تم اختيار الصورة: ${file.name}. سيتم رفعها عند الحفظ.`);
    }
  };

  // Add billboard function
  const addBillboard = async () => {
    // Validate required fields
    if (!addForm.Municipality || !addForm.Level || !addForm.Size) {
      toast.error('يرجى تحديد البلدية والمستوى والمقاس');
      return;
    }

    setAdding(true);
    const { ID, Billboard_Name, City, Municipality, District, Nearest_Landmark, GPS_Coordinates, Faces_Count, Size, Level, Image_URL, image_name, billboard_type, is_partnership, partner_companies, capital, capital_remaining } = addForm as any;
    
    // Add new items if they don't exist
    await addMunicipalityIfNew(Municipality, municipalities, setMunicipalities, setDbMunicipalities);
    await addSizeIfNew(Size, Level, sizes, setSizes, setDbSizes);
    await addLevelIfNew(Level, levels, setLevels);
    await addBillboardTypeIfNew(billboard_type, billboardTypes, setBillboardTypes);
    
    // Ensure image_name is always set
    let finalImageName = image_name;
    if (!finalImageName && Billboard_Name) {
      finalImageName = generateImageName(Billboard_Name);
    }
    
    // Upload image if a file was selected
    if (selectedFile && finalImageName) {
      const uploadSuccess = await uploadImageToFolder(selectedFile, finalImageName);
      if (!uploadSuccess) {
        setAdding(false);
        return;
      }
    }
    
    // ✅ Resolve size_id from database (sizes table), with robust fallbacks
    let sizeId: number | null = null;
    if (Size) {
      try {
        const raw = String(Size).trim();
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[×\*]/g, 'x');
        const norm = normalize(raw);
        const m = norm.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
        const variants = new Set<string>([norm, raw]);
        if (m) {
          const a = m[1];
          const b = m[2];
          variants.add(`${a}x${b}`);
          variants.add(`${b}x${a}`);
          variants.add(`${a}*${b}`);
          variants.add(`${b}*${a}`);
        }

        // 1) Try sizes table by exact/variant name
        const { data: sizesByName, error: sizesByNameErr } = await supabase
          .from('sizes')
          .select('id, name')
          .in('name', Array.from(variants));

        if (!sizesByNameErr && sizesByName && sizesByName.length > 0) {
          sizeId = Number(sizesByName[0].id);
          console.log('✅ size_id resolved from sizes.name:', { sizeId, matched: sizesByName[0].name });
        }

        // 2) If still null and we have numbers, try width/height match (both orientations)
        if (!sizeId && m) {
          const a = Number(m[1]);
          const b = Number(m[2]);
          const { data: sizesByDim } = await supabase
            .from('sizes')
            .select('id, name, width, height')
            .or(`and(width.eq.${a},height.eq.${b}),and(width.eq.${b},height.eq.${a})`);
          if (sizesByDim && sizesByDim.length > 0) {
            sizeId = Number(sizesByDim[0].id);
            console.log('✅ size_id resolved from sizes dimensions:', { sizeId, match: sizesByDim[0] });
          }
        }

        // 3) Fallback: try installation_print_pricing.size -> size_id
        if (!sizeId) {
          const { data: pricingByName } = await supabase
            .from('installation_print_pricing')
            .select('size_id, size')
            .in('size', Array.from(variants));
          const rowWithId = pricingByName?.find((r: any) => r.size_id);
          if (rowWithId) {
            sizeId = Number(rowWithId.size_id);
            console.log('✅ size_id resolved from installation_print_pricing:', rowWithId);
          }
        }

        // 4) Last resort: look at existing billboards with same Size text
        if (!sizeId) {
          const { data: bbMatch } = await supabase
            .from('billboards')
            .select('size_id')
            .eq('Size', raw)
            .not('size_id', 'is', null)
            .limit(1);
          if (bbMatch && bbMatch.length > 0) {
            sizeId = Number(bbMatch[0].size_id);
            console.log('✅ size_id copied from existing billboard record:', sizeId);
          }
        }

        if (!sizeId) {
          console.warn('⚠️ size_id could not be resolved for Size:', raw);
        }
      } catch (e) {
        console.error('❌ Exception resolving size_id:', e);
      }
    }

    const payload: any = {
      ID: Number(ID),
      Billboard_Name,
      City,
      Municipality,
      District,
      Nearest_Landmark,
      GPS_Coordinates: GPS_Coordinates || null,
      Faces_Count: Faces_Count ? parseInt(String(Faces_Count)) : null,
      Size,
      size_id: sizeId, // ✅ سيتم حفظه بشكل صحيح
      Level,
      Image_URL,
      image_name: finalImageName,
      billboard_type,
      Status: 'متاح',
      is_partnership: !!is_partnership,
      partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean),
      capital: Number(capital)||0,
      capital_remaining: Number(capital_remaining)||Number(capital)||0
    };

    console.log('🔧 Add billboard payload with size_id:', {
      ...payload,
      size_id_check: sizeId ? '✅ موجود' : '❌ غير موجود'
    });
    
    try {
      const { error } = await supabase.from('billboards').insert(payload).select().single();
      if (error) throw error;
      toast.success('تم إضافة اللوحة مع حفظ اسم الصورة');
      await loadBillboards();
      setAddOpen(false);
      setImagePreview('');
      setSelectedFile(null);
      // ✅ NEW: Reset district input
      setDistrictInput('');
    } catch (e: any) {
      console.error('❌ Add billboard error:', e);
      toast.error(e?.message || 'فشل الإضافة');
    } finally {
      setAdding(false);
    }
  };

  // Update image name when billboard name changes
  useEffect(() => {
    if (addForm.Billboard_Name && selectedFile && addForm.image_name && !addForm.image_name.includes(addForm.Billboard_Name)) {
      const imageName = generateImageName(addForm.Billboard_Name);
      setAddForm((prev: any) => ({ ...prev, image_name: imageName, Image_URL: `/image/${imageName}` }));
    }
  }, [addForm.Billboard_Name, selectedFile]);

  // ✅ NEW: Sync district input with form
  useEffect(() => {
    if (addForm.District !== districtInput) {
      setDistrictInput(addForm.District || '');
    }
  }, [addForm.District]);

  return (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">إضافة لوحة جديدة</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-foreground">رقم اللوحة (تلقائي)</Label>
            <Input 
              type="number" 
              value={addForm.ID || ''} 
              disabled 
              className="bg-muted cursor-not-allowed text-sm text-muted-foreground border-border"
              placeholder="يتم إنشاؤه تلقائياً" 
            />
          </div>
          <div>
            <Label className="text-foreground">اسم اللوحة (تلقائي)</Label>
            <Input 
              value={addForm.Billboard_Name || ''} 
              disabled 
              className="bg-muted cursor-not-allowed text-sm text-muted-foreground border-border"
              placeholder="يتم إنشاؤه تلقائياً" 
            />
          </div>
          <div>
            <Label className="text-foreground">المدينة</Label>
            <Select value={addForm.City || ''} onValueChange={(v) => setAddForm((p: any) => ({ ...p, City: v }))}>
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
            <Label className="text-foreground">البلدية * (مطلوب)</Label>
            <Select value={addForm.Municipality || ''} onValueChange={(v) => setAddForm((p: any) => ({ ...p, Municipality: v }))}>
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
              value={addForm.Nearest_Landmark || ''} 
              onChange={(e) => setAddForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} 
            />
          </div>
          <div className="relative">
            <Label className="text-foreground">المنطقة</Label>
            <Input 
              className="text-sm bg-input border-border text-foreground" 
              value={districtInput} 
              onChange={(e) => handleDistrictChange(e.target.value)}
              onFocus={() => setShowDistrictSuggestions(true)}
              onBlur={() => {
                // Delay hiding suggestions to allow clicking
                setTimeout(() => setShowDistrictSuggestions(false), 200);
              }}
              placeholder="اكتب لعرض اقتراحات المناطق" 
            />
            {/* ✅ NEW: District suggestions dropdown */}
            {showDistrictSuggestions && filteredDistricts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredDistricts.map((district, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 text-sm cursor-pointer text-popover-foreground hover:bg-accent hover:text-accent-foreground border-b border-border/50 last:border-b-0 transition-colors"
                    onClick={() => handleDistrictSelect(district)}
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
              value={addForm.GPS_Coordinates || ''} 
              onChange={(e) => setAddForm((p: any) => ({ ...p, GPS_Coordinates: e.target.value }))} 
              placeholder="lat, lng" 
            />
          </div>
          <div>
            <Label className="text-foreground">عدد الأوجه</Label>
            <Select value={String(addForm.Faces_Count || '')} onValueChange={(v) => setAddForm((p: any) => ({ ...p, Faces_Count: v }))}>
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر عدد الأوجه" />
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
            <Label className="text-foreground">المقاس * (مطلوب)</Label>
            <Select 
              value={addForm.Size || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__') {
                  const newSize = prompt('أدخل المقاس الجديد:');
                  if (newSize && newSize.trim()) {
                    addSizeIfNew(newSize.trim(), addForm.Level || 'A', sizes, setSizes, setDbSizes);
                    setAddForm((p: any) => ({ ...p, Size: newSize.trim() }));
                  }
                } else {
                  setAddForm((p: any) => ({ ...p, Size: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر المقاس" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {sizes.filter(s => s && s.id && s.name && String(s.name).trim()).map((s) => (
                  <SelectItem key={s.id} value={s.name} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">{s.name}</SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium hover:bg-accent hover:text-accent-foreground">
                  + إضافة مقاس جديد
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">المستوى * (مطلوب)</Label>
            <Select 
              value={addForm.Level || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__') {
                  const newLevel = prompt('أدخل المستوى الجديد:');
                  if (newLevel && newLevel.trim()) {
                    addLevelIfNew(newLevel.trim(), levels, setLevels);
                    setAddForm((p: any) => ({ ...p, Level: newLevel.trim() }));
                  }
                } else {
                  setAddForm((p: any) => ({ ...p, Level: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر المستوى" />
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
                <SelectItem value="__add_new__" className="text-primary font-medium hover:bg-accent hover:text-accent-foreground">
                  + إضافة مستوى جديد
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground">نوع اللوحة</Label>
            <Select 
              value={addForm.billboard_type || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__') {
                  const newType = prompt('أدخل نوع اللوحة الجديد:');
                  if (newType && newType.trim()) {
                    addBillboardTypeIfNew(newType.trim(), billboardTypes, setBillboardTypes);
                    setAddForm((p: any) => ({ ...p, billboard_type: newType.trim() }));
                  }
                } else {
                  setAddForm((p: any) => ({ ...p, billboard_type: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-input border-border text-foreground">
                <SelectValue placeholder="اختر نوع اللوحة" />
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
                <SelectItem value="__add_new__" className="text-primary font-medium hover:bg-accent hover:text-accent-foreground">
                  + إضافة نوع لوحة جديد
                </SelectItem>
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
                  value={addForm.Image_URL || ''}
                  onChange={(e) => setAddForm((p: any) => ({ ...p, Image_URL: e.target.value }))}
                  className="text-sm bg-input border-border text-foreground"
                />
              </div>
              {imagePreview && (
                <div className="w-full h-32 bg-muted rounded-lg overflow-hidden border border-border">
                  <img
                    src={imagePreview}
                    alt="معاينة الصورة"
                    className="w-full h-full object-cover"
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
                checked={!!addForm.is_partnership} 
                onChange={(e)=> setAddForm((p:any)=>({...p, is_partnership: e.target.checked}))} 
                className="accent-primary"
              />
            </div>
          </div>

          {addForm.is_partnership && (
            <>
              <div className="lg:col-span-2">
                <Label className="text-sm text-foreground">الشركات المشاركة</Label>
                <MultiSelect
                  options={partnersOptions}
                  value={Array.isArray(addForm.partner_companies) ? addForm.partner_companies : (String(addForm.partner_companies||'').split(',').map(s=>s.trim()).filter(Boolean))}
                  onChange={(vals)=> setAddForm((p:any)=>({...p, partner_companies: vals}))}
                  placeholder={partnersOptions.length ? 'اختر شركات مشاركة' : 'لا توجد شركات مسجلة'}
                  emptyText="لا توجد شركات"
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">رأس مال اللوحة</Label>
                <Input 
                  className="text-sm bg-input border-border text-foreground" 
                  type="number" 
                  value={addForm.capital || 0} 
                  onChange={(e)=> setAddForm((p:any)=>({...p, capital: Number(e.target.value)}))} 
                />
              </div>
              <div className="lg:col-span-2">
                <Label className="text-sm text-foreground">المتبقي من رأس المال</Label>
                <Input 
                  className="text-sm bg-input border-border text-foreground" 
                  type="number" 
                  value={addForm.capital_remaining || addForm.capital || 0} 
                  onChange={(e)=> setAddForm((p:any)=>({...p, capital_remaining: Number(e.target.value)}))} 
                />
              </div>
            </>
          )}

          {/* Display generated name preview */}
          {addForm.Municipality && addForm.Level && addForm.Size && (
            <div className="lg:col-span-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Label className="text-primary font-medium text-sm">الاسم المقترح:</Label>
              <div className="text-primary font-mono text-base mt-1">
                {addForm.Billboard_Name}
              </div>
            </div>
          )}

        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => {
            setAddOpen(false);
            setImagePreview('');
            setSelectedFile(null);
            setDistrictInput(''); // ✅ NEW: Reset district input
          }} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">إلغاء</Button>
          <Button onClick={addBillboard} disabled={adding || uploadingImage} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {adding ? 'جاري الإضافة...' : uploadingImage ? 'جاري رفع الصورة...' : 'إضافة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
