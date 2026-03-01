import JSZip from 'jszip';
import type { GalleryTask } from '@/hooks/useImageGallery';

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
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
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  let totalImages = 0;
  let processedImages = 0;

  // Count total
  for (const task of tasks) {
    if (mode === 'all' || mode === 'designs_only') {
      for (const design of task.designs) {
        if (design.faceAUrl) totalImages++;
        if (design.faceBUrl) totalImages++;
        if (design.cutoutUrl) totalImages++;
      }
    }
    if (mode === 'all') {
      for (const item of task.items) {
        if (item.designFaceA) totalImages++;
        if (item.designFaceB) totalImages++;
        if (item.installedFaceA) totalImages++;
        if (item.installedFaceB) totalImages++;
      }
    }
  }

  for (const task of tasks) {
    const folderName = sanitizeFileName(`${task.customerName} - ${task.adType} - عقد ${task.contractId}`);
    const taskFolder = zip.folder(folderName)!;

    // Task designs
    if (task.designs.length > 0) {
      const designsFolder = taskFolder.folder('التصاميم')!;
      for (const design of task.designs) {
        const designName = sanitizeFileName(design.designName);
        if (design.faceAUrl) {
          const blob = await fetchImageAsBlob(design.faceAUrl);
          if (blob) designsFolder.file(`${designName} - وجه أمامي${getExtension(design.faceAUrl)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (design.faceBUrl) {
          const blob = await fetchImageAsBlob(design.faceBUrl);
          if (blob) designsFolder.file(`${designName} - وجه خلفي${getExtension(design.faceBUrl)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (design.cutoutUrl) {
          const blob = await fetchImageAsBlob(design.cutoutUrl);
          if (blob) designsFolder.file(`${designName} - مجسم${getExtension(design.cutoutUrl)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
      }
    }

    if (mode === 'all') {
      // Billboard items
      for (const item of task.items) {
        const bbName = sanitizeFileName(item.billboardName);

        // Design images per billboard
        if (item.designFaceA) {
          const blob = await fetchImageAsBlob(item.designFaceA);
          if (blob) taskFolder.file(`${bbName} - تصميم وجه أمامي - ${task.adType}${getExtension(item.designFaceA)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (item.designFaceB) {
          const blob = await fetchImageAsBlob(item.designFaceB);
          if (blob) taskFolder.file(`${bbName} - تصميم وجه خلفي - ${task.adType}${getExtension(item.designFaceB)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }

        // Installed images
        if (item.installedFaceA) {
          const blob = await fetchImageAsBlob(item.installedFaceA);
          if (blob) taskFolder.file(`${bbName} - تركيب وجه أمامي - ${task.adType}${getExtension(item.installedFaceA)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
        }
        if (item.installedFaceB) {
          const blob = await fetchImageAsBlob(item.installedFaceB);
          if (blob) taskFolder.file(`${bbName} - تركيب وجه خلفي - ${task.adType}${getExtension(item.installedFaceB)}`, blob);
          processedImages++;
          onProgress?.(processedImages, totalImages);
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
