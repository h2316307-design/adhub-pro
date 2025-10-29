import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Info, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { ContractRow, PaymentRow } from "./BillingTypes";

interface DistributedPayment {
  contractNumber: number;
  amount: number;
}

interface DistributePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId?: string;
  contracts: ContractRow[];
  payments: PaymentRow[];
  onSave: (distributions: DistributedPayment[], paymentData: {
    method: string;
    reference: string;
    notes: string;
    date: string;
    distributedPaymentId: string; // ✅ إضافة المعرف المشترك
  }) => Promise<void>;
}

export function DistributePaymentDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
  contracts,
  payments,
  onSave,
}: DistributePaymentDialogProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [distributions, setDistributions] = useState<Map<number, number>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // حساب المدفوع لكل عقد
  const getContractPaid = (contractNumber: number | string) => {
    const contractNum = Number(contractNumber);
    return payments
      .filter((p) => Number(p.contract_number) === contractNum && p.entry_type === "receipt")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // العقود الغير مسددة بالكامل
  const unpaidContracts = useMemo(() => {
    return contracts
      .map((contract) => {
        const contractNumber = Number(contract.Contract_Number);
        const total = Number(contract.Total || 0);
        const paid = getContractPaid(contractNumber);
        const remaining = total - paid;
        return {
          ...contract,
          contractNumber,
          total,
          paid,
          remaining,
        };
      })
      .filter((c) => c.remaining > 0)
      .sort((a, b) => a.contractNumber - b.contractNumber);
  }, [contracts, payments]);

  // المبلغ الموزع
  const distributedAmount = useMemo(() => {
    return Array.from(distributions.values()).reduce((sum, amt) => sum + amt, 0);
  }, [distributions]);

  // المبلغ المتبقي من الدفعة
  const remainingAmount = useMemo(() => {
    const total = Number(totalAmount) || 0;
    return total - distributedAmount;
  }, [totalAmount, distributedAmount]);

  const handleContractToggle = (contractNumber: number) => {
    const contractNum = Number(contractNumber);
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractNum)) {
      newSelected.delete(contractNum);
      const newDistributions = new Map(distributions);
      newDistributions.delete(contractNum);
      setDistributions(newDistributions);
    } else {
      newSelected.add(contractNum);
    }
    setSelectedContracts(newSelected);
  };

  const handleDistributionChange = (contractNumber: number, value: string) => {
    const amount = Number(value) || 0;
    const newDistributions = new Map(distributions);
    if (amount > 0) {
      newDistributions.set(contractNumber, amount);
    } else {
      newDistributions.delete(contractNumber);
    }
    setDistributions(newDistributions);
  };

  const handleAutoDistribute = () => {
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error("يرجى إدخال المبلغ الإجمالي أولاً");
      return;
    }

    if (selectedContracts.size === 0) {
      toast.error("يرجى اختيار عقود أولاً");
      return;
    }

    const total = Number(totalAmount);
    const selectedContractsList = unpaidContracts.filter((c) =>
      selectedContracts.has(c.contractNumber)
    );

    const newDistributions = new Map<number, number>();
    let remaining = total;

    // توزيع تلقائي على العقود المختارة
    for (const contract of selectedContractsList) {
      if (remaining <= 0) break;
      const amountForContract = Math.min(remaining, contract.remaining);
      newDistributions.set(contract.contractNumber, amountForContract);
      remaining -= amountForContract;
    }

    setDistributions(newDistributions);
    toast.success("تم الت��زيع التلقائي بنجاح");
  };

  const handleSave = async () => {
    // التحقق من البيانات
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error("يرجى إدخال المبلغ الإجمالي");
      return;
    }

    if (selectedContracts.size === 0) {
      toast.error("يرجى اختيار عقد واحد على الأقل");
      return;
    }

    if (distributions.size === 0) {
      toast.error("يرجى توزيع المبلغ على العقود");
      return;
    }

    // التحقق من أن المبلغ الموزع يساوي الإجمالي
    if (Math.abs(remainingAmount) > 0.01) {
      toast.error(`يجب توزيع كامل المبلغ. المتبقي: ${remainingAmount.toFixed(2)} د.ل`);
      return;
    }

    // التحقق من أن كل عقد مختار لديه توزيع
    for (const contractNumber of selectedContracts) {
      if (!distributions.has(contractNumber) || distributions.get(contractNumber)! <= 0) {
        toast.error(`يرجى إدخال مبلغ للعقد رقم ${contractNumber}`);
        return;
      }
    }

    setSaving(true);
    try {
      const distributionsList: DistributedPayment[] = Array.from(distributions.entries()).map(
        ([contractNumber, amount]) => ({
          contractNumber,
          amount,
        })
      );

      // ✅ إنشاء معرف فريد للدفعة الموزعة
      const distributedPaymentId = `DIST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await onSave(distributionsList, {
        method: paymentMethod,
        reference: paymentReference,
        notes: paymentNotes,
        date: paymentDate,
        distributedPaymentId, // ✅ تمرير المعرف المشترك
      });

      // إعادة تعيين النموذج
      setTotalAmount("");
      setSelectedContracts(new Set());
      setDistributions(new Map());
      setPaymentMethod("نقدي");
      setPaymentReference("");
      setPaymentNotes("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      
      onOpenChange(false);
      toast.success("تم حفظ الدفعة الموزعة بنجاح");
    } catch (error) {
      console.error("Error saving distributed payment:", error);
      toast.error("فشل حفظ الدفعة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-primary text-xl font-bold">
            توزيع دفعة على عقود متعددة
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            العميل: <span className="font-semibold text-foreground">{customerName}</span>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* معلومات الدفعة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-accent/10 rounded-lg border border-border">
            <div className="space-y-2">
              <Label htmlFor="total-amount" className="text-foreground font-semibold">
                المبلغ الإجمالي للدفعة (د.ل)
              </Label>
              <Input
                id="total-amount"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="bg-input border-border text-foreground text-lg font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method" className="text-foreground font-semibold">
                طريقة الدفع
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method" className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-reference" className="text-foreground">
                رقم المرجع (اختياري)
              </Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="رقم الشيك أو التحويل"
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date" className="text-foreground">
                تاريخ الدفع
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment-notes" className="text-foreground">
                ملاحظات (اختياري)
              </Label>
              <Textarea
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية"
                rows={2}
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>

          {/* ملخص التوزيع */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
              <div className="text-2xl font-bold text-primary">
                {Number(totalAmount || 0).toLocaleString("ar-LY")} د.ل
              </div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-sm text-muted-foreground mb-1">الموزع</div>
              <div className="text-2xl font-bold text-green-400">
                {distributedAmount.toLocaleString("ar-LY")} د.ل
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                Math.abs(remainingAmount) < 0.01
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
              }`}
            >
              <div className="text-sm text-muted-foreground mb-1">المتبقي</div>
              <div
                className={`text-2xl font-bold ${
                  Math.abs(remainingAmount) < 0.01 ? "text-green-400" : "text-yellow-400"
                }`}
              >
                {remainingAmount.toLocaleString("ar-LY")} د.ل
              </div>
            </div>
          </div>

          {/* أزرار ��لإجراءات */}
          <div className="flex gap-2 justify-end">
            <Button
              onClick={handleAutoDistribute}
              variant="outline"
              disabled={!totalAmount || selectedContracts.size === 0}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              توزيع تلقائي
            </Button>
          </div>

          {/* العقود الغير مسددة */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                العقود الغير مسددة ({unpaidContracts.length})
              </h3>
            </div>

            {unpaidContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>جميع العقود مسددة بالكامل</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto border border-border rounded-lg p-4">
                {unpaidContracts.map((contract) => {
                  const isSelected = selectedContracts.has(contract.contractNumber);
                  const distribution = distributions.get(contract.contractNumber) || 0;
                  const remainingAfterDistribution = contract.remaining - distribution;

                  return (
                    <div
                      key={contract.contractNumber}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-accent/20"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`contract-${contract.contractNumber}`}
                          checked={isSelected}
                          onCheckedChange={() => handleContractToggle(contract.contractNumber)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <label
                              htmlFor={`contract-${contract.contractNumber}`}
                              className="cursor-pointer"
                            >
                              <div className="font-semibold text-foreground">
                                عقد رقم {contract.contractNumber}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {contract["Ad Type"]}
                              </div>
                            </label>
                            <Badge variant="outline" className="text-xs">
                              {new Date(contract["Contract Date"]).toLocaleDateString("ar-LY")}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">الإجمالي: </span>
                              <span className="font-semibold text-foreground">
                                {contract.total.toLocaleString("ar-LY")} د.ل
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">المدفوع: </span>
                              <span className="font-semibold text-green-400">
                                {contract.paid.toLocaleString("ar-LY")} د.ل
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">المتبقي: </span>
                              <span className="font-semibold text-red-400">
                                {contract.remaining.toLocaleString("ar-LY")} د.ل
                              </span>
                            </div>
                          </div>

                          {contract.paid > 0 && (
                            <div className="pt-2 border-t border-border">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                contract.remaining === 0
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {contract.remaining === 0
                                  ? `مدفوع بالكامل (100%)`
                                  : `مدفوع جزئياً (${Math.round((contract.paid / contract.total) * 100)}%)`
                                }
                              </span>
                            </div>
                          )}

                          {isSelected && (
                            <div className="space-y-2 pt-2 border-t border-border">
                              <Label
                                htmlFor={`amount-${contract.contractNumber}`}
                                className="text-sm font-medium text-foreground"
                              >
                                المبلغ المدفوع لهذا العقد:
                              </Label>
                              <Input
                                id={`amount-${contract.contractNumber}`}
                                type="number"
                                min="0"
                                max={contract.remaining}
                                step="0.01"
                                value={distribution || ""}
                                onChange={(e) =>
                                  handleDistributionChange(
                                    contract.contractNumber,
                                    e.target.value
                                  )
                                }
                                placeholder={`0.00 - ${contract.remaining.toFixed(2)}`}
                                className="bg-input border-border text-foreground font-bold"
                              />
                              {distribution > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Info className="h-4 w-4 text-primary" />
                                  <span className="text-muted-foreground">
                                    المتبقي بعد الدفع:{" "}
                                  </span>
                                  <span
                                    className={`font-bold ${
                                      remainingAfterDistribution <= 0
                                        ? "text-green-400"
                                        : "text-yellow-400"
                                    }`}
                                  >
                                    {remainingAfterDistribution.toLocaleString("ar-LY")} د.ل
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !totalAmount ||
                selectedContracts.size === 0 ||
                Math.abs(remainingAmount) > 0.01
              }
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "جاري الحفظ..." : "حفظ الدفعة الموزعة"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
