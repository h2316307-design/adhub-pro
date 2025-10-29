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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Loader2, FileText, AlertCircle, Users, Building, CheckCircle2, XCircle } from "lucide-react";
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
}

export function SendAccountStatementDialog({ 
  customer, 
  overdueInfo 
}: SendAccountStatementDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [open, setOpen] = useState(false);
  const [recipientType, setRecipientType] = useState<'customer' | 'management'>('customer');
  const [phoneNumber, setPhoneNumber] = useState(customer.phone || '');
  const [includeContracts, setIncludeContracts] = useState(true);
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  
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
    if (!includeContracts) return;
    
    setLoadingContracts(true);
    try {
      const customerId = customer.id.startsWith('name:') ? null : customer.id;
      
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
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('خطأ في تحميل تفاصيل العقود');
    } finally {
      setLoadingContracts(false);
    }
  };

  const generateMessage = (): string => {
    let message = `السلام عليكم ${customer.name}\n\n`;
    message += `📊 *كشف حساب مالي*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    // معلومات الزبون
    if (customer.company) {
      message += `🏢 الشركة: ${customer.company}\n`;
    }
    message += `📱 الهاتف: ${phoneNumber || customer.phone || '—'}\n\n`;

    // الملخص المالي
    message += `💰 *الملخص المالي:*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📋 عدد العقود: ${customer.contractsCount}\n`;
    message += `💵 إجمالي الإيجارات: ${customer.totalRent.toLocaleString('ar-LY')} د.ل\n`;
    message += `✅ إجمالي المدفوع: ${customer.totalPaid.toLocaleString('ar-LY')} د.ل\n`;
    message += `💳 رصيد الحساب: ${customer.accountBalance.toLocaleString('ar-LY')} د.ل\n`;
    message += `❌ المبلغ المتبقي: ${customer.remaining.toLocaleString('ar-LY')} د.ل\n\n`;

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

  const handleSend = async () => {
    if (recipientType === 'customer' && !phoneNumber) {
      toast.error('الرجاء إدخال رقم الهاتف');
      return;
    }

    if (recipientType === 'management' && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار جهة اتصال واحدة على الأقل');
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

      for (const phoneId of selectedManagement) {
        const phone = managementPhones.find(c => c.id === phoneId);
        if (!phone || !phone.phone_number) continue;

        let success = false;
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          إرسال كشف حساب
        </Button>
      </DialogTrigger>
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
          <div className="p-4 bg-muted/50 rounded-lg border">
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
              <div>إجمالي الإيجارات: <span className="font-bold">{customer.totalRent.toLocaleString('ar-LY')} د.ل</span></div>
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

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || (recipientType === 'customer' && !phoneNumber) || (recipientType === 'management' && selectedManagement.size === 0)}
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
