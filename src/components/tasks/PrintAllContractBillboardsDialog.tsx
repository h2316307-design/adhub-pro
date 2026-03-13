import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, FileDown, Users, Check, FileText, Settings2, Table2, Layers } from 'lucide-react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import { useTablePrintSettings } from '@/hooks/useTablePrintSettings';
import { TablePrintSettingsDialog } from './TablePrintSettingsDialog';

interface PrintAllContractBillboardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractNumber: number;
  customerName: string;
  allTaskItems: any[];
  tasks: any[];
  billboards: Record<number, any>;
  teams: Record<string, any>;
  designsByTask: Record<string, any[]>;
  taskId?: string;
}

export function PrintAllContractBillboardsDialog({
  open,
  onOpenChange,
  contractNumber,
  customerName,
  allTaskItems,
  tasks,
  billboards,
  teams,
  designsByTask,
  taskId
}: PrintAllContractBillboardsDialogProps) {
  const [printScope, setPrintScope] = useState<'task' | 'contract'>(taskId ? 'task' : 'contract');
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [printMode, setPrintMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [adType, setAdType] = useState('');
  const [contractAdTypes, setContractAdTypes] = useState<Record<number, string>>({});
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  const [tableSettingsDialogOpen, setTableSettingsDialogOpen] = useState(false);
  
  // جلب إعدادات التخصيص من قاعدة البيانات
  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();
  const { 
    settings: tableSettings, 
    loading: tableSettingsLoading,
    updateSetting: updateTableSetting,
    saveSettings: saveTableSettings,
    resetToDefaults: resetTableSettings,
    saving: savingTableSettings
  } = useTablePrintSettings();

  // جمع كل اللوحات من جميع الفرق للعقد المحدد أو جميع المهام الممررة مباشرة
  const contractTasks = useMemo(() => {
    // إذا كان النطاق "هذه المهمة فقط" وتم تمرير taskId
    // نعرض جميع الفرق لنفس العقد ونفس نوع المهمة ونفس رقم إعادة التركيب
    if (printScope === 'task' && taskId) {
      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask) {
        const currentType = currentTask.task_type || 'installation';
        const currentReinstallNum = currentTask.reinstallation_number ?? null;
        // جلب كل المهام لنفس العقد ونفس النوع ونفس رقم إعادة التركيب (كل الفرق)
        return tasks.filter(t => {
          if (t.contract_id !== currentTask.contract_id) return false;
          if ((t.task_type || 'installation') !== currentType) return false;
          // لإعادة التركيب: تجميع حسب reinstallation_number
          if (currentType === 'reinstallation') {
            return (t.reinstallation_number ?? null) === currentReinstallNum;
          }
          return true;
        });
      }
      return tasks.filter(t => t.id === taskId);
    }
    // إذا كانت المهام ممررة مباشرة (من تحديد متعدد)، استخدمها مباشرة
    if (tasks.length > 0 && allTaskItems.length > 0) {
      const taskIds = new Set(tasks.map(t => t.id));
      const hasMatchingItems = allTaskItems.some(item => taskIds.has(item.task_id));
      if (hasMatchingItems) {
        return tasks;
      }
    }
    // الفلترة التقليدية حسب رقم العقد
    return tasks.filter(t => t.contract_id === contractNumber || (t.contract_ids && t.contract_ids.includes(contractNumber)));
  }, [tasks, contractNumber, allTaskItems, printScope, taskId]);

  const allContractItems = useMemo(() => {
    const taskIds = new Set(contractTasks.map(t => t.id));
    return allTaskItems.filter(item => taskIds.has(item.task_id));
  }, [allTaskItems, contractTasks]);

  // تجميع اللوحات حسب الفريق
  const itemsByTeam = useMemo(() => {
    const groups: Record<string, any[]> = {};
    allContractItems.forEach(item => {
      const task = contractTasks.find(t => t.id === item.task_id);
      const teamId = task?.team_id || 'unknown';
      if (!groups[teamId]) groups[teamId] = [];
      groups[teamId].push(item);
    });
    return groups;
  }, [allContractItems, contractTasks]);

  // متغير لتتبع ما إذا تم تهيئة الفرق المختارة
  const [teamsInitialized, setTeamsInitialized] = useState(false);

  // اختيار كل الفرق عند الفتح فقط (مرة واحدة)
  useEffect(() => {
    if (open && !teamsInitialized && Object.keys(itemsByTeam).length > 0) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
      setTeamsInitialized(true);
    }
    if (!open) {
      setTeamsInitialized(false);
      setPrintScope(taskId ? 'task' : 'contract');
    }
  }, [open, teamsInitialized, itemsByTeam]);

  // جلب نوع الإعلان لجميع العقود المرتبطة باللوحات (مهم للمهام المدمجة)
  useEffect(() => {
    if (open) {
      setAdType('');
      setContractAdTypes({});
      setLoading(false);
      
      const fetchContractData = async () => {
        try {
          // جمع كل أرقام العقود الفريدة من اللوحات
          const allContractNumbers = new Set<number>();
          allContractNumbers.add(contractNumber);
          allTaskItems.forEach(item => {
            const billboard = billboards[item.billboard_id];
            if (billboard?.Contract_Number) {
              allContractNumbers.add(billboard.Contract_Number);
            }
          });
          // أيضاً من المهام نفسها
          tasks.forEach(t => {
            if (t.contract_id) allContractNumbers.add(t.contract_id);
            if (t.contract_ids) t.contract_ids.forEach((id: number) => allContractNumbers.add(id));
          });

          const contractNums = Array.from(allContractNumbers);
          const { data: contractsData } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', contractNums);
          
          const adTypesMap: Record<number, string> = {};
          (contractsData || []).forEach((c: any) => {
            adTypesMap[c.Contract_Number] = c['Ad Type'] || '';
          });
          
          setContractAdTypes(adTypesMap);
          setAdType(adTypesMap[contractNumber] || 'لوحة إعلانية');
        } catch (error) {
          console.error('Error fetching contract data:', error);
        }
      };
      
      fetchContractData();
    }
  }, [open, contractNumber, allTaskItems, billboards, tasks]);

  // اللوحات المفلترة حسب الفرق المختارة
  const contractItems = useMemo(() => {
    if (selectedTeamIds.size === 0) return [];
    return allContractItems.filter(item => {
      const task = contractTasks.find(t => t.id === item.task_id);
      const teamId = task?.team_id || 'unknown';
      return selectedTeamIds.has(teamId);
    });
  }, [allContractItems, contractTasks, selectedTeamIds]);

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

  const selectAllTeams = () => {
    setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
  };

  const clearTeamSelection = () => {
    setSelectedTeamIds(new Set());
  };

  // ترتيب اللوحات حسب المقاس ثم البلدية ثم المستوى (متماثل مع ContractPDFDialog)
  const sortBillboardsBySize = async (items: any[]) => {
    try {
      // جلب بيانات الترتيب من جميع الجداول
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizesData = sizesRes.data || [];
      const municipalitiesData = municipalitiesRes.data || [];
      const levelsData = levelsRes.data || [];
      
      // ربط كل لوحة ببيانات الترتيب (نفس منطق ContractPDFDialog)
      const itemsWithSortRanks = items.map((item) => {
        const billboard = billboards[item.billboard_id];
        const sizeObj = sizesData.find(sz => sz.name === billboard?.Size);
        const municipalityObj = municipalitiesData.find(m => m.name === billboard?.Municipality);
        const levelObj = levelsData.find(l => l.level_code === billboard?.Level);
        return {
          ...item,
          size_order: sizeObj?.sort_order ?? 999,
          municipality_order: municipalityObj?.sort_order ?? 999,
          level_order: levelObj?.sort_order ?? 999,
        };
      });
      
      // ترتيب اللوحات: المقاس أولاً، ثم البلدية، ثم المستوى
      return itemsWithSortRanks.sort((a, b) => {
        if (a.size_order !== b.size_order) return a.size_order - b.size_order;
        if (a.municipality_order !== b.municipality_order) return a.municipality_order - b.municipality_order;
        return a.level_order - b.level_order;
      });
    } catch (e) {
      console.error('Error sorting billboards:', e);
      return items;
    }
  };

  const generatePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(contractItems);
    const pages: string[] = [];
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

    for (const item of sortedItems) {
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      // الحصول على التصميم
      let designFaceA = item.design_face_a;
      let designFaceB = item.design_face_b;
      
      const task = contractTasks.find(t => t.id === item.task_id);
      if (!designFaceA && task) {
        const taskDesigns = designsByTask[task.id] || [];
        const selectedDesign = taskDesigns.find((d: any) => d.id === item.selected_design_id) || taskDesigns[0];
        if (selectedDesign) {
          designFaceA = selectedDesign.design_face_a_url;
          designFaceB = selectedDesign.design_face_b_url;
        }
      }

      // صور التركيب
      const installedImageFaceA = item.installed_image_face_a_url;
      const installedImageFaceB = item.installed_image_face_b_url;

      // منطق اختيار الصورة الرئيسية
      const mainImage = installedImageFaceA && !installedImageFaceB 
        ? installedImageFaceA 
        : (billboard.Image_URL || '');

      // إنشاء QR code - حتى لو لا توجد إحداثيات
      let qrCodeDataUrl = '';
      const coords = billboard.GPS_Coordinates || '';
      const mapLink = coords 
        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
        : 'https://www.google.com/maps?q=';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 100 });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }

      

      const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
      const municipality = billboard.Municipality || '';
      const district = billboard.District || '';
      const landmark = billboard.Nearest_Landmark || '';
      const size = billboard.Size || '';
      const facesCount = billboard.Faces_Count || 1;
      const facesToInstall = item.faces_to_install || facesCount;
      
      // Smart face logic: determine which faces are actually relevant
      const isSingleFaceBillboard = facesCount === 1;
      const isSingleFaceInstall = facesToInstall === 1;
      const hasDesignA = !!designFaceA;
      const hasDesignB = !!designFaceB;
      const hasInstalledA = !!installedImageFaceA;
      const hasInstalledB = !!installedImageFaceB;
      
      // Effective: only show face B if billboard has 2+ faces AND install requires 2 faces AND content exists
      const showFaceB = !isSingleFaceBillboard && !isSingleFaceInstall;
      const effectiveDesignA = hasDesignA ? designFaceA : null;
      const effectiveDesignB = showFaceB && hasDesignB ? designFaceB : null;
      const effectiveInstalledA = hasInstalledA ? installedImageFaceA : null;
      const effectiveInstalledB = showFaceB && hasInstalledB ? installedImageFaceB : null;
      
      const hasDesigns = effectiveDesignA || effectiveDesignB;
      const imageHeight = includeDesigns && hasDesigns ? '80mm' : '140mm';
      
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      // تاريخ التركيب
      const installationDate = item.installation_date 
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      // استخدام الإعدادات المخصصة من قاعدة البيانات
      const s = customSettings;
      
      // استخدام رقم العقد ونوع الإعلان الخاصَّين بكل لوحة (مهم للمهام المدمجة)
      const itemContractNumber = billboard.Contract_Number || contractNumber;
      const itemAdType = contractAdTypes[itemContractNumber] || adType || '';
      
      pages.push(`
        <div class="page">
          <div class="background"></div>

          <!-- رقم العقد ونوع الإعلان معاً - خاص بكل لوحة -->
          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; text-align: ${s.contract_number_alignment}; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''}">
            عقد رقم: ${itemContractNumber}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}
          </div>

          <!-- تاريخ التركيب -->
          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${s.installation_date_font_weight || '400'}; color: ${s.installation_date_color}; text-align: ${s.installation_date_alignment}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''}">
            تاريخ التركيب: ${installationDate}
          </div>
          ` : ''}

          <!-- اسم اللوحة -->
          <div class="absolute-field billboard-name" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(${s.billboard_name_offset_x && s.billboard_name_offset_x !== '0mm' ? `calc(-50% + ${s.billboard_name_offset_x})` : '-50%'}); width: 120mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          <!-- المقاس -->
          <div class="absolute-field size" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(${s.size_offset_x && s.size_offset_x !== '0mm' ? `calc(-50% + ${s.size_offset_x})` : '-50%'}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${size}
          </div>
          
          <!-- عدد الأوجه تحت المقاس -->
          <div class="absolute-field faces-count" style="top: ${s.faces_count_top}; left: ${s.faces_count_left}; transform: translateX(${s.faces_count_offset_x && s.faces_count_offset_x !== '0mm' ? `calc(-50% + ${s.faces_count_offset_x})` : '-50%'}); width: 80mm; text-align: ${s.faces_count_alignment || 'center'}; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
          </div>

          <!-- النوع (عميل/فريق تركيب) -->
          ${printType === 'installation' ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${s.team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${s.team_name_alignment}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''}">
               فريق التركيب: ${Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')}
            </div>
          ` : ''}

          <!-- صورة اللوحة أو صور التركيب -->
          ${effectiveInstalledA && effectiveInstalledB ? `
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: ${s.installed_images_left}; transform: translateX(-50%); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الأمامي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${effectiveInstalledA}" alt="التركيب - الوجه الأمامي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الخلفي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${effectiveInstalledB}" alt="التركيب - الوجه الخلفي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
            </div>
          ` : effectiveInstalledA ? `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              <img src="${effectiveInstalledA}" alt="صورة التركيب" class="billboard-image" />
            </div>
          ` : mainImage ? `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />
            </div>
          ` : ''}

          <!-- البلدية - الحي -->
          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: calc(${toCssLength(s.location_info_left)} + ${toMmOffset(s.location_info_offset_x)}); width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment};">
            ${municipalityDistrict}
          </div>

          <!-- أقرب معلم -->
          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: calc(${toCssLength(s.landmark_info_left)} + ${toMmOffset(s.landmark_info_offset_x)}); width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment};">
            ${landmark || '—'}
          </div>

          <!-- QR Code -->
          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <a href="${mapLink}" target="_blank" style="display:block;width:100%;height:100%;" title="اضغط لفتح الموقع على الخريطة">
                <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" style="cursor:pointer;" />
              </a>
            </div>
          ` : ''}

          <!-- التصاميم -->
          ${includeDesigns && hasDesigns ? `
            <div class="absolute-field designs-section" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; gap: ${s.designs_gap}; ${effectiveDesignA && !effectiveDesignB ? 'justify-content: center;' : ''}">
              ${effectiveDesignA ? `
                <div class="design-item" ${!effectiveDesignB ? 'style="max-width: 60%;"' : ''}>
                  <div class="design-label">${effectiveDesignB ? 'التصميم - الوجه الأمامي' : 'التصميم'}</div>
                  <img src="${effectiveDesignA}" alt="التصميم" class="design-image" style="max-height: ${s.design_image_height};" />
                </div>
              ` : ''}
              ${effectiveDesignB ? `
                <div class="design-item" ${!effectiveDesignA ? 'style="max-width: 60%;"' : ''}>
                  <div class="design-label">${effectiveDesignA ? 'التصميم - الوجه الخلفي' : 'التصميم'}</div>
                  <img src="${effectiveDesignB}" alt="التصميم" class="design-image" style="max-height: ${s.design_image_height};" />
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    // أسماء الفرق المختارة
    const selectedTeamNames = Array.from(selectedTeamIds)
      .map(id => teams[id]?.team_name)
      .filter(Boolean)
      .join(' - ');

    // ✅ استخدام رقم العقد الحالي فقط (لا نقرأ من billboard.Contract_Number لأنه قد يكون من عقد سابق)
    const contractNumbersStr = String(contractNumber);
    const adTypesStr = adType || '';

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تركيب - عقد #${contractNumbersStr} - ${customerName}${adTypesStr ? ` - ${adTypesStr}` : ''} - ${contractItems.length} لوحة${selectedTeamNames ? ` - ${selectedTeamNames}` : ''}</title>
        <style>
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            padding: 0;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .page:last-child {
            page-break-after: auto;
          }

          .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
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

          /* --- أحجام الخطوط المخصصة --- */
          .billboard-name {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 20px;
            font-weight: 500;
            color: #333;
          }

          .size {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 41px;
            font-weight: 700;
          }
          
          .ad-type {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            color: #000;
          }

          .contract-number {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
            font-weight: 500;
          }

          .location-info,
          .landmark-info {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
          }

          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
          }

          .billboard-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }

          .qr-code {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .designs-section {
            flex-wrap: wrap;
          }

          .design-item {
            flex: 1;
            min-width: 70mm;
            text-align: center;
          }

          .design-label {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            color: #333;
          }

          .design-image {
            width: 100%;
            max-height: 42mm;
            object-fit: contain;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0;
              padding: 0;
              background: white;
            }
            .page {
              page-break-after: always;
              page-break-inside: avoid;
              margin: 0;
              box-shadow: none;
              height: 297mm;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        ${pages.join('\n')}
        <script>
          // انتظار تحميل الخطوط قبل الطباعة
          document.fonts.ready.then(function() {
            // انتظار تحميل جميع الصور
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= totalImages) {
                setTimeout(function() {
                  window.print();
                }, 300);
              }
            }
            
            if (totalImages === 0) {
              setTimeout(function() {
                window.print();
              }, 300);
            } else {
              images.forEach(function(img) {
                if (img.complete) {
                  checkAllLoaded();
                } else {
                  img.onload = checkAllLoaded;
                  img.onerror = checkAllLoaded;
                }
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // دالة إنشاء HTML للجدول - تنسيق fares2 مع أسود وذهبي
  const generateTablePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(contractItems);
    // استخدام الألوان الثابتة من fares2 مباشرة
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
    
    const selectedTeamNames = Array.from(selectedTeamIds)
      .map(id => teams[id]?.team_name)
      .filter(Boolean)
      .join(' - ');

    // استخراج الأعمدة المفعلة مرتبة
    const enabledColumns = [...s.columns_order]
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    // تحليل بيانات اللوحات لمعرفة الأعمدة الفارغة
    const columnHasData: Record<string, boolean> = {};
    enabledColumns.forEach(col => {
      columnHasData[col.id] = false;
    });

    // فحص كل لوحة لتحديد الأعمدة التي تحتوي على بيانات
    sortedItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      if (!billboard) return;

      // تجهيز بيانات الصف
      let designFaceA = item.design_face_a;
      let designFaceB = item.design_face_b;
      const task = contractTasks.find(t => t.id === item.task_id);
      if (!designFaceA && task) {
        const taskDesigns = designsByTask[task.id] || [];
        const selectedDesign = taskDesigns.find((d: any) => d.id === item.selected_design_id) || taskDesigns[0];
        if (selectedDesign) {
          designFaceA = selectedDesign.design_face_a_url;
          designFaceB = selectedDesign.design_face_b_url;
        }
      }

      enabledColumns.forEach(col => {
        switch (col.id) {
          case 'row_number':
            columnHasData[col.id] = true;
            break;
          case 'billboard_image':
            if (billboard.Image_URL) columnHasData[col.id] = true;
            break;
          case 'billboard_name':
            if (billboard.Billboard_Name) columnHasData[col.id] = true;
            break;
          case 'size':
            if (billboard.Size) columnHasData[col.id] = true;
            break;
          case 'faces_count':
            if (billboard.Faces_Count) columnHasData[col.id] = true;
            break;
          case 'location':
            if (billboard.Municipality || billboard.District) columnHasData[col.id] = true;
            break;
          case 'landmark':
            if (billboard.Nearest_Landmark) columnHasData[col.id] = true;
            break;
          case 'contract_number':
            if (billboard.Contract_Number || contractNumber) columnHasData[col.id] = true;
            break;
          case 'installation_date':
            if (item.installation_date) columnHasData[col.id] = true;
            break;
          case 'design_images':
            if (designFaceA || designFaceB) columnHasData[col.id] = true;
            break;
          case 'installed_images':
            if (item.installed_image_face_a_url || item.installed_image_face_b_url) columnHasData[col.id] = true;
            break;
          case 'qr_code':
            if (billboard.GPS_Coordinates) columnHasData[col.id] = true;
            break;
        }
      });
    });

    // الأعمدة النهائية (مع إخفاء الفارغة إن كان مفعلاً)
    const finalColumns = s.auto_hide_empty_columns 
      ? enabledColumns.filter(col => columnHasData[col.id])
      : enabledColumns;

    // تقسيم اللوحات إلى صفحات - أقصى 11 صف في الصفحة
    const pages: string[] = [];
    const rowsPerPage = Math.min(s.rows_per_page || 11, 11);
    
    for (let pageIndex = 0; pageIndex < Math.ceil(sortedItems.length / rowsPerPage); pageIndex++) {
      const pageItems = sortedItems.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      
      const tableRows = await Promise.all(pageItems.map(async (item, index) => {
        const billboard = billboards[item.billboard_id];
        if (!billboard) return '';
        
        const globalIndex = pageIndex * rowsPerPage + index + 1;
        const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
        const municipality = billboard.Municipality || '';
        const district = billboard.District || '';
        const landmark = billboard.Nearest_Landmark || '';
        const size = billboard.Size || '';
        const facesCount = billboard.Faces_Count || 1;
        const itemContractNumber = billboard.Contract_Number || contractNumber;
        const itemAdType = contractAdTypes[itemContractNumber] || adType || '';
        
        // التصاميم
        let designFaceA = item.design_face_a;
        let designFaceB = item.design_face_b;
        const task = contractTasks.find(t => t.id === item.task_id);
        if (!designFaceA && task) {
          const taskDesigns = designsByTask[task.id] || [];
          const selectedDesign = taskDesigns.find((d: any) => d.id === item.selected_design_id) || taskDesigns[0];
          if (selectedDesign) {
            designFaceA = selectedDesign.design_face_a_url;
            designFaceB = selectedDesign.design_face_b_url;
          }
        }
        
        // صور التركيب
        const installedImageFaceA = item.installed_image_face_a_url;
        const installedImageFaceB = item.installed_image_face_b_url;
        
        // تاريخ التركيب
        const installationDate = item.installation_date 
          ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        // QR Code
        let qrCodeDataUrl = '';
        let mapLink = '';
        if (finalColumns.some(c => c.id === 'qr_code')) {
          const coords = billboard.GPS_Coordinates || '';
          mapLink = coords 
            ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
            : '';
          if (coords) {
            try {
              qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 50 });
            } catch (error) {
              console.error('Error generating QR code:', error);
            }
          }
        }

        const rowBg = '#ffffff'; // خلفية بيضاء دائماً مثل fares2
        
        // إنشاء خلايا الصف حسب ترتيب الأعمدة - مطابق لـ fares2
        const cells = finalColumns.map((col, colIndex) => {
          const isFirstColumn = colIndex === 0;

          switch (col.id) {
            case 'row_number':
              return `<td class="number-cell"><div class="billboard-number">${globalIndex}</div></td>`;
            case 'billboard_image':
              return `<td class="image-cell">
                ${billboard.Image_URL 
                  ? `<img src="${billboard.Image_URL}" alt="${name}" class="billboard-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="image-placeholder" style="display:none;"><span>صورة</span></div>`
                  : `<div class="image-placeholder"><span>صورة</span></div>`
                }
              </td>`;
            case 'billboard_name':
              return `<td style="font-weight: 600; text-align: right; padding: 4px; font-size: 8px;">${name}</td>`;
            case 'size':
              return `<td style="font-weight: 600; font-size: 8px; color: #000000;">${size}</td>`;
            case 'faces_count':
              return `<td style="font-size: 9px; padding: 2px; font-weight: 700;">${facesCount}</td>`;
            case 'location':
              return `<td style="font-weight: 500; text-align: right; padding: 4px; font-size: 8px;">${[municipality, district].filter(Boolean).join(' - ') || '-'}</td>`;
            case 'landmark':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${landmark || '-'}</td>`;
            case 'contract_number':
              return `<td style="font-size: 8px; padding: 2px;">${itemContractNumber}${itemAdType ? '<br/><span style="font-size:7px;color:#666;">' + itemAdType + '</span>' : ''}</td>`;
            case 'installation_date':
              return `<td style="font-size: 8px; padding: 2px;">${installationDate}</td>`;
            case 'design_images':
              return `<td class="image-cell">
                <div class="img-group">
                  ${designFaceA ? `<img src="${designFaceA}" alt="أمامي" class="design-img" />` : ''}
                  ${designFaceB ? `<img src="${designFaceB}" alt="خلفي" class="design-img" />` : ''}
                  ${!designFaceA && !designFaceB ? '-' : ''}
                </div>
              </td>`;
            case 'installed_images':
              return `<td class="image-cell">
                <div class="img-group">
                  ${installedImageFaceA ? `<img src="${installedImageFaceA}" alt="أمامي" class="installed-img" />` : ''}
                  ${installedImageFaceB ? `<img src="${installedImageFaceB}" alt="خلفي" class="installed-img" />` : ''}
                  ${!installedImageFaceA && !installedImageFaceB ? '-' : ''}
                </div>
              </td>`;
            case 'qr_code':
              return `<td class="qr-cell" style="padding: 2px;">
                ${qrCodeDataUrl && mapLink 
                  ? `<a href="${mapLink}" target="_blank" class="qr-link" title="اضغط لفتح الموقع على الخريطة">
                       <img src="${qrCodeDataUrl}" class="qr-code" style="width: 50px; height: 50px; object-fit: contain;" alt="QR" />
                     </a>`
                  : '<span style="color: #999; font-size: 7px;">-</span>'
                }
              </td>`;
            default:
              return '';
          }
        });
        
        return `<tr style="height: 60px; background: ${rowBg};">${cells.join('')}</tr>`;
      }));

      // إنشاء رؤوس الأعمدة مع عرض كل عمود
      const headerCells = finalColumns.map((col, colIndex) => {
        const isFirstColumn = colIndex === 0;
        const headerStyle = isFirstColumn 
          ? `background: ${s.first_column_bg_color}; color: ${s.first_column_text_color}; width: ${col.width || '8%'};`
          : `width: ${col.width || '8%'};`;
        return `<th class="header-cell" style="${headerStyle}">${col.label}</th>`;
      });

      // محتوى الصفحة - مطابق لتنسيق fares2 مع خلفية repo.svg
      pages.push(`
        <div class="info-bar">
          <span>عقد رقم: ${contractNumber} | العميل: ${customerName}${adType ? ' | ' + adType : ''}${selectedTeamNames ? ' | الفريق: ' + selectedTeamNames : ''} | صفحة ${pageIndex + 1} من ${Math.ceil(sortedItems.length / rowsPerPage)}</span>
        </div>
        <table>
          <thead>
            <tr>${headerCells.join('')}</tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>
      `);
    }

    const isLandscape = s.page_orientation === 'landscape';
    const pageMargin = s.page_margin || '8mm';
    const tableTopMargin = s.table_top_margin || '10mm';
    const rowHeight = s.row_height || '60px';
    const qrSize = s.qr_code_size || '50px';
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>جدول لوحات العقد #${contractNumber} - ${customerName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @font-face {
            font-family: 'Doran';
            src: url('/fonts/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }

          @page {
            size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 0;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: '${s.primary_font}', 'Tajawal', 'Arial', sans-serif;
            direction: rtl;
            background: #ffffff;
            color: #000;
            line-height: 1.3;
            font-size: ${s.row_font_size};
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

          .page:last-child {
            page-break-after: auto;
          }

          /* خلفية الصفحة - repo.svg */
          .page-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('/repo.svg');
            background-size: 100% 100%;
            background-repeat: no-repeat;
            z-index: 0;
          }

          .page-content {
            position: relative;
            z-index: 1;
            padding-top: ${tableTopMargin};
          }

          .info-bar {
            margin-bottom: 8px;
            padding: 6px 10px;
            background: ${s.header_bg_color};
            display: inline-block;
          }

          .info-bar span {
            font-size: 10px;
            color: ${s.header_text_color};
            font-weight: 700;
          }

          /* Table Styles - مطابق لـ fares2 */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: ${s.row_font_size};
            background: #ffffff;
          }

          th {
            background: ${s.header_bg_color};
            color: ${s.header_text_color};
            font-weight: 700;
            font-size: ${s.header_font_size};
            height: 30px;
            border: 1px solid ${s.border_color};
            padding: 4px 2px;
            text-align: center;
          }

          td {
            border: 1px solid ${s.border_color};
            padding: 2px;
            text-align: center;
            vertical-align: middle;
            background: #ffffff;
            color: #000;
          }

          /* العمود الأول - ذهبي مثل fares2 */
          td.number-cell {
            background: ${s.first_column_bg_color};
            padding: 2px;
            font-weight: 700;
            font-size: 9px;
            color: ${s.first_column_text_color};
            width: 60px;
          }

          td.image-cell {
            background: #ffffff;
            padding: 0;
            width: 70px;
          }

          .billboard-image {
            width: 100%;
            height: auto;
            max-height: ${rowHeight};
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }

          .billboard-number {
            color: ${s.first_column_text_color};
            font-weight: 700;
            font-size: 9px;
          }

          td.qr-cell {
            width: 60px;
            padding: 2px;
            vertical-align: middle;
          }

          .qr-code {
            width: 100%;
            height: auto;
            max-height: ${rowHeight};
            display: block;
            margin: 0 auto;
            cursor: pointer;
          }

          .qr-link {
            display: block;
            text-align: center;
          }

          .img-group {
            display: flex;
            gap: 2px;
            justify-content: center;
            align-items: center;
          }

          .design-img, .installed-img {
            max-width: 48%;
            max-height: calc(${rowHeight} - 4px);
            object-fit: contain;
          }

          .image-placeholder {
            width: 100%;
            height: ${rowHeight};
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            color: #666;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              background: #ffffff !important;
              margin: 0;
              padding: 0;
            }
            .no-print { display: none; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            td, th, .billboard-image, .image-placeholder, td.image-cell, td.number-cell {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .page {
              page-break-after: always;
              margin: 0;
              box-shadow: none;
              height: ${isLandscape ? '210mm' : '297mm'};
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        ${pages.map((pageContent, idx) => `
          <div class="page">
            <div class="page-background"></div>
            <div class="page-content">
              ${pageContent}
            </div>
          </div>
        `).join('\n')}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        <\/script>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    console.log('🖨️ handlePrint called', { printMode, printType, contractItemsCount: contractItems.length, loading });
    
    if (contractItems.length === 0) {
      console.log('❌ No items to print');
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    if (loading) {
      console.log('⏳ Already loading, returning');
      return; // منع النقر المزدوج
    }
    
    setLoading(true);
    console.log('🔄 Starting print generation...');
    try {
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      console.log('✅ HTML generated, opening print window...');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        console.log('✅ Print window opened successfully');
        toast.success(`تم تحضير ${contractItems.length} ${printMode === 'table' ? 'صف' : 'صفحة'} للطباعة ${printType === 'installation' ? '(فريق التركيب)' : '(العميل)'}`);
        
        // إعادة تفعيل الزر عند إغلاق النافذة المنبثقة
        const checkWindowClosed = setInterval(() => {
          if (printWindow.closed) {
            clearInterval(checkWindowClosed);
            setLoading(false);
            console.log('🔄 Print window closed, button re-enabled');
          }
        }, 500);
        
        // إعادة التفعيل بعد 30 ثانية كحد أقصى
        setTimeout(() => {
          clearInterval(checkWindowClosed);
          setLoading(false);
        }, 30000);
      } else {
        console.log('❌ Print window blocked by browser');
        toast.error('تم حظر نافذة الطباعة من المتصفح. يرجى السماح بالنوافذ المنبثقة');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error printing:', error);
      toast.error('فشل في تحضير الطباعة');
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (contractItems.length === 0) {
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

      // انتظار تحميل الصور
      const images = container.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imagePromises);

      const options = {
        margin: 0,
        filename: `عقد_${contractNumber}_جميع_اللوحات.pdf`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span>تركيب لوحات العقد</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
              {printType === 'installation' && (
                <Badge variant="secondary">فريق التركيب</Badge>
              )}
              {adType && (
                <Badge variant="secondary">{adType}</Badge>
              )}
              <span className="font-semibold text-foreground">{customerName}</span>
              <span>•</span>
              <span>عقد #{contractNumber}</span>
              <span>•</span>
              <Badge className="bg-primary/20 text-primary border-0">{contractItems.length} لوحة</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* نطاق الطباعة */}
          {taskId && (
            <div className="p-3 bg-muted/50 rounded-xl border">
              <Label className="text-sm font-bold flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" />
                نطاق الطباعة
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={printScope === 'task' ? 'default' : 'outline'}
                  onClick={() => setPrintScope('task')}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  هذه المهمة فقط
                </Button>
                <Button
                  variant={printScope === 'contract' ? 'default' : 'outline'}
                  onClick={() => setPrintScope('contract')}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  جميع مهام العقد
                </Button>
              </div>
            </div>
          )}

          {/* اختيار الفرق */}
          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                اختر الفرق للطباعة
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllTeams}>
                  الكل
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearTeamSelection}>
                  مسح
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Object.entries(itemsByTeam).map(([teamId, items]) => {
                const isSelected = selectedTeamIds.has(teamId);
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
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">اللوحات المحددة:</span>
              <Badge className="text-sm font-bold">{contractItems.length} لوحة</Badge>
            </div>
          </div>

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

          {/* إعدادات البطاقات (تظهر فقط في وضع البطاقات) */}
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
                  تخصيص الطباعة
                </Button>
              </div>
            </div>
          )}

          {/* إعدادات الجدول (تظهر فقط في وضع الجدول) */}
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
                نسخة فريق التركيب
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
              disabled={loading || settingsLoading || tableSettingsLoading || contractItems.length === 0} 
              className="flex-1"
            >
              <Printer className="h-4 w-4 ml-2" />
              طباعة {printMode === 'table' ? 'جدول' : 'بطاقات'}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={loading || settingsLoading || contractItems.length === 0} 
              variant="secondary" 
              className="flex-1"
            >
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* نافذة تخصيص البطاقات */}
      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />

      {/* نافذة إعدادات الجدول */}
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