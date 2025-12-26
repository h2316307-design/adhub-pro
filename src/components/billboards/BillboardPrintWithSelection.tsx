import React, { useState, useEffect } from 'react';
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
import { Printer, CheckSquare, Square, Image as ImageIcon, Link as LinkIcon, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

interface BillboardPrintWithSelectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
}

interface TableSettings {
  topPosition: number;
  leftPosition: number;
  rightPosition: number;
  tableWidth: number;
  rowHeight: number;
  headerRowHeight: number;
  maxRows: number;
  headerBgColor: string;
  headerTextColor: string;
  borderColor: string;
  borderWidth: number;
  alternateRowColor: string;
  fontSize: number;
  headerFontSize: number;
  fontWeight: string;
  headerFontWeight: string;
  cellTextAlign: 'right' | 'center' | 'left';
  headerTextAlign: 'right' | 'center' | 'left';
  columns: any[];
  highlightedColumns: string[];
  highlightedColumnBgColor: string;
  highlightedColumnTextColor: string;
  cellTextColor: string;
  cellPadding: number;
  qrForegroundColor: string;
  qrBackgroundColor: string;
}

const DEFAULT_TABLE_SETTINGS: TableSettings = {
  topPosition: 63.53,
  leftPosition: 5,
  rightPosition: 5,
  tableWidth: 90,
  rowHeight: 12,
  headerRowHeight: 14,
  maxRows: 12,
  headerBgColor: '#000000',
  headerTextColor: '#ffffff',
  borderColor: '#000000',
  borderWidth: 1,
  alternateRowColor: '#f5f5f5',
  fontSize: 10,
  headerFontSize: 11,
  fontWeight: 'normal',
  headerFontWeight: 'bold',
  cellTextAlign: 'center',
  headerTextAlign: 'center',
  columns: [],
  highlightedColumns: ['index'],
  highlightedColumnBgColor: '#1a1a2e',
  highlightedColumnTextColor: '#ffffff',
  cellTextColor: '#000000',
  cellPadding: 2,
  qrForegroundColor: '#000000',
  qrBackgroundColor: '#ffffff',
};

const AVAILABLE_BACKGROUNDS = [
  { id: 'bgc1', name: 'خلفية 1', url: '/bgc1.svg' },
  { id: 'bgc2', name: 'خلفية 2 (جدول)', url: '/bgc2.svg' },
  { id: 'mt1', name: 'خلفية جدول اللوحات', url: '/mt1.svg' },
  { id: 'none', name: 'بدون خلفية', url: 'none' },
];

