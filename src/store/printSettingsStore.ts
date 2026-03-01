/**
 * Redux-like Store لإعدادات الطباعة
 * يستخدم React Context + useReducer لإدارة الحالة
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentType, DOCUMENT_TYPES } from '@/types/document-types';
import { PrintSettings, PrintSettingsState, DEFAULT_PRINT_SETTINGS, AlignmentType, DirectionType, HeaderAlignmentType, HeaderDirectionType } from '@/types/print-settings';
import { fetchInvoiceSettingsAsync } from '@/hooks/useInvoiceSettingsSync';

// =====================================================
// Actions
// =====================================================

type PrintSettingsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SHARED_DEFAULTS'; payload: Omit<PrintSettings, 'document_type'> }
  | { type: 'SET_DOCUMENT_SETTINGS'; payload: { documentType: DocumentType; settings: PrintSettings } }
  | { type: 'SET_ALL_SETTINGS'; payload: Partial<Record<DocumentType, PrintSettings>> }
  | { type: 'RESET_TO_DEFAULTS' };

// =====================================================
// Initial State
// =====================================================

const initialState: PrintSettingsState = {
  sharedDefaults: DEFAULT_PRINT_SETTINGS,
  byDocumentType: {},
  isLoading: true,
  lastFetched: null,
};

// =====================================================
// Reducer
// =====================================================

function printSettingsReducer(state: PrintSettingsState, action: PrintSettingsAction): PrintSettingsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_SHARED_DEFAULTS':
      return { ...state, sharedDefaults: action.payload };
      
    case 'SET_DOCUMENT_SETTINGS':
      return {
        ...state,
        byDocumentType: {
          ...state.byDocumentType,
          [action.payload.documentType]: action.payload.settings,
        },
      };
      
    case 'SET_ALL_SETTINGS':
      return {
        ...state,
        byDocumentType: action.payload,
        lastFetched: Date.now(),
      };
      
    case 'RESET_TO_DEFAULTS':
      return {
        ...initialState,
        isLoading: false,
      };
      
    default:
      return state;
  }
}

// =====================================================
// Context
// =====================================================

interface PrintSettingsContextValue {
  state: PrintSettingsState;
  dispatch: React.Dispatch<PrintSettingsAction>;
  selectPrintSettingsByType: (documentType: DocumentType) => PrintSettings;
  fetchSettings: () => Promise<void>;
  saveSettings: (documentType: DocumentType, settings: Partial<PrintSettings>) => Promise<boolean>;
  saveSharedDefaults: (settings: Omit<PrintSettings, 'document_type'>) => Promise<boolean>;
}

const PrintSettingsContext = createContext<PrintSettingsContextValue | null>(null);

// =====================================================
// مزامنة print_settings → invoice system_settings
// =====================================================

const DOCUMENT_TO_INVOICE_MAP: Record<string, string> = {
  'contract_invoice': 'contract',
  'payment_receipt': 'receipt',
  'print_service_invoice': 'print_invoice',
  'sales_invoice': 'sales_invoice',
  'purchase_invoice': 'purchase_invoice',
  'custody_statement': 'custody',
  'expense_invoice': 'expenses',
  'installation_invoice': 'installation',
  'team_payment_receipt': 'team_payment',
  'quotation': 'offer',
  'account_statement': 'account_statement',
  'late_notice': 'overdue_notice',
  'friend_rent_receipt': 'friend_rental',
  'print_task': 'print_task',
  'cut_task': 'cutout_task',
  'combined_task': 'composite_task',
  'customer_invoice': 'customer_invoice',
  'measurements_invoice': 'sizes_invoice',
};

async function syncPrintSettingsToInvoiceSystem(documentType: DocumentType, settings: PrintSettings) {
  const invoiceType = DOCUMENT_TO_INVOICE_MAP[documentType];
  if (!invoiceType) return;

  try {
    // جلب الإعدادات الحالية
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'unified_invoice_templates_settings')
      .single();

    let allSettings: any = { shared: {}, individual: {} };
    if (data?.setting_value) {
      allSettings = JSON.parse(data.setting_value);
    }

    // تحديث الإعدادات المشتركة
    allSettings.shared = {
      ...allSettings.shared,
      companyName: settings.company_name || allSettings.shared?.companyName || '',
      companySubtitle: settings.company_subtitle || allSettings.shared?.companySubtitle || '',
      companyAddress: settings.company_address || allSettings.shared?.companyAddress || '',
      companyPhone: settings.company_phone || allSettings.shared?.companyPhone || '',
      logoPath: settings.logo_path || allSettings.shared?.logoPath || '/logofaresgold.svg',
      logoSize: settings.logo_size || allSettings.shared?.logoSize || 60,
      logoPosition: settings.logo_position || allSettings.shared?.logoPosition || 'right',
      headerBgColor: settings.header_bg_color || allSettings.shared?.headerBgColor,
      headerTextColor: settings.header_text_color || allSettings.shared?.headerTextColor,
      fontFamily: settings.font_family || allSettings.shared?.fontFamily,
      showLogo: settings.show_logo,
      showFooter: settings.show_footer,
      showPageNumber: settings.show_page_number,
      footerText: settings.footer_text || allSettings.shared?.footerText,
      footerAlignment: settings.footer_alignment,
      footerTextColor: settings.footer_text_color,
      headerMarginBottom: settings.header_margin_bottom,
      backgroundImage: settings.background_image,
      backgroundOpacity: settings.background_opacity,
      pageMarginTop: settings.page_margin_top,
      pageMarginBottom: settings.page_margin_bottom,
      pageMarginLeft: settings.page_margin_left,
      pageMarginRight: settings.page_margin_right,
      showCompanyName: settings.show_company_name,
      showCompanySubtitle: settings.show_company_subtitle,
      showCompanyAddress: settings.show_company_address,
      showCompanyPhone: settings.show_company_contact,
    };

    // تحديث الإعدادات الفردية لنوع الفاتورة
    if (!allSettings.individual) allSettings.individual = {};
    allSettings.individual[invoiceType] = {
      ...(allSettings.individual[invoiceType] || {}),
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      accentColor: settings.accent_color,
      tableBorderColor: settings.table_border_color,
      tableHeaderBgColor: settings.table_header_bg_color,
      tableHeaderTextColor: settings.table_header_text_color,
      tableRowEvenColor: settings.table_row_even_color,
      tableRowOddColor: settings.table_row_odd_color,
      tableTextColor: settings.table_text_color,
      tableHeaderFontSize: settings.table_header_font_size,
      tableHeaderPadding: settings.table_header_padding,
      tableHeaderFontWeight: settings.table_header_font_weight,
      tableBodyFontSize: settings.table_body_font_size,
      tableBodyPadding: settings.table_body_padding,
      customerSectionBgColor: settings.customer_section_bg_color,
      customerSectionBorderColor: settings.customer_section_border_color,
      customerSectionTextColor: settings.customer_text_color,
      titleFontSize: settings.title_font_size,
      headerFontSize: settings.header_font_size,
      bodyFontSize: settings.body_font_size,
      showHeader: true,
      showCustomerSection: settings.show_customer_section,
    };

    // حفظ
    await supabase
      .from('system_settings')
      .upsert({
        setting_key: 'unified_invoice_templates_settings',
        setting_value: JSON.stringify(allSettings),
      }, { onConflict: 'setting_key' });

    // مسح الكاش
    const { clearInvoiceSettingsCache } = await import('@/hooks/useInvoiceSettingsSync');
    clearInvoiceSettingsCache();
  } catch (e) {
    console.log('Sync to invoice system failed:', e);
  }
}

// =====================================================
// Provider Component
// =====================================================

interface PrintSettingsProviderProps {
  children: ReactNode;
}

export function PrintSettingsProvider({ children }: PrintSettingsProviderProps) {
  const [state, dispatch] = useReducer(printSettingsReducer, initialState);

  // ==========================================
  // Selector: الحصول على إعدادات نوع مستند
  // ==========================================
  const selectPrintSettingsByType = useCallback((documentType: DocumentType): PrintSettings => {
    const documentSettings = state.byDocumentType[documentType];
    
    if (documentSettings) {
      // ✅ دمج الإعدادات المشتركة مع إعدادات المستند - القيم الفارغة تستخدم المشتركة
      return {
        ...documentSettings,
        company_name: documentSettings.company_name || state.sharedDefaults.company_name || '',
        company_subtitle: documentSettings.company_subtitle || state.sharedDefaults.company_subtitle || '',
        company_address: documentSettings.company_address || state.sharedDefaults.company_address || '',
        company_phone: documentSettings.company_phone || state.sharedDefaults.company_phone || '',
        logo_path: documentSettings.logo_path || state.sharedDefaults.logo_path || '/logofaresgold.svg',
        logo_size: documentSettings.logo_size || state.sharedDefaults.logo_size || 60,
        footer_text: documentSettings.footer_text || state.sharedDefaults.footer_text || '',
      };
    }
    
    // إذا لم توجد إعدادات خاصة، استخدم الافتراضي
    return {
      document_type: documentType,
      ...state.sharedDefaults,
    };
  }, [state.byDocumentType, state.sharedDefaults]);

  // ==========================================
  // جلب الإعدادات من Supabase
  // ==========================================
  const fetchSettings = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // محاولة جلب الإعدادات من الجدول الجديد أولاً
      const { data: newSettings, error: newError } = await supabase
        .from('print_settings')
        .select('*');
      
      if (!newError && newSettings && newSettings.length > 0) {
        // استخدام الإعدادات من الجدول الجديد
        const convertedSettings: Partial<Record<DocumentType, PrintSettings>> = {};
        
        newSettings.forEach((row: any) => {
          const docType = row.document_type as DocumentType;
          convertedSettings[docType] = {
            document_type: docType,
            company_name: row.company_name ?? '',
            company_subtitle: row.company_subtitle ?? '',
            company_address: row.company_address ?? '',
            company_phone: row.company_phone ?? '',
            direction: (row.direction ?? 'rtl') as DirectionType,
            header_alignment: (row.header_alignment ?? 'split') as HeaderAlignmentType,
            header_direction: (row.header_direction ?? 'row') as HeaderDirectionType,
            logo_position_order: row.logo_position_order ?? 0,
            footer_alignment: (row.footer_alignment ?? 'center') as AlignmentType,
            primary_color: row.primary_color ?? '#D4AF37',
            secondary_color: row.secondary_color ?? '#1a1a2e',
            accent_color: row.accent_color ?? '#f0e6d2',
            header_bg_color: row.header_bg_color ?? '#D4AF37',
            header_text_color: row.header_text_color ?? '#ffffff',
            font_family: row.font_family ?? 'Doran',
            title_font_size: row.title_font_size ?? 24,
            header_font_size: row.header_font_size ?? 14,
            body_font_size: row.body_font_size ?? 12,
            show_logo: row.show_logo ?? true,
            logo_path: row.logo_path ?? '/logofaresgold.svg',
            logo_size: row.logo_size ?? 60,
            logo_position: (row.logo_position ?? 'right') as AlignmentType,
            show_footer: row.show_footer ?? true,
            footer_text: row.footer_text ?? 'شكراً لتعاملكم معنا',
            show_page_number: row.show_page_number ?? true,
            background_image: row.background_image ?? '',
            background_opacity: row.background_opacity ?? 100,
            page_margin_top: row.page_margin_top ?? 15,
            page_margin_bottom: row.page_margin_bottom ?? 15,
            page_margin_left: row.page_margin_left ?? 15,
            page_margin_right: row.page_margin_right ?? 15,
            // الحقول الجديدة
            document_title_ar: row.document_title_ar ?? '',
            document_title_en: row.document_title_en ?? '',
            show_document_number: row.show_document_number ?? true,
            show_document_date: row.show_document_date ?? true,
            date_format: row.date_format ?? 'ar-LY',
            show_customer_section: row.show_customer_section ?? true,
            customer_section_title: row.customer_section_title ?? 'بيانات العميل',
            customer_section_bg_color: row.customer_section_bg_color ?? '#f8f9fa',
            customer_section_border_color: row.customer_section_border_color ?? '#D4AF37',
            table_header_bg_color: row.table_header_bg_color ?? '#D4AF37',
            table_header_text_color: row.table_header_text_color ?? '#ffffff',
            table_border_color: row.table_border_color ?? '#e5e5e5',
            table_row_even_color: row.table_row_even_color ?? '#f8f9fa',
            table_row_odd_color: row.table_row_odd_color ?? '#ffffff',
            summary_bg_color: row.summary_bg_color ?? '#f0e6d2',
            summary_text_color: (row as any).summary_text_color ?? '#ffffff',
            summary_border_color: row.summary_border_color ?? '#D4AF37',
            border_radius: row.border_radius ?? 8,
            border_width: row.border_width ?? 1,
            // ✅ الحقول الجديدة للتصميم
            header_style: row.header_style ?? 'classic',
            logo_size_preset: row.logo_size_preset ?? 'medium',
            company_tax_id: row.company_tax_id ?? '',
            company_email: row.company_email ?? '',
            company_website: row.company_website ?? '',
            // ✅ ألوان جديدة دقيقة
            company_subtitle_color: row.company_subtitle_color ?? '#666666',
            customer_text_color: row.customer_text_color ?? '#333333',
            table_text_color: row.table_text_color ?? '#000000',
            footer_text_color: row.footer_text_color ?? '#666666',
            // ✅ مسافات جديدة
            header_margin_bottom: row.header_margin_bottom ?? 20,
            document_title_margin_top: row.document_title_margin_top ?? 10,
            document_title_alignment: (row.document_title_alignment ?? 'center') as AlignmentType,
            // ✅ خيارات إظهار بيانات الشركة
            show_tax_id: row.show_tax_id ?? false,
            show_email: row.show_email ?? false,
            show_website: row.show_website ?? false,
            // ✅ التحكم الدقيق في عناصر معلومات الشركة
            show_company_name: row.show_company_name ?? true,
            show_company_address: row.show_company_address ?? true,
            show_company_contact: row.show_company_contact ?? true,
            show_company_subtitle: row.show_company_subtitle ?? false,
            // ✅ إعدادات قسم معلومات المستند
            document_info_text_color: row.document_info_text_color ?? '#000000',
            document_info_bg_color: row.document_info_bg_color ?? 'transparent',
            document_info_alignment: (row.document_info_alignment ?? 'left') as AlignmentType,
            document_info_margin_top: row.document_info_margin_top ?? 0,
            // ✅ إعدادات صندوق الإجماليات الموحد
            totals_box_bg_color: row.totals_box_bg_color ?? '#f8f9fa',
            totals_box_text_color: row.totals_box_text_color ?? '#333333',
            totals_box_border_color: row.totals_box_border_color ?? '#D4AF37',
            totals_box_border_radius: row.totals_box_border_radius ?? 8,
            totals_title_font_size: row.totals_title_font_size ?? 14,
            totals_value_font_size: row.totals_value_font_size ?? 16,
            // ✅ خصائص الجدول
            table_header_font_size: row.table_header_font_size ?? 10,
            table_header_padding: row.table_header_padding ?? '4px 8px',
            table_body_font_size: row.table_body_font_size ?? 10,
            table_body_padding: row.table_body_padding ?? '4px',
            table_header_font_weight: row.table_header_font_weight ?? 'bold',
            table_line_height: row.table_line_height ?? '1.4',
            table_border_width: row.table_border_width ?? 1,
            table_border_style: row.table_border_style ?? 'solid',
            table_header_height: row.table_header_height ?? 0,
            table_body_row_height: row.table_body_row_height ?? 0,
          };
        });
        
        // ✅ جلب بيانات الشركة من إعدادات الفواتير إذا كانت فارغة في print_settings
        let invoiceShared: any = null;
        if (newSettings.length > 0 && !newSettings[0].company_name) {
          try {
            const invoiceSettings = await fetchInvoiceSettingsAsync();
            invoiceShared = invoiceSettings.shared;
          } catch { /* ignore */ }
        }

        // تحديث الإعدادات المشتركة من أول سجل (مع دمج بيانات الفواتير)
        if (newSettings.length > 0) {
          const first = newSettings[0];
          dispatch({
            type: 'SET_SHARED_DEFAULTS',
            payload: {
              company_name: first.company_name || invoiceShared?.companyName || '',
              company_subtitle: first.company_subtitle || invoiceShared?.companySubtitle || '',
              company_address: first.company_address || invoiceShared?.companyAddress || '',
              company_phone: first.company_phone || invoiceShared?.companyPhone || '',
              direction: (first.direction ?? 'rtl') as DirectionType,
              header_alignment: (first.header_alignment ?? 'split') as HeaderAlignmentType,
              header_direction: ((first as any).header_direction ?? 'row') as HeaderDirectionType,
              logo_position_order: (first as any).logo_position_order ?? 0,
              footer_alignment: (first.footer_alignment ?? 'center') as AlignmentType,
              primary_color: first.primary_color ?? '#D4AF37',
              secondary_color: first.secondary_color ?? '#1a1a2e',
              accent_color: first.accent_color ?? '#f0e6d2',
              header_bg_color: first.header_bg_color ?? '#D4AF37',
              header_text_color: first.header_text_color ?? '#ffffff',
              font_family: first.font_family ?? 'Doran',
              title_font_size: first.title_font_size ?? 24,
              header_font_size: first.header_font_size ?? 14,
              body_font_size: first.body_font_size ?? 12,
              show_logo: first.show_logo ?? true,
              logo_path: first.logo_path || invoiceShared?.logoPath || '/logofaresgold.svg',
              logo_size: first.logo_size || invoiceShared?.logoSize || 60,
              logo_position: (first.logo_position || invoiceShared?.logoPosition || 'right') as AlignmentType,
              show_footer: first.show_footer ?? true,
              footer_text: first.footer_text ?? 'شكراً لتعاملكم معنا',
              show_page_number: first.show_page_number ?? true,
              background_image: first.background_image ?? '',
              background_opacity: first.background_opacity ?? 100,
              page_margin_top: first.page_margin_top ?? 15,
              page_margin_bottom: first.page_margin_bottom ?? 15,
              page_margin_left: first.page_margin_left ?? 15,
              page_margin_right: first.page_margin_right ?? 15,
              // الحقول الجديدة
              document_title_ar: first.document_title_ar ?? '',
              document_title_en: first.document_title_en ?? '',
              show_document_number: first.show_document_number ?? true,
              show_document_date: first.show_document_date ?? true,
              date_format: first.date_format ?? 'ar-LY',
              show_customer_section: first.show_customer_section ?? true,
              customer_section_title: first.customer_section_title ?? 'بيانات العميل',
              customer_section_bg_color: first.customer_section_bg_color ?? '#f8f9fa',
              customer_section_border_color: first.customer_section_border_color ?? '#D4AF37',
              table_header_bg_color: first.table_header_bg_color ?? '#D4AF37',
              table_header_text_color: first.table_header_text_color ?? '#ffffff',
              table_border_color: first.table_border_color ?? '#e5e5e5',
              table_row_even_color: first.table_row_even_color ?? '#f8f9fa',
              table_row_odd_color: first.table_row_odd_color ?? '#ffffff',
              summary_bg_color: first.summary_bg_color ?? '#f0e6d2',
              summary_text_color: (first as any).summary_text_color ?? '#ffffff',
              summary_border_color: first.summary_border_color ?? '#D4AF37',
              border_radius: first.border_radius ?? 8,
              border_width: first.border_width ?? 1,
              // ✅ الحقول الجديدة (قد لا تكون موجودة في DB بعد)
              header_style: (first as any).header_style ?? 'classic',
              logo_size_preset: (first as any).logo_size_preset ?? 'medium',
              company_tax_id: (first as any).company_tax_id ?? '',
              company_email: (first as any).company_email ?? '',
              company_website: (first as any).company_website ?? '',
              // ✅ ألوان جديدة دقيقة
              company_subtitle_color: (first as any).company_subtitle_color ?? '#666666',
              customer_text_color: (first as any).customer_text_color ?? '#333333',
              table_text_color: (first as any).table_text_color ?? '#000000',
              footer_text_color: (first as any).footer_text_color ?? '#666666',
              // ✅ مسافات جديدة
              header_margin_bottom: (first as any).header_margin_bottom ?? 20,
              document_title_margin_top: (first as any).document_title_margin_top ?? 10,
              document_title_alignment: ((first as any).document_title_alignment ?? 'center') as AlignmentType,
              // ✅ خيارات إظهار بيانات الشركة
              show_tax_id: (first as any).show_tax_id ?? false,
              show_email: (first as any).show_email ?? false,
              show_website: (first as any).show_website ?? false,
              // ✅ التحكم الدقيق في عناصر معلومات الشركة
              show_company_name: (first as any).show_company_name ?? true,
              show_company_address: (first as any).show_company_address ?? true,
              show_company_contact: (first as any).show_company_contact ?? true,
              show_company_subtitle: (first as any).show_company_subtitle ?? false,
              // ✅ إعدادات قسم معلومات المستند
              document_info_text_color: (first as any).document_info_text_color ?? '#000000',
              document_info_bg_color: (first as any).document_info_bg_color ?? 'transparent',
              document_info_alignment: ((first as any).document_info_alignment ?? 'left') as AlignmentType,
              document_info_margin_top: (first as any).document_info_margin_top ?? 0,
              // ✅ إعدادات صندوق الإجماليات الموحد
              totals_box_bg_color: (first as any).totals_box_bg_color ?? '#f8f9fa',
              totals_box_text_color: (first as any).totals_box_text_color ?? '#333333',
              totals_box_border_color: (first as any).totals_box_border_color ?? '#D4AF37',
              totals_box_border_radius: (first as any).totals_box_border_radius ?? 8,
              totals_title_font_size: (first as any).totals_title_font_size ?? 14,
              totals_value_font_size: (first as any).totals_value_font_size ?? 16,
              // ✅ خصائص الجدول
              table_header_font_size: (first as any).table_header_font_size ?? 10,
              table_header_padding: (first as any).table_header_padding ?? '4px 8px',
              table_body_font_size: (first as any).table_body_font_size ?? 10,
              table_body_padding: (first as any).table_body_padding ?? '4px',
              table_header_font_weight: (first as any).table_header_font_weight ?? 'bold',
              table_line_height: (first as any).table_line_height ?? '1.4',
              table_border_width: (first as any).table_border_width ?? 1,
              table_border_style: (first as any).table_border_style ?? 'solid',
              table_header_height: (first as any).table_header_height ?? 0,
              table_body_row_height: (first as any).table_body_row_height ?? 0,
            },
          });
        }
        
        dispatch({ type: 'SET_ALL_SETTINGS', payload: convertedSettings });
      } else {
        // الرجوع للإعدادات القديمة
        const { data: oldSettings } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'unified_invoice_templates_settings')
          .single();
        
        if (oldSettings?.setting_value) {
          const parsed = JSON.parse(oldSettings.setting_value);
          
          if (parsed.shared) {
            dispatch({
              type: 'SET_SHARED_DEFAULTS',
              payload: convertOldSharedSettings(parsed.shared),
            });
          }
          
          if (parsed.individual) {
            const convertedSettings: Partial<Record<DocumentType, PrintSettings>> = {};
            
            const typeMapping: Record<string, DocumentType> = {
              'contract': DOCUMENT_TYPES.CONTRACT_INVOICE,
              'receipt': DOCUMENT_TYPES.PAYMENT_RECEIPT,
              'sales_invoice': DOCUMENT_TYPES.SALES_INVOICE,
              'purchase_invoice': DOCUMENT_TYPES.PURCHASE_INVOICE,
              'account_statement': DOCUMENT_TYPES.ACCOUNT_STATEMENT,
              'custody': DOCUMENT_TYPES.CUSTODY_STATEMENT,
              'expenses': DOCUMENT_TYPES.EXPENSE_INVOICE,
              'installation': DOCUMENT_TYPES.INSTALLATION_INVOICE,
              'team_payment': DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT,
              'offer': DOCUMENT_TYPES.QUOTATION,
              'overdue_notice': DOCUMENT_TYPES.LATE_NOTICE,
              'friend_rental': DOCUMENT_TYPES.FRIEND_RENT_RECEIPT,
              'print_task': DOCUMENT_TYPES.PRINT_TASK,
              'cutout_task': DOCUMENT_TYPES.CUT_TASK,
              'composite_task': DOCUMENT_TYPES.COMBINED_TASK,
              'customer_invoice': DOCUMENT_TYPES.CUSTOMER_INVOICE,
              'sizes_invoice': DOCUMENT_TYPES.MEASUREMENTS_INVOICE,
              'print_invoice': DOCUMENT_TYPES.PRINT_SERVICE_INVOICE,
            };
            
            Object.entries(parsed.individual).forEach(([oldType, settings]) => {
              const newType = typeMapping[oldType];
              if (newType && settings) {
                convertedSettings[newType] = {
                  document_type: newType,
                  ...convertOldSharedSettings(parsed.shared),
                  ...convertOldIndividualSettings(settings as any),
                };
              }
            });
            
            dispatch({ type: 'SET_ALL_SETTINGS', payload: convertedSettings });
          }
        }
      }
    } catch (error) {
      console.log('No saved print settings found, using defaults');
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  // ==========================================
  // حفظ إعدادات نوع مستند معين
  // ==========================================
  const saveSettings = useCallback(async (documentType: DocumentType, settings: Partial<PrintSettings>): Promise<boolean> => {
    try {
      const fullSettings: PrintSettings = {
        document_type: documentType,
        ...state.sharedDefaults,
        ...state.byDocumentType[documentType],
        ...settings,
      };
      
      dispatch({
        type: 'SET_DOCUMENT_SETTINGS',
        payload: { documentType, settings: fullSettings },
      });
      
      // حفظ في جدول print_settings - جميع الحقول
      const { error } = await supabase
        .from('print_settings')
        .upsert({
          document_type: documentType,
          company_name: fullSettings.company_name,
          company_subtitle: fullSettings.company_subtitle,
          company_address: fullSettings.company_address,
          company_phone: fullSettings.company_phone,
          direction: fullSettings.direction,
          header_alignment: fullSettings.header_alignment,
          footer_alignment: fullSettings.footer_alignment,
          primary_color: fullSettings.primary_color,
          secondary_color: fullSettings.secondary_color,
          accent_color: fullSettings.accent_color,
          header_bg_color: fullSettings.header_bg_color,
          header_text_color: fullSettings.header_text_color,
          font_family: fullSettings.font_family,
          title_font_size: fullSettings.title_font_size,
          header_font_size: fullSettings.header_font_size,
          body_font_size: fullSettings.body_font_size,
          show_logo: fullSettings.show_logo,
          logo_path: fullSettings.logo_path,
          logo_size: fullSettings.logo_size,
          logo_position: fullSettings.logo_position,
          show_footer: fullSettings.show_footer,
          footer_text: fullSettings.footer_text,
          show_page_number: fullSettings.show_page_number,
          background_image: fullSettings.background_image,
          background_opacity: fullSettings.background_opacity,
          page_margin_top: fullSettings.page_margin_top,
          page_margin_bottom: fullSettings.page_margin_bottom,
          page_margin_left: fullSettings.page_margin_left,
          page_margin_right: fullSettings.page_margin_right,
          // الحقول الإضافية
          document_title_ar: fullSettings.document_title_ar,
          document_title_en: fullSettings.document_title_en,
          show_document_number: fullSettings.show_document_number,
          show_document_date: fullSettings.show_document_date,
          date_format: fullSettings.date_format,
          show_customer_section: fullSettings.show_customer_section,
          customer_section_title: fullSettings.customer_section_title,
          customer_section_bg_color: fullSettings.customer_section_bg_color,
          customer_section_border_color: fullSettings.customer_section_border_color,
          table_header_bg_color: fullSettings.table_header_bg_color,
          table_header_text_color: fullSettings.table_header_text_color,
          table_border_color: fullSettings.table_border_color,
          table_row_even_color: fullSettings.table_row_even_color,
          table_row_odd_color: fullSettings.table_row_odd_color,
          summary_bg_color: fullSettings.summary_bg_color,
          summary_text_color: fullSettings.summary_text_color,
          summary_border_color: fullSettings.summary_border_color,
          border_radius: fullSettings.border_radius,
          border_width: fullSettings.border_width,
          // ✅ الحقول الجديدة للتصميم
          header_style: fullSettings.header_style,
          logo_size_preset: fullSettings.logo_size_preset,
          company_tax_id: fullSettings.company_tax_id,
          company_email: fullSettings.company_email,
          company_website: fullSettings.company_website,
          company_subtitle_color: fullSettings.company_subtitle_color,
          customer_text_color: fullSettings.customer_text_color,
          table_text_color: fullSettings.table_text_color,
          footer_text_color: fullSettings.footer_text_color,
          header_margin_bottom: fullSettings.header_margin_bottom,
          document_title_margin_top: fullSettings.document_title_margin_top,
          document_title_alignment: fullSettings.document_title_alignment,
          show_tax_id: fullSettings.show_tax_id,
          show_email: fullSettings.show_email,
          show_website: fullSettings.show_website,
          // ✅ الحقول الجديدة للتحكم في الهيدر
          header_direction: fullSettings.header_direction,
          logo_position_order: fullSettings.logo_position_order,
          // ✅ التحكم الدقيق في عناصر معلومات الشركة
          show_company_name: fullSettings.show_company_name,
          show_company_address: fullSettings.show_company_address,
          show_company_contact: fullSettings.show_company_contact,
          show_company_subtitle: fullSettings.show_company_subtitle,
          // ✅ إعدادات قسم معلومات المستند
          document_info_text_color: fullSettings.document_info_text_color,
          document_info_bg_color: fullSettings.document_info_bg_color,
          document_info_alignment: fullSettings.document_info_alignment,
          document_info_margin_top: fullSettings.document_info_margin_top,
          // ✅ خصائص الجدول
          table_header_font_size: fullSettings.table_header_font_size,
          table_header_padding: fullSettings.table_header_padding,
          table_body_font_size: fullSettings.table_body_font_size,
          table_body_padding: fullSettings.table_body_padding,
          table_header_font_weight: fullSettings.table_header_font_weight,
          table_line_height: fullSettings.table_line_height,
          table_border_width: fullSettings.table_border_width,
          table_border_style: fullSettings.table_border_style,
          table_header_height: fullSettings.table_header_height,
          table_body_row_height: fullSettings.table_body_row_height,
          // ✅ صندوق الإجماليات
          totals_box_bg_color: fullSettings.totals_box_bg_color,
          totals_box_text_color: fullSettings.totals_box_text_color,
          totals_box_border_color: fullSettings.totals_box_border_color,
          totals_box_border_radius: fullSettings.totals_box_border_radius,
          totals_title_font_size: fullSettings.totals_title_font_size,
          totals_value_font_size: fullSettings.totals_value_font_size,
        }, { onConflict: 'document_type' });
      
      if (error) throw error;
      
      // ✅ مزامنة الإعدادات مع نظام الفواتير (system_settings)
      try {
        await syncPrintSettingsToInvoiceSystem(documentType, fullSettings);
      } catch (syncError) {
        console.log('Invoice sync skipped:', syncError);
      }

      // مسح كاش الجسر
      try {
        const { clearPrintSettingsBridgeCache } = await import('@/utils/invoicePrintSettingsBridge');
        clearPrintSettingsBridgeCache();
      } catch { /* ignore */ }
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }, [state]);

  // ==========================================
  // حفظ الإعدادات الافتراضية المشتركة (تطبيق على جميع المستندات)
  // ==========================================
  const saveSharedDefaults = useCallback(async (settings: Omit<PrintSettings, 'document_type'>): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_SHARED_DEFAULTS', payload: settings });
      
      // تحديث جميع السجلات في جدول print_settings
      const allTypes = Object.values(DOCUMENT_TYPES);
      
      for (const docType of allTypes) {
        await supabase
          .from('print_settings')
          .upsert({
            document_type: docType,
            company_name: settings.company_name,
            company_subtitle: settings.company_subtitle,
            company_address: settings.company_address,
            company_phone: settings.company_phone,
            direction: settings.direction,
            header_alignment: settings.header_alignment,
            footer_alignment: settings.footer_alignment,
            primary_color: settings.primary_color,
            secondary_color: settings.secondary_color,
            accent_color: settings.accent_color,
            header_bg_color: settings.header_bg_color,
            header_text_color: settings.header_text_color,
            font_family: settings.font_family,
            title_font_size: settings.title_font_size,
            header_font_size: settings.header_font_size,
            body_font_size: settings.body_font_size,
            show_logo: settings.show_logo,
            logo_path: settings.logo_path,
            logo_size: settings.logo_size,
            logo_position: settings.logo_position,
            show_footer: settings.show_footer,
            footer_text: settings.footer_text,
            show_page_number: settings.show_page_number,
            background_image: settings.background_image,
            background_opacity: settings.background_opacity,
            page_margin_top: settings.page_margin_top,
            page_margin_bottom: settings.page_margin_bottom,
            page_margin_left: settings.page_margin_left,
            page_margin_right: settings.page_margin_right,
          }, { onConflict: 'document_type' });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save shared defaults:', error);
      return false;
    }
  }, []);

  // ==========================================
  // جلب الإعدادات عند التحميل
  // ==========================================
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value: PrintSettingsContextValue = {
    state,
    dispatch,
    selectPrintSettingsByType,
    fetchSettings,
    saveSettings,
    saveSharedDefaults,
  };

  return React.createElement(PrintSettingsContext.Provider, { value }, children);
}

