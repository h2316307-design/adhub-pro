import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, Receipt, Printer, Building2, CreditCard, Percent, Layers, Calculator } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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
  totalFriendRentals?: number;
  totalCompositeTasks?: number;
  totalDebits?: number;
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
  totalPrintedInvoices = 0,
  totalFriendRentals = 0,
  totalCompositeTasks = 0,
  totalDebits = 0
}: SummaryCardsProps) {
  // حساب نسبة السداد
  const paymentPercentage = totalRent > 0 ? Math.min(100, Math.round((totalCredits / totalRent) * 100)) : 0;
  
  // حساب نسبة السداد الإجمالية
  const overallPaymentPercentage = totalDebits > 0 ? Math.min(100, Math.round((totalCredits / totalDebits) * 100)) : 0;
  
  return (
    <div className="container mx-auto px-6 py-6">
      {/* كرت الملخص المالي الشامل */}
      <Card className="mb-6 border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-primary/20 to-transparent border-b border-white/10">
            <div className="w-12 h-12 bg-primary/30 rounded-xl flex items-center justify-center">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">الملخص المالي الشامل</h3>
              <p className="text-sm text-slate-400">جميع المعاملات المالية للعميل</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-white/10">
            {/* إجمالي الديون */}
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-sky-400" />
                <p className="text-sm font-medium text-slate-400">إجمالي الديون</p>
              </div>
              <p className="text-3xl font-bold text-sky-400">{totalDebits.toLocaleString('ar-LY')}</p>
              <p className="text-xs text-slate-500 mt-1">إجمالي المبيعات</p>
            </div>
            
            {/* إجمالي المدفوعات */}
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-medium text-slate-400">إجمالي المدفوعات</p>
              </div>
              <p className="text-3xl font-bold text-emerald-400">{totalCredits.toLocaleString('ar-LY')}</p>
              <p className="text-xs text-slate-500 mt-1">جميع الدفعات المستلمة</p>
            </div>
            
            {/* ✅ المتبقي الإجمالي (بدون إيجارات الصديقة) - الرئيسي والكبير */}
            <div className="p-6 text-center bg-gradient-to-b from-rose-500/20 to-transparent border-2 border-rose-500/30 rounded-lg mx-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-6 w-6 text-rose-400" />
                <p className="text-sm font-bold text-rose-300">المتبقي الإجمالي</p>
              </div>
              <p className="text-4xl font-bold text-rose-400">
                {(balance + totalFriendRentals) >= 0 
                  ? (balance + totalFriendRentals).toLocaleString('ar-LY') 
                  : `(${Math.abs(balance + totalFriendRentals).toLocaleString('ar-LY')})`}
              </p>
              <p className="text-xs text-rose-300 mt-2 font-medium">
                {(balance + totalFriendRentals) < 0 ? 'رصيد دائن للعميل' : 'مستحق على العميل'}
              </p>
              <p className="text-xs text-slate-500 mt-1">بدون إيجارات الصديقة</p>
            </div>
            
            {/* ✅ الرصيد النهائي (شامل إيجارات الصديقة) - ثانوي */}
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                <p className="text-sm font-medium text-slate-400">الرصيد النهائي</p>
              </div>
              <p className={`text-2xl font-bold ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {balance >= 0 ? balance.toLocaleString('ar-LY') : `(${Math.abs(balance).toLocaleString('ar-LY')})`}
              </p>
              <p className="text-xs text-slate-500 mt-1">شامل إيجارات الصديقة</p>
              {totalFriendRentals > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  ({totalFriendRentals.toLocaleString('ar-LY')})
                </p>
              )}
            </div>
          </div>
          
          {/* شريط نسبة السداد */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>نسبة السداد الإجمالية</span>
              <span className={`font-bold ${
                overallPaymentPercentage >= 100 ? 'text-emerald-400' :
                overallPaymentPercentage >= 50 ? 'text-amber-400' :
                'text-rose-400'
              }`}>{overallPaymentPercentage}%</span>
            </div>
            <div className="h-3 w-full bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  overallPaymentPercentage >= 100 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                  overallPaymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                  'bg-gradient-to-r from-rose-600 to-rose-400'
                }`}
                style={{ width: `${Math.min(100, overallPaymentPercentage)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* البطاقات الرئيسية الكبيرة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* إجمالي العقود */}
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-background shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">إجمالي العقود</p>
                <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{totalRent.toLocaleString('ar-LY')}</p>
                <p className="text-xs text-muted-foreground mt-1">دينار ليبي</p>
              </div>
              <div className="w-14 h-14 bg-sky-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                <TrendingUp className="h-7 w-7 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* إجمالي المدفوع */}
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">إجمالي المدفوع</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalCredits.toLocaleString('ar-LY')}</p>
                <p className="text-xs text-muted-foreground mt-1">دينار ليبي</p>
              </div>
              <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                <CreditCard className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المتبقي */}
        <Card className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
          balance > 0 
            ? 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-background' 
            : 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background'
        }`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500 ${
            balance > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'
          }`} />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {balance < 0 ? 'فائض لصالح العميل' : 'المتبقي'}
                </p>
                <p className={`text-3xl font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {balance >= 0 ? balance.toLocaleString('ar-LY') : Math.abs(balance).toLocaleString('ar-LY')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {balance < 0 ? 'رصيد دائن للعميل' : 'مستحق على العميل'}
                </p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                balance > 0 ? 'bg-rose-500/20' : 'bg-emerald-500/20'
              }`}>
                <DollarSign className={`h-7 w-7 ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* نسبة السداد */}
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-background shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">نسبة السداد</p>
                <p className={`text-3xl font-bold ${
                  paymentPercentage >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                  paymentPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                  'text-rose-600 dark:text-rose-400'
                }`}>{paymentPercentage}%</p>
              </div>
              <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                <Percent className="h-7 w-7 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  paymentPercentage >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                  paymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                  'bg-gradient-to-r from-rose-500 to-rose-400'
                }`}
                style={{ width: `${Math.min(100, paymentPercentage)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البطاقات الثانوية */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* الخصومات */}
        <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">الخصومات</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 truncate">{(totalDiscounts || 0).toLocaleString('ar-LY')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* رصيد الحساب */}
        <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">رصيد الحساب</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">{accountPayments.toLocaleString('ar-LY')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* فواتير الطباعة */}
        <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-indigo-500/20 bg-indigo-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Printer className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">فواتير الطباعة</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 truncate">{totalPrintedInvoices.toLocaleString('ar-LY')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المشتريات */}
        <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">المشتريات</p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400 truncate">{totalPurchases.toLocaleString('ar-LY')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المبيعات */}
        <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-teal-500/20 bg-teal-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">المبيعات</p>
                <p className="text-lg font-bold text-teal-600 dark:text-teal-400 truncate">{totalSales.toLocaleString('ar-LY')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* إيجارات الشركة الصديقة */}
        {totalFriendRentals > 0 && (
          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-orange-500/20 bg-orange-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">شركة صديقة</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400 truncate">{totalFriendRentals.toLocaleString('ar-LY')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* الفواتير المجمعة */}
        {totalCompositeTasks > 0 && (
          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-pink-500/20 bg-pink-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                  <Layers className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">فواتير مجمعة</p>
                  <p className="text-lg font-bold text-pink-600 dark:text-pink-400 truncate">{totalCompositeTasks.toLocaleString('ar-LY')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* تواريخ مهمة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-r from-violet-500/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">آخر عقد</p>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                  {lastContractDate ? new Date(lastContractDate).toLocaleDateString('ar-LY') : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-r from-cyan-500/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Receipt className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">آخر دفعة</p>
                <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                  {lastPaymentDate ? new Date(lastPaymentDate).toLocaleDateString('ar-LY') : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
