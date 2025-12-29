/**
 * Measurements Style Configuration - BLACK/GRAY FORMAL THEME
 * تكوين نمط المقاسات - ثيم أسود/رمادي رسمي
 */

import { PrintConfig, createDefaultPrintConfig } from './types';

export interface MeasurementsThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  tableBorderColor?: string;
}

export const createMeasurementsConfig = (settings: MeasurementsThemeSettings = {}): PrintConfig => {
  const config = createDefaultPrintConfig();

  // === THEME: Formal Black & White ===
  const primaryColor = '#000000'; 
  const secondaryColor = '#333333';
  const borderColor = '#000000'; 

  // === PAGE: A4 Compact ===
  config.page.direction = 'rtl';
  config.page.width = '210mm';
  config.page.minHeight = '297mm';
  config.page.padding = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' };
  config.page.backgroundColor = '#ffffff';
  config.page.fontFamily = 'Doran, Cairo, Tajawal, sans-serif';
  config.page.fontSize = '10px';
  config.page.lineHeight = '1.4';

  // === HEADER ===
  config.header.enabled = true;
  config.header.height = '150px';
  config.header.backgroundColor = 'transparent';
  config.header.padding = '0';
  config.header.marginBottom = '12px';
  config.header.borderBottom = `2px solid ${primaryColor}`;
  
  // === LOGO (Fixed 101px) ===
  config.header.logo.enabled = true;
  config.header.logo.url = '/logofares.svg'; 
  config.header.logo.width = 'auto';
  config.header.logo.height = '101px';
  config.header.logo.positionX = '0';
  config.header.logo.positionY = '50%';
  config.header.logo.objectFit = 'contain';
  
  // === TITLE ===
  config.header.title.enabled = true;
  config.header.title.text = 'كشف حساب';
  config.header.title.fontSize = '22px';
  config.header.title.fontWeight = 'bold';
  config.header.title.color = secondaryColor;
  config.header.title.alignment = 'left';
  config.header.title.positionX = '0';
  config.header.title.positionY = '50%';

  // Subtitle
  config.header.subtitle.enabled = false;

  // Document Info
  config.header.documentInfo.enabled = true;
  config.header.documentInfo.alignment = 'left';
  config.header.documentInfo.fontSize = '10px';
  config.header.documentInfo.color = secondaryColor;

  // === Company Info ===
  config.companyInfo.enabled = false;

  // === Party Info (Customer Section) ===
  config.partyInfo.enabled = true;
  config.partyInfo.backgroundColor = '#f5f5f5';
  config.partyInfo.borderColor = secondaryColor;
  config.partyInfo.borderRadius = '8px';
  config.partyInfo.padding = '12px';
  config.partyInfo.marginBottom = '15px';
  config.partyInfo.titleFontSize = '11px';
  config.partyInfo.titleColor = primaryColor;
  config.partyInfo.contentFontSize = '10px';
  config.partyInfo.contentColor = secondaryColor;

  // === TABLE (Grid) ===
  config.table.width = '100%';
  config.table.borderCollapse = 'collapse';
  config.table.borderSpacing = '0';
  config.table.marginBottom = '0';

  config.table.border.width = '1px';
  config.table.border.style = 'solid';
  config.table.border.color = borderColor;

  config.table.header.backgroundColor = '#f0f0f0'; 
  config.table.header.textColor = '#000000';
  config.table.header.fontSize = '10px';
  config.table.header.fontWeight = 'bold';
  config.table.header.padding = '4px 8px';
  config.table.header.borderColor = borderColor;
  config.table.header.textAlign = 'center';

  config.table.body.fontSize = '10px';
  config.table.body.padding = '4px';
  config.table.body.borderColor = borderColor;
  config.table.body.oddRowBackground = '#ffffff';
  config.table.body.evenRowBackground = '#f5f5f5';
  config.table.body.textColor = '#000000';

  // === TOTALS ===
  config.totals.enabled = true;
  config.totals.backgroundColor = '#1a1a1a';
  config.totals.textColor = '#ffffff';
  config.totals.borderColor = borderColor;
  config.totals.borderRadius = '0';
  config.totals.padding = '6px 4px';
  config.totals.titleFontSize = '11px';
  config.totals.titleFontWeight = 'bold';
  config.totals.valueFontSize = '11px';
  config.totals.valueFontWeight = 'bold';
  config.totals.alignment = 'center';

  // === Footer ===
  config.footer.enabled = true;
  config.footer.text = '';
  config.footer.fontSize = '9px';
  config.footer.color = '#666666';
  config.footer.alignment = 'center';
  config.footer.borderTop = `1px solid ${borderColor}`;
  config.footer.padding = '8px 0';
  config.footer.marginTop = '12px';
  config.footer.showPageNumber = true;
  config.footer.pageNumberFormat = 'صفحة {page}';

  // === Notes Section ===
  config.notes.enabled = true;
  config.notes.title = 'ملاحظات';
  config.notes.fontSize = '9px';
  config.notes.color = '#333333';
  config.notes.backgroundColor = '#f5f5f5';
  config.notes.borderColor = '#cccccc';
  config.notes.padding = '8px';
  config.notes.marginTop = '10px';

  return config;
};

/**
 * Map existing print theme to measurements config
 * IGNORES theme colors - FORCES BLACK/GRAY
 */
export const mapPrintThemeToMeasurementsConfig = (_theme: any): PrintConfig => {
  return createMeasurementsConfig();
};

export default createMeasurementsConfig;
