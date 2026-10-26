import { describe, expect, it, vi } from 'vitest';
import { writeFileSync, copyFileSync } from 'node:fs';
import { DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { generateUnifiedPrintHTML, type UnifiedPrintOptions } from '@/lib/unifiedContractPrint';

vi.mock('@/utils/invoiceExtras', () => ({ fetchInvoiceExtras: async () => ({ bankAccounts: [], stampImageUrl: '' }) }));

const options: UnifiedPrintOptions = {
  settings: DEFAULT_SECTION_SETTINGS,
  contractData: { contractNumber: '1294', amendmentNumber: 2, year: '2026', startDate: '2026-10-01', endDate: '2026-10-30', duration: 'شهر', customerName: 'زبون تجريبي' },
  terms: [{ id: 'term', term_title: 'البند الأول', term_content: 'نفس بنود العقد المحفوظة.', term_order: 1, is_active: true, font_size: 42 }],
  billboards: [], templateBgUrl: 'data:image/png;base64,first', tableBgUrl: 'data:image/png;base64,table',
  currencyInfo: { symbol: 'د.ل', writtenName: 'دينار ليبي' },
  contractDetails: { finalTotal: '6,500', rentalCost: '6,000', installationCost: '500', duration: 'شهر' },
  paymentsHtml: 'دفعة واحدة عند التوقيع',
  amendmentHistory: [{ id: '2', contract_number: 1294, amendment_number: 2, created_at: '2026-10-26T10:00:00Z', changes: [{ field: 'Total', before: 6000, after: 6500 }], total_before: 6000, total_after: 6500 }],
};

describe('amendments use the existing contract print template', () => {
  it('prints the amendment heading, original clauses, and an appended history page', async () => {
    const html = await generateUnifiedPrintHTML(options);
    const dom = new DOMParser().parseFromString(html.replace(/<link\b[^>]*>/g, '').replace(/@import[^;]*;/g, ''), 'text/html');
    expect(dom.querySelector('svg')?.textContent).toContain('ملحق العقد رقم: 2 للعقد رقم: 1294');
    expect(dom.querySelector('svg')?.textContent).toContain('نفس بنود العقد المحفوظة.');
    expect(dom.querySelectorAll('.contract-amendment-history')).toHaveLength(1);
    expect(dom.querySelectorAll('.print-page')).toHaveLength(2);
    expect(dom.title).toContain('ملحق العقد رقم: 2 للعقد رقم: 1294');
    const preview = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/data:image\/png;base64,first/g, '/bgc1.svg').replace(/data:image\/png;base64,table/g, '/bgc2.svg').replace(/http:\/\/localhost:3000\//g, '/');
    writeFileSync('scratch/contract-amendment-generated-preview.html', preview);
    copyFileSync('public/bgc1.svg', 'scratch/bgc1.svg');
  });
  it('keeps the ordinary contract heading when printing the original', async () => {
    const html = await generateUnifiedPrintHTML({ ...options, contractData: { ...options.contractData, amendmentNumber: undefined } });
    const dom = new DOMParser().parseFromString(html.replace(/<link\b[^>]*>/g, '').replace(/@import[^;]*;/g, ''), 'text/html');
    expect(dom.querySelector('svg')?.textContent).toContain('عقد إيجار مواقع إعلانية رقم: 1294');
    expect(dom.querySelector('svg')?.textContent).not.toContain('ملحق العقد رقم:');
  });
});


describe('complete contract and amendment bundle', () => {
  it('keeps the original total and appends numbered financial amendments in order', async () => {
    const second = options.amendmentHistory![0];
    const html = await generateUnifiedPrintHTML({ ...options, printAllAmendments: true,
      contractData: { ...options.contractData, amendmentNumber: undefined },
      contractDetails: { ...options.contractDetails, finalTotal: '5,000' },
      amendmentHistory: [second, { ...second, id: '1', amendment_number: 1, total_before: 5000, total_after: 6000, changes: [{ field: 'Total', before: 5000, after: 6000 }] }] });
    const dom = new DOMParser().parseFromString(html.replace(/<link\b[^>]*>/g, '').replace(/@import[^;]*;/g, ''), 'text/html');
    const pages = [...dom.querySelectorAll('.contract-formal-amendment')];
    expect(pages.map(page => page.getAttribute('data-amendment'))).toEqual(['1', '2']);
    expect(dom.querySelectorAll('.contract-amendment-history')).toHaveLength(0);
    expect(pages[1].textContent).toContain('القيمة الجديدة للعقد');
    expect(pages[1].textContent).toContain((6500).toLocaleString('ar-LY'));
    expect(pages[1].textContent).toContain('التوقيع');
    expect(pages[1].textContent).toContain('متطلبات تنفيذ الإعلان');
    expect(dom.querySelector('svg')?.textContent).toContain('عقد إيجار مواقع إعلانية');
    writeFileSync('scratch/contract-bundle-preview.html', html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/data:image\/png;base64,first/g, '/bgc1.svg').replace(/data:image\/png;base64,table/g, '/bgc2.svg').replace(/http:\/\/localhost:3000\//g, '/'));
  });
});
