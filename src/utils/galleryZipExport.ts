import JSZip from 'jszip';
import type { GalleryTask } from '@/hooks/useImageGallery';
import { createFileNameDeduplicator } from '@/utils/fileNameDedup';

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/** Short ID suffix for uniqueness (first 8 chars of UUID) */
function shortId(id: string | null): string {
  if (!id) return '';
  return id.replace(/-/g, '').slice(0, 8);
}

async function fetchImageAsBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function getExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

export async function exportTasksAsZip(
  tasks: GalleryTask[],
  mode: 'all' | 'designs_only' = 'all',
  onProgress?: (current: number, total: number) => void,
  allowedUrls?: Set<string>
): Promise<Blob> {
  const zip = new JSZip();
  let totalImages = 0;
  let processedImages = 0;

  const shouldInclude = (url: string | null) => url && (!allowedUrls || allowedUrls.has(url));

  // Count total
  for (const task of tasks) {
    if (mode === 'all' || mode === 'designs_only') {
      for (const design of task.designs) {
        if (shouldInclude(design.faceAUrl)) totalImages++;
        if (shouldInclude(design.faceBUrl)) totalImages++;
        if (shouldInclude(design.cutoutUrl)) totalImages++;
      }
    }
    if (mode === 'all') {
      for (const item of task.items) {
        if (shouldInclude(item.designFaceA)) totalImages++;
        if (shouldInclude(item.designFaceB)) totalImages++;
        if (shouldInclude(item.installedFaceA)) totalImages++;
        if (shouldInclude(item.installedFaceB)) totalImages++;
        for (const hp of (item.historyPhotos || [])) {
          if (shouldInclude(hp.installedFaceA)) totalImages++;
          if (shouldInclude(hp.installedFaceB)) totalImages++;
        }
      }
    }
  }

  for (const task of tasks) {
    const folderName = sanitizeFileName(`${task.customerName} - ${task.adType} - عقد ${task.contractId}`);
    const taskFolder = zip.folder(folderName)!;
    const dedup = createFileNameDeduplicator();

    // Task designs
    if (task.designs.length > 0) {
      const designsFolder = taskFolder.folder('التصاميم')!;
      for (const design of task.designs) {
        const designName = sanitizeFileName(design.designName);
        const sid = shortId(design.id);
        if (shouldInclude(design.faceAUrl)) {
          const blob = await fetchImageAsBlob(design.faceAUrl!);
          if (blob) designsFolder.file(dedup(`${designName} - وجه أمامي - ${sid}`, getExtension(design.faceAUrl!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (shouldInclude(design.faceBUrl)) {
          const blob = await fetchImageAsBlob(design.faceBUrl!);
          if (blob) designsFolder.file(dedup(`${designName} - وجه خلفي - ${sid}`, getExtension(design.faceBUrl!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (shouldInclude(design.cutoutUrl)) {
          const blob = await fetchImageAsBlob(design.cutoutUrl!);
          if (blob) designsFolder.file(dedup(`${designName} - مجسم - ${sid}`, getExtension(design.cutoutUrl!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
      }
    }

    if (mode === 'all') {
      for (const item of task.items) {
        const bbName = sanitizeFileName(item.billboardName);
        const sid = shortId(item.id);

        if (shouldInclude(item.designFaceA)) {
          const blob = await fetchImageAsBlob(item.designFaceA!);
          if (blob) taskFolder.file(dedup(`${bbName} - تصميم وجه أمامي - ${task.adType} - ${sid}`, getExtension(item.designFaceA!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (shouldInclude(item.designFaceB)) {
          const blob = await fetchImageAsBlob(item.designFaceB!);
          if (blob) taskFolder.file(dedup(`${bbName} - تصميم وجه خلفي - ${task.adType} - ${sid}`, getExtension(item.designFaceB!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }

        if (shouldInclude(item.installedFaceA)) {
          const blob = await fetchImageAsBlob(item.installedFaceA!);
          if (blob) taskFolder.file(dedup(`${bbName} - تركيب وجه أمامي - ${task.adType} - ${sid}`, getExtension(item.installedFaceA!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (shouldInclude(item.installedFaceB)) {
          const blob = await fetchImageAsBlob(item.installedFaceB!);
          if (blob) taskFolder.file(dedup(`${bbName} - تركيب وجه خلفي - ${task.adType} - ${sid}`, getExtension(item.installedFaceB!)), blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }

        // History photos (previous installations)
        for (const hp of (item.historyPhotos || [])) {
          const hpSid = shortId(hp.id);
          if (shouldInclude(hp.installedFaceA)) {
            const blob = await fetchImageAsBlob(hp.installedFaceA!);
            if (blob) taskFolder.file(dedup(`${bbName} - تركيب سابق ${hp.reinstallNumber} وجه أمامي - ${task.adType} - ${hpSid}`, getExtension(hp.installedFaceA!)), blob);
            processedImages++;
            onProgress?.(processedImages, totalImages);
          }
          if (shouldInclude(hp.installedFaceB)) {
            const blob = await fetchImageAsBlob(hp.installedFaceB!);
            if (blob) taskFolder.file(dedup(`${bbName} - تركيب سابق ${hp.reinstallNumber} وجه خلفي - ${task.adType} - ${hpSid}`, getExtension(hp.installedFaceB!)), blob);
            processedImages++;
            onProgress?.(processedImages, totalImages);
          }
        }
      }
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Extract all image URLs from tasks for server filtering */
export function getAllImageUrls(tasks: GalleryTask[], mode: 'all' | 'designs_only' = 'all'): string[] {
  const urls: string[] = [];
  for (const task of tasks) {
    for (const d of task.designs) {
      if (d.faceAUrl) urls.push(d.faceAUrl);
      if (d.faceBUrl) urls.push(d.faceBUrl);
      if (d.cutoutUrl) urls.push(d.cutoutUrl);
    }
    if (mode === 'all') {
      for (const item of task.items) {
        if (item.designFaceA) urls.push(item.designFaceA);
        if (item.designFaceB) urls.push(item.designFaceB);
        if (item.installedFaceA) urls.push(item.installedFaceA);
        if (item.installedFaceB) urls.push(item.installedFaceB);
        for (const hp of (item.historyPhotos || [])) {
          if (hp.installedFaceA) urls.push(hp.installedFaceA);
          if (hp.installedFaceB) urls.push(hp.installedFaceB);
        }
      }
    }
  }
  return urls;
}
