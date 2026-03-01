import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Receipt, Search, CreditCard, TrendingUp, TrendingDown, Plus, ChevronDown, ChevronRight, Printer, Edit, Wallet, User, AlertCircle, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { DistributedPaymentDetailsDialog } from '@/components/billing/DistributedPaymentDetailsDialog';
import { PaymentsStatementPrintDialog } from '@/components/billing/PaymentsStatementPrintDialog';
import { calculateTotalRemainingDebt } from '@/components/billing/BillingUtils';
import './PaymentsReceiptsPage.css';

interface Payment {
  id: string;
  customer_id: string;
  customer_name: string;
  company_name?: string | null; // اسم الشركة
  amount: number;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
  entry_type: string;
  contract_number: number | null;
  distributed_payment_id: string | null;
  created_at: string;
  collector_name: string | null;
  receiver_name: string | null;
  intermediary_commission: number | null;
  collected_via_intermediary: boolean;
  balance_after: number;
  remaining_debt: number;
  purchase_invoice_id?: string | null;
  printed_invoice_id?: string | null;
  ad_type?: string | null;
}

interface CustodyInfo {
  custody_id: string;
  employee_name: string;
  initial_amount: number;
  current_balance: number;
}

interface GroupedPayment {
  id: string;
  distributedPaymentId: string;
  totalAmount: number;
  customerName: string;
  companyName?: string | null; // اسم الشركة
  customerId: string;
  method: string;
  paidAt: string;
  distributions: Payment[];
  custodyInfo?: CustodyInfo | null; // معلومات العهدة إن وجدت
}

