const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function invoiceSummaryHtml(rows: { label: string; value: string }[], total: string): string {
  return `<div class="invoice-summary">${rows.map(row => `<div class="invoice-summary-line"><span>${escape(row.label)}</span><span class="num">${escape(row.value)}</span></div>`).join('')}
    <div class="grand-total-row invoice-summary-total"><strong>الإجمالي المستحق</strong><strong class="num">${escape(total)}</strong></div></div>`;
}

/** Same print language as the contract table and installation cards:
 * Doran, square ruled tables, white/gray rows and a restrained brand gold rule. */
export const invoiceBrandCss = `
  body.invoice-brand { --invoice-gold:#d6ac40; color:#222; line-height:1.65; }
  .invoice-brand .main-content { padding-bottom:12px; }
  .invoice-brand .u-header { border:0 !important; border-bottom:2px solid var(--invoice-gold) !important; background:#fff !important; min-height:96px !important; margin-bottom:16px !important; padding:0 0 16px !important; }
  .invoice-brand .u-header .u-invoice-details:empty { display:none; }
  .invoice-brand .u-invoice-info { text-align:right; }
  .invoice-brand .u-invoice-title { font-size:26px; line-height:1.4; color:#222; }
  .invoice-brand .u-invoice-subtitle { color:#666; letter-spacing:1px; font-size:11px; font-weight:400; opacity:1; }
  .invoice-brand .u-logo { max-width:220px; }
  .invoice-brand .invoice-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 24px; margin:0 0 16px; padding:9px 12px; border:1px solid #d9d9d9; font-size:11px; }
  .invoice-brand .invoice-meta > div { width:auto !important; }
  .invoice-brand .invoice-meta .num { color:#222; font-size:12px; }
  .invoice-brand .customer-section { display:block; background:#fff !important; border:1px solid #d9d9d9 !important; border-radius:0 !important; padding:12px 14px !important; margin-bottom:20px !important; }
  .invoice-brand .invoice-customer-heading { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px 18px; background:transparent; color:#222; }
  .invoice-brand .customer-label { font-size:11px !important; color:#555 !important; opacity:1; font-weight:400; margin:0; }
  .invoice-brand .customer-name-text { font-size:18px; color:#222; margin:0; }
  .invoice-brand .invoice-customer-details { display:flex; flex-wrap:wrap; gap:4px 18px; margin-top:7px; font-size:11px; }
  .invoice-brand .invoice-customer-details .stats-cards { display:flex; margin-inline-start:auto; gap:12px !important; }
  .invoice-brand .invoice-customer-details .stat-card { display:flex; gap:4px; border:0; padding:0; }
  .invoice-brand .invoice-customer-details .stat-value { font-size:11px !important; color:#222; }
  .invoice-brand .invoice-customer-details .stat-label { font-size:11px; opacity:1; }
  .invoice-brand .items-table { border-collapse:collapse !important; border-spacing:0; margin:0 0 20px !important; line-height:1.6; }
  .invoice-brand .items-table thead th { background:#fff !important; color:#222 !important; border:1px solid #777 !important; border-radius:0; padding:10px 7px !important; font-size:11px; font-weight:700; }
  .invoice-brand .items-table tbody td { border:1px solid #ccc !important; padding:9px 7px !important; line-height:1.6; color:#222; }
  .invoice-brand .items-table tbody tr:nth-child(odd) { background:#fff !important; }
  .invoice-brand .items-table tbody tr:nth-child(even) { background:#f5f5f5 !important; }
  .invoice-brand .invoice-summary { width:46%; min-width:250px; margin-right:auto; margin-bottom:22px; border:1px solid #d9d9d9; break-inside:avoid; }
  .invoice-brand .invoice-summary-line { display:flex; justify-content:space-between; gap:12px; padding:8px 12px; border-bottom:1px solid #eee; font-size:11px; }
  .invoice-brand .invoice-summary-total { display:flex; justify-content:space-between; align-items:center; gap:12px; background:#fff !important; color:#222 !important; border-top:2px solid var(--invoice-gold); padding:12px; font-size:14px; }
  .invoice-brand .notes-section { border:1px solid #d9d9d9 !important; border-radius:0 !important; background:#fff !important; padding:10px 14px !important; margin-top:14px !important; font-size:11px; line-height:1.9; }
  .invoice-brand .invoice-note-line { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px 12px; margin:3px 0; }
  .invoice-brand .invoice-note-line strong { flex-shrink:0; }
  .invoice-brand .invoice-note-line span { flex:1; min-width:160px; overflow-wrap:anywhere; }
  .invoice-brand .u-footer { border-top:1px solid #ccc; font-size:10px; }
`;

export function invoiceNotesHtml(words: string, notes?: string): string {
  return `<div class="notes-section"><div class="invoice-note-line"><strong>المبلغ بالحروف:</strong><span>${escape(words)}</span></div>${notes ? `<div class="invoice-note-line"><strong>ملاحظات:</strong><span>${escape(notes)}</span></div>` : ''}</div>`;
}
