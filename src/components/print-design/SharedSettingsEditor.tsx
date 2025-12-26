import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedInvoiceSettings, AVAILABLE_LOGOS, AVAILABLE_BACKGROUNDS, AlignmentOption } from '@/types/invoice-templates';
import { Building2, Image, Palette, Type, Layout, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
  settings: SharedInvoiceSettings;
  onSettingsChange: (settings: SharedInvoiceSettings) => void;
}

const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-10 h-10 rounded border cursor-pointer"
    />
    <div className="flex-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs font-mono"
      />
    </div>
  </div>
);

const SliderInput = ({ label, value, onChange, min = 0, max = 100, step = 1 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono">{value}</span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
    />
  </div>
);

const AlignmentSelector = ({ value, onChange, label }: { 
  value: AlignmentOption; 
  onChange: (v: AlignmentOption) => void;
  label: string;
}) => (
  <div className="space-y-2">
    <Label className="text-xs">{label}</Label>
    <RadioGroup 
      value={value} 
      onValueChange={(v) => onChange(v as AlignmentOption)}
      className="flex gap-2"
    >
      <div className="flex items-center space-x-1 space-x-reverse">
        <RadioGroupItem value="right" id={`${label}-right`} className="sr-only" />
        <Label 
          htmlFor={`${label}-right`}
          className={`flex items-center justify-center w-10 h-10 rounded border cursor-pointer transition-colors
            ${value === 'right' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
        >
          <AlignRight className="h-4 w-4" />
        </Label>
      </div>
      <div className="flex items-center space-x-1 space-x-reverse">
        <RadioGroupItem value="center" id={`${label}-center`} className="sr-only" />
        <Label 
          htmlFor={`${label}-center`}
          className={`flex items-center justify-center w-10 h-10 rounded border cursor-pointer transition-colors
            ${value === 'center' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
        >
          <AlignCenter className="h-4 w-4" />
        </Label>
      </div>
      <div className="flex items-center space-x-1 space-x-reverse">
        <RadioGroupItem value="left" id={`${label}-left`} className="sr-only" />
        <Label 
          htmlFor={`${label}-left`}
          className={`flex items-center justify-center w-10 h-10 rounded border cursor-pointer transition-colors
            ${value === 'left' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
        >
          <AlignLeft className="h-4 w-4" />
        </Label>
      </div>
    </RadioGroup>
  </div>
);

export function SharedSettingsEditor({ settings, onSettingsChange }: Props) {
  const update = (key: keyof SharedInvoiceSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4 p-1">
          <TabsTrigger value="header" className="text-xs gap-1 flex-1 min-w-[70px]">
            <Layout className="h-3 w-3" />
            الهيدر
          </TabsTrigger>
          <TabsTrigger value="company" className="text-xs gap-1 flex-1 min-w-[70px]">
            <Building2 className="h-3 w-3" />
            الشركة
          </TabsTrigger>
          <TabsTrigger value="background" className="text-xs gap-1 flex-1 min-w-[70px]">
            <Image className="h-3 w-3" />
            الخلفية
          </TabsTrigger>
          <TabsTrigger value="footer" className="text-xs gap-1 flex-1 min-w-[70px]">
            <Layout className="h-3 w-3 rotate-180" />
            الفوتر
          </TabsTrigger>
          <TabsTrigger value="fonts" className="text-xs gap-1 flex-1 min-w-[70px]">
            <Type className="h-3 w-3" />
            الخط
          </TabsTrigger>
        </TabsList>

        {/* Header Tab */}
        <TabsContent value="header" className="space-y-4">
          {/* Logo Selection */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">الشعار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">إظهار الشعار</Label>
                <Switch checked={settings.showLogo} onCheckedChange={(v) => update('showLogo', v)} />
              </div>
              
              {settings.showLogo && (
                <>
                  <div>
                    <Label className="text-xs mb-2 block">اختر الشعار</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {AVAILABLE_LOGOS.map(logo => (
                        <div 
                          key={logo.id}
                          onClick={() => update('logoPath', logo.path)}
                          className={`flex flex-col items-center p-2 rounded border cursor-pointer transition-all
                            ${settings.logoPath === logo.path ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                        >
                          <img src={logo.path} alt={logo.name} className="h-10 w-auto" />
                          <span className="text-[10px] mt-1 text-center">{logo.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <SliderInput
                    label="حجم الشعار"
                    value={settings.logoSize}
                    onChange={(v) => update('logoSize', v)}
                    min={30}
                    max={120}
                  />
                  
                  <AlignmentSelector
                    label="موضع الشعار"
                    value={settings.logoPosition}
                    onChange={(v) => update('logoPosition', v)}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Contact Info under Logo */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">معلومات الاتصال (أسفل الشعار)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">إظهار العنوان والهاتف</Label>
                <Switch checked={settings.showContactInfo} onCheckedChange={(v) => update('showContactInfo', v)} />
              </div>
              
              {settings.showContactInfo && (
                <>
                  <div>
                    <Label className="text-xs">العنوان</Label>
                    <Input
                      value={settings.companyAddress}
                      onChange={(e) => update('companyAddress', e.target.value)}
                      className="h-9"
                      placeholder="طرابلس – طريق المطار"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">الهاتف</Label>
                    <Input
                      value={settings.companyPhone}
                      onChange={(e) => update('companyPhone', e.target.value)}
                      className="h-9"
                      placeholder="0912612255"
                    />
                  </div>
                  <SliderInput
                    label="حجم الخط"
                    value={settings.contactInfoFontSize}
                    onChange={(v) => update('contactInfoFontSize', v)}
                    min={8}
                    max={16}
                  />
                  <AlignmentSelector
                    label="المحاذاة"
                    value={settings.contactInfoAlignment || 'center'}
                    onChange={(v) => update('contactInfoAlignment', v)}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice Title */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">عنوان الفاتورة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">إظهار العنوان</Label>
                <Switch checked={settings.showInvoiceTitle} onCheckedChange={(v) => update('showInvoiceTitle', v)} />
              </div>
              
              {settings.showInvoiceTitle && (
                <>
                  <div>
                    <Label className="text-xs">العنوان بالعربي</Label>
                    <Input
                      value={settings.invoiceTitle}
                      onChange={(e) => update('invoiceTitle', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">العنوان بالإنجليزي</Label>
                    <Input
                      value={settings.invoiceTitleEn}
                      onChange={(e) => update('invoiceTitleEn', e.target.value)}
                      className="h-9"
                      dir="ltr"
                    />
                  </div>
                  <AlignmentSelector
                    label="محاذاة العنوان"
                    value={settings.invoiceTitleAlignment}
                    onChange={(v) => update('invoiceTitleAlignment', v)}
                  />
                  <SliderInput
                    label="حجم خط العنوان"
                    value={settings.invoiceTitleFontSize || 28}
                    onChange={(v) => update('invoiceTitleFontSize', v)}
                    min={16}
                    max={48}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Header Colors */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">ألوان الهيدر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ColorInput
                label="لون خلفية الهيدر"
                value={settings.headerBgColor}
                onChange={(v) => update('headerBgColor', v)}
              />
              <ColorInput
                label="لون نص الهيدر"
                value={settings.headerTextColor}
                onChange={(v) => update('headerTextColor', v)}
              />
              <SliderInput
                label="شفافية الهيدر"
                value={settings.headerBgOpacity}
                onChange={(v) => update('headerBgOpacity', v)}
              />
              <AlignmentSelector
                label="محاذاة الهيدر"
                value={settings.headerAlignment}
                onChange={(v) => update('headerAlignment', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">معلومات الشركة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">إظهار معلومات الشركة</Label>
                <Switch checked={settings.showCompanyInfo} onCheckedChange={(v) => update('showCompanyInfo', v)} />
              </div>
              
              {settings.showCompanyInfo && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">إظهار اسم الشركة</Label>
                    <Switch checked={settings.showCompanyName} onCheckedChange={(v) => update('showCompanyName', v)} />
                  </div>
                  {settings.showCompanyName && (
                    <Input
                      value={settings.companyName}
                      onChange={(e) => update('companyName', e.target.value)}
                      className="h-9"
                      placeholder="اسم الشركة"
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">إظهار الوصف</Label>
                    <Switch checked={settings.showCompanySubtitle} onCheckedChange={(v) => update('showCompanySubtitle', v)} />
                  </div>
                  {settings.showCompanySubtitle && (
                    <Input
                      value={settings.companySubtitle}
                      onChange={(e) => update('companySubtitle', e.target.value)}
                      className="h-9"
                      placeholder="الوصف"
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">إظهار العنوان</Label>
                    <Switch checked={settings.showCompanyAddress} onCheckedChange={(v) => update('showCompanyAddress', v)} />
                  </div>
                  {settings.showCompanyAddress && (
                    <Input
                      value={settings.companyAddress}
                      onChange={(e) => update('companyAddress', e.target.value)}
                      className="h-9"
                      placeholder="العنوان"
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">إظهار الهاتف</Label>
                    <Switch checked={settings.showCompanyPhone} onCheckedChange={(v) => update('showCompanyPhone', v)} />
                  </div>
                  {settings.showCompanyPhone && (
                    <Input
                      value={settings.companyPhone}
                      onChange={(e) => update('companyPhone', e.target.value)}
                      className="h-9"
                      placeholder="الهاتف"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Background Tab */}
        <TabsContent value="background" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">صورة الخلفية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs mb-2 block">اختر الخلفية</Label>
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_BACKGROUNDS.map(bg => (
                    <div 
                      key={bg.id}
                      onClick={() => update('backgroundImage', bg.path)}
                      className={`flex flex-col items-center p-2 rounded border cursor-pointer transition-all min-h-[60px]
                        ${settings.backgroundImage === bg.path ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                    >
                      {bg.path ? (
                        <img src={bg.path} alt={bg.name} className="h-8 w-auto" />
                      ) : (
                        <div className="h-8 w-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          بدون
                        </div>
                      )}
                      <span className="text-[10px] mt-1 text-center">{bg.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-xs">أو أدخل رابط مخصص</Label>
                <Input
                  value={settings.backgroundImage}
                  onChange={(e) => update('backgroundImage', e.target.value)}
                  placeholder="اترك فارغاً لعدم وجود خلفية"
                  className="h-9"
                />
              </div>
              
              {settings.backgroundImage && (
                <>
                  <SliderInput
                    label="شفافية الخلفية"
                    value={settings.backgroundOpacity}
                    onChange={(v) => update('backgroundOpacity', v)}
                    min={5}
                    max={100}
                  />
                  <SliderInput
                    label="حجم الخلفية"
                    value={settings.backgroundScale}
                    onChange={(v) => update('backgroundScale', v)}
                    min={10}
                    max={200}
                  />
                  <SliderInput
                    label="موضع X"
                    value={settings.backgroundPosX}
                    onChange={(v) => update('backgroundPosX', v)}
                    min={0}
                    max={100}
                  />
                  <SliderInput
                    label="موضع Y"
                    value={settings.backgroundPosY}
                    onChange={(v) => update('backgroundPosY', v)}
                    min={0}
                    max={100}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer Tab */}
        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">إعدادات الفوتر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">إظهار الفوتر</Label>
                <Switch checked={settings.showFooter} onCheckedChange={(v) => update('showFooter', v)} />
              </div>
              
              {settings.showFooter && (
                <>
                  <div>
                    <Label className="text-xs">نص الفوتر</Label>
                    <Input
                      value={settings.footerText}
                      onChange={(e) => update('footerText', e.target.value)}
                      className="h-9"
                      placeholder="شكراً لتعاملكم معنا"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">إظهار رقم الصفحة</Label>
                    <Switch checked={settings.showPageNumber} onCheckedChange={(v) => update('showPageNumber', v)} />
                  </div>
                  
                  <AlignmentSelector
                    label="محاذاة الفوتر"
                    value={settings.footerAlignment}
                    onChange={(v) => update('footerAlignment', v)}
                  />
                  
                  <SliderInput
                    label="موضع الفوتر (المسافة من الأسفل - مم)"
                    value={settings.footerPosition}
                    onChange={(v) => update('footerPosition', v)}
                    min={5}
                    max={50}
                  />
                  
                  <ColorInput
                    label="لون خلفية الفوتر"
                    value={settings.footerBgColor === 'transparent' ? '#ffffff' : settings.footerBgColor}
                    onChange={(v) => update('footerBgColor', v)}
                  />
                  
                  <ColorInput
                    label="لون نص الفوتر"
                    value={settings.footerTextColor}
                    onChange={(v) => update('footerTextColor', v)}
                  />
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">هوامش الصفحة (مم)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SliderInput
                label="الهامش العلوي"
                value={settings.pageMarginTop}
                onChange={(v) => update('pageMarginTop', v)}
                min={5}
                max={40}
              />
              <SliderInput
                label="الهامش السفلي"
                value={settings.pageMarginBottom}
                onChange={(v) => update('pageMarginBottom', v)}
                min={5}
                max={40}
              />
              <SliderInput
                label="مسافة آمنة فوق الفوتر"
                value={settings.contentBottomSpacing}
                onChange={(v) => update('contentBottomSpacing', v)}
                min={0}
                max={60}
              />
              <SliderInput
                label="الهامش الأيمن"
                value={settings.pageMarginRight}
                onChange={(v) => update('pageMarginRight', v)}
                min={5}
                max={40}
              />
              <SliderInput
                label="الهامش الأيسر"
                value={settings.pageMarginLeft}
                onChange={(v) => update('pageMarginLeft', v)}
                min={5}
                max={40}
              />
              <SliderInput
                label="المسافة أسفل الهيدر"
                value={settings.headerMarginBottom}
                onChange={(v) => update('headerMarginBottom', v)}
                min={5}
                max={50}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fonts Tab */}
        <TabsContent value="fonts" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">الخط العام</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={settings.fontFamily} onValueChange={(v) => update('fontFamily', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Doran">Doran</SelectItem>
                  <SelectItem value="Manrope">Manrope</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Tahoma">Tahoma</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
