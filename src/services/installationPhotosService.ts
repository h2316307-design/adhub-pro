import { supabase } from '@/integrations/supabase/client';
import { resolveInstallationPhotos } from '@/lib/installationPhotos';

export async function loadInstallationPhotos(items: any[]) {
  const ids = [...new Set(items.map(item => item.id).filter(Boolean))] as string[];
  const history: any[] = [];
  for (let start = 0; start < ids.length; start += 35) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('installation_photo_history')
        .select('id, task_item_id, installed_image_face_a_url, installed_image_face_b_url, reinstall_number')
        .in('task_item_id', ids.slice(start, start + 35)).order('id').range(offset, offset + 499);
      if (error) throw error;
      history.push(...(data || []));
      if (!data || data.length < 500) break;
    }
  }
  return resolveInstallationPhotos(items, history);
}
