import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CutoutTask {
  id: string;
  customer_name: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  printers?: { name: string } | null;
}

interface CutoutTaskListProps {
  tasks: CutoutTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: CutoutTask) => void;
  isLoading: boolean;
}

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500'
};

const statusLabels = {
  pending: 'معلق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي'
};

const priorityColors = {
  low: 'bg-gray-500',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500'
};

const priorityLabels = {
  low: 'منخفض',
  normal: 'عادي',
  high: 'عالي',
  urgent: 'عاجل'
};

export function CutoutTaskList({ tasks, selectedTaskId, onSelectTask, isLoading }: CutoutTaskListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Scissors className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>لا توجد مهام مجسمات</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className={cn(
              "p-4 cursor-pointer transition-all hover:shadow-md",
              selectedTaskId === task.id && "ring-2 ring-primary"
            )}
            onClick={() => onSelectTask(task)}
          >
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">
                    {task.customer_name || 'بدون اسم'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {task.printers?.name || 'لم يتم التحديد'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={cn("text-xs", statusColors[task.status])}>
                    {statusLabels[task.status]}
                  </Badge>
                  <Badge className={cn("text-xs", priorityColors[task.priority])}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">الكمية:</span>
                  <span className="font-medium mr-1">{task.total_quantity}</span>
                </div>
                <div className="text-left">
                  <span className="text-muted-foreground">التكلفة:</span>
                  <span className="font-medium mr-1">{task.total_cost.toFixed(2)} د.ل</span>
                </div>
              </div>

              {/* Date */}
              <div className="text-xs text-muted-foreground">
                {new Date(task.created_at).toLocaleDateString('ar-LY')}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
