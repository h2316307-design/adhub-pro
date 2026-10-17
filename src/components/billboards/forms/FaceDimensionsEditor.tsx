import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Ruler } from 'lucide-react';
import { getBillboardDimensions } from '@/lib/billboardDimensions';
import { getAvailableFacesCount } from '@/lib/installationFaces';

export function FaceDimensionsEditor({ form, setForm, sizes = [] }: { form: any; setForm: (value: any) => void; sizes?: any[] }) {
  const count = getAvailableFacesCount(form);
  const row = sizes.find(size => size.name === form.Size || size.id === form.size_id);
  const base = getBillboardDimensions(form, row ? new Map([[form.Size, { width: Number(row.width), height: Number(row.height) }]]) : undefined);
  const customized = (index: number) => form.face_dimensions?.[index]?.width != null || form.face_dimensions?.[index]?.height != null;
  const updateFace = (index: number, patch: any) => setForm((previous: any) => {
    const dimensions = Array.from({ length: count }, (_, i) => previous.face_dimensions?.[i] || null);
    dimensions[index] = patch === null ? null : { ...(dimensions[index] || {}), ...patch };
    return { ...previous, face_dimensions: dimensions };
  });
  return <details className="group col-span-full overflow-hidden rounded-xl border border-border bg-background" dir="rtl">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-3 transition-all duration-200 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
      <Ruler className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">مقاسات الأوجه</span><span className="block text-xs text-muted-foreground">{Array.from({ length: count }, (_, i) => customized(i)).some(Boolean) ? 'توجد أوجه بمقاسات مخصصة' : `${count} وجه بنفس المقاس الأساسي`}</span></span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-3 border-t border-border p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">تستخدم الأوجه المقاس الأساسي تلقائياً. فعّل «مقاس مختلف» فقط للوجه الذي يختلف عرضه أو ارتفاعه.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: count }, (_, index) => <section key={index} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">الوجه {index + 1}</span><label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><Checkbox className="h-5 w-5 shrink-0 rounded-md" checked={customized(index)} onCheckedChange={checked => updateFace(index, checked ? { width: base.width, height: base.height } : null)} aria-label={`مقاس مختلف للوجه ${index + 1}`} />مقاس مختلف</label></div>
          {customized(index) ? <div className="grid grid-cols-2 gap-2">
            {(['width', 'height'] as const).map(field => <Label key={field} className="space-y-1.5 text-xs font-normal text-muted-foreground"><span>{field === 'width' ? 'العرض' : 'الارتفاع'} (متر)</span><input type="number" min="0.01" step="0.01" dir="ltr" className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`${field === 'width' ? 'عرض' : 'ارتفاع'} الوجه ${index + 1}`}
              placeholder={String(base[field] || '')} value={form.face_dimensions?.[index]?.[field] ?? ''}
              onChange={e => updateFace(index, { [field]: e.target.value === '' ? null : Number(e.target.value) })} /></Label>)}
          </div> : <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">المقاس الأساسي <span className="ms-2 font-semibold text-foreground" dir="ltr">{base.width || '—'} × {base.height || '—'} م</span></div>}
        </section>)}
      </div>
    </div>
  </details>;
}
