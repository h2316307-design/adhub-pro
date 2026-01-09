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
import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';

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
  designsByTask
}: PrintAllContractBillboardsDialogProps) {
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [adType, setAdType] = useState('');
  const [contractAdTypes, setContractAdTypes] = useState<Record<number, string>>({});
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  
  // جلب إعدادات التخصيص من قاعدة البيانات
  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();

  // جمع كل اللوحات من جميع الفرق للعقد المحدد أو جميع المهام الممررة مباشرة
  const contractTasks = useMemo(() => {
    // إذا كانت المهام ممررة مباشرة (من تحديد متعدد)، استخدمها مباشرة
    if (tasks.length > 0 && allTaskItems.length > 0) {
      // تحقق مما إذا كانت allTaskItems تنتمي لهذه المهام
      const taskIds = new Set(tasks.map(t => t.id));
      const hasMatchingItems = allTaskItems.some(item => taskIds.has(item.task_id));
      if (hasMatchingItems) {
        return tasks;
      }
    }
    // الفلترة التقليدية حسب رقم العقد
    return tasks.filter(t => t.contract_id === contractNumber || (t.contract_ids && t.contract_ids.includes(contractNumber)));
  }, [tasks, contractNumber, allTaskItems]);

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

  // اختيار كل الفرق عند الفتح وجلب رقم العقد ونوع الإعلان لكل لوحة
  useEffect(() => {
    if (open) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
      
      // جلب رقم العقد ونوع الإعلان لكل لوحة من جدول billboards
      const billboardIds = allContractItems.map(item => item.billboard_id);
      if (billboardIds.length > 0) {
        supabase
          .from('billboards')
          .select('ID, Contract_Number')
          .in('ID', billboardIds)
          .then(async ({ data: billboardsData }) => {
            // جمع أرقام العقود الفريدة
            const uniqueContractNumbers = [...new Set(
              (billboardsData || [])
                .map(b => b.Contract_Number)
                .filter((c): c is number => c !== null)
            )];
            
            if (uniqueContractNumbers.length > 0) {
              // جلب نوع الإعلان لكل عقد
              const { data: contractsData } = await supabase
                .from('Contract')
                .select('Contract_Number, "Ad Type"')
                .in('Contract_Number', uniqueContractNumbers);
              
              const adTypesMap: Record<number, string> = {};
              (contractsData || []).forEach(c => {
                adTypesMap[c.Contract_Number] = c['Ad Type'] || '';
              });
              setContractAdTypes(adTypesMap);
              
              // تعيين نوع الإعلان الأول كقيمة افتراضية
              if (contractsData && contractsData.length > 0) {
                setAdType(contractsData[0]['Ad Type'] || '');
              }
            }
          });
      }
      
      // جلب نوع الإعلان للعقد الرئيسي
      supabase
        .from('Contract')
        .select('"Ad Type"')
        .eq('Contract_Number', contractNumber)
        .single()
        .then(({ data }) => {
          setAdType(data?.['Ad Type'] || '');
        });
    }
  }, [open, itemsByTeam, contractNumber, allContractItems]);

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

      const hasDesigns = designFaceA || designFaceB;
      const imageHeight = includeDesigns && hasDesigns ? '80mm' : '140mm';
      
      const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
      const municipality = billboard.Municipality || '';
      const district = billboard.District || '';
      const landmark = billboard.Nearest_Landmark || '';
      const size = billboard.Size || '';
      const facesCount = billboard.Faces_Count || 1;
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      // تاريخ التركيب
      const installationDate = item.installation_date 
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      // استخدام الإعدادات المخصصة من قاعدة البيانات
      const s = customSettings;
      
      // جلب رقم العقد ونوع الإعلان الخاص بكل لوحة
      const itemContractNumber = billboard.Contract_Number || contractNumber;
      const itemAdType = contractAdTypes[itemContractNumber] || adType;
      
      pages.push(`
        <div class="page">
          <div class="background"></div>

          <!-- رقم العقد ونوع الإعلان معاً - خاص بكل لوحة -->
          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight};">
            عقد رقم: ${itemContractNumber}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}
          </div>

          <!-- تاريخ التركيب -->
          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: 400;">
            تاريخ التركيب: ${installationDate}
          </div>
          ` : ''}

          <!-- اسم اللوحة -->
          <div class="absolute-field billboard-name" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(-50%); width: 120mm; text-align: center; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          <!-- المقاس -->
          <div class="absolute-field size" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${size}
          </div>
          
          <!-- عدد الأوجه تحت المقاس -->
          <div class="absolute-field faces-count" style="top: ${s.faces_count_top}; left: ${s.faces_count_left}; transform: translateX(-50%); width: 80mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
          </div>

          <!-- النوع (عميل/فريق تركيب) -->
          ${printType === 'installation' ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: #000; font-weight: ${s.team_name_font_weight};">
               فريق التركيب: ${Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')}
            </div>
          ` : ''}

          <!-- صورة اللوحة أو صور التركيب للوجهين -->
          ${installedImageFaceA && installedImageFaceB ? `
            <!-- عرض صورتي التركيب بجانب بعض -->
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: ${s.installed_images_left}; transform: translateX(-50%); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الأمامي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceA}" alt="التركيب - الوجه الأمامي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الخلفي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceB}" alt="التركيب - الوجه الخلفي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
            </div>
          ` : mainImage ? `
            <!-- عرض الصورة الواحدة -->
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />
            </div>
          ` : ''}

          <!-- البلدية - الحي -->
          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: ${s.location_info_left}; width: ${s.location_info_width}; font-size: ${s.location_info_font_size};">
            ${municipalityDistrict}
          </div>

          <!-- أقرب معلم -->
          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: ${s.landmark_info_left}; width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size};">
            ${landmark || '—'}
          </div>

          <!-- QR Code -->
          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" />
            </div>
          ` : ''}

          <!-- التصاميم -->
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

    // أسماء الفرق المختارة
    const selectedTeamNames = Array.from(selectedTeamIds)
      .map(id => teams[id]?.team_name)
      .filter(Boolean)
      .join(' - ');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تركيب #${contractNumber} - ${customerName} - ${adType || 'إعلان'} - ${contractItems.length} لوحة${selectedTeamNames ? ` - ${selectedTeamNames}` : ''}</title>
        <style>
          @font-face {
            font-family: 'Manrope';
            src: url('/fonts/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/fonts/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            padding: 0;
            margin: 0;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            page-break-after: always;
            overflow: hidden;
          }

          .page:last-child {
            page-break-after: avoid;
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
          }

          /* --- أحجام الخطوط المخصصة --- */
          .billboard-name {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 20px;
            font-weight: 500;
            color: #333;
          }

          .size {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 41px;
            font-weight: 500;
          }
          
          .ad-type {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 14px;
            font-weight: 600;
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
              margin: 0;
              box-shadow: none;
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
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (contractItems.length === 0) {
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
        toast.success(`تم تحضير ${contractItems.length} صفحة للطباعة ${printType === 'installation' ? '(فريق التركيب)' : '(العميل)'}`);
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
                نسخة فريق التركيب
              </Button>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={handlePrint} disabled={loading || settingsLoading || contractItems.length === 0} className="flex-1">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={handleDownloadPDF} disabled={loading || settingsLoading || contractItems.length === 0} variant="secondary" className="flex-1">
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* نافذة التخصيص */}
      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />
    </Dialog>
  );
}