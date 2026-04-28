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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Printer, X, Download, Maximize2, Minimize2, Stamp, FileText, Loader2, CloudUpload, MessageCircle, Send, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { saveIframeAsPdf, iframeToPdfBlob } from '@/utils/pdfHelpers';

interface PrintJob {
  html: string;
  title?: string;
  driveFolder?: string;
  phone?: string;
}

// Global event name
export const PRINT_PREVIEW_EVENT = 'app:print-preview';

// Helper to trigger print preview from anywhere
export function showPrintPreview(html: string, title?: string, driveFolder?: string, phone?: string) {
  window.dispatchEvent(
    new CustomEvent(PRINT_PREVIEW_EVENT, { detail: { html, title, driveFolder, phone } })
  );
}

export function PrintPreviewDialog() {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showTotalMeters, setShowTotalMeters] = useState(false);
  const [hideInvoiceDate, setHideInvoiceDate] = useState(false);
  const [hideRentalNotes, setHideRentalNotes] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [isWhatsAppSending, setIsWhatsAppSending] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasTotalMetersRow = job?.html?.includes('total-meters-row') ?? false;
  const hasRentalNotes = job?.html?.includes('invoice-rental-notes') ?? false;
  const hasInvoiceDate = job?.html?.includes('invoice-meta') ?? false;

  const handleEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as PrintJob;
    setJob(detail);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(PRINT_PREVIEW_EVENT, handleEvent);
    return () => window.removeEventListener(PRINT_PREVIEW_EVENT, handleEvent);
  }, [handleEvent]);

  // Auto-fill phone from job data
  useEffect(() => {
    if (job?.phone) {
      setWhatsAppPhone(job.phone);
    }
  }, [job]);

  // Strip auto-print scripts & toggle signature/meters visibility in HTML
  const getProcessedHtml = useCallback((html: string, showSig: boolean, showMeters: boolean, hidDate: boolean, hidNotes: boolean) => {
    let processed = replaceImageUrlsInHtml(html);
    processed = processed
      .replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '')
      .replace(/onload\s*=\s*["'][^"']*window\.print\(\)[^"']*["']/gi, '');
    processed = processed.replace('</head>', getDSFallbackScript() + '</head>');
    if (!showSig) {
      processed = processed.replace('</head>', '<style>.signature-stamp-section { display: none !important; }</style></head>');
    }
    if (showMeters) {
      processed = processed.replace('</head>', '<style>.total-meters-row { display: table-row !important; }</style></head>');
    }
    if (hidDate) {
      processed = processed.replace('</head>', '<style>.invoice-meta { display: none !important; }</style></head>');
    }
    if (hidNotes) {
      processed = processed.replace('</head>', '<style>.invoice-rental-notes { display: none !important; }</style></head>');
    }
    return processed;
  }, []);

  const iframeSrcDoc = open && job ? getProcessedHtml(job.html, showSignature, showTotalMeters, hideInvoiceDate, hideRentalNotes) : undefined;

  const handlePrint = () => {
    if (!job?.html) return;
    const processedHtml = getProcessedHtml(job.html, showSignature, showTotalMeters, hideInvoiceDate, hideRentalNotes);
    const title = job.title || 'طباعة';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let htmlWithTitle = processedHtml;
      if (htmlWithTitle.includes('<title>')) {
        htmlWithTitle = htmlWithTitle.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      } else if (htmlWithTitle.includes('</head>')) {
        htmlWithTitle = htmlWithTitle.replace('</head>', `<title>${title}</title></head>`);
      }
      printWindow.document.open();
      printWindow.document.write(htmlWithTitle);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800);
    } else {
      const originalTitle = document.title;
      document.title = title;
      window.onafterprint = () => { document.title = originalTitle; window.onafterprint = null; };
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
      const filename = `${job.title || 'document'}.pdf`;
      await saveIframeAsPdf(iframeRef.current, filename, { filename, marginMm: [0, 0, 0, 0] });
      toast.success('تم تحميل PDF بنجاح');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('فشل تحميل PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleUploadToDrive = async () => {
    if (!job?.html) return;
    const folder = job.driveFolder || 'documents';
    setIsDriveUploading(true);
    try {
      const fileName = `${job.title || 'document'}.pdf`;
      const pdfBlob = await iframeToPdfBlob(iframeRef.current, fileName, { marginMm: [0, 0, 0, 0] });
      const { blobToBase64 } = await import('@/utils/pdfDriveWhatsApp');
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const base64Data = await blobToBase64(pdfBlob);
      await uploadFileToGoogleDrive(
        base64Data,
        fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        'application/pdf',
        folder,
        false,
        progress
      );
      toast.success('تم رفع الملف إلى المجلد بنجاح');
    } catch (err) {
      console.error('Drive upload failed:', err);
      toast.error('فشل رفع الملف');
    } finally {
      setIsDriveUploading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!job?.html || !whatsAppPhone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف');
      return;
    }
    const folder = job.driveFolder || 'documents';
    setIsWhatsAppSending(true);
    try {
      const fileName = `${job.title || 'document'}.pdf`;
      const pdfBlob = await iframeToPdfBlob(iframeRef.current, fileName, { marginMm: [0, 0, 0, 0] });
      const { uploadPdfBlobAndSendWhatsApp } = await import('@/utils/pdfDriveWhatsApp');
      await uploadPdfBlobAndSendWhatsApp({ pdfBlob, fileName, driveFolder: folder, phone: whatsAppPhone, message: `📄 ${job.title || 'مستند'}\n\n` });
      toast.success('تم الإرسال عبر واتساب بنجاح');
      setWhatsAppOpen(false);
    } catch (err) {
      console.error('WhatsApp send failed:', err);
      toast.error('فشل الإرسال عبر واتساب');
    } finally {
      setIsWhatsAppSending(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setJob(null);
    setFullscreen(false);
    setShowSignature(false);
    setShowTotalMeters(false);
    setHideInvoiceDate(false);
    setHideRentalNotes(false);
    setWhatsAppPhone('');
    setWhatsAppOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden flex flex-col ${fullscreen
          ? 'max-w-[100vw] w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none'
          : 'max-w-5xl w-full h-[100dvh] max-h-[100dvh] sm:h-[95vh] sm:max-h-[95vh]'
          }`}
        dir="rtl"
      >
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background shrink-0">
          <div className="flex items-center justify-between">
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

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              {/* Signature toggle */}
              <div className="flex items-center gap-2">
                <Switch id="print-signature-toggle" checked={showSignature} onCheckedChange={setShowSignature} />
                <Label htmlFor="print-signature-toggle" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1">
                  <Stamp className="h-4 w-4" />
                  <span className="hidden sm:inline">الختم والتوقيع</span>
                </Label>
              </div>

              {/* Total meters toggle - only for friend rental invoices */}
              {hasTotalMetersRow && (
                <div className="flex items-center gap-2">
                  <Switch id="print-meters-toggle" checked={showTotalMeters} onCheckedChange={setShowTotalMeters} />
                  <Label htmlFor="print-meters-toggle" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1">
                    <Ruler className="h-4 w-4" />
                    <span className="hidden sm:inline">إجمالي الأمتار</span>
                  </Label>
                </div>
              )}

              {/* Hide invoice date toggle */}
              {hasInvoiceDate && (
                <div className="flex items-center gap-2">
                  <Switch id="print-hide-date" checked={hideInvoiceDate} onCheckedChange={setHideInvoiceDate} />
                  <Label htmlFor="print-hide-date" className="text-sm cursor-pointer whitespace-nowrap">
                    <span className="hidden sm:inline">إخفاء التاريخ</span>
                  </Label>
                </div>
              )}

              {/* Hide rental notes toggle */}
              {hasRentalNotes && (
                <div className="flex items-center gap-2">
                  <Switch id="print-hide-notes" checked={hideRentalNotes} onCheckedChange={setHideRentalNotes} />
                  <Label htmlFor="print-hide-notes" className="text-sm cursor-pointer whitespace-nowrap">
                    <span className="hidden sm:inline">إخفاء الملاحظات</span>
                  </Label>
                </div>
              )}

              <Button onClick={handlePrint} className="gap-2" size="sm">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">طباعة</span>
              </Button>

              <Button variant="outline" className="gap-2" size="sm" onClick={handleDownloadPdf} disabled={isPdfLoading}>
                {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="hidden sm:inline">تحميل PDF</span>
              </Button>

              <Button variant="outline" className="gap-2" size="sm" onClick={handleUploadToDrive} disabled={isDriveUploading}>
                {isDriveUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                <span className="hidden sm:inline">رفع للمجلد</span>
              </Button>

              {job?.phone ? (
                <Button variant="outline" className="gap-2 border-green-500 text-green-600 hover:bg-green-50" size="sm" onClick={handleSendWhatsApp} disabled={isWhatsAppSending}>
                  {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  <span className="hidden sm:inline">واتساب</span>
                </Button>
              ) : (
                <Popover open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 border-green-500 text-green-600 hover:bg-green-50" size="sm">
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">واتساب</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">رقم الهاتف</Label>
                      <Input value={whatsAppPhone} onChange={(e) => setWhatsAppPhone(e.target.value)} placeholder="مثال: 218912345678" dir="ltr" className="text-left" />
                      <Button onClick={handleSendWhatsApp} disabled={isWhatsAppSending || !whatsAppPhone.trim()} className="w-full gap-2 bg-green-600 hover:bg-green-700" size="sm">
                        {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        إرسال عبر واتساب
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <Button variant="ghost" size="icon" onClick={() => setFullscreen(!fullscreen)}>
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="bg-muted/30 flex items-start justify-center p-2 sm:p-6 min-h-full">
            <iframe
              ref={iframeRef}
              srcDoc={iframeSrcDoc}
              className="bg-white shadow-xl rounded-lg w-full"
              style={{
                maxWidth: fullscreen ? '900px' : '794px',
                minHeight: fullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 120px)',
              }}
              title="print-preview"
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
