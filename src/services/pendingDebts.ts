import { supabase } from '@/integrations/supabase/client';
import type { GoogleCalendarEvent } from '@/services/googleCalendarService';
import { filterCompositeRelatedPrintedInvoices } from '@/lib/canonicalCustomerLedger';
import { operationKeyOf } from '@/lib/compositeCosts';
import { getOperationLabel } from '@/lib/compositeTaskOperation';

const PAID_TYPES = ['payment', 'receipt', 'account_payment'];
const m = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

async function readAll<T = any>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

const daysSince = (date: string) => {
  const d = new Date(String(date).slice(0, 10));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - d.getTime()) / 86400000));
};

/**
 * ديون غير مسددة لا تأتي من أقساط العقود: فواتير الطباعة وأوامر العمل (التركيب/الطباعة/القص).
 * تُعاد بشكل تنبيهات «فاتورة» حتى تظهر مع باقي الفواتير.
 */
export async function loadPendingDebtEvents(customers: { id: string; name: string; email?: string | null }[]): Promise<GoogleCalendarEvent[]> {
  const [printed, comps, printTasks, cutoutTasks, pays, installs] = await Promise.all([
    readAll((f, t) => supabase.from('printed_invoices').select('id, invoice_number, invoice_type, customer_id, customer_name, total_amount, invoice_date, created_at, notes').range(f, t)),
    readAll((f, t) => supabase.from('composite_tasks').select('id, contract_id, customer_id, customer_name, task_type, customer_total, created_at, installation_task_id, print_task_id, cutout_task_id, combined_invoice_id').gt('customer_total', 0).range(f, t)),
    readAll((f, t) => supabase.from('print_tasks').select('id, invoice_id, composite_task_id, is_composite, installation_task_id').range(f, t)),
    readAll((f, t) => supabase.from('cutout_tasks').select('id, invoice_id, is_composite, installation_task_id').range(f, t)),
    readAll((f, t) => supabase.from('customer_payments').select('amount, entry_type, printed_invoice_id, composite_task_id').or('printed_invoice_id.not.is.null,composite_task_id.not.is.null').range(f, t)),
    readAll((f, t) => supabase.from('installation_tasks').select('id, contract_ids, reinstallation_number').range(f, t)),
  ]);
  const paidBy = (field: 'printed_invoice_id' | 'composite_task_id') => {
    const map = new Map<string, number>();
    (pays as any[]).filter(p => PAID_TYPES.includes(p.entry_type) && p[field]).forEach(p => map.set(String(p[field]), (map.get(String(p[field])) || 0) + (Number(p.amount) || 0)));
    return map;
  };
  const paidPrinted = paidBy('printed_invoice_id');
  const paidComp = paidBy('composite_task_id');
  const custName = new Map(customers.map(c => [c.id, c.name]));
  const custEmail = new Map(customers.map(c => [c.id, c.email || undefined]));
  const events: GoogleCalendarEvent[] = [];

  const billable = filterCompositeRelatedPrintedInvoices(printed, comps, printTasks, cutoutTasks);
  for (const inv of billable as any[]) {
    const remaining = m((Number(inv.total_amount) || 0) - (paidPrinted.get(String(inv.id)) || 0));
    if (remaining <= 0.5) continue;
    const date = String(inv.invoice_date || inv.created_at || '').slice(0, 10);
    const d = daysSince(date);
    events.push({
      id: `printed-${inv.id}`, tag: `debt-printed-${inv.id}`, type: 'invoice',
      title: `فاتورة طباعة ${inv.invoice_number || ''}`, description: inv.notes || '',
      startDate: date, allDay: false, invoiceNumber: inv.invoice_number || '', invoiceName: 'طباعة', invoiceId: inv.id,
      customerName: custName.get(inv.customer_id) || inv.customer_name || '—', customerId: inv.customer_id, customerEmail: custEmail.get(inv.customer_id),
      amount: remaining, totalAmount: Number(inv.total_amount) || 0, paidAmount: paidPrinted.get(String(inv.id)) || 0,
      daysRemainingOrOverdue: d, isOverdue: d > 0, isContractActive: true, statusText: 'غير مسددة',
    } as GoogleCalendarEvent);
  }

  // أوامر العمل: عملية واحدة = تنبيه واحد
  const iMap = new Map((installs as any[]).map(i => [i.id, i]));
  const groups = new Map<string, any[]>();
  for (const t of comps as any[]) {
    const it: any = iMap.get(t.installation_task_id);
    const row = { ...t, contract_ids: it?.contract_ids || [], reinstallation_number: it?.reinstallation_number ?? null };
    const k = `${t.customer_id}|${operationKeyOf(row)}`;
    groups.set(k, [...(groups.get(k) || []), row]);
  }
  for (const [k, list] of groups) {
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const total = m(list.reduce((s, t) => s + (Number(t.customer_total) || 0), 0));
    const paid = m(list.reduce((s, t) => s + (paidComp.get(String(t.id)) || 0), 0));
    const remaining = m(total - paid);
    if (remaining <= 0.5) continue;
    const first = list[0];
    const contracts = [...new Set(list.flatMap(t => [t.contract_id, ...(t.contract_ids || [])]).map(Number).filter(Boolean))];
    const date = String(first.created_at || '').slice(0, 10);
    const d = daysSince(date);
    events.push({
      id: `composite-${k}`, tag: `debt-composite-${k}`, type: 'invoice',
      title: getOperationLabel({ ...first, contractIds: contracts }), description: '',
      startDate: date, allDay: false, contractNumber: contracts.length === 1 ? contracts[0] : undefined,
      invoiceNumber: contracts.map(n => '#' + n).join('، '), invoiceName: getOperationLabel({ ...first, contractIds: contracts }),
      customerName: custName.get(first.customer_id) || first.customer_name || '—', customerId: first.customer_id, customerEmail: custEmail.get(first.customer_id),
      amount: remaining, totalAmount: total, paidAmount: paid,
      daysRemainingOrOverdue: d, isOverdue: d > 0, isContractActive: true, statusText: 'غير مسددة',
    } as GoogleCalendarEvent);
  }
  return events;
}
