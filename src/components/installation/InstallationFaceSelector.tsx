import { Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InstallationFaceSelector({ maxFaces, selectedFaces, disabled, onChange }: {
  maxFaces: number; selectedFaces: number[]; disabled?: boolean; onChange: (faces: number[]) => void;
}) {
  return <fieldset disabled={disabled} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-2" onClick={event => event.stopPropagation()}>
    <legend className="sr-only">الأوجه المطلوب تركيبها</legend>
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Layers className="h-3.5 w-3.5 shrink-0" />أوجه التركيب
      {maxFaces > 1 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums" dir="ltr" aria-label={`المحدد ${selectedFaces.length} من ${maxFaces}`}>{selectedFaces.length}/{maxFaces}</span>}
    </span>
    {maxFaces === 1 ? <span className="py-2 text-xs font-semibold text-primary">وجه واحد</span> : <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-0.5">
      {Array.from({ length: maxFaces }, (_, i) => i + 1).map(face => {
        const active = selectedFaces.includes(face);
        const label = maxFaces === 2 ? (face === 1 ? 'الأمامي' : 'الخلفي') : `الوجه ${face}`;
        return <button key={face} type="button" aria-pressed={active} aria-label={`تركيب ${label}`}
          disabled={disabled || (active && selectedFaces.length === 1)}
          title={active && selectedFaces.length === 1 ? 'يجب إبقاء وجه واحد على الأقل' : `${active ? 'إلغاء اختيار' : 'اختيار'} ${label}`}
          className={cn('inline-flex min-h-10 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default', disabled ? 'cursor-wait opacity-60' : 'cursor-pointer', active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground')}
          onClick={() => onChange(active ? selectedFaces.filter(n => n !== face) : [...selectedFaces, face].sort((a, b) => a - b))}>
          <Check className={cn('h-3 w-3 shrink-0', !active && 'invisible')} aria-hidden="true" />{label}
        </button>;
      })}
    </div>}
  </fieldset>;
}
