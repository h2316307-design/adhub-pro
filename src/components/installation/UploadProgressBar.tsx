import { useCallback, useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** صور الوجهين من اختيار واحد: ترتيب الأسماء، الأولى للأمامي والثانية للخلفي */
export function splitFaceFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list || []).filter(f => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, 2);
}

/**
 * تقدم تقديري للرفع (مزوّدو الرفع لا يُبلغون عن البايتات المرسلة): يرتفع حسب حجم الملف
 * والوقت المنقضي حتى 92% ثم يكتمل 100% عند انتهاء الرفع فعلياً.
 */
export function useUploadProgress() {
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  const start = useCallback((bytes: number) => {
    clear();
    const expected = 1500 + bytes / 350; // ~350KB/ث تقديرياً
    const t0 = Date.now();
    setProgress(2);
    timer.current = window.setInterval(() => {
      setProgress(Math.max(2, Math.round(92 * (1 - Math.exp(-2.2 * (Date.now() - t0) / expected)))));
    }, 150);
  }, []);
  const finish = useCallback((ok: boolean) => {
    clear();
    if (!ok) { setProgress(null); return; }
    setProgress(100);
    window.setTimeout(() => setProgress(p => (p === 100 ? null : p)), 1200);
  }, []);
  return { progress, start, finish };
}

export function UploadProgressBar({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return null;
  return (
    <div className={cn('space-y-1', className)} role="status" aria-live="polite">
      <Progress value={value} className="h-2" />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{value >= 100 ? 'اكتمل الرفع' : value >= 85 ? 'جاري المعالجة...' : 'جاري الرفع...'}</span>
        <span dir="ltr" className="font-mono">{value}%</span>
      </div>
    </div>
  );
}