// =====================================================
// Hook للاستخدام
// =====================================================

export function usePrintSettings() {
  const context = useContext(PrintSettingsContext);
  if (!context) {
    throw new Error('usePrintSettings must be used within a PrintSettingsProvider');
  }
  return context;
}

// =====================================================
// Selector Hook
// =====================================================

export function usePrintSettingsByType(documentType: DocumentType) {
  const { selectPrintSettingsByType, state } = usePrintSettings();
  return {
    settings: selectPrintSettingsByType(documentType),
    isLoading: state.isLoading,
  };
}

// =====================================================
// دوال مساعدة للتحويل
// =====================================================

function convertOldSharedSettings(old: any): Omit<PrintSettings, 'document_type'> {
  return {
    company_name: old.companyName || '',
    company_subtitle: old.companySubtitle || '',
    company_address: old.companyAddress || '',
    company_phone: old.companyPhone || '',
    direction: 'rtl',
    header_alignment: 'split',
    header_direction: 'row',
    logo_position_order: 0,
    footer_alignment: old.footerAlignment || 'center',
    primary_color: old.headerBgColor || '#D4AF37',
    secondary_color: '#1a1a2e',
    accent_color: '#f0e6d2',
    header_bg_color: old.headerBgColor || '#D4AF37',
    header_text_color: old.headerTextColor || '#ffffff',
    font_family: old.fontFamily || 'Doran',
    title_font_size: 24,
    header_font_size: 14,
    body_font_size: 12,
    show_logo: old.showLogo ?? true,
    logo_path: old.logoPath || '/logofaresgold.svg',
    logo_size: old.logoSize || 60,
    logo_position: old.logoPosition || 'right',
    show_footer: old.showFooter ?? true,
    footer_text: old.footerText || 'شكراً لتعاملكم معنا',
    show_page_number: old.showPageNumber ?? true,
    background_image: old.backgroundImage || '',
    background_opacity: old.backgroundOpacity || 100,
    page_margin_top: old.pageMarginTop || 15,
    page_margin_bottom: old.pageMarginBottom || 15,
    page_margin_left: old.pageMarginLeft || 15,
    page_margin_right: old.pageMarginRight || 15,
    // الحقول الجديدة
    document_title_ar: '',
    document_title_en: '',
    show_document_number: true,
    show_document_date: true,
    date_format: 'ar-LY',
    show_customer_section: true,
    customer_section_title: 'بيانات العميل',
    customer_section_bg_color: '#f8f9fa',
    customer_section_border_color: '#D4AF37',
    table_header_bg_color: '#D4AF37',
    table_header_text_color: '#ffffff',
    table_border_color: '#e5e5e5',
    table_row_even_color: '#f8f9fa',
    table_row_odd_color: '#ffffff',
    summary_bg_color: '#f0e6d2',
    summary_text_color: '#ffffff',
    summary_border_color: '#D4AF37',
    border_radius: 8,
    border_width: 1,
    // ✅ الحقول الجديدة
    header_style: 'classic',
    logo_size_preset: 'medium',
    company_tax_id: '',
    company_email: '',
    company_website: '',
    // ✅ ألوان جديدة دقيقة
    company_subtitle_color: '#666666',
    customer_text_color: '#333333',
    table_text_color: '#000000',
    footer_text_color: '#666666',
    // ✅ مسافات جديدة
    header_margin_bottom: 20,
    document_title_margin_top: 10,
    document_title_alignment: 'center',
    // ✅ خيارات إظهار بيانات الشركة
    show_tax_id: false,
    show_email: false,
    show_website: false,
    // ✅ التحكم الدقيق في عناصر معلومات الشركة
    show_company_name: true,
    show_company_address: true,
    show_company_contact: true,
    show_company_subtitle: false,
    // ✅ إعدادات قسم معلومات المستند
    document_info_text_color: '#000000',
    document_info_bg_color: 'transparent',
    document_info_alignment: 'left',
    document_info_margin_top: 0,
    // ✅ إعدادات صندوق الإجماليات الموحد
    totals_box_bg_color: '#f8f9fa',
    totals_box_text_color: '#333333',
    totals_box_border_color: '#D4AF37',
    totals_box_border_radius: 8,
    totals_title_font_size: 14,
    totals_value_font_size: 16,
    // ✅ خصائص الجدول
    table_header_font_size: 10,
    table_header_padding: '4px 8px',
    table_body_font_size: 10,
    table_body_padding: '4px',
    table_header_font_weight: 'bold',
    table_line_height: '1.4',
    table_border_width: 1,
    table_border_style: 'solid',
    table_header_height: 0,
    table_body_row_height: 0,
  };
}

