import { supabase } from '@/integrations/supabase/client';
import { round2 } from './customerAccount';

/** عمليات دفعات الزبون. كل عملية تفحص الأخطاء وتوقف عند أول فشل بدل الاستمرار بصمت. */

const check = (res: { error: any }, label: string) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
};

/** تعديل حقل paid_amount المخزن في فاتورة/مهمة بمقدار delta (موجب = زيادة) */
async function adjustPaid(table: 'sales_invoices' | 'printed_invoices' | 'composite_tasks', id: string, delta: number) {
  const cols = table === 'composite_tasks' ? 'paid_amount' : 'paid_amount, total_amount';
  const r = await supabase.from(table).select(cols).eq('id', id).maybeSingle();
  check(r, 'قراءة السجل المرتبط');
  if (!r.data) return;
  const row: any = r.data;
  const paid = Math.max(0, round2((Number(row.paid_amount) || 0) + delta));
  const patch: any = { paid_amount: paid };
  if (table !== 'composite_tasks') {
    const total = Number(row.total_amount) || 0;
    patch.paid = total > 0 && paid + 0.01 >= total;
  }
  check(await supabase.from(table).update(patch).eq('id', id), 'تحديث المدفوع');
}

async function adjustPurchaseUsed(id: string, delta: number) {
  const r = await supabase.from('purchase_invoices').select('used_as_payment').eq('id', id).maybeSingle();
  check(r, 'قراءة فاتورة المشتريات');
  if (!r.data) return;
  const used = Math.max(0, round2((Number((r.data as any).used_as_payment) || 0) + delta));
  check(await supabase.from('purchase_invoices').update({ used_as_payment: used }).eq('id', id), 'تحديث فاتورة المشتريات');
}

/** سجل print_invoice_payments المساعد لا يرتبط برقم الدفعة: يُحذف سجل واحد مطابق للفاتورة والمبلغ إن وُجد */
async function removePrintInvoicePaymentRecord(invoiceId: string, amount: number) {
  const r = await supabase.from('print_invoice_payments').select('id').eq('invoice_id', invoiceId).eq('amount', amount).order('created_at', { ascending: false }).limit(1);
  const id = (r.data as any)?.[0]?.id;
  if (id) await supabase.from('print_invoice_payments').delete().eq('id', id);
}

/** إرجاع قيمة مقايضة إيجار لوحة صديقة — محصور في شركة الزبون الصديقة فقط */
async function refundFriendRental(friendCompanyId: string | null, amount: number, notes: string) {
  if (!friendCompanyId || !notes?.includes('مقايضة من إيجار لوحة:')) return;
  const r = await supabase
    .from('friend_billboard_rentals')
    .select('id, used_as_payment, contract_number, billboard_id, billboards(Billboard_Name)')
    .eq('friend_company_id', friendCompanyId)
    .gt('used_as_payment', 0);
  check(r, 'قراءة إيجارات الشركة الصديقة');
  const wordIn = (needle: string) => new RegExp(`(^|[^0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9]|$)`).test(notes);
  const matched = (r.data || []).filter((x: any) =>
    (x.contract_number && wordIn(`عقد ${x.contract_number}`)) ||
    wordIn(`لوحة ${x.billboard_id}`) ||
    (x.billboards?.Billboard_Name && notes.includes(x.billboards.Billboard_Name)));
  let left = amount;
  for (const x of matched as any[]) {
    if (left <= 0) break;
    const used = Number(x.used_as_payment) || 0;
    const take = Math.min(used, left);
    check(await supabase.from('friend_billboard_rentals').update({ used_as_payment: round2(used - take) }).eq('id', x.id), 'إرجاع المقايضة');
    left -= take;
  }
}

