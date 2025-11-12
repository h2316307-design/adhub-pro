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
    <div className="container mx-auto px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* إجمالي العقود */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-sky-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي العقود</CardTitle>
            <div className="p-2 bg-sky-500/10 rounded-lg group-hover:bg-sky-500/20 transition-colors">
              <TrendingUp className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">{totalRent.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">قيمة جميع العقود</p>
          </CardContent>
        </Card>

        {/* إجمالي الديون */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الديون</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalGeneralDebt.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">العقود + الديون + الفواتير</p>
          </CardContent>
        </Card>

        {/* إجمالي المدفوع */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المدفوع</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <TrendingDown className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalCredits.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">جميع المدفوعات</p>
          </CardContent>
        </Card>

        {/* الخصومات */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الخصومات</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{(totalDiscounts || 0).toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الخصومات</p>
          </CardContent>
        </Card>

        {/* المتبقي من إجمالي الديون */}
        <Card className={`group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 ${balance >= 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المتبقي من إجمالي الديون</CardTitle>
            <div className={`p-2 ${balance >= 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'} rounded-lg group-hover:${balance >= 0 ? 'bg-rose-500/20' : 'bg-emerald-500/20'} transition-colors`}>
              <DollarSign className={`h-4 w-4 ${balance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {balance >= 0 
                ? `${balance.toLocaleString('ar-LY')} د.ل` 
                : `(${Math.abs(balance).toLocaleString('ar-LY')}) د.ل`
              }
            </div>
            {balance < 0 ? (
              <p className="text-xs text-emerald-600 mt-1 font-medium">رصيد دائن</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">المتبقي من جميع الديون</p>
            )}
          </CardContent>
        </Card>

        {/* إجمالي الباقي */}
        <Card className={`group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 ${accountPayments >= 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الباقي</CardTitle>
            <div className={`p-2 ${accountPayments >= 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'} rounded-lg group-hover:${accountPayments >= 0 ? 'bg-rose-500/20' : 'bg-emerald-500/20'} transition-colors`}>
              <Wallet className={`h-4 w-4 ${accountPayments >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${accountPayments >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {accountPayments.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">الرصيد الإجمالي للحساب</p>
          </CardContent>
        </Card>

        {/* آخر عقد */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-violet-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">آخر عقد</CardTitle>
            <div className="p-2 bg-violet-500/10 rounded-lg group-hover:bg-violet-500/20 transition-colors">
              <Calendar className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-violet-600">
              {lastContractDate 
                ? new Date(lastContractDate).toLocaleDateString('ar-LY')
                : '—'
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">تاريخ آخر عقد</p>
          </CardContent>
        </Card>

        {/* آخر دفعة */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">آخر دفعة</CardTitle>
            <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
              <Receipt className="h-4 w-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-600">
              {lastPaymentDate 
                ? new Date(lastPaymentDate).toLocaleDateString('ar-LY')
                : '—'
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">تاريخ آخر دفعة</p>
          </CardContent>
        </Card>

        {/* مشتريات من الزبون */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">مشتريات من الزبون</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <TrendingDown className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalPurchases.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">فواتير الشراء</p>
          </CardContent>
        </Card>

        {/* مبيعات للزبون */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">مبيعات للزبون</CardTitle>
            <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{totalSales.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">فواتير المبيعات</p>
          </CardContent>
        </Card>

        {/* فواتير الطباعة */}
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">فواتير الطباعة</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Printer className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalPrintedInvoices.toLocaleString('ar-LY')} د.ل</div>
            <p className="text-xs text-muted-foreground mt-1">إجمالي فواتير الطباعة</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}