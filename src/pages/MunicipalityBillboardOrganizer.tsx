/**
 * صفحة تنظيم لوحات البلدية
 * - إضافة/جلب لوحات بلدية
 * - ترتيب تسلسلي + سحب وإفلات
 * - بحث داخلي
 * - عرض على الخريطة
 * - طباعة الكل
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, Save, Printer, MapPin, ArrowUp, ArrowDown, Search, Edit2, FolderOpen, Upload, Building2, Settings2, GripVertical, ArrowLeftRight, Replace, Filter, Sticker, LayoutGrid, List, FileSpreadsheet } from 'lucide-react';
import QRCode from 'qrcode';
import MunicipalityStickerSettings, { useStickerSettings } from '@/components/municipality/MunicipalityStickerSettings';
import { printStickers } from '@/components/municipality/MunicipalityStickerPrint';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import GoogleHomeMap from '@/components/Map/GoogleHomeMap';
import type { Billboard } from '@/types';
import * as XLSX from 'xlsx';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';
import MunicipalityPrintSettingsDialog from '@/components/municipality/MunicipalityPrintSettingsDialog';
import { ExcelColumnMappingDialog, ColumnMapping } from '@/components/municipality/ExcelColumnMappingDialog';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { X as XIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
// Google Maps is loaded live in the print window - no static generator needed

interface CollectionItem {
  id?: string;
  sequence_number: number;
  billboard_id?: number | null;
  billboard_name?: string;
  size: string;
  faces_count: string;
  location_text: string;
  nearest_landmark: string;
  latitude: number | null;
  longitude: number | null;
  item_type: 'existing' | 'new';
  design_face_a?: string | null;
  design_face_b?: string | null;
  image_url?: string | null;
  municipality?: string;
  status?: string;
}

interface Collection {
  id?: string;
  name: string;
  municipality_name?: string;
  description?: string;
  items: CollectionItem[];
}

const parseDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: '', width: '', height: '' };
  // Replace × or X with x to normalize
  const normalized = sizeStr.replace(/×/g, 'x').replace(/X/g, 'x');
  const parts = normalized.split('x').map(p => p.trim());
  return {
    length: parts[0] || '',
    width: parts[1] || '',
    height: parts[2] || ''
  };
};

const formatDimensions = (length: string, width: string, height: string) => {
  const l = length.trim();
  const w = width.trim();
  const h = height.trim();
  if (!l && !w && !h) return '';
  return `${l}x${w}${h ? 'x' + h : ''}`;
};

const formatSizeForPrint = (sizeStr: string, showHeight: boolean) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';
  if (showHeight && dims.height) {
    return `${dims.length} × ${dims.width} × ${dims.height}`;
  }
  return `${dims.length} × ${dims.width}`;
};

const generatePrintedSizeHtml = (sizeStr: string, showHeight: boolean) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';

  const showH = showHeight && !!dims.height;
  
  return `
    <div class="print-size-container">
      <div class="print-dim-col">
        <div class="print-dim-label">طول</div>
        <div class="print-dim-value">${dims.length || '-'}</div>
      </div>
      <div class="print-dim-separator">×</div>
      <div class="print-dim-col">
        <div class="print-dim-label">عرض</div>
        <div class="print-dim-value">${dims.width || '-'}</div>
      </div>
      ${showH ? `
        <div class="print-dim-separator">×</div>
        <div class="print-dim-col">
          <div class="print-dim-label">ارتفاع</div>
          <div class="print-dim-value">${dims.height}</div>
        </div>
      ` : ''}
    </div>
  `;
};

// Unified custom 3D Dimension input component
const DimensionInput = ({
  value,
  onChange,
  className = ''
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
  const { length, width, height } = parseDimensions(value);

  const handleChange = (field: 'length' | 'width' | 'height', val: string) => {
    const newDims = { length, width, height };
    newDims[field] = val;
    onChange(formatDimensions(newDims.length, newDims.width, newDims.height));
  };

  return (
    <div className={`inline-flex items-center gap-1.5 bg-muted/40 dark:bg-muted/10 p-1.5 rounded-xl border border-border/10 justify-center ${className}`}>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground font-bold tracking-wider">طول</span>
        <Input
          type="text"
          value={length}
          onChange={e => handleChange('length', e.target.value)}
          className="w-12 h-8 text-xs text-center rounded-lg bg-background/80 border-border/15 focus-visible:ring-indigo-500 font-bold p-1"
          placeholder="طول"
        />
      </div>
      <span className="text-muted-foreground/40 text-[10px] mt-4 font-bold">×</span>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground font-bold tracking-wider">عرض</span>
        <Input
          type="text"
          value={width}
          onChange={e => handleChange('width', e.target.value)}
          className="w-12 h-8 text-xs text-center rounded-lg bg-background/80 border-border/15 focus-visible:ring-indigo-500 font-bold p-1"
          placeholder="عرض"
        />
      </div>
      <span className="text-muted-foreground/40 text-[10px] mt-4 font-bold">×</span>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground font-bold tracking-wider">ارتفاع</span>
        <Input
          type="text"
          value={height}
          onChange={e => handleChange('height', e.target.value)}
          className="w-12 h-8 text-xs text-center rounded-lg bg-background/80 border-border/15 focus-visible:ring-indigo-500 font-bold p-1"
          placeholder="ارتفاع"
        />
      </div>
    </div>
  );
};

export default function MunicipalityBillboardOrganizer() {
  const [collections, setCollections] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [currentCollection, setCurrentCollection] = useState<Collection>({ name: '', municipality_name: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [searchBillboard, setSearchBillboard] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [printLoading, setPrintLoading] = useState(false);
  const { settings: customSettings, updateStatusOverride, saveSettings, refetch } = usePrintCustomization('municipality');
  const [collectionName, setCollectionName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [cityName, setCityName] = useState('');
  const [defaultSize, setDefaultSize] = useState('');
  const [showMunicipalityImportDialog, setShowMunicipalityImportDialog] = useState(false);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [restrictImportToMunicipality, setRestrictImportToMunicipality] = useState(true);
  const [searchMunicipality, setSearchMunicipality] = useState('');
  const [showExcelMunicipalityDialog, setShowExcelMunicipalityDialog] = useState(false);
  const [excelPendingItems, setExcelPendingItems] = useState<CollectionItem[]>([]);
  const [excelMunicipalityName, setExcelMunicipalityName] = useState('');
  const [showColumnMappingDialog, setShowColumnMappingDialog] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, any>[]>([]);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printImageSource, setPrintImageSource] = useState<'actual_image' | 'map_pin' | 'map_only'>('map_pin');
  const munOverrides = customSettings.status_overrides?.['municipality'] || {};
  const showStatusInPrint = munOverrides.mun_show_status !== 'false';
  const statusPosition = munOverrides.mun_status_position || 'below_number';
  const statusTop = munOverrides.mun_status_top || '12mm';
  const statusLeft = munOverrides.mun_status_left || '50%';
  const statusFontSize = munOverrides.mun_status_font_size || '14px';
  const statusColor = munOverrides.mun_status_color || '#000000';
  const statusGap = munOverrides.mun_status_gap || '2mm';

  const updateAndSaveStatusSetting = async (key: string, value: string) => {
    updateStatusOverride('municipality', key as any, value);
    await saveSettings((prev) => {
      const currentOverrides = prev.status_overrides || ({} as any);
      const currentMunOverrides = currentOverrides['municipality'] || {};
      return {
        status_overrides: {
          ...currentOverrides,
          municipality: { ...currentMunOverrides, [key]: value }
        }
      };
    });
  };
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<'all' | 'selected'>('all');
  const [bulkStatusValue, setBulkStatusValue] = useState('متاحة');
  const [bulkStatusCustom, setBulkStatusCustom] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkSize, setBulkSize] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [showStickerSettings, setShowStickerSettings] = useState(false);
  const { settings: stickerSettings, reload: reloadStickerSettings } = useStickerSettings();
  const [showHeightInPrint, setShowHeightInPrint] = useState(() => {
    try {
      const val = localStorage.getItem('mun_show_height_in_print');
      return val !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mun_show_height_in_print', String(showHeightInPrint));
    } catch {}
  }, [showHeightInPrint]);

  const handleDimChange = (sequenceNumber: number, field: 'length' | 'width' | 'height', value: string) => {
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.sequence_number === sequenceNumber) {
          const dims = parseDimensions(item.size || '');
          dims[field] = value;
          return {
            ...item,
            size: formatDimensions(dims.length, dims.width, dims.height)
          };
        }
        return item;
      })
    }));
  };

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // New item form state
  const [newItem, setNewItem] = useState<Partial<CollectionItem>>({
    size: '',
    faces_count: 'وجهين',
    location_text: '',
    nearest_landmark: '',
    latitude: null,
    longitude: null,
    item_type: 'new',
  });

  // Load saved collections
  useEffect(() => {
    loadCollections();
    loadAllBillboards();
    loadMunicipalities();
    loadCities();
    loadSizes();
    // ✅ استرجاع آخر محفوظة كانت مفتوحة
    try {
      const savedId = localStorage.getItem('last_municipality_collection_id');
      if (savedId) {
        loadCollection(savedId);
      }
    } catch {}
  }, []);

  const loadMunicipalities = async () => {
    const { data } = await supabase
      .from('billboards')
      .select('Municipality')
      .not('Municipality', 'is', null);
    if (data) {
      const unique = [...new Set(data.map(d => d.Municipality).filter(Boolean))] as string[];
      setMunicipalities(unique.sort());
    }
  };

  const loadCities = async () => {
    const { data } = await supabase
      .from('billboards')
      .select('City')
      .not('City', 'is', null);
    if (data) {
      const unique = [...new Set(data.map(d => d.City).filter(Boolean))] as string[];
      setCities(unique.sort());
    }
  };

  const loadSizes = async () => {
    const { data } = await supabase
      .from('sizes')
      .select('name')
      .order('name', { ascending: true });
    if (data) {
      setDbSizes((data as any[]).map((d: any) => d.name).filter(Boolean));
    }
  };

  const loadCollections = async () => {
    const { data } = await supabase
      .from('municipality_collections')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    if (data) setCollections(data);
  };

  const loadAllBillboards = async () => {
    const { data } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, Size, Faces_Count, City, District, Municipality, Nearest_Landmark, GPS_Coordinates, Image_URL, design_face_a, design_face_b, Status')
      .order('ID', { ascending: true });
    if (data) setAllBillboards(data);
  };

  const loadCollection = async (collectionId: string) => {
    setLoading(true);
    try {
      const [collRes, itemsRes] = await Promise.all([
        supabase.from('municipality_collections').select('*').eq('id', collectionId).single(),
        supabase.from('municipality_collection_items').select('*').eq('collection_id', collectionId).order('sequence_number'),
      ]);
      if (collRes.data && itemsRes.data) {
        const name = collRes.data.name || '';
        const desc = collRes.data.description || '';
        const muni = (collRes.data as any).municipality_name || desc || '';
        const cty = (collRes.data as any).city || '';
        const dsize = (collRes.data as any).default_size || '';
        setCurrentCollection({
          id: collRes.data.id,
          name: name,
          municipality_name: muni,
          description: desc,
          items: itemsRes.data.map((item: any) => ({
            id: item.id,
            sequence_number: item.sequence_number,
            billboard_id: item.billboard_id,
            billboard_name: item.billboard_name,
            size: item.size,
            faces_count: item.faces_count || 'وجهين',
            location_text: item.location_text || '',
            nearest_landmark: item.nearest_landmark || '',
            latitude: item.latitude,
            longitude: item.longitude,
            item_type: item.item_type,
            design_face_a: item.design_face_a,
            design_face_b: item.design_face_b,
            image_url: item.image_url,
            municipality: item.municipality || '',
            status: item.status || 'متاحة',
          })),
        });
        setCollectionName(name);
        setMunicipalityName(muni);
        setCityName(cty);
        setDefaultSize(dsize);
        toast.success(`تم تحميل "${name}"`);
        try { localStorage.setItem('last_municipality_collection_id', collectionId); } catch {}
      }
    } catch (e) {
      toast.error('فشل في تحميل المجموعة');
    } finally {
      setLoading(false);
      setShowCollectionsDialog(false);
    }
  };

  const saveCollection = async () => {
    if (currentCollection.items.length === 0) {
      toast.error('أضف لوحات أولاً');
      return;
    }
    if (!collectionName.trim()) {
      toast.error('أدخل اسم المجموعة');
      return;
    }
    setSaving(true);
    try {
      let collectionId = currentCollection.id;
      const collectionPayload: any = {
        name: collectionName,
        description: municipalityName,
        municipality_name: municipalityName || null,
        city: cityName || null,
        default_size: defaultSize || null,
      };

      if (collectionId) {
        await supabase.from('municipality_collections').update(collectionPayload).eq('id', collectionId);
        await supabase.from('municipality_collection_items').delete().eq('collection_id', collectionId);
      } else {
        const { data } = await supabase.from('municipality_collections').insert(collectionPayload).select('id').single();
        if (data) collectionId = data.id;
      }

      if (!collectionId) throw new Error('Failed to get collection ID');

      const itemsToInsert = currentCollection.items.map(item => ({
        collection_id: collectionId!,
        sequence_number: item.sequence_number,
        billboard_id: item.billboard_id || null,
        billboard_name: item.billboard_name || null,
        size: item.size,
        faces_count: item.faces_count,
        location_text: item.location_text,
        nearest_landmark: item.nearest_landmark,
        latitude: item.latitude,
        longitude: item.longitude,
        item_type: item.item_type,
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        image_url: item.image_url || null,
        status: item.status || 'متاحة',
      }));

      await supabase.from('municipality_collection_items').insert(itemsToInsert);

      setCurrentCollection(prev => ({ ...prev, id: collectionId }));
      toast.success('تم الحفظ بنجاح');
      try { if (collectionId) localStorage.setItem('last_municipality_collection_id', collectionId); } catch {}
      loadCollections();
    } catch (e) {
      toast.error('فشل في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // Add new manual billboard
  const openAddDialog = () => {
    setNewItem({
      size: defaultSize || '',
      faces_count: 'وجهين',
      location_text: '',
      nearest_landmark: '',
      latitude: null,
      longitude: null,
      item_type: 'new',
    });
    setShowAddDialog(true);
  };

  const addNewItem = () => {
    const sizeToUse = (newItem.size || '').trim() || defaultSize.trim();
    if (!sizeToUse) {
      toast.error('يجب اختيار المقاس (يمكنك ضبط المقاس الافتراضي للقائمة)');
      return;
    }
    const nextSeq = currentCollection.items.length + 1;
    const item: CollectionItem = {
      sequence_number: nextSeq,
      size: sizeToUse,
      faces_count: newItem.faces_count || 'وجهين',
      location_text: newItem.location_text || '',
      nearest_landmark: newItem.nearest_landmark || '',
      latitude: newItem.latitude || null,
      longitude: newItem.longitude || null,
      item_type: 'new',
      billboard_name: newItem.location_text || `لوحة جديدة ${nextSeq}`,
      municipality: municipalityName || '',
      status: 'متاحة',
    };
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, item] }));
    setNewItem({ size: defaultSize || '', faces_count: 'وجهين', location_text: '', nearest_landmark: '', latitude: null, longitude: null, item_type: 'new' });
    setShowAddDialog(false);
    toast.success(`تمت إضافة لوحة رقم ${nextSeq}`);
  };

  // Quickly add a single billboard from system to the collection
  const quickAddBillboard = (b: any) => {
    if (currentCollection.items.some(i => i.billboard_id === b.ID)) {
      toast.info('هذه اللوحة موجودة بالفعل في القائمة');
      return;
    }
    const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
    const nextSeq = currentCollection.items.length + 1;
    const item: CollectionItem = {
      sequence_number: nextSeq,
      billboard_id: b.ID,
      billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
      size: b.Size || defaultSize || '',
      faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
      location_text: [b.City, b.District].filter(Boolean).join(' - '),
      nearest_landmark: b.Nearest_Landmark || '',
      latitude: coords?.[0] || null,
      longitude: coords?.[1] || null,
      item_type: 'existing',
      design_face_a: b.design_face_a,
      design_face_b: b.design_face_b,
      image_url: b.Image_URL,
      municipality: b.Municipality || '',
      status: b.Status || 'متاحة',
    };
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, item] }));
    toast.success(`تمت إضافة "${item.billboard_name}"`);
  };


  // Import existing billboards
  const importSelectedBillboards = () => {
    if (selectedBillboardIds.size === 0) {
      toast.error('اختر لوحات أولاً');
      return;
    }
    const startSeq = currentCollection.items.length + 1;
    const newItems: CollectionItem[] = [];
    let seq = startSeq;

    allBillboards
      .filter(b => selectedBillboardIds.has(b.ID))
      .forEach(b => {
        const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
        newItems.push({
          sequence_number: seq++,
          billboard_id: b.ID,
          billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
          size: b.Size || '',
          faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
          location_text: [b.City, b.District].filter(Boolean).join(' - '),
          nearest_landmark: b.Nearest_Landmark || '',
          latitude: coords?.[0] || null,
          longitude: coords?.[1] || null,
          item_type: 'existing',
          design_face_a: b.design_face_a,
          design_face_b: b.design_face_b,
          image_url: b.Image_URL,
          municipality: b.Municipality || '',
          status: b.Status || 'متاحة',
        });
      });

    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setSelectedBillboardIds(new Set());
    setShowImportDialog(false);
    toast.success(`تمت إضافة ${newItems.length} لوحة`);
  };

  // Remove item and re-sequence
  const removeItem = (seq: number) => {
    setCurrentCollection(prev => {
      const filtered = prev.items.filter(i => i.sequence_number !== seq);
      const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
      return { ...prev, items: reSequenced };
    });
    setSelectedItems(prev => { const n = new Set(prev); n.delete(seq); return n; });
  };

  // Move item up/down
  const moveItem = (seq: number, direction: 'up' | 'down') => {
    setCurrentCollection(prev => {
      const items = [...prev.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const idx = items.findIndex(i => i.sequence_number === seq);
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === items.length - 1)) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
      const reSequenced = items.map((item, i) => ({ ...item, sequence_number: i + 1 }));
      return { ...prev, items: reSequenced };
    });
  };

  // Update item
  const updateItem = (seq: number, updates: Partial<CollectionItem>) => {
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(item => item.sequence_number === seq ? { ...item, ...updates } : item),
    }));
  };

  const clearAllItems = () => {
    if (currentCollection.items.length === 0) {
      toast.info('الجدول فارغ بالفعل');
      return;
    }

    const confirmed = window.confirm('سيتم مسح جميع عناصر الجدول الحالي. هل تريد المتابعة؟');
    if (!confirmed) return;

    setCurrentCollection(prev => ({ ...prev, items: [] }));
    setSelectedItems(new Set());
    setSelectedBillboardIds(new Set());
    setSearchItems('');
    setBulkSize('');
    toast.success('تم تصفير الجدول ومسح جميع العناصر');
  };

  // ✅ تحويل العناصر المحددة إلى لوحات رسمية في جدول billboards
  const convertSelectedToOfficialBillboards = async () => {
    if (selectedItems.size === 0) {
      toast.error('اختر لوحة واحدة على الأقل أولاً');
      return;
    }
    if (!municipalityName) {
      toast.error('يجب ربط القائمة ببلدية أولاً قبل التحويل');
      return;
    }

    const itemsToConvert = currentCollection.items.filter(i => selectedItems.has(i.sequence_number));
    const missingSize = itemsToConvert.filter(i => !i.size || !i.size.trim());
    if (missingSize.length > 0) {
      toast.error(`${missingSize.length} لوحة بدون مقاس — يجب تعيين مقاس لكل لوحة قبل التحويل`);
      return;
    }

    const confirmed = window.confirm(
      `سيتم إنشاء ${itemsToConvert.length} لوحة رسمية في قائمة اللوحات (سيُسند لكل واحدة كود تلقائياً).\n\nمتابعة؟`
    );
    if (!confirmed) return;

    try {
      // الحصول على أعلى ID لإسناد أكواد جديدة
      const { data: maxRow } = await supabase
        .from('billboards')
        .select('ID')
        .order('ID', { ascending: false })
        .limit(1);
      let nextId = ((maxRow?.[0]?.ID as number) || 0) + 1;

      const rows = itemsToConvert.map(item => {
        const id = nextId++;
        const facesCount = item.faces_count === 'وجه' ? 1 : 2;
        const billboardName = item.billboard_name?.trim() || `${municipalityName}-${id}`;
        return {
          ID: id,
          Billboard_Name: billboardName,
          Size: item.size,
          Faces_Count: facesCount,
          Municipality: municipalityName,
          City: cityName || item.location_text || '',
          Nearest_Landmark: item.nearest_landmark || '',
          GPS_Coordinates: item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : null,
          Image_URL: item.image_url || null,
          Status: 'متاح',
        } as any;
      });

      const { data: inserted, error } = await supabase
        .from('billboards')
        .insert(rows)
        .select('ID, Billboard_Name');

      if (error) throw error;

      // ربط العناصر بالـ IDs الجديدة وتحويل النوع إلى existing
      const idsBySeq = new Map<number, number>();
      itemsToConvert.forEach((item, idx) => {
        const newId = inserted?.[idx]?.ID as number | undefined;
        if (newId) idsBySeq.set(item.sequence_number, newId);
      });

      setCurrentCollection(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const newId = idsBySeq.get(item.sequence_number);
          if (!newId) return item;
          return {
            ...item,
            billboard_id: newId,
            billboard_name: rows.find(r => r.ID === newId)?.Billboard_Name || item.billboard_name,
            item_type: 'existing' as const,
            municipality: municipalityName,
          };
        }),
      }));
      setSelectedItems(new Set());
      toast.success(`تم تحويل ${rows.length} لوحة إلى لوحات رسمية في قائمة اللوحات`);
    } catch (err: any) {
      console.error('Convert to official billboards failed:', err);
      toast.error(`فشل التحويل: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // ✅ الاستماع لحدث تعديل اللوحة من نوافذ الخريطة
  useEffect(() => {
    const handler = (e: Event) => {
      const editId = (e as CustomEvent).detail;
      if (!editId) return;
      const seq = Number(editId);
      const item = currentCollection.items.find(i => i.sequence_number === seq);
      if (item) {
        setEditingItem(item);
      } else {
        toast.error('تعذّر إيجاد العنصر للتعديل');
      }
    };
    window.addEventListener('edit-billboard', handler);
    return () => window.removeEventListener('edit-billboard', handler);
  }, [currentCollection.items]);

  // Drag & Drop handlers
  const handleDragStart = (seq: number) => {
    dragItem.current = seq;
  };

  const handleDragEnter = (seq: number) => {
    dragOverItem.current = seq;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    setCurrentCollection(prev => {
      const items = [...prev.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const fromIdx = items.findIndex(i => i.sequence_number === dragItem.current);
      const toIdx = items.findIndex(i => i.sequence_number === dragOverItem.current);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [removed] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, removed);
      const reSequenced = items.map((item, i) => ({ ...item, sequence_number: i + 1 }));
      return { ...prev, items: reSequenced };
    });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Replace one item with another from the system
  const handleReplace = (targetSeq: number) => {
    setReplaceTarget(targetSeq);
    setSearchBillboard('');
    setSelectedBillboardIds(new Set());
    setShowReplaceDialog(true);
  };

  const confirmReplace = () => {
    if (replaceTarget === null || selectedBillboardIds.size !== 1) return;
    const billboardId = [...selectedBillboardIds][0];
    const b = allBillboards.find(bb => bb.ID === billboardId);
    if (!b) return;
    const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
    updateItem(replaceTarget, {
      billboard_id: b.ID,
      billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
      size: b.Size || '',
      faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
      location_text: [b.City, b.District].filter(Boolean).join(' - '),
      nearest_landmark: b.Nearest_Landmark || '',
      latitude: coords?.[0] || null,
      longitude: coords?.[1] || null,
      item_type: 'existing',
      design_face_a: b.design_face_a,
      design_face_b: b.design_face_b,
      image_url: b.Image_URL,
      municipality: b.Municipality || '',
    });
    setShowReplaceDialog(false);
    setReplaceTarget(null);
    setSelectedBillboardIds(new Set());
    toast.success('تم استبدال اللوحة');
  };

  // Import from Excel file
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        if (rows.length === 0) {
          toast.error('الملف فارغ');
          return;
        }

        const headers = Object.keys(rows[0]);
        setExcelHeaders(headers);
        setExcelRawRows(rows);
        setShowColumnMappingDialog(true);
      } catch {
        toast.error('فشل في قراءة ملف Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleColumnMappingConfirm = (mapping: ColumnMapping) => {
    const rows = excelRawRows;
    const startSeq = currentCollection.items.length + 1;

    const newItems: CollectionItem[] = rows.map((row, idx) => {
      let lat: number | null = null;
      let lng: number | null = null;

      if (mapping.coordsMode === 'combined' && mapping.coords_combined) {
        const coordsStr = String(row[mapping.coords_combined] || '');
        const parts = coordsStr.split(',').map((c: string) => parseFloat(c.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          lat = parts[0];
          lng = parts[1];
        }
      } else if (mapping.coordsMode === 'separate') {
        if (mapping.coords_lat) {
          const v = parseFloat(String(row[mapping.coords_lat]));
          if (!isNaN(v)) lat = v;
        }
        if (mapping.coords_lng) {
          const v = parseFloat(String(row[mapping.coords_lng]));
          if (!isNaN(v)) lng = v;
        }
      }

      const facesRaw = mapping.faces_count ? String(row[mapping.faces_count] || 'وجهين') : 'وجهين';
      const faces = facesRaw.includes('وجه') && !facesRaw.includes('وجهين') ? 'وجه' : 'وجهين';

      const locationText = mapping.location_text ? String(row[mapping.location_text] || '') : '';
      const billboardName = mapping.billboard_name 
        ? String(row[mapping.billboard_name] || locationText || `لوحة ${startSeq + idx}`)
        : (locationText || `لوحة ${startSeq + idx}`);

      return {
        sequence_number: startSeq + idx,
        size: mapping.size ? String(row[mapping.size] || '') : '',
        faces_count: faces,
        location_text: locationText,
        nearest_landmark: mapping.nearest_landmark ? String(row[mapping.nearest_landmark] || '') : '',
        latitude: lat,
        longitude: lng,
        item_type: 'new' as const,
        billboard_name: billboardName,
      };
    });

    setExcelPendingItems(newItems);
    setExcelMunicipalityName('');
    setShowColumnMappingDialog(false);
    setShowExcelMunicipalityDialog(true);
  };

  const confirmExcelImport = () => {
    if (!excelMunicipalityName.trim()) {
      toast.error('أدخل اسم البلدية');
      return;
    }
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...excelPendingItems] }));
    setMunicipalityName(excelMunicipalityName.trim());
    if (!collectionName) setCollectionName(excelMunicipalityName.trim());
    setShowExcelMunicipalityDialog(false);
    setExcelPendingItems([]);
    toast.success(`تم استيراد ${excelPendingItems.length} لوحة تحت "${excelMunicipalityName.trim()}"`);
  };

  // Import all billboards from a specific municipality
  const importByMunicipality = (municipality: string) => {
    const filtered = allBillboards.filter(b => b.Municipality === municipality);
    if (filtered.length === 0) {
      toast.error(`لا توجد لوحات في بلدية "${municipality}"`);
      return;
    }
    const startSeq = currentCollection.items.length + 1;
    const newItems: CollectionItem[] = filtered.map((b, idx) => {
      const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
      return {
        sequence_number: startSeq + idx,
        billboard_id: b.ID,
        billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
        size: b.Size || '',
        faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
        location_text: [b.City, b.District].filter(Boolean).join(' - '),
        nearest_landmark: b.Nearest_Landmark || '',
        latitude: coords?.[0] || null,
        longitude: coords?.[1] || null,
        item_type: 'existing' as const,
        design_face_a: b.design_face_a,
        design_face_b: b.design_face_b,
        image_url: b.Image_URL,
        municipality: municipality,
      };
    });
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setMunicipalityName(municipality);
    // Auto-bind city from first billboard if empty
    if (!cityName) {
      const firstCity = filtered.find(b => b.City)?.City;
      if (firstCity) setCityName(firstCity);
    }
    if (!collectionName) setCollectionName(municipality);
    setShowMunicipalityImportDialog(false);
    toast.success(`تم جلب ${newItems.length} لوحة من بلدية "${municipality}"`);
  };

  // Convert items to Billboard format for map
  const mapBillboards: Billboard[] = useMemo(() => {
    return currentCollection.items
      .filter(item => item.latitude && item.longitude)
      .map(item => ({
        ID: item.sequence_number,
        Billboard_Name: `${item.sequence_number}`,
        Size: item.size,
        Faces_Count: item.faces_count === 'وجه' ? 1 : 2,
        GPS_Coordinates: `${item.latitude},${item.longitude}`,
        Status: item.item_type === 'existing' ? 'محجوز' : 'متاح',
        City: item.location_text,
        Municipality: '',
        District: '',
        Nearest_Landmark: item.nearest_landmark,
        Image_URL: item.image_url || '',
        design_face_a: item.design_face_a || '',
        design_face_b: item.design_face_b || '',
      } as any));
  }, [currentCollection.items]);

  // Filtered billboards for import dialog
  const filteredImportBillboards = useMemo(() => {
    let base = allBillboards;
    if (restrictImportToMunicipality) {
      if (municipalityName) base = base.filter(b => (b.Municipality || '') === municipalityName);
      if (cityName) base = base.filter(b => (b.City || '') === cityName);
    }
    if (!searchBillboard) return base.slice(0, 200);
    const q = searchBillboard.toLowerCase();
    return base.filter(b =>
      (b.Billboard_Name || '').toLowerCase().includes(q) ||
      (b.City || '').toLowerCase().includes(q) ||
      (b.Nearest_Landmark || '').toLowerCase().includes(q) ||
      String(b.ID).includes(q) ||
      (b.Size || '').includes(q) ||
      (b.Municipality || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [allBillboards, searchBillboard, restrictImportToMunicipality, municipalityName, cityName]);

  // Filtered items in table
  const sortedItems = useMemo(() => {
    const sorted = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
    if (!searchItems.trim()) return sorted;
    const q = searchItems.toLowerCase();
    return sorted.filter(item =>
      (item.location_text || '').toLowerCase().includes(q) ||
      (item.nearest_landmark || '').toLowerCase().includes(q) ||
      (item.size || '').toLowerCase().includes(q) ||
      (item.municipality || '').toLowerCase().includes(q) ||
      String(item.sequence_number).includes(q) ||
      (item.billboard_name || '').toLowerCase().includes(q)
    );
  }, [currentCollection.items, searchItems]);

  // Get unique sizes from current items
  const availableSizes = useMemo(() => {
    return [...new Set(currentCollection.items.map(i => i.size).filter(Boolean))].sort();
  }, [currentCollection.items]);

  // ============ PRINT ============
  const handlePrint = async () => {
    if (currentCollection.items.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }
    setPrintLoading(true);
    try {
      const s = customSettings;
      const pages: string[] = [];
      const printItems = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const displayMunicipality = municipalityName || collectionName;
      const readStoredStatusValue = (key: string, fallback: string) => {
        try {
          return localStorage.getItem(key) || fallback;
        } catch {
          return fallback;
        }
      };
      const effectiveStatusPosition = statusPosition;
      const effectiveStatusGap = statusGap;
      const effectiveStatusTop = statusTop;
      const effectiveStatusLeft = statusLeft;
      const effectiveStatusFontSize = statusFontSize;
      const effectiveStatusColor = statusColor;

      // ✅ صفحة الغلاف
      const coverEnabled = (s as any).cover_page_enabled !== 'false';
      if (coverEnabled && displayMunicipality) {
        const coverLogoUrl = (s as any).cover_logo_url || '/logofaresgold.svg';
        const coverPhrase = (s as any).cover_phrase || 'لوحات';
        const coverLogoSize = (s as any).cover_logo_size || '200px';
        const coverPhraseFontSize = (s as any).cover_phrase_font_size || '28px';
        const coverMunicipalityFontSize = (s as any).cover_municipality_font_size || '36px';
        
        const logoTop = (s as any).cover_logo_top || '';
        const logoLeft = (s as any).cover_logo_left || '50%';
        const logoAlign = (s as any).cover_logo_align || 'center';
        const phraseTop = (s as any).cover_phrase_top || '';
        const phraseLeft = (s as any).cover_phrase_left || '50%';
        const phraseAlign = (s as any).cover_phrase_align || 'center';
        const muniTop = (s as any).cover_municipality_top || '';
        const muniLeft = (s as any).cover_municipality_left || '50%';
        const muniAlign = (s as any).cover_municipality_align || 'center';

        const coverBgEnabled = (s as any).cover_background_enabled !== 'false';
        const coverBgUrl = (s as any).cover_background_url || '';
        const coverBgClass = coverBgEnabled ? (coverBgUrl ? '' : '<div class="background"></div>') : '';
        const coverBgInline = coverBgEnabled && coverBgUrl ? `background-image:url('${coverBgUrl}');background-size:210mm 297mm;background-repeat:no-repeat;` : '';

        const posStyle = (align: string, left: string, extraWidth?: string) => {
          const w = extraWidth ? `width:${extraWidth};` : '';
          return `left:${left};transform:translateX(-50%);text-align:${align};${w}`;
        };

        pages.push(`
            <div class="page" style="${coverBgInline}">
              ${coverBgClass}
              <div style="position:absolute;${posStyle(logoAlign, logoLeft, coverLogoSize)}top:${logoTop || '100mm'};z-index:5;">
                <img src="${coverLogoUrl}" alt="شعار" style="width:100%;height:auto;object-fit:contain;" onerror="this.style.display='none'" />
              </div>
              <div style="position:absolute;${posStyle(phraseAlign, phraseLeft)}top:${phraseTop || '180mm'};z-index:5;font-family:'Doran',Arial,sans-serif;font-size:${coverPhraseFontSize};font-weight:700;color:#000;">
                ${coverPhrase}
              </div>
              <div style="position:absolute;${posStyle(muniAlign, muniLeft)}top:${muniTop || '195mm'};z-index:5;font-family:'Doran',Arial,sans-serif;font-size:${coverMunicipalityFontSize};font-weight:700;color:#000;">
                ${displayMunicipality}
              </div>
            </div>
          `);
      }

      // Map settings from DB
      const mapZoom = parseFloat(s.map_zoom || '16') || 16;
      const mapTypeRaw = (s.map_show_labels || 'hybrid') as 'satellite' | 'hybrid' | 'roadmap';
      const mapLabelScale = parseFloat((s as any).map_label_scale || '1') || 1;

      // Helper: convert mm → px at print DPI for crisp map output
      const mmToPx = (mm: number, dpi = 250) => Math.round((mm / 25.4) * dpi);
      const widthMm = parseFloat(String(s.main_image_width || '120')) || 120;
      const heightMm = parseFloat(String(s.main_image_height || '140')) || 140;
      const mapW = Math.min(1600, Math.max(900, mmToPx(widthMm)));
      const mapHFull = Math.min(1600, Math.max(700, mmToPx(heightMm)));
      const mapHHalf = Math.min(1600, Math.max(500, mmToPx(heightMm / 2)));

      // Pre-generate Google Maps images using direct tile stitching (no API needed, never grays out)
      const mapImages = new Map<number, string>();
      if (printImageSource === 'map_pin' || printImageSource === 'map_only') {
        const itemsWithCoords = printItems.filter(item => item.latitude && item.longitude);
        if (itemsWithCoords.length > 0) {
          toast.info(`جاري تجهيز ${itemsWithCoords.length} خريطة...`);
          const { generateGoogleTilesMapDataUrl } = await import('@/utils/googleTilesMapGenerator');
          const batchSize = 3;
          for (let i = 0; i < itemsWithCoords.length; i += batchSize) {
            const batch = itemsWithCoords.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map(async (item) => {
                try {
                  // ✅ في وضع "خريطة فقط" لا نقسّم الارتفاع حتى لو وُجدت صورة
                  const halve = printImageSource === 'map_pin' && !!item.image_url;
                  const dataUrl = await generateGoogleTilesMapDataUrl({
                    lat: item.latitude!,
                    lng: item.longitude!,
                    zoom: mapZoom,
                    width: mapW,
                    height: halve ? mapHHalf : mapHFull,
                    mapType: mapTypeRaw,
                    labelScale: mapLabelScale,
                  });
                  return { seq: item.sequence_number, dataUrl };
                } catch {
                  return { seq: item.sequence_number, dataUrl: '' };
                }
              })
            );
            results.forEach(r => mapImages.set(r.seq, r.dataUrl));
          }
        }
      }

      // 🆕 صفحة جدول ملخّص اللوحات
      {
        const compactSummary = printItems.length > 18;
        const rowFontSize = compactSummary ? '11px' : '13px';
        const rowPadding = compactSummary ? '4px 6px' : '6px 8px';
        const rowsPerPage = showStatusInPrint ? 18 : 20;
        const totalSummaryPages = Math.max(1, Math.ceil(printItems.length / rowsPerPage));
        for (let pIdx = 0; pIdx < totalSummaryPages; pIdx++) {
          const chunk = printItems.slice(pIdx * rowsPerPage, (pIdx + 1) * rowsPerPage);
          const tableRowsHtml = chunk.map(it => `
            <tr>
              <td class="num">${it.sequence_number}</td>
              <td class="loc">${it.location_text || '-'}</td>
              <td class="loc">${it.nearest_landmark || '-'}</td>
              <td class="num">${formatSizeForPrint(it.size, showHeightInPrint) || '-'}</td>
              <td class="num">${it.faces_count || '-'}</td>
              <td class="coords">${it.latitude && it.longitude ? `${it.latitude}, ${it.longitude}` : '-'}</td>
              ${showStatusInPrint ? `<td class="num">${it.status || '-'}</td>` : ''}
            </tr>
          `).join('');
          pages.push(`
          <div class="page summary-page">
            <div class="summary-inner">
              <h2 class="summary-title">
                قائمة لوحات بلدية ${displayMunicipality || ''}
                ${totalSummaryPages > 1 ? `<span style="font-size:14px;font-weight:500;margin-right:8px;color:#555;">(صفحة ${pIdx + 1} من ${totalSummaryPages})</span>` : ''}
              </h2>
              <table class="summary-table">
                <thead>
                  <tr>
                    <th style="width:5%;">#</th>
                    <th style="width:15%;">الموقع</th>
                    <th style="width:${showStatusInPrint ? '38%' : '44%'};">أقرب نقطة</th>
                    <th style="width:9%;">المقاس</th>
                    <th style="width:7%;">الأوجه</th>
                    <th style="width:${showStatusInPrint ? '16%' : '18%'};">الإحداثيات</th>
                    ${showStatusInPrint ? `<th style="width:10%;">الحالة</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>
            </div>
            <style>
              .summary-page { padding: 0 !important; background: #fff !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; page-break-after: always !important; page-break-inside: avoid !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-inner { padding: 15mm 10mm 15mm 10mm; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; display:flex; flex-direction:column; gap:8mm; }
              .summary-title { text-align:center; font-family:'Doran'; font-size:22px; margin:0; color:#000; letter-spacing:0.5px; font-weight:700; flex:0 0 auto; }
              .summary-table { width:100%; border-collapse:separate; border-spacing:0; font-family:'Doran'; border:1px solid #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; table-layout:fixed; }
              .summary-table thead tr { background:#000 !important; color:#fff !important; }
              .summary-table thead { display: table-header-group; }
              .summary-table thead th { background:#000 !important; color:#fff !important; font-size:14px; padding:9px 6px; border-bottom:1px solid #000; border-right:1px solid #333; font-weight:700; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table thead th:first-child { border-right:none; }
              .summary-table tbody tr { height: ${compactSummary ? '12.5mm' : '14.5mm'}; background:#ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; page-break-inside: avoid; }
              .summary-table tbody td { padding:${rowPadding}; font-size:${rowFontSize}; border-bottom:1px solid #ccc; border-right:1px solid #ccc; text-align:center; color:#000; vertical-align:middle; line-height:1.25; }
              .summary-table tbody td:first-child { border-right:none; }
              .summary-table tbody td.loc { text-align:right; padding-right:10px; padding-left:10px; word-break:break-word; }
              .summary-table tbody td.num { font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; font-weight: 600; }
              .summary-table tbody td.coords { direction:ltr; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; font-size:${compactSummary ? '9.5px' : '11px'}; letter-spacing:0.2px; white-space:nowrap; font-weight: 600; }
              .summary-table tbody tr:nth-child(even) { background:#f0f0f0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table tbody tr:nth-child(even) td { background:#f0f0f0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table tbody tr:last-child td { border-bottom:none; }
              .summary-table { page-break-inside: avoid; }
              @media print {
                .summary-page { padding: 0 !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; }
                .summary-inner { padding: 15mm 10mm 15mm 10mm !important; }
              }
            </style>
          </div>
          `);
        }
      }

      for (const item of printItems) {
        const coords = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : '';
        const qrContent = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';

        let qrDataUrl = '';
        if (qrContent) {
          try {
            qrDataUrl = await QRCode.toDataURL(qrContent, { width: 100 });
          } catch (e) {}
        }

        const hasDesign = item.design_face_a || item.design_face_b;
        const mainImage = item.image_url || '';

        const pinColor = (s as any).pin_color?.trim() || undefined;
        const pinTextColor = (s as any).pin_text_color?.trim() || undefined;
        const printedSize = formatSizeForPrint(item.size, showHeightInPrint);
        const pinData = createPinSvgUrl(printedSize || 'متاحة', 'متاحة', false, undefined, undefined, pinColor, pinTextColor);
        const customPinUrl = (s as any).custom_pin_url?.trim();
        const pinSvgDataUrl = customPinUrl || pinData.url;

        let imageSectionHtml = '';

        if (printImageSource === 'map_pin' || printImageSource === 'map_only') {
          if (coords) {
            const [lat, lng] = coords.split(',').map(c => c.trim());
            const mapDataUrl = mapImages.get(item.sequence_number) || '';
            // Use pre-captured static image instead of live Google Map
            // ✅ في وضع "خريطة فقط" نتجاهل صورة اللوحة الفعلية
            const hasUploadedImage = printImageSource === 'map_pin' && !!item.image_url;
            // The printed pin must anchor by its real SVG tip, not by the image bounds.
            const pinWidth = parseInt(String(s.pin_size || '80')) || 80;
            const pinTotalHeight = pinData.pinSize + 20 + 12;
            const pinTipY = pinData.labelOffset + pinData.pinSize - 2;
            const pinTipOffsetPercent = customPinUrl ? 100 : (pinTipY / pinTotalHeight) * 100;
            const mapBlockHtml = `
              <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
                ${mapDataUrl
                  ? `<img src="${mapDataUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`
                  : `<div style="width: 100%; height: 100%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666;">لا تتوفر خريطة</div>`
                }
                <img src="${pinSvgDataUrl}" alt="دبوس" style="position: absolute; left: 50%; top: 50%; width: ${pinWidth}px; height: auto; transform: translate(-50%, -${pinTipOffsetPercent}%); pointer-events: none; z-index: 10;" />
              </div>
            `;
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 2px solid #ccc; border-radius: 8px;
                overflow: hidden; z-index: 5;
                display: flex; flex-direction: column;
              ">
                ${hasUploadedImage ? `
                  <div style="flex: 1 1 50%; min-height: 0; overflow: hidden; border-bottom: 1px solid #ddd;">
                    <img src="${item.image_url}" alt="صورة اللوحة" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                  </div>
                  <div style="flex: 1 1 50%; min-height: 0; position: relative; overflow: hidden;">
                    ${mapBlockHtml}
                  </div>
                ` : `
                  <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
                    ${mapBlockHtml}
                  </div>
                `}
                <div style="height: ${s.coords_bar_height || '26px'}; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; z-index: 12; border-top: 1px solid #ddd; flex-shrink: 0;">
                  <span style="font-size: ${s.coords_font_size || '11px'}; font-weight: 700; color: #222; direction: ltr; font-family: '${s.coords_font_family || 'Manrope'}-Bold', '${s.coords_font_family || 'Manrope'}', monospace; letter-spacing: 0.5px;">${lat}, ${lng}</span>
                </div>
              </div>
            `;
          } else {
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 2px solid #e0e0e0; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                background: linear-gradient(145deg, #f0f4f8, #e2e8f0);
                flex-direction: column; gap: 6px; z-index: 5;
              ">
                <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 80px; height: auto;" />
                <div style="font-size: 14px; font-weight: 700; color: #333;">لا توجد إحداثيات</div>
              </div>
            `;
          }
        } else {
          if (hasDesign) {
            imageSectionHtml = '';
          } else if (mainImage) {
            imageSectionHtml = `
              <div class="absolute-field" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${s.main_image_height}; overflow: hidden; border: 3px solid #000; border-radius: 0 0 0 8px; z-index: 5;">
                <img src="${mainImage}" alt="" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
            `;
          } else if (coords) {
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 3px solid #000; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                background: #f5f5f5; flex-direction: column; gap: 8px; z-index: 5;
              ">
                <div style="font-size: 14px; font-weight: 700; color: #333;">الإحداثيات</div>
                <div style="font-size: 18px; font-weight: 700; color: #000; direction: ltr; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">${coords}</div>
                <div style="font-size: 12px; color: #666; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">المقاس: ${formatSizeForPrint(item.size, showHeightInPrint)}</div>
              </div>
            `;
          }
        }

        const statusHtml = showStatusInPrint && item.status
          ? `<span class="mb-status" style="font-size: ${effectiveStatusPosition === 'custom' ? effectiveStatusFontSize : '14px'}; font-weight: 700; color: ${effectiveStatusPosition === 'custom' ? effectiveStatusColor : '#000'};">${item.status}</span>`
          : '';
        const statusAbove = effectiveStatusPosition === 'above_number' ? `<div style="margin-bottom: ${effectiveStatusGap} !important; display:block;">${statusHtml}</div>` : '';
        const statusBelow = effectiveStatusPosition === 'below_number' ? `<div style="margin-top: ${effectiveStatusGap} !important; display:block;">${statusHtml}</div>` : '';
        const statusBeside = effectiveStatusPosition === 'beside_number' ? `<span style="margin-right: ${effectiveStatusGap} !important; display:inline-block;">${statusHtml}</span>` : '';
        const statusHeader = effectiveStatusPosition === 'header' && statusHtml
          ? `<div class="absolute-field" style="top: ${effectiveStatusGap}; left: 50%; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';
        const statusFooter = effectiveStatusPosition === 'footer' && statusHtml
          ? `<div class="absolute-field" style="bottom: ${effectiveStatusGap}; left: 50%; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';
        const statusCustom = effectiveStatusPosition === 'custom' && statusHtml
          ? `<div class="absolute-field" style="top: ${effectiveStatusTop}; left: ${effectiveStatusLeft}; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';

        pages.push(`
          <div class="page">
            <div class="background"></div>
            ${statusHeader}

            <div class="absolute-field" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(-50%); width: 120mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: ${s.billboard_name_font_size || '32px'}; font-weight: ${s.billboard_name_font_weight || '700'}; color: ${s.billboard_name_color || '#000'}; line-height: 1; z-index: 5;">
              ${statusAbove}
              <div style="font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">${String(item.sequence_number).padStart(2, '0')}${statusBeside}</div>
              ${statusBelow}
            </div>
            ${statusFooter}
            ${statusCustom}

            <div class="absolute-field" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color}; z-index: 5;">
              ${generatePrintedSizeHtml(item.size, showHeightInPrint)}
            </div>

            <div class="absolute-field" style="top: ${s.faces_count_top}; left: ${s.faces_count_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color}; z-index: 5; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">
              ${item.faces_count}
            </div>

            ${imageSectionHtml}

            <div class="absolute-field" style="top: ${s.location_info_top}; left: ${s.location_info_left}; width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; z-index: 5;">
              ${displayMunicipality ? displayMunicipality + ' - ' : ''}${item.location_text || '—'}
            </div>

            <div class="absolute-field" style="top: ${s.landmark_info_top}; left: ${s.landmark_info_left}; width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; z-index: 5;">
              ${item.nearest_landmark || '—'}
            </div>

            ${qrDataUrl ? `
              <div class="absolute-field" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; text-align: center; z-index: 5;">
                <a href="${qrContent}" target="_blank" style="display: inline-block; cursor: pointer;">
                  <img src="${qrDataUrl}" alt="QR" style="width: ${s.qr_size}; height: ${s.qr_size}; object-fit: contain;" />
                </a>
              </div>
            ` : ''}

            ${hasDesign && printImageSource === 'actual_image' ? `
              <div class="absolute-field" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; gap: ${s.designs_gap}; z-index: 5;">
                ${item.design_face_a ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333;">التصميم - الوجه الأمامي</div>
                    <img src="${item.design_face_a}" alt="" style="width: 100%; max-height: ${s.design_image_height}; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />
                  </div>
                ` : ''}
                ${item.design_face_b ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333;">التصميم - الوجه الخلفي</div>
                    <img src="${item.design_face_b}" alt="" style="width: 100%; max-height: ${s.design_image_height}; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `);
      }

      const bUrl = window.location.origin;
      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>${collectionName} - ${printItems.length} لوحة</title>
          <style>
            @font-face { font-family: 'Manrope'; src: url('${bUrl}/Manrope-Medium.otf') format('opentype'); font-weight: 500; }
            @font-face { font-family: 'Manrope-Bold'; src: url('${bUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            @font-face { font-family: 'Doran'; src: url('${bUrl}/Doran-Medium.otf') format('opentype'); font-weight: 500; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 210mm; margin: 0 auto; padding: 0; background: white; }
            body { font-family: 'Doran', Arial, sans-serif; direction: rtl; color: #000; }
            .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
            .page:last-child { page-break-after: auto; }
            .background { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; background-image: url('${customBackgroundUrl}'); background-size: 210mm 297mm; background-repeat: no-repeat; z-index: 0; }
            .absolute-field { position: absolute; color: #000; }
            .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; }
            .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
            .print-dim-label { font-size: 0.45em; font-weight: 500; opacity: 0.6; margin-bottom: 2px; letter-spacing: 0.5px; }
            .print-dim-value { font-size: 1em; font-weight: 700; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; }
            .print-dim-separator { font-size: 0.65em; opacity: 0.45; margin-top: 0.25em; font-weight: 700; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; }
            @page { size: 210mm 297mm; margin: 0; }
            @media print {
              html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page { width: 210mm !important; height: 297mm !important; page-break-after: always !important; page-break-inside: avoid !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
              .page:last-child { page-break-after: auto !important; }
              @page { size: 210mm 297mm; margin: 0; }
            }
            @media screen { body { background: #f0f0f0; } .page { margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.2); } }
          </style>
        </head>
        <body>${pages.join('\n')}
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 500);
          });
        </script></body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`تم تحضير ${printItems.length} صفحة للطباعة`);
      }
    } catch (e) {
      toast.error('فشل في الطباعة');
    } finally {
      setPrintLoading(false);
      setShowPrintDialog(false);
    }
  };

  // ============ EXPORT TO EXCEL (same layout as print summary table + all display columns) ============
  const handleExportExcel = () => {
    if (currentCollection.items.length === 0) {
      toast.error('لا توجد لوحات للتصدير');
      return;
    }
    try {
      const items = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const displayMunicipality = municipalityName || collectionName || 'لوحات البلدية';
      const headers = [
        '#',
        'الموقع / اسم اللوحة',
        'البلدية',
        'أقرب نقطة دالة',
        'المقاس',
        'الأوجه',
        'الإحداثيات',
        'حالة اللوحة',
        'رابط الصورة',
      ];
      const rows = items.map(it => [
        it.sequence_number,
        it.location_text || it.billboard_name || '',
        it.municipality || '',
        it.nearest_landmark || '',
        formatSizeForPrint(it.size, showHeightInPrint) || '',
        it.faces_count || '',
        it.latitude && it.longitude ? `${it.latitude}, ${it.longitude}` : '',
        it.status || '',
        it.image_url || '',
      ]);
      const aoa = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Column widths matching the printed summary proportions + extra columns
      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 32 },  // location
        { wch: 18 },  // municipality
        { wch: 32 },  // landmark
        { wch: 14 },  // size
        { wch: 8 },   // faces
        { wch: 24 },  // coords
        { wch: 14 },  // status
        { wch: 40 },  // image url
      ];
      // RTL view
      (ws as any)['!sheetView'] = [{ rightToLeft: true }];
      // Freeze header row
      ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'لوحات البلدية');
      const fileName = `لوحات-${displayMunicipality}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`تم تصدير ${items.length} لوحة`);
    } catch (e) {
      console.error(e);
      toast.error('فشل تصدير ملف Excel');
    }
  };

  return (
    <div className="min-h-screen bg-background relative pb-20 selection:bg-indigo-500/30">
      {/* Ambient decorative glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] bg-purple-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-40 w-full border-b border-border/15 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md text-white shadow-indigo-500/10">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
                  تنظيم لوحات البلدية
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ترتيب، تصنيف وطباعة لوحات البلدية بشكل تفاعلي
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-card/65 backdrop-blur-sm border border-border/15 rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>{currentCollection.items.length} لوحة</span>
              </div>
              <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground gap-1.5" onClick={() => setShowCollectionsDialog(true)}>
                <FolderOpen className="h-4 w-4" />
                المحفوظات
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground gap-1.5" onClick={saveCollection} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground gap-1.5" onClick={() => setShowStickerSettings(true)}>
                <Settings2 className="h-4 w-4" />
                إعدادات الملصقات
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 gap-1.5" onClick={() => printStickers(currentCollection.items, stickerSettings, municipalityName)} disabled={currentCollection.items.length === 0}>
                <Sticker className="h-4 w-4" />
                طباعة ملصقات
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground gap-1.5" onClick={() => setShowPrintSettings(true)}>
                <Settings2 className="h-4 w-4" />
                إعدادات الطباعة
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5" onClick={handleExportExcel} disabled={currentCollection.items.length === 0}>
                <FileSpreadsheet className="h-4 w-4" />
                تنزيل Excel
              </Button>
              <Button size="sm" className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-600/10 gap-1.5" onClick={() => { setPrintImageSource('map_pin'); setShowPrintDialog(true); }} disabled={currentCollection.items.length === 0}>
                <Printer className="h-4 w-4" />
                طباعة الكل
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
        {/* Collection name & Binding (Municipality + City + Default Size) */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-transparent opacity-70" />
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              تكوين المجموعة وربط البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">اسم المجموعة *</Label>
                <Input
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="مثال: قائمة يناير 2026"
                  className="h-10 rounded-xl bg-background/50 border-border/15 focus-visible:ring-indigo-500 font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">البلدية المرتبطة *</Label>
                <Select value={municipalityName || '__none__'} onValueChange={v => setMunicipalityName(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر البلدية" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {municipalities.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">المدينة المرتبطة</Label>
                <Select value={cityName || '__none__'} onValueChange={v => setCityName(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">المقاس الافتراضي</Label>
                <Select value={defaultSize || '__none__'} onValueChange={v => setDefaultSize(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر مقاساً" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {dbSizes.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(municipalityName || cityName || defaultSize) && (
              <div className="flex items-center gap-2 flex-wrap mt-4 pt-3.5 border-t border-border/10">
                <span className="text-[11px] text-muted-foreground">روابط البيانات النشطة:</span>
                {municipalityName && <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 gap-1 rounded-lg"><Building2 className="h-3 w-3" />{municipalityName}</Badge>}
                {cityName && <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 rounded-lg">{cityName}</Badge>}
                {defaultSize && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 rounded-lg">المقاس الافتراضي: {defaultSize}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-indigo-500/5 hover:border-indigo-500/30 gap-1.5 transition-all">
            <Search className="h-4 w-4 text-indigo-500" />
            جلب لوحات موجودة
          </Button>
          <Button onClick={() => setShowMunicipalityImportDialog(true)} variant="outline" size="sm" className="h-9 rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-indigo-500/5 hover:border-indigo-500/30 gap-1.5 transition-all">
            <Building2 className="h-4 w-4 text-indigo-500" />
            جلب لوحات بلدية كاملة
          </Button>
          <label className="cursor-pointer inline-flex">
            <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border/20 bg-card/45 backdrop-blur-sm text-xs font-medium hover:bg-indigo-500/5 hover:border-indigo-500/30 cursor-pointer transition-all">
              <Upload className="h-4 w-4 text-indigo-500" />
              استيراد من Excel
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
          </label>
          <Button onClick={openAddDialog} size="sm" className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Plus className="h-4 w-4" />
            إضافة لوحة جديدة
          </Button>
          <Button onClick={clearAllItems} variant="destructive" size="sm" className="h-9 rounded-xl gap-1.5 shadow-sm shadow-destructive/10">
            <Trash2 className="h-4 w-4" />
            مسح الكل
          </Button>
        </div>

        {/* Items Organizer */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/50 to-card/25 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-5 border-b border-border/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>اللوحات الحالية</span>
                  <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-md">
                    {currentCollection.items.length}
                  </span>
                </CardTitle>
                {municipalityName && (
                  <Badge variant="outline" className="text-[10px] bg-indigo-500/5 text-indigo-500 border-indigo-500/10">
                    <Building2 className="h-3 w-3 ml-1" />
                    {municipalityName}
                  </Badge>
                )}
              </div>

              {/* View Switcher & Search & Bulk Status */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View Mode Switcher */}
                <div className="bg-muted/60 p-1 rounded-xl flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${viewMode === 'table' ? 'shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-3.5 w-3.5" />
                    جدول
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${viewMode === 'grid' ? 'shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    شبكة
                  </Button>
                </div>

                {/* Search in Items */}
                <div className="relative">
                  <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchItems}
                    onChange={e => setSearchItems(e.target.value)}
                    placeholder="بحث في القائمة..."
                    className="h-8 w-44 text-xs pr-8.5 rounded-xl border-border/15 bg-background/50 focus-visible:ring-indigo-500"
                  />
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent gap-1"
                  disabled={currentCollection.items.length === 0}
                  onClick={() => { setBulkStatusTarget('all'); setBulkStatusValue('متاحة'); setBulkStatusCustom(''); setShowBulkStatusDialog(true); }}
                  title="تغيير حالة جميع اللوحات"
                >
                  تغيير حالة الكل
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-3 flex-wrap mt-3.5 pt-3 border-t border-border/10">
                <Badge className="bg-indigo-500 text-white rounded-lg px-2.5 py-0.5 text-xs font-semibold">
                  {selectedItems.size} محدد
                </Badge>
                
                {/* Bulk size change */}
                <div className="flex items-center gap-1.5">
                  <Select value={bulkSize} onValueChange={setBulkSize}>
                    <SelectTrigger className="h-8 w-32 text-xs rounded-xl bg-background/50 border-border/15">
                      <SelectValue placeholder="اختر مقاس" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      {availableSizes.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={bulkSize}
                    onChange={e => setBulkSize(e.target.value)}
                    placeholder="أو اكتب مقاس"
                    className="h-8 w-28 text-xs rounded-xl bg-background/50 border-border/15"
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45" onClick={() => {
                    if (!bulkSize) return;
                    setCurrentCollection(prev => ({
                      ...prev,
                      items: prev.items.map(item => selectedItems.has(item.sequence_number) ? { ...item, size: bulkSize } : item),
                    }));
                    toast.success(`تم تغيير مقاس ${selectedItems.size} لوحة إلى ${bulkSize}`);
                    setBulkSize('');
                  }}>
                    تطبيق المقاس
                  </Button>
                </div>

                {/* Swap 2 selected */}
                {selectedItems.size === 2 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45 gap-1.5" onClick={() => {
                    const seqs = [...selectedItems];
                    setCurrentCollection(prev => {
                      const items = [...prev.items];
                      const idx1 = items.findIndex(i => i.sequence_number === seqs[0]);
                      const idx2 = items.findIndex(i => i.sequence_number === seqs[1]);
                      if (idx1 >= 0 && idx2 >= 0) {
                        const seq1 = items[idx1].sequence_number;
                        const seq2 = items[idx2].sequence_number;
                        const temp = { ...items[idx1] };
                        items[idx1] = { ...items[idx2], sequence_number: seq1 };
                        items[idx2] = { ...temp, sequence_number: seq2 };
                      }
                      return { ...prev, items };
                    });
                    setSelectedItems(new Set());
                    toast.success('تم تبديل الموقعين');
                  }}>
                    <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
                    تبديل المواقع
                  </Button>
                )}

                {/* Convert selected to official billboards */}
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  onClick={convertSelectedToOfficialBillboards}
                  title="إنشاء لوحات رسمية في قائمة اللوحات وإسناد كود لكل واحدة"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  تحويل إلى لوحات رسمية
                </Button>

                {/* Delete selected */}
                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 gap-1" onClick={() => {
                  setCurrentCollection(prev => {
                    const filtered = prev.items.filter(i => !selectedItems.has(i.sequence_number));
                    const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
                    return { ...prev, items: reSequenced };
                  });
                  toast.success(`تم حذف ${selectedItems.size} لوحة`);
                  setSelectedItems(new Set());
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف المحدد
                </Button>

                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45" onClick={() => { setBulkStatusTarget('selected'); setBulkStatusValue('متاحة'); setBulkStatusCustom(''); setShowBulkStatusDialog(true); }}>
                  تغيير حالة المحدد
                </Button>

                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedItems(new Set())}>
                  إلغاء التحديد
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {currentCollection.items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MapPin className="h-14 w-14 mx-auto mb-3 opacity-20 text-indigo-500" />
                <p className="text-sm">لا توجد لوحات في هذه المجموعة حتى الآن.</p>
                <p className="text-xs text-muted-foreground mt-1">ابدأ بـ إضافة لوحة جديدة، أو جلب لوحات من النظام أو ملف Excel.</p>
              </div>
            ) : viewMode === 'table' ? (
              /* ==================== TABLE VIEW ==================== */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/10 bg-muted/30">
                      <th className="p-3 text-center w-6"></th>
                      <th className="p-3 text-center w-8">
                        <Checkbox
                          checked={selectedItems.size === currentCollection.items.length && currentCollection.items.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems(new Set(currentCollection.items.map(i => i.sequence_number)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-3 text-center w-12 font-semibold">#</th>
                      <th className="p-3 text-right font-semibold">الموقع / اسم اللوحة</th>
                      <th className="p-3 text-right font-semibold">أقرب نقطة دالة</th>
                      <th className="p-3 text-center w-[220px] font-semibold">المقاس</th>
                      <th className="p-3 text-center font-semibold">الأوجه</th>
                      <th className="p-3 text-center font-semibold">الإحداثيات</th>
                      <th className="p-3 text-center w-32 font-semibold">حالة اللوحة</th>
                      <th className="p-3 text-center w-44 font-semibold">صورة اللوحة</th>
                      <th className="p-3 text-center w-40 font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map(item => (
                      <tr
                        key={item.sequence_number}
                        className={`border-b border-border/10 transition-all cursor-grab active:cursor-grabbing hover:bg-muted/10 ${selectedItems.has(item.sequence_number) ? 'bg-indigo-500/[0.03] hover:bg-indigo-500/[0.05]' : ''} ${dragItem.current === item.sequence_number ? 'opacity-40 scale-[0.99] border-dashed border-indigo-500/30' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(item.sequence_number)}
                        onDragEnter={() => handleDragEnter(item.sequence_number)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <td className="p-2 text-center text-muted-foreground">
                          <GripVertical className="h-4 w-4 mx-auto opacity-40 hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(item.sequence_number)}
                            onCheckedChange={(checked) => {
                              setSelectedItems(prev => {
                                const n = new Set(prev);
                                if (checked) n.add(item.sequence_number); else n.delete(item.sequence_number);
                                return n;
                              });
                            }}
                          />
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-500">{item.sequence_number}</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground/90">{item.location_text || item.billboard_name || '—'}</span>
                            {item.municipality && (
                              <span className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5" />
                                {item.municipality}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{item.nearest_landmark || '—'}</td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <DimensionInput
                            value={item.size}
                            onChange={newSize => updateItem(item.sequence_number, { size: newSize })}
                          />
                        </td>
                        <td className="p-3 text-center text-xs font-medium text-foreground/80">{item.faces_count}</td>
                        <td className="p-3 text-center text-[10px] font-mono text-muted-foreground" dir="ltr">
                          {item.latitude && item.longitude ? `${item.latitude?.toFixed(5)}, ${item.longitude?.toFixed(5)}` : '—'}
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={item.status || ''}
                            onChange={e => updateItem(item.sequence_number, { status: e.target.value })}
                            placeholder="متاحة"
                            className="h-7.5 w-28 text-center text-xs mx-auto rounded-lg bg-background/50 border-border/15 focus-visible:ring-indigo-500 font-medium"
                          />
                        </td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="w-40 mx-auto">
                            {item.image_url ? (
                              <div className="relative group overflow-hidden rounded-lg border border-border/15 shadow-sm">
                                <img
                                  src={item.image_url}
                                  alt="صورة اللوحة"
                                  className="w-full h-12.5 object-cover transition-transform duration-300 group-hover:scale-105"
                                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItem(item.sequence_number, { image_url: null })}
                                  className="absolute top-1 right-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center shadow transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                                  title="حذف الصورة"
                                >
                                  <XIcon className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <ImageUploadZone
                                value={item.image_url || ''}
                                onChange={(url) => updateItem(item.sequence_number, { image_url: url })}
                                imageName={`mb-${item.sequence_number}-${(item.billboard_name || item.location_text || 'lwh').replace(/\s+/g, '-').slice(0, 30)}`}
                                folder={`municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}/${(collectionName || 'untitled').replace(/[^\w\u0600-\u06FF-]/g, '_')}`}
                                showUrlInput={false}
                                showPreview={false}
                                label=""
                                dropZoneHeight="h-12.5"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'up')} disabled={item.sequence_number === 1} title="أعلى">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'down')} disabled={item.sequence_number === currentCollection.items.length} title="أسفل">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => handleReplace(item.sequence_number)} title="استبدال">
                              <Replace className="h-3.5 w-3.5 text-indigo-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => setEditingItem(item)} title="تعديل">
                              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => removeItem(item.sequence_number)} title="حذف">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {searchItems && sortedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    لا توجد نتائج للبحث "{searchItems}"
                  </div>
                )}
              </div>
            ) : (
              /* ==================== PREMIUM CARD GRID VIEW ==================== */
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
                  {sortedItems.map(item => (
                    <div
                      key={item.sequence_number}
                      className={`relative overflow-hidden rounded-[20px] border border-border/15 bg-gradient-to-br from-card/65 to-card/35 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.015] hover:border-indigo-500/20 group flex flex-col justify-between min-h-[340px] select-none ${selectedItems.has(item.sequence_number) ? 'border-indigo-500/40 ring-1 ring-indigo-500/30 shadow-indigo-500/5 bg-indigo-500/[0.015]' : ''} ${dragItem.current === item.sequence_number ? 'opacity-40 scale-[0.98] border-dashed border-indigo-500/30' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(item.sequence_number)}
                      onDragEnter={() => handleDragEnter(item.sequence_number)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {/* Drag Grip & Checkbox top bar */}
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(item.sequence_number)}
                            onCheckedChange={(checked) => {
                              setSelectedItems(prev => {
                                const n = new Set(prev);
                                if (checked) n.add(item.sequence_number); else n.delete(item.sequence_number);
                                return n;
                              });
                            }}
                            className="rounded-md border-border/20"
                          />
                          <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-lg text-xs">
                            <span>#</span>
                            <span>{String(item.sequence_number).padStart(2, '0')}</span>
                          </div>
                        </div>

                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-muted/60 opacity-60 hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Image Preview / Placeholder */}
                      <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-muted/40 border border-border/10 mb-3.5 group-hover:border-indigo-500/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                        {item.image_url ? (
                          <>
                            <img
                              src={item.image_url}
                              alt="صورة اللوحة"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(item.sequence_number, { image_url: null })}
                              className="absolute top-1.5 right-1.5 bg-destructive/95 hover:bg-destructive text-white rounded-full h-6 w-6 flex items-center justify-center shadow transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 z-10"
                              title="حذف الصورة"
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                            <ImageUploadZone
                              value={item.image_url || ''}
                              onChange={(url) => updateItem(item.sequence_number, { image_url: url })}
                              imageName={`mb-${item.sequence_number}-${(item.billboard_name || item.location_text || 'lwh').replace(/\s+/g, '-').slice(0, 30)}`}
                              folder={`municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}/${(collectionName || 'untitled').replace(/[^\w\u0600-\u06FF-]/g, '_')}`}
                              showUrlInput={false}
                              showPreview={false}
                              label="اضغط أو اسحب صورة"
                              dropZoneHeight="h-full w-full"
                            />
                          </div>
                        )}
                      </div>

                      {/* Info body */}
                      <div className="flex-1 space-y-2.5">
                        <div>
                          <div className="font-bold text-sm text-foreground/90 line-clamp-1">
                            {item.location_text || item.billboard_name || 'لوحة بدون اسم'}
                          </div>
                          {item.nearest_landmark && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {item.nearest_landmark}
                            </div>
                          )}
                        </div>

                        {/* Badges metadata */}
                        <div className="flex flex-wrap gap-1.5">
                          {item.latitude && item.longitude && (
                            <Badge variant="outline" className="text-[9px] rounded-lg px-1.5 font-mono border-border/15 bg-background/40">
                              {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                            </Badge>
                          )}
                        </div>

                        {/* Size 3D Dimension Editor */}
                        <div className="space-y-1 pt-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-muted-foreground font-semibold">المقاس (طول × عرض × ارتفاع)</span>
                          <DimensionInput
                            value={item.size}
                            onChange={newSize => updateItem(item.sequence_number, { size: newSize })}
                            className="w-full bg-background/30"
                          />
                        </div>

                        {/* Inline controls (Faces count & status) */}
                        <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">الأوجه</span>
                            <Select value={item.faces_count || 'وجهين'} onValueChange={v => updateItem(item.sequence_number, { faces_count: v })}>
                              <SelectTrigger className="h-7.5 text-[11px] rounded-lg bg-background/40 border-border/15"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                                <SelectItem value="وجه" className="text-xs">وجه واحد</SelectItem>
                                <SelectItem value="وجهين" className="text-xs">وجهين</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">الحالة</span>
                            <Input
                              value={item.status || ''}
                              onChange={e => updateItem(item.sequence_number, { status: e.target.value })}
                              placeholder="متاحة"
                              className="h-7.5 text-center text-xs rounded-lg bg-background/40 border-border/15 focus-visible:ring-indigo-500 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card actions bottom bar */}
                      <div className="flex items-center justify-between border-t border-border/10 mt-3 pt-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'up')} disabled={item.sequence_number === 1} title="أعلى">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'down')} disabled={item.sequence_number === currentCollection.items.length} title="أسفل">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => handleReplace(item.sequence_number)} title="استبدال لوحة">
                            <Replace className="h-3.5 w-3.5 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => setEditingItem(item)} title="تعديل البيانات">
                            <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => removeItem(item.sequence_number)} title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {searchItems && sortedItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    لا توجد نتائج للبحث "{searchItems}"
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/50 to-card/25 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden relative">
          <CardHeader className="pb-3 pt-5 border-b border-border/10">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-4.5 w-4.5 text-indigo-500" />
              <span>خريطة توزع اللوحات</span>
              <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-md">
                {mapBillboards.length} معرّفة الإحداثيات
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ height: '600px' }} className="rounded-b-[20px] overflow-hidden relative">
              {mapBillboards.length > 0 ? (
                <GoogleHomeMap billboards={mapBillboards} />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted/10 text-muted-foreground p-8">
                  <div className="text-center max-w-sm animate-in fade-in duration-300">
                    <MapPin className="h-12 w-12 mx-auto mb-3.5 opacity-25 text-indigo-500 animate-bounce" />
                    <h3 className="font-bold text-foreground/85 mb-1 text-sm">الخريطة فارغة</h3>
                    <p className="text-xs text-muted-foreground">يرجى إضافة إحداثيات (خط العرض وخط الطول) للوحات حتى نتمكن من تمثيلها جغرافياً على الخريطة.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Add new billboard dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">إضافة لوحة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>المقاس (طول × عرض × ارتفاع) *</span>
                {defaultSize && <span className="text-[10px] text-indigo-500 font-normal">(الافتراضي: {defaultSize})</span>}
              </Label>
              <div className="flex flex-col gap-2">
                <Select value={dbSizes.includes(newItem.size || '') ? newItem.size : ''} onValueChange={v => setNewItem(p => ({ ...p, size: v }))}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue placeholder="اختر مقاساً جاهزاً (اختياري)" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    {dbSizes.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
                <DimensionInput
                  value={newItem.size || ''}
                  onChange={newSize => setNewItem(p => ({ ...p, size: newSize }))}
                  className="w-full bg-background/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">عدد الأوجه</Label>
              <Select value={newItem.faces_count || 'وجهين'} onValueChange={v => setNewItem(p => ({ ...p, faces_count: v }))}>
                <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                  <SelectItem value="وجه">وجه واحد</SelectItem>
                  <SelectItem value="وجهين">وجهين</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">موقع اللوحة</Label>
              <Input value={newItem.location_text || ''} onChange={e => setNewItem(p => ({ ...p, location_text: e.target.value }))} placeholder="مثال: طريق الشط" className="rounded-xl border-border/15 bg-background/50 h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">أقرب نقطة دالة</Label>
              <Input value={newItem.nearest_landmark || ''} onChange={e => setNewItem(p => ({ ...p, nearest_landmark: e.target.value }))} placeholder="مثال: وسط جسر القبة الفلكية" className="rounded-xl border-border/15 bg-background/50 h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">الإحداثيات (Lat, Lng)</Label>
              <Input
                dir="ltr"
                value={newItem.latitude && newItem.longitude ? `${newItem.latitude},${newItem.longitude}` : ''}
                onChange={e => {
                  const parts = e.target.value.split(',').map(c => c.trim());
                  const lat = parts[0] ? parseFloat(parts[0]) : null;
                  const lng = parts[1] ? parseFloat(parts[1]) : null;
                  setNewItem(p => ({ ...p, latitude: isNaN(lat as number) ? null : lat, longitude: isNaN(lng as number) ? null : lng }));
                }}
                placeholder="32.901753, 13.217222"
                className="font-mono text-sm rounded-xl border-border/15 bg-background/50 h-10"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={addNewItem} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import existing billboards dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <span>جلب لوحات من النظام</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث بالاسم أو المدينة أو المقاس أو الرقم..." className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5" />
            </div>

            {(municipalityName || cityName) && (
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 border border-border/10 rounded-xl text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="font-medium text-muted-foreground">الفلترة النشطة:</span>
                  {municipalityName && <Badge variant="outline" className="bg-indigo-500/5 text-indigo-500 border-indigo-500/10 rounded-lg">{municipalityName}</Badge>}
                  {cityName && <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/10 rounded-lg">{cityName}</Badge>}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={restrictImportToMunicipality} onCheckedChange={(c) => setRestrictImportToMunicipality(!!c)} className="rounded-md" />
                  <span className="text-muted-foreground font-semibold">اقتصار النتائج على الفلترة</span>
                </label>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground flex items-center justify-between px-1 shrink-0">
              <span>تم اختيار: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedBillboardIds.size}</strong> لوحة</span>
              <span>يعرض أول 200 نتيجة مطابقة</span>
            </div>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/15 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center"></th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">ID</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">الاسم</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">المقاس</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">المدينة</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">الحالة</th>
                      <th className="p-3 text-center w-16 font-semibold text-muted-foreground">إضافة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImportBillboards.map(b => (
                      <tr key={b.ID} className={`border-b border-border/10 hover:bg-muted/30 cursor-pointer transition-colors ${selectedBillboardIds.has(b.ID) ? 'bg-indigo-500/[0.02]' : ''}`} onClick={() => {
                        setSelectedBillboardIds(prev => {
                          const n = new Set(prev);
                          if (n.has(b.ID)) n.delete(b.ID); else n.add(b.ID);
                          return n;
                        });
                      }}>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedBillboardIds.has(b.ID)} onCheckedChange={(checked) => {
                            setSelectedBillboardIds(prev => {
                              const n = new Set(prev);
                              if (checked) n.add(b.ID); else n.delete(b.ID);
                              return n;
                            });
                          }} className="rounded-md" />
                        </td>
                        <td className="p-3 font-mono text-xs">{b.ID}</td>
                        <td className="p-3 font-medium">{b.Billboard_Name || '—'}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className="rounded-lg">{b.Size || '—'}</Badge></td>
                        <td className="p-3">{b.City || '—'}</td>
                        <td className="p-3 text-center">
                          <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'} className="rounded-lg">{b.Status || '—'}</Badge>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-500 rounded-lg hover:bg-indigo-500/10" title="إضافة سريعة تلقائية" onClick={() => quickAddBillboard(b)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredImportBillboards.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-10">لا توجد نتائج مطابقة. {restrictImportToMunicipality && (municipalityName || cityName) ? 'جرّب إلغاء تفعيل اقتصار النتائج.' : ''}</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter className="gap-2 shrink-0 border-t border-border/10 pt-4">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={importSelectedBillboards} disabled={selectedBillboardIds.size === 0} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              جلب {selectedBillboardIds.size} لوحة محددة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace billboard dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Replace className="h-5 w-5 text-indigo-500" />
              <span>استبدال لوحة رقم {replaceTarget}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث عن اللوحة البديلة في النظام..." autoFocus className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5" />
            </div>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/15 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center"></th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">ID</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">الاسم</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">المقاس</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">المدينة</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImportBillboards.map(b => (
                      <tr key={b.ID} className={`border-b border-border/10 hover:bg-muted/30 cursor-pointer transition-colors ${selectedBillboardIds.has(b.ID) ? 'bg-indigo-500/[0.04]' : ''}`} onClick={() => {
                        setSelectedBillboardIds(new Set([b.ID]));
                      }}>
                        <td className="p-3 text-center">
                          <Checkbox checked={selectedBillboardIds.has(b.ID)} onCheckedChange={() => setSelectedBillboardIds(new Set([b.ID]))} className="rounded-md" />
                        </td>
                        <td className="p-3 font-mono text-xs">{b.ID}</td>
                        <td className="p-3 font-medium">{b.Billboard_Name || '—'}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className="rounded-lg">{b.Size || '—'}</Badge></td>
                        <td className="p-3">{b.City || '—'}</td>
                        <td className="p-3 text-center">
                          <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'} className="rounded-lg">{b.Status || '—'}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredImportBillboards.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-10">لا توجد نتائج مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="gap-2 shrink-0 border-t border-border/10 pt-4">
            <Button variant="outline" onClick={() => setShowReplaceDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={confirmReplace} disabled={selectedBillboardIds.size !== 1} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              تأكيد الاستبدال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">تعديل لوحة رقم {editingItem?.sequence_number}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">المقاس (طول × عرض × ارتفاع)</Label>
                <div className="flex flex-col gap-2">
                  <Select value={dbSizes.includes(editingItem.size || '') ? editingItem.size : ''} onValueChange={v => setEditingItem({ ...editingItem, size: v })}>
                    <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue placeholder="اختر مقاساً جاهزاً (اختياري)" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      {dbSizes.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <DimensionInput
                    value={editingItem.size || ''}
                    onChange={newSize => setEditingItem({ ...editingItem, size: newSize })}
                    className="w-full bg-background/50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">عدد الأوجه</Label>
                <Select value={editingItem.faces_count} onValueChange={v => setEditingItem({ ...editingItem, faces_count: v })}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="وجه">وجه واحد</SelectItem>
                    <SelectItem value="وجهين">وجهين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">موقع اللوحة</Label>
                <Input value={editingItem.location_text} onChange={e => setEditingItem({ ...editingItem, location_text: e.target.value })} className="rounded-xl border-border/15 bg-background/50 h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">أقرب نقطة دالة</Label>
                <Input value={editingItem.nearest_landmark} onChange={e => setEditingItem({ ...editingItem, nearest_landmark: e.target.value })} className="rounded-xl border-border/15 bg-background/50 h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">الإحداثيات (Lat, Lng)</Label>
                <Input
                  dir="ltr"
                  value={editingItem.latitude && editingItem.longitude ? `${editingItem.latitude},${editingItem.longitude}` : ''}
                  onChange={e => {
                    const parts = e.target.value.split(',').map(c => c.trim());
                    const lat = parts[0] ? parseFloat(parts[0]) : null;
                    const lng = parts[1] ? parseFloat(parts[1]) : null;
                    setEditingItem({ ...editingItem, latitude: isNaN(lat as number) ? null : lat, longitude: isNaN(lng as number) ? null : lng });
                  }}
                  placeholder="32.901753, 13.217222"
                  className="font-mono text-sm rounded-xl border-border/15 bg-background/50 h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={() => {
              if (editingItem) {
                updateItem(editingItem.sequence_number, editingItem);
                setEditingItem(null);
                toast.success('تم تحديث بيانات اللوحة');
              }
            }} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved collections dialog */}
      <Dialog open={showCollectionsDialog} onOpenChange={(open) => { setShowCollectionsDialog(open); if (open) loadCollections(); }}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">المجموعات المحفوظة</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {collections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد مجموعات محفوظة حالياً
              </div>
            ) : (
              <ScrollArea className="max-h-[350px] pr-1">
                <div className="space-y-2">
                  {collections.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3.5 border border-border/10 rounded-2xl hover:bg-muted/50 cursor-pointer transition-colors group/item"
                      onClick={() => loadCollection(c.id)}
                    >
                      <div>
                        <div className="font-semibold text-sm group-hover/item:text-indigo-500 transition-colors">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                          <span>تاريخ الحفظ:</span>
                          <span>{new Date(c.created_at).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" className="rounded-xl h-8 text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 hover:bg-indigo-500 hover:text-white transition-all">فتح</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-indigo-500" />
              <span>تحضير الطباعة الشاملة</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 leading-relaxed">
              سيتم طباعة <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{currentCollection.items.length}</strong> لوحة بترتيبها التسلسلي المسجل (من رقم 1 إلى {currentCollection.items.length}).
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs text-muted-foreground">مصدر صورة اللوحة في الطباعة</Label>
              <RadioGroup value={printImageSource} onValueChange={(v) => setPrintImageSource(v as 'actual_image' | 'map_pin' | 'map_only')} className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-3.5 border border-border/15 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setPrintImageSource('actual_image')}>
                  <RadioGroupItem value="actual_image" id="actual_image" className="mt-0.5" checked={printImageSource === 'actual_image'} />
                  <label htmlFor="actual_image" className="cursor-pointer flex-1 select-none">
                    <div className="font-semibold text-sm">الصورة الفعلية للوحة</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">استخدام صورة اللوحة أو التصميم المرفوع في النظام</div>
                  </label>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 border border-border/15 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setPrintImageSource('map_pin')}>
                  <RadioGroupItem value="map_pin" id="map_pin" className="mt-0.5" checked={printImageSource === 'map_pin'} />
                  <label htmlFor="map_pin" className="cursor-pointer flex-1 select-none">
                    <div className="font-semibold text-sm">دبوس الخريطة مع المقاس</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">عرض شكل الدبوس مع المقاس والإحداثيات بدلاً من الصورة</div>
                  </label>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 border border-border/15 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setPrintImageSource('map_only')}>
                  <RadioGroupItem value="map_only" id="map_only" className="mt-0.5" checked={printImageSource === 'map_only'} />
                  <label htmlFor="map_only" className="cursor-pointer flex-1 select-none">
                    <div className="font-semibold text-sm">خريطة ودبوس فقط (بدون صور)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">عرض الخريطة الجغرافية مع الدبوس فقط كخلفية دلالية</div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-3.5 border border-border/15 rounded-xl">
              <div>
                <Label htmlFor="show_status_in_print" className="font-bold text-xs text-muted-foreground">إظهار حالة اللوحة في الطباعة</Label>
                <div className="text-[11px] text-muted-foreground mt-0.5">تظهر الحالة بجانب رقم اللوحة وفي جدول الملخّص</div>
              </div>
              <Switch id="show_status_in_print" checked={showStatusInPrint} onCheckedChange={(v) => updateAndSaveStatusSetting('mun_show_status', v ? 'true' : 'false')} />
            </div>

            <div className="flex items-center justify-between p-3.5 border border-border/15 rounded-xl">
              <div>
                <Label htmlFor="show_height_in_print" className="font-bold text-xs text-muted-foreground">إظهار الارتفاع في الطباعة</Label>
                <div className="text-[11px] text-muted-foreground mt-0.5">تضمين البُعد الثالث (الارتفاع) في المقاس المطبوع</div>
              </div>
              <Switch id="show_height_in_print" checked={showHeightInPrint} onCheckedChange={setShowHeightInPrint} />
            </div>

            {showStatusInPrint && (
              <div className="space-y-3 p-3.5 border border-border/15 rounded-xl bg-muted/20 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-xs text-muted-foreground">موقع الحالة في صفحة اللوحة</Label>
                  <Select value={statusPosition} onValueChange={(v) => updateAndSaveStatusSetting('mun_status_position', v)}>
                    <SelectTrigger className="h-9 rounded-lg bg-background/50 border-border/15 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md text-xs">
                      <SelectItem value="below_number">تحت رقم اللوحة</SelectItem>
                      <SelectItem value="above_number">فوق رقم اللوحة</SelectItem>
                      <SelectItem value="beside_number">بجانب رقم اللوحة</SelectItem>
                      <SelectItem value="header">في رأس الصفحة</SelectItem>
                      <SelectItem value="footer">في تذييل الصفحة</SelectItem>
                      <SelectItem value="custom">موقع مخصص (إحداثيات)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(statusPosition === 'below_number' || statusPosition === 'above_number' || statusPosition === 'beside_number') && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">البُعد عن الرقم (مثال: 2mm)</Label>
                    <Input value={statusGap} onChange={e => updateAndSaveStatusSetting('mun_status_gap', e.target.value)} className="h-8.5 text-xs rounded-lg bg-background/50 border-border/15" />
                  </div>
                )}
                {statusPosition === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Top (مثال: 12mm)</Label>
                      <Input value={statusTop} onChange={e => updateAndSaveStatusSetting('mun_status_top', e.target.value)} className="h-8.5 text-xs rounded-lg bg-background/50 border-border/15" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Left (مثال: 50%)</Label>
                      <Input value={statusLeft} onChange={e => updateAndSaveStatusSetting('mun_status_left', e.target.value)} className="h-8.5 text-xs rounded-lg bg-background/50 border-border/15" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">حجم الخط (مثال: 14px)</Label>
                      <Input value={statusFontSize} onChange={e => updateAndSaveStatusSetting('mun_status_font_size', e.target.value)} className="h-8.5 text-xs rounded-lg bg-background/50 border-border/15" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">اللون</Label>
                      <Input type="color" value={statusColor} onChange={e => updateAndSaveStatusSetting('mun_status_color', e.target.value)} className="h-8.5 p-1 rounded-lg bg-background/50 border-border/15 w-full cursor-pointer" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <BackgroundSelector value={customBackgroundUrl} onChange={setCustomBackgroundUrl} />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowPrintDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={handlePrint} disabled={printLoading} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm shadow-indigo-500/10">
              <Printer className="h-4 w-4" />
              {printLoading ? 'جاري التجهيز...' : 'بدء الطباعة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk status dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">
              {bulkStatusTarget === 'all' ? 'تغيير حالة جميع اللوحات' : `تغيير حالة ${selectedItems.size} لوحة محددة`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">اختر حالة جاهزة</Label>
              <Select value={bulkStatusValue} onValueChange={(v) => { setBulkStatusValue(v); setBulkStatusCustom(''); }}>
                <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                  <SelectItem value="متاحة">متاحة</SelectItem>
                  <SelectItem value="محجوزة">محجوزة</SelectItem>
                  <SelectItem value="مؤجرة">مؤجرة</SelectItem>
                  <SelectItem value="صيانة">صيانة</SelectItem>
                  <SelectItem value="غير صالحة">غير صالحة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">أو أدخل حالة مخصصة</Label>
              <Input
                value={bulkStatusCustom}
                onChange={e => setBulkStatusCustom(e.target.value)}
                placeholder="مثلاً: قيد الصيانة بعد 1 يونيو"
                className="rounded-xl border-border/15 bg-background/50 h-10 text-sm"
              />
              <div className="text-[10px] text-muted-foreground">عند إدخال نص مخصص سيُستخدم كحالة رسمية بدلاً من القيمة الجاهزة المحددة أعلاه.</div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={() => {
              const finalStatus = (bulkStatusCustom.trim() || bulkStatusValue).trim();
              if (!finalStatus) { toast.error('يرجى تحديد أو إدخال حالة'); return; }
              setCurrentCollection(prev => ({
                ...prev,
                items: prev.items.map(item => {
                  if (bulkStatusTarget === 'all' || selectedItems.has(item.sequence_number)) {
                    return { ...item, status: finalStatus };
                  }
                  return item;
                }),
              }));
              const count = bulkStatusTarget === 'all' ? currentCollection.items.length : selectedItems.size;
              toast.success(`تم تحديث حالة ${count} لوحة إلى "${finalStatus}"`);
              setShowBulkStatusDialog(false);
            }} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">تطبيق الحالة الجديدة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Municipality import dialog */}
      <Dialog open={showMunicipalityImportDialog} onOpenChange={setShowMunicipalityImportDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col max-h-[80vh] p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <span>جلب لوحات بلدية كاملة</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchMunicipality}
                onChange={e => setSearchMunicipality(e.target.value)}
                placeholder="بحث عن بلدية..."
                className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5 text-sm"
              />
            </div>
            
            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-3">
                  {municipalities
                    .filter(m => !searchMunicipality || m.includes(searchMunicipality))
                    .map(m => {
                      const count = allBillboards.filter(b => b.Municipality === m).length;
                      return (
                        <div
                          key={m}
                          className="flex items-center justify-between p-3.5 border border-border/10 rounded-2xl hover:bg-muted/60 hover:border-indigo-500/10 cursor-pointer transition-all group/mun"
                          onClick={() => importByMunicipality(m)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-indigo-500/5 text-indigo-500 group-hover/mun:bg-indigo-500 group-hover/mun:text-white transition-colors">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm text-foreground/90">{m}</span>
                          </div>
                          <Badge variant="secondary" className="rounded-lg font-mono text-xs">{count} لوحة</Badge>
                        </div>
                      );
                    })}
                  {municipalities.filter(m => !searchMunicipality || m.includes(searchMunicipality)).length === 0 && (
                    <p className="text-center text-muted-foreground py-10 text-xs">لا توجد بلديات مطابقة للبحث</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel municipality name dialog */}
      <Dialog open={showExcelMunicipalityDialog} onOpenChange={(open) => { if (!open) { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); } }}>
        <DialogContent className="max-w-sm border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">تسمية البلدية المستوردة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              تم بنجاح قراءة <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{excelPendingItems.length}</strong> لوحة من الملف المرفوع. الرجاء تحديد اسم البلدية لربط القائمة المستوردة بها.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">اسم البلدية المرتبطة *</Label>
              <Input
                value={excelMunicipalityName}
                onChange={e => setExcelMunicipalityName(e.target.value)}
                placeholder="مثال: طرابلس المركز"
                autoFocus
                className="rounded-xl border-border/15 bg-background/50 h-10 text-sm font-medium"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); }} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={confirmExcelImport} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              تأكيد الاستيراد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Column Mapping Dialog */}
      <ExcelColumnMappingDialog
        open={showColumnMappingDialog}
        onOpenChange={(open) => { if (!open) { setShowColumnMappingDialog(false); setExcelRawRows([]); setExcelHeaders([]); } }}
        headers={excelHeaders}
        sampleRows={excelRawRows}
        onConfirm={handleColumnMappingConfirm}
      />

      <MunicipalityPrintSettingsDialog
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        backgroundUrl={customBackgroundUrl}
        onSaveSuccess={refetch}
      />

      <MunicipalityStickerSettings
        open={showStickerSettings}
        onOpenChange={setShowStickerSettings}
        onSettingsChange={() => reloadStickerSettings()}
      />
    </div>
  );
}
