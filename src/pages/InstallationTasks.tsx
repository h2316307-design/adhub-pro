import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  Users, 
  Package,
  Printer,
  PaintBucket,
  Search,
  Filter,
  CalendarIcon,
  Trash2
} from 'lucide-react';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';
import { TaskDesignManager } from '@/components/tasks/TaskDesignManager';
import { BulkDesignAssigner } from '@/components/tasks/BulkDesignAssigner';
import { BillboardPrintIndividual } from '@/components/contracts/BillboardPrintIndividual';

interface InstallationTask {
  id: string;
  contract_id: number;
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

interface InstallationTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  installation_date: string | null;
  design_face_a: string | null;
  design_face_b: string | null;
  installed_image_url: string | null;
  installed_image_face_a_url: string | null;
  installed_image_face_b_url: string | null;
  selected_design_id: string | null;
}

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

export default function InstallationTasks() {
  const queryClient = useQueryClient();
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [taskType, setTaskType] = useState<'installation' | 'reinstallation'>('installation');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedTaskForDesign, setSelectedTaskForDesign] = useState<string | null>(null);
  const [bulkDesignDialogOpen, setBulkDesignDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  // Dialog صورة التركيب لكل لوحة
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedItemForImage, setSelectedItemForImage] = useState<InstallationTaskItem | null>(null);
  const [installedImageUrl, setInstalledImageUrl] = useState<string>('');
  const [installedImageFaceAUrl, setInstalledImageFaceAUrl] = useState<string>('');
  const [installedImageFaceBUrl, setInstalledImageFaceBUrl] = useState<string>('');
  // Fetch installation tasks (from Oct 2025 onwards)
  const { data: tasks = [], isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['installation-tasks'],
    queryFn: async () => {
      const oct2025 = new Date('2025-10-01');
      
      const { data: allTasks, error } = await supabase
        .from('installation_tasks')
        .select('*')
        .gte('created_at', oct2025.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`📋 Loaded ${allTasks?.length || 0} installation tasks`);
      
      return allTasks as InstallationTask[];
    },
  });

  // Fetch task items
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: allTaskItems = [], refetch: refetchTaskItems } = useQuery({
    queryKey: ['installation-task-items', taskIds.length],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds)
        .order('status', { ascending: true });
      
      if (error) throw error;
      return data as InstallationTaskItem[];
    },
  });

  // Fetch billboards
  const billboardIds = useMemo(() => 
    [...new Set(allTaskItems.map(i => i.billboard_id))],
    [allTaskItems]
  );
  const { data: billboards = [] } = useQuery({
    queryKey: ['billboards-for-tasks', ...billboardIds],
    enabled: billboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);
      
      if (error) throw error;
      return data;
    },
  });

  const billboardById = useMemo(() => {
    const map: Record<number, any> = {};
    billboards.forEach(b => { map[b.ID] = b; });
    return map;
  }, [billboards]);

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const teamById = useMemo(() => {
    const map: Record<string, any> = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  // Fetch contracts
  const contractIds = useMemo(() => 
    [...new Set(tasks.map(t => t.contract_id))],
    [tasks]
  );
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-tasks', ...contractIds],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", billboard_ids')
        .in('Contract_Number', contractIds);
      
      if (error) throw error;
      return data;
    },
  });

  const contractById = useMemo(() => {
    const map: Record<number, any> = {};
    contracts.forEach(c => { map[c.Contract_Number] = c; });
    return map;
  }, [contracts]);

  // Fetch all task designs
  const { data: allTaskDesigns = [], refetch: refetchDesigns } = useQuery({
    queryKey: ['task-designs', taskIds.length],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_designs')
        .select('*')
        .in('task_id', taskIds)
        .order('design_order', { ascending: true });
      
      if (error) throw error;
      return data as TaskDesign[];
    },
  });

  const designsByTask = useMemo(() => {
    const map: Record<string, TaskDesign[]> = {};
    allTaskDesigns.forEach(d => {
      if (!map[d.task_id]) map[d.task_id] = [];
      map[d.task_id].push(d);
    });
    return map;
  }, [allTaskDesigns]);

  // جلب أسعار التركيب من جدول اللوحات مباشرة
  const installationPricingByBillboard = useMemo(() => {
    const map: Record<number, number> = {};
    billboards.forEach((b: any) => {
      const cost = b.installation_cost || 0;
      map[b.ID] = cost;
    });
    return map;
  }, [billboards]);

  // Available contracts for manual task creation
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const { data: availableContracts = [] } = useQuery({
    queryKey: ['available-contracts', taskType],
    enabled: addTaskDialogOpen,
    queryFn: async () => {
      const oct2025 = new Date('2025-10-01');
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", billboard_ids')
        .gte('Contract_Number', 1161);
      
      // إذا كان نوع المهمة "إعادة تركيب"، اعرض جميع العقود الساريه المفعول بدون تحديد تاريخ
      if (taskType === 'reinstallation') {
        query = query.gte('"End Date"', today);
      } else {
        // إذا كان "تركيب جديد"، اعرض العقود من أكتوبر 2025 فصاعداً
        query = query.gte('"Contract Date"', oct2025.toISOString().split('T')[0]);
      }
      
      const { data, error } = await query.order('Contract_Number', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Filter contracts by search term
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return availableContracts;
    const search = contractSearchTerm.toLowerCase();
    return availableContracts.filter(c => 
      String(c.Contract_Number).includes(search) ||
      c['Customer Name']?.toLowerCase().includes(search) ||
      c['Ad Type']?.toLowerCase().includes(search)
    );
  }, [availableContracts, contractSearchTerm]);

  // Group tasks by team for display
  const tasksByTeam = useMemo(() => {
    const map: Record<string, InstallationTask[]> = {};
    
    let filteredTasks = tasks;
    
    // Apply filters
    if (filterStatus !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
    }
    if (filterTeam !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.team_id === filterTeam);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(t => {
        const contract = contractById[t.contract_id];
        const taskBillboards = allTaskItems
          .filter(item => item.task_id === t.id)
          .map(item => billboardById[item.billboard_id])
          .filter(Boolean);
        
        return (
          String(t.contract_id).includes(search) ||
          contract?.['Customer Name']?.toLowerCase().includes(search) ||
          contract?.['Ad Type']?.toLowerCase().includes(search) ||
          taskBillboards.some(b => 
            b?.Billboard_Name?.toLowerCase().includes(search) ||
            b?.Municipality?.toLowerCase().includes(search) ||
            b?.District?.toLowerCase().includes(search) ||
            String(b?.ID || '').includes(search)
          )
        );
      });
    }

    filteredTasks.forEach(task => {
      const teamId = task.team_id || 'no-team';
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push(task);
    });

    return map;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractById, allTaskItems, billboardById]);

  // Create manual task or re-trigger auto-creation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (selectedContractIds.length === 0) {
        throw new Error('يرجى اختيار عقد واحد على الأقل');
      }

      // If team is selected, create manual task for specific team
      if (selectedTeamId) {
        for (const contractId of selectedContractIds) {
          const contract = availableContracts.find(c => c.Contract_Number === contractId);
          if (!contract?.billboard_ids) continue;

          const billboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim()));
          
          // Check if task already exists
          const { data: existingTask } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', selectedTeamId)
            .single();

          let taskId = existingTask?.id;

          if (!taskId) {
            // Create new task
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                team_id: selectedTeamId,
                status: 'pending'
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }

          // Add task items for each billboard
          for (const billboardId of billboardIds) {
            // Check if already exists
            const { data: existing } = await supabase
              .from('installation_task_items')
              .select('id')
              .eq('task_id', taskId)
              .eq('billboard_id', billboardId)
              .single();

            if (!existing) {
              await supabase
                .from('installation_task_items')
                .insert({
                  task_id: taskId,
                  billboard_id: billboardId,
                  status: 'pending'
                });
            }
          }
        }
      } else {
        // No team selected = auto-distribute to all teams based on sizes
        for (const contractId of selectedContractIds) {
          // Trigger auto-creation by updating the contract
          const { error } = await supabase
            .from('Contract')
            .update({ billboard_ids: (await supabase.from('Contract').select('billboard_ids').eq('Contract_Number', contractId).single()).data?.billboard_ids })
            .eq('Contract_Number', contractId);
          
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(selectedTeamId ? 'تم إضافة المهمة بنجاح' : 'تم توزيع المهام على الفرق تلقائياً');
      setAddTaskDialogOpen(false);
      setSelectedContractIds([]);
      setSelectedTeamId('');
      setContractSearchTerm('');
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إضافة المهمة');
    },
  });

  // Complete task item
  const completeItemMutation = useMutation({
    mutationFn: async ({ itemId, date, notes }: { itemId: string; date: string; notes?: string }) => {
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          status: 'completed',
          installation_date: date,
          notes: notes || null
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إكمال اللوحة');
      refetchTaskItems();
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Delete task items first
      const { error: itemsError } = await supabase
        .from('installation_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      // Delete task
      const { error: taskError } = await supabase
        .from('installation_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة');
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المهمة');
    },
  });

  const handleRefreshAll = () => {
    refetchTasks();
    refetchTaskItems();
    refetchDesigns();
  };

  // Stats
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalBillboards = allTaskItems.length;
    const completedBillboards = allTaskItems.filter(i => i.status === 'completed').length;

    return { totalTasks, pendingTasks, completedTasks, totalBillboards, completedBillboards };
  }, [tasks, allTaskItems]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">مهام التركيب</h1>
          <p className="text-muted-foreground">إدارة مهام التركيب وإعادة التركيب - يتم إنشاء المهام تلقائياً وتحديثها عند تعديل العقود</p>
        </div>
        <Button onClick={() => setAddTaskDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة مهمة
        </Button>
      </div>

      {/* Info Alert */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">النظام الديناميكي للمهام</p>
              <p className="text-xs text-muted-foreground">
                • يتم إنشاء المهام تلقائياً من العقود (رقم 1161 فصاعداً)
                <br />
                • يتم توزيع اللوحات على الفرق حسب المقاسات المخصصة لكل فريق
                <br />
                • عند إضافة أو حذف لوحة من العقد، يتم تحديث المهام فوراً
                <br />
                • يمكنك إضافة مهمة يدوياً لفريق محدد أو توزيعها تلقائياً على جميع الفرق
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">معلقة</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">اللوحات</p>
                <p className="text-2xl font-bold">{stats.totalBillboards}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">لوحات مركبة</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedBillboards}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="رقم العقد، العميل، رقم اللوحة، المدينة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter-status">الحالة</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-team">الفريق</Label>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger id="filter-team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.team_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleRefreshAll} className="w-full">
                تحديث
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks grouped by team */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : Object.keys(tasksByTeam).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد مهام</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(tasksByTeam).map(([teamId, teamTasks]) => {
            const team = teamById[teamId];
            const teamItems = allTaskItems.filter(item => 
              teamTasks.some(t => t.id === item.task_id)
            );
            const completedCount = teamItems.filter(i => i.status === 'completed').length;

            return (
              <Collapsible key={teamId}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <div className="text-right">
                            <CardTitle className="text-lg">
                              {team?.team_name || 'فريق غير محدد'}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {teamTasks.length} مهمة · {teamItems.length} لوحة
                              {completedCount > 0 && ` · ${completedCount} مكتملة`}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {teamTasks.map(task => {
                        const contract = contractById[task.contract_id];
                        const taskItems = allTaskItems.filter(i => i.task_id === task.id);
                        const taskDesigns = designsByTask[task.id] || [];
                        const completedItems = taskItems.filter(i => i.status === 'completed').length;
                        
                        // حساب تكلفة تركيب الفرقة من سعر اللوحة مباشرة
                        const totalInstallCost = taskItems.reduce((sum, item) => {
                          const price = installationPricingByBillboard[item.billboard_id] || 0;
                          return sum + price;
                        }, 0);

                        return (
                          <Collapsible key={task.id}>
                            <Card className="border-2">
                              <CardHeader className="space-y-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="text-right space-y-1">
                       <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold">
                          #{task.contract_id}
                        </Badge>
                        {contract?.['Ad Type'] && (
                          <Badge variant="secondary">
                            {contract['Ad Type']}
                          </Badge>
                        )}
                        <span className="font-bold">
                          {contract?.['Customer Name'] || 'غير محدد'}
                        </span>
                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{taskItems.length} لوحة</span>
                                        {completedItems > 0 && (
                                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            {completedItems} مكتملة
                                          </Badge>
                                        )}
                                        {totalInstallCost > 0 && (
                                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            تكلفة التركيب: {totalInstallCost.toLocaleString('ar-LY')} د.ل
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForDesign(task.id);
                                        setDesignDialogOpen(true);
                                      }}
                                    >
                                      <PaintBucket className="h-4 w-4 mr-2" />
                                      إدارة التصاميم
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPrintTaskId(task.id);
                                        setPrintDialogOpen(true);
                                      }}
                                    >
                                      <Printer className="h-4 w-4 mr-2" />
                                      طباعة
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                          deleteTaskMutation.mutate(task.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      حذف
                                    </Button>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </div>
                              </CardHeader>
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {taskItems.map(item => {
                                      const billboard = billboardById[item.billboard_id];
                                      return (
                                        <BillboardTaskCard
                                          key={item.id}
                                          item={item}
                                          billboard={billboard}
                                          isSelected={false}
                                          isCompleted={item.status === 'completed'}
                                          taskDesigns={taskDesigns}
                                          onSelectionChange={(checked) => {
                                            if (checked && item.status !== 'completed') {
                                              completeItemMutation.mutate({
                                                itemId: item.id,
                                                date: new Date().toISOString().split('T')[0]
                                              });
                                            }
                                          }}
                                          onUncomplete={item.status === 'completed' ? async () => {
                                            try {
                                              const { error } = await supabase
                                                .from('installation_task_items')
                                                .update({ status: 'pending', installation_date: null })
                                                .eq('id', item.id);
                                              
                                              if (error) throw error;
                                              toast.success('تم التراجع عن إكمال اللوحة');
                                              refetchTaskItems();
                                            } catch (error) {
                                              console.error('Error:', error);
                                              toast.error('فشل في التراجع عن الإكمال');
                                            }
                                          } : undefined}
                                          onEditDesign={() => {
                                            setSelectedTaskForDesign(item.task_id);
                                            setDesignDialogOpen(true);
                                          }}
                                          onPrint={() => {
                                            setPrintTaskId(item.task_id);
                                            setPrintDialogOpen(true);
                                          }}
                                          onAddInstalledImage={() => {
                                            setSelectedItemForImage(item);
                                            setInstalledImageUrl(item.installed_image_url || '');
                                            setInstalledImageFaceAUrl(item.installed_image_face_a_url || '');
                                            setInstalledImageFaceBUrl(item.installed_image_face_b_url || '');
                                            setImageDialogOpen(true);
                                          }}
                                          onRefresh={refetchTaskItems}
                                        />
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={addTaskDialogOpen} onOpenChange={setAddTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة مهمة تركيب</DialogTitle>
            <p className="text-sm text-muted-foreground">
              يمكنك إضافة مهمة لفريق محدد، أو تركه فارغاً ليتم توزيع المهمة تلقائياً على جميع الفرق حسب المقاسات
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>نوع المهمة</Label>
              <Select value={taskType} onValueChange={(v: any) => setTaskType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">تركيب جديد</SelectItem>
                  <SelectItem value="reinstallation">إعادة تركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>البحث عن عقد</Label>
              <div className="relative mb-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث برقم العقد أو اسم العميل..."
                  value={contractSearchTerm}
                  onChange={(e) => setContractSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Label>العقد</Label>
              <Select
                value={selectedContractIds[0]?.toString() || ''}
                onValueChange={(v) => setSelectedContractIds([parseInt(v)])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر عقد..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredContracts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      لا توجد نتائج
                    </div>
                  ) : (
                    filteredContracts.map(contract => (
                      <SelectItem key={contract.Contract_Number} value={contract.Contract_Number.toString()}>
                        <div className="flex flex-col items-start">
                          <span className="font-bold">#{contract.Contract_Number} - {contract['Customer Name']}</span>
                          {contract['Ad Type'] && (
                            <span className="text-xs text-muted-foreground">{contract['Ad Type']}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفريق (اختياري)</Label>
              <Select value={selectedTeamId || 'auto'} onValueChange={(v) => setSelectedTeamId(v === 'auto' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="توزيع تلقائي على جميع الفرق" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="auto">توزيع تلقائي على جميع الفرق</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.team_name} - ({team.sizes?.join(', ') || 'بدون مقاسات'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedTeamId && (
                <p className="text-xs text-muted-foreground mt-1">
                  سيتم توزيع اللوحات على الفرق حسب المقاسات المحددة لكل فريق تلقائياً
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setAddTaskDialogOpen(false);
                setContractSearchTerm('');
              }}>
                إلغاء
              </Button>
              <Button 
                onClick={() => createTaskMutation.mutate()}
                disabled={createTaskMutation.isPending || selectedContractIds.length === 0}
              >
                {createTaskMutation.isPending ? 'جاري الإضافة...' : 'إضافة المهمة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Design Manager Dialog */}
      {selectedTaskForDesign && (
        <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إدارة التصاميم</DialogTitle>
            </DialogHeader>
            <TaskDesignManager
              taskId={selectedTaskForDesign}
              designs={designsByTask[selectedTaskForDesign] || []}
              onDesignsUpdate={() => {
                refetchDesigns();
                refetchTaskItems();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Print Dialog */}
      {printTaskId && (
        <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>طباعة اللوحات</DialogTitle>
            </DialogHeader>
            <BillboardPrintIndividual
              contractNumber={tasks.find(t => t.id === printTaskId)?.contract_id || 0}
              billboards={allTaskItems
                .filter(i => i.task_id === printTaskId)
                .map(i => billboardById[i.billboard_id])
                .filter(Boolean)}
              designData={designsByTask[printTaskId] || []}
              taskItems={allTaskItems.filter(i => i.task_id === printTaskId)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Installed Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة صور التركيب</DialogTitle>
            <p className="text-sm text-muted-foreground">أضف صور التركيب للوجه الأمامي والخلفي لتظهر في الطباعة فوق التصاميم</p>
          </DialogHeader>
          <div className="space-y-6">
            {/* صورة التركيب - الوجه الأمامي */}
            <div className="space-y-2">
              <Label htmlFor="installedImageFaceA" className="text-base font-semibold">صورة التركيب - الوجه الأمامي</Label>
              <Input
                id="installedImageFaceA"
                value={installedImageFaceAUrl}
                onChange={(e) => setInstalledImageFaceAUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
              {installedImageFaceAUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-green-500/30 bg-muted">
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                    الوجه الأمامي
                  </div>
                  <img
                    src={installedImageFaceAUrl}
                    alt="معاينة صورة التركيب - الوجه الأمامي"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
              )}
            </div>

            {/* صورة التركيب - الوجه الخلفي */}
            <div className="space-y-2">
              <Label htmlFor="installedImageFaceB" className="text-base font-semibold">صورة التركيب - الوجه الخلفي</Label>
              <Input
                id="installedImageFaceB"
                value={installedImageFaceBUrl}
                onChange={(e) => setInstalledImageFaceBUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
              {installedImageFaceBUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-500/30 bg-muted">
                  <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                    الوجه الخلفي
                  </div>
                  <img
                    src={installedImageFaceBUrl}
                    alt="معاينة صورة التركيب - الوجه الخلفي"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={async () => {
                  if (!selectedItemForImage) return;
                  
                  try {
                    const { error } = await supabase
                      .from('installation_task_items')
                      .update({ 
                        installed_image_url: installedImageUrl || null,
                        installed_image_face_a_url: installedImageFaceAUrl || null,
                        installed_image_face_b_url: installedImageFaceBUrl || null
                      })
                      .eq('id', selectedItemForImage.id);

                    if (error) throw error;
                    
                    toast.success('تم حفظ صور التركيب بنجاح');
                    setImageDialogOpen(false);
                    setSelectedItemForImage(null);
                    setInstalledImageUrl('');
                    setInstalledImageFaceAUrl('');
                    setInstalledImageFaceBUrl('');
                    refetchTaskItems();
                  } catch (error) {
                    console.error('Error saving images:', error);
                    toast.error('فشل في حفظ صور التركيب');
                  }
                }}
                className="flex-1"
              >
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImageDialogOpen(false);
                  setSelectedItemForImage(null);
                  setInstalledImageUrl('');
                  setInstalledImageFaceAUrl('');
                  setInstalledImageFaceBUrl('');
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
