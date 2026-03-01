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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  Calculator,
  StickyNote,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO, DOCUMENT_CATEGORIES, DocumentType, getAllDocumentTypes, getDocumentsByCategory } from "@/types/document-types";
import { DEFAULT_PRINT_SETTINGS, PrintSettings, HEADER_STYLES, HeaderStyleType, LOGO_SIZES, LogoSizeType, AlignmentType, HeaderAlignmentType, HeaderDirectionType } from "@/types/print-settings";
import { usePrintSettings, usePrintSettingsByType } from "@/store";
import { PrintEnginePreview } from "@/components/print-design/PrintEnginePreview";

// =====================================================
// الخطوط والشعارات والتنسيقات
// =====================================================

const AVAILABLE_FONTS = [
  { name: "Doran", label: "دوران" },
  { name: "Manrope", label: "مانروب" },
  { name: "Cairo", label: "القاهرة" },
  { name: "Tajawal", label: "تجوال" },
  { name: "Amiri", label: "أميري" },
];

const AVAILABLE_LOGOS = [
  "/logofares.svg",
  "/logofares2.svg",
  "/logofaresgold.svg",
  "/logo-symbol.svg",
  "/logo-text.svg",
  "/new-logo.svg",
];

const DATE_FORMATS = [
  { value: "ar-LY", label: "عربي (ليبيا)" },
  { value: "ar-SA", label: "عربي (السعودية)" },
  { value: "en-US", label: "إنجليزي (أمريكي)" },
  { value: "en-GB", label: "إنجليزي (بريطاني)" },
];

// =====================================================
// مكونات مساعدة
// =====================================================

const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-8 font-mono text-xs" dir="ltr" />
    </div>
  </div>
);

