/**
 * Municipality Print Settings Dialog
 * إعدادات طباعة لوحات البلدية مع معاينة مباشرة
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Settings2, Type, Image, MapPin, QrCode, Hash, Map, ZoomIn, ZoomOut, BookOpen } from 'lucide-react';
import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backgroundUrl: string;
}

const parseMM = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
const toMM = (n: number): string => `${n}mm`;
const parsePX = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 12 : n; };
const toPX = (n: number): string => `${n}px`;
const parsePercent = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 50 : n; };
const toPercent = (n: number): string => `${n}%`;
const parseRaw = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 80 : n; };

interface SettingField {
  key: keyof PrintCustomizationSettings;
  label: string;
  type: 'mm' | 'px' | 'percent' | 'text' | 'select' | 'raw';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

interface SettingGroup {
  label: string;
  icon: React.ReactNode;
  fields: SettingField[];
}

const settingGroups: SettingGroup[] = [
  {
    label: 'الترقيم',
    icon: <Hash className="h-4 w-4" />,
    fields: [
      { key: 'billboard_name_top', label: 'أعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'billboard_name_left', label: 'يسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'billboard_name_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 60, step: 1 },
      { key: 'billboard_name_font_weight', label: 'سماكة', type: 'text' },
      { key: 'billboard_name_color', label: 'اللون', type: 'text' },
    ],
  },
  {
    label: 'المقاس',
    icon: <Type className="h-4 w-4" />,
    fields: [
      { key: 'size_top', label: 'أعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'size_left', label: 'يسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'size_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 80, step: 1 },
      { key: 'size_color', label: 'اللون', type: 'text' },
    ],
  },
  {
    label: 'عدد الأوجه',
    icon: <Type className="h-4 w-4" />,
    fields: [
      { key: 'faces_count_top', label: 'أعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'faces_count_left', label: 'يسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'faces_count_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 40, step: 1 },
    ],
  },
  {
    label: 'الصورة',
    icon: <Image className="h-4 w-4" />,
    fields: [
      { key: 'main_image_top', label: 'أعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'main_image_left', label: 'يسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'main_image_width', label: 'العرض', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'main_image_height', label: 'الارتفاع', type: 'mm', min: 20, max: 200, step: 1 },
    ],
  },
  {
    label: 'الموقع',
    icon: <MapPin className="h-4 w-4" />,
    fields: [
      { key: 'location_info_top', label: 'أعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'location_info_left', label: 'يسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'location_info_width', label: 'العرض', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'location_info_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 30, step: 1 },
    ],
  },
  {
    label: 'أقرب معلم',
    icon: <MapPin className="h-4 w-4" />,
    fields: [
      { key: 'landmark_info_top', label: 'أعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'landmark_info_left', label: 'يسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'landmark_info_width', label: 'العرض', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'landmark_info_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 30, step: 1 },
    ],
  },
  {
    label: 'QR Code',
    icon: <QrCode className="h-4 w-4" />,
    fields: [
      { key: 'qr_top', label: 'أعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'qr_left', label: 'يسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'qr_size', label: 'الحجم', type: 'mm', min: 10, max: 60, step: 1 },
    ],
  },
  {
    label: 'الخريطة',
    icon: <Map className="h-4 w-4" />,
    fields: [
      { key: 'map_zoom', label: 'مستوى التكبير', type: 'px', min: 10, max: 20, step: 1 },
      { key: 'map_show_labels', label: 'نوع الخريطة', type: 'select', options: [
        { value: 'hybrid', label: 'قمر صناعي + مسميات' },
        { value: 'satellite', label: 'قمر صناعي فقط' },
      ]},
      { key: 'pin_size', label: 'حجم الدبوس', type: 'raw', min: 30, max: 200, step: 5 },
      { key: 'pin_color', label: 'لون الدبوس', type: 'text' },
      { key: 'pin_text_color', label: 'لون كتابة المقاس', type: 'text' },
      { key: 'custom_pin_url', label: 'رابط دبوس مخصص (SVG)', type: 'text' },
    ],
  },
  {
    label: 'الإحداثيات',
    icon: <MapPin className="h-4 w-4" />,
    fields: [
      { key: 'coords_font_size', label: 'حجم الخط', type: 'px', min: 6, max: 30, step: 1 },
      { key: 'coords_bar_height', label: 'ارتفاع الشريط', type: 'px', min: 16, max: 60, step: 1 },
      { key: 'coords_font_family', label: 'نوع الخط', type: 'select', options: [
        { value: 'Manrope', label: 'Manrope' },
        { value: 'Doran', label: 'Doran' },
        { value: 'monospace', label: 'Monospace' },
        { value: 'Arial', label: 'Arial' },
      ]},
    ],
  },
  {
    label: 'صفحة الغلاف',
    icon: <BookOpen className="h-4 w-4" />,
    fields: [
      { key: 'cover_page_enabled', label: 'تفعيل صفحة الغلاف', type: 'select', options: [
        { value: 'true', label: 'مفعّل' },
        { value: 'false', label: 'معطّل' },
      ]},
      { key: 'cover_logo_url', label: 'رابط شعار الغلاف', type: 'text' },
      { key: 'cover_logo_size', label: 'حجم الشعار', type: 'px', min: 50, max: 2000, step: 10 },
      { key: 'cover_logo_top' as any, label: 'موقع الشعار (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_logo_left' as any, label: 'موقع الشعار (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_logo_align' as any, label: 'محاذاة الشعار', type: 'select', options: [
        { value: 'center', label: 'وسط' },
        { value: 'right', label: 'يمين' },
        { value: 'left', label: 'يسار' },
      ]},
      { key: 'cover_phrase', label: 'العبارة قبل اسم البلدية', type: 'text' },
      { key: 'cover_phrase_font_size', label: 'حجم خط العبارة', type: 'px', min: 14, max: 80, step: 1 },
      { key: 'cover_phrase_top' as any, label: 'موقع العبارة (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_phrase_left' as any, label: 'موقع العبارة (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_phrase_align' as any, label: 'محاذاة العبارة', type: 'select', options: [
        { value: 'center', label: 'وسط' },
        { value: 'right', label: 'يمين' },
        { value: 'left', label: 'يسار' },
      ]},
      { key: 'cover_municipality_font_size', label: 'حجم خط اسم البلدية', type: 'px', min: 18, max: 100, step: 1 },
      { key: 'cover_municipality_top' as any, label: 'موقع اسم البلدية (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_municipality_left' as any, label: 'موقع اسم البلدية (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_municipality_align' as any, label: 'محاذاة اسم البلدية', type: 'select', options: [
        { value: 'center', label: 'وسط' },
        { value: 'right', label: 'يمين' },
        { value: 'left', label: 'يسار' },
      ]},
      { key: 'cover_background_enabled' as any, label: 'خلفية صفحة الغلاف', type: 'select', options: [
        { value: 'true', label: 'مع خلفية' },
        { value: 'false', label: 'بدون خلفية' },
      ]},
      { key: 'cover_background_url' as any, label: 'رابط خلفية مخصصة (اتركه فارغاً للافتراضية)', type: 'text' },
    ],
  },
];

export default function MunicipalityPrintSettingsDialog({ open, onOpenChange, backgroundUrl }: Props) {
  const { settings, saveSettings, resetToDefaults, saving } = usePrintCustomization('municipality');
  const [localSettings, setLocalSettings] = useState<PrintCustomizationSettings>(settings);
  const [previewZoom, setPreviewZoom] = useState(0.4);
  const [activeTab, setActiveTab] = useState('الترقيم');
  const [sampleBillboard, setSampleBillboard] = useState<{
    name: string; size: string; faces: number; municipality: string; landmark: string; coords: string; imageUrl: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      loadSampleBillboard();
    }
  }, [open, settings]);

  const loadSampleBillboard = async () => {
    try {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, Municipality, Nearest_Landmark, GPS_Coordinates, Image_URL')
        .not('Municipality', 'is', null)
        .not('GPS_Coordinates', 'is', null)
        .order('ID', { ascending: true })
        .limit(1);
      const row = data?.[0];
      if (row) {
        const [lat, lng] = (row.GPS_Coordinates || '').split(',').map((s: string) => s.trim());
        setSampleBillboard({
          name: row.Billboard_Name || `لوحة ${row.ID}`,
          size: row.Size || '4×12',
          faces: row.Faces_Count || 2,
          municipality: row.Municipality || 'طرابلس المركز',
          landmark: row.Nearest_Landmark || 'أقرب نقطة دالة',
          coords: lat && lng ? `${lat}, ${lng}` : '32.901753, 13.217222',
          imageUrl: row.Image_URL || '',
        });
      }
    } catch { /* ignore */ }
  };

  const updateLocal = (key: keyof PrintCustomizationSettings, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const success = await saveSettings(localSettings);
    if (success) onOpenChange(false);
  };

  const handleReset = async () => {
    await resetToDefaults();
    setLocalSettings(settings);
  };

  const getValue = (key: keyof PrintCustomizationSettings, type: string): number => {
    const val = localSettings[key] as string;
    if (type === 'mm') return parseMM(val);
    if (type === 'px') return parsePX(val);
    if (type === 'percent') return parsePercent(val);
    if (type === 'raw') return parseRaw(val);
    return 0;
  };

  const pinColor = (localSettings.pin_color || '').trim() || undefined;
  const pinTextColor = (localSettings.pin_text_color || '').trim() || undefined;
  const pinData = createPinSvgUrl('4×12', 'متاحة', false, undefined, undefined, pinColor, pinTextColor);
  const pinUrl = (localSettings.custom_pin_url || '').trim() || pinData.url;

  const sb = sampleBillboard || {
    name: '01', size: '4 × 12', faces: 2, municipality: 'طرابلس المركز',
    landmark: 'وسط جسر القبة الفلكية', coords: '32.901753, 13.217222', imageUrl: '',
  };

  // Live preview with realistic sample data
  const previewHtml = useMemo(() => {
    const s = localSettings;
    const pinSize = parseRaw(s.pin_size || '80');
    return `
      <div style="position:relative;width:210mm;height:297mm;background-color:#fff;background-image:url('${backgroundUrl}');background-size:210mm 297mm;background-repeat:no-repeat;font-family:'Doran',Arial,sans-serif;direction:rtl;overflow:hidden;">
        
        <!-- الترقيم -->
        <div style="position:absolute;top:${s.billboard_name_top};left:${s.billboard_name_left};transform:translateX(-50%);width:120mm;text-align:center;font-size:${s.billboard_name_font_size};font-weight:${s.billboard_name_font_weight};color:${s.billboard_name_color};z-index:5;">
          ${sb.name}
        </div>

        <!-- المقاس -->
        <div style="position:absolute;top:${s.size_top};left:${s.size_left};transform:translateX(-50%);width:80mm;text-align:center;font-size:${s.size_font_size};font-weight:${s.size_font_weight || '500'};color:${s.size_color};z-index:5;">
          ${sb.size}
        </div>

        <!-- عدد الأوجه -->
        <div style="position:absolute;top:${s.faces_count_top};left:${s.faces_count_left};transform:translateX(-50%);width:80mm;text-align:center;font-size:${s.faces_count_font_size};color:${s.faces_count_color};z-index:5;">
          ${sb.faces === 1 ? 'وجه واحد' : 'وجهين'}
        </div>

        <!-- الصورة / الخريطة -->
        <div style="position:absolute;top:${s.main_image_top};left:${s.main_image_left};transform:translateX(-50%);width:${s.main_image_width};height:${s.main_image_height};border:2px solid #ccc;border-radius:8px;overflow:hidden;z-index:5;">
          <div style="width:100%;height:calc(100% - ${s.coords_bar_height || '26px'});background:linear-gradient(135deg, #4a7c59, #2d5a3f);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;position:relative;">
            <div style="font-size:12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">خريطة القمر الصناعي</div>
            <!-- Pin overlay -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;">
              <img src="${pinUrl}" style="position:absolute;top:50%;left:50%;width:${pinSize}px;height:auto;transform:translate(-50%,-100%);" />
            </div>
            <div style="font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);background:rgba(0,0,0,0.4);padding:1px 6px;border-radius:3px;">الزوم: ${s.map_zoom || '15'} | الدبوس: ${pinSize}px${s.custom_pin_url ? ' | مخصص' : ''}</div>
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:${s.coords_bar_height || '26px'};background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;border-top:1px solid #ddd;">
            <span style="font-size:${s.coords_font_size || '11px'};font-weight:700;color:#222;direction:ltr;font-family:'${s.coords_font_family || 'Manrope'}',monospace;letter-spacing:0.5px;">${sb.coords}</span>
          </div>
        </div>

        <!-- الموقع -->
        <div style="position:absolute;top:${s.location_info_top};left:${s.location_info_left};width:${s.location_info_width};font-size:${s.location_info_font_size};color:${s.location_info_color || '#000'};z-index:5;">
          ${sb.municipality} - طريق الشط
        </div>

        <!-- أقرب معلم -->
        <div style="position:absolute;top:${s.landmark_info_top};left:${s.landmark_info_left};width:${s.landmark_info_width};font-size:${s.landmark_info_font_size};color:${s.landmark_info_color || '#000'};z-index:5;">
          ${sb.landmark}
        </div>

        <!-- QR Code -->
        <div style="position:absolute;top:${s.qr_top};left:${s.qr_left};width:${s.qr_size};text-align:center;z-index:5;">
          <div style="width:${s.qr_size};height:${s.qr_size};background:#f0f0f0;border:2px solid #999;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;border-radius:4px;">QR</div>
        </div>
      </div>
    `;
  }, [localSettings, backgroundUrl, pinData.url, sb]);

  // معاينة صفحة الغلاف
  const coverPreviewHtml = useMemo(() => {
    const s = localSettings;
    const coverLogoUrl = (s as any).cover_logo_url || '/logofaresgold.svg';
    const coverPhrase = (s as any).cover_phrase || 'لوحات';
    const coverLogoSize = (s as any).cover_logo_size || '200px';
    const coverPhraseFontSize = (s as any).cover_phrase_font_size || '28px';
    const coverMunicipalityFontSize = (s as any).cover_municipality_font_size || '36px';
    const municipalityName = sb.municipality || 'طرابلس المركز';

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
    const coverBgUrl = (s as any).cover_background_url || backgroundUrl;
    const bgStyle = coverBgEnabled ? `background-image:url('${coverBgUrl}');background-size:210mm 297mm;background-repeat:no-repeat;` : '';

    const posStyle = (align: string, left: string, extraWidth?: string) => {
      const w = extraWidth ? `width:${extraWidth};` : '';
      return `left:${left};transform:translateX(-50%);text-align:${align};${w}`;
    };

    return `
      <div style="position:relative;width:210mm;height:297mm;background-color:#fff;${bgStyle}font-family:'Doran',Arial,sans-serif;direction:rtl;overflow:visible;">
        <div style="position:absolute;${posStyle(logoAlign, logoLeft, coverLogoSize)}top:${logoTop || '100mm'};z-index:5;">
          <img src="${coverLogoUrl}" alt="شعار" style="width:100%;height:auto;object-fit:contain;" onerror="this.style.display='none'" />
        </div>
        <div style="position:absolute;${posStyle(phraseAlign, phraseLeft)}top:${phraseTop || '180mm'};z-index:5;font-size:${coverPhraseFontSize};font-weight:700;color:#000;">
          ${coverPhrase}
        </div>
        <div style="position:absolute;${posStyle(muniAlign, muniLeft)}top:${muniTop || '195mm'};z-index:5;font-size:${coverMunicipalityFontSize};font-weight:700;color:#000;">
          ${municipalityName}
        </div>
      </div>
    `;
  }, [localSettings, backgroundUrl, sb]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            إعدادات طباعة البلدية
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings Panel */}
          <div className="w-[380px] border-l flex flex-col">
            <Tabs defaultValue="الترقيم" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="flex flex-wrap gap-1 p-2 h-auto bg-muted/50 rounded-none border-b">
                {settingGroups.map(g => (
                  <TabsTrigger key={g.label} value={g.label} className="text-xs gap-1 px-2 py-1">
                    {g.icon}
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <ScrollArea className="flex-1 overflow-hidden" style={{ maxHeight: 'calc(90vh - 160px)' }}>
                {settingGroups.map(group => (
                  <TabsContent key={group.label} value={group.label} className="p-4 space-y-4 m-0">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      {group.icon}
                      {group.label}
                    </h3>
                    {group.fields.map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-xs">{field.label}</Label>
                        {field.type === 'text' ? (
                          <>
                            {(field.key === 'pin_color' || field.key === 'pin_text_color') ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  value={localSettings[field.key] as string || '#000000'}
                                  onChange={e => updateLocal(field.key, e.target.value)}
                                  className="h-8 w-12 p-1 cursor-pointer"
                                />
                                <Input
                                  value={localSettings[field.key] as string}
                                  onChange={e => updateLocal(field.key, e.target.value)}
                                  className="h-8 text-xs flex-1"
                                  placeholder="اتركه فارغاً للون التلقائي"
                                />
                              </div>
                            ) : (
                              <Input
                                value={localSettings[field.key] as string}
                                onChange={e => updateLocal(field.key, e.target.value)}
                                className="h-8 text-xs"
                                placeholder={field.key === 'custom_pin_url' ? 'https://example.com/pin.svg' : ''}
                              />
                            )}
                            {field.key === 'custom_pin_url' && (
                              <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
                                <p className="font-semibold">شروط الدبوس القابل للتلوين:</p>
                                <ul className="list-disc mr-3 space-y-0.5">
                                  <li>يجب أن يكون بصيغة <strong>SVG</strong></li>
                                  <li>استخدم <code className="bg-muted px-1 rounded">currentColor</code> بدل الألوان الثابتة في fill و stroke</li>
                                  <li>مثال: <code className="bg-muted px-1 rounded">{'fill="currentColor"'}</code></li>
                                  <li>سيتلون الدبوس تلقائياً حسب لون المقاس</li>
                                  <li>اتركه فارغاً لاستخدام دبوس النظام</li>
                                </ul>
                              </div>
                            )}
                          </>
                        ) : field.type === 'select' ? (
                          <Select
                            value={localSettings[field.key] as string}
                            onValueChange={v => updateLocal(field.key, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[getValue(field.key, field.type)]}
                              min={field.min ?? 0}
                              max={field.max ?? 300}
                              step={field.step ?? 1}
                              onValueChange={([v]) => {
                                if (field.type === 'mm') updateLocal(field.key, toMM(v));
                                else if (field.type === 'px') updateLocal(field.key, toPX(v));
                                else if (field.type === 'percent') updateLocal(field.key, toPercent(v));
                                else if (field.type === 'raw') updateLocal(field.key, String(v));
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-16 text-left font-mono">
                              {field.type === 'raw' ? `${localSettings[field.key]}px` : localSettings[field.key] as string}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </ScrollArea>
            </Tabs>

            <div className="p-3 border-t flex gap-2">
              <Button size="sm" variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-3 w-3 ml-1" />
                افتراضي
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-3 w-3 ml-1" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex-1 bg-gray-100 overflow-auto flex flex-col">
            <div className="flex items-center justify-center gap-2 p-2 bg-white border-b">
              <Button size="sm" variant="outline" onClick={() => setPreviewZoom(z => Math.max(0.15, z - 0.05))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono w-12 text-center">{Math.round(previewZoom * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewZoom(z => Math.min(1, z + 0.05))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewZoom(0.4)} className="text-xs">
                إعادة ضبط
              </Button>
            </div>
            <div className="flex-1 overflow-auto flex items-start justify-center p-4">
              <div
                className="origin-top shadow-xl border border-gray-300"
                style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}
                dangerouslySetInnerHTML={{ __html: activeTab === 'صفحة الغلاف' ? coverPreviewHtml : previewHtml }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