/** حذف دفعة مفردة مع عكس أثرها على الفواتير والمهام */
export async function deletePayment(paymentId: string, friendCompanyId: string | null) {
  const r = await supabase.from('customer_payments').select('*').eq('id', paymentId).maybeSingle();
  check(r, 'قراءة الدفعة');
  const p: any = r.data;
  if (!p) return;
  if (p.distributed_payment_id) throw new Error('هذه الدفعة جزء من دفعة موزعة — احذف الدفعة الموزعة كاملة');
  const amt = Number(p.amount) || 0;
  await refundFriendRental(friendCompanyId, amt, p.notes || '');
  if (p.purchase_invoice_id) await adjustPurchaseUsed(p.purchase_invoice_id, -amt);
  if (p.printed_invoice_id) {
    await removePrintInvoicePaymentRecord(p.printed_invoice_id, amt);
    await adjustPaid('printed_invoices', p.printed_invoice_id, -amt);
  }
  if (p.sales_invoice_id) await adjustPaid('sales_invoices', p.sales_invoice_id, -amt);
  if (p.composite_task_id) await adjustPaid('composite_tasks', p.composite_task_id, -amt);
  check(await supabase.from('customer_payments').delete().eq('id', paymentId), 'حذف الدفعة');
}

/** حذف دفعة موزعة كاملة مع ما ترتب عليها */
export async function deleteDistributedPayment(groupId: string, friendCompanyId: string | null) {
  const r = await supabase.from('customer_payments').select('*').eq('distributed_payment_id', groupId);
  check(r, 'قراءة الدفعة الموزعة');
  const rows = (r.data || []) as any[];

  check(await supabase.from('expenses_withdrawals').delete().eq('distributed_payment_id', groupId), 'حذف السحوبات');

  const ep = await supabase.from('expense_payments').select('expense_id').eq('distributed_payment_id', groupId);
  check(ep, 'قراءة دفعات المصاريف');
  check(await supabase.from('expense_payments').delete().eq('distributed_payment_id', groupId), 'حذف دفعات المصاريف');
  for (const expId of [...new Set((ep.data || []).map((x: any) => x.expense_id).filter(Boolean))]) {
    const [pays, exp] = await Promise.all([
      supabase.from('expense_payments').select('amount').eq('expense_id', expId),
      supabase.from('expenses').select('amount').eq('id', expId).maybeSingle(),
    ]);
    const paid = (pays.data || []).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
    const total = Number((exp.data as any)?.amount) || 0;
    const status = paid <= 0 ? 'unpaid' : paid + 0.01 >= total ? 'paid' : 'partial';
    check(await supabase.from('expenses').update({ paid_amount: paid, payment_status: status }).eq('id', expId), 'تحديث المصروف');
  }

  const cu = await supabase.from('custody_accounts').select('id').eq('source_payment_id', groupId).eq('source_type', 'distributed_payment');
  check(cu, 'قراءة العهد');
  const custodyIds = (cu.data || []).map((x: any) => x.id);
  if (custodyIds.length) {
    check(await supabase.from('custody_transactions').delete().in('custody_account_id', custodyIds), 'حذف حركات العهد');
    check(await supabase.from('custody_expenses').delete().in('custody_account_id', custodyIds), 'حذف مصروفات العهد');
    check(await supabase.from('custody_accounts').delete().in('id', custodyIds), 'حذف العهد');
  }
  check(await supabase.from('employee_advances').delete().eq('distributed_payment_id', groupId), 'حذف السلف');

  for (const p of rows) {
    if (p.method === 'مقايضة') await refundFriendRental(friendCompanyId, Number(p.amount) || 0, p.notes || '');
  }

  // تجميع المبالغ لكل فاتورة/مهمة على حدة (إصلاح: كان يُطرح مجموع كل الفواتير من كل فاتورة)
  const sumBy = (key: string) => {
    const m = new Map<string, number>();
    rows.forEach(p => { if (p[key]) m.set(p[key], (m.get(p[key]) || 0) + (Number(p.amount) || 0)); });
    return m;
  };
  for (const p of rows.filter(r => r.printed_invoice_id)) await removePrintInvoicePaymentRecord(p.printed_invoice_id, Number(p.amount) || 0);

  check(await supabase.from('customer_payments').delete().eq('distributed_payment_id', groupId), 'حذف الدفعات');

  for (const [id, amt] of sumBy('purchase_invoice_id')) await adjustPurchaseUsed(id, -amt);
  for (const [id, amt] of sumBy('printed_invoice_id')) await adjustPaid('printed_invoices', id, -amt);
  for (const [id, amt] of sumBy('sales_invoice_id')) await adjustPaid('sales_invoices', id, -amt);
  for (const [id, amt] of sumBy('composite_task_id')) await adjustPaid('composite_tasks', id, -amt);
}

