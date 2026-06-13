// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Wallet, Loader2, CheckSquare, Square, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface ExpensePaymentRow {
  expense_id: string;
  amount: number;
}

interface UnpaidExpense {
  id: string;
  description: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  employee_id?: string;
  employee_name?: string;
  category?: string;
  expense_date?: string;
}

interface Employee { id: string; name: string; }

interface Props {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  expensePayments: ExpensePaymentRow[];
  setExpensePayments: (v: ExpensePaymentRow[]) => void;
  refreshKey?: number;
  // ✅ معرّفات مصروفات يجب تضمينها حتى لو كانت مسددة (وضع التعديل)
  includeExpenseIds?: string[];
  // ✅ اختيار الموظف مُتحكَّم به من الخارج للترابط بين الأقسام
  selectedEmployeeId?: string;
  onSelectedEmployeeIdChange?: (id: string) => void;
  remainingToAllocate?: number;
  sectionPool?: number;
}

export function ExpensePaymentSection({
  enabled, setEnabled, expensePayments, setExpensePayments, refreshKey,
  includeExpenseIds = [],
  selectedEmployeeId: controlledEmployeeId,
  onSelectedEmployeeIdChange,
  remainingToAllocate = Infinity,
  sectionPool = Infinity,
}: Props) {
  const [isOpen, setIsOpen] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [allExpenses, setAllExpenses] = useState<UnpaidExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [internalEmployeeId, setInternalEmployeeId] = useState<string>('');
  const selectedEmployeeId = controlledEmployeeId !== undefined ? controlledEmployeeId : internalEmployeeId;
  const setSelectedEmployeeId = (id: string) => {
    if (onSelectedEmployeeIdChange) onSelectedEmployeeIdChange(id);
    if (controlledEmployeeId === undefined) setInternalEmployeeId(id);
  };
  const [availableAmount, setAvailableAmount] = useState<string>('');

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      setLoading(true);
      try {
        const { data: unpaidExps } = await supabase
          .from('expenses')
          .select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date')
          .neq('payment_status', 'paid')
          .not('employee_id', 'is', null)
          .order('expense_date', { ascending: false });

        // ✅ ضمّن مصروفات وضع التعديل حتى لو كانت مسددة
        let extraExps: any[] = [];
        const haveIds = new Set((unpaidExps || []).map((e: any) => e.id));
        const missingIds = includeExpenseIds.filter((id) => !haveIds.has(id));
        if (missingIds.length > 0) {
          const { data: editExps } = await supabase
            .from('expenses')
            .select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date')
            .in('id', missingIds);
          extraExps = editExps || [];
        }
        const exps = [...(unpaidExps || []), ...extraExps];

        const empIds = Array.from(new Set((exps || []).map((e: any) => e.employee_id).filter(Boolean)));
        let empList: Employee[] = [];
        let empMap: Record<string, string> = {};
        if (empIds.length) {
          const { data: emps } = await supabase.from('employees').select('id, name').in('id', empIds).order('name');
          empList = (emps || []) as Employee[];
          empMap = Object.fromEntries(empList.map((e) => [e.id, e.name]));
        }
        setEmployees(empList);

        const includeSet = new Set(includeExpenseIds);
        setAllExpenses((exps || []).map((e: any) => {
          const baseRemaining = Math.max(0, Number(e.amount) - Number(e.paid_amount || 0));
          // ✅ للعنصر المُحرَّر: أضف المبلغ السابق إلى المتبقي حتى يظهر قابلاً للتعديل
          const editingAmt = includeSet.has(e.id)
            ? Number(expensePayments.find(p => p.expense_id === e.id)?.amount || 0)
            : 0;
          return {
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          paid_amount: Number(e.paid_amount || 0),
          remaining: baseRemaining + editingAmt,
          employee_id: e.employee_id,
          employee_name: e.employee_id ? empMap[e.employee_id] : undefined,
          category: e.category,
          expense_date: e.expense_date,
          };
        }).filter(e => e.remaining > 0 || includeSet.has(e.id)));
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled, refreshKey, includeExpenseIds.join(',')]);

  // Filter by selected employee
  const visibleExpenses = useMemo(
    () => selectedEmployeeId ? allExpenses.filter(e => e.employee_id === selectedEmployeeId) : [],
    [allExpenses, selectedEmployeeId]
  );

  // When employee changes, drop selections from other employees
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const visibleIds = new Set(allExpenses.filter(e => e.employee_id === selectedEmployeeId).map(e => e.id));
    // ✅ لا تُسقط اختيارات وضع التعديل المُحمَّلة مسبقاً قبل اختيار الموظف
    const editing = new Set(includeExpenseIds);
    setExpensePayments(expensePayments.filter(p => visibleIds.has(p.expense_id) || editing.has(p.expense_id)));
  }, [selectedEmployeeId]);

  const toggle = (exp: UnpaidExpense, checked: boolean) => {
    if (checked) {
      const others = expensePayments.filter(p => p.expense_id !== exp.id);
      const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
      const poolCap = Math.max(0, sectionPool - otherSum);
      const amt = Math.min(exp.remaining, poolCap);
      setExpensePayments([...others, { expense_id: exp.id, amount: amt }]);
    } else {
      setExpensePayments(expensePayments.filter(p => p.expense_id !== exp.id));
    }
  };

  const updateAmount = (id: string, val: string, max: number) => {
    const sel = expensePayments.find(p => p.expense_id === id);
    const current = Number(sel?.amount || 0);
    const poolCap = Math.max(0, sectionPool - (totalSelected - current));
    const dynamicCap = Math.min(
      availableNum > 0 ? Math.min(max, remainingFromAvailable + current) : max,
      poolCap,
    );
    const n = Math.max(0, Math.min(parseFloat(val) || 0, dynamicCap));
    setExpensePayments(expensePayments.map(p => p.expense_id === id ? { ...p, amount: n } : p));
  };

  const allSelected = visibleExpenses.length > 0 && visibleExpenses.every(e => expensePayments.some(p => p.expense_id === e.id));

  const selectAll = () => {
    if (allSelected) {
      const visibleIds = new Set(visibleExpenses.map(e => e.id));
      setExpensePayments(expensePayments.filter(p => !visibleIds.has(p.expense_id)));
    } else {
      const others = expensePayments.filter(p => !visibleExpenses.some(e => e.id === p.expense_id));
      const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
      let budget = Math.max(0, sectionPool - otherSum);
      const additions: ExpensePaymentRow[] = [];
      for (const e of visibleExpenses) {
        if (budget <= 0) break;
        const amt = Math.min(e.remaining, budget);
        if (amt > 0) {
          additions.push({ expense_id: e.id, amount: amt });
          budget -= amt;
        }
      }
      setExpensePayments([...others, ...additions]);
    }
  };

  const totalSelected = expensePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const employeeTotalRemaining = visibleExpenses.reduce((s, e) => s + e.remaining, 0);
  const availableNum = parseFloat(availableAmount) || 0;
  const remainingFromAvailable = Math.max(0, availableNum - totalSelected);
  const availableMaxCap = Math.max(0, Math.min(sectionPool, employeeTotalRemaining));

  const rowMax = (e: UnpaidExpense) => {
    const sel = expensePayments.find(p => p.expense_id === e.id);
    const current = Number(sel?.amount || 0);
    const poolCap = Math.max(0, sectionPool - (totalSelected - current));
    const fromAvailable = availableNum > 0
      ? Math.min(e.remaining, remainingFromAvailable + current)
      : e.remaining;
    return Math.min(fromAvailable, poolCap);
  };

  const autoDistribute = () => {
    if (availableNum <= 0 || visibleExpenses.length === 0) return;
    // sort ascending by remaining amount — pay smallest first to clear more expenses
    const sorted = [...visibleExpenses].sort((a, b) => a.remaining - b.remaining);
    const others = expensePayments.filter(p => !visibleExpenses.some(e => e.id === p.expense_id));
    const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
    let budget = Math.min(availableNum, Math.max(0, sectionPool - otherSum));
    const newPayments: ExpensePaymentRow[] = [];
    for (const e of sorted) {
      if (budget <= 0) break;
      const pay = Math.min(e.remaining, budget);
      if (pay > 0) {
        newPayments.push({ expense_id: e.id, amount: pay });
        budget -= pay;
      }
    }
    setExpensePayments([...others, ...newPayments]);
  };


  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(!!v); if (v) setIsOpen(true); else { setExpensePayments([]); setSelectedEmployeeId(''); } }}
            onClick={(e) => e.stopPropagation()}
          />
          <Wallet className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-semibold">سداد مصروفات موظفين</span>
          {enabled && totalSelected > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
              {totalSelected.toFixed(0)} د.ل
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {enabled && (
          <div className="space-y-2 p-3 mt-1 bg-orange-50/50 dark:bg-orange-950/10 rounded-lg border border-orange-200/50">
            {loading ? (
              <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-orange-600" /></div>
            ) : employees.length === 0 ? (
              <div className="text-xs text-center text-muted-foreground py-3">لا يوجد موظفون لديهم مصروفات غير مسددة</div>
            ) : (
              <>
                {/* Employee selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-orange-800 dark:text-orange-300">اختر الموظف</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="-- اختر موظف --" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => {
                        const cnt = allExpenses.filter(e => e.employee_id === emp.id).length;
                        return (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">
                            {emp.name} ({cnt} مصروف)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployeeId && visibleExpenses.length > 0 && (
                  <>
                    {/* Available amount + auto distribute */}
                    <div className="flex items-end gap-2 p-2 rounded border border-orange-200/60 bg-background">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-semibold text-orange-800 dark:text-orange-300">
                          المبلغ المتاح لتوزيعه على هذا الموظف
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            value={availableAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '') { setAvailableAmount(''); return; }
                              const raw = parseFloat(v) || 0;
                              const clamped = Math.max(0, Math.min(raw, availableMaxCap));
                              setAvailableAmount(String(clamped));
                            }}
                            placeholder="0"
                            className="h-8 text-xs flex-1"
                            dir="ltr"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setAvailableAmount(String(availableMaxCap))}
                            className="text-[10px] h-7 border-orange-300 text-orange-700 hover:bg-orange-50"
                            disabled={availableMaxCap <= 0}
                            title={`الحد الأقصى: ${availableMaxCap.toFixed(2)}`}
                          >
                            كامل
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={autoDistribute}
                        disabled={availableNum <= 0}
                        className="h-8 text-[11px] gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Zap className="h-3 w-3" />
                        توزيع تلقائي
                      </Button>
                    </div>

                    {/* Status bar */}
                    {availableNum > 0 && (
                      <div className="grid grid-cols-3 gap-1 text-[10px] p-1.5 rounded bg-orange-100/60 dark:bg-orange-950/30">
                        <div className="text-center">
                          <div className="text-muted-foreground">المُختار</div>
                          <div className="font-bold text-orange-700">{totalSelected.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">المتبقي من المبلغ</div>
                          <div className="font-bold text-orange-700">{remainingFromAvailable.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">مستحقات الموظف</div>
                          <div className="font-bold text-orange-700">{employeeTotalRemaining.toFixed(2)}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-1">
                      <Button type="button" size="sm" variant="ghost" onClick={selectAll} className="h-7 text-[11px] gap-1">
                        {allSelected ? <Square className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                        {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        إجمالي مستحقات الموظف: <strong className="text-orange-700">{employeeTotalRemaining.toLocaleString('ar-LY')} د.ل</strong>
                      </span>
                    </div>


                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {visibleExpenses.map(e => {
                        const sel = expensePayments.find(p => p.expense_id === e.id);
                        const max = rowMax(e);
                        const poolFull = !sel && Math.max(0, sectionPool - totalSelected) <= 0;
                        return (
                          <div key={e.id} className="flex items-center gap-2 p-1.5 bg-background rounded border border-orange-200/40">
                            <Checkbox checked={!!sel} onCheckedChange={(v) => toggle(e, !!v)} disabled={poolFull} title={poolFull ? 'تم بلوغ سقف الدفعة' : undefined} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{e.description}</div>
                              <div className="text-[10px] text-muted-foreground">
                                متبقي: {e.remaining.toLocaleString('ar-LY')} د.ل
                                {e.expense_date && ` · ${e.expense_date}`}
                                {e.category && ` · ${e.category}`}
                                {poolFull && <span className="text-red-600 font-semibold"> · ⛔ السقف ممتلئ</span>}
                              </div>
                            </div>
                            {sel && (
                              <>
                                <Input
                                  type="number"
                                  value={sel.amount || ''}
                                  onChange={(ev) => updateAmount(e.id, ev.target.value, e.remaining)}
                                  className="h-7 w-20 text-xs text-left disabled:opacity-60"
                                  dir="ltr"
                                  disabled={max <= 0 && Number(sel.amount || 0) === 0}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAmount(e.id, String(max), e.remaining)}
                                  className="text-[10px] h-7 px-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                                  disabled={max <= 0}
                                  title={`الحد الأقصى: ${max.toFixed(2)}`}
                                >
                                  كامل
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {selectedEmployeeId && visibleExpenses.length === 0 && (
                  <div className="text-xs text-center text-muted-foreground py-3">لا توجد مصروفات غير مسددة لهذا الموظف</div>
                )}
              </>
            )}
            <div className="flex justify-between pt-1.5 border-t border-orange-200 text-xs">
              <span className="text-orange-700">إجمالي السداد:</span>
              <span className="font-bold text-orange-700">{totalSelected.toFixed(2)} د.ل</span>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
