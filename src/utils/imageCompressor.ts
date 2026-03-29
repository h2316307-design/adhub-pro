/**
 * Compress an image file to fit within maxSizeBytes while maintaining
 * a minimum resolution of minResolution px on the largest dimension.
 * Starts at high quality (0.95) and reduces gradually for best results.
 */
export async function compressImage(
  file: File,
  maxSizeBytes = 2 * 1024 * 1024,
  minResolution = 2000
): Promise<File> {
  // If already small enough and is JPEG, return as-is
  if (file.size <= maxSizeBytes && file.type === 'image/jpeg') {
    return file;
  }

  const img = await loadImage(file);
  let { width, height } = img;

  // Scale down if larger than minResolution, keeping aspect ratio
  const maxDim = Math.max(width, height);
  if (maxDim > minResolution) {
    const scale = minResolution / maxDim;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Start at high quality and reduce iteratively
  let quality = 0.95;
  let blob: Blob | null = null;

  while (quality >= 0.4) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= maxSizeBytes) break;
    quality -= 0.05;
  }

  // If still too large after min quality, return best effort
  if (!blob || blob.size > maxSizeBytes) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.4);
  }

  const compressedName = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], compressedName, { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      type,
      quality
    );
  });
}
