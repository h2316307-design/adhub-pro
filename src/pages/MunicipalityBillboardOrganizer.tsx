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
import { Plus, Trash2, Save, Printer, MapPin, ArrowUp, ArrowDown, Search, Edit2, FolderOpen, Upload, Building2, Settings2, GripVertical, ArrowLeftRight, Replace, Filter, Sticker } from 'lucide-react';
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
}

interface Collection {
  id?: string;
  name: string;
  municipality_name?: string;
  description?: string;
  items: CollectionItem[];
}

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
  const { settings: customSettings } = usePrintCustomization('municipality');
  const [collectionName, setCollectionName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [showMunicipalityImportDialog, setShowMunicipalityImportDialog] = useState(false);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [searchMunicipality, setSearchMunicipality] = useState('');
  const [showExcelMunicipalityDialog, setShowExcelMunicipalityDialog] = useState(false);
  const [excelPendingItems, setExcelPendingItems] = useState<CollectionItem[]>([]);
  const [excelMunicipalityName, setExcelMunicipalityName] = useState('');
  const [showColumnMappingDialog, setShowColumnMappingDialog] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, any>[]>([]);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printImageSource, setPrintImageSource] = useState<'actual_image' | 'map_pin'>('actual_image');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkSize, setBulkSize] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [showStickerSettings, setShowStickerSettings] = useState(false);
  const { settings: stickerSettings, reload: reloadStickerSettings } = useStickerSettings();

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
        // Try to parse municipality from description or use name
        const desc = collRes.data.description || '';
        setCurrentCollection({
          id: collRes.data.id,
          name: name,
          municipality_name: desc || '',
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
          })),
        });
        setCollectionName(name);
        setMunicipalityName(desc || '');
        toast.success(`تم تحميل "${name}"`);
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

      if (collectionId) {
        await supabase.from('municipality_collections').update({ name: collectionName, description: municipalityName }).eq('id', collectionId);
        await supabase.from('municipality_collection_items').delete().eq('collection_id', collectionId);
      } else {
        const { data } = await supabase.from('municipality_collections').insert({ name: collectionName, description: municipalityName }).select('id').single();
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
      }));

      await supabase.from('municipality_collection_items').insert(itemsToInsert);

      setCurrentCollection(prev => ({ ...prev, id: collectionId }));
      toast.success('تم الحفظ بنجاح');
      loadCollections();
    } catch (e) {
      toast.error('فشل في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // Add new manual billboard
  const addNewItem = () => {
    if (!newItem.size) {
      toast.error('المقاس مطلوب');
      return;
    }
    const nextSeq = currentCollection.items.length + 1;
    const item: CollectionItem = {
      sequence_number: nextSeq,
      size: newItem.size!,
      faces_count: newItem.faces_count || 'وجهين',
      location_text: newItem.location_text || '',
      nearest_landmark: newItem.nearest_landmark || '',
      latitude: newItem.latitude || null,
      longitude: newItem.longitude || null,
      item_type: 'new',
      billboard_name: newItem.location_text || `لوحة جديدة ${nextSeq}`,
      municipality: municipalityName || '',
    };
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, item] }));
    setNewItem({ size: '', faces_count: 'وجهين', location_text: '', nearest_landmark: '', latitude: null, longitude: null, item_type: 'new' });
    setShowAddDialog(false);
    toast.success(`تمت إضافة لوحة رقم ${nextSeq}`);
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
    if (!searchBillboard) return allBillboards.slice(0, 100);
    const q = searchBillboard.toLowerCase();
    return allBillboards.filter(b =>
      (b.Billboard_Name || '').toLowerCase().includes(q) ||
      (b.City || '').toLowerCase().includes(q) ||
      (b.Nearest_Landmark || '').toLowerCase().includes(q) ||
      String(b.ID).includes(q) ||
      (b.Size || '').includes(q) ||
      (b.Municipality || '').toLowerCase().includes(q)
    ).slice(0, 100);
  }, [allBillboards, searchBillboard]);

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
      const mapZoom = parseInt(s.map_zoom || '15') || 15;
      const mapTypeRaw = (s.map_show_labels || 'hybrid') as 'satellite' | 'hybrid' | 'roadmap';

      // Pre-generate Google Maps images using direct tile stitching (no API needed, never grays out)
      const mapImages = new Map<number, string>();
      if (printImageSource === 'map_pin') {
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
                  const dataUrl = await generateGoogleTilesMapDataUrl({
                    lat: item.latitude!,
                    lng: item.longitude!,
                    zoom: mapZoom,
                    width: 600,
                    height: 500,
                    mapType: mapTypeRaw,
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
        const pinData = createPinSvgUrl(item.size || '', 'متاحة', false, undefined, undefined, pinColor, pinTextColor);
        const customPinUrl = (s as any).custom_pin_url?.trim();
        const pinSvgDataUrl = customPinUrl || pinData.url;

        let imageSectionHtml = '';

        if (printImageSource === 'map_pin') {
          if (coords) {
            const [lat, lng] = coords.split(',').map(c => c.trim());
            const mapDataUrl = mapImages.get(item.sequence_number) || '';
            // Use pre-captured static image instead of live Google Map
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 2px solid #ccc; border-radius: 8px;
                overflow: hidden; z-index: 5;
              ">
                <div style="width: 100%; height: calc(100% - ${s.coords_bar_height || '26px'}); position: relative; overflow: hidden;">
                  ${mapDataUrl
                    ? `<img src="${mapDataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                    : `<div style="width: 100%; height: 100%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666;">لا تتوفر خريطة</div>`
                  }
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 10; display: flex; align-items: center; justify-content: center;">
                    <img src="${pinSvgDataUrl}" alt="دبوس" style="width: ${s.pin_size || '80'}px; height: auto; transform: translateY(-50%);" />
                  </div>
                </div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${s.coords_bar_height || '26px'}; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; z-index: 12; border-top: 1px solid #ddd;">
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
                <div style="font-size: 18px; font-weight: 700; color: #000; direction: ltr; font-family: monospace;">${coords}</div>
                <div style="font-size: 12px; color: #666;">المقاس: ${item.size}</div>
              </div>
            `;
          }
        }

        pages.push(`
          <div class="page">
            <div class="background"></div>

            <div class="absolute-field" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(-50%); width: 120mm; text-align: center; font-size: 32px; font-weight: 700; color: #000; z-index: 5;">
              ${String(item.sequence_number).padStart(2, '0')}
            </div>

            <div class="absolute-field" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color}; z-index: 5;">
              ${item.size}
            </div>

            <div class="absolute-field" style="top: ${s.faces_count_top}; left: ${s.faces_count_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color}; z-index: 5;">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-l from-gray-900 to-gray-800 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">تنظيم لوحات البلدية</h1>
              <p className="text-white/70 text-sm">ترتيب وطباعة لوحات البلدية</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-sm">{currentCollection.items.length} لوحة</Badge>
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowCollectionsDialog(true)}>
              <FolderOpen className="h-4 w-4 ml-1" />
              المحفوظات
            </Button>
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={saveCollection} disabled={saving}>
              <Save className="h-4 w-4 ml-1" />
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
            <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowStickerSettings(true)}>
              <Settings2 className="h-4 w-4 ml-1" />
              إعدادات الملصقات
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => printStickers(currentCollection.items, stickerSettings, municipalityName)} disabled={currentCollection.items.length === 0}>
              <Sticker className="h-4 w-4 ml-1" />
              طباعة ملصقات
            </Button>
            <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowPrintSettings(true)}>
              <Settings2 className="h-4 w-4 ml-1" />
              إعدادات الطباعة
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowPrintDialog(true)} disabled={currentCollection.items.length === 0}>
              <Printer className="h-4 w-4 ml-1" />
              طباعة الكل
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Collection name & Municipality name */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">اسم المجموعة *</Label>
              <Input
                value={collectionName}
                onChange={e => setCollectionName(e.target.value)}
                placeholder="اسم المجموعة (مثال: قائمة يناير 2026)"
                className="text-lg font-bold"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">اسم البلدية (يظهر في الطباعة بجانب الموقع)</Label>
              <Input
                value={municipalityName}
                onChange={e => setMunicipalityName(e.target.value)}
                placeholder="اسم البلدية (مثال: بلدية طرابلس المركز)"
                className="text-base"
              />
            </div>
          </div>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm">
            <Search className="h-4 w-4 ml-1" />
            جلب لوحات موجودة
          </Button>
          <Button onClick={() => setShowMunicipalityImportDialog(true)} variant="outline" size="sm" className="gap-1">
            <Building2 className="h-4 w-4" />
            جلب لوحات بلدية كاملة
          </Button>
          <label className="cursor-pointer inline-flex">
            <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <Upload className="h-4 w-4" />
              استيراد من Excel
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
          </label>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 ml-1" />
            إضافة لوحة جديدة
          </Button>
        </div>

        {/* Items table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">اللوحات ({currentCollection.items.length})</CardTitle>
                {municipalityName && (
                  <Badge variant="outline" className="text-xs">
                    <Building2 className="h-3 w-3 ml-1" />
                    {municipalityName}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search within items */}
                <div className="relative">
                  <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchItems}
                    onChange={e => setSearchItems(e.target.value)}
                    placeholder="بحث في القائمة..."
                    className="h-8 w-44 text-xs pr-8"
                  />
                </div>
              </div>
            </div>

            {/* Bulk actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t">
                <Badge variant="secondary">{selectedItems.size} محدد</Badge>
                
                {/* Bulk size change - with preset sizes */}
                <div className="flex items-center gap-1">
                  <Select value={bulkSize} onValueChange={setBulkSize}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="اختر مقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSizes.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={bulkSize}
                    onChange={e => setBulkSize(e.target.value)}
                    placeholder="أو اكتب مقاس"
                    className="h-7 w-28 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
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
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
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
                    <ArrowLeftRight className="h-3 w-3" />
                    تبديل المواقع
                  </Button>
                )}

                {/* Delete selected */}
                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => {
                  setCurrentCollection(prev => {
                    const filtered = prev.items.filter(i => !selectedItems.has(i.sequence_number));
                    const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
                    return { ...prev, items: reSequenced };
                  });
                  toast.success(`تم حذف ${selectedItems.size} لوحة`);
                  setSelectedItems(new Set());
                }}>
                  <Trash2 className="h-3 w-3 ml-1" />
                  حذف المحدد
                </Button>

                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedItems(new Set())}>
                  إلغاء التحديد
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {currentCollection.items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد لوحات. أضف لوحات جديدة أو اجلب لوحات من النظام.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-center w-6"></th>
                      <th className="p-2 text-center w-8">
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
                      <th className="p-2 text-center w-12">#</th>
                      <th className="p-2 text-right">الموقع</th>
                      <th className="p-2 text-right">أقرب نقطة</th>
                      <th className="p-2 text-center">المقاس</th>
                      <th className="p-2 text-center">الأوجه</th>
                      <th className="p-2 text-center">الإحداثيات</th>
                      <th className="p-2 text-center w-40">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map(item => (
                      <tr
                        key={item.sequence_number}
                        className={`border-b transition-colors cursor-grab active:cursor-grabbing ${selectedItems.has(item.sequence_number) ? 'bg-primary/5' : 'hover:bg-muted/30'} ${dragItem.current === item.sequence_number ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(item.sequence_number)}
                        onDragEnter={() => handleDragEnter(item.sequence_number)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <td className="p-1 text-center text-muted-foreground">
                          <GripVertical className="h-4 w-4 mx-auto" />
                        </td>
                        <td className="p-2 text-center">
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
                        <td className="p-2 text-center font-bold text-primary">{item.sequence_number}</td>
                        <td className="p-2">
                          <div className="flex flex-col">
                            <span className="text-sm">{item.location_text || item.billboard_name || '—'}</span>
                            {item.municipality && (
                              <span className="text-[10px] text-muted-foreground">{item.municipality}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground text-xs">{item.nearest_landmark || '—'}</td>
                        <td className="p-2 text-center">
                          <Input
                            value={item.size}
                            onChange={e => updateItem(item.sequence_number, { size: e.target.value })}
                            className="h-7 w-28 text-center text-xs mx-auto"
                            placeholder="المقاس"
                          />
                        </td>
                        <td className="p-2 text-center text-xs">{item.faces_count}</td>
                        <td className="p-2 text-center text-[10px] font-mono" dir="ltr">
                          {item.latitude && item.longitude ? `${item.latitude?.toFixed(5)},${item.longitude?.toFixed(5)}` : '—'}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(item.sequence_number, 'up')} disabled={item.sequence_number === 1} title="أعلى">
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(item.sequence_number, 'down')} disabled={item.sequence_number === currentCollection.items.length} title="أسفل">
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReplace(item.sequence_number)} title="استبدال">
                              <Replace className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)} title="تعديل">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.sequence_number)} title="حذف">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {searchItems && sortedItems.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    لا توجد نتائج للبحث "{searchItems}"
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              الخريطة ({mapBillboards.length} لوحة)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ height: '700px' }} className="rounded-b-lg overflow-hidden">
              {mapBillboards.length > 0 ? (
                <GoogleHomeMap billboards={mapBillboards} />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>أضف لوحات بإحداثيات لعرضها على الخريطة</p>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة لوحة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المقاس *</Label>
              <Input value={newItem.size || ''} onChange={e => setNewItem(p => ({ ...p, size: e.target.value }))} placeholder="مثال: 12 × 4" />
            </div>
            <div>
              <Label>عدد الأوجه</Label>
              <Select value={newItem.faces_count || 'وجهين'} onValueChange={v => setNewItem(p => ({ ...p, faces_count: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="وجه">وجه واحد</SelectItem>
                  <SelectItem value="وجهين">وجهين</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>موقع اللوحة</Label>
              <Input value={newItem.location_text || ''} onChange={e => setNewItem(p => ({ ...p, location_text: e.target.value }))} placeholder="مثال: طريق الشط" />
            </div>
            <div>
              <Label>أقرب نقطة دالة</Label>
              <Input value={newItem.nearest_landmark || ''} onChange={e => setNewItem(p => ({ ...p, nearest_landmark: e.target.value }))} placeholder="مثال: وسط جسر القبة الفلكية" />
            </div>
            <div>
              <Label>الإحداثيات (Lat, Lng)</Label>
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
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>إلغاء</Button>
            <Button onClick={addNewItem}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import existing billboards dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>جلب لوحات من النظام</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث بالاسم أو المدينة أو المقاس أو الرقم..." />
            <div className="text-xs text-muted-foreground">
              محدد: {selectedBillboardIds.size} لوحة | يعرض أول 100 نتيجة
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-right">ID</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-center">المقاس</th>
                    <th className="p-2 text-right">المدينة</th>
                    <th className="p-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImportBillboards.map(b => (
                    <tr key={b.ID} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => {
                      setSelectedBillboardIds(prev => {
                        const n = new Set(prev);
                        if (n.has(b.ID)) n.delete(b.ID); else n.add(b.ID);
                        return n;
                      });
                    }}>
                      <td className="p-2 text-center">
                        <Checkbox checked={selectedBillboardIds.has(b.ID)} />
                      </td>
                      <td className="p-2 font-mono text-xs">{b.ID}</td>
                      <td className="p-2">{b.Billboard_Name || '—'}</td>
                      <td className="p-2 text-center"><Badge variant="outline">{b.Size || '—'}</Badge></td>
                      <td className="p-2">{b.City || '—'}</td>
                      <td className="p-2 text-center">
                        <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'}>{b.Status || '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>إلغاء</Button>
            <Button onClick={importSelectedBillboards} disabled={selectedBillboardIds.size === 0}>
              جلب {selectedBillboardIds.size} لوحة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace billboard dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>استبدال لوحة رقم {replaceTarget}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث عن اللوحة البديلة..." autoFocus />
            <ScrollArea className="h-[400px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-right">ID</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-center">المقاس</th>
                    <th className="p-2 text-right">المدينة</th>
                    <th className="p-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImportBillboards.map(b => (
                    <tr key={b.ID} className={`border-b hover:bg-muted/30 cursor-pointer ${selectedBillboardIds.has(b.ID) ? 'bg-primary/10' : ''}`} onClick={() => {
                      setSelectedBillboardIds(new Set([b.ID]));
                    }}>
                      <td className="p-2 text-center">
                        <Checkbox checked={selectedBillboardIds.has(b.ID)} />
                      </td>
                      <td className="p-2 font-mono text-xs">{b.ID}</td>
                      <td className="p-2">{b.Billboard_Name || '—'}</td>
                      <td className="p-2 text-center"><Badge variant="outline">{b.Size || '—'}</Badge></td>
                      <td className="p-2">{b.City || '—'}</td>
                      <td className="p-2 text-center">
                        <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'}>{b.Status || '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReplaceDialog(false)}>إلغاء</Button>
            <Button onClick={confirmReplace} disabled={selectedBillboardIds.size !== 1}>
              استبدال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل لوحة رقم {editingItem?.sequence_number}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-3">
              <div>
                <Label>المقاس</Label>
                <Input value={editingItem.size} onChange={e => setEditingItem({ ...editingItem, size: e.target.value })} />
              </div>
              <div>
                <Label>عدد الأوجه</Label>
                <Select value={editingItem.faces_count} onValueChange={v => setEditingItem({ ...editingItem, faces_count: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="وجه">وجه واحد</SelectItem>
                    <SelectItem value="وجهين">وجهين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>موقع اللوحة</Label>
                <Input value={editingItem.location_text} onChange={e => setEditingItem({ ...editingItem, location_text: e.target.value })} />
              </div>
              <div>
                <Label>أقرب نقطة دالة</Label>
                <Input value={editingItem.nearest_landmark} onChange={e => setEditingItem({ ...editingItem, nearest_landmark: e.target.value })} />
              </div>
              <div>
                <Label>الإحداثيات (Lat, Lng)</Label>
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
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>إلغاء</Button>
            <Button onClick={() => {
              if (editingItem) {
                updateItem(editingItem.sequence_number, editingItem);
                setEditingItem(null);
                toast.success('تم التحديث');
              }
            }}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved collections dialog */}
      <Dialog open={showCollectionsDialog} onOpenChange={setShowCollectionsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>المجموعات المحفوظة</DialogTitle>
          </DialogHeader>
          {collections.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد مجموعات محفوظة</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {collections.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => loadCollection(c.id)}>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('ar-LY')}</div>
                    </div>
                    <Button variant="ghost" size="sm">فتح</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Print dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طباعة الكل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              سيتم طباعة {currentCollection.items.length} لوحة بترتيبها التسلسلي (1 إلى {currentCollection.items.length})
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">مصدر صورة اللوحة في الطباعة</Label>
              <RadioGroup value={printImageSource} onValueChange={(v) => setPrintImageSource(v as 'actual_image' | 'map_pin')} className="space-y-2">
                <div className="flex items-start gap-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="actual_image" id="actual_image" className="mt-0.5" />
                  <label htmlFor="actual_image" className="cursor-pointer flex-1">
                    <div className="font-medium text-sm">الصورة الفعلية للوحة</div>
                    <div className="text-xs text-muted-foreground">استخدام صورة اللوحة أو التصميم المرفوع في النظام</div>
                  </label>
                </div>
                <div className="flex items-start gap-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="map_pin" id="map_pin" className="mt-0.5" />
                  <label htmlFor="map_pin" className="cursor-pointer flex-1">
                    <div className="font-medium text-sm">دبوس الخريطة مع المقاس</div>
                    <div className="text-xs text-muted-foreground">عرض شكل الدبوس مع المقاس والإحداثيات بدلاً من الصورة</div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            <BackgroundSelector value={customBackgroundUrl} onChange={setCustomBackgroundUrl} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>إلغاء</Button>
            <Button onClick={handlePrint} disabled={printLoading}>
              <Printer className="h-4 w-4 ml-1" />
              {printLoading ? 'جاري الطباعة...' : 'طباعة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Municipality import dialog */}
      <Dialog open={showMunicipalityImportDialog} onOpenChange={setShowMunicipalityImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>جلب لوحات بلدية كاملة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={searchMunicipality}
              onChange={e => setSearchMunicipality(e.target.value)}
              placeholder="بحث عن بلدية..."
            />
            <ScrollArea className="h-[350px] border rounded-lg">
              <div className="space-y-1 p-2">
                {municipalities
                  .filter(m => !searchMunicipality || m.includes(searchMunicipality))
                  .map(m => {
                    const count = allBillboards.filter(b => b.Municipality === m).length;
                    return (
                      <div
                        key={m}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => importByMunicipality(m)}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{m}</span>
                        </div>
                        <Badge variant="secondary">{count} لوحة</Badge>
                      </div>
                    );
                  })}
                {municipalities.filter(m => !searchMunicipality || m.includes(searchMunicipality)).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بلديات</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel municipality name dialog */}
      <Dialog open={showExcelMunicipalityDialog} onOpenChange={(open) => { if (!open) { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تسمية البلدية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              تم قراءة {excelPendingItems.length} لوحة من الملف. أدخل اسم البلدية لتسجيل هذه القائمة تحتها.
            </p>
            <div>
              <Label>اسم البلدية *</Label>
              <Input
                value={excelMunicipalityName}
                onChange={e => setExcelMunicipalityName(e.target.value)}
                placeholder="مثال: طرابلس المركز"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); }}>إلغاء</Button>
            <Button onClick={confirmExcelImport}>
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
      />

      <MunicipalityStickerSettings
        open={showStickerSettings}
        onOpenChange={setShowStickerSettings}
        onSettingsChange={() => reloadStickerSettings()}
      />
    </div>
  );
}
