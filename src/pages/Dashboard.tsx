// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Calendar, FileText, Receipt, Monitor, Clock, Plus, Eye, Package, ChevronDown, ChevronUp, 
  TrendingUp, Users, BarChart3, MapPin, Image as ImageIcon, AlertTriangle, Layers, Building2, 
  RefreshCw, ArrowUpRight, Wallet, Target, Sparkles, Zap, Bell, Activity, TrendingDown,
  CircleDollarSign, PieChart, ArrowRight, CheckCircle2, XCircle, Timer, CalendarDays
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LegacyContract {
  Contract_Number: number;
  'Customer Name': string;
  'Ad Type': string;
  'Total Rent': number;
  'Start Date': string;
  'End Date': string;
  'Contract Date': string;
  customer_id: string;
  id: number;
  Total: number;
  billboards_count: number;
}

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  entry_type: string;
  created_at: string;
  contract_number: number | null;
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Level: string;
  Municipality: string;
  District: string;
  Status: string;
  created_at: string;
  Nearest_Landmark: string;
  Image_URL: string;
}

interface InstallationTeam {
  id: string;
  team_name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [legacyContracts, setLegacyContracts] = useState<LegacyContract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [allBillboards, setAllBillboards] = useState<Billboard[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [installationTasks, setInstallationTasks] = useState<any[]>([]);
  const [removalTasks, setRemovalTasks] = useState<any[]>([]);
  const [installationTeams, setInstallationTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  
  // حالات الطي
  const [chartsOpen, setChartsOpen] = useState(false);
  const [expiringSoonOpen, setExpiringSoonOpen] = useState(true);
  const [recentlyEndedOpen, setRecentlyEndedOpen] = useState(true);
  
  // حالة عرض الصورة
  const [selectedImage, setSelectedImage] = useState<{url: string; name: string} | null>(null);

  // تحميل البيانات
  const loadData = async () => {
    try {
      setLoading(true);

      // تحميل العقود القديمة
      const { data: legacyData, error: legacyError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract Date', { ascending: false });

      if (legacyError) {
        console.error('خطأ في تحميل العقود:', legacyError);
        toast.error(`فشل في تحميل العقود`);
      } else {
        setLegacyContracts(legacyData || []);
      }

      // تحميل المدفوعات مع رقم العقد
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .in('entry_type', ['receipt', 'account_payment', 'payment'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (!paymentsError) {
        setPayments(paymentsData || []);
      }

      // تحميل اللوحات مع الصورة وأقرب نقطة دالة
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Level, Municipality, District, Status, created_at, Nearest_Landmark, Image_URL')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!billboardsError) {
        setBillboards(billboardsData || []);
      }

      // تحميل جميع اللوحات للإحصائيات (مع حقل الشركة الصديقة)
      const { data: allBillboardsData } = await supabase
        .from('billboards')
        .select('ID, Size, Municipality, Status, friend_company_id');

      if (allBillboardsData) {
        setAllBillboards(allBillboardsData);
      }

      // تحميل فرق التركيب
      const { data: teamsData } = await supabase
        .from('installation_teams')
        .select('id, team_name');

      if (teamsData) {
        setInstallationTeams(teamsData);
      }

      // تحميل المهمات المتأخرة
      const today = new Date();
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .lt('due_date', today.toISOString())
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);

      setOverdueTasks(tasksData || []);

      // تحميل آخر مهام التركيب مع معلومات العقد
      const { data: installTasksData, error: installError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (installError) {
        console.error('خطأ في تحميل مهام التركيب:', installError);
      }

      // جلب معلومات العقود لمهام التركيب
      const enrichedInstallTasks = await Promise.all(
        (installTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select('"Customer Name", "Ad Type"')
              .eq('Contract_Number', task.contract_id)
              .maybeSingle();
            return {
              ...task,
              customer_name: contractData?.['Customer Name'] || 'غير محدد',
              ad_type: contractData?.['Ad Type'] || 'غير محدد'
            };
          }
          return { ...task, customer_name: 'غير محدد', ad_type: 'غير محدد' };
        })
      );

      setInstallationTasks(enrichedInstallTasks);

      // تحميل آخر مهام الإزالة
      const { data: removalTasksData, error: removalError } = await supabase
        .from('removal_tasks')
        .select('id, contract_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (removalError) {
        console.error('خطأ في تحميل مهام الإزالة:', removalError);
      }

      // جلب معلومات العقود لمهام الإزالة
      const enrichedRemovalTasks = await Promise.all(
        (removalTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select('"Customer Name", "Ad Type"')
              .eq('Contract_Number', task.contract_id)
              .maybeSingle();
            return {
              ...task,
              customer_name: contractData?.['Customer Name'] || 'غير محدد',
              ad_type: contractData?.['Ad Type'] || 'غير محدد'
            };
          }
          return { ...task, customer_name: 'غير محدد', ad_type: 'غير محدد' };
        })
      );

      setRemovalTasks(enrichedRemovalTasks);

    } catch (error) {
      console.error('خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // دالة للحصول على اسم الفريق
  const getTeamName = (teamId: string) => {
    const team = installationTeams.find(t => t.id === teamId);
    return team?.team_name || 'غير محدد';
  };

  // دالة للحصول على نوع الإعلان من العقد
  const getAdTypeFromContract = (contractId: number) => {
    const contract = legacyContracts.find(c => c.Contract_Number === contractId);
    return contract?.['Ad Type'] || 'غير محدد';
  };

  // العقود التي تقارب على الانتهاء
  const expiringContracts = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const legacyExpiring = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate >= today && endDate <= thirtyDaysFromNow;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        end_date: contract['End Date'] || '',
        total_amount: Number(contract['Total']) || 0,
        billboards_count: contract.billboards_count || 0,
        source: 'legacy'
      }));

