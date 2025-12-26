import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, FileText, Wrench, Printer, Building2, Users, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RevenueData {
  contracts: number;
  reinstallation: number;
  installation: number;
  printing: number;
  cutout: number;
  operatingFees: number;
  friendRentals: number;
  partnerships: number;
  total: number;
}

interface RevenueStats {
  current: RevenueData;
  previous: RevenueData;
  expenses: number;
  netProfit: number;
}

export default function Revenue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [stats, setStats] = useState<RevenueStats | null>(null);

  // Calculate date ranges based on period
  const dateRanges = useMemo(() => {
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    switch (period) {
      case 'week':
        currentStart = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
        currentEnd = endOfWeek(now, { weekStartsOn: 6 });
        previousStart = subWeeks(currentStart, 1);
        previousEnd = subWeeks(currentEnd, 1);
        break;
      case 'month':
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        previousStart = subMonths(currentStart, 1);
        previousEnd = endOfMonth(previousStart);
        break;
      case 'year':
        currentStart = startOfYear(now);
        currentEnd = endOfYear(now);
        previousStart = subYears(currentStart, 1);
        previousEnd = endOfYear(previousStart);
        break;
    }

    return {
      current: { start: format(currentStart, 'yyyy-MM-dd'), end: format(currentEnd, 'yyyy-MM-dd') },
      previous: { start: format(previousStart, 'yyyy-MM-dd'), end: format(previousEnd, 'yyyy-MM-dd') }
    };
  }, [period]);

  // Fetch revenue data
  React.useEffect(() => {
    fetchRevenueData();
  }, [period, dateRanges]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      // Fetch contracts revenue
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Total, "Contract Date"')
        .gte('Contract Date', dateRanges.current.start)
        .lte('Contract Date', dateRanges.current.end);

      const contractsRevenue = contractsData?.reduce((sum, c) => sum + (Number(c.Total) || 0), 0) || 0;

      // Fetch previous contracts revenue
      const { data: prevContractsData } = await supabase
        .from('Contract')
        .select('Total')
        .gte('Contract Date', dateRanges.previous.start)
        .lte('Contract Date', dateRanges.previous.end);

      const prevContractsRevenue = prevContractsData?.reduce((sum, c) => sum + (Number(c.Total) || 0), 0) || 0;

      // Fetch composite tasks (reinstallation)
      const { data: compositeData } = await supabase
        .from('composite_tasks')
        .select('customer_total, created_at, task_type')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end)
        .eq('task_type', 'reinstallation');

      const reinstallationRevenue = compositeData?.reduce((sum, t) => sum + (Number(t.customer_total) || 0), 0) || 0;

      // Fetch installation tasks revenue (from composite_tasks)
      const { data: installationData } = await supabase
        .from('composite_tasks')
        .select('customer_installation_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const installationRevenue = installationData?.reduce((sum, t) => sum + (Number(t.customer_installation_cost) || 0), 0) || 0;

      // Fetch printing revenue
      const { data: printingData } = await supabase
        .from('composite_tasks')
        .select('customer_print_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const printingRevenue = printingData?.reduce((sum, t) => sum + (Number(t.customer_print_cost) || 0), 0) || 0;

      // Fetch cutout revenue
      const { data: cutoutData } = await supabase
        .from('composite_tasks')
        .select('customer_cutout_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const cutoutRevenue = cutoutData?.reduce((sum, t) => sum + (Number(t.customer_cutout_cost) || 0), 0) || 0;

      // Fetch operating fees from contracts
      const { data: feesData } = await supabase
        .from('Contract')
        .select('fee, "Contract Date"')
        .gte('Contract Date', dateRanges.current.start)
        .lte('Contract Date', dateRanges.current.end);

      const operatingFeesRevenue = feesData?.reduce((sum, c) => {
        const fee = typeof c.fee === 'string' ? Number(c.fee) : (c.fee || 0);
        return sum + fee;
      }, 0) || 0;

      // Fetch friend rentals profit
      const { data: friendRentalsData } = await supabase
        .from('friend_billboard_rentals')
        .select('profit, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const friendRentalsRevenue = friendRentalsData?.reduce((sum, r) => sum + (Number(r.profit) || 0), 0) || 0;

      // Fetch partnerships revenue (from friend_billboard_rentals as proxy)
      // Note: shared_transactions doesn't have transaction_date field, using friend_billboard_rentals as alternative
      const { data: partnershipsData } = await supabase
        .from('friend_billboard_rentals')
        .select('profit, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      // Calculate 50% of friend rentals profit as partnerships estimate
      const partnershipsRevenue = (partnershipsData?.reduce((sum, r) => sum + (Number(r.profit) || 0), 0) || 0) * 0.5;

      // Fetch expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .gte('expense_date', dateRanges.current.start)
        .lte('expense_date', dateRanges.current.end);

      const totalExpenses = expensesData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      const currentRevenue: RevenueData = {
        contracts: contractsRevenue,
        reinstallation: reinstallationRevenue,
        installation: installationRevenue,
        printing: printingRevenue,
        cutout: cutoutRevenue,
        operatingFees: operatingFeesRevenue,
        friendRentals: friendRentalsRevenue,
        partnerships: partnershipsRevenue,
        total: contractsRevenue + reinstallationRevenue + installationRevenue + printingRevenue + cutoutRevenue + operatingFeesRevenue + friendRentalsRevenue + partnershipsRevenue
      };

      const previousRevenue: RevenueData = {
        contracts: prevContractsRevenue,
        reinstallation: 0,
        installation: 0,
        printing: 0,
        cutout: 0,
        operatingFees: 0,
        friendRentals: 0,
        partnerships: 0,
        total: prevContractsRevenue
      };

      setStats({
        current: currentRevenue,
        previous: previousRevenue,
        expenses: totalExpenses,
        netProfit: currentRevenue.total - totalExpenses
      });

    } catch (error: any) {
      console.error('Error fetching revenue data:', error);
      toast.error('فشل في تحميل بيانات الإيرادات');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'week': return 'أسبوعي';
      case 'month': return 'شهري';
      case 'year': return 'سنوي';
    }
  };

  const revenueItems = stats ? [
    {
      label: 'العقود',
      icon: FileText,
      amount: stats.current.contracts,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      label: 'إعادة التركيب',
      icon: Wrench,
      amount: stats.current.reinstallation,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    {
      label: 'التركيب',
      icon: Package,
      amount: stats.current.installation,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      label: 'الطباعة',
      icon: Printer,
      amount: stats.current.printing,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      label: 'القص',
      icon: Package,
      amount: stats.current.cutout,
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-950/30',
      borderColor: 'border-pink-200 dark:border-pink-800'
    },
    {
      label: 'رسوم التشغيل',
      icon: DollarSign,
      amount: stats.current.operatingFees,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
      borderColor: 'border-cyan-200 dark:border-cyan-800'
    },
    {
      label: 'إيجار الشركات الصديقة',
      icon: Building2,
      amount: stats.current.friendRentals,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    },
    {
      label: 'اللوحات المشتركة',
      icon: Users,
      amount: stats.current.partnerships,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
      borderColor: 'border-teal-200 dark:border-teal-800'
    }
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات الإيرادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">تقرير الإيرادات</h1>
              <p className="text-muted-foreground mt-1">عرض شامل للإيرادات والأرباح</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-lg">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(dateRanges.current.start), 'dd MMM', { locale: ar })} - {format(new Date(dateRanges.current.end), 'dd MMM yyyy', { locale: ar })}</span>
          </div>
        </div>

        {/* Period Tabs */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="week">أسبوعي</TabsTrigger>
            <TabsTrigger value="month">شهري</TabsTrigger>
            <TabsTrigger value="year">سنوي</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="space-y-6 mt-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">{formatCurrency(stats?.current.total || 0)}</span>
                    <span className="text-sm text-muted-foreground">د.ل</span>
                  </div>
                  {stats && stats.previous.total > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className={calculateChange(stats.current.total, stats.previous.total) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {calculateChange(stats.current.total, stats.previous.total).toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">مقارنة بـ{period === 'week' ? 'الأسبوع' : period === 'month' ? 'الشهر' : 'السنة'} السابق</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">المصاريف</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats?.expenses || 0)}</span>
                    <span className="text-sm text-muted-foreground">د.ل</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {((stats?.expenses || 0) / (stats?.current.total || 1) * 100).toFixed(1)}% من الإيرادات
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">صافي الربح</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats?.netProfit || 0)}</span>
                    <span className="text-sm text-muted-foreground">د.ل</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    هامش ربح: {((stats?.netProfit || 0) / (stats?.current.total || 1) * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown */}
            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  تفصيل مصادر الإيرادات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {revenueItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={index}
                        className={`${item.bgColor} ${item.borderColor} border rounded-lg p-4 space-y-3`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-lg ${item.bgColor}`}>
                            <Icon className={`h-5 w-5 ${item.color}`} />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {((item.amount / (stats?.current.total || 1)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                          <p className={`text-2xl font-bold ${item.color}`}>
                            {formatCurrency(item.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">د.ل</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Performance Indicators */}
            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  مؤشرات الأداء
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">متوسط الإيراد اليومي</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency((stats?.current.total || 0) / (period === 'week' ? 7 : period === 'month' ? 30 : 365))} د.ل
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">أكبر مصدر إيراد</span>
                    <span className="text-lg font-bold text-primary">
                      {revenueItems.reduce((max, item) => item.amount > max.amount ? item : max, revenueItems[0])?.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">نسبة الربحية</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {((stats?.netProfit || 0) / (stats?.current.total || 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}