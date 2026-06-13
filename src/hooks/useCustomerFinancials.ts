/**
 * Hook مركزي لحساب البيانات المالية للعميل
 * يوحد منطق الحساب في مكان واحد ليتم استخدامه في:
 * - كرت ملخص الديون
 * - صفحة العملاء
 * - طباعة الإيصالات
 * - كشف الحساب
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } from '@/components/billing/BillingUtils';

export interface CustomerFinancialData {
  // إجمالي الديون (العقود + الفواتير + المهام المجمعة + الديون السابقة)
  totalDebt: number;
  // إجمالي المدفوعات
  totalPaid: number;
  // المتبقي (باستخدام المنطق الصحيح)
  remainingDebt: number;
  // نسبة السداد
  repaymentPercentage: number;
  // إجمالي الخصومات
  totalDiscounts: number;
  // إجمالي المشتريات من العميل
  totalPurchases: number;
  // حالة التحميل
  isLoading: boolean;
  // خطأ
  error: string | null;
  // تفاصيل الديون
  debtBreakdown: {
    contracts: number;
    salesInvoices: number;
    printedInvoices: number;
    compositeTasks: number;
    otherDebts: number;
  };
}

interface Contract {
  Contract_Number: number;
  Total: number;
  customer_id: string | null;
  [key: string]: any;
}

interface Payment {
  id: string;
  customer_id: string | null;
  amount: number;
  entry_type: string | null;
  contract_number: number | null;
  sales_invoice_id: string | null;
  printed_invoice_id: string | null;
  purchase_invoice_id: string | null;
  [key: string]: any;
}

/**
 * Hook لحساب البيانات المالية لعميل معين
 */
