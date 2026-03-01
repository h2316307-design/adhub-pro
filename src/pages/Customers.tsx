// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { Edit, Trash2, Printer, Plus, AlertCircle, TrendingUp, Users, Wallet, CreditCard, Clock, Building2, Phone as PhoneIcon, Merge } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { useOverduePayments } from '@/hooks/useOverduePayments';
import { TopOverduePayments } from '@/components/customers/TopOverduePayments';
import { SendAccountStatementDialog } from '@/components/customers/SendAccountStatementDialog';
import { SendOverdueRemindersDialog } from '@/components/billing/SendOverdueRemindersDialog';
import { SendDebtRemindersDialog } from '@/components/billing/SendDebtRemindersDialog';
import { BulkAccountStatementDialog } from '@/components/customers/BulkAccountStatementDialog';
import { Mail, FileSpreadsheet, AlertTriangle, DollarSign } from 'lucide-react';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { calculateCustomerFinancials } from '@/hooks/useCustomerFinancials';

interface PaymentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  contract_number: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  entry_type: string | null;
}

interface ContractRow {
  Contract_Number: string | null;
  "Customer Name": string | null;
  "Ad Type": string | null;
  "Total": string | number | null;
  "Start Date"?: string | null;
  "End Date"?: string | null;
  customer_id?: string | null;
}

interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  contractsCount: number;
  totalRent: number;       // إجمالي الديون (العقود + الفواتير + المهام المجمعة)
  totalPaid: number;       // إجمالي المدفوعات الصحيحة
  accountBalance: number;
  remainingDebt: number;   // ✅ المتبقي من الدين باستخدام المنطق الصحيح
  repaymentPercentage: number; // ✅ نسبة السداد الصحيحة
  isSupplier?: boolean;
  isCustomer?: boolean;
  supplierType?: string | null;
}

