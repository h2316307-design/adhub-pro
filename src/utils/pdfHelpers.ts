// Reusable helper to generate a pixel-perfect PDF from an HTML string
// Uses an offscreen iframe to ensure fonts and images load, then html2pdf.js to export
import DOMPurify from 'dompurify';

export interface SavePdfOptions {
  filename?: string;
  marginMm?: [number, number, number, number];
  rootSelector?: string; // optional CSS selector to capture a specific element (e.g., '#pdf-root')
  waitMs?: number; // extra wait time after load (default 1200ms)
}

export async function saveHtmlAsPdf(html: string, filename: string, opts: SavePdfOptions = {}) {
  const html2pdf = (await import('html2pdf.js')).default;

  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['target', 'rel', 'dir', 'lang'],
    WHOLE_DOCUMENT: true,
    RETURN_DOM: false,
  });

  // Create hidden iframe to fully load HTML (fonts/images)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  iframe.sandbox.add('allow-same-origin');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('فشل في إنشاء iframe');
  }

  iframeDoc.open();
  iframeDoc.write(sanitizedHtml);
  iframeDoc.close();

  // Wait for iframe load + fonts/images
  await new Promise((resolve) => {
    if (iframe.contentWindow) {
      iframe.contentWindow.addEventListener('load', () => {
        setTimeout(resolve, opts.waitMs ?? 1500);
      });
    } else {
      setTimeout(resolve, opts.waitMs ?? 1500);
    }
  });

  try {
    const element = opts.rootSelector
      ? (iframeDoc.querySelector(opts.rootSelector) as HTMLElement | null)
      : iframeDoc.body;

    const opt = {
      margin: (opts.marginMm ?? [10, 10, 10, 10]) as [number, number, number, number],
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        foreignObjectRendering: true,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const,
        compress: true,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any },
    };

    await html2pdf().set(opt).from(element || iframeDoc.body).save();
  } finally {
    document.body.removeChild(iframe);
  }
}
