// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { Printer, Calculator, Receipt, Info, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllBillboards } from '@/services/supabaseService';
import { generateModernInvoiceHTML, numberToArabicWords, generateModernPrintInvoiceHTML } from '@/components/billing/InvoiceTemplates';
import { getContractWithBillboards } from '@/services/contractService';
import ContractPDFDialog from './ContractPDFDialog';

// Import components
import { SummaryCards } from '@/components/billing/SummaryCards';
import { ContractSection } from '@/components/billing/ContractSection';
import { PaymentSection } from '@/components/billing/PaymentSection';
import ModernPrintInvoiceDialog from '@/components/billing/ModernPrintInvoiceDialog';
import { UnpaidContractsDialog } from '@/components/billing/UnpaidContractsDialog';
import { SalesSection } from '@/components/billing/SalesSection';

// ✅ Import new receipt and account statement dialogs
import ReceiptPrintDialog from '@/components/billing/ReceiptPrintDialog';
import AccountStatementDialog from '@/components/billing/AccountStatementDialog';
import { SendAccountStatementDialog } from '@/components/customers/SendAccountStatementDialog';
import { BulkPaymentDialog } from '@/components/billing/BulkPaymentDialog';
import GeneralDiscountsSection from '@/components/billing/GeneralDiscountsSection';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { PrintInvoicePaymentDialog } from '@/components/billing/PrintInvoicePaymentDialog';
import { PurchaseInvoiceDialog } from '@/components/billing/PurchaseInvoiceDialog';
import { SalesInvoiceDialog } from '@/components/billing/SalesInvoiceDialog';

// Import types and utilities
import {
  PaymentRow,
  ContractRow,
  PrintedInvoiceRow,
} from '@/components/billing/BillingTypes';

import {
  calculateRemainingBalanceAfterPayment,
  getContractDetails,
  calculateTotalRemainingDebt
} from '@/components/billing/BillingUtils';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number; // عدد الأوجه لكل لوحة
  totalFaces: number; // إجمالي الأوجه (quantity × faces)
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
}

