import { getAvailableFacesCount, getInstallationFaceIndices } from './installationFaces';
/** Completion applies only to the faces selected in that execution, never the whole billboard. */
export function executedInstallationFaces(item: any, board: any): number[] {
  if (item.status === 'cancelled') return [];
  const explicit = Array.isArray(item.selected_faces) && item.selected_faces.length > 0;
  const photoFace = !explicit && Number(item.faces_to_install) === 1 && !['face_a','face_b'].includes(item.reinstalled_faces)
    && (!!item.installed_image_face_a_url !== !!item.installed_image_face_b_url)
    ? (item.installed_image_face_b_url ? 2 : 1) : null;
  const selected = photoFace ? [photoFace] : getInstallationFaceIndices(item, board);
  if (item.status === 'completed' || item.completed_at || item.installation_date) return selected;
  return selected.filter(face => face === 1 ? !!item.installed_image_face_a_url : face === 2 ? !!item.installed_image_face_b_url : false);
}
export function splitCampaignFaces(board: any, history: any[], selection?: number[]) {
  const max = getAvailableFacesCount(board);
  const requested = selection || Array.from({ length: max }, (_, i) => i + 1);
  const done = new Set(history.flatMap(item => executedInstallationFaces(item, board)));
  const faces = [...new Set(requested)].filter(face => Number.isInteger(face) && face > 0 && face <= max);
  return { first: faces.filter(face => !done.has(face)), repeat: faces.filter(face => done.has(face)), done: [...done].sort() };
}

export function hasAmbiguousInstalledFace(item: any, board: any): boolean {
  return getAvailableFacesCount(board) > 1 && Number(item.faces_to_install) === 1
    && (item.status === 'completed' || !!item.completed_at || !!item.installation_date)
    && (!Array.isArray(item.selected_faces) || !item.selected_faces.length) && !['face_a','face_b'].includes(item.reinstalled_faces)
    && (!!item.installed_image_face_a_url === !!item.installed_image_face_b_url);
}
