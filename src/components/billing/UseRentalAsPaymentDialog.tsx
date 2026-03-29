import { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PrinterIcon, ArrowRightLeft, Building2 } from 'lucide-react';

interface UseRentalAsPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  rental: {
    id: string;
    billboard_id: number;
    friend_rental_cost: number;
    used_as_payment: number;
    billboards?: {
      Billboard_Name?: string;
    };
  };
  onSuccess: () => void;
}

interface PayableItem {
  id: string | number;
  type: 'contract' | 'printed_invoice' | 'sales_invoice';
  displayName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  selected: boolean;
  allocatedAmount: number;
}

// مكون العنصر خارج المكون الرئيسي لتجنب إعادة الرسم
const PayableItemRow = memo(({
  item,
  availableCredit,
  onSelect,
  onAmountChange
}: {
  item: PayableItem;
  availableCredit: number;
  onSelect: (selected: boolean) => void;
  onAmountChange: (value: string) => void;
}) => (
  <div className="border rounded-lg p-3 space-y-2">
    <div className="flex items-start gap-3">
      <Checkbox
        checked={item.selected}
        onCheckedChange={(checked) => onSelect(checked as boolean)}
      />
      <div className="flex-1">
        <div className="font-medium">{item.displayName}</div>
        <div className="text-sm text-muted-foreground">
          المستحق: {item.remainingAmount.toFixed(2)} د.ل
        </div>
      </div>
    </div>
    {item.selected && (
      <div>
        <Label>المبلغ المخصص</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max={Math.min(item.remainingAmount, availableCredit)}
          value={item.allocatedAmount || ''}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </div>
    )}
  </div>
));

