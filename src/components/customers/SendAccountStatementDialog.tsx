import { useState, useEffect } from "react";
import html2pdf from 'html2pdf.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Loader2, FileText, AlertCircle, Users, Building, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CustomerData {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  contractsCount: number;
  totalRent: number;
  totalPaid: number;
  accountBalance: number;
  remaining: number;
}

interface ContractInfo {
  contractNumber: string;
  total: number;
  paid: number;
  remaining: number;
  startDate?: string;
  endDate?: string;
}

interface OverdueInfo {
  hasOverdue: boolean;
  totalOverdueAmount: number;
  oldestDaysOverdue: number;
  oldestDueDate?: string;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendAccountStatementDialogProps {
  customer: CustomerData;
  overdueInfo?: OverdueInfo;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SendAccountStatementDialog({ 
  customer, 
  overdueInfo,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: SendAccountStatementDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, sendDocument, loading: sendingTextly } = useSendTextly();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [recipientType, setRecipientType] = useState<'customer' | 'management'>('customer');
  const [phoneNumber, setPhoneNumber] = useState(customer.phone || '');
  const [includeContracts, setIncludeContracts] = useState(true);
  const [includePrintInvoices, setIncludePrintInvoices] = useState(true);
  const [includeSalesInvoices, setIncludeSalesInvoices] = useState(true);
  const [includePurchaseInvoices, setIncludePurchaseInvoices] = useState(true);
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [printInvoices, setPrintInvoices] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [sendAsPDF, setSendAsPDF] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [currency, setCurrency] = useState({ code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' });

  const loading = sendingWhatsApp || sendingTextly;

  useEffect(() => {
    if (open) {
      loadManagementPhones();
    }
  }, [open]);

  const loadManagementPhones = async () => {
    try {
      const { data, error } = await supabase
        .from('management_phones')
        .select('id, phone_number, label')
        .eq('is_active', true)
        .order('label');

      if (error) throw error;

      setManagementPhones(data || []);
    } catch (error) {
      console.error('Error loading management phones:', error);
    }
  };

  const toggleManagement = (contactId: string) => {
    const newSelected = new Set(selectedManagement);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedManagement(newSelected);
  };

  const toggleAllManagement = () => {
    if (selectedManagement.size === managementPhones.length) {
      setSelectedManagement(new Set());
    } else {
      setSelectedManagement(new Set(managementPhones.map(c => c.id)));
    }
  };

  const loadContracts = async () => {
    if (!includeContracts && !includePrintInvoices && !includeSalesInvoices && !includePurchaseInvoices) return;
    
    setLoadingContracts(true);
    try {
      const customerId = customer.id.startsWith('name:') ? null : customer.id;
      
      // تحميل العقود
      if (includeContracts) {
        let query = supabase
          .from('Contract')
          .select('Contract_Number, Total, "Contract Date", "End Date"');

        if (customerId) {
          query = query.eq('customer_id', customerId);
        } else {
          query = query.ilike('Customer Name', customer.name);
        }

        const { data: contractsData, error: contractsError } = await query;

        if (contractsError) throw contractsError;

        // جلب الدفعات لكل عقد
        const contractNumbers = contractsData?.map(c => c.Contract_Number) || [];
        
        const { data: paymentsData } = await supabase
          .from('customer_payments')
          .select('contract_number, amount')
          .in('contract_number', contractNumbers);

        // حساب المدفوع لكل عقد
        const paymentsByContract = new Map<string, number>();
        (paymentsData || []).forEach(p => {
          const key = String(p.contract_number);
          paymentsByContract.set(key, (paymentsByContract.get(key) || 0) + Number(p.amount || 0));
        });

        const contractsInfo: ContractInfo[] = (contractsData || []).map(c => {
          const total = Number(c.Total || 0);
          const paid = paymentsByContract.get(String(c.Contract_Number)) || 0;
          return {
            contractNumber: String(c.Contract_Number),
            total,
            paid,
            remaining: total - paid,
            startDate: c['Contract Date'] || undefined,
            endDate: c['End Date'] || undefined,
          };
        });

        setContracts(contractsInfo);
      }

      // تحميل فواتير الطباعة
      if (includePrintInvoices && customerId) {
        const { data, error } = await supabase
          .from('printed_invoices')
          .select('invoice_number, total_amount, created_at, invoice_type, paid, paid_amount')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPrintInvoices(data);
        }
      }

      // تحميل فواتير المبيعات
      if (includeSalesInvoices && customerId) {
        const { data, error } = await supabase
          .from('sales_invoices')
          .select('invoice_number, total_amount, invoice_date, paid, paid_amount')
          .eq('customer_id', customerId)
          .order('invoice_date', { ascending: false });

        if (!error && data) {
          setSalesInvoices(data);
        }
      }

      // تحميل فواتير المشتريات
      if (includePurchaseInvoices && customerId) {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .select('invoice_number, total_amount, invoice_date')
          .eq('customer_id', customerId)
          .order('invoice_date', { ascending: false });

        if (!error && data) {
          setPurchaseInvoices(data);
        }
      }

    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('خطأ في تحميل تفاصيل الحساب');
    } finally {
      setLoadingContracts(false);
    }
  };

  const generateMessage = (): string => {
    let message = `السلام عليكم ${customer.name}\n\n`;
    message += `📊 *كشف حساب مالي شامل*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    // معلومات الزبون
    if (customer.company) {
      message += `🏢 الشركة: ${customer.company}\n`;
    }
    message += `📱 الهاتف: ${phoneNumber || customer.phone || '—'}\n\n`;

    // حساب الديون من جميع المصادر
    const contractsRemaining = contracts.reduce((sum, c) => sum + c.remaining, 0);
    const printInvoicesRemaining = printInvoices.reduce((sum, inv) => {
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.paid_amount || 0);
      return sum + (total - paid);
    }, 0);
    const salesInvoicesRemaining = salesInvoices.reduce((sum, inv) => {
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.paid_amount || 0);
      return sum + (total - paid);
    }, 0);
    
    const totalDebt = contractsRemaining + printInvoicesRemaining + salesInvoicesRemaining;

    // الملخص المالي
    message += `💰 *الملخص المالي:*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📋 عدد العقود: ${customer.contractsCount}\n`;
    message += `💵 إجمالي العقود: ${customer.totalRent.toLocaleString('ar-LY')} د.ل\n`;
    message += `✅ إجمالي المدفوع: ${customer.totalPaid.toLocaleString('ar-LY')} د.ل\n`;
    message += `💳 رصيد الحساب: ${customer.accountBalance.toLocaleString('ar-LY')} د.ل\n\n`;
    
    // الدين الكلي مع التفاصيل
    message += `❌ *الدين الكلي: ${totalDebt.toLocaleString('ar-LY')} د.ل*\n`;
    message += `   📌 تفاصيل الديون:\n`;
    if (contractsRemaining > 0) {
      message += `   • متبقي من العقود: ${contractsRemaining.toLocaleString('ar-LY')} د.ل\n`;
    }
    if (printInvoicesRemaining > 0) {
      message += `   • متبقي من الطباعة: ${printInvoicesRemaining.toLocaleString('ar-LY')} د.ل\n`;
    }
    if (salesInvoicesRemaining > 0) {
      message += `   • متبقي من فواتير المبيعات: ${salesInvoicesRemaining.toLocaleString('ar-LY')} د.ل\n`;
    }
    message += `\n`;

    // الدفعات المتأخرة
    if (includeOverdue && overdueInfo?.hasOverdue) {
      message += `⚠️ *تنبيه: دفعات متأخرة!*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `💰 المبلغ المتأخر: ${overdueInfo.totalOverdueAmount.toLocaleString('ar-LY')} د.ل\n`;
      message += `⏰ أقدم تأخير: ${overdueInfo.oldestDaysOverdue} يوم\n`;
      if (overdueInfo.oldestDueDate) {
        message += `📅 تاريخ الاستحقاق: ${new Date(overdueInfo.oldestDueDate).toLocaleDateString('ar-LY')}\n`;
      }
      message += `\n⚠️ يرجى المبادرة بالسداد في أقرب وقت.\n\n`;
    }

    // تفاصيل العقود
    if (includeContracts && contracts.length > 0) {
      message += `📋 *تفاصيل العقود:*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      contracts.forEach((contract, idx) => {
        message += `\n${idx + 1}. عقد رقم: #${contract.contractNumber}\n`;
        message += `   💵 المبلغ الإجمالي: ${contract.total.toLocaleString('ar-LY')} د.ل\n`;
        message += `   ✅ المدفوع: ${contract.paid.toLocaleString('ar-LY')} د.ل\n`;
        message += `   ❌ المتبقي: ${contract.remaining.toLocaleString('ar-LY')} د.ل\n`;
        if (contract.startDate && contract.endDate) {
          message += `   📅 المدة: ${new Date(contract.startDate).toLocaleDateString('ar-LY')} - ${new Date(contract.endDate).toLocaleDateString('ar-LY')}\n`;
        }
      });
      message += `\n`;
    }

    // فواتير الطباعة
    if (includePrintInvoices && printInvoices.length > 0) {
      message += `🖨️ *فواتير الطباعة:*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      const totalPrint = printInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const totalPaidPrint = printInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
      message += `📊 عدد الفواتير: ${printInvoices.length}\n`;
      message += `💵 إجمالي المبلغ: ${totalPrint.toLocaleString('ar-LY')} د.ل\n`;
      message += `✅ المدفوع: ${totalPaidPrint.toLocaleString('ar-LY')} د.ل\n`;
      message += `❌ المتبقي: ${(totalPrint - totalPaidPrint).toLocaleString('ar-LY')} د.ل\n\n`;
    }

    // فواتير المبيعات
    if (includeSalesInvoices && salesInvoices.length > 0) {
      message += `🛒 *فواتير المبيعات:*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      const totalSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const totalPaidSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
      message += `📊 عدد الفواتير: ${salesInvoices.length}\n`;
      message += `💵 إجمالي المبلغ: ${totalSales.toLocaleString('ar-LY')} د.ل\n`;
      message += `✅ المدفوع: ${totalPaidSales.toLocaleString('ar-LY')} د.ل\n`;
      message += `❌ المتبقي: ${(totalSales - totalPaidSales).toLocaleString('ar-LY')} د.ل\n\n`;
    }

    // فواتير المشتريات
    if (includePurchaseInvoices && purchaseInvoices.length > 0) {
      message += `📦 *فواتير المشتريات:*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      const totalPurchase = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      message += `📊 عدد الفواتير: ${purchaseInvoices.length}\n`;
      message += `💵 إجمالي المبلغ: ${totalPurchase.toLocaleString('ar-LY')} د.ل\n`;
      message += `ℹ️ المشتريات تُخصم من رصيد الزبون\n\n`;
    }

    // رسالة مخصصة
    if (customMessage.trim()) {
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `📝 *ملاحظة:*\n${customMessage.trim()}\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━\n`;
    message += `شكراً لتعاملكم معنا 🙏`;

    return message;
  };

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      await loadContracts();
    }
  };

  useEffect(() => {
    if (open) {
      loadContracts();
    }
  }, [open]);

  const handleSend = async () => {
    if (recipientType === 'customer' && !phoneNumber) {
      toast.error('الرجاء إدخال رقم الهاتف');
      return;
    }

    if (recipientType === 'management' && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار جهة اتصال واحدة على الأقل');
      return;
    }

    // التحقق من إمكانية إرسال PDF
    if (sendAsPDF && sendingMethod !== 'textly') {
      toast.error('إرسال PDF يتطلب استخدام Textly API');
      return;
    }

    const message = generateMessage();
    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    let successCount = 0;
    let errorCount = 0;

    if (recipientType === 'customer') {
      statusMap.set('customer', 'pending');
      setSendingStatus(statusMap);

      let success = false;
      
      // إرسال كملف PDF
      if (sendAsPDF) {
        try {
          toast.info('جاري إنشاء ملف PDF...');

          const pdfBase64 = await generatePDFBase64();

          success = await sendDocument({
            phone: phoneNumber,
            caption: message,
            fileName: `كشف_حساب_${customer.name}.pdf`,
            mimeType: 'application/pdf',
            base64Content: pdfBase64,
          });
        } catch (error: any) {
          console.error('Error generating/sending PDF:', error);
          toast.error('فشل في إنشاء أو إرسال ملف PDF: ' + (error.message || 'خطأ غير معروف'));
          success = false;
        }
      } else {
        // إرسال رسالة نصية فقط
        if (sendingMethod === 'textly') {
          success = await sendTextly({
            phone: phoneNumber,
            message: message,
          });
        } else {
          success = await sendWhatsApp({
            phone: phoneNumber,
            message: message,
          });
        }
      }

      statusMap.set('customer', success ? 'success' : 'error');
      setSendingStatus(new Map(statusMap));

      if (success) {
        toast.success(`تم إرسال كشف الحساب إلى ${customer.name}`);
        setTimeout(() => setOpen(false), 1500);
      }
    } else {
      // إرسال للإدارة
      selectedManagement.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(statusMap);

      // إذا كان إرسال PDF، يجب إنشاء الملف مرة واحدة
      let pdfBase64: string | null = null;
      if (sendAsPDF) {
        try {
          toast.info('جاري إنشاء ملف PDF...');

          pdfBase64 = await generatePDFBase64();
        } catch (error: any) {
          console.error('Error generating PDF:', error);
          toast.error('فشل في إنشاء ملف PDF: ' + (error.message || 'خطأ غير معروف'));
          return;
        }
      }

      for (const phoneId of selectedManagement) {
        const phone = managementPhones.find(c => c.id === phoneId);
        if (!phone || !phone.phone_number) continue;

        let success = false;
        
        if (sendAsPDF && pdfBase64) {
          success = await sendDocument({
            phone: phone.phone_number,
            caption: message,
            fileName: `كشف_حساب_${customer.name}.pdf`,
            mimeType: 'application/pdf',
            base64Content: pdfBase64,
          });
        } else {
          if (sendingMethod === 'textly') {
            success = await sendTextly({
              phone: phone.phone_number,
              message: message,
            });
          } else {
            success = await sendWhatsApp({
              phone: phone.phone_number,
              message: message,
            });
          }
        }

        statusMap.set(phoneId, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));

        if (success) successCount++;
        else errorCount++;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (successCount > 0) {
        toast.success(`تم إرسال ${successCount} رسالة بنجاح`);
      }
      if (errorCount > 0) {
        toast.error(`فشل إرسال ${errorCount} رسالة`);
      }

      if (errorCount === 0) {
        setTimeout(() => {
          setOpen(false);
          setSelectedManagement(new Set());
          setSendingStatus(new Map());
        }, 2000);
      }
    }
  };

  const getStatusIcon = (id: string) => {
    const status = sendingStatus.get(id);
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    return null;
  };

  const formatArabicNumber = (num: number): string => {
    if (isNaN(num) || num === null || num === undefined) return '0';
    const numStr = num.toString();
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (decimalPart) {
      return `${formattedInteger}.${decimalPart}`;
    }
    return formattedInteger;
  };

  const generateStatementHTML = async (): Promise<string> => {
    const customerId = customer.id.startsWith('name:') ? null : customer.id;

    // تحميل البيانات
    let customerData: any = { name: customer.name, id: customer.id, phone: customer.phone || '' };
    if (customerId) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();
      if (data) {
        customerData = data;
      }
    }

    // تحميل العقود
    let contractsData: any[] = [];
    let query = supabase.from('Contract').select('*');
    if (customerId) {
      query = query.eq('customer_id', customerId);
    } else {
      query = query.ilike('Customer Name', customer.name);
    }
    const { data: contractResult } = await query.order('Contract Date', { ascending: false });
    contractsData = contractResult || [];

    // تحميل الدفعات
    let paymentsData: any[] = [];
    let paymentQuery = supabase.from('customer_payments').select('*');
    if (customerId) {
      paymentQuery = paymentQuery.eq('customer_id', customerId);
    } else {
      paymentQuery = paymentQuery.ilike('customer_name', customer.name);
    }
    const { data: paymentResult } = await paymentQuery.order('paid_at', { ascending: true });
    paymentsData = paymentResult || [];

    // إنشاء قائمة الحركات
    const transactions: any[] = [];

    contractsData.forEach(contract => {
      transactions.push({
        date: contract['Contract Date'],
        description: `عقد رقم ${contract.Contract_Number} - ${contract['Ad Type'] || 'غير محدد'}`,
        debit: Number(contract['Total']) || 0,
        credit: 0,
        reference: `عقد-${contract.Contract_Number}`,
        notes: contract['Ad Type'] || '—',
      });
    });

    paymentsData.forEach(payment => {
      const isDebit = payment.entry_type === 'invoice' || payment.entry_type === 'debt';
      transactions.push({
        date: payment.paid_at,
        description: payment.entry_type === 'receipt' ? 'إيصال' : 'فاتورة',
        debit: isDebit ? Number(payment.amount) || 0 : 0,
        credit: isDebit ? 0 : Number(payment.amount) || 0,
        reference: payment.reference || '—',
        notes: payment.notes || '—',
      });
    });

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    transactions.forEach(t => {
      balance += (t.debit - t.credit);
      t.balance = balance;
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

    const statementDate = new Date().toLocaleDateString('ar-LY');
    const statementNumber = `STMT-${Date.now()}`;

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف حساب ${customerData.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            width: 210mm;
            height: 297mm;
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white;
            color: #000;
            font-size: 12px;
            line-height: 1.4;
            overflow: hidden;
          }

          .statement-container {
            width: 210mm;
            height: 297mm;
            padding: 15mm;
            display: flex;
            flex-direction: column;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }

          .statement-info {
            text-align: left;
            direction: ltr;
            order: 2;
          }

          .statement-title {
            font-size: 28px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
          }

          .statement-details {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
          }

          .company-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
            order: 1;
          }

          .company-logo {
            max-width: 400px;
            height: auto;
            object-fit: contain;
            margin-bottom: 5px;
            display: block;
            margin-right: 0;
          }

          .company-details {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
            font-weight: 400;
            text-align: right;
          }

          .customer-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0;
            margin-bottom: 25px;
            border-right: 4px solid #000;
          }

          .customer-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #000;
          }

          .customer-details {
            font-size: 13px;
            line-height: 1.6;
          }

          .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            table-layout: fixed;
          }

          .transactions-table th {
            background: #000;
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #000;
            font-size: 11px;
            height: 40px;
          }

          .transactions-table td {
            padding: 8px 6px;
            text-align: center;
            border: 1px solid #ddd;
            font-size: 10px;
            vertical-align: middle;
            height: 30px;
          }

          .transactions-table tbody tr:nth-child(even) {
            background: #f8f9fa;
          }

          .debit {
            color: #dc2626;
            font-weight: bold;
          }

          .credit {
            color: #16a34a;
            font-weight: bold;
          }

          .balance {
            font-weight: bold;
          }

          .summary-section {
            margin-top: auto;
            border-top: 2px solid #000;
            padding-top: 20px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            font-size: 14px;
          }

          .summary-row.total-debits {
            font-size: 16px;
            font-weight: bold;
            color: #dc2626;
            margin-bottom: 10px;
          }

          .summary-row.total-credits {
            font-size: 16px;
            font-weight: bold;
            color: #16a34a;
            margin-bottom: 10px;
          }

          .summary-row.balance {
            font-size: 20px;
            font-weight: bold;
            background: #000;
            color: white;
            padding: 20px 25px;
            border-radius: 0;
            margin-top: 15px;
            border: none;
          }

          .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }

          @media print {
            html, body {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="statement-container">
          <div class="header">
            <div class="company-info">
              <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
            </div>

            <div class="statement-info">
              <div class="statement-title">كشف حساب</div>
              <div class="statement-details">
                رقم الكشف: ${statementNumber}<br>
                التاريخ: ${statementDate}<br>
              </div>
            </div>
          </div>

          <div class="customer-info">
            <div class="customer-title">بيانات العميل</div>
            <div class="customer-details">
              <strong>الاسم:</strong> ${customerData.name}<br>
              ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
              ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
              <strong>رقم العميل:</strong> ${customerData.id}
            </div>
          </div>

          <table class="transactions-table">
            <thead>
              <tr>
                <th style="width: 8%">#</th>
                <th style="width: 12%">التاريخ</th>
                <th style="width: 20%">البيان</th>
                <th style="width: 12%">المرجع</th>
                <th style="width: 12%">مدين</th>
                <th style="width: 12%">دائن</th>
                <th style="width: 12%">الرصيد</th>
                <th style="width: 12%">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map((transaction, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY') : '—'}</td>
                  <td style="text-align: right; padding-right: 8px;">${transaction.description}</td>
                  <td>${transaction.reference}</td>
                  <td class="debit">${transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—'}</td>
                  <td class="credit">${transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—'}</td>
                  <td class="balance">${currency.symbol} ${formatArabicNumber(transaction.balance)}</td>
                  <td style="text-align: right; padding-right: 8px;">${transaction.notes}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="summary-row total-debits">
              <span>إجمالي المدين:</span>
              <span>${currency.symbol} ${formatArabicNumber(totalDebits)}</span>
            </div>
            <div class="summary-row total-credits">
              <span>إجمالي الدائن:</span>
              <span>- ${currency.symbol} ${formatArabicNumber(totalCredits)}</span>
            </div>
            <div class="summary-row balance" style="background: ${balance > 0 ? '#000' : '#065f46'};">
              <span>الرصيد النهائي:</span>
              <span>${currency.symbol} ${formatArabicNumber(Math.abs(balance))}${balance < 0 ? ' (رصيد دائن)' : balance === 0 ? ' (مسدد بالكامل)' : ''}</span>
            </div>
          </div>

          <div class="footer">
            شكراً لتعاملكم معنا | Thank you for your business<br>
            هذا كشف حساب إلكتروني ولا يحتاج إلى ختم أو توقيع
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generatePDFBase64 = async (): Promise<string> => {
    const htmlContent = await generateStatementHTML();

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `كشف_حساب_${customer.name}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
        compress: true
      }
    };

