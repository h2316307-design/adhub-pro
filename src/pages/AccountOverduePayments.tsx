import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Clock, DollarSign, User, CreditCard, Receipt, TrendingDown, MessageCircle, ArrowUpDown, Calendar, Search, Filter, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

interface UnpaidInvoice {
  invoiceId: string;
  contractNumber: number | null;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
  adType?: string;
}

interface CustomerAccountOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  invoicesCount: number;
  oldestDate: string;
  oldestDaysOverdue: number;
  invoices: UnpaidInvoice[];
}

export default function AccountOverduePayments() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerAccountOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Map<string, string>>(new Map());
  const { sendMessage: sendWhatsApp } = useSendWhatsApp();

  // فلاتر
  const [searchTerm, setSearchTerm] = useState('');
  const [minDays, setMinDays] = useState<number>(0);
  const [minAmount, setMinAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'oldest' | 'newest'>('oldest');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: invoices, error } = await supabase
        .from('printed_invoices')
        .select(`id, contract_number, customer_name, customer_id, total_amount, created_at, paid`)
        .eq('paid', false);

      if (error) {
        console.error('Error loading unpaid invoices:', error);
        toast.error('خطأ في تحميل البيانات');
        return;
      }

      // ✅ جلب خصومات المهام المجمعة المرتبطة بهذه الفواتير
      const invoiceIds = (invoices || []).map((i: any) => i.id);
      const ctDiscountByInvoice = new Map<string, number>();
      const ctByInvoice = new Map<string, { customerTotal: number; paid: number; discount: number }>();
      if (invoiceIds.length) {
        const { data: ctRows } = await supabase
          .from('composite_tasks')
          .select('combined_invoice_id, discount_amount')
          .in('combined_invoice_id', invoiceIds);
        (ctRows || []).forEach((r: any) => {
          if (r.combined_invoice_id) {
            ctDiscountByInvoice.set(
              r.combined_invoice_id,
              (ctDiscountByInvoice.get(r.combined_invoice_id) || 0) + (Number(r.discount_amount) || 0)
            );
          }
        });

        // اجلب print_tasks المرتبطة بهذه الفواتير
        const { data: ptRows } = await supabase
          .from('print_tasks')
          .select('id, invoice_id')
          .in('invoice_id', invoiceIds);
        const ptToInvoice = new Map<string, string>();
        (ptRows || []).forEach((pt: any) => {
          if (pt.invoice_id) ptToInvoice.set(pt.id, pt.invoice_id);
        });
        const ptIds = Array.from(ptToInvoice.keys());
        if (ptIds.length) {
          const { data: ctLinked } = await supabase
            .from('composite_tasks')
            .select('print_task_id, customer_total, paid_amount, discount_amount')
            .in('print_task_id', ptIds);
          (ctLinked || []).forEach((ct: any) => {
            const invId = ct.print_task_id ? ptToInvoice.get(ct.print_task_id) : null;
            if (!invId) return;
            const prev = ctByInvoice.get(invId) || { customerTotal: 0, paid: 0, discount: 0 };
            ctByInvoice.set(invId, {
              customerTotal: prev.customerTotal + (Number(ct.customer_total) || 0),
              paid: prev.paid + (Number(ct.paid_amount) || 0),
              discount: prev.discount + (Number(ct.discount_amount) || 0),
            });
          });
        }
      }

      // جلب أنواع الإعلانات من جدول العقود بشكل منفصل
      const contractNumbers = Array.from(
        new Set((invoices || []).map((i: any) => i.contract_number).filter((n: any) => n != null))
      );
      const adTypeMap = new Map<number, string>();
      if (contractNumbers.length) {
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type"')
          .in('Contract_Number', contractNumbers as any);
        (contracts || []).forEach((c: any) => {
          if (c.Contract_Number != null) adTypeMap.set(Number(c.Contract_Number), c['Ad Type']);
        });
      }

      const today = new Date();
      const map = new Map<string, CustomerAccountOverdue>();

      for (const inv of invoices || []) {
        const createdAt = inv.created_at as string;
        const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const rawAmount = Number(inv.total_amount) || 0;
        const ctDisc = ctDiscountByInvoice.get(inv.id) || 0;
        // ✅ إذا كانت الفاتورة مرتبطة بمهمة مجمعة، استخدم متبقي المهمة الكاملة
        const ctInfo = ctByInvoice.get(inv.id);
        let effectiveAmount: number;
        if (ctInfo && ctInfo.customerTotal > 0) {
          effectiveAmount = Math.max(0, ctInfo.customerTotal - ctInfo.paid - ctInfo.discount);
        } else {
          effectiveAmount = Math.max(0, rawAmount - ctDisc);
        }
        // تجاهل الفواتير التي أصبحت قيمتها صفراً بعد خصم المهمة المجمعة
        if (effectiveAmount <= 0.5) continue;
        const item: UnpaidInvoice = {
          invoiceId: inv.id,
          contractNumber: inv.contract_number,
          customerName: inv.customer_name || 'غير معروف',
          customerId: inv.customer_id,
          amount: effectiveAmount,
          createdAt,
          daysOverdue: diffDays,
          adType: inv.contract_number != null ? adTypeMap.get(Number(inv.contract_number)) : undefined,
        };

        const key = item.customerId || item.customerName;
        if (!map.has(key)) {
          map.set(key, {
            customerId: item.customerId,
            customerName: item.customerName,
            totalOverdue: 0,
            invoicesCount: 0,
            oldestDate: item.createdAt,
            oldestDaysOverdue: item.daysOverdue,
            invoices: [],
          });
        }
        const c = map.get(key)!;
        c.invoices.push(item);
        c.totalOverdue += item.amount;
        c.invoicesCount += 1;
        if (new Date(item.createdAt) < new Date(c.oldestDate)) {
          c.oldestDate = item.createdAt;
          c.oldestDaysOverdue = item.daysOverdue;
        }
      }

      const result = Array.from(map.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

      // ✅ استبعاد العملاء الذين رصيدهم الفعلي صفر
      const customerIds = result.map(r => r.customerId).filter((x): x is string => !!x);
      const remainingMap = new Map<string, number>();
      if (customerIds.length) {
        const [contractsRes, paymentsRes, salesRes, printedRes, purchasesRes, discountsRes, compositeRes] = await Promise.all([
          supabase.from('Contract').select('Total, customer_id').in('customer_id', customerIds),
          supabase.from('customer_payments').select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, purchase_invoice_id').in('customer_id', customerIds),
          supabase.from('sales_invoices').select('customer_id, total_amount').in('customer_id', customerIds),
          supabase.from('printed_invoices').select('customer_id, total_amount, included_in_contract').in('customer_id', customerIds),
          supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment').in('customer_id', customerIds),
          supabase.from('customer_general_discounts').select('customer_id, discount_value').in('customer_id', customerIds),
          supabase.from('composite_tasks').select('customer_id, discount_amount').in('customer_id', customerIds),
        ]);

        const byCustomer = <T extends { customer_id: string | null }>(rows: T[] | null) => {
          const m = new Map<string, T[]>();
          (rows || []).forEach((r) => {
            if (!r.customer_id) return;
            const arr = m.get(r.customer_id) || [];
            arr.push(r);
            m.set(r.customer_id, arr);
          });
          return m;
        };
        const cMap = byCustomer((contractsRes.data as any[]) || []);
        const pMap = byCustomer((paymentsRes.data as any[]) || []);
        const sMap = byCustomer((salesRes.data as any[]) || []);
        const piMap = byCustomer((printedRes.data as any[]) || []);
        const puMap = byCustomer((purchasesRes.data as any[]) || []);
        const dMap = byCustomer((discountsRes.data as any[]) || []);
        const ctMap = byCustomer((compositeRes.data as any[]) || []);

        for (const cid of customerIds) {
          const contracts = cMap.get(cid) || [];
          const payments = pMap.get(cid) || [];
          const sales = sMap.get(cid) || [];
          const printed = piMap.get(cid) || [];
          const purchases = puMap.get(cid) || [];
          const discounts = dMap.get(cid) || [];
          const composites = ctMap.get(cid) || [];

          const totalContracts = contracts.reduce((s: number, c: any) => s + (Number(c.Total) || 0), 0);
          const totalSales = sales.reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
          const totalPrinted = printed.reduce((s: number, i: any) => {
            if (i.included_in_contract === true) return s;
            return s + (Number(i.total_amount) || 0);
          }, 0);
          const otherDebts = payments.reduce((s: number, p: any) => {
            const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
            const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
            return isDebt && !isLinked ? s + (Number(p.amount) || 0) : s;
          }, 0);
          const totalPaid = payments.reduce((s: number, p: any) => {
            const isCredit = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment' || p.entry_type === 'general_credit';
            return isCredit ? s + (Number(p.amount) || 0) : s;
          }, 0);
          const totalDiscounts = discounts.reduce((s: number, d: any) => s + (Number(d.discount_value) || 0), 0);
          const totalCompositeDiscounts = composites.reduce((s: number, c: any) => s + (Number(c.discount_amount) || 0), 0);
          const totalPurchases = purchases.reduce((s: number, i: any) => s + Math.max(0, (Number(i.total_amount) || 0) - (Number(i.used_as_payment) || 0)), 0);

          const totalDebt = totalContracts + totalSales + totalPrinted + otherDebts;
          const remaining = totalDebt - totalPaid - totalDiscounts - totalCompositeDiscounts - totalPurchases;
          remainingMap.set(cid, remaining);
        }
      }

      const filteredResult = result.filter((r) => {
        if (!r.customerId) return true;
        const rem = remainingMap.get(r.customerId);
        if (rem == null) return true;
        return rem > 0.5;
      }).map((r) => {
        if (!r.customerId) return r;
        const rem = remainingMap.get(r.customerId);
        if (rem == null) return r;
        return { ...r, totalOverdue: Math.min(r.totalOverdue, Math.max(0, rem)) };
      });

      setCustomers(filteredResult);

      const customerNames = filteredResult.filter(r => !r.customerId).map(r => r.customerName);
      const pm = new Map<string, string>();
      if (customerIds.length) {
        const { data: cs } = await supabase.from('customers').select('id, phone').in('id', customerIds);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.id, c.phone); });
      }
      if (customerNames.length) {
        const { data: cs } = await supabase.from('customers').select('name, phone').in('name', customerNames);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.name, c.phone); });
      }
      setPhoneMap(pm);
    } catch (e) {
      console.error(e);
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const sortedAndFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minAmt = parseFloat(minAmount || '0') || 0;
    
    const items = customers.filter(c =>
      (!term || c.customerName.toLowerCase().includes(term)) &&
      c.oldestDaysOverdue >= minDays &&
      c.totalOverdue >= minAmt
    );

    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') {
        return b.oldestDaysOverdue - a.oldestDaysOverdue; // أقدم تأخير أولاً (رقم تأخير كبير)
      } else {
        return a.oldestDaysOverdue - b.oldestDaysOverdue; // أحدث تأخير أولاً (رقم تأخير صغير)
      }
    });
  }, [customers, searchTerm, minDays, minAmount, sortBy]);

  const totalAmount = sortedAndFiltered.reduce((s, c) => s + c.totalOverdue, 0);
  const totalInvoices = sortedAndFiltered.reduce((s, c) => s + c.invoicesCount, 0);

  const getPhone = (c: { customerId: string | null; customerName: string }) =>
    (c.customerId && phoneMap.get(c.customerId)) || phoneMap.get(c.customerName) || '';

  const sendInvoiceWhatsApp = async (inv: UnpaidInvoice) => {
    const phone = getPhone(inv);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    const dateStr = new Date(inv.createdAt).toLocaleDateString('ar-LY');
    const message = `السلام عليكم ورحمة الله\n\nالسيد/ ${inv.customerName} المحترم،\n\nنود تذكيركم بفاتورة غير مسددة:\n- تاريخ الإصدار: ${dateStr}\n- أيام التأخير: ${inv.daysOverdue} يوم\n- المبلغ: ${inv.amount.toLocaleString('en-US')} د.ل${inv.contractNumber ? `\n- عقد رقم: #${inv.contractNumber}` : ''}\n\nنرجو المبادرة بالسداد.\n\nشكراً لتعاونكم.`;
    await sendWhatsApp({ phone, message });
  };

  const markInvoicePaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase.from('printed_invoices').update({ paid: true }).eq('id', invoiceId);
      if (error) throw error;
      toast.success('تم تسديد الفاتورة بنجاح');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('خطأ في تسديد الفاتورة');
    }
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 90) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white font-semibold">حرجة جداً (90+ يوم)</Badge>;
    } else if (days >= 30) {
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">متأخرة (30+ يوم)</Badge>;
    } else if (days >= 7) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">تنبيه (7+ أيام)</Badge>;
    }
    return <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-semibold">حديثة ({days} يوم)</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <Clock className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">جاري تحميل متأخرات الحسابات والفواتير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
      {/* Premium Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/15 p-6 md:p-8 backdrop-blur-sm">
        <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-orange-500/5 blur-3xl"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 text-white shrink-0">
              <Receipt className="h-6 w-6 md:h-7 md:w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">متأخرات الحسابات والفواتير</h1>
              <p className="text-muted-foreground text-sm mt-1">
                متابعة فواتير الطباعة والمهام المجمعة غير المسددة مع فحص أرصدة الحسابات
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filter Console */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" /> فلاتر وتصنيف القائمة
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">بحث بالاسم</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))} 
                  placeholder="ابحث باسم الزبون..." 
                  className="pr-9 h-10 border-border/80 focus-visible:ring-orange-500/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">الحد الأدنى لأيام التأخير</Label>
              <Select value={String(minDays)} onValueChange={(v) => setMinDays(parseInt(v, 10) || 0)}>
                <SelectTrigger className="h-10 border-border/80 focus:ring-orange-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">كل التأخيرات</SelectItem>
                  <SelectItem value="7">7+ أيام</SelectItem>
                  <SelectItem value="30">30+ يوم</SelectItem>
                  <SelectItem value="60">60+ يوم</SelectItem>
                  <SelectItem value="90">90+ يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">الحد الأدنى للمبلغ (د.ل)</Label>
              <Input 
                type="number" 
                inputMode="decimal" 
                value={minAmount} 
                onChange={(e) => setMinAmount(e.target.value.slice(0, 12))} 
                placeholder="مثال: 1000" 
                className="h-10 border-border/80 focus-visible:ring-orange-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">ترتيب متأخرات التأخير</Label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-10 border-border/80 focus:ring-orange-500/30">
                  <ArrowUpDown className="h-4 w-4 ml-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oldest">التأخير الأطول أولاً (الأقدم)</SelectItem>
                  <SelectItem value="newest">التأخير الأقل أولاً (الأحدث)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                className="w-full h-10 border-dashed border-muted-foreground/30 hover:border-orange-500 hover:text-orange-500 transition-colors" 
                onClick={() => { setSearchTerm(''); setMinDays(0); setMinAmount(''); setSortBy('oldest'); }}
              >
                إعادة تعيين الفلاتر
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 to-amber-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-orange-500" /> عدد الزبائن المتأخرين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight font-numbers">{sortedAndFiltered.length}</div>
            <p className="text-xs text-muted-foreground mt-1">حساب زبون نشط لديه مديونية</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 to-amber-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-orange-500" /> فواتير غير مسددة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight font-numbers">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الفواتير غير المحصلة</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 to-amber-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" /> مجموع المستحقات المطلوبة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-orange-500 tracking-tight font-numbers">
              {totalAmount.toLocaleString('en-US')} <span className="text-base font-semibold">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">إجمالي المبالغ المطلوبة فعلياً</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content List */}
      {sortedAndFiltered.length === 0 ? (
        <Card className="border-green-500/20 bg-green-500/5 py-12 text-center shadow-inner">
          <CardContent className="space-y-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-md">
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--success)' }} />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-green-800 dark:text-green-300">سجل نظيف بالكامل!</p>
              <p className="text-sm text-green-600/80 max-w-md mx-auto">
                لا توجد فواتير أو متأخرات حسابات تطابق خيارات التصفية الحالية.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/30">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" /> قائمة الزبائن المتأخرين
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="divide-y divide-border/40">
              {sortedAndFiltered.map((customer, index) => (
                <AccordionItem
                  key={`${customer.customerId || customer.customerName}-${index}`}
                  value={`c-${index}`}
                  className="border-none hover:bg-muted/10 transition-colors"
                >
                  {/* Accordion Header */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full px-6 py-4 gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-11 h-11 bg-orange-500/10 text-orange-600 rounded-full flex items-center justify-center font-bold text-base shadow-sm shrink-0 border border-orange-500/20">
                        {customer.customerName.charAt(0) || 'ز'}
                      </div>
                      <div className="space-y-1">
                        <p className="font-extrabold text-foreground text-base tracking-tight">{customer.customerName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded border border-border/30">
                            <Clock className="h-3 w-3 text-orange-500" /> أقدم تأخير: {customer.oldestDaysOverdue} يوم
                          </span>
                          <span className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded border border-border/30">
                            <Receipt className="h-3 w-3 text-orange-500" /> {customer.invoicesCount} فاتورة
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 font-medium text-xs border-border/80 shadow-sm hover:bg-orange-500 hover:text-white transition-all gap-1.5"
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          const name = encodeURIComponent(customer.customerName || '');
                          if (customer.customerId) navigate(`/admin/customer-billing?id=${customer.customerId}&name=${name}`);
                          else if (customer.customerName) navigate(`/admin/customer-billing?name=${name}`);
                        }}
                      >
                        <Receipt className="h-3.5 w-3.5" /> كشف الحساب
                      </Button>
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-orange-600 font-numbers tracking-tight">
                          {customer.totalOverdue.toLocaleString('en-US')} <span className="text-xs font-semibold text-muted-foreground">د.ل</span>
                        </span>
                      </div>
                      <AccordionTrigger className="p-2 hover:bg-muted rounded-full shrink-0 transition-colors" />
                    </div>
                  </div>

                  {/* Accordion Content */}
                  <AccordionContent className="px-6 pb-6 pt-1 bg-muted/20 border-t border-border/20">
                    <div className="space-y-3 pt-3">
                      {customer.invoices
                        .slice()
                        .sort((a, b) => b.daysOverdue - a.daysOverdue)
                        .map((invoice, idx) => (
                        <div 
                          key={idx} 
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-border/50 rounded-xl bg-card hover:shadow-sm hover:border-orange-500/30 transition-all gap-4"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {invoice.contractNumber && (
                                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 border-border/80">عقد #{invoice.contractNumber}</Badge>
                              )}
                              {invoice.adType && (
                                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0">{invoice.adType}</Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] font-bold bg-orange-500/10 text-orange-700 border-orange-500/20 px-2 py-0">فاتورة طباعة</Badge>
                              {getUrgencyBadge(invoice.daysOverdue)}
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1">
                              <div><strong>المبلغ المطلوب:</strong> <span className="font-bold text-foreground font-numbers">{invoice.amount.toLocaleString('en-US')} د.ل</span></div>
                              <div><strong>تاريخ الإصدار:</strong> <span className="font-medium font-numbers">{new Date(invoice.createdAt).toLocaleDateString('ar-LY')}</span></div>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                            <Button
                              size="sm"
                              className="h-9 flex-1 sm:flex-none font-semibold bg-green-600 hover:bg-green-700 text-white shadow-sm transition-colors gap-1.5"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); markInvoicePaid(invoice.invoiceId); }}
                            >
                              <CreditCard className="h-3.5 w-3.5" /> تسديد الفاتورة
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 flex-1 sm:flex-none font-semibold bg-[#25d366] hover:bg-[#20ba56] text-white shadow-sm transition-colors gap-1.5"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendInvoiceWhatsApp(invoice); }}
                              disabled={!getPhone(invoice)}
                              title={getPhone(invoice) ? 'إرسال تنبيه واتساب' : 'لا يوجد رقم هاتف'}
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> تنبيه واتساب
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
