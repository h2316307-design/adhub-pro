import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { linkInstallationOperation } from '@/services/installationOperation';

export function MergeTaskGroupsDialog({ groups }: { groups: any[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const chosen = groups.filter(group => selected.includes(group.key));
  const customerKey = (group: any) => String(group.tasks[0]?.customer_id || group.customerName).trim();
  const save = async () => {
    if (chosen.length < 2 || new Set(chosen.map(customerKey)).size !== 1) return;
    if (chosen.some(group => group.operations.length !== 1 || group.tasks.some((task: any) => !task.installation_task_id))) {
      toast.error('اختر أجزاء عملية تركيب واحدة فقط؛ البطاقات التي تضم عدة عمليات لا يمكن توحيدها هنا');
      return;
    }
    setSaving(true);
    try {
      const taskIds = [...new Set<string>(chosen.flatMap(group => group.tasks.map((task: any) => task.installation_task_id)))];
      await linkInstallationOperation(crypto.randomUUID(), taskIds);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['composite-tasks'] }),
        client.invalidateQueries({ queryKey: ['installation-tasks'] }),
      ]);
      setOpen(false); setSelected([]); toast.success('تم توحيد العملية وحالتها وتكاليفها ودفعاتها');
    } catch { toast.error('تعذر حفظ التجميع؛ أعد المحاولة'); }
    finally { setSaving(false); }
  };
  return <>
    <Button variant="outline" className="cursor-pointer" onClick={() => { setSelected([]); setOpen(true); }}>تجميع مهام الزبون</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>توحيد أجزاء عملية واحدة</DialogTitle><DialogDescription>اختر البطاقات التي أُنشئت ضمن طلب تركيب واحد للزبون نفسه. ستصبح عملية مستقلة بحالة وإجمالي تكاليف ودفعات وفاتورة موحّدة، مع حفظ اللوحات والصور وتفاصيل الفرق.</DialogDescription></DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-auto">
          {groups.map(group => {
            const disabled = chosen.length > 0 && customerKey(group) !== customerKey(chosen[0]);
            return <label key={group.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <input type="checkbox" disabled={disabled || saving} checked={selected.includes(group.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, group.key] : previous.filter(key => key !== group.key))} />
              <span><strong>{group.customerName}</strong><span className="block text-sm">{group.adType}</span><span className="text-xs text-muted-foreground">عقود #{group.contractIds.join('، #')} · {group.tasks.length} مهام</span></span>
            </label>;
          })}
        </div>
        <Button disabled={saving || chosen.length < 2} onClick={save}>{saving ? 'جارٍ الحفظ...' : 'تأكيد التجميع'}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