// Component for each customer row with overdue check
function CustomerRow({ 
  customer, 
  remaining, 
  paymentPercentage,
  onViewBilling,
  onEdit,
  onDelete
}: { 
  customer: CustomerSummary; 
  remaining: number;
  paymentPercentage: number;
  onViewBilling: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { overdueInfo } = useOverduePayments(
    customer.id.startsWith('name:') ? null : customer.id,
    customer.name
  );

  const isOverdue = overdueInfo.hasOverdue;
  const hasUnpaidDebt = remaining > 0;
  const isHighlighted = isOverdue || hasUnpaidDebt;
  
  const rowClassName = isHighlighted
    ? "group hover:bg-destructive/10 transition-all duration-300 bg-destructive/5 border-r-4 border-r-destructive" 
    : "group hover:bg-accent/10 transition-all duration-300";

  const customerData = {
    ...customer,
    remaining,
  };

  return (
    <TableRow className={rowClassName}>
      {/* اسم الزبون */}
      <TableCell className="font-medium py-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
            isHighlighted 
              ? 'bg-destructive/20 text-destructive' 
              : 'bg-primary/10 text-primary'
          }`}>
            {customer.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {isHighlighted && <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />}
              <span className={`font-semibold ${isHighlighted ? "text-destructive" : "text-foreground"}`}>
                {customer.name}
              </span>
            </div>
            <div className="flex gap-1.5 mt-1">
              {customer.isCustomer && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                  زبون
                </Badge>
              )}
              {customer.isSupplier && (
                <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0" variant="outline">
                  مورد
                  {customer.supplierType === 'billboard_rental' && ' (إيجار)'}
                  {customer.supplierType === 'general_purchases' && ' (مشتريات)'}
                  {customer.supplierType === 'printer' && ' (مطبعة)'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* الهاتف والشركة */}
      <TableCell className="py-4">
        <div className="flex flex-col gap-1">
          {customer.phone ? (
            <div className="flex items-center gap-1.5 text-sm">
              <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span dir="ltr">{customer.phone}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/50 text-sm">—</span>
          )}
          {customer.company && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{customer.company}</span>
            </div>
          )}
        </div>
      </TableCell>

      {/* العقود */}
      <TableCell className="text-center py-4">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-sm">
          {customer.contractsCount}
        </div>
      </TableCell>

      {/* الإجمالي */}
      <TableCell className="py-4">
        <div className="flex flex-col items-end">
          <span className="font-bold font-manrope text-foreground">{customer.totalRent.toLocaleString('ar-LY')}</span>
          <span className="text-[10px] text-muted-foreground">د.ل</span>
        </div>
      </TableCell>

      {/* المدفوع */}
      <TableCell className="py-4">
        <div className="flex flex-col items-end">
          <span className="font-semibold font-manrope text-emerald-600 dark:text-emerald-400">{customer.totalPaid.toLocaleString('ar-LY')}</span>
          <span className="text-[10px] text-muted-foreground">د.ل</span>
        </div>
      </TableCell>

      {/* رصيد الحساب */}
      <TableCell className="py-4">
        <div className="flex flex-col items-end">
          <span className="font-semibold font-manrope text-blue-600 dark:text-blue-400">{customer.accountBalance.toLocaleString('ar-LY')}</span>
          <span className="text-[10px] text-muted-foreground">د.ل</span>
        </div>
      </TableCell>

      {/* المتبقي */}
      <TableCell className="py-4">
        <div className="flex flex-col items-end">
          <span className={`font-bold font-manrope ${remaining > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {remaining.toLocaleString('ar-LY')}
          </span>
          <span className="text-[10px] text-muted-foreground">د.ل</span>
        </div>
      </TableCell>

      {/* نسبة السداد */}
      <TableCell className="py-4 min-w-[140px]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">نسبة السداد</span>
            <span className={`font-bold ${
              paymentPercentage >= 100 ? 'text-emerald-600' : 
              paymentPercentage >= 50 ? 'text-amber-600' : 'text-destructive'
            }`}>{paymentPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                paymentPercentage >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 
                paymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 
                'bg-gradient-to-r from-destructive to-red-400'
              }`}
              style={{ width: `${Math.min(100, paymentPercentage)}%` }}
            />
          </div>
        </div>
      </TableCell>

      {/* الحالة */}
      <TableCell className="py-4">
        {isOverdue ? (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant="destructive" className="text-xs shadow-sm animate-pulse">
              متأخر {overdueInfo.oldestDaysOverdue} يوم
            </Badge>
            <span className="text-xs font-medium text-destructive">
              {overdueInfo.totalOverdueAmount.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
        ) : hasUnpaidDebt ? (
          <div className="flex flex-col gap-1 items-start">
            <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-sm" variant="outline">
              دين غير مسدد
            </Badge>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {remaining.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
        ) : (
          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-sm" variant="outline">
            <TrendingUp className="h-3 w-3 ml-1" />
            محدث
          </Badge>
        )}
      </TableCell>

      {/* الإجراءات */}
      <TableCell className="py-4">
        <div className="flex gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
          <Button 
            size="sm" 
            onClick={onViewBilling}
            className="bg-primary/90 hover:bg-primary shadow-sm"
          >
            <Wallet className="h-4 w-4 ml-1" />
            الفواتير
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onEdit}
            className="hover:bg-accent"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onDelete}
            className="hover:bg-destructive/10 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <SendAccountStatementDialog customer={customerData} overdueInfo={overdueInfo} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Customers() {
  const { confirm: systemConfirm } = useSystemDialog();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [customers, setCustomers] = useState<{id:string; name:string; phone?: string | null; company?: string | null}[]>([]);
  
  // ✅ بيانات إضافية للحساب الصحيح
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [printedInvoices, setPrintedInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [compositeTasks, setCompositeTasks] = useState<any[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filter and Sort states
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // print invoice dialog state
  const [printInvOpen, setPrintInvOpen] = useState(false);
  const [allBillboards, setAllBillboards] = useState<Billboard[]>([]);
  const [selectedContractsForInv, setSelectedContractsForInv] = useState<string[]>([]);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [printPrices, setPrintPrices] = useState<Record<string, number>>({});
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // add/edit customer states
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerCompanyInput, setCustomerCompanyInput] = useState('');
  const [isCustomerChecked, setIsCustomerChecked] = useState(true);
  const [isSupplierChecked, setIsSupplierChecked] = useState(false);
  const [supplierTypeInput, setSupplierTypeInput] = useState<string>('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<{id: string; name: string}[]>([]);
  const [syncing, setSyncing] = useState(false);

  // edit receipt states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState('');

  // add invoice/receipt dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<'invoice'|'receipt'|'account_payment'>('receipt');
  const [addAmount, setAddAmount] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addReference, setAddReference] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addDate, setAddDate] = useState<string>(()=>new Date().toISOString().slice(0,10));
  const [addContract, setAddContract] = useState<string>('');

  // add previous debt dialog
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=>new Date().toISOString().slice(0,10));

  // overdue reminders dialog state
  const [overdueRemindersOpen, setOverdueRemindersOpen] = useState(false);
  
  // debt reminders dialog state
  const [debtRemindersOpen, setDebtRemindersOpen] = useState(false);
  
  // bulk account statement dialog
  const [bulkStatementOpen, setBulkStatementOpen] = useState(false);
  
  // edit discount dialog state
  const [editDiscountOpen, setEditDiscountOpen] = useState(false);
  const [editingContractDiscount, setEditingContractDiscount] = useState<{contractNumber: string | null; currentDiscount: number} | null>(null);
  
  // duplicate name warning
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<string | null>(null);
  
  // delete customer dialog
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerSummary | null>(null);
  const [deleteCheckResult, setDeleteCheckResult] = useState<{hasContracts: boolean; hasDebt: boolean; contractsCount: number; debtAmount: number} | null>(null);
  const [newDiscountAmount, setNewDiscountAmount] = useState('');

  const loadData = async () => {
    try {
      console.log('Loading data...');
      // ✅ تحميل جميع البيانات المطلوبة للحساب الصحيح
      const [pRes, cRes, cuRes, siRes, piRes, puRes, dRes, ctRes] = await Promise.all([
        supabase.from('customer_payments').select('*').order('paid_at', { ascending: false }),
        supabase.from('Contract').select('*'),
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('sales_invoices').select('*'),
        supabase.from('printed_invoices').select('*'),
        supabase.from('purchase_invoices').select('*'),
        supabase.from('customer_general_discounts').select('*').eq('status', 'active'),
        supabase.from('composite_tasks').select('*'),
      ]);

      if (pRes.error) {
        console.error('Payments error:', pRes.error);
      } else {
        setPayments(pRes.data || []);
      }

      if (cRes.error) {
        console.error('Contracts error:', cRes.error);
      } else {
        setContracts(cRes.data || []);
      }

      if (cuRes.error) {
        console.error('Customers error:', cuRes.error);
      } else {
        setCustomers(cuRes.data || []);
      }

      // ✅ تخزين البيانات الإضافية
      setSalesInvoices(siRes.data || []);
      setPrintedInvoices(piRes.data || []);
      setPurchaseInvoices(puRes.data || []);
      setDiscounts(dRes.data || []);
      setCompositeTasks(ctRes.data || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('خطأ في تحميل البيانات');
    }
  };

  useEffect(() => {
    loadData();
    // load billboards for invoice builder
    fetchAllBillboards().then((b)=> setAllBillboards(b as any)).catch(()=> setAllBillboards([] as any));
    // load printers list
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setPrinters(data);
      }
    } catch (error) {
      console.error('Error loading printers:', error);
    }
  };

  // auto-derive size counts from selected contracts
  useEffect(() => {
    const sel = new Set(selectedContractsForInv);
    const boards = allBillboards.filter((b:any)=> sel.has(String((b as any).Contract_Number||'')) && (!selectedCustomerName || String((b as any).Customer_Name||'').toLowerCase().includes(selectedCustomerName.toLowerCase())));
    const counts: Record<string, number> = {};
    for (const b of boards) {
      const size = String((b as any).Size || (b as any).size || '—');
      counts[size] = (counts[size]||0) + 1;
    }
    setSizeCounts(counts);
  }, [selectedContractsForInv, allBillboards, selectedCustomerName]);

  // load print prices for sizes in current selection
  useEffect(() => {
    const sizes = Object.keys(sizeCounts);
    if (sizes.length === 0) { setPrintPrices({}); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('installation_print_pricing')
          .select('size, print_price')
          .in('size', sizes);
        if (!error && Array.isArray(data)) {
          const map: Record<string, number> = {};
          (data as any[]).forEach((r) => { map[String(r.size)] = Number(r.print_price) || 0; });
          setPrintPrices(map);
        } else {
          setPrintPrices({});
        }
      } catch {
        setPrintPrices({});
      }
    })();
  }, [sizeCounts]);

  // ✅ Build summary per customer using the CORRECT calculation logic (same as debt summary card)
  const customersSummary = useMemo((): CustomerSummary[] => {
    // initialize map from customers list with all customer data
    const map = new Map<string, CustomerSummary>();
    for (const c of (customers || [])) {
      const id = c.id;
      const name = c.name || '—';
      const phone = c.phone || null;
      const company = c.company || null;
      map.set(id, { 
        id, 
        name, 
        phone, 
        company, 
        contractsCount: 0, 
        totalRent: 0, 
        totalPaid: 0,
        accountBalance: 0,
        remainingDebt: 0,
        repaymentPercentage: 0,
        isSupplier: (c as any).is_supplier ?? false,
        isCustomer: (c as any).is_customer ?? true,
        supplierType: (c as any).supplier_type ?? null
      });
    }

    // Count contracts per customer
    for (const ct of contracts) {
      const cid = ct.customer_id ?? null;
      if (cid && map.has(cid)) {
        map.get(cid)!.contractsCount += 1;
      } else {
        // fallback: group by name if customer_id missing
        const name = (ct['Customer Name'] || '').toString() || '—';
        const key = `name:${name}`;
        if (!map.has(key)) {
          map.set(key, { 
            id: key, 
            name, 
            phone: null, 
            company: null, 
            contractsCount: 0, 
            totalRent: 0, 
            totalPaid: 0,
            accountBalance: 0,
            remainingDebt: 0,
            repaymentPercentage: 0,
            isSupplier: false,
            isCustomer: true,
            supplierType: null
          });
        }
        map.get(key)!.contractsCount += 1;
      }
    }

    // ✅ للمستخدمين الذين لديهم customer_id حقيقي، نستخدم الدالة الموحدة للحساب
    for (const [customerId, customerData] of map.entries()) {
      // تجاهل العملاء الذين ليس لديهم id حقيقي
      if (customerId.startsWith('name:')) continue;
      
      // تصفية البيانات الخاصة بهذا العميل
      const customerContracts = contracts.filter(c => c.customer_id === customerId);
      const customerPayments = payments.filter(p => p.customer_id === customerId);
      const customerSalesInvoices = salesInvoices.filter(inv => inv.customer_id === customerId);
      const customerPrintedInvoices = printedInvoices.filter(inv => inv.customer_id === customerId);
      const customerPurchaseInvoices = purchaseInvoices.filter(inv => inv.customer_id === customerId);
      const customerDiscounts = discounts.filter(d => d.customer_id === customerId);
      const customerCompositeTasks = compositeTasks.filter(t => t.customer_id === customerId);
      
      // حساب إيجارات الشركات الصديقة
      let friendRentals = 0;
      for (const contract of customerContracts) {
        const friendData = (contract as any).friend_rental_data;
        if (friendData && typeof friendData === 'object') {
          const entries = Object.values(friendData) as any[];
          for (const entry of entries) {
            if (entry && typeof entry.rental_cost === 'number') {
              friendRentals += entry.rental_cost;
            }
          }
        }
      }
      
      // ✅ استخدام الدالة الموحدة للحساب الصحيح
      const financials = calculateCustomerFinancials(
        customerContracts,
        customerPayments,
        customerSalesInvoices,
        customerPrintedInvoices,
        customerPurchaseInvoices,
        customerDiscounts,
        customerCompositeTasks,
        friendRentals
      );
      
      customerData.totalRent = financials.totalDebt;
      customerData.totalPaid = financials.totalPaid;
      customerData.remainingDebt = financials.remainingDebt;
      customerData.repaymentPercentage = financials.repaymentPercentage;
      
      // تحديد الموردين
      for (const p of customerPayments) {
        if (p.entry_type === 'general_debit') {
          customerData.isSupplier = true;
          break;
        }
      }
      
      // حساب رصيد الحساب (استثناء الدفعات الموزعة على مهام مجمعة)
      customerData.accountBalance = customerPayments
        .filter(p => {
          if (p.entry_type === 'account_payment') return true;
          if (!p.contract_number && (p.entry_type === 'receipt' || p.entry_type === 'payment')) {
            // ✅ استثناء الدفعات المرتبطة بمهام مجمعة (تحتوي "مهمة مجمعة" في الملاحظات)
            if (p.notes && (p.notes.includes('مهمة مجمعة') || p.notes.includes('composite'))) return false;
            // ✅ استثناء الدفعات المرتبطة بـ distributed_payment
            if (p.distributed_payment_id) return false;
            return true;
          }
          return false;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }

    // ✅ للعملاء بدون customer_id (fallback by name) - استخدام المنطق القديم المبسط
    for (const p of payments) {
      if (p.customer_id && map.has(p.customer_id)) continue; // تم معالجته أعلاه
      
      if (p.customer_name) {
        const name = p.customer_name;
        const key = `name:${name}`;
        if (!map.has(key)) {
          map.set(key, { 
            id: key, 
            name, 
            phone: null, 
            company: null, 
            contractsCount: 0, 
            totalRent: 0, 
            totalPaid: 0,
            accountBalance: 0,
            remainingDebt: 0,
            repaymentPercentage: 0,
            isSupplier: false,
            isCustomer: true,
            supplierType: null
          });
        }
        const cur = map.get(key)!;
        const amt = Number(p.amount || 0) || 0;
        
        if (p.entry_type === 'general_debit') {
          cur.isSupplier = true;
        }
        
        if (p.entry_type === 'account_payment' || !p.contract_number) {
          cur.accountBalance += amt;
        } else if (p.entry_type === 'receipt' || p.entry_type === 'payment') {
          cur.totalPaid += amt;
        }
      }
    }

    // حساب المتبقي ونسبة السداد للعملاء بدون customer_id
    for (const [customerId, customerData] of map.entries()) {
      if (customerId.startsWith('name:')) {
        // استخدام المنطق المبسط للعملاء بدون customer_id
        const customerContracts = contracts.filter(c => 
          !c.customer_id && (c['Customer Name'] || '').toString().toLowerCase() === customerData.name.toLowerCase()
        );
        customerData.totalRent = customerContracts.reduce((sum, c) => sum + (Number(c['Total']) || 0), 0);
        customerData.remainingDebt = Math.max(0, customerData.totalRent - customerData.totalPaid);
        customerData.repaymentPercentage = customerData.totalRent > 0 
          ? Math.round((customerData.totalPaid / customerData.totalRent) * 100) 
          : 100;
      }
    }

    const result = Array.from(map.values()).sort((a, b) => b.totalRent - a.totalRent);
    return result;
  }, [payments, contracts, customers, salesInvoices, printedInvoices, purchaseInvoices, discounts, compositeTasks]);

  const totalAllPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // Apply filters and sorting
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...customersSummary];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        (c.company && c.company.toLowerCase().includes(searchLower)) ||
        (c.phone && c.phone.includes(search))
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => {
        const remaining = c.totalRent - c.totalPaid;
        switch (filterStatus) {
          case 'has_balance':
            return remaining > 0;
          case 'fully_paid':
            return remaining <= 0 && c.totalRent > 0;
          case 'has_contracts':
            return c.contractsCount > 0;
          case 'no_contracts':
            return c.contractsCount === 0;
          case 'suppliers': // ✅ جديد: فلتر الموردين
            return c.isSupplier === true;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name, 'ar');
          break;
        case 'totalRent':
          compareValue = a.totalRent - b.totalRent;
          break;
        case 'totalPaid':
          compareValue = a.totalPaid - b.totalPaid;
          break;
        case 'remaining':
          compareValue = (a.totalRent - a.totalPaid) - (b.totalRent - b.totalPaid);
          break;
        case 'contractsCount':
          compareValue = a.contractsCount - b.contractsCount;
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [customersSummary, search, filterStatus, sortBy, sortOrder]);

  const [detailsContracts, setDetailsContracts] = useState<ContractRow[]>([]);
  const [detailsPayments, setDetailsPayments] = useState<PaymentRow[]>([]);

  const openCustomer = async (idOrKey: string) => {
    console.log('Opening customer details for:', idOrKey);
    
    // idOrKey may be a real customer id, or a fallback key like 'name:Customer Name'
    let id = idOrKey;
    let nameFallback: string | null = null;
    if (typeof idOrKey === 'string' && idOrKey.startsWith('name:')) {
      nameFallback = idOrKey.slice(5);
      id = '';
    }

    // Find customer name for dialog title
    const customer = customers.find(c => c.id === id);
    const customerName = customer?.name || nameFallback || 'غير معروف';
    
    console.log('Customer found:', customer);
    console.log('Customer name:', customerName);
    
    setSelectedCustomer(idOrKey);
    setSelectedCustomerName(customerName);
    setDialogOpen(true);

    try {
      // First fetch payments for this customer (by id), fallback to name
      let paymentsData: PaymentRow[] = [];

      if (id) {
        console.log('Fetching payments by customer_id:', id);
        const pRes = await supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_id', id)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by ID result:', pRes);
        paymentsData = pRes.data || [];
      }

      // determine customer name if available (from customers list) or fallback
      const cust = customers.find(x => x.id === id);
      const name = cust?.name || nameFallback || null;

      if ((!paymentsData || paymentsData.length === 0) && name) {
        console.log('Fetching payments by customer name:', name);
        const pByName = await supabase
          .from('customer_payments')
          .select('*')
          .ilike('customer_name', `%${name}%`)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by name result:', pByName);
        paymentsData = pByName.data || [];
      }

      setDetailsPayments(paymentsData);

      // collect contract numbers from payments
      const contractNumbers = Array.from(new Set((paymentsData || []).map((p:any)=>p.contract_number).filter(Boolean)));
      console.log('Contract numbers from payments:', contractNumbers);

      // fetch contracts by customer_id if we have id, otherwise by name or contract numbers
      let contractsData: ContractRow[] = [];

      if (id) {
        console.log('Fetching contracts by customer_id:', id);
        const contractsById = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', id);
        
        console.log('Contracts by ID result:', contractsById);
        contractsData = contractsById.data || [];
      }

      if ((contractsData || []).length === 0 && name) {
        console.log('Fetching contracts by customer name:', name);
        const byName = await supabase
          .from('Contract')
          .select('*')
          .ilike('Customer Name', `%${name}%`);
        
        console.log('Contracts by name result:', byName);
        contractsData = byName.data || [];
      }

      if ((contractsData || []).length === 0 && contractNumbers.length > 0) {
        console.log('Fetching contracts by contract numbers:', contractNumbers);
        // attempt fetching by contract numbers
        const byNumbers = await supabase
          .from('Contract')
          .select('*')
          .in('Contract_Number', contractNumbers);
        
        console.log('Contracts by numbers result:', byNumbers);
        contractsData = byNumbers.data || [];
      }

      // dedupe by Contract_Number
      const seen = new Set();
      const deduped = [] as ContractRow[];
      for (const c of contractsData) {
        const key = String(c.Contract_Number || c['Contract Number'] || JSON.stringify(c));
        if (!seen.has(key)) { 
          seen.add(key); 
          deduped.push(c); 
        }
      }

      console.log('Final contracts data:', deduped);
      setDetailsContracts(deduped);
    } catch (e) {
      console.error('openCustomer error', e);
      setDetailsContracts([]);
      setDetailsPayments([]);
      toast.error('خطأ في تحميل بيانات العميل');
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
    setSelectedCustomerName('');
    setDetailsContracts([]);
    setDetailsPayments([]);
  };

  const customerContracts = detailsContracts;
  const customerPayments = detailsPayments;

  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setReceiptAmount(String(payment.amount || ''));
    setReceiptMethod(payment.method || '');
    setReceiptReference(payment.reference || '');
    setReceiptNotes(payment.notes || '');
    setReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .update({
          amount: Number(receiptAmount) || 0,
          method: receiptMethod || null,
          reference: receiptReference || null,
          notes: receiptNotes || null,
          paid_at: receiptDate ? new Date(receiptDate).toISOString() : null
        })
        .eq('id', editingReceipt.id);

      if (error) {
        console.error('Error updating receipt:', error);
        toast.error('فشل في تحديث الإيصال');
      } else {
        toast.success('تم تحديث الإيصال بنجاح');
        setEditReceiptOpen(false);
        setEditingReceipt(null);
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Save receipt error:', e);
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (paymentId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الإيصال؟', variant: 'destructive', confirmText: 'حذف' })) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', paymentId);

      if (error) {
        console.error('Error deleting receipt:', error);
        toast.error('فشل في حذف الإيصال');
      } else {
        toast.success('تم حذف الإيصال بنجاح');
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Delete receipt error:', e);
      toast.error('خطأ في حذف الإيصال');
    }
  };

  const printReceipt = async (payment: PaymentRow) => {
    const styles = await getMergedInvoiceStylesAsync('receipt');

    const primary = styles.primaryColor || '#D4AF37';
    const secondary = styles.secondaryColor || '#B8860B';

    const companyName = styles.companyName || '';
    const companySubtitle = styles.companySubtitle || '';

    const companyBlock = (companyName || companySubtitle)
      ? `
            <div style="text-align:${styles.headerAlignment === 'left' ? 'left' : styles.headerAlignment === 'center' ? 'center' : 'right'}; width:100%;">
              ${companyName ? `<div style="font-size: 22px; font-weight: bold; color: ${primary};">${companyName}</div>` : ''}
              ${companySubtitle ? `<div style="color: ${primary}; font-size: 14px;">${companySubtitle}</div>` : ''}
            </div>
        `
      : '';

    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>إيصال دفع</title>
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 20px; 
              max-width: 600px; 
              margin: auto;
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #2c5aa0;
              margin-bottom: 10px;
            }
            .company {
              font-size: 16px;
              color: #666;
            }
            .content {
              line-height: 2;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .label {
              font-weight: bold;
              color: #333;
            }
            .value {
              color: #555;
            }
            .amount {
              font-size: 24px;
              font-weight: bold;
              color: #2c5aa0;
              text-align: center;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${primary}; padding-bottom: 15px;">
            ${companyBlock}
            <div class="title" style="text-align: left; font-size: 24px; font-weight: bold; color: ${secondary};">إيصال دفع</div>
          </div>
          
          <div class="content">
            <div class="row">
              <span class="label">اسم العميل:</span>
              <span class="value">${payment.customer_name || '—'}</span>
            </div>
            <div class="row">
              <span class="label">رقم العقد:</span>
              <span class="value">${payment.contract_number || (payment.entry_type === 'account_payment' ? 'حساب عام' : '—')}</span>
            </div>
            <div class="row">
              <span class="label">نوع الدفعة:</span>
              <span class="value">${payment.entry_type === 'account_payment' ? 'دفعة على الحساب' : payment.entry_type || '—'}</span>
            </div>
            <div class="row">
              <span class="label">طريقة الدفع:</span>
              <span class="value">${payment.method || '—'}</span>
            </div>
            <div class="row">
              <span class="label">المرجع:</span>
              <span class="value">${payment.reference || '—'}</span>
            </div>
            <div class="row">
              <span class="label">التاريخ:</span>
              <span class="value">${payment.paid_at ? new Date(payment.paid_at).toLocaleString('ar-LY') : '—'}</span>
            </div>
            ${payment.notes ? `
            <div class="row">
              <span class="label">ملاحظات:</span>
              <span class="value">${payment.notes}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="amount">
            المبلغ المدفوع: ${(Number(payment.amount) || 0).toLocaleString('ar-LY')} دينار ليبي
          </div>
          
          <div class="footer">
            <p>${styles.footerText || ''}</p>
            <p>تم إنشاء هذا الإيصال في: ${new Date().toLocaleString('ar-LY')}</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  };


  const printMultiContractInvoice = () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    const selectedContractData = customerContracts.filter(c => 
      selectedContractsForInv.includes(String(c.Contract_Number))
    );

    const contractTotal = selectedContractData.reduce((sum, contract) => 
      sum + (Number(contract['Total']) || 0), 0
    );

    // Get account balance for this customer
    const accountBalance = customerPayments
      .filter(p => p.entry_type === 'account_payment' || !p.contract_number)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const printTotal = Object.entries(sizeCounts).reduce((sum, [size, qty]) => {
      const unitPrice = printPrices[size] || 0;
      return sum + (qty * unitPrice);
    }, 0);

    const finalTotal = contractTotal + printTotal + (includeAccountBalance ? accountBalance : 0);

    const contractRows = selectedContractData.map(contract => `
      <tr>
        <td>${contract.Contract_Number}</td>
        <td>${contract['Ad Type'] || '—'}</td>
        <td>${contract['Start Date'] ? new Date(contract['Start Date']).toLocaleDateString('ar-LY') : '—'}</td>
        <td>${contract['End Date'] ? new Date(contract['End Date']).toLocaleDateString('ar-LY') : '—'}</td>
        <td>${(Number(contract['Total']) || 0).toLocaleString('ar-LY')} د.ل</td>
      </tr>
    `).join('');

    const printRows = Object.entries(sizeCounts).map(([size, qty]) => {
      const unitPrice = printPrices[size] || 0;
      const lineTotal = qty * unitPrice;
      return `
        <tr>
          <td>${size}</td>
          <td>${qty}</td>
          <td>${unitPrice.toLocaleString('ar-LY')} د.ل</td>
          <td>${lineTotal.toLocaleString('ar-LY')} د.ل</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>فاتورة شاملة - ${selectedCustomerName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:auto}
        h1{font-size:24px;text-align:center;margin-bottom:20px}
        .customer-info{margin-bottom:20px;background:#f9f9f9;padding:15px;border-radius:5px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:center}
        th{background:#f5f5f5;font-weight:bold}
        .total-row{background:#e8f5e8;font-weight:bold}
        .section-title{font-size:18px;font-weight:bold;margin:20px 0 10px 0;color:#333}
        .footer{margin-top:30px;text-align:center;color:#666}
      </style></head><body>
      <h1>فاتورة شاملة</h1>
      <div class="customer-info">
        <strong>العميل:</strong> ${selectedCustomerName}<br>
        <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}<br>
        <strong>عدد العقود:</strong> ${selectedContractsForInv.length}
      </div>
      
      ${contractRows ? `
      <div class="section-title">تفاصيل العقود:</div>
      <table>
        <thead>
          <tr>
            <th>رقم العقد</th>
            <th>نوع الإعلان</th>
            <th>تاريخ البداية</th>
            <th>تاريخ النهاية</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${contractRows}
          <tr class="total-row">
            <td colspan="4">إجمالي العقود</td>
            <td>${contractTotal.toLocaleString('ar-LY')} د.ل</td>
          </tr>
        </tbody>
      </table>
      ` : ''}
      
      ${printRows ? `
      <div class="section-title">تفاصيل الطباعة:</div>
      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${printRows}
          <tr class="total-row">
            <td colspan="3">إجمالي الطباعة</td>
            <td>${printTotal.toLocaleString('ar-LY')} د.ل</td>
          </tr>
        </tbody>
      </table>
      ` : ''}
      
      <table>
        <tbody>
          ${includeAccountBalance ? `
          <tr>
            <td colspan="4">رصيد الحساب العام</td>
            <td>${accountBalance.toLocaleString('ar-LY')} د.ل</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td colspan="4">الإجمالي النهائي</td>
            <td>${finalTotal.toLocaleString('ar-LY')} د.ل</td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        <p>شكراً لتعاملكم معنا</p>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }
  };

  const searchQ = search.trim().toLowerCase();
  const visible = filteredAndSortedCustomers;

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 border border-primary/10">
        <div className="absolute top-0 left-0 w-40 h-40 bg-primary/5 rounded-full -translate-x-20 -translate-y-20" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-16 translate-y-16" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              إدارة الزبائن
            </h1>
            <p className="text-muted-foreground mt-2">إدارة شاملة لبيانات وحسابات الزبائن • {customersSummary.length} زبون</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/admin/overdue-payments')} variant="destructive" size="lg" className="gap-2 shadow-lg">
              <AlertTriangle className="h-4 w-4" />
              الدفعات المتأخرة
            </Button>
            <Button onClick={() => setBulkStatementOpen(true)} variant="outline" size="lg" className="gap-2">
              <Mail className="h-4 w-4" />
              كشوفات جماعية
            </Button>
            <Button onClick={() => { setEditingCustomerId(null); setNewCustomerOpen(true); setCustomerNameInput(''); setCustomerPhoneInput(''); setCustomerCompanyInput(''); setIsCustomerChecked(true); setIsSupplierChecked(false); setSupplierTypeInput(''); setSelectedPrinterId(''); }} size="lg" className="shadow-lg">
              <Plus className="h-4 w-4 ml-2" />
              إضافة زبون
            </Button>
          </div>
        </div>
        
        {/* Collection Rate Progress */}
        {(() => {
          const totalRent = customersSummary.reduce((s, c) => s + c.totalRent, 0);
          const collectionRate = totalRent > 0 ? Math.round((totalAllPaid / totalRent) * 100) : 0;
          return (
            <div className="relative mt-6 pt-4 border-t border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">نسبة التحصيل الإجمالية</span>
                <span className="text-lg font-bold text-primary">{collectionRate}%</span>
              </div>
              <Progress value={collectionRate} className="h-2" />
            </div>
          );
        })()}
      </div>

      {/* Statistics Cards - Modern Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الزبائن</CardTitle>
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shadow-inner">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{customersSummary.length}</div>
            <p className="text-xs text-muted-foreground mt-1">زبون مسجل</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-background shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center shadow-inner">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{customersSummary.reduce((s, c) => s + c.totalRent, 0).toLocaleString('ar-LY')}</div>
            <p className="text-xs text-muted-foreground mt-1">دينار ليبي</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المدفوعات</CardTitle>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center shadow-inner">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalAllPaid.toLocaleString('ar-LY')}</div>
            <p className="text-xs text-muted-foreground mt-1">دينار ليبي</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-destructive/10 via-destructive/5 to-background shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المتبقي</CardTitle>
            <div className="w-12 h-12 bg-destructive/20 rounded-xl flex items-center justify-center shadow-inner">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{customersSummary.reduce((s, c) => s + Math.max(0, c.totalRent - c.totalPaid), 0).toLocaleString('ar-LY')}</div>
            <p className="text-xs text-muted-foreground mt-1">دينار ليبي</p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>قائمة الزبائن</CardTitle>
        </CardHeader>
        <CardContent>
          {/* المرشحات والبحث */}
          <CustomerFilters
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderToggle={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
          />
          
          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => { setCustomerNameInput(''); setCustomerPhoneInput(''); setCustomerCompanyInput(''); setEditingCustomerId(null); setDuplicateNameWarning(null); setNewCustomerOpen(true); }}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة زبون جديد
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/customer-merge')}>
                <Merge className="h-4 w-4 ml-2" />
                دمج الزبائن
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setOverdueRemindersOpen(true)}
              >
                <AlertTriangle className="h-4 w-4 ml-2" />
                تذكيرات المتأخرين
              </Button>
              <Button 
                variant="default"
                className="bg-orange hover:bg-orange/90"
                onClick={() => setDebtRemindersOpen(true)}
              >
                <DollarSign className="h-4 w-4 ml-2" />
                تذكيرات الديون
              </Button>
              <Button disabled={syncing} onClick={async () => {
                try {
                  setSyncing(true);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = (sessionData as any)?.session?.access_token || null;
                  const resp = await fetch('/.netlify/functions/sync-customers', {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      ...(token ? { authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ createMissing: false })
                  });

                  let json: any = null;
                  try {
                    json = await resp.json();
                  } catch (err) {
                    // sometimes body stream may be consumed or invalid JSON; try text
                    try {
                      const text = await resp.text();
                      json = text ? { text } : null;
                    } catch (err2) {
                      json = null;
                    }
                  }

                  if (!resp.ok) {
                    console.error('sync error', json || resp.statusText);
                    toast.error((json && (json.error || json.text)) || 'فشل المزامنة');
                  } else {
                    toast.success(`تمت المزامنة. تم تحديث ${json?.updated || 0} عقود، إضافة عملاء: ${json?.createdCustomers || 0}`);
                    // reload data if something changed
                    if ((json?.updated || 0) > 0 || (json?.createdCustomers || 0) > 0) loadData();
                  }
                } catch (e) {
                  console.error('sync error', e);
                  toast.error('خطأ في المزامنة');
                } finally {
                  setSyncing(false);
                }
              }}>
                {syncing ? 'جاري المزامنة...' : 'مزامنة العملاء'}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline"
                onClick={() => setBulkStatementOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                كشوفات جماعية
              </Button>
            </div>
          </div>
          
          {/* Collapsible Overdue Payments Alert */}
          <TopOverduePayments />

          {/* Add/Edit customer dialog */}
          <Dialog open={newCustomerOpen} onOpenChange={(open) => {
            if (!open) {
              setEditingCustomerId(null);
              setCustomerNameInput('');
              setCustomerPhoneInput('');
              setCustomerCompanyInput('');
              setIsCustomerChecked(true);
              setIsSupplierChecked(false);
              setSupplierTypeInput('');
              setSelectedPrinterId('');
            }
            setNewCustomerOpen(open);
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingCustomerId ? 'تعديل الزبون' : 'إضافة زبون جديد'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Input 
                    placeholder="اسم الزبون" 
                    value={customerNameInput} 
                    onChange={(e) => {
                      const newName = e.target.value;
                      setCustomerNameInput(newName);
                      // Check for duplicate name
                      if (newName.trim()) {
                        const duplicate = customers.find(c => 
                          c.name.toLowerCase().trim() === newName.toLowerCase().trim() && 
                          c.id !== editingCustomerId
                        );
                        setDuplicateNameWarning(duplicate ? `يوجد زبون بنفس الاسم: ${duplicate.name}` : null);
                      } else {
                        setDuplicateNameWarning(null);
                      }
                    }} 
                  />
                  {duplicateNameWarning && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400">{duplicateNameWarning}</span>
                    </div>
                  )}
                </div>
                <Input placeholder="هاتف" value={customerPhoneInput} onChange={(e)=>setCustomerPhoneInput(e.target.value)} />
                <Input placeholder="اسم الشركة" value={customerCompanyInput} onChange={(e)=>setCustomerCompanyInput(e.target.value)} />
                
                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-3 block">نوع الحساب</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="is-customer-main" 
                        checked={isCustomerChecked} 
                        onCheckedChange={(checked) => setIsCustomerChecked(checked === true)} 
                      />
                      <label htmlFor="is-customer-main" className="text-sm font-medium cursor-pointer">
                        زبون (يستأجر لوحات)
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="is-supplier-main" 
                        checked={isSupplierChecked} 
                        onCheckedChange={(checked) => setIsSupplierChecked(checked === true)} 
                      />
                      <label htmlFor="is-supplier-main" className="text-sm font-medium cursor-pointer">
                        مورد (نشتري منه)
                      </label>
                    </div>
                    
                    {isSupplierChecked && (
                      <div className="mr-6 mt-2 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">نوع المشتريات من المورد</label>
                          <Select value={supplierTypeInput} onValueChange={setSupplierTypeInput}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر نوع المشتريات" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general_purchases">مشتريات عامة</SelectItem>
                              <SelectItem value="billboard_rental">إيجار لوحات</SelectItem>
                              <SelectItem value="printer">مطبعة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {supplierTypeInput === 'printer' && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">اختر المطبعة</label>
                            <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المطبعة" />
                              </SelectTrigger>
                              <SelectContent>
                                {printers.map(printer => (
                                  <SelectItem key={printer.id} value={printer.id}>
                                    {printer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>إلغاء</Button>
                  <Button onClick={async () => {
                    const name = customerNameInput.trim();
                    const phone = customerPhoneInput.trim();
                    const company = customerCompanyInput.trim();
                    
                    if (!name) {
                      toast.error('يرجى إدخال اسم العميل');
                      return;
                    }
                    
                    if (!isCustomerChecked && !isSupplierChecked) {
                      toast.error('يجب اختيار نوع واحد على الأقل (زبون أو مورد)');
                      return;
                    }
                    
                    if (isSupplierChecked && !supplierTypeInput) {
                      toast.error('يرجى اختيار نوع المشتريات للمورد');
                      return;
                    }
                    
                    if (isSupplierChecked && supplierTypeInput === 'printer' && !selectedPrinterId) {
                      toast.error('يرجى اختيار المطبعة من القائمة');
                      return;
                    }
                    
                    try {
                      const customerData = {
                        name,
                        phone: phone || null,
                        company: company || null,
                        is_customer: isCustomerChecked,
                        is_supplier: isSupplierChecked,
                        supplier_type: isSupplierChecked ? supplierTypeInput : null,
                        printer_id: (isSupplierChecked && supplierTypeInput === 'printer') ? selectedPrinterId : null
                      };
                      
                      if (editingCustomerId) {
                        console.log('Updating customer:', editingCustomerId, customerData);
                        const { error, data } = await supabase
                          .from('customers')
                          .update(customerData)
                          .eq('id', editingCustomerId)
                          .select();
                        
                        console.log('Update result:', { error, data });
                        
                        if (!error) {
                          setCustomers(prev => prev.map(c => c.id === editingCustomerId ? { 
                            ...c, 
                            ...customerData
                          } : c));
                          
                          toast.success('تم تحديث بيانات العميل بنجاح');
                          setNewCustomerOpen(false);
                          setEditingCustomerId(null);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                          setIsCustomerChecked(true);
                          setIsSupplierChecked(false);
                          setSupplierTypeInput('');
                          setSelectedPrinterId('');
                          
                          await loadData();
                        } else {
                          console.error('Update error:', error);
                          toast.error(`فشل في تحديث العميل: ${error.message}`);
                        }
                      } else {
                        const { data: newC, error } = await supabase
                          .from('customers')
                          .insert(customerData)
                          .select()
                          .single();
                        
                        if (!error && newC && (newC as any).id) {
                          setCustomers(prev => [{ 
                            id: (newC as any).id, 
                            ...customerData
                          }, ...prev]);
                          
                          toast.success('تم إضافة العميل بنجاح');
                          setNewCustomerOpen(false);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                          setIsCustomerChecked(true);
                          setIsSupplierChecked(false);
                          setSupplierTypeInput('');
                          setSelectedPrinterId('');
                        } else {
                          console.error('Insert error:', error);
                          toast.error(`فشل في إضافة العميل: ${error?.message || 'خطأ غير معروف'}`);
                        }
                      }
                    } catch (e) {
                      console.error('customer save error', e);
                      toast.error('خطأ في حفظ بيانات العميل');
                    }
                  }}>حفظ</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-bold text-foreground">الزبون</TableHead>
                  <TableHead className="font-bold text-foreground">التواصل</TableHead>
                  <TableHead className="font-bold text-foreground text-center">العقود</TableHead>
                  <TableHead className="font-bold text-foreground text-left">الإجمالي</TableHead>
                  <TableHead className="font-bold text-foreground text-left">المدفوع</TableHead>
                  <TableHead className="font-bold text-foreground text-left">الرصيد</TableHead>
                  <TableHead className="font-bold text-foreground text-left">المتبقي</TableHead>
                  <TableHead className="font-bold text-foreground">السداد</TableHead>
                  <TableHead className="font-bold text-foreground">الحالة</TableHead>
                  <TableHead className="font-bold text-foreground">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(c => {
                  // ✅ استخدام القيم المحسوبة مسبقاً بالمنطق الصحيح
                  const remaining = c.remainingDebt;
                  const paymentPercentage = c.repaymentPercentage;

                  return (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      remaining={remaining}
                      paymentPercentage={paymentPercentage}
                      onViewBilling={() => {
                        const id = typeof c.id === 'string' ? c.id : String(c.id);
                        navigate(`/admin/customer-billing?id=${encodeURIComponent(id)}&name=${encodeURIComponent(c.name)}`);
                      }}
                      onEdit={async () => {
                        setEditingCustomerId(c.id);
                        setCustomerNameInput(c.name);
                        setCustomerPhoneInput(c.phone || '');
                        setCustomerCompanyInput(c.company || '');
                        setDuplicateNameWarning(null);
                        
                        // Load customer type data from database
                        if (!c.id.startsWith('name:')) {
                          const { data } = await supabase
                            .from('customers')
                            .select('is_customer, is_supplier, supplier_type, printer_id')
                            .eq('id', c.id)
                            .single();
                          
                          if (data) {
                            setIsCustomerChecked(data.is_customer ?? true);
                            setIsSupplierChecked(data.is_supplier ?? false);
                            setSupplierTypeInput(data.supplier_type || '');
                            setSelectedPrinterId((data as any).printer_id || '');
                          }
                        }
                        
                        setNewCustomerOpen(true);
                      }}
                      onDelete={async () => {
                        setCustomerToDelete(c);
                        // Check if customer has contracts or debt
                        const hasDebt = remaining > 0;
                        const contractsCount = c.contractsCount;
                        setDeleteCheckResult({
                          hasContracts: contractsCount > 0,
                          hasDebt,
                          contractsCount,
                          debtAmount: remaining
                        });
                        setDeleteCustomerOpen(true);
                      }}
                    />
                  );
                })}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">فواتير وعقود العميل: {selectedCustomerName}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>عقود العميل ({customerContracts.length})</span>
                    <span className="text-sm text-muted-foreground">إجمالي قيمة العقود</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerContracts.length > 0 ? (
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>نوع الإعلان</TableHead>
                            <TableHead>تاريخ البداية</TableHead>
                            <TableHead>تاريخ النهاية</TableHead>
                            <TableHead>القيمة الإجمالية</TableHead>
                            <TableHead>الخصم</TableHead>
                            <TableHead>المدفوع</TableHead>
                            <TableHead>المتبقي</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerContracts.map(ct => {
                            const paidForContract = customerPayments.filter(p => (p.contract_number||'') === (ct.Contract_Number||'') && p.entry_type !== 'account_payment').reduce((s, x) => s + (Number(x.amount)||0), 0);
                            const totalRent = Number(ct['Total'] || 0) || 0;
                            const discount = Number((ct as any)['Discount'] || 0) || 0;
                            const remaining = Math.max(0, totalRent - paidForContract);
                            const endDate = ct['End Date'] ? new Date(ct['End Date']) : null;
                            const today = new Date();
                            const isExpired = endDate && endDate < today;
                            const isActive = endDate && endDate >= today;
                            
                            return (
                              <TableRow key={ct.Contract_Number}>
                                <TableCell className="font-medium">{ct.Contract_Number}</TableCell>
                                <TableCell>{ct['Ad Type'] || '—'}</TableCell>
                                <TableCell>{ct['Start Date'] ? new Date(ct['Start Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell>{ct['End Date'] ? new Date(ct['End Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell className="font-semibold">{totalRent.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell className="text-orange font-medium">{discount > 0 ? `${discount.toLocaleString('ar-LY')} د.ل` : '—'}</TableCell>
                                <TableCell className="text-green">{paidForContract.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell className={remaining > 0 ? 'text-red font-semibold' : 'text-green'}>{remaining.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell>
                                  {isExpired ? (
                                    <Badge variant="destructive" className="text-xs">منتهي</Badge>
                                  ) : isActive ? (
                                    <Badge className="text-xs bg-accent text-accent-foreground">نشط</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">غير محدد</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingContractDiscount({
                                        contractNumber: ct.Contract_Number,
                                        currentDiscount: discount
                                      });
                                      setEditDiscountOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 ml-1" />
                                    تعديل الخصم
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد عقود مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>سجل الدفعات والإيصالات ({customerPayments.length})</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}>إضافة دين سابق</Button>
                      <Button size="sm" onClick={() => { setPrintInvOpen(true); setSelectedContractsForInv(customerContracts[0]?.Contract_Number ? [String(customerContracts[0]?.Contract_Number)] : []); }}>إضافة فاتورة طباعة</Button>
                      <Button size="sm" onClick={() => { setAddType('invoice'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة فاتورة</Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddType('receipt'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة إيصال</Button>
                      <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => { setAddType('account_payment'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(''); }}>
                        <Plus className="h-4 w-4 ml-1" />
                        دفعة على الحساب
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>طريقة الدفع</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>تاريخ الدفع</TableHead>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {p.contract_number || (p.entry_type === 'account_payment' ? 'حساب عام' : '—')}
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${
                                  p.entry_type === 'account_payment' ? 'bg-accent/10 text-green border-accent/30' :
                                  p.entry_type === 'receipt' ? 'bg-primary/10 text-blue border-primary/30' :
                                  p.entry_type === 'debt' ? 'bg-destructive/10 text-red border-destructive/30' :
                                  'bg-muted text-muted-foreground'
                                }`} variant="outline">
                                  {p.entry_type === 'account_payment' ? 'دفعة حساب' :
                                   p.entry_type === 'receipt' ? 'إيصال' :
                                   p.entry_type === 'debt' ? 'دين سابق' :
                                   p.entry_type || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-green">{(Number(p.amount)||0).toLocaleString('ar-LY')} د.ل</TableCell>
                              <TableCell>{p.method || '—'}</TableCell>
                              <TableCell>{p.reference || '—'}</TableCell>
                              <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-LY') : '—'}</TableCell>
                              <TableCell>{p.notes || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => printReceipt(p)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    طباعة إيصال
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openEditReceipt(p)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => deleteReceipt(p.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد دفعات مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Invoice/Receipt Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addType === 'invoice' ? 'إضافة فاتورة' : 
               addType === 'account_payment' ? 'إضافة دفعة على الحساب' : 
               'إضافة إيصال'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">العميل: {selectedCustomerName}</div>
            
            {addType === 'account_payment' && (
              <div className="p-3 bg-accent/10 border border-accent/30 rounded">
                <p className="text-sm text-accent-foreground">
                  هذه الدفعة ستُضاف إلى رصيد الحساب العام للعميل ولن تُربط بعقد محدد
                </p>
              </div>
            )}

            {addType !== 'account_payment' && (
              <div>
                <label className="text-sm font-medium">العقد</label>
                <Select value={addContract || 'none'} onValueChange={(v) => setAddContract(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عقدًا أو اتركه فارغاً للحساب العام" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">حساب عام (بدون عقد محدد)</SelectItem>
                    {customerContracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)}>{String(ct.Contract_Number)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={addAmount} onChange={(e)=>setAddAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={addMethod} onValueChange={setAddMethod}>
                <SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input value={addReference} onChange={(e)=>setAddReference(e.target.value)} placeholder="رقم المرجع أو الشيك" />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={addDate} onChange={(e)=>setAddDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={addNotes} onChange={(e)=>setAddNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                try {
                  if (!addAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(addAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customers.find(c => c.name === selectedCustomerName)?.id || (typeof selectedCustomer === 'string' && !selectedCustomer.startsWith('name:') ? selectedCustomer : null),
                    customer_name: selectedCustomerName,
                    contract_number: addType === 'account_payment' ? null : (addContract || null),
                    amount: amt,
                    method: addMethod || null,
                    reference: addReference || null,
                    notes: addNotes || null,
                    paid_at: addDate ? new Date(addDate).toISOString() : new Date().toISOString(),
                    entry_type: addType === 'account_payment' ? 'account_payment' : addType,
                  } as any;
                  
                  const { error } = await supabase.from('customer_payments').insert(payload);
                  if (error) { console.error(error); toast.error('فشل الحفظ'); return; }
                  toast.success('تمت الإضافة بنجاح');
                  setAddOpen(false);
                  if (selectedCustomer) await openCustomer(selectedCustomer);
                  await loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('خطأ غير متوقع');
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input
                type="number"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="المبلغ"
              />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={receiptMethod} onValueChange={setReceiptMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                placeholder="رقم المرجع أو الشيك"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ الدفع</label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditReceiptOpen(false)}>إلغاء</Button>
              <Button onClick={saveReceiptEdit}>حفظ التعديلات</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Invoice Dialog (Enhanced) */}
      <Dialog open={printInvOpen} onOpenChange={setPrintInvOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>فاتورة شاملة محسنة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">العميل: {selectedCustomerName}</div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">اختر العقود (يمكن اختيار أكثر من عقد):</label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-3">
                {customerContracts.map((ct)=>{
                  const num = String(ct.Contract_Number||'');
                  const isSelected = selectedContractsForInv.includes(num);
                  return (
                    <div key={num} className="flex items-center space-x-2">
                      <Checkbox
                        id={`contract-${num}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedContractsForInv(prev => [...prev, num]);
                          } else {
                            setSelectedContractsForInv(prev => prev.filter(c => c !== num));
                          }
                        }}
                      />
                      <label htmlFor={`contract-${num}`} className="text-sm cursor-pointer">
                        عقد رقم {num} - {ct['Ad Type'] || '—'} - {(Number(ct['Total']) || 0).toLocaleString('ar-LY')} د.ل
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">عدد اللوحات حسب المقاس</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1">المقاس</th>
                      <th className="border px-2 py-1">الكمية</th>
                      <th className="border px-2 py-1">سعر الوحدة (طباعة)</th>
                      <th className="border px-2 py-1">الإجمالي</th>
                      <th className="border px-2 py-1">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(sizeCounts).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-muted-foreground py-2">لا توجد لوحات للعقود المحددة</td>
                      </tr>
                    )}
                    {Object.entries(sizeCounts).map(([size, qty]) => {
                      const unit = Number(printPrices[size] || 0);
                      const line = (Number(qty)||0) * unit;
                      return (
                        <tr key={size}>
                          <td className="border px-2 py-1 text-center">{size}</td>
                          <td className="border px-2 py-1 text-center">
                            <Input type="number" className="w-24 mx-auto" value={String(qty)} onChange={(e)=> setSizeCounts((p)=> ({...p, [size]: Math.max(0, Number(e.target.value)||0)}))} />
                          </td>
                          <td className="border px-2 py-1 text-center">
                            <Input type="number" className="w-28 mx-auto" value={String(unit)} onChange={(e)=> setPrintPrices((p)=> ({...p, [size]: Math.max(0, Number(e.target.value)||0)}))} />
                          </td>
                          <td className="border px-2 py-1 text-center">{line.toLocaleString('ar-LY')} د.ل</td>
                          <td className="border px-2 py-1 text-center">
                            <Button variant="outline" size="sm" onClick={()=> setSizeCounts((p)=> { const c={...p}; delete c[size]; return c; })}>حذف</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-account-balance"
                checked={includeAccountBalance}
                onCheckedChange={setIncludeAccountBalance}
              />
              <label htmlFor="include-account-balance" className="text-sm cursor-pointer">
                إضافة رصيد الحساب العام للعميل
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintInvOpen(false)}>إغلاق</Button>
              <Button onClick={printMultiContractInvoice} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Printer className="h-4 w-4 ml-2" />
                طباعة الفاتورة الشاملة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Previous Debt Dialog */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة دين سابق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} placeholder="ملاحظات" />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setAddDebtOpen(false)}>إلغاء</Button>
              <Button onClick={async ()=>{
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customers.find(c => c.name === selectedCustomerName)?.id || (typeof selectedCustomer === 'string' && !selectedCustomer.startsWith('name:') ? selectedCustomer : null),
                    customer_name: selectedCustomerName,
                    contract_number: null,
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  } as any;
                  
                  const { error } = await supabase.from('customer_payments').insert(payload);
                  if (error) { console.error(error); toast.error('فشل الحفظ'); return; }
                  toast.success('تمت إضافة الدين');
                  setAddDebtOpen(false);
                  if (selectedCustomer) await openCustomer(selectedCustomer);
                  await loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('خطأ غير متوقع');
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overdue Reminders Dialog */}
      <SendOverdueRemindersDialog 
        open={overdueRemindersOpen} 
        onOpenChange={setOverdueRemindersOpen} 
      />
      
      {/* Debt Reminders Dialog */}
      <SendDebtRemindersDialog 
        open={debtRemindersOpen} 
        onOpenChange={setDebtRemindersOpen} 
      />
      
      {/* Bulk Account Statement Dialog */}
      <BulkAccountStatementDialog
        customers={filteredAndSortedCustomers}
        open={bulkStatementOpen}
        onOpenChange={setBulkStatementOpen}
      />

      {/* Edit Discount Dialog */}
      <Dialog open={editDiscountOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingContractDiscount(null);
          setNewDiscountAmount('');
        }
        setEditDiscountOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الخصم للعقد رقم {editingContractDiscount?.contractNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">الخصم الحالي</label>
              <div className="text-lg font-bold text-orange">
                {(editingContractDiscount?.currentDiscount || 0).toLocaleString('ar-LY')} د.ل
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">قيمة الخصم الجديدة</label>
              <Input
                type="number"
                value={newDiscountAmount}
                onChange={(e) => setNewDiscountAmount(e.target.value)}
                placeholder="أدخل قيمة الخصم"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDiscountOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                if (!editingContractDiscount?.contractNumber) return;
                
                try {
                  const discountValue = Number(newDiscountAmount) || 0;
                  
                  const { error } = await supabase
                    .from('Contract')
                    .update({ Discount: discountValue })
                    .eq('Contract_Number', editingContractDiscount.contractNumber);
                  
                  if (error) {
                    console.error('Error updating discount:', error);
                    toast.error('فشل في تحديث الخصم');
                    return;
                  }
                  
                  toast.success('تم تحديث الخصم بنجاح');
                  setEditDiscountOpen(false);
                  setEditingContractDiscount(null);
                  setNewDiscountAmount('');
                  
                  // Reload data
                  await loadData();
                  if (selectedCustomer) {
                    await openCustomer(selectedCustomer);
                  }
                } catch (e) {
                  console.error('Error:', e);
                  toast.error('خطأ في تحديث الخصم');
                }
              }}>حفظ الخصم</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Dialog */}
      <Dialog open={deleteCustomerOpen} onOpenChange={(open) => {
        if (!open) {
          setCustomerToDelete(null);
          setDeleteCheckResult(null);
        }
        setDeleteCustomerOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف الزبون: {customerToDelete?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {deleteCheckResult?.hasContracts && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">تحذير: يوجد عقود</p>
                  <p className="text-sm text-muted-foreground">
                    هذا الزبون لديه {deleteCheckResult.contractsCount} عقد مرتبط
                  </p>
                </div>
              </div>
            )}
            
            {deleteCheckResult?.hasDebt && (
              <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">تحذير: يوجد دين</p>
                  <p className="text-sm text-muted-foreground">
                    هذا الزبون لديه دين بقيمة {deleteCheckResult.debtAmount.toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </div>
            )}
            
            {!deleteCheckResult?.hasContracts && !deleteCheckResult?.hasDebt && (
              <p className="text-muted-foreground">
                هل أنت متأكد من حذف هذا الزبون؟ هذا الإجراء لا يمكن التراجع عنه.
              </p>
            )}
            
            {(deleteCheckResult?.hasContracts || deleteCheckResult?.hasDebt) && (
              <p className="text-sm text-destructive font-medium">
                ⚠️ سيتم حذف الزبون وجميع بياناته بشكل نهائي!
              </p>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteCustomerOpen(false)}>إلغاء</Button>
              <Button 
                variant="destructive" 
                onClick={async () => {
                  if (!customerToDelete || customerToDelete.id.startsWith('name:')) {
                    toast.error('لا يمكن حذف هذا الزبون');
                    return;
                  }
                  
                  try {
                    // Delete customer payments first
                    await supabase
                      .from('customer_payments')
                      .delete()
                      .eq('customer_id', customerToDelete.id);
                    
                    // Update contracts to remove customer_id
                    await supabase
                      .from('Contract')
                      .update({ customer_id: null })
                      .eq('customer_id', customerToDelete.id);
                    
                    // Delete the customer
                    const { error } = await supabase
                      .from('customers')
                      .delete()
                      .eq('id', customerToDelete.id);
                    
                    if (error) {
                      console.error('Error deleting customer:', error);
                      toast.error(`فشل في حذف الزبون: ${error.message}`);
                      return;
                    }
                    
                    toast.success('تم حذف الزبون بنجاح');
                    setDeleteCustomerOpen(false);
                    setCustomerToDelete(null);
                    setDeleteCheckResult(null);
                    await loadData();
                  } catch (e) {
                    console.error('Delete error:', e);
                    toast.error('خطأ في حذف الزبون');
                  }
                }}
              >
                حذف الزبون
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}