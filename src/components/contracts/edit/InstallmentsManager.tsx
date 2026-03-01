import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calculator, Plus as PlusIcon, Trash2, Info, Pen, CheckCircle2, AlertCircle, Sparkles, Check, ChevronsUpDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UnequalDistributionManager } from './UnequalDistributionManager';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// أنواع مواعيد الدفع الافتراضية
const DEFAULT_PAYMENT_TYPES = [
  '', // خيار فارغ افتراضي
  'عند التوقيع',
  'عند التركيب',
  'شهري',
  'مقدم',
  'ربع سنوي',
  'نصف سنوي',
  'نهاية العقد',
];

interface Installment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

export interface UnequalPayment {
  amount: number;
  dueDate: string;
  description: string;
  paymentType: string;
}

interface InstallmentsManagerProps {
  installments: Installment[];
  finalTotal: number;
  startDate: string;
  /**
   * When true, prevents the component from re-distributing installments automatically
   * when the total changes (e.g., when installments are loaded from DB).
   */
  disableAutoRedistribute?: boolean;
  onDistributeEvenly: (count: number) => void;
  onDistributeWithInterval?: (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => void;
  onCreateManualInstallments?: (count: number) => void;
  onApplyUnequalDistribution?: (payments: UnequalPayment[]) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
  onUpdateInstallment: (index: number, field: string, value: any) => void;
  onClearAll: () => void;
  installmentSummary?: string | null;
  savedDistributionType?: 'single' | 'multiple';
  savedFirstPaymentAmount?: number;
  savedFirstPaymentType?: 'amount' | 'percent';
  savedInterval?: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
  savedCount?: number;
  savedHasDifferentFirstPayment?: boolean;
  savedFirstAtSigning?: boolean;
  onDistributionTypeChange?: (type: 'single' | 'multiple') => void;
  onFirstPaymentAmountChange?: (amount: number) => void;
  onFirstPaymentTypeChange?: (type: 'amount' | 'percent') => void;
  onIntervalChange?: (interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months') => void;
  onCountChange?: (count: number) => void;
  onHasDifferentFirstPaymentChange?: (has: boolean) => void;
  onFirstAtSigningChange?: (value: boolean) => void;
}

export function InstallmentsManager({
  installments,
  finalTotal,
  startDate,
  disableAutoRedistribute,
  onDistributeEvenly,
  onDistributeWithInterval,
  onCreateManualInstallments,
  onApplyUnequalDistribution,
  onAddInstallment,
  onRemoveInstallment,
  onUpdateInstallment,
  onClearAll,
  installmentSummary,
  savedDistributionType,
  savedFirstPaymentAmount,
  savedFirstPaymentType,
  savedInterval,
  savedCount,
  savedHasDifferentFirstPayment,
  savedFirstAtSigning,
  onDistributionTypeChange,
  onFirstPaymentAmountChange,
  onFirstPaymentTypeChange,
  onIntervalChange,
  onCountChange,
  onHasDifferentFirstPaymentChange,
  onFirstAtSigningChange
}: InstallmentsManagerProps) {
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = React.useState<boolean>(savedHasDifferentFirstPayment ?? false);
  const [firstPayment, setFirstPayment] = React.useState<number>(savedFirstPaymentAmount ?? 0);
  const [firstPaymentType, setFirstPaymentType] = React.useState<'amount' | 'percent'>(savedFirstPaymentType ?? 'amount');
  const [firstPaymentDate, setFirstPaymentDate] = React.useState<string>('');
  const [useCustomFirstDate, setUseCustomFirstDate] = React.useState(false);

  const [paymentMode, setPaymentMode] = React.useState<'single' | 'multiple'>(savedDistributionType ?? 'multiple');
  const [interval, setInterval] = React.useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>(savedInterval ?? 'month');
  const [numPayments, setNumPayments] = React.useState<number>(savedCount ?? 2);
  const [useCustomLastDate, setUseCustomLastDate] = React.useState(false);
  const [firstAtSigning, setFirstAtSigning] = React.useState<boolean>(savedFirstAtSigning ?? true);
  const [lastPaymentDate, setLastPaymentDate] = React.useState<string>('');

  const [unequalDistributionOpen, setUnequalDistributionOpen] = React.useState(false);
  const [unequalCount, setUnequalCount] = React.useState<number>(2);
  
  // أنواع مواعيد الدفع المخصصة (يتم جمعها من الدفعات الحالية)
  const [customPaymentTypes, setCustomPaymentTypes] = React.useState<string[]>([]);
  const [openPaymentTypeIndex, setOpenPaymentTypeIndex] = React.useState<number | null>(null);
  
  // جمع كل أنواع مواعيد الدفع المتاحة
  const allPaymentTypes = React.useMemo(() => {
    const fromInstallments = installments.map(i => i.paymentType).filter(Boolean);
    const combined = [...DEFAULT_PAYMENT_TYPES, ...customPaymentTypes, ...fromInstallments];
    return [...new Set(combined)];
  }, [installments, customPaymentTypes]);

  const prevFinalTotalRef = React.useRef<number>(finalTotal);
  const isInitialMount = React.useRef(true);

  // Sync state with parent
  React.useEffect(() => {
    if (savedHasDifferentFirstPayment !== undefined) setHasDifferentFirstPayment(savedHasDifferentFirstPayment);
  }, [savedHasDifferentFirstPayment]);
  
  React.useEffect(() => {
    if (savedFirstPaymentAmount !== undefined) setFirstPayment(savedFirstPaymentAmount);
  }, [savedFirstPaymentAmount]);
  
  React.useEffect(() => {
    if (savedFirstPaymentType !== undefined) setFirstPaymentType(savedFirstPaymentType);
  }, [savedFirstPaymentType]);
  
  React.useEffect(() => {
    if (savedDistributionType !== undefined) setPaymentMode(savedDistributionType);
  }, [savedDistributionType]);
  
  React.useEffect(() => {
    if (savedInterval !== undefined) setInterval(savedInterval);
  }, [savedInterval]);
  
  React.useEffect(() => {
    if (savedCount !== undefined) setNumPayments(savedCount);
  }, [savedCount]);

  // Auto-redistribute when finalTotal changes
  React.useEffect(() => {
    if (disableAutoRedistribute) {
      prevFinalTotalRef.current = finalTotal;
      return;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFinalTotalRef.current = finalTotal;
      return;
    }

    const prevTotal = prevFinalTotalRef.current;
    const difference = Math.abs(finalTotal - prevTotal);
    
    if (difference > 1 && installments.length > 0 && startDate && onDistributeWithInterval) {
      onDistributeWithInterval({
        firstPayment: hasDifferentFirstPayment ? firstPayment : 0,
        firstPaymentType,
        interval,
        numPayments: useCustomLastDate ? undefined : numPayments,
        lastPaymentDate: useCustomLastDate && lastPaymentDate ? lastPaymentDate : undefined,
        firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined
      });
    }
    
    prevFinalTotalRef.current = finalTotal;
  }, [finalTotal, disableAutoRedistribute]);

  // Handlers
  const handleHasDifferentFirstPaymentChange = (value: boolean) => {
    setHasDifferentFirstPayment(value);
    onHasDifferentFirstPaymentChange?.(value);
  };

  const handleFirstPaymentChange = (value: number) => {
    setFirstPayment(value);
    onFirstPaymentAmountChange?.(value);
  };

  const handleFirstPaymentTypeChange = (value: 'amount' | 'percent') => {
    setFirstPaymentType(value);
    onFirstPaymentTypeChange?.(value);
  };

  const handlePaymentModeChange = (value: 'single' | 'multiple') => {
    setPaymentMode(value);
    onDistributionTypeChange?.(value);
  };

  const handleIntervalChange = (value: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months') => {
    setInterval(value);
    onIntervalChange?.(value);
  };

  const handleNumPaymentsChange = (value: number) => {
    setNumPayments(value);
    onCountChange?.(value);
  };

  const handleFirstAtSigningChange = (value: boolean) => {
    setFirstAtSigning(value);
    onFirstAtSigningChange?.(value);
  };

  // إعادة توزيع الدفعات المتبقية بعد حذف دفعة
  const handleRemoveAndRedistribute = (index: number) => {
    const remainingInstallments = installments.filter((_, i) => i !== index);
    
    // إذا تبقت دفعات، أعد توزيع المبلغ عليها
    if (remainingInstallments.length > 0) {
      const totalRemaining = remainingInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const diff = finalTotal - totalRemaining;
      
      // إذا كان هناك فرق كبير، وزع الفرق على الدفعات المتبقية
      if (Math.abs(diff) > 1 && remainingInstallments.length > 0) {
        const addPerInstallment = Math.round(diff / remainingInstallments.length);
        remainingInstallments.forEach((inst, i) => {
          if (i === remainingInstallments.length - 1) {
            // آخر دفعة تأخذ الباقي لتجنب أخطاء التقريب
            const currentTotal = remainingInstallments.slice(0, -1).reduce((sum, x) => sum + (x.amount || 0), 0);
            inst.amount = finalTotal - currentTotal;
          } else {
            inst.amount = (inst.amount || 0) + addPerInstallment;
          }
        });
        
        // تحديث الدفعات من خلال onUpdateInstallment
        remainingInstallments.forEach((inst, i) => {
          onUpdateInstallment(i > index ? i - 1 : i, 'amount', inst.amount);
        });
      }
    }
    
    onRemoveInstallment(index);
  };

  const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const difference = finalTotal - totalInstallments;
  const isBalanced = Math.abs(difference) < 1;

  const actualFirstPayment = React.useMemo(() => {
    if (!hasDifferentFirstPayment) return 0;
    if (firstPaymentType === 'percent') {
      return Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }
    return firstPayment;
  }, [hasDifferentFirstPayment, firstPayment, firstPaymentType, finalTotal]);

  const remainingAfterFirst = finalTotal - actualFirstPayment;

  const intervalMonths = React.useMemo(() => {
    switch (interval) {
      case 'month': return 1;
      case '2months': return 2;
      case '3months': return 3;
      case '4months': return 4;
      case '5months': return 5;
      case '6months': return 6;
      case '7months': return 7;
      default: return 1;
    }
  }, [interval]);

  const intervalLabel = React.useMemo(() => {
    switch (interval) {
      case 'month': return 'شهر';
      case '2months': return 'شهرين';
      case '3months': return '3 أشهر';
      case '4months': return '4 أشهر';
      case '5months': return '5 أشهر';
      case '6months': return '6 أشهر';
      case '7months': return '7 أشهر';
      default: return 'شهر';
    }
  }, [interval]);

  const handleDistribute = () => {
    if (!onDistributeWithInterval || !startDate) return;

    onDistributeWithInterval({
      firstPayment: actualFirstPayment,
      firstPaymentType,
      interval,
      numPayments: useCustomLastDate ? undefined : numPayments,
      lastPaymentDate: useCustomLastDate && lastPaymentDate ? lastPaymentDate : undefined,
      firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
      firstAtSigning
    });
  };

  // Quick two-payment mode (first + remainder)
  const handleTwoPaymentMode = () => {
    if (!onDistributeWithInterval || !startDate || actualFirstPayment <= 0) return;
    
    onDistributeWithInterval({
      firstPayment: actualFirstPayment,
      firstPaymentType,
      interval: 'month',
      numPayments: 1, // Only 1 remaining payment
      firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
      firstAtSigning
    });
  };

  return (
    <Card className="bg-card border-border shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-lg bg-primary/20">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <span>نظام الدفعات</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        
        {/* التوزيع الذكي */}
        {onDistributeWithInterval && (
          <div className="space-y-4">
            
            {/* الدفعة الأولى */}
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-bold">دفعة أولى مختلفة</Label>
                </div>
                <Switch
                  checked={hasDifferentFirstPayment}
                  onCheckedChange={handleHasDifferentFirstPaymentChange}
                />
              </div>

              {hasDifferentFirstPayment && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">القيمة</Label>
                      <Input
                        type="number"
                        min={0}
                        max={firstPaymentType === 'percent' ? 100 : finalTotal}
                        value={firstPayment}
                        onChange={(e) => handleFirstPaymentChange(Number(e.target.value) || 0)}
                        placeholder={firstPaymentType === 'percent' ? '%' : 'د.ل'}
                        className="h-10 font-bold text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">النوع</Label>
                      <Select value={firstPaymentType} onValueChange={(v: any) => handleFirstPaymentTypeChange(v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="amount">مبلغ ثابت</SelectItem>
                          <SelectItem value="percent">نسبة %</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* عرض القيمة المحسوبة */}
                  {actualFirstPayment > 0 && actualFirstPayment <= finalTotal && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">الدفعة الأولى</p>
                        <p className="text-lg font-bold text-primary font-manrope">{actualFirstPayment.toLocaleString('ar-LY')} د.ل</p>
                      </div>
                      <div className="text-left space-y-0.5">
                        <p className="text-xs text-muted-foreground">المتبقي</p>
                        <p className="text-lg font-bold text-foreground font-manrope">{remainingAfterFirst.toLocaleString('ar-LY')} د.ل</p>
                      </div>
                    </div>
                  )}

                  {/* تاريخ الدفعة الأولى */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <Label className="text-xs">تاريخ مخصص للدفعة الأولى</Label>
                    <Switch checked={useCustomFirstDate} onCheckedChange={setUseCustomFirstDate} />
                  </div>

                  {useCustomFirstDate && (
                    <Input
                      type="date"
                      value={firstPaymentDate}
                      onChange={(e) => setFirstPaymentDate(e.target.value)}
                      className="h-10"
                    />
                  )}
                  
                  {/* زر سريع: دفعتان فقط */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTwoPaymentMode}
                    className="w-full border-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 font-bold"
                    disabled={actualFirstPayment <= 0 || !startDate}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    دفعتان فقط (الأولى + الباقي)
                  </Button>
                </div>
              )}
            </div>

            {/* نوع التوزيع */}
            <div className="space-y-3">
              <Label className="text-sm font-bold">توزيع الدفعات</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePaymentModeChange('single')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-center transition-all duration-200",
                    paymentMode === 'single' 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <DollarSign className="h-6 w-6 mb-1 text-primary" />
                  <div className="text-sm font-bold">دفعة واحدة</div>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentModeChange('multiple')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-center transition-all duration-200",
                    paymentMode === 'multiple' 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Calculator className="h-6 w-6 mb-1 text-primary" />
                  <div className="text-sm font-bold">عدة دفعات</div>
                </button>
              </div>
            </div>

            {/* إعدادات الدفعات المتعددة */}
            {paymentMode === 'multiple' && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
                {/* دفعة عند التوقيع */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">دفعة عند التوقيع</Label>
                  </div>
                  <Switch
                    checked={firstAtSigning}
                    onCheckedChange={handleFirstAtSigningChange}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">الفترة بين الدفعات</Label>
                    <Select value={interval} onValueChange={(v: any) => handleIntervalChange(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="month">كل شهر</SelectItem>
                        <SelectItem value="2months">كل شهرين</SelectItem>
                        <SelectItem value="3months">كل 3 أشهر</SelectItem>
                        <SelectItem value="4months">كل 4 أشهر</SelectItem>
                        <SelectItem value="5months">كل 5 أشهر</SelectItem>
                        <SelectItem value="6months">كل 6 أشهر</SelectItem>
                        <SelectItem value="7months">كل 7 أشهر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">عدد الدفعات</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={numPayments}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 24) {
                          handleNumPaymentsChange(val);
                        }
                      }}
                      className="h-10 font-bold text-center"
                      placeholder="2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* زر التطبيق الرئيسي */}
            <Button
              type="button"
              onClick={handleDistribute}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
              disabled={!startDate}
            >
              <Calculator className="h-5 w-5 mr-2" />
              تطبيق التوزيع
            </Button>
            
            {!startDate && (
              <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                حدد تاريخ بداية العقد أولاً
              </p>
            )}
          </div>
        )}

        {/* الأدوات السريعة */}
        <div className="pt-3 border-t border-border space-y-3">
          <Label className="text-xs text-muted-foreground">أدوات سريعة</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onAddInstallment}
              size="sm"
              className="text-xs"
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              إضافة دفعة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnequalCount(3);
                setUnequalDistributionOpen(true);
              }}
              size="sm"
              className="text-xs border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
            >
              <Pen className="h-3 w-3 mr-1" />
              توزيع يدوي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClearAll}
              size="sm"
              className="text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              مسح الكل
            </Button>
          </div>
        </div>