export const BillboardPrintWithSelection: React.FC<BillboardPrintWithSelectionProps> = ({
  open,
  onOpenChange,
  billboards,
  isContractExpired
}) => {
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom'>('preset');
  const [selectedBackground, setSelectedBackground] = useState('/bgc2.svg');
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('');
  const [tableSettings, setTableSettings] = useState<TableSettings>(DEFAULT_TABLE_SETTINGS);
  const [showLogo, setShowLogo] = useState(true);
  const [activeTab, setActiveTab] = useState('selection');

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('contract_template_settings')
          .select('*')
          .eq('setting_key', 'section_positions')
          .single();

        if (data?.setting_value) {
          const settings = data.setting_value as any;
          if (settings.tableSettings) {
            setTableSettings(prev => ({ ...prev, ...settings.tableSettings }));
          }
        }

        // Load table background
        const { data: bgData } = await supabase
          .from('contract_template_settings')
          .select('*')
          .eq('setting_key', 'table_background_url')
          .single();

        if (bgData?.setting_value) {
          setSelectedBackground(String(bgData.setting_value));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    if (open) {
      loadSettings();
    }
  }, [open]);

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

  const getBackgroundUrl = () => {
    if (backgroundType === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    return selectedBackground === 'none' ? '' : selectedBackground;
  };

  const getFacesText = (faces: number): string => {
    switch(faces) {
      case 1: return 'وجه واحد';
      case 2: return 'وجهين';
      case 3: return 'ثلاثة أوجه';
      case 4: return 'أربعة أوجه';
      default: return `${faces} أوجه`;
    }
  };

  const printSelectedBillboards = async () => {
    if (selectedBillboardIds.size === 0) {
      toast.error('يرجى اختيار لوحة واحدة على الأقل للطباعة');
      return;
    }

    try {
      const selectedBillboards = billboards.filter(b => 
        selectedBillboardIds.has(b.ID || b.id)
      );

      const bgUrl = getBackgroundUrl();
      const ts = tableSettings;

      // Normalize billboard data
      const normalized = selectedBillboards.map((b, index) => {
        const id = String(b.ID ?? b.id ?? '');
        const code = b.Billboard_Name || `لوحة ${id}`;
        const name = b.Nearest_Landmark || b.nearest_landmark || b.Location || '';
        const imageName = b.image_name || b.Image_Name;
        const imageUrl = b.Image_URL || b.image || b.billboard_image;
        const image = imageName ? `/image/${imageName}` : (imageUrl || '');
        const municipality = String(b.Municipality ?? b.municipality ?? '');
        const district = String(b.District ?? b.district ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const faces = b.Faces_Count ?? b.faces_count ?? b.faces ?? 1;
        let coords = String(b.GPS_Coordinates ?? b.gps_coordinates ?? '');
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        
        return { 
          index: index + 1, 
          id, 
          code, 
          name, 
          image, 
          municipality, 
          district, 
          size, 
          faces: getFacesText(Number(faces)), 
          mapLink,
          gps: coords
        };
      });

      // Generate QR codes
      const qrCodes: { [key: string]: string } = {};
      for (const b of normalized) {
        if (b.mapLink) {
          try {
            qrCodes[b.id] = await QRCode.toDataURL(b.mapLink, {
              width: 100,
              margin: 0,
              color: {
                dark: ts.qrForegroundColor || '#000000',
                light: ts.qrBackgroundColor || '#ffffff',
              },
              errorCorrectionLevel: 'M',
            });
          } catch (e) {
            console.error('QR Error:', e);
          }
        }
      }

      // Calculate pages
      const rowsPerPage = ts.maxRows || 12;
      const pages: any[][] = [];
      for (let i = 0; i < normalized.length; i += rowsPerPage) {
        pages.push(normalized.slice(i, i + rowsPerPage));
      }

      // Build visible columns
      const defaultColumns = [
        { key: 'index', label: '#', visible: true },
        { key: 'image', label: 'الصورة', visible: true },
        { key: 'code', label: 'الكود', visible: true },
        { key: 'municipality', label: 'البلدية', visible: true },
        { key: 'district', label: 'المنطقة', visible: true },
        { key: 'name', label: 'الموقع', visible: true },
        { key: 'size', label: 'المقاس', visible: true },
        { key: 'faces', label: 'الأوجه', visible: true },
        { key: 'location', label: 'GPS', visible: true },
      ];
      
      const columns = (ts.columns?.length ? ts.columns : defaultColumns).filter((c: any) => c.visible !== false);
      const highlighted = new Set(ts.highlightedColumns || ['index']);

      const generateTableHTML = (pageRows: any[]) => {
        const headerCells = columns.map((col: any) => `
          <th style="
            background: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='100%' height='100%' fill='${ts.headerBgColor}'/></svg>`)}');
            color: ${ts.headerTextColor};
            font-size: ${ts.headerFontSize || 11}px;
            font-weight: ${ts.headerFontWeight || 'bold'};
            text-align: ${ts.headerTextAlign || 'center'};
            padding: ${ts.cellPadding || 2}mm;
            border: ${ts.borderWidth || 1}px solid ${ts.borderColor};
          ">${col.label}</th>
        `).join('');

        const rows = pageRows.map((row, rowIdx) => {
          const isAlternate = rowIdx % 2 === 1;
          const rowBg = isAlternate ? ts.alternateRowColor : '#ffffff';
          
          const cells = columns.map((col: any) => {
            const isHighlighted = highlighted.has(col.key);
            const cellBg = isHighlighted ? ts.highlightedColumnBgColor : rowBg;
            const cellColor = isHighlighted ? ts.highlightedColumnTextColor : ts.cellTextColor;
            
            let content = '';
            if (col.key === 'index') {
              content = String(row.index);
            } else if (col.key === 'image') {
              content = row.image ? `<img src="${row.image}" style="max-width: 40px; max-height: 40px; object-fit: contain;" onerror="this.style.display='none'" />` : '';
            } else if (col.key === 'location') {
              content = qrCodes[row.id] ? `<img src="${qrCodes[row.id]}" style="width: 35px; height: 35px;" />` : '';
            } else {
              content = row[col.key] || '';
            }

            return `<td style="
              background: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='100%' height='100%' fill='${cellBg}'/></svg>`)}');
              color: ${cellColor};
              font-size: ${ts.fontSize || 10}px;
              font-weight: ${ts.fontWeight || 'normal'};
              text-align: ${ts.cellTextAlign || 'center'};
              padding: ${ts.cellPadding || 2}mm;
              border: ${ts.borderWidth || 1}px solid ${ts.borderColor};
              height: ${ts.rowHeight || 12}mm;
              vertical-align: middle;
            ">${content}</td>`;
          }).join('');

          return `<tr>${cells}</tr>`;
        }).join('');

        return `
          <table style="
            width: 100%;
            border-collapse: collapse;
            font-family: 'Doran', 'Noto Sans Arabic', sans-serif;
          ">
            <thead>
              <tr style="height: ${ts.headerRowHeight || 14}mm;">
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      };

      const pagesHTML = pages.map((pageRows) => `
        <div class="page" style="
          position: relative;
          width: 210mm;
          height: 297mm;
          page-break-after: always;
          overflow: hidden;
        ">
          ${bgUrl ? `<img src="${bgUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1;" onerror="console.warn('Failed to load background')" />` : ''}
          ${showLogo ? `<img src="/logofares.svg" style="position: absolute; top: 8mm; left: 12mm; width: 60mm; z-index: 15;" />` : ''}
          <div style="
            position: absolute;
            top: ${ts.topPosition}mm;
            left: ${ts.leftPosition}%;
            right: ${ts.rightPosition}%;
            z-index: 20;
          ">
            ${generateTableHTML(pageRows)}
          </div>
        </div>
      `).join('');

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>طباعة اللوحات المختارة</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { font-family: 'Noto Sans Arabic', 'Doran', sans-serif; direction: rtl; }
            @media print {
              html, body { width: 210mm; min-height: 297mm; }
              .page { width: 210mm !important; height: 297mm !important; }
              @page { size: A4; margin: 0; }
              .no-print { display: none !important; }
            }
            .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 100; }
            .controls button { padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
          </style>
        </head>
        <body>
          ${pagesHTML}
          <div class="controls no-print">
            <button onclick="window.print()">طباعة</button>
          </div>
        </body>
        </html>`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('فشل في فتح نافذة الطباعة');
        return;
      }
      
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 800);
      
      toast.success(`تم تحضير ${selectedBillboards.length} لوحة للطباعة`);
      onOpenChange(false);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('فشل في طباعة اللوحات');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            طباعة اللوحات مع خيارات متقدمة
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
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
            <div className="space-y-4 h-full flex flex-col">
              {/* Select All */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectAll} 
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                  />
                  <Label htmlFor="select-all" className="font-medium">
                    تحديد الكل ({billboards.length} لوحة)
                  </Label>
                </div>
                <Badge variant="outline">
                  {selectedBillboardIds.size} محددة
                </Badge>
              </div>

              {/* Billboard List */}
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-2 space-y-2">
                  {billboards.map((billboard) => {
                    const id = billboard.ID || billboard.id;
                    const isSelected = selectedBillboardIds.has(id);
                    
                    return (
                      <Card 
                        key={id}
                        className={`cursor-pointer transition-all ${
                          isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleBillboardSelection(id)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {billboard.Billboard_Name || `لوحة ${id}`}
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                              <span>{billboard.Municipality || billboard.municipality}</span>
                              <span>•</span>
                              <span>{billboard.Size || billboard.size}</span>
                              <span>•</span>
                              <span>{billboard.District || billboard.district}</span>
                            </div>
                          </div>
                          {billboard.is_visible_in_available === false && (
                            <Badge variant="secondary" className="text-xs">مخفية</Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto mt-4">
            <div className="space-y-6">
              {/* Background Settings */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    خلفية الطباعة
                  </Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">نوع الخلفية</Label>
                      <Select value={backgroundType} onValueChange={(v: 'preset' | 'custom') => setBackgroundType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preset">خلفيات جاهزة</SelectItem>
                          <SelectItem value="custom">رابط مخصص</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {backgroundType === 'preset' ? (
                      <div>
                        <Label className="text-sm">اختر الخلفية</Label>
                        <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_BACKGROUNDS.map(bg => (
                              <SelectItem key={bg.id} value={bg.url}>{bg.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-sm flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" />
                          رابط الخلفية
                        </Label>
                        <Input
                          value={customBackgroundUrl}
                          onChange={(e) => setCustomBackgroundUrl(e.target.value)}
                          placeholder="https://example.com/background.svg"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={showLogo} 
                      onCheckedChange={(v) => setShowLogo(!!v)}
                      id="show-logo"
                    />
                    <Label htmlFor="show-logo">إظهار الشعار</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              {getBackgroundUrl() && (
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-sm mb-2 block">معاينة الخلفية</Label>
                    <div className="border rounded-lg overflow-hidden bg-muted/50 h-40 flex items-center justify-center">
                      <img 
                        src={getBackgroundUrl()} 
                        alt="معاينة الخلفية"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button 
            onClick={printSelectedBillboards}
            disabled={selectedBillboardIds.size === 0}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة {selectedBillboardIds.size} لوحة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};