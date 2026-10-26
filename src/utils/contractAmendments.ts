export type AmendmentChange = { field: string; before: unknown; after: unknown };
export type ContractAmendment = {
  id: string;
  contract_number: number;
  amendment_number: number;
  created_at: string;
  changes: AmendmentChange[];
  total_before: number;
  total_after: number;
  currency?: string;
};
export type AmendmentStatus = { enabled: boolean; fullyInstalled: boolean; latestNumber: number; originalSaved: boolean };

export const escapeDocumentText = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function contractDocumentHeading(contractNumber: string | number, amendmentNumber?: number): string {
  return amendmentNumber && amendmentNumber > 0
    ? `ملحق العقد رقم: ${amendmentNumber} للعقد رقم: ${contractNumber}`
    : `عقد إيجار مواقع إعلانية رقم: ${contractNumber}`;
}

const labels: Record<string, string> = {
  'Customer Name': 'اسم الزبون', customer_id: 'بيانات الزبون', 'Ad Type': 'نوع الإعلان',
  'Contract Date': 'تاريخ بداية العقد', 'End Date': 'تاريخ نهاية العقد', Duration: 'مدة العقد',
  Total: 'إجمالي العقد', 'Total Rent': 'صافي الإيجار', Discount: 'الخصم', base_rent: 'قيمة الإيجار',
  billboard_ids: 'لوحات العقد', billboards_count: 'عدد اللوحات', billboard_prices: 'أسعار اللوحات ومددها',
  installments_data: 'جدول الدفعات', design_data: 'تصاميم اللوحات', contract_currency: 'عملة العقد',
  exchange_rate: 'سعر الصرف', installation_cost: 'تكلفة التركيب', installation_enabled: 'تفعيل التركيب',
  print_cost: 'تكلفة الطباعة', print_cost_enabled: 'تفعيل الطباعة', print_price_per_meter: 'سعر متر الطباعة',
  include_installation_in_price: 'شمول التركيب بالسعر', include_print_in_billboard_price: 'شمول الطباعة بالسعر',
  single_face_billboards: 'اللوحات ذات الوجه الواحد', customer_category: 'فئة التسعير',
  friend_rental_data: 'إيجارات الشركات الصديقة', level_discounts: 'خصومات المستويات', fee: 'رسوم التشغيل',
  operating_fee_rate: 'نسبة التشغيل', partnership_operating_fee_rate: 'تشغيل الشراكات',
};

export function amendmentChangeLabel(field: string): string {
  if (labels[field]) return labels[field];
  if (field.startsWith('installment_') || /^Payment [123]$/.test(field)) return 'توزيع الدفعات';
  if (field.startsWith('duration_') || field === 'pricing_mode' || field === 'use_30_day_month') return 'طريقة احتساب المدة';
  if (field.includes('operating')) return 'إعدادات رسوم التشغيل';
  if (field.startsWith('friend_rental_')) return 'إعدادات الشركات الصديقة';
  return 'إعدادات إضافية بالعقد';
}

export function amendmentChangeValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean' || ['installation_enabled', 'print_cost_enabled'].includes(field)) return ['true', '1'].includes(String(value)) ? 'مفعّل' : 'غير مفعّل';
  if (typeof value === 'number') return value.toLocaleString('ar-LY', { maximumFractionDigits: 2 });
  if (field === 'billboard_ids') {
    const ids = String(value).split(',').filter(Boolean);
    return ids.length <= 12 ? ids.map(id => `#${id}`).join('، ') : `${ids.length} لوحة (${ids.slice(0, 10).join('، ')}…)`;
  }
  if (Array.isArray(value)) return value.length ? `${value.length} ${field === 'installments_data' ? 'دفعات' : field === 'billboard_prices' ? 'لوحات' : 'بنود'}` : 'لا يوجد';
  if (typeof value === 'object') return Object.keys(value).length ? 'بيانات محفوظة' : 'لا يوجد';
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function amendmentChangeLines(changes: AmendmentChange[]): Array<{ label: string; before: string; after: string }> {
  const lines = changes.map(change => ({ label: amendmentChangeLabel(change.field), before: amendmentChangeValue(change.field, change.before), after: amendmentChangeValue(change.field, change.after) }));
  return lines.filter((line, i) => lines.findIndex(other => other.label === line.label && other.before === line.before && other.after === line.after) === i);
}

