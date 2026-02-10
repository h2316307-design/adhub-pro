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
import { Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Users, Building, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface CustomerDebt {
  customerId: string | null;
  customerName: string;
  totalDebt: number;
  totalRent: number;
  totalPaid: number;
  contractsCount: number;
  phone?: string;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendDebtRemindersDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SendDebtRemindersDialog({ 
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: SendDebtRemindersDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [internalOpen, setInternalOpen] = useState(false);
  const [recipientType, setRecipientType] = useState<'customers' | 'management' | 'both'>('customers');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [customersWithDebt, setCustomersWithDebt] = useState<CustomerDebt[]>([]);
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  
  const sending = sendingWhatsApp || sendingTextly;
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  useEffect(() => {
    if (open) {
      loadCustomersWithDebt();
      loadManagementPhones();
    }
  }, [open]);

  const loadCustomersWithDebt = async () => {
    setLoadingData(true);
    try {
      // جلب جميع الزبائن
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, phone');

      if (customersError) throw customersError;

      // جلب العقود
      const { data: contracts, error: contractsError } = await supabase
        .from('Contract')
        .select('customer_id, "Customer Name", Total, "Total Paid"');

      if (contractsError) throw contractsError;

      // حساب الديون لكل زبون
      const debtMap = new Map<string, CustomerDebt>();

      for (const contract of contracts || []) {
        const total = Number(contract.Total || 0);
        const paid = Number(contract['Total Paid'] || 0);
        const remaining = total - paid;

        if (remaining > 0) {
          const customerId = contract.customer_id || `name:${contract['Customer Name']}`;
          
          if (!debtMap.has(customerId)) {
            debtMap.set(customerId, {
              customerId: contract.customer_id,
              customerName: contract['Customer Name'] || 'غير معروف',
              totalDebt: 0,
              totalRent: 0,
              totalPaid: 0,
              contractsCount: 0,
            });
          }

          const customer = debtMap.get(customerId)!;
          customer.totalDebt += remaining;
          customer.totalRent += total;
          customer.totalPaid += paid;
          customer.contractsCount += 1;
        }
      }

      // إضافة أرقام الهواتف
      const customerPhoneMap = new Map(customers?.map(c => [c.id, c.phone]) || []);
      const customerNameMap = new Map(customers?.map(c => [c.name, c.phone]) || []);

      const customersWithPhone = Array.from(debtMap.values())
        .map(c => ({
          ...c,
          phone: c.customerId 
            ? customerPhoneMap.get(c.customerId) 
            : customerNameMap.get(c.customerName),
        }))
        .filter(c => c.phone && c.phone.trim() !== '')
        .sort((a, b) => b.totalDebt - a.totalDebt);

      setCustomersWithDebt(customersWithPhone);
    } catch (error) {
      console.error('Error loading customers with debt:', error);
      toast.error('خطأ في تحميل بيانات الزبائن');
    } finally {
      setLoadingData(false);
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
    if (selectedCustomers.size === customersWithDebt.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customersWithDebt.map(c => c.customerId || c.customerName)));
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

  const generateCustomerMessage = (customer: CustomerDebt): string => {
    const paymentPercentage = ((customer.totalPaid / customer.totalRent) * 100).toFixed(1);
    
    let message = `السلام عليكم ورحمة الله وبركاته\n\n`;
    message += `السيد/ ${customer.customerName} المحترم،\n\n`;
    message += `نتشرف بإحاطة سيادتكم علماً بأن لديكم مستحقات مالية لم يتم سدادها حتى تاريخه:\n\n`;
    message += `📊 *تفاصيل الحساب:*\n`;
    message += `━━━━━━━━━━━━━━━━━\n`;
    message += `• عدد العقود: ${customer.contractsCount}\n`;
    message += `• إجمالي القيمة: ${customer.totalRent.toLocaleString('ar-LY')} د.ل\n`;
    message += `• المدفوع: ${customer.totalPaid.toLocaleString('ar-LY')} د.ل (${paymentPercentage}%)\n`;
    message += `• *الرصيد المستحق: ${customer.totalDebt.toLocaleString('ar-LY')} د.ل*\n`;
    message += `━━━━━━━━━━━━━━━━━\n\n`;
    message += `نرجو من سيادتكم التكرم بسداد المبلغ المستحق في أقرب وقت ممكن.\n\n`;
    message += `للاستفسار أو التنسيق يرجى التواصل معنا.\n\n`;
    message += `نشكر لكم حسن تعاونكم،\nمع فائق التقدير والاحترام`;

    return message;
  };

  const generateManagementReport = (): string => {
    const totalDebt = customersWithDebt.reduce((sum, c) => sum + c.totalDebt, 0);
    const totalRent = customersWithDebt.reduce((sum, c) => sum + c.totalRent, 0);
    const totalPaid = customersWithDebt.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalCustomers = customersWithDebt.length;
    const selectedCustomersData = customersWithDebt.filter(c => 
      selectedCustomers.has(c.customerId || c.customerName)
    );
    
    let report = `📊 *تقرير المستحقات المالية*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `📅 التاريخ: ${new Date().toLocaleDateString('ar', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    
    report += `📈 *الملخص التنفيذي:*\n`;
    report += `• عدد الزبائن: ${totalCustomers}\n`;
    report += `• إجمالي قيمة العقود: ${totalRent.toLocaleString('ar-LY')} د.ل\n`;
    report += `• إجمالي المدفوع: ${totalPaid.toLocaleString('ar-LY')} د.ل\n`;
    report += `• *إجمالي المستحقات: ${totalDebt.toLocaleString('ar-LY')} د.ل*\n`;
    report += `• نسبة التحصيل: ${((totalPaid / totalRent) * 100).toFixed(1)}%\n\n`;
    
    if (selectedCustomersData.length > 0) {
      report += `📋 *الزبائن المستهدفين بالتذكير (${selectedCustomersData.length}):*\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      selectedCustomersData
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 15)
        .forEach((customer, idx) => {
          const paymentRate = ((customer.totalPaid / customer.totalRent) * 100).toFixed(0);
          report += `${idx + 1}. *${customer.customerName}*\n`;
          report += `   • المستحق: ${customer.totalDebt.toLocaleString('ar-LY')} د.ل\n`;
          report += `   • العقود: ${customer.contractsCount}\n`;
          report += `   • التحصيل: ${paymentRate}%\n`;
          if (customer.phone) {
            report += `   • الهاتف: ${customer.phone}\n`;
          }
          report += `\n`;
        });
      
      if (selectedCustomersData.length > 15) {
        const remaining = selectedCustomersData.length - 15;
        const remainingDebt = selectedCustomersData
          .slice(15)
          .reduce((sum, c) => sum + c.totalDebt, 0);
        report += `... و ${remaining} زبون آخر (${remainingDebt.toLocaleString('ar-LY')} د.ل)\n\n`;
      }
    }
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `⚠️ *يرجى المتابعة الفورية للتحصيل*`;
    
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

    if (recipientType === 'both' && selectedCustomers.size === 0 && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار زبائن أو جهات اتصال');
      return;
    }

    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    
    let successCount = 0;
    let errorCount = 0;

    // إرسال للزبائن
    if (recipientType === 'customers' || recipientType === 'both') {
      selectedCustomers.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(new Map(statusMap));

      for (const customerId of selectedCustomers) {
        const customer = customersWithDebt.find(c => 
          (c.customerId === customerId) || (c.customerName === customerId)
        );
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
    }

    // إرسال للإدارة
    if (recipientType === 'management' || recipientType === 'both') {
      selectedManagement.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(new Map(statusMap));

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

  const getStatusIcon = (id: string) => {
    const status = sendingStatus.get(id);
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <DollarSign className="h-4 w-4" />
          إرسال تذكيرات الديون
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6" />
            إرسال تذكيرات احترافية بالمستحقات المالية
          </DialogTitle>
          <DialogDescription>
            اختر الزبائن لإرسال تذكيرات رسمية أو الإدارة لإرسال تقرير تفصيلي
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-3">جاري تحميل البيانات...</span>
          </div>
        ) : customersWithDebt.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-semibold">لا توجد ديون مستحقة</p>
            <p className="text-sm text-muted-foreground mt-2">
              جميع الزبائن قاموا بالسداد الكامل
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Alert for summary */}
              <Alert className="border-orange-500 bg-orange-50/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium">
                    <div>
                      <div className="text-muted-foreground">عدد الزبائن</div>
                      <div className="text-lg font-bold">{customersWithDebt.length}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">إجمالي المستحقات</div>
                      <div className="text-lg font-bold text-orange-600">
                        {customersWithDebt.reduce((s, c) => s + c.totalDebt, 0).toLocaleString('ar-LY')} د.ل
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">نسبة التحصيل</div>
                      <div className="text-lg font-bold text-green-600">
                        {(
                          (customersWithDebt.reduce((s, c) => s + c.totalPaid, 0) / 
                          customersWithDebt.reduce((s, c) => s + c.totalRent, 0)) * 100
                        ).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Recipient Type Selection */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  اختر جهة الإرسال
                </Label>
                <RadioGroup
                  value={recipientType}
                  onValueChange={(value) => setRecipientType(value as 'customers' | 'management' | 'both')}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="flex items-center space-x-2 space-x-reverse p-3 border-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                    <RadioGroupItem value="customers" id="customers" />
                    <Label htmlFor="customers" className="cursor-pointer font-normal flex items-center gap-2 flex-1">
                      <Users className="h-4 w-4" />
                      <div>
                        <div className="font-semibold">الزبائن</div>
                        <div className="text-xs text-muted-foreground">تذكيرات رسمية</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse p-3 border-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                    <RadioGroupItem value="management" id="management" />
                    <Label htmlFor="management" className="cursor-pointer font-normal flex items-center gap-2 flex-1">
                      <Building className="h-4 w-4" />
                      <div>
                        <div className="font-semibold">الإدارة</div>
                        <div className="text-xs text-muted-foreground">تقرير تفصيلي</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse p-3 border-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="cursor-pointer font-normal flex items-center gap-2 flex-1">
                      <Users className="h-3 w-3" />
                      <Building className="h-3 w-3" />
                      <div>
                        <div className="font-semibold">كلاهما</div>
                        <div className="text-xs text-muted-foreground">إرسال شامل</div>
                      </div>
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

              {(recipientType === 'customers' || recipientType === 'both') && (
                <>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-customers"
                        checked={selectedCustomers.size === customersWithDebt.length}
                        onCheckedChange={toggleAllCustomers}
                      />
                      <label htmlFor="select-all-customers" className="font-semibold cursor-pointer">
                        اختيار الكل ({customersWithDebt.length})
                      </label>
                    </div>
                    <Badge variant="secondary">
                      {selectedCustomers.size} محدد
                    </Badge>
                  </div>

                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <div className="space-y-3">
                      {customersWithDebt.map((customer) => {
                        const customerId = customer.customerId || customer.customerName;
                        const isSelected = selectedCustomers.has(customerId);
                        const statusIcon = getStatusIcon(customerId);

                        return (
                          <div
                            key={customerId}
                            className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card hover:border-primary/50'
                            }`}
                          >
                            <Checkbox
                              id={`customer-${customerId}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleCustomer(customerId)}
                              disabled={sending}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <label
                                  htmlFor={`customer-${customerId}`}
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
                                    {customer.totalDebt.toLocaleString('ar-LY')} د.ل
                                  </Badge>
                                  <span>{customer.contractsCount} عقد</span>
                                  <span>نسبة السداد: {((customer.totalPaid / customer.totalRent) * 100).toFixed(1)}%</span>
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

              {(recipientType === 'management' || recipientType === 'both') && (
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

                      <ScrollArea className="h-[200px] rounded-md border p-4">
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
                disabled={sending || (
                  (recipientType === 'customers' && selectedCustomers.size === 0) ||
                  (recipientType === 'management' && selectedManagement.size === 0) ||
                  (recipientType === 'both' && selectedCustomers.size === 0 && selectedManagement.size === 0)
                )}
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
                    إرسال (
                    {recipientType === 'both' 
                      ? selectedCustomers.size + selectedManagement.size
                      : recipientType === 'customers' 
                        ? selectedCustomers.size 
                        : selectedManagement.size
                    })
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