/** تعديل دفعة مفردة: المبلغ والطريقة والمرجع والتاريخ والملاحظات، مع مزامنة المدفوع في السجل المرتبط */
export async function updatePayment(paymentId: string, patch: { amount: number; method?: string | null; reference?: string | null; paid_at?: string; notes?: string | null }) {
  const r = await supabase.from('customer_payments').select('*').eq('id', paymentId).maybeSingle();
  check(r, 'قراءة الدفعة');
  const p: any = r.data;
  if (!p) throw new Error('الدفعة غير موجودة');
  if (!(patch.amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const delta = round2(patch.amount - (Number(p.amount) || 0));
  check(await supabase.from('customer_payments').update({
    amount: round2(patch.amount),
    method: patch.method ?? p.method,
    reference: patch.reference ?? p.reference,
    paid_at: patch.paid_at ?? p.paid_at,
    notes: patch.notes ?? null,
  }).eq('id', paymentId), 'حفظ الدفعة');
  if (delta !== 0) {
    if (p.purchase_invoice_id) await adjustPurchaseUsed(p.purchase_invoice_id, delta);
    if (p.printed_invoice_id) await adjustPaid('printed_invoices', p.printed_invoice_id, delta);
    if (p.sales_invoice_id) await adjustPaid('sales_invoices', p.sales_invoice_id, delta);
    if (p.composite_task_id) await adjustPaid('composite_tasks', p.composite_task_id, delta);
  }
}

export interface NewPaymentInput {
  customerId: string;
  customerName: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
}

/** دفعة على عقد واحد */
export async function addContractPayment(input: NewPaymentInput & { contractNumber: number }) {
  if (!(input.amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  check(await supabase.from('customer_payments').insert({
    customer_id: input.customerId, customer_name: input.customerName, contract_number: input.contractNumber,
    amount: round2(input.amount), method: input.method, reference: input.reference || null, notes: input.notes || null,
    paid_at: input.date, entry_type: 'receipt',
  }), 'حفظ الدفعة');
}

/** دفعة على الحساب (غير موزعة) */
export async function addAccountPayment(input: NewPaymentInput) {
  if (!(input.amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  check(await supabase.from('customer_payments').insert({
    customer_id: input.customerId, customer_name: input.customerName, contract_number: null,
    amount: round2(input.amount), method: input.method, reference: input.reference || null, notes: input.notes || null,
    paid_at: input.date, entry_type: 'account_payment',
  }), 'حفظ الدفعة');
}

/** دين سابق أو مستحق إضافي على الزبون */
export async function addDebt(input: NewPaymentInput) {
  if (!(input.amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  check(await supabase.from('customer_payments').insert({
    customer_id: input.customerId, customer_name: input.customerName, contract_number: null,
    amount: round2(input.amount), method: 'دين سابق', reference: input.reference || null, notes: input.notes || null,
    paid_at: input.date, entry_type: 'debt',
  }), 'حفظ الدين');
}

/**
 * تحصيل جماعي على عدة عقود: يوزَّع المبلغ بنسبة المتبقي لكل عقد مقرباً لقرشين،
 * والفرق الناتج عن التقريب يضاف لآخر عقد. يُدرج دفعة واحدة لكل عقد بطلب واحد.
 */
export async function addBulkContractPayment(input: NewPaymentInput & { contracts: { number: number; remaining: number }[] }) {
  if (!(input.amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const targets = input.contracts.filter(c => c.remaining > 0);
  if (!targets.length) throw new Error('العقود المحددة مسددة بالكامل');
  const totalRemaining = targets.reduce((s, c) => s + c.remaining, 0);
  let allocated = 0;
  const rows = targets.map((c, i) => {
    const share = i === targets.length - 1 ? round2(input.amount - allocated) : round2((c.remaining / totalRemaining) * input.amount);
    allocated = round2(allocated + share);
    return {
      customer_id: input.customerId, customer_name: input.customerName, contract_number: c.number,
      amount: share, method: input.method, reference: input.reference || null,
      notes: `${input.notes ? input.notes + ' ' : ''}(دفع جماعي)`, paid_at: input.date, entry_type: 'receipt',
    };
  }).filter(r => r.amount > 0);
  check(await supabase.from('customer_payments').insert(rows), 'حفظ الدفعات');
}