function convertOldIndividualSettings(old: any): Partial<PrintSettings> {
  return {
    primary_color: old.primaryColor || '#D4AF37',
    secondary_color: old.secondaryColor || '#1a1a2e',
    accent_color: old.accentColor || '#f0e6d2',
    title_font_size: old.titleFontSize || 24,
    header_font_size: old.headerFontSize || 14,
    body_font_size: old.bodyFontSize || 12,
  };
}

async function saveToSupabase(state: PrintSettingsState, newSettings: PrintSettings): Promise<void> {
  // حفظ بالتنسيق القديم للتوافق مع الكود الحالي
  const allSettings = {
    shared: {
      companyName: state.sharedDefaults.company_name,
      companySubtitle: state.sharedDefaults.company_subtitle,
      companyAddress: state.sharedDefaults.company_address,
      companyPhone: state.sharedDefaults.company_phone,
      headerAlignment: state.sharedDefaults.header_alignment,
      footerAlignment: state.sharedDefaults.footer_alignment,
      headerBgColor: state.sharedDefaults.header_bg_color,
      headerTextColor: state.sharedDefaults.header_text_color,
      fontFamily: state.sharedDefaults.font_family,
      showLogo: state.sharedDefaults.show_logo,
      logoPath: state.sharedDefaults.logo_path,
      logoSize: state.sharedDefaults.logo_size,
      logoPosition: state.sharedDefaults.logo_position,
      showFooter: state.sharedDefaults.show_footer,
      footerText: state.sharedDefaults.footer_text,
      showPageNumber: state.sharedDefaults.show_page_number,
      backgroundImage: state.sharedDefaults.background_image,
      backgroundOpacity: state.sharedDefaults.background_opacity,
      pageMarginTop: state.sharedDefaults.page_margin_top,
      pageMarginBottom: state.sharedDefaults.page_margin_bottom,
      pageMarginLeft: state.sharedDefaults.page_margin_left,
      pageMarginRight: state.sharedDefaults.page_margin_right,
    },
    individual: {},
  };
  
  const { data: existing } = await supabase
    .from('system_settings')
    .select('id')
    .eq('setting_key', 'unified_invoice_templates_settings')
    .single();

  if (existing) {
    await supabase
      .from('system_settings')
      .update({
        setting_value: JSON.stringify(allSettings),
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'unified_invoice_templates_settings');
  } else {
    await supabase
      .from('system_settings')
      .insert({
        setting_key: 'unified_invoice_templates_settings',
        setting_value: JSON.stringify(allSettings),
        setting_type: 'json',
        description: 'إعدادات قوالب الفواتير الموحدة',
        category: 'print',
      });
  }
}

async function saveSharedToSupabase(settings: Omit<PrintSettings, 'document_type'>): Promise<void> {
  const allSettings = {
    shared: {
      companyName: settings.company_name,
      companySubtitle: settings.company_subtitle,
      companyAddress: settings.company_address,
      companyPhone: settings.company_phone,
      headerAlignment: settings.header_alignment,
      footerAlignment: settings.footer_alignment,
      headerBgColor: settings.header_bg_color,
      headerTextColor: settings.header_text_color,
      fontFamily: settings.font_family,
      showLogo: settings.show_logo,
      logoPath: settings.logo_path,
      logoSize: settings.logo_size,
      logoPosition: settings.logo_position,
      showFooter: settings.show_footer,
      footerText: settings.footer_text,
      showPageNumber: settings.show_page_number,
      backgroundImage: settings.background_image,
      backgroundOpacity: settings.background_opacity,
      pageMarginTop: settings.page_margin_top,
      pageMarginBottom: settings.page_margin_bottom,
      pageMarginLeft: settings.page_margin_left,
      pageMarginRight: settings.page_margin_right,
    },
    individual: {},
  };

  const { data: existing } = await supabase
    .from('system_settings')
    .select('id, setting_value')
    .eq('setting_key', 'unified_invoice_templates_settings')
    .single();

  if (existing) {
    // الحفاظ على الإعدادات الفردية الموجودة
    const existingValue = JSON.parse(existing.setting_value || '{}');
    allSettings.individual = existingValue.individual || {};
    
    await supabase
      .from('system_settings')
      .update({
        setting_value: JSON.stringify(allSettings),
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'unified_invoice_templates_settings');
  } else {
    await supabase
      .from('system_settings')
      .insert({
        setting_key: 'unified_invoice_templates_settings',
        setting_value: JSON.stringify(allSettings),
        setting_type: 'json',
        description: 'إعدادات قوالب الفواتير الموحدة',
        category: 'print',
      });
  }
}
