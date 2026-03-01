/**
 * SmartBillboardConfirmDialog
 * نافذة تأكيد حذف اللوحات مع عرض المهام المرتبطة والاختيار بينها
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Wrench, Printer, Box, Trash2, ArrowLeftRight } from 'lucide-react';
import type { BillboardTaskLinks, LinkedTaskInfo } from '@/services/smartBillboardService';

export type TaskTypeSelection = {
  installation: boolean;
  print: boolean;
  cutout: boolean;
  removal: boolean;
};

interface SmartBillboardConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardLinks: BillboardTaskLinks[];
  onConfirm: (selectedTypes: TaskTypeSelection) => void;
  loading?: boolean;
}

const taskTypeConfig = {
  installation: { icon: Wrench, color: 'bg-blue-500/15 text-blue-700 border-blue-200', label: 'تركيب' },
  print: { icon: Printer, color: 'bg-purple-500/15 text-purple-700 border-purple-200', label: 'طباعة' },
  cutout: { icon: Box, color: 'bg-amber-500/15 text-amber-700 border-amber-200', label: 'قص مجسم' },
  removal: { icon: ArrowLeftRight, color: 'bg-red-500/15 text-red-700 border-red-200', label: 'إزالة' },
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  in_progress: 'جاري التنفيذ',
  completed: 'مكتمل',
};

export function SmartBillboardConfirmDialog({
  open,
  onOpenChange,
  billboardLinks,
  onConfirm,
  loading = false,
}: SmartBillboardConfirmDialogProps) {
  // Determine which task types exist across all billboards
  const existingTypes = new Set<string>();
  billboardLinks.forEach(bl => bl.linkedTasks.forEach(t => existingTypes.add(t.type)));

  const [selectedTypes, setSelectedTypes] = useState<TaskTypeSelection>({
    installation: true,
    print: true,
    cutout: true,
    removal: true,
  });

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTypes({ installation: true, print: true, cutout: true, removal: true });
    }
  }, [open]);

  const selectedCount = Object.entries(selectedTypes)
    .filter(([type, checked]) => checked && existingTypes.has(type))
    .length;

  const totalTasks = billboardLinks.reduce((acc, bl) => 
    acc + bl.linkedTasks.filter(t => selectedTypes[t.type]).length, 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            تأكيد حذف اللوحات من العقد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            اللوحات التالية مرتبطة بمهام. اختر المهام التي تريد حذف اللوحات منها:
          </p>

          {/* Task type selection */}
          <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/50 border">
            {(Object.keys(taskTypeConfig) as Array<keyof typeof taskTypeConfig>).map(type => {
              if (!existingTypes.has(type)) return null;
              const config = taskTypeConfig[type];
              const Icon = config.icon;
              return (
                <label
                  key={type}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedTypes[type]
                      ? config.color + ' border-current'
                      : 'bg-muted/30 border-border text-muted-foreground'
                  }`}
                >
                  <Checkbox
                    checked={selectedTypes[type]}
                    onCheckedChange={(checked) =>
                      setSelectedTypes(prev => ({ ...prev, [type]: !!checked }))
                    }
                  />
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{config.label}</span>
                </label>
              );
            })}
          </div>

          <div className="space-y-3">
            {billboardLinks.map((bl) => (
              <div
                key={bl.billboardId}
                className="border rounded-lg p-3 bg-muted/30"
              >
                <div className="font-medium text-sm mb-2">{bl.billboardName}</div>
                <div className="flex flex-wrap gap-1.5">
                  {bl.linkedTasks.map((task, idx) => {
                    const config = taskTypeConfig[task.type];
                    const Icon = config.icon;
                    const isSelected = selectedTypes[task.type];
                    return (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`text-xs gap-1 transition-opacity ${
                          isSelected ? config.color : 'opacity-30 line-through'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {config.label}
                        <span className="opacity-60">({statusLabels[task.status] || task.status})</span>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(selectedTypes)}
            disabled={loading || selectedCount === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'جاري الحذف...' : `حذف من ${totalTasks} مهمة وحفظ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
