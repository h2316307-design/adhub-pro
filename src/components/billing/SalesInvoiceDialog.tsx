import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, X, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateSalesInvoiceHTML } from '@/components/billing/InvoiceTemplates';

interface SalesItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SalesInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

export function SalesInvoiceDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess
}: SalesInvoiceDialogProps) {
  const [items, setItems] = useState<SalesItem[]>([
    { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error('يجب أن يحتوي على عنصر واحد على الأقل');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SalesItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  const handleSave = async (shouldPrint: boolean = false) => {
    try {
      setIsSaving(true);

      const validItems = items.filter(item => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0);
      if (validItems.length === 0) {
        toast.error('يرجى إضافة عنصر واحد على الأقل');
        return;
      }

      const invoiceNumber = `SALE-${Date.now()}`;

      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('sales_invoices')
        .insert({
          customer_id: customerId,
          customer_name: customerName,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          items: JSON.stringify(validItems),
          total_amount: totalAmount,
          paid_amount: 0,
          paid: false,
          notes: notes || null
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      await supabase
        .from('customer_payments')
        .insert({
          customer_id: customerId,
          amount: totalAmount,
          method: 'نقدي',
          paid_at: new Date().toISOString().split('T')[0],
          notes: `فاتورة مبيعات ${invoiceNumber}` + (notes ? ` - ${notes}` : ''),
          entry_type: 'sales_invoice'
        });

      toast.success('تم إنشاء فاتورة المبيعات بنجاح');

      if (shouldPrint) {
        printInvoice(invoice);
      }

      onOpenChange(false);
      onSuccess();
      
      setItems([{ item_name: '', quantity: 1, unit_price: 0, total_price: 0 }]);
      setNotes('');
    } catch (error) {
      console.error('Error saving sales invoice:', error);
      toast.error('فشل حفظ فاتورة المبيعات');
    } finally {
      setIsSaving(false);
    }
  };

  const printInvoice = (invoice: any) => {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    const invoiceData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      customerName: invoice.customer_name,
      items: items.map((item: SalesItem) => ({
        description: item.item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total_price
      })),
      totalAmount: invoice.total_amount,
      notes: invoice.notes || undefined
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generateSalesInvoiceHTML(invoiceData);
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            إنشاء فاتورة مبيعات - {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Items Table */}
          <div className="expenses-preview-item">
            <div className="flex justify-between items-center mb-3">
              <h3 className="expenses-preview-label">الأصناف</h3>
              <Button onClick={addItem} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 ml-1" />
                إضافة صنف
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-card-foreground text-lg">
                      صنف {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="expenses-form-label block mb-2">اسم الصنف</label>
                      <Input
                        placeholder="اسم الصنف"
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">الكمية</label>
                      <Input
                        type="number"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        min="1"
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">السعر</label>
                      <Input
                        type="number"
                        placeholder="السعر"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                    الإجمالي: <span className="expenses-amount-calculated font-bold">{item.total_price.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملاحظات (اختياري)</h3>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-input border-border text-card-foreground"
              placeholder="أضف ملاحظات إضافية"
            />
          </div>

          {/* Summary */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملخص الفاتورة:</h3>
            <div className="space-y-3 text-card-foreground">
              <div className="flex justify-between font-bold text-xl pt-2">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="expenses-actions justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              إلغاء
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              حفظ الفاتورة
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Printer className="h-4 w-4 ml-1" />
              حفظ وطباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
