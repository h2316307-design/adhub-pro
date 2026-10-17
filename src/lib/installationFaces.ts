import { getFaceDimensions, normalizeSelectedFaces } from './billboardFaces';
export type ReinstalledFaces = 'both' | 'face_a' | 'face_b';

export interface InstallationFacesSource {
  faces_to_install?: unknown;
  selected_faces?: unknown;
  reinstalled_faces?: ReinstalledFaces | null;
  billboard?: PhysicalFacesSource | null;
}

export interface PhysicalFacesSource {
  Faces_Count?: unknown;
  face_dimensions?: unknown;
  faces_count?: unknown;
  Faces?: unknown;
  faces?: unknown;
}

export const parsePositiveFacesCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (/^(1|one|single|وجه\s*واحد|وجه1)$/.test(normalized) || /وجه\s*واحد|وجه1|single|one/.test(normalized)) return 1;
    if (/^(2|two|double|وجهين|وجهان|وجه\s*2)$/.test(normalized) || /وجهين|وجهان|وجه\s*2|double|two/.test(normalized)) return 2;
    if (/^(3|three|triple|3\s*أوجه|ثلاثة\s*أوجه)$/.test(normalized)) return 3;
    if (/^(4|four|quad|4\s*أوجه|أربعة\s*أوجه)$/.test(normalized)) return 4;
    const num = Number(normalized);
    if (Number.isFinite(num) && num > 0) return Math.max(1, Math.min(10, Math.round(num)));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.min(10, Math.round(parsed)));
};

export const getAvailableFacesCount = (billboard?: PhysicalFacesSource | null): number => {
  if (!billboard) return 2;
  const physicalFaces = [
    billboard?.Faces_Count,
    billboard?.faces_count,
    billboard?.Faces,
    billboard?.faces,
  ].map(parsePositiveFacesCount).find((faces): faces is number => faces !== null);
  return physicalFaces ?? 2;
};

export const resolveInstallationFacesCount = (
  item: InstallationFacesSource,
  billboard: PhysicalFacesSource | null | undefined = item.billboard,
  taskType?: string | null,
): number => {
  const physicalFaces = [
    billboard?.Faces_Count,
    billboard?.faces_count,
    billboard?.Faces,
    billboard?.faces,
  ].map(parsePositiveFacesCount).find((faces): faces is number => faces !== null) ?? null;
  const selected = normalizeSelectedFaces(item.selected_faces, physicalFaces ?? 10);
  if (selected.length) return selected.length;
  const requestedFaces = parsePositiveFacesCount(item.faces_to_install);
  const reinstalledFaces = item.reinstalled_faces || undefined;

  let resolvedFaces = requestedFaces ?? physicalFaces ?? 1;
  if (taskType === 'reinstallation') {
    if (reinstalledFaces === 'face_a' || reinstalledFaces === 'face_b') resolvedFaces = 1;
    if (reinstalledFaces === 'both') {
      // A legacy "both" flag must not widen an explicit one-face selection.
      resolvedFaces = requestedFaces ?? physicalFaces ?? 2;
    }
  }

  // A task can request fewer faces than the billboard, but never more than it physically owns.
  return physicalFaces !== null ? Math.min(resolvedFaces, physicalFaces) : resolvedFaces;
};

export const calculateInstallationArea = (
  width: number,
  height: number,
  item: InstallationFacesSource,
  billboard: PhysicalFacesSource | null | undefined = item.billboard,
  taskType?: string | null,
): number => {
  const safeWidth = Number.isFinite(Number(width)) ? Math.max(0, Number(width)) : 0;
  const safeHeight = Number.isFinite(Number(height)) ? Math.max(0, Number(height)) : 0;
  const count = resolveInstallationFacesCount(item, billboard, taskType);
  const max = billboard ? getAvailableFacesCount(billboard) : count;
  const explicit = normalizeSelectedFaces(item.selected_faces, max);
  const indices = explicit.length ? explicit : count === 1 && item.reinstalled_faces === 'face_b' && max >= 2
    ? [2] : Array.from({ length: count }, (_, i) => i + 1);
  const dimensions = getFaceDimensions(billboard, max, { width: safeWidth, height: safeHeight });
  return indices.reduce((area, face) => area + dimensions[face - 1].width * dimensions[face - 1].height, 0);
};

export function getInstallationFaceIndices(item: InstallationFacesSource, billboard?: PhysicalFacesSource | null, taskType?: string | null): number[] {
  const max = getAvailableFacesCount(billboard ?? item.billboard);
  const selected = normalizeSelectedFaces(item.selected_faces, max);
  if (selected.length) return selected;
  if (resolveInstallationFacesCount(item, billboard ?? item.billboard, taskType) === 1 && item.reinstalled_faces === 'face_b' && max > 1) return [2];
  return Array.from({ length: resolveInstallationFacesCount(item, billboard ?? item.billboard, taskType) }, (_, i) => i + 1);
}
