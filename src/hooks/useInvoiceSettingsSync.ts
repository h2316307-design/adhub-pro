/**
 * Synchronous Invoice Settings Getter
 * للاستخدام في دوال توليد HTML حيث لا يمكن استخدام async
 */
import { supabase } from '@/integrations/supabase/client';
import {
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
  InvoiceTemplateType,
  INVOICE_TEMPLATES,
} from '@/types/invoice-templates';
import { fetchPrintSettingsForInvoice } from '@/utils/invoicePrintSettingsBridge';

const SETTINGS_KEY = 'unified_invoice_templates_settings';

// Cache for settings
let cachedSettings: AllInvoiceSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Fetch settings synchronously from cache or return defaults
export function getInvoiceSettingsSync(): {
  shared: SharedInvoiceSettings;
  individual: Record<InvoiceTemplateType, IndividualInvoiceSettings>;
} {
  if (cachedSettings && Date.now() - lastFetchTime < CACHE_DURATION) {
    return {
      shared: { ...DEFAULT_SHARED_SETTINGS, ...cachedSettings.shared },
      individual: cachedSettings.individual as Record<InvoiceTemplateType, IndividualInvoiceSettings>,
    };
  }

  // Return defaults if cache is empty
  const defaultIndividual: Record<string, IndividualInvoiceSettings> = {};
  INVOICE_TEMPLATES.forEach(t => {
    defaultIndividual[t.id] = { ...DEFAULT_INDIVIDUAL_SETTINGS };
  });

  return {
    shared: DEFAULT_SHARED_SETTINGS,
    individual: defaultIndividual as Record<InvoiceTemplateType, IndividualInvoiceSettings>,
  };
}

// Prefetch settings (call this early in the app lifecycle)
export async function prefetchInvoiceSettings(): Promise<void> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', SETTINGS_KEY)
      .single();

    if (data?.setting_value) {
      cachedSettings = JSON.parse(data.setting_value);
      lastFetchTime = Date.now();
    }
  } catch (e) {
    console.log('No saved invoice template settings found, using defaults');
  }
}

// Update cache when settings change
export function updateInvoiceSettingsCache(settings: AllInvoiceSettings): void {
  cachedSettings = settings;
  lastFetchTime = Date.now();
}

// Clear cache
export function clearInvoiceSettingsCache(): void {
  cachedSettings = null;
  lastFetchTime = 0;
}

// ✅ Async version - fetches from DB if cache is empty
export async function fetchInvoiceSettingsAsync(): Promise<{
  shared: SharedInvoiceSettings;
  individual: Record<InvoiceTemplateType, IndividualInvoiceSettings>;
}> {
  // Return from cache if valid
  if (cachedSettings && Date.now() - lastFetchTime < CACHE_DURATION) {
    return {
      shared: { ...DEFAULT_SHARED_SETTINGS, ...cachedSettings.shared },
      individual: cachedSettings.individual as Record<InvoiceTemplateType, IndividualInvoiceSettings>,
    };
  }

  // Fetch from database
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', SETTINGS_KEY)
      .single();

    if (data?.setting_value) {
      cachedSettings = JSON.parse(data.setting_value);
      lastFetchTime = Date.now();
      return {
        shared: { ...DEFAULT_SHARED_SETTINGS, ...cachedSettings!.shared },
        individual: cachedSettings!.individual as Record<InvoiceTemplateType, IndividualInvoiceSettings>,
      };
    }
  } catch (e) {
    console.log('No saved invoice template settings found, using defaults');
  }

  // Return defaults
  const defaultIndividual: Record<string, IndividualInvoiceSettings> = {};
  INVOICE_TEMPLATES.forEach(t => {
    defaultIndividual[t.id] = { ...DEFAULT_INDIVIDUAL_SETTINGS };
  });

  return {
    shared: DEFAULT_SHARED_SETTINGS,
    individual: defaultIndividual as Record<InvoiceTemplateType, IndividualInvoiceSettings>,
  };
}

// Get merged styles for a specific invoice type (sync - uses cache)
export function getMergedInvoiceStyles(type: InvoiceTemplateType) {
  const settings = getInvoiceSettingsSync();
  const shared = settings.shared;
  const individual = settings.individual[type] || DEFAULT_INDIVIDUAL_SETTINGS;

  return mergeSettings(shared, individual);
}

