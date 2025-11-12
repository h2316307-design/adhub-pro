import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface PrintedInvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  onSuccess: () => void;
}

export function PrintedInvoiceEditDialog({
  open,
  onOpenChange,
  invoiceId,
  onSuccess
}: PrintedInvoiceEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: '',
    printer_name: '',
    invoice_date: '',
    total_amount: '',
    printer_cost: '',
    notes: ''
  });

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoice();
    }
  }, [open, invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      setFormData({
        invoice_number: data.invoice_number || '',
        printer_name: data.printer_name || '',
        invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
        total_amount: data.total_amount?.toString() || '',
        printer_cost: data.printer_cost?.toString() || '',
        notes: data.notes || ''
      });
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('فشل في تحميل بيانات الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.printer_name || !formData.invoice_date) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('printed_invoices')
        .update({
          invoice_number: formData.invoice_number,
          printer_name: formData.printer_name,
          invoice_date: formData.invoice_date,
          total_amount: formData.total_amount ? Number(formData.total_amount) : null,
          printer_cost: formData.printer_cost ? Number(formData.printer_cost) : null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('تم تحديث الفاتورة بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('فشل في تحديث الفاتورة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل فاتورة الطباعة</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الفاتورة</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="رقم الفاتورة"
                />
              </div>

              <div className="space-y-2">
                <Label>اسم المطبعة <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.printer_name}
                  onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                  placeholder="اسم المطبعة"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الفاتورة <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>المبلغ الإجمالي (للعميل)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تكلفة المطبعة (سعر التكلفة)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.printer_cost}
                  onChange={(e) => setFormData({ ...formData, printer_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2 flex items-end">
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 w-full">
                  <p className="text-sm text-muted-foreground mb-1">الربح المتوقع</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {((Number(formData.total_amount) || 0) - (Number(formData.printer_cost) || 0)).toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              'حفظ التعديلات'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
