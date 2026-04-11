import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, X, Loader2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import type { Employee, EmployeeBalance, EmployeePaymentDistribution } from './types';

interface EmployeeDistributionSectionProps {
  enableEmployee: boolean;
  setEnableEmployee: (v: boolean) => void;
  employeePaymentDistributions: EmployeePaymentDistribution[];
  addEmployeePaymentDistribution: () => void;
  removeEmployeePaymentDistribution: (index: number) => void;
  updateEmployeePaymentDistribution: (index: number, field: 'employeeId' | 'amount' | 'paymentType', value: string | number) => void;
  getTotalEmployeePaymentAmount: () => number;
  employees: Employee[];
  employeeBalances: EmployeeBalance[];
  loadingEmployees: boolean;
  totalAmount: string;
}

export function EmployeeDistributionSection({
  enableEmployee, setEnableEmployee,
  employeePaymentDistributions,
  addEmployeePaymentDistribution,
  removeEmployeePaymentDistribution,
  updateEmployeePaymentDistribution,
  getTotalEmployeePaymentAmount,
  employees, employeeBalances, loadingEmployees, totalAmount,
}: EmployeeDistributionSectionProps) {
  const [isOpen, setIsOpen] = useState(enableEmployee);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enableEmployee}
            onCheckedChange={(checked) => {
              setEnableEmployee(checked as boolean);
              if (checked) setIsOpen(true);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <UserCheck className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold">دفع لموظفين</span>
          {enableEmployee && getTotalEmployeePaymentAmount() > 0 && (
            <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
              {getTotalEmployeePaymentAmount().toFixed(0)} د.ل
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {enableEmployee && (
          <div className="space-y-2 p-3 mt-1 bg-green-50/50 dark:bg-green-950/10 rounded-lg border border-green-200/50 dark:border-green-800/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-green-700 dark:text-green-400">توزيع الدفع على الموظفين</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEmployeePaymentDistribution} className="gap-1 h-7 text-xs border-green-300">
                <Plus className="h-3 w-3" /> إضافة
              </Button>
            </div>

            {loadingEmployees ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {employeePaymentDistributions.map((distribution, index) => {
                  const balance = employeeBalances.find(b => b.employeeId === distribution.employeeId);
                  return (
                    <div key={index} className="p-2 bg-background rounded-lg border border-green-200/50 dark:border-green-800/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select value={distribution.employeeId} onValueChange={(value) => updateEmployeePaymentDistribution(index, 'employeeId', value)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اختر موظف" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => {
                                const empBalance = employeeBalances.find(b => b.employeeId === employee.id);
                                return (
                                  <SelectItem key={employee.id} value={employee.id}>
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span>{employee.name}</span>
                                      {empBalance && empBalance.pendingAmount > 0 && (
                                        <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700">
                                          {empBalance.pendingAmount.toFixed(0)} د.ل
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        {employeePaymentDistributions.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeEmployeePaymentDistribution(index)} className="h-7 w-7 text-red-500">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {distribution.employeeId && (
                        <div className="space-y-1.5">
                          {balance && balance.pendingAmount > 0 ? (
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded border border-green-300 dark:border-green-700">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-green-800 dark:text-green-300">رصيد ({balance.teamName})</span>
                                <Badge className="bg-green-600 text-white text-[10px]">{balance.pendingAmount.toFixed(0)} د.ل</Badge>
                              </div>
                              <div className="flex gap-1.5">
                                <Button type="button" size="sm" variant={distribution.paymentType === 'from_balance' ? 'default' : 'outline'} onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'from_balance')} className="flex-1 text-[10px] h-6">
                                  سحب من الرصيد
                                </Button>
                                <Button type="button" size="sm" variant={distribution.paymentType === 'advance' ? 'default' : 'outline'} onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'advance')} className="flex-1 text-[10px] h-6">
                                  سلفة
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                              <span className="text-[10px] text-amber-700 dark:text-amber-400">⚠️ لا رصيد - سلفة</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <Input type="number" value={distribution.amount || ''} onChange={(e) => updateEmployeePaymentDistribution(index, 'amount', e.target.value)} placeholder="المبلغ" className="h-8 text-xs text-left flex-1" dir="ltr" />
                            <span className="text-[10px] text-muted-foreground">د.ل</span>
                            {balance && balance.pendingAmount > 0 && distribution.paymentType === 'from_balance' && (
                              <Button type="button" size="sm" variant="outline" onClick={() => updateEmployeePaymentDistribution(index, 'amount', Math.min(balance.pendingAmount, parseFloat(totalAmount) || 0))} className="text-[10px] h-7">كامل</Button>
                            )}
                          </div>

                          {distribution.paymentType === 'from_balance' && balance && distribution.amount > balance.pendingAmount && (
                            <div className="text-[10px] text-red-600">⚠️ أكبر من الرصيد ({balance.pendingAmount.toFixed(0)} د.ل)</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1.5 border-t border-green-200 text-xs">
                  <span className="text-green-700">إجمالي الموظفين:</span>
                  <span className="font-bold text-green-700">{getTotalEmployeePaymentAmount().toFixed(2)} د.ل</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
