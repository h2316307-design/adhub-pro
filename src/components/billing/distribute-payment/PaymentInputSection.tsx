import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';

interface PaymentInputSectionProps {
  totalAmount: string;
  setTotalAmount: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentDate: string;
  setPaymentDate: (v: string) => void;
  paymentReference: string;
  setPaymentReference: (v: string) => void;
  paymentNotes: string;
  setPaymentNotes: (v: string) => void;
  sourceBank: string;
  setSourceBank: (v: string) => void;
  destinationBank: string;
  setDestinationBank: (v: string) => void;
  transferReference: string;
  setTransferReference: (v: string) => void;
}

export function PaymentInputSection({
  totalAmount, setTotalAmount,
  paymentMethod, setPaymentMethod,
  paymentDate, setPaymentDate,
  paymentReference, setPaymentReference,
  paymentNotes, setPaymentNotes,
  sourceBank, setSourceBank,
  destinationBank, setDestinationBank,
  transferReference, setTransferReference,
}: PaymentInputSectionProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          المبلغ الكلي <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="أدخل المبلغ"
            className="text-base font-semibold text-right h-10 pr-3 pl-10 bg-background/80"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
            د.ل
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">طريقة الدفع</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-9 bg-background/80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="نقدي">💵 نقدي</SelectItem>
              <SelectItem value="شيك">📝 شيك</SelectItem>
              <SelectItem value="تحويل بنكي">🏦 تحويل بنكي</SelectItem>
              <SelectItem value="بطاقة ائتمان">💳 بطاقة ائتمان</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">التاريخ</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="h-9 bg-background/80 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">المرجع / رقم الشيك</Label>
        <Input
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="اختياري"
          className="h-9 bg-background/80 text-xs"
        />
      </div>

      {paymentMethod === 'تحويل بنكي' && (
        <div className="space-y-2 p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">المصرف المحول منه</Label>
            <Input value={sourceBank} onChange={(e) => setSourceBank(e.target.value)} placeholder="مصرف الجمهورية" className="h-8 bg-background text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">المصرف المحول إليه</Label>
            <Input value={destinationBank} onChange={(e) => setDestinationBank(e.target.value)} placeholder="مصرف التجارة" className="h-8 bg-background text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">رقم العملية</Label>
            <Input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="رقم إيصال التحويل" className="h-8 bg-background text-xs" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">ملاحظات</Label>
        <Input
          value={paymentNotes}
          onChange={(e) => setPaymentNotes(e.target.value)}
          placeholder="اختياري"
          className="h-9 bg-background/80 text-xs"
        />
      </div>
    </div>
  );
}
