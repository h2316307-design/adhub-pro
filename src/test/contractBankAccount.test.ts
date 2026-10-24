import { describe, expect, it } from 'vitest';
import { renderContractBankAccount } from '@/lib/contractBankAccount';

describe('contract bank account from settings', () => {
  it('leaves the account area empty when no account is configured', () => {
    expect(renderContractBankAccount([])).toBe('');
    expect(renderContractBankAccount([{ bankName: 'Bank', accountNumber: '' }])).toBe('');
  });

  it('includes LYPay even when the regular account is empty', () => {
    const svg = renderContractBankAccount([{ bankName: 'Bank', accountNumber: '', lypayNumber: '123456' }]);
    expect(svg).toContain('>123456</span>');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('LYPay');
    expect(svg).toContain('font-family:Manrope, sans-serif');
    expect(svg).not.toContain('textLength');
  });

  it('groups both numbers under one bank title on the same line', () => {
    const svg = renderContractBankAccount([{ bankName: 'Bank', accountNumber: '111', lypayNumber: '222' }]);
    expect(svg).toContain('>111</span>');
    expect(svg).toContain('>222</span>');
    expect(svg.match(/>Bank<\/span>/g)).toHaveLength(1);
    expect(svg).toContain('white-space:nowrap');
    expect(svg).toContain('height:3px;transform:translateY(-50%);background:#D4AF37');
    expect(svg).toContain('>،</span>');
    expect(svg).toContain('font-weight:800');
  });

  it('renders the configured account safely in the original SVG position', () => {
    const svg = renderContractBankAccount([{ bankName: 'A & B', accountNumber: ' LY12345 ' }]);
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('>LY12345</span>');
    expect(svg).toContain('y="716"');
    expect(svg).not.toContain('LY04002103103207000003703');
  });
});
