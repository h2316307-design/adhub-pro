import { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Percent, DollarSign } from 'lucide-react';

interface GeneralDiscount {
  id: string;
  customer_id: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  reason?: string;
  applied_date: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface GeneralDiscountsSectionProps {
  customerId: string | null;
  customerName: string;
  onDiscountChange?: () => void;
}

export default function GeneralDiscountsSection({ 
  customerId, 
  customerName,
  onDiscountChange 
}: GeneralDiscountsSectionProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [discounts, setDiscounts] = useState<GeneralDiscount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<GeneralDiscount | null>(null);
  
  // Form states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    if (customerId) {
      loadDiscounts();
    }
  }, [customerId]);

  const loadDiscounts = async () => {
    if (!customerId) return;

    try {
      const { data, error } = await supabase
        .from('customer_general_discounts')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscounts((data || []) as GeneralDiscount[]);
    } catch (error) {
      console.error('Error loading discounts:', error);
      toast.error('فشل تحميل الخصومات');
    }
  };

  const openAddDialog = () => {
    setEditingDiscount(null);
    setDiscountType('percentage');
    setDiscountValue('');
    setReason('');
    setAppliedDate(new Date().toISOString().slice(0, 10));
    setStatus('active');
    setDialogOpen(true);
  };

  const openEditDialog = (discount: GeneralDiscount) => {
    setEditingDiscount(discount);
    setDiscountType(discount.discount_type);
    setDiscountValue(String(discount.discount_value));
    setReason(discount.reason || '');
    setAppliedDate(discount.applied_date);
    setStatus(discount.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!customerId) {
      toast.error('معرف العميل مفقود');
      return;
    }

    if (!discountValue || Number(discountValue) <= 0) {
      toast.error('يرجى إدخال قيمة خصم صالحة');
      return;
    }

    try {
      const payload = {
        customer_id: customerId,
        discount_type: discountType,
        discount_value: Number(discountValue),
        reason: reason || null,
        applied_date: appliedDate,
        status: status,
      };

      if (editingDiscount) {
        const { error } = await supabase
          .from('customer_general_discounts')
          .update(payload)
          .eq('id', editingDiscount.id);

        if (error) throw error;
        toast.success('تم تحديث الخصم بنجاح');
      } else {
        const { error } = await supabase
          .from('customer_general_discounts')
          .insert(payload);

        if (error) throw error;
        toast.success('تم إضافة الخصم بنجاح');
      }

      setDialogOpen(false);
      loadDiscounts();
      if (onDiscountChange) onDiscountChange();
    } catch (error: any) {
      console.error('Error saving discount:', error);
      toast.error(`فشل حفظ الخصم: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const handleDelete = async (discountId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الخصم؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      const { error } = await supabase
        .from('customer_general_discounts')
        .delete()
        .eq('id', discountId);

      if (error) throw error;
      toast.success('تم حذف الخصم بنجاح');
      loadDiscounts();
      if (onDiscountChange) onDiscountChange();
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      toast.error(`فشل حذف الخصم: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const formatDiscount = (discount: GeneralDiscount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}%`;
    }
    return `${discount.discount_value.toLocaleString()} د.ل`;
  };

  const calculateTotalActiveDiscount = () => {
    const activeDiscounts = discounts.filter(d => d.status === 'active');
    const percentageTotal = activeDiscounts
      .filter(d => d.discount_type === 'percentage')
      .reduce((sum, d) => sum + d.discount_value, 0);
    const fixedTotal = activeDiscounts
      .filter(d => d.discount_type === 'fixed')
      .reduce((sum, d) => sum + d.discount_value, 0);

    return { percentageTotal, fixedTotal };
  };

  const { percentageTotal, fixedTotal } = calculateTotalActiveDiscount();

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5" />
                الخصومات
              </CardTitle>
              {/* إجمالي الخصومات */}
              {discounts.length > 0 && (percentageTotal > 0 || fixedTotal > 0) && (
                <div className="mt-2 flex gap-3 text-sm">
                  {percentageTotal > 0 && (
                    <div className="flex items-center gap-1 text-primary">
                      <Percent className="h-4 w-4" />
                      <span className="font-semibold">{percentageTotal}%</span>
                    </div>
                  )}
                  {fixedTotal > 0 && (
                    <div className="flex items-center gap-1 text-primary">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-semibold">{fixedTotal.toLocaleString()} د.ل</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 ml-2" />
              إضافة خصم
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {discounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد خصومات مضافة لهذا العميل</p>
            </div>
          ) : (
            <>
              {/* ملخص الخصومات النشطة */}
              {(percentageTotal > 0 || fixedTotal > 0) && (
                <div className="mb-4 p-4 bg-success/10 border border-success rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">إجمالي الخصومات النشطة:</h4>
                  <div className="flex gap-4 text-sm">
                    {percentageTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <Percent className="h-4 w-4" />
                        <span>{percentageTotal}% نسبة مئوية</span>
                      </div>
                    )}
                    {fixedTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>{fixedTotal.toLocaleString()} د.ل مبلغ ثابت</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* جدول الخصومات */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-right p-3 font-semibold">نوع الخصم</th>
                      <th className="text-right p-3 font-semibold">القيمة</th>
                      <th className="text-right p-3 font-semibold">السبب</th>
                      <th className="text-right p-3 font-semibold">تاريخ التطبيق</th>
                      <th className="text-right p-3 font-semibold">الحالة</th>
                      <th className="text-center p-3 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((discount) => (
                      <tr key={discount.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {discount.discount_type === 'percentage' ? (
                              <Percent className="h-4 w-4 text-primary" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-primary" />
                            )}
                            <span>
                              {discount.discount_type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold">{formatDiscount(discount)}</td>
                        <td className="p-3">{discount.reason || '-'}</td>
                        <td className="p-3">{new Date(discount.applied_date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-3">
                          <Badge variant={discount.status === 'active' ? 'default' : 'secondary'}>
                            {discount.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(discount)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(discount.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog لإضافة/تعديل الخصم */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingDiscount ? 'تعديل الخصم' : 'إضافة خصم جديد'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>نوع الخصم</Label>
              <Select value={discountType} onValueChange={(v: 'percentage' | 'fixed') => setDiscountType(v)}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                  <SelectItem value="fixed">مبلغ ثابت (د.ل)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>قيمة الخصم</Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '10' : '100'}
                className="text-right"
                min="0"
                step={discountType === 'percentage' ? '0.1' : '1'}
              />
            </div>

            <div>
              <Label>السبب (اختياري)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب منح الخصم..."
                className="text-right"
              />
            </div>

            <div>
              <Label>تاريخ التطبيق</Label>
              <Input
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="text-right"
              />
            </div>

            <div>
              <Label>الحالة</Label>
              <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave}>
                {editingDiscount ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}