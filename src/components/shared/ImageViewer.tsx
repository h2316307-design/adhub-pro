import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, ExternalLink, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useResolvedImage } from '@/utils/imageResolver';

/**
 * عارض الصور الموحّد للنظام كله: تكبير/تصغير، تدوير، تنزيل، تنقل بين الصور، Esc للإغلاق.
 * الاستخدام: <ImageViewer images={[{ src, label }]} index={0} title="..." onClose={...} />
 */
export interface ViewerImage { src: string; label?: string }

export function ImageViewer({ images, index = 0, onClose, title }: { images: ViewerImage[]; index?: number; onClose: () => void; title?: string }) {
  const list = images.filter(i => !!i?.src);
  const [i, setI] = useState(Math.min(Math.max(0, index), Math.max(0, list.length - 1)));
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const cur = list[i];
  const { src: resolved } = useResolvedImage(cur?.src || '');
  const url = resolved || cur?.src || '';

  useEffect(() => { setScale(1); setRotation(0); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setI(v => (v + 1) % list.length);
      else if (e.key === 'ArrowRight') setI(v => (v - 1 + list.length) % list.length);
      else if (e.key === '+' || e.key === '=') setScale(s => Math.min(4, s + 0.25));
      else if (e.key === '-') setScale(s => Math.max(0.5, s - 0.25));
      else if (e.key === 'r' || e.key === 'R') setRotation(r => r + 90);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list.length, onClose]);

  if (!cur) return null;
  const download = () => {
    const a = document.createElement('a');
    a.href = url; a.download = (cur.label || 'image').replace(/\s+/g, '-') + '.jpg'; a.target = '_blank'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const btn = 'flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/20 disabled:opacity-40';

  // Radix Dialog: يعمل فوق أي نافذة أخرى دون أن يغلقها، ويُغلق بـ Esc
  return (
    <DialogPrimitive.Root open onOpenChange={o => { if (!o) onClose(); }}>
    {/* داخل عنصر ملء الشاشة إن وُجد (الخرائط)، وإلا يختفي العارض خلفه */}
    <DialogPrimitive.Portal container={(typeof document !== 'undefined' && (document.fullscreenElement as HTMLElement | null)) || undefined}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/95" />
    <DialogPrimitive.Content dir="rtl" aria-describedby={undefined}
      className="fixed inset-0 z-[100001] flex flex-col outline-none" onClick={onClose}>
      <DialogPrimitive.Title className="sr-only">{title || cur.label || 'عرض الصورة'}</DialogPrimitive.Title>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
        <div className="min-w-0 flex-1 truncate text-sm">
          {title}{cur.label ? `${title ? ' · ' : ''}${cur.label}` : ''}{list.length > 1 ? `  (${i + 1}/${list.length})` : ''}
        </div>
        <button type="button" className={btn} onClick={onClose} aria-label="إغلاق"><X className="h-6 w-6" /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}
        onWheel={e => setScale(s => Math.min(4, Math.max(0.5, s + (e.deltaY < 0 ? 0.15 : -0.15))))}>
        <img src={url} alt={cur.label || ''} draggable={false}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          onDoubleClick={() => setScale(s => (s === 1 ? 2 : 1))} />
        {list.length > 1 && (
          <>
            <button type="button" aria-label="السابق" onClick={() => setI(v => (v - 1 + list.length) % list.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30"><ChevronRight className="h-7 w-7" /></button>
            <button type="button" aria-label="التالي" onClick={() => setI(v => (v + 1) % list.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30"><ChevronLeft className="h-7 w-7" /></button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 rounded-2xl border border-white/20 bg-white/10 px-3 py-1.5">
          <button type="button" className={btn} onClick={() => setScale(s => Math.max(0.5, s - 0.25))} disabled={scale <= 0.5} aria-label="تصغير"><ZoomOut className="h-5 w-5" /></button>
          <button type="button" className="min-w-[56px] rounded-lg px-2 text-sm text-white/80 hover:bg-white/10" onClick={() => setScale(1)} aria-label="الحجم الأصلي">{Math.round(scale * 100)}%</button>
          <button type="button" className={btn} onClick={() => setScale(s => Math.min(4, s + 0.25))} disabled={scale >= 4} aria-label="تكبير"><ZoomIn className="h-5 w-5" /></button>
          <span className="mx-1 h-6 w-px bg-white/20" />
          <button type="button" className={btn} onClick={() => setRotation(r => r + 90)} aria-label="تدوير"><RotateCw className="h-5 w-5" /></button>
          <button type="button" className={btn} onClick={download} aria-label="تنزيل"><Download className="h-5 w-5" /></button>
          <a href={url} target="_blank" rel="noreferrer" className={btn} aria-label="فتح في تبويب جديد"><ExternalLink className="h-5 w-5" /></a>
        </div>
        {list.length > 1 && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {list.map((im, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={im.label || `صورة ${k + 1}`}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 ${k === i ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={im.src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
