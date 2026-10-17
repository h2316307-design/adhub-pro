import { describe, expect, it } from 'vitest';
import { calculateInstallationArea, resolveInstallationFacesCount } from '@/lib/installationFaces';
import { applyBulkPrice, changeCostLineFaces, computeOperation, lineArea } from '@/lib/compositeCosts';
import { validateFaceDimensions } from '@/lib/billboardFaces';

describe('changing faces with unequal face prices', () => {
  it('scales the customer price by the selected faces prices, not by face count', () => {
    // وجه أمامي 100 وخلفي 50 (سعر الجدول = مجموع الأوجه المختارة)
    const line = {
      faces: 1, selectedFaces: [1], faceArea: 10, faceAreas: [20, 10], faceInstallPrices: [100, 50],
      maxFaces: 2, sizeInstallPrice: 100, tableFullPrice: 150, customerPerMeter: null,
      customer: 80, company: 60, companyPerMeter: null,
    } as any;
    const next = changeCostLineFaces(line, [1, 2]);
    expect(next.sizeInstallPrice).toBe(150);
    // 80 × (150 / 100) = 120، لا 80 × 2 / 1 = 160
    expect(next.customer).toBe(120);
    expect(next.company).toBe(90);
  });
});

describe('different sized physical faces', () => {
  const billboard = { Faces_Count: 4, face_dimensions: [null, { width: 6, height: 2 }, null, { width: 2, height: 2 }] };
  it('sums the selected physical faces instead of multiplying the base size', () => {
    const item = { faces_to_install: 4, selected_faces: [2, 4] };
    expect(resolveInstallationFacesCount(item, billboard)).toBe(2);
    expect(calculateInstallationArea(8, 3, item, billboard)).toBe(16);
    expect(calculateInstallationArea(8, 3, { faces_to_install: 4 }, billboard)).toBe(64);
  });
  it('preserves a legacy back-face selection and ignores invalid indices', () => {
    expect(calculateInstallationArea(8, 3, { reinstalled_faces: 'face_b' }, billboard, 'reinstallation')).toBe(12);
    expect(resolveInstallationFacesCount({ selected_faces: [2, 2, 0, 5] }, billboard)).toBe(1);
  });
  it('rejects incomplete or invalid custom dimensions', () => {
    expect(() => validateFaceDimensions({ Faces_Count: 1, face_dimensions: [{ width: 4 }] })).toThrow();
    expect(() => validateFaceDimensions({ Faces_Count: 1, face_dimensions: [{ width: -4, height: 2 }] })).toThrow();
    expect(() => validateFaceDimensions({ Faces_Count: 1, face_dimensions: [{}] })).not.toThrow();
  });
  const line = {
    id: 'item', taskId: 'task', billboardId: 1, faceArea: 24, faceAreas: [24, 12, 24, 4],
    faces: 4, maxFaces: 4, selectedFaces: [1, 2, 3, 4], faceInstallPrices: [120, 60, 120, 20],
    sizeInstallPrice: 320, tableFullPrice: 240, customerPerMeter: 10, customer: 640, company: 320,
    customerExtra: 0, companyExtra: 0, inPrint: true, hasCutout: false, cutoutCount: 1,
    cutoutCustomerUnit: 0, cutoutCompanyUnit: 0,
  };
  it('immediately recalculates installation and print from the chosen faces', () => {
    const changed = changeCostLineFaces(line, [2, 4]);
    expect(changed.faces).toBe(2);
    expect(lineArea(changed)).toBe(16);
    expect(changed.company).toBe(80);
    expect(changed.customer).toBe(160);
    const totals = computeOperation({ type: 'reinstallation', contractIncludesInstallation: false, contractIncludesPrint: false,
      lines: [changed], printEnabled: true, printCustomerPerMeter: 5, printCompanyPerMeter: 2, discount: 0 });
    expect(totals.print.area).toBe(16);
    expect(totals.customerTotal).toBe(240);
    expect(totals.companyTotal).toBe(112);
    expect(changeCostLineFaces(changed, []).selectedFaces).toEqual([2, 4]);
  });
  it('can replace a selected face without changing the face count', () => {
    const front = changeCostLineFaces(line, [1]);
    const back = changeCostLineFaces(front, [2]);
    expect(back.customer).toBe(120);
    expect(back.company).toBe(60);
  });
  it('retains company pricing per metre when face sizes change', () => {
    const [priced] = applyBulkPrice([line], new Set(['item']), 'company', 'meter', 3);
    const changed = changeCostLineFaces({ ...line, ...priced }, [2]);
    expect(changed.company).toBe(36);
    expect(changed.companyPerMeter).toBe(3);
  });
  it('uses each selected face price for table-priced customers', () => {
    const changed = changeCostLineFaces({ ...line, customer: 320, customerPerMeter: null }, [2, 4]);
    expect(changed.customer).toBe(80);
  });
});