    return new Promise((resolve, reject) => {
      html2pdf()
        .set(opt)
        .from(htmlContent)
        .output('dataurlstring')
        .then((dataUrl: string) => {
          const base64Content = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve(base64Content);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      toast.info('جاري إنشاء ملف PDF...');

      const base64 = await generatePDFBase64();

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `كشف_حساب_${customer.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('تم تحميل ملف PDF بنجاح');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error('فشل في تحميل ملف PDF: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            إرسال كشف حساب
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6" />
            إرسال كشف حساب - {customer.name}
          </DialogTitle>
          <DialogDescription>
            إرسال كشف حساب مفصل للزبون عبر واتساب
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Type Selection */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <Label className="text-base font-semibold mb-3 block">المستلم</Label>
            <RadioGroup
              value={recipientType}
              onValueChange={(value) => setRecipientType(value as 'customer' | 'management')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="customer" id="customer-recipient" />
                <Label htmlFor="customer-recipient" className="cursor-pointer font-normal flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  الزبون
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="management" id="management-recipient" />
                <Label htmlFor="management-recipient" className="cursor-pointer font-normal flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  الإدارة
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Sending Method Selection */}
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">طريقة الإرسال</Label>
              <RadioGroup
                value={sendingMethod}
                onValueChange={(value) => setSendingMethod(value as 'textly' | 'whatsapp')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="textly" id="textly-method" />
                  <Label htmlFor="textly-method" className="cursor-pointer font-normal">
                    Textly API (موصى به)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="whatsapp" id="whatsapp-method" />
                  <Label htmlFor="whatsapp-method" className="cursor-pointer font-normal">
                    واتساب Web
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* خيار إرسال كملف PDF */}
            <div className="flex items-center space-x-2 space-x-reverse p-3 bg-background rounded-lg border-2 border-primary/20">
              <Checkbox
                id="send-pdf"
                checked={sendAsPDF}
                onCheckedChange={(checked) => setSendAsPDF(checked as boolean)}
              />
              <Label htmlFor="send-pdf" className="flex items-center gap-2 cursor-pointer font-medium">
                <FileText className="h-5 w-5 text-primary" />
                إرسال كشف الحساب كملف PDF
              </Label>
            </div>

            {sendAsPDF && sendingMethod !== 'textly' && (
              <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                ⚠️ إرسال ملفات PDF يتطلب استخدام Textly API
              </div>
            )}
          </div>

          {recipientType === 'customer' ? (
            <>
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف *</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    placeholder="+218912345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    dir="ltr"
                    className="flex-1"
                  />
                  {customer.phone && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 bg-muted px-3 rounded-md">
                      <span className="text-xs">المخزن:</span>
                      <span className="font-mono">{customer.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Management Recipients */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">أرقام الإدارة</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllManagement}
                  >
                    {selectedManagement.size === managementPhones.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </Button>
                </div>
                
                <ScrollArea className="h-48 border rounded-lg p-3">
                  {managementPhones.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      لا توجد أرقام إدارة مضافة
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {managementPhones.map((phone) => (
                        <div
                          key={phone.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              id={`mgmt-${phone.id}`}
                              checked={selectedManagement.has(phone.id)}
                              onCheckedChange={() => toggleManagement(phone.id)}
                            />
                            <label htmlFor={`mgmt-${phone.id}`} className="flex-1 cursor-pointer">
                              <div className="font-medium">{phone.label || 'بدون تسمية'}</div>
                              <div className="text-sm text-muted-foreground font-mono" dir="ltr">
                                {phone.phone_number}
                              </div>
                            </label>
                          </div>
                          <div className="mr-2">
                            {getStatusIcon(phone.id)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}

          {/* Customer Summary Card */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-lg">الملخص المالي</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>عدد العقود: <span className="font-bold">{customer.contractsCount}</span></div>
              <div>إجمالي العقود: <span className="font-bold">{customer.totalRent.toLocaleString('ar-LY')} د.ل</span></div>
              <div>إجمالي المدفوع: <span className="font-bold text-green-600">{customer.totalPaid.toLocaleString('ar-LY')} د.ل</span></div>
              <div>رصيد الحساب: <span className="font-bold text-blue-600">{customer.accountBalance.toLocaleString('ar-LY')} د.ل</span></div>
              <div className="col-span-2">المبلغ المتبقي: <span className="font-bold text-red-600">{customer.remaining.toLocaleString('ar-LY')} د.ل</span></div>
            </div>
          </div>

          {/* Overdue Alert */}
          {overdueInfo?.hasOverdue && (
            <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-destructive font-bold">
                <AlertCircle className="h-5 w-5" />
                تنبيه: يوجد دفعات متأخرة!
              </div>
              <div className="text-sm space-y-1">
                <div>المبلغ المتأخر: <span className="font-bold">{overdueInfo.totalOverdueAmount.toLocaleString('ar-LY')} د.ل</span></div>
                <div>أقدم تأخير: <span className="font-bold">{overdueInfo.oldestDaysOverdue} يوم</span></div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="include-contracts" className="cursor-pointer">
                  تضمين تفاصيل العقود
                </Label>
              </div>
              <Switch
                id="include-contracts"
                checked={includeContracts}
                onCheckedChange={(checked) => {
                  setIncludeContracts(checked);
                  if (checked) loadContracts();
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <Label htmlFor="include-print" className="cursor-pointer">
                  تضمين فواتير الطباعة
                </Label>
              </div>
              <Switch
                id="include-print"
                checked={includePrintInvoices}
                onCheckedChange={(checked) => {
                  setIncludePrintInvoices(checked);
                  if (checked) loadContracts();
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <Label htmlFor="include-sales" className="cursor-pointer">
                  تضمين فواتير المبيعات
                </Label>
              </div>
              <Switch
                id="include-sales"
                checked={includeSalesInvoices}
                onCheckedChange={(checked) => {
                  setIncludeSalesInvoices(checked);
                  if (checked) loadContracts();
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-500" />
                <Label htmlFor="include-purchase" className="cursor-pointer">
                  تضمين فواتير المشتريات
                </Label>
              </div>
              <Switch
                id="include-purchase"
                checked={includePurchaseInvoices}
                onCheckedChange={(checked) => {
                  setIncludePurchaseInvoices(checked);
                  if (checked) loadContracts();
                }}
              />
            </div>

            {overdueInfo?.hasOverdue && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <Label htmlFor="include-overdue" className="cursor-pointer">
                    تضمين تنبيه الدفعات المتأخرة
                  </Label>
                </div>
                <Switch
                  id="include-overdue"
                  checked={includeOverdue}
                  onCheckedChange={setIncludeOverdue}
                />
              </div>
            )}

          </div>

          {/* Loading Contracts */}
          {loadingContracts && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="mr-2">جاري تحميل تفاصيل العقود...</span>
            </div>
          )}

          {/* Contracts List */}
          {includeContracts && contracts.length > 0 && !loadingContracts && (
            <div className="space-y-2">
              <Label>العقود ({contracts.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 p-2 border rounded-lg">
                {contracts.map((contract, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded text-sm">
                    <div className="font-semibold">عقد #{contract.contractNumber}</div>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <div>الإجمالي: {contract.total.toLocaleString('ar-LY')}</div>
                      <div className="text-green-600">المدفوع: {contract.paid.toLocaleString('ar-LY')}</div>
                      <div className="text-red-600">المتبقي: {contract.remaining.toLocaleString('ar-LY')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="custom-message">رسالة إضافية (اختياري)</Label>
            <Textarea
              id="custom-message"
              rows={3}
              placeholder="أضف ملاحظة أو رسالة خاصة..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading || downloadingPDF}
            >
              إلغاء
            </Button>
            {sendAsPDF && (
              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
                disabled={loading || downloadingPDF}
                className="gap-2"
              >
                {downloadingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري التحميل...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    تحميل PDF
                  </>
                )}
              </Button>
            )}
          </div>
          <Button
            onClick={handleSend}
            disabled={loading || downloadingPDF || (recipientType === 'customer' && !phoneNumber) || (recipientType === 'management' && selectedManagement.size === 0)}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {recipientType === 'customer' ? 'إرسال للزبون' : `إرسال لـ ${selectedManagement.size} من الإدارة`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
