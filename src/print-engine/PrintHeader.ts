/**
 * PrintHeader
 * يولد HTML الهيدر الموحد
 * 
 * ⚠️ جميع الألوان والخصائص من theme فقط
 * ✅ يدعم التحكم الدقيق في العناصر (show_company_name, show_company_subtitle, etc.)
 */

import { PrintTheme, DocumentHeaderData } from './types';

export function generatePrintHeader(
  theme: PrintTheme,
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
  if (theme.showLogo && logoDataUri) {
    companyInfoParts.push(`<img src="${logoDataUri}" alt="شعار الشركة" class="company-logo" style="max-width: ${theme.logoSize}; max-height: ${theme.logoSize};" onerror="this.style.display='none'">`);
  }
  
  // اسم الشركة
  if (theme.showCompanyName && theme.companyName) {
    companyInfoParts.push(`<div class="company-name">${theme.companyName}</div>`);
  }
  
  // شعار/تاغلاين الشركة
  if (theme.showCompanySubtitle && theme.companySubtitle) {
    companyInfoParts.push(`<div class="company-subtitle-text">${theme.companySubtitle}</div>`);
  }
  
  // العنوان والاتصال
  const contactParts: string[] = [];
  if (theme.showCompanyAddress && theme.companyAddress) {
    contactParts.push(theme.companyAddress);
  }
  if (theme.showCompanyContact && theme.companyPhone) {
    contactParts.push(`هاتف: ${theme.companyPhone}`);
  }
  if (contactParts.length > 0) {
    companyInfoParts.push(`<div class="company-contact">${contactParts.join('<br>')}</div>`);
  }

  // ✅ تطبيق header direction و logo position order
  const headerStyle = `
    display: flex;
    flex-direction: ${theme.flexDirection};
    justify-content: ${theme.justifyContent};
    align-items: ${theme.alignItems};
    margin-bottom: ${theme.headerMarginBottom};
  `;

  return `
    <div class="print-header" style="${headerStyle}">
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
