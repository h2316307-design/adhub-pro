import { generateModernInvoiceHTML, ModernInvoiceData } from './ModernInvoiceTemplate';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';

export { generateModernInvoiceHTML };

// Modern print invoice generator used by ModernPrintInvoiceDialog
export interface ModernPrintInvoiceData {
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  customerName: string;
  items: Array<{
    size: string;
    quantity: number | string;
    faces: number | string;
    totalFaces: number | string;
    width?: number | string;
    height?: number | string;
    area?: number | string;
    pricePerMeter?: number | string;
    totalPrice?: number | string;
  }>;
  totalAmount: number;
  notes?: string;
  printerName?: string;
  hidePrices?: boolean;
  showNotes?: boolean; // ✅ خيار إظهار/إخفاء الملاحظات
}

export const generateModernPrintInvoiceHTML = async (data: ModernPrintInvoiceData): Promise<string> => {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // ✅ جلب إعدادات القالب المحفوظة (async)
  const styles = await getMergedInvoiceStylesAsync('print_invoice');
  
  // ✅ تحويل نوع الفاتورة للعربية
  const getArabicInvoiceType = (type: string) => {
    if (type === 'print_only' || type === 'print' || type === 'طباعة') return 'طباعة';
    if (type === 'print_install' || type === 'طباعة وتركيب') return 'طباعة وتركيب';
    if (type === 'install_only' || type === 'install' || type === 'تركيب') return 'تركيب';
    return type;
  };
  const arabicInvoiceType = getArabicInvoiceType(data.invoiceType);
  const fileName = `فاتورة_${arabicInvoiceType}_${(data.customerName||'').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_')}`;
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ size: '', quantity: '', faces: '', totalFaces: '', width: '', height: '', area: '', pricePerMeter: '', totalPrice: '' } as any);
  }

  const logoUrl = styles.logoPath || '/logofares.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${fontBaseUrl}${logoUrl}`;

  const rowsHtml = displayItems.map((item, idx) => {
    const rowBg = idx % 2 === 0 
      ? hexToRgba(styles.tableRowEvenColor, styles.tableRowOpacity) 
      : hexToRgba(styles.tableRowOddColor, styles.tableRowOpacity);
    
    if (data.hidePrices) {
      return `
      <tr style="background:${rowBg}">
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.size || ''}</td>
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.quantity ?? ''}</td>
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.faces ?? ''}</td>
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.totalFaces ?? ''}</td>
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.width ?? ''} × ${item.height ?? ''}</td>
        <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${Number(item.area || 0).toFixed(2)} م²</td>
      </tr>
    `;
    }
    return `
    <tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.size || ''}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.quantity ?? ''}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.faces ?? ''}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.totalFaces ?? ''}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${item.width ?? ''} × ${item.height ?? ''}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${Number(item.area || 0).toFixed(2)} م²</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${(Number(item.pricePerMeter || 0)).toLocaleString('ar-LY')}</td>
      <td style="padding:8px;border:1px solid ${styles.tableBorderColor};color:${styles.tableTextColor}">${(Number(item.totalPrice || 0)).toLocaleString('ar-LY')} د.ل</td>
    </tr>
  `;
  }).join('');

  // استخدام الخلفية من الإعدادات
  const bgImageUrl = styles.backgroundImage ? (styles.backgroundImage.startsWith('http') ? styles.backgroundImage : `${fontBaseUrl}${styles.backgroundImage}`) : '';
  const bgStyle = bgImageUrl ? `
    background-image: url('${bgImageUrl}');
    background-position: ${styles.backgroundPosX}% ${styles.backgroundPosY}%;
    background-repeat: no-repeat;
    background-size: ${styles.backgroundScale}%;
  ` : '';

  const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }

      :root{
        --bg: #ffffff;
        --muted: #f8fafc;
        --primary: ${styles.primaryColor};
        --secondary: ${styles.secondaryColor};
        --primary-foreground: ${styles.tableHeaderTextColor};
        --border: ${styles.tableBorderColor};
        --card: ${hexToRgba(styles.subtotalBgColor, 50)};
        --text: ${styles.customerSectionTextColor};
      }

      html,body{height:100%;margin:0;padding:0;background:var(--bg);color:var(--text);font-family:${styles.fontFamily || 'Manrope, Doran, system-ui, sans-serif'};direction:rtl}
      
      .paper{
        width:210mm;
        max-width:100%;
        min-height:297mm;
        margin:0 auto;
        padding:${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
        padding-bottom:60px;
        background:var(--bg);
        position:relative;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        overflow:visible;
      }
      
      .bg-layer{
        position:absolute;
        top:0;left:0;right:0;bottom:0;
        ${bgStyle}
        opacity:${(styles.backgroundOpacity || 10) / 100};
        pointer-events:none;
        z-index:0;
      }
      
      .content{position:relative;z-index:1;flex:1;display:flex;flex-direction:column}
      .main-content{flex:1;padding-bottom:${styles.contentBottomSpacing || 25}mm}
      
      /* Header - matching UnifiedInvoicePreview with dynamic alignment */
      .header{
        display:flex;
        flex-direction:${styles.headerAlignment === 'left' ? 'row' : 'row-reverse'};
        justify-content:space-between;
        align-items:flex-start;
        margin-bottom:${styles.headerMarginBottom || 20}px;
        padding-bottom:15px;
        border-bottom:2px solid var(--primary);
        direction:rtl;
      }
      
      .header-left{
        flex:1;
        text-align:${styles.invoiceTitleAlignment === 'right' ? 'right' : styles.invoiceTitleAlignment === 'center' ? 'center' : 'left'};
        direction:ltr;
      }

      .invoice-title{
        font-size:28px;
        font-weight:bold;
        margin:0;
        font-family:Manrope, sans-serif;
        letter-spacing:2px;
        color:var(--secondary);
      }

      .invoice-meta{
        font-size:11px;
        color:var(--text);
        margin-top:8px;
        line-height:1.6;
      }

      .header-right{
        flex:1;
        display:flex;
        flex-direction:column;
        align-items:${styles.headerAlignment === 'left' ? 'flex-start' : styles.headerAlignment === 'center' ? 'center' : 'flex-end'};
        gap:8px;
        text-align:${styles.headerAlignment || 'right'};
      }

      .logo img{
        height:${styles.logoSize}px;
        object-fit:contain;
        align-self:${styles.logoPosition === 'left' ? 'flex-start' : styles.logoPosition === 'center' ? 'center' : 'flex-end'};
      }

      .contact-info{
        width:100%;
        font-size:${styles.contactInfoFontSize || 10}px;
        color:var(--text);
        line-height:1.6;
        text-align:${styles.headerAlignment || 'right'};
      }

      .company-info{
        width:100%;
        font-size:11px;
        color:var(--text);
        line-height:1.8;
        text-align:${styles.headerAlignment || 'right'};
      }

      .company-name{
        font-weight:bold;
        font-size:14px;
        color:var(--primary);
        margin-bottom:2px;
      }

      
      /* Customer Section - matching UnifiedInvoicePreview */
      .customer-section{
        background:${styles.customerSectionBgColor};
        border-right:4px solid ${styles.customerSectionBorderColor};
        padding:15px 20px;
        margin-bottom:20px;
        text-align:${styles.customerSectionAlignment || 'right'};
      }
      
      .customer-title{
        font-size:${styles.headerFontSize}px;
        font-weight:bold;
        color:${styles.customerSectionTitleColor};
        margin-bottom:10px;
      }
      
      .customer-details{
        font-size:${styles.bodyFontSize}px;
        color:var(--text);
        line-height:1.8;
      }

      /* Table */
      table{width:100%;border-collapse:collapse;margin-bottom:20px;background:transparent}
      thead th{
        background:${styles.tableHeaderBgColor};
        color:${styles.tableHeaderTextColor};
        padding:12px 8px;
        text-align:center;
        font-weight:bold;
        font-size:${styles.headerFontSize}px;
        border:1px solid var(--border);
      }
      tbody td{
        border:1px solid var(--border);
        padding:12px 8px;
        text-align:center;
        vertical-align:middle;
        font-size:${styles.bodyFontSize}px;
        color:${styles.tableTextColor};
      }

      /* Totals - matching UnifiedInvoicePreview */
      .totals-section{
        margin-top:30px;
        page-break-inside:avoid;
        break-inside:avoid;
      }
      
      .total-row{
        display:flex;
        justify-content:space-between;
        padding:10px 0;
        border-bottom:1px solid ${styles.notesBorderColor};
        font-size:${styles.bodyFontSize}px;
      }
      
      .subtotal-row{
        background:${styles.subtotalBgColor !== 'transparent' ? styles.subtotalBgColor : 'transparent'};
        color:${styles.subtotalTextColor};
        page-break-inside:avoid;
        break-inside:avoid;
      }
      
      .grand-total{
        display:flex;
        justify-content:space-between;
        padding:20px 20px;
        margin-top:40px;
        background:${styles.totalBgColor};
        color:${styles.totalTextColor};
        font-size:${Number(styles.headerFontSize) + 6}px;
        font-weight:bold;
        width:100%;
        box-sizing:border-box;
        page-break-before:auto;
        page-break-after:auto;
        page-break-inside:avoid;
        break-inside:avoid;
        margin-bottom:40px;
      }
      
      /* Notes - matching UnifiedInvoicePreview */
      .notes-section{
        margin-top:20px;
        padding:15px;
        background:${styles.notesBgColor};
        border-radius:4px;
        border:1px solid ${styles.notesBorderColor};
        font-size:${styles.bodyFontSize}px;
        line-height:1.8;
        color:${styles.notesTextColor};
        text-align:${styles.notesAlignment || 'right'};
      }
      
      /* Footer - matching UnifiedInvoicePreview */
      .footer{
        width:100%;
        margin-bottom:${styles.footerPosition || 15}mm;
        padding-top:10px;
        border-top:1px solid var(--border);
        background:${styles.footerBgColor !== 'transparent' ? styles.footerBgColor : 'transparent'};
        color:${styles.footerTextColor};
        font-size:10px;
        display:flex;
        align-items:center;
        justify-content:${styles.footerAlignment === 'left' ? 'flex-start' : styles.footerAlignment === 'center' ? 'center' : 'flex-end'};
        gap:20px;
      }
      
      .page-number{
        margin-${styles.footerAlignment === 'right' ? 'right' : 'left'}:auto;
      }

      @media print{
        html,body{background:white;overflow:visible!important}
        .paper{
          margin:0;
          padding:${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
          border:none;
          box-shadow:none;
          height:auto!important;
          overflow:visible!important;
          padding-bottom:60px;
        }
        .content{overflow:visible!important;height:auto!important}
        .main-content{overflow:visible!important;height:auto!important}
        .totals-section{page-break-inside:avoid;break-inside:avoid}
        .grand-total{page-break-inside:avoid;break-inside:avoid;margin-bottom:40px;overflow:visible!important}
        .notes-section{page-break-inside:avoid;break-inside:avoid}
        @page{size:A4;margin:0}
      }
    </style>
  </head>
  <body>
    <div class="paper">
      ${bgImageUrl ? '<div class="bg-layer"></div>' : ''}
      <div class="content">
        <div class="main-content">
          <!-- Header -->
          ${styles.showHeader !== false ? `
          <div class="header">
            <!-- Invoice Title Side -->
            ${styles.showInvoiceTitle !== false ? `
            <div class="header-left">
              <h1 class="invoice-title">${styles.invoiceTitleEn || 'INVOICE'}</h1>
              <div class="invoice-meta">
                رقم الفاتورة: ${data.invoiceNumber}<br/>
                التاريخ: ${new Date(data.invoiceDate).toLocaleDateString('ar-LY')}<br/>
                نوع الفاتورة: ${arabicInvoiceType}
              </div>
            </div>
            ` : ''}
            
            <!-- Company Info Side -->
            <div class="header-right">
              ${styles.showLogo ? `<div class="logo"><img src="${fullLogoUrl}" alt="Logo" onerror="this.style.display='none'"/></div>` : ''}
              
              ${styles.showContactInfo ? `
              <div class="contact-info">
                ${styles.showCompanyAddress !== false && styles.companyAddress ? `<div>${styles.companyAddress}</div>` : ''}
                ${styles.showCompanyPhone !== false && styles.companyPhone ? `<div>هاتف: ${styles.companyPhone}</div>` : ''}
                ${styles.showTaxId && styles.companyTaxId ? `<div>الرقم الضريبي: ${styles.companyTaxId}</div>` : ''}
                ${styles.showEmail && styles.companyEmail ? `<div>${styles.companyEmail}</div>` : ''}
                ${styles.showWebsite && styles.companyWebsite ? `<div>${styles.companyWebsite}</div>` : ''}
              </div>
              ` : ''}
              
              ${styles.showCompanyInfo && (styles.showCompanyName || styles.showCompanySubtitle) ? `
              <div class="company-info">
                ${styles.showCompanyName && styles.companyName ? `<div class="company-name">${styles.companyName}</div>` : ''}
                ${styles.showCompanySubtitle && styles.companySubtitle ? `<div>${styles.companySubtitle}</div>` : ''}
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Customer Section -->
          ${styles.showCustomerSection !== false ? `
          <div class="customer-section">
            <h3 class="customer-title">بيانات العميل</h3>
            <div class="customer-details">
              <div><strong>الاسم:</strong> ${data.customerName || ''}</div>
              <div><strong>نوع الخدمة:</strong> ${arabicInvoiceType}</div>
              ${data.printerName ? `<div><strong>المطبعة:</strong> ${data.printerName}</div>` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Table -->
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>المقاس</th>
                <th>عدد اللوحات</th>
                <th>أوجه/لوحة</th>
                <th>إجمالي الأوجه</th>
                <th>الأبعاد (م)</th>
                <th>المساحة/الوجه</th>
                ${!data.hidePrices ? '<th>سعر المتر</th><th>الإجمالي</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${displayItems.map((item, idx) => {
                const rowBg = idx % 2 === 0 
                  ? hexToRgba(styles.tableRowEvenColor, styles.tableRowOpacity) 
                  : hexToRgba(styles.tableRowOddColor, styles.tableRowOpacity);
                
                if (data.hidePrices) {
                  return `
                  <tr style="background:${rowBg}">
                    <td>${item.size ? idx + 1 : ''}</td>
                    <td>${item.size || ''}</td>
                    <td>${item.quantity ?? ''}</td>
                    <td>${item.faces ?? ''}</td>
                    <td>${item.totalFaces ?? ''}</td>
                    <td>${item.width && item.height ? `${item.width} × ${item.height}` : ''}</td>
                    <td>${item.area ? `${Number(item.area).toFixed(2)} م²` : ''}</td>
                  </tr>`;
                }
                return `
                <tr style="background:${rowBg}">
                  <td>${item.size ? idx + 1 : ''}</td>
                  <td>${item.size || ''}</td>
                  <td>${item.quantity ?? ''}</td>
                  <td>${item.faces ?? ''}</td>
                  <td>${item.totalFaces ?? ''}</td>
                  <td>${item.width && item.height ? `${item.width} × ${item.height}` : ''}</td>
                  <td>${item.area ? `${Number(item.area).toFixed(2)} م²` : ''}</td>
                  <td>${item.pricePerMeter ? Number(item.pricePerMeter).toLocaleString('ar-LY') : ''}</td>
                  <td style="font-weight:bold">${item.totalPrice ? `${Number(item.totalPrice).toLocaleString('ar-LY')} د.ل` : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>

          <!-- Totals Section -->
          ${data.hidePrices ? `
          <div class="totals-section">
            <div class="grand-total">
              <span>إجمالي الأوجه:</span>
              <span style="direction:ltr">${Number(data.totalAmount || 0).toLocaleString('ar-LY')} وحدة</span>
            </div>
          </div>
          ` : `
          <div class="totals-section">
            <div class="grand-total">
              <span>المجموع الإجمالي:</span>
              <span style="direction:ltr">${data.totalAmount.toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>
          `}

          <!-- Notes Section -->
          ${(data.showNotes !== false && data.notes) ? `
          <div class="notes-section">
            <div><strong>المبلغ بالكلمات:</strong> ${data.totalAmount ? numberToArabicWords(Number(data.totalAmount)) + ' دينار ليبي' : ''}</div>
            <div style="margin-top:5px">${data.notes}</div>
          </div>
          ` : (data.totalAmount && !data.hidePrices ? `
          <div class="notes-section">
            <div><strong>المبلغ بالكلمات:</strong> ${numberToArabicWords(Number(data.totalAmount))} دينار ليبي</div>
          </div>
          ` : '')}
        </div>

        <!-- Footer -->
        ${styles.showFooter !== false ? `
        <div class="footer">
          <span>${styles.footerText || 'شكراً لتعاملكم معنا'}</span>
          ${styles.showPageNumber !== false ? '<span class="page-number">صفحة 1 من 1</span>' : ''}
        </div>
        ` : ''}
      </div>
    </div>
    <script>window.onload=function(){window.print();}</script>
  </body>
  </html>`;

  return html;
};

// Helper function to convert number to Arabic words (re-exported for convenience)
export const numberToArabicWords = (num: number): string => {
  // Handle invalid input
  if (num === null || num === undefined || isNaN(num)) return '';
  
  // Round to whole number
  num = Math.round(Math.abs(num));
  
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  const convertHundreds = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return ones[one] + (one > 0 ? ' و' : '') + tens[ten];
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let result = '';
    if (hundred === 1) result = 'مائة';
    else if (hundred === 2) result = 'مائتان';
    else result = ones[hundred] + ' مائة';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  };

  if (num < 1000) return convertHundreds(num);
  
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = '';
    if (thousands === 1) result = 'ألف';
    else if (thousands === 2) result = 'ألفان';
    else if (thousands >= 3 && thousands <= 10) result = convertHundreds(thousands) + ' آلاف';
    else result = convertHundreds(thousands) + ' ألف';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  }
  
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    let result = '';
    if (millions === 1) result = 'مليون';
    else if (millions === 2) result = 'مليونان';
    else if (millions >= 3 && millions <= 10) result = convertHundreds(millions) + ' ملايين';
    else result = convertHundreds(millions) + ' مليون';
    if (remainder > 0) result += ' و' + numberToArabicWords(remainder);
    return result;
  }
  
  return num.toLocaleString('ar-LY');
};

// Generate invoice with modern template
// Generate purchase invoice HTML (for مشتريات)
export interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  invoiceName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
}

export const generatePurchaseInvoiceHTML = async (data: PurchaseInvoiceData): Promise<string> => {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // ✅ استخدام نفس تصميم فاتورة المقاسات - ثيم أسود/رمادي رسمي
  const PRIMARY_COLOR = '#000000';
  const SECONDARY_COLOR = '#333333';
  const BORDER_COLOR = '#000000';
  const LOGO_URL = '/logofares.svg';
  const LOGO_HEIGHT = '101px';
  
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ description: '', quantity: 0, unitPrice: 0, total: 0 } as any);
  }

  const subtotal = (data.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const discount = data.discount || 0;
  const totalQuantity = (data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const rowsHtml = displayItems.map((item, idx) => {
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
    return `
    <tr style="background:${rowBg}">
      <td style="padding:4px 8px;text-align:center;border:1px solid ${BORDER_COLOR};font-size:10px;color:#000000">${item.description ? idx + 1 : ''}</td>
      <td style="padding:4px 8px;text-align:right;border:1px solid ${BORDER_COLOR};font-size:10px;color:#000000">${item.description || ''}</td>
      <td style="padding:4px 8px;text-align:center;border:1px solid ${BORDER_COLOR};font-size:10px;font-weight:600;color:#000000">${item.quantity || ''}</td>
      <td style="padding:4px 8px;text-align:center;border:1px solid ${BORDER_COLOR};font-size:10px;font-weight:600;color:#000000">${item.unitPrice ? (Number(item.unitPrice)).toLocaleString('ar-LY') : ''}</td>
      <td style="padding:4px 8px;text-align:center;border:1px solid ${BORDER_COLOR};font-size:10px;font-weight:700;color:#000000">${item.total ? (Number(item.total)).toLocaleString('ar-LY') + ' د.ل' : ''}</td>
    </tr>
  `;
  }).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مشتريات - ${data.invoiceNumber}</title>
  <style>
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Manrope'; src: url('${fontBaseUrl}/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Manrope'; src: url('${fontBaseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
      color-adjust: exact !important; 
    }
    
    html, body { 
      font-family: Doran, Cairo, Tajawal, sans-serif;
      direction: rtl;
      background: #ffffff !important;
      color: #000000;
      font-size: 10px;
      line-height: 1.4;
    }
    
    .measurements-container {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      background: #ffffff;
      position: relative;
      margin: 0 auto;
    }
    
    /* Header Styles - مثل فاتورة المقاسات */
    .measurements-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${PRIMARY_COLOR};
    }
    
    .measurements-header-title {
      flex: 1;
      text-align: left;
      direction: ltr;
    }
    
    .measurements-title {
      font-size: 22px;
      font-weight: bold;
      color: ${SECONDARY_COLOR};
      font-family: 'Manrope', sans-serif;
      letter-spacing: 2px;
      margin: 0;
      text-align: right;
    }
    
    .measurements-title-info {
      font-size: 11px;
      color: ${SECONDARY_COLOR};
      margin-top: 8px;
      line-height: 1.6;
      direction: rtl;
      text-align: right;
    }
    
    .measurements-header-company {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    
    .measurements-logo {
      height: ${LOGO_HEIGHT};
      object-fit: contain;
      flex-shrink: 0;
    }
    
    /* Customer Section - مثل فاتورة المقاسات */
    .measurements-customer-section {
      background: linear-gradient(135deg, #f5f5f5, #ffffff);
      padding: 12px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-right: 5px solid ${SECONDARY_COLOR};
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .measurements-customer-label {
      font-size: 10px;
      color: ${SECONDARY_COLOR};
      opacity: 0.7;
      margin-bottom: 4px;
    }
    
    .measurements-customer-name {
      font-size: 18px;
      font-weight: bold;
      color: ${PRIMARY_COLOR};
    }
    
    .measurements-stats-cards {
      display: flex;
      gap: 24px;
    }
    
    .measurements-stat-card {
      text-align: center;
    }
    
    .measurements-stat-value {
      font-size: 26px;
      font-weight: bold;
      color: #000000;
      font-family: 'Manrope', sans-serif;
    }
    
    .measurements-stat-label {
      font-size: 10px;
      color: ${SECONDARY_COLOR};
      opacity: 0.7;
    }
    
    /* Table Styles - Full Grid Borders مثل فاتورة المقاسات */
    .measurements-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      page-break-inside: auto;
    }
    
    .measurements-table thead tr {
      background-color: #f0f0f0 !important;
    }
    
    .measurements-table th {
      padding: 4px 8px;
      color: #000000;
      border: 1px solid ${BORDER_COLOR};
      text-align: center;
      font-weight: bold;
      font-size: 10px;
    }
    
    .measurements-table td {
      padding: 4px;
      border: 1px solid ${BORDER_COLOR};
      color: #000000;
    }
    
    .measurements-table .even-row {
      background-color: #f5f5f5;
    }
    
    .measurements-table .odd-row {
      background-color: #ffffff;
    }
    
    /* Subtotal Row */
    .measurements-table .subtotal-row {
      background-color: #f5f5f5 !important;
    }
    
    .measurements-table .subtotal-row td {
      font-weight: bold;
    }
    
    /* Grand Total Row - مثل فاتورة المقاسات */
    .measurements-table .grand-total-row {
      background-color: #1a1a1a !important;
    }
    
    .measurements-table .grand-total-row td {
      color: #ffffff;
      font-weight: bold;
      padding: 6px 4px;
    }
    
    .measurements-table .grand-total-row .totals-label {
      text-align: left;
      font-size: 11px;
    }
    
    .measurements-table .grand-total-row .totals-value {
      text-align: center;
      font-size: 11px;
      font-family: 'Manrope', sans-serif;
    }
    
    /* Discount Row */
    .discount-row {
      background-color: #fff5f5 !important;
    }
    .discount-row td {
      color: #e74c3c;
      font-weight: 600;
    }
    
    /* Notes Section - مثل فاتورة المقاسات */
    .measurements-notes {
      margin-top: 10px;
      padding: 8px;
      background-color: #f5f5f5;
      border: 1px solid #cccccc;
      border-radius: 8px;
    }
    
    .measurements-notes-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: ${SECONDARY_COLOR};
    }
    
    .measurements-notes-content {
      font-size: 9px;
      color: ${SECONDARY_COLOR};
      line-height: 1.6;
    }
    
    /* Footer - مثل فاتورة المقاسات */
    .measurements-footer {
      margin-top: 12px;
      padding: 8px 0;
      border-top: 1px solid ${BORDER_COLOR};
      text-align: center;
      font-size: 9px;
      color: #666666;
    }
    
    /* Utility Classes */
    .en-text {
      font-family: 'Manrope', sans-serif;
    }
    
    /* Print Media */
    @media print {
      @page { 
        size: A4; 
        margin: 10mm;
      }
      
      * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        color-adjust: exact !important; 
      }
      
      html, body { 
        background: #ffffff !important; 
        width: 100%;
        height: 100%;
      }
      
      .measurements-container {
        width: 100%;
        min-height: auto;
        padding: 0;
      }
      
      .measurements-table thead tr {
        background-color: #f0f0f0 !important;
      }
      
      .measurements-table .grand-total-row {
        background-color: #1a1a1a !important;
      }
      
      .measurements-customer-section,
      .measurements-notes,
      .measurements-footer {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      .measurements-table tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="measurements-container">
    <!-- Header - مثل فاتورة المقاسات -->
    <div class="measurements-header">
      <!-- Title Side (Left in RTL) -->
      <div class="measurements-header-title">
        <h1 class="measurements-title">PURCHASE INVOICE</h1>
        <div class="measurements-title-info">
          رقم الفاتورة: <span class="en-text">${data.invoiceNumber}</span><br/>
          التاريخ: <span class="en-text">${new Date(data.invoiceDate).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <!-- Company Side (Right in RTL) -->
      <div class="measurements-header-company">
        <img src="${fontBaseUrl}${LOGO_URL}" alt="Logo" class="measurements-logo" onerror="this.style.display='none'" />
      </div>
    </div>
    
    <!-- Customer Section - مثل فاتورة المقاسات -->
    <div class="measurements-customer-section">
      <div class="measurements-customer-info">
        <div class="measurements-customer-label">المورد</div>
        <div class="measurements-customer-name">${data.customerName}</div>
      </div>
      
      <div class="measurements-stats-cards">
        <div class="measurements-stat-card">
          <div class="measurements-stat-value">${totalQuantity}</div>
          <div class="measurements-stat-label">إجمالي الكمية</div>
        </div>
        <div class="measurements-stat-card">
          <div class="measurements-stat-value">${(data.items || []).length}</div>
          <div class="measurements-stat-label">عدد الأصناف</div>
        </div>
      </div>
    </div>
    
    <!-- Table - مثل فاتورة المقاسات -->
    <table class="measurements-table">
      <thead>
        <tr>
          <th style="width:8%">م</th>
          <th style="width:37%">البيان</th>
          <th style="width:15%">الكمية</th>
          <th style="width:20%">الفئة</th>
          <th style="width:20%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <!-- Subtotal Row -->
        <tr class="subtotal-row">
          <td colspan="4" style="text-align:left;font-weight:700;padding:6px 4px;">المجموع الفرعي</td>
          <td style="text-align:center;font-weight:700;padding:6px 4px;">${subtotal.toLocaleString('ar-LY')} د.ل</td>
        </tr>
        ${discount > 0 ? `
        <!-- Discount Row -->
        <tr class="discount-row">
          <td colspan="4" style="text-align:left;padding:6px 4px;">التخفيض</td>
          <td style="text-align:center;padding:6px 4px;">- ${discount.toLocaleString('ar-LY')} د.ل</td>
        </tr>
        ` : ''}
        <!-- Grand Total Row -->
        <tr class="grand-total-row">
          <td colspan="4" class="totals-label">المجموع الإجمالي</td>
          <td class="totals-value">${data.totalAmount.toLocaleString('ar-LY')} د.ل</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Notes Section -->
    ${data.notes ? `
    <div class="measurements-notes">
      <div class="measurements-notes-title">ملاحظات</div>
      <div class="measurements-notes-content">${data.notes}</div>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="measurements-footer">
      <div>صفحة 1</div>
    </div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
};

// Generate sales invoice with unified design
export const generateSalesInvoiceHTML = async (data: PurchaseInvoiceData): Promise<string> => {
  const html = await generatePurchaseInvoiceHTML(data);
  // Replace titles for sales invoice
  if (!data.invoiceName) {
    return html
      .replace(/PURCHASE INVOICE/g, 'SALES INVOICE')
      .replace(/فاتورة مشتريات/g, 'فاتورة مبيعات');
  }
  return html;
};

export const generateInvoiceHTML = (invoiceData: ModernInvoiceData): string => {
  return generateModernInvoiceHTML(invoiceData);
};
