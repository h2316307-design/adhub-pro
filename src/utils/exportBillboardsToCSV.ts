import { supabase } from '@/integrations/supabase/client';
import { buildContractFolderName, buildImagePath } from './contractExportNaming';

export interface ExportBillboardsCSVOptions {
  contractNumber: string | number;
  billboards: any[];
  customerName?: string;
  includePrices?: boolean;
}

/**
 * تصدير لوحات العقد إلى ملف CSV بترميز UTF-16 BE
 * يدعم اللغة العربية بشكل كامل ويفتح مباشرة في Excel بدون مشاكل ترميز.
 */
export async function exportBillboardsToCSV({
  contractNumber,
  billboards,
  customerName = '',
  includePrices = false,
}: ExportBillboardsCSVOptions) {
  if (!billboards || billboards.length === 0) {
    throw new Error('لا توجد لوحات للتصدير');
  }

  const billboardIds = billboards
    .map((b) => Number(b.ID ?? b.id))
    .filter((id) => Number.isFinite(id));

  // Ad Type fallback من العقد
  let contractAdType = '';
  if (contractNumber) {
    try {
      const { data: contractRow } = await supabase
        .from('Contract')
        .select('"Ad Type"')
        .eq('Contract_Number', Number(contractNumber))
        .maybeSingle();
      contractAdType = (contractRow as any)?.['Ad Type'] || '';
    } catch (err) {
      console.warn('[exportBillboardsToCSV] failed to fetch contract Ad Type:', err);
    }
  }

  // جلب صور التركيب
  const installedImagesMap = new Map<number, { faceA: string; faceB: string }>();
  if (billboardIds.length > 0) {
    try {
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at')
        .in('billboard_id', billboardIds)
        .order('created_at', { ascending: false });
      if (items) {
        for (const it of items as any[]) {
          const bid = Number(it.billboard_id);
          if (!Number.isFinite(bid)) continue;
          const existing = installedImagesMap.get(bid);
          if (existing && (existing.faceA || existing.faceB)) continue;
          const faceA = it.installed_image_face_a_url || '';
          const faceB = it.installed_image_face_b_url || '';
          if (!faceA && !faceB && existing) continue;
          installedImagesMap.set(bid, { faceA, faceB });
        }
      }
    } catch (err) {
      console.warn('[exportBillboardsToCSV] installation_task_items error:', err);
    }

    const missingIds = billboardIds.filter((id) => {
      const e = installedImagesMap.get(id);
      return !e || (!e.faceA && !e.faceB);
    });
    if (missingIds.length > 0) {
      try {
        const { data: histItems } = await supabase
          .from('billboard_history')
          .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, updated_at')
          .in('billboard_id', missingIds)
          .order('updated_at', { ascending: false });
        if (histItems) {
          for (const h of histItems as any[]) {
            const bid = Number(h.billboard_id);
            if (!Number.isFinite(bid)) continue;
            const existing = installedImagesMap.get(bid);
            if (existing && (existing.faceA || existing.faceB)) continue;
            if (!h.installed_image_face_a_url && !h.installed_image_face_b_url) continue;
            installedImagesMap.set(bid, {
              faceA: h.installed_image_face_a_url || '',
              faceB: h.installed_image_face_b_url || '',
            });
          }
        }
      } catch (err) {
        console.warn('[exportBillboardsToCSV] billboard_history error:', err);
      }
    }
  }

  // مساعد لاستخراج اسم الملف من الرابط واشتقاق اسم بديل
  const folderName = buildContractFolderName({ contractNumber, customerName });

  // الأعمدة (نفس ترتيب Excel) — أعمدة الصور بالإنجليزية وتبدأ بـ @IMAGE
  const headers = [
    'اسم اللوحة',
    'أقرب نقطة دالة',
    'البلدية',
    'المقاس',
    'عدد الأوجه',
    'نوع اللوحة',
    '@IMAGE_URL',
    '@IMAGE_NAME',
    'إحداثيات اللوحة',
    'اسم الزبون',
    'نوع الإعلان',
    '@IMAGE_INSTALLED_FACE_A_URL',
    '@IMAGE_INSTALLED_FACE_A_NAME',
    '@IMAGE_INSTALLED_FACE_B_URL',
    '@IMAGE_INSTALLED_FACE_B_NAME',
  ];
  if (includePrices) headers.push('السعر');

  const rows: string[][] = billboards.map((b) => {
    const bid = Number(b.ID ?? b.id);
    const installed = installedImagesMap.get(bid) || { faceA: '', faceB: '' };
    const billboardName = String(b.Billboard_Name || b.name || b.ID || b.id || '');
    const mainUrl = String(b.Image_URL || b.image_url || b.image || '');
    const row = [
      billboardName,
      String(b.Nearest_Landmark || b.nearest_landmark || b.location || ''),
      String(b.Municipality || b.municipality || b.City || ''),
      String(b.Size || b.size || ''),
      String(b.Faces_Count || b.faces_count || b.Faces || b.faces || ''),
      String(b.billboard_type || b.Ad_Type || b.ad_type || b.type || ''),
      mainUrl,
      mainUrl ? buildImagePath({ folderName, billboardName, suffix: 'main', url: mainUrl }) : '',
      String(b.GPS_Coordinates || b.coordinates || b.coords || ''),
      String(customerName || ''),
      String(b.Ad_Type || b.ad_type || contractAdType || ''),
      String(installed.faceA || ''),
      installed.faceA ? buildImagePath({ folderName, billboardName, suffix: 'A', url: installed.faceA }) : '',
      String(installed.faceB || ''),
      installed.faceB ? buildImagePath({ folderName, billboardName, suffix: 'B', url: installed.faceB }) : '',
    ];
    if (includePrices) row.push(b.Price != null ? String(b.Price) : '');
    return row;
  });

  // بناء محتوى CSV — استخدم TAB كفاصل ليتعرف Excel تلقائياً على الأعمدة
  // مع ترميز UTF-16 BE الذي يدعم العربية بالكامل في Excel.
  const TAB = '\t';
  const CRLF = '\r\n';
  const escapeCell = (v: string) => v.replace(/[\t\r\n]+/g, ' ');

  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(TAB));
  for (const r of rows) lines.push(r.map(escapeCell).join(TAB));
  const text = lines.join(CRLF) + CRLF;

  // تحويل النص إلى UTF-16 BE مع BOM
  const buffer = encodeUtf16BE(text);
  // ArrayBuffer جديد لتجنب SharedArrayBuffer typing
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  const blob = new Blob([ab], { type: 'text/csv;charset=utf-16be' });

  // اسم الملف يطابق اسم مجلد الصور (وملف ZIP) ليتعرف فوراً
  const fileName = `${folderName}${includePrices ? '_مع_الأسعار' : ''}.csv`;
  triggerDownload(blob, fileName);
}