        {/* Unequal Distribution Dialog */}
        {onApplyUnequalDistribution && (
          <UnequalDistributionManager
            open={unequalDistributionOpen}
            onOpenChange={setUnequalDistributionOpen}
            finalTotal={finalTotal}
            startDate={startDate}
            count={unequalCount}
            onApply={(payments) => {
              onApplyUnequalDistribution(payments);
              setUnequalDistributionOpen(false);
            }}
          />
        )}

        {/* قائمة الدفعات */}
        {installments.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Label className="text-sm font-bold flex items-center gap-2">
              <Info className="h-4 w-4" /> الدفعات ({installments.length})
            </Label>
            
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {installments.map((installment, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    index === 0 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-card border-border hover:border-primary/20"
                  )}
                >
                  <div className="flex flex-col gap-3">
                    {/* الصف الأول: رقم الدفعة والمبلغ وزر الحذف */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                          index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">المبلغ</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              value={installment.amount}
                              onChange={(e) => onUpdateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-32 h-8 text-sm font-bold"
                            />
                            <span className="text-xs text-muted-foreground">د.ل</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAndRedistribute(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        title="حذف الدفعة وإعادة توزيع المبلغ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* الصف الثاني: نوع الدفعة وتاريخ الاستحقاق */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">موعد الدفع</span>
                        <Popover 
                          open={openPaymentTypeIndex === index} 
                          onOpenChange={(open) => setOpenPaymentTypeIndex(open ? index : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPaymentTypeIndex === index}
                              className="h-9 justify-between font-normal"
                            >
                              {installment.paymentType || "غير محدد"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0 z-[10000]" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="ابحث أو اكتب موعد جديد..." 
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = (e.target as HTMLInputElement).value.trim();
                                    if (input && !allPaymentTypes.includes(input)) {
                                      setCustomPaymentTypes(prev => [...prev, input]);
                                    }
                                    if (input) {
                                      onUpdateInstallment(index, 'paymentType', input);
                                      setOpenPaymentTypeIndex(null);
                                    }
                                  }
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="text-sm text-muted-foreground p-2">
                                    اضغط Enter لإضافة موعد جديد
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {allPaymentTypes.map((type) => (
                                    <CommandItem
                                      key={type || 'empty'}
                                      value={type || 'غير محدد'}
                                      onSelect={() => {
                                        onUpdateInstallment(index, 'paymentType', type);
                                        setOpenPaymentTypeIndex(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          installment.paymentType === type ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {type || 'غير محدد'}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">تاريخ الاستحقاق</span>
                        <Input
                          type="date"
                          value={installment.dueDate}
                          onChange={(e) => onUpdateInstallment(index, 'dueDate', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    
                    {/* الصف الثالث: الوصف */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">وصف الدفعة (اختياري)</span>
                      <Input
                        type="text"
                        value={installment.description}
                        onChange={(e) => onUpdateInstallment(index, 'description', e.target.value)}
                        placeholder={index === 0 ? 'مثال: دفعة مقدمة' : `مثال: القسط ${index + 1}`}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الملخص */}
        <div className={cn(
          "p-4 rounded-xl border-2 space-y-2",
          isBalanced 
            ? "bg-green-500/5 border-green-500/30" 
            : "bg-amber-500/5 border-amber-500/30"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">إجمالي العقد</span>
            <span className="font-bold text-lg font-manrope">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">مجموع الدفعات</span>
            <span className="font-bold text-lg font-manrope">{totalInstallments.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between items-center">
            <span className="text-sm font-medium">الفرق</span>
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span className={cn(
                "font-bold text-lg font-manrope",
                isBalanced ? "text-green-500" : "text-amber-500"
              )}>
                {difference.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>
          
          {!isBalanced && installments.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>تحذير: لن يتم حفظ العقد حتى تتساوى الدفعات مع الإجمالي!</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDistribute}
                className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              >
                <Calculator className="h-4 w-4 mr-2" />
                إعادة التوزيع تلقائياً
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
