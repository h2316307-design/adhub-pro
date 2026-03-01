/**
 * جسر بين نظام print_settings (صفحة تصميم الطباعة) ونظام invoice_templates (الفواتير)
 * يسمح لصفحة تصميم الطباعة بالتحكم الكامل في مظهر الفواتير
 */

import { supabase } from '@/integrations/supabase/client';
import { InvoiceTemplateType } from '@/types/invoice-templates';
import { DocumentType, DOCUMENT_TYPES } from '@/types/document-types';

// =====================================================
// خريطة الربط بين أنواع الفواتير وأنواع المستندات
// =====================================================

const INVOICE_TO_DOCUMENT_MAP: Record<InvoiceTemplateType, DocumentType> = {
  contract: DOCUMENT_TYPES.CONTRACT_INVOICE,
  receipt: DOCUMENT_TYPES.PAYMENT_RECEIPT,
  print_invoice: DOCUMENT_TYPES.PRINT_SERVICE_INVOICE,
  sales_invoice: DOCUMENT_TYPES.SALES_INVOICE,
  purchase_invoice: DOCUMENT_TYPES.PURCHASE_INVOICE,
  custody: DOCUMENT_TYPES.CUSTODY_STATEMENT,
  expenses: DOCUMENT_TYPES.EXPENSE_INVOICE,
  installation: DOCUMENT_TYPES.INSTALLATION_INVOICE,
  team_payment: DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT,
  offer: DOCUMENT_TYPES.QUOTATION,
  account_statement: DOCUMENT_TYPES.ACCOUNT_STATEMENT,
  overdue_notice: DOCUMENT_TYPES.LATE_NOTICE,
  friend_rental: DOCUMENT_TYPES.FRIEND_RENT_RECEIPT,
  print_task: DOCUMENT_TYPES.PRINT_TASK,
  cutout_task: DOCUMENT_TYPES.CUT_TASK,
  composite_task: DOCUMENT_TYPES.COMBINED_TASK,
  customer_invoice: DOCUMENT_TYPES.CUSTOMER_INVOICE,
  sizes_invoice: DOCUMENT_TYPES.MEASUREMENTS_INVOICE,
};

// Cache
let printSettingsCache: Record<string, any> = {};
let printSettingsCacheTime = 0;
const CACHE_TTL = 60000;

/**
 * جلب إعدادات print_settings لنوع فاتورة معين
 * وتحويلها إلى الصيغة المستخدمة في الفواتير
 */
export async function fetchPrintSettingsForInvoice(invoiceType: InvoiceTemplateType): Promise<Record<string, any> | null> {
  const documentType = INVOICE_TO_DOCUMENT_MAP[invoiceType];
  if (!documentType) return null;

  // Check cache
  if (printSettingsCache[documentType] && Date.now() - printSettingsCacheTime < CACHE_TTL) {
    return printSettingsCache[documentType];
  }

  try {
    const { data, error } = await supabase
      .from('print_settings')
      .select('*')
      .eq('document_type', documentType)
      .single();

    if (error || !data) return null;

    // تحويل أسماء الحقول من print_settings إلى صيغة الفواتير
    const mapped = mapPrintSettingsToInvoiceStyles(data);
    printSettingsCache[documentType] = mapped;
    printSettingsCacheTime = Date.now();
    return mapped;
  } catch {
    return null;
  }
}

/**
 * تحويل حقول print_settings إلى الصيغة المستخدمة في getMergedInvoiceStyles
 */
