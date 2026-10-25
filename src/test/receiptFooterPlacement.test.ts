import { describe, expect, it } from 'vitest';
import { unifiedFooterHtml } from '@/lib/unifiedInvoiceBase';
import { withRepeatedPrintHeader } from '@/lib/repeatedPrintHeader';
import { renderBankAccountsHTML } from '@/utils/invoiceExtras';
import { writeFileSync } from 'node:fs';

describe('receipt footer placement', () => {
  it('keeps bank names and labelled account numbers together without duplicate accounts', () => {
    const account = { bankName: 'مصرف تجريبي', accountNumber: '10320000000001', lypayNumber: 'LY04002100000000000001', iconUrl: '/bank-icons/jumhouria.png' };
    const banks = renderBankAccountsHTML([account, account, { bankName: 'مصرف فارغ', accountNumber: '' }]);
    const doc = new DOMParser().parseFromString(banks, 'text/html');
    expect(doc.querySelectorAll('.invoice-bank-card')).toHaveLength(1);
    expect(doc.querySelectorAll('.invoice-bank-number')).toHaveLength(2);
    expect(doc.querySelector('.invoice-bank-card')?.textContent).toContain(account.bankName);
    expect(Array.from(doc.querySelectorAll('bdi')).map(node => node.textContent)).toEqual([account.accountNumber, account.lypayNumber]);
    expect(doc.querySelector('bdi')?.getAttribute('dir')).toBe('ltr');
    const footer = unifiedFooterHtml({ companyPhone: '0910000000', companyAddress: 'طرابلس · عنوان تجريبي', footerText: 'شكراً لتعاملكم معنا' }, '');
    if (process.env.FOOTER_LAYOUT_PREVIEW) writeFileSync(process.env.FOOTER_LAYOUT_PREVIEW, `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>@font-face{font-family:Doran;src:url('/Doran-Regular.otf')}@font-face{font-family:Manrope;src:url('/Manrope-Regular.otf')}*{box-sizing:border-box}body{margin:0;background:#eee;font-family:Doran,sans-serif}.preview{width:760px;max-width:100%;margin:30px auto;padding:28px;background:#fff}.u-closing-message{margin-top:8px}</style></head><body><div class="preview"><div style="border:1px solid #ddd;padding:14px 18px;margin-bottom:14px;font-size:13px;display:flex;justify-content:space-between"><span>الإجمالي المستحق</span><strong>23,040 د.ل</strong></div>${banks}${footer}</div></body></html>`);
  });
  it('does not leave an empty page icon when numbering is provided by the print engine', () => {
    const doc = new DOMParser().parseFromString(unifiedFooterHtml({ companyPhone: '0910000000' }, ''), 'text/html');
    expect(doc.querySelector('.u-page-number')).toBeNull();
    expect(doc.querySelectorAll('.u-footer-contact')).toHaveLength(1);
  });
  it('keeps company contacts together on the right and pagination separate', () => {
    const html = unifiedFooterHtml({ companyPhone: '0910000000', companyAddress: 'عنوان تجريبي', showFooter: true } as any);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.u-footer-contacts')?.textContent).toContain('0910000000');
    expect(doc.querySelector('.u-footer-contacts')?.textContent).toContain('عنوان تجريبي');
    expect(doc.querySelector('.u-footer-contacts .u-page-number')).toBeNull();
    expect((doc.querySelector('.u-footer') as HTMLElement).style.justifyContent).toBe('space-between');
  });
  it('places header in thead and footer in tfoot for reliable multi-page printing, and restores the preview', () => {
    const footer = unifiedFooterHtml({ companyPhone: '0910000000', companyAddress: 'عنوان تجريبي', showFooter: true } as any);
    const html = withRepeatedPrintHeader(`<html><body><div class="paper"><div class="u-header">Header</div><div>Invoice</div>${footer}</div><style>@page { margin: 0; }</style></body></html>`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
    const original = document.querySelector('.paper')!.innerHTML;
    new Function(doc.querySelector('script')!.textContent!)();
    window.dispatchEvent(new Event('beforeprint'));
    const tfoot = document.querySelector('.print-pagination-shell > tfoot');
    expect(tfoot).not.toBeNull();
    expect(tfoot?.querySelector('.u-footer')).not.toBeNull();
    expect(tfoot?.textContent).toContain('0910000000');
    expect((tfoot?.querySelector('.u-footer') as HTMLElement).style.display).not.toBe('none');
    const thead = document.querySelector('.print-pagination-shell > thead');
    expect(thead).not.toBeNull();
    expect(thead?.querySelector('.u-header')).not.toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.querySelector('.print-pagination-shell')).toBeNull();
    expect(document.querySelector('.paper')!.innerHTML).toBe(original);
  });
});
