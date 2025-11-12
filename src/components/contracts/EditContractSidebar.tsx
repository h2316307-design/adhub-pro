import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}

interface EditContractSidebarProps {
  formData: any;
  updateFormData: (updates: any) => void;
  installments: any[];
  installationCost: number;
  onSave: () => void;
  isSaving: boolean;
  totalRentCost: number;
}

export function EditContractSidebar({
  formData,
  updateFormData,
  installments,
  installationCost,
  onSave,
  isSaving,
  totalRentCost
}: EditContractSidebarProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pricingCategories] = useState<string[]>(['عادي', 'مسوق', 'شركات', 'المدينة']);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, phone, email, company')
          .order('name');

        if (!error && data) {
          setCustomers(data);
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      }
    };

    loadCustomers();
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      updateFormData({
        customerId: customer.id,
        customerName: customer.name
      });
    }
  };

  // Calculate totals
  const discountAmount = formData.discountType === 'percent' 
    ? (totalRentCost * formData.discountValue) / 100
    : formData.discountValue;

  const totalAfterDiscount = totalRentCost - discountAmount;
  const operatingFee = (totalAfterDiscount * formData.operatingFeeRate) / 100;
  const finalTotal = totalAfterDiscount + operatingFee + installationCost;

  const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const remainingAmount = finalTotal - totalInstallments;

  return (
    <div className="w-full lg:w-80 space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات العميل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="customer">العميل</Label>
            <Select
              value={formData.customerId || ''}
              onValueChange={handleCustomerSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.company && ` - ${customer.company}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="customerName">اسم العميل</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => updateFormData({ customerName: e.target.value })}
              placeholder="أدخل اسم العميل"
            />
          </div>
          <div>
            <Label htmlFor="adType">نوع الإعلان</Label>
            <Textarea
              id="adType"
              value={formData.adType}
              onChange={(e) => updateFormData({ adType: e.target.value })}
              placeholder="وصف نوع الإعلان"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contract Details */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل العقد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pricingCategory">فئة التسعير</Label>
            <Select
              value={formData.pricingCategory}
              onValueChange={(value) => updateFormData({ pricingCategory: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pricingCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate">تاريخ البداية</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => updateFormData({ startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">تاريخ النهاية</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => updateFormData({ endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pricingMode">نوع المدة</Label>
            <Select
              value={formData.pricingMode}
              onValueChange={(value) => updateFormData({ pricingMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="months">بالأشهر</SelectItem>
                <SelectItem value="days">بالأيام</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.pricingMode === 'months' ? (
            <div>
              <Label htmlFor="durationMonths">المدة (بالأشهر)</Label>
              <Input
                id="durationMonths"
                type="number"
                min="1"
                value={formData.durationMonths}
                onChange={(e) => updateFormData({ durationMonths: parseInt(e.target.value) || 1 })}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="durationDays">المدة (بالأيام)</Label>
              <Input
                id="durationDays"
                type="number"
                min="1"
                value={formData.durationDays}
                onChange={(e) => updateFormData({ durationDays: parseInt(e.target.value) || 1 })}
              />
            </div>
          )}

          <div>
            <Label htmlFor="discountType">نوع الخصم</Label>
            <Select
              value={formData.discountType}
              onValueChange={(value) => updateFormData({ discountType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">نسبة مئوية</SelectItem>
                <SelectItem value="amount">مبلغ ثابت</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="discountValue">
              قيمة الخصم {formData.discountType === 'percent' ? '(%)' : '(ريال)'}
            </Label>
            <Input
              id="discountValue"
              type="number"
              min="0"
              step="0.01"
              value={formData.discountValue}
              onChange={(e) => updateFormData({ discountValue: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label htmlFor="operatingFeeRate">نسبة رسوم التشغيل (%)</Label>
            <Input
              id="operatingFeeRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.operatingFeeRate}
              onChange={(e) => updateFormData({ operatingFeeRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص التكاليف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>تكلفة الإيجار:</span>
            <span>{totalRentCost.toLocaleString()} ريال</span>
          </div>
          
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>الخصم:</span>
              <span>-{discountAmount.toLocaleString()} ريال</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span>بعد الخصم:</span>
            <span>{totalAfterDiscount.toLocaleString()} ريال</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>رسوم التشغيل ({formData.operatingFeeRate}%):</span>
            <span>{operatingFee.toLocaleString()} ريال</span>
          </div>
          
          {installationCost > 0 && (
            <div className="flex justify-between text-sm">
              <span>تكلفة التركيب:</span>
              <span>{installationCost.toLocaleString()} ريال</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between font-semibold">
            <span>الإجمالي النهائي:</span>
            <span>{finalTotal.toLocaleString()} ريال</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between text-sm">
            <span>إجمالي الدفعات:</span>
            <span>{totalInstallments.toLocaleString()} ريال</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>المتبقي:</span>
            <Badge variant={remainingAmount === 0 ? 'default' : remainingAmount > 0 ? 'destructive' : 'secondary'}>
              {remainingAmount.toLocaleString()} ريال
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                حفظ التعديلات
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}