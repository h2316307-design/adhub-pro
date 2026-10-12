import { describe, expect, it } from 'vitest';
import { removalPrintImages, verifiedRemovalDesignSource, matchesRemovalDesignBillboard } from '../services/removalPrintImages';
import { createPrintGeneratorFixture } from './helpers/printGeneratorFixture';

describe('removal print image selection', () => {
  it('uses the exact contract design when the matching installation has no design', () => {
    const source = verifiedRemovalDesignSource({ design_face_a: null, design_face_b: null }, { design_face_a: '/old.jpg' });
    expect(removalPrintImages(source, {}).faceA).toBe('/old.jpg');
    expect(verifiedRemovalDesignSource(undefined, undefined)).toEqual({ design_face_a: null, design_face_b: null });
  });
  it('matches ZL0900 by its saved code without borrowing another billboard design', () => {
    const billboard = { ID: 900, Billboard_Name: 'ZL0900' };
    expect(matchesRemovalDesignBillboard({ billboardCode: 'ZL0900' }, billboard)).toBe(true);
    expect(matchesRemovalDesignBillboard({ billboardId: 'ZL0900' }, billboard)).toBe(true);
    expect(matchesRemovalDesignBillboard({ billboardId: 901, billboardCode: 'ZL0900' }, billboard)).toBe(false);
    expect(matchesRemovalDesignBillboard({ designFaceA: '/general.jpg' }, billboard)).toBe(false);

    // TR-JZ0952: An unrelated design whose primary key or object id happens to be 952 must NOT match billboard 952
    const billboard952 = { ID: 952, Billboard_Name: 'TR-JZ0952' };
    expect(matchesRemovalDesignBillboard({ id: 952, designFaceA: '/unrelated.jpg' }, billboard952)).toBe(false);
    expect(matchesRemovalDesignBillboard({ ID: 952, billboardCode: 'TR-JZ0317', designFaceA: '/unrelated.jpg' }, billboard952)).toBe(false);

    // Disabled designs must NEVER match
    expect(matchesRemovalDesignBillboard({ billboardId: 952, enabled: false, designFaceA: '/disabled.jpg' }, billboard952)).toBe(false);
    expect(matchesRemovalDesignBillboard({ billboardCode: 'TR-JZ0952', active: false, designFaceA: '/disabled.jpg' }, billboard952)).toBe(false);
    expect(matchesRemovalDesignBillboard({ billboardId: 'TR-JZ0952', status: 'disabled', designFaceA: '/disabled.jpg' }, billboard952)).toBe(false);

    // Grouped billboardIds array matching
    expect(matchesRemovalDesignBillboard({ billboardIds: ['317', '400'], designFaceA: '/other.jpg' }, billboard952)).toBe(false);
    expect(matchesRemovalDesignBillboard({ billboardIds: ['952', '317'], designFaceA: '/valid.jpg' }, billboard952)).toBe(true);

    const source = verifiedRemovalDesignSource({}, { design_face_a: '/eid-design.jpg' });
    expect(removalPrintImages(source, { Image_URL: '/site.jpg' })).toEqual({ faceA: '/eid-design.jpg', faceB: null, main: '/site.jpg' });
  });
  it('rejects historical installation photos even through a different Drive URL', () => {
    const images = removalPrintImages({ design_face_a: 'https://lh3.googleusercontent.com/d/abc=s2048' }, {}, true, ['https://drive.google.com/uc?id=abc']);
    expect(images.faceA).toBeNull();
  });
  it('prints without an image when only billboard and installation photos exist', () => {
    expect(removalPrintImages({ installed_image_face_a_url: '/installed.jpg' }, { Image_URL: '/site.jpg' }).faceA).toBe(null);
  });
  it('uses the task design and respects a single face', () => {
    expect(removalPrintImages({ design_face_a: ' /old-contract.jpg ', design_face_b: '/back.jpg' }, { Image_URL: '/site.jpg' }, false)).toEqual({ faceA: '/old-contract.jpg', faceB: null, main: '/site.jpg' });
  });
  it('rejects photos incorrectly saved in design fields', () => {
    expect(removalPrintImages({ design_face_a: '/site.jpg', design_face_b: '/installed.jpg', installed_image_face_b_url: '/installed.jpg' }, { Image_URL: '/site.jpg' }).faceA).toBe(null);
  });
  it('uses the back design when the front design is unavailable', () => {
    expect(removalPrintImages({ design_face_b: '/back.jpg' }, {}).faceB).toBe('/back.jpg');
  });
  it('keeps site photos separate and excludes unrelated designs from both real print generators', async () => {
    const fixture = createPrintGeneratorFixture({ contextType: 'removal',
      filteredItems: [{ id: 'removal', billboard_id: 1, installed_image_face_a_url: '/installed-only.jpg' }],
      dynamicDesignsMap: { 1: { design_face_a: '/other-contract.jpg' } },
      resolveBillboardDesigns: async () => { throw new Error('Must not fetch a different campaign'); },
    });
    for (const html of [await fixture.generatePrintHTML(), await fixture.generateTablePrintHTML()]) {
      expect(html).toContain('/original.png');
      expect(html).not.toContain('/installed-only.jpg');
      expect(html).not.toContain('/other-contract.jpg');
    }
  });
  it('prints the removal contract design in both layouts', async () => {
    const fixture = createPrintGeneratorFixture({ contextType: 'removal' });
    for (const html of [await fixture.generatePrintHTML(), await fixture.generateTablePrintHTML()]) {
      expect(html).toContain('/design-a.png');
      expect(html).toContain('/original.png');
      expect(html).not.toContain('/photo-a.png');
    }
  });
});
