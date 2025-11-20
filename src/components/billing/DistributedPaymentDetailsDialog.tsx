import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, FileText, Trash2, Edit, UserCheck } from "lucide-react";
import { PaymentRow } from "./BillingTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import IntermediaryReceiptPrintDialog from "./IntermediaryReceiptPrintDialog";

interface DistributedPaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  onPrintCombined: () => void;
  onPrintIndividual: (payment: PaymentRow) => void;
  onDelete: () => void;
  onEdit?: () => void;
  customerName: string;
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
  customerName,
}: DistributedPaymentDetailsDialogProps) {
  const [viaIntermediary, setViaIntermediary] = useState(false);
  const [collectorName, setCollectorName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [notes, setNotes] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [intermediaryPrintOpen, setIntermediaryPrintOpen] = useState(false);

  useEffect(() => {
    if (open && groupedPayments.length > 0) {
      const firstPayment = groupedPayments[0];
      setViaIntermediary(firstPayment.collected_via_intermediary || false);
      setCollectorName(firstPayment.collector_name || '');
      setReceiverName(firstPayment.receiver_name || '');
      setDeliveryLocation(firstPayment.delivery_location || '');
      setPaymentMethod(firstPayment.method || 'نقدي');
      setNotes(firstPayment.notes || '');
      setCollectionDate(firstPayment.collection_date || '');
    }
  }, [open, groupedPayments]);

  if (groupedPayments.length === 0) return null;

  const firstPayment = groupedPayments[0];
  const paymentDate = firstPayment.paid_at 
    ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') 
    : '—';

  const handleSaveIntermediaryData = async () => {
    setSaving(true);
    try {
      const distributedPaymentId = firstPayment.distributed_payment_id;
      if (!distributedPaymentId) {
        toast.error('معرف الدفعة غير موجود');
        setSaving(false);
        return;
      }

      if (!viaIntermediary) {
        // Clear intermediary data
        const { error } = await supabase
          .from('customer_payments')
          .update({
            collected_via_intermediary: false,
            collector_name: null,
            receiver_name: null,
            delivery_location: null,
            collection_date: null
          })
          .eq('distributed_payment_id', distributedPaymentId);

        if (error) throw error;
        toast.success('تم إلغاء تفعيل الوسيط بنجاح');
        setSaving(false);
        return;
      }

      // Validate
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('customer_payments')
        .update({
          collected_via_intermediary: true,
          collector_name: collectorName.trim(),
          receiver_name: receiverName.trim(),
          delivery_location: deliveryLocation.trim(),
          collection_date: collectionDate,
          method: paymentMethod,
          notes: notes.trim() || null
        })
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      toast.success('تم حفظ بيانات الوسيط بنجاح');
      
      // Reload the data to reflect changes
      window.location.reload();
    } catch (error: any) {
      console.error('Error saving intermediary data:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

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
          {/* ملخص المبلغ والعمولات */}
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
              <div className="text-3xl font-bold text-primary">
                {totalAmount.toLocaleString('ar-LY')} د.ل
              </div>
            </div>
            
            {/* عرض العمولات إذا كانت موجودة */}
            {firstPayment.collected_via_intermediary && (
              <div className="p-4 rounded-lg bg-muted/50 border border-muted space-y-2">
                <div className="font-semibold text-foreground mb-2">تفاصيل العمولات</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                    <span className="font-semibold">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  {firstPayment.intermediary_commission > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة الوسيط:</span>
                      <span className="font-semibold">-{(Number(firstPayment.intermediary_commission) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  {firstPayment.transfer_fee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة التحويل:</span>
                      <span className="font-semibold">-{(Number(firstPayment.transfer_fee) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-muted-foreground/20 text-base font-bold text-primary">
                    <span>الصافي:</span>
                    <span>
                      {(totalAmount - (Number(firstPayment.intermediary_commission) || 0) - (Number(firstPayment.transfer_fee) || 0)).toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>
                  {firstPayment.commission_notes && (
                    <div className="pt-2 border-t border-muted-foreground/20 mt-2">
                      <span className="text-muted-foreground">ملاحظات العمولات: </span>
                      <span className="text-foreground">{firstPayment.commission_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
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

          {/* قسم الوسيط المحصل */}
          <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                id="viaIntermediary"
                checked={viaIntermediary}
                onCheckedChange={(checked) => setViaIntermediary(checked as boolean)}
              />
              <Label htmlFor="viaIntermediary" className="text-base font-bold text-primary cursor-pointer flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                القبض عن طريق وسيط
              </Label>
            </div>

            {viaIntermediary && (
              <div className="space-y-4 mt-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collectorName" className="text-sm font-semibold">
                      المحصل (المستلم من الزبون) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="collectorName"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      placeholder="اسم المحصل"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiverName" className="text-sm font-semibold">
                      المسلم له (المدير) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="receiverName"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="اسم المستلم"
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryLocation" className="text-sm font-semibold">
                    مكان التسليم <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="deliveryLocation"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="مكان تسليم المبلغ"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionDate" className="text-sm font-semibold">
                    تاريخ القبض <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="collectionDate"
                    type="date"
                    value={collectionDate}
                    onChange={(e) => setCollectionDate(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod" className="text-sm font-semibold">
                      نوع الدفع
                    </Label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="نقدي">نقدي</option>
                      <option value="كاش">كاش</option>
                      <option value="شيك">شيك</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-semibold">
                      ملاحظات
                    </Label>
                    <Input
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="ملاحظات إضافية"
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveIntermediaryData}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {saving ? 'جاري الحفظ...' : 'حفظ بيانات الوسيط'}
                  </Button>
                  {viaIntermediary && collectorName && receiverName && deliveryLocation && (
                    <Button
                      onClick={() => setIntermediaryPrintOpen(true)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                      size="sm"
                    >
                      <Printer className="h-4 w-4" />
                      طباعة إيصال الوسيط
                    </Button>
                  )}
                </div>
              </div>
            )}
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

        {/* Dialog for Intermediary Receipt */}
        <IntermediaryReceiptPrintDialog
          open={intermediaryPrintOpen}
          onOpenChange={setIntermediaryPrintOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          customerName={customerName}
        />
      </DialogContent>
    </Dialog>
  );
}
