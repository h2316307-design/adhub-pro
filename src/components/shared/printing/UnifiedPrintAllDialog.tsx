/**
 * UnifiedPrintAllDialog - مكون طباعة موحد لجميع الصفحات
 * يستخدم في: العقود، العروض، مهام التركيب، مهام الإزالة
 */

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, FileDown, Users, Check, FileText, Settings2 } from 'lucide-react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { createPinSvgUrl, getBillboardStatus } from '@/hooks/useMapMarkers';

export type PrintContextType = 'installation' | 'removal' | 'contract' | 'offer';

export interface BillboardPrintItem {
  id: string | number;
  billboard_id: number;
  design_face_a?: string | null;
  design_face_b?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  installation_date?: string | null;
  team_id?: string;
  has_cutout?: boolean;
  contract_number?: number | string | null;
  ad_type?: string | null;
}

export interface UnifiedPrintAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextType: PrintContextType;
  contextNumber: number | string; // رقم العقد/العرض
  customerName: string;
  adType?: string;
  items: BillboardPrintItem[];
  billboards: Record<number, any>;
  teams?: Record<string, any>;
  showTeamFilter?: boolean;
  title?: string;
}

export function UnifiedPrintAllDialog({
  open,
  onOpenChange,
  contextType,
  contextNumber,
  customerName,
  adType = '',
  items,
  billboards,
  teams = {},
  showTeamFilter = false,
  title
}: UnifiedPrintAllDialogProps) {
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [respectCityLimits, setRespectCityLimits] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  
  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();

  // تجميع العناصر حسب الفريق
  const itemsByTeam = useMemo(() => {
    if (!showTeamFilter) return { 'all': items };
    const groups: Record<string, BillboardPrintItem[]> = {};
    items.forEach(item => {
      const teamId = item.team_id || 'unknown';
      if (!groups[teamId]) groups[teamId] = [];
      groups[teamId].push(item);
    });
    return groups;
  }, [items, showTeamFilter]);

  useEffect(() => {
    if (open) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
    }
  }, [open, itemsByTeam]);

  const filteredItems = useMemo(() => {
    if (!showTeamFilter) return items;
    
    let result = items;
    
    // فلتر حسب الفرق المختارة
    if (selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = item.team_id || 'unknown';
        return selectedTeamIds.has(teamId);
      });
    } else {
      result = [];
    }
    
    // فلتر حسب حدود مدن الفرق
    if (respectCityLimits && selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = item.team_id || 'unknown';
        const team = teams[teamId];
        const billboard = billboards[item.billboard_id];
        if (!team || !billboard) return true;
        const teamCities: string[] = team.cities || [];
        if (!teamCities.length) return true;
        return teamCities.includes(billboard.City);
      });
    }
    
    return result;
  }, [items, selectedTeamIds, showTeamFilter, respectCityLimits, teams, billboards]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const selectAllTeams = () => setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
  const clearTeamSelection = () => setSelectedTeamIds(new Set());

  // ترتيب اللوحات
  const sortBillboardsBySize = async (items: BillboardPrintItem[]) => {
    try {
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizeOrderMap = new Map((sizesRes.data || []).map((s: any) => [s.name, s.sort_order ?? 999]));
      const municipalityOrderMap = new Map((municipalitiesRes.data || []).map((m: any) => [m.name, m.sort_order ?? 999]));
      const levelOrderMap = new Map((levelsRes.data || []).map((l: any) => [l.level_code, l.sort_order ?? 999]));
      
      return [...items].sort((a, b) => {
        const billboardA = billboards[a.billboard_id];
        const billboardB = billboards[b.billboard_id];
        
        const sizeOrderA = sizeOrderMap.get(billboardA?.Size) ?? 999;
        const sizeOrderB = sizeOrderMap.get(billboardB?.Size) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        const municipalityOrderA = municipalityOrderMap.get(billboardA?.Municipality) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(billboardB?.Municipality) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        const levelOrderA = levelOrderMap.get(billboardA?.Level) ?? 999;
        const levelOrderB = levelOrderMap.get(billboardB?.Level) ?? 999;
        return levelOrderA - levelOrderB;
      });
    } catch (e) {
      return items;
    }
  };

  const getContextLabel = () => {
    switch (contextType) {
      case 'installation': return 'تركيب';
      case 'removal': return 'إزالة';
      case 'contract': return 'عقد';
      case 'offer': return 'عرض';
      default: return '';
    }
  };

  const generatePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(filteredItems);
    const pages: string[] = [];
    const s = customSettings || {} as Record<string, string>;

    for (let pageIndex = 0; pageIndex < sortedItems.length; pageIndex++) {
      const item = sortedItems[pageIndex];
      const sequentialNumber = pageIndex + 1; // الرقم التسلسلي
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      const designFaceA = item.design_face_a;
      const designFaceB = item.design_face_b;
      const installedImageFaceA = item.installed_image_face_a_url;
      const installedImageFaceB = item.installed_image_face_b_url;
      
      const mainImage = installedImageFaceA && !installedImageFaceB 
        ? installedImageFaceA 
        : (billboard.Image_URL || '');

      const coords = billboard.GPS_Coordinates || '';
      const mapLink = coords 
        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
        : 'https://www.google.com/maps?q=';
      
      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 100 });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }

      // توليد صورة الدبوس - استخدام إعدادات التخصيص إن وجدت
      const billboardSize = billboard.Size || '';
      const pinColor = customSettings?.pin_color || '';
      const pinTextColor = customSettings?.pin_text_color || '';
      const customPinUrl = customSettings?.custom_pin_url || '';
      
      let pinSvgDataUrl: string;
      if (customPinUrl) {
        pinSvgDataUrl = customPinUrl;
      } else {
        const billboardStatus = getBillboardStatus(billboard);
        const pinData = createPinSvgUrl(billboardSize, billboardStatus.label, false, undefined, undefined, pinColor || undefined, pinTextColor || undefined);
        pinSvgDataUrl = pinData.url;
      }

      const hasDesigns = designFaceA || designFaceB;
      const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
      const municipality = billboard.Municipality || '';
      const district = billboard.District || '';
      const landmark = billboard.Nearest_Landmark || '';
      const size = billboard.Size || '';
      const facesCount = billboard.Faces_Count || 1;
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      const installationDate = item.installation_date 
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      const selectedTeamNames = showTeamFilter 
        ? Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')
        : '';

      const itemContractNumber = item.contract_number || contextNumber;
      const itemAdType = item.ad_type || adType;
      const contractInfoText = itemContractNumber 
        ? `${getContextLabel()} رقم: ${itemContractNumber}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}`
        : (itemAdType ? `نوع الإعلان: ${itemAdType}` : '');

      // تحديد الصورة الرئيسية: صورة اللوحة أو صورة الدبوس (الدبوس فقط في تنظيم البلديات)
      const hasMainImage = !!mainImage;
      const showPinFallback = contextType !== 'contract' && contextType !== 'offer' && contextType !== 'removal';
      const imageSection = hasMainImage
        ? `<img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />`
        : (showPinFallback
          ? `<div class="pin-fallback">
              <img src="${pinSvgDataUrl}" alt="دبوس اللوحة" style="width: 80px; height: auto; margin-bottom: 8px;" />
              <div style="font-size: 11px; color: #666; direction: ltr;">${coords || 'لا توجد إحداثيات'}</div>
            </div>`
          : `<div class="pin-fallback">
              <div style="font-size: 13px; color: #999; direction: rtl;">لا توجد صورة</div>
              <div style="font-size: 11px; color: #666; direction: ltr; margin-top: 4px;">${coords || 'لا توجد إحداثيات'}</div>
            </div>`);

      pages.push(`
        <div class="page">
          <div class="background"></div>

          <!-- تم نقل الترقيم إلى مكان الموقع -->

          ${contextType !== 'contract' && contextType !== 'offer' && contextType !== 'removal' ? `
          <!-- دبوس اللوحة المعتمد -->
          <div class="absolute-field pin-badge">
            <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 60px; height: auto;" />
          </div>
          ` : ''}

          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight};">
            ${contractInfoText}
          </div>

          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: 400;">
            ${contextType === 'removal' ? 'تاريخ الإزالة' : 'تاريخ التركيب'}: ${installationDate}
          </div>
          ` : ''}

          <div class="absolute-field billboard-name" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(-50%); width: 120mm; text-align: center; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          <div class="absolute-field size" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${size}
          </div>
          
          <div class="absolute-field faces-count" style="top: ${s.faces_count_top}; left: ${s.faces_count_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
          </div>

          ${printType === 'installation' && selectedTeamNames ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: #000; font-weight: ${s.team_name_font_weight};">
               ${contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}: ${selectedTeamNames}
            </div>
          ` : ''}

          ${installedImageFaceA && installedImageFaceB ? `
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: ${s.installed_images_left}; transform: translateX(-50%); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">الوجه الأمامي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceA}" alt="الوجه الأمامي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">الوجه الخلفي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceB}" alt="الوجه الخلفي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
            </div>
          ` : `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              ${imageSection}
            </div>
          `}

          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: ${s.location_info_left}; width: ${s.location_info_width}; font-size: ${s.location_info_font_size};">
            ${municipalityDistrict}
          </div>

          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: ${s.landmark_info_left}; width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size};">
            ${landmark || '—'}
          </div>

          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <a href="${mapLink}" target="_blank" style="display:block;width:100%;height:100%;" title="اضغط لفتح الموقع على الخريطة">
                <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" style="cursor:pointer;" />
              </a>
            </div>
          ` : ''}

          ${includeDesigns && hasDesigns ? `
            <div class="absolute-field designs-section" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; gap: ${s.designs_gap};">
              ${designFaceA ? `
                <div class="design-item">
                  <div class="design-label">التصميم - الوجه الأمامي</div>
                  <img src="${designFaceA}" alt="التصميم - الوجه الأمامي" class="design-image" style="max-height: ${s.design_image_height};" />
                </div>
              ` : ''}
              ${designFaceB ? `
                <div class="design-item">
                  <div class="design-label">التصميم - الوجه الخلفي</div>
                  <img src="${designFaceB}" alt="التصميم - الوجه الخلفي" class="design-image" style="max-height: ${s.design_image_height};" />
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    const baseUrl = window.location.origin;
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${getContextLabel()} #${contextNumber} - ${customerName} - ${filteredItems.length} لوحة</title>
        <style>
          @font-face {
            font-family: 'Manrope';
            src: url('${baseUrl}/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Doran';
            src: url('${baseUrl}/Doran-Medium.otf') format('opentype');
            font-weight: 500;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            page-break-after: always;
            overflow: hidden;
          }

          .page:last-child { page-break-after: avoid; }

          .background {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url('${customBackgroundUrl}');
            background-size: 210mm 297mm;
            background-repeat: no-repeat;
            z-index: 0;
          }

          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
            font-family: 'Doran', Arial, sans-serif;
          }

          .billboard-name { font-family: 'Doran', Arial, sans-serif; font-size: 20px; font-weight: 500; color: #333; }
          .size { font-family: 'Manrope', Arial, sans-serif; font-size: 41px; font-weight: 700; }
          .contract-number { font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 500; }
          .location-info, .landmark-info { font-family: 'Doran', Arial, sans-serif; font-size: 16px; }

          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
          }

          .billboard-image { width: 100%; height: 100%; object-fit: contain; }
          .qr-code { width: 100%; height: 100%; object-fit: contain; }

          .sequential-number {
            top: 8mm; left: 8mm;
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 32px; font-weight: 800;
            color: #1a1a2e;
            background: rgba(255,255,255,0.85);
            border: 2px solid #1a1a2e;
            border-radius: 50%;
            width: 48px; height: 48px;
            display: flex; align-items: center; justify-content: center;
            line-height: 1;
          }

          .pin-badge {
            top: 8mm; left: 60mm;
          }

          .pin-fallback {
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px;
          }

          .coordinates-text {
            font-family: 'Manrope', monospace;
            font-size: 9px; color: #555;
            margin-top: 2mm; direction: ltr;
            word-break: break-all;
          }

          .designs-section { flex-wrap: wrap; }
          .design-item { flex: 1; min-width: 70mm; text-align: center; }
          .design-label { font-family: 'Doran', Arial, sans-serif; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333; }
          .design-image { width: 100%; max-height: 42mm; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }

          @page { size: A4 portrait; margin: 0; }

          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page { page-break-after: always; box-shadow: none; }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pages.join('\n')}
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 500); };
        </script>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (filteredItems.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    setLoading(true);
    try {
      const html = await generatePrintHTML();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`تم تحضير ${filteredItems.length} صفحة للطباعة`);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('فشل في تحضير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (filteredItems.length === 0) {
      toast.error('لا توجد لوحات للتحميل');
      return;
    }

    setLoading(true);
    toast.info('جاري تحضير ملف PDF...');

    try {
      const html = await generatePrintHTML();
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-99999px';
      document.body.appendChild(container);

      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));

      const images = container.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => 
        img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
      ));

      const options = {
        margin: 0,
        filename: `${getContextLabel()}_${contextNumber}_جميع_اللوحات.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] as const, before: '.page' }
      };

      await html2pdf().set(options).from(container).save();
      document.body.removeChild(container);
      toast.success('تم تحميل ملف PDF بنجاح');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('فشل في إنشاء ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle = title || `${getContextLabel()} لوحات`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span>{dialogTitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
              {adType && <Badge variant="secondary">{adType}</Badge>}
              <span className="font-semibold text-foreground">{customerName}</span>
              <span>•</span>
              <span>{getContextLabel()} #{contextNumber}</span>
              <span>•</span>
              <Badge className="bg-primary/20 text-primary border-0">{filteredItems.length} لوحة</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* اختيار الفرق */}
          {showTeamFilter && Object.keys(itemsByTeam).length > 0 && (
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  اختر الفرق للطباعة
                </Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllTeams}>الكل</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearTeamSelection}>مسح</Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {Object.entries(itemsByTeam).map(([teamId, teamItems]) => {
                  const isSelected = selectedTeamIds.has(teamId);
                  const team = teams[teamId];
                  const teamCities: string[] = team?.cities || [];
                  
                  // احسب عدد اللوحات المفلترة حسب المدينة لهذا الفريق
                  const cityFilteredCount = respectCityLimits && teamCities.length > 0
                    ? teamItems.filter(item => {
                        const billboard = billboards[item.billboard_id];
                        return billboard && teamCities.includes(billboard.City);
                      }).length
                    : teamItems.length;
                  
                  return (
                    <button
                      key={teamId}
                      type="button"
                      onClick={() => toggleTeam(teamId)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{teams[teamId]?.team_name || 'غير محدد'}</span>
                      <Badge variant="secondary" className="text-xs">
                        {respectCityLimits && cityFilteredCount !== teamItems.length
                          ? `${cityFilteredCount}/${teamItems.length}`
                          : teamItems.length}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* خيار الالتزام بحدود مدن الفرق */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="respectCityLimits"
                    checked={respectCityLimits}
                    onCheckedChange={(c) => setRespectCityLimits(!!c)}
                  />
                  <Label htmlFor="respectCityLimits" className="cursor-pointer flex-1 text-sm">
                    الالتزام بحدود مدن الفرق (تجاهل اللوحات خارج نطاق المدينة)
                  </Label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">اللوحات المحددة:</span>
                  <Badge className="text-sm font-bold">{filteredItems.length} لوحة</Badge>
                </div>
              </div>
            </div>
          )}

          {/* اختيار الخلفية وزر التخصيص */}
          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <div className="flex items-center justify-between">
              <BackgroundSelector
                value={customBackgroundUrl}
                onChange={setCustomBackgroundUrl}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomizationDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Settings2 className="h-4 w-4" />
                تخصيص الطباعة
              </Button>
            </div>
          </div>

          {/* خيارات الطباعة */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="includeDesigns"
                checked={includeDesigns}
                onCheckedChange={(c) => setIncludeDesigns(!!c)}
              />
              <Label htmlFor="includeDesigns" className="cursor-pointer flex-1">تضمين التصاميم</Label>
            </div>

            <div className="flex gap-2">
              <Button
                variant={printType === 'client' ? 'default' : 'outline'}
                onClick={() => setPrintType('client')}
                className="flex-1"
              >
                نسخة العميل
              </Button>
              <Button
                variant={printType === 'installation' ? 'default' : 'outline'}
                onClick={() => setPrintType('installation')}
                className="flex-1"
              >
                نسخة {contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}
              </Button>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={handlePrint} disabled={loading || settingsLoading || filteredItems.length === 0} className="flex-1">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={handleDownloadPDF} disabled={loading || settingsLoading || filteredItems.length === 0} variant="secondary" className="flex-1">
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />
    </Dialog>
  );
}
