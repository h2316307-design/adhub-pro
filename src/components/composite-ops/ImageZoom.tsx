import { useEffect, useState } from 'react';
import { ImageIcon, ZoomIn } from 'lucide-react';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { cn } from '@/lib/utils';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';

/** العارض الموحد للنظام */
export const Lightbox = ({ images, index, onClose, title }: { images: { src: string; label?: string }[]; index: number; onClose: () => void; title?: string }) =>
  <ImageViewer images={images} index={index} onClose={onClose} title={title} />;

/** صورة قابلة للتكبير بالنقر */
export function ZoomImage({ src, alt, className, imgClassName, gallery, title }: {
  src: string | null | undefined; alt: string; className?: string; imgClassName?: string;
  gallery?: { src: string; label?: string }[]; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const list = gallery?.length ? gallery : src ? [{ src, label: alt }] : [];
  const start = Math.max(0, list.findIndex(g => g.src === src));
  return (
    <>
      <button type="button" disabled={!src || broken} onClick={e => { e.stopPropagation(); setOpen(true); }}
        className={cn('group relative flex items-center justify-center overflow-hidden bg-muted', src && !broken ? 'cursor-zoom-in' : 'cursor-default', className)} aria-label={src ? `تكبير ${alt}` : alt}>
        {src && !broken
          ? <img src={src} alt={alt} loading="lazy" className={cn('h-full w-full object-cover transition-transform group-hover:scale-[1.03]', imgClassName)} onError={() => setBroken(true)} />
          : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
        {src && !broken && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><ZoomIn className="h-3.5 w-3.5" /></span>}
      </button>
      {open && list.length > 0 && <Lightbox images={list} index={start} onClose={() => setOpen(false)} title={title} />}
    </>
  );
}

/** تصميم العقد (كل التصاميم قابلة للتصفح والتكبير) */
export function ContractDesignZoom({ contractId, className, title }: { contractId: number; className?: string; title?: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!contractId) { setUrls([]); return; }
    fetchContractDesignUrls(contractId).then(u => { if (!cancelled) setUrls((u || []).filter(Boolean)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [contractId]);
  return (
    <ZoomImage src={urls[0]} alt={`تصميم عقد ${contractId}`} title={title} className={className} imgClassName="object-contain"
      gallery={urls.map((s, i) => ({ src: s, label: `تصميم ${i + 1}` }))} />
  );
}
