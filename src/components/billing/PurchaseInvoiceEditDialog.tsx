import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, X, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePurchaseInvoiceHTML } from '@/components/billing/InvoiceTemplates';

interface PurchaseItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  paid: boolean;
  notes: string | null;
}

interface PurchaseInvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  onSuccess: () => void;
}

export function PurchaseInvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess
}: PurchaseInvoiceEditDialogProps) {
  const [items, setItems] = useState<PurchaseItem[]>([
    { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      loadInvoiceItems();
      setNotes(invoice.notes || '');
    }
  }, [invoice]);

  const loadInvoiceItems = async () => {
    if (!invoice) return;

    try {
      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setItems(data.map((item: any) => ({
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })));
      }
    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast.error('فشل تحميل عناصر الفاتورة');
    }
  };

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

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!invoice) return;

    try {
      setIsSaving(true);

      const validItems = items.filter(item => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0);
      if (validItems.length === 0) {
        toast.error('يرجى إضافة عنصر واحد على الأقل');
        return;
      }

      const { data: updatedInvoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .update({
          total_amount: totalAmount,
          notes: notes || null
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);

      const { error: itemsError } = await supabase
        .from('purchase_invoice_items')
        .insert(
          validItems.map(item => ({
            invoice_id: invoice.id,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          }))
        );

      if (itemsError) throw itemsError;

      toast.success('تم تحديث فاتورة المشتريات بنجاح');

      if (shouldPrint) {
        handlePrint(updatedInvoice, validItems);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating purchase invoice:', error);
      toast.error('فشل تحديث فاتورة المشتريات');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (invoiceData: any, items: PurchaseItem[]) => {
    const data = {
      invoiceNumber: invoiceData.invoice_number,
      invoiceDate: invoiceData.invoice_date,
      customerName: invoiceData.customer_name,
      items: items.map(item => ({
        description: item.item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total_price
      })),
      totalAmount: totalAmount,
      notes: invoiceData.notes || undefined
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatePurchaseInvoiceHTML(data);
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            تعديل فاتورة مشتريات - {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* العناصر */}
          <div className="expenses-preview-item">
            <div className="flex justify-between items-center mb-3">
              <h3 className="expenses-preview-label">الأصناف</h3>
              <Button
                type="button"
                size="sm"
                onClick={addItem}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 ml-2" />
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
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="expenses-form-label block mb-2">اسم الصنف *</label>
                      <Input
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        placeholder="مثال: طباعة، تركيب، مواد..."
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>

                    <div>
                      <label className="expenses-form-label block mb-2">الكمية *</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value) || 1)}
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>

                    <div>
                      <label className="expenses-form-label block mb-2">سعر الوحدة *</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value) || 0)}
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

          {/* الملاحظات */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملاحظات (اختياري)</h3>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية (اختياري)"
              className="bg-input border-border text-card-foreground"
            />
          </div>

          {/* الملخص */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملخص الفاتورة:</h3>
            <div className="space-y-3 text-card-foreground">
              <div className="flex justify-between font-bold text-xl pt-2">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>
          </div>

          {/* الأزرار */}
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
              disabled={isSaving || totalAmount === 0}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              حفظ التعديلات
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving || totalAmount === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Printer className="h-4 w-4 ml-2" />
              حفظ وطباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
