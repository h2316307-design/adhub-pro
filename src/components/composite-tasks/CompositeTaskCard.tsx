import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { Wrench, Printer, Scissors, Edit, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CompositeTaskCardProps {
  task: CompositeTaskWithDetails;
  onEditCosts?: (task: CompositeTaskWithDetails) => void;
  onViewInvoice?: (task: CompositeTaskWithDetails) => void;
}

export const CompositeTaskCard: React.FC<CompositeTaskCardProps> = ({
  task,
  onEditCosts,
  onViewInvoice
}) => {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'قيد الانتظار', variant: 'outline' },
      in_progress: { label: 'قيد التنفيذ', variant: 'default' },
      completed: { label: 'مكتمل', variant: 'secondary' },
      cancelled: { label: 'ملغي', variant: 'destructive' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTaskTypeBadge = (type: string) => {
    if (type === 'new_installation') {
      return <Badge className="bg-blue-500">تركيب جديد (شامل)</Badge>;
    }
    return <Badge className="bg-orange-500">إعادة تركيب</Badge>;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-lg">
              {task.customer_name || 'غير محدد'} - عقد #{task.contract_id}
            </CardTitle>
            <div className="flex gap-2">
              {getTaskTypeBadge(task.task_type)}
              {getStatusBadge(task.status)}
            </div>
          </div>
          <div className="text-left text-sm text-muted-foreground">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* المهام المرتبطة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* مهمة التركيب */}
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <Wrench className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <div className="text-sm font-medium">التركيب</div>
              <div className="text-lg font-bold text-orange-600">
                {task.installation_cost.toLocaleString('ar-LY')} د.ل
              </div>
            </div>
          </div>

          {/* مهمة الطباعة */}
          {task.print_task_id && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <Printer className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">الطباعة</div>
                <div className="text-lg font-bold text-blue-600">
                  {task.print_cost.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            </div>
          )}

          {/* مهمة القص */}
          {task.cutout_task_id && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <Scissors className="h-5 w-5 text-purple-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">القص</div>
                <div className="text-lg font-bold text-purple-600">
                  {task.cutout_cost.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            </div>
          )}
        </div>

        {/* الإجمالي */}
        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
          <span className="font-semibold">الإجمالي:</span>
          <span className="text-2xl font-bold text-primary">
            {task.total_cost.toLocaleString('ar-LY')} د.ل
          </span>
        </div>

        {/* ملاحظات */}
        {task.notes && (
          <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
            {task.notes}
          </div>
        )}

        {/* الإجراءات */}
        <div className="flex gap-2 pt-2">
          {onEditCosts && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCosts(task)}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              تعديل التكاليف
            </Button>
          )}

          {task.combined_invoice_id && onViewInvoice && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewInvoice(task)}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              عرض الفاتورة
            </Button>
          )}

        </div>
      </CardContent>
    </Card>
  );
};
