import { PaymentRow, ContractRow, InstallationPrintPricing } from './BillingTypes';

export interface ContractDetails {
  total: number;
  paid: number;
  remaining: number;
}

export const calculateRemainingBalanceAfterPayment = (
  paymentId: string,
  payments: PaymentRow[],
  totalDebits: number
): number => {
  // Sort payments chronologically
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = new Date(a.paid_at || a.created_at).getTime();
    const dateB = new Date(b.paid_at || b.created_at).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  // Find the current payment
  const currentPayment = sortedPayments.find(p => p.id === paymentId);
  if (!currentPayment) return totalDebits;
  
  // ✅ FIXED: إذا كانت الدفعة موزعة، نحسب حتى آخر دفعة في المجموعة
  const isDistributed = currentPayment.distributed_payment_id;
  let lastPaymentIndex = sortedPayments.findIndex(p => p.id === paymentId);
  
  if (isDistributed) {
    // جلب جميع الدفعات الموزعة في نفس المجموعة
    const distributedGroup = sortedPayments.filter(p => 
      p.distributed_payment_id === currentPayment.distributed_payment_id
    );
    
    // آخر دفعة في المجموعة
    if (distributedGroup.length > 0) {
      const lastDistributed = distributedGroup[distributedGroup.length - 1];
      lastPaymentIndex = sortedPayments.findIndex(p => p.id === lastDistributed.id);
    }
  }
  
  // Calculate total credits up to and including this payment (or last distributed payment)
  let totalCredits = 0;
  for (let i = 0; i <= lastPaymentIndex; i++) {
    const payment = sortedPayments[i];
    if (payment.entry_type === 'receipt' || payment.entry_type === 'account_payment' || payment.entry_type === 'payment') {
      totalCredits += Number(payment.amount) || 0;
    }
  }
  
  return Math.max(0, totalDebits - totalCredits);
};

export const getContractDetails = (
  contractNumber: string,
  contracts: ContractRow[],
  payments: PaymentRow[]
): ContractDetails | null => {
  const contract = contracts.find(c => String(c.Contract_Number) === String(contractNumber));
  if (!contract) return null;
  
  const total = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
  const paid = payments
    .filter(p => String(p.contract_number) === String(contractNumber))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid)
  };
};

// ✅ حساب موحد للمتبقي من إجمالي الديون
export const calculateTotalRemainingDebt = (
  contracts: ContractRow[],
  payments: PaymentRow[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: number,
  compositeTasks: any[] = [],
  extraPurchases: number = 0
): number => {
  // إجمالي العقود
  const totalContracts = contracts.reduce(
    (sum, c) => sum + (Number((c as any)['Total']) || 0),
    0
  );

  // إجمالي فواتير المبيعات
  const totalSalesInvoices = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0),
    0
  );

  // إجمالي فواتير الطباعة (استثناء الفواتير المرتبطة بمهام مجمعة والمضمنة في العقود)
  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv) => {
    // استثناء فواتير المهام المجمعة
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    // ✅ استثناء الفواتير المضمنة في العقود
    if (inv.included_in_contract === true) return sum;
    const val = Number(inv.total_amount ?? inv.print_cost) || 0;
    return sum + val;
  }, 0);

  // ✅ إجمالي المهام المجمعة (غير المنشأ لها فواتير)
  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    // إذا تم إنشاء فاتورة، يتم احتسابها من printed_invoices
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  // الديون الأخرى (من جدول الدفعات - غير المرتبطة بفواتير)
  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي الديون
  const totalDebits = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalOtherDebts + totalCompositeTasks;

  // إجمالي المدفوعات
  const totalCredits = payments.reduce((sum, p) => {
    const isCredit =
      p.entry_type === 'receipt' ||
      p.entry_type === 'account_payment' ||
      p.entry_type === 'payment' ||
      p.entry_type === 'general_credit';
    if (isCredit) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي المشتريات من الزبون (غير المستخدمة كدفعات) + مشتريات إضافية (مثل إيجارات الشركات الصديقة)
  const totalPurchasesFromInvoices = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0);

  const totalPurchases = totalPurchasesFromInvoices + (Number(extraPurchases) || 0);

  // المتبقي = الديون - المدفوعات - الخصومات - المشتريات
  return totalDebits - totalCredits - discounts - totalPurchases;
};