export function UseRentalAsPaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  rental,
  onSuccess
}: UseRentalAsPaymentDialogProps) {
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const totalRentalCost = Number(rental.friend_rental_cost) || 0;
  const usedAsPayment = Number(rental.used_as_payment) || 0;
  const availableCredit = totalRentalCost - usedAsPayment;
  const billboardName = rental.billboards?.Billboard_Name || `لوحة ${rental.billboard_id}`;

  useEffect(() => {
    if (open) {
      loadPayableItems();
    }
  }, [open, customerId]);

  const loadPayableItems = async () => {
    setLoading(true);
    try {
      const payableItems: PayableItem[] = [];

      // جلب العقود
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, Total, "Total Paid", "Customer Name", "Ad Type"')
        .eq('customer_id', customerId);

      // جلب الدفعات لحساب المدفوع الفعلي
      const { data: payments } = await supabase
        .from('customer_payments')
        .select('contract_number, amount')
        .eq('customer_id', customerId);

      const paymentsByContract = (payments || []).reduce((acc: Record<number, number>, p) => {
        if (p.contract_number) {
          acc[p.contract_number] = (acc[p.contract_number] || 0) + Number(p.amount);
        }
        return acc;
      }, {});

      for (const contract of contracts || []) {
        const total = Number(contract.Total) || 0;
        const paid = paymentsByContract[contract.Contract_Number] || 0;
        const remaining = total - paid;
        if (remaining > 0) {
          payableItems.push({
            id: contract.Contract_Number,
            type: 'contract',
            displayName: `عقد ${contract.Contract_Number} - ${contract['Ad Type'] || contract['Customer Name'] || ''}`,
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            selected: false,
            allocatedAmount: 0
          });
        }
      }

      // جلب فواتير الطباعة
      const { data: printedInvoices } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId);

      for (const inv of printedInvoices || []) {
        const total = Number(inv.total_amount) || 0;
        const paid = Number(inv.paid_amount) || 0;
        const remaining = total - paid;
        if (remaining > 0) {
          payableItems.push({
            id: inv.id,
            type: 'printed_invoice',
            displayName: `فاتورة طباعة ${inv.invoice_number || inv.id}`,
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            selected: false,
            allocatedAmount: 0
          });
        }
      }

      // جلب فواتير المبيعات
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId);

      for (const inv of salesInvoices || []) {
        const total = Number(inv.total_amount) || 0;
        const paid = Number(inv.paid_amount) || 0;
        const remaining = total - paid;
        if (remaining > 0) {
          payableItems.push({
            id: inv.id,
            type: 'sales_invoice',
            displayName: `فاتورة مبيعات ${inv.invoice_number || inv.id}`,
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            selected: false,
            allocatedAmount: 0
          });
        }
      }

      setItems(payableItems);
    } catch (error) {
      console.error('Error loading payable items:', error);
      toast.error('فشل في تحميل البنود القابلة للسداد');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (index: number, selected: boolean) => {
    const newItems = [...items];
    newItems[index].selected = selected;
    if (!selected) {
      newItems[index].allocatedAmount = 0;
    }
    setItems(newItems);
  };

  const handleAmountChange = (index: number, value: string) => {
    const newItems = [...items];
    
    if (value === '') {
      newItems[index].allocatedAmount = 0;
      setItems(newItems);
      return;
    }
    
    const amount = parseFloat(value);
    if (!Number.isFinite(amount)) return;
    
    newItems[index].allocatedAmount = Math.min(amount, newItems[index].remainingAmount, availableCredit - totalAllocated + newItems[index].allocatedAmount);
    setItems(newItems);
  };

  const totalAllocated = items.reduce((sum, item) => sum + (item.selected ? item.allocatedAmount : 0), 0);
  const remainingCredit = availableCredit - totalAllocated;

  const handleApplyAsPayment = async () => {
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل');
      return;
    }

    if (totalAllocated > availableCredit) {
      toast.error('المبلغ المخصص أكبر من الرصيد المتاح');
      return;
    }

    setProcessing(true);
    try {
      for (const item of selectedItems) {
        // إنشاء دفعة من نوع مقايضة/خصم من الإيجار
        const paymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: item.allocatedAmount,
          paid_at: new Date().toISOString(),
          entry_type: 'payment',
          method: 'مقايضة إيجار',
          notes: `مقايضة من إيجار لوحة: ${billboardName}`
        };

        if (item.type === 'contract') {
          paymentData.contract_number = item.id;
        } else if (item.type === 'printed_invoice') {
          paymentData.printed_invoice_id = item.id;
        } else if (item.type === 'sales_invoice') {
          paymentData.sales_invoice_id = item.id;
        }

        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert(paymentData);

        if (paymentError) throw paymentError;

        // تحديث المبلغ المدفوع في العنصر المستهدف
        if (item.type === 'contract') {
          const { error: updateError } = await supabase
            .from('Contract')
            .update({
              'Total Paid': String(item.paidAmount + item.allocatedAmount)
            })
            .eq('Contract_Number', Number(item.id));
          if (updateError) throw updateError;
        } else if (item.type === 'printed_invoice') {
          const { error: updateError } = await supabase
            .from('printed_invoices')
            .update({
              paid_amount: item.paidAmount + item.allocatedAmount
            })
            .eq('id', String(item.id));
          if (updateError) throw updateError;
        } else if (item.type === 'sales_invoice') {
          const { error: updateError } = await supabase
            .from('sales_invoices')
            .update({
              paid_amount: item.paidAmount + item.allocatedAmount
            })
            .eq('id', String(item.id));
          if (updateError) throw updateError;
        }
      }

      // تحديث المبلغ المستخدم من الإيجار
      const { error: rentalUpdateError } = await supabase
        .from('friend_billboard_rentals')
        .update({
          used_as_payment: usedAsPayment + totalAllocated
        })
        .eq('id', rental.id);

      if (rentalUpdateError) throw rentalUpdateError;

      toast.success('تم استخدام إيجار اللوحة كدفعة بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error applying rental as payment:', error);
      toast.error('فشل في تطبيق الدفعة');
    } finally {
      setProcessing(false);
    }
  };

  const contracts = items.filter(i => i.type === 'contract');
  const printedInvoices = items.filter(i => i.type === 'printed_invoice');
  const salesInvoices = items.filter(i => i.type === 'sales_invoice');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            استخدام إيجار لوحة كدفعة - {customerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">إيجار اللوحة:</span>
                <span className="text-lg font-bold">{billboardName}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>إجمالي الإيجار:</span>
                <span className="font-medium">{totalRentalCost.toLocaleString()} د.ل</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>الرصيد المتاح:</span>
                <span className="text-lg font-bold text-amber-600">{availableCredit.toLocaleString()} د.ل</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>المخصص:</span>
                <span className={totalAllocated > availableCredit ? 'text-destructive' : ''}>{totalAllocated.toLocaleString()} د.ل</span>
              </div>
              <div className="flex justify-between items-center">
                <span>المتبقي:</span>
                <span className={remainingCredit < 0 ? 'text-destructive' : 'text-green-600'}>{remainingCredit.toLocaleString()} د.ل</span>
              </div>
            </div>

            <Tabs defaultValue="contracts">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contracts">
                  العقود ({contracts.length})
                </TabsTrigger>
                <TabsTrigger value="printed">
                  فواتير الطباعة ({printedInvoices.length})
                </TabsTrigger>
                <TabsTrigger value="sales">
                  فواتير المبيعات ({salesInvoices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="space-y-3 max-h-60 overflow-y-auto">
                {contracts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد عقود بها مبالغ مستحقة</p>
                ) : (
                  contracts.map((item, index) => (
                    <PayableItemRow
                      key={item.id}
                      item={item}
                      availableCredit={availableCredit}
                      onSelect={(selected) => handleSelectItem(items.indexOf(item), selected)}
                      onAmountChange={(value) => handleAmountChange(items.indexOf(item), value)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="printed" className="space-y-3 max-h-60 overflow-y-auto">
                {printedInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد فواتير طباعة بها مبالغ مستحقة</p>
                ) : (
                  printedInvoices.map((item) => (
                    <PayableItemRow
                      key={item.id}
                      item={item}
                      availableCredit={availableCredit}
                      onSelect={(selected) => handleSelectItem(items.indexOf(item), selected)}
                      onAmountChange={(value) => handleAmountChange(items.indexOf(item), value)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-3 max-h-60 overflow-y-auto">
                {salesInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد فواتير مبيعات بها مبالغ مستحقة</p>
                ) : (
                  salesInvoices.map((item) => (
                    <PayableItemRow
                      key={item.id}
                      item={item}
                      availableCredit={availableCredit}
                      onSelect={(selected) => handleSelectItem(items.indexOf(item), selected)}
                      onAmountChange={(value) => handleAmountChange(items.indexOf(item), value)}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleApplyAsPayment}
                disabled={processing || totalAllocated === 0 || totalAllocated > availableCredit}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                <ArrowRightLeft className="h-4 w-4" />
                تطبيق كدفعة ({totalAllocated.toLocaleString()} د.ل)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
