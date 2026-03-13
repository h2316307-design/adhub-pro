/**
 * UnifiedPrintDialog - نافذة طباعة موحدة لجميع الفواتير
 * تستخدم نفس تصميم UnifiedTaskInvoice مع دعم الطباعة وتحميل PDF
 */
import { useState, useRef, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Download, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';

interface UnifiedPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** HTML string to render in iframe mode */
  html?: string;
  /** React children to render directly */
  children?: ReactNode;
  /** Controls to show in the header bar */
  headerControls?: ReactNode;
  /** PDF filename (without extension) */
  pdfFilename?: string;
  /** Font family for print */
  fontFamily?: string;
  /** Custom max width class */
  maxWidth?: string;
}

export function UnifiedPrintDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  html,
  children,
  headerControls,
  pdfFilename,
  fontFamily = 'Doran',
  maxWidth = 'max-w-5xl',
}: UnifiedPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = () => {
    if (html) {
      // HTML mode - open in new window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        // Fallback: iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '900px';
        iframe.style.height = '700px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          iframe.onload = () => {
            setTimeout(() => {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              setTimeout(() => iframe.remove(), 2500);
            }, 300);
          };
        }
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 800);
    } else if (printRef.current) {
      // React children mode - clone content to new window
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('فشل فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; background: #fff; }
            .print-container { width: 210mm; min-height: 297mm; padding: 15mm; background: #fff; }
            @media print {
              @page { size: A4; margin: 15mm; }
              .print-container { width: 100%; min-height: auto; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">${printContent}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 800);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      let element: HTMLElement | null = null;

      if (html) {
        // Create a temporary container for HTML content
        const container = document.createElement('div');
        container.innerHTML = html;
        // Extract body content if full HTML document
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          container.innerHTML = bodyMatch[1];
        }
        container.style.width = '210mm';
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.fontFamily = `${fontFamily}, 'Noto Sans Arabic', Arial, sans-serif`;
        container.style.direction = 'rtl';
        document.body.appendChild(container);
        element = container;
      } else if (printRef.current) {
        element = printRef.current;
      }

      if (!element) {
        toast.error('لا يوجد محتوى للتحميل');
        return;
      }

      const filename = pdfFilename || title.replace(/[|#]/g, '').trim();

      const opt = {
        margin: 0,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 794,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any },
      };

      await html2pdf().set(opt).from(element).save();

      // Clean up temporary element
      if (html && element.parentElement === document.body) {
        document.body.removeChild(element);
      }

      toast.success('تم تحميل ملف PDF بنجاح');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('فشل تحميل PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidth} w-full max-h-[100dvh] sm:max-h-[95vh] p-0`}>
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {icon || <FileText className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <DialogTitle className="text-lg">{title}</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{subtitle || title}</DialogDescription>
                </VisuallyHidden>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              {headerControls}
              <Button onClick={handlePrint} className="gap-2" size="sm">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">طباعة</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="gap-2"
                size="sm"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">تحميل PDF</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(100dvh-80px)] sm:max-h-[calc(95vh-80px)]">
          <div className="p-2 sm:p-6 flex justify-center bg-muted/30">
            {html ? (
              <div
                className="bg-white shadow-2xl rounded-lg overflow-hidden w-full"
                style={{ maxWidth: '210mm', minHeight: '297mm' }}
              >
                <iframe
                  srcDoc={html}
                  className="w-full border-0"
                  style={{ height: '297mm', minHeight: '297mm' }}
                  title="Print Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div
                ref={printRef}
                className="bg-white shadow-2xl w-full"
                style={{
                  maxWidth: '210mm',
                  minHeight: '297mm',
                  backgroundColor: '#fff',
                  fontFamily: `${fontFamily}, 'Noto Sans Arabic', Arial, sans-serif`,
                  padding: '15mm',
                  direction: 'rtl',
                }}
              >
                {children}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
