import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { IndividualInvoiceSettings, AlignmentOption, InvoiceTemplateType, hasSection } from '@/types/invoice-templates';
import { Palette, Table, Type, User, Calculator, FileText, AlignLeft, AlignCenter, AlignRight, CreditCard, Users, Wallet, PenTool, Image, Wrench, BarChart2, ArrowLeftRight } from 'lucide-react';

interface Props {
  settings: IndividualInvoiceSettings;
  onSettingsChange: (settings: IndividualInvoiceSettings) => void;
  templateName: string;
  templateType?: InvoiceTemplateType;
}

const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value === 'transparent' ? '#ffffff' : value}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
    />
    <div className="flex-1 min-w-0">
      <Label className="text-xs truncate block">{label}</Label>
    </div>
  </div>
);

const SliderInput = ({ label, value, onChange, min = 0, max = 100, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono">{value}</span>
    </div>
    <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
  </div>
);

const AlignmentSelector = ({ value, onChange, label }: { value: AlignmentOption; onChange: (v: AlignmentOption) => void; label: string; }) => (
  <div className="space-y-2">
    <Label className="text-xs">{label}</Label>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as AlignmentOption)} className="flex gap-2">
      {['right', 'center', 'left'].map((align) => (
        <div key={align} className="flex items-center">
          <RadioGroupItem value={align} id={`${label}-${align}`} className="sr-only" />
          <Label htmlFor={`${label}-${align}`}
            className={`flex items-center justify-center w-8 h-8 rounded border cursor-pointer transition-colors
              ${value === align ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
            {align === 'right' ? <AlignRight className="h-3 w-3" /> : align === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
          </Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

export function IndividualSettingsEditor({ settings, onSettingsChange, templateName, templateType = 'contract' }: Props) {
  const update = (key: keyof IndividualInvoiceSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const hasSec = (section: string) => hasSection(templateType, section as any);

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      <div className="text-center py-2 bg-muted/50 rounded-lg mb-4">
        <p className="text-sm font-medium">{templateName}</p>
        <p className="text-xs text-muted-foreground">إعدادات خاصة بهذه الفاتورة</p>
      </div>

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="colors" className="text-xs gap-1 px-1"><Palette className="h-3 w-3" />ألوان</TabsTrigger>
          <TabsTrigger value="sections" className="text-xs gap-1 px-1"><Type className="h-3 w-3" />أقسام</TabsTrigger>
          <TabsTrigger value="table" className="text-xs gap-1 px-1"><Table className="h-3 w-3" />جدول</TabsTrigger>
          <TabsTrigger value="extras" className="text-xs gap-1 px-1"><FileText className="h-3 w-3" />إضافي</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">الألوان الرئيسية</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <ColorInput label="اللون الأساسي" value={settings.primaryColor} onChange={(v) => update('primaryColor', v)} />
              <ColorInput label="اللون الثانوي" value={settings.secondaryColor} onChange={(v) => update('secondaryColor', v)} />
              <ColorInput label="لون التمييز" value={settings.accentColor} onChange={(v) => update('accentColor', v)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">أحجام الخطوط</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SliderInput label="حجم العنوان" value={settings.titleFontSize} onChange={(v) => update('titleFontSize', v)} min={12} max={48} />
              <SliderInput label="حجم الترويسة" value={settings.headerFontSize} onChange={(v) => update('headerFontSize', v)} min={8} max={24} />
              <SliderInput label="حجم النص" value={settings.bodyFontSize} onChange={(v) => update('bodyFontSize', v)} min={8} max={20} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">إظهار/إخفاء الأقسام</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between"><Label className="text-sm">الهيدر</Label><Switch checked={settings.showHeader} onCheckedChange={(v) => update('showHeader', v)} /></div>
              {hasSec('customer') && <div className="flex items-center justify-between"><Label className="text-sm">بيانات العميل</Label><Switch checked={settings.showCustomerSection} onCheckedChange={(v) => update('showCustomerSection', v)} /></div>}
              {hasSec('billboards') && <div className="flex items-center justify-between"><Label className="text-sm">اللوحات</Label><Switch checked={settings.showBillboardsSection} onCheckedChange={(v) => update('showBillboardsSection', v)} /></div>}
              {hasSec('items') && <div className="flex items-center justify-between"><Label className="text-sm">العناصر</Label><Switch checked={settings.showItemsSection} onCheckedChange={(v) => update('showItemsSection', v)} /></div>}
              {hasSec('services') && <div className="flex items-center justify-between"><Label className="text-sm">الخدمات</Label><Switch checked={settings.showServicesSection} onCheckedChange={(v) => update('showServicesSection', v)} /></div>}
              {hasSec('transactions') && <div className="flex items-center justify-between"><Label className="text-sm">الحركات المالية</Label><Switch checked={settings.showTransactionsSection} onCheckedChange={(v) => update('showTransactionsSection', v)} /></div>}
              {hasSec('totals') && <div className="flex items-center justify-between"><Label className="text-sm">المجاميع</Label><Switch checked={settings.showTotalsSection} onCheckedChange={(v) => update('showTotalsSection', v)} /></div>}
              {hasSec('payment_info') && <div className="flex items-center justify-between"><Label className="text-sm">معلومات الدفع</Label><Switch checked={settings.showPaymentInfoSection} onCheckedChange={(v) => update('showPaymentInfoSection', v)} /></div>}
              {hasSec('team_info') && <div className="flex items-center justify-between"><Label className="text-sm">معلومات الفريق</Label><Switch checked={settings.showTeamInfoSection} onCheckedChange={(v) => update('showTeamInfoSection', v)} /></div>}
              {hasSec('custody_info') && <div className="flex items-center justify-between"><Label className="text-sm">معلومات العهدة</Label><Switch checked={settings.showCustodyInfoSection} onCheckedChange={(v) => update('showCustodyInfoSection', v)} /></div>}
              {hasSec('balance_summary') && <div className="flex items-center justify-between"><Label className="text-sm">ملخص الرصيد</Label><Switch checked={settings.showBalanceSummarySection} onCheckedChange={(v) => update('showBalanceSummarySection', v)} /></div>}
              {hasSec('signatures') && <div className="flex items-center justify-between"><Label className="text-sm">التوقيعات</Label><Switch checked={settings.showSignaturesSection} onCheckedChange={(v) => update('showSignaturesSection', v)} /></div>}
              {hasSec('notes') && <div className="flex items-center justify-between"><Label className="text-sm">الملاحظات</Label><Switch checked={settings.showNotesSection} onCheckedChange={(v) => update('showNotesSection', v)} /></div>}
            </CardContent>
          </Card>

          {hasSec('customer') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />قسم العميل</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="الخلفية" value={settings.customerSectionBgColor} onChange={(v) => update('customerSectionBgColor', v)} />
                  <ColorInput label="الحدود" value={settings.customerSectionBorderColor} onChange={(v) => update('customerSectionBorderColor', v)} />
                  <ColorInput label="العنوان" value={settings.customerSectionTitleColor} onChange={(v) => update('customerSectionTitleColor', v)} />
                  <ColorInput label="النص" value={settings.customerSectionTextColor} onChange={(v) => update('customerSectionTextColor', v)} />
                </div>
                <AlignmentSelector label="المحاذاة" value={settings.customerSectionAlignment} onChange={(v) => update('customerSectionAlignment', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('payment_info') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />قسم الدفع</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.paymentSectionBgColor} onChange={(v) => update('paymentSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.paymentSectionBorderColor} onChange={(v) => update('paymentSectionBorderColor', v)} />
                <ColorInput label="العنوان" value={settings.paymentSectionTitleColor} onChange={(v) => update('paymentSectionTitleColor', v)} />
                <ColorInput label="النص" value={settings.paymentSectionTextColor} onChange={(v) => update('paymentSectionTextColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('team_info') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />قسم الفريق</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.teamSectionBgColor} onChange={(v) => update('teamSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.teamSectionBorderColor} onChange={(v) => update('teamSectionBorderColor', v)} />
                <ColorInput label="العنوان" value={settings.teamSectionTitleColor} onChange={(v) => update('teamSectionTitleColor', v)} />
                <ColorInput label="النص" value={settings.teamSectionTextColor} onChange={(v) => update('teamSectionTextColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('custody_info') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />قسم العهدة</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.custodySectionBgColor} onChange={(v) => update('custodySectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.custodySectionBorderColor} onChange={(v) => update('custodySectionBorderColor', v)} />
                <ColorInput label="العنوان" value={settings.custodySectionTitleColor} onChange={(v) => update('custodySectionTitleColor', v)} />
                <ColorInput label="النص" value={settings.custodySectionTextColor} onChange={(v) => update('custodySectionTextColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('balance_summary') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" />ملخص الرصيد</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.balanceSummaryBgColor} onChange={(v) => update('balanceSummaryBgColor', v)} />
                <ColorInput label="الحدود" value={settings.balanceSummaryBorderColor} onChange={(v) => update('balanceSummaryBorderColor', v)} />
                <ColorInput label="العنوان" value={settings.balanceSummaryTitleColor} onChange={(v) => update('balanceSummaryTitleColor', v)} />
                <ColorInput label="النص" value={settings.balanceSummaryTextColor} onChange={(v) => update('balanceSummaryTextColor', v)} />
                <ColorInput label="لون الموجب" value={settings.balanceSummaryPositiveColor} onChange={(v) => update('balanceSummaryPositiveColor', v)} />
                <ColorInput label="لون السالب" value={settings.balanceSummaryNegativeColor} onChange={(v) => update('balanceSummaryNegativeColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('transactions') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />قسم الحركات المالية</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.transactionsSectionBgColor} onChange={(v) => update('transactionsSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.transactionsSectionBorderColor} onChange={(v) => update('transactionsSectionBorderColor', v)} />
                <ColorInput label="العنوان" value={settings.transactionsSectionTitleColor} onChange={(v) => update('transactionsSectionTitleColor', v)} />
                <ColorInput label="النص" value={settings.transactionsSectionTextColor} onChange={(v) => update('transactionsSectionTextColor', v)} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">ألوان الجدول</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <ColorInput label="الحدود" value={settings.tableBorderColor} onChange={(v) => update('tableBorderColor', v)} />
              <ColorInput label="خلفية الترويسة" value={settings.tableHeaderBgColor} onChange={(v) => update('tableHeaderBgColor', v)} />
              <ColorInput label="نص الترويسة" value={settings.tableHeaderTextColor} onChange={(v) => update('tableHeaderTextColor', v)} />
              <ColorInput label="لون النص" value={settings.tableTextColor} onChange={(v) => update('tableTextColor', v)} />
              <ColorInput label="صف زوجي" value={settings.tableRowEvenColor} onChange={(v) => update('tableRowEvenColor', v)} />
              <ColorInput label="صف فردي" value={settings.tableRowOddColor} onChange={(v) => update('tableRowOddColor', v)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">شفافية الصفوف</CardTitle></CardHeader>
            <CardContent>
              <SliderInput label="شفافية صفوف الجدول" value={settings.tableRowOpacity} onChange={(v) => update('tableRowOpacity', v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extras" className="space-y-4">
          {hasSec('totals') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />المجاميع</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="خلفية الفرعي" value={settings.subtotalBgColor} onChange={(v) => update('subtotalBgColor', v)} />
                  <ColorInput label="نص الفرعي" value={settings.subtotalTextColor} onChange={(v) => update('subtotalTextColor', v)} />
                  <ColorInput label="لون الخصم" value={settings.discountTextColor} onChange={(v) => update('discountTextColor', v)} />
                  <ColorInput label="خلفية الإجمالي" value={settings.totalBgColor} onChange={(v) => update('totalBgColor', v)} />
                  <ColorInput label="نص الإجمالي" value={settings.totalTextColor} onChange={(v) => update('totalTextColor', v)} />
                </div>
                <AlignmentSelector label="محاذاة المجاميع" value={settings.totalsAlignment} onChange={(v) => update('totalsAlignment', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('notes') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />الملاحظات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="الخلفية" value={settings.notesBgColor} onChange={(v) => update('notesBgColor', v)} />
                  <ColorInput label="النص" value={settings.notesTextColor} onChange={(v) => update('notesTextColor', v)} />
                  <ColorInput label="الحدود" value={settings.notesBorderColor} onChange={(v) => update('notesBorderColor', v)} />
                </div>
                <AlignmentSelector label="المحاذاة" value={settings.notesAlignment} onChange={(v) => update('notesAlignment', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('signatures') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><PenTool className="h-4 w-4" />التوقيعات</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.signaturesSectionBgColor} onChange={(v) => update('signaturesSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.signaturesSectionBorderColor} onChange={(v) => update('signaturesSectionBorderColor', v)} />
                <ColorInput label="النص" value={settings.signaturesSectionTextColor} onChange={(v) => update('signaturesSectionTextColor', v)} />
                <ColorInput label="خط التوقيع" value={settings.signatureLineColor} onChange={(v) => update('signatureLineColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('billboards') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Image className="h-4 w-4" />قسم اللوحات</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.billboardsSectionBgColor} onChange={(v) => update('billboardsSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.billboardsSectionBorderColor} onChange={(v) => update('billboardsSectionBorderColor', v)} />
                <ColorInput label="لون العنوان" value={settings.billboardsSectionTitleColor} onChange={(v) => update('billboardsSectionTitleColor', v)} />
              </CardContent>
            </Card>
          )}

          {hasSec('services') && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" />قسم الخدمات</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ColorInput label="الخلفية" value={settings.servicesSectionBgColor} onChange={(v) => update('servicesSectionBgColor', v)} />
                <ColorInput label="الحدود" value={settings.servicesSectionBorderColor} onChange={(v) => update('servicesSectionBorderColor', v)} />
                <ColorInput label="لون العنوان" value={settings.servicesSectionTitleColor} onChange={(v) => update('servicesSectionTitleColor', v)} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
