import { describe, expect, it } from 'vitest';
import { resolveInstallationPhotos } from '@/lib/installationPhotos';

describe('actual operation installation photos', () => {
  it('loads generic and back-only photos without requiring a front photo', () => {
    const rows = resolveInstallationPhotos([
      { id: 'front', installed_image_url: 'https://drive.google.com/uc?id=front' },
      { id: 'back', installed_image_face_b_url: '/back.jpg' },
    ]);
    expect(rows[0].installed_image_face_a_url).toBe('https://lh3.googleusercontent.com/d/front');
    expect(rows[1].installed_image_face_b_url).toBe('/back.jpg');
  });
  it('reads history only for the same task item, despite the same billboard appearing in another operation', () => {
    const rows = resolveInstallationPhotos([{ id: '1293-operation-one', billboard_id: 4 }, { id: '1293-operation-two', billboard_id: 4 }], [
      { task_item_id: '1293-operation-one', reinstall_number: 1, installed_image_face_a_url: '/first.jpg' },
      { task_item_id: '1293-operation-two', reinstall_number: 1, installed_image_face_a_url: '/second.jpg' },
      { task_item_id: 'unrelated', installed_image_face_a_url: '/wrong.jpg' },
    ]);
    expect(rows.map(row => row.installed_image_face_a_url)).toEqual(['/first.jpg', '/second.jpg']);
  });
  it('preserves the current photo and uses the latest archive only for a missing face', () => {
    const [row] = resolveInstallationPhotos([{ id: 'item', installed_image_face_a_url: '/current.jpg' }], [
      { task_item_id: 'item', reinstall_number: 1, installed_image_face_a_url: '/old.jpg', installed_image_face_b_url: '/back-old.jpg' },
      { task_item_id: 'item', reinstall_number: 2, installed_image_face_b_url: '/back-new.jpg' },
    ]);
    expect(row.installed_image_face_a_url).toBe('/current.jpg');
    expect(row.installed_image_face_b_url).toBe('/back-new.jpg');
  });
});