// ✅ Async version - always fetches fresh data + merges from print_settings
export async function getMergedInvoiceStylesAsync(type: InvoiceTemplateType) {
  const settings = await fetchInvoiceSettingsAsync();
  const shared = settings.shared;
  const individual = settings.individual[type] || DEFAULT_INDIVIDUAL_SETTINGS;

  const baseStyles = mergeSettings(shared, individual);

  // ✅ جلب إعدادات print_settings (صفحة تصميم الطباعة) ودمجها
  try {
    const printSettingsOverrides = await fetchPrintSettingsForInvoice(type);
    if (printSettingsOverrides) {
      // print_settings تتجاوز الإعدادات الأساسية (فقط القيم غير الفارغة)
      return { ...baseStyles, ...printSettingsOverrides };
    }
  } catch (e) {
    console.log('Could not fetch print_settings bridge, using invoice settings only');
  }

  return baseStyles;
}

// Helper to merge shared and individual settings
function mergeSettings(shared: SharedInvoiceSettings, individual: IndividualInvoiceSettings) {
  return {
    // Shared settings
    companyName: shared.companyName,
    companySubtitle: shared.companySubtitle,
    companyAddress: shared.companyAddress,
    companyPhone: shared.companyPhone,
    logoPath: shared.logoPath,
    logoSize: shared.logoSize,
    logoPosition: shared.logoPosition,
    showContactInfo: shared.showContactInfo,
    contactInfoFontSize: shared.contactInfoFontSize,
    contactInfoAlignment: shared.contactInfoAlignment || 'center',
    headerBgColor: shared.headerBgColor,
    headerTextColor: shared.headerTextColor,
    headerBgOpacity: shared.headerBgOpacity,
    headerAlignment: shared.headerAlignment,
    invoiceTitle: shared.invoiceTitle,
    invoiceTitleEn: shared.invoiceTitleEn,
    showInvoiceTitle: shared.showInvoiceTitle,
    invoiceTitleAlignment: shared.invoiceTitleAlignment,
    invoiceTitleFontSize: shared.invoiceTitleFontSize || 28,
    showLogo: shared.showLogo,
    showCompanyInfo: shared.showCompanyInfo,
    showCompanyName: shared.showCompanyName,
    showCompanySubtitle: shared.showCompanySubtitle,
    showCompanyAddress: shared.showCompanyAddress,
    showCompanyPhone: shared.showCompanyPhone,
    showTaxId: shared.showTaxId,
    showEmail: shared.showEmail,
    showWebsite: shared.showWebsite,
    companyTaxId: shared.companyTaxId,
    companyEmail: shared.companyEmail,
    companyWebsite: shared.companyWebsite,
    showFooter: shared.showFooter,
    showPageNumber: shared.showPageNumber,
    footerText: shared.footerText,
    footerAlignment: shared.footerAlignment,
    footerBgColor: shared.footerBgColor,
    footerTextColor: shared.footerTextColor,
    footerPosition: shared.footerPosition,
    backgroundImage: shared.backgroundImage,
    backgroundOpacity: shared.backgroundOpacity,
    backgroundScale: shared.backgroundScale,
    backgroundPosX: shared.backgroundPosX,
    backgroundPosY: shared.backgroundPosY,
    fontFamily: shared.fontFamily,
    headerMarginBottom: shared.headerMarginBottom,
    contentBottomSpacing: shared.contentBottomSpacing,
    pageMarginTop: shared.pageMarginTop,
    pageMarginBottom: shared.pageMarginBottom,
    pageMarginLeft: shared.pageMarginLeft,
    pageMarginRight: shared.pageMarginRight,

    // Individual - Main colors
    primaryColor: individual.primaryColor,
    secondaryColor: individual.secondaryColor,
    accentColor: individual.accentColor,
    
    // Individual - Customer section
    customerSectionBgColor: individual.customerSectionBgColor,
    customerSectionBorderColor: individual.customerSectionBorderColor,
    customerSectionTitleColor: individual.customerSectionTitleColor,
    customerSectionTextColor: individual.customerSectionTextColor,
    customerSectionAlignment: individual.customerSectionAlignment,
    
    // Individual - Table
    tableBorderColor: individual.tableBorderColor,
    tableHeaderBgColor: individual.tableHeaderBgColor,
    tableHeaderTextColor: individual.tableHeaderTextColor,
    tableRowEvenColor: individual.tableRowEvenColor,
    tableRowOddColor: individual.tableRowOddColor,
    tableTextColor: individual.tableTextColor,
    tableRowOpacity: individual.tableRowOpacity,
    
    // Individual - Totals
    subtotalBgColor: individual.subtotalBgColor,
    subtotalTextColor: individual.subtotalTextColor,
    discountTextColor: individual.discountTextColor,
    totalBgColor: individual.totalBgColor,
    totalTextColor: individual.totalTextColor,
    totalsAlignment: individual.totalsAlignment,
    
    // Individual - Notes
    notesBgColor: individual.notesBgColor,
    notesTextColor: individual.notesTextColor,
    notesBorderColor: individual.notesBorderColor,
    notesAlignment: individual.notesAlignment,
    
    // Individual - Font sizes
    titleFontSize: individual.titleFontSize,
    headerFontSize: individual.headerFontSize,
    bodyFontSize: individual.bodyFontSize,
    
    // Individual - Section visibility
    showHeader: individual.showHeader,
    showCustomerSection: individual.showCustomerSection,
    showNotesSection: individual.showNotesSection,
    showBillboardsSection: individual.showBillboardsSection,
    showItemsSection: individual.showItemsSection,
    showServicesSection: individual.showServicesSection,
    showTransactionsSection: individual.showTransactionsSection,
    showTotalsSection: individual.showTotalsSection,
    showPaymentInfoSection: individual.showPaymentInfoSection,
    showSignaturesSection: individual.showSignaturesSection,
    showTeamInfoSection: individual.showTeamInfoSection,
    showCustodyInfoSection: individual.showCustodyInfoSection,
    showBalanceSummarySection: individual.showBalanceSummarySection,
    
    // Individual - Payment section
    paymentSectionBgColor: individual.paymentSectionBgColor,
    paymentSectionBorderColor: individual.paymentSectionBorderColor,
    paymentSectionTitleColor: individual.paymentSectionTitleColor,
    paymentSectionTextColor: individual.paymentSectionTextColor,
    
    // Individual - Signatures section
    signaturesSectionBgColor: individual.signaturesSectionBgColor,
    signaturesSectionBorderColor: individual.signaturesSectionBorderColor,
    signaturesSectionTextColor: individual.signaturesSectionTextColor,
    signatureLineColor: individual.signatureLineColor,
    
    // Individual - Team section
    teamSectionBgColor: individual.teamSectionBgColor,
    teamSectionBorderColor: individual.teamSectionBorderColor,
    teamSectionTitleColor: individual.teamSectionTitleColor,
    teamSectionTextColor: individual.teamSectionTextColor,
    
    // Individual - Custody section
    custodySectionBgColor: individual.custodySectionBgColor,
    custodySectionBorderColor: individual.custodySectionBorderColor,
    custodySectionTitleColor: individual.custodySectionTitleColor,
    custodySectionTextColor: individual.custodySectionTextColor,
    
    // Individual - Balance summary
    balanceSummaryBgColor: individual.balanceSummaryBgColor,
    balanceSummaryBorderColor: individual.balanceSummaryBorderColor,
    balanceSummaryTitleColor: individual.balanceSummaryTitleColor,
    balanceSummaryTextColor: individual.balanceSummaryTextColor,
    balanceSummaryPositiveColor: individual.balanceSummaryPositiveColor,
    balanceSummaryNegativeColor: individual.balanceSummaryNegativeColor,
    
    // Individual - Billboards section
    billboardsSectionBgColor: individual.billboardsSectionBgColor,
    billboardsSectionBorderColor: individual.billboardsSectionBorderColor,
    billboardsSectionTitleColor: individual.billboardsSectionTitleColor,
    
    // Individual - Services section
    servicesSectionBgColor: individual.servicesSectionBgColor,
    servicesSectionBorderColor: individual.servicesSectionBorderColor,
    servicesSectionTitleColor: individual.servicesSectionTitleColor,
    
    // Individual - Transactions section
    transactionsSectionBgColor: individual.transactionsSectionBgColor,
    transactionsSectionBorderColor: individual.transactionsSectionBorderColor,
    transactionsSectionTitleColor: individual.transactionsSectionTitleColor,
    transactionsSectionTextColor: individual.transactionsSectionTextColor,
  };
}

// Helper function to convert hex to rgba
export function hexToRgba(hex: string, opacity: number): string {
  if (!hex || hex === 'transparent') return 'transparent';
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  } catch {
    return hex;
  }
}
