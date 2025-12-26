import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CutoutTaskPrintDialog } from '@/components/billing/CutoutTaskPrintDialog';
import { PrintTaskPrintDialog } from '@/components/billing/PrintTaskPrintDialog';
import { 
  Search, 
  Printer, 
  TrendingUp, 
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Wallet,
  FileText,
  Scissors,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PrinterAccount {
  printer_id: string;
  printer_name: string;
  customer_id: string | null;
  customer_name: string | null;
  total_print_costs: number;
  total_cutout_costs: number;
  total_supplier_debt: number;
  total_payments_to_printer: number;
  total_customer_debt: number;
  total_customer_payments: number;
  final_balance: number;
  print_tasks_count: number;
  cutout_tasks_count: number;
}

interface PrintTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_area: number;
  total_cost: number;
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface CutoutTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function PrinterAccounts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(new Set());
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedCutoutTask, setSelectedCutoutTask] = useState<CutoutTask | null>(null);
  const [printTaskDialogOpen, setPrintTaskDialogOpen] = useState(false);
  const [selectedPrintTask, setSelectedPrintTask] = useState<PrintTask | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['printer-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_accounts')
        .select('*')
        .order('printer_name');
      
      if (error) throw error;
      return (data || []) as PrinterAccount[];
    }
  });

  const { data: printTasks = [] } = useQuery({
    queryKey: ['printer-print-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase
        .from('print_tasks')
        .select('*')
        .eq('printer_id', selectedPrinterId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PrintTask[];
    },
    enabled: !!selectedPrinterId
  });

  const { data: cutoutTasks = [] } = useQuery({
    queryKey: ['printer-cutout-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase
        .from('cutout_tasks')
        .select('*')
        .eq('printer_id', selectedPrinterId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as CutoutTask[];
    },
    enabled: !!selectedPrinterId
  });

  const filteredAccounts = accounts.filter(account =>
    account.printer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Overall stats
  const overallStats = useMemo(() => {
    return accounts.reduce((acc, a) => ({
      totalPrinters: acc.totalPrinters + 1,
      totalTasks: acc.totalTasks + a.print_tasks_count + a.cutout_tasks_count,
      totalOwed: acc.totalOwed + (a.final_balance > 0 ? a.final_balance : 0),
      totalOwing: acc.totalOwing + (a.final_balance < 0 ? Math.abs(a.final_balance) : 0),
    }), { totalPrinters: 0, totalTasks: 0, totalOwed: 0, totalOwing: 0 });
  }, [accounts]);

  const selectedPrinter = accounts.find(a => a.printer_id === selectedPrinterId);

  // Group tasks by contract
  const groupedPrintTasks = printTasks.reduce((groups, task) => {
    const contractId = task.contract_id || 0;
    if (!groups[contractId]) groups[contractId] = [];
    groups[contractId].push(task);
    return groups;
  }, {} as Record<number, PrintTask[]>);

  const groupedCutoutTasks = cutoutTasks.reduce((groups, task) => {
    const contractId = task.contract_id || 0;
    if (!groups[contractId]) groups[contractId] = [];
    groups[contractId].push(task);
    return groups;
  }, {} as Record<number, CutoutTask[]>);

  // Merge all contracts
  const allContractIds = [...new Set([
    ...Object.keys(groupedPrintTasks).map(Number),
    ...Object.keys(groupedCutoutTasks).map(Number)
  ])].sort((a, b) => b - a);

  const toggleContract = (contractId: number) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  const handlePrintCutoutTask = (task: CutoutTask) => {
    setSelectedCutoutTask(task);
    setPrintDialogOpen(true);
  };

  const handlePrintPrintTask = (task: PrintTask) => {
    setSelectedPrintTask(task);
    setPrintTaskDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />مكتمل</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"><Clock className="h-3 w-3 mr-1" />معلق</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">قيد التنفيذ</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">حسابات المطابع</h1>
          <p className="text-muted-foreground">إدارة ومتابعة حسابات شركات الطباعة والقص</p>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد المطابع</p>
                <p className="text-2xl font-bold">{overallStats.totalPrinters}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/20">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{overallStats.totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-500/20">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مستحقات لنا</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {overallStats.totalOwed.toLocaleString()} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مستحقات علينا</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {overallStats.totalOwing.toLocaleString()} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن مطبعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </Card>

      {/* Printer Summary Cards */}
      {!selectedPrinterId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              جاري التحميل...
            </Card>
          ) : filteredAccounts.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد مطابع
            </Card>
          ) : (
            filteredAccounts.map((account) => (
              <Card 
                key={account.printer_id}
                className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:bg-muted/30"
                onClick={() => setSelectedPrinterId(account.printer_id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Printer className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{account.printer_name}</CardTitle>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={account.final_balance > 0 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : account.final_balance < 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : ''
                      }
                    >
                      {account.final_balance > 0 ? 'لنا' : account.final_balance < 0 ? 'علينا' : 'متعادل'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Print Tasks */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">مهام الطباعة</span>
                    </div>
                    <div className="text-left">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                        {account.print_tasks_count}
                      </Badge>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 mr-2">
                        {account.total_print_costs.toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                  
                  {/* Cutout Tasks */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">مهام القص</span>
                    </div>
                    <div className="text-left">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                        {account.cutout_tasks_count}
                      </Badge>
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 mr-2">
                        {account.total_cutout_costs.toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>

                  {/* Payments */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-500" />
                      <span className="text-sm">المدفوعات</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {account.total_payments_to_printer.toLocaleString()} د.ل
                    </span>
                  </div>
                  
                  {/* Final Balance */}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">الرصيد النهائي</span>
                      <span className={`font-bold text-lg ${
                        account.final_balance > 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : account.final_balance < 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-primary'
                      }`}>
                        {Math.abs(account.final_balance).toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Printer Details */}
      {selectedPrinterId && selectedPrinter && (
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedPrinterId(null);
                  setExpandedContracts(new Set());
                }}
                className="hover:bg-muted"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>تفاصيل حساب: {selectedPrinter.printer_name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {printTasks.length} مهمة طباعة - {cutoutTasks.length} مهمة قص
                  </p>
                </div>
              </div>
            </div>
            
            {/* Balance Summary */}
            <div className="flex items-center gap-4 bg-muted/50 px-4 py-2 rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">الرصيد: </span>
                <span className={`font-bold ${
                  selectedPrinter.final_balance > 0 ? 'text-red-600' : 
                  selectedPrinter.final_balance < 0 ? 'text-green-600' : ''
                }`}>
                  {Math.abs(selectedPrinter.final_balance).toLocaleString()} د.ل
                </span>
                <span className="text-xs text-muted-foreground mr-1">
                  {selectedPrinter.final_balance > 0 ? '(لنا)' : selectedPrinter.final_balance < 0 ? '(علينا)' : ''}
                </span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 space-y-4">
            {allContractIds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد مهام لهذه المطبعة
              </div>
            ) : (
              allContractIds.map((contractId) => {
                const contractPrintTasks = groupedPrintTasks[contractId] || [];
                const contractCutoutTasks = groupedCutoutTasks[contractId] || [];
                const isExpanded = expandedContracts.has(contractId);
                const customerName = contractPrintTasks[0]?.customer_name || contractCutoutTasks[0]?.customer_name || 'غير محدد';
                
                const totalPrintCost = contractPrintTasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);
                const totalCutoutCost = contractCutoutTasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);
                
                return (
                  <Collapsible 
                    key={contractId} 
                    open={isExpanded}
                    onOpenChange={() => toggleContract(contractId)}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-primary border-primary">
                                عقد #{contractId || 'بدون عقد'}
                              </Badge>
                              <span className="text-sm font-medium flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {customerName}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <span>{contractPrintTasks.length}</span>
                              <span className="text-blue-600 font-medium">{totalPrintCost.toLocaleString()} د.ل</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Scissors className="h-4 w-4 text-purple-500" />
                              <span>{contractCutoutTasks.length}</span>
                              <span className="text-purple-600 font-medium">{totalCutoutCost.toLocaleString()} د.ل</span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-4 bg-muted/20">
                          {/* Print Tasks */}
                          {contractPrintTasks.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-600">
                                <FileText className="h-4 w-4" />
                                مهام الطباعة
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {contractPrintTasks.map((task) => (
                                  <Card key={task.id} className="p-3 border-blue-200 dark:border-blue-800">
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          {getStatusBadge(task.status)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          المساحة: {task.total_area?.toFixed(2) || 0} م²
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          السعر/م: {task.price_per_meter || 0} د.ل
                                        </p>
                                        {task.due_date && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-left space-y-2">
                                        <p className="font-bold text-blue-600 dark:text-blue-400">
                                          {(task.total_cost || 0).toLocaleString()} د.ل
                                        </p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 text-xs border-blue-300 hover:bg-blue-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrintPrintTask(task);
                                          }}
                                        >
                                          <Printer className="h-3 w-3" />
                                          طباعة
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Cutout Tasks */}
                          {contractCutoutTasks.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-600">
                                <Scissors className="h-4 w-4" />
                                مهام القص
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {contractCutoutTasks.map((task) => (
                                  <Card key={task.id} className="p-3 border-purple-200 dark:border-purple-800">
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          {getStatusBadge(task.status)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          الكمية: {task.total_quantity || 0} قطعة
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          السعر/قطعة: {task.unit_cost || 0} د.ل
                                        </p>
                                        {task.due_date && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-left space-y-2">
                                        <p className="font-bold text-purple-600 dark:text-purple-400">
                                          {(task.total_cost || 0).toLocaleString()} د.ل
                                        </p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 text-xs border-purple-300 hover:bg-purple-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrintCutoutTask(task);
                                          }}
                                        >
                                          <Printer className="h-3 w-3" />
                                          طباعة
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-blue-900 dark:text-blue-100">ملاحظة هامة:</p>
            <p className="text-blue-800 dark:text-blue-200">
              • <strong>الرصيد الموجب (أحمر)</strong>: يعني المطبعة لها عليهم مبلغ (ديون الزبون أكثر من المستحقات)
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              • <strong>الرصيد السالب (أخضر)</strong>: يعني علينا ندفع للمطبعة هذا المبلغ
            </p>
          </div>
        </div>
      </Card>

      {/* Cutout Task Print Dialog */}
      {selectedCutoutTask && selectedPrinter && (
        <CutoutTaskPrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          task={selectedCutoutTask}
          printerName={selectedPrinter.printer_name}
        />
      )}

      {/* Print Task Print Dialog */}
      {selectedPrintTask && selectedPrinter && (
        <PrintTaskPrintDialog
          open={printTaskDialogOpen}
          onOpenChange={setPrintTaskDialogOpen}
          task={selectedPrintTask}
          printerName={selectedPrinter.printer_name}
        />
      )}
    </div>
  );
}
