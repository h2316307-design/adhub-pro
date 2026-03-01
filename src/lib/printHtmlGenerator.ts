/**
 * مولد HTML للطباعة الموحد
 * يُنشئ HTML كامل للطباعة مع دعم الإعدادات الديناميكية
 */

import { PrintSettings } from '@/types/print-settings';
import { getPrintLayoutConfig, PrintLayoutConfig } from './printLayoutHelper';

// =====================================================
// الأنماط الأساسية المشتركة
// =====================================================

export function generateBasePrintCSS(config: PrintLayoutConfig): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    @font-face { 
      font-family: 'Doran'; 
      src: url('/Doran-Bold.otf') format('opentype'); 
      font-weight: 700; 
    }
    @font-face { 
      font-family: 'Doran'; 
      src: url('/Doran-Regular.otf') format('opentype'); 
      font-weight: 400; 
    }
    @font-face { 
      font-family: 'Manrope'; 
      src: url('/Manrope-Bold.otf') format('opentype'); 
      font-weight: 700; 
    }
    @font-face { 
      font-family: 'Manrope'; 
      src: url('/Manrope-Regular.otf') format('opentype'); 
      font-weight: 400; 
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html {
      direction: ${config.direction} !important;
    }
    
    body {
      width: 210mm;
      font-family: '${config.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif !important;
      direction: ${config.direction} !important;
      text-align: ${config.textAlign};
      background: white;
      color: #333;
      font-size: ${config.bodyFontSize};
      line-height: 1.4;
      overflow: visible;
    }
    
    .print-container {
      width: 210mm;
      min-height: 297mm;
      padding: ${config.pageMargins.top} ${config.pageMargins.right} ${config.pageMargins.bottom} ${config.pageMargins.left};
      padding-bottom: 32mm;
      display: flex;
      flex-direction: column;
      margin: 0 auto;
    }
    
    /* ===== UNIFIED HEADER ===== */
    .print-header {
      display: flex;
      flex-direction: ${config.flexDirection};
      justify-content: ${config.justifyContent};
      align-items: ${config.alignItems};
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px solid ${config.primaryColor};
    }
    
    .document-info {
      flex: 0 0 45%;
      text-align: ${config.direction === 'rtl' ? 'left' : 'right'};
      direction: ${config.direction === 'rtl' ? 'ltr' : 'rtl'};
    }
    
    .document-title {
      font-size: 28px;
      font-weight: 700;
      color: ${config.secondaryColor};
      margin-bottom: 5px;
      letter-spacing: 2px;
      font-family: Manrope, sans-serif;
      text-transform: uppercase;
    }
    
    .document-subtitle {
      font-size: 16px;
      font-weight: 600;
      color: ${config.primaryColor};
      margin-bottom: 10px;
    }
    
    .document-details {
      font-size: 11px;
      color: #666;
      line-height: 1.8;
    }
    
    .document-details-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    
    .document-details-label {
      font-weight: 700;
      color: ${config.primaryColor};
    }
    
    .company-info {
      flex: 0 0 50%;
      display: flex;
      flex-direction: column;
      align-items: ${config.direction === 'rtl' ? 'flex-end' : 'flex-start'};
      gap: 8px;
    }
    
    .company-logo {
      max-width: 200px;
      max-height: 80px;
      height: auto;
      object-fit: contain;
    }
    
    .company-name {
      font-size: 18px;
      font-weight: 700;
      color: ${config.primaryColor};
    }
    
    .company-subtitle-text {
      font-size: 13px;
      color: ${config.secondaryColor};
    }
    
    .company-contact {
      font-size: 10px;
      color: #666;
      text-align: ${config.direction === 'rtl' ? 'right' : 'left'};
    }
    
    /* ===== CUSTOMER/PARTY SECTION ===== */
    .party-section {
      background: ${config.accentColor};
      padding: 15px 20px;
      margin-bottom: 20px;
      border-${config.direction === 'rtl' ? 'right' : 'left'}: 4px solid ${config.primaryColor};
    }

    .party-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
      color: ${config.primaryColor};
    }

    .party-details {
      font-size: 12px;
      line-height: 1.8;
      color: #333;
    }

    /* ===== UNIFIED TABLE ===== */
    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      table-layout: fixed;
      font-size: 11px;
    }

    .print-table thead { display: table-header-group; }
    .print-table tfoot { display: table-footer-group; }
    .print-table tr { page-break-inside: avoid; }

    .print-table th {
      background: ${config.tableHeaderBgColor};
      color: ${config.tableHeaderTextColor};
      padding: 12px 8px;
      text-align: center;
      font-weight: 700;
      border: 1px solid ${config.tableBorderColor};
      font-size: 12px;
    }

    .print-table td {
      padding: 10px 8px;
      text-align: center;
      border: 1px solid ${config.tableBorderColor};
      vertical-align: middle;
      color: #333;
    }

    .print-table td.text-right {
      text-align: right;
      padding-right: 8px;
    }

    .print-table td.text-left {
      text-align: left;
      padding-left: 8px;
    }

    .print-table tbody tr:nth-child(even) {
      background: ${config.tableRowEvenColor};
    }

    .print-table tbody tr:nth-child(odd) {
      background: ${config.tableRowOddColor};
    }

    .debit-cell {
      color: #dc2626;
      font-weight: 700;
    }

    .credit-cell {
      color: #16a34a;
      font-weight: 700;
    }

    .balance-cell {
      font-weight: 700;
      color: #333;
    }

    /* ===== TOTALS ROWS ===== */
    .totals-row {
      background: ${config.accentColor} !important;
    }

    .totals-row td {
      padding: 12px 8px !important;
      font-weight: 700;
      font-size: 13px;
    }

    .grand-total-row {
      background: ${config.primaryColor} !important;
    }

    .grand-total-row td {
      padding: 15px 12px !important;
      font-weight: 700;
      font-size: 16px;
      color: ${config.headerTextColor} !important;
    }

    /* ===== SUMMARY SECTION ===== */
    .summary-section {
      margin-top: 25px;
      padding: 20px;
      background: ${config.accentColor};
      border: 2px solid ${config.primaryColor};
      border-radius: 8px;
    }

    .summary-title {
      font-size: 16px;
      font-weight: 700;
      color: ${config.primaryColor};
      text-align: center;
      margin-bottom: 15px;
    }
    
    .summary-grid {
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    
    .summary-item {
      padding: 10px 20px;
    }
    
    .summary-value {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .summary-value.positive { color: #27ae60; }
    .summary-value.negative { color: #e74c3c; }
    .summary-value.neutral { color: ${config.primaryColor}; }
    
    .summary-label {
      font-size: 12px;
      color: #666;
    }
    
    .amount-words {
      margin-top: 15px;
      padding: 12px;
      background: #fff;
      border: 1px dashed ${config.primaryColor};
      text-align: center;
      font-size: 13px;
      color: #666;
    }
    
    /* ===== UNIFIED FOOTER ===== */
    .print-footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 2px solid ${config.primaryColor};
      display: flex;
      flex-direction: ${config.flexDirection};
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #666;
      text-align: ${config.footerTextAlign};
    }
    
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    
    /* ===== DARK MODE OVERRIDE ===== */
    html, body, .dark, [data-theme="dark"] {
      background-color: #ffffff !important;
      color: #333333 !important;
      color-scheme: light !important;
    }
    
    @media print {
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #333333 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-scheme: light !important;
      }
      
      /* Force light mode for all elements */
      *, *::before, *::after {
        color-scheme: light !important;
      }
      
      .dark, [data-theme="dark"], [class*="dark"] {
        background-color: #ffffff !important;
        color: #333333 !important;
      }

      .print-container {
        width: 100% !important;
        max-width: 180mm !important;
        padding: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
        background-color: #ffffff !important;
      }

      .print-table thead {
        display: table-header-group !important;
      }

      .print-table tr {
        page-break-inside: avoid !important;
      }

      .summary-section {
        page-break-inside: avoid !important;
      }
    }
  `;
}

// =====================================================
// توليد Header الموحد
// =====================================================

export interface DocumentHeaderData {
  titleEn: string;
  titleAr: string;
  documentNumber: string;
  date: string;
  additionalDetails?: { label: string; value: string }[];
}

export function generateDocumentHeader(
  config: PrintLayoutConfig,
  headerData: DocumentHeaderData,
  logoDataUri: string
): string {
  const detailsHtml = headerData.additionalDetails
    ?.map(detail => `
      <div class="document-details-row">
        <span class="document-details-label">${detail.label}:</span>
        <span>${detail.value}</span>
      </div>
    `).join('') || '';

  // ✅ بناء قسم معلومات الشركة بناءً على الإعدادات
  const companyInfoParts: string[] = [];
  
  // الشعار
  if (config.showLogo && logoDataUri) {
    companyInfoParts.push(`<img src="${logoDataUri}" alt="شعار الشركة" class="company-logo" style="max-width: ${config.logoSize}; max-height: ${config.logoSize};" onerror="this.style.display='none'">`);
  }
  
  // اسم الشركة
  if (config.showCompanyName && config.companyName) {
    companyInfoParts.push(`<div class="company-name">${config.companyName}</div>`);
  }
  
  // شعار/تاغلاين الشركة
  if (config.showCompanySubtitle && config.companySubtitle) {
    companyInfoParts.push(`<div class="company-subtitle-text">${config.companySubtitle}</div>`);
  }
  
  // العنوان والاتصال
  const contactParts: string[] = [];
  if (config.showCompanyAddress && config.companyAddress) {
    contactParts.push(config.companyAddress);
  }
  if (config.showCompanyContact && config.companyPhone) {
    contactParts.push(`هاتف: ${config.companyPhone}`);
  }
  if (contactParts.length > 0) {
    companyInfoParts.push(`<div class="company-contact">${contactParts.join('<br>')}</div>`);
  }

  return `
    <div class="print-header">
      <div class="document-info">
        <div class="document-title">${headerData.titleEn}</div>
        <div class="document-subtitle">${headerData.titleAr}</div>
        <div class="document-details">
          <div class="document-details-row">
            <span class="document-details-label">الرقم:</span>
            <span>${headerData.documentNumber}</span>
          </div>
          <div class="document-details-row">
            <span class="document-details-label">التاريخ:</span>
            <span>${headerData.date}</span>
          </div>
          ${detailsHtml}
        </div>
      </div>
      
      <div class="company-info">
        ${companyInfoParts.join('\n        ')}
      </div>
    </div>
  `;
}

// =====================================================
// توليد قسم الطرف (عميل/مورد)
// =====================================================

export interface PartyData {
  title: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  id?: string;
  additionalFields?: { label: string; value: string }[];
}

export function generatePartySection(partyData: PartyData): string {
  const additionalFieldsHtml = partyData.additionalFields
    ?.map(field => `<strong>${field.label}:</strong> ${field.value}<br>`)
    .join('') || '';

  return `
    <div class="party-section">
      <div class="party-title">${partyData.title}</div>
      <div class="party-details">
        <strong>الاسم:</strong> ${partyData.name}<br>
        ${partyData.company ? `<strong>الشركة:</strong> ${partyData.company}<br>` : ''}
        ${partyData.phone ? `<strong>الهاتف:</strong> ${partyData.phone}<br>` : ''}
        ${partyData.email ? `<strong>البريد الإلكتروني:</strong> ${partyData.email}<br>` : ''}
        ${additionalFieldsHtml}
        ${partyData.id ? `<strong>رقم العميل:</strong> ${partyData.id}` : ''}
      </div>
    </div>
  `;
}

// =====================================================
// توليد Footer الموحد
// =====================================================

export function generateDocumentFooter(config: PrintLayoutConfig): string {
  if (!config.showFooter) return '';
  
  return `
    <div class="print-footer">
      <div>${config.footerText || 'شكراً لتعاملكم معنا | Thank you for your business'}</div>
      <div>هذا مستند إلكتروني ولا يحتاج إلى ختم أو توقيع</div>
    </div>
  `;
}

// =====================================================
// توليد HTML الكامل للطباعة
// =====================================================

export interface PrintDocumentData {
  title: string;
  headerData: DocumentHeaderData;
  partyData?: PartyData;
  bodyContent: string;
  footerContent?: string;
  customCSS?: string;
}

export function generatePrintHTML(
  settings: Partial<PrintSettings>,
  documentData: PrintDocumentData,
  logoDataUri: string
): string {
  const config = getPrintLayoutConfig(settings);
  
  return `
    <!DOCTYPE html>
    <html dir="${config.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentData.title}</title>
      <style>
        ${generateBasePrintCSS(config)}
        ${documentData.customCSS || ''}
      </style>
    </head>
    <body dir="${config.direction}" style="font-family: '${config.fontFamily}', 'Noto Sans Arabic', sans-serif;">
      <div class="print-container">
        ${generateDocumentHeader(config, documentData.headerData, logoDataUri)}
        ${documentData.partyData ? generatePartySection(documentData.partyData) : ''}
        ${documentData.bodyContent}
        ${documentData.footerContent || generateDocumentFooter(config)}
      </div>
      
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;
}

// =====================================================
// دوال مساعدة للتنسيق
// =====================================================

export function formatArabicNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
}

export function formatDate(date: string | Date | null, locale: string = 'ar-LY'): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale);
}

// =====================================================
// فتح نافذة الطباعة
// =====================================================

export function openPrintWindow(htmlContent: string, documentTitle: string): Window | null {
  const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
  const printWindow = window.open('', '_blank', windowFeatures);

  if (!printWindow) {
    throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
  }

  printWindow.document.title = documentTitle;
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  return printWindow;
}
