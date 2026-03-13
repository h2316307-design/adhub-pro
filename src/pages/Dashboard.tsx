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
  CircleDollarSign, PieChart, ArrowRight, CheckCircle2, XCircle, Timer, CalendarDays,
  ClipboardList, LayoutDashboard, Wrench, BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { OverdueInvoicesAlert } from '@/components/billing/OverdueInvoicesAlert';
import { OverdueCompositeTasksAlert } from '@/components/billing/OverdueCompositeTasksAlert';
import { RecentActivityLog } from '@/components/billing/RecentActivityLog';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isBillboardAvailable } from '@/utils/contractUtils';

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
  
  const [chartsOpen, setChartsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<{url: string; name: string} | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);

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

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .in('entry_type', ['receipt', 'account_payment', 'payment'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (!paymentsError) {
        setPayments(paymentsData || []);
      }

      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Level, Municipality, District, Status, created_at, Nearest_Landmark, Image_URL')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!billboardsError) {
        setBillboards(billboardsData || []);
      }

      const { data: allBillboardsData } = await supabase
        .from('billboards')
        .select('ID, Size, Municipality, Status, friend_company_id');

      if (allBillboardsData) {
        setAllBillboards(allBillboardsData);
      }

      const { data: teamsData } = await supabase
        .from('installation_teams')
        .select('id, team_name');

      if (teamsData) {
        setInstallationTeams(teamsData);
      }

      const today = new Date();
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .lt('due_date', today.toISOString())
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);

      setOverdueTasks(tasksData || []);

      const { data: installTasksData, error: installError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (installError) {
        console.error('خطأ في تحميل مهام التركيب:', installError);
      }

      const enrichedInstallTasks = await Promise.all(
        (installTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select("\"Customer Name\", \"Ad Type\"")
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

      const { data: removalTasksData, error: removalError } = await supabase
        .from('removal_tasks')
        .select('id, contract_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (removalError) {
        console.error('خطأ في تحميل مهام الإزالة:', removalError);
      }

      const enrichedRemovalTasks = await Promise.all(
        (removalTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select("\"Customer Name\", \"Ad Type\"")
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

  const getTeamName = (teamId: string) => {
    const team = installationTeams.find(t => t.id === teamId);
    return team?.team_name || 'غير محدد';
  };

  const getAdTypeFromContract = (contractId: number) => {
    const contract = legacyContracts.find(c => c.Contract_Number === contractId);
    return contract?.['Ad Type'] || 'غير محدد';
  };

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

    return sorted.slice(0, 5);
  }, [legacyContracts]);

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

    return legacyEnded.sort((a, b) => a.days_ago - b.days_ago).slice(0, 5);
  }, [legacyContracts]);

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

  const recentPayments = useMemo(() => {
    return payments
      .filter(p => 
        (p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment') &&
        p.amount > 0
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [payments]);

  const recentBillboards = useMemo(() => {
    return billboards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [billboards]);

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

  const ownBillboards = useMemo(() => {
    return allBillboards.filter(b => !b.friend_company_id);
  }, [allBillboards]);

  const friendBillboards = useMemo(() => {
    return allBillboards.filter(b => !!b.friend_company_id);
  }, [allBillboards]);

  const billboardStatusData = useMemo(() => {
    const available = ownBillboards.filter(b => isBillboardAvailable(b)).length;
    const unavailable = ownBillboards.length - available;
    return [
      { name: 'متاح', value: available, color: '#22c55e' },
      { name: 'غير متاح', value: unavailable, color: '#ef4444' },
    ];
  }, [ownBillboards]);

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
  }, [ownBillboards]);

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
  }, [ownBillboards]);

  const getDaysLeft = (endDate: string) => {
    try {
      const today = new Date();
      const end = new Date(endDate);
      return differenceInDays(end, today);
    } catch (error) {
      return 0;
    }
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

  const totalSales = useMemo(() => {
    return legacyContracts.reduce((sum, c) => sum + (Number(c['Total']) || 0), 0);
  }, [legacyContracts]);

  const totalPaymentsAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

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
    <div className="space-y-5 pb-10" dir="rtl">
      {/* هيدر مختصر */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE، dd MMMM yyyy', { locale: ar })}
            </p>
          </div>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="إجمالي العقود"
          value={legacyContracts.length}
          subtitle={`${totalSales.toLocaleString('ar-LY')} د.ل`}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
          trend={activeContracts}
          trendLabel="نشط"
          onClick={() => navigate('/admin/contracts')}
        />
        <StatCard
          title="عقود منتهية"
          value={recentlyEndedContracts.length}
          subtitle="تحتاج متابعة"
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          onClick={() => navigate('/admin/contracts')}
        />
        <StatCard
          title="المدفوعات"
          value={payments.length}
          subtitle={`${totalPaymentsAmount.toLocaleString('ar-LY')} د.ل`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          color="green"
          onClick={() => navigate('/admin/payments-receipts-page')}
        />
        <StatCard
          title="اللوحات"
          value={allBillboards.length}
          subtitle={`${billboardStatusData[0]?.value || 0} متاح`}
          icon={<Layers className="h-5 w-5" />}
          color="purple"
          onClick={() => navigate('/admin/billboards')}
        />
      </div>

      {/* إجراءات سريعة موسعة */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        <QuickActionButton icon={<Plus className="h-4 w-4" />} label="إضافة عقد" onClick={() => navigate('/admin/contracts/new')} variant="primary" />
        <QuickActionButton icon={<FileText className="h-4 w-4" />} label="العقود" onClick={() => navigate('/admin/contracts')} variant="outline" />
        <QuickActionButton icon={<Users className="h-4 w-4" />} label="العملاء" onClick={() => navigate('/admin/customers')} variant="outline" />
        <QuickActionButton icon={<Monitor className="h-4 w-4" />} label="اللوحات" onClick={() => navigate('/admin/billboards')} variant="outline" />
        <QuickActionButton icon={<Wallet className="h-4 w-4" />} label="المدفوعات" onClick={() => navigate('/admin/payments-receipts-page')} variant="outline" />
        <QuickActionButton icon={<BarChart3 className="h-4 w-4" />} label="التقارير" onClick={() => navigate('/admin/reports')} variant="outline" />
        <QuickActionButton icon={<ClipboardList className="h-4 w-4" />} label="المهام" onClick={() => navigate('/admin/composite-tasks')} variant="outline" />
        <QuickActionButton icon={<BookOpen className="h-4 w-4" />} label="العروض" onClick={() => navigate('/admin/booking-requests')} variant="outline" />
      </div>

      {/* التنبيهات - قابلة للطي */}
      <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-semibold text-sm">التنبيهات والمتابعات</span>
            </div>
            {alertsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-3">
          <OverduePaymentsAlert />
          <OverdueInvoicesAlert />
          <OverdueCompositeTasksAlert />
          <RecentActivityLog />
        </CollapsibleContent>
      </Collapsible>

      {/* العقود المنتهية + قريبة الانتهاء - جنباً إلى جنب */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* العقود المنتهية */}
        <Card className="border border-red-500/20 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <span>عقود منتهية</span>
                <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                  {recentlyEndedContracts.length}
                </Badge>
              </CardTitle>
              <Link to="/admin/contracts">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7 px-2">
                  المزيد <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentlyEndedContracts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد عقود منتهية</p>
            ) : (
              <div className="space-y-2">
                {recentlyEndedContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-red-500/5 cursor-pointer transition-colors border border-transparent hover:border-red-500/20"
                    onClick={() => navigate(`/admin/contracts/view/${contract.contract_number}`)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0 border-red-500/30 text-red-600">#{contract.contract_number}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{contract.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{contract.ad_type}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
                      <Clock className="h-3 w-3" /> {contract.days_ago} يوم
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* العقود قريبة الانتهاء */}
        <Card className="border border-orange-500/20 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Timer className="h-4 w-4 text-orange-500" />
                </div>
                <span>قريبة الانتهاء</span>
                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-xs">
                  {expiringContracts.length}
                </Badge>
              </CardTitle>
              <Link to="/admin/contracts">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7 px-2">
                  المزيد <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {expiringContracts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد عقود قريبة الانتهاء</p>
            ) : (
              <div className="space-y-2">
                {expiringContracts.map((contract) => {
                  const daysLeft = getDaysLeft(contract.end_date);
                  return (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-orange-500/5 cursor-pointer transition-colors border border-transparent hover:border-orange-500/20"
                      onClick={() => navigate(`/admin/contracts/view/${contract.contract_number}`)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0 border-orange-500/30 text-orange-600">#{contract.contract_number}</Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{contract.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{contract.ad_type}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0",
                        daysLeft <= 3 ? 'bg-red-500 text-white' :
                        daysLeft <= 7 ? 'bg-orange-500 text-white' :
                        daysLeft <= 15 ? 'bg-yellow-500 text-black' :
                        'bg-green-500 text-white'
                      )}>
                        {daysLeft === 0 ? 'اليوم' : `${daysLeft} يوم`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* مهام التركيب والإزالة - جنباً إلى جنب */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* مهام التركيب */}
        <Card className="border border-blue-500/20 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <span>مهام التركيب</span>
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">{installationTasks.length}</Badge>
              </div>
              <Link to="/admin/installation-tasks">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                  عرض الكل <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {installationTasks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد مهام تركيب</p>
            ) : (
              <div className="space-y-2">
                {installationTasks.map((task) => (
                  <div key={task.id} className="p-2.5 bg-muted/30 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-blue-500/10 rounded-md">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{task.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">عقد #{task.contract_id} • {getTeamName(task.team_id)}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0",
                        task.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                      )}>
                        {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'انتظار'}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1.5 bg-blue-500/5 text-blue-600 border-blue-500/20">
                      {task.ad_type || 'غير محدد'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* مهام الإزالة */}
        <Card className="border border-purple-500/20 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <XCircle className="h-4 w-4 text-purple-500" />
                </div>
                <span>مهام الإزالة</span>
                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs">{removalTasks.length}</Badge>
              </div>
              <Link to="/admin/removal-tasks">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                  عرض الكل <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {removalTasks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد مهام إزالة</p>
            ) : (
              <div className="space-y-2">
                {removalTasks.map((task) => (
                  <div key={task.id} className="p-2.5 bg-muted/30 rounded-lg hover:bg-purple-500/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-purple-500/10 rounded-md">
                          <XCircle className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{task.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">عقد #{task.contract_id}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0",
                        task.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                        task.status === 'in_progress' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                      )}>
                        {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'انتظار'}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1.5 bg-purple-500/5 text-purple-600 border-purple-500/20">
                      {task.ad_type || 'غير محدد'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* المهام المتأخرة */}
      {overdueTasks.length > 0 && (
        <Card className="border border-red-500/20 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Bell className="h-4 w-4 text-red-500 animate-pulse" />
              </div>
              <span>المهام المتأخرة</span>
              <Badge className="bg-red-500 text-white text-xs">{overdueTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 bg-red-500/5 rounded-lg border border-red-500/15">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-red-600 dark:text-red-400">{task.title || 'مهمة بدون عنوان'}</p>
                      <p className="text-[11px] text-muted-foreground">تأخر: {Math.abs(differenceInDays(new Date(task.due_date), new Date()))} يوم</p>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white text-[10px]">متأخرة</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* المدفوعات + أفضل العملاء - جنباً إلى جنب */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Wallet className="h-4 w-4 text-green-500" />
                </div>
                <span>آخر المدفوعات</span>
              </div>
              <Link to="/admin/payments-receipts-page">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                  عرض الكل <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentPayments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد مدفوعات</p>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-green-500 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{payment.customer_name || 'غير محدد'}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateSafe(payment.paid_at)}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30 font-mono text-xs">
                      +{payment.amount.toLocaleString('ar-LY')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <span>أفضل العملاء</span>
              </div>
              <Link to="/admin/customers">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                  عرض الكل <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topCustomers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد بيانات</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                        index === 1 ? "bg-gray-400/20 text-gray-600" :
                        index === 2 ? "bg-orange-500/20 text-orange-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <p className="font-medium text-sm truncate max-w-[150px]">{customer.name}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {customer.total.toLocaleString('ar-LY')} د.ل
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* آخر اللوحات المضافة */}
      {recentBillboards.length > 0 && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Monitor className="h-4 w-4 text-primary" />
                </div>
                آخر اللوحات المضافة
                <Badge variant="secondary" className="font-mono text-xs">{recentBillboards.length}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                <Link to="/admin/billboards">
                  عرض الكل <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentBillboards.map((bb) => {
                const imageUrl = bb.Image_URL || bb.image_name;
                const isAvailable = isBillboardAvailable(bb);
                return (
                  <div
                    key={bb.ID}
                    className="flex gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    {/* صورة اللوحة */}
                    <div
                      className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                      onClick={() => imageUrl && setSelectedImage({ url: imageUrl, name: bb.Billboard_Name || '' })}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={bb.Billboard_Name || ''}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* تفاصيل اللوحة */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm truncate">{bb.Billboard_Name || `لوحة ${bb.ID}`}</h4>
                        <Badge
                          variant={isAvailable ? 'default' : 'destructive'}
                          className={cn(
                            'text-[10px] flex-shrink-0',
                            isAvailable
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}
                        >
                          {isAvailable ? 'متاح' : 'مؤجر'}
                        </Badge>
                      </div>
                      {bb.Size && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" /> {bb.Size}
                        </p>
                      )}
                      {(bb.Municipality || bb.District) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" /> {bb.Municipality || bb.District}
                        </p>
                      )}
                      {bb.Nearest_Landmark && (
                        <p className="text-xs text-muted-foreground truncate" title={bb.Nearest_Landmark}>
                          📍 {bb.Nearest_Landmark}
                        </p>
                      )}
                      {bb.created_at && (
                        <p className="text-[10px] text-muted-foreground/60">
                          {format(new Date(bb.created_at), 'dd MMM yyyy', { locale: ar })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* إحصائيات اللوحات - مطوية */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <Card className="border-border overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <PieChart className="h-4 w-4 text-primary" />
                  </div>
                  إحصائيات اللوحات
                  <Badge variant="secondary" className="font-mono text-xs">{allBillboards.length} لوحة</Badge>
                </CardTitle>
                {chartsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* لوحاتنا */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-primary text-xs">لوحاتنا</Badge>
                    <span className="text-xs text-muted-foreground">({ownBillboards.length})</span>
                  </div>
                  
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <h4 className="font-bold text-center text-sm mb-3">حالة اللوحات</h4>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-lg shadow-green-500/20">
                          {billboardStatusData[0]?.value || 0}
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400">متاح</p>
                      </div>
                      <div className="text-xl text-muted-foreground/30">/</div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
                          {billboardStatusData[1]?.value || 0}
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">مؤجر</p>
                      </div>
                    </div>
                    <div className="mt-3 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 rounded-full"
                        style={{ width: `${ownBillboards.length > 0 ? ((billboardStatusData[0]?.value || 0) / ownBillboards.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <h4 className="font-bold text-center text-sm mb-2">توزيع الأحجام</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {sizeDistributionData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 8] }} />
                          <span className="flex-1 text-xs truncate">{item.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <h4 className="font-bold text-center text-sm mb-2">توزيع البلديات</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {municipalityData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 8] }} />
                          <span className="flex-1 text-xs truncate">{item.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* لوحات الشركات الصديقة */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-xs">الشركات الصديقة</Badge>
                    <span className="text-xs text-muted-foreground">({friendBillboards.length})</span>
                  </div>
                  
                  {friendBillboards.length === 0 ? (
                    <div className="p-8 bg-muted/30 rounded-xl border border-border/50 text-center">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">لا توجد لوحات للشركات الصديقة</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/20">
                        <h4 className="font-bold text-center text-sm mb-3">حالة اللوحات</h4>
                        <div className="flex items-center justify-center gap-4">
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-lg shadow-green-500/20">
                              {friendBillboards.filter(b => isBillboardAvailable(b)).length}
                            </div>
                            <p className="mt-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400">متاح</p>
                          </div>
                          <div className="text-xl text-muted-foreground/30">/</div>
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
                              {friendBillboards.filter(b => !isBillboardAvailable(b)).length}
                            </div>
                            <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">مؤجر</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                        <h4 className="font-bold text-center text-sm mb-2">توزيع الأحجام</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {friendSizeDistributionData.map((item, i) => (
                            <div key={item.name} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'][i % 5] }} />
                              <span className="flex-1 text-xs truncate">{item.name}</span>
                              <Badge variant="secondary" className="font-mono text-[10px]">{item.value}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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

// مكون بطاقة الإحصائية
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
    blue: { bg: 'from-blue-500/10 to-blue-500/5', border: 'border-blue-500/20 hover:border-blue-500/40', icon: 'bg-blue-500/10', iconColor: 'text-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    red: { bg: 'from-red-500/10 to-red-500/5', border: 'border-red-500/20 hover:border-red-500/40', icon: 'bg-red-500/10', iconColor: 'text-red-500', text: 'text-red-600 dark:text-red-400' },
    green: { bg: 'from-green-500/10 to-green-500/5', border: 'border-green-500/20 hover:border-green-500/40', icon: 'bg-green-500/10', iconColor: 'text-green-500', text: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'from-purple-500/10 to-purple-500/5', border: 'border-purple-500/20 hover:border-purple-500/40', icon: 'bg-purple-500/10', iconColor: 'text-purple-500', text: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'from-orange-500/10 to-orange-500/5', border: 'border-orange-500/20 hover:border-orange-500/40', icon: 'bg-orange-500/10', iconColor: 'text-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  };
  const c = colors[color];

  return (
    <Card className={cn("bg-gradient-to-br transition-all hover:shadow-lg group cursor-pointer", c.bg, c.border)} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl lg:text-3xl font-black font-mono tracking-tight", c.text)}>{value.toLocaleString('ar-LY')}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            {trend !== undefined && (
              <Badge variant="secondary" className="text-[10px] mt-0.5">{trend} {trendLabel}</Badge>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", c.icon)}>
            <span className={c.iconColor}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// مكون زر الإجراء السريع
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
      "h-auto py-3 flex-col gap-1.5 rounded-xl text-[11px] transition-all",
      variant === 'primary' 
        ? "shadow-md shadow-primary/20 hover:shadow-lg hover:scale-[1.02]" 
        : "border hover:bg-muted/50 hover:scale-[1.02]"
    )}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </Button>
);

// مكون الحالة الفارغة
interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  color?: 'default' | 'green';
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, color = 'default' }) => (
  <div className="text-center py-8">
    <div className={cn("mx-auto mb-3 p-3 rounded-xl w-fit", color === 'green' ? "bg-green-500/10" : "bg-muted")}>
      <span className={cn("h-8 w-8 block", color === 'green' ? "text-green-500" : "text-muted-foreground/50")}>{icon}</span>
    </div>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);
