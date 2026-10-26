import { describe, expect, it } from 'vitest';
import { amendmentChangeLines, buildFormalAmendmentPages, buildAmendmentHistoryPages, contractDocumentHeading, type ContractAmendment } from '@/utils/contractAmendments';

const version = (number: number, changes: ContractAmendment['changes']): ContractAmendment => ({
  id: `version-${number}`, contract_number: 1294, amendment_number: number,
  created_at: '2026-10-26T10:00:00Z', changes, total_before: 6000, total_after: 6500,
});

describe('numbered contract document output', () => {
  it('labels original contracts and amendments without changing the parent number', () => {
    expect(contractDocumentHeading(1294, 0)).toBe('عقد إيجار مواقع إعلانية رقم: 1294');
    expect(contractDocumentHeading(1294, 2)).toBe('ملحق العقد رقم: 2 للعقد رقم: 1294');
  });
  it('keeps ordinary contracts free of empty history pages', () => {
    expect(buildAmendmentHistoryPages([], '/bgc2.svg', 1294)).toBe('');
    expect(buildAmendmentHistoryPages([version(0, [])], '/bgc2.svg', 1294)).toBe('');
  });
  it('prints before/after changes and escapes customer text', () => {
    const html = buildAmendmentHistoryPages([version(1, [{ field: 'Customer Name', before: 'قديم', after: '<script>alert(1)</script>' }])], '/bgc2.svg', 1294);
    expect(html).toContain('سجل تعديلات العقد رقم 1294');
    expect(html).toContain('اسم الزبون');
    expect(html).toContain('قديم');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('paginates long amendment histories onto separate A4 pages', () => {
    const history = Array.from({ length: 23 }, (_, i) => version(i + 1, [{ field: 'Total', before: i * 100, after: (i + 1) * 100 }]));
    const html = buildAmendmentHistoryPages(history, '/bgc2.svg', 1294);
    expect(html.match(/class="print-page contract-amendment-history"/g)).toHaveLength(3);
    expect(html).toContain('صفحة 3');
    expect(html.match(/<tr>/g)).toHaveLength(26);
  });
  it('uses readable labels for payment and service changes', () => {
    expect(amendmentChangeLines([
      { field: 'print_cost_enabled', before: 'false', after: 'true' },
      { field: 'installments_data', before: [{ amount: 100 }], after: [{ amount: 50 }, { amount: 50 }] },
    ])).toEqual([
      { label: 'تفعيل الطباعة', before: 'غير مفعّل', after: 'مفعّل' },
      { label: 'جدول الدفعات', before: '1 دفعات', after: '2 دفعات' },
    ]);
  });
});


it('paginates formal amendment details and escapes customer text', () => {
  const row = version(1, Array.from({ length: 20 }, (_, i) => ({ field: 'Ad Type', before: `old-${i}`, after: `<script>${i}</script>` })));
  const html = buildFormalAmendmentPages([row], '/bg.svg', 1294, 'د.ل');
  expect((html.match(/class="print-page contract-formal-amendment"/g) || []).length).toBeGreaterThan(1);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;19');
  expect((html.match(/الطرف الأول: الشركة/g) || []).length).toBe(1);
  expect(buildFormalAmendmentPages([], '/bg.svg', 1294, 'د.ل')).toBe('');
});
