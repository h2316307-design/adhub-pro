export type AlignmentOption = 'left' | 'center' | 'right';

export interface UnifiedPrintStyles {
  // Shared-ish
  companyName?: string;
  companySubtitle?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  companyEmail?: string;
  companyWebsite?: string;
  logoPath?: string;
  logoSize?: number;
  logoPosition?: AlignmentOption;

  // Header alignment (applies to the company/info column as a whole)
  headerAlignment?: AlignmentOption;

  showLogo?: boolean;
  showContactInfo?: boolean;
  contactInfoFontSize?: number;
  contactInfoAlignment?: AlignmentOption;
  showCompanyInfo?: boolean;
  showCompanyName?: boolean;
  showCompanySubtitle?: boolean;
  showCompanyAddress?: boolean;
  showCompanyPhone?: boolean;
  showTaxId?: boolean;
  showEmail?: boolean;
  showWebsite?: boolean;

  // Layout
  headerMarginBottom?: number;
  footerPosition?: number;
  footerAlignment?: AlignmentOption;
  footerText?: string;
  footerTextColor?: string;
  footerBgColor?: string;
  showFooter?: boolean;
  showPageNumber?: boolean;

  // Colors
  primaryColor?: string;
  secondaryColor?: string;
  customerSectionTextColor?: string;
  tableBorderColor?: string;

  // Invoice title
  invoiceTitleEn?: string;
  invoiceTitleAlignment?: AlignmentOption;
}

const textAlign = (a?: AlignmentOption) => (a === 'center' ? 'center' : a === 'right' ? 'right' : 'left');
const flexAlign = (a?: AlignmentOption) => (a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end');
const flexJustify = (a?: AlignmentOption) => (a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end');

export function unifiedHeaderFooterCss(styles: UnifiedPrintStyles) {
  const headerMarginBottom = styles.headerMarginBottom ?? 20;
  const footerPosition = styles.footerPosition ?? 15;

  const companyAlign = styles.headerAlignment ?? styles.logoPosition;

  return `
  /* Unified Header/Footer (matches UnifiedInvoicePreview layout) */
  .u-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${headerMarginBottom}px;padding-bottom:15px;border-bottom:2px solid ${styles.primaryColor};direction:rtl;flex-direction:row-reverse}
  .u-header-left{flex:1;text-align:${textAlign(styles.invoiceTitleAlignment)};direction:ltr}
  .u-title{font-size:28px;font-weight:700;margin:0;font-family:Manrope, sans-serif;letter-spacing:2px;color:${styles.secondaryColor}}
  .u-meta{font-size:11px;color:${styles.customerSectionTextColor};margin-top:8px;line-height:1.6}

  /* Company column alignment comes from headerAlignment; logo can still be positioned separately */
  .u-header-right{flex:1;display:flex;flex-direction:column;align-items:${flexAlign(companyAlign)};gap:8px}
  .u-logo{height:${styles.logoSize ?? 70}px;object-fit:contain;flex-shrink:0;align-self:${flexAlign(styles.logoPosition)}}
  .u-contact{width:100%;font-size:${styles.contactInfoFontSize ?? 10}px;color:${styles.customerSectionTextColor};line-height:1.6;text-align:${textAlign(companyAlign)}}
  .u-company{width:100%;font-size:11px;color:${styles.customerSectionTextColor};line-height:1.8;text-align:${textAlign(companyAlign)}}
  .u-company-name{font-weight:700;font-size:14px;color:${styles.primaryColor};margin-bottom:2px}

  .u-footer{width:100%;margin-bottom:${footerPosition}mm;padding-top:10px;border-top:1px solid ${styles.tableBorderColor};background:${styles.footerBgColor && styles.footerBgColor !== 'transparent' ? styles.footerBgColor : 'transparent'};color:${styles.footerTextColor};font-size:10px;display:flex;align-items:center;justify-content:${flexJustify(styles.footerAlignment)};gap:20px}
  .u-page-number{${styles.footerAlignment === 'right' ? 'margin-right:auto' : styles.footerAlignment === 'left' ? 'margin-left:auto' : ''}}
  `;
}

export function unifiedHeaderHtml(opts: {
  styles: UnifiedPrintStyles;
  fullLogoUrl: string;
  metaLinesHtml: string;
  titleEn?: string;
}) {
  const { styles, fullLogoUrl, metaLinesHtml } = opts;

  const titleEn = opts.titleEn || styles.invoiceTitleEn || 'INVOICE';

  const showInvoiceTitle = true;
  const showLogo = styles.showLogo !== false;

  return `
  <div class="u-header">
    ${showInvoiceTitle ? `
    <div class="u-header-left">
      <h1 class="u-title">${titleEn}</h1>
      <div class="u-meta">${metaLinesHtml}</div>
    </div>
    ` : ''}

    <div class="u-header-right">
      ${showLogo ? `<img src="${fullLogoUrl}" alt="Logo" class="u-logo" onerror="this.style.display='none'"/>` : ''}

      ${(styles.showCompanyAddress || styles.showCompanyPhone || styles.showTaxId || styles.showEmail || styles.showWebsite) ? `
      <div class="u-contact">
        ${styles.showCompanyAddress && styles.companyAddress ? `<div>${styles.companyAddress}</div>` : ''}
        ${styles.showCompanyPhone && styles.companyPhone ? `<div>هاتف: ${styles.companyPhone}</div>` : ''}
        ${styles.showTaxId && styles.companyTaxId ? `<div>الرقم الضريبي: ${styles.companyTaxId}</div>` : ''}
        ${styles.showEmail && styles.companyEmail ? `<div>${styles.companyEmail}</div>` : ''}
        ${styles.showWebsite && styles.companyWebsite ? `<div>${styles.companyWebsite}</div>` : ''}
      </div>
      ` : ''}

      ${styles.showCompanyInfo && (styles.showCompanyName || styles.showCompanySubtitle) ? `
      <div class="u-company">
        ${styles.showCompanyName && styles.companyName ? `<div class="u-company-name">${styles.companyName}</div>` : ''}
        ${styles.showCompanySubtitle && styles.companySubtitle ? `<div>${styles.companySubtitle}</div>` : ''}
      </div>
      ` : ''}
    </div>
  </div>
  `;
}

export function unifiedFooterHtml(styles: UnifiedPrintStyles, pageText = 'صفحة 1 من 1') {
  if (styles.showFooter === false) return '';

  return `
  <div class="u-footer">
    <span>${styles.footerText || ''}</span>
    ${styles.showPageNumber !== false ? `<span class="u-page-number">${pageText}</span>` : ''}
  </div>
  `;
}

