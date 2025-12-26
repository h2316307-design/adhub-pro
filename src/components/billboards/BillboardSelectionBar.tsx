import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Printer, CheckSquare, Square, Loader2, Image as ImageIcon, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { renderAllBillboardsTablePagesPreviewLike, BillboardRowData } from '@/lib/contractTableRenderer';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';

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

export const BillboardSelectionBar: React.FC<BillboardSelectionBarProps> = ({
  selectedBillboards,
  filteredBillboards,
  onClearSelection,
  onSelectAll,
  isAllSelected
}) => {
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [showTableTerm, setShowTableTerm] = useState(false); // إخفاء "البند الثامن" افتراضياً
  const [selectedBackground, setSelectedBackground] = useState('template');
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('');
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom'>('preset');
  
  // ✅ استخدام useContractTemplateSettings hook مباشرة - مرتبط بإعدادات قالب العقد
  const { data: templateData, isLoading: templateLoading } = useContractTemplateSettings();
  
  // الإعدادات المدمجة من القالب
  const settings = useMemo(() => {
    return templateData?.settings || DEFAULT_SECTION_SETTINGS;
  }, [templateData]);
  
  const templateTableBackgroundUrl = useMemo(() => {
    return templateData?.tableBackgroundUrl || '/bgc2.svg';
  }, [templateData]);

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
      image: b.Image_URL || b.image_url || '',
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
        showTableTerm // تمرير خيار إظهار/إخفاء البند الثامن
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

      {/* نافذة إعدادات الطباعة */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              طباعة اللوحات ({selectedBillboards.length} لوحة)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* رسالة الربط بإعدادات القالب */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
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
              <Select value={backgroundType} onValueChange={(v) => setBackgroundType(v as 'preset' | 'custom')}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الخلفية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">خلفية جاهزة</SelectItem>
                  <SelectItem value="custom">رابط مخصص</SelectItem>
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

            {/* معاينة اللوحات المختارة */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">اللوحات المختارة للطباعة</Label>
              <ScrollArea className="h-40 rounded-lg border p-3">
                <div className="space-y-2">
                  {selectedBillboards.map((b, idx) => (
                    <div key={b.ID || idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm font-medium">
                        {b.Billboard_Name || b.ID || `لوحة ${idx + 1}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {b.Size || b.size || 'غير محدد'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={isPrinting || templateLoading}
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
                  طباعة
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
