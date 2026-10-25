import type { BankAccount } from '@/utils/invoiceExtras';

const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]!));

/** Both account numbers belong to the bank and share one line above the signatures. */
export function renderContractBankAccount(accounts: BankAccount[]): string {
  const banks = new Map<string, string[]>();
  for (const account of accounts) {
    const numbers = [account.accountNumber?.trim(), account.lypayNumber?.trim()].filter((n): n is string => !!n);
    if (!numbers.length) continue;
    banks.set(account.bankName, [...new Set([...(banks.get(account.bankName) || []), ...numbers])]);
  }
  if (!banks.size) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 602.7 844.02" aria-label="الحسابات البنكية" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;">
    <foreignObject x="32" y="716" width="539" height="35">
      <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:ContractDoran, Doran, 'Noto Sans Arabic', sans-serif;color:#000;">
        ${[...banks].map(([name, numbers]) => `<div style="display:flex;align-items:center;justify-content:center;gap:20px;white-space:nowrap;line-height:20px;">
          <span style="position:relative;display:inline-block;font-size:10.2px;font-weight:800;padding:0 4px;flex-shrink:0;">
            <span style="position:absolute;left:0;right:0;top:50%;height:3px;transform:translateY(-50%);background:#D4AF37;z-index:0;border-radius:0.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="position:relative;z-index:1;">${escapeXml(name)}</span>
          </span>
          ${numbers.map(number => `<span class="contract-account-number" dir="ltr" style="font-family:Manrope, sans-serif;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:0.25px;flex-shrink:0;unicode-bidi:isolate;">${escapeXml(number)}</span>`).join('<span aria-hidden="true" style="font-family:ContractDoran, Doran, sans-serif;font-size:12px;line-height:20px;">،</span>')}
        </div>`).join('')}
      </div>
    </foreignObject>
  </svg>`;
}
