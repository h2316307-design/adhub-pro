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

      html,body{height:100%;margin:0;padding:0;background:var(--bg);color:var(--text);font-family:${styles.fontFamily || 'Manrope, Doran, system-ui, sans-serif'}}
      
      .paper{
        width:210mm;
        min-height:297mm;
        margin:0 auto;
        padding:${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
        background:var(--bg);
        position:relative;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
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
      
      /* Header - matching UnifiedInvoicePreview */
      .header{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        margin-bottom:${styles.headerMarginBottom || 20}px;
        padding-bottom:15px;
        border-bottom:2px solid var(--primary);
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
        align-items:${styles.logoPosition === 'left' ? 'flex-start' : styles.logoPosition === 'center' ? 'center' : 'flex-end'};
        gap:8px;
      }
      
      .logo img{
        height:${styles.logoSize}px;
        object-fit:contain;
      }
      
      .contact-info{
        font-size:${styles.contactInfoFontSize || 10}px;
        color:var(--text);
        line-height:1.6;
        text-align:${styles.contactInfoAlignment || 'center'};
      }
      
      .company-info{
        font-size:11px;
        color:var(--text);
        line-height:1.8;
        text-align:${styles.logoPosition === 'center' ? 'center' : styles.logoPosition === 'left' ? 'left' : 'right'};
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
      .totals-section{margin-top:30px}
      
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
      }
      
      .grand-total{
        display:flex;
        justify-content:space-between;
        padding:15px 20px;
        margin-top:15px;
        background:${styles.totalBgColor};
        color:${styles.totalTextColor};
        font-size:${Number(styles.headerFontSize) + 4}px;
        font-weight:bold;
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
        html,body{background:white}
        .paper{margin:0;padding:${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;border:none;box-shadow:none}
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
                ${styles.companyAddress ? `<div>${styles.companyAddress}</div>` : ''}
                ${styles.companyPhone ? `<div>هاتف: ${styles.companyPhone}</div>` : ''}
              </div>
              ` : ''}
              
              ${styles.showCompanyInfo && (styles.showCompanyName || styles.showCompanySubtitle) ? `
              <div class="company-info">
                ${styles.showCompanyName ? `<div class="company-name">${styles.companyName}</div>` : ''}
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
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' و' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' مائة' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    return numberToArabicWords(thousand) + ' ألف' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  
  return num.toString(); // Fallback for very large numbers
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

export const generatePurchaseInvoiceHTML = (data: PurchaseInvoiceData): string => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ description: '', quantity: 0, unitPrice: 0, total: 0 } as any);
  }

  const subtotal = (data.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const discount = data.discount || 0;

  const rowsHtml = displayItems.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f8f9fa' : '#ffffff'}">
      <td style="padding:14px;text-align:right;border:1px solid #e0e0e0;font-size:14px">${item.description || ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:600">${item.quantity || ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:600">${item.unitPrice ? (Number(item.unitPrice)).toLocaleString('ar-LY') : ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:700">${item.total ? (Number(item.total)).toLocaleString('ar-LY') + ' د.ل' : ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مشتريات - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
      background: #f5f5f5;
      padding: 8px;
      color: #1a1a1a;
      line-height: 1.3;
    }
    
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      position: relative;
    }
    
    /* Header Section */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      border-bottom: 2px solid #000000;
    }
    
    .header-right {
      text-align: right;
      flex: 1;
    }
    
    .invoice-title {
      font-size: 22px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 6px;
    }
    
    .invoice-meta {
      font-size: 12px;
      color: #666;
      line-height: 1.5;
    }
    
    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 15px;
    }
    
    .company-logo {
      max-width: 300px;
      height: auto;
      margin: 0 auto;
    }
    
    .header-left {
      text-align: left;
      flex: 1;
      font-size: 11px;
      color: #666;
      line-height: 1.5;
    }
    
    /* Info Box */
    .info-box {
      background: #f8f9fa;
      padding: 12px 20px;
      margin: 15px 30px;
      border: 1px solid #e0e0e0;
      border-right: 4px solid #000000;
      border-radius: 6px;
    }
    
    .info-title {
      font-size: 14px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #000000;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    
    .info-label {
      color: #666;
      font-weight: 600;
    }
    
    .info-value {
      color: #1a1a1a;
      font-weight: 700;
    }
    
    /* Table */
    .items-table {
      width: calc(100% - 60px);
      margin: 15px 30px;
      border-collapse: collapse;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .items-table thead {
      background: #000000;
      color: #ffffff;
    }
    
    .items-table thead th {
      padding: 10px 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #000000;
    }
    
    .items-table tbody td {
      padding: 8px;
      border: 1px solid #e0e0e0;
      font-size: 12px;
    }
    
    /* Total Section */
    .total-section {
      margin: 15px 30px;
    }

    .summary-table {
      width: 100%;
      max-width: 380px;
      margin-left: auto;
      border-collapse: collapse;
      background: #f8f9fa;
      border-radius: 6px;
      overflow: hidden;
    }

    .summary-table tr {
      border-bottom: 1px solid #e0e0e0;
    }

    .summary-table td {
      padding: 8px 12px;
      font-size: 13px;
    }

    .summary-table td:first-child {
      text-align: right;
      color: #666;
      font-weight: 600;
    }

    .summary-table td:last-child {
      text-align: left;
      font-weight: 700;
      color: #1a1a1a;
    }

    .summary-table tr.discount-row td {
      color: #e74c3c;
      font-weight: 700;
    }

    .summary-table tr.total-row {
      background: #000000;
      color: #ffffff;
      font-weight: 800;
      border-bottom: none;
    }

    .summary-table tr.total-row td {
      padding: 12px;
      font-size: 15px;
      color: #ffffff;
    }
    
    
    /* Notes */
    .notes-section {
      margin: 15px 30px;
      padding: 10px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 12px;
      color: #666;
    }
    
    /* Footer */
    .footer {
      margin-top: 20px;
      padding: 12px 30px;
      border-top: 1px dashed #e0e0e0;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .invoice-container { border: none; box-shadow: none; }
      @page { size: A4; margin: 5mm; }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .info-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f9fa !important; border-right: 4px solid #000000 !important; }
      .info-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; border-bottom: 2px solid #000000 !important; }
      .items-table thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #000000 !important; color: #ffffff !important; }
      .items-table thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #000000 !important; color: #ffffff !important; }
      .items-table tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f9fa !important; }
      .summary-table { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f9fa !important; }
      .summary-table tr.total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #000000 !important; }
      .summary-table tr.total-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #ffffff !important; }
      .summary-table tr.discount-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #e74c3c !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="header-right">
        <div class="invoice-title">${data.invoiceName || 'فاتورة مشتريات'}</div>
        <div class="invoice-meta">
          رقم الفاتورة: ${data.invoiceNumber}<br/>
          التاريخ: ${new Date(data.invoiceDate).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </div>
      </div>
      
      <div class="header-center">
        <img class="company-logo" src="${baseUrl}/logofares.svg" alt="شعار الشركة" />
      </div>
      
      <div class="header-left">
        طرابلس - طريق المطار، حي الزهور<br/>
        هاتف: 0912612255
      </div>
    </div>
    
    <!-- Info Box -->
    <div class="info-box">
      <div class="info-title">بيانات الفاتورة</div>
      <div class="info-row">
        <span class="info-label">العميل:</span>
        <span class="info-value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع:</span>
        <span class="info-value">نقدي</span>
      </div>
    </div>
    
    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:40%">البيان</th>
          <th style="width:15%">الكمية</th>
          <th style="width:20%">الفئة</th>
          <th style="width:25%">السعر الاجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    
    <!-- Total Section -->
    <div class="total-section">
      <table class="summary-table">
        <tbody>
          <tr>
            <td>إجمالي الكمية:</td>
            <td>${(data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} قطعة</td>
          </tr>
          <tr>
            <td>المجموع الفرعي:</td>
            <td>د.ل ${subtotal.toLocaleString('ar-LY')}</td>
          </tr>
          ${discount > 0 ? `
          <tr class="discount-row">
            <td>التخفيض:</td>
            <td>- د.ل ${discount.toLocaleString('ar-LY')}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td>الإجمالي النهائي:</td>
            <td>د.ل ${data.totalAmount.toLocaleString('ar-LY')}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Notes -->
    ${data.notes ? `<div class="notes-section"><strong>ملاحظات:</strong> ${data.notes}</div>` : ''}
    
    <!-- Footer -->
    <div class="footer">
      شكراً لتعاملكم معنا | Thank you for your business<br/>
      هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
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

// Generate sales invoice with same design
export const generateSalesInvoiceHTML = (data: PurchaseInvoiceData): string => {
  const html = generatePurchaseInvoiceHTML(data);
  // Replace "فاتورة قطع" and "فاتورة مشتريات" with "فاتورة مبيعات" if no custom invoice name
  if (!data.invoiceName) {
    return html
      .replace(/فاتورة قطع/g, 'فاتورة مبيعات')
      .replace(/فاتورة مشتريات/g, 'فاتورة مبيعات');
  }
  return html;
};

export const generateInvoiceHTML = (invoiceData: ModernInvoiceData): string => {
  return generateModernInvoiceHTML(invoiceData);
};
