import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** زر عائم للانتقال إلى أعلى أقرب حاوية قابلة للتمرير (الصفحة أو النافذة الحوارية) */
export function ScrollTopButton({ className, threshold = 400 }: { className?: string; threshold?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [show, setShow] = useState(false);

  const scrollers = () => {
    const list: (HTMLElement | Window)[] = [];
    let el = ref.current?.parentElement || null;
    while (el) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight) list.push(el);
      el = el.parentElement;
    }
    list.push(window);
    return list;
  };

  useEffect(() => {
    const check = () => setShow(scrollers().some(s => (s instanceof Window ? s.scrollY : s.scrollTop) > threshold));
    document.addEventListener('scroll', check, true);
    check();
    return () => document.removeEventListener('scroll', check, true);
  }, [threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button ref={ref} type="button" aria-label="الانتقال إلى الأعلى"
      onClick={() => scrollers().forEach(s => s.scrollTo({ top: 0, behavior: 'smooth' }))}
      className={cn('fixed bottom-24 right-6 z-40 lg:bottom-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105',
        show ? 'opacity-100' : 'pointer-events-none translate-y-4 opacity-0', className)}>
      <ArrowUp className="h-6 w-6" />
    </button>
  );
}
