import { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, PrinterIcon, ShoppingCart, DollarSign, Sparkles, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EnhancedDistributePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
  purchaseInvoice?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    used_as_payment: number;
  } | null;
  editMode?: boolean;
  editingDistributedPaymentId?: string | null;
  editingPayments?: any[];
}

interface DistributableItem {
  id: string | number;
  type: 'contract' | 'printed_invoice' | 'sales_invoice';
  displayName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  selected: boolean;
  allocatedAmount: number;
}

// مكون البطاقة المحسّن مع الترقيم
const ItemCard = memo(({ 
  item, 
  index,
  onSelect, 
  onAmountChange 
}: { 
  item: DistributableItem;
  index: number;
  onSelect: (id: string | number, selected: boolean) => void;
  onAmountChange: (id: string | number, value: string) => void;
}) => (
  <Card 
    className={`transition-all ${
      item.selected 
        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20' 
        : 'border-border hover:border-primary/50 hover:bg-accent/5'
    }`}
  >
    <CardContent className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-sm font-bold text-muted-foreground">
            {index + 1}
          </div>
          <Checkbox
            checked={item.selected}
            onCheckedChange={(checked) => onSelect(item.id, checked as boolean)}
            className="mt-0"
          />
        </div>
        <div className="flex-1 space-y-2">
          <div className="font-semibold text-foreground flex items-center justify-between">
            <span>{item.displayName}</span>
            {item.selected && (
              <Badge variant="default" className="text-xs">محدد</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي:</span>
              <span className="font-medium">{item.totalAmount.toFixed(2)} د.ل</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المدفوع:</span>
              <span className="font-medium text-green-600">{item.paidAmount.toFixed(2)} د.ل</span>
            </div>
            <div className="flex justify-between col-span-2 pt-1.5 border-t border-border">
              <span className="text-muted-foreground font-semibold">المتبقي:</span>
              <span className="font-bold text-lg text-red-600">{item.remainingAmount.toFixed(2)} د.ل</span>
            </div>
          </div>
        </div>
      </div>
      {item.selected && (
        <div className="pt-2 border-t border-primary/20 bg-primary/5 -mx-4 px-4 -mb-3 pb-3 rounded-b-lg">
          <Label className="text-sm font-semibold mb-2 block text-primary">المبلغ المخصص لهذا العنصر</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={item.remainingAmount}
              value={item.allocatedAmount || ''}
              onChange={(e) => onAmountChange(item.id, e.target.value)}
              placeholder="0.00"
              className="text-right text-lg font-semibold"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAmountChange(item.id, String(item.remainingAmount))}
              className="whitespace-nowrap"
            >
              كامل المبلغ
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
));

export function EnhancedDistributePaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
  purchaseInvoice = null,
  editMode = false,
  editingDistributedPaymentId = null,
  editingPayments = []
}: EnhancedDistributePaymentDialogProps) {
  const [items, setItems] = useState<DistributableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const availableCredit = purchaseInvoice 
    ? purchaseInvoice.total_amount - purchaseInvoice.used_as_payment 
    : 0;

  useEffect(() => {
    if (open) {
      if (editMode && editingPayments && editingPayments.length > 0) {
        // تحميل بيانات التعديل
        const totalAmt = editingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        setTotalAmount(String(totalAmt));
        setPaymentMethod(editingPayments[0]?.method || 'نقدي');
        setPaymentReference(editingPayments[0]?.reference || '');
        setPaymentNotes(editingPayments[0]?.notes || '');
        setPaymentDate(editingPayments[0]?.paid_at ? new Date(editingPayments[0].paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      } else {
        setTotalAmount(purchaseInvoice ? String(availableCredit) : '');
        setPaymentMethod(purchaseInvoice ? 'مقايضة' : 'نقدي');
        setPaymentReference('');
        setPaymentNotes(purchaseInvoice ? `مقايضة من فاتورة مشتريات ${purchaseInvoice.invoice_number}` : '');
        setPaymentDate(new Date().toISOString().split('T')[0]);
      }
      loadDistributableItems();
    }
  }, [open, customerId, editMode, purchaseInvoice]);

  const loadDistributableItems = async () => {
    setLoading(true);
    try {
      const allItems: DistributableItem[] = [];

      // جلب العقود مع المدفوعات الفعلية من customer_payments
      const { data: contracts, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, Total, "Total Paid", "Customer Name"')
        .eq('customer_id', customerId);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
      }

      if (contracts) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل عقد
        const { data: contractPayments } = await supabase
          .from('customer_payments')
          .select('contract_number, amount, entry_type')
          .eq('customer_id', customerId)
          .in('entry_type', ['receipt', 'payment', 'account_payment']);

        const paymentsByContract = new Map<number, number>();
        if (contractPayments) {
          contractPayments.forEach(p => {
            const contractNum = Number(p.contract_number);
            if (contractNum && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByContract.get(contractNum) || 0;
              paymentsByContract.set(contractNum, current + (Number(p.amount) || 0));
            }
          });
        }

        contracts.forEach(contract => {
          const total = Number(contract.Total) || 0;
          const contractNum = Number(contract.Contract_Number);
          const paid = paymentsByContract.get(contractNum) || 0;
          const remaining = Math.max(0, total - paid);
          
          if (remaining > 0.01) { // تجنب القيم الصغيرة جداً
            allItems.push({
              id: contractNum,
              type: 'contract',
              displayName: `عقد #${contractNum}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير الطباعة غير المقفلة فقط
      const { data: printedInvoices, error: printedError } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId)
        .eq('locked', false);

      if (printedError) {
        console.error('Error fetching printed invoices:', printedError);
      }

      if (printedInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة طباعة
        const { data: printedPayments } = await supabase
          .from('customer_payments')
          .select('printed_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('printed_invoice_id', 'is', null);

        const paymentsByPrintedInvoice = new Map<string, number>();
        if (printedPayments) {
          printedPayments.forEach(p => {
            if (p.printed_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByPrintedInvoice.get(p.printed_invoice_id) || 0;
              paymentsByPrintedInvoice.set(p.printed_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        printedInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsByPrintedInvoice.get(invoice.id) || 0;
          const remaining = Math.max(0, total - paid);
          
          if (remaining > 0.01) {
            allItems.push({
              id: invoice.id,
              type: 'printed_invoice',
              displayName: `فاتورة طباعة #${invoice.invoice_number}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير المبيعات
      const { data: salesInvoices, error: salesError } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId);

      if (salesError) {
        console.error('Error fetching sales invoices:', salesError);
      }

      if (salesInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة مبيعات
        const { data: salesPayments } = await supabase
          .from('customer_payments')
          .select('sales_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('sales_invoice_id', 'is', null);

        const paymentsBySalesInvoice = new Map<string, number>();
        if (salesPayments) {
          salesPayments.forEach(p => {
            if (p.sales_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsBySalesInvoice.get(p.sales_invoice_id) || 0;
              paymentsBySalesInvoice.set(p.sales_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        salesInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsBySalesInvoice.get(invoice.id) || 0;
          const remaining = Math.max(0, total - paid);
          
          if (remaining > 0.01) {
            allItems.push({
              id: invoice.id,
              type: 'sales_invoice',
              displayName: `فاتورة مبيعات #${invoice.invoice_number}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // ✅ ترتيب من الأصغر للأكبر حسب رقم العقد
      allItems.sort((a, b) => Number(a.id) - Number(b.id));
      
      // في حالة التعديل، تحديد العناصر المحددة مسبقاً
      if (editMode && editingPayments && editingPayments.length > 0) {
        allItems.forEach(item => {
          const existingPayment = editingPayments.find(p => {
            if (item.type === 'contract') return Number(p.contract_number) === Number(item.id);
            if (item.type === 'printed_invoice') return p.printed_invoice_id === item.id;
            if (item.type === 'sales_invoice') return p.sales_invoice_id === item.id;
            return false;
          });
          if (existingPayment) {
            item.selected = true;
            item.allocatedAmount = Number(existingPayment.amount) || 0;
          }
        });
      }
      
      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItemById = (id: string | number, selected: boolean) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        return {
          ...it,
          selected,
          allocatedAmount: selected ? it.allocatedAmount : 0
        };
      }
      return it;
    }));
  };

  const handleAmountChangeById = (id: string | number, value: string) => {
    // السماح بالنص الفارغ أو القيم الصالحة فقط
    if (value === '') {
      setItems(prev => prev.map(it => {
        if (it.id === id) {
          return { ...it, allocatedAmount: 0 };
        }
        return it;
      }));
      return;
    }

    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return;

    setItems(prev => prev.map(it => {
      if (it.id === id) {
        const safeAmount = Math.min(Math.max(0, amount), it.remainingAmount);
        return { ...it, allocatedAmount: safeAmount };
      }
      return it;
    }));
  };

  const handleAutoDistribute = () => {
    const inputAmount = parseFloat(totalAmount) || 0;
    if (inputAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل');
      return;
    }

    let remainingToDistribute = inputAmount;
    const newItems = [...items];

    // توزيع تلقائي ذكي: يبدأ من الأصغر إلى الأكبر
    for (const item of newItems) {
      if (item.selected && remainingToDistribute > 0) {
        const amountToAllocate = Math.min(item.remainingAmount, remainingToDistribute);
        item.allocatedAmount = amountToAllocate;
        remainingToDistribute -= amountToAllocate;
      }
    }

    setItems(newItems);
    
    if (remainingToDistribute > 0) {
      toast.info(`تم توزيع ${inputAmount - remainingToDistribute} د.ل - يتبقى ${remainingToDistribute.toFixed(2)} د.ل`);
    } else {
      toast.success('تم التوزيع التلقائي بنجاح');
    }
  };

  const totalAllocated = items.reduce((sum, item) => sum + (item.selected ? item.allocatedAmount : 0), 0);
  const inputAmountNum = parseFloat(totalAmount) || 0;
  const remainingToAllocate = inputAmountNum - totalAllocated;

  const handleDistribute = async () => {
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);
    
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل وتخصيص مبلغ له');
      return;
    }

    if (inputAmountNum <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (Math.abs(remainingToAllocate) > 0.01) {
      toast.error(`المبلغ الموزع (${totalAllocated.toFixed(2)}) لا يساوي المبلغ الكلي (${inputAmountNum.toFixed(2)})`);
      return;
    }

    setDistributing(true);
    
    try {
      // في حالة التعديل
      if (editMode && editingDistributedPaymentId) {
        // حذف الدفعات القديمة
        const { error: deleteError } = await supabase
          .from('customer_payments')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);

        if (deleteError) {
          console.error('Error deleting old payments:', deleteError);
          throw deleteError;
        }
      }

      const distributedPaymentId = editMode && editingDistributedPaymentId ? editingDistributedPaymentId : crypto.randomUUID();
      const currentDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
      const paymentInserts = [];
      const errors = [];

      console.log('🔄 بدء توزيع الدفعة:', {
        totalAmount: inputAmountNum,
        selectedItems: selectedItems.length,
        distributedPaymentId
      });

      // إدخال جميع الدفعات
      for (const item of selectedItems) {
        const paymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: item.allocatedAmount,
          paid_at: currentDate,
          method: paymentMethod || 'نقدي',
          reference: paymentReference || null,
          entry_type: 'payment',
          distributed_payment_id: distributedPaymentId,
          notes: paymentNotes || `توزيع على ${item.displayName} من دفعة بمبلغ ${inputAmountNum.toFixed(2)} د.ل`
        };

        // إضافة purchase_invoice_id في حالة المقايضة
        if (purchaseInvoice) {
          paymentData.purchase_invoice_id = purchaseInvoice.id;
        }

        if (item.type === 'contract') {
          paymentData.contract_number = Number(item.id);
        } else if (item.type === 'printed_invoice') {
          paymentData.printed_invoice_id = String(item.id);
        } else if (item.type === 'sales_invoice') {
          paymentData.sales_invoice_id = String(item.id);
        }

        console.log(`💳 إضافة دفعة لـ ${item.displayName}:`, paymentData);

        const { error: paymentError, data: paymentResult } = await supabase
          .from('customer_payments')
          .insert(paymentData)
          .select();

        if (paymentError) {
          console.error(`❌ خطأ في إضافة دفعة ${item.displayName}:`, paymentError);
          errors.push(`فشل حفظ الدفعة لـ ${item.displayName}: ${paymentError.message}`);
          continue;
        }

        console.log(`✅ تم إضافة الدفعة لـ ${item.displayName}:`, paymentResult);
        paymentInserts.push({ item, paymentResult });
      }

      if (errors.length > 0) {
        toast.error(`حدثت أخطاء:\n${errors.join('\n')}`);
        setDistributing(false);
        return;
      }

      // تحديث المبالغ المدفوعة
      for (const { item } of paymentInserts) {
        try {
          if (item.type === 'contract') {
            const newPaidAmount = item.paidAmount + item.allocatedAmount;
            
            console.log(`📝 تحديث عقد #${item.id}:`, {
              oldPaid: item.paidAmount,
              allocated: item.allocatedAmount,
              newPaid: newPaidAmount
            });

            const { error: updateError } = await supabase
              .from('Contract')
              .update({
                'Total Paid': String(newPaidAmount)
              })
              .eq('Contract_Number', Number(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث العقد #${item.id}:`, updateError);
              errors.push(`فشل تحديث العقد #${item.id}: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث العقد #${item.id} بنجاح`);
            }
          } else if (item.type === 'printed_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            const isPaid = newPaid >= item.totalAmount;
            
            console.log(`📄 تحديث فاتورة طباعة ${item.id}:`, {
              newPaid,
              isPaid
            });

            const { error: updateError } = await supabase
              .from('printed_invoices')
              .update({
                paid_amount: newPaid,
                paid: isPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة طباعة:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة الطباعة بنجاح`);
            }
          } else if (item.type === 'sales_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            
            console.log(`🛒 تحديث فاتورة مبيعات ${item.id}:`, { newPaid });

            const { error: updateError } = await supabase
              .from('sales_invoices')
              .update({
                paid_amount: newPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة مبيعات:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة المبيعات بنجاح`);
            }
          }
        } catch (err) {
          console.error(`❌ خطأ غير متوقع في تحديث ${item.displayName}:`, err);
          errors.push(`خطأ غير متوقع: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        toast.warning(`تم توزيع الدفعة مع بعض التحذيرات:\n${errors.join('\n')}`);
      } else {
        console.log('✅ تم توزيع الدفعة بنجاح بالكامل');
        toast.success(`تم توزيع ${inputAmountNum.toFixed(2)} د.ل على ${selectedItems.length} عناصر بنجاح`);
      }
      
      // تحديث فاتورة المشتريات في حالة المقايضة
      if (purchaseInvoice) {
        const { error: purchaseUpdateError } = await supabase
          .from('purchase_invoices')
          .update({
            used_as_payment: purchaseInvoice.used_as_payment + totalAllocated
          })
          .eq('id', purchaseInvoice.id);

        if (purchaseUpdateError) {
          console.error('Error updating purchase invoice:', purchaseUpdateError);
          toast.warning('تم توزيع الدفعة ولكن فشل تحديث فاتورة المشتريات');
        }
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('❌ خطأ عام في توزيع الدفعة:', error);
      toast.error(`فشل في توزيع الدفعة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setDistributing(false);
    }
  };

  const contracts = items.filter(i => i.type === 'contract');
  const printedInvoices = items.filter(i => i.type === 'printed_invoice');
  const salesInvoices = items.filter(i => i.type === 'sales_invoice');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            توزيع دفعة - {customerName}
          </DialogTitle>
          <DialogDescription>
            أدخل المبلغ، اختر العناصر، ثم وزّعه بالتساوي أو يدويًا.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* قسم إدخال بيانات الدفعة */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      المبلغ الكلي للدفعة <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="أدخل المبلغ الكلي (د.ل)"
                      className="text-lg font-semibold text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">طريقة الدفع</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="نقدي">نقدي</SelectItem>
                        <SelectItem value="شيك">شيك</SelectItem>
                        <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                        <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">المرجع / رقم الشيك</Label>
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="اختياري"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">تاريخ الدفعة</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="text-right"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">ملاحظات</Label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="ملاحظات إضافية (اختياري)"
                  />
                </div>

                {/* ملخص التوزيع */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                  <div className="text-center p-2 bg-background rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">المبلغ الكلي</div>
                    <div className="text-xl font-bold text-primary">{inputAmountNum.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">الموزع</div>
                    <div className={`text-xl font-bold ${totalAllocated > inputAmountNum ? 'text-destructive' : 'text-green-600'}`}>
                      {totalAllocated.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">المتبقي</div>
                    <div className={`text-xl font-bold ${remainingToAllocate < 0 ? 'text-destructive' : remainingToAllocate > 0.01 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {remainingToAllocate.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* زر التوزيع التلقائي */}
                <Button
                  onClick={handleAutoDistribute}
                  variant="outline"
                  className="w-full border-primary hover:bg-primary hover:text-primary-foreground"
                  disabled={!totalAmount || items.filter(i => i.selected).length === 0}
                >
                  <Sparkles className="h-4 w-4 ml-2" />
                  توزيع تلقائي ذكي
                </Button>

                {items.filter(i => i.selected).length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    <span>اختر العناصر أولاً ثم اضغط على التوزيع التلقائي</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الأقسام */}
            <Tabs defaultValue="contracts" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted">
                <TabsTrigger value="contracts" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span>العقود</span>
                  <Badge variant="secondary">{contracts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="printed" className="gap-2">
                  <PrinterIcon className="h-4 w-4" />
                  <span>فواتير الطباعة</span>
                  <Badge variant="secondary">{printedInvoices.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>فواتير المبيعات</span>
                  <Badge variant="secondary">{salesInvoices.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {contracts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد عقود مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({contracts.length} عقد)
                    </div>
                    {contracts.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="printed" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {printedInvoices.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <PrinterIcon className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد فواتير طباعة مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({printedInvoices.length} فاتورة)
                    </div>
                    {printedInvoices.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {salesInvoices.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <ShoppingCart className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="text-lg">لا توجد فواتير مبيعات مستحقة</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                      مرتبة من الأصغر إلى الأكبر ({salesInvoices.length} فاتورة)
                    </div>
                    {salesInvoices.map((item, idx) => (
                      <ItemCard 
                        key={item.id} 
                        item={item}
                        index={idx}
                        onSelect={handleSelectItemById}
                        onAmountChange={handleAmountChangeById}
                      />
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={distributing}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={distributing || items.filter(i => i.selected && i.allocatedAmount > 0).length === 0 || Math.abs(remainingToAllocate) > 0.01}
            className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary"
          >
            {distributing ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري التوزيع...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 ml-2" />
                تأكيد التوزيع
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
