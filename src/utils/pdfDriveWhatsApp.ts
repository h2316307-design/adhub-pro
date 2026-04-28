/**
 * pdfDriveWhatsApp - أدوات مشتركة لتحويل HTML إلى PDF ورفعه إلى Google Drive وإرسال عبر WhatsApp
 * يستخدم المحرك الموحد من pdfHelpers.ts (iframe-based rendering)
 */

import { htmlToPdfBlob, htmlToPdfBlobOptimized } from '@/utils/pdfHelpers';

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface HtmlToPdfOptions {
  html: string;
  fileName: string;
  landscape?: boolean;
  showSignature?: boolean;
}

/**
 * رفع PDF إلى Google Drive
 */
export async function uploadPdfToDrive(options: {
  html: string;
  fileName: string;
  driveFolder: string;
  landscape?: boolean;
}): Promise<string> {
  const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
  const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');

  const progress = createUploadProgressTracker();
  const pdfBlob = await htmlToPdfBlobOptimized(options.html, options.fileName, { landscape: options.landscape });
  const base64Data = await blobToBase64(pdfBlob);

  const pdfUrl = await uploadFileToGoogleDrive(
    base64Data,
    options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
    'application/pdf',
    options.driveFolder,
    false,
    progress
  );

  return pdfUrl;
}

/**
 * رفع PDF ثم إرسال عبر واتساب (الجسر أو wa.me كـ fallback)
 */
export async function uploadPdfAndSendWhatsApp(options: {
  html: string;
  fileName: string;
  driveFolder: string;
  phone: string;
  message?: string;
  landscape?: boolean;
}): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');

  // 1. تحويل HTML إلى PDF
  const pdfBlob = await htmlToPdfBlobOptimized(options.html, options.fileName, { landscape: options.landscape });
  const base64Data = await blobToBase64(pdfBlob);

  // 2. رفع إلى Google Drive
  const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
  const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
  const progress = createUploadProgressTracker();
  const pdfUrl = await uploadFileToGoogleDrive(
    base64Data,
    options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
    'application/pdf',
    options.driveFolder,
    false,
    progress
  );

  const cleanPhone = options.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  const baseMsg = options.message || `📄 ${options.fileName}`;
  const fullMsg = `${baseMsg}\n\n📎 رابط الملف:\n${pdfUrl}`;

  // 3. محاولة إرسال الملف عبر الجسر (wppconnect bridge)
  let bridgeSent = false;
  try {
    // أولاً: إرسال الملف كمرفق
    const { data: fileData, error: fileError } = await supabase.functions.invoke('whatsapp-service', {
      body: {
        action: 'sendFile',
        phone: cleanPhone,
        base64: base64Data,
        mimeType: 'application/pdf',
        fileName: options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
        caption: baseMsg,
      }
    });

    if (!fileError && fileData?.success !== false) {
      bridgeSent = true;
      console.log('✅ PDF sent via WhatsApp bridge');
      
      // ثانياً: إرسال الرابط كرسالة نصية
      await supabase.functions.invoke('whatsapp-service', {
        body: {
          action: 'send',
          phone: cleanPhone,
          message: `📎 رابط الملف:\n${pdfUrl}`,
        }
      });
    }
  } catch (err) {
    console.log('Bridge send failed, falling back to wa.me:', err);
  }

  // 4. Fallback: فتح wa.me مع الرابط
  if (!bridgeSent) {
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`;
    window.open(waUrl, '_blank');
  }

  return pdfUrl;
}

/**
 * رفع PDF Blob جاهز ثم إرسال عبر واتساب (بدون تحويل HTML)
 */
export async function uploadPdfBlobAndSendWhatsApp(options: {
  pdfBlob: Blob;
  fileName: string;
  driveFolder: string;
  phone: string;
  message?: string;
}): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  const base64Data = await blobToBase64(options.pdfBlob);

  const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
  const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
  const progress = createUploadProgressTracker();
  const pdfUrl = await uploadFileToGoogleDrive(
    base64Data,
    options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
    'application/pdf',
    options.driveFolder,
    false,
    progress
  );

  const cleanPhone = options.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  const baseMsg = options.message || `📄 ${options.fileName}`;
  const fullMsg = `${baseMsg}\n\n📎 رابط الملف:\n${pdfUrl}`;

  let bridgeSent = false;
  try {
    const { data: fileData, error: fileError } = await supabase.functions.invoke('whatsapp-service', {
      body: {
        action: 'sendFile',
        phone: cleanPhone,
        base64: base64Data,
        mimeType: 'application/pdf',
        fileName: options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
        caption: baseMsg,
      }
    });

    if (!fileError && fileData?.success !== false) {
      bridgeSent = true;
      await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'send', phone: cleanPhone, message: `📎 رابط الملف:\n${pdfUrl}` }
      });
    }
  } catch (err) {
    console.log('Bridge send failed, falling back to wa.me:', err);
  }

  if (!bridgeSent) {
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`;
    window.open(waUrl, '_blank');
  }

  return pdfUrl;
}
