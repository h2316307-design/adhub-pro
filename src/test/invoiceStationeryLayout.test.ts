import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateSalesInvoiceHTML } from '@/lib/salesInvoiceGenerator';
import { generatePrintInvoiceHTML } from '@/lib/printInvoiceGenerator';
import { generatePurchaseInvoiceHTML } from '@/lib/purchaseInvoiceGenerator';
import { generateContractInvoiceHTML } from '@/lib/contractInvoiceGenerator';
import { resolveInvoiceStyles } from '@/lib/unifiedInvoiceBase';
import { mapPrintSettingsToInvoiceStyles } from '@/utils/invoicePrintSettingsBridge';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';
import { REFERENCE_INVOICE_STYLE } from '@/lib/officialInvoiceTemplate';

describe('printed invoice stationery', () => {
  it('preserves purchase and contract totals in separate brand summaries', async () => {
    const styles = await resolveInvoiceStyles('sales_invoice', {}, mapPrintSettingsToInvoiceStyles({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE }));
    for (const isFriendRental of [false, true]) {
      const html = await generatePurchaseInvoiceHTML({ invoiceNumber: 'PUR-14', invoiceDate: '2026-10-25', supplierName: 'مورد تجريبي', isFriendRental, items: [{ description: 'لوحة', quantity: 2, unitPrice: 500, total: 1000, faces: 2, size: '4 × 3' }], discount: 100, totalAmount: 900 }, styles);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('.invoice-summary')?.textContent).toContain('900.0');
      expect(doc.querySelector('.invoice-summary')?.textContent).toContain('100.0');
      expect(doc.querySelector('.items-table .grand-total-row')).toBeNull();
      if (isFriendRental) expect(doc.querySelector('.invoice-summary')?.textContent).toContain('عدد الأوجه');
    }
    const html = await generateContractInvoiceHTML({ invoiceNumber: 'CON-14', invoiceDate: '2026-10-25', contractId: 14, customerName: 'عميل تجريبي', currencySymbol: 'د.ل', currencyWrittenName: 'دينار ليبي', items: [{ size: '4 × 3', faces: 2, billboardCount: 2, unitPrice: 500, totalPrice: 1000 }], totalBillboards: 2, grandTotal: 1000 }, styles);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.invoice-summary')?.textContent).toContain('1,000.0');
    expect(doc.querySelector('.items-table .grand-total-row')).toBeNull();
  });
  it('retains customer details, discount and amounts in a long sales invoice', async () => {
    const styles = await resolveInvoiceStyles('sales_invoice', { titleAr: 'فاتورة مبيعات', titleEn: 'SALES INVOICE' }, mapPrintSettingsToInvoiceStyles({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, document_title_ar: 'فاتورة مبيعات', document_title_en: 'SALES INVOICE' }));
    const items = Array.from({ length: process.env.INVOICE_DESIGN_LONG ? 45 : 4 }, (_, i) => ({ description: ['طباعة وتجهيز لوحات الحملة الإعلانية', 'تركيب اللوحات على المواقع المعتمدة', 'قص وتجهيز مجسمات إعلانية', 'تصميم وتنسيق الهوية الإعلانية'][i % 4], quantity: 2, unit: 'لوحة', unitPrice: 1250, total: 2500 }));
    const html = await generateSalesInvoiceHTML({ invoiceNumber: 'INV-2026-0142', invoiceDate: '2026-10-25', customerName: 'شركة النور للتجارة والاستثمار', customerCompany: 'الحملة الإعلانية · طرابلس', customerPhone: '091 000 0000', items, discount: 500, totalAmount: items.length * 2500 - 500, notes: 'التنفيذ وفق المقاسات والتصاميم المعتمدة من العميل.', autoPrint: false }, styles);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.items-table tbody tr:not(.invoice-blank-row)')).toHaveLength(items.length);
    expect(doc.querySelector('.customer-section')?.textContent).toContain('شركة النور');
    expect(doc.querySelector('.grand-total-row')?.textContent).toContain((items.length * 2500 - 500).toLocaleString('en-US') + '.0');
    expect(doc.querySelector('.invoice-meta')?.textContent).toContain('INV-2026-0142');
    expect(doc.querySelector('.notes-section')?.textContent).toContain('التنفيذ وفق المقاسات');
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelectorAll('.items-table thead th')).toHaveLength(4);
    expect(doc.querySelector('.items-table .grand-total-row')).toBeNull();
    expect(doc.querySelector('body')?.hasAttribute('data-keep-print-colors')).toBe(true);
    expect(doc.querySelector('.invoice-customer-heading')?.textContent).toContain('شركة النور');
    if (process.env.INVOICE_DESIGN_PREVIEW) writeFileSync(process.env.INVOICE_DESIGN_PREVIEW, html.replaceAll('http://localhost:3000', ''));
  });

  it('keeps print-service quantities, dimensions and totals in the same stationery', async () => {
    const styles = await resolveInvoiceStyles('print_invoice', { titleAr: 'فاتورة طباعة', titleEn: 'PRINT INVOICE' }, mapPrintSettingsToInvoiceStyles({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, document_title_ar: 'فاتورة طباعة', document_title_en: 'PRINT INVOICE' }));
    const html = await generatePrintInvoiceHTML({ invoiceNumber: 'PR-2026-0142', invoiceDate: '2026-10-25', customerName: 'شركة النور للتجارة والاستثمار', currency: { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' }, subtotal: 2400, totalAmount: 2200, discountAmount: 200, items: [{ size: '4 × 3', quantity: 2, faces: 2, totalFaces: 4, area: 12, pricePerMeter: 50, totalArea: 48, totalPrice: 2400, width: 4, height: 3 }], autoPrint: false }, styles);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.items-table thead th')).toHaveLength(9);
    expect(doc.querySelector('.grand-total-row')?.textContent).toContain('2,200');
    expect(doc.querySelector('.invoice-meta')?.textContent).toContain('PR-2026-0142');
    if (process.env.PRINT_SERVICE_DESIGN_PREVIEW) writeFileSync(process.env.PRINT_SERVICE_DESIGN_PREVIEW, html.replaceAll('http://localhost:3000', ''));
  });
});
