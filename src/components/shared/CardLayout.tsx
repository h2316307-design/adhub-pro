import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Columns2, Rows3 } from 'lucide-react';

/** اتجاه البطاقات: عرضي (الصورة بجانب التفاصيل) أو طولي (الصورة فوق التفاصيل) — محفوظ لكل صفحة في هذا الجهاز */
export type CardLayout = 'horizontal' | 'vertical';
const EVENT = 'ui-card-layout-change';
const keyOf = (page: string) => `ui-card-layout:${page}`;

const read = (page: string, fallback: CardLayout): CardLayout => {
  try {
    const v = localStorage.getItem(keyOf(page));
    return v === 'horizontal' || v === 'vertical' ? v : fallback;
  } catch { return fallback; }
};

export function useCardLayout(page: string, fallback: CardLayout = 'horizontal'): [CardLayout, (l: CardLayout) => void] {
  const [layout, setLayout] = useState<CardLayout>(() => read(page, fallback));
  useEffect(() => {
    const sync = () => setLayout(read(page, fallback));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, [page, fallback]);
  const set = (l: CardLayout) => {
    try { localStorage.setItem(keyOf(page), l); } catch { /* ignore */ }
    setLayout(l);
    window.dispatchEvent(new Event(EVENT));
  };
  return [layout, set];
}

export function CardLayoutToggle({ value, onChange, className }: { value: CardLayout; onChange: (l: CardLayout) => void; className?: string }) {
  const item = (l: CardLayout, label: string, Icon: typeof Rows3) => (
    <button
      type="button"
      aria-pressed={value === l}
      title={label}
      onClick={() => onChange(l)}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        value === l ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
  return (
    <div role="group" aria-label="اتجاه البطاقات" className={cn('inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5', className)}>
      {item('horizontal', 'عرضي', Rows3)}
      {item('vertical', 'طولي', Columns2)}
    </div>
  );
}
