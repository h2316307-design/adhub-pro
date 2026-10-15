export interface ReceiptPresentation {
  amount: string;
  receiver?: string;
}

const escapeText = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function receiptAmountHtml(receipt: ReceiptPresentation): string {
  return `<section class="receipt-amount"><span>المبلغ المستلم بموجب هذا الوصل</span><strong><bdi>${escapeText(receipt.amount)}</bdi></strong></section>`;
}

export function receiptSignatureHtml(receipt: ReceiptPresentation): string {
  return `<section class="receipt-signatures"><div><span>اسم المستلم</span><strong>${escapeText(receipt.receiver || '')}</strong></div><div><span>توقيع المستلم</span><strong></strong></div><div><span>الختم</span><strong></strong></div></section>`;
}

export const receiptPresentationCss = `
  [data-payment-receipt] .receipt-amount {
    display: flex; justify-content: space-between; align-items: center; gap: 20px;
    border: 1px solid #d4d4d4; border-inline-start: 3px solid #b8860b;
    padding: 16px 18px; margin: 14px 0 20px; break-inside: avoid;
    color: #262626; background: #fff;
  }
  [data-payment-receipt] .receipt-amount > span { font-size: 12px; }
  [data-payment-receipt] .receipt-amount strong { font-size: 25px; line-height: 1.5; overflow-wrap: anywhere; }
  [data-payment-receipt] .measurements-table th { padding: 10px 8px; }
  [data-payment-receipt] .measurements-table td { padding: 9px 8px; line-height: 1.7; }
  [data-payment-receipt] .receipt-signatures {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px;
    margin: 28px 0 24px; break-inside: avoid; text-align: center; color: #404040;
  }
  [data-payment-receipt] .receipt-signatures span { font-size: 12px; }
  [data-payment-receipt] .receipt-signatures strong {
    display: block; min-height: 42px; padding-top: 14px; border-bottom: 1px solid #aaa;
    font-size: 12px; font-weight: 400; overflow-wrap: anywhere;
  }
  [data-payment-receipt] .u-footer { margin-top: 20px; padding: 10px 0; border-top: 1px solid #d4d4d4; }
  [data-payment-receipt] .u-footer-contacts { flex: 1; justify-content: space-between !important; gap: 8px 24px !important; }
  [data-payment-receipt] .u-footer-contacts > span[aria-hidden] { display: none; }
  [data-payment-receipt] .u-footer-contact { font-size: 10px; line-height: 1.8; }
`;
