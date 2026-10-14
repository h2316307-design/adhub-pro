import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, ArrowUpToLine, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { OPERATION_ORDER_PREFIX } from '@/lib/compositeOperationDisplayOrder';
import { toast } from 'sonner';

export function OperationOrderDialog({ group }: { group: any }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const firstNumberedIndex = draft.findIndex(operation => operation.isReinstall !== false);
  function move(index: number, target: number) {
    setDraft(rows => { const next = [...rows]; const [row] = next.splice(index, 1); next.splice(target, 0, row); return next; });
  }
  async function save() {
    setSaving(true);
    try {
      const currentKeys = new Set(group.operations.map((operation: any) => operation.key));
      if (currentKeys.size !== draft.length || draft.some(row => !currentKeys.has(row.key))) throw new Error('تغيرت العمليات، أغلق النافذة وافتحها مجددًا.');
      const { error } = await supabase.from('system_settings').upsert({ setting_key: OPERATION_ORDER_PREFIX + group.key, setting_value: JSON.stringify(draft.map(row => row.key)) }, { onConflict: 'setting_key' });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['composite-operation-display-order'] });
      toast.success('تم حفظ ترتيب وترقيم العمليات'); setOpen(false);
    } catch (error: any) { toast.error(error.message || 'تعذر حفظ الترتيب'); }
    finally { setSaving(false); }
  }
  return <><Button variant="outline" className="cursor-pointer gap-2 transition-all duration-200" disabled={group.operations.length < 2} onClick={() => { setDraft([...group.operations].reverse()); setOpen(true); }}><ListOrdered className="h-4 w-4" />ترتيب العمليات</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}><DialogContent dir="rtl" className="max-w-2xl max-h-[90dvh] flex flex-col">
      <DialogHeader><DialogTitle>{group.isMultiContract ? `ترتيب المهمة المجمعة · عقود #${(group.contractIds || []).join('، #')}` : `ترتيب عمليات العقد #${group.contractId}`}</DialogTitle><DialogDescription>«تركيب جديد» ثابت أسفل القائمة الرئيسية. رتّب بقية العمليات من تركيب 1 إلى آخر تركيب؛ يظهر الرقم الأكبر أعلى. هذا ترتيب العرض وترقيمه؛ تظل اللوحات والتكاليف والدفعات مرتبطة بعملياتها الأصلية.</DialogDescription></DialogHeader>
      <div className="space-y-3 overflow-y-auto min-h-0">{draft.map((operation, index) => {
        const image = operation.tasks.flatMap((task: any) => task.designUrls || [])[0];
        return <div key={operation.key} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          {image && <img src={image} alt="تصميم العملية" className="h-20 w-28 object-contain rounded-lg bg-muted" />}
          <div className="flex-1 min-w-0"><p className="font-bold text-primary">{operation.isReinstall === false ? 'تركيب جديد' : `تركيب ${index - Math.max(0, firstNumberedIndex) + 1}`}</p><p className="text-sm">{operation.label}</p><p className="text-xs text-muted-foreground">{operation.createdAt?.slice(0, 10)} · {operation.tasks.map((task: any) => task.teamName).filter(Boolean).join('، ')}</p><p className="text-xs">{operation.tasks.length} مهمة · {operation.operationTotalBillboards || 0} لوحة</p></div>
          <div className="flex flex-col gap-1"><Button aria-label={`جعل العملية ${index + 1} الأولى`} size="sm" variant="outline" disabled={saving || operation.isReinstall === false || index === firstNumberedIndex} onClick={() => move(index, firstNumberedIndex)} className="cursor-pointer gap-1"><ArrowUpToLine className="h-4 w-4" />الأولى</Button><div className="flex gap-1"><Button aria-label={`تقديم العملية ${index + 1}`} size="icon" variant="outline" disabled={saving || operation.isReinstall === false || index <= firstNumberedIndex} onClick={() => move(index, index - 1)} className="cursor-pointer"><ArrowUp className="h-4 w-4" /></Button><Button aria-label={`تأخير العملية ${index + 1}`} size="icon" variant="outline" disabled={saving || operation.isReinstall === false || index === draft.length - 1} onClick={() => move(index, index + 1)} className="cursor-pointer"><ArrowDown className="h-4 w-4" /></Button></div></div>
        </div>;
      })}</div>
      <div className="flex justify-between border-t pt-3"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)} className="cursor-pointer">إلغاء</Button><Button disabled={saving} onClick={save} className="cursor-pointer">{saving ? 'جارٍ الحفظ…' : 'حفظ الترتيب'}</Button></div>
    </DialogContent></Dialog></>;
}
