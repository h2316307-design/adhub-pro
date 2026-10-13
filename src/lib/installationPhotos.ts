import { normalizeGoogleImageUrl } from '@/utils/imageUtils';

export function resolveInstallationPhotos(items: any[], history: any[] = []) {
  const byItem = new Map<string, any[]>();
  for (const photo of history) {
    const rows = byItem.get(String(photo.task_item_id)) || [];
    rows.push(photo); byItem.set(String(photo.task_item_id), rows);
  }
  return items.map(item => {
    const archived = [...(byItem.get(String(item.id)) || [])].sort((a, b) => Number(b.reinstall_number || 1) - Number(a.reinstall_number || 1));
    const faceA = item.installed_image_face_a_url || item.installed_image_url || archived.find(row => row.installed_image_face_a_url)?.installed_image_face_a_url;
    const faceB = item.installed_image_face_b_url || archived.find(row => row.installed_image_face_b_url)?.installed_image_face_b_url;
    return { ...item, installed_image_face_a_url: normalizeGoogleImageUrl(faceA) || null, installed_image_face_b_url: normalizeGoogleImageUrl(faceB) || null };
  });
}
