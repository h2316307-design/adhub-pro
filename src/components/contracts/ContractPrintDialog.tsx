import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye } from 'lucide-react';
import { ContractData } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { saveHtmlAsPdf } from '@/utils/pdfHelpers';

interface ContractPrintDialogProps {
  contract: ContractData;
  trigger?: React.ReactNode;
}

export function ContractPrintDialog({ contract, trigger }: ContractPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Function to get billboard image from contract
  const getBillboardImage = (contract: ContractData): string => {
    if (!contract?.billboards || contract.billboards.length === 0) {
      return '';
    }
    
    for (const billboard of contract.billboards) {
      const image = billboard.image || billboard.Image || billboard.billboard_image || (billboard as any).Image_URL || (billboard as any)['@IMAGE'] || (billboard as any).image_url;
      if (image && typeof image === 'string' && image.trim() !== '') {
        return image;
      }
    }
    
    return '';
  };

  // Function to extract contract data
  const extractContractData = (contract: ContractData) => {
    const contractNumber = contract.Contract_Number || contract.id || '';
    const customerName = contract.customer_name || contract['Customer Name'] || '';
    const adType = contract.ad_type || contract['Ad Type'] || 'عقد إيجار لوحات إعلانية';
    const startDate = contract.start_date || contract['Contract Date'] || '';
    const endDate = contract.end_date || contract['End Date'] || '';
    const totalCost = contract.rent_cost || contract['Total Rent'] || 0;
    
    // Calculate duration in days
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${durationDays}`;
    }
    
    // Format price
    const formattedPrice = `${totalCost.toLocaleString('ar-LY')}`;
    
    // Format dates
    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('ar-LY') : new Date().toLocaleDateString('ar-LY');
    const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : '';
    
    // Get year from start date
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    
    // Get billboard count
    const billboardCount = contract.billboards ? contract.billboards.length : 0;
    const billboardInfo = billboardCount > 0 ? ` (${billboardCount} لوحة إعلانية)` : '';
    
    return {
      contractNumber: contractNumber.toString(),
      customerName: customerName,
      adType: adType + billboardInfo,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      price: formattedPrice,
      duration: duration,
      year: year.toString(),
      companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
      phoneNumber: contract.phoneNumber || '0912612255',
      billboardImage: getBillboardImage(contract)
    };
  };

  const handlePrintContract = async () => {
    try {
      setIsGenerating(true);

      // Extract contract data
      const contractData = extractContractData(contract);

      // Normalize billboards and build table pages for printing
      const billboards: any[] = Array.isArray(contract.billboards) ? contract.billboards : [];

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(
          b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? ''
        );
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.Rent ?? b.rent_cost ?? b['Total Rent'];
        const price =
          typeof priceVal === 'number'
            ? `${priceVal.toLocaleString('ar-LY')} د.ل`
            : (typeof priceVal === 'string' && priceVal.trim() !== '' ? priceVal : '');
        let coords: string = String(
          b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? ''
        );
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        return { id, image, municipality, district, landmark, size, faces, price, mapLink };
      };

      const normalizedRows = billboards.map(normalizeBillboard);
      const ROWS_PER_PAGE = 12; // fits with image thumbnails comfortably

      const tablePagesHtml = normalizedRows.length
        ? normalizedRows
            .reduce((pages: any[][], row, idx) => {
              const p = Math.floor(idx / ROWS_PER_PAGE);
              if (!pages[p]) pages[p] = [];
              pages[p].push(row);
              return pages;
            }, [])
            .map((rows) => `
              <div class="template-container">
                <img src="/bgc2.jpg" alt="خلفية جدول اللوحات" class="template-image" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:8%" />
                      <col style="width:14%" />
                      <col style="width:12%" />
                      <col style="width:12%" />
                      <col style="width:18%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                    </colgroup>
                    <tbody>
                      ${rows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-num">${r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.price}</td>
                            <td>${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      // Create HTML content for printing using the main6 design
      const installationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== 'false';
      const printEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === 'true';
      const flagsHtml = `
        <div style="margin:16px 0; font-size:18px;">
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#eef6ff; color:#0b63c5; margin-left:8px;">${installationEnabled ? 'مع التركيب' : 'بدون تركيب'}</span>
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#f5f5f5; color:#444;">${printEnabled ? 'شاملة الطباعة' : 'غير شاملة الطباعة'}</span>
        </div>`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              overflow-x: hidden;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .template-container {
              position: relative;
              width: 100%;
              aspect-ratio: 1191 / 1684;
              display: inline-block;
              overflow: hidden;
              margin: 20px auto;
              page-break-after: always;
            }

            .template-image,
            .overlay-svg {
              position: absolute;
              top: 0;
              left: 60px;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            }

            .overlay-svg {
              z-index: 10;
              pointer-events: none;
            }

            /* Table overlay area for bgc2 pages */
            .table-area {
              position: absolute;
              right: 140px;
              left: 140px;
              top: 500px;
              bottom: 310px;
              z-index: 20;
            }
            .btable { width: 100%; border-collapse: collapse; font-size: 26px; }
            .btable td { border: 1px solid #000; padding: 10px 8px; vertical-align: middle; }
            .c-img img { width: 120px; height: 70px; object-fit: cover; display: block; margin: 0 auto; }
            .c-num { text-align: center; font-weight: 700; }
            .btable a { color: #004aad; text-decoration: none; }

            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              @page {
                size: A4;
                margin: 0;
              }
              
              body {
                padding: 0;
                margin: 0;
                width: 210mm;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .template-container {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
              }
              
              .template-image, .overlay-svg {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .controls {
                display: none !important;
              }
            }

            .controls {
              margin-top: 20px;
              text-align: center;
            }

            button {
              padding: 10px 20px;
              font-size: 16px;
              background-color: #0066cc;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          ${flagsHtml}
          <div class="template-container">
            <!-- Background image -->
            <img src="/contract-template.png" alt="الإشعار الأصلي" class="template-image" />

            <!-- Overlay SVG -->
            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Header: إجراً لمواقع إعلانية رقم: 1098 سنة -->
              <text
                x="1750"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}
              </text>

              <!-- التاريخ: -->
              <text
                x="440"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                التاريخ: ${contractData.startDate}
              </text>

              <!-- نوع الإعلان -->
              <text
                x="2050"
                y="915"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                نوع الإعلان: ${contractData.adType}.
              </text>

              <!-- الطرف الأول -->
              <text
                x="2220"
                y="1140"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الطرف الأول:
              </text>
              <text
                x="1500"
                y="1140"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                شركة الفارس الذهبي للدعاية والإعلان، طرابلس – طريق المطار، حي الزهور.
              </text>
              <text
                x="1960"
                y="1200"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يمثلها السيد جمال أحمد زحيل (المدير العام).
              </text>

              <!-- الطرف الثاني -->
              <text
                x="2210"
                y="1380"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الطرف الثاني:
              </text>
              <text
                x="1920"
                y="1380"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                ${contractData.customerName}.
              </text>
              <text
                x="1970"
                y="1440"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.
              </text>

              <!-- المقدمة -->
              <text
                x="2250"
                y="1630"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                المقدمة:
              </text>
              <text
                x="1290"
                y="1630"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>

              <!-- البند الأول -->
              <text
                x="2240"
                y="1715"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الأول:
              </text>
              <text
                x="1190"
                y="1715"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .
              </text>
              <text
                x="2095"
                y="1775"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                المذكور في المادة السادسة
              </text>

              <!-- البند الثاني -->
              <text
                x="2230"
                y="1890"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثاني:
              </text>
              <text
                x="1170"
                y="1890"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text
                x="1850"
                y="1950"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الأخير تكاليف التغيير الناتجة عن الأحوال ال��وية أو الحوادث.
              </text>

              <!-- البند الثالث -->
              <text
                x="2225"
                y="2065"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثالث:
              </text>
              <text
                x="1240"
                y="2065"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text
                x="1890"
                y="2125"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>

              <!-- البند الرابع -->
              <text
                x="2235"
                y="2240"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الرابع:
              </text>
              <text
                x="1190"
                y="2240"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ ��حق.
              </text>
              <text
                x="1530"
                y="2300"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>

              <!-- البند الخامس – contract amount -->
              <text
                x="560"
                y="2410"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="end"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                قيمة العقد ${contractData.price} دينار ليبي بدون طباعة، دفع عند توقيع العقد والنصف الآخر بعد
              </text>
              <text
                x="1640"
                y="2470"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                التركيب، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>

              <!-- البند السادس – duration -->
              <text
                x="2210"
                y="2590"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند السادس:
              </text>
              <text
                x="1150"
                y="2590"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text
                x="1800"
                y="2650"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها .
              </text>

              <!-- البند السابع -->
              <text
                x="2220"
                y="2760"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند السابع:
              </text>
              <text
                x="1150"
                y="2760"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي
              </text>
              <text
                x="2200"
                y="2820"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                وملزم للطرفين.
              </text>
            </svg>

            <!-- Print button -->
            <div class="controls">
              <button onclick="window.print()">طباعة</button>
            </div>
          </div>

          ${tablePagesHtml}
        </body>
        </html>
      `;

      // Create a new window and write the HTML content
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');

      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for images to load, then focus and show print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 1000);
        };
      } else {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      }

    } catch (error) {
      console.error('Error opening print window:', error);
      alert('حدث خطأ أثناء فتح نافذة الطباعة: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      toast.info('جاري إنشاء ملف PDF...');

      // استخدام نفس منطق handlePrintContract تماماً
      const contractData = extractContractData(contract);

      // Normalize billboards and build table pages (نفس المنطق من handlePrintContract)
      const billboards: any[] = Array.isArray(contract.billboards) ? contract.billboards : [];

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(
          b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? ''
        );
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.Rent ?? b.rent_cost ?? b['Total Rent'];
        const price =
          typeof priceVal === 'number'
            ? `${priceVal.toLocaleString('ar-LY')} د.ل`
            : (typeof priceVal === 'string' && priceVal.trim() !== '' ? priceVal : '');
        let coords: string = String(
          b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? ''
        );
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        return { id, image, municipality, district, landmark, size, faces, price, mapLink };
      };

      const normalizedRows = billboards.map(normalizeBillboard);
      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalizedRows.length
        ? normalizedRows
            .reduce((pages: any[][], row, idx) => {
              const p = Math.floor(idx / ROWS_PER_PAGE);
              if (!pages[p]) pages[p] = [];
              pages[p].push(row);
              return pages;
            }, [])
            .map((rows) => `
              <div class="template-container">
                <img src="/bgc2.jpg" alt="خلفية جدول اللوحات" class="template-image" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:8%" />
                      <col style="width:14%" />
                      <col style="width:12%" />
                      <col style="width:12%" />
                      <col style="width:18%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                    </colgroup>
                    <tbody>
                      ${rows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-num">${r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.price}</td>
                            <td>${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      // نفس الـflags من handlePrintContract
      const installationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== 'false';
      const printEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === 'true';
      const flagsHtml = `
        <div style="margin:16px 0; font-size:18px;">
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#eef6ff; color:#0b63c5; margin-left:8px;">${installationEnabled ? 'مع التركيب' : 'بدون تركيب'}</span>
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#f5f5f5; color:#444;">${printEnabled ? 'شاملة الطباعة' : 'غير شاملة الطباعة'}</span>
        </div>`;

      // ✅ نفس HTML من handlePrintContract تماماً
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              overflow-x: hidden;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .template-container {
              position: relative;
              width: 100%;
              aspect-ratio: 1191 / 1684;
              display: inline-block;
              overflow: hidden;
              margin: 20px auto;
              page-break-after: always;
            }

            .template-image,
            .overlay-svg {
              position: absolute;
              top: 0;
              left: 60px;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            }

            .overlay-svg {
              z-index: 10;
              pointer-events: none;
            }

            .table-area {
              position: absolute;
              right: 140px;
              left: 140px;
              top: 500px;
              bottom: 310px;
              z-index: 20;
            }
            .btable { width: 100%; border-collapse: collapse; font-size: 26px; }
            .btable td { border: 1px solid #000; padding: 10px 8px; vertical-align: middle; }
            .c-img img { width: 120px; height: 70px; object-fit: cover; display: block; margin: 0 auto; }
            .c-num { text-align: center; font-weight: 700; }
            .btable a { color: #004aad; text-decoration: none; }
            
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              @page {
                size: A4;
                margin: 0;
              }
              
              body {
                padding: 0;
                margin: 0;
                width: 210mm;
              }
              
              .template-container {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
              }
              
              .template-image, .overlay-svg {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${flagsHtml}
          <div class="template-container">
            <img src="/contract-template.png" alt="الإشعار الأصلي" class="template-image" />
            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <text x="1750" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}
              </text>
              <text x="440" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                التاريخ: ${contractData.startDate}
              </text>
              <text x="2050" y="915" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                نوع الإعلان: ${contractData.adType}.
              </text>
              <text x="2220" y="1140" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الأول:
              </text>
              <text x="1500" y="1140" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                شركة الفارس الذهبي للدعاية والإعلان، طرابلس – طريق المطار، حي الزهور.
              </text>
              <text x="1960" y="1200" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يمثلها السيد جمال أحمد زحيل (المدير العام).
              </text>
              <text x="2210" y="1380" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الثاني:
              </text>
              <text x="1920" y="1380" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                ${contractData.customerName}.
              </text>
              <text x="1970" y="1440" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.
              </text>
              <text x="2250" y="1630" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                المقدمة:
              </text>
              <text x="1290" y="1630" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>
              <text x="2240" y="1715" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الأول:
              </text>
              <text x="1190" y="1715" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .
              </text>
              <text x="2095" y="1775" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                المذكور في المادة السادسة
              </text>
              <text x="2230" y="1890" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثاني:
              </text>
              <text x="1170" y="1890" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text x="1850" y="1950" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.
              </text>
              <text x="2225" y="2065" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثالث:
              </text>
              <text x="1240" y="2065" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text x="1890" y="2125" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>
              <text x="2235" y="2240" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الرابع:
              </text>
              <text x="1190" y="2240" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق.
              </text>
              <text x="1530" y="2300" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>
              <text x="560" y="2410" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="end" dominant-baseline="middle" style="direction: rtl; text-align: center">
                قيمة العقد ${contractData.price} دينار ليبي بدون طباعة، دفع عند توقيع العقد والنصف الآخر بعد
              </text>
              <text x="1640" y="2470" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                التركيب، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>
              <text x="2210" y="2590" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند السادس:
              </text>
              <text x="1150" y="2590" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text x="1800" y="2650" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها .
              </text>
              <text x="2220" y="2760" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند السابع:
              </text>
              <text x="1150" y="2760" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                في حال اعتراض الجهات الرسمية على محتوى الإعلان، يتحمل الطرف الثاني المسؤولية الكاملة ويلتزم بتصحيحه فورًا.
              </text>
              <text x="2220" y="2870" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند الثامن:
              </text>
              <text x="1190" y="2870" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يُمنع استخدام المساحات لأغراض غير مشروعة أو مخالفة للقانون، وفي حال المخالفة يحق للطرف الأول إلغاء العقد دون رد المبلغ.
              </text>
              <text x="2230" y="2985" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند التاسع:
              </text>
              <text x="1170" y="2985" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يحق لأي طرف إلغاء العقد قبل انتهاء المدة بإخطار كتابي قبل 15 يومًا على الأقل، ويتحمل الطرف المُلغي أي خسائر مادية.
              </text>
              <text x="2220" y="3100" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                البند العاشر:
              </text>
              <text x="1220" y="3100" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                يتم حل أي خلاف وديًا بين الطرفين أولاً، وفي حال عدم التوصل لحل يتم اللجوء إلى المحكمة المختصة في ليبيا.
              </text>
              <text x="540" y="3220" font-family="Doran, sans-serif" font-weight="bold" font-size="50" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الثاني:
              </text>
              <text x="1950" y="3220" font-family="Doran, sans-serif" font-weight="bold" font-size="50" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
                الطرف الأول:
              </text>
            </svg>
          </div>
          ${tablePagesHtml}
        </body>
        </html>
      `;

      // ======= 🎯 استخدام نفس طريقة الطباعة لإنشاء PDF =======
      // استخدم html2canvas + jsPDF للحصول على نتائج مماثلة للطباعة
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;

      // إنشاء container مؤقت
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.fontFamily = 'Noto Sans Arabic, Doran, Arial, sans-serif';
      container.style.direction = 'rtl';
      container.innerHTML = htmlContent;
      
      document.body.appendChild(container);

      // انتظار تحميل الخطوط والصور (زيادة الوقت)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ======= 🎨 معالجة الصفحة الأولى (بيانات العقد) =======
      const firstPage = container.querySelector('.template-container') as HTMLElement;
      if (!firstPage) {
        document.body.removeChild(container);
        throw new Error('لم يتم العثور على محتوى العقد');
      }

      // إنشاء PDF بأبعاد A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // تحويل الصفحة الأولى إلى صورة
      const firstCanvas = await html2canvas(firstPage, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123
      });
      
      const firstImgData = firstCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(firstImgData, 'JPEG', 0, 0, 210, 297);

      // ======= 📊 معالجة صفحات الجداول (اللوحات) =======
      const tablePages = container.querySelectorAll('.template-container:not(:first-child)');
      for (let i = 0; i < tablePages.length; i++) {
        const tablePage = tablePages[i] as HTMLElement;
        
        pdf.addPage('a4', 'portrait');
        
        const tableCanvas = await html2canvas(tablePage, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123
        });
        
        const tableImgData = tableCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(tableImgData, 'JPEG', 0, 0, 210, 297);
      }

      // ======= 💾 حفظ الملف =======
      pdf.save(`عقد-${contractData.contractNumber}.pdf`);

      // تنظيف
      document.body.removeChild(container);

      toast.success('تم تحميل ملف PDF بنجاح');
    } catch (error) {
      console.error('خطأ في تحميل PDF:', error);
      toast.error('حدث خطأ أثناء تحميل PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            طباعة العقد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>طباعة عقد إيجار اللوحات الإعلانية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>اختر الإجراء المناسب:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>معاينة:</strong> عرض العقد قبل الطباعة أو التحميل</li>
              <li><strong>تحميل PDF:</strong> حفظ العقد كملف PDF</li>
            </ul>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleDownloadPDF}
              disabled={isDownloading || isGenerating}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'جاري التحميل...' : 'تحميل PDF'}
            </Button>
            <Button
              onClick={handlePrintContract}
              disabled={isGenerating || isDownloading}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isGenerating ? 'جاري التحضير...' : 'معاينة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
