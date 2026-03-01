// Reusable helper to generate a pixel-perfect PDF from an HTML string
// Uses an offscreen iframe to ensure fonts and images load, then jsPDF + html2canvas to export
// ✅ FIXED: Now correctly handles multi-page content by slicing single canvas into pages
import DOMPurify from 'dompurify';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface SavePdfOptions {
  filename?: string;
  marginMm?: [number, number, number, number];
  rootSelector?: string; // optional CSS selector to capture a specific element (e.g., '#pdf-root')
  waitMs?: number; // extra wait time after load (default 1200ms)
}

// A4 dimensions at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export async function saveHtmlAsPdf(html: string, filename: string, opts: SavePdfOptions = {}) {
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
  iframe.style.width = `${A4_WIDTH_PX}px`;
  iframe.style.height = 'auto';
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
    // Find all pages (elements with class 'print-page' or direct children of body)
    let pages = Array.from(iframeDoc.querySelectorAll('.print-page, .template-container')) as HTMLElement[];
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // ======= إذا وجدنا صفحات محددة (.print-page)، نعالج كل صفحة بشكل منفصل =======
    if (pages.length > 0) {
      for (let i = 0; i < pages.length; i++) {
        const element = pages[i];
        
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          scrollX: 0,
          scrollY: 0
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
      }
    } else {
      // ======= لا توجد صفحات محددة - نرسم الـ body كاملاً ونقسمه إلى صفحات =======
      const targetElement = opts.rootSelector
        ? (iframeDoc.querySelector(opts.rootSelector) as HTMLElement | null) || iframeDoc.body
        : iframeDoc.body;
      
      // Capture the entire content at high resolution
      const canvas = await html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      // Calculate how many pages we need
      const imgWidth = A4_WIDTH_MM;
      const imgHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;
      const pageHeight = A4_HEIGHT_MM;
      
      let heightLeft = imgHeight;
      let position = 0;
      let pageNum = 0;
      
      // Add pages by slicing the canvas
      while (heightLeft > 0) {
        if (pageNum > 0) {
          pdf.addPage('a4', 'portrait');
        }
        
        // Calculate the portion of canvas to draw on this page
        const sourceY = (pageNum * pageHeight * canvas.width) / imgWidth;
        const sourceHeight = Math.min(
          (pageHeight * canvas.width) / imgWidth,
          canvas.height - sourceY
        );
        
        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = (pageHeight * canvas.width) / imgWidth;
        const ctx = pageCanvas.getContext('2d');
        
        if (ctx) {
          // Fill with white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          
          // Draw the portion of the original canvas
          ctx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight, // source rectangle
            0, 0, canvas.width, sourceHeight // destination rectangle
          );
          
          const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
          pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, pageHeight);
        }
        
        heightLeft -= pageHeight;
        pageNum++;
      }
    }
    
    // Save the PDF
    pdf.save(filename);

  } finally {
    document.body.removeChild(iframe);
  }
}
