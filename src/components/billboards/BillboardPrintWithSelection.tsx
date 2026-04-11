import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Printer, CheckSquare, Image as ImageIcon, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { renderAllBillboardsTablePagesPreviewLike, BillboardRowData } from '@/lib/contractTableRenderer';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';

interface BillboardPrintWithSelectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
  /** Optional: hide price column */
  hidePrice?: boolean;
  /** Optional: partner name to show in header */
  partnerName?: string;
  /** Optional: size summary for header e.g. [["3x4", 12], ["3x6", 8]] */
  sizeSummary?: [string, number][];
}

const AVAILABLE_BACKGROUNDS = [
  { id: 'template', name: 'من إعدادات القالب', url: 'template' },
  { id: 'bgc1', name: 'خلفية 1', url: '/bgc1.svg' },
  { id: 'bgc2', name: 'خلفية 2 (جدول)', url: '/bgc2.svg' },
  { id: 'mt1', name: 'خلفية جدول اللوحات', url: '/mt1.svg' },
  { id: 'ipg', name: 'خلفية قائمة الأسعار', url: '/ipg.svg' },
  { id: 'none', name: 'بدون خلفية', url: 'none' },
];

export const BillboardPrintWithSelection: React.FC<BillboardPrintWithSelectionProps> = ({
  open,
  onOpenChange,
  billboards,
  isContractExpired,
  hidePrice = false,
  partnerName,
  sizeSummary,
}) => {
  // Load persisted settings from localStorage
  const loadSaved = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(`billboard_print_${key}`);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(() => {
    const saved = loadSaved<number[]>('selectedIds', []);
    return new Set(saved);
  });
  const [selectAll, setSelectAll] = useState(false);
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom' | 'none'>(() => loadSaved('backgroundType', 'preset'));
  const [selectedBackground, setSelectedBackground] = useState(() => loadSaved('selectedBackground', 'template'));
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState(() => loadSaved('customBackgroundUrl', ''));
  const [showLogo, setShowLogo] = useState(() => loadSaved('showLogo', true));
  const [showTableTerm, setShowTableTerm] = useState(() => loadSaved('showTableTerm', false));
  const [activeTab, setActiveTab] = useState('selection');
  const [isPrinting, setIsPrinting] = useState(false);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('billboard_print_backgroundType', JSON.stringify(backgroundType));
  }, [backgroundType]);
  useEffect(() => {
    localStorage.setItem('billboard_print_selectedBackground', JSON.stringify(selectedBackground));
  }, [selectedBackground]);
  useEffect(() => {
    localStorage.setItem('billboard_print_customBackgroundUrl', JSON.stringify(customBackgroundUrl));
  }, [customBackgroundUrl]);
  useEffect(() => {
    localStorage.setItem('billboard_print_showLogo', JSON.stringify(showLogo));
  }, [showLogo]);
  useEffect(() => {
    localStorage.setItem('billboard_print_showTableTerm', JSON.stringify(showTableTerm));
  }, [showTableTerm]);
  useEffect(() => {
    localStorage.setItem('billboard_print_selectedIds', JSON.stringify([...selectedBillboardIds]));
  }, [selectedBillboardIds]);

  // ✅ استخدام نفس hooks المستخدمة في BillboardSelectionBar
  const { data: templateData, isLoading: templateLoading } = useContractTemplateSettings();
  const { printMultiplePages } = useContractPrint();
  
  // الإعدادات المدمجة من القالب
  const settings = useMemo(() => {
    return templateData?.settings || DEFAULT_SECTION_SETTINGS;
  }, [templateData]);
  
  const templateTableBackgroundUrl = useMemo(() => {
    return templateData?.tableBackgroundUrl || '/bgc2.svg';
  }, [templateData]);

  const getBackgroundUrl = (): string => {
    if (backgroundType === 'none') return '';
    if (backgroundType === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    if (selectedBackground === 'template') {
      return templateTableBackgroundUrl;
    }
    return selectedBackground === 'none' ? '' : selectedBackground;
  };

  // تحويل اللوحات للتنسيق المطلوب - نفس التنسيق المستخدم في طباعة العقد
  const prepareBillboardsData = (billboardsList: any[]): BillboardRowData[] => {
    return billboardsList.map((b) => ({
      id: String(b.ID || b.id || ''),
      billboardName: b.Billboard_Name || b.billboard_name || '',
      image: b.Image_URL || b.image_url || '',
      municipality: b.Municipality || b.municipality || '',
      district: b.District || b.district || '',
      landmark: b.Nearest_Landmark || b.nearest_landmark || '',
      size: b.Size || b.size || '',
      level: b.Level || b.level || '',
      faces: b.Faces_Count || b.faces_count || b.faces || '1',
      price: hidePrice ? '' : (b.Price ? `${Number(b.Price).toLocaleString()}` : ''),
      rent_end_date: b.Rent_End_Date || b.rent_end_date || '',
      mapLink: b.GPS_Link || b.GPS_Coordinates 
        ? `https://www.google.com/maps?q=${b.GPS_Coordinates || ''}` 
        : '',
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedBillboardIds(new Set(billboards.map(b => b.ID || b.id)));
    } else {
      setSelectedBillboardIds(new Set());
    }
  };

  const toggleBillboardSelection = (id: number) => {
    const newSet = new Set(selectedBillboardIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBillboardIds(newSet);
    setSelectAll(newSet.size === billboards.length);
  };

  // ✅ طريقة الطباعة الموحدة - نفس المستخدمة في BillboardSelectionBar
  const handlePrint = async () => {
    if (selectedBillboardIds.size === 0) {
      toast.error('يرجى اختيار لوحة واحدة على الأقل للطباعة');
      return;
    }

    setIsPrinting(true);

    try {
      const selectedBillboards = billboards.filter(b => 
        selectedBillboardIds.has(b.ID || b.id)
      );

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
        title: `طباعة اللوحات${partnerName ? ` - ${partnerName}` : ''} - ${selectedBillboards.length} لوحة${sizeSummary && sizeSummary.length > 0 ? ` | ${sizeSummary.map(([s, c]) => `${s}(${c})`).join(' - ')}` : ''}`,
        designWidth: 2480,
        designHeight: 3508,
      });

      toast.success(`تم تحضير ${selectedBillboards.length} لوحة للطباعة`);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-base leading-relaxed">
            <div className="flex items-center gap-2 mb-1">
              <Printer className="h-5 w-5 shrink-0" />
              <span>طباعة اللوحات</span>
              {partnerName && (
                <Badge variant="default" className="text-sm px-3 py-1 shadow-sm">{partnerName}</Badge>
              )}
              <span className="text-sm font-normal text-muted-foreground">({billboards.length} لوحة)</span>
            </div>
            {sizeSummary && sizeSummary.length > 0 && (
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {sizeSummary.map(([size, count]) => `${size} (${count})`).join(' • ')}
              </p>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden mt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selection" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              اختيار اللوحات
              {selectedBillboardIds.size > 0 && (
                <Badge variant="secondary" className="mr-1">{selectedBillboardIds.size}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              إعدادات الطباعة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selection" className="flex-1 overflow-hidden mt-4">
            <div className="space-y-3 h-full flex flex-col">
              {/* Select All bar */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectAll} 
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                  />
                  <Label htmlFor="select-all" className="font-medium text-sm">
                    تحديد الكل ({billboards.length})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedBillboardIds.size === billboards.length ? "default" : "outline"} className="text-xs">
                    {selectedBillboardIds.size} / {billboards.length}
                  </Badge>
                </div>
              </div>

              {/* Billboard List */}
              <ScrollArea className="flex-1 border rounded-xl">
                <div className="p-1.5 space-y-1">
                  {billboards.map((billboard) => {
                    const id = billboard.ID || billboard.id;
                    const isSelected = selectedBillboardIds.has(id);
                    
                    return (
                      <div 
                        key={id}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all text-sm",
                          isSelected 
                            ? "bg-primary/8 border border-primary/20" 
                            : "hover:bg-muted/50 border border-transparent"
                        )}
                        onClick={() => toggleBillboardSelection(id)}
                      >
                        <Checkbox checked={isSelected} className="shrink-0" />
                        <span className="font-medium truncate flex-1 min-w-0">
                          {billboard.Billboard_Name || billboard.billboard_name || `لوحة ${id}`}
                        </span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {billboard.Municipality || billboard.municipality}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {billboard.Size || billboard.size}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto mt-4">
            <div className="space-y-5 py-2">
              {/* رسالة الربط بإعدادات القالب */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <Settings className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">مرتبط بإعدادات قالب العقد</p>
                  <p className="text-xs text-muted-foreground">
                    أي تغييرات في إعدادات الجدول ستنعكس هنا تلقائياً
                  </p>
                </div>
                {templateLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>

              {/* اختيار نوع الخلفية */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">نوع الخلفية</Label>
                <Select value={backgroundType} onValueChange={(v) => setBackgroundType(v as 'preset' | 'custom' | 'none')}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الخلفية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">خلفية جاهزة</SelectItem>
                    <SelectItem value="custom">رابط مخصص</SelectItem>
                    <SelectItem value="none">بدون خلفية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* اختيار الخلفية الجاهزة */}
              {backgroundType === 'preset' && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">الخلفية</Label>
                  <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الخلفية" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_BACKGROUNDS.map(bg => (
                        <SelectItem key={bg.id} value={bg.url}>
                          <div className="flex items-center gap-2">
                            {bg.id === 'template' ? (
                              <Settings className="h-4 w-4" />
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                            {bg.name}
                            {bg.id === 'template' && (
                              <Badge variant="secondary" className="text-xs mr-2">موصى به</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBackground === 'template' && (
                    <p className="text-xs text-muted-foreground">
                      سيتم استخدام الخلفية المحددة في إعدادات قالب العقد: {templateTableBackgroundUrl}
                    </p>
                  )}
                </div>
              )}

              {/* رابط خلفية مخصص */}
              {backgroundType === 'custom' && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">رابط الخلفية المخصصة</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com/background.svg"
                    value={customBackgroundUrl}
                    onChange={(e) => setCustomBackgroundUrl(e.target.value)}
                    dir="ltr"
                  />
                </div>
              )}

              {/* عرض الشعار */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-base cursor-pointer">عرض شعار الشركة</Label>
                </div>
                <Switch checked={showLogo} onCheckedChange={setShowLogo} />
              </div>

              {/* عرض عنوان البند الثامن */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-base cursor-pointer">عرض عنوان البند (البند الثامن)</Label>
                </div>
                <Switch checked={showTableTerm} onCheckedChange={setShowTableTerm} />
              </div>

              {/* معلومات إعدادات الجدول */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                <p className="text-sm font-medium">إعدادات الجدول الحالية:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>عدد الصفوف: {settings.tableSettings?.maxRows || 12}</span>
                  <span>ارتفاع الصف: {settings.tableSettings?.rowHeight || 12}mm</span>
                  <span>عرض الجدول: {settings.tableSettings?.tableWidth || 90}%</span>
                  <span>حجم الخط: {settings.tableSettings?.fontSize || 10}px</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* أزرار الإجراءات */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button 
            onClick={handlePrint} 
            disabled={isPrinting || templateLoading || selectedBillboardIds.size === 0}
            className="gap-2"
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التحضير...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                طباعة ({selectedBillboardIds.size} لوحة)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillboardPrintWithSelection;