export function useCustomerFinancials(customerId: string | null): CustomerFinancialData {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [printedInvoices, setPrintedInvoices] = useState<any[]>([]);
  const [printTasks, setPrintTasks] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [compositeTasks, setCompositeTasks] = useState<any[]>([]);
  const [friendRentals, setFriendRentals] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // جلب جميع البيانات بالتوازي
        const [
          contractsRes,
          paymentsRes,
          salesInvoicesRes,
          printedInvoicesRes,
          purchaseInvoicesRes,
          discountsRes,
          compositeTasksRes,
          printTasksRes,
          customerRes,
        ] = await Promise.all([
          // العقود
          supabase
            .from('Contract')
            .select('*')
            .eq('customer_id', customerId),
          // الدفعات
          supabase
            .from('customer_payments')
            .select('*')
            .eq('customer_id', customerId),
          // فواتير المبيعات
          supabase
            .from('sales_invoices')
            .select('*')
            .eq('customer_id', customerId),
          // فواتير الطباعة
          supabase
            .from('printed_invoices')
            .select('*')
            .eq('customer_id', customerId),
          // فواتير المشتريات من العميل
          supabase
            .from('purchase_invoices')
            .select('*')
            .eq('customer_id', customerId),
          // الخصومات
          supabase
            .from('customer_general_discounts')
            .select('*')
            .eq('customer_id', customerId)
            .eq('status', 'active'),
          // المهام المجمعة
          supabase
            .from('composite_tasks')
            .select('*')
            .eq('customer_id', customerId),
          supabase
            .from('print_tasks')
            .select('id, invoice_id')
            .eq('customer_id', customerId),
          // جلب معلومات العميل لمعرفة معرف الشركة الصديقة المرتبطة
          supabase
            .from('customers')
            .select('linked_friend_company_id')
            .eq('id', customerId)
            .maybeSingle(),
        ]);

        if (contractsRes.error) throw contractsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        if (customerRes.error) throw customerRes.error;

        setContracts(contractsRes.data || []);
        setPayments(paymentsRes.data || []);
        setSalesInvoices(salesInvoicesRes.data || []);
        setPrintedInvoices(printedInvoicesRes.data || []);
        setPurchaseInvoices(purchaseInvoicesRes.data || []);
        setDiscounts(discountsRes.data || []);
        setCompositeTasks(compositeTasksRes.data || []);
        setPrintTasks(printTasksRes.data || []);

        // حساب إيجارات الشركات الصديقة وجلب البيانات اللازمة
        let dbFriendRentals: any[] = [];
        let linkedFriendCompanyName: string | null = null;
        
        if (customerRes.data?.linked_friend_company_id) {
          const [friendCompanyRes, rentalsRes] = await Promise.all([
            supabase
              .from('friend_companies')
              .select('name')
              .eq('id', customerRes.data.linked_friend_company_id)
              .maybeSingle(),
            supabase
              .from('friend_billboard_rentals')
              .select('*')
              .eq('friend_company_id', customerRes.data.linked_friend_company_id)
          ]);
          
          if (friendCompanyRes.data) {
            linkedFriendCompanyName = friendCompanyRes.data.name;
          }
          if (rentalsRes.data) {
            dbFriendRentals = rentalsRes.data;
          }
        }

        const addedFriendBillboardRentals = new Set<string>();
        const addedFriendRentalGroups = new Set<string>();
        let friendRentalTotal = 0;
        
        // 1. إضافة من جدول friend_billboard_rentals
        dbFriendRentals.forEach(rental => {
          const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
          const usedAsPayment = Number(rental.used_as_payment) || 0;
          const remainingAmount = Math.max(0, rentalCost - usedAsPayment);
          
          if (remainingAmount > 0) {
            friendRentalTotal += remainingAmount;
            const contractNum = Number(rental.contract_number);
            const startDate = rental.start_date || '';
            const billboardId = rental.billboard_id;
            
            if (contractNum && billboardId) {
              addedFriendBillboardRentals.add(`${Number(contractNum)}_${String(billboardId).trim()}`);
            }
            if (contractNum && !isNaN(contractNum)) {
              addedFriendRentalGroups.add(`${contractNum}_${startDate}`);
            }
          }
        });
        
        // 2. إضافة من JSON العقود (مع التصفية والدبلرة)
        if (linkedFriendCompanyName) {
          for (const contract of contractsRes.data || []) {
            const friendData = contract.friend_rental_data as any;
            if (friendData) {
              const items = typeof friendData === 'string' ? (() => { try { return JSON.parse(friendData); } catch { return []; } })() : friendData;
              
              const groupedByDate = new Map<string, number>();

              const processItem = (cost: number, name: string | null, startDate: string, billboardId: any) => {
                if (!name || name.trim() !== linkedFriendCompanyName!.trim()) return;
                
                const isAlreadyAdded = billboardId && addedFriendBillboardRentals.has(`${Number(contract.Contract_Number)}_${String(billboardId).trim()}`);
                if (isAlreadyAdded) return;
                
                const currentSum = groupedByDate.get(startDate) || 0;
                groupedByDate.set(startDate, currentSum + cost);
              };

              if (Array.isArray(items)) {
                for (const item of items) {
                  const cost = Number(item.friendRentalCost || item.friend_rental_cost || 0);
                  if (cost > 0) {
                    const name = item.friendCompanyName || item.friend_company_name || null;
                    const startDate = item.startDate || item.start_date || contract['Contract Date'] || '';
                    const bId = item.billboardId || item.billboard_id || null;
                    processItem(cost, name, startDate, bId);
                  }
                }
              } else if (typeof items === 'object') {
                const entries = Object.entries(items) as [string, any][];
                for (const [bId, entry] of entries) {
                  if (entry && typeof entry.rental_cost === 'number' && entry.rental_cost > 0) {
                    const name = entry.company_name || null;
                    const startDate = entry.startDate || entry.start_date || contract['Contract Date'] || '';
                    processItem(entry.rental_cost, name, startDate, bId);
                  }
                }
              }

              // إضافة التكاليف المجمعة لكل تاريخ بدء
              groupedByDate.forEach((totalCost, startDate) => {
                const groupKey = `${contract.Contract_Number}_${startDate}`;
                if (totalCost > 0 && !addedFriendRentalGroups.has(groupKey)) {
                  friendRentalTotal += totalCost;
                  addedFriendRentalGroups.add(groupKey);
                }
              });
            }
          }
        }
        
        setFriendRentals(friendRentalTotal);

      } catch (err: any) {
        console.error('Error fetching customer financials:', err);
        setError(err.message || 'خطأ في تحميل البيانات المالية');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  // حساب الأرقام باستخدام المنطق الموحد
  const financials = useMemo((): Omit<CustomerFinancialData, 'isLoading' | 'error'> => {
    // إجمالي الخصومات
    const totalDiscounts = discounts.reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);
    const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(printedInvoices, compositeTasks, printTasks);

    // حساب المتبقي باستخدام الدالة الموحدة
    const remainingDebt = calculateTotalRemainingDebt(
      contracts as any[],
      payments as any[],
      salesInvoices,
      billablePrintedInvoices,
      purchaseInvoices,
      totalDiscounts,
      compositeTasks,
      friendRentals
    );

    // حساب تفاصيل الديون
    const totalContracts = contracts.reduce((sum, c) => sum + (Number(c.Total) || 0), 0);
    const totalSalesInvoices = salesInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    
    // فواتير الطباعة (بدون المرتبطة بمهام مجمعة والمضمنة في العقود)
    const totalPrintedInvoices = billablePrintedInvoices.reduce((sum, inv: any) => {
      if (inv.included_in_contract === true) return sum;
      return sum + (Number(inv.total_amount ?? inv.print_cost) || 0);
    }, 0);

    // المهام المجمعة (بدون الفواتير)
    const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
      if (task.combined_invoice_id) return sum;
      return sum + (Number(task.customer_total) || 0);
    }, 0);

    // الديون الأخرى
    const totalOtherDebts = payments.reduce((sum, p) => {
      const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
      const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
      if (isDebt && !isLinked) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);

    // إجمالي الديون
    const totalDebt = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalCompositeTasks + totalOtherDebts;

    // إجمالي المدفوعات
    const totalPaid = payments.reduce((sum, p) => {
      const isCredit = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || 
                       p.entry_type === 'payment' || p.entry_type === 'general_credit';
      if (isCredit) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);

    // إجمالي المشتريات
    const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
      const totalAmount = Number(inv.total_amount) || 0;
      const usedAmount = Number(inv.used_as_payment) || 0;
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0) + friendRentals;

    // نسبة السداد
    const repaymentPercentage = totalDebt > 0 
      ? Math.round(((totalPaid + totalDiscounts + totalPurchases) / totalDebt) * 100) 
      : 100;

    return {
      totalDebt,
      totalPaid,
      remainingDebt: remainingDebt,
      repaymentPercentage: Math.min(100, Math.max(0, repaymentPercentage)),
      totalDiscounts,
      totalPurchases,
      debtBreakdown: {
        contracts: totalContracts,
        salesInvoices: totalSalesInvoices,
        printedInvoices: totalPrintedInvoices,
        compositeTasks: totalCompositeTasks,
        otherDebts: totalOtherDebts,
      },
    };
  }, [contracts, payments, salesInvoices, printedInvoices, printTasks, purchaseInvoices, discounts, compositeTasks, friendRentals]);

  return {
    ...financials,
    isLoading,
    error,
  };
}