export default function PaymentsReceiptsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adTypeFilter, setAdTypeFilter] = useState<string>('all');
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [customerSelectDialogOpen, setCustomerSelectDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalReceipts: 0,
    totalCredits: 0,
    totalDebits: 0
  });
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [distributedPaymentDialogOpen, setDistributedPaymentDialogOpen] = useState(false);
  const [selectedDistributedPayments, setSelectedDistributedPayments] = useState<Payment[]>([]);
  const [statementPrintDialogOpen, setStatementPrintDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [custodyDataMap, setCustodyDataMap] = useState<Record<string, CustodyInfo>>({});
  const distributeOpenFrameRef = useRef<number | null>(null);
  const [pendingDistributeOpen, setPendingDistributeOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    return () => {
      if (distributeOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(distributeOpenFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDistributeOpen || customerSelectDialogOpen || !selectedCustomerId) return;

    if (distributeOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(distributeOpenFrameRef.current);
    }

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
        setDistributeDialogOpen(true);
        setPendingDistributeOpen(false);
        distributeOpenFrameRef.current = null;
      });
      distributeOpenFrameRef.current = secondFrame;
    });

    distributeOpenFrameRef.current = firstFrame;
  }, [pendingDistributeOpen, customerSelectDialogOpen, selectedCustomerId]);

  const fetchAllFinancialData = async () => {
    try {
      const [contractsResult, salesInvoicesResult, printedInvoicesResult, purchaseInvoicesResult, discountsResult] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, customer_id, Total, "Customer Name"'),
        supabase.from('sales_invoices').select('customer_id, total_amount'),
        supabase.from('printed_invoices').select('customer_id, total_amount'),
        supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment'),
        supabase.from('customer_general_discounts').select('customer_id, discount_value, status').eq('status', 'active')
      ]);

      return {
        contracts: contractsResult.data || [],
        salesInvoices: salesInvoicesResult.data || [],
        printedInvoices: printedInvoicesResult.data || [],
        purchaseInvoices: purchaseInvoicesResult.data || [],
        discounts: discountsResult.data || []
      };
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      return { contracts: [], salesInvoices: [], printedInvoices: [], purchaseInvoices: [], discounts: [] };
    }
  };

  // ✅ جلب بيانات العهد المرتبطة بالدفعات الموزعة
  const loadCustodyData = async (distributedPaymentIds: string[]) => {
    if (distributedPaymentIds.length === 0) return {};
    
    try {
      const { data: custodyData } = await supabase
        .from('custody_accounts')
        .select(`
          id,
          source_payment_id,
          initial_amount,
          current_balance,
          employee_id,
          employees(name)
        `)
        .in('source_payment_id', distributedPaymentIds);

      const custodyMap: Record<string, CustodyInfo> = {};
      if (custodyData) {
        custodyData.forEach((custody: any) => {
          if (custody.source_payment_id) {
            custodyMap[custody.source_payment_id] = {
              custody_id: custody.id,
              employee_name: custody.employees?.name || 'غير معروف',
              initial_amount: custody.initial_amount || 0,
              current_balance: custody.current_balance || 0,
            };
          }
        });
      }
      return custodyMap;
    } catch (error) {
      console.error('خطأ في جلب بيانات العهد:', error);
      return {};
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      // جلب الدفعات مع نوع الإعلان من العقود
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .order('paid_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // جلب أنواع الإعلانات من العقود
      const { data: contractsAdTypes } = await supabase
        .from('Contract')
        .select('Contract_Number, "Ad Type"');
      
      const adTypeMap: Record<number, string> = {};
      (contractsAdTypes || []).forEach((c: any) => {
        if (c.Contract_Number && c['Ad Type']) {
          adTypeMap[c.Contract_Number] = c['Ad Type'];
        }
      });

      // ✅ جلب أسماء الشركات من جدول العملاء
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, company');
      
      const customerCompanyMap: Record<string, string> = {};
      (customersData || []).forEach((c: any) => {
        if (c.id && c.company) {
          customerCompanyMap[c.id] = c.company;
        }
      });

      // ✅ جلب فواتير المشتريات مع اسم الزبون (المورد)
      const { data: existingPurchaseInvoices } = await supabase
        .from('purchase_invoices')
        .select('id, customer_name, customer_id, invoice_name');
      
      const existingPurchaseInvoiceIds = new Set(existingPurchaseInvoices?.map(inv => inv.id) || []);
      const purchaseInvoiceCustomerMap: Record<string, string> = {};
      (existingPurchaseInvoices || []).forEach((inv: any) => {
        if (inv.id) {
          purchaseInvoiceCustomerMap[inv.id] = inv.invoice_name || inv.customer_name || 'مورد';
        }
      });

      // ✅ جلب فواتير الطباعة
      const { data: existingPrintedInvoices } = await supabase
        .from('printed_invoices')
        .select('id, printer_name, customer_name');
      
      const existingPrintedInvoiceIds = new Set(existingPrintedInvoices?.map(inv => inv.id) || []);
      const printedInvoiceMap: Record<string, { printer: string; customer: string }> = {};
      (existingPrintedInvoices || []).forEach((inv: any) => {
        if (inv.id) {
          printedInvoiceMap[inv.id] = {
            printer: inv.printer_name || '',
            customer: inv.customer_name || ''
          };
        }
      });
      
      const filteredPaymentsData = (paymentsData || []).filter(payment => {
        // ✅ تصفية فواتير المشتريات المحذوفة
        if (payment.entry_type === 'purchase_invoice' && payment.purchase_invoice_id) {
          return existingPurchaseInvoiceIds.has(payment.purchase_invoice_id);
        }
        // ✅ تصفية فواتير الطباعة المحذوفة (جميع الأنواع التي لها printed_invoice_id)
        if (payment.printed_invoice_id) {
          return existingPrintedInvoiceIds.has(payment.printed_invoice_id);
        }
        return true;
      }).map(payment => {
        let customerName = payment.customer_name;
        // ✅ اسم الشركة يظهر دائماً من جدول العملاء
        let companyName = customerCompanyMap[payment.customer_id] || null;
        
        // ✅ إظهار اسم المورد لفواتير المشتريات
        if (payment.entry_type === 'purchase_invoice' && payment.purchase_invoice_id) {
          const supplierInfo = purchaseInvoiceCustomerMap[payment.purchase_invoice_id];
          if (supplierInfo) {
            customerName = `${payment.customer_name || ''} ← ${supplierInfo}`;
          }
        }
        
        // ✅ إظهار اسم المطبعة لفواتير الطباعة (كإضافة لاسم الشركة)
        if (payment.printed_invoice_id) {
          const printInfo = printedInvoiceMap[payment.printed_invoice_id];
          if (printInfo?.printer) {
            // إضافة اسم المطبعة مع الحفاظ على اسم الشركة
            const printerLabel = `مطبعة: ${printInfo.printer}`;
            companyName = companyName ? `${companyName} | ${printerLabel}` : printerLabel;
          }
        }
        
        return {
          ...payment,
          customer_name: customerName,
          company_name: companyName,
          ad_type: payment.contract_number ? adTypeMap[payment.contract_number] : null
        };
      });

      // ✅ جلب بيانات العهد
      const distributedPaymentIds = [...new Set(filteredPaymentsData.filter(p => p.distributed_payment_id).map(p => p.distributed_payment_id as string))];
      const custodyMap = await loadCustodyData(distributedPaymentIds);
      setCustodyDataMap(custodyMap);

      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(
        filteredPaymentsData, 
        financialData.contracts,
        financialData.salesInvoices,
        financialData.printedInvoices,
        financialData.purchaseInvoices,
        financialData.discounts
      );
      setPayments(paymentsWithBalance);
      calculateStats(paymentsWithBalance);
    } catch (error: any) {
      console.error('خطأ في تحميل الدفعات:', error);
      toast.error(`فشل في تحميل الدفعات والإيصالات`);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (
    payments: any[], 
    contracts: any[],
    salesInvoices: any[],
    printedInvoices: any[],
    purchaseInvoices: any[],
    discounts: any[]
  ): Payment[] => {
    const customerBalances: Record<string, number> = {};
    const customerDiscounts: Record<string, number> = {};
    
    discounts.forEach(discount => {
      if (!customerDiscounts[discount.customer_id]) customerDiscounts[discount.customer_id] = 0;
      customerDiscounts[discount.customer_id] += Number(discount.discount_value) || 0;
    });
    
    return payments.map(payment => {
      const customerId = payment.customer_id;
      if (!customerBalances[customerId]) customerBalances[customerId] = 0;

      if (['receipt', 'payment', 'account_payment', 'general_credit'].includes(payment.entry_type)) {
        customerBalances[customerId] += Number(payment.amount);
      } else if (['debt', 'general_debit'].includes(payment.entry_type)) {
        customerBalances[customerId] -= Number(payment.amount);
      }

      const customerContracts = contracts.filter(c => c.customer_id === customerId);
      const customerPayments = payments.filter(p => p.customer_id === customerId);
      const customerSalesInvoices = salesInvoices.filter(inv => inv.customer_id === customerId);
      const customerPrintedInvoices = printedInvoices.filter(inv => inv.customer_id === customerId);
      const customerPurchaseInvoices = purchaseInvoices.filter(inv => inv.customer_id === customerId);
      const totalDiscounts = customerDiscounts[customerId] || 0;

      const remaining_debt = calculateTotalRemainingDebt(
        customerContracts, customerPayments, customerSalesInvoices,
        customerPrintedInvoices, customerPurchaseInvoices, totalDiscounts
      );

      return { ...payment, balance_after: customerBalances[customerId], remaining_debt: Math.max(0, remaining_debt) };
    });
  };

  const calculateStats = (data: Payment[]) => {
    const receipts = data.filter(p => ['receipt', 'payment', 'account_payment'].includes(p.entry_type));
    const debits = data.filter(p => ['debt', 'general_debit'].includes(p.entry_type));
    setStats({
      totalPayments: data.length,
      totalReceipts: receipts.length,
      totalCredits: receipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      totalDebits: debits.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    });
  };

  const uniqueAdTypes = useMemo(() => {
    const types = new Set<string>();
    payments.forEach(p => { if (p.ad_type) types.add(p.ad_type); });
    return Array.from(types).sort();
  }, [payments]);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.contract_number?.toString().includes(searchTerm);
    const matchesAdType = adTypeFilter === 'all' || payment.ad_type === adTypeFilter;
    return matchesSearch && matchesAdType;
  });

  const { groupedPayments, standalonePayments } = useMemo(() => {
    const groups: Record<string, GroupedPayment> = {};
    const standalone: Payment[] = [];
    
    filteredPayments.forEach(payment => {
      if (payment.distributed_payment_id) {
        const groupId = payment.distributed_payment_id;
        if (!groups[groupId]) {
          // ✅ إضافة معلومات العهدة إن وجدت
          const custodyInfo = custodyDataMap[groupId] || null;
          
          groups[groupId] = {
            id: groupId,
            distributedPaymentId: groupId,
            totalAmount: 0,
            customerName: payment.customer_name,
            companyName: payment.company_name, // إضافة اسم الشركة للمجموعة
            customerId: payment.customer_id,
            method: payment.method,
            paidAt: payment.paid_at,
            distributions: [],
            custodyInfo
          };
        }
        groups[groupId].totalAmount += Number(payment.amount) || 0;
        groups[groupId].distributions.push(payment);
      } else {
        standalone.push(payment);
      }
    });

    Object.values(groups).forEach(group => {
      group.distributions.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    });

    return { groupedPayments: Object.values(groups), standalonePayments: standalone };
  }, [filteredPayments, custodyDataMap]);

  const sortedItems = useMemo(() => {
    const items: Array<{ type: 'group' | 'payment'; data: GroupedPayment | Payment; date: Date }> = [];
    groupedPayments.forEach(group => items.push({ type: 'group', data: group, date: new Date(group.paidAt) }));
    standalonePayments.forEach(payment => items.push({ type: 'payment', data: payment, date: new Date(payment.paid_at) }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [groupedPayments, standalonePayments]);

  const getEntryTypeText = (entryType: string): string => {
    const types: Record<string, string> = {
      'payment': 'دفعة', 'account_payment': 'دفعة حساب', 'receipt': 'إيصال',
      'debt': 'دين سابق', 'invoice': 'فاتورة', 'general_debit': 'وارد عام',
      'general_credit': 'صادر عام', 'purchase_invoice': 'فاتورة مشتريات',
      'sales_invoice': 'فاتورة مبيعات', 'printed_invoice': 'فاتورة طباعة'
    };
    return types[entryType] || entryType || '—';
  };

  const getEntryTypeStyle = (entryType: string) => {
    if (['receipt', 'payment', 'account_payment', 'general_credit'].includes(entryType)) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    }
    if (['debt', 'general_debit'].includes(entryType)) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    }
    if (['invoice', 'purchase_invoice'].includes(entryType)) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
  };

  const handleViewCustomer = (customerId: string, customerName: string) => {
    navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`);
  };

  const handleAddDistributedPayment = () => {
    setPendingDistributeOpen(false);
    setCustomerSelectDialogOpen(true);
    loadCustomers();
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      // ✅ جلب العملاء الذين لديهم معاملات أو عقود فقط
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('id, name, company, phone')
        .order('name');
      
      if (error) throw error;
      
      // ✅ جلب العملاء الذين لديهم دفعات أو عقود
      const [paymentsResult, contractsResult] = await Promise.all([
        supabase.from('customer_payments').select('customer_id'),
        supabase.from('Contract').select('customer_id')
      ]);
      
      const activeCustomerIds = new Set<string>();
      (paymentsResult.data || []).forEach(p => p.customer_id && activeCustomerIds.add(p.customer_id));
      (contractsResult.data || []).forEach(c => c.customer_id && activeCustomerIds.add(c.customer_id));
      
      // ✅ تصفية العملاء النشطين فقط
      const activeCustomers = (customersData || []).filter(c => activeCustomerIds.has(c.id));
      setCustomers(activeCustomers);
    } catch (error) {
      toast.error('فشل في تحميل قائمة العملاء');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSelectCustomer = (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName);
    setPendingDistributeOpen(true);
    setCustomerSelectDialogOpen(false);
  };

  const handleViewDistributedPayment = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase.from('customer_payments').select('*').eq('distributed_payment_id', distributedPaymentId);
      if (error) throw error;
      if (!data || data.length === 0) { toast.error('لم يتم العثور على الدفعة'); return; }
      
      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(data, financialData.contracts, financialData.salesInvoices, financialData.printedInvoices, financialData.purchaseInvoices, financialData.discounts);
      setSelectedDistributedPayments(paymentsWithBalance);
      setDistributedPaymentDialogOpen(true);
    } catch (error) {
      toast.error('فشل في تحميل تفاصيل الدفعة');
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm)
  );

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الدفعات والإيصالات</h1>
          <p className="text-muted-foreground">إدارة وعرض جميع الدفعات والإيصالات المالية</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => setStatementPrintDialogOpen(true)} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />طباعة كشف
          </Button>
          <Button onClick={handleAddDistributedPayment} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />دفعة موزعة
          </Button>
          <Button onClick={loadPayments} variant="outline" className="gap-2">
            <Receipt className="h-4 w-4" />تحديث
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المعاملات</p>
                <h3 className="text-2xl font-bold text-foreground font-numbers">{stats.totalPayments}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عدد الإيصالات</p>
                <h3 className="text-2xl font-bold text-foreground font-numbers">{stats.totalReceipts}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الواردات</p>
                <h3 className="text-xl font-bold text-green-600 font-numbers">{stats.totalCredits.toLocaleString('ar-LY')} د.ل</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الصادرات</p>
                <h3 className="text-xl font-bold text-red-600 font-numbers">{stats.totalDebits.toLocaleString('ar-LY')} د.ل</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <Input
                placeholder="ابحث باسم العميل، رقم العقد، أو الملاحظات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
              <SelectTrigger className="w-[160px] shrink-0">
                <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                <SelectValue placeholder="نوع الإعلان" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {uniqueAdTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950">{groupedPayments.length} مجمعة</Badge>
              <Badge variant="outline">{standalonePayments.length} مستقلة</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-l from-muted/50 to-transparent">
          <CardTitle className="text-lg">جميع الدفعات والإيصالات ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">جارٍ التحميل...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد معاملات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table */}
              <table className="w-full">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="text-right px-3 py-3 font-semibold text-sm">التاريخ</th>
                    <th className="text-right px-3 py-3 font-semibold text-sm">العميل</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">النوع</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">نوع الإعلان</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">المبلغ</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">المتبقي</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">العقد</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">الطريقة</th>
                    <th className="text-center px-2 py-3 font-semibold text-sm">الإجراءات</th>
                  </tr>
                </thead>
              
                <tbody className="divide-y divide-border">
                  {sortedItems.map((item, itemIndex) => {
                    if (item.type === 'group') {
                      const group = item.data as GroupedPayment;
                      const isExpanded = expandedGroups.has(group.id);
                      const contractsList = [...new Set(group.distributions.filter(d => d.contract_number).map(d => d.contract_number))];
                      const hasCustody = !!group.custodyInfo;
                      // ✅ جمع أنواع الإعلانات من التوزيعات
                      const adTypes = [...new Set(group.distributions.filter(d => d.ad_type).map(d => d.ad_type))];
                      
                      return (
                        <React.Fragment key={group.id}>
                          {/* Group Header Row */}
                          <tr 
                            className="bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 cursor-pointer transition-colors"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
                                <span className="font-medium text-sm">{new Date(group.paidAt).toLocaleDateString('ar-LY')}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Button variant="link" className="p-0 h-auto font-bold text-base text-foreground hover:text-purple-600" onClick={(e) => { e.stopPropagation(); handleViewCustomer(group.customerId, group.customerName); }}>
                                    {group.customerName}
                                  </Button>
                                  {hasCustody && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 text-xs gap-1">
                                      <Wallet className="h-3 w-3" />عهدة
                                    </Badge>
                                  )}
                                </div>
                                {group.companyName && (
                                  <span className="text-xs text-muted-foreground">{group.companyName}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                                مجمعة ({group.distributions.length})
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-center">
                              {adTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {adTypes.slice(0, 2).map((ad, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{ad}</Badge>
                                  ))}
                                  {adTypes.length > 2 && <span className="text-xs text-muted-foreground">+{adTypes.length - 2}</span>}
                                </div>
                              ) : <span className="text-muted-foreground text-sm">—</span>}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className="font-bold text-lg text-purple-700 dark:text-purple-300">
                                {group.totalAmount.toLocaleString('ar-LY')} <span className="text-sm">د.ل</span>
                              </span>
                            </td>
                            <td className={`px-2 py-2 text-center font-bold text-base ${(group.distributions[0]?.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {(group.distributions[0]?.remaining_debt || 0).toLocaleString('ar-LY')}
                            </td>
                            <td className="px-2 py-2 text-center text-sm text-muted-foreground">
                              {contractsList.length > 0 ? contractsList.slice(0, 2).map(c => `#${c}`).join('، ') : '—'}
                            </td>
                            <td className="px-2 py-2 text-center text-sm text-muted-foreground">
                              {group.method || '—'}
                            </td>
                            <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" onClick={() => handleViewDistributedPayment(group.distributedPaymentId)} className="h-7 px-2 text-xs">
                                <Edit className="h-3 w-3 ml-1" />تفاصيل
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Expanded Content */}
                          {isExpanded && (
                            <>
                              {/* Custody Info */}
                              {hasCustody && group.custodyInfo && (
                                <tr className="bg-amber-50/50 dark:bg-amber-950/20">
                                  <td colSpan={9} className="px-6 py-2 border-r-4 border-amber-400">
                                    <div className="flex items-center gap-4 flex-wrap text-sm">
                                      <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-amber-600" />
                                        <span className="font-bold text-amber-800 dark:text-amber-200">عهدة</span>
                                      </div>
                                      <span className="text-muted-foreground">لدى: <strong className="text-foreground">{group.custodyInfo.employee_name}</strong></span>
                                      <span className="text-muted-foreground">المبلغ: <strong className="text-amber-700">{group.custodyInfo.initial_amount.toLocaleString('ar-LY')} د.ل</strong></span>
                                      <span className="text-muted-foreground">المتبقي: <strong className={group.custodyInfo.current_balance > 0 ? 'text-red-600' : 'text-green-600'}>{group.custodyInfo.current_balance.toLocaleString('ar-LY')} د.ل</strong></span>
                                      {group.custodyInfo.current_balance === 0 && <Badge className="bg-green-100 text-green-700 text-xs">✓ مسددة</Badge>}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              
                              {/* Distributions */}
                              {group.distributions.map((dist, distIndex) => (
                                <tr key={dist.id} className={`border-r-4 border-purple-400 ${distIndex % 2 === 0 ? 'bg-muted/30' : 'bg-muted/10'}`}>
                                  <td className="px-5 py-2 text-sm text-muted-foreground">
                                    <span className="text-purple-400 ml-1">↳</span>
                                    {new Date(dist.paid_at).toLocaleDateString('ar-LY')}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">
                                    {dist.notes || '—'}
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <Badge className={`${getEntryTypeStyle(dist.entry_type)} text-xs`}>{getEntryTypeText(dist.entry_type)}</Badge>
                                  </td>
                                  <td className="px-2 py-2 text-center text-xs text-muted-foreground">{dist.ad_type || '—'}</td>
                                  <td className="px-2 py-2 text-center font-semibold text-base">
                                    {(Number(dist.amount) || 0).toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground">د.ل</span>
                                  </td>
                                  <td className="px-2 py-2 text-center text-muted-foreground">—</td>
                                  <td className="px-2 py-2 text-center text-sm text-primary font-medium">
                                    {dist.contract_number ? `#${dist.contract_number}` : '—'}
                                  </td>
                                  <td className="px-2 py-2"></td>
                                  <td className="px-2 py-2"></td>
                                </tr>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      );
                    } else {
                      const payment = item.data as Payment;
                      return (
                        <tr key={payment.id} className={`hover:bg-muted/50 transition-colors ${itemIndex % 2 === 0 ? 'bg-muted/10' : ''}`}>
                          <td className="px-3 py-2 text-sm font-medium">
                            {new Date(payment.paid_at || payment.created_at).toLocaleDateString('ar-LY')}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <Button variant="link" className="p-0 h-auto font-bold text-base text-foreground hover:text-primary justify-start" onClick={() => handleViewCustomer(payment.customer_id, payment.customer_name)}>
                                {payment.customer_name}
                              </Button>
                              {payment.company_name && (
                                <span className="text-xs text-muted-foreground">{payment.company_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Badge className={`${getEntryTypeStyle(payment.entry_type)} text-xs`}>{getEntryTypeText(payment.entry_type)}</Badge>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {payment.ad_type ? <Badge variant="outline" className="text-xs">{payment.ad_type}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                          </td>
                          <td className={`px-2 py-2 text-center font-bold text-lg ${Number(payment.amount) < 0 ? 'text-red-600' : ''}`}>
                            {(Number(payment.amount) || 0).toLocaleString('ar-LY')} <span className="text-sm text-muted-foreground">د.ل</span>
                          </td>
                          <td className={`px-2 py-2 text-center font-bold text-base ${(payment.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(payment.remaining_debt || 0).toLocaleString('ar-LY')}
                          </td>
                          <td className="px-2 py-2 text-center text-sm text-primary font-medium">
                            {payment.contract_number ? `#${payment.contract_number}` : '—'}
                          </td>
                          <td className="px-2 py-2 text-center text-sm text-muted-foreground">
                            {payment.method || '—'}
                          </td>
                          <td className="px-2 py-2 text-center"></td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Select Dialog - Redesigned */}
      {!distributeDialogOpen && (
        <Dialog open={customerSelectDialogOpen} onOpenChange={setCustomerSelectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-2xl">
          <DialogHeader className="border-b border-border/50 pb-4 bg-gradient-to-l from-primary/5 to-transparent -mx-6 -mt-6 px-6 pt-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">اختيار العميل</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">اختر العميل لإنشاء دفعة موزعة</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col pt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث باسم العميل، الشركة، أو رقم الهاتف..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="pr-10 h-11 bg-background/80 text-base"
                autoFocus
              />
            </div>
            
            {loadingCustomers ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
                <p className="text-muted-foreground text-sm">جاري تحميل العملاء...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">لا توجد نتائج</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border border-border/50 rounded-xl divide-y divide-border/30">
                <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground sticky top-0 z-10">
                  {filteredCustomers.length} عميل
                </div>
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer transition-all duration-200 group"
                    onClick={() => handleSelectCustomer(customer.id, customer.name)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0 group-hover:from-primary/30 group-hover:to-primary/10 transition-all">
                      {customer.name?.charAt(0) || '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{customer.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {customer.company && <span className="truncate">{customer.company}</span>}
                        {customer.phone && (
                          <>
                            {customer.company && <span>•</span>}
                            <span dir="ltr">{customer.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Distribute Payment Dialog */}
      <EnhancedDistributePaymentDialog
        open={distributeDialogOpen}
        onOpenChange={(isOpen) => {
          setDistributeDialogOpen(isOpen);
          if (!isOpen) {
            setSelectedCustomerId('');
            setSelectedCustomerName('');
            setPendingDistributeOpen(false);
            document.body.style.pointerEvents = '';
          }
        }}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onSuccess={() => {
          loadPayments();
          setDistributeDialogOpen(false);
          toast.success('تم إضافة الدفعة الموزعة بنجاح');
        }}
      />

      {/* Distributed Payment Details Dialog */}
      {selectedDistributedPayments.length > 0 && (
        <DistributedPaymentDetailsDialog
          open={distributedPaymentDialogOpen}
          onOpenChange={setDistributedPaymentDialogOpen}
          groupedPayments={selectedDistributedPayments as any}
          totalAmount={selectedDistributedPayments.reduce((sum, p) => sum + p.amount, 0)}
          onPrintCombined={() => toast.info('طباعة مجمعة قيد التطوير')}
          onPrintIndividual={() => toast.info('طباعة فردية قيد التطوير')}
          onDelete={() => toast.info('حذف قيد التطوير')}
          customerName={selectedDistributedPayments[0]?.customer_name || ''}
        />
      )}

      {/* Print Statement Dialog */}
      <PaymentsStatementPrintDialog
        open={statementPrintDialogOpen}
        onOpenChange={setStatementPrintDialogOpen}
        payments={filteredPayments}
      />
    </div>
  );
}
