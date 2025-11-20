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

  const printOverdueNotice = (payment: OverdueInstallment) => {
    const today = new Date();
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>إشعار تأخير دفعة - عقد ${payment.contractNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            font-family: 'Tajawal', 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            background: white;
            font-size: 13px;
            line-height: 1.5;
            color: #1a1a1a;
            max-width: 190mm;
            margin: 0 auto;
          }

          .page-wrapper {
            background: white;
            border: 2px solid #dc2626;
            border-radius: 8px;
            overflow: hidden;
            page-break-inside: avoid;
          }

          .notice-header {
            background: #dc2626;
            color: white;
            padding: 18px 24px;
            text-align: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .notice-header h1 {
            font-size: 22px;
            font-weight: 900;
            margin-bottom: 6px;
          }

          .notice-header .subtitle {
            font-size: 14px;
            opacity: 0.95;
          }

          .notice-body {
            padding: 20px;
          }

          .alert-banner {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 18px;
            text-align: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .alert-banner .text {
            color: #92400e;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
          }

          .info-grid {
            display: grid;
            gap: 10px;
            margin-bottom: 18px;
          }

          .info-card {
            background: #f9fafb;
            border: 1.5px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .info-label {
            color: #6b7280;
            font-size: 13px;
            font-weight: 600;
          }

          .info-value {
            color: #111827;
            font-size: 14px;
            font-weight: 700;
          }

          .overdue-badge {
            background: #fee2e2;
            border: 1.5px solid #dc2626;
            color: #991b1b;
            padding: 5px 10px;
            border-radius: 5px;
            font-weight: 700;
            font-size: 13px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .amount-section {
            background: #dc2626;
            color: white;
            padding: 18px;
            text-align: center;
            border-radius: 8px;
            margin: 18px 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .amount-label {
            font-size: 14px;
            opacity: 0.95;
            margin-bottom: 8px;
          }

          .amount-value {
            font-size: 28px;
            font-weight: 900;
          }

          .warning-box {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 18px 0;
            text-align: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .warning-title {
            color: #92400e;
            font-size: 15px;
            font-weight: 900;
            margin-bottom: 6px;
          }

          .warning-text {
            color: #78350f;
            font-size: 13px;
            line-height: 1.5;
          }

          .footer {
            background: #f9fafb;
            padding: 14px 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .footer-date {
            color: #6b7280;
            font-size: 11px;
            margin-bottom: 4px;
          }

          .footer-text {
            color: #9ca3af;
            font-size: 10px;
          }

          .divider {
            height: 2px;
            background: #dc2626;
            margin: 14px 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media print {
            body {
              padding: 0;
              background: white;
            }
            .page-wrapper {
              box-shadow: none;
              border: 2px solid #dc2626;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-wrapper">
          <div class="notice-header">
            <h1>إشعار تأخير دفعة</h1>
            <div class="subtitle">تنبيه رسمي بدفعة مستحقة</div>
          </div>

          <div class="notice-body">
            <div class="alert-banner">
              <div class="text">
                هذه الدفعة متأخرة عن موعد استحقاقها<br>
                يرجى المبادرة بالسداد في أقرب وقت
              </div>
            </div>

            <div class="info-grid">
              <div class="info-card">
                <span class="info-label">رقم العقد</span>
                <span class="info-value">#${payment.contractNumber}</span>
              </div>

              <div class="info-card">
                <span class="info-label">اسم العميل</span>
                <span class="info-value">${payment.customerName}</span>
              </div>

              <div class="info-card">
                <span class="info-label">تاريخ الاستحقاق</span>
                <span class="info-value">${new Date(payment.dueDate).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>

              <div class="info-card">
                <span class="info-label">مدة التأخير</span>
                <span class="overdue-badge">${payment.daysOverdue} يوم</span>
              </div>

              <div class="info-card">
                <span class="info-label">وصف الدفعة</span>
                <span class="info-value">${payment.description}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="amount-section">
              <div class="amount-label">المبلغ المستحق</div>
              <div class="amount-value">${payment.installmentAmount.toLocaleString('ar-LY')} د.ل</div>
            </div>

            <div class="warning-box">
              <div class="warning-title">تحذير هام</div>
              <div class="warning-text">
                يرجى سداد المبلغ المستحق في أقرب وقت ممكن<br>
                للحفاظ على سجلكم المالي الجيد معنا
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-date">
              تاريخ الطباعة: ${today.toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${today.toLocaleTimeString('ar-LY')}
            </div>
            <div class="footer-text">
              هذا إشعار رسمي صادر من نظام إدارة العقود والإعلانات
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => window.print(), 250);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
    }
  };

  const totalOverdue = filteredOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
  const totalInstallments = filteredOverdues.reduce((sum, c) => sum + c.overdueCount, 0);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <h1 className="text-3xl font-bold">جاري تحميل الدفعات المتأخرة...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">الدفعات المتأخرة</h1>
            <p className="text-muted-foreground">متابعة وإدارة الدفعات المتأخرة عن موعدها</p>
          </div>
        </div>
        <SendOverdueRemindersDialog customerOverdues={customerOverdues} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              {totalOverdue.toLocaleString('ar-LY')} <span className="text-lg">د.ل</span>
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
                          {customer.totalOverdue.toLocaleString('ar-LY')} د.ل
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
                                  <div><strong>المبلغ:</strong> {installment.installmentAmount.toLocaleString('ar-LY')} د.ل</div>
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
                                  <div><strong>المبلغ:</strong> {invoice.amount.toLocaleString('ar-LY')} د.ل</div>
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
                  <span className="font-bold text-destructive">{paymentDialog.installment.installmentAmount.toLocaleString('ar-LY')} د.ل</span>
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