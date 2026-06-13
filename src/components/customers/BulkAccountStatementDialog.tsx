import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  totalRent: number;
  totalPaid: number;
  accountBalance: number;
}

interface BulkAccountStatementDialogProps {
  customers: Customer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAccountStatementDialog({ customers, open, onOpenChange }: BulkAccountStatementDialogProps) {
  const { sendMessage, loading } = useSendWhatsApp();
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());

  const customersWithPhone = customers.filter(c => c.phone && c.phone.trim() !== '');

  const toggleCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleAll = () => {
    if (selectedCustomers.size === customersWithPhone.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customersWithPhone.map(c => c.id)));
    }
  };

  const generateMessage = (customer: Customer): string => {
    const remaining = customer.totalRent - customer.totalPaid;
    
    let message = `السلام عليكم ${customer.name}\n\n`;
    message += `📊 *كشف حساب*\n\n`;
    message += `💰 إجمالي المستحقات: ${customer.totalRent.toLocaleString('ar-LY')} د.ل\n`;
    message += `✅ إجمالي المدفوعات: ${customer.totalPaid.toLocaleString('ar-LY')} د.ل\n`;
    
    if (customer.accountBalance > 0) {
      message += `🏦 رصيد الحساب: ${customer.accountBalance.toLocaleString('ar-LY')} د.ل\n`;
    }
    
    message += `\n📌 *المبلغ المتبقي: ${remaining.toLocaleString('ar-LY')} د.ل*\n\n`;
    
    if (remaining > 0) {
      message += `يرجى المبادرة بالسداد في أقرب وقت ممكن.\n`;
    } else if (remaining < 0) {
      message += `لديكم رصيد إضافي يمكن استخدامه في العقود القادمة.\n`;
    } else {
      message += `✨ الحساب مسدد بالكامل - شكراً لتعاملكم معنا.\n`;
    }
    
    message += `\nشكراً لثقتكم بنا.`;
    
    return message;
  };

  const handleSendStatements = async () => {
    if (selectedCustomers.size === 0) {
      toast.error('الرجاء اختيار زبون واحد على الأقل');
      return;
    }

    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    selectedCustomers.forEach(id => statusMap.set(id, 'pending'));
    setSendingStatus(statusMap);

    let successCount = 0;
    let errorCount = 0;

    for (const customerId of selectedCustomers) {
      const customer = customersWithPhone.find(c => c.id === customerId);
      if (!customer || !customer.phone) continue;

      const message = generateMessage(customer);
      const success = await sendMessage({
        phone: customer.phone,
        message: message,
      });

      statusMap.set(customerId, success ? 'success' : 'error');
      setSendingStatus(new Map(statusMap));

      if (success) successCount++;
      else errorCount++;

      // تأخير صغير بين الرسائل
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (successCount > 0) {
      toast.success(`تم إرسال ${successCount} كشف حساب بنجاح`);
    }
    if (errorCount > 0) {
      toast.error(`فشل إرسال ${errorCount} كشف حساب`);
    }

    if (errorCount === 0) {
      setTimeout(() => {
        onOpenChange(false);
        setSelectedCustomers(new Set());
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-6 w-6" />
            إرسال كشوفات حساب جماعية
          </DialogTitle>
        </DialogHeader>

        {customersWithPhone.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>لا يوجد زبائن لديهم أرقام هواتف مسجلة</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCustomers.size === customersWithPhone.length}
                  onCheckedChange={toggleAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer font-semibold">
                  تحديد الكل ({customersWithPhone.length} زبون)
                </Label>
              </div>
              <Badge variant="secondary">
                {selectedCustomers.size} محدد
              </Badge>
            </div>

            <ScrollArea className="h-[400px] rounded-lg border p-4">
              <div className="space-y-2">
                {customersWithPhone.map((customer) => {
                  const remaining = customer.totalRent - customer.totalPaid;
                  const isSelected = selectedCustomers.has(customer.id);

                  return (
                    <div
                      key={customer.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          id={`customer-${customer.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleCustomer(customer.id)}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`customer-${customer.id}`}
                            className="cursor-pointer font-medium"
                          >
                            {customer.name}
                          </Label>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>📱 {customer.phone}</div>
                            <div className="flex gap-3">
                              <span>💰 المستحق: {customer.totalRent.toLocaleString('ar-LY')} د.ل</span>
                              <span>✅ المدفوع: {customer.totalPaid.toLocaleString('ar-LY')} د.ل</span>
                              <span className={remaining > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                المتبقي: {remaining.toLocaleString('ar-LY')} د.ل
                              </span>
                            </div>
                          </div>
                        </div>
                        {getStatusIcon(customer.id)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSendStatements}
            disabled={loading || selectedCustomers.size === 0}
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
                إرسال ({selectedCustomers.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
