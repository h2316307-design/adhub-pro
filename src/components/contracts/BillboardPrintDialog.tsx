import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Printer, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';

interface BillboardPrintDialogProps {
  contractId: string;
  designFaceA?: string;
  designFaceB?: string;
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  GPS_Coordinates: string;
  Image_URL: string;
  Nearest_Landmark: string;
  Municipality: string;
}

export default function BillboardPrintDialog({ 
  contractId, 
  designFaceA, 
  designFaceB 
}: BillboardPrintDialogProps) {
  const [open, setOpen] = useState(false);
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [loading, setLoading] = useState(false);

  const generatePrintHTML = async (billboards: Billboard[]) => {
    // ✅ Sort billboards by size sort_order
    const sortedBillboards = await sortBillboardsBySize(billboards);
    
    const pages = await Promise.all(sortedBillboards.map(async (billboard) => {
      // Generate QR code for GPS location
      let qrCodeDataUrl = '';
      if (billboard.GPS_Coordinates) {
        try {
          const mapsUrl = `https://www.google.com/maps/@${billboard.GPS_Coordinates}`;
          qrCodeDataUrl = await QRCode.toDataURL(mapsUrl);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      }

      // ✅ Adjust image height based on whether designs are included
      const imageHeight = includeDesigns && (designFaceA || designFaceB) ? '280px' : '480px';
      
      return `
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="logo">
              <img src="/logofares.svg" alt="Al-Fares Logo" style="height: 80px;" />
            </div>
            <div class="title">
              <h1>عقـــد إستئجــــار</h1>
              <h2>مساحـــة إعلانيـــة</h2>
            </div>
          </div>

          <!-- Billboard Info Cards -->
          <div class="info-cards">
            <div class="info-card">
              <div class="info-label">رقــــم المســــاحــــة<br/>الاعـــــلانيـــــة</div>
              <div class="info-value">${billboard.Billboard_Name || 'غير محدد'}</div>
            </div>
            <div class="info-card">
              <div class="info-label">مقاس المساحة<br/>الاعـــــلانيـــــة</div>
              <div class="info-value">${billboard.Size || 'غير محدد'}</div>
            </div>
          </div>

          <!-- Billboard Image -->
          <div class="billboard-image-container${!includeDesigns ? ' large-image' : ''}">
            <div class="image-label">${printType === 'installation' ? 'صورة اللوحة - فريق التركيب' : 'صورة المساحة الاعــــلانية'}</div>
            <img src="${billboard.Image_URL || '/placeholder-billboard.jpg'}" alt="Billboard" class="billboard-image" style="height: ${imageHeight};" />
          </div>

          ${includeDesigns && (designFaceA || designFaceB) ? `
          <!-- Design Images -->
          <div class="design-container">
            ${designFaceB ? `
            <div class="design-box">
              <div class="design-label">تصميم الوجه الثاني</div>
              <img src="${designFaceB}" alt="Design Face B" class="design-image" />
            </div>
            ` : ''}
            ${designFaceA ? `
            <div class="design-box">
              <div class="design-label">تصميم الوجه الاول</div>
              <img src="${designFaceA}" alt="Design Face A" class="design-image" />
            </div>
            ` : ''}
          </div>
          ` : ''}

          <!-- Location Info -->
          <div class="location-container">
            <div class="location-text">
              مكان المساحة الاعــــلانية  |  ${billboard.Municipality || 'ليبيا'} - ${billboard.Nearest_Landmark || 'طرابلس'}
            </div>
          </div>

          <!-- QR Code -->
          ${qrCodeDataUrl ? `
          <div class="qr-container">
            <div class="qr-box">
              <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code" />
              <div class="qr-text">امسح الكود للوصول<br/>لموقع المساحة الاعلانية</div>
            </div>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer-bar"></div>
        </div>
      `;
    }));

    return `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>طباعة اللوحات - عقد ${contractId}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            html, body {
              font-family: 'Cairo', Arial, sans-serif;
              background: white;
              direction: rtl;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            .page {
              width: 210mm;
              height: 297mm;
              padding: 15mm;
              position: relative;
              background: white;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: always;
              break-inside: avoid;
            }

            .page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            /* Header */
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 3px solid #d4af37;
            }

            .logo img {
              height: 80px;
            }

            .title {
              text-align: center;
              flex: 1;
            }

            .title h1 {
              font-size: 32px;
              font-weight: 800;
              color: #1a1a1a;
              margin-bottom: 5px;
              letter-spacing: 2px;
            }

            .title h2 {
              font-size: 24px;
              font-weight: 600;
              color: #666;
              letter-spacing: 1px;
            }

            /* Info Cards */
            .info-cards {
              display: flex;
              gap: 20px;
              justify-content: center;
              margin-bottom: 20px;
            }

            .info-card {
              flex: 1;
              max-width: 280px;
              border: 3px solid #1a1a1a;
              border-radius: 12px;
              padding: 15px;
              text-align: center;
              background: white;
            }

            .info-label {
              font-size: 14px;
              font-weight: 600;
              color: #666;
              margin-bottom: 8px;
              line-height: 1.4;
            }

            .info-value {
              font-size: 28px;
              font-weight: 800;
              color: #1a1a1a;
              letter-spacing: 1px;
            }

            /* Billboard Image */
            .billboard-image-container {
              margin-bottom: 20px;
              border: 4px solid #1a1a1a;
              border-radius: 16px;
              overflow: hidden;
              background: white;
            }

            .image-label {
              background: #1a1a1a;
              color: white;
              padding: 12px;
              text-align: center;
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 1px;
            }

            .billboard-image {
              width: 100%;
              object-fit: cover;
              display: block;
            }
            
            /* Large image when no designs */
            .large-image {
              height: auto;
              min-height: 400px;
            }
            
            .large-image .billboard-image {
              height: 480px;
              object-fit: contain;
              background: #f5f5f5;
            }

            /* Design Container */
            .design-container {
              display: flex;
              gap: 15px;
              margin-bottom: 20px;
            }

            .design-box {
              flex: 1;
              border: 3px solid #1a1a1a;
              border-radius: 12px;
              overflow: hidden;
              background: #f5f5f5;
            }

            .design-label {
              background: #1a1a1a;
              color: white;
              padding: 10px;
              text-align: center;
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }

            .design-image {
              width: 100%;
              height: 180px;
              object-fit: cover;
              display: block;
              background: #e0e0e0;
            }

            /* Location */
            .location-container {
              border: 3px solid #1a1a1a;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 15px;
              background: white;
            }

            .location-text {
              font-size: 18px;
              font-weight: 700;
              color: #1a1a1a;
              text-align: center;
              letter-spacing: 0.5px;
            }

            /* QR Code */
            .qr-container {
              display: flex;
              justify-content: center;
              margin-bottom: 15px;
            }

            .qr-box {
              border: 3px solid #1a1a1a;
              border-radius: 12px;
              padding: 20px;
              text-align: center;
              background: white;
            }

            .qr-code {
              width: 150px;
              height: 150px;
              margin-bottom: 10px;
            }

            .qr-text {
              font-size: 14px;
              font-weight: 600;
              color: #1a1a1a;
              line-height: 1.5;
            }

            /* Footer */
            .footer-bar {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 15mm;
              background: linear-gradient(90deg, #d4af37 0%, #f0c654 50%, #d4af37 100%);
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            @media print {
              body {
                margin: 0;
                padding: 0;
              }

              .page {
                margin: 0;
                padding: 15mm;
              }

              @page {
                size: A4;
                margin: 0;
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

  // ✅ Sort billboards by size sort_order
  const sortBillboardsBySize = async (billboards: Billboard[]) => {
    try {
      // Get size sort orders from billboard_sizes table
      const { data: sizes, error } = await supabase
        .from('billboard_sizes' as any)
        .select('size, sort_order');
      
      if (error || !sizes) {
        console.warn('Failed to load size sort orders, using original order');
        return billboards;
      }
      
      // Create a map of size to sort_order
      const sizeOrderMap = new Map<string, number>();
      sizes.forEach((s: any) => {
        sizeOrderMap.set(s.size, s.sort_order || 999);
      });
      
      // Sort billboards by their size's sort_order
      return [...billboards].sort((a, b) => {
        const orderA = sizeOrderMap.get(a.Size) || 999;
        const orderB = sizeOrderMap.get(b.Size) || 999;
        return orderA - orderB;
      });
    } catch (e) {
      console.warn('Error sorting billboards:', e);
      return billboards;
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);

      // Get billboards for this contract
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, GPS_Coordinates, Image_URL, Nearest_Landmark, Municipality')
        .eq('Contract_Number', Number(contractId));

      if (error) throw error;

      if (!billboards || billboards.length === 0) {
        toast.error('لا توجد لوحات مرتبطة بهذا العقد');
        return;
      }

      const html = await generatePrintHTML(billboards);
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`تم تحضير ${billboards.length} صفحة للطباعة ${printType === 'installation' ? '(فريق التركيب)' : '(العميل)'}`);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error printing billboards:', error);
      toast.error('فشل في تحضير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      toast.info('جاري تحضير ملف PDF...');

      // Get billboards for this contract
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, GPS_Coordinates, Image_URL, Nearest_Landmark, Municipality')
        .eq('Contract_Number', Number(contractId));

      if (error) throw error;

      if (!billboards || billboards.length === 0) {
        toast.error('لا توجد لوحات مرتبطة بهذا العقد');
        return;
      }

      const html = await generatePrintHTML(billboards);
      
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-99999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Wait for fonts to load
      await document.fonts.ready;
      
      // Small delay to ensure fonts are rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for all images to load
      const images = container.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          // Timeout after 5 seconds
          setTimeout(() => resolve(false), 5000);
        });
      });
      
      await Promise.all(imagePromises);
      console.log(`✅ Loaded ${images.length} images`);

      const opt = {
        margin: 0,
        filename: `billboards-contract-${contractId}-${printType}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          letterRendering: true,
          foreignObjectRendering: false,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4',
          orientation: 'portrait' as const,
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.page',
          avoid: ['img', '.qr-code', '.design-image']
        },
      };

      const pdfContent = container.querySelector('body') || container;
      
      console.log(`🔄 Generating PDF with ${billboards.length} pages...`);
      await html2pdf().from(pdfContent).set(opt).save();
      
      // Clean up
      document.body.removeChild(container);
      
      toast.success(`✅ تم تحميل ${billboards.length} صفحة كملف PDF`);
      setOpen(false);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      toast.error('فشل في إنشاء ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700 text-white">
          <Printer className="h-4 w-4 ml-2" />
          طباعة اللوحات منفصلة
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-yellow-400 text-xl">خيارات طباعة اللوحات</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-300">
            سيتم طباعة كل لوحة في صفحة منفصلة مع بياناتها الكاملة مرتبة حسب المقاس
          </p>

          {/* ✅ Print type selection */}
          <div className="space-y-3 bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <Label className="text-sm font-bold text-yellow-400">نوع الطباعة:</Label>
            <div className="flex items-center space-x-4 space-x-reverse gap-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="radio"
                  id="print-client"
                  name="printType"
                  value="client"
                  checked={printType === 'client'}
                  onChange={(e) => setPrintType(e.target.value as 'client' | 'installation')}
                  className="w-4 h-4 text-yellow-400"
                />
                <Label htmlFor="print-client" className="text-sm cursor-pointer text-slate-200 font-medium">
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
                  className="w-4 h-4 text-yellow-400"
                />
                <Label htmlFor="print-installation" className="text-sm cursor-pointer text-slate-200 font-medium">
                  طباعة لفريق التركيب 🔧
                </Label>
              </div>
            </div>
          </div>

          {/* عرض حالة التصاميم */}
          {(designFaceA || designFaceB) ? (
            <div className="space-y-2">
              <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-3">
                <p className="text-sm text-green-200 font-medium">
                  ✅ التصاميم متوفرة
                  {designFaceA && designFaceB ? ' (الوجهين)' : designFaceA ? ' (الوجه الأمامي)' : ' (الوجه الثاني)'}
                </p>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="include-designs-print"
                  checked={includeDesigns}
                  onCheckedChange={(checked) => setIncludeDesigns(checked as boolean)}
                />
                <Label 
                  htmlFor="include-designs-print" 
                  className="text-sm cursor-pointer text-slate-200 font-medium"
                >
                  تضمين التصميمات في الطباعة
                </Label>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
              <p className="text-sm text-yellow-200">
                ⚠️ لا توجد تصاميم مرفقة بهذا العقد
              </p>
            </div>
          )}
          
          {!includeDesigns && (
            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
              <p className="text-sm text-blue-200">
                💡 عند إلغاء التصميمات، ستظهر صورة اللوحة بحجم أكبر وفي المنتصف
              </p>
            </div>
          )}

          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <p className="text-sm text-slate-300">
              <span className="font-bold text-yellow-400">محتويات الطباعة:</span>
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-slate-300 space-y-1">
              <li>رقم اللوحة والمقاس</li>
              <li>صورة اللوحة {!includeDesigns && '(كبيرة ومركزية)'}</li>
              {includeDesigns && (designFaceA || designFaceB) && <li>التصميمات (الوجه الأمامي والخلفي)</li>}
              <li>موقع اللوحة</li>
              <li>QR code للموقع</li>
              <li className="font-bold text-yellow-400">ترتيب تلقائي حسب المقاس</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleDownloadPDF}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 ml-2" />
              {loading ? 'جاري التحضير...' : 'تحميل PDF'}
            </Button>
            <Button 
              onClick={handlePrint}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Printer className="h-4 w-4 ml-2" />
              {loading ? 'جاري التحضير...' : 'طباعة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
