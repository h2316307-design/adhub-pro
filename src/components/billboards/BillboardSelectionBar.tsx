import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Printer, CheckSquare, Square, Loader2, Image as ImageIcon, Settings, Camera, CameraOff, ImageOff, DollarSign, Tag, Percent, Calculator, Save, RotateCcw, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { renderAllBillboardsTablePagesPreviewLike, BillboardRowData } from '@/lib/contractTableRenderer';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';
import { supabase } from '@/integrations/supabase/client';

interface BillboardSelectionBarProps {
  selectedBillboards: any[];
  filteredBillboards: any[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
}

const AVAILABLE_BACKGROUNDS = [
  { id: 'template', name: 'من إعدادات القالب', url: 'template' },
  { id: 'bgc1', name: 'خلفية 1', url: '/bgc1.svg' },
  { id: 'bgc2', name: 'خلفية 2 (جدول)', url: '/bgc2.svg' },
  { id: 'mt1', name: 'خلفية جدول اللوحات', url: '/mt1.svg' },
  { id: 'ipg', name: 'خلفية قائمة الأسعار', url: '/ipg.svg' },
  { id: 'none', name: 'بدون خلفية', url: 'none' },
];

const PRINT_SETTINGS_KEY = 'billboard_print_settings';

interface PrintSettings {
  showLogo: boolean;
  showTableTerm: boolean;
  showImages: boolean;
  showPricing: boolean;
  backgroundType: 'preset' | 'custom';
  selectedBackground: string;
  customBackgroundUrl: string;
  selectedPeriod: string;
  discounts: { [level: string]: { type: 'percentage' | 'fixed'; value: number } };
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  showLogo: true,
  showTableTerm: false,
  showImages: true,
  showPricing: false,
  backgroundType: 'preset',
  selectedBackground: 'template',
  customBackgroundUrl: '',
  selectedPeriod: 'monthly',
  discounts: {},
};

// فترات الإيجار
const RENTAL_PERIODS = [
  { value: 'daily', label: 'يومي' },
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربع سنوي' },
  { value: 'semi-annual', label: 'نصف سنوي' },
  { value: 'annual', label: 'سنوي' },
];

export const BillboardSelectionBar: React.FC<BillboardSelectionBarProps> = ({
  selectedBillboards,
  filteredBillboards,
  onClearSelection,
  onSelectAll,
  isAllSelected
}) => {
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  
  // إعدادات الطباعة
  const [showLogo, setShowLogo] = useState(true);
  const [showTableTerm, setShowTableTerm] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState('template');
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('');
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom'>('preset');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [discounts, setDiscounts] = useState<{ [level: string]: { type: 'percentage' | 'fixed'; value: number } }>({});
  
  // ✅ استخدام useContractTemplateSettings hook مباشرة - مرتبط بإعدادات قالب العقد
  const { data: templateData, isLoading: templateLoading } = useContractTemplateSettings();
  
  // الإعدادات المدمجة من القالب
  const settings = useMemo(() => {
    return templateData?.settings || DEFAULT_SECTION_SETTINGS;
  }, [templateData]);
  
  const templateTableBackgroundUrl = useMemo(() => {
    return templateData?.tableBackgroundUrl || '/bgc2.svg';
  }, [templateData]);

  // استخراج الفئات الفريدة من اللوحات المحددة
  const uniqueLevels = useMemo(() => {
    const levels = new Set<string>();
    selectedBillboards.forEach(billboard => {
      const level = (billboard.Level || billboard.level || 'A').toUpperCase();
      levels.add(level);
    });
    return Array.from(levels).sort();
  }, [selectedBillboards]);

  // تحميل الإعدادات المحفوظة
  useEffect(() => {
    const loadSettings = async () => {
      if (!printDialogOpen) return;
      
      setIsLoadingSettings(true);
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', PRINT_SETTINGS_KEY)
          .maybeSingle();

        if (data?.setting_value) {
          const savedSettings: PrintSettings = JSON.parse(data.setting_value);
          setShowLogo(savedSettings.showLogo ?? true);
          setShowTableTerm(savedSettings.showTableTerm ?? false);
          setShowImages(savedSettings.showImages ?? true);
          setShowPricing(savedSettings.showPricing ?? false);
          setBackgroundType(savedSettings.backgroundType ?? 'preset');
          setSelectedBackground(savedSettings.selectedBackground ?? 'template');
          setCustomBackgroundUrl(savedSettings.customBackgroundUrl ?? '');
          setSelectedPeriod(savedSettings.selectedPeriod ?? 'monthly');
          setDiscounts(savedSettings.discounts ?? {});
        }
      } catch (error) {
        console.error('Error loading print settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [printDialogOpen]);

  // حفظ الإعدادات
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsToSave: PrintSettings = {
        showLogo,
        showTableTerm,
        showImages,
        showPricing,
        backgroundType,
        selectedBackground,
        customBackgroundUrl,
        selectedPeriod,
        discounts,
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: PRINT_SETTINGS_KEY,
          setting_value: JSON.stringify(settingsToSave),
          setting_type: 'json',
          description: 'إعدادات طباعة اللوحات',
          category: 'print',
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('تم حفظ إعدادات الطباعة');
    } catch (error) {
      console.error('Error saving print settings:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  // إعادة تعيين الإعدادات
  const handleResetSettings = () => {
    setShowLogo(DEFAULT_PRINT_SETTINGS.showLogo);
    setShowTableTerm(DEFAULT_PRINT_SETTINGS.showTableTerm);
    setShowImages(DEFAULT_PRINT_SETTINGS.showImages);
    setShowPricing(DEFAULT_PRINT_SETTINGS.showPricing);
    setBackgroundType(DEFAULT_PRINT_SETTINGS.backgroundType);
    setSelectedBackground(DEFAULT_PRINT_SETTINGS.selectedBackground);
    setCustomBackgroundUrl(DEFAULT_PRINT_SETTINGS.customBackgroundUrl);
    setSelectedPeriod(DEFAULT_PRINT_SETTINGS.selectedPeriod);
    setDiscounts(DEFAULT_PRINT_SETTINGS.discounts);
    toast.info('تم إعادة تعيين الإعدادات');
  };

  const handleDiscountChange = (level: string, field: 'type' | 'value', value: string | number) => {
    setDiscounts(prev => ({
      ...prev,
      [level]: {
        type: prev[level]?.type || 'percentage',
        value: prev[level]?.value || 0,
        [field]: field === 'value' ? Number(value) || 0 : value
      }
    }));
  };

  const getBackgroundUrl = (): string => {
    if (backgroundType === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    if (selectedBackground === 'template') {
      return templateTableBackgroundUrl;
    }
    return selectedBackground === 'none' ? '' : selectedBackground;
  };

  // تحويل اللوحات للتنسيق المطلوب - نفس التنسيق المستخدم في طباعة العقد
  const prepareBillboardsData = (billboards: any[]): BillboardRowData[] => {
    return billboards.map((b) => ({
      id: String(b.ID || b.id || ''),
      billboardName: b.Billboard_Name || b.billboard_name || '',
      image: showImages ? (b.Image_URL || b.image_url || '') : '',
      municipality: b.Municipality || b.municipality || '',
      district: b.District || b.district || '',
      landmark: b.Nearest_Landmark || b.nearest_landmark || '',
      size: b.Size || b.size || '',
      level: b.Level || b.level || '',
      faces: b.Faces_Count || b.faces_count || b.faces || '1',
      price: b.Price ? `${Number(b.Price).toLocaleString()}` : '',
      rent_end_date: b.Rent_End_Date || b.rent_end_date || '',
      mapLink: b.GPS_Link || b.GPS_Coordinates 
        ? `https://www.google.com/maps?q=${b.GPS_Coordinates || ''}` 
        : '',
    }));
  };

  const { printMultiplePages } = useContractPrint();

  const handlePrint = async () => {
    if (selectedBillboards.length === 0) {
      toast.error('لم يتم اختيار أي لوحات');
      return;
    }

    setIsPrinting(true);

    try {
      const bgUrl = getBackgroundUrl();
      const billboardsData = prepareBillboardsData(selectedBillboards);

      // ✅ مهم: "بدون خلفية" يرجّع '' ويجب عدم استبداله بخلفية افتراضية
      const tableBgUrl = bgUrl === '' ? '' : (bgUrl || templateTableBackgroundUrl || '/bgc2.svg');

      // ✅ صفحات HTML بحجم التصميم (2480x3508) مثل معاينة إعدادات قالب العقد
      const pages = renderAllBillboardsTablePagesPreviewLike(
        billboardsData,
        settings,
        tableBgUrl,
        settings.tableSettings?.maxRows || 12,
        showTableTerm
      ).map((pageHtml) => {
        if (!showLogo) return pageHtml;

        // إضافة شعار كـ overlay بدون تغيير تخطيط الصفحة
        const logoHtml = `
          <div style="position:absolute; top:120px; right:120px; z-index:1000;">
            <img src="/logofaresgold.svg" alt="شعار الفارس" style="height:95px; width:auto;" onerror="this.style.display='none'" />
          </div>
        `;

        return pageHtml.replace(/<div[^>]*class=\"[^\"]*contract-preview-container[^\"]*\"[^>]*>/, (match) => `${match}${logoHtml}`);
      });

      if (pages.length === 0) {
        toast.error('لا توجد لوحات للطباعة');
        return;
      }

      // ✅ نفس طريقة الطباعة المستخدمة في إعدادات القالب (تحجيم تلقائي لـ A4)
      printMultiplePages(pages, {
        title: `طباعة اللوحات - ${selectedBillboards.length} لوحة`,
        designWidth: 2480,
        designHeight: 3508,
      });
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
      setPrintDialogOpen(false);
    }
  };

  if (selectedBillboards.length === 0) {
    return null;
  }

  return (
    <>
      {/* الشريط العائم */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-primary/95 to-primary-foreground/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-primary/20">
          {/* عدد اللوحات المختارة */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 text-base font-bold bg-white/90 text-primary">
              {selectedBillboards.length}
            </Badge>
            <span className="text-white font-medium">لوحة مختارة</span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          {/* اختيار الكل */}
          <Button
            variant="ghost"
            size="sm"
            onClick={isAllSelected ? onClearSelection : onSelectAll}
            className="text-white hover:bg-white/20 gap-2"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4" />
                إلغاء الكل ({filteredBillboards.length})
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                اختيار الكل ({filteredBillboards.length})
              </>
            )}
          </Button>

          <div className="w-px h-8 bg-white/30" />

          {/* زر الطباعة */}
          <Button
            onClick={() => setPrintDialogOpen(true)}
            className="bg-white text-primary hover:bg-white/90 gap-2 font-bold shadow-lg"
          >
            <Printer className="h-4 w-4" />
            طباعة اللوحات
          </Button>

          {/* زر إلغاء الاختيار */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* نافذة إعدادات الطباعة المحسنة */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Printer className="h-5 w-5 text-primary" />
              خيارات طباعة التقرير
              <Badge variant="secondary" className="mr-2">{selectedBillboards.length} لوحة</Badge>
            </DialogTitle>
          </DialogHeader>

          {isLoadingSettings ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-4">
                {/* رأس التقرير */}
                <div>
                  <Label className="text-sm font-bold text-muted-foreground mb-3 block">رأس التقرير:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowLogo(true)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        showLogo
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border bg-muted/30 hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        showLogo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">بالشعار</p>
                        <p className="text-xs text-muted-foreground">عرض شعار الشركة</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowLogo(false)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        !showLogo
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border bg-muted/30 hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        !showLogo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <ImageOff className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">بدون شعار</p>
                        <p className="text-xs text-muted-foreground">إخفاء الشعار</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* صور اللوحات */}
                <div>
                  <Label className="text-sm font-bold text-muted-foreground mb-3 block">صور اللوحات:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowImages(true)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        showImages
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border bg-muted/30 hover:border-emerald-500/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        showImages ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">مع الصور</p>
                        <p className="text-xs text-muted-foreground">عرض صور اللوحات</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowImages(false)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        !showImages
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border bg-muted/30 hover:border-amber-500/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        !showImages ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <CameraOff className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">بدون صور</p>
                        <p className="text-xs text-muted-foreground">إخفاء صور اللوحات</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* الأسعار */}
                <div>
                  <Label className="text-sm font-bold text-muted-foreground mb-3 block">الأسعار:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowPricing(true)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        showPricing
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border bg-muted/30 hover:border-blue-500/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        showPricing ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">مع الأسعار</p>
                        <p className="text-xs text-muted-foreground">عرض أسعار الإيجار</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowPricing(false)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-3 ${
                        !showPricing
                          ? "border-gray-500 bg-gray-500/10"
                          : "border-border bg-muted/30 hover:border-gray-500/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        !showPricing ? "bg-gray-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <Tag className="w-6 h-6" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-bold">بدون أسعار</p>
                        <p className="text-xs text-muted-foreground">إخفاء الأسعار</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* خيارات الأسعار التفصيلية */}
                {showPricing && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-5">
                    {/* اختيار المدة */}
                    <div>
                      <Label className="text-sm font-bold mb-3 block">مدة الإيجار:</Label>
                      <div className="flex flex-wrap gap-2">
                        {RENTAL_PERIODS.map(period => (
                          <button
                            key={period.value}
                            onClick={() => setSelectedPeriod(period.value)}
                            className={`px-4 py-2 text-sm font-bold transition-all rounded-md border ${
                              selectedPeriod === period.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* التخفيضات حسب الفئة */}
                    {uniqueLevels.length > 0 && (
                      <div>
                        <Label className="text-sm font-bold mb-3 flex items-center gap-2">
                          <Percent className="w-4 h-4 text-primary" />
                          التخفيضات حسب الفئة:
                        </Label>
                        <div className="space-y-2">
                          {uniqueLevels.map(level => (
                            <div key={level} className="flex items-center gap-3 bg-background rounded-md border border-border p-3">
                              <span className="w-16 text-sm font-bold text-primary">فئة {level}</span>
                              <Select
                                value={discounts[level]?.type || 'percentage'}
                                onValueChange={(v) => handleDiscountChange(level, 'type', v)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">نسبة %</SelectItem>
                                  <SelectItem value="fixed">قيمة ثابتة</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min="0"
                                value={discounts[level]?.value || 0}
                                onChange={(e) => handleDiscountChange(level, 'value', e.target.value)}
                                className="w-24 h-10 text-sm font-bold"
                                placeholder="0"
                              />
                              <span className="text-sm font-bold text-muted-foreground">
                                {discounts[level]?.type === 'percentage' ? '%' : 'د.ل'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* إعدادات الخلفية */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-muted-foreground block">الخلفية:</Label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBackgroundType('preset')}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        backgroundType === 'preset'
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30 hover:border-primary/50"
                      }`}
                    >
                      <p className="font-bold text-sm">خلفية جاهزة</p>
                    </button>
                    <button
                      onClick={() => setBackgroundType('custom')}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        backgroundType === 'custom'
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30 hover:border-primary/50"
                      }`}
                    >
                      <p className="font-bold text-sm">رابط مخصص</p>
                    </button>
                  </div>

                  {backgroundType === 'preset' ? (
                    <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الخلفية" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_BACKGROUNDS.map(bg => (
                          <SelectItem key={bg.id} value={bg.url}>
                            <div className="flex items-center gap-2">
                              {bg.id === 'template' ? <Settings className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                              {bg.name}
                              {bg.id === 'template' && <Badge variant="secondary" className="text-xs mr-2">موصى به</Badge>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="url"
                      placeholder="https://example.com/background.svg"
                      value={customBackgroundUrl}
                      onChange={(e) => setCustomBackgroundUrl(e.target.value)}
                      dir="ltr"
                    />
                  )}
                </div>

                {/* خيار البند الثامن */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base cursor-pointer">عرض عنوان البند (البند الثامن)</Label>
                  </div>
                  <Switch checked={showTableTerm} onCheckedChange={setShowTableTerm} />
                </div>

                {/* معلومات إعدادات الجدول */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Settings className="h-4 w-4" />
                    <p className="text-sm font-medium">مرتبط بإعدادات قالب العقد</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>عدد الصفوف: {settings.tableSettings?.maxRows || 12}</span>
                    <span>ارتفاع الصف: {settings.tableSettings?.rowHeight || 12}mm</span>
                    <span>عرض الجدول: {settings.tableSettings?.tableWidth || 90}%</span>
                    <span>حجم الخط: {settings.tableSettings?.fontSize || 10}px</span>
                  </div>
                </div>

                {/* معاينة اللوحات المختارة */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-muted-foreground block">اللوحات المختارة للطباعة:</Label>
                  <ScrollArea className="h-32 rounded-lg border p-3">
                    <div className="space-y-2">
                      {selectedBillboards.slice(0, 10).map((b, idx) => (
                        <div key={b.ID || idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <span className="text-sm font-medium truncate flex-1">
                            {b.Billboard_Name || b.ID || `لوحة ${idx + 1}`}
                          </span>
                          <Badge variant="outline" className="text-xs mr-2">
                            {b.Size || b.size || 'غير محدد'}
                          </Badge>
                        </div>
                      ))}
                      {selectedBillboards.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          و {selectedBillboards.length - 10} لوحة أخرى...
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSettings}
              className="gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              إعادة تعيين
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="gap-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الإعدادات
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={isPrinting || templateLoading}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحضير...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  طباعة التقرير
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillboardSelectionBar;
