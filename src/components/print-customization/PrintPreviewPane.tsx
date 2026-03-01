import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, ZoomIn, ZoomOut, RotateCcw, Users, Layers, Box, Image, ImageMinus, Images } from 'lucide-react';
import { PrintCustomizationSettings } from '@/hooks/usePrintCustomization';

interface PrintPreviewPaneProps {
  settings: PrintCustomizationSettings;
  backgroundUrl: string;
  onZoomChange?: (zoom: string) => void;
}

// دالة للحصول على محاذاة CSS
const getTextAlign = (alignment: string): 'left' | 'center' | 'right' => {
  if (alignment === 'left') return 'left';
  if (alignment === 'right') return 'right';
  return 'center';
};

// دالة لحساب الإزاحة
const getTransformWithOffset = (baseTransform: string, offsetX: string): string => {
  const offset = parseFloat(offsetX?.replace(/[^0-9.-]/g, '') || '0') || 0;
  if (offset === 0) return baseTransform;
  return `${baseTransform} translateX(${offset}mm)`;
};

export function PrintPreviewPane({ settings, backgroundUrl, onZoomChange }: PrintPreviewPaneProps) {
  const [zoomLevel, setZoomLevel] = useState(() => {
    const zoom = parseFloat(settings.preview_zoom?.replace('%', '') || '35');
    return zoom;
  });
  
  // حالة النص (فرقة / مجسمات / أوجه)
  const [textCase, setTextCase] = useState<'team' | 'cutout' | 'faces'>('team');
  
  // حالة الصور (بدون تصاميم / صورة واحدة / صورتين)
  const [imageCase, setImageCase] = useState<'no-designs' | 'one-image' | 'two-images'>('two-images');

  // بيانات تجريبية للنصوص حسب الحالة
  const textMockData = useMemo(() => {
    const baseData = {
      billboardName: 'ZW-ZW0953',
      size: '12x4',
      contractNumber: 1234,
      adType: 'إعلان تجاري',
      installationDate: '15 يناير 2025',
      municipality: 'الزاوية',
      district: 'الطريق الساحلي',
      landmark: 'بجوار كوبري بئر الغنم باتجاه الغرب',
    };

    switch (textCase) {
      case 'team':
        return { ...baseData, hasTeam: true, teamName: 'فريق التركيب الأول', hasCutout: false, hasDesigns: true, facesCount: 2 };
      case 'cutout':
        return { ...baseData, hasTeam: false, teamName: '', hasCutout: true, hasDesigns: true, facesCount: 2 };
      case 'faces':
        return { ...baseData, hasTeam: false, teamName: '', hasCutout: false, hasDesigns: true, facesCount: 2 };
      default:
        return { ...baseData, hasTeam: true, teamName: 'فريق التركيب الأول', hasCutout: false, hasDesigns: true, facesCount: 2 };
    }
  }, [textCase]);

  const handleZoomChange = (value: number[]) => {
    const newZoom = value[0];
    setZoomLevel(newZoom);
    onZoomChange?.(`${newZoom}%`);
  };

  const resetZoom = () => {
    setZoomLevel(35);
    onZoomChange?.('35%');
  };

  // عرض الصور حسب الحالة المختارة
  const renderImageSection = () => {
    switch (imageCase) {
      case 'no-designs':
        // صورة المنتج وحدها بحجم كبير
        return (
          <div 
            className="absolute z-10 bg-muted/30 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center"
            style={{
              top: settings.main_image_top,
              left: settings.main_image_left,
              transform: 'translateX(-50%)',
              width: settings.main_image_width,
              height: settings.main_image_height,
            }}
          >
            <div className="text-center text-muted-foreground">
              <div className="text-3xl mb-2">📷</div>
              <div className="text-sm font-medium">صورة اللوحة الرئيسية</div>
              <div className="text-xs opacity-60">(بدون تصاميم - حجم كبير)</div>
              <div className="text-xs opacity-60 mt-1">{settings.main_image_width} × {settings.main_image_height}</div>
            </div>
          </div>
        );
      
      case 'one-image':
        // صورة تركيب واحدة تحل محل الصورة الافتراضية
        return (
          <div 
            className="absolute z-10 bg-green-100/50 border-2 border-dashed border-green-500/50 rounded-lg flex items-center justify-center"
            style={{
              top: settings.main_image_top,
              left: settings.main_image_left,
              transform: 'translateX(-50%)',
              width: settings.main_image_width,
              height: settings.main_image_height,
            }}
          >
            <div className="text-center text-green-700">
              <div className="text-3xl mb-2">🖼️</div>
              <div className="text-sm font-medium">صورة التركيب</div>
              <div className="text-xs opacity-70">(تحل محل الصورة الافتراضية)</div>
            </div>
          </div>
        );
      
      case 'two-images':
        // صورتين تركيب في الأعلى + تصاميم في الأسفل
        return (
          <>
            {/* صور التركيب (وجهين) */}
            <div 
              className="absolute z-10 flex"
              style={{
                top: settings.installed_images_top,
                left: settings.installed_images_left,
                transform: 'translateX(-50%)',
                width: settings.installed_images_width,
                gap: settings.installed_images_gap,
              }}
            >
              <div 
                className="flex-1 bg-blue-100/50 border-2 border-dashed border-blue-500/50 rounded-lg flex items-center justify-center"
                style={{ height: settings.installed_image_height }}
              >
                <div className="text-center text-blue-700 text-xs">
                  <div className="text-xl">🖼️</div>
                  <div>صورة تركيب A</div>
                </div>
              </div>
              <div 
                className="flex-1 bg-blue-100/50 border-2 border-dashed border-blue-500/50 rounded-lg flex items-center justify-center"
                style={{ height: settings.installed_image_height }}
              >
                <div className="text-center text-blue-700 text-xs">
                  <div className="text-xl">🖼️</div>
                  <div>صورة تركيب B</div>
                </div>
              </div>
            </div>

            {/* التصاميم */}
            <div 
              className="absolute z-10 flex gap-2"
              style={{
                top: settings.designs_top,
                left: settings.designs_left,
                width: settings.designs_width,
                gap: settings.designs_gap,
              }}
            >
              <div 
                className="flex-1 bg-purple-100/50 border border-dashed border-purple-400/50 rounded flex items-center justify-center"
                style={{ height: settings.design_image_height }}
              >
                <div className="text-center text-purple-600 text-xs">
                  <div>🎨</div>
                  <div>التصميم A</div>
                </div>
              </div>
              <div 
                className="flex-1 bg-purple-100/50 border border-dashed border-purple-400/50 rounded flex items-center justify-center"
                style={{ height: settings.design_image_height }}
              >
                <div className="text-center text-purple-600 text-xs">
                  <div>🎨</div>
                  <div>التصميم B</div>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            معاينة الطباعة
          </CardTitle>
          
          {/* أدوات التكبير */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleZoomChange([Math.max(10, zoomLevel - 5)])}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <div className="w-20">
              <Slider
                value={[zoomLevel]}
                onValueChange={handleZoomChange}
                min={10}
                max={60}
                step={1}
                className="w-full"
              />
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleZoomChange([Math.min(60, zoomLevel + 5)])}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10">{zoomLevel}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetZoom}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* حالات الصور */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">حالات الصور:</span>
          <div className="flex gap-1">
            <Button 
              variant={imageCase === 'no-designs' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => setImageCase('no-designs')}
            >
              <ImageMinus className="h-3 w-3" />
              بدون تصاميم
            </Button>
            <Button 
              variant={imageCase === 'one-image' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => setImageCase('one-image')}
            >
              <Image className="h-3 w-3" />
              صورة واحدة
            </Button>
            <Button 
              variant={imageCase === 'two-images' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => setImageCase('two-images')}
            >
              <Images className="h-3 w-3" />
              صورتين تركيب
            </Button>
          </div>
        </div>
        
        {/* حالات النصوص */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">حالات النصوص:</span>
          <Tabs value={textCase} onValueChange={(v) => setTextCase(v as typeof textCase)}>
            <TabsList className="h-8 w-full justify-start">
              <TabsTrigger value="team" className="text-xs h-7 gap-1">
                <Users className="h-3 w-3" />
                مع فريق
              </TabsTrigger>
              <TabsTrigger value="cutout" className="text-xs h-7 gap-1">
                <Box className="h-3 w-3" />
                مع مجسمات
              </TabsTrigger>
              <TabsTrigger value="faces" className="text-xs h-7 gap-1">
                <Layers className="h-3 w-3" />
                عدد أوجه فقط
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      
      <CardContent 
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: settings.preview_background || '#ffffff' }}
      >
        <div 
          className="relative mx-auto border-2 border-border rounded-lg overflow-hidden shadow-lg"
          style={{
            width: '210mm',
            height: '297mm',
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* الخلفية */}
          <img 
            src={backgroundUrl || '/ipg.svg'} 
            alt="خلفية الطباعة"
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* رقم العقد */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.contract_number_top,
              right: settings.contract_number_right,
              fontSize: settings.contract_number_font_size,
              fontWeight: settings.contract_number_font_weight,
              color: settings.contract_number_color || '#333',
              fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.contract_number_alignment || 'right'),
              transform: getTransformWithOffset('', settings.contract_number_offset_x || '0mm'),
            }}
          >
            عقد رقم: {textMockData.contractNumber} - نوع الإعلان: {textMockData.adType}
          </div>

          {/* تاريخ التركيب */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.installation_date_top,
              right: settings.installation_date_right,
              fontSize: settings.installation_date_font_size,
              fontWeight: settings.installation_date_font_weight || 'normal',
              color: settings.installation_date_color || '#333',
              fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.installation_date_alignment || 'right'),
              transform: getTransformWithOffset('', settings.installation_date_offset_x || '0mm'),
            }}
          >
            تاريخ التركيب: {textMockData.installationDate}
          </div>

          {/* اسم اللوحة */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.billboard_name_top,
              left: settings.billboard_name_left,
              transform: getTransformWithOffset('translateX(-50%)', settings.billboard_name_offset_x || '0mm'),
              width: '120mm',
              fontSize: settings.billboard_name_font_size,
              fontWeight: settings.billboard_name_font_weight,
              color: settings.billboard_name_color,
              fontFamily: `'${settings.secondary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.billboard_name_alignment || 'center'),
            }}
          >
            {textMockData.billboardName}
          </div>

          {/* المقاس */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.size_top,
              left: settings.size_left,
              transform: getTransformWithOffset('translateX(-50%)', settings.size_offset_x || '0mm'),
              width: '80mm',
              fontSize: settings.size_font_size,
              fontWeight: settings.size_font_weight,
              color: settings.size_color,
              fontFamily: `'${settings.secondary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.size_alignment || 'center'),
            }}
          >
            {textMockData.size}
          </div>

          {/* عدد الأوجه - يظهر فقط عند وجود تصاميم */}
          {textMockData.hasDesigns && (
            <div 
              className="absolute z-10"
              style={{
                top: settings.faces_count_top,
                left: settings.faces_count_left,
                transform: getTransformWithOffset('translateX(-50%)', settings.faces_count_offset_x || '0mm'),
                width: '80mm',
                fontSize: settings.faces_count_font_size,
                color: settings.faces_count_color,
                fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
                textAlign: getTextAlign(settings.faces_count_alignment || 'center'),
              }}
            >
              {textMockData.hasCutout ? 'مجسم - ' : ''}عدد {textMockData.facesCount} {textMockData.facesCount === 1 ? 'وجه' : 'أوجه'}
            </div>
          )}

          {/* فريق التركيب - يظهر فقط عند اختيار فرقة */}
          {textMockData.hasTeam && textMockData.teamName && (
            <div 
              className="absolute z-10"
              style={{
                top: settings.team_name_top,
                right: settings.team_name_right,
                fontSize: settings.team_name_font_size,
                fontWeight: settings.team_name_font_weight,
                color: settings.team_name_color || '#333',
                fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
                textAlign: getTextAlign(settings.team_name_alignment || 'right'),
                transform: getTransformWithOffset('', settings.team_name_offset_x || '0mm'),
              }}
            >
              فريق التركيب: {textMockData.teamName}
            </div>
          )}

          {/* عرض الصور حسب الحالة */}
          {renderImageSection()}

          {/* البلدية والحي */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.location_info_top,
              left: settings.location_info_left,
              width: settings.location_info_width,
              fontSize: settings.location_info_font_size,
              color: settings.location_info_color || '#333',
              fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.location_info_alignment || 'left'),
              transform: getTransformWithOffset('', settings.location_info_offset_x || '0mm'),
            }}
          >
            {textMockData.municipality} - {textMockData.district}
          </div>

          {/* أقرب معلم */}
          <div 
            className="absolute z-10"
            style={{
              top: settings.landmark_info_top,
              left: settings.landmark_info_left,
              width: settings.landmark_info_width,
              fontSize: settings.landmark_info_font_size,
              color: settings.landmark_info_color || '#333',
              fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
              textAlign: getTextAlign(settings.landmark_info_alignment || 'left'),
              transform: getTransformWithOffset('', settings.landmark_info_offset_x || '0mm'),
            }}
          >
            {textMockData.landmark}
          </div>

          {/* QR Code */}
          <div 
            className="absolute z-10 bg-white border border-border rounded flex items-center justify-center"
            style={{
              top: settings.qr_top,
              left: settings.qr_left,
              width: settings.qr_size,
              height: settings.qr_size,
            }}
          >
            <div className="text-center text-muted-foreground text-xs">
              <div className="text-xl">📱</div>
              <div>QR</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
