import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

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
  setDurationDays
}: ContractDatesFormProps) {
  return (
    <Card className="bg-gradient-to-br from-card/90 to-card/70 border-primary/20 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Calendar className="h-5 w-5 text-primary" />
          التواريخ والمدة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-card-foreground mb-2 block">
            تاريخ البداية
          </label>
          <Input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-input border-border text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-card-foreground mb-2 block">
              نظام الإيجار
            </label>
            <Select value={pricingMode} onValueChange={(v) => setPricingMode(v as any)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="اختر نظام الإيجار" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-[10000]">
                <SelectItem value="months">شهري</SelectItem>
                <SelectItem value="days">يومي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pricingMode === 'months' ? (
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">
                عدد الأشهر
              </label>
              <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="اختر عدد الأشهر" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-[10000]">
                  {[1, 2, 3, 6, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? 'شهر' : 'أشهر'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">
                عدد الأيام
              </label>
              <Input 
                type="number" 
                min={1} 
                value={durationDays} 
                onChange={(e) => setDurationDays(Number(e.target.value) || 0)} 
                placeholder="أدخل عدد الأيام"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-card-foreground mb-2 block">
            تاريخ النهاية (محسوب تلقائياً)
          </label>
          <Input 
            type="date" 
            value={endDate} 
            readOnly 
            disabled 
            className="bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
          />
        </div>
      </CardContent>
    </Card>
  );
}