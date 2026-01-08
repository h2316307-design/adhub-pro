// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, FileText, Receipt, Monitor, Clock, Plus, Eye, Package, ChevronDown, ChevronUp, TrendingUp, Users, PieChart, BarChart3, MapPin, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { useNavigate } from 'react-router-dom';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [expiringSoonOpen, setExpiringSoonOpen] = useState(true);
  const [recentlyEndedOpen, setRecentlyEndedOpen] = useState(true);
  
  // حالة عرض الصورة
  const [selectedImage, setSelectedImage] = useState<{url: string; name: string} | null>(null);

  // تحميل البيانات
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 بدء تحميل بيانات لوحة الإدارة...');

      // تحميل العقود القديمة
      const { data: legacyData, error: legacyError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract Date', { ascending: false });

      if (legacyError) {
        console.error('❌ خطأ في تحميل العقود:', legacyError);
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

      console.log('🎉 تم الانتهاء من تحميل جميع البيانات');
    } catch (error) {
      console.error('💥 خطأ عام في تحميل البيانات:', error);
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
        source: 'legacy'
      }));

    const sorted = legacyExpiring.sort((a, b) => {
      const daysLeftA = differenceInDays(new Date(a.end_date), today);
      const daysLeftB = differenceInDays(new Date(b.end_date), today);
      return daysLeftA - daysLeftB;
    });

    return sorted.slice(0, 10);
  }, [legacyContracts]);

  // العقود المنتهية مؤخراً
  const recentlyEndedContracts = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const legacyEnded = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate < today && endDate >= thirtyDaysAgo;
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
        days_ago: Math.abs(differenceInDays(new Date(contract['End Date']), today))
      }));

    return legacyEnded.sort((a, b) => a.days_ago - b.days_ago).slice(0, 5);
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
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ar });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات الإدارة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      <OverduePaymentsAlert />
      
      {/* العنوان الرئيسي */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">لوحة الإدارة</h1>
          <p className="text-muted-foreground">نظرة شاملة على آخر التحديثات والعقود المهمة</p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          تحديث البيانات
        </Button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="expenses-stats-grid">
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي العقود</p>
              <p className="expenses-stat-value font-manrope">{legacyContracts.length}</p>
            </div>
            <FileText className="expenses-stat-icon stat-blue" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">العقود المنتهية قريباً</p>
              <p className="expenses-stat-value stat-red font-manrope">{expiringContracts.length}</p>
            </div>
            <Clock className="expenses-stat-icon stat-red" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي المدفوعات</p>
              <p className="expenses-stat-value font-manrope">{payments.length}</p>
            </div>
            <Receipt className="expenses-stat-icon stat-green" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي اللوحات</p>
              <p className="expenses-stat-value font-manrope">{allBillboards.length}</p>
            </div>
            <Monitor className="expenses-stat-icon stat-purple" />
          </div>
        </Card>
      </div>

      {/* الإجراءات السريعة - قابلة للطي */}
      <Collapsible open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <Card className="expenses-preview-card mb-6">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="expenses-preview-title">الإجراءات السريعة</CardTitle>
                {quickActionsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button onClick={() => navigate('/admin/contracts/new')} className="expenses-action-btn">
                  <Plus className="h-4 w-4" />
                  إضافة عقد جديد
                </Button>
                <Button onClick={() => navigate('/admin/customers')} variant="outline" className="expenses-action-btn">
                  <Receipt className="h-4 w-4" />
                  إضافة دفعة جديدة
                </Button>
                <Button onClick={() => navigate('/admin/billboards')} variant="outline" className="expenses-action-btn">
                  <Monitor className="h-4 w-4" />
                  إضافة لوحة جديدة
                </Button>
                <Button onClick={() => navigate('/admin/reports')} variant="outline" className="expenses-action-btn">
                  <Eye className="h-4 w-4" />
                  عرض التقارير
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* الرسوم البيانية - قابلة للطي */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <Card className="mb-6 border border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">إحصائيات اللوحات</CardTitle>
                </div>
                {chartsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* حالة اللوحات */}
                <div className="bg-gradient-to-br from-green-500/5 to-red-500/5 rounded-xl p-4 border border-border/30">
                  <h4 className="font-bold text-center mb-4 text-foreground">حالة اللوحات</h4>
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-500/30">
                        {billboardStatusData[0]?.value || 0}
                      </div>
                      <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">متاح</p>
                    </div>
                    <div className="text-3xl text-muted-foreground">/</div>
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-500/30">
                        {billboardStatusData[1]?.value || 0}
                      </div>
                      <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">غير متاح</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-muted/50 rounded-full h-3 overflow-hidden">
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
                <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-4 border border-border/30">
                  <h4 className="font-bold text-center mb-4 text-foreground">توزيع المقاسات</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
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
                <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl p-4 border border-border/30">
                  <h4 className="font-bold text-center mb-4 text-foreground">توزيع البلديات</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
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
      <Card className="mb-6 border-l-4 border-l-yellow-500">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-lg">أفضل 5 عملاء مبيعات</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topCustomers.map((customer, index) => (
              <div key={customer.name} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.total.toLocaleString()} د.ل</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* القوائم الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* المهمات المتأخرة */}
        <Card className="expenses-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="expenses-preview-title">
                <Clock className="inline-block ml-2 h-5 w-5" />
                المهمات المتأخرة
              </CardTitle>
              <Badge variant="destructive">{overdueTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <div className="expenses-empty-state">
                <p>لا توجد مهمات متأخرة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overdueTasks.map((task) => {
                  const daysOverdue = Math.abs(getDaysLeft(task.due_date));
                  return (
                    <div key={task.id} className="expenses-preview-item">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            تأخر بـ {daysOverdue} {daysOverdue === 1 ? 'يوم' : 'أيام'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* العقود المنتهية قريباً - قابلة للطي */}
        <Collapsible open={expiringSoonOpen} onOpenChange={setExpiringSoonOpen}>
          <Card className="expenses-preview-card">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="expenses-preview-title">
                    <Clock className="inline-block ml-2 h-5 w-5" />
                    العقود المنتهية قريباً
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{expiringContracts.length}</Badge>
                    {expiringSoonOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {expiringContracts.length === 0 ? (
                  <div className="expenses-empty-state">
                    <p>لا توجد عقود تنتهي قريباً</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiringContracts.map((contract) => {
                      const daysLeft = getDaysLeft(contract.end_date);
                      return (
                        <div key={contract.id} className="expenses-preview-item">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{contract.contract_number}</p>
                              <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                              <p className="text-xs text-blue-400 font-medium">{contract.ad_type}</p>
                              <p className="text-xs text-muted-foreground">
                                ينتهي في: {formatDateSafe(contract.end_date)}
                              </p>
                            </div>
                            <div className="text-left">
                              <Badge className={getExpiryBadgeColor(daysLeft)}>
                                {daysLeft === 0 ? 'ينتهي اليوم' : `${daysLeft} يوم`}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {contract.total_amount.toLocaleString()} د.ل
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* العقود المنتهية مؤخراً */}
        <Collapsible open={recentlyEndedOpen} onOpenChange={setRecentlyEndedOpen}>
          <Card className="border-l-4 border-l-gray-500">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-50 dark:bg-gray-950 rounded-lg">
                      <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <CardTitle className="text-lg">آخر عقود انتهت</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{recentlyEndedContracts.length}</Badge>
                    {recentlyEndedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {recentlyEndedContracts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد عقود منتهية مؤخراً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentlyEndedContracts.map((contract) => (
                      <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">عقد #{contract.contract_number}</p>
                          <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                          <p className="text-xs text-blue-400">{contract.ad_type}</p>
                        </div>
                        <div className="text-left shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            منذ {contract.days_ago} يوم
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateSafe(contract.end_date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* آخر العقود المضافة */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">آخر 5 عقود مضافة</CardTitle>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => navigate('/admin/contracts/new')}>
                <Plus className="h-3 w-3 ml-1" />
                إضافة عقد
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد عقود مضافة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentContracts.map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">عقد #{contract.contract_number}</p>
                      <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                      <p className="text-xs text-blue-400">{contract.ad_type}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateSafe(contract.created_at)}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-base font-bold text-green-600 dark:text-green-400">
                        {contract.total_amount?.toLocaleString() || 0} د.ل
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر المدفوعات المضافة - مع رقم العقد */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">آخر 5 مدفوعات مضافة</CardTitle>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => navigate('/admin/customers')}>
                <Plus className="h-3 w-3 ml-1" />
                إضافة دفعة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مدفوعات مضافة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment, index) => (
                  <div key={`payment-${payment.id}-${index}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{payment.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.entry_type === 'receipt' ? 'إيصال' : 'دفعة حساب'}
                        {payment.contract_number && (
                          <span className="text-blue-400 mr-2">• عقد #{payment.contract_number}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateSafe(payment.created_at)}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-base font-bold text-purple-600 dark:text-purple-400">
                        {payment.amount?.toLocaleString() || 0} د.ل
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر اللوحات المضافة - مع الصورة وأقرب نقطة دالة */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <Monitor className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-lg">آخر 10 لوحات مضافة</CardTitle>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => navigate('/admin/billboards')}>
                <Plus className="h-3 w-3 ml-1" />
                إضافة لوحة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentBillboards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد لوحات مضافة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentBillboards.map((billboard, index) => (
                  <div key={`billboard-${billboard.ID}-${index}`} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    {/* صورة اللوحة - قابلة للضغط */}
                    <div 
                      className={`w-16 h-12 rounded-lg overflow-hidden bg-muted shrink-0 ${billboard.Image_URL ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
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
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{billboard.Billboard_Name}</p>
                      <p className="text-sm text-muted-foreground">{billboard.Municipality}</p>
                      {billboard.Nearest_Landmark && (
                        <p className="text-xs text-blue-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {billboard.Nearest_Landmark}
                        </p>
                      )}
                    </div>
                    <div className="text-left shrink-0 space-y-1">
                      <Badge variant="outline" className="text-xs">
                        {billboard.Size}
                      </Badge>
                      <Badge variant={billboard.Status === 'متاح' ? 'default' : 'secondary'} className="text-xs block">
                        {billboard.Status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر مهام التركيب - مع اسم الفريق ونوع الإعلان */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">آخر مهام التركيب</CardTitle>
              </div>
              <Badge variant="default" className="bg-blue-600">{installationTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {installationTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مهام تركيب</p>
              </div>
            ) : (
              <div className="space-y-2">
                {installationTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">عقد #{task.contract_id}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getTeamName(task.team_id)}
                      </p>
                      <p className="text-xs text-blue-400">
                        {getAdTypeFromContract(task.contract_id)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateSafe(task.created_at)}
                      </p>
                    </div>
                    <Badge variant={
                      task.status === 'completed' ? 'default' : 
                      task.status === 'in_progress' ? 'secondary' : 
                      'outline'
                    } className="shrink-0">
                      {task.status === 'pending' ? 'معلق' : task.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر مهام الإزالة - مع اسم الفريق ونوع الإعلان */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                  <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-lg">آخر مهام الإزالة</CardTitle>
              </div>
              <Badge variant="destructive">{removalTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {removalTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد مهام إزالة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {removalTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">عقد #{task.contract_id}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getTeamName(task.team_id)}
                      </p>
                      <p className="text-xs text-blue-400">
                        {getAdTypeFromContract(task.contract_id)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateSafe(task.created_at)}
                      </p>
                    </div>
                    <Badge variant={
                      task.status === 'completed' ? 'default' : 
                      task.status === 'in_progress' ? 'secondary' : 
                      'outline'
                    } className="shrink-0">
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
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.name}</span>
            </DialogTitle>
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