export default function CustomerBilling() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const paramId = params.get('id') || '';
  const paramName = params.get('name') || '';
  const modernPrintFlag = params.get('modernPrint');

  // Basic state
  const [customerId, setCustomerId] = useState<string>(paramId);
  const [customerName, setCustomerName] = useState<string>(paramName);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [customerType, setCustomerType] = useState<{
    isCustomer: boolean;
    isSupplier: boolean;
    supplierType: string | null;
    printerName?: string | null;
  }>({ isCustomer: true, isSupplier: false, supplierType: null, printerName: null });
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [printedInvoices, setPrintedInvoices] = useState<PrintedInvoiceRow[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  
  // ✅ NEW: Print invoice details dialog state
  const [printInvoiceDetailsOpen, setPrintInvoiceDetailsOpen] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<any>(null);

  // Dialog states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [editReceiptAmount, setEditReceiptAmount] = useState('');
  const [editReceiptMethod, setEditReceiptMethod] = useState('');
  const [editReceiptReference, setEditReceiptReference] = useState('');
  const [editReceiptNotes, setEditReceiptNotes] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');

  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  // Enhanced print invoice states
  const [printContractInvoiceOpen, setPrintContractInvoiceOpen] = useState(false);
  const [selectedContractsForInv, setSelectedContractsForInv] = useState<string[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [printOpenToPreview, setPrintOpenToPreview] = useState(false);
  const [printAuto, setPrintAuto] = useState(false);
  const [printForPrinter, setPrintForPrinter] = useState(false);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [printPrices, setPrintPrices] = useState<Record<string, number>>({});
  const [sizeAreas, setSizeAreas] = useState<Record<string, number>>({});
  const [sizeFaces, setSizeFaces] = useState<Record<string, number>>({});
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // Contract PDF Dialog state
  const [contractPDFOpen, setContractPDFOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);

  // ✅ NEW: Receipt and Account Statement dialog states
  const [receiptPrintOpen, setReceiptPrintOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any>(null);
  const [accountStatementOpen, setAccountStatementOpen] = useState(false);
  const [sendAccountStatementOpen, setSendAccountStatementOpen] = useState(false);
  
  // ✅ NEW: Bulk payment dialog state
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [selectedContractsForBulkPayment, setSelectedContractsForBulkPayment] = useState<number[]>([]);
  
  // ✅ NEW: Distribute payment dialog state
  const [enhancedDistributePaymentOpen, setEnhancedDistributePaymentOpen] = useState(false);
  const [distributeTotalAmount, setDistributeTotalAmount] = useState('');
  const [selectedContractsForDistribute, setSelectedContractsForDistribute] = useState<Set<number>>(new Set());
  
  // ✅ NEW: Print invoice payment dialog state
  const [printInvoicePaymentOpen, setPrintInvoicePaymentOpen] = useState(false);
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<any>(null);
  
  // ✅ NEW: Unpaid contracts dialog state
  const [unpaidContractsDialogOpen, setUnpaidContractsDialogOpen] = useState(false);
  
  // ✅ NEW: Purchase and Sales Invoice dialog states
  const [purchaseInvoiceDialogOpen, setPurchaseInvoiceDialogOpen] = useState(false);
  const [salesInvoiceDialogOpen, setSalesInvoiceDialogOpen] = useState(false);

  // Account payment dialog states
  const [accountPaymentOpen, setAccountPaymentOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState('');
  const [accountPaymentReference, setAccountPaymentReference] = useState('');
  const [accountPaymentNotes, setAccountPaymentNotes] = useState('');
  const [accountPaymentDate, setAccountPaymentDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [accountPaymentContract, setAccountPaymentContract] = useState('');
  const [accountPaymentToGeneral, setAccountPaymentToGeneral] = useState(true);
  
  // ✅ NEW: Purchase from customer dialog states
  const [purchaseFromCustomerOpen, setPurchaseFromCustomerOpen] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  // ✅ NEW: Edit distributed payment dialog state
  const [editDistributedPaymentOpen, setEditDistributedPaymentOpen] = useState(false);
  const [editingDistributedPaymentId, setEditingDistributedPaymentId] = useState<string | null>(null);
  const [editingDistributedPayments, setEditingDistributedPayments] = useState<PaymentRow[]>([]);
  const [editDistributionAmounts, setEditDistributionAmounts] = useState<Record<string, number>>({});

  // ✅ NEW: General transaction states (واردات/صادرات خارج العقود)
  const [generalDebitOpen, setGeneralDebitOpen] = useState(false);
  const [generalCreditOpen, setGeneralCreditOpen] = useState(false);
  const [generalAmount, setGeneralAmount] = useState('');
  const [generalDescription, setGeneralDescription] = useState('');
  const [generalDate, setGeneralDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [generalReference, setGeneralReference] = useState('');
  
  // ✅ NEW: Filter state for transaction view
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'debits' | 'credits' | 'print_invoices'>('all');
  
  // ✅ Show collection details in payments table
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
  
  // Add payment to contract dialog
  const [addPaymentToContractOpen, setAddPaymentToContractOpen] = useState(false);
  const [selectedContractForPayment, setSelectedContractForPayment] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  useEffect(() => {
    if (modernPrintFlag) {
      setPrintContractInvoiceOpen(true);
      const cleanedParams = new URLSearchParams(location.search);
      cleanedParams.delete('modernPrint');
      const nextSearch = cleanedParams.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
    }
  }, [location.pathname, location.search, modernPrintFlag, navigate]);

  // Initialize customer data
  useEffect(() => {
    (async () => {
      try {
        if (customerId && !customerName) {
          const { data } = await supabase.from('customers').select('name, phone').eq('id', customerId).single();
          setCustomerName(data?.name || '');
          setCustomerPhone(data?.phone || '');
        }
        if (!customerId && customerName) {
          const { data } = await supabase.from('customers').select('id, phone').ilike('name', customerName).limit(1).maybeSingle();
          if (data?.id) setCustomerId(data.id);
          setCustomerPhone(data?.phone || '');
        }
      } catch {}
    })();
  }, [customerId, customerName]);

  // ✅ FIXED: Load data with proper contract-payment relationship
  const loadData = async () => {
    try {
      // Load customer type information and printer name if applicable
      if (customerId) {
        const { data: customerDataResult } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();
        
        if (customerDataResult) {
          setCustomerData(customerDataResult);
          let printerName = null;
          
          // If supplier is a printer, get printer name
          if (customerDataResult.supplier_type === 'printer' && customerDataResult.printer_id) {
            const { data: printerData } = await supabase
              .from('printers')
              .select('name')
              .eq('id', customerDataResult.printer_id)
              .single();
            
            if (printerData) {
              printerName = printerData.name;
            }
          }
          
          setCustomerType({
            isCustomer: customerDataResult.is_customer ?? true,
            isSupplier: customerDataResult.is_supplier ?? false,
            supplierType: customerDataResult.supplier_type ?? null,
            printerName: printerName
          });
        }
      }
      
      let paymentsData: PaymentRow[] = [];
      if (customerId) {
        const p = await (supabase as any).from('customer_payments').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
        if (!p.error) paymentsData = (p.data || []) as PaymentRow[];
      }
      if ((!paymentsData || paymentsData.length === 0) && customerName) {
        const p = await (supabase as any).from('customer_payments').select('*').ilike('customer_name', `%${customerName}%`).order('created_at', { ascending: true });
        if (!p.error) paymentsData = (p.data || []) as PaymentRow[];
      }
      setPayments(paymentsData);

      let contractsData: ContractRow[] = [];
      if (customerId) {
        const c = await (supabase as any).from('Contract').select('*').eq('customer_id', customerId).order('Contract_Number', { ascending: false });
        if (!c.error) contractsData = (c.data || []) as ContractRow[];
      }
      if ((!contractsData || contractsData.length === 0) && customerName) {
        const c = await (supabase as any).from('Contract').select('*').ilike('Customer Name', `%${customerName}%`).order('Contract_Number', { ascending: false });
        if (!c.error) contractsData = (c.data || []) as ContractRow[];
      }
      setContracts(contractsData);

      let printedInvoicesData: PrintedInvoiceRow[] = [];
      try {
        // ✅ إذا كان المورد مطبعة، جلب فواتير الطباعة المرتبطة بالمطبعة
        if (customerType.supplierType === 'printer' && customerType.printerName) {
          const { data, error } = await (supabase as any)
            .from('printed_invoices')
            .select('*')
            .eq('printer_name', customerType.printerName)
            .order('created_at', { ascending: false });
          if (!error && data) printedInvoicesData = data;
        } else if (customerId) {
          const { data, error } = await (supabase as any)
            .from('printed_invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
          if (!error && data) printedInvoicesData = data;
        } else if (customerName) {
          // Fallback: if no customerId, try to match by customer name (fuzzy)
          const { data, error } = await (supabase as any)
            .from('printed_invoices')
            .select('*')
            .ilike('customer_name', `%${customerName}%`)
            .order('created_at', { ascending: false });
          if (!error && data) printedInvoicesData = data;
        }
      } catch (e) {
        console.warn('Error loading printed_invoices:', e);
        printedInvoicesData = [];
      }
      setPrintedInvoices(printedInvoicesData || []);

      // ✅ Load purchase invoices (فواتير المشتريات من الزبون)
      let purchaseInvoicesData: any[] = [];
      try {
        if (customerId) {
          const { data, error } = await supabase
            .from('purchase_invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
          if (!error && data) purchaseInvoicesData = data;
        }
      } catch (e) {
        console.warn('Error loading purchase_invoices:', e);
        purchaseInvoicesData = [];
      }
      setPurchaseInvoices(purchaseInvoicesData || []);

      // ✅ Load sales invoices (فواتير المبيعات للزبون)
      let salesInvoicesData: any[] = [];
      try {
        if (customerId) {
          const { data, error } = await supabase
            .from('sales_invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
          if (!error && data) salesInvoicesData = data;
        }
      } catch (e) {
        console.warn('Error loading sales_invoices:', e);
        salesInvoicesData = [];
      }
      setSalesInvoices(salesInvoicesData || []);

      // تحميل الخصومات النشطة (مبالغ ثابتة)
      if (customerId) {
        try {
          const { data: discountsData } = await supabase
            .from('customer_general_discounts')
            .select('discount_type, discount_value, status')
            .eq('customer_id', customerId)
            .eq('status', 'active');
          const discountSum = (discountsData || [])
            .filter((d: any) => d.discount_type === 'fixed')
            .reduce((sum: number, d: any) => sum + (Number(d.discount_value) || 0), 0);
          setTotalDiscounts(discountSum);
        } catch (e) {
          setTotalDiscounts(0);
        }
      } else {
        setTotalDiscounts(0);
      }

      try {
        const billboards = await fetchAllBillboards();
        setAllBillboards(billboards as any);
      } catch {
        setAllBillboards([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    }
  };

  useEffect(() => { loadData(); }, [customerId, customerName]);

  // ✅ إصلاح حساب عدد الأوجه - حساب إجمالي الأوجه من جميع اللوحات
  useEffect(() => {
    const sel = new Set(selectedContractsForInv);
    const boards = allBillboards.filter((b: any) => 
      sel.has(String(b.Contract_Number || '')) && 
      (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
    );
    
    const counts: Record<string, number> = {};
    const totalFacesPerSize: Record<string, number> = {};
    const facesPerBoard: Record<string, number> = {};
    
    for (const b of boards) {
      const size = String(b.Size || b.size || '—');
      const faceCount = Number(b.Faces || b.faces || b.Number_of_Faces || b.Faces_Count || b.faces_count || 1);
      
      counts[size] = (counts[size] || 0) + 1;
      totalFacesPerSize[size] = (totalFacesPerSize[size] || 0) + faceCount;
      
      // حفظ عدد الأوجه لكل لوحة (للعرض)
      if (!facesPerBoard[size]) {
        facesPerBoard[size] = faceCount;
      }
    }
    
    setSizeCounts(counts);
    setSizeFaces(facesPerBoard);
    
    console.log('✅ حساب الأوجه الجديد:', {
      counts,
      totalFacesPerSize,
      facesPerBoard
    });
  }, [selectedContractsForInv, allBillboards, customerName]);

  // Load size information and print prices
  useEffect(() => {
    const sizes = Object.keys(sizeCounts);
    if (sizes.length === 0) { 
      setPrintPrices({});
      setSizeAreas({});
      return; 
    }

    (async () => {
      try {
        let sizeData: any[] = [];
        
        const sizeRes1 = await supabase
          .from('Size')
          .select('name, width, height')
          .in('name', sizes);
        
        if (!sizeRes1.error && sizeRes1.data) {
          sizeData = sizeRes1.data;
        } else {
          const sizeRes2 = await supabase
            .from('sizes')
            .select('name, width, height')
            .in('name', sizes);
          
          if (!sizeRes2.error && sizeRes2.data) {
            sizeData = sizeRes2.data;
          }
        }

        const areas: Record<string, number> = {};
        const prices: Record<string, number> = {};
        
        sizes.forEach(size => {
          const sizeInfo = sizeData.find(s => s.name === size);
          if (sizeInfo && sizeInfo.width && sizeInfo.height) {
            const width = parseFloat(sizeInfo.width);
            const height = parseFloat(sizeInfo.height);
            areas[size] = width * height;
          } else {
            areas[size] = 1;
          }
          prices[size] = 25;
        });

        setSizeAreas(areas);
        setPrintPrices(prices);

        try {
          const { data: pricingData, error: pricingError } = await supabase
            .from('installation_print_pricing')
            .select('size, print_price')
            .in('size', sizes);
          
          if (!pricingError && Array.isArray(pricingData)) {
            const updatedPrices = { ...prices };
            pricingData.forEach((r: any) => {
              if (r.size && r.print_price) {
                updatedPrices[r.size] = Number(r.print_price) || 25;
              }
            });
            setPrintPrices(updatedPrices);
          }
        } catch (pricingErr) {
          console.log('Could not load pricing data, using defaults');
        }

      } catch (err) {
        console.error('Error loading size data:', err);
        const defaultAreas: Record<string, number> = {};
        const defaultPrices: Record<string, number> = {};
        sizes.forEach(size => {
          defaultAreas[size] = 1;
          defaultPrices[size] = 25;
        });
        setSizeAreas(defaultAreas);
        setPrintPrices(defaultPrices);
      }
    })();
  }, [sizeCounts]);

  // ✅ تحديث حساب عناصر الطباعة مع إجمالي الأوجه الصحيح
  useEffect(() => {
    if (Object.keys(sizeCounts).length > 0) {
      const sel = new Set(selectedContractsForInv);
      const boards = allBillboards.filter((b: any) => 
        sel.has(String(b.Contract_Number || '')) && 
        (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
      );

      const items: PrintItem[] = Object.entries(sizeCounts).map(([size, quantity]) => {
        const area = sizeAreas[size] || 1;
        const facesPerBoard = sizeFaces[size] || 1;
        const pricePerMeter = printPrices[size] || 25;
        
        // ✅ حساب إجمالي الأوجه من جميع اللوحات بهذا المقاس
        const boardsOfThisSize = boards.filter(b => String(b.Size || b.size || '—') === size);
        const totalFaces = boardsOfThisSize.reduce((sum, board) => {
          return sum + Number(board.Faces || board.faces || board.Number_of_Faces || board.Faces_Count || board.faces_count || 1);
        }, 0);
        
        const totalArea = area * totalFaces; // المساحة × إجمالي الأوجه
        const totalPrice = totalArea * pricePerMeter;

        console.log(`✅ ${size}: ${quantity} لوحة، ${facesPerBoard} وجه/لوحة، إجمالي الأوجه: ${totalFaces}`);

        return {
          size,
          quantity,
          faces: facesPerBoard, // عدد الأوجه لكل لوحة
          totalFaces, // إجمالي الأوجه
          area,
          pricePerMeter,
          totalArea,
          totalPrice
        };
      });
      setPrintItems(items);
    } else {
      setPrintItems([]);
    }
  }, [sizeCounts, sizeAreas, printPrices, sizeFaces, selectedContractsForInv, allBillboards, customerName]);

  // ✅ FIXED: Calculate financial totals with proper contract-payment relationship
  const totalRent = useMemo(() => contracts.reduce((s, c) => s + (Number((c as any)['Total']) || 0), 0), [contracts]);
  
  // ✅ تفصيل أنواع المعاملات
  const generalDebits = useMemo(() => 
    payments.filter(p => p.entry_type === 'general_debit')
  , [payments]);
  
  const generalCredits = useMemo(() => 
    payments.filter(p => p.entry_type === 'general_credit')
  , [payments]);
  
  // ✅ FIXED: تضمين فواتير الطباعة والواردات العامة في الحسابات المدينة
  const totalDebits = useMemo(() => {
    let totalDebit = totalRent;

    // إضافة الديون من الدفعات مع استثناء ما هو مرتبط بفواتير المبيعات/الطباعة (يتم احتسابها أدناه)
    payments.forEach(p => {
      const amount = Number(p.amount) || 0;
      const isInvoiceOrDebt = p.entry_type === 'invoice' || (p.entry_type === 'debt' && amount > 0) || p.entry_type === 'general_debit';
      const isLinkedToSalesOrPrint = (p as any)?.sales_invoice_id || (p as any)?.printed_invoice_id;
      if (isInvoiceOrDebt && !isLinkedToSalesOrPrint) {
        totalDebit += amount;
      }
    });

    // ✅ إضافة فواتير الطباعة (جميع الفواتير)
    printedInvoices.forEach(invoice => {
      const totalAmount = Number((invoice as any).total_amount ?? (invoice as any).print_cost) || 0;
      totalDebit += totalAmount;
    });

    // ✅ إضافة فواتير المبيعات (جميع الفواتير)
    salesInvoices.forEach(invoice => {
      const totalAmount = Number(invoice.total_amount) || 0;
      totalDebit += totalAmount;
    });

    return totalDebit;
  }, [payments, totalRent, printedInvoices, salesInvoices]);
  
  const totalCredits = useMemo(() => {
    return payments.reduce((s, p) => {
      const amount = Number(p.amount) || 0;
      // ✅ احتساب جميع أنواع الدفعات: receipt, account_payment, payment, general_credit
      if (p.entry_type === 'receipt' || 
          p.entry_type === 'account_payment' || 
          p.entry_type === 'payment' ||
          p.entry_type === 'general_credit') {
        return s + amount;
      }
      return s;
    }, 0);
  }, [payments]);
  
  // إجمالي الخصومات (مب��لغ ثابتة فقط)
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  
  // ✅ حساب إجمالي المشتريات من الزبون (فواتير المشتريات - فقط غير المدفوعة)
  const totalPurchases = useMemo(() => {
    return purchaseInvoices.reduce((sum, invoice) => {
      const totalAmount = Number(invoice.total_amount) || 0;
      const usedAmount = Number((invoice as any).used_as_payment) || 0;
      // فقط المبلغ المتبقي (غير المستخدم كدفعة)
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0);
  }, [purchaseInvoices]);
  
  // ✅ حساب إجمالي المبيعات للزبون (فواتير المبيعات)
  const totalSales = useMemo(() => {
    return salesInvoices.reduce((sum, invoice) => {
      return sum + (Number(invoice.total_amount) || 0);
    }, 0);
  }, [salesInvoices]);
  
  // ✅ حساب إجمالي فواتير الطباعة
  const totalPrintedInvoices = useMemo(() => {
    return printedInvoices.reduce((sum, invoice) => {
      return sum + (Number(invoice.total_amount) || 0);
    }, 0);
  }, [printedInvoices]);
  
  // ✅ حساب موحد للمتبقي من إجمالي الديون
  const balance = useMemo(() => {
    return calculateTotalRemainingDebt(
      contracts,
      payments,
      salesInvoices,
      printedInvoices,
      purchaseInvoices,
      totalDiscounts
    );
  }, [contracts, payments, salesInvoices, printedInvoices, purchaseInvoices, totalDiscounts]);

  // ✅ إصلاح حساب رصيد الحساب العام - جميع الدفعات غير المرتبطة بعقود
  const accountPayments = useMemo(() => 
    payments
      .filter(p => 
        p.entry_type === 'account_payment' || 
        ((p.entry_type === 'receipt' || p.entry_type === 'payment') && !p.contract_number)
      )
      .reduce((s, p) => s + (Number(p.amount) || 0), 0), 
    [payments]
  );

  // ✅ FIXED: Calculate payments per contract using proper type conversion
  const getContractPayments = (contractNumber: number | string): number => {
    const contractNumStr = String(contractNumber);
    return payments
      .filter(p => {
        const paymentContractNum = String(p.contract_number || '');
        const isMatch = paymentContractNum === contractNumStr;
        // ✅ احتساب جميع أنواع الدفعات: receipt, account_payment, payment
        const isValidType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
        return isMatch && isValidType;
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // ✅ NEW: Calculate remaining balance for each contract
  const getContractRemaining = (contract: ContractRow): number => {
    const contractTotal = Number((contract as any)['Total']) || 0;
    const contractPaid = getContractPayments(contract.Contract_Number);
    return contractTotal - contractPaid;
  };

  // Event handlers
  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setEditReceiptAmount(String(payment.amount || ''));
    setEditReceiptMethod(payment.method || '');
    setEditReceiptReference(payment.reference || '');
    setEditReceiptNotes(payment.notes || '');
    setEditReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  // ✅ NEW: Open receipt print dialog
  const openReceiptPrint = (payment: PaymentRow) => {
    setSelectedPaymentForReceipt(payment);
    setReceiptPrintOpen(true);
  };

  // ✅ NEW: Open account statement dialog
  const openAccountStatement = () => {
    setAccountStatementOpen(true);
  };

  // ✅ NEW: Handle bulk payment
  const handleBulkPayment = (selectedContracts: number[]) => {
    setSelectedContractsForBulkPayment(selectedContracts);
    setBulkPaymentOpen(true);
  };

  // ✅ NEW: Save bulk payment
  const saveBulkPayment = async (paymentData: {
    amount: number;
    method: string;
    reference: string;
    notes: string;
    date: string;
    contracts: number[];
  }) => {
    try {
      // توزيع المبلغ على العقود بناءً على المتبقي لكل عقد
      const contractsData = paymentData.contracts.map(contractNum => {
        const contract = contracts.find(c => Number(c.Contract_Number) === contractNum);
        if (!contract) return null;
        
        const contractTotal = Number((contract as any)['Total']) || 0;
        const contractPaid = getContractPayments(contractNum);
        const contractRemaining = Math.max(0, contractTotal - contractPaid);
        
        return {
          contractNumber: contractNum,
          remaining: contractRemaining
        };
      }).filter(Boolean);

      const totalRemaining = contractsData.reduce((sum, c: any) => sum + c.remaining, 0);
      
      // إنشاء دفعة لكل عقد بنسبة من المبلغ الكلي
      for (const contractData of contractsData as any[]) {
        if (contractData.remaining <= 0) continue;
        
        const paymentForContract = totalRemaining > 0 
          ? (contractData.remaining / totalRemaining) * paymentData.amount 
          : 0;
        
        if (paymentForContract <= 0) continue;

        const { error } = await supabase.from('customer_payments').insert({
          customer_id: customerId,
          customer_name: customerName,
          contract_number: contractData.contractNumber,
          amount: paymentForContract,
          method: paymentData.method,
          reference: paymentData.reference,
          notes: `${paymentData.notes || ''} (دفع جماعي)`,
          paid_at: paymentData.date,
          entry_type: 'receipt'
        });

        if (error) throw error;
      }

      toast.success(`تم حفظ الدفعة الج��اعية بنجاح لـ ${paymentData.contracts.length} عقد`);
      await loadData();
    } catch (error) {
      console.error('Bulk payment error:', error);
      toast.error('فشل حفظ الدفعة الجماعية');
      throw error;
    }
  };

  // Handle adding payment to specific contract
  const handleAddPayment = (contractNumber: number) => {
    setSelectedContractForPayment(contractNumber);
    setPaymentAmount('');
    setPaymentMethod('نقدي');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setAddPaymentToContractOpen(true);
  };

  // Save payment for specific contract
  const savePaymentForContract = async () => {
    if (!selectedContractForPayment) return;
    
    try {
      const amount = Number(paymentAmount);
      if (!amount || amount <= 0) {
        toast.error('الرجاء إدخال مبلغ صحيح');
        return;
      }

      const { error } = await supabase.from('customer_payments').insert({
        customer_id: customerId,
        customer_name: customerName,
        contract_number: selectedContractForPayment,
        amount: amount,
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
        paid_at: paymentDate,
        entry_type: 'receipt'
      });

      if (error) {
        console.error('Error adding payment:', error);
        toast.error('فشل في إضافة الدفعة');
        return;
      }

      toast.success('تم إضافة الدفعة بنجاح');
      setAddPaymentToContractOpen(false);
      await loadData();
    } catch (error) {
      console.error('Payment save error:', error);
      toast.error('خطأ في حفظ الدفعة');
    }
  };

  // ✅ NEW: Save distributed payment
  const saveDistributedPayment = async (
    distributions: { contractNumber: number; amount: number }[],
    paymentData: { method: string; reference: string; notes: string; date: string; distributedPaymentId: string }
  ) => {
    try {
      // ✅ إنشاء دفعات منفصلة لكل عقد مع معرف مشترك
      const payments = distributions.map((dist) => ({
        customer_id: customerId,
        customer_name: customerName,
        contract_number: dist.contractNumber,
        amount: dist.amount,
        method: paymentData.method,
        reference: paymentData.reference || null,
        notes: `${paymentData.notes ? paymentData.notes + ' - ' : ''}دفعة موزعة على ${distributions.length} عقود`,
        paid_at: paymentData.date,
        entry_type: 'receipt',
        distributed_payment_id: paymentData.distributedPaymentId, // ✅ المعرف المشترك
      }));

      const { error } = await supabase.from('customer_payments').insert(payments);

      if (error) {
        console.error('Error saving distributed payment:', error);
        throw error;
      }

      await loadData();
    } catch (error) {
      console.error('Distributed payment error:', error);
      throw error;
    }
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    try {
      const { error } = await supabase.from('customer_payments').update({
        amount: Number(editReceiptAmount) || 0,
        method: editReceiptMethod || null,
        reference: editReceiptReference || null,
        notes: editReceiptNotes || null,
        paid_at: editReceiptDate ? new Date(editReceiptDate).toISOString() : null,
      }).eq('id', editingReceipt.id).select();
      
      if (error) { 
        console.error('Update error:', error);
        toast.error('فشل في تحديث الإيصال: ' + error.message); 
        return; 
      }
      
      toast.success('تم تحديث الإيصال');
      setEditReceiptOpen(false); 
      setEditingReceipt(null);
      await loadData();
    } catch (e) {
      console.error(e); 
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!window.confirm('تأكيد حذف الإيصال؟')) return;
    try {
      const { error } = await supabase.from('customer_payments').delete().eq('id', id);
      if (error) { 
        toast.error('فشل الحذف'); 
        return; 
      }
      toast.success('تم الحذف');
      await loadData();
    } catch (e) { 
      console.error(e); 
      toast.error('خطأ في الحذف'); 
    }
  };

  const deleteDistributedPayment = async (distributedPaymentId: string) => {
    try {
      // جلب دفعات المقايضة قبل الحذف
      const { data: paymentsToDelete } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('distributed_payment_id', distributedPaymentId);

      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) {
        toast.error('فشل حذف الدفعة الموزعة');
        return;
      }

      // تحديث فواتير المشتريات المرتبطة
      if (paymentsToDelete && paymentsToDelete.length > 0) {
        const purchaseInvoiceIds = new Set<string>();
        let totalToReturn = 0;

        paymentsToDelete.forEach(p => {
          if (p.purchase_invoice_id) {
            purchaseInvoiceIds.add(p.purchase_invoice_id);
            totalToReturn += Number(p.amount) || 0;
          }
        });

        for (const invoiceId of purchaseInvoiceIds) {
          const { data: invoice } = await supabase
            .from('purchase_invoices')
            .select('used_as_payment')
            .eq('id', invoiceId)
            .single();

          if (invoice) {
            await supabase
              .from('purchase_invoices')
              .update({
                used_as_payment: Math.max(0, (invoice.used_as_payment || 0) - totalToReturn)
              })
              .eq('id', invoiceId);
          }
        }
      }

      toast.success('تم حذف الدفعة الموزعة بنجاح');
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error('خطأ في حذف الدفعة الموزعة');
    }
  };

  const openEditDistributedPayment = (distributedPaymentId: string, distributedPayments: PaymentRow[]) => {
    setEditingDistributedPaymentId(distributedPaymentId);
    setEditingDistributedPayments(distributedPayments);
    setEnhancedDistributePaymentOpen(true);
  };

  const saveEditDistributedPayment = async (distributions: { contractNumber: number; amount: number }[]) => {
    if (!editingDistributedPaymentId) return;

    try {
      const oldDistribution = editingDistributedPayments;

      const updatePayments = distributions.map((dist) => ({
        contract_number: dist.contractNumber,
        amount: dist.amount,
      }));

      for (const update of updatePayments) {
        const existingPayment = oldDistribution.find(p => Number(p.contract_number) === update.contract_number);

        if (existingPayment) {
          const { error } = await supabase
            .from('customer_payments')
            .update({ amount: update.amount })
            .eq('id', existingPayment.id);

          if (error) throw error;
        }
      }

      const deletedContractNumbers = oldDistribution
        .filter(p => !distributions.find(d => d.contractNumber === Number(p.contract_number)))
        .map(p => p.id);

      for (const paymentId of deletedContractNumbers) {
        const { error } = await supabase
          .from('customer_payments')
          .delete()
          .eq('id', paymentId);

        if (error) throw error;
      }

      const newContractNumbers = distributions
        .filter(d => !oldDistribution.find(p => Number(p.contract_number) === d.contractNumber))
        .map(d => d.contractNumber);

      if (newContractNumbers.length > 0) {
        const firstPayment = oldDistribution[0];
        const newPayments = newContractNumbers.map(contractNumber => ({
          customer_id: customerId,
          customer_name: customerName,
          contract_number: contractNumber,
          amount: distributions.find(d => d.contractNumber === contractNumber)?.amount || 0,
          method: firstPayment.method,
          reference: firstPayment.reference || null,
          notes: firstPayment.notes || null,
          paid_at: firstPayment.paid_at,
          entry_type: 'receipt' as const,
          distributed_payment_id: editingDistributedPaymentId,
        }));

        const { error } = await supabase.from('customer_payments').insert(newPayments);
        if (error) throw error;
      }

      setEditDistributedPaymentOpen(false);
      setEditingDistributedPaymentId(null);
      setEditingDistributedPayments([]);
      toast.success('تم تحديث الدفعة الموزعة بنجاح');
      await loadData();
    } catch (error) {
      console.error('Error updating distributed payment:', error);
      toast.error('فشل تحديث الدفعة الموزعة');
    }
  };

  const updatePrintItem = (index: number, field: keyof PrintItem, value: number) => {
    const newItems = [...printItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'pricePerMeter' || field === 'totalFaces') {
      newItems[index].totalArea = newItems[index].area * newItems[index].totalFaces;
      newItems[index].totalPrice = newItems[index].totalArea * newItems[index].pricePerMeter;
    }
    
    setPrintItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = printItems.filter((_, i) => i !== index);
    setPrintItems(newItems);
  };

  // ...existing code... (printing is now handled inside ModernPrintInvoiceDialog)

  // Print a saved invoice object (same style as modern print)
  const printSavedInvoice = (invoice: PrintedInvoiceRow) => {
    // Open the ModernPrintInvoiceDialog prefilled in preview mode and auto-print (normal)
    openEditPrintedInvoice(invoice, true, true, false);
  };

  // Print a saved invoice with printer-friendly layout (for internal print shop)
  const printSavedInvoiceForPrinter = (invoice: PrintedInvoiceRow) => {
    // Open the ModernPrintInvoiceDialog prefilled in preview mode and auto-print for printer
    openEditPrintedInvoice(invoice, true, true, true);
  };

  // Edit a saved printed invoice
  const openEditPrintedInvoice = (invoice: PrintedInvoiceRow, preview: boolean = false, auto: boolean = false, forPrinter: boolean = false) => {
    // Ensure print_items is parsed (it might be stored as a JSON string)
    let editable = invoice as any;
    try {
      const raw = (invoice as any).print_items ?? (invoice as any).print_items_json ?? null;
      if (raw && typeof raw === 'string') {
        try { editable = { ...editable, print_items: JSON.parse(raw) }; } catch (e) { /* ignore parse error */ }
      } else if (raw && Array.isArray(raw)) {
        editable = { ...editable, print_items: raw };
      }
    } catch (e) {
      // ignore
    }
    setEditingInvoice(editable as any);
    // Open the same modern print dialog for editing
  setSelectedContractsForInv(Array.isArray(invoice.contract_numbers) ? invoice.contract_numbers.map(String) : (invoice.contract_numbers ? String(invoice.contract_numbers).split(',').map(s=>s.trim()) : (invoice.contract_number ? [String(invoice.contract_number)] : [])));
    setPrintOpenToPreview(preview);
    setPrintAuto(auto);
    setPrintForPrinter(forPrinter);
    setPrintContractInvoiceOpen(true);
  };

  const deletePrintedInvoice = async (invoice: PrintedInvoiceRow) => {
    if (!invoice || !invoice.id) return;
    if (!window.confirm('تأكيد حذف الفاتورة؟')) return;
    try {
      const { error } = await (supabase as any).from('printed_invoices').delete().eq('id', invoice.id);
      if (error) { console.error('delete error', error); toast.error('فشل حذف الفاتورة'); return; }
      toast.success('تم حذف الفاتورة');
      await loadData();
    } catch (e) {
      console.error('Failed to delete printed invoice', e);
      toast.error('فشل حذف الفاتورة');
    }
  };

  const saveContractInvoiceToAccount = async () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد ع��ى الأقل لحفظ الفاتورة');
      return;
    }

    try {
      const printTotal = printItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      if (printTotal <= 0) {
        toast.error('لا يمكن حفظ فاتورة بقيمة صفر أو أقل');
        return;
      }

      // Generate a unique invoice number
      const invoice_number = `PRINT-${new Date().getTime()}`;

      // Prepare notes from print items
      const notes = printItems.map(item => 
        `${item.size}: ${item.quantity} لوحة, ${item.totalFaces} وجه, ${item.totalArea.toFixed(2)}م²`
      ).join('; ');

      // The user schema indicates contract_number is not nullable.
      // We will use the first selected contract number. If multiple are selected, we can consider how to handle it.
      // For now, we'll enforce selecting only one contract to save, or just use the first.
      // Let's use the first one for now.
      const contract_number = Number(selectedContractsForInv[0]);
      if (isNaN(contract_number)) {
        toast.error('رقم العقد المختار غير صالح.');
        return;
      }

      // The actual insert is handled by ModernPrintInvoiceDialog (it inserts with the selected invoice_type).
      // Here we just refresh the data and close the dialog (this function is passed as onSaveInvoice).
      toast.success('تم حفظ فاتورة الطباعة بنجاح. جارٍ تحديث السجل...');
      setPrintContractInvoiceOpen(false);
      // Clear state after saving
      setSelectedContractsForInv([]);
      setSizeCounts({});
      setPrintItems([]);
      await loadData();
    } catch (e) { 
      console.error('Invoice save error:', e); 
      toast.error(`خطأ غير متوقع: ${(e as Error).message}`); 
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background">
      {/* Modern Header with Glassmorphism */}
      <Card className="sticky top-0 z-40 rounded-none border-x-0 border-t-0 backdrop-blur-xl bg-card/80 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl border border-primary/20">
                  <Receipt className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-l from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                  فواتير وإيصالات العميل
                </CardTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-sm text-muted-foreground font-medium">{customerName || '—'}</p>
                  {customerType.isCustomer && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs px-2">
                      زبون
                    </Badge>
                  )}
                  {customerType.isSupplier && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs px-2">
                      مورد
                      {customerType.supplierType === 'billboard_rental' && ' (إيجار لوحات)'}
                      {customerType.supplierType === 'general_purchases' && ' (مشتريات عامة)'}
                      {customerType.supplierType === 'printer' && ' (مطبعة)'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/customers')} 
                className="gap-2 hover:bg-accent transition-all duration-200"
                size="sm"
              >
                رجوع للزبائن
              </Button>
              <Button 
                onClick={openAccountStatement}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <Printer className="h-4 w-4" />
                طباعة كشف حساب
              </Button>
              <Button 
                onClick={() => setSendAccountStatementOpen(true)}
                className="gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <FileText className="h-4 w-4" />
                إرسال كشف حساب
              </Button>
              <Button 
                onClick={() => setUnpaidContractsDialogOpen(true)}
                className="gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <AlertCircle className="h-4 w-4" />
                العقود غير المسددة
              </Button>
              <Button 
                onClick={() => setEnhancedDistributePaymentOpen(true)}
                className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <Calculator className="h-4 w-4" />
                توزيع دفعة
              </Button>
              <Button 
                onClick={() => setPurchaseInvoiceDialogOpen(true)}
                className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <Calculator className="h-4 w-4" />
                فاتورة مشتريات
              </Button>
              <Button
                onClick={() => setSalesInvoiceDialogOpen(true)}
                className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                size="sm"
              >
                <Receipt className="h-4 w-4" />
                فاتورة مبيعات
              </Button>
              <Button 
                onClick={() => {
                  setEditingInvoice(null);
                  setSelectedContractsForInv(contracts[0]?.Contract_Number ? [String(contracts[0]?.Contract_Number)] : []);
                  setPrintContractInvoiceOpen(true);
                }} 
                className="gap-2 bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                size="sm"
              >
                <Calculator className="h-4 w-4" />
                فاتورة طباعة
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <SummaryCards 
        totalRent={totalRent}
        totalCredits={totalCredits}
        balance={balance}
        totalDiscounts={totalDiscounts}
        totalGeneralDebt={totalDebits}
        accountPayments={accountPayments}
        totalPurchases={totalPurchases}
        totalSales={totalSales}
        totalPrintedInvoices={totalPrintedInvoices}
        lastContractDate={contracts.length > 0 ? contracts[0]['Contract Date'] : undefined}
        lastPaymentDate={
          payments
            .filter(p => p.entry_type === 'receipt' || p.entry_type === 'account_payment')
            .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0]?.paid_at
        }
      />

      {/* ✅ FIXED: Use ContractSection component instead of inline table */}
      <ContractSection 
        contracts={contracts}
        payments={payments}
        onBulkPayment={handleBulkPayment}
        onAddPayment={handleAddPayment}
        selectedContracts={selectedContractsForDistribute}
        onSelectedContractsChange={setSelectedContractsForDistribute}
        onDistributePayment={() => {
          // إزالة الشرط - يمكن فتح نافذة التوزيع مباشرة
          const amt = window.prompt('أدخل قيمة الدفعة للتوزيع (د.ل)');
          const num = amt ? Number(amt) : 0;
          if (!amt || isNaN(num) || num <= 0) {
            toast.error('قيمة غير صالحة');
            return;
          }
          setDistributeTotalAmount(String(num));
          setEnhancedDistributePaymentOpen(true);
        }}
      />

      {/* خيار إظهار بيانات التحصيل */}
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            id="showCollectionDetails"
            checked={showCollectionDetails}
            onCheckedChange={(checked) => setShowCollectionDetails(checked === true)}
          />
          <Label htmlFor="showCollectionDetails" className="cursor-pointer">
            إظهار أعمدة التحصيل عبر الوسيط (عمولة وسيط، عمولة تحويل، الصافي)
          </Label>
        </div>
      </div>

      {/* Payments Section */}
      <PaymentSection
        payments={payments}
        onEditReceipt={openEditReceipt}
        onDeleteReceipt={deleteReceipt}
        onPrintReceipt={openReceiptPrint}
        onAddDebt={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}
        onAddAccountPayment={() => { setAccountPaymentOpen(true); setAccountPaymentAmount(''); setAccountPaymentMethod(''); setAccountPaymentReference(''); setAccountPaymentNotes(''); setAccountPaymentDate(new Date().toISOString().slice(0,10)); setAccountPaymentContract(''); setAccountPaymentToGeneral(true); }}
        onAddPurchaseFromCustomer={() => { setPurchaseFromCustomerOpen(true); setPurchaseAmount(''); setPurchaseNotes(''); setPurchaseDate(new Date().toISOString().slice(0,10)); }}
        onDeleteDistributedPayment={deleteDistributedPayment}
        onEditDistributedPayment={openEditDistributedPayment}
        showCollectionDetails={showCollectionDetails}
        totalRemainingDebt={balance}
      />

      {/* General Discounts Section */}
      <GeneralDiscountsSection 
        customerId={customerId}
        customerName={customerName}
        onDiscountChange={loadData}
      />

      {/* ✅ قسم فواتير المبيعات */}
      <SalesSection
        customerId={customerId}
        invoices={salesInvoices}
        onRefresh={loadData}
      />
      
      {/* قسم المعاملات العامة (الواردات/الصادرات) تم إخفاؤه حسب طلب العميل */}

      {/* Printed Invoices Section */}
      <Card className="expenses-preview-card mt-6">
        <CardHeader>
          <CardTitle className="expenses-preview-title">
            {customerType.supplierType === 'printer' 
              ? 'فواتير الطباعة للمطبعة' 
              : 'فواتير الطباعة والتركيب المحفوظة'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <table className="w-full">
              <thead>
                <tr className="expenses-table-header">
                  <th>رقم الفاتورة</th>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>{customerType.supplierType === 'printer' ? 'اسم الزبون' : 'أرقام العقود'}</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {printedInvoices.length > 0 ? (
                  printedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="expenses-table-row">
                      <td className="num">{invoice.invoice_number}</td>
                      <td>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('ar-LY') : ''}</td>
                      <td><Badge variant="outline">{invoice.invoice_type}</Badge></td>
                      <td className="num">
                        {customerType.supplierType === 'printer' 
                          ? (invoice.customer_name || '—')
                          : (Array.isArray(invoice.contract_numbers) ? invoice.contract_numbers.join(', ') : (invoice.contract_numbers ?? invoice.contract_number ?? ''))}
                      </td>
                      <td className="expenses-amount-calculated num">
                        {((invoice.total_amount ?? 0) as number).toLocaleString('ar-LY')} د.ل
                      </td>
                      <td>
                        <div className="space-y-1">
                          {invoice.paid ? (
                            <Badge variant="default" className="bg-green-600">مسددة</Badge>
                          ) : (
                            <>
                              <Badge variant="destructive">غير مسددة</Badge>
                              <div className="text-xs text-muted-foreground">
                                المدفوع: {Number(invoice.paid_amount || 0).toLocaleString('ar-LY')} د.ل
                                <br />
                                المتبقي: {(Number(invoice.total_amount) - Number(invoice.paid_amount || 0)).toLocaleString('ar-LY')} د.ل
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="flex items-center justify-center gap-2 py-2">
                        {customerType.supplierType === 'printer' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedInvoiceDetails(invoice);
                              setPrintInvoiceDetailsOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 ml-1" />
                            تفاصيل
                          </Button>
                        )}
                        {!invoice.paid && customerType.supplierType !== 'printer' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setSelectedPrintInvoice(invoice);
                              setPrintInvoicePaymentOpen(true);
                            }}
                          >
                            إضافة دفعة
                          </Button>
                        )}
                        {customerType.supplierType !== 'printer' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => printSavedInvoice(invoice)}>
                              <Printer className="h-4 w-4 ml-1" />
                              طباعة
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => printSavedInvoiceForPrinter(invoice)}>
                              <FileText className="h-4 w-4 ml-1" />
                              للمطبعة
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditPrintedInvoice(invoice)}>
                              تعديل
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deletePrintedInvoice(invoice)}>
                              حذف
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="expenses-table-row">
                    <td colSpan={7} className="text-center text-muted-foreground py-6">
                      {customerType.supplierType === 'printer' 
                        ? 'لا توجد فواتير طباعة لهذه المطبعة.' 
                        : 'لا توجد فواتير طباعة محفوظة لهذا العميل.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modern Print Invoice Dialog */}
      <ModernPrintInvoiceDialog
        open={printContractInvoiceOpen}
        onClose={() => { setPrintContractInvoiceOpen(false); setPrintOpenToPreview(false); setEditingInvoice(null); setPrintAuto(false); setPrintForPrinter(false); }}
        customerId={customerId}
        customerName={customerName}
        customerPhone={customerPhone}
        contracts={contracts as any}
        selectedContracts={selectedContractsForInv}
        onSelectContracts={setSelectedContractsForInv}
        printItems={printItems}
        onUpdatePrintItem={updatePrintItem}
        onRemoveItem={removeItem}
        includeAccountBalance={includeAccountBalance}
        onIncludeAccountBalance={setIncludeAccountBalance}
        accountPayments={accountPayments}
        onSaveInvoice={async () => { setEditingInvoice(null); setPrintOpenToPreview(false); setPrintAuto(false); setPrintForPrinter(false); await saveContractInvoiceToAccount(); }}
        initialInvoice={editingInvoice}
        openToPreview={printOpenToPreview}
        autoPrint={printAuto}
        autoPrintForPrinter={printForPrinter}
        paymentMethod={paymentMethod}
        onPrintInvoice={() => {}}
      />

      {/* ✅ NEW: Receipt Print Dialog */}
      <ReceiptPrintDialog
        open={receiptPrintOpen}
        onOpenChange={setReceiptPrintOpen}
        payment={selectedPaymentForReceipt}
        customerName={customerName}
      />

      {/* ✅ NEW: Account Statement Dialog */}
      <AccountStatementDialog
        open={accountStatementOpen}
        onOpenChange={setAccountStatementOpen}
        customerId={customerId}
        customerName={customerName}
      />

      {/* ✅ NEW: Send Account Statement Dialog */}
      <SendAccountStatementDialog
        open={sendAccountStatementOpen}
        onOpenChange={setSendAccountStatementOpen}
        customer={{
          id: customerId,
          name: customerName,
          phone: customerPhone,
          company: customerData?.company || null,
          contractsCount: contracts.length,
          totalRent: totalRent,
          totalPaid: totalCredits,
          accountBalance: balance,
          remaining: totalRent - totalCredits,
        }}
      />

      {/* ✅ NEW: Enhanced Distribute Payment Dialog */}
      <EnhancedDistributePaymentDialog
        open={enhancedDistributePaymentOpen}
        onOpenChange={setEnhancedDistributePaymentOpen}
        customerName={customerName}
        customerId={customerId}
        onSuccess={loadData}
      />

      {/* ✅ NEW: Print Invoice Payment Dialog */}
      <PrintInvoicePaymentDialog
        open={printInvoicePaymentOpen}
        onOpenChange={setPrintInvoicePaymentOpen}
        invoice={selectedPrintInvoice}
        customerId={customerId}
        onPaymentAdded={loadData}
      />

      {/* Contract PDF Dialog */}
      <ContractPDFDialog
        open={contractPDFOpen}
        onOpenChange={setContractPDFOpen}
        contract={selectedContractForPDF}
      />

      {/* Account Payment Dialog */}
      <Dialog open={accountPaymentOpen} onOpenChange={setAccountPaymentOpen}>
        <DialogContent className="max-w-md bg-card border-border" dir="rtl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-lg font-bold text-primary text-right">دفعة على الحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
              <div className="text-sm text-slate-300 mb-1 font-medium">العميل:</div>
              <div className="font-semibold text-yellow-400">{customerName}</div>
            </div>
            
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-3">
              <div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                اختر وجهة الدفعة:
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  accountPaymentToGeneral 
                    ? 'border-primary bg-accent/20 text-primary' 
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(true)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm font-medium">إضافة إلى الحساب العام</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  !accountPaymentToGeneral 
                    ? 'border-primary bg-accent/20 text-primary' 
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={!accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(false)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm font-medium">إضافة إلى عقد محدد</span>
                </label>
              </div>
            </div>

            {!accountPaymentToGeneral && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">العقد</label>
                <Select value={accountPaymentContract} onValueChange={setAccountPaymentContract}>
                  <SelectTrigger className="text-right bg-input border-border text-foreground">
                    <SelectValue placeholder="اختر عقدًا" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-popover border-border z-50">
                    {contracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)} className="text-popover-foreground">
                        عقد رقم {String(ct.Contract_Number)} - {ct['Ad Type']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!accountPaymentToGeneral && accountPaymentContract && (
              <div className="bg-accent/10 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-primary">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contract = contracts.find(c => String(c.Contract_Number) === accountPaymentContract);
                  if (!contract) return null;
                  const contractTotal = Number((contract as any)['Total']) || 0;
                  const contractPaid = getContractPayments(contract.Contract_Number);
                  const contractRemaining = contractTotal - contractPaid;
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي العقد:</span>
                        <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المدفوع:</span>
                        <span className="font-semibold text-green-400">{contractPaid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-1">
                        <span className="text-slate-400">المتبقي:</span>
                        <span className={`font-bold ${contractRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {contractRemaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">المبلغ</label>
              <Input 
                type="number" 
                value={accountPaymentAmount} 
                onChange={(e)=> setAccountPaymentAmount(e.target.value)}
                className="text-right bg-input border-border text-foreground"
                placeholder="أدخل المبلغ"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">طريقة الدفع</label>
              <Select value={accountPaymentMethod} onValueChange={setAccountPaymentMethod}>
                <SelectTrigger className="text-right bg-input border-border text-foreground">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="نقدي" className="text-popover-foreground">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-popover-foreground">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-popover-foreground">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتم��ن" className="text-popover-foreground">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">المرجع</label>
              <Input 
                value={accountPaymentReference} 
                onChange={(e)=> setAccountPaymentReference(e.target.value)}
                className="text-right bg-input border-border text-foreground"
                placeholder="رقم المرجع (اختياري)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">التاريخ</label>
              <Input 
                type="date" 
                value={accountPaymentDate} 
                onChange={(e)=> setAccountPaymentDate(e.target.value)}
                className="text-right bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">ملاحظات</label>
              <Input 
                value={accountPaymentNotes} 
                onChange={(e)=> setAccountPaymentNotes(e.target.value)}
                className="text-right bg-input border-border text-foreground"
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={()=> setAccountPaymentOpen(false)}
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!accountPaymentAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(accountPaymentAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  if (!accountPaymentToGeneral && !accountPaymentContract) {
                    toast.error('يرجى اختيار عقد');
                    return;
                  }
                  
                  const contractNumber = accountPaymentToGeneral ? null : 
                    (accountPaymentContract ? (isNaN(Number(accountPaymentContract)) ? null : Number(accountPaymentContract)) : null);
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: contractNumber,
                    amount: amt,
                    method: accountPaymentMethod || null,
                    reference: accountPaymentReference || null,
                    notes: accountPaymentNotes || null,
                    paid_at: accountPaymentDate ? new Date(accountPaymentDate).toISOString() : new Date().toISOString(),
                    entry_type: accountPaymentToGeneral ? 'account_payment' : 'receipt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Insert error:', error);
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  
                  toast.success('تم الحفظ بنجاح');
                  setAccountPaymentOpen(false);
                  
                  setAccountPaymentAmount('');
                  setAccountPaymentMethod('');
                  setAccountPaymentReference('');
                  setAccountPaymentNotes('');
                  setAccountPaymentContract('');
                  setAccountPaymentToGeneral(true);
                  
                  await loadData();
                } catch (e) { 
                  console.error('Unexpected error:', e); 
                  toast.error('خطأ غير ��توقع: ' + (e as Error).message); 
                }
              }} className="bg-primary text-primary-foreground hover:bg-primary/90">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit receipt dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-foreground">المبلغ</label>
              <Input type="number" value={editReceiptAmount} onChange={(e)=> setEditReceiptAmount(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">طريقة الدفع</label>
              <Select value={editReceiptMethod} onValueChange={setEditReceiptMethod}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="اختر ��ريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="نقدي" className="text-popover-foreground">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-popover-foreground">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-popover-foreground">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان" className="text-popover-foreground">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">المرجع</label>
              <Input value={editReceiptReference} onChange={(e)=> setEditReceiptReference(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">تاريخ الدفع</label>
              <Input type="date" value={editReceiptDate} onChange={(e)=> setEditReceiptDate(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ملاحظات</label>
              <Input value={editReceiptNotes} onChange={(e)=> setEditReceiptNotes(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={()=> setEditReceiptOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                onClick={saveReceiptEdit} 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ NEW: Bulk Payment Dialog */}
      <BulkPaymentDialog
        open={bulkPaymentOpen}
        onOpenChange={setBulkPaymentOpen}
        selectedContractNumbers={selectedContractsForBulkPayment}
        contracts={contracts}
        payments={payments}
        onSave={saveBulkPayment}
      />

      {/* ✅ Distribute payment dialog */}
      <EnhancedDistributePaymentDialog
        open={enhancedDistributePaymentOpen && editingDistributedPaymentId === null}
        onOpenChange={setEnhancedDistributePaymentOpen}
        customerId={customerId}
        customerName={customerName}
        onSuccess={loadData}
      />

      {/* ✅ Edit distributed payment dialog */}
      <EnhancedDistributePaymentDialog
        open={editingDistributedPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDistributedPaymentId(null);
            setEditingDistributedPayments([]);
          }
        }}
        customerId={customerId}
        customerName={customerName}
        onSuccess={loadData}
        editMode={true}
        editingDistributedPaymentId={editingDistributedPaymentId}
        editingPayments={editingDistributedPayments}
      />

      {/* Add payment to specific contract */}
      <Dialog open={addPaymentToContractOpen} onOpenChange={setAddPaymentToContractOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">
              إضافة دفعة للعقد #{selectedContractForPayment}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedContractForPayment && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-green-400" />
                  <span className="font-semibold text-sm text-green-300">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contract = contracts.find(c => c.Contract_Number === selectedContractForPayment);
                  if (!contract) return null;
                  const contractTotal = Number((contract as any)['Total']) || 0;
                  const contractPaid = getContractPayments(contract.Contract_Number);
                  const enteredAmount = Number(paymentAmount) || 0;
                  const contractRemaining = contractTotal - contractPaid - enteredAmount;
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي العقد:</span>
                        <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المدفوع سابقاً:</span>
                        <span className="font-semibold text-green-400">{contractPaid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      {enteredAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">المبلغ المدخل:</span>
                          <span className="font-semibold text-blue-400">{enteredAmount.toLocaleString('ar-LY')} د.ل</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-600 pt-1">
                        <span className="text-slate-400">المتبقي:</span>
                        <span className={`font-bold ${contractRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {contractRemaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-slate-300">المبلغ</label>
              <Input 
                type="number" 
                value={paymentAmount} 
                onChange={(e)=> setPaymentAmount(e.target.value)} 
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="0" 
              />
            </div>
            {selectedContractForPayment && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-green-400" />
                  <span className="font-semibold text-sm text-green-300">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contract = contracts.find(c => c.Contract_Number === selectedContractForPayment);
                  if (!contract) return null;
                  const contractTotal = Number((contract as any)['Total']) || 0;
                  const contractPaid = getContractPayments(contract.Contract_Number);
                  const enteredAmount = Number(paymentAmount) || 0;
                  const contractRemaining = contractTotal - contractPaid - enteredAmount;
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي العقد:</span>
                        <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المدفوع سابقاً:</span>
                        <span className="font-semibold text-green-400">{contractPaid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      {enteredAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">المبلغ المدخل:</span>
                          <span className="font-semibold text-blue-400">{enteredAmount.toLocaleString('ar-LY')} د.ل</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-600 pt-1">
                        <span className="text-slate-400">المتبقي:</span>
                        <span className={`font-bold ${contractRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {contractRemaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-300">طريقة الدفع</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحوي�� بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">المرجع</label>
              <Input 
                value={paymentReference} 
                onChange={(e)=> setPaymentReference(e.target.value)} 
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="رقم الشيك أو رقم التحويل" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">ملاحظات</label>
              <Input 
                value={paymentNotes} 
                onChange={(e)=> setPaymentNotes(e.target.value)} 
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="ملاحظات إضافية" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">تاريخ الدفع</label>
              <Input 
                type="date" 
                value={paymentDate} 
                onChange={(e)=> setPaymentDate(e.target.value)} 
                className="bg-slate-700 border-slate-600 text-slate-200" 
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setAddPaymentToContractOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button 
                onClick={savePaymentForContract}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                حفظ الدفعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add previous debt */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">إضافة دين سابق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-foreground">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ال��اريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} className="bg-input border-border text-foreground" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={()=> setAddDebtOpen(false)}
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: null,
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Debt insert error:', error); 
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  toast.success('تمت الإضافة');
                  setAddDebtOpen(false);
                  
                  setDebtAmount('');
                  setDebtNotes('');
                  
                  await loadData();
                } catch (e) { 
                  console.error('Debt save error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ General Debit Dialog (وارد عام) */}
      <Dialog open={generalDebitOpen} onOpenChange={setGeneralDebitOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">إضافة وارد عام</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input type="number" value={generalAmount} onChange={(e)=> setGeneralAmount(e.target.value)} placeholder="المبلغ" />
            <Input value={generalDescription} onChange={(e)=> setGeneralDescription(e.target.value)} placeholder="الوصف" />
            <Input value={generalReference} onChange={(e)=> setGeneralReference(e.target.value)} placeholder="المرجع" />
            <Input type="date" value={generalDate} onChange={(e)=> setGeneralDate(e.target.value)} />
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={()=> setGeneralDebitOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                if (!generalAmount) { toast.error('أدخل المبلغ'); return; }
                const payload = { customer_id: customerId, customer_name: customerName, amount: Number(generalAmount), notes: generalDescription, reference: generalReference, paid_at: generalDate, entry_type: 'general_debit' };
                const { error } = await supabase.from('customer_payments').insert(payload);
                if (error) { toast.error('فشل الحفظ'); return; }
                toast.success('تم الحفظ');
                setGeneralDebitOpen(false);
                setGeneralAmount(''); setGeneralDescription(''); setGeneralReference('');
                await loadData();
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ General Credit Dialog (صادر عام) */}
      <Dialog open={generalCreditOpen} onOpenChange={setGeneralCreditOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">إضافة صادر عام</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input type="number" value={generalAmount} onChange={(e)=> setGeneralAmount(e.target.value)} placeholder="المبلغ" />
            <Input value={generalDescription} onChange={(e)=> setGeneralDescription(e.target.value)} placeholder="الوصف" />
            <Input value={generalReference} onChange={(e)=> setGeneralReference(e.target.value)} placeholder="المرجع" />
            <Input type="date" value={generalDate} onChange={(e)=> setGeneralDate(e.target.value)} />
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={()=> setGeneralCreditOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                if (!generalAmount) { toast.error('أدخل المبلغ'); return; }
                const payload = { customer_id: customerId, customer_name: customerName, amount: Number(generalAmount), notes: generalDescription, reference: generalReference, paid_at: generalDate, entry_type: 'general_credit' };
                const { error } = await supabase.from('customer_payments').insert(payload);
                if (error) { toast.error('فشل الحفظ'); return; }
                toast.success('تم الحفظ');
                setGeneralCreditOpen(false);
                setGeneralAmount(''); setGeneralDescription(''); setGeneralReference('');
                await loadData();
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ Purchase Invoice Dialog */}
      <PurchaseInvoiceDialog
        open={purchaseInvoiceDialogOpen}
        onOpenChange={setPurchaseInvoiceDialogOpen}
        customerId={customerId}
        customerName={customerName}
        onSuccess={loadData}
      />

      {/* ✅ Sales Invoice Dialog */}
      <SalesInvoiceDialog
        open={salesInvoiceDialogOpen}
        onOpenChange={setSalesInvoiceDialogOpen}
        customerId={customerId}
        customerName={customerName}
        onSuccess={loadData}
      />

      {/* ✅ Purchase from customer dialog */}
      <Dialog open={purchaseFromCustomerOpen} onOpenChange={setPurchaseFromCustomerOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-primary">مشتريات من العميل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-accent/10 border border-primary/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  دين لك على العميل مقابل مشتريات/خدمات قدمتها له
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">المبلغ</label>
              <Input 
                type="number" 
                value={purchaseAmount} 
                onChange={(e)=> setPurchaseAmount(e.target.value)} 
                className="bg-input border-border text-foreground"
                placeholder="أدخل مبلغ المشتريات"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ملاحظات</label>
              <Input 
                value={purchaseNotes} 
                onChange={(e)=> setPurchaseNotes(e.target.value)} 
                className="bg-input border-border text-foreground"
                placeholder="تفاصيل المشتريات أو الخدمات"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">التاريخ</label>
              <Input 
                type="date" 
                value={purchaseDate} 
                onChange={(e)=> setPurchaseDate(e.target.value)} 
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={()=> setPurchaseFromCustomerOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    if (!purchaseAmount) { toast.error('أدخل المبلغ'); return; }
                    const amt = Number(purchaseAmount);
                    if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                    
                    const payload = {
                      customer_id: customerId || null,
                      customer_name: customerName,
                      contract_number: null,
                      amount: -amt,
                      method: null,
                      reference: null,
                      notes: purchaseNotes || 'مشتريات من العميل',
                      paid_at: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
                      entry_type: 'debt',
                    };
                    
                    const { error } = await supabase.from('customer_payments').insert(payload).select();
                    if (error) { 
                      console.error('Insert error:', error);
                      toast.error('فشل الحفظ: ' + error.message); 
                      return; 
                    }
                    
                    toast.success('تم حفظ المشتريات بنجاح');
                    setPurchaseFromCustomerOpen(false);
                    setPurchaseAmount('');
                    setPurchaseNotes('');
                    setPurchaseDate(new Date().toISOString().slice(0,10));
                    await loadData();
                  } catch (e) { 
                    console.error('Unexpected error:', e); 
                    toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ Print Invoice Details Dialog (for printers) */}
      <Dialog open={printInvoiceDetailsOpen} onOpenChange={setPrintInvoiceDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              تفاصيل فاتورة الطباعة
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoiceDetails && (
            <div className="space-y-6 mt-4">
              {/* معلومات الفاتورة */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">معلومات الفاتورة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">رقم الفاتورة:</label>
                      <p className="text-base font-semibold">{selectedInvoiceDetails.invoice_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">تاريخ الفاتورة:</label>
                      <p className="text-base">{selectedInvoiceDetails.invoice_date ? new Date(selectedInvoiceDetails.invoice_date).toLocaleDateString('ar-LY') : '—'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">اسم الزبون:</label>
                      <p className="text-base font-semibold">{selectedInvoiceDetails.customer_name || '—'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">اسم المطبعة:</label>
                      <p className="text-base">{selectedInvoiceDetails.printer_name || '—'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">نوع الفاتورة:</label>
                      <Badge variant="outline">{selectedInvoiceDetails.invoice_type || 'طباعة'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* تفاصيل البنود */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">بنود الفاتورة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-right">المقاس</th>
                          <th className="px-4 py-2 text-center">الكمية</th>
                          <th className="px-4 py-2 text-center">عدد الأوجه</th>
                          <th className="px-4 py-2 text-center">المساحة (م²)</th>
                          <th className="px-4 py-2 text-center">سعر المتر للمطبعة</th>
                          <th className="px-4 py-2 text-center">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          try {
                            const printItems = typeof selectedInvoiceDetails.print_items === 'string' 
                              ? JSON.parse(selectedInvoiceDetails.print_items) 
                              : selectedInvoiceDetails.print_items || [];
                            
                            return printItems.length > 0 ? (
                              printItems.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b hover:bg-accent/50">
                                  <td className="px-4 py-2 text-right font-medium">{item.size || '—'}</td>
                                  <td className="px-4 py-2 text-center">{item.quantity || 0}</td>
                                  <td className="px-4 py-2 text-center">{item.totalFaces || item.faces || 0}</td>
                                  <td className="px-4 py-2 text-center">{(item.totalArea || 0).toFixed(2)}</td>
                                  <td className="px-4 py-2 text-center font-semibold text-primary">
                                    {(item.pricePerMeter || 0).toLocaleString('ar-LY')} د.ل
                                  </td>
                                  <td className="px-4 py-2 text-center font-bold">
                                    {(item.totalPrice || 0).toLocaleString('ar-LY')} د.ل
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                                  لا توجد بنود للفاتورة
                                </td>
                              </tr>
                            );
                          } catch (e) {
                            console.error('Error parsing print_items:', e);
                            return (
                              <tr>
                                <td colSpan={6} className="px-4 py-4 text-center text-destructive">
                                  خطأ في تحميل البنود
                                </td>
                              </tr>
                            );
                          }
                        })()}
                      </tbody>
                      <tfoot>
                        <tr className="bg-accent/30 font-bold">
                          <td colSpan={5} className="px-4 py-3 text-right">الإجمالي الكلي:</td>
                          <td className="px-4 py-3 text-center text-lg">
                            {(selectedInvoiceDetails.total_amount || 0).toLocaleString('ar-LY')} د.ل
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* حالة السداد */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">حالة السداد</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</p>
                      <p className="text-2xl font-bold">{(selectedInvoiceDetails.total_amount || 0).toLocaleString('ar-LY')} د.ل</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">المدفوع</p>
                      <p className="text-2xl font-bold text-green-600">{(selectedInvoiceDetails.paid_amount || 0).toLocaleString('ar-LY')} د.ل</p>
                    </div>
                    <div className="text-center p-4 bg-destructive/10 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">المتبقي</p>
                      <p className="text-2xl font-bold text-destructive">
                        {((selectedInvoiceDetails.total_amount || 0) - (selectedInvoiceDetails.paid_amount || 0)).toLocaleString('ar-LY')} د.ل
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    {selectedInvoiceDetails.paid ? (
                      <Badge className="bg-green-600 text-white px-4 py-2">✓ تم التسديد بالكامل</Badge>
                    ) : (
                      <Badge variant="destructive" className="px-4 py-2">لم يتم التسديد</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ملاحظات */}
              {selectedInvoiceDetails.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">ملاحظات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedInvoiceDetails.notes}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setPrintInvoiceDetailsOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Unpaid Contracts Dialog */}
      <UnpaidContractsDialog
        open={unpaidContractsDialogOpen}
        onOpenChange={setUnpaidContractsDialogOpen}
        contracts={contracts}
        getContractPayments={getContractPayments}
        getContractRemaining={getContractRemaining}
      />
    </div>
  );
}
