// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, FileText, Receipt, Monitor, Clock, Plus, Eye, Package, ChevronDown, ChevronUp, TrendingUp, Users, BarChart3, MapPin, Image as ImageIcon, AlertTriangle, Layers, Building2, RefreshCw, ArrowUpRight, Wallet, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { useNavigate, Link } from 'react-router-dom';

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
  const [chartsOpen, setChartsOpen] = useState(true);
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
        .select('ID, Billboard_Name, Size, Level, Municipality, Status, created_at, Nearest_Landmark, Image_URL')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!billboardsError) {
        setBillboards(billboardsData || []);
      }

      // تحميل جميع اللوحات للإحصائيات
      const { data: allBillboardsData } = await supabase
        .from('billboards')
        .select('ID, Size, Municipality, Status');

      if (allBillboardsData) {
        setAllBillboards(allBillboardsData || []);
      }

      // تحميل فرق التركيب
      const { data: teamsData } = await supabase
        .from('installation_teams')
        .select('id, team_name');

      if (teamsData) {
        setInstallationTeams(teamsData || []);
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
      const { data: installTasksData } = await supabase
        .from('installation_tasks')
        .select('*')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      setInstallationTasks(installTasksData || []);

      // تحميل آخر مهام الإزالة
      const { data: removalTasksData } = await supabase
        .from('removal_tasks')
        .select('*')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      setRemovalTasks(removalTasksData || []);

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

  // بيانات الرسوم البيانية
  const billboardStatusData = useMemo(() => {
    const available = allBillboards.filter(b => b.Status === 'متاح' || b.Status === 'available').length;
    const unavailable = allBillboards.length - available;
    return [
      { name: 'متاح', value: available, color: '#22c55e' },
      { name: 'غير متاح', value: unavailable, color: '#ef4444' },
    ];
  }, [allBillboards]);

  const sizeDistributionData = useMemo(() => {
    const sizeCounts: { [key: string]: number } = {};
    allBillboards.forEach(b => {
      if (b.Size) {
        sizeCounts[b.Size] = (sizeCounts[b.Size] || 0) + 1;
      }
    });
    return Object.entries(sizeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [allBillboards]);

  const municipalityData = useMemo(() => {
    const muniCounts: { [key: string]: number } = {};
    allBillboards.forEach(b => {
      if (b.Municipality) {
        muniCounts[b.Municipality] = (muniCounts[b.Municipality] || 0) + 1;
      }
    });
    return Object.entries(muniCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [allBillboards]);

  const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-foreground font-medium">جاري تحميل بيانات لوحة الإدارة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <OverduePaymentsAlert />
      
      {/* العنوان الرئيسي */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">لوحة الإدارة</h1>
          <p className="text-muted-foreground mt-1">نظرة شاملة على آخر التحديثات والعقود المهمة</p>
        </div>
        <Button 
          onClick={loadData} 
          variant="outline" 
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* إحصائيات سريعة - تصميم جديد */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-all hover:shadow-lg group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي العقود</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 font-manrope">{legacyContracts.length}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {totalSales.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40 transition-all hover:shadow-lg group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">عقود منتهية</p>
                <p className="text-3xl font-black text-red-600 dark:text-red-400 font-manrope">{recentlyEndedContracts.length}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  آخر 30 يوم
                </p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl group-hover:bg-red-500/20 transition-colors">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 transition-all hover:shadow-lg group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي المدفوعات</p>
                <p className="text-3xl font-black text-green-600 dark:text-green-400 font-manrope">{payments.length}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {totalPaymentsAmount.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-colors">
                <Wallet className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-lg group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي اللوحات</p>
                <p className="text-3xl font-black text-purple-600 dark:text-purple-400 font-manrope">{allBillboards.length}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {billboardStatusData[0]?.value || 0} متاح
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <Layers className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الإجراءات السريعة */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="h-5 w-5 text-primary" />
            </div>
            الإجراءات السريعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button onClick={() => navigate('/admin/contracts/new')} className="h-auto py-4 flex-col gap-2">
              <Plus className="h-5 w-5" />
              <span>إضافة عقد</span>
            </Button>
            <Button onClick={() => navigate('/admin/customers')} variant="outline" className="h-auto py-4 flex-col gap-2">
              <Receipt className="h-5 w-5" />
              <span>إضافة دفعة</span>
            </Button>
            <Button onClick={() => navigate('/admin/billboards')} variant="outline" className="h-auto py-4 flex-col gap-2">
              <Monitor className="h-5 w-5" />
              <span>إضافة لوحة</span>
            </Button>
            <Button onClick={() => navigate('/admin/reports')} variant="outline" className="h-auto py-4 flex-col gap-2">
              <Eye className="h-5 w-5" />
              <span>التقارير</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* آخر 10 عقود منتهية - قسم بارز */}
      <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              آخر 10 عقود منتهية
            </CardTitle>
            <Link to="/admin/contracts">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                عرض الكل
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentlyEndedContracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد عقود منتهية</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {recentlyEndedContracts.map((contract) => (
                <div 
                  key={contract.id}
                  className="group p-4 bg-card rounded-xl border border-border hover:border-red-500/30 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/admin/contracts/${contract.contract_number}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 font-manrope text-xs">
                      #{contract.contract_number}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 ml-1" />
                      {contract.days_ago} يوم
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground mb-1 truncate" title={contract.customer_name}>
                    {contract.customer_name}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{contract.ad_type}</p>
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
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-sm font-bold text-primary font-manrope">
                      {(contract.total_amount || 0).toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* العقود المنتهية قريباً */}
      <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              عقود تنتهي خلال 30 يوم
              <Badge variant="destructive" className="mr-2">{expiringContracts.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {expiringContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد عقود تنتهي قريباً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {expiringContracts.map((contract) => {
                const daysLeft = getDaysLeft(contract.end_date);
                return (
                  <div 
                    key={contract.id}
                    className="group p-4 bg-card rounded-xl border border-border hover:border-orange-500/30 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/contracts/${contract.contract_number}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 font-manrope text-xs">
                        #{contract.contract_number}
                      </Badge>
                      <Badge className={`text-xs ${getExpiryBadgeColor(daysLeft)}`}>
                        {daysLeft === 0 ? 'اليوم' : `${daysLeft} يوم`}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mb-1 truncate" title={contract.customer_name}>
                      {contract.customer_name}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2 truncate">{contract.ad_type}</p>
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
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-sm font-bold text-primary font-manrope">
                        {(contract.total_amount || 0).toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* إحصائيات اللوحات */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <Card className="border-border">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  إحصائيات اللوحات
                </CardTitle>
                {chartsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* حالة اللوحات */}
                <div className="p-6 bg-muted/30 rounded-xl">
                  <h4 className="font-bold text-center mb-6">حالة اللوحات</h4>
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-500/30">
                        {billboardStatusData[0]?.value || 0}
                      </div>
                      <p className="mt-3 text-sm font-medium text-green-600 dark:text-green-400">متاح</p>
                    </div>
                    <div className="text-3xl text-muted-foreground">/</div>
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-500/30">
                        {billboardStatusData[1]?.value || 0}
                      </div>
                      <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">غير متاح</p>
                    </div>
                  </div>
                  <div className="mt-6 bg-muted/50 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                      style={{ width: `${allBillboards.length > 0 ? ((billboardStatusData[0]?.value || 0) / allBillboards.length) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    {allBillboards.length > 0 ? Math.round(((billboardStatusData[0]?.value || 0) / allBillboards.length) * 100) : 0}% متاح
                  </p>
                </div>

                {/* توزيع المقاسات */}
                <div className="p-6 bg-muted/30 rounded-xl">
                  <h4 className="font-bold text-center mb-4">توزيع المقاسات</h4>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {sizeDistributionData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-16 text-xs text-right text-muted-foreground truncate">{item.name}</div>
                        <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${sizeDistributionData[0]?.value ? (item.value / sizeDistributionData[0].value) * 100 : 0}%`,
                              backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                            }}
                          />
                        </div>
                        <div className="w-8 text-xs font-bold text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* توزيع البلديات */}
                <div className="p-6 bg-muted/30 rounded-xl">
                  <h4 className="font-bold text-center mb-4">توزيع البلديات</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                    {municipalityData.map((item, index) => (
                      <div 
                        key={item.name} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-xs truncate flex-1">{item.name}</span>
                        <span className="text-xs font-bold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* أفضل العملاء */}
      <Card className="border-yellow-500/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            أفضل 5 عملاء مبيعات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topCustomers.map((customer, index) => (
              <div key={customer.name} className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-white shrink-0 ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground font-manrope">{customer.total.toLocaleString('ar-LY')} د.ل</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* القوائم الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* المهمات المتأخرة */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-destructive" />
                المهمات المتأخرة
              </CardTitle>
              <Badge variant="destructive">{overdueTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مهمات متأخرة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueTasks.map((task) => {
                  const daysOverdue = Math.abs(getDaysLeft(task.due_date));
                  return (
                    <div key={task.id} className="p-3 bg-muted/30 rounded-lg">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-destructive">
                        تأخر بـ {daysOverdue} {daysOverdue === 1 ? 'يوم' : 'أيام'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر العقود المضافة */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-green-500" />
                آخر 5 عقود مضافة
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate('/admin/contracts/new')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد عقود</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentContracts.map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/contracts/${contract.contract_number}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">#{contract.contract_number}</p>
                        <Badge variant="outline" className="text-xs">{contract.ad_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{contract.customer_name}</p>
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateSafe(contract.created_at)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-green-600 font-manrope shrink-0">
                      {(contract.total_amount || 0).toLocaleString('ar-LY')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر المدفوعات */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5 text-purple-500" />
                آخر 5 مدفوعات
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate('/admin/customers')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مدفوعات</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment, index) => (
                  <div key={`payment-${payment.id}-${index}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{payment.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.contract_number && `عقد #${payment.contract_number}`}
                      </p>
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateSafe(payment.paid_at || payment.created_at)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-purple-600 font-manrope shrink-0">
                      {(payment.amount || 0).toLocaleString('ar-LY')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر اللوحات */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-5 w-5 text-orange-500" />
                آخر 10 لوحات
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate('/admin/billboards')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentBillboards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد لوحات</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentBillboards.map((billboard, index) => (
                  <div key={`billboard-${billboard.ID}-${index}`} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div 
                      className={`w-12 h-10 rounded-lg overflow-hidden bg-muted shrink-0 ${billboard.Image_URL ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                      onClick={() => billboard.Image_URL && setSelectedImage({ url: billboard.Image_URL, name: billboard.Billboard_Name })}
                    >
                      {billboard.Image_URL ? (
                        <img 
                          src={billboard.Image_URL} 
                          alt={billboard.Billboard_Name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{billboard.Billboard_Name}</p>
                      <p className="text-xs text-muted-foreground truncate">{billboard.Municipality}</p>
                    </div>
                    <Badge variant={billboard.Status === 'متاح' ? 'default' : 'secondary'} className="text-xs shrink-0">
                      {billboard.Status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* مهام التركيب */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-blue-500" />
                مهام التركيب
              </CardTitle>
              <Badge className="bg-blue-600">{installationTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {installationTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مهام</p>
              </div>
            ) : (
              <div className="space-y-2">
                {installationTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">عقد #{task.contract_id}</p>
                        <Badge variant="outline" className="text-xs">{getAdTypeFromContract(task.contract_id)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{task.customer_name || 'غير محدد'}</p>
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getTeamName(task.team_id)}
                      </p>
                    </div>
                    <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                      {task.status === 'pending' ? 'معلق' : task.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* مهام الإزالة */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-red-500" />
                مهام الإزالة
              </CardTitle>
              <Badge variant="destructive">{removalTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {removalTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مهام</p>
              </div>
            ) : (
              <div className="space-y-2">
                {removalTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">عقد #{task.contract_id}</p>
                        <Badge variant="outline" className="text-xs">{getAdTypeFromContract(task.contract_id)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{task.customer_name || 'غير محدد'}</p>
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getTeamName(task.team_id)}
                      </p>
                    </div>
                    <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                      {task.status === 'pending' ? 'معلق' : task.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog لعرض الصورة */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {selectedImage && (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name}
                className="w-full max-h-[70vh] object-contain bg-black/5"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
