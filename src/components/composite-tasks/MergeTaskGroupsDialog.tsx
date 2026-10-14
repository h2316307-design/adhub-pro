import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function MergeTaskGroupsDialog({ groups }: { groups: any[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const chosen = groups.filter(group => selected.includes(group.key));
  const customerKey = (group: any) => String(group.tasks[0]?.customer_id || group.customerName).trim();
  const save = async () => {
    if (chosen.length < 2 || new Set(chosen.map(customerKey)).size !== 1) return;
    setSaving(true);
    try {
      const taskIds = [...new Set(chosen.flatMap(group => group.tasks.map((task: any) => task.id)))];
      const { error } = await supabase.from('system_settings').upsert({ setting_key: 'composite_manual_group:' + crypto.randomUUID(), setting_value: JSON.stringify(taskIds), updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ['composite-manual-groups'] });
      setOpen(false); setSelected([]); toast.success('تم تجميع المهام في كرت واحد');
    } catch { toast.error('تعذر حفظ التجميع؛ أعد المحاولة'); }
    finally { setSaving(false); }
  };
  return <>
    <Button variant="outline" className="cursor-pointer" onClick={() => { setSelected([]); setOpen(true); }}>تجميع مهام الزبون</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>تجميع المهام في كرت واحد</DialogTitle><DialogDescription>اختر مهام الزبون نفسه. تبقى الفرق والعمليات والصور والتكاليف محفوظة داخل الكرت.</DialogDescription></DialogHeader>
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
