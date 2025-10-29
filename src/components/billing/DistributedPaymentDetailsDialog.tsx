import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileText, Trash2, Edit } from "lucide-react";
import { PaymentRow } from "./BillingTypes";

interface DistributedPaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  onPrintCombined: () => void;
  onPrintIndividual: (payment: PaymentRow) => void;
  onDelete: () => void;
  onEdit?: () => void;
}

export function DistributedPaymentDetailsDialog({
  open,
  onOpenChange,
  groupedPayments,
  totalAmount,
  onPrintCombined,
  onPrintIndividual,
  onDelete,
  onEdit,
}: DistributedPaymentDetailsDialogProps) {
  if (groupedPayments.length === 0) return null;

  const firstPayment = groupedPayments[0];
  const paymentDate = firstPayment.paid_at 
    ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') 
    : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold text-primary">
            تفاصيل الدفعة الموزعة
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <div>
              المعرف: <span className="font-semibold text-foreground">{firstPayment.distributed_payment_id}</span>
            </div>
            <div>
              التاريخ: <span className="font-semibold text-foreground">{paymentDate}</span>
            </div>
            <div>
              طريقة الدفع: <span className="font-semibold text-foreground">{firstPayment.method}</span>
            </div>
            {firstPayment.reference && (
              <div>
                المرجع: <span className="font-semibold text-foreground">{firstPayment.reference}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* ملخص المبلغ الإجمالي */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
            <div className="text-3xl font-bold text-primary">
              {totalAmount.toLocaleString('ar-LY')} د.ل
            </div>
          </div>

          {/* جدول العقود */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">المبلغ المدفوع</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-semibold text-lg">
                      عقد رقم {payment.contract_number}
                    </TableCell>
                    <TableCell className="font-bold text-green-600 text-lg">
                      {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPrintIndividual(payment)}
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال العقد
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* أزرار الطباعة والحذف والتعديل */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={onPrintCombined}
              className="flex-1 bg-primary hover:bg-primary/90 gap-2"
              size="lg"
            >
              <FileText className="h-5 w-5" />
              طباعة إيصال موحد لكل العقود
            </Button>
            {onEdit && (
              <Button
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                size="lg"
              >
                <Edit className="h-5 w-5" />
                تعديل الدفعة
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm(`هل أنت متأكد من حذف هذه الدفعة الموزعة على ${groupedPayments.length} عقود؟`)) {
                  onDelete();
                  onOpenChange(false);
                }
              }}
              className="gap-2"
              size="lg"
            >
              <Trash2 className="h-5 w-5" />
              حذف الدفعة
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              size="lg"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
