import type { ReactNode } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BillboardFaceMedia({ faces, showInstalled = true, renderImage, onPreview }: {
  faces: { face: number; design?: string | null; installed?: string | null }[];
  showInstalled?: boolean;
  renderImage?: (src: string, label: string) => ReactNode;
  onPreview?: (src: string) => void;
}) {
  return <section aria-label="تصاميم أوجه اللوحة" className="space-y-2">
    <div className="flex items-center justify-between text-xs"><h4 className="font-semibold">{showInstalled ? 'التصميم والتنفيذ' : 'التصاميم المطبقة'}</h4><span className="text-muted-foreground">{faces.length} وجه</span></div>
    <div className={cn("grid gap-2", faces.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
      {faces.map(({ face, design, installed }) => <div key={face} className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border bg-muted/30 px-2 py-1.5 text-[11px] font-semibold">الوجه {face}</div>
        <div className={cn("gap-2", showInstalled ? "grid grid-cols-2 p-2" : "grid grid-cols-1 p-2")}>
          {(showInstalled ? [{ label: 'التصميم', src: design }, { label: 'التركيب', src: installed }] : [{ label: 'التصميم', src: design }]).map(({ label, src }) => <div key={label} className="min-w-0 space-y-1">
            {src ? renderImage ? renderImage(src, `${label} — الوجه ${face}`) : <button type="button" onClick={() => onPreview?.(src)} aria-label={`عرض ${label} للوجه ${face}`} className={cn("block w-full cursor-pointer overflow-hidden rounded-md bg-muted/30 transition-all duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", showInstalled ? "h-24" : "h-32")}><img src={src} alt={`${label} للوجه ${face}`} loading="lazy" className="h-full w-full object-contain" /></button>
              : <div className={cn("flex flex-col items-center justify-center gap-1 rounded-md bg-muted/30 text-muted-foreground", showInstalled ? "h-24" : "h-32")}><ImageIcon className="h-4 w-4" /><span className="text-[10px]">{label === 'التصميم' ? 'غير معيّن' : 'لم يُرفع بعد'}</span></div>}
            {showInstalled && <p className="text-center text-[10px] text-muted-foreground">{label}</p>}
          </div>)}
        </div>
      </div>)}
    </div>
  </section>;
}
