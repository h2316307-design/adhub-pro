import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Wrench } from 'lucide-react';

interface CostSummaryCardProps {
  estimatedTotal: number;
  rentCost: number;
  setRentCost: (cost: number) => void;
  setUserEditedRentCost: (edited: boolean) => void;
  discountType: 'percent' | 'amount';
  setDiscountType: (type: 'percent' | 'amount') => void;
  discountValue: number;
  setDiscountValue: (value: number) => void;
  baseTotal: number;
  discountAmount: number;
  finalTotal: number;
  installationCost: number;
  rentalCostOnly: number;
  operatingFee: number;
  currentContract: any;
  originalTotal: number;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function CostSummaryCard({
  estimatedTotal,
  rentCost,
  setRentCost,
  setUserEditedRentCost,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  baseTotal,
  discountAmount,
  finalTotal,
  installationCost,
  rentalCostOnly,
  operatingFee,
  currentContract,
  originalTotal,
  onSave,
  onCancel,
  saving
}: CostSummaryCardProps) {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <DollarSign className="h-5 w-5 text-primary" />
          التكلفة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          تقدير تلقائي حسب الفئة والمدة: 
          <span className="text-primary font-medium ml-1">
            {estimatedTotal.toLocaleString('ar-LY')} د.ل
          </span>
        </div>

        <Input
          type="number"
          value={rentCost}
          onChange={(e) => {
            setRentCost(Number(e.target.value));
            setUserEditedRentCost(true);
          }}
          placeholder="تكلفة قبل الخصم (تُحدّث تلقائياً)"
          className="bg-input border-border text-foreground"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium text-card-foreground mb-2 block">
              نوع الخصم
            </label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="نوع الخصم" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="percent">نسبة %</SelectItem>
                <SelectItem value="amount">قيمة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-card-foreground mb-2 block">
              قيمة الخصم
            </label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
              placeholder="0"
              className="bg-input border-border text-foreground"
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">الإجمالي قبل الخصم:</span>
            <span className="text-primary font-medium">{baseTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">الخصم:</span>
            <span className="text-destructive font-medium">{discountAmount.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span className="text-card-foreground">الإجمالي بعد الخصم:</span>
            <span className="text-primary">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          
          {installationCost > 0 && (
            <>
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-1 text-accent">
                  <Wrench className="h-4 w-4" />
                  تكلفة التركيب:
                </span>
                <span className="text-accent font-medium">{installationCost.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span className="text-card-foreground">سعر الإيجار فقط:</span>
                <span className="text-primary">{rentalCostOnly.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </>
          )}
          
          {operatingFee > 0 && (
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-blue-400">
                <DollarSign className="h-4 w-4" />
                رسوم التشغيل (يُحفظ في fee):
              </span>
              <span className="text-blue-400 font-medium">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">المدفوع:</span>
            <span className="text-green-400 font-medium">
              {(currentContract?.['Total Paid'] || 0).toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">المتبقي:</span>
            <span className="text-destructive font-medium">
              {(finalTotal - (currentContract?.['Total Paid'] || 0)).toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">السابق:</span>
            <span className="text-primary font-medium">{originalTotal.toLocaleString('ar-LY')} د.ل</span>
            <span className="text-blue-400 font-medium">
              • الفرق: {(finalTotal - originalTotal).toLocaleString('ar-LY')} د.ل
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Button 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
            onClick={onSave} 
            disabled={saving}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Button 
            variant="outline" 
            className="w-full border-border hover:bg-accent" 
            onClick={onCancel}
          >
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}