import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, DollarSign, Trash2, Edit, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseInvoicePaymentDialog } from './PurchaseInvoicePaymentDialog';
import { PurchaseInvoiceEditDialog } from './PurchaseInvoiceEditDialog';
import { EnhancedDistributePaymentDialog } from './EnhancedDistributePaymentDialog';
import { generatePurchaseInvoiceHTML } from './InvoiceTemplates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  paid?: boolean;
  locked?: boolean;
  invoice_name: string | null;
  notes: string | null;
  used_as_payment?: number;
}

interface PurchaseInvoicesSectionProps {
  customerId: string;
  customerName: string;
  invoices: PurchaseInvoice[];
  onRefresh: () => void;
}

export function PurchaseInvoicesSection({
  customerId,
  customerName,
  invoices,
  onRefresh
}: PurchaseInvoicesSectionProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [useAsPaymentDialogOpen, setUseAsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const handleAddPayment = (invoice: PurchaseInvoice) => {
    if (invoice.locked) {
      toast.error('لا يمكن إضافة دفعات لفاتورة مسددة بالكامل');
      return;
    }
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleUseAsPayment = (invoice: PurchaseInvoice) => {
    const availableCredit = Number(invoice.total_amount) - Number(invoice.used_as_payment || 0);
    if (availableCredit <= 0) {
      toast.error('لا يوجد رصيد متاح لاستخدامه كدفعة');
      return;
    }
    const completeInvoice: PurchaseInvoice = {
      ...invoice,
      customer_id: invoice.customer_id || customerId,
      customer_name: invoice.customer_name || customerName,
    };
    setSelectedInvoice(completeInvoice);
    setUseAsPaymentDialogOpen(true);
  };

  const handlePrint = async (invoice: PurchaseInvoice) => {
    try {
      const { data: items, error } = await supabase
        .from('purchase_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        customerName: invoice.customer_name,
        invoiceName: invoice.invoice_name || 'فاتورة مشتريات',
        items: (items || []).map((item: any) => ({
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

      const html = await generatePurchaseInvoiceHTML(invoiceData);
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error('Error printing invoice:', error);
      toast.error('فشل طباعة الفاتورة');
    }
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceToDelete.id);

      if (error) throw error;

      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  if (invoices.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {invoices.map((invoice) => {
          const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount);
          const usedAsPayment = Number(invoice.used_as_payment || 0);
          const availableCredit = Number(invoice.total_amount) - usedAsPayment;
          
          return (
            <div
              key={invoice.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-foreground">{invoice.invoice_number}</span>
                  {invoice.invoice_name && (
                    <span className="text-primary font-semibold">- {invoice.invoice_name}</span>
                  )}
                  <Badge
                    variant={invoice.paid ? 'default' : remaining > 0 ? 'destructive' : 'secondary'}
                    className={invoice.paid ? 'bg-green-600 text-white' : remaining > 0 ? 'bg-red-600 text-white' : ''}
                  >
                    {invoice.paid ? 'مسددة' : remaining > 0 ? 'غير مسددة' : 'جزئي'}
                  </Badge>
                  {invoice.locked && (
                    <Badge variant="outline" className="border-primary/50 text-primary">مقفلة</Badge>
                  )}
                  {usedAsPayment > 0 && (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      مستخدمة كدفعة: {usedAsPayment.toLocaleString('ar-LY')} د.ل
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    التاريخ: <span className="text-foreground">{new Date(invoice.invoice_date).toLocaleDateString('ar-LY')}</span>
                  </div>
                  <div className="text-muted-foreground">
                    الإجمالي: <span className="font-semibold text-foreground">{Number(invoice.total_amount).toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  <div className="text-muted-foreground">
                    المتبقي: <span className="font-semibold text-destructive">{remaining.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  {usedAsPayment > 0 && (
                    <div className="text-muted-foreground">
                      الرصيد المتاح: <span className="font-semibold text-green-600">{availableCredit.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                </div>

                {invoice.notes && (
                  <div className="text-xs text-muted-foreground">ملاحظات: {invoice.notes}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handlePrint(invoice)} className="border-border text-foreground hover:bg-muted">
                  <Printer className="h-4 w-4 ml-2" />طباعة
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(invoice)} className="border-primary/50 text-primary hover:bg-primary/10">
                  <Edit className="h-4 w-4 ml-2" />تعديل
                </Button>
                {availableCredit > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handleUseAsPayment(invoice)} className="border-purple-500 text-purple-600 hover:bg-purple-50">
                    <ArrowRightLeft className="h-4 w-4 ml-2" />استخدام كدفعة
                  </Button>
                )}
                {!invoice.locked && remaining > 0 && (
                  <Button size="sm" onClick={() => handleAddPayment(invoice)} className="bg-green-600 text-white hover:bg-green-700">
                    <DollarSign className="h-4 w-4 ml-2" />سداد
                  </Button>
                )}
                {!invoice.locked && (
                  <Button size="sm" variant="destructive" onClick={() => { setInvoiceToDelete(invoice); setDeleteDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PurchaseInvoicePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        customerId={customerId}
        onPaymentAdded={onRefresh}
      />

      <PurchaseInvoiceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        invoice={selectedInvoice}
        onSuccess={onRefresh}
      />

      {selectedInvoice && (
        <EnhancedDistributePaymentDialog
          open={useAsPaymentDialogOpen}
          onOpenChange={setUseAsPaymentDialogOpen}
          customerId={customerId}
          customerName={customerName}
          purchaseInvoice={{
            id: selectedInvoice.id,
            invoice_number: selectedInvoice.invoice_number,
            total_amount: selectedInvoice.total_amount,
            used_as_payment: selectedInvoice.used_as_payment || 0
          }}
          onSuccess={onRefresh}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