const AlignmentSelector = ({ value, onChange, label }: { value: AlignmentType; onChange: (v: AlignmentType) => void; label: string }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {[
        { value: 'right' as const, icon: AlignRight, label: 'يمين' },
        { value: 'center' as const, icon: AlignCenter, label: 'وسط' },
        { value: 'left' as const, icon: AlignLeft, label: 'يسار' },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${
            value === option.value ? "bg-primary text-primary-foreground shadow" : "hover:bg-background/80"
          }`}
          title={option.label}
        >
          <option.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  </div>
);

const SectionResetButton = ({ onClick, label = "إعادة تعيين" }: { onClick: () => void; label?: string }) => (
  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive px-2" onClick={onClick}>
    <RotateCcw className="h-3 w-3 ml-1" />
    {label}
  </Button>
);

// =====================================================
// المكون الرئيسي
// =====================================================

const PrintSettingsPage = () => {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>(DOCUMENT_TYPES.ACCOUNT_STATEMENT);
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.45);
  const [docTypeOpen, setDocTypeOpen] = useState(false);
  const [copyFromOpen, setCopyFromOpen] = useState(false);

  const { saveSettings, selectPrintSettingsByType, fetchSettings } = usePrintSettings();
  const { settings: storeSettings, isLoading } = usePrintSettingsByType(selectedDocType);

  const [settings, setSettings] = useState<Omit<PrintSettings, "document_type">>({ ...DEFAULT_PRINT_SETTINGS });
  const [initializedDocType, setInitializedDocType] = useState<DocumentType | null>(null);

  useEffect(() => {
    if (!storeSettings || isLoading) return;
    if (initializedDocType === selectedDocType) return;
    const { document_type: _dt, ...rest } = storeSettings;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
    setInitializedDocType(selectedDocType);
  }, [storeSettings, selectedDocType, isLoading, initializedDocType]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await saveSettings(selectedDocType, { document_type: selectedDocType, ...settings });
      if (!ok) throw new Error("فشل الحفظ");
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_PRINT_SETTINGS });
    toast.info("تم إعادة الإعدادات للقيم الافتراضية");
  };

  const handleRefresh = async () => {
    setInitializedDocType(null);
    await fetchSettings();
    toast.success("تم تحديث الإعدادات");
  };

  const handleCopyFrom = (sourceDocType: DocumentType) => {
    const src = selectPrintSettingsByType(sourceDocType);
    const { document_type: _dt, ...rest } = src;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
    toast.success(`تم نسخ الإعدادات من ${DOCUMENT_TYPE_INFO[sourceDocType].nameAr}`);
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSection = (keys: (keyof typeof settings)[]) => {
    setSettings((prev) => {
      const updated = { ...prev };
      keys.forEach((key) => {
        (updated as any)[key] = (DEFAULT_PRINT_SETTINGS as any)[key];
      });
      return updated;
    });
    toast.info("تم إعادة تعيين القسم");
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
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* Left Panel - Settings */}
        <div className="lg:w-[460px] space-y-3">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">إعدادات الطباعة</CardTitle>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="تحديث">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5 ml-1" />
                    إعادة
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Save className="h-3.5 w-3.5 ml-1" />}
                    حفظ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="grid grid-cols-2 gap-2">
                {/* Document Type Selector */}
                <div>
                  <Label className="text-xs text-muted-foreground">نوع المستند</Label>
                  <Popover open={docTypeOpen} onOpenChange={setDocTypeOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal">
                        {DOCUMENT_TYPE_INFO[selectedDocType]?.nameAr || 'اختر...'}
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن نوع المستند..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>لا توجد نتائج</CommandEmpty>
                          {Object.entries(DOCUMENT_CATEGORIES).map(([catKey, catInfo]) => (
                            <CommandGroup key={catKey} heading={catInfo.nameAr}>
                              {getDocumentsByCategory(catKey as keyof typeof DOCUMENT_CATEGORIES).map((doc) => (
                                <CommandItem key={doc.id} value={doc.nameAr} onSelect={() => { setSelectedDocType(doc.id); setDocTypeOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", selectedDocType === doc.id ? "opacity-100" : "opacity-0")} />
                                  {doc.nameAr}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Copy From Selector */}
                <div>
                  <Label className="text-xs text-muted-foreground">نسخ من</Label>
                  <Popover open={copyFromOpen} onOpenChange={setCopyFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal text-muted-foreground">
                        اختر...
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>لا توجد نتائج</CommandEmpty>
                          {Object.entries(DOCUMENT_CATEGORIES).map(([catKey, catInfo]) => (
                            <CommandGroup key={catKey} heading={catInfo.nameAr}>
                              {getDocumentsByCategory(catKey as keyof typeof DOCUMENT_CATEGORIES)
                                .filter(d => d.id !== selectedDocType)
                                .map((doc) => (
                                  <CommandItem key={doc.id} value={doc.nameAr} onSelect={() => { handleCopyFrom(doc.id); setCopyFromOpen(false); }}>
                                    {doc.nameAr}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Tabs */}
          <Card className="flex-1">
            <ScrollArea className="h-[calc(100vh-260px)]">
              <Tabs defaultValue="header" className="p-3">
                <TabsList className="grid grid-cols-5 w-full mb-3 h-9">
                  <TabsTrigger value="header" className="text-[10px] px-1 gap-0.5">
                    <Layout className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الهيدر</span>
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-[10px] px-1 gap-0.5">
                    <Table className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الجدول</span>
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-[10px] px-1 gap-0.5">
                    <Type className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">التخطيط</span>
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-[10px] px-1 gap-0.5">
                    <Palette className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الألوان</span>
                  </TabsTrigger>
                  <TabsTrigger value="document" className="text-[10px] px-1 gap-0.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">المستند</span>
                  </TabsTrigger>
                </TabsList>

                {/* ===== Tab 1: الهيدر والشركة ===== */}
                <TabsContent value="header" className="mt-0">
                  <Accordion type="multiple" defaultValue={["header-style", "logo"]} className="space-y-0">
                    {/* نمط الهيدر */}
                    <AccordionItem value="header-style">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> نمط الهيدر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['header_style', 'header_alignment', 'header_direction', 'logo_position_order'])} />
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {(Object.keys(HEADER_STYLES) as HeaderStyleType[]).map((style) => (
                            <button
                              key={style}
                              onClick={() => updateSetting("header_style", style)}
                              className={`p-2.5 border rounded-lg text-right transition-all ${
                                settings.header_style === style ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-xs">{HEADER_STYLES[style].label}</p>
                                  <p className="text-[10px] text-muted-foreground">{HEADER_STYLES[style].description}</p>
                                </div>
                                {settings.header_style === style && (
                                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                    <span className="text-primary-foreground text-[10px]">✓</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* محاذاة واتجاه الهيدر */}
                        <div className="space-y-2 pt-2">
                          <Label className="text-xs">محاذاة الهيدر</Label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([
                              { value: 'right' as const, label: 'يمين' },
                              { value: 'center' as const, label: 'وسط' },
                              { value: 'left' as const, label: 'يسار' },
                              { value: 'split' as const, label: 'موزع' },
                            ]).map((opt) => (
                              <button key={opt.value} onClick={() => updateSetting("header_alignment", opt.value)}
                                className={`p-1.5 border rounded text-center text-[10px] transition-all ${
                                  settings.header_alignment === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                }`}
                              >{opt.label}</button>
                            ))}
                          </div>
                          <Label className="text-xs">اتجاه الهيدر</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {([
                              { value: 'row' as const, label: 'أفقي (جنب لجنب)' },
                              { value: 'column' as const, label: 'عمودي (فوق بعض)' },
                            ]).map((opt) => (
                              <button key={opt.value} onClick={() => updateSetting("header_direction", opt.value)}
                                className={`p-2 border rounded text-center text-[10px] transition-all ${
                                  settings.header_direction === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                }`}
                              >{opt.label}</button>
                            ))}
                          </div>
                          <Label className="text-xs">ترتيب الشعار</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => updateSetting("logo_position_order", 0)}
                              className={`p-1.5 border rounded text-center text-[10px] transition-all ${settings.logo_position_order === 0 ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                            >الشعار أولاً</button>
                            <button onClick={() => updateSetting("logo_position_order", 1)}
                              className={`p-1.5 border rounded text-center text-[10px] transition-all ${settings.logo_position_order === 1 ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                            >العنوان أولاً</button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الشعار */}
                    <AccordionItem value="logo">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> الشعار</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_logo', 'logo_path', 'logo_size', 'logo_size_preset', 'logo_position'])} />
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                          <Checkbox id="show_logo" checked={settings.show_logo} onCheckedChange={(v) => updateSetting("show_logo", !!v)} />
                          <Label htmlFor="show_logo" className="text-xs cursor-pointer">إظهار الشعار</Label>
                        </div>
                        {settings.show_logo && (
                          <>
                            <Label className="text-xs">حجم الشعار</Label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(Object.keys(LOGO_SIZES) as LogoSizeType[]).map((size) => (
                                <button key={size} onClick={() => { updateSetting("logo_size_preset", size); updateSetting("logo_size", LOGO_SIZES[size].value); }}
                                  className={`p-2 border rounded text-center transition-all ${settings.logo_size_preset === size ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                                >
                                  <p className="font-medium text-[10px]">{LOGO_SIZES[size].label}</p>
                                  <p className="text-[9px] text-muted-foreground">{LOGO_SIZES[size].value}px</p>
                                </button>
                              ))}
                            </div>
                            <Label className="text-xs">اختر الشعار</Label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {AVAILABLE_LOGOS.map((logo) => (
                                <button key={logo} onClick={() => updateSetting("logo_path", logo)}
                                  className={`p-2 border rounded-lg hover:border-primary transition-colors ${settings.logo_path === logo ? "border-primary bg-primary/5" : "border-border"}`}
                                >
                                  <img src={logo} alt="" className="h-7 w-full object-contain" />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* عناصر الهيدر */}
                    <AccordionItem value="header-elements">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> عناصر الهيدر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="space-y-2 p-2 bg-muted/30 rounded">
                          {[
                            { id: 'show_tax_id' as const, label: 'الرقم الضريبي' },
                            { id: 'show_email' as const, label: 'البريد الإلكتروني' },
                            { id: 'show_website' as const, label: 'الموقع الإلكتروني' },
                          ].map(item => (
                            <div key={item.id} className="flex items-center gap-3">
                              <Checkbox id={item.id} checked={settings[item.id]} onCheckedChange={(v) => updateSetting(item.id, !!v)} />
                              <Label htmlFor={item.id} className="text-xs cursor-pointer">إظهار {item.label}</Label>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">إظهار/إخفاء عناصر الشركة</Label>
                        <div className="space-y-2 p-2 bg-muted/30 rounded">
                          {[
                            { id: 'show_company_name' as const, label: 'اسم الشركة' },
                            { id: 'show_company_subtitle' as const, label: 'العنوان الفرعي' },
                            { id: 'show_company_address' as const, label: 'العنوان' },
                            { id: 'show_company_contact' as const, label: 'معلومات الاتصال' },
                          ].map(item => (
                            <div key={item.id} className="flex items-center gap-3">
                              <Checkbox id={item.id} checked={settings[item.id]} onCheckedChange={(v) => updateSetting(item.id, !!v)} />
                              <Label htmlFor={item.id} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* معلومات الشركة */}
                    <AccordionItem value="company-info">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> معلومات الشركة</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['company_name', 'company_subtitle', 'company_address', 'company_phone', 'company_tax_id', 'company_email', 'company_website'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">اسم الشركة</Label>
                            <Input value={settings.company_name} onChange={(e) => updateSetting("company_name", e.target.value)} placeholder="الفارس الذهبي" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">العنوان الفرعي</Label>
                            <Input value={settings.company_subtitle} onChange={(e) => updateSetting("company_subtitle", e.target.value)} placeholder="للإعلان والدعاية" className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">العنوان</Label>
                            <Input value={settings.company_address} onChange={(e) => updateSetting("company_address", e.target.value)} placeholder="طرابلس - ليبيا" className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">الهاتف</Label>
                            <Input value={settings.company_phone} onChange={(e) => updateSetting("company_phone", e.target.value)} placeholder="0912345678" className="h-8 text-xs" dir="ltr" />
                          </div>
                          {settings.show_tax_id && (
                            <div>
                              <Label className="text-xs">الرقم الضريبي</Label>
                              <Input value={settings.company_tax_id || ''} onChange={(e) => updateSetting("company_tax_id", e.target.value)} placeholder="1234567890" className="h-8 text-xs" dir="ltr" />
                            </div>
                          )}
                          {settings.show_email && (
                            <div>
                              <Label className="text-xs">البريد الإلكتروني</Label>
                              <Input value={settings.company_email || ''} onChange={(e) => updateSetting("company_email", e.target.value)} placeholder="info@example.com" className="h-8 text-xs" dir="ltr" />
                            </div>
                          )}
                          {settings.show_website && (
                            <div className="col-span-2">
                              <Label className="text-xs">الموقع الإلكتروني</Label>
                              <Input value={settings.company_website || ''} onChange={(e) => updateSetting("company_website", e.target.value)} placeholder="www.example.com" className="h-8 text-xs" dir="ltr" />
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 2: الجدول والملخص ===== */}
                <TabsContent value="table" className="mt-0">
                  <Accordion type="multiple" defaultValue={["table-colors"]} className="space-y-0">
                    {/* ألوان الجدول */}
                    <AccordionItem value="table-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Palette className="h-4 w-4" /> ألوان الجدول</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['table_header_bg_color', 'table_header_text_color', 'table_border_color', 'table_row_even_color', 'table_row_odd_color', 'table_text_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الترويسة" value={settings.table_header_bg_color} onChange={(v) => updateSetting("table_header_bg_color", v)} />
                          <ColorPicker label="نص الترويسة" value={settings.table_header_text_color} onChange={(v) => updateSetting("table_header_text_color", v)} />
                          <ColorPicker label="لون الحدود" value={settings.table_border_color} onChange={(v) => updateSetting("table_border_color", v)} />
                          <ColorPicker label="نص الجدول" value={settings.table_text_color} onChange={(v) => updateSetting("table_text_color", v)} />
                          <ColorPicker label="صف زوجي" value={settings.table_row_even_color} onChange={(v) => updateSetting("table_row_even_color", v)} />
                          <ColorPicker label="صف فردي" value={settings.table_row_odd_color} onChange={(v) => updateSetting("table_row_odd_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* خصائص الجدول */}
                    <AccordionItem value="table-props">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Table className="h-4 w-4" /> خصائص الجدول</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['table_header_font_size', 'table_body_font_size', 'table_header_padding', 'table_body_padding', 'table_header_font_weight', 'table_line_height', 'table_border_width', 'table_border_style', 'table_header_height', 'table_body_row_height'])} />
                        </div>
                        {/* حجم الخطوط */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">حجم خط الترويسة: {settings.table_header_font_size}px</Label>
                            <Slider value={[settings.table_header_font_size]} onValueChange={([v]) => updateSetting("table_header_font_size", v)} min={7} max={18} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">حجم خط الصفوف: {settings.table_body_font_size}px</Label>
                            <Slider value={[settings.table_body_font_size]} onValueChange={([v]) => updateSetting("table_body_font_size", v)} min={7} max={18} step={1} className="mt-1" />
                          </div>
                        </div>
                        {/* Padding */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">padding الترويسة</Label>
                            <Input value={settings.table_header_padding} onChange={(e) => updateSetting("table_header_padding", e.target.value)} placeholder="4px 8px" className="h-8 font-mono text-xs" dir="ltr" />
                          </div>
                          <div>
                            <Label className="text-xs">padding الصفوف</Label>
                            <Input value={settings.table_body_padding} onChange={(e) => updateSetting("table_body_padding", e.target.value)} placeholder="4px" className="h-8 font-mono text-xs" dir="ltr" />
                          </div>
                        </div>
                        {/* وزن الخط وارتفاع السطر */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">وزن خط الترويسة</Label>
                            <Select value={settings.table_header_font_weight} onValueChange={(v) => updateSetting("table_header_font_weight", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">عادي</SelectItem>
                                <SelectItem value="500">متوسط</SelectItem>
                                <SelectItem value="600">شبه سميك</SelectItem>
                                <SelectItem value="bold">سميك</SelectItem>
                                <SelectItem value="800">سميك جداً</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">ارتفاع السطر: {settings.table_line_height}</Label>
                            <Select value={settings.table_line_height} onValueChange={(v) => updateSetting("table_line_height", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1.0">ضيق (1.0)</SelectItem>
                                <SelectItem value="1.2">متوسط (1.2)</SelectItem>
                                <SelectItem value="1.4">عادي (1.4)</SelectItem>
                                <SelectItem value="1.6">واسع (1.6)</SelectItem>
                                <SelectItem value="1.8">واسع جداً (1.8)</SelectItem>
                                <SelectItem value="2.0">مزدوج (2.0)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* ارتفاع الصفوف */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">ارتفاع الترويسة: {settings.table_header_height || 'تلقائي'}px</Label>
                            <Slider value={[settings.table_header_height]} onValueChange={([v]) => updateSetting("table_header_height", v)} min={0} max={60} step={2} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">ارتفاع الصف: {settings.table_body_row_height || 'تلقائي'}px</Label>
                            <Slider value={[settings.table_body_row_height]} onValueChange={([v]) => updateSetting("table_body_row_height", v)} min={0} max={60} step={2} className="mt-1" />
                          </div>
                        </div>
                        {/* نمط الحدود */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">سمك الحدود: {settings.table_border_width}px</Label>
                            <Slider value={[settings.table_border_width]} onValueChange={([v]) => updateSetting("table_border_width", v)} min={0} max={4} step={0.5} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">نمط الحدود</Label>
                            <Select value={settings.table_border_style} onValueChange={(v) => updateSetting("table_border_style", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid">متصل</SelectItem>
                                <SelectItem value="dashed">متقطع</SelectItem>
                                <SelectItem value="dotted">منقط</SelectItem>
                                <SelectItem value="none">بدون</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* صندوق الإجماليات */}
                    <AccordionItem value="totals-box">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Calculator className="h-4 w-4" /> صندوق الإجماليات</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['totals_box_bg_color', 'totals_box_text_color', 'totals_box_border_color', 'totals_box_border_radius', 'totals_title_font_size', 'totals_value_font_size', 'summary_bg_color', 'summary_text_color', 'summary_border_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الملخص" value={settings.summary_bg_color} onChange={(v) => updateSetting("summary_bg_color", v)} />
                          <ColorPicker label="نص الملخص (الإجمالي)" value={settings.summary_text_color} onChange={(v) => updateSetting("summary_text_color", v)} />
                          <ColorPicker label="حدود الملخص" value={settings.summary_border_color} onChange={(v) => updateSetting("summary_border_color", v)} />
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">صندوق الإجماليات المنفصل</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الصندوق" value={settings.totals_box_bg_color} onChange={(v) => updateSetting("totals_box_bg_color", v)} />
                          <ColorPicker label="نص الصندوق" value={settings.totals_box_text_color} onChange={(v) => updateSetting("totals_box_text_color", v)} />
                          <ColorPicker label="حدود الصندوق" value={settings.totals_box_border_color} onChange={(v) => updateSetting("totals_box_border_color", v)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">نصف قطر الحدود: {settings.totals_box_border_radius}px</Label>
                            <Slider value={[settings.totals_box_border_radius]} onValueChange={([v]) => updateSetting("totals_box_border_radius", v)} min={0} max={20} step={1} className="mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">حجم خط العنوان: {settings.totals_title_font_size}px</Label>
                            <Slider value={[settings.totals_title_font_size]} onValueChange={([v]) => updateSetting("totals_title_font_size", v)} min={8} max={24} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">حجم خط القيمة: {settings.totals_value_font_size}px</Label>
                            <Slider value={[settings.totals_value_font_size]} onValueChange={([v]) => updateSetting("totals_value_font_size", v)} min={8} max={24} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* قسم العميل */}
                    <AccordionItem value="customer-section">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><User className="h-4 w-4" /> قسم العميل</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_customer_section', 'customer_section_title', 'customer_section_bg_color', 'customer_section_border_color', 'customer_text_color'])} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار قسم العميل</Label>
                          <Switch checked={settings.show_customer_section} onCheckedChange={(v) => updateSetting("show_customer_section", v)} />
                        </div>
                        {settings.show_customer_section && (
                          <>
                            <div>
                              <Label className="text-xs">عنوان القسم</Label>
                              <Input value={settings.customer_section_title} onChange={(e) => updateSetting("customer_section_title", e.target.value)} placeholder="بيانات العميل" className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <ColorPicker label="خلفية القسم" value={settings.customer_section_bg_color} onChange={(v) => updateSetting("customer_section_bg_color", v)} />
                              <ColorPicker label="حدود القسم" value={settings.customer_section_border_color} onChange={(v) => updateSetting("customer_section_border_color", v)} />
                              <ColorPicker label="لون النص" value={settings.customer_text_color} onChange={(v) => updateSetting("customer_text_color", v)} />
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 3: التخطيط والخطوط ===== */}
                <TabsContent value="layout" className="mt-0">
                  <Accordion type="multiple" defaultValue={["margins"]} className="space-y-0">
                    {/* الهوامش */}
                    <AccordionItem value="margins">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> الهوامش</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['page_margin_top', 'page_margin_bottom', 'page_margin_left', 'page_margin_right', 'header_margin_bottom', 'document_title_margin_top'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">أعلى: {settings.page_margin_top}mm</Label>
                            <Slider value={[settings.page_margin_top]} onValueChange={([v]) => updateSetting("page_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">أسفل: {settings.page_margin_bottom}mm</Label>
                            <Slider value={[settings.page_margin_bottom]} onValueChange={([v]) => updateSetting("page_margin_bottom", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">يمين: {settings.page_margin_right}mm</Label>
                            <Slider value={[settings.page_margin_right]} onValueChange={([v]) => updateSetting("page_margin_right", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">يسار: {settings.page_margin_left}mm</Label>
                            <Slider value={[settings.page_margin_left]} onValueChange={([v]) => updateSetting("page_margin_left", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">مسافة أسفل الهيدر: {settings.header_margin_bottom}px</Label>
                            <Slider value={[settings.header_margin_bottom]} onValueChange={([v]) => updateSetting("header_margin_bottom", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">مسافة أعلى العنوان: {settings.document_title_margin_top}px</Label>
                            <Slider value={[settings.document_title_margin_top]} onValueChange={([v]) => updateSetting("document_title_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                        </div>
                        <AlignmentSelector value={settings.document_title_alignment} onChange={(v) => updateSetting("document_title_alignment", v)} label="محاذاة عنوان المستند" />
                      </AccordionContent>
                    </AccordionItem>

                    {/* الخطوط */}
                    <AccordionItem value="fonts">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Type className="h-4 w-4" /> الخطوط</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['font_family', 'title_font_size', 'header_font_size', 'body_font_size'])} />
                        </div>
                        <div>
                          <Label className="text-xs">نوع الخط</Label>
                          <Select value={settings.font_family} onValueChange={(v) => updateSetting("font_family", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_FONTS.map((font) => (
                                <SelectItem key={font.name} value={font.name}><span style={{ fontFamily: font.name }}>{font.label}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">العنوان: {settings.title_font_size}px</Label>
                            <Slider value={[settings.title_font_size]} onValueChange={([v]) => updateSetting("title_font_size", v)} min={14} max={36} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">الهيدر: {settings.header_font_size}px</Label>
                            <Slider value={[settings.header_font_size]} onValueChange={([v]) => updateSetting("header_font_size", v)} min={10} max={24} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">النص: {settings.body_font_size}px</Label>
                            <Slider value={[settings.body_font_size]} onValueChange={([v]) => updateSetting("body_font_size", v)} min={8} max={18} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الاتجاه والحدود */}
                    <AccordionItem value="direction">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> الاتجاه والحدود</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">اتجاه الصفحة</Label>
                            <Select value={settings.direction} onValueChange={(v) => updateSetting("direction", v as 'rtl' | 'ltr')}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rtl">RTL (عربي)</SelectItem>
                                <SelectItem value="ltr">LTR (إنجليزي)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">نصف قطر الحدود: {settings.border_radius}px</Label>
                            <Slider value={[settings.border_radius]} onValueChange={([v]) => updateSetting("border_radius", v)} min={0} max={20} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الخلفية */}
                    <AccordionItem value="background">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> الخلفية (ووترمارك)</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['background_image', 'background_opacity'])} />
                        </div>
                        <div>
                          <Label className="text-xs">رابط صورة الخلفية</Label>
                          <Input value={settings.background_image} onChange={(e) => updateSetting("background_image", e.target.value)} placeholder="https://... أو /path/to/image.png" className="h-8 text-xs" dir="ltr" />
                        </div>
                        <div>
                          <Label className="text-xs">شفافية الخلفية: {settings.background_opacity}%</Label>
                          <Slider value={[settings.background_opacity]} onValueChange={([v]) => updateSetting("background_opacity", v)} min={0} max={100} step={5} className="mt-1" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 4: الألوان ===== */}
                <TabsContent value="colors" className="mt-0">
                  <Accordion type="multiple" defaultValue={["main-colors"]} className="space-y-0">
                    {/* الألوان الأساسية */}
                    <AccordionItem value="main-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Palette className="h-4 w-4" /> الألوان الأساسية</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['primary_color', 'secondary_color', 'accent_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="اللون الأساسي" value={settings.primary_color} onChange={(v) => { updateSetting("primary_color", v); updateSetting("header_bg_color", v); updateSetting("table_header_bg_color", v); }} />
                          <ColorPicker label="اللون الثانوي" value={settings.secondary_color} onChange={(v) => updateSetting("secondary_color", v)} />
                          <ColorPicker label="لون التمييز" value={settings.accent_color} onChange={(v) => updateSetting("accent_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* ألوان الهيدر */}
                    <AccordionItem value="header-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> ألوان الهيدر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['header_bg_color', 'header_text_color', 'company_subtitle_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الهيدر" value={settings.header_bg_color} onChange={(v) => updateSetting("header_bg_color", v)} />
                          <ColorPicker label="نص الهيدر" value={settings.header_text_color} onChange={(v) => updateSetting("header_text_color", v)} />
                          <ColorPicker label="العنوان الفرعي" value={settings.company_subtitle_color} onChange={(v) => updateSetting("company_subtitle_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* ألوان النصوص */}
                    <AccordionItem value="text-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Type className="h-4 w-4" /> ألوان النصوص</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['customer_text_color', 'table_text_color', 'footer_text_color', 'document_info_text_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="نص قسم العميل" value={settings.customer_text_color} onChange={(v) => updateSetting("customer_text_color", v)} />
                          <ColorPicker label="نص الجدول" value={settings.table_text_color} onChange={(v) => updateSetting("table_text_color", v)} />
                          <ColorPicker label="نص الفوتر" value={settings.footer_text_color} onChange={(v) => updateSetting("footer_text_color", v)} />
                          <ColorPicker label="نص معلومات المستند" value={settings.document_info_text_color} onChange={(v) => updateSetting("document_info_text_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 5: المستند ===== */}
                <TabsContent value="document" className="mt-0">
                  <Accordion type="multiple" defaultValue={["doc-title"]} className="space-y-0">
                    {/* عنوان المستند */}
                    <AccordionItem value="doc-title">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> عنوان المستند</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">العنوان بالعربي</Label>
                            <Input value={settings.document_title_ar} onChange={(e) => updateSetting("document_title_ar", e.target.value)} placeholder={docTypeInfo.nameAr} className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">العنوان بالإنجليزي</Label>
                            <Input value={settings.document_title_en} onChange={(e) => updateSetting("document_title_en", e.target.value)} placeholder={docTypeInfo.nameEn} className="h-8 text-xs" dir="ltr" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* معلومات المستند */}
                    <AccordionItem value="doc-info">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> معلومات المستند</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار رقم المستند</Label>
                          <Switch checked={settings.show_document_number} onCheckedChange={(v) => updateSetting("show_document_number", v)} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار التاريخ</Label>
                          <Switch checked={settings.show_document_date} onCheckedChange={(v) => updateSetting("show_document_date", v)} />
                        </div>
                        <div>
                          <Label className="text-xs">تنسيق التاريخ</Label>
                          <Select value={settings.date_format} onValueChange={(v) => updateSetting("date_format", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DATE_FORMATS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">تنسيق قسم المعلومات</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="لون النص" value={settings.document_info_text_color} onChange={(v) => updateSetting("document_info_text_color", v)} />
                          <ColorPicker label="لون الخلفية" value={settings.document_info_bg_color} onChange={(v) => updateSetting("document_info_bg_color", v)} />
                        </div>
                        <AlignmentSelector value={settings.document_info_alignment} onChange={(v) => updateSetting("document_info_alignment", v)} label="محاذاة المعلومات" />
                        <div>
                          <Label className="text-xs">المسافة العلوية: {settings.document_info_margin_top}px</Label>
                          <Slider value={[settings.document_info_margin_top]} onValueChange={([v]) => updateSetting("document_info_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الفوتر */}
                    <AccordionItem value="footer">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> الفوتر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_footer', 'footer_text', 'show_page_number', 'footer_alignment', 'footer_text_color'])} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار الفوتر</Label>
                          <Switch checked={settings.show_footer} onCheckedChange={(v) => updateSetting("show_footer", v)} />
                        </div>
                        {settings.show_footer && (
                          <>
                            <div>
                              <Label className="text-xs">نص الفوتر</Label>
                              <Input value={settings.footer_text} onChange={(e) => updateSetting("footer_text", e.target.value)} placeholder="شكراً لتعاملكم معنا" className="h-8 text-xs" />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <Label className="text-xs">إظهار رقم الصفحة</Label>
                              <Switch checked={settings.show_page_number} onCheckedChange={(v) => updateSetting("show_page_number", v)} />
                            </div>
                            <AlignmentSelector value={settings.footer_alignment} onChange={(v) => updateSetting("footer_alignment", v)} label="محاذاة الفوتر" />
                            <ColorPicker label="لون نص الفوتر" value={settings.footer_text_color} onChange={(v) => updateSetting("footer_text_color", v)} />
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                معاينة حية - {docTypeInfo.nameAr}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <PrintEnginePreview settings={settings} documentType={selectedDocType} zoom={previewZoom} />

              {/* Floating Zoom Control */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))} disabled={previewZoom <= 0.3}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <div className="w-28">
                  <Slider value={[previewZoom]} onValueChange={([v]) => setPreviewZoom(v)} min={0.3} max={1.2} step={0.05} className="cursor-pointer" />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))} disabled={previewZoom >= 1.2}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground min-w-[32px] text-center">{Math.round(previewZoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(0.45)} title="إعادة التعيين">
                  <Maximize2 className="h-3.5 w-3.5" />
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
