import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Search, CreditCard, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { DistributedPaymentDetailsDialog } from '@/components/billing/DistributedPaymentDetailsDialog';
import { PaymentsStatementPrintDialog } from '@/components/billing/PaymentsStatementPrintDialog';
import { Printer, Edit } from 'lucide-react';
import { calculateTotalRemainingDebt } from '@/components/billing/BillingUtils';
import './PaymentsReceiptsPage.css';

interface Payment {
  id: string;
  customer_id: string;
  customer_name: string;
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
}

export default function PaymentsReceiptsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    loadPayments();
  }, []);

  // دالة مساعدة لجلب جميع البيانات المطلوبة لحساب المتبقي من الدين
  const fetchAllFinancialData = async () => {
    try {
      const [contractsResult, salesInvoicesResult, printedInvoicesResult, purchaseInvoicesResult, discountsResult] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, customer_id, Total, "Customer Name"'),
        supabase.from('sales_invoices').select('customer_id, total_amount'),
        supabase.from('printed_invoices').select('customer_id, total_amount'),
        supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment'),
        supabase.from('customer_general_discounts').select('customer_id, discount_value, status').eq('status', 'active')
      ]);

      // تحقق من وجود أخطاء
      if (contractsResult.error) {
        console.error('خطأ في جلب العقود:', contractsResult.error);
      }
      if (salesInvoicesResult.error) {
        console.error('خطأ في جلب فواتير المبيعات:', salesInvoicesResult.error);
      }
      if (printedInvoicesResult.error) {
        console.error('خطأ في جلب الفواتير المطبوعة:', printedInvoicesResult.error);
      }
      if (purchaseInvoicesResult.error) {
        console.error('خطأ في جلب فواتير المشتريات:', purchaseInvoicesResult.error);
      }
      if (discountsResult.error) {
        console.error('خطأ في جلب الخصومات:', discountsResult.error);
      }

      return {
        contracts: contractsResult.data || [],
        salesInvoices: salesInvoicesResult.data || [],
        printedInvoices: printedInvoicesResult.data || [],
        purchaseInvoices: purchaseInvoicesResult.data || [],
        discounts: discountsResult.data || []
      };
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      return {
        contracts: [],
        salesInvoices: [],
        printedInvoices: [],
        purchaseInvoices: [],
        discounts: []
      };
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      // جلب الدفعات
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .order('paid_at', { ascending: false });

      if (paymentsError) {
        console.error('خطأ في جلب الدفعات:', paymentsError);
        throw paymentsError;
      }

      // جلب البيانات اللازمة لحساب المتبقي من الدين بشكل صحيح
      const financialData = await fetchAllFinancialData();

      if (!financialData) {
        throw new Error('فشل في جلب البيانات المالية');
      }

      // حساب الرصيد بعد كل دفعة مع المتبقي الصحيح
      const paymentsWithBalance = calculateBalances(
        paymentsData || [], 
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
      toast.error(`فشل في تحميل الدفعات والإيصالات: ${error.message || 'خطأ غير معروف'}`);
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
    
    // حساب إجمالي الخصومات لكل عميل
    const customerDiscounts: Record<string, number> = {};
    discounts.forEach(discount => {
      if (!customerDiscounts[discount.customer_id]) {
        customerDiscounts[discount.customer_id] = 0;
      }
      customerDiscounts[discount.customer_id] += Number(discount.discount_value) || 0;
    });
    
    return payments.map(payment => {
      const customerId = payment.customer_id;
      if (!customerBalances[customerId]) {
        customerBalances[customerId] = 0;
      }

      // تحديث الرصيد حسب نوع العملية
      if (payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment' || payment.entry_type === 'general_credit') {
        customerBalances[customerId] += Number(payment.amount);
      } else if (payment.entry_type === 'debt' || payment.entry_type === 'general_debit') {
        customerBalances[customerId] -= Number(payment.amount);
      }

      // حساب المتبقي من الدين الكلي باستخدام calculateTotalRemainingDebt
      const customerContracts = contracts.filter(c => c.customer_id === customerId);
      const customerPayments = payments.filter(p => p.customer_id === customerId);
      const customerSalesInvoices = salesInvoices.filter(inv => inv.customer_id === customerId);
      const customerPrintedInvoices = printedInvoices.filter(inv => inv.customer_id === customerId);
      const customerPurchaseInvoices = purchaseInvoices.filter(inv => inv.customer_id === customerId);
      const totalDiscounts = customerDiscounts[customerId] || 0;

      const remaining_debt = calculateTotalRemainingDebt(
        customerContracts,
        customerPayments,
        customerSalesInvoices,
        customerPrintedInvoices,
        customerPurchaseInvoices,
        totalDiscounts
      );

      return {
        ...payment,
        balance_after: customerBalances[customerId],
        remaining_debt: Math.max(0, remaining_debt)
      };
    });
  };

  const calculateStats = (data: Payment[]) => {
    const receipts = data.filter(p => 
      p.entry_type === 'receipt' || 
      p.entry_type === 'payment' || 
      p.entry_type === 'account_payment'
    );
    const debits = data.filter(p => 
      p.entry_type === 'debt' || 
      p.entry_type === 'general_debit'
    );

    const totalCredits = receipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalDebits = debits.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    setStats({
      totalPayments: data.length,
      totalReceipts: receipts.length,
      totalCredits,
      totalDebits
    });
  };

  const filteredPayments = payments.filter(payment =>
    payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.contract_number?.toString().includes(searchTerm)
  );

  const getEntryTypeText = (entryType: string): string => {
    switch (entryType) {
      case 'payment': return 'دفعة';
      case 'account_payment': return 'دفعة حساب';
      case 'receipt': return 'إيصال';
      case 'debt': return 'دين سابق';
      case 'invoice': return 'فاتورة';
      case 'general_debit': return 'وارد عام';
      case 'general_credit': return 'صادر عام';
      default: return entryType || '—';
    }
  };

  const getEntryTypeStyle = (entryType: string) => {
    switch (entryType) {
      case 'receipt':
      case 'payment':
      case 'account_payment':
      case 'general_credit':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'debt':
      case 'general_debit':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'invoice':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const handleViewCustomer = (customerId: string, customerName: string) => {
    navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleAddDistributedPayment = () => {
    // فتح نافذة اختيار العميل
    setCustomerSelectDialogOpen(true);
    loadCustomers();
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company, phone')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('فشل في تحميل قائمة العملاء');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSelectCustomer = (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName);
    setCustomerSelectDialogOpen(false);
    setDistributeDialogOpen(true);
  };

  const handleViewDistributedPayment = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('لم يتم العثور على الدفعة الموزعة');
        return;
      }
      
      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(
        data,
        financialData.contracts,
        financialData.salesInvoices,
        financialData.printedInvoices,
        financialData.purchaseInvoices,
        financialData.discounts
      );
      setSelectedDistributedPayments(paymentsWithBalance);
      setDistributedPaymentDialogOpen(true);
    } catch (error) {
      console.error('Error loading distributed payment:', error);
      toast.error('فشل في تحميل تفاصيل الدفعة الموزعة');
    }
  };

  const handlePrintDistributedPayment = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('لم يتم العثور على الدفعة الموزعة');
        return;
      }
      
      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(
        data,
        financialData.contracts,
        financialData.salesInvoices,
        financialData.printedInvoices,
        financialData.purchaseInvoices,
        financialData.discounts
      );
      setSelectedDistributedPayments(paymentsWithBalance);
      setDistributedPaymentDialogOpen(true);
    } catch (error) {
      console.error('Error loading distributed payment:', error);
      toast.error('فشل في تحميل تفاصيل الدفعة الموزعة');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm)
  );

  return (
    <div className="space-y-6 p-6">
      {/* الهيدر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الدفعات والإيصالات</h1>
          <p className="text-muted-foreground">إدارة وعرض جميع الدفعات والإيصالات المالية</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setStatementPrintDialogOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة كشف شامل
          </Button>
          <Button
            onClick={handleAddDistributedPayment}
            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" />
            دفعة موزعة
          </Button>
          <Button
            onClick={loadPayments}
            variant="outline"
            className="gap-2"
          >
            <Receipt className="h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">إجمالي المعاملات</p>
                <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalPayments}</h3>
              </div>
              <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full">
                <CreditCard className="h-6 w-6 text-blue-700 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">عدد الإيصالات</p>
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.totalReceipts}</h3>
              </div>
              <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full">
                <Receipt className="h-6 w-6 text-green-700 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">إجمالي الواردات</p>
                <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {stats.totalCredits.toLocaleString('ar-LY')} د.ل
                </h3>
              </div>
              <div className="p-3 bg-emerald-200 dark:bg-emerald-800 rounded-full">
                <TrendingUp className="h-6 w-6 text-emerald-700 dark:text-emerald-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">إجمالي الصادرات</p>
                <h3 className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {stats.totalDebits.toLocaleString('ar-LY')} د.ل
                </h3>
              </div>
              <div className="p-3 bg-red-200 dark:bg-red-800 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-700 dark:text-red-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث وخيارات الطباعة */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            بحث في المعاملات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="ابحث باسم العميل، رقم العقد، المرجع، أو الملاحظات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showCollectionDetails"
              checked={showCollectionDetails}
              onChange={(e) => setShowCollectionDetails(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="showCollectionDetails" className="cursor-pointer">
              إظهار بيانات التحصيل عبر الوسيط في الطباعة
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* جدول الدفعات */}
      <Card>
        <CardHeader>
          <CardTitle>
            جميع الدفعات والإيصالات ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">جارٍ التحميل...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد معاملات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الرصيد</TableHead>
                    <TableHead className="text-right">المتبقي من الدين</TableHead>
                    <TableHead className="text-right print:hidden">العقد</TableHead>
                    <TableHead className="text-right print:hidden">طريقة الدفع</TableHead>
                    <TableHead className="text-right print:hidden">المرجع</TableHead>
                    <TableHead className="text-right print:hidden">ملاحظات</TableHead>
                    <TableHead className="text-right print:hidden">مجمعة</TableHead>
                    <TableHead className="text-right print:hidden">إجراءات</TableHead>
                    {showCollectionDetails && isPrinting && (
                      <>
                        <TableHead className="text-right">المحصل</TableHead>
                        <TableHead className="text-right">المستلم</TableHead>
                        <TableHead className="text-right">عمولة الوسيط</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {payment.paid_at 
                          ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
                          : new Date(payment.created_at).toLocaleDateString('ar-LY')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium print:pointer-events-none"
                          onClick={() => !isPrinting && handleViewCustomer(payment.customer_id, payment.customer_name)}
                        >
                          {payment.customer_name}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge className={getEntryTypeStyle(payment.entry_type)}>
                          {getEntryTypeText(payment.entry_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="font-bold text-blue-600">
                        {(payment.balance_after || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className={`font-bold ${(payment.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(payment.remaining_debt || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="print:hidden">
                        {payment.contract_number ? (
                          <span className="font-mono">عقد #{payment.contract_number}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="print:hidden">{payment.method || '—'}</TableCell>
                      <TableCell className="print:hidden">{payment.reference || '—'}</TableCell>
                      <TableCell className="max-w-xs truncate print:hidden">
                        {payment.notes || '—'}
                      </TableCell>
                      <TableCell className="print:hidden">
                        {payment.distributed_payment_id ? (
                          <Badge variant="secondary">دفعة موزعة</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="print:hidden">
                        {payment.distributed_payment_id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDistributedPayment(payment.distributed_payment_id!)}
                              className="gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrintDistributedPayment(payment.distributed_payment_id!)}
                              className="gap-1"
                            >
                              <Printer className="h-3 w-3" />
                              طباعة
                            </Button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {showCollectionDetails && isPrinting && payment.collected_via_intermediary && (
                        <>
                          <TableCell>{payment.collector_name || '—'}</TableCell>
                          <TableCell>{payment.receiver_name || '—'}</TableCell>
                          <TableCell>
                            {payment.intermediary_commission 
                              ? `${Number(payment.intermediary_commission).toLocaleString('ar-LY')} د.ل`
                              : '—'}
                          </TableCell>
                        </>
                      )}
                      {showCollectionDetails && isPrinting && !payment.collected_via_intermediary && (
                        <>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة اختيار العميل */}
      <Dialog open={customerSelectDialogOpen} onOpenChange={setCustomerSelectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>اختيار العميل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>بحث عن عميل</Label>
              <Input
                placeholder="ابحث باسم العميل، الشركة، أو رقم الهاتف..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
              />
            </div>
            
            {loadingCustomers ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-muted-foreground">جارٍ التحميل...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا توجد نتائج</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleSelectCustomer(customer.id, customer.name)}
                  >
                    <div className="font-semibold">{customer.name}</div>
                    {customer.company && (
                      <div className="text-sm text-muted-foreground">{customer.company}</div>
                    )}
                    {customer.phone && (
                      <div className="text-sm text-muted-foreground">{customer.phone}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة إضافة دفعة موزعة */}
      <EnhancedDistributePaymentDialog
        open={distributeDialogOpen}
        onOpenChange={setDistributeDialogOpen}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onSuccess={() => {
          loadPayments();
          setDistributeDialogOpen(false);
          toast.success('تم إضافة الدفعة الموزعة بنجاح');
        }}
      />

      {/* نافذة عرض تفاصيل الدفعة الموزعة */}
      {selectedDistributedPayments.length > 0 && (
        <DistributedPaymentDetailsDialog
          open={distributedPaymentDialogOpen}
          onOpenChange={setDistributedPaymentDialogOpen}
          groupedPayments={selectedDistributedPayments as any}
          totalAmount={selectedDistributedPayments.reduce((sum, p) => sum + p.amount, 0)}
          onPrintCombined={() => {
            toast.info('طباعة مجمعة قيد التطوير');
          }}
          onPrintIndividual={(payment) => {
            toast.info('طباعة فردية قيد التطوير');
          }}
          onDelete={() => {
            toast.info('حذف قيد التطوير');
          }}
          customerName={selectedDistributedPayments[0]?.customer_name || ''}
        />
      )}

      {/* نافذة طباعة كشف شامل */}
      <PaymentsStatementPrintDialog
        open={statementPrintDialogOpen}
        onOpenChange={setStatementPrintDialogOpen}
        payments={filteredPayments}
      />
    </div>
  );
}
