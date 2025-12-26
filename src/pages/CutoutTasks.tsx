import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  RefreshCw, 
  Scissors, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  TrendingUp,
  Package
} from 'lucide-react';
import { CutoutTaskList } from '@/components/cutout-tasks/CutoutTaskList';
import { CutoutTaskDetails } from '@/components/cutout-tasks/CutoutTaskDetails';
import { CreateManualCutoutTask } from '@/components/cutout-tasks/CreateManualCutoutTask';

interface CutoutTask {
  id: string;
  installation_task_id?: string | null;
  contract_id?: number | null;
  customer_id?: string | null;
  customer_name: string | null;
  printer_id?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  customer_total_amount?: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  printers?: { name: string } | null;
}

export default function CutoutTasks() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<CutoutTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [createManualDialogOpen, setCreateManualDialogOpen] = useState(false);

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cutout-tasks', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('cutout_tasks')
        .select(`
          *,
          printers:printer_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any as CutoutTask[];
    },
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['cutout-task-items'] });
  };

  const handleTaskCreated = () => {
    refetch();
  };

  // Stats calculations
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    totalQuantity: tasks.reduce((sum, t) => sum + (t.total_quantity || 0), 0),
    totalRevenue: tasks.reduce((sum, t) => sum + (t.customer_total_amount || 0), 0),
  };

  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filterStatus);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
            <Scissors className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              مهام المجسمات
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة ومتابعة مهام قص وتجهيز المجسمات الإعلانية
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={isFetching}
            className="border-border/50 hover:bg-muted/50"
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button 
            onClick={() => setCreateManualDialogOpen(true)} 
            size="sm" 
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
          >
            <Plus className="h-4 w-4 ml-2" />
            إنشاء مهمة جديدة
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">إجمالي المهام</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/10">
                <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-orange-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">معلقة</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pending}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">قيد التنفيذ</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">مكتملة</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">إجمالي القطع</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalQuantity.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Scissors className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.totalRevenue.toLocaleString()} <span className="text-xs">د.ل</span>
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks List */}
        <Card className="lg:col-span-1 border-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  قائمة المهام
                </CardTitle>
                <CardDescription className="mt-1">
                  {filteredTasks.length} مهمة
                </CardDescription>
              </div>
              {filterStatus !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {filterStatus === 'pending' && 'معلق'}
                  {filterStatus === 'in_progress' && 'قيد التنفيذ'}
                  {filterStatus === 'completed' && 'مكتمل'}
                  {filterStatus === 'cancelled' && 'ملغي'}
                </Badge>
              )}
            </div>
            
            {/* Filter Tabs */}
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="mt-4">
              <TabsList className="grid w-full grid-cols-4 h-9 bg-background/50">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  الكل
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                  معلق
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  جاري
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  مكتمل
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <CutoutTaskList
                tasks={filteredTasks}
                selectedTaskId={selectedTask?.id || null}
                onSelectTask={(task) => setSelectedTask(task)}
                isLoading={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Task Details */}
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="p-4 md:p-6">
            <CutoutTaskDetails task={selectedTask} />
          </CardContent>
        </Card>
      </div>

      {/* Create Manual Task Dialog */}
      <CreateManualCutoutTask
        open={createManualDialogOpen}
        onOpenChange={setCreateManualDialogOpen}
        onSuccess={handleTaskCreated}
      />
    </div>
  );
}
