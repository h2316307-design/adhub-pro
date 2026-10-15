/* eslint-disable @typescript-eslint/no-explicit-any */
// طباعة الإيصال الموحد للدفعة الموزعة — مستخرجة كما هي من النافذة القديمة دون تغيير في الحسابات
import { supabase } from '@/integrations/supabase/client';
import { compositeTaskLabel, compositeTaskGroupKey } from '@/lib/compositeTaskLabel';
import { filterCompositeRelatedPrintedInvoices } from './BillingUtils';
import type { PaymentRow } from './BillingTypes';

export async function printDistributedUnifiedReceipt(
  groupedPayments: PaymentRow[],
  customerName: string,
  totalAmount: number,
  printReceipt: (options: any) => any,
): Promise<void> {
  // ✅ استخدام نظام الطباعة الموحد الجديد (مثل كشف الحساب)
  const firstPaymentData = groupedPayments[0];
  
  // جلب بيانات العميل
  let customerData = { id: '', name: customerName, company: '', phone: '' };
  if (firstPaymentData.customer_id) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, company, phone')
      .eq('id', firstPaymentData.customer_id)
      .single();
    if (data) customerData = data;
  }

  // ✅ جلب بيانات أوامر العمل وفواتير المبيعات أولاً لتحديد كافة أرقام العقود
  const compositeTaskIds = groupedPayments
    .filter(p => p.composite_task_id)
    .map(p => p.composite_task_id as string);
  
  const salesInvoiceIds = groupedPayments
    .filter(p => p.sales_invoice_id)
    .map(p => p.sales_invoice_id as string);

  const printedInvoiceIds = groupedPayments
    .filter(p => p.printed_invoice_id)
    .map(p => p.printed_invoice_id as string);

  // جلب بيانات أوامر العمل
  const compositeTaskMap: Record<string, any> = {};
  let tasksData: any[] = [];
  if (compositeTaskIds.length > 0) {
    const { data } = await supabase
      .from('composite_tasks')
      .select('id, task_number, contract_id, task_type, customer_total, paid_amount, installation_task_id, print_task_id, cutout_task_id')
      .in('id', compositeTaskIds);
    tasksData = data || [];
  }

  // جلب بيانات أوامر التركيب المرتبطة لاستخراج رقم إعادة التركيب ونوع المهمة
  const installTaskIds = tasksData
    .map((t: any) => t.installation_task_id)
    .filter(Boolean);

  const installTaskMap: Record<string, any> = {};
  if (installTaskIds.length > 0) {
    const { data: itData, error: itErr } = await supabase
      .from('installation_tasks')
      .select('id, contract_id, task_type, reinstallation_number, team_id, installation_teams(team_name)')
      .in('id', installTaskIds);
    if (itErr) {
      console.warn('Fallback loading installation_tasks in print without join:', itErr);
      const { data: fallbackData } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, task_type, reinstallation_number, team_id')
        .in('id', installTaskIds);
      (fallbackData || []).forEach((it: any) => {
        installTaskMap[it.id] = it;
      });
    } else {
      (itData || []).forEach((it: any) => {
        installTaskMap[it.id] = it;
      });
    }
  }

  tasksData.forEach((t: any) => {
    const it = t.installation_task_id ? installTaskMap[t.installation_task_id] : null;
    const contractId = t.contract_id || it?.contract_id || null;
    const taskType = it?.task_type || t.task_type;
    const reinstallationNumber = it?.reinstallation_number ?? (taskType === 'reinstallation' ? 1 : null);
    const remaining = (Number(t.customer_total) || 0) - (Number(t.paid_amount) || 0);

    compositeTaskMap[t.id] = {
      ...t,
      contract_id: contractId,
      task_type: taskType,
      reinstallation_number: reinstallationNumber,
      team_name: it?.installation_teams?.team_name || null,
      calculatedRemaining: Math.max(0, remaining),
    };
  });

  // جلب أرقام كافة العقود (سواء من الدفعات المباشرة أو أوامر العمل)
  const contractNumbers = Array.from(new Set([
    ...groupedPayments.map(p => p.contract_number),
    ...Object.values(compositeTaskMap).map((t: any) => t.contract_id),
  ].filter(Boolean).map(v => Number(v)).filter(n => !Number.isNaN(n))));

  const contractMap: Record<number, any> = {};
  if (contractNumbers.length > 0) {
    const { data: contractsData, error: contractsError } = await supabase
      .from('Contract')
      .select('Contract_Number, "Ad Type", Total, "Total Paid"')
      .in('Contract_Number', contractNumbers);
    if (contractsError) throw contractsError;
    
    // جلب المدفوعات لهذه العقود لحساب المتبقي الصحيح
    const { data: allPayments } = await supabase
      .from('customer_payments')
      .select('contract_number, amount, entry_type')
      .in('contract_number', contractNumbers);
    
    // حساب إجمالي المدفوع لكل عقد
    const paidByContract: Record<number, number> = {};
    (allPayments || []).forEach((p: any) => {
      const cn = Number(p.contract_number);
      if (!paidByContract[cn]) paidByContract[cn] = 0;
      if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment') {
        paidByContract[cn] += Number(p.amount) || 0;
      }
    });
    
    (contractsData || []).forEach((c: any) => {
      const cn = c.Contract_Number;
      const total = Number(c.Total) || 0;
      const paid = paidByContract[cn] || 0;
      const remaining = Math.max(0, total - paid);
      contractMap[cn] = { ...c, calculatedRemaining: remaining, calculatedPaid: paid };
    });
  }

  // جلب بيانات فواتير المبيعات
  const salesInvoiceMap: Record<string, any> = {};
  if (salesInvoiceIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, invoice_name, total_amount, paid_amount, notes')
      .in('id', salesInvoiceIds);
    (invoicesData || []).forEach((i: any) => {
      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
      salesInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
    });
  }

  // جلب بيانات فواتير الطباعة
  const printedInvoiceMap: Record<string, any> = {};
  if (printedInvoiceIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from('printed_invoices')
      .select('id, invoice_number, total_amount, paid_amount, notes')
      .in('id', printedInvoiceIds);
    (invoicesData || []).forEach((i: any) => {
      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
      printedInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
    });
  }

  const distributedContracts = groupedPayments.map((p) => {
    // تحديد نوع الدفعة
    if (p.composite_task_id) {
      const task = compositeTaskMap[p.composite_task_id];
      const contract = task?.contract_id ? contractMap[Number(task.contract_id)] : null;
      const rawAdType = contract?.['Ad Type'] || '';
      const adTypeClean = rawAdType && rawAdType !== 'لوحة إعلانية' ? rawAdType.trim() : '';

      // بناء وصف مكونات المهمة بناءً على المكونات الفعلية
      const components: string[] = [];
      if (task?.print_task_id) components.push('طباعة');
      if (task?.cutout_task_id) components.push('قص');
      if (task?.installation_task_id) components.push('تركيب');
      const taskComponents = components.length > 0 ? components.join(' + ') : 'أمر عمل';

      // وصف البيان: نوع الإعلان + مكونات الخدمة (بدون أسماء الفرق في الفاتورة للزبون)
      let finalDescription = taskComponents;
      if (adTypeClean) {
        if (adTypeClean.includes('طباعة') || adTypeClean.includes('تركيب')) {
          finalDescription = adTypeClean;
        } else {
          finalDescription = `${adTypeClean} (${taskComponents})`;
        }
      }

      const taskIdentity = {
        id: task?.id || p.composite_task_id,
        task_number: task?.task_number,
        contract_id: task?.contract_id,
        task_type: task?.task_type,
        reinstallation_number: task?.reinstallation_number,
        installation_task_id: task?.installation_task_id,
        team_name: task?.team_name,
        remaining: task?.calculatedRemaining,
        total: task?.customer_total,
      };

      const groupKey = compositeTaskGroupKey(taskIdentity);
      const refLabel = compositeTaskLabel(taskIdentity);

      return {
        contractNumber: refLabel,
        compositeTaskId: p.composite_task_id,
        installationTaskId: task?.installation_task_id,
        adType: finalDescription,
        rawAdType: adTypeClean || undefined,
        taskComponents,
        teamName: task?.team_name || undefined,
        contractId: task?.contract_id ? Number(task.contract_id) : undefined,
        reinstallationNumber: task?.reinstallation_number ? Number(task.reinstallation_number) : undefined,
        amount: Number(p.amount) || 0,
        total: task?.customer_total ?? null,
        totalPaid: task?.paid_amount ?? null,
        remaining: task?.calculatedRemaining ?? null,
        entityType: 'composite_task' as const,
        compositeTaskType: finalDescription,
        groupKey,
      };
    }
    
    if (p.sales_invoice_id) {
      const invoice = salesInvoiceMap[p.sales_invoice_id];
      return {
        contractNumber: invoice?.invoice_number ? (String(invoice.invoice_number).startsWith('فاتورة') ? String(invoice.invoice_number) : `فاتورة مبيعات #${invoice.invoice_number}`) : 'فاتورة مبيعات',
        adType: invoice?.invoice_name || invoice?.notes || 'مبيعات',
        amount: Number(p.amount) || 0,
        total: invoice?.total_amount ?? null,
        totalPaid: invoice?.paid_amount ?? null,
        remaining: invoice?.calculatedRemaining ?? null,
        entityType: 'sales_invoice' as const,
      };
    }

    if (p.printed_invoice_id) {
      const invoice = printedInvoiceMap[p.printed_invoice_id];
      return {
        contractNumber: invoice?.invoice_number ? (String(invoice.invoice_number).startsWith('فاتورة') ? String(invoice.invoice_number) : `فاتورة طباعة #${invoice.invoice_number}`) : 'فاتورة طباعة',
        adType: invoice?.notes || 'طباعة',
        amount: Number(p.amount) || 0,
        total: invoice?.total_amount ?? null,
        totalPaid: invoice?.paid_amount ?? null,
        remaining: invoice?.calculatedRemaining ?? null,
        entityType: 'printed_invoice' as const,
      };
    }

    // رصيد فائض (غير موزع)
    if (!p.contract_number && !p.composite_task_id && !p.sales_invoice_id && !p.printed_invoice_id) {
      return {
        contractNumber: 'رصيد فائض (غير موزع)',
        adType: p.notes?.replace(/^توزيع على.*?- /g, '') || 'فائض سداد متبقي في حساب العميل',
        amount: Number(p.amount) || 0,
        total: null,
        totalPaid: null,
        remaining: null,
        entityType: 'general_credit' as const,
      };
    }
    
    // Default: عقد
    const cn = p.contract_number ? Number(p.contract_number) : null;
    const c = cn ? contractMap[cn] : null;
    return {
      contractNumber: String(p.contract_number || '—'),
      contractId: cn || undefined,
      adType: c?.['Ad Type'] || 'لوحة إعلانية',
      amount: Number(p.amount) || 0,
      total: c?.Total ?? null,
      totalPaid: c?.calculatedPaid ?? null,
      remaining: c?.calculatedRemaining ?? null,
      entityType: 'contract' as const,
    };
  });

  // ✅ حساب المتبقي الإجمالي للعميل بنفس منطق صفحة العميل (بدون فلترة تاريخية)
  let remainingDebt: number | undefined = undefined;
  
  if (customerData.id) {
    const { calculateCustomerFinancials } = await import('@/hooks/useCustomerFinancials');
    
    // جلب كل البيانات الحالية (مطابق لـ useCustomerFinancials)
    const [contractsRes, paymentsRes, salesRes, printedRes, purchaseRes, discountsRes, compositeRes, printTasksRes, cutoutTasksRes, customerRes] = await Promise.all([
      supabase.from('Contract').select('*').eq('customer_id', customerData.id),
      supabase.from('customer_payments').select('*').eq('customer_id', customerData.id),
      supabase.from('sales_invoices').select('*').eq('customer_id', customerData.id),
      supabase.from('printed_invoices').select('*').eq('customer_id', customerData.id),
      supabase.from('purchase_invoices').select('*').eq('customer_id', customerData.id),
      supabase.from('customer_general_discounts').select('*').eq('customer_id', customerData.id).eq('status', 'active'),
      supabase.from('composite_tasks').select('*').eq('customer_id', customerData.id),
      supabase.from('print_tasks').select('id, invoice_id, is_composite, installation_task_id, composite_task_id').eq('customer_id', customerData.id),
      supabase.from('cutout_tasks').select('id, invoice_id, is_composite, installation_task_id').eq('customer_id', customerData.id),
      supabase.from('customers').select('linked_friend_company_id').eq('id', customerData.id).maybeSingle()
    ]);
    
    const contracts = contractsRes.data || [];
    
    // حساب إيجارات الشركات الصديقة بنفس مفتاح useCustomerFinancials (فقط إذا كان العميل مرتبك بشركة صديقة)
    let friendRentalTotal = 0;
    if (customerRes.data?.linked_friend_company_id) {
      for (const contract of contracts) {
        const friendData = (contract as any).friend_rental_data;
        if (friendData && typeof friendData === 'object') {
          const entries = Array.isArray(friendData) ? friendData : Object.values(friendData);
          for (const entry of entries as any[]) {
            if (entry && typeof entry.rental_cost === 'number') {
              friendRentalTotal += entry.rental_cost;
            } else if (entry && typeof entry.friendRentalCost === 'number') {
              friendRentalTotal += entry.friendRentalCost;
            } else if (entry && typeof entry.friend_rental_cost === 'number') {
              friendRentalTotal += entry.friend_rental_cost;
            }
          }
        }
      }
    }
    
    const financials = calculateCustomerFinancials(
      contracts,
      paymentsRes.data || [],
      salesRes.data || [],
      filterCompositeRelatedPrintedInvoices(printedRes.data || [], compositeRes.data || [], printTasksRes.data || [], cutoutTasksRes?.data || []),
      purchaseRes.data || [],
      discountsRes.data || [],
      compositeRes.data || [],
      friendRentalTotal
    );
    
    remainingDebt = financials.remainingDebt;
  } else if (typeof firstPaymentData.remaining_debt === 'number') {
    remainingDebt = firstPaymentData.remaining_debt;
  }

  // ✅ بناء "مصدر المقايضة": عنوان فاتورة المشتريات أو نوع إعلان العقد المُستخدم
  let barterSource = '';
  try {
    const isBarter = (m?: string | null) =>
      !!m && (m.includes('مقايضة') || m === 'barter');

    // 1) فواتير المشتريات المستخدمة في المقايضة
    const purchaseIds = Array.from(new Set(
      groupedPayments
        .filter(p => (p as any).purchase_invoice_id)
        .map(p => String((p as any).purchase_invoice_id))
    ));
    const purchaseTitles: string[] = [];
    if (purchaseIds.length > 0) {
      const { data: piData } = await supabase
        .from('purchase_invoices')
        .select('id, invoice_number, invoice_name')
        .in('id', purchaseIds);
      (piData || []).forEach((pi: any) => {
        const title = (pi.invoice_name && String(pi.invoice_name).trim())
          || (pi.invoice_number ? `#${pi.invoice_number}` : '');
        if (title) purchaseTitles.push(`فاتورة مشتريات: ${title}`);
      });
    }

    // 2) لوحات عقد مستخدمة كمقايضة إيجار → نوع إعلان العقد المصدر
    // المصدر يُحفظ ضمن الملاحظات بصيغة "مقايضة من إيجار لوحة: <الاسم>"
    // نستخرج اسم اللوحة ونبحث عن نوع إعلان العقد المرتبط بها
    const rentalPayments = groupedPayments.filter(
      p => isBarter(p.method) && (p as any).purchase_invoice_id == null
    );
    const billboardNames = Array.from(new Set(
      rentalPayments
        .map(p => {
          const m = (p.notes || '').match(/لوحة[:\s]+([^\n،,•]+)/);
          return m ? m[1].trim() : '';
        })
        .filter(Boolean)
    ));
    const rentalSources: string[] = [];
    if (billboardNames.length > 0) {
      const { data: bbs } = await supabase
        .from('billboards')
        .select('Billboard_Name, Contract_Number')
        .in('Billboard_Name', billboardNames);
      const contractNums = Array.from(new Set(
        (bbs || [])
          .map((b: any) => Number(b.Contract_Number))
          .filter((n: number) => !!n && !Number.isNaN(n))
      ));
      const adTypeByContract: Record<number, string> = {};
      if (contractNums.length > 0) {
        const { data: srcContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type"')
          .in('Contract_Number', contractNums);
        (srcContracts || []).forEach((c: any) => {
          adTypeByContract[Number(c.Contract_Number)] = c['Ad Type'] || '';
        });
      }
      // اجمع لكل عقد مصدر: "عقد X - <نوع الإعلان>"
      const labelSet = new Set<string>();
      (bbs || []).forEach((b: any) => {
        const cn = Number(b.Contract_Number);
        if (!cn) return;
        const adType = adTypeByContract[cn];
        labelSet.add(
          adType
            ? `لوحات عقد ${cn} - ${adType}`
            : `لوحات عقد ${cn}`
        );
      });
      rentalSources.push(...labelSet);
      // fallback إذا لم نتمكّن من الربط
      if (rentalSources.length === 0) {
        rentalSources.push(...billboardNames.map(n => `لوحة: ${n}`));
      }
    } else {
      // لا توجد لوحات مُستخرجة، نستخدم الملاحظات كما هي
      rentalSources.push(
        ...Array.from(new Set(
          rentalPayments.map(p => (p.notes || '').trim()).filter(Boolean)
        ))
      );
    }

    const parts = [...purchaseTitles, ...rentalSources];
    barterSource = parts.join(' • ');
  } catch (e) {
    console.warn('barter_source build failed:', e);
  }

  await printReceipt({
    payment: {
      id: firstPaymentData.id,
      amount: totalAmount,
      paid_at: firstPaymentData.paid_at,
      method: firstPaymentData.method || 'نقدي',
      reference: firstPaymentData.reference || undefined,
      notes: firstPaymentData.notes || undefined,
      contract_number: null,
      collector_name: firstPaymentData.collector_name || undefined,
      receiver_name: firstPaymentData.receiver_name || undefined,
      delivery_location: firstPaymentData.delivery_location || undefined,
      source_bank: firstPaymentData.source_bank || undefined,
      destination_bank: firstPaymentData.destination_bank || undefined,
      transfer_reference: firstPaymentData.transfer_reference || undefined,
      transfer_image_url: firstPaymentData.transfer_image_url || undefined,
      distributed_payment_id: firstPaymentData.distributed_payment_id || undefined,
      barter_source: barterSource || undefined,
    },
    customerData: {
      id: customerData.id,
      name: customerData.name,
      company: customerData.company || undefined,
      phone: customerData.phone || undefined,
    },
    currency: {
      code: 'LYD',
      symbol: 'د.ل',
      name: 'دينار ليبي',
      writtenName: 'دينار ليبي',
    },
    distributedContracts,
    ...(typeof remainingDebt === 'number'
      ? { balanceInfo: { remainingBalance: remainingDebt, totalPaid: 0 } }
      : {}),
  });
}
