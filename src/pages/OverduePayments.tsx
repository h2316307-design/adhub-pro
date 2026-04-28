import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Clock, DollarSign, FileText, TrendingDown, User, CreditCard, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendOverdueRemindersDialog } from '@/components/billing/SendOverdueRemindersDialog';
import { OverduePaymentsPrintDialog } from '@/components/billing/OverduePaymentsPrintDialog';
import { Printer } from 'lucide-react';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  installmentId?: string;
  adType?: string;
}

interface UnpaidPrintInvoice {
  invoiceId: string;
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
  adType?: string;
}

interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDueDate: string;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  unpaidInvoices: UnpaidPrintInvoice[];
}

export default function OverduePayments() {
  const navigate = useNavigate();
  const [customerOverdues, setCustomerOverdues] = useState<CustomerOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    installment: OverdueInstallment | null;
  }>({ open: false, installment: null });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedCustomerForPrint, setSelectedCustomerForPrint] = useState<CustomerOverdue | null>(null);

  // فلاتر البحث
  const [searchTerm, setSearchTerm] = useState('');
  const [minDays, setMinDays] = useState<number>(0);
  const [minAmount, setMinAmount] = useState<string>('');

  const filteredOverdues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minAmt = parseFloat(minAmount || '0');
    const minAmtSafe = isNaN(minAmt) ? 0 : minAmt;
    return customerOverdues.filter(c =>
      (!term || c.customerName.toLowerCase().includes(term)) &&
      c.oldestDaysOverdue >= minDays &&
      c.totalOverdue >= minAmtSafe
    );
  }, [customerOverdues, searchTerm, minDays, minAmount]);

  useEffect(() => {
    loadOverduePayments();
  }, []);

  const loadOverduePayments = async () => {
    try {
      setLoading(true);
      
      // استعلام محسّن: جلب العقود والدفعات بالتوازي
      const [contractsResult, paymentsResult, invoicesResult] = await Promise.all([
        supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type"')
          .not('installments_data', 'is', null),
        supabase
          .from('customer_payments')
          .select('contract_number, amount, paid_at'),
        supabase
          .from('printed_invoices')
          .select(`
            id, 
            contract_number, 
            customer_name, 
            customer_id, 
            total_amount, 
            created_at, 
            paid,
            Contract!printed_invoices_contract_number_fkey("Ad Type")
          `)
          .eq('paid', false)
      ]);

      if (contractsResult.error) {
        console.error('Error loading contracts:', contractsResult.error);
        toast.error('خطأ في تحميل البيانات');
        return;
      }

      const contracts = contractsResult.data || [];
      const allPayments = paymentsResult.data || [];
      const unpaidInvoices = invoicesResult.data || [];

      // تجميع الدفعات حسب رقم العقد
      const paymentsByContract = new Map<number, { amount: number; paid_at: string }[]>();
      allPayments.forEach(p => {
        if (!paymentsByContract.has(p.contract_number)) {
          paymentsByContract.set(p.contract_number, []);
        }
        paymentsByContract.get(p.contract_number)!.push(p);
      });

      const today = new Date();
      const overdue: OverdueInstallment[] = [];

      for (const contract of contracts) {
        try {
          let installments = [];
          
          if (typeof contract.installments_data === 'string') {
            installments = JSON.parse(contract.installments_data);
          } else if (Array.isArray(contract.installments_data)) {
            installments = contract.installments_data;
          }

          // ترتيب الدفعات وتراكمها زمنيًا
          const contractPayments = [...(paymentsByContract.get(contract.Contract_Number) || [])]
            .map(p => ({ amount: Number(p.amount) || 0, paid_at: p.paid_at }))
            .sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());

          // إجمالي ما تم دفعه حتى اليوم (يُوزَّع على الدفعات الأقدم أولاً)
          let paymentsRemaining = contractPayments.reduce((sum, p) => sum + p.amount, 0);

          // ترتيب الدفعات المستحقة زمنيًا
          const installmentsSorted = [...installments]
            .filter((i: any) => i.dueDate)
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          for (const inst of installmentsSorted) {
            const dueDate = new Date(inst.dueDate);
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // فقط الدفعات التي حان موعدها تعتبر متأخرة
            if (diffDays > 0) {
              const currentDue = Number(inst.amount) || 0;
              const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
              const overdueAmount = Math.max(0, currentDue - allocated);

              // خصم المبلغ المخصص من إجمالي المدفوعات المتاحة
              paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

              if (overdueAmount > 0) {
                overdue.push({
                  contractNumber: contract.Contract_Number,
                  customerName: contract['Customer Name'] || 'غير معروف',
                  customerId: contract.customer_id,
                  installmentAmount: overdueAmount,
                  dueDate: inst.dueDate,
                  description: inst.description || 'دفعة',
                  daysOverdue: diffDays,
                  adType: contract['Ad Type']
                });
              }
            }
          }
        } catch (e) {
          console.error('Error parsing installments for contract:', contract.Contract_Number, e);
        }
      }

      // معالجة فواتير الطباعة غير المسددة
      const unpaidInvoicesList: UnpaidPrintInvoice[] = [];

      for (const invoice of unpaidInvoices) {
        const createdDate = new Date(invoice.created_at);
        const diffTime = today.getTime() - createdDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        unpaidInvoicesList.push({
          invoiceId: invoice.id,
          contractNumber: invoice.contract_number,
          customerName: invoice.customer_name || 'غير معروف',
          customerId: invoice.customer_id,
          amount: Number(invoice.total_amount) || 0,
          createdAt: invoice.created_at,
          daysOverdue: diffDays,
          adType: (invoice as any).Contract?.['Ad Type']
        });
      }

      // Group by customer
      const customerMap = new Map<string, CustomerOverdue>();

      for (const item of overdue) {
        const key = item.customerId || item.customerName;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customerId: item.customerId,
            customerName: item.customerName,
            totalOverdue: 0,
            overdueCount: 0,
            oldestDueDate: item.dueDate,
            oldestDaysOverdue: item.daysOverdue,
            installments: [],
            unpaidInvoices: []
          });
        }

        const customer = customerMap.get(key)!;
        customer.totalOverdue += item.installmentAmount;
        customer.overdueCount += 1;
        customer.installments.push(item);

        if (new Date(item.dueDate) < new Date(customer.oldestDueDate)) {
          customer.oldestDueDate = item.dueDate;
          customer.oldestDaysOverdue = item.daysOverdue;
        }
      }

      // إضافة فواتير الطباعة غير المسددة للزبائن
      for (const invoice of unpaidInvoicesList) {
        const key = invoice.customerId || invoice.customerName;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            totalOverdue: 0,
            overdueCount: 0,
            oldestDueDate: invoice.createdAt,
            oldestDaysOverdue: invoice.daysOverdue,
            installments: [],
            unpaidInvoices: []
          });
        }

        const customer = customerMap.get(key)!;
        customer.totalOverdue += invoice.amount;
        customer.unpaidInvoices.push(invoice);

        if (new Date(invoice.createdAt) < new Date(customer.oldestDueDate)) {
          customer.oldestDueDate = invoice.createdAt;
          customer.oldestDaysOverdue = invoice.daysOverdue;
        }
      }

      const result = Array.from(customerMap.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);
      setCustomerOverdues(result);
    } catch (error) {
      console.error('Error loading overdue payments:', error);
      toast.error('خطأ في تحميل الدفعات المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentDialog.installment) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (amount > paymentDialog.installment.installmentAmount) {
      toast.error('المبلغ المدخل أكبر من المبلغ المستحق');
      return;
    }

    try {
      setProcessingPayment(true);

      const { error } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: paymentDialog.installment.customerId,
          customer_name: paymentDialog.installment.customerName,
          contract_number: paymentDialog.installment.contractNumber,
          amount: amount,
          paid_at: new Date().toISOString().split('T')[0],
          method: 'نقدي',
          notes: paymentNotes || `تسديد دفعة متأخرة - ${paymentDialog.installment.description}`,
          entry_type: 'payment',
        });

      if (error) {
        console.error('Error inserting payment:', error);
        throw error;
      }

      toast.success('تم تسجيل الدفعة بنجاح');
      setPaymentDialog({ open: false, installment: null });
      setPaymentAmount('');
      setPaymentNotes('');
      await loadOverduePayments();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setProcessingPayment(false);
    }
  };

  const openPaymentDialog = (installment: OverdueInstallment) => {
    setPaymentDialog({ open: true, installment });
    setPaymentAmount(installment.installmentAmount.toString());
    setPaymentNotes('');
  };

  const printOverdueNotice = async (payment: OverdueInstallment) => {
    const { generateOverdueNoticeHTML } = await import('@/lib/overdueNoticeGenerator');
    const html = await generateOverdueNoticeHTML({
      customerName: payment.customerName,
      contractNumber: payment.contractNumber,
      installmentNumber: 1,
      dueDate: payment.dueDate,
      amount: payment.installmentAmount,
      overdueDays: payment.daysOverdue,
      notes: payment.description,
    });
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, 'إشعار تأخير', 'billing-overdue');
  };

  const totalOverdue = filteredOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
  const totalInstallments = filteredOverdues.reduce((sum, c) => sum + c.overdueCount, 0);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">جاري تحميل الدفعات المتأخرة...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-destructive/10 rounded-xl flex items-center justify-center">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">الدفعات المتأخرة</h1>
            <p className="text-muted-foreground text-sm">متابعة وإدارة الدفعات المتأخرة</p>
          </div>
        </div>
        <SendOverdueRemindersDialog customerOverdues={customerOverdues} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label htmlFor="search-term">بحث بالاسم</Label>
          <Input id="search-term" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.slice(0,100))} placeholder="ابحث باسم الزبون" maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label>الحد الأدنى لأيام التأخير</Label>
          <Select value={String(minDays)} onValueChange={(v) => setMinDays(parseInt(v, 10) || 0)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="كل التأخيرات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">كل التأخيرات</SelectItem>
              <SelectItem value="7">7+ أيام</SelectItem>
              <SelectItem value="30">30+ يوم</SelectItem>
              <SelectItem value="60">60+ يوم</SelectItem>
              <SelectItem value="90">90+ يوم</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="min-amount">الحد الأدنى للمبلغ (د.ل)</Label>
          <Input id="min-amount" type="number" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value.slice(0,12))} placeholder="مثال: 1000" />
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setSearchTerm(''); setMinDays(0); setMinAmount(''); }}>إعادة تعيين</Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              عدد الزبائن المتأخرين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{customerOverdues.length}</div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              إجمالي الدفعات المتأخرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{totalInstallments}</div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              مجموع المبالغ المتأخرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {totalOverdue.toLocaleString('en-US')} <span className="text-lg">د.ل</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers with Overdue Payments */}
      {customerOverdues.length === 0 ? (
        <Card className="border-success">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-3 text-green-600">
              <DollarSign className="h-12 w-12" />
              <p className="text-xl font-medium">لا توجد دفعات متأخرة!</p>
              <p className="text-sm text-muted-foreground">جميع الدفعات محدثة.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              الزبائن المتأخرين في السداد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-3">
              {filteredOverdues.map((customer, index) => (
                <AccordionItem
                  key={`${customer.customerId || customer.customerName}-${index}`}
                  value={`customer-${index}`}
                  className="border border-destructive/20 rounded-lg bg-destructive/5"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between w-full px-4 py-3 border-b" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{customer.customerName}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              أقدم تأخير: {customer.oldestDaysOverdue} يوم
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {customer.overdueCount} دفعة متأخرة
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="hover:bg-blue-600 hover:text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedCustomerForPrint(customer);
                            setPrintDialogOpen(true);
                          }}
                        >
                          <Printer className="h-4 w-4 ml-2" />
                          طباعة كشف شامل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="hover:bg-primary hover:text-primary-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const name = encodeURIComponent(customer.customerName || '');
                            if (customer.customerId) {
                              navigate(`/admin/customer-billing?id=${customer.customerId}&name=${name}`);
                            } else if (customer.customerName) {
                              navigate(`/admin/customer-billing?name=${name}`);
                            } else {
                              toast.error('لا يمكن فتح صفحة الفواتير - معلومات العميل غير متوفرة');
                            }
                          }}
                        >
                          <Receipt className="h-4 w-4 ml-2" />
                          الفواتير
                        </Button>
                        <Badge variant="destructive" className="text-lg px-3 py-1">
                          {customer.totalOverdue.toLocaleString('en-US')} د.ل
                        </Badge>
                      </div>
                    </div>
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <span className="text-sm text-muted-foreground">عرض التفاصيل</span>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-3">
                      {customer.installments.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            دفعات العقود المتأخرة ({customer.installments.length})
                          </h4>
                          {customer.installments.map((installment, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    عقد #{installment.contractNumber}
                                  </Badge>
                                  {installment.adType && (
                                    <Badge variant="secondary" className="text-xs">
                                      {installment.adType}
                                    </Badge>
                                  )}
                                  <Badge variant="destructive" className="text-xs">
                                    {installment.daysOverdue} يوم
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div><strong>المبلغ:</strong> {installment.installmentAmount.toLocaleString('en-US')} د.ل</div>
                                  <div><strong>تاريخ الاستحقاق:</strong> {new Date(installment.dueDate).toLocaleDateString('ar-LY')}</div>
                                  <div><strong>الوصف:</strong> {installment.description}</div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openPaymentDialog(installment);
                                  }}
                                >
                                  <CreditCard className="h-4 w-4 ml-2" />
                                  تسديد
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    printOverdueNotice(installment);
                                  }}
                                >
                                  <FileText className="h-4 w-4 ml-2" />
                                  طباعة
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {customer.unpaidInvoices.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-orange-600 flex items-center gap-2">
                            <Receipt className="h-4 w-4" />
                            فواتير الطباعة غير المسددة ({customer.unpaidInvoices.length})
                          </h4>
                          {customer.unpaidInvoices.map((invoice, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs bg-white">
                                    عقد #{invoice.contractNumber}
                                  </Badge>
                                  {invoice.adType && (
                                    <Badge variant="secondary" className="text-xs">
                                      {invoice.adType}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs bg-orange-200">
                                    فاتورة طباعة
                                  </Badge>
                                  <Badge className="text-xs bg-orange-500 text-white">
                                    {invoice.daysOverdue} يوم
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-700 space-y-1">
                                  <div><strong>المبلغ:</strong> {invoice.amount.toLocaleString('en-US')} د.ل</div>
                                  <div><strong>تاريخ الإصدار:</strong> {new Date(invoice.createdAt).toLocaleDateString('ar-LY')}</div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const { error } = await supabase
                                        .from('printed_invoices')
                                        .update({ paid: true })
                                        .eq('id', invoice.invoiceId);

                                      if (error) throw error;

                                      toast.success('تم تسديد فاتورة الطباعة بنجاح');
                                      loadOverduePayments();
                                    } catch (error) {
                                      console.error('Error marking invoice as paid:', error);
                                      toast.error('خطأ في تسديد الفاتورة');
                                    }
                                  }}
                                >
                                  <CreditCard className="h-4 w-4 ml-2" />
                                  تسديد الفاتورة
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Dialog open={paymentDialog.open} onOpenChange={(open) => !processingPayment && setPaymentDialog({ open, installment: paymentDialog.installment })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تسديد دفعة متأخرة</DialogTitle>
          </DialogHeader>
          {paymentDialog.installment && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم العقد:</span>
                  <span className="font-bold">#{paymentDialog.installment.contractNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-bold">{paymentDialog.installment.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المبلغ المستحق:</span>
                  <span className="font-bold text-destructive">{paymentDialog.installment.installmentAmount.toLocaleString('en-US')} د.ل</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">أيام التأخير:</span>
                  <Badge variant="destructive">{paymentDialog.installment.daysOverdue} يوم</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount">مبلغ الدفعة *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  disabled={processingPayment}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">ملاحظات (اختياري)</Label>
                <Input
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="أدخل ملاحظات إضافية"
                  disabled={processingPayment}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPaymentDialog({ open: false, installment: null })}
              disabled={processingPayment}
            >
              إلغاء
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processingPayment}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingPayment ? 'جاري التسديد...' : 'تأكيد التسديد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      {selectedCustomerForPrint && (
        <OverduePaymentsPrintDialog
          open={printDialogOpen}
          onOpenChange={(open) => {
            setPrintDialogOpen(open);
            if (!open) setSelectedCustomerForPrint(null);
          }}
          customerOverdue={selectedCustomerForPrint}
        />
      )}
    </div>
  );
}