// ✅ حساب المتبقي مع استبعاد إيجارات الشركات الصديقة من الديون
export const calculateTotalRemainingDebtExcludingFriendRentals = (
  contracts: ContractRow[],
  payments: PaymentRow[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: number,
  compositeTasks: any[] = [],
  friendRentalsToExclude: number = 0
): number => {
  // إجمالي العقود (مطروح منه إيجارات الصديقة لأنها مضمنة في Total)
  const totalContracts = contracts.reduce(
    (sum, c) => sum + (Number((c as any)['Total']) || 0),
    0
  ) - friendRentalsToExclude;

  // إجمالي فواتير المبيعات
  const totalSalesInvoices = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0),
    0
  );

  // إجمالي فواتير الطباعة (استثناء الفواتير المرتبطة بمهام مجمعة والمضمنة في العقود)
  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv: any) => {
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    // ✅ استثناء الفواتير المضمنة في العقود
    if (inv.included_in_contract === true) return sum;
    const val = Number(inv.total_amount ?? inv.print_cost) || 0;
    return sum + val;
  }, 0);

  // إجمالي المهام المجمعة (غير المنشأ لها فواتير)
  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  // الديون الأخرى (من جدول الدفعات - غير المرتبطة بفواتير)
  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي الديون (بدون إيجارات الصديقة)
  const totalDebits = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalOtherDebts + totalCompositeTasks;

  // إجمالي المدفوعات
  const totalCredits = payments.reduce((sum, p) => {
    const isCredit =
      p.entry_type === 'receipt' ||
      p.entry_type === 'account_payment' ||
      p.entry_type === 'payment' ||
      p.entry_type === 'general_credit';
    if (isCredit) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي المشتريات من الزبون (بدون إضافة إيجارات الصديقة هنا)
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0);

  // المتبقي = الديون - المدفوعات - الخصومات - المشتريات
  return totalDebits - totalCredits - discounts - totalPurchases;
};

export interface BillboardSize {
  size: string;
  level: string;
  quantity: number;
  print_price?: number;
  install_price?: number;
}

export const parseBillboardSizes = (
  contractNumber: string,
  billboardsData: string | Record<string, unknown> | null,
  billboardsCount: number,
  customerCategory: string,
  pricingData: InstallationPrintPricing[],
  contractBillboards: any[]
): BillboardSize[] => {
  console.log('Parsing billboard sizes:', { 
    contractNumber,
    billboardsData, 
    billboardsCount, 
    customerCategory, 
    pricingDataLength: pricingData.length,
    contractBillboardsLength: contractBillboards?.length ?? 0
  });
  
  const sizes: BillboardSize[] = [];
  
  try {
    let billboards: any[] = [];
    
    // First, try to use the billboards from the database query
    if (contractBillboards?.length > 0) {
      billboards = contractBillboards;
      console.log('Using billboards from database query:', billboards.length);
    }
    // Fallback: try to parse billboards_data
    else if (billboardsData && typeof billboardsData === 'string' && billboardsData.trim()) {
      try {
        const parsed = JSON.parse(billboardsData);
        if (Array.isArray(parsed)) {
          billboards = parsed;
        } else if (parsed && typeof parsed === 'object') {
          billboards = [parsed];
        }
        console.log('Using billboards from billboards_data:', billboards.length);
      } catch (e) {
        console.warn('Failed to parse billboards_data:', e);
      }
    }
    // Last resort: use billboards_count to create default entries
    else if (billboardsCount > 0) {
      console.log('Creating default billboards based on count:', billboardsCount);
      for (let i = 0; i < billboardsCount; i++) {
        billboards.push({
          size: '3x4',
          level: 'أرضي'
        });
      }
    }
    
    // Process each billboard
    if (billboards.length > 0) {
      billboards.forEach((billboard: any, index: number) => {
        let size = '3x4'; // default
        let level = 'أرضي'; // default
        
        // Extract size from various possible field names
        if (billboard.Size) {
          size = String(billboard.Size);
        } else if (billboard.size) {
          size = String(billboard.size);
        }
        
        // Extract level from various possible field names
        if (billboard.Level) {
          level = String(billboard.Level);
        } else if (billboard.level) {
          level = String(billboard.level);
        } else if (billboard.billboard_level) {
          level = String(billboard.billboard_level);
        }
        
        // Normalize size format (replace × or * with x)
        size = size.replace(/×|\*/g, 'x');
        
        // Find pricing for this size, level, and category
        const pricing = pricingData.find(p => 
          p.size === size && 
          p.level === level && 
          p.category === customerCategory
        );
        
        console.log(`Billboard ${index + 1}: size=${size}, level=${level}, category=${customerCategory}`, pricing ? 'Found pricing' : 'No pricing found');
        
        sizes.push({
          size,
          level,
          quantity: 1,
          print_price: pricing?.print_price || 50, // Default fallback
          install_price: pricing?.installation_price || 30 // Default fallback
        });
      });
    }
    
    // If still no sizes, create at least one default
    if (sizes.length === 0) {
      console.log('Creating single default size entry');
      
      const defaultPricing = pricingData.find(p => 
        p.size === '3x4' && 
        p.level === 'أرضي' && 
        p.category === customerCategory
      ) || pricingData.find(p => p.category === customerCategory) || pricingData[0];
      
      sizes.push({
        size: '3x4',
        level: 'أرضي',
        quantity: 1,
        print_price: defaultPricing?.print_price || 50,
        install_price: defaultPricing?.installation_price || 30
      });
    }
    
  } catch (error) {
    console.error('Error parsing billboard sizes:', error);
    
    // Emergency fallback: create default sizes
    const count = Math.max(1, billboardsCount || 1);
    for (let i = 0; i < count; i++) {
      const defaultPricing = pricingData.find(p => p.category === customerCategory);
      
      sizes.push({
        size: '3x4',
        level: 'أرضي',
        quantity: 1,
        print_price: defaultPricing?.print_price || 50,
        install_price: defaultPricing?.installation_price || 30
      });
    }
  }
  
  console.log('Final parsed sizes:', sizes);
  return sizes;
};