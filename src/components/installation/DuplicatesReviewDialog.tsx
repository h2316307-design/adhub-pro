import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';

interface DuplicateRow {
  itemId: string;
  billboardId: number;
  billboardName: string;
  city: string;
  taskId: string;
  taskShortId: string;
  teamName: string;
  contractName: string;
  priority: number;
  willKeep: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: DuplicateRow[];
  onConfirm: (itemIdsToDelete: string[]) => void;
  isPending?: boolean;
}

export const DuplicatesReviewDialog: React.FC<Props> = ({ open, onOpenChange, rows, onConfirm, isPending }) => {
  const groups = useMemo(() => {
    const map: Record<number, DuplicateRow[]> = {};
    rows.forEach(r => {
      if (!map[r.billboardId]) map[r.billboardId] = [];
      map[r.billboardId].push(r);
    });
    return map;
  }, [rows]);

  // Default selection: all rows where willKeep === false
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      const init = new Set<string>();
      rows.forEach(r => { if (!r.willKeep) init.add(r.itemId); });
      setSelected(init);
    }
  }, [open, rows]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(rows.filter(r => !r.willKeep).map(r => r.itemId)));
  };
  const invert = () => {
    setSelected(prev => {
      const next = new Set<string>();
      rows.forEach(r => { if (!prev.has(r.itemId) && !r.willKeep) next.add(r.itemId); });
      return next;
    });
  };
  const clear = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>مراجعة اللوحات المكررة قبل الحذف</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            {Object.keys(groups).length} لوحة مكررة — محدد للحذف: <strong>{selected.size}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>تحديد الكل</Button>
            <Button size="sm" variant="outline" onClick={invert}>عكس التحديد</Button>
            <Button size="sm" variant="ghost" onClick={clear}>إلغاء</Button>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <div className="p-3 space-y-4">
            {Object.entries(groups).map(([bbId, items]) => (
              <div key={bbId} className="border rounded-md">
                <div className="px-3 py-2 bg-muted/40 border-b font-semibold text-sm flex items-center justify-between">
                  <span>اللوحة #{bbId} — {items[0].billboardName}</span>
                  <span className="text-xs text-muted-foreground">{items[0].city}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="p-2 w-10"></th>
                      <th className="p-2 text-right">المهمة</th>
                      <th className="p-2 text-right">الفريق</th>
                      <th className="p-2 text-right">العقد</th>
                      <th className="p-2 text-right">الأولوية</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.itemId} className={`border-b last:border-0 ${it.willKeep ? 'bg-emerald-500/5' : ''}`}>
                        <td className="p-2">
                          {it.willKeep ? (
                            <span className="text-emerald-500 text-[10px]">—</span>
                          ) : (
                            <Checkbox checked={selected.has(it.itemId)} onCheckedChange={() => toggle(it.itemId)} />
                          )}
                        </td>
                        <td className="p-2 font-mono">{it.taskShortId}</td>
                        <td className="p-2">{it.teamName}</td>
                        <td className="p-2">{it.contractName}</td>
                        <td className="p-2">{it.priority}</td>
                        <td className="p-2">
                          {it.willKeep
                            ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">يُحتفظ به</Badge>
                            : <Badge variant="outline" className="text-red-500 border-red-500/30">قابل للحذف</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">لا توجد لوحات مكررة.</div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>إلغاء</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={isPending || selected.size === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            تأكيد حذف {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type { DuplicateRow };
