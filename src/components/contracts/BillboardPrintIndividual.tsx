import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Printer } from 'lucide-react';
import { SendBillboardPDFWhatsApp } from './SendBillboardPDFWhatsApp';

interface BillboardPrintIndividualProps {
  contractNumber: string | number;
  billboards: any[];
  designData?: any[] | null;
  customerPhone?: string;
  taskItems?: any[]; // ✅ بيانات مهام التركيب/الإزالة تحتوي على صور اللوحات
  printMode?: 'installation' | 'removal'; // ✅ NEW: نوع الطباعة (تركيب أو إزالة)
}

export const BillboardPrintIndividual: React.FC<BillboardPrintIndividualProps> = ({
  contractNumber,
  billboards,
  designData,
  customerPhone = '',
  taskItems = [],
  printMode = 'installation' // ✅ NEW: القيمة الافتراضية تركيب
}) => {
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [installationTeams, setInstallationTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [adType, setAdType] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // جلب فرق التركيب ونوع الإعلان من العقد
  useEffect(() => {
    const fetchData = async () => {
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name');
      if (teams) setInstallationTeams(teams);

      // جلب نوع الإعلان من العقد
      const { data: contract } = await supabase
        .from('Contract')
        .select('"Ad Type"')
        .eq('Contract_Number', Number(contractNumber))
        .single();
      if (contract) setAdType(contract['Ad Type'] || '');
    };
    fetchData();
  }, [contractNumber]);

  // ترتيب اللوحات حسب المقاس ثم البلدية ثم المستوى
  const sortBillboardsBySize = async (boards: any[]) => {
    try {
      // جلب بيانات الترتيب من الجداول الثلاثة
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      // إنشاء خرائط الترتيب
      const sizeOrderMap = new Map<string, number>();
      (sizesRes.data || []).forEach((s: any) => {
        if (!sizeOrderMap.has(s.name)) {
          sizeOrderMap.set(s.name, s.sort_order ?? 999);
        }
      });
      
      const municipalityOrderMap = new Map<string, number>();
      (municipalitiesRes.data || []).forEach((m: any) => {
        if (!municipalityOrderMap.has(m.name)) {
          municipalityOrderMap.set(m.name, m.sort_order ?? 999);
        }
      });
      
      const levelOrderMap = new Map<string, number>();
      (levelsRes.data || []).forEach((l: any) => {
        if (!levelOrderMap.has(l.level_code)) {
          levelOrderMap.set(l.level_code, l.sort_order ?? 999);
        }
      });
      
      return [...boards].sort((a, b) => {
        // ترتيب أولاً حسب المقاس
        const sizeA = a.Size || a.size || '';
        const sizeB = b.Size || b.size || '';
        const sizeOrderA = sizeOrderMap.get(sizeA) ?? 999;
        const sizeOrderB = sizeOrderMap.get(sizeB) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        // ثانياً حسب البلدية
        const municipalityA = a.Municipality || a.municipality || '';
        const municipalityB = b.Municipality || b.municipality || '';
        const municipalityOrderA = municipalityOrderMap.get(municipalityA) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(municipalityB) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        // ثالثاً حسب المستوى
        const levelA = a.Level || a.level || '';
        const levelB = b.Level || b.level || '';
        const levelOrderA = levelOrderMap.get(levelA) ?? 999;
        const levelOrderB = levelOrderMap.get(levelB) ?? 999;
        return levelOrderA - levelOrderB;
      });
    } catch (error) {
      console.warn('Failed to sort billboards:', error);
      return boards;
    }
  };

  const handlePrint = async () => {
    try {
      if (!billboards || billboards.length === 0) {
        toast.info('لا توجد لوحات للطباعة');
        return;
      }

      // ترتيب اللوحات حسب المقاس
      let sortedBillboards = await sortBillboardsBySize(billboards);

      // تصفية حسب فريق التركيب - فقط عند طباعة لفريق التركيب
      // طباعة للعميل تطبع كل اللوحات من جميع الفرق
      if (printType === 'installation' && selectedTeam !== 'all') {
        const team = installationTeams.find(t => t.id === selectedTeam);
        if (team && team.sizes) {
          sortedBillboards = sortedBillboards.filter((b: any) => {
            const size = b.Size || b.size || '';
            return team.sizes.includes(size);
          });
        }
      }

      if (sortedBillboards.length === 0) {
        toast.info('لا توجد لوحات تطابق المقاسات المختارة لهذا الفريق');
        return;
      }

      // جلب التصاميم من design_data أو مباشرة من اللوحة أو من taskItems
      const getDesignsForBillboard = async (billboardId: number) => {
        // أولاً: محاولة الحصول على التصاميم من taskItems (من task_designs table)
        const taskItem = taskItems.find(item => item.billboard_id === billboardId);
        if (taskItem) {
          // إذا كان هناك selected_design_id، جلب التصميم من task_designs
          if (taskItem.selected_design_id) {
            try {
              const { data: selectedDesign } = await supabase
                .from('task_designs')
                .select('design_face_a_url, design_face_b_url')
                .eq('id', taskItem.selected_design_id)
                .single();
              
              if (selectedDesign) {
                return {
                  faceA: selectedDesign.design_face_a_url || null,
                  faceB: selectedDesign.design_face_b_url || null
                };
              }
            } catch (error) {
              console.warn('Failed to load design from task_designs:', error);
            }
          }
          
          // إذا كان في taskItem تصاميم مباشرة
          if (taskItem.design_face_a || taskItem.design_face_b) {
            return {
              faceA: taskItem.design_face_a || null,
              faceB: taskItem.design_face_b || null
            };
          }
        }

        // ثانياً: محاولة الحصول من اللوحة نفسها
        const billboard = billboards.find((b: any) => (b.ID || b.id) === billboardId);
        if (billboard?.design_face_a || billboard?.design_face_b) {
          return {
            faceA: billboard.design_face_a || null,
            faceB: billboard.design_face_b || null
          };
        }

        // ثالثاً: محاولة الحصول من design_data (من العقد)
        if (designData && Array.isArray(designData)) {
          const design = designData.find((d: any) => Number(d.billboardId) === billboardId);
          if (design) {
            return {
              faceA: design?.faceA || null,
              faceB: design?.faceB || null
            };
          }
        }

        return { faceA: null, faceB: null };
      };

      // Check if any billboard has designs (async check)
      let hasAnyDesigns = false;
      for (const b of sortedBillboards) {
        const billboardId = b.ID || b.id;
        const designs = await getDesignsForBillboard(billboardId);
        if (designs.faceA || designs.faceB || b.design_face_a || b.design_face_b) {
          hasAnyDesigns = true;
          break;
        }
      }
      const imageHeight = includeDesigns && hasAnyDesigns ? '80mm' : '140mm';
      
      const pagesHtml = await Promise.all(
        sortedBillboards.map(async (billboard) => {
          const billboardId = billboard.ID || billboard.id;
          const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboardId}`;
          
          // جلب taskItem للحصول على صور التركيب
          const taskItem = taskItems.find(item => item.billboard_id === billboardId);
          const installedImageFaceA = taskItem?.installed_image_face_a_url;
          const installedImageFaceB = taskItem?.installed_image_face_b_url;
          
          // منطق اختيار الصورة:
          // 1. إذا كانت هناك صورة تركيب للوجه الأمامي فقط، تظهر بدل صورة اللوحة الأصلية
          // 2. إذا كانت هناك صورتان (أمامي وخلفي)، يتم عرضهما بجانب بعض فوق التصاميم
          const mainImage = installedImageFaceA && !installedImageFaceB 
            ? installedImageFaceA 
            : (billboard.Image_URL || billboard.image || '');
          
          const municipality = billboard.Municipality || billboard.municipality || '';
          const district = billboard.District || billboard.district || '';
          const landmark = billboard.Nearest_Landmark || billboard.nearest_landmark || '';
          const size = billboard.Size || billboard.size || '';
          const facesCount = billboard.Faces_Count || billboard.faces_count || 1;
          
          const coords = billboard.GPS_Coordinates || '';
          const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : 'https://www.google.com/maps?q=';

          // جلب تصاميم اللوحة من جميع المصادر
          const designs = await getDesignsForBillboard(billboardId);
          const billboardDesignA = designs.faceA;
          const billboardDesignB = designs.faceB;

          let qrCodeDataURL = '';
          if (coords) {
            try {
              qrCodeDataURL = await QRCode.toDataURL(mapLink, { width: 100 });
            } catch (e) {
              console.warn('Failed to generate QR code:', e);
            }
          }

          const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';
          const hasDesigns = billboardDesignA || billboardDesignB;

          // تاريخ التركيب من taskItem
          const installationDate = taskItem?.installation_date 
            ? new Date(taskItem.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';

          // نوع الإعلان: أولوية للوحة نفسها، ثم النوع العام من العقد
          const billboardAdType = billboard.Ad_Type || billboard.ad_type || adType || '';
          
          return `
            <div class="page">
              <div class="background"></div>

              <!-- رقم العقد ونوع الإعلان معاً -->
              <div class="absolute-field contract-number" style="top: 39.869mm;right: 22mm;">
                ${printMode === 'removal' ? 'إزالة دعاية' : 'عقد رقم: ' + contractNumber}${billboardAdType ? ' - نوع الإعلان: ' + billboardAdType : ''}
              </div>

              <!-- تاريخ التركيب -->
              ${installationDate ? `
              <div class="absolute-field installation-date" style="top: 42.869mm; right: 116mm; font-family: 'Doran', Arial, sans-serif; font-size: 11px; font-weight: 400;">
                تاريخ التركيب: ${installationDate}
              </div>
              ` : ''}

              <!-- اسم اللوحة -->
              <div class="absolute-field billboard-name" style="top: 55.588mm;left: 15.5%;transform: translateX(-50%);width: 120mm;text-align: center;">
                ${name}
              </div>

              <!-- المقاس -->
              <div class="absolute-field size" style="top: 51mm;left: 63%;transform: translateX(-50%);width: 80mm;text-align: center;">
                ${size}
              </div>
              
              <!-- عدد الأوجه تحت المقاس -->
              <div class="absolute-field faces-count" style="top: 63mm;left: 64%;transform: translateX(-50%);width: 80mm;text-align: center;font-size: 12px;color: #000;">
                ${taskItem?.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
              </div>

              <!-- النوع (عميل/فريق تركيب) -->
              ${printType === 'installation' ? `
                <div class="absolute-field print-type" style="top: 45mm; right: 22mm; font-size: 14px; color: #d4af37; font-weight: bold;">
                   فريق التركيب
                </div>
              ` : ''}

              <!-- صورة اللوحة أو صور التركيب للوجهين -->
              ${installedImageFaceA && installedImageFaceB ? `
                <!-- عرض صورتي التركيب بجانب بعض -->
                <div class="absolute-field" style="top: 88mm; left: 50%; transform: translateX(-50%); width: 180mm; display: flex; gap: 5mm;">
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الأمامي</div>
                    <div style="height: ${imageHeight}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                      <img src="${installedImageFaceA}" alt="التركيب - الوجه الأمامي" style="width: 100%; height: 100%; object-fit: contain;" />
                    </div>
                  </div>
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الخلفي</div>
                    <div style="height: ${imageHeight}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                      <img src="${installedImageFaceB}" alt="التركيب - الوجه الخلفي" style="width: 100%; height: 100%; object-fit: contain;" />
                    </div>
                  </div>
                </div>
              ` : mainImage ? `
                <!-- عرض الصورة الواحدة (صورة أصلية أو صورة تركيب وجه أمامي) -->
                <div class="absolute-field image-container" style="top: 90mm; left: 50%; transform: translateX(-50%); width: 120mm; height: ${imageHeight};">
                  <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />
                </div>
              ` : ''}

              <!-- البلدية - الحي -->
              <div class="absolute-field location-info" style="top: 233mm;left: 0;width: 150mm;">
                ${municipalityDistrict}
              </div>

              <!-- أقرب معلم -->
              <div class="absolute-field landmark-info" style="top: 241mm;left: 0mm;width: 150mm;">
                ${landmark || '—'}
              </div>

              <!-- QR Code -->
              ${qrCodeDataURL ? `
                <div class="absolute-field qr-container" style="top: 255mm; left: 65mm; width: 30mm; height: 30mm;">
                  <img src="${qrCodeDataURL}" alt="QR" class="qr-code" />
                </div>
              ` : ''}

              <!-- التصاميم (فقط) - لا تعرض صور التركيب هنا إذا كانت معروضة أعلاه -->
              ${includeDesigns && hasDesigns ? `
                <div class="absolute-field designs-section" style="top: 178mm; left: 16mm; width: 178mm; display: flex; gap: 10mm;">
                  ${billboardDesignA ? `
                    <div class="design-item">
                      <div class="design-label">التصميم - الوجه الأمامي</div>
                      <img src="${billboardDesignA}" alt="التصميم - الوجه الأمامي" class="design-image" />
                    </div>
                  ` : ''}
                  ${billboardDesignB ? `
                    <div class="design-item">
                      <div class="design-label">التصميم - الوجه الخلفي</div>
                      <img src="${billboardDesignB}" alt="التصميم - الوجه الخلفي" class="design-image" />
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        })
      );

      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>${printMode === 'removal' ? 'إزالة دعاية' : 'فاتورة تركيب'} - عقد ${contractNumber}</title>
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
              background-image: url('/ipg.svg');
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
              /* إطار أسود حول الصورة */
              border: 3px solid #000;
              border-radius: 0 0 0 8px; /* اختياري: زوايا سفلية فقط */
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
            
            .installed-image-label {
              font-family: 'Doran', Arial, sans-serif;
              font-size: 11px;
              font-weight: 600;
              margin-bottom: 3px;
              color: #000;
              background: rgba(0, 0, 0, 0.05);
              padding: 2px 6px;
              border-radius: 3px;
            }
            
            .installed-image {
              width: 100%;
              max-height: 35mm;
              object-fit: contain;
              border: 2px solid #000;
              border-radius: 4px;
              margin-bottom: 4mm;
              background: rgba(0, 0, 0, 0.02);
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
              .controls {
                display: none !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }

            .controls {
              position: fixed;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 9999;
              background: white;
              padding: 10px 20px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }

            .print-btn {
              background: #d4af37;
              color: #000;
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-size: 16px;
              font-family: 'Doran', Arial, sans-serif;
            }
            .print-btn:hover { background: #e3c14b; }
          </style>
        </head>
        <body>
          ${pagesHtml.join('\n')}
          <div class="controls">
            <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('فشل فتح نافذة الطباعة');
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
      }, 1000);

      const teamName = selectedTeam !== 'all' ? installationTeams.find(t => t.id === selectedTeam)?.team_name : '';
      toast.success(`تم تحضير ${sortedBillboards.length} صفحة للطباعة ${printType === 'installation' ? `(فريق التركيب${teamName ? ': ' + teamName : ''})` : '(العميل)'}`);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      if (!billboards || billboards.length === 0) {
        toast.info('لا توجد لوحات للتحميل');
        return;
      }

      let sortedBillboards = await sortBillboardsBySize(billboards);

      // تصفية حسب فريق التركيب - فقط عند طباعة لفريق التركيب
      // طباعة للعميل تطبع كل اللوحات من جميع الفرق
      if (printType === 'installation' && selectedTeam !== 'all') {
        const team = installationTeams.find(t => t.id === selectedTeam);
        if (team && team.sizes) {
          sortedBillboards = sortedBillboards.filter((b: any) => {
            const size = b.Size || b.size || '';
            return team.sizes.includes(size);
          });
        }
      }

      if (sortedBillboards.length === 0) {
        toast.info('لا توجد لوحات تطابق المقاسات المختارة لهذا الفريق');
        return;
      }

      // تحميل المكتبات
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;
      const QRCode = (await import('qrcode')).default;

      // تحميل الخلفية SVG
      let svgContent = '';
      try {
        const response = await fetch('/ipg.svg');
        svgContent = await response.text();
      } catch (e) {
        console.warn('Failed to load background SVG:', e);
      }

      const getDesignsForBillboard = (billboardId: number) => {
        if (!designData || !Array.isArray(designData)) return { faceA: null, faceB: null };
        const design = designData.find((d: any) => Number(d.billboardId) === billboardId);
        return {
          faceA: design?.faceA || null,
          faceB: design?.faceB || null
        };
      };

      const hasAnyDesigns = sortedBillboards.some((b: any) => {
        const designs = getDesignsForBillboard(b.ID || b.id);
        return designs.faceA || designs.faceB || b.design_face_a || b.design_face_b;
      });
      const imageHeight = includeDesigns && hasAnyDesigns ? '80mm' : '140mm';

      // إنشاء PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [793.7, 1122.5],
        compress: true
      });

      // إنشاء صفحات منفصلة
      const containers: HTMLElement[] = [];
      
      for (let i = 0; i < sortedBillboards.length; i++) {
        const billboard = sortedBillboards[i];
        const billboardId = billboard.ID || billboard.id;
        const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboardId}`;
        const image = billboard.Image_URL || billboard.image || '';
        const municipality = billboard.Municipality || billboard.municipality || '';
        const district = billboard.District || billboard.district || '';
        const landmark = billboard.Nearest_Landmark || billboard.nearest_landmark || '';
        const size = billboard.Size || billboard.size || '';
        const coords = billboard.GPS_Coordinates || '';
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : 'https://www.google.com/maps?q=';

        // جلب taskItem للحصول على تاريخ التركيب
        const taskItem = taskItems.find(item => item.billboard_id === billboardId);
        const installationDate = taskItem?.installation_date 
          ? new Date(taskItem.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '';

        const designs = getDesignsForBillboard(billboardId);
        const billboardDesignA = billboard.design_face_a || designs.faceA;
        const billboardDesignB = billboard.design_face_b || designs.faceB;

        let qrCodeDataURL = '';
        if (coords) {
          try {
            qrCodeDataURL = await QRCode.toDataURL(mapLink, { width: 250, margin: 1 });
          } catch (e) {
            console.warn('Failed to generate QR code:', e);
          }
        }

        const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';
        const hasDesigns = billboardDesignA || billboardDesignB;

        const pageHtml = `
          <div style="position: relative; width: 793.7px; height: 1122.5px; margin: 0; padding: 0; overflow: hidden; background: white;">
            ${svgContent ? `
              <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;">
                ${svgContent.replace(/<svg/, '<svg width="100%" height="100%" preserveAspectRatio="none"')}
              </div>
            ` : ''}

            <div style="position: absolute;top: 40mm; right: 12mm;font-size: 14px;font-weight: 700;"> 
              عقد رقم: ${contractNumber}
            </div>

            ${adType ? `
              <div style="position: absolute; top: 40mm; right: 35mm; font-size: 14px; font-weight: 700;">
                نوع الإعلان: ${adType}
              </div>
            ` : ''}

            ${installationDate ? `
              <div style="position: absolute; top: 42.869mm; right: 116mm; font-family: 'Doran', Arial, sans-serif; font-size: 11px; font-weight: 400;">
                تاريخ التركيب: ${installationDate}
              </div>
            ` : ''}

            <div style="position: absolute; top: 200px; left: 16%; transform: translateX(-50%); width: 450px; text-align: center; font-family: 'Manrope', Arial, sans-serif; font-size: 20px; font-weight: 700; color: #111; z-index: 10; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
              ${name}
            </div>

            <div style="position: absolute; top: 184px; left: 63%; transform: translateX(-50%); width: 300px; text-align: center; font-family: 'Manrope', Arial, sans-serif; font-size: 35px; font-weight: 900; color: #000; z-index: 10; text-shadow: 0 1px 3px rgba(255,255,255,0.9);">
              ${size}
            </div>

            ${printType === 'installation' ? `
              <div style="position: absolute; top: 170px; right: 83px; font-size: 18px; color: #d4af37; font-weight: 900; z-index: 10; font-family: 'Doran', Arial, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                 فريق التركيب
              </div>
            ` : ''}

${image ? `
  <div style="
    position: absolute;
    top: 340px;
    left: 0;
    right: 0;
    width: min(650px, 95vw);
    height: ${imageHeight === '80mm' ? '350px' : '650px'};
    margin: 0 auto;
    overflow: hidden;
    background: rgba(255,255,255,0.95);
    border: 4px solid #000;
    border-radius: 0 0 10px 10px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    justify-content: center;
    align-items: center;
  ">
    <img 
      src="${image}" 
      alt="صورة اللوحة" 
      style="
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
      " 
      crossorigin="anonymous"
    />
  </div>
` : ''}
            <div style="position: absolute; top: 229mm; left: 0; width: 150mm; font-family: 'Doran', Arial, sans-serif; font-size: 21px; font-weight: 700; color: #000; z-index: 10; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
              ${municipalityDistrict}
            </div>

            <div style="position: absolute; top: 239mm; left: 0; width: 150mm; font-family: 'Doran', Arial, sans-serif; font-size: 21px; font-weight: 500; color: #000; z-index: 10; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
              ${landmark || '—'}
            </div>

            ${qrCodeDataURL ? `
              <div style="position: absolute; top: 970px; left: 245px; width: 100px; height: 100px; z-index: 10;">
                <img src="${qrCodeDataURL}" alt="QR" style="width: 100%; height: 100%; object-fit: contain; background: white; padding: 3px; border-radius: 5px;" />
              </div>
            ` : ''}

            ${includeDesigns && hasDesigns ? `
              <div style="position: absolute; top: 700px; left: 75px; width: 640px; display: flex; gap: 38px; z-index: 10;">
                ${billboardDesignA ? `
                  <div style="flex: 1; min-width: 260px; text-align: center;">
                    <div style="font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 700; margin-bottom: 15px; color: #111; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">الوجه الأمامي</div>
                    <img src="${billboardDesignA}" alt="الوجه الأمامي" style="width: 100%; max-height: 159px; object-fit: contain; border: 3px solid #ccc; border-radius: 6px; background: white;" crossorigin="anonymous" />
                  </div>
                ` : ''}
                ${billboardDesignB ? `
                  <div style="flex: 1; min-width: 260px; text-align: center;">
                    <div style="font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 700; margin-bottom: 15px; color: #111; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">الوجه الخلفي</div>
                    <img src="${billboardDesignB}" alt="الوجه الخلفي" style="width: 100%; max-height: 159px; object-fit: contain; border: 3px solid #ccc; border-radius: 6px; background: white;" crossorigin="anonymous" />
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `;

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.innerHTML = `
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Doran:wght@400;500;700;900&display=swap" rel="stylesheet">
          <div style="font-family: 'Doran', Arial, sans-serif; direction: rtl;">
            ${pageHtml}
          </div>
        `;
        
        document.body.appendChild(container);
        containers.push(container);
      }

      // انتظار تحميل الخطوط والصور
      await new Promise(resolve => setTimeout(resolve, 2000));

      // معالجة كل صفحة
      for (let i = 0; i < containers.length; i++) {
        const pageElement = containers[i].querySelector('div > div') as HTMLElement;
        
        if (pageElement) {
          const canvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          
          if (i > 0) {
            pdf.addPage([793.7, 1122.5], 'portrait');
          }
          
          pdf.addImage(imgData, 'JPEG', 0, 0, 793.7, 1122.5, undefined, 'FAST');
        }
      }

      pdf.save(`عقد-${contractNumber}-لوحات.pdf`);
      
      // تنظيف
      containers.forEach(c => document.body.removeChild(c));
      
      const teamName = selectedTeam !== 'all' ? installationTeams.find(t => t.id === selectedTeam)?.team_name : '';
      toast.success(`تم تحميل ${sortedBillboards.length} صفحة كملف PDF ${printType === 'installation' ? `(فريق التركيب${teamName ? ': ' + teamName : ''})` : '(العميل)'}`);
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error('حدث خطأ أثناء تحميل PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-primary mb-4">خيارات طباعة اللوحات</h3>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            سيتم طباعة {billboards?.length || 0} لوحة في صفحات منفصلة مرتبة حسب المقاس
          </p>

          {/* نوع الطباعة */}
          <div className="space-y-3 bg-muted/50 rounded-lg p-4 border border-border">
            <Label className="text-sm font-bold text-primary">نوع الطباعة:</Label>
            <div className="flex items-center space-x-4 space-x-reverse gap-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="radio"
                  id="print-client"
                  name="printType"
                  value="client"
                  checked={printType === 'client'}
                  onChange={(e) => setPrintType(e.target.value as 'client' | 'installation')}
                  className="w-4 h-4 text-primary"
                />
                <Label htmlFor="print-client" className="text-sm cursor-pointer font-medium">
                  طباعة للعميل 📋
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="radio"
                  id="print-installation"
                  name="printType"
                  value="installation"
                  checked={printType === 'installation'}
                  onChange={(e) => setPrintType(e.target.value as 'client' | 'installation')}
                  className="w-4 h-4 text-primary"
                />
                <Label htmlFor="print-installation" className="text-sm cursor-pointer font-medium">
                  طباعة لفريق التركيب 🔧
                </Label>
              </div>
            </div>
          </div>

          {/* اختيار فريق التركيب */}
          {printType === 'installation' && installationTeams.length > 0 && (
            <div className="space-y-3 bg-muted/50 rounded-lg p-4 border border-border">
              <Label className="text-sm font-bold text-primary">اختر فريق التركيب:</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفريق" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع اللوحات</SelectItem>
                  {installationTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.team_name} ({team.sizes?.length || 0} مقاس)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* خيار تضمين التصاميم */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="include-designs"
              checked={includeDesigns}
              onCheckedChange={(checked) => setIncludeDesigns(checked as boolean)}
            />
            <Label
              htmlFor="include-designs"
              className="text-sm cursor-pointer font-medium"
            >
              تضمين التصميمات (الوجه الأمامي والخلفي)
            </Label>
          </div>
          
          {/* عرض حالة التصاميم */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            {(() => {
              const hasDesignData = designData && Array.isArray(designData) && designData.length > 0;
              const hasBillboardDesigns = billboards.some((b:any) => b.design_face_a || b.design_face_b);
              const designCount = billboards.filter((b:any) => {
                const billboardId = b.ID || b.id;
                const designs = designData?.find((d: any) => Number(d.billboardId) === billboardId);
                return b.design_face_a || b.design_face_b || designs?.faceA || designs?.faceB;
              }).length;
              
              return (hasDesignData || hasBillboardDesigns) ? (
                <div>
                  <p className="text-sm">
                    <span className="font-semibold text-primary">التصاميم متوفرة</span>
                    {` — عدد اللوحات التي تحتوي على تصميم: ${designCount}`}
                  </p>
                  {/* معاينة سريعة للتصاميم */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {billboards.filter((b:any)=> {
                      const billboardId = b.ID || b.id;
                      const designs = designData?.find((d: any) => Number(d.billboardId) === billboardId);
                      return b.design_face_a || b.design_face_b || designs?.faceA || designs?.faceB;
                    }).slice(0,4).map((b:any, idx:number) => {
                      const billboardId = b.ID || b.id;
                      const designs = designData?.find((d: any) => Number(d.billboardId) === billboardId);
                      const designImg = b.design_face_a || designs?.faceA || b.design_face_b || designs?.faceB;
                      return (
                        <div key={idx}>
                          <img src={designImg} alt={(b.Billboard_Name || b.name || 'لوحة') + ' تصميم'} className="w-full h-24 object-contain rounded border border-border bg-background" />
                          <div className="text-xs mt-1 text-muted-foreground text-center">{b.Billboard_Name || b.name || 'لوحة'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm">لا توجد تصاميم مرفقة لهذا العقد أو للوحات</p>
              );
            })()}
          </div>
          
          {!includeDesigns && (
            <div className="bg-accent/20 border border-accent rounded-lg p-3">
              <p className="text-sm text-accent-foreground">
                💡 عند إلغاء التصميمات، ستظهر صورة اللوحة بحجم أكبر
              </p>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-sm">
              <span className="font-bold text-primary">محتويات الطباعة:</span>
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
              <li>رقم اللوحة والمقاس</li>
              <li>صورة اللوحة {!includeDesigns && '(كبيرة ومركزية)'}</li>
              {includeDesigns && <li>التصميمات (الوجه الأمامي والخلفي)</li>}
              <li>الموقع وأقرب معلم</li>
              <li>QR code للموقع</li>
              <li className="font-bold text-primary">ترتيب تلقائي حسب المقاس</li>
              {printType === 'installation' && selectedTeam !== 'all' && (
                <li className="font-bold text-primary">تصفية حسب فريق التركيب المختار</li>
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4 flex-wrap">
            <SendBillboardPDFWhatsApp
              contractNumber={contractNumber}
              customerPhone={customerPhone}
              billboards={billboards}
              designData={designData}
              includeDesigns={includeDesigns}
              printType={printType}
              selectedTeam={selectedTeam}
              adType={adType}
            />
            <Button 
              onClick={handleDownloadPDF} 
              disabled={isDownloading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isDownloading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  جاري التحميل...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  تحميل PDF
                </>
              )}
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90"
            >
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
