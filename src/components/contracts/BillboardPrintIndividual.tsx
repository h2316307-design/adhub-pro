import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface BillboardPrintIndividualProps {
  contractNumber: string | number;
  billboards: any[];
  designFaceA?: string | null;
  designFaceB?: string | null;
}

export const BillboardPrintIndividual: React.FC<BillboardPrintIndividualProps> = ({
  contractNumber,
  billboards,
  designFaceA,
  designFaceB
}) => {
  const [open, setOpen] = useState(false);
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [installationTeams, setInstallationTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // فتح Dialog تلقائياً عند توفر البيانات
  useEffect(() => {
    if (billboards && billboards.length > 0) {
      setOpen(true);
    }
  }, [billboards]);

  // جلب فرق التركيب
  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name');
      if (data) setInstallationTeams(data);
    };
    fetchTeams();
  }, []);

  // ترتيب اللوحات حسب sort_order من pricing table
  const sortBillboardsBySize = async (boards: any[]) => {
    try {
      const { data: sizes } = await supabase
        .from('pricing')
        .select('size')
        .order('id', { ascending: true });
      
      if (!sizes || sizes.length === 0) {
        return boards;
      }
      
      const sizeOrderMap = new Map<string, number>();
      sizes.forEach((s: any, index: number) => {
        if (!sizeOrderMap.has(s.size)) {
          sizeOrderMap.set(s.size, index);
        }
      });
      
      return [...boards].sort((a, b) => {
        const sizeA = a.Size || a.size || '';
        const sizeB = b.Size || b.size || '';
        const orderA = sizeOrderMap.get(sizeA) ?? 999;
        const orderB = sizeOrderMap.get(sizeB) ?? 999;
        return orderA - orderB;
      });
    } catch (error) {
      console.warn('Failed to sort billboards:', error);
      return boards;
    }
  };

  const handlePrint = async () => {
    try {
      if (!billboards || billboards.length === 0) {
        toast.warning('لا توجد لوحات للطباعة');
        return;
      }

      // ترتيب اللوحات حسب المقاس
      let sortedBillboards = await sortBillboardsBySize(billboards);

      // تصفية حسب فريق التركيب
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
        toast.warning('لا توجد لوحات تطابق المقاسات المختارة لهذا الفريق');
        return;
      }

      const imageHeight = includeDesigns && (designFaceA || designFaceB) ? '80mm' : '140mm';
      
      const pagesHtml = await Promise.all(
        sortedBillboards.map(async (billboard) => {
          const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboard.ID}`;
          const image = billboard.Image_URL || billboard.image || '';
          const municipality = billboard.Municipality || billboard.municipality || '';
          const district = billboard.District || billboard.district || '';
          const landmark = billboard.Nearest_Landmark || billboard.nearest_landmark || '';
          const size = billboard.Size || billboard.size || '';
          // ✅ جلب الإحداثيات من GPS_Coordinates فقط
          const coords = billboard.GPS_Coordinates || '';
          // ✅ إنشاء رابط خرائط جوجل (حتى لو كان فارغاً)
          const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : 'https://www.google.com/maps?q=';

          // جلب تصاميم اللوحة الخاصة بها
          const billboardDesignA = billboard.design_face_a || designFaceA;
          const billboardDesignB = billboard.design_face_b || designFaceB;

          let qrCodeDataURL = '';
          if (mapLink) {
            try {
              qrCodeDataURL = await QRCode.toDataURL(mapLink, { width: 100 });
            } catch (e) {
              console.warn('Failed to generate QR code:', e);
            }
          }

          const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';
          const hasDesigns = billboardDesignA || billboardDesignB;

          return `
            <div class="page">
              <div class="background"></div>

              <!-- رقم العقد -->
              <div class="absolute-field contract-number" style="top: 39.869mm;right: 22mm;">
                عقد رقم: ${contractNumber}
              </div>

              <!-- اسم اللوحة -->
              <div class="absolute-field billboard-name" style="top: 55.588mm;left: 15.5%;transform: translateX(-50%);width: 120mm;text-align: center;">
                ${name}
              </div>

              <!-- المقاس -->
              <div class="absolute-field size" style="top: 52mm;left: 63%;transform: translateX(-50%);width: 80mm;text-align: center;">
                ${size}
              </div>

              <!-- النوع (عميل/فريق تركيب) -->
              ${printType === 'installation' ? `
                <div class="absolute-field print-type" style="top: 45mm; right: 22mm; font-size: 14px; color: #d4af37; font-weight: bold;">
                  🔧 فريق التركيب
                </div>
              ` : ''}

              <!-- صورة اللوحة (حجم متغير حسب التصاميم) -->
              ${image ? `
                <div class="absolute-field image-container" style="top: 90mm; left: 50%; transform: translateX(-50%); width: 120mm; height: ${imageHeight};">
                  <img src="${image}" alt="صورة اللوحة" class="billboard-image" />
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

              <!-- التصاميم -->
              ${hasDesigns ? `
                <div class="absolute-field designs-section" style="top: 180mm; left: 20mm; width: 170mm; display: flex; gap: 10mm;">
                  ${billboardDesignA ? `
                    <div class="design-item">
                      <div class="design-label">الوجه الأمامي</div>
                      <img src="${billboardDesignA}" alt="الوجه الأمامي" class="design-image" />
                    </div>
                  ` : ''}
                  ${billboardDesignB ? `
                    <div class="design-item">
                      <div class="design-label">الوجه الخلفي</div>
                      <img src="${billboardDesignB}" alt="الوجه الخلفي" class="design-image" />
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
          <title>فاتورة تركيب - عقد ${contractNumber}</title>
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
              border-radius: 0 0 8px 8px; /* اختياري: زوايا سفلية فقط */
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
              max-height: 60mm;
              object-fit: contain;
              border: 1px solid #ddd;
              border-radius: 4px;
            }

            @page {
              size: A4;
              margin: 0;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .controls {
                display: none !important;
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
      setOpen(false);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-primary">خيارات طباعة اللوحات</DialogTitle>
        </DialogHeader>

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
          {(designFaceA || designFaceB) && (
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
          )}
          
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
              {includeDesigns && (designFaceA || designFaceB) && <li>التصميمات</li>}
              <li>الموقع وأقرب معلم</li>
              <li>QR code للموقع</li>
              <li className="font-bold text-primary">ترتيب تلقائي حسب المقاس</li>
              {printType === 'installation' && selectedTeam !== 'all' && (
                <li className="font-bold text-primary">تصفية حسب فريق التركيب المختار</li>
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90"
            >
              طباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};