/**
 * نفس منطق exportBillboardsToCSV لكن يُرجع Blob + fileName بدون تنزيل.
 * مفيد لتضمين CSV داخل ملف ZIP.
 */
export async function buildBillboardsCsvBlob(
  options: ExportBillboardsCSVOptions
): Promise<{ blob: Blob; fileName: string }> {
  const { contractNumber, billboards, customerName = '', includePrices = false } = options;
  if (!billboards || billboards.length === 0) {
    throw new Error('لا توجد لوحات للتصدير');
  }

  const billboardIds = billboards
    .map((b) => Number(b.ID ?? b.id))
    .filter((id) => Number.isFinite(id));

  let contractAdType = '';
  if (contractNumber) {
    try {
      const { data: contractRow } = await supabase
        .from('Contract')
        .select('"Ad Type"')
        .eq('Contract_Number', Number(contractNumber))
        .maybeSingle();
      contractAdType = (contractRow as any)?.['Ad Type'] || '';
    } catch {}
  }

  const installedImagesMap = new Map<number, { faceA: string; faceB: string }>();
  if (billboardIds.length > 0) {
    try {
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at')
        .in('billboard_id', billboardIds)
        .order('created_at', { ascending: false });
      if (items) {
        for (const it of items as any[]) {
          const bid = Number(it.billboard_id);
          if (!Number.isFinite(bid)) continue;
          const existing = installedImagesMap.get(bid);
          if (existing && (existing.faceA || existing.faceB)) continue;
          const faceA = it.installed_image_face_a_url || '';
          const faceB = it.installed_image_face_b_url || '';
          if (!faceA && !faceB && existing) continue;
          installedImagesMap.set(bid, { faceA, faceB });
        }
      }
    } catch {}

    const missingIds = billboardIds.filter((id) => {
      const e = installedImagesMap.get(id);
      return !e || (!e.faceA && !e.faceB);
    });
    if (missingIds.length > 0) {
      try {
        const { data: histItems } = await supabase
          .from('billboard_history')
          .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, updated_at')
          .in('billboard_id', missingIds)
          .order('updated_at', { ascending: false });
        if (histItems) {
          for (const h of histItems as any[]) {
            const bid = Number(h.billboard_id);
            if (!Number.isFinite(bid)) continue;
            const existing = installedImagesMap.get(bid);
            if (existing && (existing.faceA || existing.faceB)) continue;
            if (!h.installed_image_face_a_url && !h.installed_image_face_b_url) continue;
            installedImagesMap.set(bid, {
              faceA: h.installed_image_face_a_url || '',
              faceB: h.installed_image_face_b_url || '',
            });
          }
        }
      } catch {}
    }
  }

  const folderName = buildContractFolderName({ contractNumber, customerName });

  const headers = [
    'اسم اللوحة',
    'أقرب نقطة دالة',
    'البلدية',
    'المقاس',
    'عدد الأوجه',
    'نوع اللوحة',
    '@IMAGE_URL',
    '@IMAGE_NAME',
    'إحداثيات اللوحة',
    'اسم الزبون',
    'نوع الإعلان',
    '@IMAGE_INSTALLED_FACE_A_URL',
    '@IMAGE_INSTALLED_FACE_A_NAME',
    '@IMAGE_INSTALLED_FACE_B_URL',
    '@IMAGE_INSTALLED_FACE_B_NAME',
  ];
  if (includePrices) headers.push('السعر');

  const rows: string[][] = billboards.map((b) => {
    const bid = Number(b.ID ?? b.id);
    const installed = installedImagesMap.get(bid) || { faceA: '', faceB: '' };
    const billboardName = String(b.Billboard_Name || b.name || b.ID || b.id || '');
    const mainUrl = String(b.Image_URL || b.image_url || b.image || '');
    const row = [
      billboardName,
      String(b.Nearest_Landmark || b.nearest_landmark || b.location || ''),
      String(b.Municipality || b.municipality || b.City || ''),
      String(b.Size || b.size || ''),
      String(b.Faces_Count || b.faces_count || b.Faces || b.faces || ''),
      String(b.billboard_type || b.Ad_Type || b.ad_type || b.type || ''),
      mainUrl,
      mainUrl ? buildImagePath({ folderName, billboardName, suffix: 'main', url: mainUrl }) : '',
      String(b.GPS_Coordinates || b.coordinates || b.coords || ''),
      String(customerName || ''),
      String(b.Ad_Type || b.ad_type || contractAdType || ''),
      String(installed.faceA || ''),
      installed.faceA ? buildImagePath({ folderName, billboardName, suffix: 'A', url: installed.faceA }) : '',
      String(installed.faceB || ''),
      installed.faceB ? buildImagePath({ folderName, billboardName, suffix: 'B', url: installed.faceB }) : '',
    ];
    if (includePrices) row.push(b.Price != null ? String(b.Price) : '');
    return row;
  });

  const TAB = '\t';
  const CRLF = '\r\n';
  const escapeCell = (v: string) => v.replace(/[\t\r\n]+/g, ' ');
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(TAB));
  for (const r of rows) lines.push(r.map(escapeCell).join(TAB));
  const text = lines.join(CRLF) + CRLF;
  const buffer = encodeUtf16BE(text);
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  const blob = new Blob([ab], { type: 'text/csv;charset=utf-16be' });
  const fileName = `${folderName}${includePrices ? '_مع_الأسعار' : ''}.csv`;
  return { blob, fileName };
}

/**
 * يحوّل سلسلة JS (UTF-16 LE داخلياً) إلى Uint8Array بترميز UTF-16 BE
 * مع إضافة BOM (FE FF) في البداية ليتعرف Excel على الترميز.
 */
function encodeUtf16BE(str: string): Uint8Array {
  const len = str.length;
  const buf = new Uint8Array(2 + len * 2);
  // BOM: FE FF
  buf[0] = 0xfe;
  buf[1] = 0xff;
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    buf[2 + i * 2] = (code >> 8) & 0xff;
    buf[2 + i * 2 + 1] = code & 0xff;
  }
  return buf;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
