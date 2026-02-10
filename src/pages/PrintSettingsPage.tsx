import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  RotateCcw,
  Palette,
  Layout,
  Type,
  FileText,
  Building2,
  Image as ImageIcon,
  Eye,
  Table,
  User,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignRight,
  AlignCenter,
  AlignLeft,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO, DocumentType, getAllDocumentTypes } from "@/types/document-types";
import { DEFAULT_PRINT_SETTINGS, PrintSettings, HEADER_STYLES, HeaderStyleType, LOGO_SIZES, LogoSizeType, AlignmentType, HeaderAlignmentType, HeaderDirectionType } from "@/types/print-settings";
import { usePrintSettings, usePrintSettingsByType } from "@/store";

// الخطوط المتوفرة
const AVAILABLE_FONTS = [
  { name: "Doran", label: "دوران" },
  { name: "Manrope", label: "مانروب" },
  { name: "Cairo", label: "القاهرة" },
  { name: "Tajawal", label: "تجوال" },
  { name: "Amiri", label: "أميري" },
];

// الشعارات المتوفرة
const AVAILABLE_LOGOS = [
  "/logofares.svg",
  "/logofares2.svg",
  "/logofaresgold.svg",
  "/logo-symbol.svg",
  "/logo-text.svg",
  "/new-logo.svg",
];

// تنسيقات التاريخ
const DATE_FORMATS = [
  { value: "ar-LY", label: "عربي (ليبيا)" },
  { value: "ar-SA", label: "عربي (السعودية)" },
  { value: "en-US", label: "إنجليزي (أمريكي)" },
  { value: "en-GB", label: "إنجليزي (بريطاني)" },
];

// مكون اختيار اللون
const ColorPicker = ({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
}) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded border cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-10 font-mono text-sm"
        dir="ltr"
      />
    </div>
  </div>
);

