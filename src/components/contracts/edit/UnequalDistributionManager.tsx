import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface UnequalPayment {
  amount: number;
  dueDate: string;
  description: string;
  paymentType: string;
}

interface UnequalDistributionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalTotal: number;
  startDate: string;
  count: number;
  onApply: (payments: UnequalPayment[]) => void;
}

export function UnequalDistributionManager({
  open,
  onOpenChange,
  finalTotal,
  startDate,
  count,
  onApply
}: UnequalDistributionManagerProps) {
  const [payments, setPayments] = useState<UnequalPayment[]>(
    Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      dueDate: '',
      description: i === 0 ? 'الدفعة الأولى' : `الدفعة ${i + 1}`,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري'
    }))
  );

  // Calculate due dates
  const calculateDueDate = (index: number): string => {
    if (!startDate) return '';
    const date = new Date(startDate);
    
    if (index === 0) {
      return startDate;
    }
    
    date.setMonth(date.getMonth() + index);
    return date.toISOString().split('T')[0];
  };

  const totalAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const difference = finalTotal - totalAmount;
  const isValid = Math.abs(difference) < 0.01;

  const handlePaymentChange = (index: number, field: string, value: any) => {
    const newPayments = [...payments];
    if (field === 'amount') {
      newPayments[index].amount = parseFloat(value) || 0;
    } else if (field === 'dueDate') {
      newPayments[index].dueDate = value;
    } else if (field === 'description') {
      newPayments[index].description = value;
    }
    setPayments(newPayments);
  };

  const handleAutoFillDates = () => {
    const newPayments = payments.map((p, i) => ({
      ...p,
      dueDate: calculateDueDate(i)
    }));
    setPayments(newPayments);
  };

  const handleAutoDistribute = () => {
    if (totalAmount === 0) return;
    
    // حساب النسبة المئوية لكل دفعة
    const newPayments = payments.map(p => ({
      ...p,
      amount: Math.round((p.amount / totalAmount) * finalTotal * 100) / 100
    }));
    
    // تصحيح آخر دفعة لضمان المجموع الصحيح
    const calculatedTotal = newPayments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(calculatedTotal - finalTotal) > 0.01) {
      newPayments[newPayments.length - 1].amount = finalTotal - (calculatedTotal - newPayments[newPayments.length - 1].amount);
    }
    
    setPayments(newPayments);
  };

  const handleApply = () => {
    if (!isValid) return;
    
    // تعيين التواريخ إذا كانت فارغة
    const finalPayments = payments.map((p, i) => ({
      ...p,
      dueDate: p.dueDate || calculateDueDate(i)
    }));
    
    onApply(finalPayments);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✏️ توزيع غير متساوي - أدخل كل دفعة يدويًا
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">إجمالي العقد</div>
                  <div className="text-xl font-bold text-primary">
                    {finalTotal.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">المدخل</div>
                  <div className={`text-xl font-bold ${totalAmount === finalTotal ? 'text-green-600' : 'text-orange-600'}`}>
                    {totalAmount.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">الفرق</div>
                  <div className={`text-xl font-bold ${isValid ? 'text-green-600' : 'text-destructive'}`}>
                    {difference.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          {isValid ? (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-600">✅ المجموع صحيح! يمكنك تطبيق التوزيع</span>
            </div>
          ) : (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-600">
                ⚠️ المجموع غير متطابق. الفرق: {Math.abs(difference).toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}

          {/* Helper Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoFillDates}
              className="text-xs"
            >
              📅 ملء التواريخ تلقائيًا
            </Button>
            {totalAmount > 0 && !isValid && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoDistribute}
                className="text-xs"
              >
                🔄 إعادة حساب النسب
              </Button>
            )}
          </div>

          {/* Payments List */}
          <div className="space-y-3">
            {payments.map((payment, index) => (
              <Card key={index} className="border-border bg-card">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      {/* Amount */}
                      <div>
                        <label className="text-xs font-bold text-muted-foreground block mb-1">
                          المبلغ
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payment.amount || ''}
                          onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="bg-background h-9 text-sm font-bold"
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="text-xs font-bold text-muted-foreground block mb-1">
                          تاريخ الاستحقاق
                        </label>
                        <Input
                          type="date"
                          value={payment.dueDate}
                          onChange={(e) => handlePaymentChange(index, 'dueDate', e.target.value)}
                          className="bg-background h-9 text-sm"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-xs font-bold text-muted-foreground block mb-1">
                          الوصف
                        </label>
                        <Input
                          type="text"
                          value={payment.description}
                          onChange={(e) => handlePaymentChange(index, 'description', e.target.value)}
                          placeholder="وصف الدفعة"
                          className="bg-background h-9 text-sm"
                        />
                      </div>

                      {/* Payment Type */}
                      <div>
                        <label className="text-xs font-bold text-muted-foreground block mb-1">
                          نوع السداد
                        </label>
                        <Input
                          type="text"
                          value={payment.paymentType}
                          onChange={(e) => handlePaymentChange(index, 'paymentType', e.target.value)}
                          placeholder="شهري"
                          className="bg-background h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Delete Button */}
                    {payments.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                        className="text-destructive hover:text-destructive/80 mt-6"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Payment Button */}
          {payments.length < 12 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newPayment = {
                  amount: 0,
                  dueDate: '',
                  description: `الدفعة ${payments.length + 1}`,
                  paymentType: 'شهري'
                };
                setPayments([...payments, newPayment]);
              }}
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة دفعة جديدة
            </Button>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isValid}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <CheckCircle className="h-4 w-4 ml-2" />
              تطبيق التوزيع
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