    const sorted = legacyExpiring.sort((a, b) => {
      const daysLeftA = differenceInDays(new Date(a.end_date), today);
      const daysLeftB = differenceInDays(new Date(b.end_date), today);
      return daysLeftA - daysLeftB;
    });

    return sorted.slice(0, 10);
  }, [legacyContracts]);

  // العقود المنتهية مؤخراً - 10 عقود
  const recentlyEndedContracts = useMemo(() => {
    const today = new Date();

    const legacyEnded = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate < today;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        end_date: contract['End Date'] || '',
        total_amount: Number(contract['Total']) || 0,
        billboards_count: contract.billboards_count || 0,
        days_ago: Math.abs(differenceInDays(new Date(contract['End Date']), today))
      }));

    return legacyEnded.sort((a, b) => a.days_ago - b.days_ago).slice(0, 10);
  }, [legacyContracts]);

  // آخر العقود المضافة
  const recentContracts = useMemo(() => {
    const legacyRecent = legacyContracts
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        total_amount: Number(contract['Total']) || 0,
        created_at: contract['Contract Date'] || '',
        billboards_count: contract.billboards_count || 0,
        date_for_sorting: new Date(contract['Contract Date'] || '1970-01-01').getTime(),
      }));

    return legacyRecent.sort((a, b) => b.date_for_sorting - a.date_for_sorting).slice(0, 5);
  }, [legacyContracts]);

  // آخر المدفوعات مع رقم العقد
  const recentPayments = useMemo(() => {
    return payments
      .filter(p => 
        (p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment') &&
        p.amount > 0
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [payments]);

  // آخر اللوحات المضافة
  const recentBillboards = useMemo(() => {
    return billboards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [billboards]);

  // أفضل 5 عملاء من حيث المبيعات
  const topCustomers = useMemo(() => {
    const customerTotals: { [key: string]: number } = {};
    
    legacyContracts.forEach(contract => {
      const customerName = contract['Customer Name'];
      if (customerName) {
        customerTotals[customerName] = (customerTotals[customerName] || 0) + (Number(contract['Total']) || 0);
      }
    });

    return Object.entries(customerTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [legacyContracts]);

  // ✅ فصل اللوحات الخاصة عن لوحات الشركات الصديقة
  const ownBillboards = useMemo(() => {
    return allBillboards.filter(b => !b.friend_company_id);
  }, [allBillboards]);

  const friendBillboards = useMemo(() => {
    return allBillboards.filter(b => !!b.friend_company_id);
  }, [allBillboards]);

  // بيانات الرسوم البيانية - اللوحات الخاصة فقط
  const billboardStatusData = useMemo(() => {
    const available = ownBillboards.filter(b => b.Status === 'متاح' || b.Status === 'available').length;
    const unavailable = ownBillboards.length - available;
    return [
      { name: 'متاح', value: available, color: '#22c55e' },
      { name: 'غير متاح', value: unavailable, color: '#ef4444' },
    ];
  }, [ownBillboards]);

  // ✅ توزيع الأحجام - جميع الأحجام بدون حد (اللوحات الخاصة فقط)
  const sizeDistributionData = useMemo(() => {
    const sizeCounts: { [key: string]: number } = {};
    ownBillboards.forEach(b => {
      if (b.Size) {
        sizeCounts[b.Size] = (sizeCounts[b.Size] || 0) + 1;
      }
    });
    return Object.entries(sizeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
      // ✅ إزالة .slice لعرض جميع الأحجام
  }, [ownBillboards]);

  // ✅ توزيع أحجام لوحات الشركات الصديقة
  const friendSizeDistributionData = useMemo(() => {
    const sizeCounts: { [key: string]: number } = {};
    friendBillboards.forEach(b => {
      if (b.Size) {
        sizeCounts[b.Size] = (sizeCounts[b.Size] || 0) + 1;
      }
    });
    return Object.entries(sizeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [friendBillboards]);

  const municipalityData = useMemo(() => {
    const muniCounts: { [key: string]: number } = {};
    ownBillboards.forEach(b => {
      if (b.Municipality) {
        muniCounts[b.Municipality] = (muniCounts[b.Municipality] || 0) + 1;
      }
    });
    return Object.entries(muniCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
      // ✅ إزالة .slice لعرض جميع البلديات
  }, [ownBillboards]);

  // حساب الأيام المتبقية
  const getDaysLeft = (endDate: string) => {
    try {
      const today = new Date();
      const end = new Date(endDate);
      return differenceInDays(end, today);
    } catch (error) {
      return 0;
    }
  };

  const getExpiryBadgeColor = (daysLeft: number) => {
    if (daysLeft <= 3) return 'bg-red-500 text-white';
    if (daysLeft <= 7) return 'bg-orange-500 text-white';
    if (daysLeft <= 15) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  const formatDateSafe = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // حساب إجمالي المبيعات
  const totalSales = useMemo(() => {
    return legacyContracts.reduce((sum, c) => sum + (Number(c['Total']) || 0), 0);
  }, [legacyContracts]);

  // حساب إجمالي المدفوعات
  const totalPaymentsAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  // العقود النشطة
  const activeContracts = useMemo(() => {
    const today = new Date();
    return legacyContracts.filter(contract => {
      try {
        if (!contract['End Date']) return false;
        const endDate = new Date(contract['End Date']);
        return endDate >= today;
      } catch {
        return false;
      }
    }).length;
  }, [legacyContracts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-foreground font-semibold text-lg">جاري تحميل لوحة التحكم...</p>
          <p className="text-muted-foreground text-sm">يتم تحميل الإحصائيات والبيانات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <OverduePaymentsAlert />
      
      {/* ✅ الهيدر الرئيسي - تصميم عصري */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-6 border border-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/25">
              <BarChart3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">لوحة التحكم</h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                نظرة شاملة على النظام والعقود
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={loadData} 
              variant="outline" 
              disabled={loading}
              className="gap-2 rounded-xl border-2 hover:bg-primary/10"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              تحديث
            </Button>
            <Badge variant="outline" className="px-4 py-2 rounded-xl bg-background/80 backdrop-blur">
              <CalendarDays className="h-4 w-4 ml-2 text-primary" />
              {format(new Date(), 'dd MMMM yyyy', { locale: ar })}
            </Badge>
          </div>
        </div>
      </div>

      {/* ✅ إحصائيات سريعة - تصميم محسن */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي العقود"
          value={legacyContracts.length}
          subtitle={`${totalSales.toLocaleString('ar-LY')} د.ل`}
          icon={<FileText className="h-6 w-6" />}
          color="blue"
          trend={activeContracts}
          trendLabel="نشط"
        />
        
        <StatCard
          title="عقود منتهية"
          value={recentlyEndedContracts.length}
          subtitle="تحتاج متابعة"
          icon={<AlertTriangle className="h-6 w-6" />}
          color="red"
          onClick={() => navigate('/admin/contracts')}
        />
        
        <StatCard
          title="المدفوعات"
          value={payments.length}
          subtitle={`${totalPaymentsAmount.toLocaleString('ar-LY')} د.ل`}
          icon={<CircleDollarSign className="h-6 w-6" />}
          color="green"
          onClick={() => navigate('/admin/payments-receipts-page')}
        />
        
        <StatCard
          title="اللوحات"
          value={allBillboards.length}
          subtitle={`${billboardStatusData[0]?.value || 0} متاح`}
          icon={<Layers className="h-6 w-6" />}
          color="purple"
          onClick={() => navigate('/admin/billboards')}
        />
      </div>

      {/* ✅ الإجراءات السريعة - تصميم محسن */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
        <CardHeader className="pb-4 relative">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span>الإجراءات السريعة</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickActionButton
              icon={<Plus className="h-5 w-5" />}
              label="إضافة عقد"
              onClick={() => navigate('/admin/contracts/new')}
              variant="primary"
            />
            <QuickActionButton
              icon={<FileText className="h-5 w-5" />}
              label="عرض العقود"
              onClick={() => navigate('/admin/contracts')}
              variant="outline"
            />
            <QuickActionButton
              icon={<Receipt className="h-5 w-5" />}
              label="العملاء والدفعات"
              onClick={() => navigate('/admin/customers')}
              variant="outline"
            />
            <QuickActionButton
              icon={<Monitor className="h-5 w-5" />}
              label="اللوحات"
              onClick={() => navigate('/admin/billboards')}
              variant="outline"
            />
          </div>
        </CardContent>
      </Card>

      {/* ✅ العقود المنتهية - تصميم محسن */}
      <Card className="border-2 border-red-500/30 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <span>العقود المنتهية</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">آخر 10 عقود انتهت</p>
              </div>
              <Badge className="bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20">
                {recentlyEndedContracts.length}
              </Badge>
            </CardTitle>
            <Link to="/admin/contracts">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-red-600">
                عرض الكل
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentlyEndedContracts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} message="لا توجد عقود منتهية" color="green" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {recentlyEndedContracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  variant="ended"
                  onClick={() => navigate(`/admin/contracts/${contract.contract_number}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ العقود قريبة الانتهاء */}
      <Card className="border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-500/5 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20">
                <Timer className="h-5 w-5 text-white" />
              </div>
              <div>
                <span>قريبة الانتهاء</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">خلال 30 يوم</p>
              </div>
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20">
                {expiringContracts.length}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {expiringContracts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} message="لا توجد عقود قريبة الانتهاء" color="green" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {expiringContracts.map((contract) => {
                const daysLeft = getDaysLeft(contract.end_date);
                return (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    daysLeft={daysLeft}
                    variant="expiring"
                    onClick={() => navigate(`/admin/contracts/${contract.contract_number}`)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ إحصائيات اللوحات */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <Card className="border-border overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                    <PieChart className="h-5 w-5 text-primary-foreground" />
                  </div>
                  إحصائيات اللوحات
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {allBillboards.length} لوحة
                  </Badge>
                  {chartsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ✅ إحصائيات اللوحات الخاصة */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="bg-primary">لوحاتنا</Badge>
                    <span className="text-sm text-muted-foreground">({ownBillboards.length} لوحة)</span>
                  </div>
                  
                  {/* حالة اللوحات الخاصة */}
                  <div className="p-5 bg-muted/30 rounded-2xl border border-border/50">
                    <h4 className="font-bold text-center mb-4 flex items-center justify-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      حالة اللوحات
                    </h4>
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-green-500/30">
                          {billboardStatusData[0]?.value || 0}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-green-600 dark:text-green-400">متاح</p>
                      </div>
                      <div className="text-2xl text-muted-foreground/30">/</div>
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-red-500/30">
                          {billboardStatusData[1]?.value || 0}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">مؤجر</p>
                      </div>
                    </div>
                    <div className="mt-4 bg-muted/50 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 rounded-full"
                        style={{ width: `${ownBillboards.length > 0 ? ((billboardStatusData[0]?.value || 0) / ownBillboards.length) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      نسبة الإتاحة: {ownBillboards.length > 0 ? Math.round(((billboardStatusData[0]?.value || 0) / ownBillboards.length) * 100) : 0}%
                    </p>
                  </div>

                  {/* توزيع الأحجام - لوحاتنا */}
                  <div className="p-5 bg-muted/30 rounded-2xl border border-border/50">
                    <h4 className="font-bold text-center mb-3 flex items-center justify-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      توزيع الأحجام
                      <Badge variant="secondary" className="text-xs">{sizeDistributionData.length}</Badge>
                    </h4>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {sizeDistributionData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#14b8a6', '#f97316'][i % 10] }} />
                          <span className="flex-1 text-sm truncate">{item.name}</span>
                          <Badge variant="secondary" className="font-mono text-xs">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* توزيع البلديات */}
                  <div className="p-5 bg-muted/30 rounded-2xl border border-border/50">
                    <h4 className="font-bold text-center mb-3 flex items-center justify-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      توزيع البلديات
                      <Badge variant="secondary" className="text-xs">{municipalityData.length}</Badge>
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {municipalityData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 8] }} />
                          <span className="flex-1 text-sm truncate">{item.name}</span>
                          <Badge variant="secondary" className="font-mono text-xs">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ✅ إحصائيات لوحات الشركات الصديقة */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">الشركات الصديقة</Badge>
                    <span className="text-sm text-muted-foreground">({friendBillboards.length} لوحة)</span>
                  </div>
                  
                  {friendBillboards.length === 0 ? (
                    <div className="p-8 bg-muted/30 rounded-2xl border border-border/50 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">لا توجد لوحات للشركات الصديقة</p>
                    </div>
                  ) : (
                    <>
                      {/* حالة لوحات الشركات الصديقة */}
                      <div className="p-5 bg-orange-500/5 rounded-2xl border border-orange-500/20">
                        <h4 className="font-bold text-center mb-4 flex items-center justify-center gap-2">
                          <Users className="h-4 w-4 text-orange-500" />
                          حالة اللوحات
                        </h4>
                        <div className="flex items-center justify-center gap-6">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-green-500/30">
                              {friendBillboards.filter(b => b.Status === 'متاح' || b.Status === 'available').length}
                            </div>
                            <p className="mt-2 text-xs font-semibold text-green-600 dark:text-green-400">متاح</p>
                          </div>
                          <div className="text-2xl text-muted-foreground/30">/</div>
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-orange-500/30">
                              {friendBillboards.filter(b => b.Status !== 'متاح' && b.Status !== 'available').length}
                            </div>
                            <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400">مؤجر</p>
                          </div>
                        </div>
                      </div>

                      {/* توزيع الأحجام - الشركات الصديقة */}
                      <div className="p-5 bg-orange-500/5 rounded-2xl border border-orange-500/20">
                        <h4 className="font-bold text-center mb-3 flex items-center justify-center gap-2">
                          <Layers className="h-4 w-4 text-orange-500" />
                          توزيع الأحجام
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">{friendSizeDistributionData.length}</Badge>
                        </h4>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {friendSizeDistributionData.map((item, i) => (
                            <div key={item.name} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-orange-500/10 transition-colors">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ea580c', '#c2410c'][i % 6] }} />
                              <span className="flex-1 text-sm truncate">{item.name}</span>
                              <Badge variant="outline" className="font-mono text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">{item.value}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* رابط لعرض كل لوحات الشركات الصديقة */}
                  <Link to="/admin/friend-billboards" className="block">
                    <Button variant="outline" className="w-full gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10">
                      <Users className="h-4 w-4" />
                      عرض لوحات الشركات الصديقة
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ✅ آخر اللوحات المضافة */}
      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span>آخر اللوحات المضافة</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">أحدث 10 لوحات</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/30">
                {recentBillboards.length}
              </Badge>
            </div>
            <Link to="/admin/billboards">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                عرض الكل
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentBillboards.length === 0 ? (
            <EmptyState icon={<Monitor />} message="لا توجد لوحات مضافة حديثاً" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {recentBillboards.map((billboard) => (
                <div 
                  key={billboard.ID}
                  className="group p-3 bg-card rounded-xl border-2 border-border hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg"
                  onClick={() => billboard.Image_URL && setSelectedImage({ url: billboard.Image_URL, name: billboard.Billboard_Name || '' })}
                >
                  {/* صورة اللوحة */}
                  {billboard.Image_URL ? (
                    <div className="relative w-full h-20 rounded-lg overflow-hidden mb-2 bg-muted">
                      <img 
                        src={billboard.Image_URL} 
                        alt={billboard.Billboard_Name || ''} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-1 right-1">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background/80 backdrop-blur text-primary border-primary/30">
                          #{billboard.ID}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-20 rounded-lg mb-2 bg-muted/50 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      <div className="absolute top-1 right-1">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background/80 text-primary border-primary/30">
                          #{billboard.ID}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  <h4 className="font-bold text-xs text-foreground mb-1 truncate group-hover:text-primary transition-colors" title={billboard.Billboard_Name || ''}>
                    {billboard.Billboard_Name || 'بدون اسم'}
                  </h4>
                  
                  {/* البلدية والمنطقة */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{billboard.Municipality || billboard.District || 'غير محدد'}</span>
                  </div>
                  
                  {/* أقرب نقطة دالة */}
                  {billboard.Nearest_Landmark && (
                    <p className="text-[10px] text-muted-foreground mb-2 truncate" title={billboard.Nearest_Landmark}>
                      📍 {billboard.Nearest_Landmark}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="secondary" className="text-[10px] px-1.5">{billboard.Size || '-'}</Badge>
                    <Badge className={billboard.Status === 'متاح' || billboard.Status === 'available' ? 'bg-green-500/10 text-green-600 border-green-500/30 text-[10px] px-1.5' : 'bg-red-500/10 text-red-600 border-red-500/30 text-[10px] px-1.5'}>
                      {billboard.Status || 'غير محدد'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ مهام التركيب والإزالة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* آخر مهام التركيب */}
        <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span>مهام التركيب</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">آخر 5 مهام</p>
                </div>
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  {installationTasks.length}
                </Badge>
              </div>
              <Link to="/admin/operations">
                <Button variant="ghost" size="sm" className="gap-1 text-xs hover:text-blue-600">
                  عرض الكل
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {installationTasks.length === 0 ? (
              <EmptyState icon={<Package />} message="لا توجد مهام تركيب" />
            ) : (
              <div className="space-y-3">
                {installationTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 bg-muted/30 rounded-xl hover:bg-blue-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Package className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{task.customer_name || 'غير محدد'}</p>
                          <p className="text-xs text-muted-foreground">
                            عقد #{task.contract_id} • {getTeamName(task.team_id)}
                          </p>
                        </div>
                      </div>
                      <Badge className={
                        task.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                      }>
                        {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'قيد الانتظار'}
                      </Badge>
                    </div>
                    {/* نوع الإعلان */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <Badge variant="outline" className="text-xs bg-blue-500/5 text-blue-600 border-blue-500/20">
                        {task.ad_type || 'غير محدد'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر مهام الإزالة */}
        <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/5 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span>مهام الإزالة</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">آخر 5 مهام</p>
                </div>
                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                  {removalTasks.length}
                </Badge>
              </div>
              <Link to="/admin/operations">
                <Button variant="ghost" size="sm" className="gap-1 text-xs hover:text-purple-600">
                  عرض الكل
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {removalTasks.length === 0 ? (
              <EmptyState icon={<XCircle />} message="لا توجد مهام إزالة" />
            ) : (
              <div className="space-y-3">
                {removalTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 bg-muted/30 rounded-xl hover:bg-purple-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <XCircle className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{task.customer_name || 'غير محدد'}</p>
                          <p className="text-xs text-muted-foreground">
                            عقد #{task.contract_id}
                          </p>
                        </div>
                      </div>
                      <Badge className={
                        task.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                        task.status === 'in_progress' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                      }>
                        {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'قيد الانتظار'}
                      </Badge>
                    </div>
                    {/* نوع الإعلان */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <Badge variant="outline" className="text-xs bg-purple-500/5 text-purple-600 border-purple-500/20">
                        {task.ad_type || 'غير محدد'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ المهام المتأخرة / اليومية */}
      {overdueTasks.length > 0 && (
        <Card className="border-2 border-red-500/30 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
                <Bell className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <span>المهام المتأخرة</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">تحتاج متابعة عاجلة</p>
              </div>
              <Badge className="bg-red-500 text-white">
                {overdueTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl border border-red-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-red-600 dark:text-red-400">{task.title || 'مهمة بدون عنوان'}</p>
                      <p className="text-xs text-muted-foreground">
                        تأخر: {Math.abs(differenceInDays(new Date(task.due_date), new Date()))} يوم
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white">
                    متأخرة
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ آخر المدفوعات وأفضل العملاء */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* آخر المدفوعات */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <Wallet className="h-5 w-5 text-green-500" />
                </div>
                <span>آخر المدفوعات</span>
              </div>
              <Link to="/admin/payments-receipts-page">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  عرض الكل
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <EmptyState icon={<Wallet />} message="لا توجد مدفوعات حديثة" />
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div 
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Receipt className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{payment.customer_name || 'غير محدد'}</p>
                        <p className="text-xs text-muted-foreground">{formatDateSafe(payment.paid_at)}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30 font-mono">
                      +{payment.amount.toLocaleString('ar-LY')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* أفضل العملاء */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span>أفضل العملاء</span>
              </div>
              <Link to="/admin/customers">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  عرض الكل
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <EmptyState icon={<Users />} message="لا توجد بيانات عملاء" />
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div 
                    key={customer.name}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                        index === 1 ? "bg-gray-400/20 text-gray-600" :
                        index === 2 ? "bg-orange-500/20 text-orange-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <p className="font-medium text-sm truncate max-w-[150px]">{customer.name}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {customer.total.toLocaleString('ar-LY')} د.ل
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog عرض الصورة */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img 
              src={selectedImage.url} 
              alt={selectedImage.name}
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ✅ مكون بطاقة الإحصائية
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange';
  trend?: number;
  trendLabel?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color, trend, trendLabel, onClick }) => {
  const colors = {
    blue: {
      bg: 'from-blue-500/10 to-blue-500/5',
      border: 'border-blue-500/20 hover:border-blue-500/40',
      icon: 'bg-blue-500/10 group-hover:bg-blue-500/20',
      iconColor: 'text-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
    },
    red: {
      bg: 'from-red-500/10 to-red-500/5',
      border: 'border-red-500/20 hover:border-red-500/40',
      icon: 'bg-red-500/10 group-hover:bg-red-500/20',
      iconColor: 'text-red-500',
      text: 'text-red-600 dark:text-red-400',
    },
    green: {
      bg: 'from-green-500/10 to-green-500/5',
      border: 'border-green-500/20 hover:border-green-500/40',
      icon: 'bg-green-500/10 group-hover:bg-green-500/20',
      iconColor: 'text-green-500',
      text: 'text-green-600 dark:text-green-400',
    },
    purple: {
      bg: 'from-purple-500/10 to-purple-500/5',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      icon: 'bg-purple-500/10 group-hover:bg-purple-500/20',
      iconColor: 'text-purple-500',
      text: 'text-purple-600 dark:text-purple-400',
    },
    orange: {
      bg: 'from-orange-500/10 to-orange-500/5',
      border: 'border-orange-500/20 hover:border-orange-500/40',
      icon: 'bg-orange-500/10 group-hover:bg-orange-500/20',
      iconColor: 'text-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
    },
  };

  const c = colors[color];

  return (
    <Card 
      className={cn(
        "bg-gradient-to-br transition-all hover:shadow-xl group cursor-pointer",
        c.bg, c.border
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-4xl lg:text-5xl font-black font-mono tracking-tight", c.text)}>{value.toLocaleString('ar-LY')}</p>
            <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
            {trend !== undefined && (
              <Badge variant="secondary" className="text-xs mt-1">
                {trend} {trendLabel}
              </Badge>
            )}
          </div>
          <div className={cn("p-3 rounded-xl transition-colors", c.icon)}>
            <span className={c.iconColor}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ✅ مكون زر الإجراء السريع
interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'outline';
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ icon, label, onClick, variant }) => (
  <Button
    onClick={onClick}
    variant={variant === 'primary' ? 'default' : 'outline'}
    className={cn(
      "h-auto py-5 flex-col gap-3 rounded-xl transition-all",
      variant === 'primary' 
        ? "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]" 
        : "border-2 hover:bg-muted/50 hover:scale-[1.02]"
    )}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </Button>
);

// ✅ مكون بطاقة العقد
interface ContractCardProps {
  contract: {
    id: string;
    contract_number: string;
    customer_name: string;
    ad_type: string;
    end_date: string;
    total_amount: number;
    billboards_count: number;
    days_ago?: number;
  };
  daysLeft?: number;
  variant: 'ended' | 'expiring';
  onClick: () => void;
}

const ContractCard: React.FC<ContractCardProps> = ({ contract, daysLeft, variant, onClick }) => {
  const formatDateSafe = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const getExpiryBadgeColor = (days: number) => {
    if (days <= 3) return 'bg-red-500 text-white';
    if (days <= 7) return 'bg-orange-500 text-white';
    if (days <= 15) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  const isEnded = variant === 'ended';
  const borderColor = isEnded ? 'hover:border-red-500/40' : 'hover:border-orange-500/40';
  const badgeColor = isEnded ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-orange-500/10 text-orange-500 border-orange-500/30';

  return (
    <div 
      className={cn(
        "group p-4 bg-card rounded-xl border-2 border-border transition-all cursor-pointer hover:shadow-lg",
        borderColor
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant="outline" className={cn("font-mono text-xs", badgeColor)}>
          #{contract.contract_number}
        </Badge>
        {isEnded ? (
          <Badge variant="secondary" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            {contract.days_ago} يوم
          </Badge>
        ) : (
          <Badge className={cn("text-xs", getExpiryBadgeColor(daysLeft || 0))}>
            {daysLeft === 0 ? 'اليوم' : `${daysLeft} يوم`}
          </Badge>
        )}
      </div>
      
      <h4 className="font-bold text-sm text-foreground mb-1 truncate group-hover:text-primary transition-colors" title={contract.customer_name}>
        {contract.customer_name}
      </h4>
      <p className="text-xs text-muted-foreground mb-3 truncate">{contract.ad_type}</p>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDateSafe(contract.end_date)}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {contract.billboards_count || 0}
        </span>
      </div>
      
      <div className="mt-3 pt-3 border-t border-border">
        <span className="text-sm font-bold text-primary font-mono">
          {(contract.total_amount || 0).toLocaleString('ar-LY')} د.ل
        </span>
      </div>
    </div>
  );
};

// ✅ مكون الحالة الفارغة
interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  color?: 'default' | 'green';
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, color = 'default' }) => (
  <div className="text-center py-12">
    <div className={cn(
      "mx-auto mb-4 p-4 rounded-2xl w-fit",
      color === 'green' ? "bg-green-500/10" : "bg-muted"
    )}>
      <span className={cn(
        "h-12 w-12 block",
        color === 'green' ? "text-green-500" : "text-muted-foreground/50"
      )}>
        {icon}
      </span>
    </div>
    <p className="text-muted-foreground">{message}</p>
  </div>
);