// مكون تحديد المحاذاة
const AlignmentSelector = ({
  value,
  onChange,
  label,
}: {
  value: AlignmentType;
  onChange: (v: AlignmentType) => void;
  label: string;
}) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {[
        { value: 'right' as const, icon: AlignRight, label: 'يمين' },
        { value: 'center' as const, icon: AlignCenter, label: 'وسط' },
        { value: 'left' as const, icon: AlignLeft, label: 'يسار' },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 p-2 rounded-md flex items-center justify-center gap-1 transition-all ${
            value === option.value 
              ? "bg-primary text-primary-foreground shadow" 
              : "hover:bg-background/80"
          }`}
          title={option.label}
        >
          <option.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  </div>
);

const PrintSettingsPage = () => {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>(DOCUMENT_TYPES.ACCOUNT_STATEMENT);
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.45);

  const { saveSettings, selectPrintSettingsByType, fetchSettings } = usePrintSettings();
  const { settings: storeSettings, isLoading } = usePrintSettingsByType(selectedDocType);

  // Form state
  const [settings, setSettings] = useState<Omit<PrintSettings, "document_type">>({ ...DEFAULT_PRINT_SETTINGS });

  // Apply store settings to form
  useEffect(() => {
    if (!storeSettings) return;
    const { document_type: _dt, ...rest } = storeSettings;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
  }, [storeSettings]);

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await saveSettings(selectedDocType, {
        document_type: selectedDocType,
        ...settings,
      });
      if (!ok) throw new Error("فشل الحفظ");
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setSettings({ ...DEFAULT_PRINT_SETTINGS });
    toast.info("تم إعادة الإعدادات للقيم الافتراضية");
  };

  // Refresh from server
  const handleRefresh = async () => {
    await fetchSettings();
    toast.success("تم تحديث الإعدادات");
  };

  // Copy settings from another document type
  const handleCopyFrom = (sourceDocType: DocumentType) => {
    const src = selectPrintSettingsByType(sourceDocType);
    const { document_type: _dt, ...rest } = src;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
    toast.success(`تم نسخ الإعدادات من ${DOCUMENT_TYPE_INFO[sourceDocType].nameAr}`);
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const docTypeInfo = DOCUMENT_TYPE_INFO[selectedDocType];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
        {/* Left Panel - Settings */}
        <div className="lg:w-[480px] space-y-4">
          {/* Header */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">إعدادات الطباعة</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={handleRefresh} title="تحديث">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 ml-1" />
                    إعادة
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                    حفظ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">نوع المستند</Label>
                  <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as DocumentType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllDocumentTypes().map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">نسخ من</Label>
                  <Select onValueChange={(v) => handleCopyFrom(v as DocumentType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="اختر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllDocumentTypes().filter(d => d.id !== selectedDocType).map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Tabs */}
          <Card className="flex-1">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <Tabs defaultValue="branding" className="p-4">
                <TabsList className="grid grid-cols-4 w-full mb-4">
                  <TabsTrigger value="branding" className="text-xs px-2 gap-1">
                    <Palette className="h-4 w-4" />
                    <span className="hidden sm:inline">العلامة</span>
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs px-2 gap-1">
                    <Layout className="h-4 w-4" />
                    <span className="hidden sm:inline">التخطيط</span>
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs px-2 gap-1">
                    <Type className="h-4 w-4" />
                    <span className="hidden sm:inline">الألوان</span>
                  </TabsTrigger>
                  <TabsTrigger value="document" className="text-xs px-2 gap-1">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">المستند</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Branding - العلامة التجارية */}
                <TabsContent value="branding" className="space-y-4 mt-0">
                  {/* نمط الهيدر - كاردات بصرية */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Layout className="h-4 w-4" />
                      نمط الهيدر
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {(Object.keys(HEADER_STYLES) as HeaderStyleType[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => updateSetting("header_style", style)}
                          className={`p-3 border rounded-lg text-right transition-all ${
                            settings.header_style === style 
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{HEADER_STYLES[style].label}</p>
                              <p className="text-xs text-muted-foreground">{HEADER_STYLES[style].description}</p>
                            </div>
                            {settings.header_style === style && (
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-primary-foreground text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* حجم الشعار */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      حجم الشعار
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(LOGO_SIZES) as LogoSizeType[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            updateSetting("logo_size_preset", size);
                            updateSetting("logo_size", LOGO_SIZES[size].value);
                          }}
                          className={`p-3 border rounded-lg text-center transition-all ${
                            settings.logo_size_preset === size 
                              ? "border-primary bg-primary/10" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="font-medium text-xs">{LOGO_SIZES[size].label}</p>
                          <p className="text-[10px] text-muted-foreground">{LOGO_SIZES[size].value}px</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* تخطيط الهيدر - محاذاة واتجاه */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Layout className="h-4 w-4" />
                      تخطيط الهيدر
                    </h4>
                    
                    {/* محاذاة الهيدر */}
                    <div className="space-y-2">
                      <Label className="text-xs">محاذاة الهيدر</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          { value: 'right' as const, label: 'يمين' },
                          { value: 'center' as const, label: 'وسط' },
                          { value: 'left' as const, label: 'يسار' },
                          { value: 'split' as const, label: 'موزع' },
                        ] as const).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => updateSetting("header_alignment", option.value)}
                            className={`p-2 border rounded-lg text-center text-xs transition-all ${
                              settings.header_alignment === option.value 
                                ? "border-primary bg-primary/10" 
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* اتجاه الهيدر */}
                    <div className="space-y-2">
                      <Label className="text-xs">اتجاه الهيدر</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'row' as const, label: 'أفقي (جنب لجنب)' },
                          { value: 'column' as const, label: 'عمودي (فوق بعض)' },
                        ] as const).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => updateSetting("header_direction", option.value)}
                            className={`p-3 border rounded-lg text-center text-xs transition-all ${
                              settings.header_direction === option.value 
                                ? "border-primary bg-primary/10" 
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ترتيب موضع الشعار */}
                    <div className="space-y-2">
                      <Label className="text-xs">ترتيب الشعار: {settings.logo_position_order === 0 ? 'الشعار أولاً' : 'العنوان أولاً'}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateSetting("logo_position_order", 0)}
                          className={`p-2 border rounded-lg text-center text-xs transition-all ${
                            settings.logo_position_order === 0 
                              ? "border-primary bg-primary/10" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          الشعار أولاً
                        </button>
                        <button
                          onClick={() => updateSetting("logo_position_order", 1)}
                          className={`p-2 border rounded-lg text-center text-xs transition-all ${
                            settings.logo_position_order === 1 
                              ? "border-primary bg-primary/10" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          العنوان أولاً
                        </button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* عناصر الهيدر - Toggles */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      عناصر الهيدر
                    </h4>
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_logo"
                          checked={settings.show_logo}
                          onCheckedChange={(v) => updateSetting("show_logo", !!v)}
                        />
                        <Label htmlFor="show_logo" className="text-sm cursor-pointer">إظهار الشعار</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_tax_id"
                          checked={settings.show_tax_id}
                          onCheckedChange={(v) => updateSetting("show_tax_id", !!v)}
                        />
                        <Label htmlFor="show_tax_id" className="text-sm cursor-pointer">إظهار الرقم الضريبي</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_email"
                          checked={settings.show_email}
                          onCheckedChange={(v) => updateSetting("show_email", !!v)}
                        />
                        <Label htmlFor="show_email" className="text-sm cursor-pointer">إظهار البريد الإلكتروني</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_website"
                          checked={settings.show_website}
                          onCheckedChange={(v) => updateSetting("show_website", !!v)}
                        />
                        <Label htmlFor="show_website" className="text-sm cursor-pointer">إظهار الموقع الإلكتروني</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* التحكم الدقيق في عناصر معلومات الشركة */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      إظهار/إخفاء عناصر الشركة
                    </h4>
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_company_name"
                          checked={settings.show_company_name}
                          onCheckedChange={(v) => updateSetting("show_company_name", !!v)}
                        />
                        <Label htmlFor="show_company_name" className="text-sm cursor-pointer">إظهار اسم الشركة</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_company_subtitle"
                          checked={settings.show_company_subtitle}
                          onCheckedChange={(v) => updateSetting("show_company_subtitle", !!v)}
                        />
                        <Label htmlFor="show_company_subtitle" className="text-sm cursor-pointer">إظهار العنوان الفرعي (الشعار)</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_company_address"
                          checked={settings.show_company_address}
                          onCheckedChange={(v) => updateSetting("show_company_address", !!v)}
                        />
                        <Label htmlFor="show_company_address" className="text-sm cursor-pointer">إظهار العنوان</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="show_company_contact"
                          checked={settings.show_company_contact}
                          onCheckedChange={(v) => updateSetting("show_company_contact", !!v)}
                        />
                        <Label htmlFor="show_company_contact" className="text-sm cursor-pointer">إظهار معلومات الاتصال</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* معلومات الشركة */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      معلومات الشركة
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">اسم الشركة</Label>
                        <Input
                          value={settings.company_name}
                          onChange={(e) => updateSetting("company_name", e.target.value)}
                          placeholder="الفارس الذهبي"
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">العنوان الفرعي</Label>
                        <Input
                          value={settings.company_subtitle}
                          onChange={(e) => updateSetting("company_subtitle", e.target.value)}
                          placeholder="للإعلان والدعاية"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">العنوان</Label>
                        <Input
                          value={settings.company_address}
                          onChange={(e) => updateSetting("company_address", e.target.value)}
                          placeholder="طرابلس - ليبيا"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">الهاتف</Label>
                        <Input
                          value={settings.company_phone}
                          onChange={(e) => updateSetting("company_phone", e.target.value)}
                          placeholder="0912345678"
                          className="h-9"
                          dir="ltr"
                        />
                      </div>
                      {settings.show_tax_id && (
                        <div>
                          <Label className="text-xs">الرقم الضريبي</Label>
                          <Input
                            value={settings.company_tax_id || ''}
                            onChange={(e) => updateSetting("company_tax_id", e.target.value)}
                            placeholder="1234567890"
                            className="h-9"
                            dir="ltr"
                          />
                        </div>
                      )}
                      {settings.show_email && (
                        <div>
                          <Label className="text-xs">البريد الإلكتروني</Label>
                          <Input
                            value={settings.company_email || ''}
                            onChange={(e) => updateSetting("company_email", e.target.value)}
                            placeholder="info@example.com"
                            className="h-9"
                            dir="ltr"
                          />
                        </div>
                      )}
                      {settings.show_website && (
                        <div className="col-span-2">
                          <Label className="text-xs">الموقع الإلكتروني</Label>
                          <Input
                            value={settings.company_website || ''}
                            onChange={(e) => updateSetting("company_website", e.target.value)}
                            placeholder="www.example.com"
                            className="h-9"
                            dir="ltr"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* اختيار الشعار */}
                  {settings.show_logo && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-xs">اختر الشعار</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {AVAILABLE_LOGOS.map((logo) => (
                            <button
                              key={logo}
                              onClick={() => updateSetting("logo_path", logo)}
                              className={`p-2 border rounded-lg hover:border-primary transition-colors ${
                                settings.logo_path === logo ? "border-primary bg-primary/5" : "border-border"
                              }`}
                            >
                              <img src={logo} alt="" className="h-8 w-full object-contain" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Tab 2: Layout - التخطيط */}
                <TabsContent value="layout" className="space-y-4 mt-0">
                  {/* محاذاة عنوان المستند */}
                  <AlignmentSelector
                    value={settings.document_title_alignment}
                    onChange={(v) => updateSetting("document_title_alignment", v)}
                    label="محاذاة عنوان المستند"
                  />

                  <Separator />

                  {/* المسافات */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">الهوامش (ملم)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">أعلى: {settings.page_margin_top}mm</Label>
                        <Slider 
                          value={[settings.page_margin_top]} 
                          onValueChange={([v]) => updateSetting("page_margin_top", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">أسفل: {settings.page_margin_bottom}mm</Label>
                        <Slider 
                          value={[settings.page_margin_bottom]} 
                          onValueChange={([v]) => updateSetting("page_margin_bottom", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">يمين: {settings.page_margin_right}mm</Label>
                        <Slider 
                          value={[settings.page_margin_right]} 
                          onValueChange={([v]) => updateSetting("page_margin_right", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">يسار: {settings.page_margin_left}mm</Label>
                        <Slider 
                          value={[settings.page_margin_left]} 
                          onValueChange={([v]) => updateSetting("page_margin_left", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* مسافات إضافية */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">مسافات إضافية</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">مسافة أسفل الهيدر: {settings.header_margin_bottom}px</Label>
                        <Slider 
                          value={[settings.header_margin_bottom]} 
                          onValueChange={([v]) => updateSetting("header_margin_bottom", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">مسافة أعلى العنوان: {settings.document_title_margin_top}px</Label>
                        <Slider 
                          value={[settings.document_title_margin_top]} 
                          onValueChange={([v]) => updateSetting("document_title_margin_top", v)} 
                          min={0} max={50} step={1} 
                          className="mt-2" 
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* الخطوط */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      الخطوط
                    </h4>
                    <div>
                      <Label className="text-xs">نوع الخط</Label>
                      <Select value={settings.font_family} onValueChange={(v) => updateSetting("font_family", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_FONTS.map((font) => (
                            <SelectItem key={font.name} value={font.name}>
                              <span style={{ fontFamily: font.name }}>{font.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">العنوان: {settings.title_font_size}px</Label>
                        <Slider value={[settings.title_font_size]} onValueChange={([v]) => updateSetting("title_font_size", v)} min={14} max={36} step={1} className="mt-2" />
                      </div>
                      <div>
                        <Label className="text-xs">الهيدر: {settings.header_font_size}px</Label>
                        <Slider value={[settings.header_font_size]} onValueChange={([v]) => updateSetting("header_font_size", v)} min={10} max={24} step={1} className="mt-2" />
                      </div>
                      <div>
                        <Label className="text-xs">النص: {settings.body_font_size}px</Label>
                        <Slider value={[settings.body_font_size]} onValueChange={([v]) => updateSetting("body_font_size", v)} min={8} max={18} step={1} className="mt-2" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* الاتجاه */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">الاتجاه والحدود</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">اتجاه الصفحة</Label>
                        <Select value={settings.direction} onValueChange={(v) => updateSetting("direction", v as 'rtl' | 'ltr')}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rtl">RTL (عربي)</SelectItem>
                            <SelectItem value="ltr">LTR (إنجليزي)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">نصف قطر الحدود: {settings.border_radius}px</Label>
                        <Slider value={[settings.border_radius]} onValueChange={([v]) => updateSetting("border_radius", v)} min={0} max={20} step={1} className="mt-2" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Colors - الألوان (تحكم دقيق) */}
                <TabsContent value="colors" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">الألوان الأساسية</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker 
                        label="اللون الأساسي" 
                        value={settings.primary_color} 
                        onChange={(v) => {
                          updateSetting("primary_color", v);
                          updateSetting("header_bg_color", v);
                          updateSetting("table_header_bg_color", v);
                        }} 
                      />
                      <ColorPicker label="اللون الثانوي" value={settings.secondary_color} onChange={(v) => updateSetting("secondary_color", v)} />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">ألوان النصوص (تحكم دقيق)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker 
                        label="العنوان الفرعي للشركة" 
                        value={settings.company_subtitle_color} 
                        onChange={(v) => updateSetting("company_subtitle_color", v)} 
                      />
                      <ColorPicker 
                        label="نص قسم العميل" 
                        value={settings.customer_text_color} 
                        onChange={(v) => updateSetting("customer_text_color", v)} 
                      />
                      <ColorPicker 
                        label="نص الجدول" 
                        value={settings.table_text_color} 
                        onChange={(v) => updateSetting("table_text_color", v)} 
                      />
                      <ColorPicker 
                        label="نص الفوتر" 
                        value={settings.footer_text_color} 
                        onChange={(v) => updateSetting("footer_text_color", v)} 
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">ألوان الهيدر</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker label="خلفية الهيدر" value={settings.header_bg_color} onChange={(v) => updateSetting("header_bg_color", v)} />
                      <ColorPicker label="نص الهيدر" value={settings.header_text_color} onChange={(v) => updateSetting("header_text_color", v)} />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      ألوان الجدول
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker label="خلفية الترويسة" value={settings.table_header_bg_color} onChange={(v) => updateSetting("table_header_bg_color", v)} />
                      <ColorPicker label="نص الترويسة" value={settings.table_header_text_color} onChange={(v) => updateSetting("table_header_text_color", v)} />
                      <ColorPicker label="لون الحدود" value={settings.table_border_color} onChange={(v) => updateSetting("table_border_color", v)} />
                      <ColorPicker label="صف زوجي" value={settings.table_row_even_color} onChange={(v) => updateSetting("table_row_even_color", v)} />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">ألوان الملخص وقسم العميل</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker label="خلفية الملخص" value={settings.summary_bg_color} onChange={(v) => updateSetting("summary_bg_color", v)} />
                      <ColorPicker label="حدود الملخص" value={settings.summary_border_color} onChange={(v) => updateSetting("summary_border_color", v)} />
                      <ColorPicker label="خلفية قسم العميل" value={settings.customer_section_bg_color} onChange={(v) => updateSetting("customer_section_bg_color", v)} />
                      <ColorPicker label="حدود قسم العميل" value={settings.customer_section_border_color} onChange={(v) => updateSetting("customer_section_border_color", v)} />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 4: Document - المستند */}
                <TabsContent value="document" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      عنوان المستند
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">العنوان بالعربي</Label>
                        <Input
                          value={settings.document_title_ar}
                          onChange={(e) => updateSetting("document_title_ar", e.target.value)}
                          placeholder={docTypeInfo.nameAr}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">العنوان بالإنجليزي</Label>
                        <Input
                          value={settings.document_title_en}
                          onChange={(e) => updateSetting("document_title_en", e.target.value)}
                          placeholder={docTypeInfo.nameEn}
                          className="h-9"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* بيانات المستند (الرقم + التاريخ) */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">معلومات المستند (رقم + تاريخ)</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">إظهار رقم المستند</Label>
                        <Switch
                          checked={settings.show_document_number}
                          onCheckedChange={(v) => updateSetting("show_document_number", v)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">إظهار التاريخ</Label>
                        <Switch
                          checked={settings.show_document_date}
                          onCheckedChange={(v) => updateSetting("show_document_date", v)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">تنسيق التاريخ</Label>
                        <Select value={settings.date_format} onValueChange={(v) => updateSetting("date_format", v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATE_FORMATS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* ✅ تحكم دقيق في قسم معلومات المستند */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">تنسيق قسم المعلومات</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker 
                        label="لون النص" 
                        value={settings.document_info_text_color} 
                        onChange={(v) => updateSetting("document_info_text_color", v)} 
                      />
                      <ColorPicker 
                        label="لون الخلفية" 
                        value={settings.document_info_bg_color} 
                        onChange={(v) => updateSetting("document_info_bg_color", v)} 
                      />
                    </div>
                    <AlignmentSelector
                      value={settings.document_info_alignment}
                      onChange={(v) => updateSetting("document_info_alignment", v)}
                      label="محاذاة المعلومات"
                    />
                    <div>
                      <Label className="text-xs">المسافة العلوية: {settings.document_info_margin_top}px</Label>
                      <Slider 
                        value={[settings.document_info_margin_top]} 
                        onValueChange={([v]) => updateSetting("document_info_margin_top", v)} 
                        min={0} max={50} step={1} 
                        className="mt-2" 
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* قسم العميل */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        قسم العميل
                      </h4>
                      <Switch
                        checked={settings.show_customer_section}
                        onCheckedChange={(v) => updateSetting("show_customer_section", v)}
                      />
                    </div>
                    
                    {settings.show_customer_section && (
                      <div>
                        <Label className="text-xs">عنوان القسم</Label>
                        <Input
                          value={settings.customer_section_title}
                          onChange={(e) => updateSetting("customer_section_title", e.target.value)}
                          placeholder="بيانات العميل"
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* الفوتر */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">الفوتر</h4>
                      <Switch
                        checked={settings.show_footer}
                        onCheckedChange={(v) => updateSetting("show_footer", v)}
                      />
                    </div>
                    
                    {settings.show_footer && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">نص الفوتر</Label>
                          <Input
                            value={settings.footer_text}
                            onChange={(e) => updateSetting("footer_text", e.target.value)}
                            placeholder="شكراً لتعاملكم معنا"
                            className="h-9"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">إظهار رقم الصفحة</Label>
                          <Switch
                            checked={settings.show_page_number}
                            onCheckedChange={(v) => updateSetting("show_page_number", v)}
                          />
                        </div>
                        <AlignmentSelector
                          value={settings.footer_alignment}
                          onChange={(v) => updateSetting("footer_alignment", v)}
                          label="محاذاة الفوتر"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                معاينة حية - {docTypeInfo.nameAr}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[calc(100vh-250px)]">
                {/* A4 Preview with dynamic scale */}
                <div
                  className="bg-white shadow-xl mx-auto transition-transform duration-200"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "top center",
                    direction: settings.direction,
                    fontFamily: settings.font_family,
                    padding: `${settings.page_margin_top}mm ${settings.page_margin_right}mm ${settings.page_margin_bottom}mm ${settings.page_margin_left}mm`,
                    backgroundImage: settings.background_image ? `url(${settings.background_image})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Header */}
                  <div
                    className="p-6"
                    style={{
                      backgroundColor: settings.header_bg_color,
                      color: settings.header_text_color,
                      borderRadius: `${settings.border_radius}px`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: settings.header_alignment === 'center' || settings.header_style === 'centered' 
                        ? "center" 
                        : settings.header_alignment === 'split' 
                          ? "space-between" 
                          : settings.header_alignment === 'left' ? "flex-end" : "flex-start",
                      gap: "20px",
                      flexDirection: settings.header_direction === 'column' || settings.header_style === 'centered'
                        ? "column" 
                        : settings.logo_position_order === 1 
                          ? "row-reverse" 
                          : "row",
                      marginBottom: `${settings.header_margin_bottom}px`,
                    }}
                  >
                    {settings.show_logo && (
                      <img
                        src={settings.logo_path}
                        alt="شعار الشركة"
                        style={{ 
                          height: `${settings.logo_size}px`, 
                          objectFit: "contain",
                          order: settings.logo_position_order,
                        }}
                      />
                    )}
                    <div style={{ 
                      textAlign: settings.header_style === 'centered' || settings.header_direction === 'column'
                        ? 'center' 
                        : (settings.header_alignment === 'split' ? 'right' : settings.header_alignment) as 'left' | 'center' | 'right', 
                      flex: settings.header_style === 'centered' || settings.header_direction === 'column' ? 'none' : 1,
                      order: settings.logo_position_order === 1 ? 0 : 1,
                    }}>
                      {settings.show_company_name && (
                        <h1 style={{ fontSize: `${settings.title_font_size}px`, fontWeight: "bold", margin: 0 }}>
                          {settings.company_name || "الفارس الذهبي"}
                        </h1>
                      )}
                      {settings.show_company_subtitle && (
                        <p style={{ fontSize: `${settings.header_font_size}px`, margin: "4px 0 0 0", color: settings.company_subtitle_color, opacity: 0.9 }}>
                          {settings.company_subtitle || "للإعلان والدعاية"}
                        </p>
                      )}
                      {settings.show_company_address && settings.company_address && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "4px 0 0 0", opacity: 0.8 }}>
                          {settings.company_address}
                        </p>
                      )}
                      {settings.show_company_contact && settings.company_phone && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "4px 0 0 0", opacity: 0.8 }}>
                          هاتف: {settings.company_phone}
                        </p>
                      )}
                      {settings.show_tax_id && settings.company_tax_id && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "4px 0 0 0", opacity: 0.8 }}>
                          الرقم الضريبي: {settings.company_tax_id}
                        </p>
                      )}
                      {settings.show_email && settings.company_email && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "4px 0 0 0", opacity: 0.8 }}>
                          {settings.company_email}
                        </p>
                      )}
                      {settings.show_website && settings.company_website && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "4px 0 0 0", opacity: 0.8 }}>
                          {settings.company_website}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Document Title & Info */}
                  <div 
                    className="mb-6 flex justify-between items-start"
                    style={{ marginTop: `${settings.document_title_margin_top}px` }}
                  >
                    <div style={{ textAlign: settings.document_title_alignment, flex: 1 }}>
                      <h2 style={{ fontSize: `${settings.title_font_size - 4}px`, fontWeight: "bold", color: settings.primary_color, margin: 0 }}>
                        {settings.document_title_ar || docTypeInfo.nameAr}
                      </h2>
                      <p style={{ fontSize: `${settings.body_font_size}px`, color: "#666", margin: "4px 0 0 0" }}>
                        {settings.document_title_en || docTypeInfo.nameEn}
                      </p>
                    </div>
                    {/* ✅ قسم معلومات المستند مع التنسيق الديناميكي */}
                    <div 
                      style={{ 
                        textAlign: settings.document_info_alignment,
                        color: settings.document_info_text_color,
                        backgroundColor: settings.document_info_bg_color === 'transparent' ? undefined : settings.document_info_bg_color,
                        padding: settings.document_info_bg_color !== 'transparent' ? '8px 12px' : undefined,
                        borderRadius: settings.document_info_bg_color !== 'transparent' ? `${settings.border_radius}px` : undefined,
                        marginTop: `${settings.document_info_margin_top}px`,
                      }}
                    >
                      {settings.show_document_number && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "2px 0" }}>
                          <strong>الرقم:</strong> STMT-1735489000
                        </p>
                      )}
                      {settings.show_document_date && (
                        <p style={{ fontSize: `${settings.body_font_size}px`, margin: "2px 0" }}>
                          <strong>التاريخ:</strong> {new Date().toLocaleDateString(settings.date_format)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Customer Section */}
                  {settings.show_customer_section && (
                    <div
                      className="mb-6 p-4"
                      style={{
                        backgroundColor: settings.customer_section_bg_color,
                        border: `${settings.border_width}px solid ${settings.customer_section_border_color}`,
                        borderRadius: `${settings.border_radius}px`,
                        color: settings.customer_text_color,
                      }}
                    >
                      <h3 style={{ fontSize: `${settings.header_font_size}px`, fontWeight: "bold", marginBottom: "8px", color: settings.primary_color }}>
                        {settings.customer_section_title}
                      </h3>
                      <div style={{ fontSize: `${settings.body_font_size}px` }}>
                        <p style={{ margin: "4px 0" }}><strong>الاسم:</strong> أحمد أقدورة</p>
                        <p style={{ margin: "4px 0" }}><strong>الشركة:</strong> شركة المثال التجارية</p>
                        <p style={{ margin: "4px 0" }}><strong>الهاتف:</strong> 0912345678</p>
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="mb-6">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${settings.body_font_size}px`, color: settings.table_text_color }}>
                      <thead>
                        <tr style={{ backgroundColor: settings.table_header_bg_color, color: settings.table_header_text_color }}>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>#</th>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>التاريخ</th>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>البيان</th>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>مدين</th>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>دائن</th>
                          <th style={{ padding: "10px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ backgroundColor: settings.table_row_odd_color }}>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, textAlign: "center" }}>1</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>2025-12-01</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>فاتورة عقد #1170</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, color: "#dc2626" }}>19,000 د.ل</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>—</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, fontWeight: "bold" }}>19,000 د.ل</td>
                        </tr>
                        <tr style={{ backgroundColor: settings.table_row_even_color }}>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, textAlign: "center" }}>2</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>2025-12-10</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>دفعة نقدية</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}` }}>—</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, color: "#16a34a" }}>10,000 د.ل</td>
                          <td style={{ padding: "8px", border: `${settings.border_width}px solid ${settings.table_border_color}`, fontWeight: "bold" }}>9,000 د.ل</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div
                    className="p-4"
                    style={{
                      backgroundColor: settings.summary_bg_color,
                      border: `${settings.border_width}px solid ${settings.summary_border_color}`,
                      borderRadius: `${settings.border_radius}px`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${settings.body_font_size}px` }}>
                      <span>إجمالي المدين:</span>
                      <span style={{ color: "#dc2626", fontWeight: "bold" }}>24,000 د.ل</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${settings.body_font_size}px`, marginTop: "8px" }}>
                      <span>إجمالي الدائن:</span>
                      <span style={{ color: "#16a34a", fontWeight: "bold" }}>10,000 د.ل</span>
                    </div>
                    <div 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        fontSize: `${settings.header_font_size}px`, 
                        marginTop: "12px", 
                        paddingTop: "12px",
                        borderTop: `2px solid ${settings.summary_border_color}`,
                        fontWeight: "bold"
                      }}
                    >
                      <span>الرصيد النهائي:</span>
                      <span style={{ color: "#dc2626" }}>14,000 د.ل</span>
                    </div>
                  </div>

                  {/* Footer */}
                  {settings.show_footer && (
                    <div 
                      className="mt-8 pt-4 border-t"
                      style={{ 
                        textAlign: settings.footer_alignment,
                        color: settings.footer_text_color,
                        fontSize: `${settings.body_font_size}px`,
                      }}
                    >
                      <p>{settings.footer_text}</p>
                      {settings.show_page_number && <p className="mt-2 opacity-60">صفحة 1 من 1</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Zoom Control */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}
                  disabled={previewZoom <= 0.3}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="w-32">
                  <Slider
                    value={[previewZoom]}
                    onValueChange={([v]) => setPreviewZoom(v)}
                    min={0.3}
                    max={1.2}
                    step={0.05}
                    className="cursor-pointer"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}
                  disabled={previewZoom >= 1.2}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewZoom(0.45)}
                  title="إعادة التعيين"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrintSettingsPage;
