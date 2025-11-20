import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Users, Building } from "lucide-react";
import { toast } from "sonner";

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
}

interface UnpaidPrintInvoice {
  invoiceId: string;
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
}

interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  unpaidInvoices: UnpaidPrintInvoice[];
  phone?: string;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendOverdueRemindersDialogProps {
  customerOverdues?: CustomerOverdue[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SendOverdueRemindersDialog({ 
  customerOverdues: propCustomerOverdues, 
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: SendOverdueRemindersDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [internalOpen, setInternalOpen] = useState(false);
  const [recipientType, setRecipientType] = useState<'customers' | 'management'>('customers');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [customersWithPhone, setCustomersWithPhone] = useState<CustomerOverdue[]>([]);
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [loadedCustomerOverdues, setLoadedCustomerOverdues] = useState<CustomerOverdue[]>([]);
  const [loading, setLoading] = useState(false);
  
  const sending = sendingWhatsApp || sendingTextly;
  
  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  // Use prop customerOverdues if provided, otherwise use loaded ones
  const customerOverdues = propCustomerOverdues || loadedCustomerOverdues;

  useEffect(() => {
    if (open) {
      if (!propCustomerOverdues) {
        loadAllCustomerOverdues();
      }
      loadCustomerPhones();
      loadManagementPhones();
    }
  }, [open, propCustomerOverdues]);
  
  const loadAllCustomerOverdues = async () => {
    setLoading(true);
    try {
      const today = new Date();

      // ✅ جلب جميع العقود التي لديها installments_data
      const { data: contracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, Total')
        .not('installments_data', 'is', null);

      if (error) throw error;

      const overdueByCustomer = new Map<string, CustomerOverdue>();

      // جلب كل دفعات الزبائن مرة واحدة
      const contractNumbers = (contracts || []).map(c => c.Contract_Number);
      const { data: allPayments } = contractNumbers.length > 0
        ? await supabase
            .from('customer_payments')
            .select('contract_number, amount, paid_at')
            .in('contract_number', contractNumbers)
        : { data: [] };

      const paymentsByContract = new Map<number, { amount: number; paid_at: string }[]>();
      (allPayments || []).forEach((p: any) => {
        if (!paymentsByContract.has(p.contract_number)) 
          paymentsByContract.set(p.contract_number, []);
        paymentsByContract.get(p.contract_number)!.push({ 
          amount: Number(p.amount) || 0, 
          paid_at: p.paid_at 
        });
      });

      for (const contract of (contracts || [])) {
        try {
          let installments: any[] = [];
          const rawData = contract.installments_data;
          
          // ✅ تحليل البيانات بشكل صحيح
          if (!rawData) continue;
          
          if (typeof rawData === 'string') {
            try {
              installments = JSON.parse(rawData);
            } catch {
              continue;
            }
          } else if (Array.isArray(rawData)) {
            installments = rawData;
          } else {
            continue;
          }

          const installmentsSorted = installments
            .filter((i: any) => i.dueDate)
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          const totalPaidForContract = (paymentsByContract.get(contract.Contract_Number) || [])
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          let paymentsRemaining = totalPaidForContract;

          for (const inst of installmentsSorted) {
            const dueDate = new Date(inst.dueDate);
            const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
              const currentDue = Number(inst.amount) || 0;
              const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
              const overdueAmount = Math.max(0, currentDue - allocated);
              paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

              if (overdueAmount > 0) {
                const customerId = contract.customer_id || `name:${contract['Customer Name']}`;
                const customerName = contract['Customer Name'] || 'غير معروف';

                if (!overdueByCustomer.has(customerId)) {
                  overdueByCustomer.set(customerId, {
                    customerId: contract.customer_id,
                    customerName,
                    totalOverdue: 0,
                    overdueCount: 0,
                    oldestDaysOverdue: 0,
                    installments: [],
                    unpaidInvoices: [],
                  });
                }

                const customerData = overdueByCustomer.get(customerId)!;
                customerData.installments.push({
                  contractNumber: contract.Contract_Number,
                  customerName,
                  customerId: contract.customer_id,
                  installmentAmount: overdueAmount,
                  dueDate: inst.dueDate,
                  description: inst.description || 'دفعة',
                  daysOverdue: diffDays,
                });
                customerData.totalOverdue += overdueAmount;
                customerData.overdueCount += 1;
                customerData.oldestDaysOverdue = Math.max(customerData.oldestDaysOverdue, diffDays);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing contract installments:', e);
        }
      }

      setLoadedCustomerOverdues(Array.from(overdueByCustomer.values()));
    } catch (error) {
      console.error('Error loading customer overdues:', error);
      toast.error('خطأ في تحميل بيانات الزبائن');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerPhones = async () => {
    setLoadingPhones(true);
    try {
      // جلب أرقام الهواتف بناءً على IDs والأسماء
      const customerIds = customerOverdues
        .map(c => c.customerId)
        .filter(id => id !== null) as string[];

      const customerNames = customerOverdues
        .filter(c => !c.customerId)
        .map(c => c.customerName);

      const phoneMap = new Map<string, string>();

      // جلب بناءً على IDs
      if (customerIds.length > 0) {
        const { data: customers, error } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('id', customerIds);

        if (!error && customers) {
          customers.forEach(c => {
            if (c.phone) phoneMap.set(c.id, c.phone);
          });
        }
      }

      // جلب بناءً على الأسماء
      if (customerNames.length > 0) {
        const { data: customersByName } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('name', customerNames);

        if (customersByName) {
          customersByName.forEach(c => {
            if (c.phone) phoneMap.set(c.name, c.phone);
          });
        }
      }

      const withPhones = customerOverdues
        .map(c => ({
          ...c,
          phone: c.customerId 
            ? phoneMap.get(c.customerId) 
            : phoneMap.get(c.customerName),
        }))
        .filter(c => c.phone && c.phone.trim() !== '');

      console.log('عدد الزبائن المتأخرين:', customerOverdues.length);
      console.log('عدد الزبائن الذين لديهم أرقام:', withPhones.length);

      setCustomersWithPhone(withPhones);
    } catch (error) {
      console.error('Error loading phones:', error);
      toast.error('خطأ في تحميل أرقام الهواتف');
    } finally {
      setLoadingPhones(false);
    }
  };

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
      toast.error('خطأ في تحميل أرقام الإدارة');
    }
  };

  const toggleCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleAllCustomers = () => {
    if (selectedCustomers.size === customersWithPhone.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customersWithPhone.map(c => c.customerId!)));
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

  const generateCustomerMessage = (customer: CustomerOverdue): string => {
    let message = `السلام عليكم ${customer.customerName}\n\n`;
    message += `تذكير بوجود دفعات متأخرة:\n\n`;

    // Group installments by contract
    const contractGroups = new Map<number, OverdueInstallment[]>();
    customer.installments.forEach(inst => {
      if (!contractGroups.has(inst.contractNumber)) {
        contractGroups.set(inst.contractNumber, []);
      }
      contractGroups.get(inst.contractNumber)!.push(inst);
    });

    if (contractGroups.size > 0) {
      message += `📋 دفعات العقود المتأخرة:\n`;
      let idx = 1;
      contractGroups.forEach((installments, contractNumber) => {
        message += `\n${idx}. عقد #${contractNumber}\n`;
        message += `   ⚠️ *التكلفة الكاملة للعقد شاملة الطباعة والتركيب*\n`;
        installments.forEach(inst => {
          message += `   • دفعة متأخرة: ${inst.installmentAmount.toLocaleString('ar-LY')} د.ل\n`;
          message += `     تاريخ الاستحقاق: ${new Date(inst.dueDate).toLocaleDateString('ar-LY')}\n`;
          message += `     التأخير: ${inst.daysOverdue} يوم\n`;
        });
        idx++;
      });
      message += `\n`;
    }

    if (customer.unpaidInvoices.length > 0) {
      message += `🧾 فواتير إضافية غير مسددة:\n`;
      customer.unpaidInvoices.forEach((inv, idx) => {
        message += `${idx + 1}. عقد #${inv.contractNumber}\n`;
        message += `   المبلغ: ${inv.amount.toLocaleString('ar-LY')} د.ل\n`;
        message += `   مدة التأخير: ${inv.daysOverdue} يوم\n\n`;
      });
    }

    message += `💰 *إجمالي المبلغ المستحق: ${customer.totalOverdue.toLocaleString('ar-LY')} د.ل*\n\n`;
    message += `يرجى المبادرة بالسداد في أقرب وقت ممكن.\n`;
    message += `شكراً لتعاونكم.`;

    return message;
  };

  const generateManagementReport = (): string => {
    const totalOverdue = customerOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
    const totalCustomers = customerOverdues.length;
    
    let report = `📊 *تقرير الدفعات المتأخرة*\n\n`;
    report += `📅 التاريخ: ${new Date().toLocaleDateString('ar-LY')}\n\n`;
    report += `📈 *ملخص عام:*\n`;
    report += `عدد الزبائن: ${totalCustomers}\n`;
    report += `إجمالي المبالغ المتأخرة: ${totalOverdue.toLocaleString('ar-LY')} د.ل\n\n`;
    report += `───────────────────\n\n`;
    
    customerOverdues.slice(0, 10).forEach((customer, idx) => {
      report += `${idx + 1}. *${customer.customerName}*\n`;
      report += `   💰 المبلغ: ${customer.totalOverdue.toLocaleString('ar-LY')} د.ل\n`;
      report += `   ⏰ أقدم تأخير: ${customer.oldestDaysOverdue} يوم\n`;
      report += `   📋 عدد الدفعات: ${customer.installments.length + customer.unpaidInvoices.length}\n\n`;
    });
    
    if (customerOverdues.length > 10) {
      report += `... و ${customerOverdues.length - 10} زبون آخر\n\n`;
    }
    
    report += `───────────────────\n`;
    report += `يرجى المتابعة مع الزبائن للتحصيل`;
    
    return report;
  };

  const handleSendReminders = async () => {
    if (recipientType === 'customers' && selectedCustomers.size === 0) {
      toast.error('الرجاء اختيار زبون واحد على الأقل');
      return;
    }

    if (recipientType === 'management' && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار جهة اتصال واحدة على الأقل');
      return;
    }

    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    
    let successCount = 0;
    let errorCount = 0;

    if (recipientType === 'customers') {
      selectedCustomers.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(statusMap);

      for (const customerId of selectedCustomers) {
        const customer = customersWithPhone.find(c => c.customerId === customerId);
        if (!customer || !customer.phone) continue;

        const message = generateCustomerMessage(customer);

        let success = false;
        
        if (sendingMethod === 'textly') {
          success = await sendTextly({
            phone: customer.phone,
            message: message,
          });
        } else {
          success = await sendWhatsApp({
            phone: customer.phone,
            message: message,
          });
        }

        statusMap.set(customerId, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));

        if (success) successCount++;
        else errorCount++;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      // إرسال للإدارة
      selectedManagement.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(statusMap);

      const reportMessage = generateManagementReport();

      for (const phoneId of selectedManagement) {
        const phone = managementPhones.find(c => c.id === phoneId);
        if (!phone || !phone.phone_number) continue;

        let success = false;
        
        if (sendingMethod === 'textly') {
          success = await sendTextly({
            phone: phone.phone_number,
            message: reportMessage,
          });
        } else {
          success = await sendWhatsApp({
            phone: phone.phone_number,
            message: reportMessage,
          });
        }

        statusMap.set(phoneId, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));

        if (success) successCount++;
        else errorCount++;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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
        setSelectedCustomers(new Set());
        setSelectedManagement(new Set());
        setSendingStatus(new Map());
      }, 2000);
    }
  };

  const getStatusIcon = (customerId: string) => {
    const status = sendingStatus.get(customerId);
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="lg" className="gap-2">
          <MessageSquare className="h-5 w-5" />
          إرسال تنبيهات واتساب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="h-6 w-6" />
            إرسال تنبيهات الدفعات المتأخرة
          </DialogTitle>
          <DialogDescription>
            اختر الزبائن أو الإدارة لإرسال التنبيهات
          </DialogDescription>
        </DialogHeader>

        {(loadingPhones || loading) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-3">جاري تحميل البيانات...</span>
          </div>
        ) : (customerOverdues.length === 0 || customersWithPhone.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
            <p className="text-lg font-semibold">لا يوجد زبائن بأرقام هواتف مسجلة</p>
            <p className="text-sm text-muted-foreground mt-2">
              الرجاء إضافة أرقام الهواتف في صفحة الزبائن أولاً
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Alert for recipient type */}
              <Alert className={recipientType === 'customers' ? 'border-blue-500 bg-blue-50' : 'border-orange-500 bg-orange-50'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-semibold">
                  {recipientType === 'customers' 
                    ? '🔔 سيتم إرسال التنبيهات للزبائن المحددين'
                    : '📊 سيتم إرسال تقرير شامل للإدارة المحددة'}
                </AlertDescription>
              </Alert>

              {/* Recipient Type Selection */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <Label className="text-base font-semibold mb-3 block">المستلم</Label>
                <RadioGroup
                  value={recipientType}
                  onValueChange={(value) => setRecipientType(value as 'customers' | 'management')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="customers" id="customers" />
                    <Label htmlFor="customers" className="cursor-pointer font-normal flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      الزبائن
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="management" id="management" />
                    <Label htmlFor="management" className="cursor-pointer font-normal flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      الإدارة
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Sending Method Selection */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <Label className="text-base font-semibold mb-3 block">طريقة الإرسال</Label>
                <RadioGroup
                  value={sendingMethod}
                  onValueChange={(value) => setSendingMethod(value as 'textly' | 'whatsapp')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="textly" id="textly" />
                    <Label htmlFor="textly" className="cursor-pointer font-normal">
                      Textly API (موصى به)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="whatsapp" id="whatsapp" />
                    <Label htmlFor="whatsapp" className="cursor-pointer font-normal">
                      واتساب Web
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {recipientType === 'customers' ? (
                <>
                  {customersWithPhone.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
                      <p className="text-lg font-semibold">لا يوجد زبائن بأرقام هواتف مسجلة</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        الرجاء إضافة أرقام الهواتف في صفحة الزبائن أولاً
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all-customers"
                            checked={selectedCustomers.size === customersWithPhone.length}
                            onCheckedChange={toggleAllCustomers}
                          />
                          <label htmlFor="select-all-customers" className="font-semibold cursor-pointer">
                            اختيار الكل ({customersWithPhone.length})
                          </label>
                        </div>
                        <Badge variant="secondary">
                          {selectedCustomers.size} محدد
                        </Badge>
                      </div>

                      <ScrollArea className="h-[400px] rounded-md border p-4">
                        <div className="space-y-3">
                          {customersWithPhone.map((customer) => {
                            const isSelected = selectedCustomers.has(customer.customerId!);
                            const statusIcon = getStatusIcon(customer.customerId!);

                            return (
                              <div
                                key={customer.customerId}
                                className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border bg-card hover:border-primary/50'
                                }`}
                              >
                                <Checkbox
                                  id={`customer-${customer.customerId}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleCustomer(customer.customerId!)}
                                  disabled={sending}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <label
                                      htmlFor={`customer-${customer.customerId}`}
                                      className="font-bold text-lg cursor-pointer"
                                    >
                                      {customer.customerName}
                                    </label>
                                    {statusIcon}
                                  </div>
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <span>📱 {customer.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="destructive" className="text-xs">
                                        {customer.totalOverdue.toLocaleString('ar-LY')} د.ل
                                      </Badge>
                                      <span>{customer.installments.length + customer.unpaidInvoices.length} دفعة</span>
                                      <span>أقدم تأخير: {customer.oldestDaysOverdue} يوم</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </>
              ) : (
                <>
                  {managementPhones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
                      <p className="text-lg font-semibold">لا توجد جهات اتصال للإدارة</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        يرجى إضافة أرقام الإدارة في إعدادات النظام
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all-management"
                            checked={selectedManagement.size === managementPhones.length}
                            onCheckedChange={toggleAllManagement}
                          />
                          <label htmlFor="select-all-management" className="font-semibold cursor-pointer">
                            اختيار الكل ({managementPhones.length})
                          </label>
                        </div>
                        <Badge variant="secondary">
                          {selectedManagement.size} محدد
                        </Badge>
                      </div>

                      <ScrollArea className="h-[400px] rounded-md border p-4">
                        <div className="space-y-3">
                          {managementPhones.map((phone) => {
                            const isSelected = selectedManagement.has(phone.id);
                            const statusIcon = getStatusIcon(phone.id);

                            return (
                              <div
                                key={phone.id}
                                className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border bg-card hover:border-primary/50'
                                }`}
                              >
                                <Checkbox
                                  id={`phone-${phone.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleManagement(phone.id)}
                                  disabled={sending}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <label
                                      htmlFor={`phone-${phone.id}`}
                                      className="font-bold text-lg cursor-pointer"
                                    >
                                      {phone.label || 'رقم إدارة'}
                                    </label>
                                    {statusIcon}
                                  </div>
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <span>📱 {phone.phone_number}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSendReminders}
                disabled={sending || (recipientType === 'customers' ? selectedCustomers.size === 0 : selectedManagement.size === 0)}
                className="gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    إرسال ({recipientType === 'customers' ? selectedCustomers.size : selectedManagement.size})
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
