import { useState, useEffect, useRef, useCallback } from 'react';
import { replaceImageUrlsInHtml } from '@/utils/offlineImageInterceptor';
import { getDSFallbackScript } from '@/utils/printDSFallbackScript';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, X, Download, Maximize2, Minimize2, Stamp, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PrintJob {
  html: string;
  title?: string;
}

// Global event name
export const PRINT_PREVIEW_EVENT = 'app:print-preview';

// Helper to trigger print preview from anywhere
export function showPrintPreview(html: string, title?: string) {
  window.dispatchEvent(
    new CustomEvent(PRINT_PREVIEW_EVENT, { detail: { html, title } })
  );
}

export function PrintPreviewDialog() {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as PrintJob;
    setJob(detail);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(PRINT_PREVIEW_EVENT, handleEvent);
    return () => window.removeEventListener(PRINT_PREVIEW_EVENT, handleEvent);
  }, [handleEvent]);

  // Strip auto-print scripts & toggle signature section visibility in HTML
  const getProcessedHtml = useCallback((html: string, showSig: boolean) => {
    // Replace image URLs with cached base64 for offline mode
    let processed = replaceImageUrlsInHtml(html);
    // Remove any embedded window.print() / self-print scripts so the preview doesn't auto-trigger print
    processed = processed
      .replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '')
      .replace(/onload\s*=\s*["'][^"']*window\.print\(\)[^"']*["']/gi, '');
    // Inject DS fallback script for offline image resolution
    processed = processed.replace('</head>', getDSFallbackScript() + '</head>');
    if (!showSig) {
      processed = processed.replace('</head>', '<style>.signature-stamp-section { display: none !important; }</style></head>');
    }
    return processed;
  }, []);

  const iframeSrcDoc = open && job ? getProcessedHtml(job.html, showSignature) : undefined;

  const handlePrint = () => {
    if (!job?.html) return;
    
    const processedHtml = getProcessedHtml(job.html, showSignature);
    const title = job.title || 'طباعة';
    
    // فتح نافذة جديدة بالعنوان الوصفي حتى يظهر كاسم ملف عند الحفظ كـ PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // حقن العنوان في HTML
      let htmlWithTitle = processedHtml;
      if (htmlWithTitle.includes('<title>')) {
        htmlWithTitle = htmlWithTitle.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      } else if (htmlWithTitle.includes('</head>')) {
        htmlWithTitle = htmlWithTitle.replace('</head>', `<title>${title}</title></head>`);
      }
      
      printWindow.document.open();
      printWindow.document.write(htmlWithTitle);
      printWindow.document.close();
      // انتظار تحميل المحتوى ثم فتح مربع حوار الطباعة
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      // fallback في حال لم يعمل onload
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 800);
    } else {
      // fallback: طباعة من iframe مع تغيير عنوان الصفحة مؤقتاً
      const originalTitle = document.title;
      document.title = title;
      window.onafterprint = () => {
        document.title = originalTitle;
        window.onafterprint = null;
      };
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (!job?.html) return;
    setIsPdfLoading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const parser = new DOMParser();
      const parsed = parser.parseFromString(getProcessedHtml(job.html, showSignature), 'text/html');

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;z-index:-1;';

      const styles = parsed.querySelectorAll('style, link[rel="stylesheet"]');
      styles.forEach(s => wrapper.appendChild(s.cloneNode(true)));

      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = parsed.body.innerHTML;
      contentDiv.style.cssText = parsed.body.style.cssText;
      contentDiv.setAttribute('dir', parsed.body.getAttribute('dir') || 'rtl');
      if (parsed.body.style.fontFamily) {
        contentDiv.style.fontFamily = parsed.body.style.fontFamily;
      }
      wrapper.appendChild(contentDiv);
      document.body.appendChild(wrapper);

      await new Promise(resolve => setTimeout(resolve, 800));

      await html2pdf()
        .set({
          margin: 0,
          filename: `${job?.title || 'document'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            width: 794,
            windowWidth: 794,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(contentDiv)
        .save();

      wrapper.remove();
      toast.success('تم تحميل PDF بنجاح');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('فشل تحميل PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setJob(null);
    setFullscreen(false);
    setShowSignature(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden flex flex-col ${
          fullscreen
            ? 'max-w-[100vw] w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none'
            : 'max-w-5xl w-full h-[100dvh] max-h-[100dvh] sm:h-[95vh] sm:max-h-[95vh]'
        }`}
        dir="rtl"
      >
        {/* Header - matches UnifiedTaskInvoice style */}
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background shrink-0">
          <div className="flex items-center justify-between">
            {/* Title section */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {job?.title || 'معاينة الطباعة'}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>معاينة المستند قبل الطباعة</DialogDescription>
                </VisuallyHidden>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              {/* Signature toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="print-signature-toggle"
                  checked={showSignature}
                  onCheckedChange={setShowSignature}
                />
                <Label htmlFor="print-signature-toggle" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1">
                  <Stamp className="h-4 w-4" />
                  <span className="hidden sm:inline">الختم والتوقيع</span>
                </Label>
              </div>

              {/* Print button */}
              <Button onClick={handlePrint} className="gap-2" size="sm">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">طباعة</span>
              </Button>

              {/* Download PDF */}
              <Button
                variant="outline"
                className="gap-2"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isPdfLoading}
              >
                {isPdfLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">تحميل PDF</span>
              </Button>

              {/* Fullscreen toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFullscreen(!fullscreen)}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              {/* Close */}
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview area */}
        <ScrollArea className="flex-1">
          <div className="bg-muted/30 flex items-start justify-center p-2 sm:p-6 min-h-full">
            <iframe
              ref={iframeRef}
              srcDoc={iframeSrcDoc}
              className="bg-white shadow-xl rounded-lg w-full"
              style={{
                maxWidth: fullscreen ? '900px' : '794px',
                minHeight: fullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 120px)',
                border: '1px solid hsl(var(--border))',
                pointerEvents: 'auto',
                userSelect: 'auto',
              }}
              title="print-preview"
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
