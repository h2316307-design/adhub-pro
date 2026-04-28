// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Wallet, Loader2, CheckSquare, Square } from 'lucide-react';
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
}

export function ExpensePaymentSection({ enabled, setEnabled, expensePayments, setExpensePayments, refreshKey }: Props) {
  const [isOpen, setIsOpen] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [allExpenses, setAllExpenses] = useState<UnpaidExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      setLoading(true);
      try {
        const { data: exps } = await supabase
          .from('expenses')
          .select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date')
          .neq('payment_status', 'paid')
          .not('employee_id', 'is', null)
          .order('expense_date', { ascending: false });

        const empIds = Array.from(new Set((exps || []).map((e: any) => e.employee_id).filter(Boolean)));
        let empList: Employee[] = [];
        let empMap: Record<string, string> = {};
        if (empIds.length) {
          const { data: emps } = await supabase.from('employees').select('id, name').in('id', empIds).order('name');
          empList = (emps || []) as Employee[];
          empMap = Object.fromEntries(empList.map((e) => [e.id, e.name]));
        }
        setEmployees(empList);

        setAllExpenses((exps || []).map((e: any) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          paid_amount: Number(e.paid_amount || 0),
          remaining: Math.max(0, Number(e.amount) - Number(e.paid_amount || 0)),
          employee_id: e.employee_id,
          employee_name: e.employee_id ? empMap[e.employee_id] : undefined,
          category: e.category,
          expense_date: e.expense_date,
        })).filter(e => e.remaining > 0));
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled, refreshKey]);

  // Filter by selected employee
  const visibleExpenses = useMemo(
    () => selectedEmployeeId ? allExpenses.filter(e => e.employee_id === selectedEmployeeId) : [],
    [allExpenses, selectedEmployeeId]
  );

  // When employee changes, drop selections from other employees
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const visibleIds = new Set(allExpenses.filter(e => e.employee_id === selectedEmployeeId).map(e => e.id));
    setExpensePayments(expensePayments.filter(p => visibleIds.has(p.expense_id)));
  }, [selectedEmployeeId]);

  const toggle = (exp: UnpaidExpense, checked: boolean) => {
    if (checked) {
      setExpensePayments([...expensePayments.filter(p => p.expense_id !== exp.id), { expense_id: exp.id, amount: exp.remaining }]);
    } else {
      setExpensePayments(expensePayments.filter(p => p.expense_id !== exp.id));
    }
  };

  const updateAmount = (id: string, val: string, max: number) => {
    const n = Math.min(parseFloat(val) || 0, max);
    setExpensePayments(expensePayments.map(p => p.expense_id === id ? { ...p, amount: n } : p));
  };

  const allSelected = visibleExpenses.length > 0 && visibleExpenses.every(e => expensePayments.some(p => p.expense_id === e.id));

  const selectAll = () => {
    if (allSelected) {
      const visibleIds = new Set(visibleExpenses.map(e => e.id));
      setExpensePayments(expensePayments.filter(p => !visibleIds.has(p.expense_id)));
    } else {
      const others = expensePayments.filter(p => !visibleExpenses.some(e => e.id === p.expense_id));
      const additions = visibleExpenses.map(e => ({ expense_id: e.id, amount: e.remaining }));
      setExpensePayments([...others, ...additions]);
    }
  };

  const totalSelected = expensePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const employeeTotalRemaining = visibleExpenses.reduce((s, e) => s + e.remaining, 0);

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
                        return (
                          <div key={e.id} className="flex items-center gap-2 p-1.5 bg-background rounded border border-orange-200/40">
                            <Checkbox checked={!!sel} onCheckedChange={(v) => toggle(e, !!v)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{e.description}</div>
                              <div className="text-[10px] text-muted-foreground">
                                متبقي: {e.remaining.toLocaleString('ar-LY')} د.ل
                                {e.expense_date && ` · ${e.expense_date}`}
                                {e.category && ` · ${e.category}`}
                              </div>
                            </div>
                            {sel && (
                              <Input
                                type="number"
                                value={sel.amount || ''}
                                onChange={(ev) => updateAmount(e.id, ev.target.value, e.remaining)}
                                className="h-7 w-24 text-xs text-left"
                                dir="ltr"
                              />
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
