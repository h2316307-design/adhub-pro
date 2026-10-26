import { useState } from 'react';
import { FileText, Plus, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContractAmendments } from '@/hooks/useContractAmendments';
import { amendmentChangeLines, type ContractAmendment } from '@/utils/contractAmendments';

export function ContractAddenda({ contractNumber, refreshKey, onAdd, onPrint }: {
  contractNumber: number; refreshKey: number; onAdd: () => void; onPrint: (document: ContractAmendment, history: ContractAmendment[]) => Promise<void>;
}) {
  const { data, isLoading, isError, refetch } = useContractAmendments(contractNumber, refreshKey);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const original = data?.documents.find(row => row.amendment_number === 0);
  const amendments = data?.documents.filter(row => row.amendment_number > 0) || [];
  const print = async (row: ContractAmendment) => {
    setPrintingId(row.id);
    try { await onPrint(row, data?.documents || []); } finally { setPrintingId(null); }
  };
  return (
    <section id="contract-addenda" className="scroll-mt-28 space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="flex items-center gap-2 text-base font-bold"><FileText className="h-5 w-5 text-primary" />ملاحق العقد وسجل التعديلات</h2>
        <div className="flex flex-wrap gap-2">
          {original && <Button type="button" variant="outline" disabled={!!printingId} onClick={() => print(original)} className="min-h-10 cursor-pointer gap-2 transition-all duration-200 hover:bg-primary/10"><Printer className="h-4 w-4" />طباعة العقد الأصلي</Button>}
          <Button type="button" variant="outline" onClick={onAdd} className="min-h-10 cursor-pointer gap-2 transition-all duration-200 hover:bg-primary/10"><Plus className="h-4 w-4" />إضافة لوحات</Button>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">بعد اكتمال تركيب جميع لوحات العقد يظهر «حفظ كملحق». يُحفظ الأصل مرة واحدة، ويأخذ كل تعديل لاحق رقماً متسلسلاً، حتى أثناء انتظار تركيب لوحات جديدة. كل ملحق نسخة كاملة محفوظة من العقد بعد التعديل، ويظهر سجل التعديلات في الطباعة.</p>
      {isLoading ? <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل الملاحق…</p> : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">تعذر تحميل سجل الملاحق<Button variant="outline" className="min-h-10 cursor-pointer gap-2 transition-all duration-200 hover:bg-muted" onClick={() => refetch()}><RefreshCw className="h-4 w-4" />إعادة المحاولة</Button></div>
      ) : amendments.length === 0 ? <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">{data?.status.enabled ? 'التعديل القادم سيُحفظ كملحق رقم 1 مع الاحتفاظ بالعقد الأصلي.' : 'لا توجد ملاحق بعد. تبقى التعديلات ضمن العقد حتى اكتمال تركيب جميع لوحاته.'}</p> : amendments.map(row => (
        <article key={row.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/10 px-4 py-3 text-sm">
            <div><h3 className="font-bold text-primary">ملحق العقد رقم {row.amendment_number} للعقد رقم {contractNumber}</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli' })}</p></div>
            <Button type="button" variant="outline" disabled={!!printingId} onClick={() => print(row)} className="min-h-10 cursor-pointer gap-2 transition-all duration-200 hover:bg-primary/10"><Printer className="h-4 w-4" />{printingId === row.id ? 'جارٍ التحضير…' : 'طباعة الملحق'}</Button>
          </div>
          <div className="space-y-3 p-4 text-sm">
            <p>الإجمالي قبل التعديل: <strong>{Number(row.total_before).toLocaleString('ar-LY')}</strong> · بعد التعديل: <strong>{Number(row.total_after).toLocaleString('ar-LY')}</strong></p>
            <ul className="space-y-2">{amendmentChangeLines(row.changes).map((change, index) => <li key={index} className="flex flex-wrap gap-x-2 gap-y-1 leading-relaxed"><span className="font-medium">{change.label}:</span><span className="text-muted-foreground">{change.before}</span><span aria-hidden="true">←</span><span>{change.after}</span></li>)}</ul>
          </div>
        </article>
      ))}
    </section>
  );
}
