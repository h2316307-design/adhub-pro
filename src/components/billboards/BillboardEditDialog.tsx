import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ClipboardPaste, Loader2, Image as ImageIcon } from 'lucide-react';
import { BillboardImage } from '@/components/BillboardImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';
import { uploadToImgbb } from '@/services/imgbbService';

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
  loadBillboards: (options?: { silent?: boolean }) => Promise<void>;
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
  
  // State for friend companies
  const [friendCompanies, setFriendCompanies] = useState<Array<{id: string, name: string}>>([]);
  const [loadingFriendCompanies, setLoadingFriendCompanies] = useState(false);

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
        capital_remaining: bb.capital_remaining || bb.capitalRemaining || bb.remaining_capital || bb.capital || 0,
        friend_company_id: bb.friend_company_id || ''
      });
      
      // ✅ NEW: Set district input
      setDistrictInput(district);
      
      const imageName = bb.image_name || bb.Image_Name || bb.imageName;
      const imageUrl = bb.Image_URL || bb.image || bb.image_url || bb.imageUrl;
      // Prioritize external URL (imgbb etc.) over local path
      setImagePreview(imageUrl || (imageName ? `/image/${imageName}` : ''));
      
      setEditOpen(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      toast.error('حدث خطأ في فتح نافذة التعديل');
    }
  };

  const [imgbbUploading, setImgbbUploading] = useState(false);
  const [pasteActive, setPasteActive] = useState(false);

  // Upload image to imgbb with professional naming
  const handleImgbbUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صحيح');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 10MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setImgbbUploading(true);
    try {
      const bbName = editForm.Billboard_Name || 'billboard';
      const city = editForm.City || '';
      const district = editForm.District || '';
      const nameParts = [bbName, city, district].filter(Boolean);
      const imageName = nameParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-');
      
      const imageUrl = await uploadToImgbb(file, imageName);
      setEditForm((prev: any) => ({ ...prev, Image_URL: imageUrl, image_name: imageName }));
      setSelectedFile(null);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة. تأكد من إعداد مفتاح API في الإعدادات.');
      // Fallback: keep file for local upload
      const imageName = generateImageName(editForm.Billboard_Name || '');
      setSelectedFile(file);
      setEditForm((prev: any) => ({ ...prev, image_name: imageName, Image_URL: prev.Image_URL || `/image/${imageName}` }));
    } finally {
      setImgbbUploading(false);
    }
  };

  // Handle image selection (file input)
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImgbbUpload(file);
  };

  // Handle paste from clipboard
  const handleBillboardImagePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImgbbUpload(file);
        return;
      }
    }
    // Check for URL text
    const text = e.clipboardData?.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault();
      setEditForm((prev: any) => ({ ...prev, Image_URL: text }));
      setImagePreview(text);
      toast.success('تم لصق رابط الصورة');
    }
  };

  // Handle drag & drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPasteActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleImgbbUpload(file);
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
    try {
      const id = editing.ID ?? editing.id;
      const { City, Municipality, District, Nearest_Landmark, GPS_Coordinates, Faces_Count, Size, size_id, Level, Image_URL, image_name, billboard_type, is_partnership, partner_companies, capital, capital_remaining, friend_company_id } = editForm as any;
      
      await addMunicipalityIfNew(Municipality, municipalities, setMunicipalities, setDbMunicipalities);
      
      if (selectedFile && image_name) {
        const uploadSuccess = await uploadImageToFolder(selectedFile, image_name);
        if (!uploadSuccess) {
          setSaving(false);
          return;
        }
      }
      
      // تحديد size_id إذا لم يكن موجوداً
      let finalSizeId = size_id;
      if (!finalSizeId && Size) {
        const matchedSize = sizes.find(s => s.name === Size);
        finalSizeId = matchedSize?.id || null;
      }

      const payload: any = { 
        City, 
        Municipality, 
        District, 
        Nearest_Landmark, 
        GPS_Coordinates: GPS_Coordinates || null,
        Faces_Count: Faces_Count ? parseInt(String(Faces_Count)) : null,
        Size, 
        size_id: finalSizeId,
        Level, 
        Image_URL,
        image_name,
        billboard_type,
        is_partnership: !!is_partnership, 
        partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean), 
        capital: Number(capital)||0, 
        capital_remaining: Number(capital_remaining)||Number(capital)||0,
        friend_company_id: friend_company_id || null
      };

      console.log('🔧 Saving edit payload:', payload);

      const { error } = await supabase.from('billboards').update(payload).eq('ID', Number(id));

      if (error) {
        console.error('❌ Error saving edit:', error);
        toast.error(`فشل حفظ التعديلات: ${error.message}`);
      } else {
        toast.success('تم حفظ التعديلات');
        setEditOpen(false);
        setEditing(null);
        setImagePreview('');
        setSelectedFile(null);
        // Reload billboards in background without blocking
        loadBillboards({ silent: true }).catch(() => {});
      }
    } catch (err) {
      console.error('❌ Unexpected error saving billboard:', err);
      toast.error('حدث خطأ غير متوقع أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // Load partners and friend companies from database
  useEffect(() => {
    const loadData = async () => {
      setLoadingPartners(true);
      setLoadingFriendCompanies(true);
      try {
        // Load partners
        const { data: partnersData, error: partnersError } = await supabase
          .from('partners')
          .select('id, name')
          .order('name');

        if (partnersError) throw partnersError;
        setPartners(partnersData || []);
        
        // Load friend companies
        const { data: friendData, error: friendError } = await supabase
          .from('friend_companies')
          .select('id, name')
          .order('name');

        if (friendError) throw friendError;
        setFriendCompanies(friendData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('فشل تحميل البيانات');
      } finally {
        setLoadingPartners(false);
        setLoadingFriendCompanies(false);
      }
    };

    if (editOpen) {
      loadData();
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
    <Dialog open={editOpen} onOpenChange={(open) => {
      setEditOpen(open);
      if (!open) {
        // Reset editing so the useEffect can re-trigger for the same billboard
        setTimeout(() => setEditing(null), 100);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border z-[9999]">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="w-2 h-6 bg-primary rounded-full" />
            تعديل اللوحة
            {editForm.Billboard_Name && (
              <span className="text-sm font-normal text-muted-foreground mr-2">
                ({editForm.Billboard_Name})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* معلومات أساسية */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full" />
              المعلومات الأساسية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">اسم اللوحة</Label>
                <Input 
                  value={editForm.Billboard_Name || ''} 
                  disabled 
                  className="bg-muted/50 cursor-not-allowed text-sm font-medium text-muted-foreground border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">المدينة</Label>
                <Select value={editForm.City || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, City: v }))}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
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
                <Label className="text-xs text-muted-foreground mb-1.5 block">البلدية</Label>
                <Select value={editForm.Municipality || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Municipality: v }))}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                    <SelectValue placeholder="اختر البلدية">
                      {editForm.Municipality || 'اختر البلدية'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    {Array.isArray(municipalities) && municipalities.length > 0 ? (
                      municipalities.map((m) => (
                        <SelectItem 
                          key={m.id || m.name} 
                          value={m.name} 
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {m.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-data" disabled className="text-muted-foreground">
                        لا توجد بلديات متاحة
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Label className="text-xs text-muted-foreground mb-1.5 block">المنطقة</Label>
                <Input 
                  className="text-sm bg-background border-border text-foreground h-9" 
                  value={districtInput} 
                  onChange={(e) => handleDistrictInputChange(e.target.value)}
                  onFocus={() => setShowDistrictSuggestions(districtInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowDistrictSuggestions(false), 200)}
                  placeholder="اكتب للبحث" 
                />
                {showDistrictSuggestions && filteredDistricts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg">
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
            </div>
          </div>

          {/* الموقع */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              الموقع
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">أقرب معلم</Label>
                <Input 
                  className="text-sm bg-background border-border text-foreground h-9" 
                  value={editForm.Nearest_Landmark || ''} 
                  onChange={(e) => setEditForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} 
                  placeholder="مثال: بجانب مصرف الجمهورية"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">الإحداثيات GPS</Label>
                <Input 
                  className="text-sm bg-background border-border text-foreground h-9 font-mono" 
                  value={editForm.GPS_Coordinates || ''} 
                  onChange={(e) => setEditForm((p: any) => ({ ...p, GPS_Coordinates: e.target.value }))} 
                  placeholder="32.8752, 13.1875" 
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* المواصفات الفنية */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              المواصفات الفنية
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">المقاس</Label>
                <Select value={editForm.Size || ''} onValueChange={(v) => {
                  const selectedSize = sizes.find(s => s.name === v);
                  setEditForm((p: any) => ({ 
                    ...p, 
                    Size: v,
                    size_id: selectedSize?.id || null
                  }));
                }}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                    <SelectValue placeholder="اختر المقاس">
                      {editForm.Size || 'اختر المقاس'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    {sizes && sizes.length > 0 ? (
                      sizes.map((s) => (
                        <SelectItem 
                          key={s.id} 
                          value={s.name} 
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {s.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-sizes" disabled className="text-muted-foreground">
                        لا توجد مقاسات متاحة
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">عدد الأوجه</Label>
                <Select value={String(editForm.Faces_Count || '')} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Faces_Count: v }))}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                    <SelectValue placeholder="اختر">
                      {editForm.Faces_Count ? 
                        faces.find(f => String(f.count) === String(editForm.Faces_Count) || String(f.face_count) === String(editForm.Faces_Count))?.name || editForm.Faces_Count
                        : "اختر"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {faces.filter(face => face && face.id && (face.count != null || face.face_count != null)).map((face) => {
                      const faceCount = face.count || face.face_count;
                      return (
                        <SelectItem key={face.id} value={String(faceCount)} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                          {face.name} ({faceCount})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">المستوى</Label>
                <Select value={editForm.Level || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Level: v }))}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                    <SelectValue placeholder="اختر المستوى">
                      {editForm.Level || "اختر المستوى"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {levels && levels.filter(lv => lv && String(lv).trim()).length > 0 ? (
                      levels.filter(lv => lv && String(lv).trim()).map((lv) => (
                        <SelectItem key={lv} value={lv} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                          {lv}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="placeholder" disabled className="text-muted-foreground">لا توجد مستويات</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">نوع اللوحة</Label>
                <Select value={editForm.billboard_type || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, billboard_type: v }))}>
                  <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                    <SelectValue placeholder="اختر النوع">
                      {editForm.billboard_type || "اختر النوع"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {billboardTypes && billboardTypes.filter(type => type && String(type).trim()).length > 0 ? (
                      billboardTypes.filter(type => type && String(type).trim()).map((type) => (
                        <SelectItem key={type} value={type} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                          {type}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="placeholder" disabled className="text-muted-foreground">لا توجد أنواع</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* صورة اللوحة */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              صورة اللوحة
              {imgbbUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </h3>
            <div 
              className={`p-4 rounded-lg border-2 border-dashed transition-colors ${pasteActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
              onPaste={handleBillboardImagePaste}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setPasteActive(true); }}
              onDragLeave={() => setPasteActive(false)}
              onClick={() => setPasteActive(true)}
              onBlur={() => setPasteActive(false)}
              tabIndex={0}
            >
              {pasteActive && (
                <div className="text-center text-xs text-primary font-medium mb-3 flex items-center justify-center gap-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  اضغط Ctrl+V للصق صورة أو اسحب صورة هنا
                </div>
              )}
              
              {/* معاينة الصورة - كبيرة وواضحة */}
              <div className="mb-4">
                {(imagePreview || editForm.Image_URL) ? (
                  <div className="w-full h-56 bg-muted rounded-lg overflow-hidden border border-border shadow-sm">
                    <img 
                      src={imagePreview || editForm.Image_URL}
                      alt="معاينة الصورة"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-40 bg-muted/50 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground">لا توجد صورة - اختر أو الصق صورة</span>
                  </div>
                )}
              </div>

              {/* أزرار الرفع */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={imgbbUploading || uploadingImage}
                    className="hidden"
                    id="edit-billboard-image-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-2 text-sm"
                    disabled={imgbbUploading || uploadingImage}
                    onClick={() => document.getElementById('edit-billboard-image-input')?.click()}
                  >
                    {imgbbUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {imgbbUploading ? 'جاري الرفع...' : 'اختيار صورة من الجهاز'}
                  </Button>
                </div>
                <div>
                  <Input
                    placeholder="أو الصق رابط الصورة هنا https://..."
                    value={editForm.Image_URL || ''}
                    onChange={(e) => setEditForm((p: any) => ({ ...p, Image_URL: e.target.value }))}
                    className="text-sm bg-background border-border text-foreground h-11"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* الشراكة */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <input 
                type="checkbox" 
                id="partnership-checkbox"
                checked={!!editForm.is_partnership} 
                onChange={(e)=> setEditForm((p:any)=>({...p, is_partnership: e.target.checked}))} 
                className="w-4 h-4 accent-primary rounded"
              />
              <Label htmlFor="partnership-checkbox" className="text-sm text-foreground cursor-pointer">
                لوحة شراكة
              </Label>
            </div>
          </div>

          {editForm.is_partnership && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span className="text-sm font-semibold text-foreground">إعدادات الشراكة</span>
              </div>
              
              {/* الشركات المشاركة */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">الشركات المشاركة</Label>
                {loadingPartners ? (
                  <div className="text-sm text-muted-foreground">جاري تحميل الشركاء...</div>
                ) : (
                  <Select
                    value=""
                    onValueChange={(v) => {
                      const currentPartners = Array.isArray(editForm.partner_companies) ? editForm.partner_companies : [];
                      if (v && !currentPartners.includes(v)) {
                        setEditForm((p: any) => ({ ...p, partner_companies: [...currentPartners, v] }));
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                      <SelectValue placeholder="إضافة شريك جديد" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {partners.filter(p => !editForm.partner_companies?.includes(p.name)).map((partner) => (
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
                      <div key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">
                        <span>{partner}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPartners = editForm.partner_companies.filter((_: any, i: number) => i !== idx);
                            setEditForm((p: any) => ({ ...p, partner_companies: newPartners }));
                          }}
                          className="ml-1 text-destructive hover:text-destructive/80 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* رأس المال */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">إجمالي رأس المال</Label>
                  <Input 
                    className="text-sm font-medium bg-background border-border text-foreground h-9" 
                    type="number" 
                    value={editForm.capital || 0} 
                    onChange={(e)=> setEditForm((p:any)=>({...p, capital: Number(e.target.value)}))} 
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">المتبقي للاسترداد</Label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-background border border-border">
                    <span className="text-sm font-bold text-primary">
                      {(editForm.capital_remaining || editForm.capital || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">د.ل</span>
                  </div>
                </div>
              </div>
              
              {/* مؤشر التقدم */}
              {editForm.capital > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>نسبة الاسترداد</span>
                    <span>{(((editForm.capital - (editForm.capital_remaining || editForm.capital)) / editForm.capital) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                      style={{ width: `${((editForm.capital - (editForm.capital_remaining || editForm.capital)) / editForm.capital) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الشركة الصديقة */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              الشركة الصديقة
            </h3>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <Select 
                value={editForm.friend_company_id || 'none'} 
                onValueChange={(v) => setEditForm((p: any) => ({ ...p, friend_company_id: v === 'none' ? null : v }))}
              >
                <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                  <SelectValue placeholder="اختر الشركة الصديقة" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="none" className="text-popover-foreground">بدون شركة صديقة</SelectItem>
                  {friendCompanies.map((company) => (
                    <SelectItem 
                      key={company.id} 
                      value={company.id}
                      className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* أزرار الحفظ */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setEditOpen(false);
              setImagePreview('');
              setSelectedFile(null);
            }} 
            className="px-6"
          >
            إلغاء
          </Button>
          <Button 
            onClick={saveEdit} 
            disabled={saving || uploadingImage} 
            className="px-6 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? 'جارٍ الحفظ...' : uploadingImage ? 'جاري رفع الصورة...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};