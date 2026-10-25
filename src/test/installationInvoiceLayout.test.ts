import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateInvoiceHTML } from '@/components/composite-tasks/CompositeTaskInvoicePrint';

const task = { id: 'install-preview', task_number: 142, contract_id: 1170, customer_name: 'شركة النور للتجارة والاستثمار', invoice_date: '2026-10-25', task_type: 'new_installation', customer_installation_cost: 1200, customer_print_cost: 0, customer_cutout_cost: 0, customer_total: 1100, discount_amount: 100, notes: 'التنفيذ حسب التصاميم المعتمدة.' };
const landmark = 'مدخل الطريق الساحلي مقابل الإشارة الضوئية بجوار المركز التجاري عند تقاطع الطريق الرئيسي';
const board = { billboard_id: 12, billboard_name: 'TR-012', billboard_size: '6 × 3', billboard_image: '/placeholder.svg', city: 'طرابلس', municipality: 'حي الأندلس', nearest_landmark: landmark, gps_coordinates: '32.88,13.18', faces_count: 2, design_face_a: '/logofaresgold.svg', design_face_b: '/logofares.svg', customer_installation_cost: 600 };
const details = { installationItems: [board, { ...board, billboard_id: 13, billboard_name: 'TR-013' }], print: null };

describe('installation invoice brand layout', () => {
  it('uses the production invoice route and retains photos and full board details', () => {
    const html = generateInvoiceHTML(task as any, details, true, '/logofares.svg', 'detailed', undefined, { logoSize: 86 });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('body')?.classList.contains('installation-invoice')).toBe(true);
    expect(doc.querySelectorAll('.items-table tbody tr')).toHaveLength(2);
    expect(doc.querySelectorAll('.board-photo img')).toHaveLength(2);
    expect(doc.querySelectorAll('.board-designs img')).toHaveLength(4);
    expect(doc.querySelector('.board-location')?.textContent).toContain(landmark);
    expect(doc.querySelector('.board-location')?.textContent).toContain('حي الأندلس');
    expect(doc.querySelector('.board-location a')?.getAttribute('href')).toContain('32.88%2C13.18');
    expect(doc.querySelector('.items-table')?.textContent).toContain('6 × 3');
    expect(doc.querySelector('.invoice-summary-total')?.textContent).toContain('1,100');
    expect(doc.querySelector('.invoice-summary')?.textContent).toContain('100');
    if (process.env.INSTALLATION_INVOICE_PREVIEW) writeFileSync(process.env.INSTALLATION_INVOICE_PREVIEW, html);
  });

  it('keeps the same board details in summary mode and supports missing photos', () => {
    const html = generateInvoiceHTML(task as any, { ...details, installationItems: [{ billboard_id: 14, billboard_name: 'TR-014', customer_installation_cost: 0 }] }, false, '/logofares.svg', 'summary');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.board-photo')?.textContent).toContain('لا توجد صورة');
    expect(doc.querySelector('.board-identity')?.textContent).toContain('TR-014');
    expect(doc.querySelector('.items-table tbody tr td:last-child')?.textContent).toBe('0 د.ل');
  });

  it('uses the reinstallation price while retaining the supplied invoice total', () => {
    const html = generateInvoiceHTML({ ...task, task_type: 'reinstallation' } as any, { ...details, installationItems: [{ ...board, reinstall_count: 1, customer_reinstall_cost: 250 }] });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.u-invoice-title')?.textContent).toContain('إعادة تركيب');
    expect(doc.querySelector('.items-table tbody tr td:last-child')?.textContent).toBe('250 د.ل');
    expect(doc.querySelector('.invoice-summary-total')?.textContent).toContain('1,100');
  });
});
