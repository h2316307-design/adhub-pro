/**
 * CostAllocationSection - نظام توزيع التكاليف بين الأطراف
 * يسمح بتوزيع تكلفة كل خدمة (طباعة/مجسمات/تركيب) على الزبون والشركة والمطبعة
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Users, Printer, Scissors, Wrench, Percent, DollarSign, 
  AlertTriangle, ArrowLeftRight 
} from 'lucide-react';

export interface ServiceAllocation {
  enabled: boolean;
  mode: 'percentage' | 'amount'; // نسبة أو مبلغ
  customer_pct: number;
  company_pct: number;
  printer_pct: number;
  customer_amount: number;
  company_amount: number;
  printer_amount: number;
  reason: string;
  // تخفيض خاص بالخدمة
  discount: number;
  discount_reason: string;
}

export interface CostAllocationData {
  print: ServiceAllocation;
  cutout: ServiceAllocation;
  installation: ServiceAllocation;
}

const defaultServiceAllocation = (): ServiceAllocation => ({
  enabled: false,
  mode: 'percentage',
  customer_pct: 100,
  company_pct: 0,
  printer_pct: 0,
  customer_amount: 0,
  company_amount: 0,
  printer_amount: 0,
  reason: '',
  discount: 0,
  discount_reason: '',
});

export const createDefaultCostAllocation = (): CostAllocationData => ({
  print: defaultServiceAllocation(),
  cutout: defaultServiceAllocation(),
  installation: defaultServiceAllocation(),
});

interface CostAllocationSectionProps {
  allocation: CostAllocationData;
  onChange: (allocation: CostAllocationData) => void;
  hasPrint: boolean;
  hasCutout: boolean;
  hasInstallation: boolean;
  // التكاليف الأصلية لحساب المبالغ من النسب
  originalCosts: {
    customerPrint: number;
    companyPrint: number;
    customerCutout: number;
    companyCutout: number;
    customerInstallation: number;
    companyInstallation: number;
  };
}

interface ServiceAllocationCardProps {
  service: 'print' | 'cutout' | 'installation';
  label: string;
  icon: React.ReactNode;
  color: string;
  allocation: ServiceAllocation;
  onChange: (alloc: ServiceAllocation) => void;
  totalCost: number; // إجمالي تكلفة الزبون للخدمة
  showPrinter: boolean; // هل يوجد مطبعة (الطباعة والمجسمات فقط)
}

function ServiceAllocationCard({
  service,
  label,
  icon,
  color,
  allocation,
  onChange,
  totalCost,
  showPrinter,
}: ServiceAllocationCardProps) {
  const handlePctChange = (field: 'customer_pct' | 'company_pct' | 'printer_pct', value: number) => {
    const newAlloc = { ...allocation, [field]: Math.max(0, Math.min(100, value)) };
    
    // حساب المبالغ من النسب
    const total = totalCost;
    newAlloc.customer_amount = Math.round((newAlloc.customer_pct / 100) * total * 100) / 100;
    newAlloc.company_amount = Math.round((newAlloc.company_pct / 100) * total * 100) / 100;
    newAlloc.printer_amount = Math.round((newAlloc.printer_pct / 100) * total * 100) / 100;
    
    onChange(newAlloc);
  };

  const handleAmountChange = (field: 'customer_amount' | 'company_amount' | 'printer_amount', value: number) => {
    const newAlloc = { ...allocation, [field]: Math.max(0, value) };
    
    // حساب النسب من المبالغ
    const total = totalCost;
    if (total > 0) {
      newAlloc.customer_pct = Math.round((newAlloc.customer_amount / total) * 100 * 10) / 10;
      newAlloc.company_pct = Math.round((newAlloc.company_amount / total) * 100 * 10) / 10;
      newAlloc.printer_pct = Math.round((newAlloc.printer_amount / total) * 100 * 10) / 10;
    }
    
    onChange(newAlloc);
  };

  const totalPct = allocation.customer_pct + allocation.company_pct + allocation.printer_pct;
  const totalAllocated = allocation.customer_amount + allocation.company_amount + allocation.printer_amount;
  const isBalanced = allocation.mode === 'percentage' 
    ? Math.abs(totalPct - 100) < 0.1 
    : Math.abs(totalAllocated - totalCost) < 0.1;

  // التحقق التلقائي عند تغيير الإجمالي
  useEffect(() => {
    if (allocation.enabled && allocation.mode === 'percentage') {
      const newAlloc = { ...allocation };
      newAlloc.customer_amount = Math.round((newAlloc.customer_pct / 100) * totalCost * 100) / 100;
      newAlloc.company_amount = Math.round((newAlloc.company_pct / 100) * totalCost * 100) / 100;
      newAlloc.printer_amount = Math.round((newAlloc.printer_pct / 100) * totalCost * 100) / 100;
      onChange(newAlloc);
    }
  }, [totalCost]);

  return (
    <Card className={cn("border", allocation.enabled ? `border-${color}-200 dark:border-${color}-800` : "opacity-60")}>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {label}
            {totalCost > 0 && (
              <Badge variant="outline" className="text-xs">
                {totalCost.toLocaleString('ar-LY')} د.ل
              </Badge>
            )}
          </CardTitle>
          <Switch
            checked={allocation.enabled}
            onCheckedChange={(checked) => onChange({ ...allocation, enabled: checked })}
          />
        </div>
      </CardHeader>
      
      {allocation.enabled && (
        <CardContent className="py-2 px-3 space-y-3">
          {/* اختيار الوضع */}
          <div className="flex items-center gap-2">
            <Select
              value={allocation.mode}
              onValueChange={(v: 'percentage' | 'amount') => onChange({ ...allocation, mode: v })}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> نسبة %</span>
                </SelectItem>
                <SelectItem value="amount">
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> مبلغ</span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {!isBalanced && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                {allocation.mode === 'percentage' 
                  ? `المجموع ${totalPct.toFixed(1)}% ≠ 100%`
                  : `المجموع ${totalAllocated.toLocaleString()} ≠ ${totalCost.toLocaleString()}`
                }
              </Badge>
            )}
            {isBalanced && allocation.enabled && (
              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                ✓ متوازن
              </Badge>
            )}
          </div>

          {/* حقول التوزيع */}
          <div className={cn("grid gap-2", showPrinter ? "grid-cols-3" : "grid-cols-2")}>
            {/* الزبون */}
            <div className="space-y-1">
              <Label className="text-xs text-green-700 flex items-center gap-1">
                <Users className="h-3 w-3" /> الزبون
              </Label>
              {allocation.mode === 'percentage' ? (
                <div className="relative">
                  <Input
                    type="number"
                    value={allocation.customer_pct}
                    onChange={(e) => handlePctChange('customer_pct', Number(e.target.value) || 0)}
                    className="h-7 text-xs pl-7"
                    min="0"
                    max="100"
                    step="5"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              ) : (
                <Input
                  type="number"
                  value={allocation.customer_amount}
                  onChange={(e) => handleAmountChange('customer_amount', Number(e.target.value) || 0)}
                  className="h-7 text-xs"
                  min="0"
                />
              )}
              {allocation.mode === 'percentage' && (
                <div className="text-[10px] text-green-600">{allocation.customer_amount.toLocaleString('ar-LY')} د.ل</div>
              )}
            </div>

            {/* الشركة */}
            <div className="space-y-1">
              <Label className="text-xs text-blue-700 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> الشركة
              </Label>
              {allocation.mode === 'percentage' ? (
                <div className="relative">
                  <Input
                    type="number"
                    value={allocation.company_pct}
                    onChange={(e) => handlePctChange('company_pct', Number(e.target.value) || 0)}
                    className="h-7 text-xs pl-7"
                    min="0"
                    max="100"
                    step="5"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              ) : (
                <Input
                  type="number"
                  value={allocation.company_amount}
                  onChange={(e) => handleAmountChange('company_amount', Number(e.target.value) || 0)}
                  className="h-7 text-xs"
                  min="0"
                />
              )}
              {allocation.mode === 'percentage' && (
                <div className="text-[10px] text-blue-600">{allocation.company_amount.toLocaleString('ar-LY')} د.ل</div>
              )}
            </div>

            {/* المطبعة */}
            {showPrinter && (
              <div className="space-y-1">
                <Label className="text-xs text-purple-700 flex items-center gap-1">
                  <Printer className="h-3 w-3" /> المطبعة
                </Label>
                {allocation.mode === 'percentage' ? (
                  <div className="relative">
                    <Input
                      type="number"
                      value={allocation.printer_pct}
                      onChange={(e) => handlePctChange('printer_pct', Number(e.target.value) || 0)}
                      className="h-7 text-xs pl-7"
                      min="0"
                      max="100"
                      step="5"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={allocation.printer_amount}
                    onChange={(e) => handleAmountChange('printer_amount', Number(e.target.value) || 0)}
                    className="h-7 text-xs"
                    min="0"
                  />
                )}
                {allocation.mode === 'percentage' && (
                  <div className="text-[10px] text-purple-600">{allocation.printer_amount.toLocaleString('ar-LY')} د.ل</div>
                )}
              </div>
            )}
          </div>

          {/* سبب التوزيع */}
          <Input
            value={allocation.reason}
            onChange={(e) => onChange({ ...allocation, reason: e.target.value })}
            placeholder="سبب التوزيع (اختياري)..."
            className="h-7 text-xs"
          />

          {/* تخفيض خاص بالخدمة */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-red-600 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> تخفيض
              </Label>
              <Input
                type="number"
                value={allocation.discount}
                onChange={(e) => onChange({ ...allocation, discount: Number(e.target.value) || 0 })}
                className="h-7 text-xs"
                min="0"
                placeholder="مبلغ التخفيض"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">سبب التخفيض</Label>
              <Input
                value={allocation.discount_reason}
                onChange={(e) => onChange({ ...allocation, discount_reason: e.target.value })}
                className="h-7 text-xs"
                placeholder="اختياري..."
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function CostAllocationSection({
  allocation,
  onChange,
  hasPrint,
  hasCutout,
  hasInstallation,
  originalCosts,
}: CostAllocationSectionProps) {
  const updateService = (service: 'print' | 'cutout' | 'installation', alloc: ServiceAllocation) => {
    onChange({ ...allocation, [service]: alloc });
  };

  const hasAnyEnabled = allocation.print.enabled || allocation.cutout.enabled || allocation.installation.enabled;

  return (
    <Card className="border-dashed border-amber-300 dark:border-amber-700">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-amber-600" />
          توزيع التكاليف والتخفيضات
          {hasAnyEnabled && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
              مفعّل
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        {hasPrint && (
          <ServiceAllocationCard
            service="print"
            label="الطباعة"
            icon={<Printer className="h-4 w-4 text-blue-600" />}
            color="blue"
            allocation={allocation.print}
            onChange={(a) => updateService('print', a)}
            totalCost={originalCosts.customerPrint}
            showPrinter={true}
          />
        )}

        {hasCutout && (
          <ServiceAllocationCard
            service="cutout"
            label="المجسمات"
            icon={<Scissors className="h-4 w-4 text-purple-600" />}
            color="purple"
            allocation={allocation.cutout}
            onChange={(a) => updateService('cutout', a)}
            totalCost={originalCosts.customerCutout}
            showPrinter={true}
          />
        )}

        {hasInstallation && (
          <ServiceAllocationCard
            service="installation"
            label="التركيب"
            icon={<Wrench className="h-4 w-4 text-orange-600" />}
            color="orange"
            allocation={allocation.installation}
            onChange={(a) => updateService('installation', a)}
            totalCost={originalCosts.customerInstallation}
            showPrinter={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