/**
 * دالة مساعدة لحساب البيانات المالية مباشرة (بدون Hook)
 * تستخدم عندما تكون البيانات متوفرة مسبقاً
 */
export function calculateCustomerFinancials(
  contracts: any[],
  payments: any[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: any[],
  compositeTasks: any[],
  friendRentals: number = 0
): Omit<CustomerFinancialData, 'isLoading' | 'error'> {
  // إجمالي الخصومات
  const totalDiscounts = discounts.reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);

  // حساب المتبقي باستخدام الدالة الموحدة
  const remainingDebt = calculateTotalRemainingDebt(
    contracts,
    payments,
    salesInvoices,
    printedInvoices,
    purchaseInvoices,
    totalDiscounts,
    compositeTasks,
    friendRentals
  );

  // حساب تفاصيل الديون
  const totalContracts = contracts.reduce((sum, c) => sum + (Number(c.Total || c['Total']) || 0), 0);
  const totalSalesInvoices = salesInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  
  // فواتير الطباعة (بدون المرتبطة بمهام مجمعة والمضمنة في العقود)
  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv: any) => {
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    // ✅ استثناء الفواتير المضمنة في العقود
    if (inv.included_in_contract === true) return sum;
    return sum + (Number(inv.total_amount ?? inv.print_cost) || 0);
  }, 0);

  // المهام المجمعة (بدون الفواتير)
  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  // الديون الأخرى
  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي الديون
  const totalDebt = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalCompositeTasks + totalOtherDebts;

  // إجمالي المدفوعات
  const totalPaid = payments.reduce((sum, p) => {
    const isCredit = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || 
                     p.entry_type === 'payment' || p.entry_type === 'general_credit';
    if (isCredit) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي المشتريات
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0) + friendRentals;

  // نسبة السداد
  const repaymentPercentage = totalDebt > 0 
    ? Math.round(((totalPaid + totalDiscounts + totalPurchases) / totalDebt) * 100) 
    : 100;

  return {
    totalDebt,
    totalPaid,
    remainingDebt: remainingDebt,
    repaymentPercentage: Math.min(100, Math.max(0, repaymentPercentage)),
    totalDiscounts,
    totalPurchases,
    debtBreakdown: {
      contracts: totalContracts,
      salesInvoices: totalSalesInvoices,
      printedInvoices: totalPrintedInvoices,
      compositeTasks: totalCompositeTasks,
      otherDebts: totalOtherDebts,
    },
  };
}