/** Separate A4 pages use the existing contract background and print scaling. */
export function buildAmendmentHistoryPages(history: ContractAmendment[], background: string, contractNumber: string | number): string {
  const entries = history.filter(row => row.amendment_number > 0).flatMap(row => {
    const lines = amendmentChangeLines(row.changes);
    return (lines.length ? lines : [{ label: 'تعديل العقد', before: String(row.total_before), after: String(row.total_after) }]).map(line => ({ ...line, number: row.amendment_number, date: new Date(row.created_at).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' }) }));
  });
  const groups: typeof entries[] = [];
  let group: typeof entries = [];
  let units = 0;
  for (const entry of entries) {
    const weight = Math.max(1, Math.ceil(Math.max(entry.label.length, entry.before.length, entry.after.length) / 16)) + 1;
    if (group.length && (group.length >= 10 || units + weight > 24)) { groups.push(group); group = []; units = 0; }
    group.push(entry); units += weight;
  }
  if (group.length) groups.push(group);
  const pages: string[] = [];
  for (const [pageIndex, groupEntries] of groups.entries()) {
    const rows = groupEntries.map(entry => `<tr>${[entry.number, entry.date, entry.label, entry.before, entry.after].map(value => `<td style="padding:24px 18px;border:2px solid #ccc;overflow-wrap:anywhere;vertical-align:top">${escapeDocumentText(value)}</td>`).join('')}</tr>`).join('');
    pages.push(`<div class="print-page contract-amendment-history"><div class="contract-preview-container" style="position:relative;width:2480px;height:3508px;overflow:hidden;background:white;direction:rtl;font-family:ContractDoran,Doran,Tajawal,sans-serif;color:#111">
      <img src="${escapeDocumentText(background)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />
      <div style="position:absolute;left:150px;right:150px;top:530px;bottom:150px;background:#fff"></div>
      <div style="position:relative;padding:650px 150px 300px"><h2 style="font-size:64px;margin:0 0 24px">سجل تعديلات العقد رقم ${escapeDocumentText(contractNumber)}</h2>
      <p style="font-size:38px;margin:0 0 40px">الأصل محفوظ، وكل ملحق يمثل نسخة العقد بعد التعديل.</p>
      <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:34px;line-height:1.6;background:#fff"><thead><tr>${['الملحق','التاريخ','التغيير','قبل','بعد'].map(label => `<th style="padding:22px 12px;border:2px solid #ccc;background:#f5eedb">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:30px;margin-top:32px">سجل التعديلات · صفحة ${pageIndex + 1}</p></div></div></div>`);
  }
  return pages.join('');
}

/** A signed amendment sheet for each saved change, following the original contract. */
export function buildFormalAmendmentPages(history: ContractAmendment[], background: string, contractNumber: string | number, currency: string): string {
  const e = escapeDocumentText;
  return [...history].filter(row => row.amendment_number > 0).sort((a, b) => a.amendment_number - b.amendment_number).map(row => {
    const money = (value: number) => `${Number(value || 0).toLocaleString('ar-LY', { maximumFractionDigits: 2 })} ${row.currency || currency}`;
    const lines = amendmentChangeLines(row.changes);
    const groups: typeof lines[] = [];
    let group: typeof lines = []; let weight = 0;
    for (const line of lines) {
      const size = Math.max(1, Math.ceil(Math.max(line.before.length, line.after.length, line.label.length) / 24)) + 1;
      if (group.length && (group.length >= 6 || weight + size > 16)) { groups.push(group); group = []; weight = 0; }
      group.push(line); weight += size;
    }
    if (group.length || !groups.length) groups.push(group);
    return groups.map((items, index) => `<div class="print-page contract-formal-amendment" data-amendment="${row.amendment_number}"><div class="contract-preview-container" style="position:relative;width:2480px;height:3508px;overflow:hidden;background:#fff;direction:rtl;font-family:ContractDoran,Doran,Tajawal,sans-serif;color:#171717">
      <img src="${e(background)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />
      <div style="position:absolute;left:150px;right:150px;top:530px;bottom:150px;background:white"></div>
      <div style="position:relative;padding:600px 170px 170px;font-size:38px;line-height:1.65">
        <div style="border-bottom:5px solid #b8860b;padding-bottom:24px;margin-bottom:28px"><h1 style="font-size:58px;margin:0">${e(contractDocumentHeading(contractNumber, row.amendment_number))}</h1>
        <p style="margin:12px 0 0;font-size:32px">تاريخ تحرير الملحق: ${e(new Date(row.created_at).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' }))} · صفحة ${index + 1} من ${groups.length}</p></div>
        ${index === 0 ? `<p style="margin:0 0 28px;text-align:justify">إلحاقاً بالعقد رقم ${e(contractNumber)}، ونظراً لما استجد من متطلبات تنفيذ الإعلان وما اقتضاه ذلك من تعديل نطاق الأعمال، يُحرّر هذا الملحق بين طرفي العقد لتوثيق التعديلات المبينة أدناه، ويُعتمد بتوقيعه من الطرفين.</p>
        <h2 style="font-size:42px;margin:18px 0">أولاً: القيمة المالية للعقد بعد التعديل</h2>
        <div style="display:flex;gap:22px;margin:20px 0 32px">${[['القيمة السابقة للعقد', money(row.total_before)], ['القيمة الجديدة للعقد', money(row.total_after)], ['فرق التعديل', money(row.total_after - row.total_before)]].map(([label,value]) => `<div style="flex:1;border:2px solid #b8860b;padding:24px;background:#faf6e9"><div style="font-size:30px">${label}</div><strong style="font-size:44px">${e(value)}</strong></div>`).join('')}</div>
        <p style="font-size:30px;margin:0 0 28px">القيمة الجديدة تحل محل إجمالي العقد السابق؛ ولا تُضاف إليه مرة أخرى. فرق التعديل لا يمثل الرصيد المتبقي للسداد.</p>` : '<p>تابع تفاصيل التغييرات الخاصة بهذا الملحق.</p>'}
        <h2 style="font-size:42px;margin:20px 0">${index === 0 ? 'ثانياً: ' : ''}بيان التغييرات</h2>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:32px;line-height:1.5"><thead><tr>${['البند المعدّل','قبل التعديل','بعد التعديل'].map(t => `<th style="border:2px solid #ccc;background:#f5eedb;padding:18px">${t}</th>`).join('')}</tr></thead><tbody>${items.map(line => `<tr>${[line.label,line.before,line.after].map(v => `<td style="border:2px solid #ccc;padding:18px;vertical-align:top;overflow-wrap:anywhere">${e(v)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="3" style="padding:24px">تحديث بيانات العقد وفق النسخة المحفوظة.</td></tr>'}</tbody></table>
        ${index === groups.length - 1 ? `<h2 style="font-size:42px;margin:32px 0 12px">ثالثاً: استمرار أحكام العقد</h2><p style="margin:0">يُعد هذا الملحق جزءاً مكملاً للعقد الأصلي، وتبقى البنود التي لم يرد تعديلها سارية. وعند تعارض بند معدّل مع نسخة سابقة، يُعمل بالتعديل الأحدث المعتمد من الطرفين في حدود ذلك البند.</p>
        <div style="display:flex;justify-content:space-between;border-top:2px solid #b8860b;margin-top:42px;padding-top:24px;font-size:34px"><div>الطرف الأول: الشركة<br/>الاسم: ................................<br/>التوقيع: ..............................</div><div>الطرف الثاني: الزبون<br/>الاسم: ................................<br/>التوقيع: ..............................</div></div>` : '<p style="font-size:30px">يتبع في الصفحة التالية من الملحق نفسه.</p>'}
      </div></div></div>`).join('');
  }).join('');
}