function mapPrintSettingsToInvoiceStyles(ps: any): Record<string, any> {
  const result: Record<string, any> = {};

  // بيانات الشركة - فقط إذا كانت محددة
  if (ps.company_name) result.companyName = ps.company_name;
  if (ps.company_subtitle) result.companySubtitle = ps.company_subtitle;
  if (ps.company_address) result.companyAddress = ps.company_address;
  if (ps.company_phone) result.companyPhone = ps.company_phone;

  // الشعار
  if (ps.logo_path) result.logoPath = ps.logo_path;
  if (ps.logo_size) result.logoSize = ps.logo_size;
  if (ps.logo_position) result.logoPosition = ps.logo_position;

  // إظهار/إخفاء
  if (ps.show_logo !== null && ps.show_logo !== undefined) result.showLogo = ps.show_logo;
  if (ps.show_footer !== null && ps.show_footer !== undefined) result.showFooter = ps.show_footer;
  if (ps.show_page_number !== null && ps.show_page_number !== undefined) result.showPageNumber = ps.show_page_number;
  if (ps.show_company_name !== null && ps.show_company_name !== undefined) result.showCompanyName = ps.show_company_name;
  if (ps.show_company_subtitle !== null && ps.show_company_subtitle !== undefined) result.showCompanySubtitle = ps.show_company_subtitle;
  if (ps.show_company_address !== null && ps.show_company_address !== undefined) result.showCompanyAddress = ps.show_company_address;
  if (ps.show_company_contact !== null && ps.show_company_contact !== undefined) result.showCompanyPhone = ps.show_company_contact;
  if (ps.show_customer_section !== null && ps.show_customer_section !== undefined) result.showCustomerSection = ps.show_customer_section;

  // ألوان
  if (ps.primary_color) result.primaryColor = ps.primary_color;
  if (ps.secondary_color) result.secondaryColor = ps.secondary_color;
  if (ps.accent_color) result.accentColor = ps.accent_color;
  if (ps.header_bg_color) result.headerBgColor = ps.header_bg_color;
  if (ps.header_text_color) result.headerTextColor = ps.header_text_color;

  // ألوان الجدول
  if (ps.table_border_color) result.tableBorderColor = ps.table_border_color;
  if (ps.table_header_bg_color) result.tableHeaderBgColor = ps.table_header_bg_color;
  if (ps.table_header_text_color) result.tableHeaderTextColor = ps.table_header_text_color;
  if (ps.table_row_even_color) result.tableRowEvenColor = ps.table_row_even_color;
  if (ps.table_row_odd_color) result.tableRowOddColor = ps.table_row_odd_color;
  if (ps.table_text_color) result.tableTextColor = ps.table_text_color;

  // خصائص الجدول
  if (ps.table_header_font_size) result.tableHeaderFontSize = ps.table_header_font_size;
  if (ps.table_header_padding) result.tableHeaderPadding = ps.table_header_padding;
  if (ps.table_header_font_weight) result.tableHeaderFontWeight = ps.table_header_font_weight;
  if (ps.table_body_font_size) result.tableBodyFontSize = ps.table_body_font_size;
  if (ps.table_body_padding) result.tableBodyPadding = ps.table_body_padding;

  // ألوان قسم العميل
  if (ps.customer_section_bg_color) result.customerSectionBgColor = ps.customer_section_bg_color;
  if (ps.customer_section_border_color) result.customerSectionBorderColor = ps.customer_section_border_color;
  if (ps.customer_text_color) result.customerSectionTextColor = ps.customer_text_color;

  // ألوان الإجماليات
  if (ps.summary_bg_color) result.totalBgColor = ps.summary_bg_color;
  if (ps.summary_text_color) result.totalTextColor = ps.summary_text_color;
  if (ps.totals_box_bg_color) result.subtotalBgColor = ps.totals_box_bg_color;
  if (ps.totals_box_text_color) result.subtotalTextColor = ps.totals_box_text_color;
  if (ps.totals_box_border_color) result.totalBorderColor = ps.totals_box_border_color;

  // خطوط
  if (ps.font_family) result.fontFamily = ps.font_family;
  if (ps.title_font_size) result.titleFontSize = ps.title_font_size;
  if (ps.header_font_size) result.headerFontSize = ps.header_font_size;
  if (ps.body_font_size) result.bodyFontSize = ps.body_font_size;

  // الفوتر
  if (ps.footer_text) result.footerText = ps.footer_text;
  if (ps.footer_alignment) result.footerAlignment = ps.footer_alignment;
  if (ps.footer_text_color) result.footerTextColor = ps.footer_text_color;

  // الخلفية
  if (ps.background_image) result.backgroundImage = ps.background_image;
  if (ps.background_opacity !== null && ps.background_opacity !== undefined) result.backgroundOpacity = ps.background_opacity;

  // المسافات
  if (ps.header_margin_bottom) result.headerMarginBottom = ps.header_margin_bottom;
  if (ps.page_margin_top) result.pageMarginTop = ps.page_margin_top;
  if (ps.page_margin_bottom) result.pageMarginBottom = ps.page_margin_bottom;
  if (ps.page_margin_left) result.pageMarginLeft = ps.page_margin_left;
  if (ps.page_margin_right) result.pageMarginRight = ps.page_margin_right;

  // عنوان المستند
  if (ps.document_title_ar) result.invoiceTitle = ps.document_title_ar;
  if (ps.document_title_en) result.invoiceTitleEn = ps.document_title_en;
  if (ps.document_title_alignment) result.invoiceTitleAlignment = ps.document_title_alignment;
  if (ps.header_alignment) result.headerAlignment = ps.header_alignment;

  // معلومات الاتصال
  result.showContactInfo = !!(ps.show_company_address || ps.show_company_contact);
  if (ps.header_font_size) result.contactInfoFontSize = ps.header_font_size;

  // عرض/إخفاء العنوان
  result.showInvoiceTitle = true;
  result.showCompanyInfo = true;
  result.showHeader = true;

  return result;
}

/**
 * مسح الكاش
 */
export function clearPrintSettingsBridgeCache() {
  printSettingsCache = {};
  printSettingsCacheTime = 0;
}
