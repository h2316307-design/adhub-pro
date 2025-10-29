import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, Receipt, Printer } from 'lucide-react';

interface SummaryCardsProps {
  totalRent: number;
  totalCredits: number;
  balance: number;
  totalDiscounts: number;
  totalGeneralDebt: number;
  accountPayments: number;
  lastContractDate?: string;
  lastPaymentDate?: string;
  totalPurchases?: number;
  totalSales?: number;
  totalPrintedInvoices?: number;
}

export function SummaryCards({
  totalRent,
  totalCredits,
  balance,
  totalDiscounts,
  totalGeneralDebt,
  accountPayments,
  lastContractDate,
  lastPaymentDate,
  totalPurchases = 0,
  totalSales = 0,
  totalPrintedInvoices = 0
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي العقود</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{totalRent.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card border-2 border-orange-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الديون</CardTitle>
          <TrendingUp className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{totalGeneralDebt.toLocaleString('ar-LY')} د.ل</div>
          <p className="text-xs text-muted-foreground mt-1">العقود + الديون + الفواتير</p>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المدفوع</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{totalCredits.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">الخصومات</CardTitle>
          <TrendingDown className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{(totalDiscounts || 0).toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">المتبقي</CardTitle>
          <DollarSign className={`h-4 w-4 ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {balance >= 0 
              ? `${balance.toLocaleString('ar-LY')} د.ل` 
              : `(${Math.abs(balance).toLocaleString('ar-LY')}) د.ل`
            }
          </div>
          {balance < 0 && (
            <p className="text-xs text-green-600 mt-1">رصيد دائن</p>
          )}
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">رصيد الحساب العام</CardTitle>
          <Wallet className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{accountPayments.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">آخر عقد</CardTitle>
          <Calendar className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-orange-600">
            {lastContractDate 
              ? new Date(lastContractDate).toLocaleDateString('ar-LY')
              : '—'
            }
          </div>
          {lastContractDate && (
            <p className="text-xs text-muted-foreground mt-1">تاريخ آخر عقد</p>
          )}
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">آخر دفعة</CardTitle>
          <Receipt className="h-4 w-4 text-cyan-600" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-cyan-600">
            {lastPaymentDate 
              ? new Date(lastPaymentDate).toLocaleDateString('ar-LY')
              : '—'
            }
          </div>
          {lastPaymentDate && (
            <p className="text-xs text-muted-foreground mt-1">تاريخ آخر دفعة</p>
          )}
        </CardContent>
      </Card>

      <Card className="expenses-summary-card border-2 border-purple-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">مشتريات من الزبون</CardTitle>
          <TrendingDown className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{totalPurchases.toLocaleString('ar-LY')} د.ل</div>
          <p className="text-xs text-muted-foreground mt-1">فواتير الشراء من الزبون</p>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card border-2 border-indigo-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">مبيعات للزبون</CardTitle>
          <TrendingUp className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-600">{totalSales.toLocaleString('ar-LY')} د.ل</div>
          <p className="text-xs text-muted-foreground mt-1">فواتير المبيعات للزبون</p>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card border-2 border-blue-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">فواتير الطباعة</CardTitle>
          <Printer className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{totalPrintedInvoices.toLocaleString('ar-LY')} د.ل</div>
          <p className="text-xs text-muted-foreground mt-1">إجمالي فواتير الطباعة</p>
        </CardContent>
      </Card>
    </div>
  );
}