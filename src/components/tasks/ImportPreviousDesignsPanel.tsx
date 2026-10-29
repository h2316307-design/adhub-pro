import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PreviousDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url: string | null;
  created_at: string | null;
}

interface ImportPreviousDesignsPanelProps {
  taskId: string;
  contractNumber?: number | string;
  /** نفس منطق إضافة التصميم: يُنسخ التصميم لهذه المهمة ولمهام المجموعة المرتبطة بها */
  replicateToTaskIds?: string[];
  currentDesignCount: number;
  onImported: () => void;
}

/**
 * جلب تصاميم من مهام سابقة للعقد نفسه (مثل التركيب الأول) لإعادة استخدامها
 * في إعادة التركيب أو الاستبدال دون رفعها من جديد.
 */
export function ImportPreviousDesignsPanel({
  taskId,
  contractNumber,
  replicateToTaskIds,
  currentDesignCount,
  onImported,
}: ImportPreviousDesignsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [designs, setDesigns] = useState<PreviousDesign[]>([]);

  const load = async () => {
    if (!contractNumber) {
      toast.error('لا يوجد رقم عقد لجلب التصاميم السابقة');
      return;
    }
    setLoading(true);
    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('contract_id', Number(contractNumber))
        .neq('id', taskId);
      if (tasksError) throw tasksError;

      const taskIds = (tasks || []).map((t) => t.id);
      if (taskIds.length === 0) {
        setDesigns([]);
        return;
      }

      const { data, error } = await supabase
        .from('task_designs')
        .select('id, task_id, design_name, design_face_a_url, design_face_b_url, created_at')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // تصميم واحد قد يكون منسوخاً على عدة مهام: نعرضه مرة واحدة حسب روابط الوجهين
      const seen = new Set<string>();
      const unique = ((data as PreviousDesign[]) || []).filter((d) => {
        const key = `${d.design_face_a_url}|${d.design_face_b_url ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setDesigns(unique);
    } catch (err: any) {
      toast.error('تعذر تحميل التصاميم السابقة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const importDesign = async (design: PreviousDesign) => {
    const targets = Array.from(new Set([taskId, ...(replicateToTaskIds || [])]));
    setImportingId(design.id);
    try {
      const rows = targets.map((tid) => ({
        task_id: tid,
        design_name: design.design_name,
        design_face_a_url: design.design_face_a_url,
        design_face_b_url: design.design_face_b_url,
        design_order: currentDesignCount,
        created_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('task_designs').insert(rows);
      if (error) throw error;
      toast.success('تم استيراد التصميم');
      onImported();
    } catch (err: any) {
      toast.error('تعذر استيراد التصميم: ' + err.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <section className="space-y-3" dir="rtl" aria-label="استيراد تصاميم سابقة">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 text-xs font-bold" onClick={toggle}>
          <Download className="w-3.5 h-3.5" />
          {open ? 'إخفاء التصاميم السابقة' : 'استيراد من مهمة سابقة'}
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : designs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">لا توجد تصاميم سابقة لهذا العقد</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto">
              {designs.map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-2 space-y-2">
                  {d.design_face_a_url ? (
                    <img
                      src={d.design_face_a_url}
                      alt={d.design_name}
                      loading="lazy"
                      className="w-full h-24 rounded object-cover border"
                    />
                  ) : (
                    <div className="w-full h-24 rounded bg-muted flex items-center justify-center border">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{d.design_name}</div>
                    {d.created_at && (
                      <Badge variant="outline" className="text-[9px] mt-0.5">
                        {format(new Date(d.created_at), 'yyyy/MM/dd', { locale: ar })}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full h-7 text-xs"
                    disabled={importingId !== null}
                    onClick={() => importDesign(d)}
                  >
                    {importingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'استيراد'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
