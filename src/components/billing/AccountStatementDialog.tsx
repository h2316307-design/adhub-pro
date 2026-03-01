import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatArabicNumber, formatDate } from '@/lib/printHtmlGenerator';
import { useAccountStatementPrint } from './AccountStatementPrint';

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  customerName: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

// ✅ دالة تحديد حالة العقد
const getContractStatus = (endDate: string | null): { status: string; className: string } => {
  if (!endDate) return { status: 'غير محدد', className: 'text-muted-foreground' };
  
  const end = new Date(endDate);
  const now = new Date();
  
  if (end >= now) {
    return { status: 'نشط', className: 'text-green-400 font-semibold' };
  } else {
    return { status: 'منتهي', className: 'text-red-400 font-semibold' };
  }
};

// ✅ دالة تنسيق نوع الدفعة بستايل الموقع
const formatPaymentType = (entryType: string, hasDistributedPaymentId?: boolean): { text: string; className: string } => {
  switch (entryType) {
    case 'receipt':
      return { 
        text: 'إيصال', 
        className: 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold border border-green-500/30' 
      };
    case 'invoice':
      return { 
        text: 'فاتورة', 
        className: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold border border-blue-500/30' 
      };
    case 'debt':
      return { 
        text: 'دين سابق', 
        className: 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold border border-red-500/30' 
      };
    case 'account_payment':
      return { 
        text: 'دفعة حساب', 
        className: 'bg-gradient-to-r from-primary/20 to-primary-glow/20 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/30' 
      };
    case 'composite_task':
      return { 
        text: 'مهمة مجمعة', 
        className: 'bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold border border-purple-500/30' 
      };
    case 'payment':
      return { 
        text: hasDistributedPaymentId ? 'دفعة موزعة' : 'دفعة', 
        className: 'bg-gradient-to-r from-teal-500/20 to-teal-600/20 text-teal-400 px-3 py-1 rounded-full text-xs font-semibold border border-teal-500/30' 
      };
    case 'purchase_invoice':
      return { 
        text: 'فاتورة مشتريات', 
        className: 'bg-gradient-to-r from-orange-500/20 to-orange-600/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold border border-orange-500/30' 
      };
    case 'sales_invoice':
      return { 
        text: 'فاتورة مبيعات', 
        className: 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/20 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-500/30' 
      };
    case 'friend_billboard_rental':
      return { 
        text: 'إيجار لوحة (صديق)', 
        className: 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/30' 
      };
    default:
      return { 
        text: entryType || 'غير محدد', 
        className: 'bg-gradient-to-r from-muted/20 to-muted/30 text-muted-foreground px-3 py-1 rounded-full text-xs font-semibold border border-muted/30' 
      };
  }
};

