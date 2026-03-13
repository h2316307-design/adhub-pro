import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Clock, Layers } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface OverdueCompositeTask {
  id: string;
  taskNumber: number;
  taskType: string;
  customerName: string;
  customerTotal: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
  daysOverdue: number;
  contractId: number | null;
  adType: string;
}

export function OverdueCompositeTasksAlert() {
  const [overdueTasks, setOverdueTasks] = useState<OverdueCompositeTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverdueTasks();
  }, []);

  const loadOverdueTasks = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const overdue: OverdueCompositeTask[] = [];

      const { data: tasks, error } = await supabase
        .from('composite_tasks')
        .select('id, task_number, task_type, customer_name, customer_total, paid_amount, created_at, status, contract_id')
        .not('status', 'eq', 'cancelled');

      if (error) {
        console.error('Error loading composite tasks:', error);
        return;
      }

      // جلب أنواع الإعلان من العقود دفعة واحدة
      const contractIds = [...new Set((tasks || []).map(t => t.contract_id).filter(Boolean))] as number[];
      const adTypeMap = new Map<number, string>();
      if (contractIds.length > 0) {
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type"')
          .in('Contract_Number', contractIds);
        for (const c of contracts || []) {
          if (c['Ad Type']) adTypeMap.set(c.Contract_Number, c['Ad Type']);
        }
      }

      for (const task of tasks || []) {
        const customerTotal = Number(task.customer_total) || 0;
        const paidAmount = Number(task.paid_amount) || 0;
        const remaining = customerTotal - paidAmount;
        
        if (remaining <= 0 || customerTotal <= 0) continue;

        const createdAt = new Date(task.created_at || '');
        const diffDays = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 15) {
          overdue.push({
            id: task.id,
            taskNumber: task.task_number,
            taskType: task.task_type,
            customerName: task.customer_name || 'غير معروف',
            customerTotal,
            paidAmount,
            remainingAmount: remaining,
            createdAt: task.created_at || '',
            daysOverdue: diffDays,
            contractId: task.contract_id,
            adType: task.contract_id ? (adTypeMap.get(task.contract_id) || '') : '',
          });
        }
      }

      overdue.sort((a, b) => b.remainingAmount - a.remainingAmount);
      setOverdueTasks(overdue.slice(0, 5));
    } catch (error) {
      console.error('Error loading overdue composite tasks:', error);
      toast.error('خطأ في تحميل المهام المجمعة المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'installation_print': 'تركيب + طباعة',
      'installation_print_cutout': 'تركيب + طباعة + قص',
      'installation_cutout': 'تركيب + قص',
      'print_cutout': 'طباعة + قص',
      'installation': 'تركيب',
      'print': 'طباعة',
      'cutout': 'قص',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <Card className="border-purple-300 dark:border-purple-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span>جاري تحميل المهام المجمعة المتأخرة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overdueTasks.length === 0) return null;

  return (
    <Card className="border-purple-400 dark:border-purple-600 bg-gradient-to-br from-purple-500/5 to-violet-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-base">
          <Layers className="h-5 w-5" />
          مهام مجمعة متأخرة ({overdueTasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {overdueTasks.map((task) => (
            <Card
              key={task.id}
              className="border-purple-300/40 dark:border-purple-700/40 bg-background hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                      {task.daysOverdue} يوم
                    </Badge>
                    <span className="font-bold text-foreground text-sm">#{task.taskNumber}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-foreground truncate" title={task.customerName}>
                      {task.customerName}
                    </div>
                    {task.contractId && (
                      <div className="text-xs text-muted-foreground">
                        عقد #{task.contractId}
                        {task.adType && <span className="mr-1 text-purple-600 dark:text-purple-400">({task.adType})</span>}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">
                      {getTaskTypeLabel(task.taskType)}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400 font-bold text-lg">
                      {formatAmount(task.remainingAmount)} د.ل
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString('ar-LY')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
