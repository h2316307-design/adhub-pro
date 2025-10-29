import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calculator, Plus as PlusIcon, Trash2, Info, Pen } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UnequalDistributionManager } from './UnequalDistributionManager';

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
  onDistributeEvenly: (count: number) => void;
  onDistributeWithInterval?: (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
  }) => void;
  onCreateManualInstallments?: (count: number) => void;
  onApplyUnequalDistribution?: (payments: UnequalPayment[]) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
  onUpdateInstallment: (index: number, field: string, value: any) => void;
  onClearAll: () => void;
  installmentSummary?: string | null;
}

export function InstallmentsManager({
  installments,
  finalTotal,
  startDate,
  onDistributeEvenly,
  onDistributeWithInterval,
  onCreateManualInstallments,
  onApplyUnequalDistribution,
  onAddInstallment,
  onRemoveInstallment,
  onUpdateInstallment,
  onClearAll,
  installmentSummary
}: InstallmentsManagerProps) {
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = React.useState<boolean>(false);
  const [firstPayment, setFirstPayment] = React.useState<number>(0);
  const [firstPaymentType, setFirstPaymentType] = React.useState<'amount' | 'percent'>('amount');
  const [firstPaymentDate, setFirstPaymentDate] = React.useState<string>('');
  const [useCustomFirstDate, setUseCustomFirstDate] = React.useState(false);

  const [paymentMode, setPaymentMode] = React.useState<'single' | 'multiple'>('multiple');
  const [interval, setInterval] = React.useState<'month' | '2months' | '3months' | '4months'>('month');
  const [numPayments, setNumPayments] = React.useState<number>(3);
  const [useCustomLastDate, setUseCustomLastDate] = React.useState(false);
  const [lastPaymentDate, setLastPaymentDate] = React.useState<string>('');

  const [unequalDistributionOpen, setUnequalDistributionOpen] = React.useState(false);
  const [unequalCount, setUnequalCount] = React.useState<number>(3);

  const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const difference = finalTotal - totalInstallments;

  const actualFirstPayment = React.useMemo(() => {
    if (!hasDifferentFirstPayment) return 0;
    if (firstPaymentType === 'percent') {
      return Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }
    return firstPayment;
  }, [hasDifferentFirstPayment, firstPayment, firstPaymentType, finalTotal]);

  const intervalMonths = React.useMemo(() => {
    switch (interval) {
      case 'month': return 1;
      case '2months': return 2;
      case '3months': return 3;
      case '4months': return 4;
      default: return 1;
    }
  }, [interval]);

  const intervalLabel = React.useMemo(() => {
    switch (interval) {
      case 'month': return 'شهر';
      case '2months': return 'شهرين';
      case '3months': return '3 أشهر';
      case '4months': return '4 أشهر';
      default: return 'شهر';
    }
  }, [interval]);

  const calculatePaymentsPreview = React.useMemo(() => {
    if (!startDate) return null;
    
    const firstDate = useCustomFirstDate && firstPaymentDate ? firstPaymentDate : startDate;
    const remaining = finalTotal - actualFirstPayment;

    // دفعة واحدة فقط
    if (paymentMode === 'single' || remaining <= 0) {
      return {
        mode: 'single',
        firstPayment: actualFirstPayment > 0 ? actualFirstPayment : finalTotal,
        firstDate,
        total: finalTotal
      };
    }

    // دفعات متعددة
    let numberOfPayments: number;
    
    if (useCustomLastDate && lastPaymentDate) {
      const start = new Date(firstDate);
      const end = new Date(lastPaymentDate);
      const monthsDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
    } else {
      numberOfPayments = Math.min(12, Math.max(1, numPayments));
    }

    const recurringAmount = Math.round((remaining / numberOfPayments) * 100) / 100;
    const lastRecurringTotal = remaining - (recurringAmount * (numberOfPayments - 1));

    const lastInstallmentDate = new Date(firstDate);
    lastInstallmentDate.setMonth(lastInstallmentDate.getMonth() + numberOfPayments * intervalMonths);

    return {
      mode: 'multiple',
      firstPayment: actualFirstPayment,
      firstDate,
      numberOfPayments,
      recurringAmount,
      lastRecurringTotal,
      lastDate: lastInstallmentDate.toISOString().split('T')[0],
      total: actualFirstPayment + (recurringAmount * (numberOfPayments - 1)) + lastRecurringTotal,
      remaining
    };
  }, [startDate, actualFirstPayment, finalTotal, paymentMode, interval, intervalMonths, numPayments, useCustomLastDate, lastPaymentDate, useCustomFirstDate, firstPaymentDate]);

  const handleDistribute = () => {
    if (!onDistributeWithInterval || !startDate) return;

    onDistributeWithInterval({
      firstPayment: actualFirstPayment,
      firstPaymentType,
      interval,
      numPayments: useCustomLastDate ? undefined : numPayments,
      lastPaymentDate: useCustomLastDate && lastPaymentDate ? lastPaymentDate : undefined,
      firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined
    });
  };

  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <DollarSign className="h-5 w-5 text-primary" />
          نظام الدفعات الديناميكي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Smart Distribution */}
        {onDistributeWithInterval && (
          <Card className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 shadow-lg">
            <h4 className="font-bold text-base mb-4 text-primary flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              التوزيع الذكي للدفعات
            </h4>

            <div className="space-y-4">
              {/* هل الدفعة الأولى مختلفة؟ */}
              <div className="flex items-center justify-between p-3 bg-background rounded-lg border-2 border-border hover:border-primary/50 transition-colors">
                <Label htmlFor="has-different-first" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                  💰 دفعة أولى مختلفة؟
                </Label>
                <Switch
                  id="has-different-first"
                  checked={hasDifferentFirstPayment}
                  onCheckedChange={setHasDifferentFirstPayment}
                />
              </div>

              {/* إعدادات الدفعة الأولى */}
              {hasDifferentFirstPayment && (
                <Card className="p-4 bg-background/50 border-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-bold text-foreground block mb-2">💵 قيمة الدفعة الأولى</label>
                      <Input
                        type="number"
                        min={0}
                        max={firstPaymentType === 'percent' ? 100 : finalTotal}
                        value={firstPayment}
                        onChange={(e) => setFirstPayment(Number(e.target.value) || 0)}
                        placeholder={firstPaymentType === 'percent' ? 'النسبة %' : 'المبلغ'}
                        className="bg-background font-semibold text-base h-11"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground block mb-2">نوع القيمة</label>
                      <Select value={firstPaymentType} onValueChange={(v: any) => setFirstPaymentType(v)}>
                        <SelectTrigger className="bg-background h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="amount">💵 مبلغ ثابت</SelectItem>
                          <SelectItem value="percent">📊 نسبة %</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {actualFirstPayment > 0 && actualFirstPayment <= finalTotal && (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-600 dark:text-blue-400">
                      <Info className="h-3 w-3 inline ml-1" />
                      القيمة الفعلية: {actualFirstPayment.toLocaleString('ar-LY')} د.ل
                      {firstPaymentType === 'percent' && ` (${firstPayment}%)`}
                    </div>
                  )}

                  {/* تاريخ الدفعة الأولى */}
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                    <Label htmlFor="custom-first-date" className="text-sm font-medium cursor-pointer">
                      📅 تاريخ مخصص للدفعة الأولى
                    </Label>
                    <Switch
                      id="custom-first-date"
                      checked={useCustomFirstDate}
                      onCheckedChange={setUseCustomFirstDate}
                    />
                  </div>

                  {useCustomFirstDate && (
                    <div className="animate-in slide-in-from-top-2">
                      <Input
                        type="date"
                        value={firstPaymentDate}
                        onChange={(e) => setFirstPaymentDate(e.target.value)}
                        className="bg-background h-11 font-semibold"
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* دفعة واحدة أو عدة دفعات؟ */}
              <div>
                <label className="text-sm font-bold text-foreground block mb-2">💳 عدد الدفعات</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={paymentMode === 'single' ? 'default' : 'outline'}
                    onClick={() => setPaymentMode('single')}
                    className="h-11"
                  >
                    دفعة واحدة
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMode === 'multiple' ? 'default' : 'outline'}
                    onClick={() => setPaymentMode('multiple')}
                    className="h-11"
                  >
                    عدة دفعات
                  </Button>
                </div>
              </div>

              {/* إعدادات الدفعات المتعددة */}
              {paymentMode === 'multiple' && (
                <Card className="p-4 bg-background/50 border-border space-y-3">
                  <div>
                    <label className="text-sm font-bold text-foreground block mb-2">📅 الفترة بين الدفعات</label>
                    <Select value={interval} onValueChange={(v: any) => setInterval(v)}>
                      <SelectTrigger className="bg-background h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="month">📆 كل شهر</SelectItem>
                        <SelectItem value="2months">📆📆 كل شهرين</SelectItem>
                        <SelectItem value="3months">📅 كل 3 أشهر</SelectItem>
                        <SelectItem value="4months">🗓️ كل 4 أشهر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* طريقة تحديد عدد الدفعات */}
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                    <Label htmlFor="custom-last-date" className="text-sm font-medium cursor-pointer">
                      🎯 تحديد بتاريخ آخر دفعة
                    </Label>
                    <Switch
                      id="custom-last-date"
                      checked={useCustomLastDate}
                      onCheckedChange={setUseCustomLastDate}
                    />
                  </div>

                  {useCustomLastDate ? (
                    <div className="animate-in slide-in-from-top-2">
                      <label className="text-sm font-bold text-foreground block mb-2">🗓️ موعد آخر دفعة</label>
                      <Input
                        type="date"
                        value={lastPaymentDate}
                        onChange={(e) => setLastPaymentDate(e.target.value)}
                        min={startDate}
                        className="bg-background h-11 font-semibold"
                      />
                    </div>
                  ) : (
                    <div className="animate-in slide-in-from-top-2">
                      <label className="text-sm font-bold text-foreground block mb-2">🔢 عدد الدفعات المتكررة (2-12)</label>
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        value={numPayments}
                        onChange={(e) => setNumPayments(Math.min(12, Math.max(2, Number(e.target.value) || 2)))}
                        className="bg-background h-11 font-semibold"
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* معاينة التوز��ع */}
              {calculatePaymentsPreview && startDate && (
                <Card className="p-3 bg-green-500/10 border-green-500/30">
                  <h5 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">📊 معاينة التوزيع:</h5>
                  <div className="space-y-1 text-xs text-green-600 dark:text-green-400">
                    {calculatePaymentsPreview.mode === 'single' ? (
                      <p>• دفعة واحدة: {calculatePaymentsPreview.firstPayment.toLocaleString('ar-LY')} د.ل بتاريخ {calculatePaymentsPreview.firstDate}</p>
                    ) : (
                      <>
                        {calculatePaymentsPreview.firstPayment > 0 && (
                          <p>• الدفعة الأولى: {calculatePaymentsPreview.firstPayment.toLocaleString('ar-LY')} د.ل بتاريخ {calculatePaymentsPreview.firstDate}</p>
                        )}
                        <p>• عدد الدفعات المتكررة: {calculatePaymentsPreview.numberOfPayments}</p>
                        <p>• مبلغ كل دفعة: {calculatePaymentsPreview.recurringAmount.toLocaleString('ar-LY')} د.ل</p>
                        <p>• الفترة: كل {intervalLabel}</p>
                        <p>• آخر دفعة بتاريخ: {calculatePaymentsPreview.lastDate}</p>
                        <p className="font-bold pt-1 border-t border-green-500/20">
                          المجموع: {calculatePaymentsPreview.total.toLocaleString('ar-LY')} د.ل
                        </p>
                      </>
                    )}
                  </div>
                </Card>
              )}

              {/* زر التطبيق */}
              <Button
                type="button"
                onClick={handleDistribute}
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-bold shadow-lg"
                size="lg"
                disabled={!startDate || (hasDifferentFirstPayment && (actualFirstPayment < 0 || actualFirstPayment > finalTotal))}
              >
                <Calculator className="h-5 w-5 mr-2" />
                تطبيق التوزيع الذكي
              </Button>
              {(!startDate || (hasDifferentFirstPayment && (actualFirstPayment < 0 || actualFirstPayment > finalTotal))) && (
                <p className="text-xs text-destructive text-center mt-1">
                  {!startDate && '⚠️ يرجى تحديد تاريخ بداية العقد أولاً'}
                  {startDate && hasDifferentFirstPayment && actualFirstPayment < 0 && '⚠️ قيمة الدفعة الأولى لا يمكن أن تكون سالبة'}
                  {startDate && hasDifferentFirstPayment && actualFirstPayment > finalTotal && '⚠️ قيمة الدفعة الأولى أكبر من إجمالي العقد'}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              max={12}
              placeholder="عدد الدفعات (1-12)"
              className="w-36 bg-input border-border text-foreground"
              id="quick-count-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const input = document.getElementById('quick-count-input') as HTMLInputElement;
                onDistributeEvenly(parseInt(input?.value || '1'));
              }}
              size="sm"
              className="border-border hover:bg-accent"
            >
              <Calculator className="h-4 w-4 mr-1" />
              توزيع متساوي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const input = document.getElementById('quick-count-input') as HTMLInputElement;
                setUnequalCount(parseInt(input?.value || '3'));
                setUnequalDistributionOpen(true);
              }}
              size="sm"
              className="border-purple-500 hover:bg-purple-500/10 text-purple-600"
            >
              <Pen className="h-4 w-4 mr-1" />
              توزيع غير متساوي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onAddInstallment}
              size="sm"
              className="border-border hover:bg-accent"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              إضافة دفعة
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onClearAll}
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              مسح الكل
            </Button>
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded">
            <Info className="h-3 w-3 inline ml-1" />
            <strong>توزيع متساوي:</strong> يقسم المبلغ بالتساوي على جميع الدفعات
            <br />
            <strong>توزيع غير متساوي:</strong> ينشئ دفعات لتعبئتها يدويًا بمبالغ مختلفة (حتى 12 دفعة) مع تاريخ محدد لكل دفعة
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

        {/* Installment Summary */}
        {installmentSummary && installments.length > 0 && (
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm font-medium text-green-600 dark:text-green-400 whitespace-pre-line">
                {installmentSummary}
              </div>
            </div>
          </Card>
        )}

        {/* Installments List */}
        <div className="space-y-3">
          {installments.length > 0 && (
            <>
              {/* First Payment Card */}
              {installments[0] && (
                <Card className="p-4 bg-primary/10 border-primary/30">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-primary">الدفعة الأولى</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveInstallment(0)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">ال��بلغ</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={installments[0].amount}
                          onChange={(e) => onUpdateInstallment(0, 'amount', parseFloat(e.target.value) || 0)}
                          className="text-sm bg-background border-border font-bold text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                        <Input
                          type="date"
                          value={installments[0].dueDate}
                          onChange={(e) => onUpdateInstallment(0, 'dueDate', e.target.value)}
                          className="text-sm bg-background border-border"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Recurring Payments Cards */}
              {installments.length > 1 && (
                <Card className="p-4 bg-secondary/10 border-secondary/30">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-secondary-foreground">الدفعات الإضافية</h4>

                    <div className="space-y-3">
                      {installments.slice(1).map((installment, index) => (
                        <div key={index + 1} className="p-3 bg-background rounded-lg border border-border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">الدفعة {index + 2}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveInstallment(index + 1)}
                              className="text-destructive hover:text-destructive/80 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">المبلغ</label>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={installment.amount}
                                onChange={(e) => onUpdateInstallment(index + 1, 'amount', parseFloat(e.target.value) || 0)}
                                className="text-sm h-8 bg-background border-border font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">التاريخ</label>
                              <Input
                                type="date"
                                value={installment.dueDate}
                                onChange={(e) => onUpdateInstallment(index + 1, 'dueDate', e.target.value)}
                                className="text-sm h-8 bg-background border-border"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="text-xs text-muted-foreground">الوصف</label>
                              <Input
                                type="text"
                                value={installment.description}
                                onChange={(e) => onUpdateInstallment(index + 1, 'description', e.target.value)}
                                className="text-xs h-7 bg-background border-border"
                                placeholder="وصف الدفعة"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">نوع السداد</label>
                              <Input
                                type="text"
                                value={installment.paymentType}
                                onChange={(e) => onUpdateInstallment(index + 1, 'paymentType', e.target.value)}
                                className="text-xs h-7 bg-background border-border"
                                placeholder="شهري"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">إجمالي العقد:</span>
            <span className="font-medium text-primary">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">مجموع الدفعات:</span>
            <span className="font-medium text-card-foreground">
              {totalInstallments.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">الفرق:</span>
            <span className={`font-medium ${Math.abs(difference) > 1 ? 'text-destructive' : 'text-green-400'}`}>
              {difference.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
