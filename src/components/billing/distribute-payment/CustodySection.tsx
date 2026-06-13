import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, X, Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import type { Employee, CustodyDistribution } from './types';

interface CustodySectionProps {
  enableCustodyOption: boolean;
  setEnableCustodyOption: (v: boolean) => void;
  convertToCustody: boolean;
  setConvertToCustody: (v: boolean) => void;
  custodyOptionAmount: string;
  setCustodyOptionAmount: (v: string) => void;
  custodyDistributions: CustodyDistribution[];
  addCustodyDistribution: () => void;
  removeCustodyDistribution: (index: number) => void;
  updateCustodyDistribution: (index: number, field: 'employeeId' | 'amount', value: string | number) => void;
  employees: Employee[];
  loadingEmployees: boolean;
  remainingToAllocate?: number;
  sectionPool?: number;
}

export function CustodySection({
  enableCustodyOption, setEnableCustodyOption,
  convertToCustody, setConvertToCustody,
  custodyOptionAmount, setCustodyOptionAmount,
  custodyDistributions,
  addCustodyDistribution,
  removeCustodyDistribution,
  updateCustodyDistribution,
  employees, loadingEmployees,
  remainingToAllocate = 0,
  sectionPool = Infinity,
}: CustodySectionProps) {
  const [isOpen, setIsOpen] = useState(enableCustodyOption);

  const clamp = (val: number, max: number) => Math.max(0, Math.min(val, Math.max(0, max)));
  const custodyPool = parseFloat(custodyOptionAmount) || 0;
  const otherSum = (idx: number) =>
    custodyDistributions.reduce((s, d, i) => (i === idx ? s : s + Number(d.amount || 0)), 0);
  const computeRowMax = (idx: number) => {
    const current = Number(custodyDistributions[idx]?.amount || 0);
    return Math.max(0, custodyPool - otherSum(idx));
  };
  // السقف الفعلي = ما تبقّى من الدفعة الكلية بعد بقية الأقسام (sectionPool يأخذ بالحسبان قيمتنا الحالية)
  const custodyMaxAmount = () => Math.max(0, sectionPool);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enableCustodyOption}
            onCheckedChange={(checked) => {
              setEnableCustodyOption(checked as boolean);
              if (!checked) setCustodyOptionAmount('');
              if (checked && !convertToCustody) setConvertToCustody(true);
              if (!checked) setConvertToCustody(false);
              if (checked) setIsOpen(true);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <Wallet className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold">عهدة / تسليم</span>
          {enableCustodyOption && custodyOptionAmount && (
            <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
              {parseFloat(custodyOptionAmount).toFixed(0)} د.ل
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {enableCustodyOption && (
          <div className="space-y-2.5 p-3 mt-1 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400">مبلغ العهدة</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  step="0.01"
                  value={custodyOptionAmount}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value) || 0;
                    const max = custodyMaxAmount();
                    setCustodyOptionAmount(String(Number.isFinite(max) ? clamp(raw, max) : Math.max(0, raw)));
                  }}
                  placeholder="المبلغ"
                  className="h-8 text-xs text-right flex-1 disabled:opacity-60"
                  disabled={Number.isFinite(custodyMaxAmount()) && custodyMaxAmount() <= 0 && (parseFloat(custodyOptionAmount) || 0) === 0}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCustodyOptionAmount(String(custodyMaxAmount()))}
                  className="text-[10px] h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                  disabled={!Number.isFinite(custodyMaxAmount()) || custodyMaxAmount() <= 0}
                  title={Number.isFinite(custodyMaxAmount()) ? `الحد الأقصى: ${custodyMaxAmount().toFixed(2)}` : undefined}
                >
                  كامل
                </Button>
              </div>
              {Number.isFinite(custodyMaxAmount()) && custodyMaxAmount() <= 0 && (parseFloat(custodyOptionAmount) || 0) === 0 && (
                <div className="text-[10px] text-red-600 font-semibold">⛔ تم بلوغ سقف الدفعة</div>
              )}
            </div>

            {convertToCustody && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400">توزيع على الموظفين</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCustodyDistribution} className="gap-1 h-7 text-xs border-amber-300">
                    <Plus className="h-3 w-3" /> إضافة
                  </Button>
                </div>

                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {custodyDistributions.map((distribution, index) => (
                      <div key={index} className="flex items-center gap-1.5 p-1.5 bg-background rounded border border-amber-200 dark:border-amber-700">
                        <div className="flex-1">
                          <Select value={distribution.employeeId} onValueChange={(value) => updateCustodyDistribution(index, 'employeeId', value)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اختر الموظف" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            value={distribution.amount || ''}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value) || 0;
                              updateCustodyDistribution(index, 'amount', clamp(raw, computeRowMax(index)));
                            }}
                            placeholder="المبلغ"
                            className="h-8 text-xs text-left"
                            dir="ltr"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateCustodyDistribution(index, 'amount', computeRowMax(index))}
                          className="text-[10px] h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                          disabled={computeRowMax(index) <= 0}
                          title={`الحد الأقصى: ${computeRowMax(index).toFixed(2)}`}
                        >
                          كامل
                        </Button>
                        {custodyDistributions.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCustodyDistribution(index)} className="h-7 w-7 text-red-500">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {custodyDistributions.some(d => d.amount > 0) && (
                  <div className="flex items-center justify-between p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                    <span className="text-amber-700 dark:text-amber-300">إجمالي العهد:</span>
                    <span className="font-bold text-amber-800 dark:text-amber-200">
                      {custodyDistributions.reduce((sum, d) => sum + d.amount, 0).toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
