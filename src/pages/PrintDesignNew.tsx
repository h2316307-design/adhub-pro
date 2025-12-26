import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Loader2, ZoomIn, ZoomOut, Maximize2, Settings2, FileText, Copy, RotateCcw, Database, FileQuestion, RefreshCw, Printer, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  InvoiceTypeSelector, 
  SharedSettingsEditor,
  IndividualSettingsEditor,
  UnifiedInvoicePreview
} from '@/components/print-design';
import { clearInvoiceSettingsCache as clearTemplateCache } from '@/hooks/useInvoiceTemplateSettings';
import { clearInvoiceSettingsCache as clearSyncCache } from '@/hooks/useInvoiceSettingsSync';
import { useRealInvoiceData, useInvoiceList } from '@/hooks/useRealInvoiceData';
import { 
  InvoiceTemplateType,
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
  INVOICE_TEMPLATES
} from '@/types/invoice-templates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SETTINGS_KEY = 'unified_invoice_templates_settings';

export default function PrintDesignNew() {
  const [selectedType, setSelectedType] = useState<InvoiceTemplateType>('contract');
  const [sharedSettings, setSharedSettings] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individualSettings, setIndividualSettings] = useState<Record<InvoiceTemplateType, IndividualInvoiceSettings>>({} as any);
  const [settingsTab, setSettingsTab] = useState<'shared' | 'individual'>('shared');
  const [previewScale, setPreviewScale] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | undefined>(undefined);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const { data: invoiceList, isLoading: isLoadingList } = useInvoiceList(selectedType, useRealData);
  const { data: realData, isLoading: isLoadingRealData, refetch: refetchRealData } = useRealInvoiceData(selectedType, useRealData, selectedInvoiceId);
  
  // Reset selected invoice when type changes
  useEffect(() => {
    setSelectedInvoiceId(undefined);
  }, [selectedType]);

  const handlePrint = () => {
    if (!previewRef.current) return;
    
    const printContent = previewRef.current.querySelector('[data-print-content]');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل في فتح نافذة الطباعة');
      return;
    }
    
    const styles = `
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; direction: rtl; }
        @font-face {
          font-family: 'Doran';
          src: url('/Doran-Regular.otf') format('opentype');
        }
        @font-face {
          font-family: 'Manrope';
          src: url('/Manrope-Regular.otf') format('opentype');
        }
      </style>
    `;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>طباعة الفاتورة</title>
          ${styles}
        </head>
        <body>
          ${(printContent as HTMLElement).outerHTML.replace(/transform:[^;]+;?/g, '').replace(/transform-origin:[^;]+;?/g, '')}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Initialize settings for all template types
  useEffect(() => {
    const initIndividual: Record<string, IndividualInvoiceSettings> = {};
    INVOICE_TEMPLATES.forEach(t => {
      initIndividual[t.id] = { ...DEFAULT_INDIVIDUAL_SETTINGS };
    });
    
    // Load saved settings
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', SETTINGS_KEY)
          .single();

        if (data?.setting_value) {
          const saved: AllInvoiceSettings = JSON.parse(data.setting_value);
          if (saved.shared) {
            setSharedSettings({ ...DEFAULT_SHARED_SETTINGS, ...saved.shared });
          }
          if (saved.individual) {
            Object.keys(saved.individual).forEach(key => {
              if (initIndividual[key]) {
                initIndividual[key] = { ...initIndividual[key], ...saved.individual[key as InvoiceTemplateType] };
              }
            });
          }
        }
      } catch (e) {
        console.log('No saved settings found, using defaults');
      }
      setIndividualSettings(initIndividual as Record<InvoiceTemplateType, IndividualInvoiceSettings>);
      setIsLoading(false);
    };

    loadSettings();
  }, []);

  const currentIndividualSettings = individualSettings[selectedType] || DEFAULT_INDIVIDUAL_SETTINGS;

  const handleIndividualSettingsChange = (newSettings: IndividualInvoiceSettings) => {
    setIndividualSettings(prev => ({
      ...prev,
      [selectedType]: newSettings
    }));
  };

  const handleApplyToAll = () => {
    const currentSettings = individualSettings[selectedType];
    const updated: Record<string, IndividualInvoiceSettings> = {};
    INVOICE_TEMPLATES.forEach(t => {
      updated[t.id] = { ...currentSettings };
    });
    setIndividualSettings(updated as Record<InvoiceTemplateType, IndividualInvoiceSettings>);
    toast.success('تم تطبيق الإعدادات على جميع الفواتير');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const allSettings: AllInvoiceSettings = {
        shared: sharedSettings,
        individual: individualSettings,
      };

      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', SETTINGS_KEY)
        .single();

      if (existing) {
        await supabase
          .from('system_settings')
          .update({ 
            setting_value: JSON.stringify(allSettings), 
            updated_at: new Date().toISOString() 
          })
          .eq('setting_key', SETTINGS_KEY);
      } else {
        await supabase
          .from('system_settings')
          .insert({ 
            setting_key: SETTINGS_KEY, 
            setting_value: JSON.stringify(allSettings), 
            setting_type: 'json', 
            description: 'إعدادات قوالب الفواتير الموحدة', 
            category: 'print' 
          });
      }
      // Clear both caches so other components get updated settings
      clearTemplateCache();
      clearSyncCache();
      toast.success('تم حفظ جميع الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل في حفظ الإعدادات');
    }
    setIsSaving(false);
  };

  const handleResetToDefault = () => {
    setSharedSettings(DEFAULT_SHARED_SETTINGS);
    const initIndividual: Record<string, IndividualInvoiceSettings> = {};
    INVOICE_TEMPLATES.forEach(t => {
      initIndividual[t.id] = { ...DEFAULT_INDIVIDUAL_SETTINGS };
    });
    setIndividualSettings(initIndividual as Record<InvoiceTemplateType, IndividualInvoiceSettings>);
    toast.success('تم إعادة الإعدادات للافتراضي');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedTemplate = INVOICE_TEMPLATES.find(t => t.id === selectedType);

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4 p-4">
      {/* Invoice Types Sidebar */}
      <div className="w-64 bg-card rounded-lg border flex flex-col">
        <div className="p-3 border-b bg-muted/30">
          <h2 className="font-bold text-sm">أنواع الفواتير</h2>
          <p className="text-xs text-muted-foreground">اختر نوع الفاتورة</p>
        </div>
        <InvoiceTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
      </div>

      {/* Settings Panel */}
      <div className="w-80 bg-card rounded-lg border flex flex-col">
        <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as any)} className="flex flex-col h-full">
          <div className="p-3 border-b bg-muted/30">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="shared" className="text-xs gap-1">
                <Settings2 className="h-3 w-3" />
                إعدادات موحدة
              </TabsTrigger>
              <TabsTrigger value="individual" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                إعدادات الفاتورة
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-hidden p-3">
            <TabsContent value="shared" className="mt-0 h-full">
              <SharedSettingsEditor 
                settings={sharedSettings} 
                onSettingsChange={setSharedSettings} 
              />
            </TabsContent>
            
            <TabsContent value="individual" className="mt-0 h-full">
              <IndividualSettingsEditor 
                settings={currentIndividualSettings} 
                onSettingsChange={handleIndividualSettingsChange}
                templateName={selectedTemplate?.name || ''}
                templateType={selectedType}
              />
            </TabsContent>
          </div>
          
          <div className="p-3 border-t space-y-2">
            {settingsTab === 'individual' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-xs" size="sm">
                    <Copy className="ml-2 h-3 w-3" />
                    تطبيق على جميع الفواتير
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تطبيق الإعدادات على الكل؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم نسخ إعدادات "{selectedTemplate?.name}" إلى جميع أنواع الفواتير الأخرى.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApplyToAll}>تطبيق</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
              حفظ جميع الإعدادات
            </Button>
          </div>
        </Tabs>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted/30 rounded-lg border flex flex-col overflow-hidden">
        <div className="p-3 border-b bg-card flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">معاينة</h3>
            <Badge variant="outline">{selectedTemplate?.name}</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Real Data */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
              <FileQuestion className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="real-data" className="text-xs cursor-pointer">بيانات تجريبية</Label>
              <Switch
                id="real-data"
                checked={useRealData}
                onCheckedChange={(checked) => {
                  setUseRealData(checked);
                  if (!checked) setSelectedInvoiceId(undefined);
                }}
                className="scale-75"
              />
              <Label htmlFor="real-data" className="text-xs cursor-pointer">بيانات واقعية</Label>
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            
            {/* Invoice Selector */}
            {useRealData && (
              <Select
                value={selectedInvoiceId || ''}
                onValueChange={(value) => setSelectedInvoiceId(value || undefined)}
              >
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder={isLoadingList ? "جاري التحميل..." : "اختر فاتورة محددة"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="">آخر فاتورة</SelectItem>
                  {invoiceList.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {item.customerName && <span className="text-muted-foreground">{item.customerName}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {useRealData && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => refetchRealData()}
                disabled={isLoadingRealData}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingRealData ? 'animate-spin' : ''}`} />
              </Button>
            )}
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.1))}>
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs font-mono w-10 text-center">{Math.round(previewScale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}>
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(0.5)}>
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Print Button */}
            <Button variant="default" size="sm" onClick={handlePrint} className="gap-1">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
          </div>
        </div>
        <div ref={previewRef} className="flex-1 overflow-auto p-4 flex justify-center">
          {isLoadingRealData ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <UnifiedInvoicePreview 
              templateType={selectedType} 
              sharedSettings={sharedSettings}
              individualSettings={currentIndividualSettings}
              scale={previewScale}
              realData={useRealData ? realData : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}