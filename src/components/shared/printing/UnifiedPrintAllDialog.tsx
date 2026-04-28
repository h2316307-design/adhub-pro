/**
 * UnifiedPrintAllDialog - مكون طباعة موحد لجميع الصفحات
 * يستخدم في: العقود، العروض، مهام التركيب، مهام الإزالة
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, FileDown, Users, Check, FileText, Settings2, Table2, MessageCircle } from 'lucide-react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { useTablePrintSettings } from '@/hooks/useTablePrintSettings';
import { TablePrintSettingsDialog } from '@/components/tasks/TablePrintSettingsDialog';
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
  contextNumber: number | string;
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
  const PDF_PORTRAIT_WIDTH_PX = 2480;
  const PDF_PORTRAIT_HEIGHT_PX = 3508;
  const PDF_LANDSCAPE_WIDTH_PX = 3508;
  const PDF_LANDSCAPE_HEIGHT_PX = 2480;

  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [hideInstallDate, setHideInstallDate] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [printMode, setPrintMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [respectCityLimits, setRespectCityLimits] = useState(false);
  const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [showInstalledImages, setShowInstalledImages] = useState(false);
  const [installedImagesData, setInstalledImagesData] = useState<Record<number, { face_a?: string; face_b?: string }>>({});
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  const [tableSettingsDialogOpen, setTableSettingsDialogOpen] = useState(false);
  
  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();
  const { 
    settings: tableSettings, 
    loading: tableSettingsLoading,
    updateSetting: updateTableSetting,
    saveSettings: saveTableSettings,
    resetToDefaults: resetTableSettings,
    saving: savingTableSettings
  } = useTablePrintSettings();

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

  // جلب صور التركيب من قاعدة البيانات
  useEffect(() => {
    if (!showInstalledImages || !open) return;
    const fetchInstalledImages = async () => {
      const billboardIds = [...new Set(items.map(i => i.billboard_id))];
      if (billboardIds.length === 0) return;
      
      const { data } = await supabase
        .from('installation_task_items')
        .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url')
        .in('billboard_id', billboardIds)
        .not('installed_image_face_a_url', 'is', null);
      
      if (data) {
        const map: Record<number, { face_a?: string; face_b?: string }> = {};
        data.forEach((row: any) => {
          // نأخذ آخر صورة تركيب لكل لوحة
          map[row.billboard_id] = {
            face_a: row.installed_image_face_a_url || undefined,
            face_b: row.installed_image_face_b_url || undefined,
          };
        });
        setInstalledImagesData(map);
      }
    };
    fetchInstalledImages();
  }, [showInstalledImages, open, items]);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

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
    const toMmOffset = (value?: string) => {
      const parsed = parseFloat(String(value ?? '0').replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) && parsed !== 0 ? `${parsed}mm` : '0mm';
    };
    const toCssLength = (value?: string) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '0mm';
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}mm`;
      return raw;
    };

    for (let pageIndex = 0; pageIndex < sortedItems.length; pageIndex++) {
      const item = sortedItems[pageIndex];
      const sequentialNumber = pageIndex + 1;
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      const designFaceA = item.design_face_a;
      const designFaceB = item.design_face_b;
      
      // إذا كان خيار صور التركيب مفعّل، نجلبها من البيانات المحملة
      const fetchedInstalled = showInstalledImages ? installedImagesData[item.billboard_id] : null;
      const installedImageFaceA = item.installed_image_face_a_url || fetchedInstalled?.face_a || null;
      const installedImageFaceB = item.installed_image_face_b_url || fetchedInstalled?.face_b || null;
      
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

      const installationDate = (!hideInstallDate && item.installation_date)
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
          <div class="background"><img src="${customBackgroundUrl}" alt="" /></div>

          ${contextType !== 'contract' && contextType !== 'offer' && contextType !== 'removal' ? `
          <div class="absolute-field pin-badge">
            <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 60px; height: auto;" />
          </div>
          ` : ''}

          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; text-align: ${s.contract_number_alignment}; max-width: 60%; overflow: hidden; text-overflow: ellipsis; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''}">
            ${contractInfoText}
          </div>

          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${s.installation_date_font_weight || '400'}; color: ${s.installation_date_color}; text-align: ${s.installation_date_alignment}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''}">
            ${contextType === 'removal' ? 'تاريخ الإزالة' : 'تاريخ التركيب'}: ${installationDate}
          </div>
          ` : ''}

          <div class="absolute-field billboard-name" style="top: ${toCssLength(s.billboard_name_top)}; left: calc(${s.billboard_name_left} - 60mm${s.billboard_name_offset_x && s.billboard_name_offset_x !== '0mm' ? ` + ${s.billboard_name_offset_x}` : ''}); width: 120mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          <div class="absolute-field size" style="top: ${toCssLength(s.size_top)}; left: calc(${s.size_left} - 40mm${s.size_offset_x && s.size_offset_x !== '0mm' ? ` + ${s.size_offset_x}` : ''}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${size}
          </div>
          
          <div class="absolute-field faces-count" style="top: ${toCssLength(s.faces_count_top)}; left: calc(${s.faces_count_left} - 40mm${s.faces_count_offset_x && s.faces_count_offset_x !== '0mm' ? ` + ${s.faces_count_offset_x}` : ''}); width: 80mm; text-align: ${s.faces_count_alignment || 'center'}; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
          </div>

          ${printType === 'installation' && selectedTeamNames ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${s.team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${s.team_name_alignment}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''}">
               ${contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}: ${selectedTeamNames}
            </div>
          ` : ''}

          ${installedImageFaceA && installedImageFaceB ? `
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: calc(${s.installed_images_left} - ${s.installed_images_width} / 2); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
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
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              ${imageSection}
            </div>
          `}

          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: calc(${toCssLength(s.location_info_left)} + ${toMmOffset(s.location_info_offset_x)}); width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment};">
            ${municipalityDistrict}
          </div>

          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: calc(${toCssLength(s.landmark_info_left)} + ${toMmOffset(s.landmark_info_offset_x)}); width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment};">
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
            <div class="absolute-field designs-section" style="top: ${toCssLength(s.designs_top)}; left: ${s.designs_left}; width: ${s.designs_width}; max-height: ${s.design_image_height}; overflow: hidden; display: flex; gap: ${s.designs_gap};">
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
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('${baseUrl}/Manrope-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Doran';
            src: url('${baseUrl}/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Doran';
            src: url('${baseUrl}/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: block;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .page:last-child { page-break-after: avoid; }

          .background {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
          }
          .background img {
            width: 100%; height: 100%;
            object-fit: fill;
            display: block;
            transform: translateZ(0);
            backface-visibility: hidden;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
            font-family: 'Doran', Arial, sans-serif;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
            font-smooth: always;
            line-height: 1.2;
          }

          .billboard-name { font-family: 'Doran', Arial, sans-serif; font-size: 20px; font-weight: 500; color: #333; line-height: 1.2; }
          .size { font-family: 'Manrope', Arial, sans-serif; font-size: 41px; font-weight: 700; line-height: 1.1; }
          .faces-count { line-height: 1.3; }
          .contract-number { font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 1.2; }
          .location-info, .landmark-info { font-family: 'Doran', Arial, sans-serif; font-size: 16px; line-height: 1.2; }

          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .billboard-image { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
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

          .pin-badge { top: 8mm; left: 60mm; }

          .pin-fallback {
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px;
          }

          .designs-section { flex-wrap: wrap; }
          .design-item { flex: 1; min-width: 70mm; text-align: center; display: flex; flex-direction: column; align-items: center; }
          .design-label { font-family: 'Doran', Arial, sans-serif; font-size: 13px; font-weight: 500; margin-bottom: 2mm; color: #333; line-height: 1; white-space: nowrap; }
          .design-image { width: 100%; height: auto; max-height: 42mm; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
          .designs-section { overflow: hidden; }

          @page { size: A4 portrait; margin: 0; }

          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              margin: 0;
              padding: 0;
            }
            .page { 
              page-break-after: always; 
              box-shadow: none; 
              height: 297mm;
              overflow: hidden;
              margin: 0;
            }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pages.join('\n')}
        <script>
          document.fonts.ready.then(function() {
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= totalImages) {
                setTimeout(function() { window.print(); }, 300);
              }
            }
            if (totalImages === 0) {
              setTimeout(function() { window.print(); }, 300);
            } else {
              images.forEach(function(img) {
                if (img.complete) checkAllLoaded();
                else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // دالة إنشاء HTML للجدول
  const generateTablePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(filteredItems);
    const GOLD = '#E8CC64';
    const BLACK = '#000000';
    const WHITE = '#ffffff';
    
    const s = {
      ...tableSettings,
      header_bg_color: BLACK,
      header_text_color: GOLD,
      first_column_bg_color: GOLD,
      first_column_text_color: BLACK,
      border_color: BLACK,
      row_bg_color: WHITE,
      row_text_color: BLACK,
    };
    
    const selectedTeamNames = showTeamFilter
      ? Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')
      : '';

    const enabledColumns = [...s.columns_order]
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    const columnHasData: Record<string, boolean> = {};
    enabledColumns.forEach(col => { columnHasData[col.id] = false; });

    sortedItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      if (!billboard) return;
      enabledColumns.forEach(col => {
        switch (col.id) {
          case 'row_number': columnHasData[col.id] = true; break;
          case 'billboard_image': if (billboard.Image_URL) columnHasData[col.id] = true; break;
          case 'billboard_name': if (billboard.Billboard_Name) columnHasData[col.id] = true; break;
          case 'size': if (billboard.Size) columnHasData[col.id] = true; break;
          case 'faces_count': if (billboard.Faces_Count) columnHasData[col.id] = true; break;
          case 'location': if (billboard.Municipality || billboard.District) columnHasData[col.id] = true; break;
          case 'landmark': if (billboard.Nearest_Landmark) columnHasData[col.id] = true; break;
          case 'contract_number': if (item.contract_number || contextNumber) columnHasData[col.id] = true; break;
          case 'installation_date': if (!hideInstallDate && item.installation_date) columnHasData[col.id] = true; break;
          case 'design_images': if (item.design_face_a || item.design_face_b) columnHasData[col.id] = true; break;
          case 'installed_images': if (item.installed_image_face_a_url || item.installed_image_face_b_url) columnHasData[col.id] = true; break;
          case 'qr_code': if (billboard.GPS_Coordinates) columnHasData[col.id] = true; break;
        }
      });
    });

    const finalColumns = s.auto_hide_empty_columns 
      ? enabledColumns.filter(col => columnHasData[col.id])
      : enabledColumns;

    const pages: string[] = [];
    const rowsPerPage = Math.min(s.rows_per_page || 11, 11);
    
    for (let pageIndex = 0; pageIndex < Math.ceil(sortedItems.length / rowsPerPage); pageIndex++) {
      const pageItems = sortedItems.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      
      const tableRows = await Promise.all(pageItems.map(async (item, index) => {
        const billboard = billboards[item.billboard_id];
        if (!billboard) return '';
        
        const globalIndex = pageIndex * rowsPerPage + index + 1;
        const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
        const size = billboard.Size || '';
        const facesCount = billboard.Faces_Count || 1;
        const itemContractNumber = item.contract_number || contextNumber;
        const itemAdType = item.ad_type || adType || '';
        
        const installationDate = (!hideInstallDate && item.installation_date)
          ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        let qrCodeDataUrl = '';
        let mapLink = '';
        if (finalColumns.some(c => c.id === 'qr_code')) {
          const coords = billboard.GPS_Coordinates || '';
          mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
          if (coords) {
            try { qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 50 }); } catch (e) {}
          }
        }
        
        const cells = finalColumns.map((col) => {
          switch (col.id) {
            case 'row_number':
              return `<td class="number-cell"><div class="billboard-number">${globalIndex}</div></td>`;
            case 'billboard_image':
              return `<td class="image-cell">${billboard.Image_URL 
                ? `<img src="${billboard.Image_URL}" alt="${name}" class="billboard-image" onerror="this.style.display='none'">`
                : `<div class="image-placeholder"><span>صورة</span></div>`}</td>`;
            case 'billboard_name':
              return `<td style="font-weight: 600; text-align: right; padding: 4px; font-size: 8px;">${name}</td>`;
            case 'size':
              return `<td style="font-weight: 600; font-size: 8px;">${size}</td>`;
            case 'faces_count':
              return `<td style="font-size: 9px; font-weight: 700;">${facesCount}</td>`;
            case 'location':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${[billboard.Municipality, billboard.District].filter(Boolean).join(' - ') || '-'}</td>`;
            case 'landmark':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${billboard.Nearest_Landmark || '-'}</td>`;
            case 'contract_number':
              return `<td style="font-size: 8px;">${itemContractNumber}${itemAdType ? '<br/><span style="font-size:7px;color:#666;">' + itemAdType + '</span>' : ''}</td>`;
            case 'installation_date':
              return `<td style="font-size: 8px;">${installationDate}</td>`;
            case 'design_images':
              return `<td class="image-cell"><div class="img-group">
                ${item.design_face_a ? `<img src="${item.design_face_a}" class="design-img" />` : ''}
                ${item.design_face_b ? `<img src="${item.design_face_b}" class="design-img" />` : ''}
                ${!item.design_face_a && !item.design_face_b ? '-' : ''}
              </div></td>`;
            case 'installed_images':
              return `<td class="image-cell"><div class="img-group">
                ${item.installed_image_face_a_url ? `<img src="${item.installed_image_face_a_url}" class="installed-img" />` : ''}
                ${item.installed_image_face_b_url ? `<img src="${item.installed_image_face_b_url}" class="installed-img" />` : ''}
                ${!item.installed_image_face_a_url && !item.installed_image_face_b_url ? '-' : ''}
              </div></td>`;
            case 'qr_code':
              return `<td class="qr-cell">${qrCodeDataUrl && mapLink 
                ? `<a href="${mapLink}" target="_blank"><img src="${qrCodeDataUrl}" class="qr-code" style="width: 50px; height: 50px;" alt="QR" /></a>`
                : '-'}</td>`;
            default: return '';
          }
        });
        
        return `<tr style="height: 60px; background: #fff;">${cells.join('')}</tr>`;
      }));

      const headerCells = finalColumns.map((col, colIndex) => {
        const isFirstColumn = colIndex === 0;
        const headerStyle = isFirstColumn 
          ? `background: ${s.first_column_bg_color}; color: ${s.first_column_text_color}; width: ${col.width || '8%'};`
          : `width: ${col.width || '8%'};`;
        return `<th class="header-cell" style="${headerStyle}">${col.label}</th>`;
      });

      pages.push(`
        <div class="info-bar">
          <span>${getContextLabel()} رقم: ${contextNumber} | ${customerName}${adType ? ' | ' + adType : ''}${selectedTeamNames ? ' | الفريق: ' + selectedTeamNames : ''} | صفحة ${pageIndex + 1} من ${Math.ceil(sortedItems.length / rowsPerPage)}</span>
        </div>
        <table>
          <thead><tr>${headerCells.join('')}</tr></thead>
          <tbody>${tableRows.join('')}</tbody>
        </table>
      `);
    }

    const isLandscape = s.page_orientation === 'landscape';
    const pageMargin = s.page_margin || '8mm';
    const tableTopMargin = s.table_top_margin || '10mm';
    const rowHeight = s.row_height || '60px';
    const baseUrl = window.location.origin;
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>جدول ${getContextLabel()} #${contextNumber} - ${customerName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Medium.otf') format('opentype'); font-weight: 500; }
          @page { size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: '${s.primary_font}', 'Tajawal', 'Arial', sans-serif;
            direction: rtl; background: #ffffff; color: #000;
            line-height: 1.3; font-size: ${s.row_font_size};
            margin: 0; padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page {
            position: relative;
            width: ${isLandscape ? '297mm' : '210mm'};
            height: ${isLandscape ? '210mm' : '297mm'};
            padding: ${pageMargin};
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
            background: white;
          }
          .page:last-child { page-break-after: auto; }
          .page-background {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-image: url('${baseUrl}/repo.svg');
            background-size: 100% 100%; background-repeat: no-repeat; z-index: 0;
          }
          .page-content { position: relative; z-index: 1; padding-top: ${tableTopMargin}; }
          .info-bar { margin-bottom: 8px; padding: 6px 10px; background: ${s.header_bg_color}; display: inline-block; }
          .info-bar span { font-size: 10px; color: ${s.header_text_color}; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: ${s.row_font_size}; background: #fff; }
          th { background: ${s.header_bg_color}; color: ${s.header_text_color}; font-weight: 700; font-size: ${s.header_font_size}; height: 30px; border: 1px solid ${s.border_color}; padding: 4px 2px; text-align: center; }
          td { border: 1px solid ${s.border_color}; padding: 2px; text-align: center; vertical-align: middle; background: #fff; color: #000; }
          td.number-cell { background: ${s.first_column_bg_color}; font-weight: 700; font-size: 9px; color: ${s.first_column_text_color}; width: 60px; }
          td.image-cell { background: #fff; padding: 0; width: 70px; }
          .billboard-image { width: 100%; height: auto; max-height: ${rowHeight}; object-fit: contain; display: block; margin: 0 auto; }
          .billboard-number { color: ${s.first_column_text_color}; font-weight: 700; font-size: 9px; }
          td.qr-cell { width: 60px; padding: 2px; }
          .qr-code { width: 100%; height: auto; max-height: ${rowHeight}; display: block; margin: 0 auto; cursor: pointer; }
          .img-group { display: flex; gap: 2px; justify-content: center; align-items: center; }
          .design-img, .installed-img { max-width: 48%; max-height: calc(${rowHeight} - 4px); object-fit: contain; }
          .image-placeholder { width: 100%; height: ${rowHeight}; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #666; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; padding: 0; }
            .page { page-break-after: always; margin: 0; box-shadow: none; height: ${isLandscape ? '210mm' : '297mm'}; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pages.map((pageContent) => `
          <div class="page">
            <div class="page-background"></div>
            <div class="page-content">${pageContent}</div>
          </div>
        `).join('\n')}
        <script>
          document.fonts.ready.then(function() {
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= totalImages) setTimeout(function() { window.print(); }, 300);
            }
            if (totalImages === 0) setTimeout(function() { window.print(); }, 300);
            else images.forEach(function(img) {
              if (img.complete) checkAllLoaded();
              else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
            });
          });
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

    if (loading) return;
    setLoading(true);
    try {
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`تم تحضير ${filteredItems.length} ${printMode === 'table' ? 'صف' : 'صفحة'} للطباعة`);
        
        const checkWindowClosed = setInterval(() => {
          if (printWindow.closed) {
            clearInterval(checkWindowClosed);
            setLoading(false);
          }
        }, 500);
        setTimeout(() => { clearInterval(checkWindowClosed); setLoading(false); }, 30000);
      } else {
        toast.error('تم حظر نافذة الطباعة من المتصفح');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('فشل في تحضير الطباعة');
      setLoading(false);
    }
  };

  const stripScriptsForPdf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

  const rasterizeSvgForPdf = async (url: string, w = PDF_PORTRAIT_WIDTH_PX, h = PDF_PORTRAIT_HEIGHT_PX): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) { resolve(url); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      try { img.src = new URL(url, window.location.origin).toString(); } catch { img.src = url; }
    });
  };

  const prepareHtmlForPdf = async (html: string, isLandscape = false) => {
    let preparedHtml = stripScriptsForPdf(html);
    const svgUrls = new Set<string>();
    const bgRegex = /(?:background-image:\s*url\(['"]?)([^'")\s]+\.svg)['"]?\)|<img[^>]+src=["']([^"']+\.svg)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = bgRegex.exec(preparedHtml)) !== null) {
      svgUrls.add(match[1] || match[2]);
    }
    const rasterW = isLandscape ? PDF_LANDSCAPE_WIDTH_PX : PDF_PORTRAIT_WIDTH_PX;
    const rasterH = isLandscape ? PDF_LANDSCAPE_HEIGHT_PX : PDF_PORTRAIT_HEIGHT_PX;
    const rasterized = new Map<string, string>();
    await Promise.all(
      Array.from(svgUrls).map(async (svgUrl) => {
        const dataUrl = await rasterizeSvgForPdf(svgUrl, rasterW, rasterH);
        if (dataUrl !== svgUrl) rasterized.set(svgUrl, dataUrl);
      })
    );
    for (const [svgUrl, dataUrl] of rasterized) {
      preparedHtml = preparedHtml.split(svgUrl).join(dataUrl);
    }
    return preparedHtml;
  };

  const buildPdfBlobFromHtml = async (html: string, isLandscape = false): Promise<Blob> => {
    const preparedHtml = await prepareHtmlForPdf(html, isLandscape);
    // Use mm units to match print preview exactly
    const PAGE_W_MM = isLandscape ? 297 : 210;
    const PAGE_H_MM = isLandscape ? 210 : 297;
    const pageCountEstimate = (preparedHtml.match(/class="page"/g) || []).length || 1;

    const iframe = document.createElement('iframe');
    // Set iframe width in mm so CSS mm-based positioning matches print preview
    iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_W_MM}mm;height:${PAGE_H_MM * pageCountEstimate + 50}mm;border:none;opacity:0;pointer-events:none;`;
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('تعذر إنشاء مستند PDF');

      iframeDoc.open();
      iframeDoc.write(preparedHtml);
      iframeDoc.close();

      const overrideStyle = iframeDoc.createElement('style');
      overrideStyle.textContent = `
        html, body { margin:0!important; padding:0!important; width:${PAGE_W_MM}mm!important; background:#fff!important; overflow:visible!important; }
        * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
        .page { width:${PAGE_W_MM}mm!important; height:${PAGE_H_MM}mm!important; margin:0!important; overflow:hidden!important; page-break-after:always!important; }
        .page:last-child { page-break-after:auto!important; }
        .background, .background img { width:${PAGE_W_MM}mm!important; height:${PAGE_H_MM}mm!important; }
        .page-background { width:${PAGE_W_MM}mm!important; height:${PAGE_H_MM}mm!important; background-size:${PAGE_W_MM}mm ${PAGE_H_MM}mm!important; }

        /* PDF-only vertical compensations — html2canvas rasterizes with slightly different font metrics */
        .billboard-name { transform: translateY(-4mm) !important; }
        .size { transform: translateY(-5mm) !important; line-height: 1.1 !important; font-size: 36px !important; }
        .faces-count { transform: translateY(-4mm) !important; line-height: 1.3 !important; }
        .location-info { transform: translateY(-4mm) !important; }
        .landmark-info { transform: translateY(-4mm) !important; }
        .design-label { transform: translateY(-4mm) !important; }
        .designs-section { transform: translateY(-3mm) !important; }
        .contract-number { transform: translateY(-3mm) !important; }
        .installation-date { transform: translateY(-3mm) !important; }
        .print-type { transform: translateY(-3mm) !important; }
        /* High quality background rendering */
        .background img {
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
        }
      `;
      iframeDoc.head.appendChild(overrideStyle);

      // No pdfOffsetStyle needed — mm units match print preview exactly

      // Wait for iframe load
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => { if (settled) return; settled = true; resolve(); };
        if (iframe.contentWindow && iframeDoc.readyState !== 'complete') {
          iframe.contentWindow.addEventListener('load', done, { once: true });
        }
        setTimeout(done, 2000);
      });

      // Wait for fonts to load in iframe — prevents fallback font metrics causing displacement
      try {
        if (iframe.contentDocument?.fonts) {
          await Promise.race([
            iframe.contentDocument.fonts.ready,
            new Promise(r => setTimeout(r, 3000)),
          ]);
          // Give an extra tick for font metrics to settle
          await new Promise(r => setTimeout(r, 200));
        }
      } catch {}


      // Wait for images
      const images = Array.from(iframeDoc.getElementsByTagName('img'));
      await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })));

      const pages = Array.from(iframeDoc.querySelectorAll('.page')) as HTMLElement[];
      if (pages.length === 0) throw new Error('لا توجد صفحات للتصدير');

      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const orientation = isLandscape ? 'landscape' : 'portrait';
      const a4W = isLandscape ? 297 : 210;
      const a4H = isLandscape ? 210 : 297;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation, compress: true });

      const pxW = isLandscape ? 1123 : 794;
      const pxH = isLandscape ? 794 : 1123;

      for (let i = 0; i < pages.length; i++) {
        iframe.style.height = `${pxH}px`;
        iframeDoc.body.style.width = `${pxW}px`;
        iframeDoc.body.style.height = `${pxH}px`;

        const canvas = await html2canvas(pages[i], {
          scale: 3, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff',
          foreignObjectRendering: true, imageTimeout: 15000,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage('a4', orientation);
        pdf.addImage(imgData, 'JPEG', 0, 0, a4W, a4H);
      }

      return pdf.output('blob');
    } finally {
      iframe.remove();
    }
  };

  const downloadPdfBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPDF = async () => {
    if (filteredItems.length === 0) {
      toast.error('لا توجد لوحات للتحميل');
      return;
    }

    if (loading) return;
    setLoading(true);
    toast.info('جاري تحضير ملف PDF...');

    try {
      const isTableLandscape = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const pdfBlob = await buildPdfBlobFromHtml(html, isTableLandscape);
      const pdfFileName = `لوحات_${contextNumber}_${filteredItems.length}لوحة.pdf`;
      downloadPdfBlob(pdfBlob, pdfFileName);
      toast.success('تم تحميل ملف PDF بنجاح');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('فشل في تحضير ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsAppUpload = async (phone: string, teamName?: string) => {
    if (!phone) {
      toast.error('لا يوجد رقم واتساب لهذا الفريق');
      return;
    }

    setLoading(true);
    try {
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();

      const isTableLandscape = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const preparedHtml = await prepareHtmlForPdf(html, isTableLandscape);
      const { htmlToPdfBlobOptimized } = await import('@/utils/pdfHelpers');
      const pdfBlob = await htmlToPdfBlobOptimized(preparedHtml, `upload_${contextNumber}.pdf`, { marginMm: [0, 0, 0, 0], landscape: isTableLandscape });
      const base64Data = await blobToBase64(pdfBlob);
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');

      const driveFolder = contextType === 'installation' ? 'installation-tasks' : contextType === 'removal' ? 'removal-tasks' : 'contracts';
      const pdfFileName = `${getContextLabel()}_${contextNumber}${adType ? '_' + adType : ''}_${filteredItems.length}لوحة.pdf`;
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', driveFolder, false, progress);

      const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
      const message = [
        `مرحباً،`,
        '',
        `نرسل لك ملف ${printMode === 'table' ? 'جدول' : 'لوحات'} ${getContextLabel()} رقم ${contextNumber}.`,
        '',
        `رابط الملف:`,
        pdfUrl,
      ].join('\n');

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      toast.success('تم رفع الملف وفتح واتساب بنجاح');
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading PDF to WhatsApp:', error);
      toast.error('فشل في رفع الملف أو فتح واتساب');
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle = title || `${getContextLabel()} لوحات`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
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

          {/* نوع الطباعة (بطاقات / جدول) */}
          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <Label className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              نوع الطباعة
            </Label>
            <div className="flex gap-2">
              <Button
                variant={printMode === 'cards' ? 'default' : 'outline'}
                onClick={() => setPrintMode('cards')}
                className="flex-1 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                بطاقات (صفحة لكل لوحة)
              </Button>
              <Button
                variant={printMode === 'table' ? 'default' : 'outline'}
                onClick={() => setPrintMode('table')}
                className="flex-1 flex items-center gap-2"
              >
                <Table2 className="h-4 w-4" />
                جدول
              </Button>
            </div>
          </div>

          {/* إعدادات البطاقات */}
          {printMode === 'cards' && (
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
                  إعدادات طباعة اللوحات
                </Button>
              </div>
            </div>
          )}

          {/* إعدادات الجدول */}
          {printMode === 'table' && (
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  جدول يحتوي على جميع اللوحات مع الصور والتفاصيل
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTableSettingsDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  إعدادات الجدول
                </Button>
              </div>
            </div>
          )}

          {/* خيارات الطباعة */}
          <div className="space-y-3">
            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="includeDesigns"
                  checked={includeDesigns}
                  onCheckedChange={(c) => setIncludeDesigns(!!c)}
                />
                <Label htmlFor="includeDesigns" className="cursor-pointer flex-1">تضمين التصاميم</Label>
              </div>
            )}

            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="showInstalledImages"
                  checked={showInstalledImages}
                  onCheckedChange={(c) => setShowInstalledImages(!!c)}
                />
                <Label htmlFor="showInstalledImages" className="cursor-pointer flex-1">إظهار صور التركيب الفعلية</Label>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="hideInstallDate"
                checked={hideInstallDate}
                onCheckedChange={(c) => setHideInstallDate(!!c)}
              />
              <Label htmlFor="hideInstallDate" className="cursor-pointer flex-1">
                إخفاء تاريخ التركيب
              </Label>
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
            <Button 
              onClick={handlePrint} 
              disabled={loading || settingsLoading || tableSettingsLoading || filteredItems.length === 0} 
              className="flex-1"
            >
              <Printer className="h-4 w-4 ml-2" />
              طباعة {printMode === 'table' ? 'جدول' : 'بطاقات'}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={loading || settingsLoading || filteredItems.length === 0} 
              variant="secondary" 
              className="flex-1"
            >
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
            {selectedTeamIds.size > 0 && (() => {
              const teamsWithPhone = Array.from(selectedTeamIds)
                .map(id => teams[id])
                .filter(t => t?.phone_number || t?.phone);
              const firstTeam = teamsWithPhone[0];
              const savedPhone = firstTeam?.phone_number || firstTeam?.phone;
              
              return (
                <div className="flex-1 flex flex-col gap-2">
                  {showWhatsAppInput && !savedPhone ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="أدخل رقم واتساب الفريق"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="flex-1 text-right"
                        dir="ltr"
                      />
                      <Button
                        onClick={() => {
                          if (manualPhone.trim()) {
                            handleSendWhatsAppUpload(manualPhone.trim());
                            setShowWhatsAppInput(false);
                            setManualPhone('');
                          } else {
                            toast.error('أدخل رقم الهاتف أولاً');
                          }
                        }}
                        variant="outline"
                        className="gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10"
                        disabled={loading || filteredItems.length === 0}
                      >
                        <MessageCircle className="h-4 w-4" />
                        إرسال
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        if (savedPhone) {
                          handleSendWhatsAppUpload(savedPhone);
                        } else {
                          setShowWhatsAppInput(true);
                        }
                      }}
                      variant="outline"
                      className="w-full gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10"
                      disabled={loading || filteredItems.length === 0}
                    >
                      <MessageCircle className="h-4 w-4" />
                      واتساب الفريق
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </DialogContent>
      
      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />

      <TablePrintSettingsDialog
        open={tableSettingsDialogOpen}
        onOpenChange={setTableSettingsDialogOpen}
        settings={tableSettings}
        onUpdateSetting={updateTableSetting}
        onSave={async () => {
          const ok = await saveTableSettings(tableSettings);
          if (ok) setTableSettingsDialogOpen(false);
        }}
        onReset={resetTableSettings}
        saving={savingTableSettings}
      />
    </Dialog>
  );
}
