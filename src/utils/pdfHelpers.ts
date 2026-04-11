// Reusable helper to generate a pixel-perfect PDF from an HTML string
// Renders content at A4 width (794px ≈ 210mm at 96dpi) then converts via html2pdf
import DOMPurify from 'dompurify';
import html2pdf from 'html2pdf.js';

export interface SavePdfOptions {
  filename?: string;
  marginMm?: [number, number, number, number];
  rootSelector?: string;
  waitMs?: number;
}

// A4 width at 96 DPI = 210mm ≈ 794px
const A4_WIDTH_PX = 794;

/**
 * CSS injected into the cloned DOM before html2canvas captures it.
 * Forces print-like behavior: fixed table layout, no page-break mid-row,
 * exact color rendering, and neutralized responsive breakpoints.
 */
const PRINT_OVERRIDE_CSS = `
  /* Force print color rendering */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  /* Prevent page-break issues */
  tr, td, th, img, svg {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  table {
    table-layout: fixed !important;
    width: 100% !important;
    border-collapse: collapse !important;
  }
  /* Neutralize any responsive max-width constraints */
  .container, [class*="max-w-"] {
    max-width: none !important;
  }
  .print-page, .template-container {
    page-break-after: always !important;
    break-after: page !important;
  }
`;

export async function saveHtmlAsPdf(html: string, filename: string, opts: SavePdfOptions = {}) {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['target', 'rel', 'dir', 'lang'],
    WHOLE_DOCUMENT: true,
    RETURN_DOM: false,
  });

  // Create an offscreen iframe at A4 width so the content renders at print size
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${A4_WIDTH_PX}px;height:3000px;border:none;`;
  iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create iframe');
  }

  // Write the HTML directly — no extra wrapper needed since templates already have 210mm width
  iframeDoc.open();
  iframeDoc.write(sanitizedHtml);
  iframeDoc.close();

  // Inject override styles into the iframe
  const overrideStyle = iframeDoc.createElement('style');
  overrideStyle.innerHTML = `
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      width: ${A4_WIDTH_PX}px !important;
      background-color: #ffffff !important;
    }
    ${PRINT_OVERRIDE_CSS}
  `;
  iframeDoc.head.appendChild(overrideStyle);

  // Wait for iframe to finish loading
  await new Promise<void>((resolve) => {
    let doneOnce = false;
    const done = () => {
      if (doneOnce) return;
      doneOnce = true;
      setTimeout(resolve, opts.waitMs ?? 1500);
    };
    if (iframe.contentWindow && iframeDoc.readyState !== 'complete') {
      iframe.contentWindow.addEventListener('load', done, { once: true });
    }
    setTimeout(done, 3000);
  });

  // Wait for custom fonts
  try { await (iframeDoc as any).fonts?.ready; } catch { }

  // Wait for all images to load
  const images = Array.from(iframeDoc.getElementsByTagName('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  try {
    const targetElement = opts.rootSelector
      ? (iframeDoc.querySelector(opts.rootSelector) as HTMLElement | null) || iframeDoc.body
      : iframeDoc.body;

    const uniqueId = `pdf-target-${Date.now()}`;
    targetElement.setAttribute('data-pdf-target', uniqueId);

    await html2pdf()
      .from(targetElement)
      .set({
        margin: opts.marginMm ?? [10, 0, 10, 0],
        filename: opts.filename ?? filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: A4_WIDTH_PX,
          windowWidth: A4_WIDTH_PX,
          onclone: (clonedDoc: Document) => {
            const style = clonedDoc.createElement('style');
            style.textContent = PRINT_OVERRIDE_CSS;
            clonedDoc.head.appendChild(style);

            // Force the specific target element to A4 width so it doesn't stretch to 1200
            const clonedTarget = clonedDoc.querySelector(`[data-pdf-target="${uniqueId}"]`) as HTMLElement;
            if (clonedTarget) {
              clonedTarget.style.width = `${A4_WIDTH_PX}px`;
              clonedTarget.style.minWidth = `${A4_WIDTH_PX}px`;
              clonedTarget.style.maxWidth = `${A4_WIDTH_PX}px`;
              clonedTarget.style.margin = '0 auto';
              clonedTarget.style.boxSizing = 'border-box';
              clonedTarget.classList.remove('w-full');
            }
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      } as any)
      .save();
  } finally {
    document.body.removeChild(iframe);
  }
}
