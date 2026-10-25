import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from './unifiedInvoiceBase';
import { invoiceBrandCss, invoiceSummaryHtml, invoiceNotesHtml } from './invoiceBrandLayout';
import { numberToArabicWords } from './printUtils';

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: unknown) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })} د.ل`;
const image = (url: unknown, label: string) => url ? `<img src="${escape(url)}" alt="${escape(label)}" loading="eager" />` : '<span class="missing-image">لا توجد صورة</span>';

/** Installation invoice rows retain board identity even when boards share photos. */
export function buildInstallationInvoiceHTML(task: Record<string, any>, details: Record<string, any>, styles: Record<string, any>, logo: string, total: number): string {
  const items: Record<string, any>[] = details.installationItems || [];
  const date = formatDateForPrint(task.invoice_date || new Date().toISOString(), styles.showHijriDate);
  const title = task.task_type === 'reinstallation' ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
  const contracts = details.contractsInfo?.map((contract: any) => `#${contract.contractId}`).join('، ') || (task.contract_ids || [task.contract_id]).filter(Boolean).map((id: number) => `#${id}`).join('، ');
  const rows = items.map((item, index) => {
    const board = item.billboard || {};
    const name = item.billboard_name || board.Billboard_Name || `لوحة #${item.billboard_id || index + 1}`;
    const size = item.billboard_size || board.Size || (item.width && item.height ? `${item.width} × ${item.height}` : 'غير محدد');
    const city = item.city || board.City;
    const municipality = item.municipality || board.Municipality;
    const landmark = item.nearest_landmark || board.Nearest_Landmark;
    const gps = item.gps_coordinates || board.GPS_Coordinates;
    const designs = [['أمامي', item.design_face_a || board.design_face_a], ['خلفي', item.design_face_b || board.design_face_b]].filter(([, url]) => url);
    const reinstall = task.task_type === 'reinstallation' && Number(item.reinstall_count) > 0;
    const cost = reinstall ? Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0 : item.customer_installation_cost ?? (Number(task.customer_installation_cost || 0) / Math.max(1, items.length));
    return `<tr><td class="num">${index + 1}</td><td class="board-photo">${image(item.billboard_image || board.Image_URL, `صورة اللوحة ${name}`)}</td>
      <td class="board-identity"><strong>${escape(name)}</strong><small>رقم اللوحة: <bdi>${escape(item.billboard_id || board.ID || '—')}</bdi></small>${item.contract_id ? `<small>العقد: #${escape(item.contract_id)}</small>` : ''}${item.completed_at ? `<small>التركيب: ${escape(formatDateForPrint(item.completed_at))}</small>` : ''}</td>
      <td class="board-location">${[city, municipality, landmark, item.location].filter((value, i, values) => value && values.indexOf(value) === i).map(value => `<div>${escape(value)}</div>`).join('') || 'الموقع غير محدد'}${gps ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(String(gps))}"><bdi dir="ltr">${escape(gps)}</bdi></a>` : ''}</td>
      <td class="board-designs">${designs.length ? designs.map(([face, url]) => `<figure>${image(url, `تصميم ${face} ${name}`)}<figcaption>${face}</figcaption></figure>`).join('') : 'لا توجد تصاميم'}</td>
      <td><strong><bdi dir="ltr">${escape(size)}</bdi></strong><small>${escape(item.faces_count || board.Faces_Count || designs.length || '—')} وجه</small></td>
      <td class="num">${escape(money(cost))}</td></tr>`;
  }).join('');
  const summary = [
    { label: 'تكلفة التركيب', value: money(task.customer_installation_cost) },
    ...(Number(task.customer_print_cost) > 0 ? [{ label: 'تكلفة الطباعة', value: money(task.customer_print_cost) }] : []),
    ...(Number(task.customer_cutout_cost || details.customerCutoutTotal) > 0 ? [{ label: 'تكلفة القص', value: money(task.customer_cutout_cost || details.customerCutoutTotal) }] : []),
    ...(Number(task.discount_amount) > 0 ? [{ label: `الخصم${task.discount_reason ? ` (${task.discount_reason})` : ''}`, value: `− ${money(task.discount_amount)}` }] : []),
  ];
  const printStyles = { ...styles, headerSwap: false, headerStyle: 'classic', headerAlignment: 'split' as const, invoiceTitleArFontSize: 26, logoSize: styles.logoSize || 86 };
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} - ${escape(task.customer_name)}</title><style>
    * { box-sizing:border-box; } body { margin:0; background:#fff; direction:rtl; font-size:11px; }
    @page { size:A4; margin:12mm; }
    .paper { width:210mm; min-height:297mm; padding:12mm; margin:auto; background:white; }
    ${unifiedHeaderFooterCss(printStyles)}
    ${invoiceBrandCss}
    .installation-invoice .items-table { table-layout:fixed; width:100%; font-size:10px !important; }
    .installation-invoice .items-table tbody td { text-align:center; overflow-wrap:anywhere; padding:8px 5px !important; }
    .installation-invoice .items-table small { display:block; font-size:9px; margin-top:5px; font-weight:400; }
    .installation-invoice .board-photo img { width:100%; height:80px; object-fit:contain; display:block; }
    .installation-invoice .board-identity, .installation-invoice .board-location { text-align:right !important; line-height:1.8; }
    .installation-invoice .board-location a { color:#56584f; font-size:8px; }
    .installation-invoice .board-designs figure { margin:3px 0; }
    .installation-invoice .board-designs img { width:100%; height:45px; object-fit:contain; display:block; }
    .installation-invoice figcaption, .missing-image { font-size:9px; color:#555; }
    .installation-invoice .invoice-summary { width:46%; }
    @media print { .paper { width:auto; min-height:0; padding:0; margin:0; } .items-table tr { break-inside:avoid; } }
    </style></head><body class="invoice-brand installation-invoice" data-keep-print-colors><div class="paper">
    ${unifiedHeaderHtml({ styles: printStyles, fullLogoUrl: logo || styles.logoPath || '/logofares.svg', titleAr: title, titleEn: task.task_type === 'reinstallation' ? 'REINSTALLATION INVOICE' : 'INSTALLATION INVOICE', metaLinesHtml: '' })}
    <div class="u-invoice-details invoice-meta"><div>رقم الفاتورة: <bdi class="num">${escape(task.task_number || task.id)}</bdi></div><div>التاريخ: ${escape(date)}</div></div>
    <div class="customer-section"><div class="invoice-customer-heading"><span class="customer-label">بيانات العميل:</span><strong class="customer-name-text">${escape(task.customer_name || 'غير محدد')}</strong></div><div class="invoice-customer-details"><span>العقود: ${escape(contracts)}</span><span>عدد بنود التركيب: ${items.length}</span>${task.teamName ? `<span>الفريق: ${escape(task.teamName)}</span>` : ''}</div></div>
    <table class="items-table"><colgroup>${[4, 16, 18, 20, 17, 11, 14].map(width => `<col style="width:${width}%">`).join('')}</colgroup><thead><tr>${['#', 'صورة اللوحة', 'بيانات اللوحة', 'الموقع', 'التصاميم', 'المقاس والأوجه', 'تكلفة التركيب'].map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    ${invoiceSummaryHtml(summary, money(total))}
    ${invoiceNotesHtml(`${numberToArabicWords(total)} دينار ليبي فقط لا غير`, task.notes || '')}
    ${unifiedFooterHtml({ ...styles, footerText: styles.footerText ?? 'شكراً لتعاملكم معنا' }, '')}
    </div></body></html>`;
}
