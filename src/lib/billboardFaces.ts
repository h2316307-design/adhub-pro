import { getBillboardDimensions } from './billboardDimensions';

export interface FaceDimension { width: number; height: number }

/** Empty entries inherit the billboard's standard dimensions. */
export function getFaceDimensions(billboard: any, count: number, fallback?: FaceDimension): FaceDimension[] {
  const base = fallback || getBillboardDimensions(billboard);
  const overrides = Array.isArray(billboard?.face_dimensions) ? billboard.face_dimensions : [];
  return Array.from({ length: count }, (_, index) => {
    const face = overrides[index];
    return Number(face?.width) > 0 && Number(face?.height) > 0
      ? { width: Number(face.width), height: Number(face.height) }
      : { width: base.width, height: base.height };
  });
}

export function normalizeSelectedFaces(value: unknown, max: number): number[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((v): v is number => Number.isInteger(v) && v >= 1 && v <= max))].sort((a, b) => a - b)
    : [];
}

export function validateFaceDimensions(form: any): void {
  const count = Number(form.Faces_Count) || 1;
  for (const face of (form.face_dimensions || []).slice(0, count)) {
    if (!face || (!face.width && !face.height)) continue;
    if (!Number.isFinite(Number(face.width)) || !Number.isFinite(Number(face.height)) || Number(face.width) <= 0 || Number(face.height) <= 0) {
      throw new Error('أدخل عرضاً وارتفاعاً أكبر من صفر لكل وجه مخصص');
    }
  }
}
