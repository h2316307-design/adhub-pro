import { supabase } from '@/integrations/supabase/client';
import type { RawCustomerFinancialSources } from '@/lib/canonicalCustomerLedger';
import { loadInstallationOperationIds } from '@/services/installationOperation';

/** كل بيانات حساب الزبون في دفعة واحدة متوازية — مصدر واحد للصفحة والكشف والملخص */
export interface CustomerAccountData {
  customer: any;
  friendCompanyName: string | null;
  contracts: any[];
  payments: any[];
  salesInvoices: any[];
  printedInvoices: any[];
  purchaseInvoices: any[];
  generalDiscounts: any[];
  compositeTasks: any[];
  printTasks: any[];
  cutoutTasks: any[];
  pausedBillboards: any[];
  friendRentals: any[];
  extraContracts: any[];
  ledgerSources: RawCustomerFinancialSources;
}

const must = <T,>(res: { data: T | null; error: any }, label: string): T => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return (res.data ?? []) as T;
};

export async function resolveCustomerId(id: string | null, name: string | null): Promise<string | null> {
  if (id) return id;
  if (!name) return null;
  // مطابقة تامة للاسم فقط — لا مطابقة جزئية حتى لا تُدمج بيانات زبون آخر
  const { data } = await supabase.from('customers').select('id').eq('name', name.trim()).limit(2);
  return data && data.length === 1 ? data[0].id : null;
}

export async function loadCustomerAccount(customerId: string): Promise<CustomerAccountData> {
  const customerRes = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
  if (customerRes.error) throw new Error(customerRes.error.message);
  const customer = customerRes.data;
  if (!customer) throw new Error('الزبون غير موجود');
  const friendId = customer.linked_friend_company_id || null;

  const [contractsR, paymentsR, salesR, printedR, purchaseR, discountsR, compositeR, printTasksR, cutoutTasksR, friendR, friendCoR] = await Promise.all([
    supabase.from('Contract').select('*').eq('customer_id', customerId).order('Contract_Number', { ascending: false }),
    supabase.from('customer_payments').select('*').eq('customer_id', customerId).order('paid_at', { ascending: true }),
    supabase.from('sales_invoices').select('*').eq('customer_id', customerId).order('invoice_date', { ascending: false }),
    supabase.from('printed_invoices').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    supabase.from('purchase_invoices').select('*').eq('customer_id', customerId).order('invoice_date', { ascending: false }),
    supabase.from('customer_general_discounts').select('*').eq('customer_id', customerId),
    supabase.from('composite_tasks').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    supabase.from('print_tasks').select('*').eq('customer_id', customerId),
    supabase.from('cutout_tasks').select('*').eq('customer_id', customerId),
    friendId
      ? supabase.from('friend_billboard_rentals')
          .select('*, billboards:billboard_id(ID, Billboard_Name, Size, Municipality, Faces_Count, Image_URL, Nearest_Landmark, design_face_a, design_face_b, Ad_Type, District)')
          .eq('friend_company_id', friendId).order('start_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    friendId ? supabase.from('friend_companies').select('name').eq('id', friendId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const contracts = must<any[]>(contractsR as any, 'العقود');
  const contractNumbers = contracts.map(c => Number(c.Contract_Number)).filter(Boolean);
  const friendRentals = must<any[]>(friendR as any, 'إيجارات الشركة الصديقة');
  const rawComposite = must<any[]>(compositeR as any, 'أوامر العمل');

  // بيانات تابعة تعتمد على النتائج أعلاه (متوازية أيضاً)
  const extraNums = [...new Set(friendRentals.map(r => Number(r.contract_number)).filter(n => n && !contractNumbers.includes(n)))];
  const installIds = rawComposite.map(t => t.installation_task_id).filter(Boolean);
  const [pausedR, extraR, installR, operationIds] = await Promise.all([
    contractNumbers.length
      ? supabase.from('paused_billboards' as any).select('*').in('contract_number', contractNumbers)
      : Promise.resolve({ data: [], error: null }),
    extraNums.length ? supabase.from('Contract').select('*').in('Contract_Number', extraNums) : Promise.resolve({ data: [], error: null }),
    installIds.length
      ? supabase.from('installation_tasks').select('id, contract_id, contract_ids, reinstallation_number, task_type, team_id, installation_teams(team_name)').in('id', installIds)
      : Promise.resolve({ data: [], error: null }),
    installIds.length ? loadInstallationOperationIds().catch(() => ({} as Record<string, string>)) : Promise.resolve({} as Record<string, string>),
  ]);

  const installMap = new Map<string, any>((installR.data || []).map((it: any) => [it.id, it]));
  const compositeTasks = rawComposite.map(t => {
    const it = t.installation_task_id ? installMap.get(t.installation_task_id) : null;
    return {
      ...t,
      reinstallation_number: it?.reinstallation_number ?? t.reinstallation_number ?? null,
      operation_id: t.installation_task_id ? (operationIds as Record<string, string>)[t.installation_task_id] || null : null,
      contract_ids: [...new Set([t.contract_id, it?.contract_id, ...((it?.contract_ids as number[]) || [])].map(Number).filter(Boolean))],
      task_type: it?.task_type ?? t.task_type,
      team_name: it?.installation_teams?.team_name ?? t.team_name ?? null,
    };
  });

  const payments = must<any[]>(paymentsR as any, 'الدفعات');
  const salesInvoices = must<any[]>(salesR as any, 'فواتير المبيعات');
  const printedInvoices = must<any[]>(printedR as any, 'فواتير الطباعة');
  const purchaseInvoices = must<any[]>(purchaseR as any, 'فواتير المشتريات');
  const generalDiscounts = must<any[]>(discountsR as any, 'الخصومات');
  const printTasks = must<any[]>(printTasksR as any, 'مهام الطباعة');
  const cutoutTasks = must<any[]>(cutoutTasksR as any, 'مهام القص');
  const pausedBillboards = ((pausedR.data || []) as any[]).filter(p => p.lifecycle_state !== 'cancelled');
  const extraContracts = (extraR.data || []) as any[];
  const friendCompanyName = (friendCoR.data as any)?.name || null;

  return {
    customer, friendCompanyName, contracts, payments, salesInvoices, printedInvoices, purchaseInvoices,
    generalDiscounts, compositeTasks, printTasks, cutoutTasks, pausedBillboards, friendRentals, extraContracts,
    ledgerSources: {
      contracts,
      allContracts: [...contracts, ...extraContracts],
      payments,
      salesInvoices,
      printedInvoices,
      purchaseInvoices,
      generalDiscounts: generalDiscounts.filter(d => d.status === 'active'),
      compositeTasks,
      printTasks,
      cutoutTasks,
      pausedBillboards,
      friendBillboardRentals: friendRentals,
      linkedFriendCompanyName: friendCompanyName,
    },
  };
}

/** أنواع الحركات النقدية التي تُعدّ سداداً */
export const CASH_TYPES = new Set(['receipt', 'payment', 'account_payment']);

/** المدفوع على عقد: دفعات نقدية مرتبطة بالعقد وليست لأمر عمل أو فاتورة */
export function contractPaid(payments: any[], contractNumber: number | string): number {
  return payments
    .filter(p => CASH_TYPES.has(p.entry_type) && String(p.contract_number ?? '') === String(contractNumber)
      && !p.composite_task_id && !p.sales_invoice_id && !p.printed_invoice_id)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
