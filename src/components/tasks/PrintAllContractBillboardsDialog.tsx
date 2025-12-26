import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, FileDown, Users, Check, FileText } from 'lucide-react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';

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

  // جمع كل اللوحات من جميع الفرق للعقد المحدد
  const contractTasks = useMemo(() => 
    tasks.filter(t => t.contract_id === contractNumber || (t.contract_ids && t.contract_ids.includes(contractNumber))),
    [tasks, contractNumber]
  );

  const allContractItems = useMemo(() => 
    allTaskItems.filter(item => contractTasks.some(t => t.id === item.task_id)),
    [allTaskItems, contractTasks]
  );

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

  // اختيار كل الفرق عند الفتح
  useEffect(() => {
    if (open) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
      // جلب نوع الإعلان
      supabase
        .from('Contract')
        .select('"Ad Type"')
        .eq('Contract_Number', contractNumber)
        .single()
        .then(({ data }) => {
          setAdType(data?.['Ad Type'] || '');
        });
    }
  }, [open, itemsByTeam, contractNumber]);

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

  // ترتيب اللوحات حسب المقاس ثم البلدية ثم المستوى
  const sortBillboardsBySize = async (items: any[]) => {
    try {
      // جلب بيانات الترتيب من جميع الجداول
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizes = sizesRes.data || [];
      const municipalities = municipalitiesRes.data || [];
      const levels = levelsRes.data || [];
      
      const sizeOrderMap = new Map<string, number>();
      sizes.forEach((s: any) => {
        sizeOrderMap.set(s.name, s.sort_order ?? 999);
      });
      
      const municipalityOrderMap = new Map<string, number>();
      municipalities.forEach((m: any) => {
        municipalityOrderMap.set(m.name, m.sort_order ?? 999);
      });
      
      const levelOrderMap = new Map<string, number>();
      levels.forEach((l: any) => {
        levelOrderMap.set(l.level_code, l.sort_order ?? 999);
      });
      
      return [...items].sort((a, b) => {
        const billboardA = billboards[a.billboard_id];
        const billboardB = billboards[b.billboard_id];
        
        // ترتيب حسب المقاس أولاً
        const sizeOrderA = sizeOrderMap.get(billboardA?.Size) ?? 999;
        const sizeOrderB = sizeOrderMap.get(billboardB?.Size) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        // ثم حسب البلدية
        const municipalityOrderA = municipalityOrderMap.get(billboardA?.Municipality) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(billboardB?.Municipality) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        // ثم حسب المستوى
        const levelOrderA = levelOrderMap.get(billboardA?.Level) ?? 999;
        const levelOrderB = levelOrderMap.get(billboardB?.Level) ?? 999;
        return levelOrderA - levelOrderB;
      });
    } catch (e) {
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

      pages.push(`
        <div class="page">
          <div class="background"></div>

          <!-- رقم العقد ونوع الإعلان معاً -->
          <div class="absolute-field contract-number" style="top: 39.869mm;right: 22mm;">
            عقد رقم: ${contractNumber}${adType ? ' - نوع الإعلان: ' + adType : ''}
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
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
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
            <!-- عرض الصورة الواحدة -->
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
          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: 255mm; left: 65mm; width: 30mm; height: 30mm;">
              <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" />
            </div>
          ` : ''}

          <!-- التصاميم -->
          ${includeDesigns && hasDesigns ? `
            <div class="absolute-field designs-section" style="top: 178mm; left: 16mm; width: 178mm; display: flex; gap: 10mm;">
              ${designFaceA ? `
                <div class="design-item">
                  <div class="design-label">التصميم - الوجه الأمامي</div>
                  <img src="${designFaceA}" alt="التصميم - الوجه الأمامي" class="design-image" />
                </div>
              ` : ''}
              ${designFaceB ? `
                <div class="design-item">
                  <div class="design-label">التصميم - الوجه الخلفي</div>
                  <img src="${designFaceB}" alt="التصميم - الوجه الخلفي" class="design-image" />
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${printType === 'installation' ? 'تركيب' : 'طباعة'}${adType ? ` - ${adType}` : ''} - ${customerName} - عقد #${contractNumber} (${contractItems.length} لوحة)</title>
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
            <Button onClick={handlePrint} disabled={loading || contractItems.length === 0} className="flex-1">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={handleDownloadPDF} disabled={loading || contractItems.length === 0} variant="secondary" className="flex-1">
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}