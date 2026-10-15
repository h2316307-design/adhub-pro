import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { uploadImage } from '@/services/imageUploadService';
import { parseImageUrls, serializeImageUrls } from '@/components/billing/distribute-payment/PaymentInputSection';
import { useResolvedImage } from '@/utils/imageResolver';

function Thumb({ src, alt }: { src: string; alt: string }) {
  const { src: resolved } = useResolvedImage(src);
  return <img src={resolved || src} alt={alt} className="h-full w-full object-cover" loading="lazy" />;
}

/**
 * صور الوصل/الحوالة لدفعة: رفع عدة صور، لصق (Ctrl+V عبر GlobalImagePaste)، تكبير بالعارض الموحد، حذف.
 * القيمة بصيغة transfer_image_url: رابط واحد أو مصفوفة JSON.
 */
export function ReceiptImagesField({ value, onChange, customerName, disabled }: {
  value: string; onChange: (v: string) => void; customerName?: string; disabled?: boolean;
}) {
  const urls = parseImageUrls(value);
  const [uploading, setUploading] = useState(false);
  const [viewAt, setViewAt] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    if (!list.length) { if (files?.length) toast.error('يرجى اختيار صورة'); return; }
    setUploading(true);
    const added: string[] = [];
    try {
      for (const f of list) {
        added.push(await uploadImage(f, `وصل${customerName ? `_${customerName}` : ''}_${Date.now()}`, 'payment-receipts'));
      }
      onChange(serializeImageUrls([...urls, ...added]));
      toast.success(added.length > 1 ? `رُفعت ${added.length} صور` : 'رُفعت صورة الوصل');
    } catch (e: any) {
      if (added.length) onChange(serializeImageUrls([...urls, ...added]));
      toast.error('فشل رفع الصورة: ' + (e?.message || ''));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">صورة الوصل / الحوالة</span>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} disabled={disabled || uploading} />
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-dashed" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? 'جاري الرفع…' : urls.length ? 'إضافة صورة' : 'رفع صورة'}
        </Button>
      </div>
      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <div key={u + i} className="group relative h-16 w-20 overflow-hidden rounded-lg border border-border bg-muted">
              <button type="button" className="h-full w-full cursor-zoom-in" onClick={() => setViewAt(i)} title="تكبير">
                <Thumb src={u} alt={`صورة الوصل ${i + 1}`} />
              </button>
              <button type="button" aria-label="حذف الصورة" disabled={disabled}
                className="absolute left-0.5 top-0.5 rounded-full bg-destructive p-0.5 text-white shadow"
                onClick={() => onChange(serializeImageUrls(urls.filter((_, j) => j !== i)))}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">لا توجد صورة — ارفع صورة أو الصقها بـ Ctrl+V</p>
      )}
      {viewAt !== null && <ImageViewer images={urls.map((src, k) => ({ src, label: `صورة الوصل ${k + 1}` }))} index={viewAt} onClose={() => setViewAt(null)} />}
    </div>
  );
}
