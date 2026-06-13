import { DollarSign, CheckCircle, AlertCircle, Users, Wallet, Receipt, UserCheck } from 'lucide-react';

interface DistributionSummaryBarProps {
  inputAmountNum: number;
  totalAllocated: number;
  remainingToAllocate: number;
  breakdown?: {
    customer: number;
    employees: number;
    custody: number;
    expenses: number;
  };
}

export function DistributionSummaryBar({ inputAmountNum, totalAllocated, remainingToAllocate, breakdown }: DistributionSummaryBarProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">الكلي</span>
          </div>
          <div className="text-lg font-bold text-primary">
            {inputAmountNum.toLocaleString("ar-LY")}
            <span className="text-[10px] font-normal mr-0.5">د.ل</span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${
          totalAllocated > 0 
            ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30"
            : "bg-gradient-to-br from-accent/30 to-accent/10 border-border/50"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className={`h-3.5 w-3.5 ${totalAllocated > 0 ? "text-green-400" : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">الموزّع للعميل</span>
          </div>
          <div className={`text-lg font-bold ${totalAllocated > 0 ? "text-green-400" : "text-muted-foreground"}`}>
            {totalAllocated.toLocaleString("ar-LY")}
            <span className="text-[10px] font-normal mr-0.5">د.ل</span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${
          Math.abs(remainingToAllocate) < 0.01
            ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30"
            : remainingToAllocate < 0
              ? "bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30"
              : "bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            {Math.abs(remainingToAllocate) < 0.01 ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <AlertCircle className={`h-3.5 w-3.5 ${remainingToAllocate < 0 ? "text-red-400" : "text-amber-400"}`} />
            )}
            <span className="text-xs text-muted-foreground">المتبقي للعميل</span>
          </div>
          <div className={`text-lg font-bold ${
            Math.abs(remainingToAllocate) < 0.01 ? "text-green-400" : remainingToAllocate < 0 ? "text-red-400" : "text-amber-400"
          }`}>
            {remainingToAllocate.toLocaleString("ar-LY")}
            <span className="text-[10px] font-normal mr-0.5">د.ل</span>
          </div>
        </div>
      </div>

      {breakdown && (
        <div className="grid grid-cols-4 gap-1 text-[10px]">
          <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="flex items-center justify-center gap-0.5 text-blue-600 dark:text-blue-400">
              <Receipt className="h-2.5 w-2.5" /><span>عميل</span>
            </div>
            <div className="font-bold text-blue-700 dark:text-blue-300">{breakdown.customer.toFixed(0)}</div>
          </div>
          <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20 text-center">
            <div className="flex items-center justify-center gap-0.5 text-green-600 dark:text-green-400">
              <UserCheck className="h-2.5 w-2.5" /><span>موظفين</span>
            </div>
            <div className="font-bold text-green-700 dark:text-green-300">{breakdown.employees.toFixed(0)}</div>
          </div>
          <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="flex items-center justify-center gap-0.5 text-amber-600 dark:text-amber-400">
              <Wallet className="h-2.5 w-2.5" /><span>عهدة</span>
            </div>
            <div className="font-bold text-amber-700 dark:text-amber-300">{breakdown.custody.toFixed(0)}</div>
          </div>
          <div className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-center">
            <div className="flex items-center justify-center gap-0.5 text-orange-600 dark:text-orange-400">
              <Users className="h-2.5 w-2.5" /><span>مصاريف</span>
            </div>
            <div className="font-bold text-orange-700 dark:text-orange-300">{breakdown.expenses.toFixed(0)}</div>
          </div>
        </div>
      )}

      {inputAmountNum > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">نسبة توزيع دفعة العميل</span>
            <span className={`font-bold ${totalAllocated >= inputAmountNum ? "text-green-400" : "text-primary"}`}>
              {((totalAllocated / inputAmountNum) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                totalAllocated >= inputAmountNum 
                  ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                  : "bg-gradient-to-r from-primary to-primary/70"
              }`}
              style={{ width: `${Math.min((totalAllocated / inputAmountNum) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
