/**
 * PrintInvoicePrint - فاتورة الطباعة بنفس تصميم فاتورة المقاسات
 * 
 * ⚠️ هذا المكون يستخدم نفس قالب SizesInvoicePrintDialog
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  SharedInvoiceSettings, 
  IndividualInvoiceSettings, 
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS, 
  DEFAULT_INDIVIDUAL_SETTINGS,
} from '@/types/invoice-templates';

const UNIFIED_SETTINGS_KEY = 'unified_invoice_templates_settings';

// =====================================================
// الأنواع
// =====================================================

interface PrintItem {
  size: string;
  quantity: number;
  faces: number;
  totalFaces: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
  width: number;
  height: number;
  isCustomItem?: boolean;
  customDescription?: string;
}

interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  contractNumbers?: string[];
  items: PrintItem[];
  currency: { code: string; name: string; symbol: string };
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  discountAmount?: number;
  accountDeduction?: number;
  subtotal: number;
  totalAmount: number;
  notes?: string;
  paymentMethod?: string;
  printerForDisplay?: boolean;
  includedInContract?: boolean;
}

// =====================================================
// Helper functions
// =====================================================

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  } catch {
    return hex;
  }
};

const getFlexJustify = (alignment: string | undefined): string => {
  switch (alignment) {
    case 'left': return 'flex-start';
    case 'center': return 'center';
    case 'right': 
    default: return 'flex-end';
  }
};

const formatNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('ar-LY');
};

// =====================================================
// توليد HTML بنفس تصميم فاتورة المقاسات
// =====================================================

async function generatePrintInvoiceHTML(data: PrintInvoiceData): Promise<string> {
  const showPrices = !data.printerForDisplay;
  
  // Load settings from database (same as SizesInvoicePrintDialog)
  let shared: SharedInvoiceSettings = { ...DEFAULT_SHARED_SETTINGS };
  let individual: IndividualInvoiceSettings = { ...DEFAULT_INDIVIDUAL_SETTINGS };

  try {
    const { data: unifiedData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', UNIFIED_SETTINGS_KEY)
      .maybeSingle();

    if (unifiedData?.setting_value) {
      const allSettings: AllInvoiceSettings = JSON.parse(unifiedData.setting_value);
      if (allSettings.shared) {
        shared = { ...DEFAULT_SHARED_SETTINGS, ...allSettings.shared };
      }
      if (allSettings.individual && allSettings.individual['sizes_invoice']) {
        individual = { ...DEFAULT_INDIVIDUAL_SETTINGS, ...allSettings.individual['sizes_invoice'] };
      }
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  // All colors from settings
  const primaryColor = individual.primaryColor || '#D4AF37';
  const secondaryColor = individual.secondaryColor || '#1a1a2e';
  const tableHeaderBg = individual.tableHeaderBgColor || '#D4AF37';
  const tableHeaderText = individual.tableHeaderTextColor || '#ffffff';
  const tableBorder = individual.tableBorderColor || '#D4AF37';
  const tableRowEven = individual.tableRowEvenColor || '#f8f9fa';
  const tableRowOdd = individual.tableRowOddColor || '#ffffff';
  const tableText = individual.tableTextColor || '#333333';
  const tableRowOpacity = (individual.tableRowOpacity || 100) / 100;
  const customerBg = individual.customerSectionBgColor || '#f8f9fa';
  const customerBorder = individual.customerSectionBorderColor || '#D4AF37';
  const customerTitle = individual.customerSectionTitleColor || '#D4AF37';
  const customerText = individual.customerSectionTextColor || '#333333';
  const subtotalBg = individual.subtotalBgColor || '#f0f0f0';
  const subtotalText = individual.subtotalTextColor || '#333333';
  const totalBg = individual.totalBgColor || '#D4AF37';
  const totalText = individual.totalTextColor || '#ffffff';
  const notesBg = individual.notesBgColor || '#fffbeb';
  const notesText = individual.notesTextColor || '#92400e';
  const notesBorder = individual.notesBorderColor || '#fbbf24';
  const titleFontSize = individual.titleFontSize || 24;
  const headerFontSize = individual.headerFontSize || 14;
  const bodyFontSize = individual.bodyFontSize || 12;
  const fontFamily = shared.fontFamily || 'Doran';
  
  // Page margins
  const pageMarginTop = shared.pageMarginTop || 15;
  const pageMarginBottom = shared.pageMarginBottom || 15;
  const pageMarginLeft = shared.pageMarginLeft || 15;
  const pageMarginRight = shared.pageMarginRight || 15;

  // Calculate totals
  const totalQuantity = data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalFaces = data.items.reduce((sum, item) => sum + (item.totalFaces || 0), 0);
  const totalArea = data.items.reduce((sum, item) => sum + ((item.area || 0) * (item.totalFaces || 0)), 0);

  // Generate table rows
  const tableRowsHtml = data.items.map((item, idx) => {
    const rowBg = hexToRgba(idx % 2 === 0 ? tableRowEven : tableRowOdd, tableRowOpacity * 100);
    const displayName = item.isCustomItem ? (item.customDescription || item.size) : item.size;
    
    if (showPrices) {
      return `
        <tr style="background-color: ${rowBg};">
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText};">${idx + 1}</td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-weight: 600;">${displayName}</td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif;">
            ${item.width?.toFixed(2) || '0'} × ${item.height?.toFixed(2) || '0'}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif; font-weight: bold;">
            ${formatNumber(item.quantity)}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; background-color: ${item.faces === 1 ? '#e0f2fe' : primaryColor + '20'}; color: ${item.faces === 1 ? '#0369a1' : primaryColor}; font-family: 'Manrope', sans-serif; font-weight: bold; font-size: ${bodyFontSize - 1}px;">
              ${item.faces}
            </span>
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif; font-weight: bold;">
            ${formatNumber(item.totalFaces)}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif;">
            ${(item.area || 0).toFixed(2)} م²
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif;">
            ${formatNumber(item.pricePerMeter)} ${data.currency.symbol}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${primaryColor}; font-weight: bold; font-family: 'Manrope', sans-serif;">
            ${formatNumber(item.totalPrice)} ${data.currency.symbol}
          </td>
        </tr>
      `;
    } else {
      // للطابعة - بدون أسعار
      return `
        <tr style="background-color: ${rowBg};">
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText};">${idx + 1}</td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-weight: 600;">${displayName}</td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif;">
            ${item.width?.toFixed(2) || '0'} × ${item.height?.toFixed(2) || '0'}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif; font-weight: bold;">
            ${formatNumber(item.quantity)}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; background-color: ${item.faces === 1 ? '#e0f2fe' : primaryColor + '20'}; color: ${item.faces === 1 ? '#0369a1' : primaryColor}; font-family: 'Manrope', sans-serif; font-weight: bold; font-size: ${bodyFontSize - 1}px;">
              ${item.faces}
            </span>
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${tableText}; font-family: 'Manrope', sans-serif; font-weight: bold;">
            ${formatNumber(item.totalFaces)}
          </td>
          <td style="padding: 10px 8px; border: 1px solid ${tableBorder}; text-align: center; color: ${primaryColor}; font-weight: bold; font-family: 'Manrope', sans-serif;">
            ${(item.area * item.totalFaces).toFixed(2)} م²
          </td>
        </tr>
      `;
    }
  }).join('');

  // Totals section
  let totalsHtml = '';
  if (showPrices) {
    const colSpan = 8;
    totalsHtml = `
      <!-- Subtotal Row -->
      <tr style="background-color: ${subtotalBg};">
        <td colspan="${colSpan}" style="padding: 10px 8px; text-align: left; font-weight: bold; color: ${subtotalText}; border: 1px solid ${tableBorder};">
          المجموع الفرعي
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: ${subtotalText}; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif;">
          ${formatNumber(data.subtotal)} ${data.currency.symbol}
        </td>
      </tr>
      ${data.discountAmount && data.discountAmount > 0 ? `
      <tr style="background-color: #fff5f5;">
        <td colspan="${colSpan}" style="padding: 10px 8px; text-align: left; font-weight: 600; color: #e74c3c; border: 1px solid ${tableBorder};">
          الخصم ${data.discountType === 'percentage' ? `(${data.discount}%)` : ''}
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600; color: #e74c3c; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif;">
          - ${formatNumber(data.discountAmount)} ${data.currency.symbol}
        </td>
      </tr>
      ` : ''}
      ${data.accountDeduction && data.accountDeduction > 0 ? `
      <tr style="background-color: #f0f9ff;">
        <td colspan="${colSpan}" style="padding: 10px 8px; text-align: left; font-weight: 600; color: #0369a1; border: 1px solid ${tableBorder};">
          خصم من رصيد الحساب
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600; color: #0369a1; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif;">
          - ${formatNumber(data.accountDeduction)} ${data.currency.symbol}
        </td>
      </tr>
      ` : ''}
      <!-- Grand Total Row -->
      <tr style="background-color: ${totalBg};">
        <td colspan="${colSpan}" style="padding: 14px 12px; text-align: left; font-weight: bold; color: ${totalText}; border: 1px solid ${tableBorder}; font-size: ${headerFontSize}px;">
          الإجمالي النهائي
        </td>
        <td style="padding: 14px 12px; text-align: center; font-weight: bold; color: ${totalText}; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif; font-size: ${headerFontSize + 2}px;">
          ${formatNumber(data.totalAmount)} ${data.currency.symbol}
        </td>
      </tr>
    `;
  } else {
    // للطابعة - إجمالي المساحة فقط
    const colSpan = 6;
    totalsHtml = `
      <tr style="background-color: ${subtotalBg};">
        <td colspan="${colSpan}" style="padding: 10px 8px; text-align: left; font-weight: bold; color: ${subtotalText}; border: 1px solid ${tableBorder};">
          إجمالي القسم (${totalQuantity} لوحة - ${totalFaces} وجه)
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: ${subtotalText}; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif;">
          ${totalArea.toFixed(2)} م²
        </td>
      </tr>
      <tr style="background-color: ${totalBg};">
        <td colspan="${colSpan}" style="padding: 14px 12px; text-align: left; font-weight: bold; color: ${totalText}; border: 1px solid ${tableBorder}; font-size: ${headerFontSize}px;">
          إجمالي المساحة الكلية
        </td>
        <td style="padding: 14px 12px; text-align: center; font-weight: bold; color: ${totalText}; border: 1px solid ${tableBorder}; font-family: 'Manrope', sans-serif; font-size: ${headerFontSize + 2}px;">
          ${totalArea.toFixed(2)} م²
        </td>
      </tr>
    `;
  }

  // Table headers
  const tableHeadersHtml = showPrices ? `
    <tr style="background-color: ${tableHeaderBg};">
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 5%;">#</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 14%;">المقاس</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 12%;">الأبعاد (م)</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 10%;">الكمية</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 8%;">الأوجه</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 10%;">إجمالي الأوجه</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 11%;">المساحة/وجه</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 12%;">سعر المتر</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 18%;">الإجمالي</th>
    </tr>
  ` : `
    <tr style="background-color: ${tableHeaderBg};">
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 6%;">#</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 20%;">المقاس</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 16%;">الأبعاد (م)</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 14%;">الكمية</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 12%;">الأوجه</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 14%;">إجمالي الأوجه</th>
      <th style="padding: 12px 8px; color: ${tableHeaderText}; border: 1px solid ${tableBorder}; text-align: center; font-weight: bold; font-size: ${bodyFontSize}px; width: 18%;">إجمالي المساحة</th>
    </tr>
  `;

  // Notes section
  const notesHtml = data.notes ? `
    <div style="margin-top: 15px; padding: 12px; background-color: ${notesBg}; border: 1px solid ${notesBorder}; border-radius: 8px; border-right: 4px solid ${notesBorder};">
      <div style="font-weight: bold; margin-bottom: 6px; color: ${notesText}; font-size: ${bodyFontSize}px;">ملاحظات</div>
      <div style="font-size: ${bodyFontSize - 1}px; color: ${notesText}; line-height: 1.6;">${data.notes}</div>
    </div>
  ` : '';

  // Payment info
  const paymentHtml = (data.paymentMethod && showPrices) || data.includedInContract ? `
    <div style="margin-top: 10px; padding: 8px 12px; background-color: #f0f9ff; border-radius: 6px; display: flex; gap: 20px; font-size: ${bodyFontSize - 1}px; color: #0369a1;">
      ${data.paymentMethod && showPrices ? `<span>طريقة الدفع: <strong>${data.paymentMethod}</strong></span>` : ''}
      ${data.includedInContract ? `<span style="color: #059669;">✓ مضمنة في العقد</span>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة طباعة - ${data.customerName}</title>
  <style>
    @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
      color-adjust: exact !important; 
    }
    
    html, body { 
      font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      background: #ffffff !important;
      color: ${tableText};
    }
    
    .print-container {
      width: 210mm;
      min-height: 297mm;
      padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
      background: #ffffff;
      position: relative;
    }
    
    table { 
      border-collapse: collapse; 
      page-break-inside: auto;
    }
    
    tr { 
      page-break-inside: avoid; 
    }
    
    th, td { 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    
    .totals-section {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    @media print {
      @page { 
        size: A4; 
        margin: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
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
      
      .print-container {
        width: 100%;
        min-height: auto;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${shared.headerMarginBottom || 20}px; padding-bottom: 15px; border-bottom: 2px solid ${primaryColor};">
      <!-- Titles Side -->
      <div style="flex: 1; text-align: right;">
        ${shared.showCompanyInfo && (shared.showCompanyName || shared.showCompanySubtitle) ? `
        <div style="margin-bottom: 8px;">
          ${shared.showCompanyName ? `<div style="font-weight: bold; font-size: 16px; color: ${primaryColor}; margin-bottom: 2px;">${shared.companyName}</div>` : ''}
          ${shared.showCompanySubtitle ? `<div style="font-size: 12px; color: ${customerText};">${shared.companySubtitle}</div>` : ''}
        </div>
        ` : ''}
        
        <div>
          <h1 style="font-size: ${shared.invoiceTitleFontSize || 28}px; font-weight: bold; margin: 0; font-family: 'Manrope', sans-serif; letter-spacing: 2px; color: ${secondaryColor}; text-align: right;">
            ${showPrices ? 'PRINT INVOICE' : 'PRINT ORDER'}
          </h1>
          <div style="font-size: 12px; color: ${customerText}; margin-top: 8px; line-height: 1.6; text-align: right;">
            رقم الفاتورة: <span style="font-family: 'Manrope', sans-serif;">${data.invoiceNumber}</span><br/>
            التاريخ: <span style="font-family: 'Manrope', sans-serif;">${new Date(data.invoiceDate).toLocaleDateString('ar-LY')}</span>
            ${data.contractNumbers?.length ? `<br/>العقود: <span style="font-family: 'Manrope', sans-serif;">${data.contractNumbers.join(' - ')}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Logo Side -->
      <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
        ${shared.showLogo && shared.logoPath ? `
        <img src="${shared.logoPath}" alt="Logo" style="height: ${shared.logoSize || 60}px; object-fit: contain; flex-shrink: 0;" onerror="this.style.display='none'" />
        ` : ''}
        
        ${shared.showContactInfo ? `
        <div style="font-size: ${shared.contactInfoFontSize || 10}px; color: ${customerText}; line-height: 1.6; text-align: left;">
          ${shared.companyAddress ? `<div>${shared.companyAddress}</div>` : ''}
          ${shared.companyPhone ? `<div>هاتف: <span style="font-family: 'Manrope', sans-serif; direction: ltr; display: inline-block;">${shared.companyPhone}</span></div>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
    
    <!-- Customer Section -->
    <div style="background: linear-gradient(135deg, ${customerBg}, #ffffff); padding: 20px; margin-bottom: 28px; border-radius: 12px; border-right: 5px solid ${customerBorder}; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: ${bodyFontSize}px; color: ${customerText}; opacity: 0.7; margin-bottom: 4px;">العميل</div>
          <div style="font-size: ${titleFontSize - 4}px; font-weight: bold; color: ${customerTitle};">${data.customerName}</div>
          ${data.customerPhone ? `<div style="font-size: ${bodyFontSize - 1}px; color: ${customerText}; margin-top: 4px;">هاتف: <span style="font-family: 'Manrope', sans-serif;">${data.customerPhone}</span></div>` : ''}
        </div>
        <div style="display: flex; gap: 24px;">
          <div style="text-align: center;">
            <div style="font-size: ${titleFontSize + 4}px; font-weight: bold; color: ${primaryColor}; font-family: 'Manrope', sans-serif;">${totalQuantity}</div>
            <div style="font-size: ${bodyFontSize}px; color: ${customerText}; opacity: 0.7;">لوحة</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: ${titleFontSize + 4}px; font-weight: bold; color: ${primaryColor}; font-family: 'Manrope', sans-serif;">${totalFaces}</div>
            <div style="font-size: ${bodyFontSize}px; color: ${customerText}; opacity: 0.7;">وجه</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: ${bodyFontSize}px; page-break-inside: auto;">
      <thead>
        ${tableHeadersHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
        ${totalsHtml}
      </tbody>
    </table>
    
    ${notesHtml}
    ${paymentHtml}
    
    <!-- Footer -->
    ${shared.showFooter ? `
    <div style="width: 100%; margin-top: 20px; padding-top: 10px; border-top: 1px solid ${tableBorder}; color: ${shared.footerTextColor || '#666666'}; font-size: 10px; display: flex; align-items: center; justify-content: ${getFlexJustify(shared.footerAlignment)}; gap: 20px;">
      <span>${shared.footerText || ''}</span>
      ${shared.showPageNumber ? `<span>صفحة 1 من 1</span>` : ''}
    </div>
    ` : ''}
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 800);
    };
  </script>
</body>
</html>`;
}

// =====================================================
// دالة الطباعة الرئيسية
// =====================================================

export async function printPrintInvoice(data: PrintInvoiceData): Promise<void> {
  const htmlContent = await generatePrintInvoiceHTML(data);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('فشل فتح نافذة الطباعة');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

// =====================================================
// Hook للاستخدام في المكونات
// =====================================================

export function usePrintInvoicePrint() {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const print = async (data: PrintInvoiceData) => {
    setIsPrinting(true);
    try {
      await printPrintInvoice(data);
    } catch (error) {
      console.error('Error printing print invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading };
}
