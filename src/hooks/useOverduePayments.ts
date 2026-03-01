import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
}

interface CustomerOverdueInfo {
  hasOverdue: boolean;
  oldestDueDate: string | null;
  oldestDaysOverdue: number;
  totalOverdueAmount: number;
  overdueCount: number;
}

export function useOverduePayments(customerId: string | null, customerName: string) {
  const [overdueInfo, setOverdueInfo] = useState<CustomerOverdueInfo>({
    hasOverdue: false,
    oldestDueDate: null,
    oldestDaysOverdue: 0,
    totalOverdueAmount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOverdueForCustomer();
  }, [customerId, customerName]);

  const loadOverdueForCustomer = async () => {
    if (!customerId && !customerName) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, Total')
        .not('installments_data', 'is', null);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (customerName) {
        query = query.ilike('Customer Name', `%${customerName}%`);
      }

      const { data: contracts, error } = await query;

      if (error) {
        console.error('Error loading contracts for customer:', error);
        return;
      }

      const today = new Date();
      const overdue: OverdueInstallment[] = [];

      // جمع أرقام العقود
      const contractNumbers = (contracts || []).map((c: any) => c.Contract_Number);

      // جلب كل دفعات العميل لهذه العقود مرة واحدة
      const { data: allPayments } = contractNumbers.length
        ? await supabase
            .from('customer_payments')
            .select('contract_number, amount, paid_at')
            .in('contract_number', contractNumbers)
        : { data: [], error: null } as any;

      // تجميع الدفعات حسب العقد
      const paymentsByContract = new Map<number, { amount: number; paid_at: string }[]>();
      (allPayments || []).forEach((p: any) => {
        if (!paymentsByContract.has(p.contract_number)) paymentsByContract.set(p.contract_number, []);
        paymentsByContract.get(p.contract_number)!.push({ amount: Number(p.amount) || 0, paid_at: p.paid_at });
      });

      for (const contract of contracts || []) {
        try {
          let installments: any[] = [];
          if (typeof contract.installments_data === 'string') {
            installments = JSON.parse(contract.installments_data);
          } else if (Array.isArray(contract.installments_data)) {
            installments = contract.installments_data;
          }

          // ترتيب الدفعات حسب التاريخ
          const installmentsSorted = installments
            .filter((i: any) => i.dueDate)
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          // إجمالي مدفوعات هذا العقد حتى اليوم
          const totalPaidForContract = (paymentsByContract.get(contract.Contract_Number) || [])
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          let paymentsRemaining = totalPaidForContract;

          for (const inst of installmentsSorted) {
            const dueDate = new Date(inst.dueDate);
            const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
              const currentDue = Number(inst.amount) || 0;
              const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
              const overdueAmount = Math.max(0, currentDue - allocated);
              paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

              if (overdueAmount > 0) {
                overdue.push({
                  contractNumber: contract.Contract_Number,
                  customerName: contract['Customer Name'] || 'غير معروف',
                  customerId: contract.customer_id,
                  installmentAmount: overdueAmount,
                  dueDate: inst.dueDate,
                  description: inst.description || 'دفعة',
                  daysOverdue: diffDays
                });
              }
            }
          }
        } catch (e) {
          console.error('Error parsing installments:', e);
        }
      }

      if (overdue.length > 0) {
        const oldest = overdue.reduce((prev, curr) => curr.daysOverdue > prev.daysOverdue ? curr : prev);

        setOverdueInfo({
          hasOverdue: true,
          oldestDueDate: oldest.dueDate,
          oldestDaysOverdue: oldest.daysOverdue,
          totalOverdueAmount: overdue.reduce((sum, o) => sum + o.installmentAmount, 0),
          overdueCount: overdue.length
        });
      } else {
        setOverdueInfo({
          hasOverdue: false,
          oldestDueDate: null,
          oldestDaysOverdue: 0,
          totalOverdueAmount: 0,
          overdueCount: 0
        });
      }
    } catch (error) {
      console.error('Error loading overdue payments:', error);
    } finally {
      setLoading(false);
    }
  };

  return { overdueInfo, loading };
}