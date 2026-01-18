import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Trash2, Edit, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateSalesInvoiceHTML } from './InvoiceTemplates';
import { SalesInvoiceEditDialog } from './SalesInvoiceEditDialog';
import { SalesInvoicePaymentDialog } from './SalesInvoicePaymentDialog';

interface SalesItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SalesSectionProps {
  customerId: string;
  invoices: any[];
  onRefresh: () => void;
}

export function SalesSection({
  customerId,
  invoices,
  onRefresh
}: SalesSectionProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const toggleInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleAddPayment = (invoice: any) => {
    setSelectedForPayment(invoice);
    setPaymentDialogOpen(true);
  };

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;

    try {
      // حذف الدفعة المرتبطة أولاً
      await supabase
        .from('customer_payments')
        .delete()
        .eq('sales_invoice_id', invoiceId);

      // حذف الفاتورة
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    }
  };

  const handlePrint = async (invoice: any) => {
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

    const html = await generateSalesInvoiceHTML(invoiceData);
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <>
    <Card className="expenses-preview-card border-green-300 bg-green-50/20 mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="expenses-preview-title text-green-700">فواتير المبيعات ({invoices.length})</span>
          <div className="flex items-center gap-4">
            {selectedInvoices.size > 0 && (
              <span className="text-sm text-muted-foreground">
                تم اختيار {selectedInvoices.size} فاتورة
              </span>
            )}
            <Badge variant="default" className="text-lg bg-green-600">
              {invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0).toLocaleString('ar-LY')} د.ل
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length > 0 ? (
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow className="bg-green-600 text-primary-foreground">
                  <TableHead className="text-right text-primary-foreground w-12">
                    <Checkbox 
                      checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                      onCheckedChange={toggleAll}
                      className="border-primary-foreground"
                    />
                  </TableHead>
                  <TableHead className="text-right text-primary-foreground">رقم الفاتورة</TableHead>
                  <TableHead className="text-right text-primary-foreground">عنوان الفاتورة</TableHead>
                  <TableHead className="text-right text-primary-foreground">التاريخ</TableHead>
                  <TableHead className="text-right text-primary-foreground">المبلغ الإجمالي</TableHead>
                  <TableHead className="text-right text-primary-foreground">المدفوع</TableHead>
                  <TableHead className="text-right text-primary-foreground">المتبقي</TableHead>
                  <TableHead className="text-right text-primary-foreground">الحالة</TableHead>
                  <TableHead className="text-right text-primary-foreground">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice, idx) => {
                  const totalAmount = Number(invoice.total_amount) || 0;
                  const paidAmount = Number(invoice.paid_amount) || 0;
                  const remaining = totalAmount - paidAmount;
                  const isPaid = remaining <= 0.01;

                  return (
                    <TableRow key={invoice.id} className={idx % 2 === 0 ? 'bg-green-50/30' : 'bg-green-50/10'}>
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.has(invoice.id)}
                          onCheckedChange={() => toggleInvoice(invoice.id)}
                        />
                      </TableCell>
                      <TableCell className="font-bold">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-primary font-medium">
                        {invoice.invoice_name || '—'}
                      </TableCell>
                      <TableCell>
                        {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {totalAmount.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        {paidAmount.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {remaining.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <Badge variant="default" className="bg-green-600">مسددة</Badge>
                        ) : (
                          <Badge variant="destructive">غير مسددة</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {!isPaid && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAddPayment(invoice)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <DollarSign className="h-4 w-4 ml-1" />
                              سداد
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(invoice)}
                          >
                            <Edit className="h-4 w-4 ml-1" />
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(invoice)}
                          >
                            <Printer className="h-4 w-4 ml-1" />
                            طباعة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(invoice.id, invoice.invoice_number)}
                          >
                            <Trash2 className="h-4 w-4 ml-1" />
                            حذف
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="expenses-empty-state text-center py-8">لا توجد فواتير مبيعات</div>
        )}
      </CardContent>
    </Card>

    <SalesInvoiceEditDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      invoice={selectedInvoice}
      onSuccess={onRefresh}
    />

    <SalesInvoicePaymentDialog
      open={paymentDialogOpen}
      onOpenChange={setPaymentDialogOpen}
      invoice={selectedForPayment}
      customerId={customerId}
      onPaymentAdded={onRefresh}
    />
    </>
  );
}
