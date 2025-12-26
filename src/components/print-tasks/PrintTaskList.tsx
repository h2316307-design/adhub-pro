import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2, Printer, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PrintTaskListProps {
  tasks: any[];
  selectedTaskId: string | null;
  onSelectTask: (task: any) => void;
  isLoading: boolean;
}

export function PrintTaskList({ tasks, selectedTaskId, onSelectTask, isLoading }: PrintTaskListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Printer;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'in_progress': return 'قيد التنفيذ';
      case 'cancelled': return 'ملغي';
      default: return 'معلق';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'عاجل';
      case 'high': return 'عالية';
      case 'low': return 'منخفضة';
      default: return 'عادية';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Printer className="h-12 w-12 mx-auto mb-4 animate-pulse" />
        <p>جاري تحميل المهام...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Printer className="h-12 w-12 mx-auto mb-4" />
        <p>لا توجد مهام طباعة</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const StatusIcon = getStatusIcon(task.status);
        
        return (
          <Card
            key={task.id}
            onClick={() => onSelectTask(task)}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedTaskId === task.id ? 'ring-2 ring-primary bg-primary/5' : ''
            }`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {task.customer_name || 'بدون اسم'}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.printed_invoices?.invoice_number || `#${task.id.slice(0, 8)}`}
                  </p>
                </div>
                <Badge className={getPriorityColor(task.priority)}>
                  {getPriorityLabel(task.priority)}
                </Badge>
              </div>

              {/* Status */}
              <Badge className={`${getStatusColor(task.status)} gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {getStatusLabel(task.status)}
              </Badge>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">المساحة:</span>
                  <div className="font-semibold">{task.total_area?.toFixed(2)} م²</div>
                </div>
                <div>
                  <span className="text-muted-foreground">التكلفة:</span>
                  <div className="font-semibold">{task.total_cost?.toLocaleString()} د.ل</div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span>{task.printers?.name || 'بدون مطبعة'}</span>
                  <span>{format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}</span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