export default function AccountStatementDialog({ open, onOpenChange, customerId, customerName }: AccountStatementDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [excludeFriendRentals, setExcludeFriendRentals] = useState(false);

  // ✅ استخدام نظام الطباعة الموحد
  const { print: printStatement, isPrinting } = useAccountStatementPrint();

  // ✅ تحميل بيانات العميل
  const loadCustomerData = async () => {
    try {
      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData(data);
        } else {
          setCustomerData({ name: customerName, id: customerId });
        }
      } else {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', `%${customerName}%`)
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setCustomerData(data);
        } else {
          setCustomerData({ name: customerName, id: 'غير محدد' });
        }
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({ name: customerName, id: customerId || 'غير محدد' });
    }
  };

  // ✅ تحميل العقود والدفعات
  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // تحميل العقود
      let contractsData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', customerId)
          .order('Contract Date', { ascending: false });

        if (!error && data) {
          contractsData = data;
        }
      }
      
      if (contractsData.length === 0 && customerName) {
        const { data, error } = await supabase
          .from('Contract')
          .select('*')
          .ilike('Customer Name', `%${customerName}%`)
          .order('Contract Date', { ascending: false });

        if (!error && data) {
          contractsData = data;
        }
      }
      
      setContracts(contractsData);

      // تحميل الدفعات
      let paymentsData: any[] = [];
      
      if (customerId) {
        let paymentsQuery = supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_id', customerId)
          .order('paid_at', { ascending: true });

        if (startDate) {
          paymentsQuery = paymentsQuery.gte('paid_at', startDate);
        }
        if (endDate) {
          paymentsQuery = paymentsQuery.lte('paid_at', endDate);
        }

        const { data, error } = await paymentsQuery;

        if (!error && data) {
          paymentsData = data;
        }
      }
      
      if (paymentsData.length === 0 && customerName) {
        let paymentsQuery = supabase
          .from('customer_payments')
          .select('*')
          .ilike('customer_name', `%${customerName}%`)
          .order('paid_at', { ascending: true });

        if (startDate) {
          paymentsQuery = paymentsQuery.gte('paid_at', startDate);
        }
        if (endDate) {
          paymentsQuery = paymentsQuery.lte('paid_at', endDate);
        }

        const { data, error } = await paymentsQuery;

        if (!error && data) {
          paymentsData = data;
        }
      }
      
      setPayments(paymentsData);

      // تحميل فواتير الطباعة
      let printedInvoicesData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('printed_invoices')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          printedInvoicesData = data;
        }
      }
      
      if (printedInvoicesData.length === 0 && customerName) {
        const { data, error } = await supabase
          .from('printed_invoices')
          .select('*')
          .ilike('customer_name', `%${customerName}%`)
          .order('created_at', { ascending: true });

        if (!error && data) {
          printedInvoicesData = data;
        }
      }

      // تحميل الخصومات العامة
      let generalDiscountsData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('customer_general_discounts')
          .select('*')
          .eq('customer_id', customerId)
          .eq('status', 'active')
          .order('applied_date', { ascending: true });

        if (!error && data) {
          generalDiscountsData = data;
        }
      }

      // تحميل فواتير المشتريات
      let purchaseInvoicesData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          // فلترة لاستبعاد الفواتير المحذوفة أو الملغاة
          purchaseInvoicesData = data.filter(inv => {
            const invAny = inv as any;
            return !invAny.is_deleted && invAny.status !== 'deleted' && invAny.status !== 'cancelled';
          });
        }
      }

      // ✅ fallback: إذا لم يوجد customerId أو لم تُرجع نتائج، ابحث بالاسم
      if (purchaseInvoicesData.length === 0 && customerName) {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .select('*')
          .ilike('customer_name', `%${customerName}%`)
          .order('created_at', { ascending: true });

        if (!error && data) {
          purchaseInvoicesData = data.filter(inv => {
            const invAny = inv as any;
            return !invAny.is_deleted && invAny.status !== 'deleted' && invAny.status !== 'cancelled';
          });
        }
      }

      // تحميل فواتير المبيعات
      let salesInvoicesData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('sales_invoices')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          salesInvoicesData = data;
        }
      }
      
      if (salesInvoicesData.length === 0 && customerName) {
        const { data, error } = await supabase
          .from('sales_invoices')
          .select('*')
          .ilike('customer_name', `%${customerName}%`)
          .order('created_at', { ascending: true });

        if (!error && data) {
          salesInvoicesData = data;
        }
      }

      // تحميل المهام المجمعة
      let compositeTasksData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('composite_tasks')
          .select('*, installation_tasks!composite_tasks_installation_task_id_fkey(contract_ids, contract_id)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          compositeTasksData = data;
        }
      }

      // تحميل إيجارات اللوحات الصديقة
      let friendBillboardRentalsData: any[] = [];
      
      if (customerId) {
        const { data: customerInfo } = await supabase
          .from('customers')
          .select('linked_friend_company_id')
          .eq('id', customerId)
          .single();
        
        if (customerInfo?.linked_friend_company_id) {
          const { data, error } = await supabase
            .from('friend_billboard_rentals')
            .select(`
              *,
              billboards:billboard_id (ID, Billboard_Name, Size, Municipality, Faces_Count)
            `)
            .eq('friend_company_id', customerInfo.linked_friend_company_id)
            .order('start_date', { ascending: true });

          if (!error && data) {
            friendBillboardRentalsData = data;
          }
        }
      }

      // إنشاء قائمة موحدة لجميع الحركات
      const compositeTaskInvoiceIds = new Set(compositeTasksData.map(t => t.combined_invoice_id).filter(Boolean));
      const transactions: any[] = [];
      
      // إضافة العقود - مع حساب المدفوع والمتبقي
      contractsData.forEach(contract => {
        const contractTotal = Number(contract['Total']) || 0;
        // حساب المدفوع الفعلي من الدفعات
        const contractPaid = paymentsData
          .filter(p => String(p.contract_number) === String(contract.Contract_Number) && 
                       (p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment'))
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const contractRemaining = Math.max(0, contractTotal - contractPaid);
        
        // ✅ إضافة نوع الإعلان في المرجع
        const adType = contract['Ad Type'] || 'غير محدد';
        transactions.push({
          id: `contract-${contract.Contract_Number}`,
          date: contract['Contract Date'],
          type: 'contract',
          description: `عقد رقم ${contract.Contract_Number} - ${adType}`,
          debit: contractTotal,
          credit: 0,
          balance: 0,
          reference: `عقد-${contract.Contract_Number} (${adType})`,
          notes: '',
          details: `القيمة: ${contractTotal.toLocaleString()} | المدفوع: ${contractPaid.toLocaleString()} | المتبقي: ${contractRemaining.toLocaleString()}`,
          originalAmount: contractTotal,
          paidAmount: contractPaid,
          remainingAmount: contractRemaining,
          itemTotal: contractTotal,
          itemRemaining: null, // سيتم حسابه لاحقاً حسب التسلسل الزمني
          adType: adType,
          contractNumber: contract.Contract_Number,
        });
      });

      // إضافة الخصومات
      generalDiscountsData.forEach(discount => {
        const amount = Number(discount.discount_value) || 0;
        const description = discount.discount_type === 'percentage' 
          ? `خصم ${amount}% - ${discount.reason || 'خصم عام'}`
          : `خصم ${amount.toLocaleString()} د.ل - ${discount.reason || 'خصم عام'}`;
        
        transactions.push({
          id: `discount-${discount.id}`,
          date: discount.applied_date,
          type: 'discount',
          description: description,
          debit: 0,
          credit: discount.discount_type === 'fixed' ? amount : 0,
          balance: 0,
          reference: 'خصم عام',
          notes: discount.reason || '—',
        });
      });

      // إضافة فواتير الطباعة - مع حساب المدفوع والمتبقي
      printedInvoicesData.forEach(invoice => {
        if (compositeTaskInvoiceIds.has(invoice.id)) return;
        
        let invoiceTypeText = '';
        if (invoice.invoice_type === 'print_only') {
          invoiceTypeText = ' (طباعة فقط)';
        } else if (invoice.invoice_type === 'print_install') {
          invoiceTypeText = ' (طباعة وتركيب)';
        } else if (invoice.invoice_type === 'install_only') {
          invoiceTypeText = ' (تركيب فقط)';
        }
        
        const invoiceTotal = Number(invoice.total_amount) || 0;
        const invoicePaid = Number(invoice.paid_amount) || 0;
        const invoiceRemaining = invoiceTotal - invoicePaid;
        
        transactions.push({
          id: `print-invoice-${invoice.id}`,
          date: invoice.invoice_date || invoice.created_at,
          type: 'print_invoice',
          description: `فاتورة طباعة رقم ${invoice.invoice_number || invoice.id}${invoiceTypeText}`,
          debit: invoiceTotal,
          credit: 0,
          balance: 0,
          reference: `فاتورة-${invoice.invoice_number || invoice.id}`,
          notes: invoice.notes || '—',
          details: `القيمة: ${invoiceTotal.toLocaleString()} | المدفوع: ${invoicePaid.toLocaleString()} | المتبقي: ${invoiceRemaining.toLocaleString()}`,
          originalAmount: invoiceTotal,
          paidAmount: invoicePaid,
          remainingAmount: invoiceRemaining,
          itemTotal: invoiceTotal,
          itemRemaining: invoiceRemaining,
        });
      });

      // إضافة المهام المجمعة
      compositeTasksData.forEach(task => {
        const taskContractIds = task.installation_tasks?.contract_ids || 
          (task.installation_tasks?.contract_id ? [task.installation_tasks.contract_id] : []);
        const contractsRef = taskContractIds.length > 0 
          ? `عقود: ${taskContractIds.join(', ')}`
          : task.contract_id ? `عقد-${task.contract_id}` : '—';
        // ترجمة نوع المهمة للعربية
        const getTaskTypeLabel = (taskType: string) => {
          switch (taskType) {
            case 'new_installation': return 'تركيب جديد';
            case 'reinstallation': return 'إعادة تركيب';
            default: return taskType || 'غير محدد';
          }
        };
        
        transactions.push({
          id: `composite-${task.id}`,
          date: task.invoice_date || task.created_at,
          type: 'composite_task',
          description: `مهمة مجمعة - ${getTaskTypeLabel(task.task_type)}`,
          debit: Number(task.customer_total) || 0,
          credit: 0,
          balance: 0,
          reference: contractsRef,
          notes: '—', // ✅ إخفاء الملاحظات (تكلفة القص والتركيب)
        });
      });

      // إضافة فواتير المشتريات - فقط المبلغ غير المستخدم كدفعة موزعة
      purchaseInvoicesData.forEach(invoice => {
        const totalAmount = Number(invoice.total_amount) || 0;
        const usedAsPayment = Number(invoice.used_as_payment) || 0;
        const remainingAmount = totalAmount - usedAsPayment;
        
        // عدم عرض الفاتورة إذا كانت مستخدمة بالكامل كدفعة موزعة
        if (remainingAmount <= 0) return;
        
        // بناء الملاحظات مع قيمة فاتورة المشتريات الكلية
        let notesText = '';
        if (usedAsPayment > 0) {
          notesText = `القيمة الكلية: ${totalAmount.toLocaleString()} د.ل - مستخدم كدفعة: ${usedAsPayment.toLocaleString()} د.ل`;
        } else {
          notesText = `القيمة الكلية: ${totalAmount.toLocaleString()} د.ل${invoice.notes ? ' | ' + invoice.notes : ''}`;
        }
        
        // استخدام عنوان الفاتورة بدلاً من الكود - مع إزالة المسافات الزائدة
        const trimmedInvoiceName = invoice.invoice_name?.trim();
        const invoiceTitle = trimmedInvoiceName || `فاتورة مشتريات ${invoice.invoice_number || ''}`;
        
        transactions.push({
          id: `purchase-${invoice.id}`,
          date: invoice.invoice_date || invoice.created_at,
          type: 'purchase_invoice',
          description: `مقايضة - ${invoiceTitle}${usedAsPayment > 0 ? ' (جزئي)' : ''}`,
          debit: 0,
          credit: remainingAmount,
          balance: 0,
          reference: invoice.invoice_name ? `مشتريات-${invoice.invoice_number || invoice.id}` : '—',
          notes: notesText,
        });
      });

      // إضافة فواتير المبيعات - مع حساب المدفوع والمتبقي
      // إنشاء خريطة لربط فواتير المبيعات بمعرفاتها
      const salesInvoicesMap = new Map<string, any>();
      salesInvoicesData.forEach(invoice => {
        salesInvoicesMap.set(invoice.id, invoice);
        // استخدام عنوان الفاتورة بدلاً من الكود - مع إزالة المسافات الزائدة
        const trimmedSalesInvoiceName = invoice.invoice_name?.trim();
        const invoiceTitle = trimmedSalesInvoiceName || `فاتورة مبيعات ${invoice.invoice_number || ''}`;
        
        const invoiceTotal = Number(invoice.total_amount) || 0;
        const invoicePaid = Number(invoice.paid_amount) || 0;
        const invoiceRemaining = invoiceTotal - invoicePaid;
        
        transactions.push({
          id: `sales-${invoice.id}`,
          date: invoice.invoice_date || invoice.created_at,
          type: 'sales_invoice',
          description: invoiceTitle,
          debit: invoiceTotal,
          credit: 0,
          balance: 0,
          reference: invoice.invoice_name ? `مبيعات-${invoice.invoice_number || invoice.id}` : '—',
          notes: invoice.notes || '—',
          details: `القيمة: ${invoiceTotal.toLocaleString()} | المدفوع: ${invoicePaid.toLocaleString()} | المتبقي: ${invoiceRemaining.toLocaleString()}`,
          originalAmount: invoiceTotal,
          paidAmount: invoicePaid,
          remainingAmount: invoiceRemaining,
          itemTotal: invoiceTotal,
          itemRemaining: invoiceRemaining,
        });
      });

      // ✅ خريطة فواتير المشتريات (لاستخدام عنوان الفاتورة داخل ملاحظات/مرجع الدفعات المقايضة)
      const purchaseInvoicesMap = new Map<string, any>();
      purchaseInvoicesData.forEach((inv) => purchaseInvoicesMap.set(inv.id, inv));


      // إضافة إيجارات اللوحات الصديقة من جدول friend_billboard_rentals - فقط المبلغ غير المستخدم كدفعة
      // ✅ مع مراعاة خيار الاستثناء
      if (!excludeFriendRentals) {
        friendBillboardRentalsData.forEach(rental => {
          const billboardInfo = rental.billboards;
          const billboardName = billboardInfo?.Billboard_Name || `لوحة ${rental.billboard_id}`;
          // ✅ استخدام friend_rental_cost بدلاً من rental_amount
          const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
          const usedAsPayment = Number(rental.used_as_payment) || 0;
          const remainingAmount = rentalCost - usedAsPayment;
          
          // عدم عرض الإيجار إذا كان مستخدم بالكامل كدفعة موزعة
          if (remainingAmount <= 0) return;
          
          transactions.push({
            id: `friend-rental-${rental.id}`,
            date: rental.start_date,
            type: 'friend_billboard_rental',
            description: `إيجار لوحة: ${billboardName}${usedAsPayment > 0 ? ' (جزئي)' : ''}`,
            debit: 0,
            credit: remainingAmount,
            balance: 0,
            reference: `إيجار-${rental.id.slice(0, 8)}`,
            notes: usedAsPayment > 0 ? `المبلغ الأصلي: ${rentalCost.toLocaleString()} - مستخدم: ${usedAsPayment.toLocaleString()}` : `${rental.start_date} - ${rental.end_date}`,
          });
        });

        // إضافة إيجارات الشركات الصديقة من friend_rental_data في العقود
        contractsData.forEach(contract => {
          const friendData = contract.friend_rental_data as any;
          if (friendData && typeof friendData === 'object') {
            const entries = Object.entries(friendData) as [string, any][];
            entries.forEach(([billboardId, entry]) => {
              if (entry && typeof entry.rental_cost === 'number' && entry.rental_cost > 0) {
                transactions.push({
                  id: `friend-contract-${contract.Contract_Number}-${billboardId}`,
                  date: contract['Contract Date'],
                  type: 'friend_rental_contract',
                  description: `إيجار لوحة صديقة - عقد ${contract.Contract_Number}`,
                  debit: 0,
                  credit: Number(entry.rental_cost) || 0,
                  balance: 0,
                  reference: `عقد-${contract.Contract_Number}`,
                  notes: entry.company_name || '—',
                });
              }
            });
          }
        });
      }

      // إضافة الدفعات
      paymentsData.forEach(payment => {
        const paymentInfo = formatPaymentType(payment.entry_type || 'payment', !!payment.distributed_payment_id);

        // تحديد المرجع بناءً على نوع الربط (الهدف)
        let paymentRef = '—';
        if (payment.contract_number) {
          paymentRef = `عقد-${payment.contract_number}`;
        } else if (payment.sales_invoice_id) {
          // البحث عن فاتورة المبيعات للحصول على اسمها
          const salesInvoice = salesInvoicesMap.get(payment.sales_invoice_id);
          if (salesInvoice) {
            paymentRef = salesInvoice.invoice_name || `مبيعات-${salesInvoice.invoice_number || payment.sales_invoice_id}`;
          } else {
            paymentRef = `مبيعات-${payment.sales_invoice_id.slice(0, 8)}`;
          }
        } else if (payment.printed_invoice_id) {
          paymentRef = `فاتورة طباعة`;
        } else if (payment.composite_task_id) {
          paymentRef = `مهمة مجمعة`;
        }

        // ✅ ملاحظات/وصف الدفعة: في حالة المقايضة من فاتورة مشتريات نعرض "عنوان الفاتورة" بدل الكود
        let paymentNotes: string = payment.notes || '—';

        // نحاول حل فاتورة المشتريات إمّا بالـ id أو (fallback) من الكود الموجود داخل النص
        let resolvedPurchaseInvoice: any | null = null;
        if (payment.purchase_invoice_id) {
          resolvedPurchaseInvoice = purchaseInvoicesMap.get(payment.purchase_invoice_id) || null;
        }

        if (!resolvedPurchaseInvoice && typeof paymentNotes === 'string') {
          const match = paymentNotes.match(/PUR-\d+/);
          if (match) {
            resolvedPurchaseInvoice = purchaseInvoicesData.find((inv: any) => inv.invoice_number === match[0]) || null;
          }
        }

        let purchaseTitle: string | null = null;
        if (resolvedPurchaseInvoice) {
          purchaseTitle =
            resolvedPurchaseInvoice.invoice_name?.trim() ||
            resolvedPurchaseInvoice.invoice_number ||
            resolvedPurchaseInvoice.id;

          // استبدال النص القديم الذي يحتوي على الكود فقط
          if (
            paymentNotes !== '—' &&
            (paymentNotes.includes('مقايضة من فاتورة مشتريات') || payment.method === 'مقايضة')
          ) {
            paymentNotes = `مقايضة من فاتورة مشتريات ${purchaseTitle}`;
          }

          // إذا لم يوجد مرجع للهدف، استخدم عنوان/رقم فاتورة المشتريات كمرجع بديل
          if (paymentRef === '—') {
            paymentRef = purchaseTitle;
          }
        }

        // ✅ الوصف: لا تستخدم payment.reference المخزّن إذا كان سيعيد الكود
        const descriptionSuffix = purchaseTitle
          ? `مقايضة من فاتورة مشتريات ${purchaseTitle}`
          : (payment.reference ? String(payment.reference) : '');

        // ✅ بناء تفاصيل الدفعة: القيمة الكاملة والمتبقي
        let detailsText = '';
        let itemRemaining: number | null = null;
        let itemTotal: number | null = null;
        
        // 1. مقايضة من فاتورة مشتريات
        if (payment.distributed_payment_id && resolvedPurchaseInvoice) {
          const fullAmount = Number(resolvedPurchaseInvoice.total_amount) || 0;
          const usedAmount = Number(resolvedPurchaseInvoice.used_as_payment) || 0;
          const remainingAmount = fullAmount - usedAmount;
          detailsText = `القيمة: ${fullAmount.toLocaleString()} | المستخدم: ${usedAmount.toLocaleString()} | المتبقي: ${remainingAmount.toLocaleString()}`;
          itemTotal = fullAmount;
          itemRemaining = remainingAmount;
        }
        
        // 2. سند قبض مرتبط بعقد - عرض قيمة العقد والمتبقي
        let linkedContractAdType = '';
        if (payment.contract_number) {
          const linkedContract = contractsData.find((c: any) => c.Contract_Number === payment.contract_number);
          if (linkedContract) {
            const contractTotalValue = Number(linkedContract.Total) || 0;
            const contractPaid = paymentsData
              .filter((p: any) => 
                String(p.contract_number) === String(payment.contract_number) && 
                (p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment')
              )
              .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            const contractRemaining = Math.max(0, contractTotalValue - contractPaid);
            linkedContractAdType = linkedContract['Ad Type'] || '';
            detailsText = `الدين: ${contractTotalValue.toLocaleString()} | المسدد: ${contractPaid.toLocaleString()} | المتبقي: ${contractRemaining.toLocaleString()}${linkedContractAdType ? ` | ${linkedContractAdType}` : ''}`;
            itemTotal = contractTotalValue;
            itemRemaining = contractRemaining;
          }
        }
        
        // 3. سند قبض مرتبط بفاتورة مبيعات - عرض قيمة الفاتورة والمتبقي
        if (payment.sales_invoice_id) {
          const salesInvoice = salesInvoicesMap.get(payment.sales_invoice_id);
          if (salesInvoice) {
            const invoiceTotalValue = Number(salesInvoice.total_amount) || 0;
            const invoicePaid = Number(salesInvoice.paid_amount) || 0;
            const invoiceRemaining = invoiceTotalValue - invoicePaid;
            const invoiceName = salesInvoice.invoice_name?.trim() || '';
            detailsText = `الدين: ${invoiceTotalValue.toLocaleString()} | المسدد: ${invoicePaid.toLocaleString()} | المتبقي: ${invoiceRemaining.toLocaleString()}${invoiceName ? ` | ${invoiceName}` : ''}`;
            itemTotal = invoiceTotalValue;
            itemRemaining = invoiceRemaining;
          }
        }
        
        // 3.1. دفعة موزعة على فاتورة مبيعات (من notes) - استبدال الكود باسم الفاتورة
        if (paymentNotes && paymentNotes.includes('فاتورة مبيعات')) {
          const saleMatch = paymentNotes.match(/SALE-\d+/);
          if (saleMatch) {
            const salesInvoice = salesInvoicesData.find((inv: any) => inv.invoice_number === saleMatch[0]);
            if (salesInvoice) {
              const invoiceTotalValue = Number(salesInvoice.total_amount) || 0;
              const invoicePaid = Number(salesInvoice.paid_amount) || 0;
              const invoiceRemaining = invoiceTotalValue - invoicePaid;
              const invoiceName = salesInvoice.invoice_name?.trim() || saleMatch[0];
              
              // ✅ تحديث التفاصيل والمتبقي
              if (!detailsText) {
                detailsText = `الدين: ${invoiceTotalValue.toLocaleString()} | المسدد: ${invoicePaid.toLocaleString()} | المتبقي: ${invoiceRemaining.toLocaleString()} | ${invoiceName}`;
              }
              if (itemTotal === null) {
                itemTotal = invoiceTotalValue;
              }
              if (itemRemaining === null) {
                itemRemaining = invoiceRemaining;
              }
              
              // ✅ استبدال الكود باسم الفاتورة في الملاحظات
              paymentNotes = paymentNotes.replace(saleMatch[0], invoiceName);
            }
          }
        }
        
        // 4. سند قبض مرتبط بفاتورة طباعة - عرض قيمة الفاتورة والمتبقي
        if (payment.printed_invoice_id) {
          const printedInvoice = printedInvoicesData.find((inv: any) => inv.id === payment.printed_invoice_id);
          if (printedInvoice) {
            const invoiceTotalValue = Number(printedInvoice.total_amount) || 0;
            const invoicePaid = Number(printedInvoice.paid_amount) || 0;
            const invoiceRemaining = invoiceTotalValue - invoicePaid;
            detailsText = `الدين: ${invoiceTotalValue.toLocaleString()} | المسدد: ${invoicePaid.toLocaleString()} | المتبقي: ${invoiceRemaining.toLocaleString()}`;
            itemTotal = invoiceTotalValue;
            itemRemaining = invoiceRemaining;
          }
        }
        
        // 5. دين سابق (debt) بدون ربط - محاولة استخراج المعلومات من notes
        if (itemRemaining === null && payment.entry_type === 'debt') {
          // البحث عن رقم العقد في الملاحظات
          const contractMatch = paymentNotes.match(/عقد\s*#?(\d+)/);
          if (contractMatch) {
            const contractNum = parseInt(contractMatch[1]);
            const linkedContract = contractsData.find((c: any) => c.Contract_Number === contractNum);
            if (linkedContract) {
              const contractTotalValue = Number(linkedContract.Total) || 0;
              linkedContractAdType = linkedContract['Ad Type'] || '';
              detailsText = `الدين: ${contractTotalValue.toLocaleString()}${linkedContractAdType ? ` | ${linkedContractAdType}` : ''}`;
              itemTotal = contractTotalValue;
              // itemRemaining سيتم حسابه لاحقاً حسب التسلسل الزمني
            }
          }
        }
        
        // 6. ✅ استخراج رقم العقد من الملاحظات للدفعات الموزعة (مثل "توزيع على عقد 1127#")
        let targetContractNumber: number | null = payment.contract_number || null;
        if (!targetContractNumber && paymentNotes) {
          const distributedMatch = paymentNotes.match(/توزيع على عقد\s*#?(\d+)/);
          if (distributedMatch) {
            targetContractNumber = parseInt(distributedMatch[1]);
          }
        }
        
        // جلب نوع الإعلان من العقد المستهدف إذا لم يكن موجوداً
        if (!linkedContractAdType && targetContractNumber) {
          const targetContract = contractsData.find((c: any) => c.Contract_Number === targetContractNumber);
          if (targetContract) {
            linkedContractAdType = targetContract['Ad Type'] || '';
            if (!itemTotal) {
              itemTotal = Number(targetContract.Total) || 0;
            }
          }
        }

        // ✅ تحديث المرجع ليشمل نوع الإعلان
        if (targetContractNumber && linkedContractAdType && !paymentRef.includes(linkedContractAdType)) {
          paymentRef = `عقد-${targetContractNumber} (${linkedContractAdType})`;
        }

        // ✅ إضافة نوع الإعلان للملاحظات إذا وُجد
        let enrichedNotes = paymentNotes;
        if (linkedContractAdType && !paymentNotes.includes(linkedContractAdType)) {
          enrichedNotes = paymentNotes !== '—' 
            ? `${paymentNotes} | نوع: ${linkedContractAdType}`
            : `نوع: ${linkedContractAdType}`;
        }

        transactions.push({
          id: `payment-${payment.id}`,
          date: payment.paid_at,
          type: payment.entry_type || 'payment',
          description: `${paymentInfo.text}${descriptionSuffix ? ` - ${descriptionSuffix}` : ''}`,
          debit: 0,
          credit: Number(payment.amount) || 0,
          balance: 0,
          reference: paymentRef,
          notes: enrichedNotes,
          details: detailsText,
          itemTotal: itemTotal,
          itemRemaining: null, // سيتم حسابه لاحقاً حسب التسلسل الزمني
          hasDistributedPaymentId: !!payment.distributed_payment_id,
          distributedPaymentId: payment.distributed_payment_id || null,
          sourceInvoice: purchaseTitle || null,
          adType: linkedContractAdType || null,
          targetContractNumber: targetContractNumber,
        });
      });

      // ترتيب وحساب الرصيد
      transactions.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });

      // ✅ حساب مجموع كل دفعة موزعة
      const distributedPaymentTotals: Map<string, number> = new Map();
      transactions.forEach(t => {
        if (t.distributedPaymentId) {
          const current = distributedPaymentTotals.get(t.distributedPaymentId) || 0;
          distributedPaymentTotals.set(t.distributedPaymentId, current + t.credit);
        }
      });

      // ✅ إضافة المجموع لكل معاملة موزعة
      transactions.forEach(t => {
        if (t.distributedPaymentId) {
          t.distributedPaymentTotal = distributedPaymentTotals.get(t.distributedPaymentId) || 0;
        }
      });

      // ✅ حساب الرصيد التشغيلي + متبقي العنصر حسب التسلسل الزمني
      let runningBalance = 0;
      const contractPaymentTracker: Map<number, number> = new Map(); // تتبع المدفوع لكل عقد
      
      transactions.forEach(transaction => {
        runningBalance += transaction.debit - transaction.credit;
        transaction.balance = runningBalance;
        
        // حساب متبقي العنصر حسب التسلسل الزمني
        const contractNum = transaction.contractNumber || transaction.targetContractNumber;
        if (contractNum && transaction.itemTotal) {
          // إذا كان عقد (مدين) - تسجيل القيمة
          if (transaction.type === 'contract') {
            contractPaymentTracker.set(contractNum, 0);
            transaction.itemRemaining = transaction.itemTotal;
          }
          // إذا كان دفعة (دائن) - حساب المتبقي بعد هذه الدفعة
          else if (transaction.credit > 0) {
            const previousPaid = contractPaymentTracker.get(contractNum) || 0;
            const newPaid = previousPaid + transaction.credit;
            contractPaymentTracker.set(contractNum, newPaid);
            transaction.itemRemaining = Math.max(0, transaction.itemTotal - newPaid);
          }
        }
      });

      setAllTransactions(transactions);
    } catch (error) {
      console.error('Error loading account data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCustomerData();
      loadAccountData();
    }
  }, [open, customerId, customerName, startDate, endDate, excludeFriendRentals]);

  // ✅ حساب الإحصائيات
  const calculateStatistics = () => {
    let totalDebits = 0;
    let totalCredits = 0;
    let totalFriendRentals = 0;
    
    allTransactions.forEach(t => {
      totalDebits += t.debit;
      totalCredits += t.credit;
      
      // حساب إيجارات الشركات الصديقة
      if (t.type === 'friend_billboard_rental' || t.type === 'friend_rental_contract') {
        totalFriendRentals += t.credit;
      }
    });

    const activeContracts = contracts.filter(c => {
      if (!c['End Date']) return false;
      return new Date(c['End Date']) >= new Date();
    }).length;

    const totalPurchaseInvoices = allTransactions
      .filter(t => t.type === 'purchase_invoice')
      .reduce((sum, t) => sum + t.credit, 0);
    
    const totalSalesInvoices = allTransactions
      .filter(t => t.type === 'sales_invoice')
      .reduce((sum, t) => sum + t.debit, 0);

    const balance = totalDebits - totalCredits;
    const balanceWithoutFriendRentals = totalDebits - (totalCredits - totalFriendRentals);

    return {
      totalContracts: contracts.length,
      activeContracts,
      totalDebits,
      totalCredits,
      balance,
      balanceWithoutFriendRentals,
      totalFriendRentals,
      totalPayments: payments.length,
      totalPurchaseInvoices,
      totalSalesInvoices,
    };
  };

  // ✅ تحميل الشعار - يستخدم config من النظام الموحد
  const loadLogoAsDataUri = async (logoPath: string): Promise<string> => {
    try {
      const response = await fetch(logoPath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading logo:', error);
      return '';
    }
  };

  // ✅ طباعة كشف الحساب باستخدام MasterLayout الموحد
  const handlePrintStatement = async () => {
    if (!customerData) {
      toast.error('يجب تحميل بيانات العميل أولاً');
      return;
    }

    setIsGenerating(true);

    try {
      const statistics = calculateStatistics();
      
      await printStatement({
        customerData: {
          id: customerData.id,
          name: customerData.name,
          company: customerData.company,
          phone: customerData.phone,
          email: customerData.email,
        },
        transactions: allTransactions,
        statistics,
        currency,
        startDate,
        endDate,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error in handlePrintStatement:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير كشف الحساب للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const statistics = calculateStatistics();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="w-[69rem] max-w-[69rem] h-[85vh] max-h-[85vh] overflow-hidden">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            كشف حساب العميل
          </UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير كشف الحساب للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              {/* إعدادات الكشف */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <h3 className="font-semibold mb-4 text-primary">إعدادات كشف الحساب:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">من تاريخ:</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">إلى تاريخ:</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">العملة:</label>
                    <select
                      value={currency.code}
                      onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0])}
                      className="w-full p-2 border border-border rounded-md text-sm bg-input text-foreground"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.name} ({curr.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* خيار استثناء إيجارات الصديقة */}
                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="excludeFriendRentals"
                    checked={excludeFriendRentals}
                    onChange={(e) => setExcludeFriendRentals(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="excludeFriendRentals" className="text-sm cursor-pointer">
                    استثناء إيجارات الشركات الصديقة من الكشف
                  </label>
                </div>
              </div>

              {/* معلومات العميل */}
              {customerData && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">بيانات العميل:</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>الاسم:</strong> {customerData.name}</p>
                    {customerData.company && (
                      <p><strong>الشركة:</strong> {customerData.company}</p>
                    )}
                    {customerData.phone && (
                      <p><strong>الهاتف:</strong> {customerData.phone}</p>
                    )}
                    {customerData.email && (
                      <p><strong>البريد الإلكتروني:</strong> {customerData.email}</p>
                    )}
                    <p><strong>رقم العميل:</strong> {customerData.id}</p>
                  </div>
                </div>
              )}

              {/* الإحصائيات */}
              {!isLoading && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">إجمالي العقود</div>
                      <div className="expenses-preview-value">{formatArabicNumber(statistics.totalContracts)}</div>
                    </div>
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">العقود النشطة</div>
                      <div className="expenses-preview-value stat-green">{formatArabicNumber(statistics.activeContracts)}</div>
                    </div>
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">إجمالي المدين</div>
                      <div className="expenses-preview-value stat-red">{formatArabicNumber(statistics.totalDebits)} {currency.symbol}</div>
                    </div>
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">إجمالي الدائن</div>
                      <div className="expenses-preview-value stat-green">{formatArabicNumber(statistics.totalCredits)} {currency.symbol}</div>
                    </div>
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">المشتريات</div>
                      <div className="expenses-preview-value stat-purple">{formatArabicNumber(statistics.totalPurchaseInvoices)} {currency.symbol}</div>
                    </div>
                    <div className="expenses-preview-item">
                      <div className="expenses-preview-label">المبيعات</div>
                      <div className="expenses-preview-value stat-blue">{formatArabicNumber(statistics.totalSalesInvoices)} {currency.symbol}</div>
                    </div>
                  </div>
                  
                  {/* صف الأرصدة المتبقية - مفصولة */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="expenses-preview-item border-2 border-primary/50">
                      <div className="expenses-preview-label">المتبقي الإجمالي (بدون إيجارات الصديقة)</div>
                      <div className="expenses-preview-value text-primary text-lg font-bold">
                        {formatArabicNumber(statistics.balanceWithoutFriendRentals)} {currency.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">مستحق على العميل</div>
                    </div>
                    {statistics.totalFriendRentals > 0 && (
                      <div className="expenses-preview-item border border-amber-500/30 bg-amber-500/5">
                        <div className="expenses-preview-label text-amber-400">إيجارات اللوحات (شركة صديقة)</div>
                        <div className="expenses-preview-value text-amber-500">{formatArabicNumber(statistics.totalFriendRentals)} {currency.symbol}</div>
                        <div className="text-xs text-muted-foreground mt-1">سيتم توزيعها كدفعة</div>
                      </div>
                    )}
                    <div className="expenses-preview-item border border-muted">
                      <div className="expenses-preview-label">الرصيد النهائي (شامل كل شيء)</div>
                      <div className="expenses-preview-value text-muted-foreground">{formatArabicNumber(statistics.balance)} {currency.symbol}</div>
                      <div className="text-xs text-muted-foreground mt-1">بعد احتساب إيجارات الصديقة</div>
                    </div>
                  </div>
                </div>
              )}

              {/* جدول جميع الحركات */}
              {!isLoading && allTransactions.length > 0 && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">جميع حركات الحساب ({allTransactions.length}):</h3>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm border-collapse border border-border">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="border border-border p-2 text-center" style={{ width: '3%' }}>#</th>
                          <th className="border border-border p-2 text-center" style={{ width: '8%' }}>التاريخ</th>
                          <th className="border border-border p-2 text-center" style={{ width: '15%' }}>البيان</th>
                          <th className="border border-border p-2 text-center" style={{ width: '8%' }}>المرجع</th>
                          <th className="border border-border p-2 text-center" style={{ width: '8%' }}>مدين</th>
                          <th className="border border-border p-2 text-center" style={{ width: '8%' }}>دائن</th>
                          <th className="border border-border p-2 text-center" style={{ width: '9%' }}>قيمة العنصر</th>
                          <th className="border border-border p-2 text-center" style={{ width: '9%' }}>متبقي العنصر</th>
                          <th className="border border-border p-2 text-center" style={{ width: '8%' }}>الرصيد</th>
                          <th className="border border-border p-2 text-center" style={{ width: '24%' }}>الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTransactions.map((transaction, index) => (
                          <tr key={transaction.id} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                            <td className="border border-border p-2 text-center">{index + 1}</td>
                            <td className="border border-border p-2 text-center">
                              {transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY') : '—'}
                            </td>
                             <td className="border border-border p-2 text-right">
                               <span className={formatPaymentType(transaction.type, transaction.hasDistributedPaymentId).className}>
                                 {transaction.description}
                               </span>
                               {transaction.sourceInvoice && (
                                 <div className="text-xs text-muted-foreground mt-1">
                                   المصدر: {transaction.sourceInvoice}
                                 </div>
                               )}
                             </td>
                            <td className="border border-border p-2 text-center">{transaction.reference}</td>
                            <td className="border border-border p-2 text-center font-medium text-red-400">
                              {transaction.debit > 0 ? `${formatArabicNumber(transaction.debit)} ${currency.symbol}` : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-medium text-green-400">
                              {transaction.credit > 0 ? `${formatArabicNumber(transaction.credit)} ${currency.symbol}` : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-medium text-blue-400">
                              {transaction.itemTotal !== null && transaction.itemTotal !== undefined 
                                ? `${formatArabicNumber(transaction.itemTotal)} ${currency.symbol}` 
                                : transaction.originalAmount !== null && transaction.originalAmount !== undefined
                                  ? `${formatArabicNumber(transaction.originalAmount)} ${currency.symbol}`
                                  : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-medium text-amber-500">
                              {transaction.itemRemaining !== null && transaction.itemRemaining !== undefined 
                                ? `${formatArabicNumber(transaction.itemRemaining)} ${currency.symbol}` 
                                : transaction.remainingAmount !== null && transaction.remainingAmount !== undefined
                                  ? `${formatArabicNumber(transaction.remainingAmount)} ${currency.symbol}`
                                  : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-bold text-primary">
                              {formatArabicNumber(transaction.balance)} {currency.symbol}
                            </td>
                            <td className="border border-border p-2 text-right text-xs text-muted-foreground" style={{ maxWidth: '200px' }}>
                              {transaction.notes !== '—' ? transaction.notes : ''}
                              {transaction.adType && !transaction.notes?.includes(transaction.adType) && (
                                <span className="text-primary block mt-1">نوع: {transaction.adType}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* جدول العقود */}
              {!isLoading && contracts.length > 0 && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">العقود ({contracts.length}):</h3>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-sm border-collapse border border-border">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="border border-border p-2 text-center">رقم العقد</th>
                          <th className="border border-border p-2 text-center">التاريخ</th>
                          <th className="border border-border p-2 text-center">نوع الإعلان</th>
                          <th className="border border-border p-2 text-center">المبلغ</th>
                          <th className="border border-border p-2 text-center">المدفوع</th>
                          <th className="border border-border p-2 text-center">المتبقي</th>
                          <th className="border border-border p-2 text-center">تاريخ الانتهاء</th>
                          <th className="border border-border p-2 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contracts.map((contract, index) => {
                          const status = getContractStatus(contract['End Date']);
                          const contractTotal = Number(contract['Total']) || 0;
                          const contractPaid = Number(contract['Total Paid']) || 0;
                          const contractRemaining = contractTotal - contractPaid;
                          return (
                            <tr key={contract.Contract_Number} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                              <td className="border border-border p-2 text-center font-semibold">{contract.Contract_Number}</td>
                              <td className="border border-border p-2 text-center">
                                {contract['Contract Date'] ? new Date(contract['Contract Date']).toLocaleDateString('ar-LY') : '—'}
                              </td>
                              <td className="border border-border p-2 text-center">{contract['Ad Type'] || '—'}</td>
                              <td className="border border-border p-2 text-center text-primary font-medium">
                                {formatArabicNumber(contractTotal)} {currency.symbol}
                              </td>
                              <td className="border border-border p-2 text-center text-green-400 font-medium">
                                {formatArabicNumber(contractPaid)} {currency.symbol}
                              </td>
                              <td className="border border-border p-2 text-center text-red-400 font-medium">
                                {formatArabicNumber(contractRemaining)} {currency.symbol}
                              </td>
                              <td className="border border-border p-2 text-center">
                                {contract['End Date'] ? new Date(contract['End Date']).toLocaleDateString('ar-LY') : '—'}
                              </td>
                              <td className={`border border-border p-2 text-center ${status.className}`}>
                                {status.status}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* رسالة إذا لم توجد بيانات */}
              {!isLoading && allTransactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد حركات لهذا العميل</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button 
            onClick={handlePrintStatement}
            disabled={isGenerating || isLoading || allTransactions.length === 0}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {isGenerating ? 'جاري التحضير...' : 'طباعة كشف الحساب'}
          </Button>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
