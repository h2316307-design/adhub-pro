import { supabase } from '@/integrations/supabase/client';
import type { DistributableItem } from '@/components/billing/distribute-payment/types';
import { operationKeyOf } from '@/lib/compositeCosts';
import { getOperationLabel } from '@/lib/compositeTaskOperation';
import { filterCompositeRelatedPrintedInvoices } from '@/lib/canonicalCustomerLedger';

/** نفس تعريف «المدفوع» في دالة الحفظ save_payment_distribution */
const PAID_TYPES = ['payment', 'receipt', 'account_payment'];
const m = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export interface DistTarget extends DistributableItem {
  key: string;
  date: string;
  subtitle?: string;
}

/**
 * كل المستحقات المفتوحة للزبون (عقود، فواتير طباعة، فواتير مبيعات، عمليات مجمعة)
 * مع إعادة مبالغ الدفعة الجاري تعديلها إلى المتبقي.
 */
export async function loadDistributionTargets(customerId: string, editingPayments: any[] = []): Promise<DistTarget[]> {
  const [contractsR, printedR, salesR, compositeR, paymentsR, printTasksR, cutoutTasksR] = await Promise.all([
    supabase.from('Contract').select('"Contract_Number", "Total", "Ad Type", "Contract Date", "End Date"').eq('customer_id', customerId),
    supabase.from('printed_invoices').select('id, invoice_number, total_amount, created_at, invoice_date, invoice_type').eq('customer_id', customerId),
    supabase.from('sales_invoices').select('id, invoice_number, total_amount, invoice_date, created_at').eq('customer_id', customerId),
    supabase.from('composite_tasks').select('id, contract_id, task_type, customer_total, created_at, installation_task_id, task_number, print_task_id, cutout_task_id, combined_invoice_id').eq('customer_id', customerId),
    supabase.from('customer_payments').select('id, amount, entry_type, contract_number, printed_invoice_id, sales_invoice_id, composite_task_id').eq('customer_id', customerId),
    supabase.from('print_tasks').select('id, invoice_id, composite_task_id, is_composite, installation_task_id').eq('customer_id', customerId),
    supabase.from('cutout_tasks').select('id, invoice_id, is_composite, installation_task_id').eq('customer_id', customerId),
  ]);
  for (const r of [contractsR, printedR, salesR, compositeR, paymentsR]) if (r.error) throw new Error(r.error.message);

  const editingIds = new Set(editingPayments.map(p => String(p.id)));
  const paid = (field: string, id: string | number) => m((paymentsR.data || [])
    .filter((p: any) => PAID_TYPES.includes(p.entry_type) && p[field] != null && String(p[field]) === String(id) && !editingIds.has(String(p.id)))
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
  const editing = (field: string, ids: (string | number)[]) => {
    const set = new Set(ids.map(String));
    return m(editingPayments.filter(p => p[field] != null && set.has(String(p[field]))).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  };

  const out: DistTarget[] = [];
  for (const c of (contractsR.data || []) as any[]) {
    const total = m(Number(c.Total) || 0);
    const p = paid('contract_number', c.Contract_Number);
    const alloc = editing('contract_number', [c.Contract_Number]);
    const remaining = m(total - p);
    if (remaining <= 0.009 && alloc <= 0) continue;
    out.push({
      key: `contract:${c.Contract_Number}`, id: Number(c.Contract_Number), type: 'contract',
      displayName: `عقد #${c.Contract_Number}`, adType: c['Ad Type'] || undefined, contractNumber: Number(c.Contract_Number),
      subtitle: [c['Ad Type'], c['Contract Date'] && c['End Date'] ? `${c['Contract Date']} ← ${c['End Date']}` : ''].filter(Boolean).join(' · '),
      totalAmount: total, paidAmount: p, remainingAmount: Math.max(0, remaining),
      selected: alloc > 0, allocatedAmount: alloc, date: String(c['Contract Date'] || ''),
    });
  }
  // نفس تصفية كشف الحساب: فواتير طباعة أوامر العمل ليست ديناً مستقلاً
  const billablePrinted = filterCompositeRelatedPrintedInvoices(printedR.data || [], compositeR.data || [], printTasksR.data || [], cutoutTasksR.data || []);
  for (const i of billablePrinted as any[]) {
    const total = m(Number(i.total_amount) || 0);
    const p = paid('printed_invoice_id', i.id);
    const alloc = editing('printed_invoice_id', [i.id]);
    const remaining = m(total - p);
    if (remaining <= 0.009 && alloc <= 0) continue;
    out.push({
      key: `printed:${i.id}`, id: i.id, type: 'printed_invoice', displayName: `فاتورة طباعة ${i.invoice_number || ''}`.trim(),
      totalAmount: total, paidAmount: p, remainingAmount: Math.max(0, remaining), selected: alloc > 0, allocatedAmount: alloc,
      date: String(i.invoice_date || i.created_at || ''), subtitle: String(i.invoice_date || i.created_at || '').slice(0, 10),
    });
  }
  for (const i of (salesR.data || []) as any[]) {
    const total = m(Number(i.total_amount) || 0);
    const p = paid('sales_invoice_id', i.id);
    const alloc = editing('sales_invoice_id', [i.id]);
    const remaining = m(total - p);
    if (remaining <= 0.009 && alloc <= 0) continue;
    out.push({
      key: `sales:${i.id}`, id: i.id, type: 'sales_invoice', displayName: `فاتورة مبيعات ${i.invoice_number || ''}`.trim(),
      totalAmount: total, paidAmount: p, remainingAmount: Math.max(0, remaining), selected: alloc > 0, allocatedAmount: alloc,
      date: String(i.invoice_date || i.created_at || ''), subtitle: String(i.invoice_date || i.created_at || '').slice(0, 10),
    });
  }

  // العمليات المجمعة: بند واحد لكل عملية، ويُوزَّع داخلياً على صفوف الفرق حسب متبقي كل صف
  const comps = ((compositeR.data || []) as any[]).filter(t => Number(t.customer_total) > 0);
  const installIds = comps.map(t => t.installation_task_id).filter(Boolean);
  const { data: installs } = installIds.length
    ? await supabase.from('installation_tasks').select('id, contract_id, contract_ids, reinstallation_number, task_type, installation_teams(team_name)').in('id', installIds)
    : { data: [] as any[] };
  const iMap = new Map((installs || []).map((i: any) => [i.id, i]));
  const groups = new Map<string, any[]>();
  for (const t of comps) {
    const it: any = iMap.get(t.installation_task_id);
    const row = { ...t, contract_ids: it?.contract_ids || [], reinstallation_number: it?.reinstallation_number ?? null, reinstallationNumber: it?.reinstallation_number ?? null, teamName: it?.installation_teams?.team_name };
    const k = operationKeyOf(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  for (const [k, list] of groups) {
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const subTasks = list.map(t => {
      const total = m(Number(t.customer_total) || 0);
      const p = paid('composite_task_id', t.id);
      const ed = editing('composite_task_id', [t.id]);
      return { id: t.id, total, paid: p, remaining: Math.max(0, m(total - p)), editingAmount: ed, teamName: t.teamName };
    });
    const total = m(subTasks.reduce((s, x) => s + x.total, 0));
    const p = m(subTasks.reduce((s, x) => s + x.paid, 0));
    const remaining = m(subTasks.reduce((s, x) => s + x.remaining, 0));
    const alloc = m(subTasks.reduce((s, x) => s + (x.editingAmount || 0), 0));
    if (remaining <= 0.009 && alloc <= 0) continue;
    const first = list[0];
    const contracts = [...new Set(list.flatMap(t => [t.contract_id, ...(t.contract_ids || [])]).map(Number).filter(Boolean))];
    out.push({
      key: `composite:${k}`, id: first.id, type: 'composite_task',
      displayName: getOperationLabel({ ...first, contractIds: contracts }),
      subtitle: `${contracts.map(n => '#' + n).join('، ')} · ${[...new Set(list.map(t => t.teamName).filter(Boolean))].join('، ')}`,
      contractNumber: first.contract_id, totalAmount: total, paidAmount: p, remainingAmount: remaining,
      selected: alloc > 0, allocatedAmount: alloc, date: String(first.created_at || ''), subTasks, groupKey: k,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** هل لهذه الدفعة الموزعة توزيعات جانبية (موظفين/عهد/مصاريف)؟ */
export async function hasSideDistributions(groupId: string): Promise<boolean> {
  const checks = await Promise.all([
    supabase.from('employee_advances').select('id', { count: 'exact', head: true }).eq('distributed_payment_id', groupId),
    supabase.from('custody_accounts').select('id', { count: 'exact', head: true }).eq('source_payment_id', groupId),
    supabase.from('expense_payments').select('id', { count: 'exact', head: true }).eq('distributed_payment_id', groupId),
    supabase.from('expenses_withdrawals').select('id', { count: 'exact', head: true }).eq('distributed_payment_id', groupId),
    supabase.from('installation_team_accounts').select('id', { count: 'exact', head: true }).eq('distributed_payment_id', groupId),
  ]);
  return checks.some(r => (r.count || 0) > 0);
}

/* ───────────── التوزيعات الإضافية: سلف، سحب مستحقات، عهد، سداد مصاريف ───────────── */
export interface SideEmployee { id: string; name: string; teamId: string | null; operating: boolean; teamName?: string | null }
export interface SideBalance { employeeId: string; teamId: string | null; teamName: string | null; pendingAmount: number }
export interface SideExpense { id: string; description: string; remaining: number; employeeId?: string | null; employeeName?: string; date?: string; category?: string }
export interface SideData {
  employees: SideEmployee[];
  balances: SideBalance[];
  expenses: SideExpense[];
  existing: {
    employees: { employeeId: string; amount: number; paymentType: 'advance' | 'from_balance' }[];
    custody: { employeeId: string; amount: number }[];
    expenses: { expense_id: string; amount: number }[];
  };
}

/**
 * الأرصدة تُحسب كما تتحقق منها دالة الحفظ في القاعدة:
 * - فريق التركيب: مجموع حساباته المعلقة (+ ما سُدد من هذه الدفعة عند التعديل).
 * - مستحقات التشغيل: available_operating_balance() (+ سحوبات هذه الدفعة عند التعديل).
 */
export async function loadSideData(groupId: string | null): Promise<SideData> {
  const [empR, teamsR, opR, expR] = await Promise.all([
    supabase.from('employees').select('id, name, installation_team_id, linked_to_operating_expenses, status').eq('status', 'active').order('name'),
    supabase.from('installation_teams').select('id, team_name'),
    (supabase as any).rpc('available_operating_balance'),
    supabase.from('expenses').select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date').neq('payment_status', 'paid').order('expense_date', { ascending: false }),
  ]);
  if (empR.error) throw new Error(empR.error.message);
  const teamName = new Map((teamsR.data || []).map((t: any) => [t.id, t.team_name]));
  const employees: SideEmployee[] = (empR.data || []).map((e: any) => ({ id: e.id, name: e.name, teamId: e.installation_team_id || null, operating: !!e.linked_to_operating_expenses && !e.installation_team_id, teamName: e.installation_team_id ? teamName.get(e.installation_team_id) || null : null }));

  const existing: SideData['existing'] = { employees: [], custody: [], expenses: [] };
  let groupWithdrawals = 0;
  const groupTeam = new Map<string, number>();
  if (groupId) {
    const [adv, wd, team, cus, exp] = await Promise.all([
      supabase.from('employee_advances').select('employee_id, amount').eq('distributed_payment_id', groupId),
      supabase.from('expenses_withdrawals').select('receiver_name, amount').eq('distributed_payment_id', groupId),
      (supabase as any).from('installation_team_accounts').select('team_id, amount').eq('distributed_payment_id', groupId),
      supabase.from('custody_accounts').select('employee_id, initial_amount').eq('source_payment_id', groupId).eq('source_type', 'distributed_payment'),
      supabase.from('expense_payments').select('expense_id, amount').eq('distributed_payment_id', groupId),
    ]);
    (adv.data || []).forEach((a: any) => existing.employees.push({ employeeId: a.employee_id, amount: Number(a.amount) || 0, paymentType: 'advance' }));
    for (const w of (wd.data || []) as any[]) {
      groupWithdrawals += Number(w.amount) || 0;
      const cands = employees.filter(e => e.operating && (!w.receiver_name || e.name === w.receiver_name));
      if (cands.length !== 1) throw new Error('تعذر تحديد مستلم سحب مستحقات التشغيل في هذه الدفعة؛ راجع اسم المستلم');
      existing.employees.push({ employeeId: cands[0].id, amount: Number(w.amount) || 0, paymentType: 'from_balance' });
    }
    for (const t of (team.data || []) as any[]) groupTeam.set(t.team_id, (groupTeam.get(t.team_id) || 0) + (Number(t.amount) || 0));
    for (const [teamId, amount] of groupTeam) {
      const cands = employees.filter(e => e.teamId === teamId);
      if (cands.length !== 1) throw new Error('تعذر تحديد موظف فريق التركيب المرتبط بهذه الدفعة');
      existing.employees.push({ employeeId: cands[0].id, amount: m(amount), paymentType: 'from_balance' });
    }
    (cus.data || []).forEach((c: any) => existing.custody.push({ employeeId: c.employee_id, amount: Number(c.initial_amount) || 0 }));
    (exp.data || []).forEach((p: any) => existing.expenses.push({ expense_id: p.expense_id, amount: Number(p.amount) || 0 }));
  }

  // أرصدة الفرق
  const teamIds = [...new Set(employees.map(e => e.teamId).filter(Boolean))] as string[];
  const teamPending = new Map<string, number>();
  if (teamIds.length) {
    const { data, error } = await (supabase as any).from('installation_team_accounts').select('team_id, amount').in('team_id', teamIds).eq('status', 'pending');
    if (error) throw new Error(error.message);
    (data || []).forEach((r: any) => teamPending.set(r.team_id, (teamPending.get(r.team_id) || 0) + (Number(r.amount) || 0)));
  }
  const operating = m(Math.max(0, (Number(opR.data) || 0) + groupWithdrawals));
  const balances: SideBalance[] = employees.filter(e => e.teamId || e.operating).map(e => e.teamId
    ? { employeeId: e.id, teamId: e.teamId, teamName: e.teamName || 'فريق التركيب', pendingAmount: m((teamPending.get(e.teamId) || 0) + (groupTeam.get(e.teamId) || 0)) }
    : { employeeId: e.id, teamId: null, teamName: 'مصروفات التشغيل', pendingAmount: operating });

  // المصروفات غير المسددة (+ مصروفات هذه الدفعة)
  let expRows = (expR.data || []) as any[];
  const missing = existing.expenses.map(x => x.expense_id).filter(id => !expRows.some(e => e.id === id));
  if (missing.length) {
    const { data } = await supabase.from('expenses').select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date').in('id', missing);
    expRows = [...expRows, ...(data || [])];
  }
  const empName = new Map(employees.map(e => [e.id, e.name]));
  const expenses: SideExpense[] = expRows.map(e => {
    const editing = existing.expenses.filter(x => x.expense_id === e.id).reduce((s, x) => s + x.amount, 0);
    return { id: e.id, description: e.description || 'مصروف', remaining: m(Math.max(0, (Number(e.amount) || 0) - (Number(e.paid_amount) || 0)) + editing), employeeId: e.employee_id || null, employeeName: e.employee_id ? empName.get(e.employee_id) : undefined, date: e.expense_date, category: e.category };
  }).filter(e => e.remaining > 0);

  return { employees, balances, expenses, existing };
}
