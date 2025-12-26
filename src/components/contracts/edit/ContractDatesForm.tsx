import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CalendarDays, Clock, Settings2, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ContractDatesFormProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  pricingMode: 'months' | 'days';
  setPricingMode: (mode: 'months' | 'days') => void;
  durationMonths: number;
  setDurationMonths: (months: number) => void;
  durationDays: number;
  setDurationDays: (days: number) => void;
  use30DayMonth?: boolean;
  setUse30DayMonth?: (use: boolean) => void;
}

export function ContractDatesForm({
  startDate,
  setStartDate,
  endDate,
  pricingMode,
  setPricingMode,
  durationMonths,
  setDurationMonths,
  durationDays,
  setDurationDays,
  use30DayMonth = true,
  setUse30DayMonth
}: ContractDatesFormProps) {
  // حساب عدد الأيام الفعلية
  const totalDays = React.useMemo(() => {
    if (pricingMode === 'days') return durationDays;
    return use30DayMonth ? durationMonths * 30 : durationMonths * 30; // افتراضي 30 يوم
  }, [pricingMode, durationMonths, durationDays, use30DayMonth]);

  // حساب تاريخ الانتهاء المتوقع
  const calculatedEndDate = React.useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    
    if (pricingMode === 'days') {
      start.setDate(start.getDate() + durationDays);
    } else {
      if (use30DayMonth) {
        start.setDate(start.getDate() + (durationMonths * 30));
      } else {
        start.setMonth(start.getMonth() + durationMonths);
      }
    }
    return start.toISOString().split('T')[0];
  }, [startDate, pricingMode, durationMonths, durationDays, use30DayMonth]);

  return (
    <Card className="border-border shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          التواريخ والمدة
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Pricing Mode Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPricingMode('months')}
            className={cn(
              "p-3 rounded-xl border-2 text-center transition-all duration-200 flex items-center justify-center gap-2",
              pricingMode === 'months' 
                ? "border-blue-500 bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-600 shadow-lg shadow-blue-500/15" 
                : "border-border hover:border-blue-500/50 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <CalendarDays className="h-4 w-4" />
            <span className="font-semibold text-sm">شهري</span>
          </button>
          <button
            type="button"
            onClick={() => setPricingMode('days')}
            className={cn(
              "p-3 rounded-xl border-2 text-center transition-all duration-200 flex items-center justify-center gap-2",
              pricingMode === 'days' 
                ? "border-blue-500 bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-600 shadow-lg shadow-blue-500/15" 
                : "border-border hover:border-blue-500/50 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Clock className="h-4 w-4" />
            <span className="font-semibold text-sm">يومي</span>
          </button>
        </div>

        {/* 30 Day Month Setting */}
        {pricingMode === 'months' && setUse30DayMonth && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use30day"
                  checked={use30DayMonth}
                  onCheckedChange={(checked) => setUse30DayMonth(!!checked)}
                  className="border-violet-500 data-[state=checked]:bg-violet-500"
                />
                <Label htmlFor="use30day" className="text-sm font-medium text-violet-700 dark:text-violet-300 cursor-pointer">
                  حساب الشهر = 30 يوم
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-right">
                      <p className="font-semibold mb-1">طريقة الحساب:</p>
                      <p>✓ مفعل: كل شهر = 30 يوم ثابت</p>
                      <p>✗ معطل: حسب أيام الشهر الفعلية</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                {use30DayMonth ? `${durationMonths * 30} يوم` : 'أيام فعلية'}
              </span>
            </div>
          </div>
        )}

        {/* Start Date & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              تاريخ البداية
            </label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 text-sm bg-background border-2 border-border focus:border-blue-500 rounded-xl font-medium"
            />
          </div>

          {pricingMode === 'months' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                المدة (أشهر)
              </label>
              <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                <SelectTrigger className="h-10 text-sm bg-background border-2 border-border rounded-xl font-medium">
                  <SelectValue placeholder="الأشهر" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-[10000]">
                  {[1, 2, 3, 6, 9, 12].map((m) => (
                    <SelectItem key={m} value={String(m)} className="font-medium">
                      {m} {m === 1 ? 'شهر' : m === 2 ? 'شهرين' : 'أشهر'}
                      {use30DayMonth && (
                        <span className="text-muted-foreground mr-2">({m * 30} يوم)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                عدد الأيام
              </label>
              <Input 
                type="number" 
                min={1} 
                value={durationDays} 
                onChange={(e) => setDurationDays(Number(e.target.value) || 0)} 
                placeholder="الأيام"
                className="h-10 text-sm bg-background border-2 border-border focus:border-blue-500 rounded-xl font-medium"
              />
            </div>
          )}
        </div>

        <Separator className="my-2" />

        {/* End Date & Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border-2 border-emerald-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              ملخص الفترة
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">تاريخ الانتهاء</span>
              <div className="font-bold text-base text-foreground">
                {calculatedEndDate ? new Date(calculatedEndDate).toLocaleDateString('ar-LY', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : '---'}
              </div>
            </div>
            <div className="space-y-1 text-left">
              <span className="text-xs text-muted-foreground">إجمالي الأيام</span>
              <div className="font-bold text-base text-emerald-600">
                {totalDays} يوم
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
