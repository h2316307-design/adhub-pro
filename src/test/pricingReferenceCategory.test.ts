import { describe, expect, it } from 'vitest';
import { computeRelativePricingPlan } from '@/utils/pricingRelativeCalculator';

describe('arbitrary category and level reference pricing', () => {
  const records = [
    { size: '8x3', billboard_level: 'A', customer_category: 'مسوق', one_month: 1000, duration_prices: { custom_45: 1500 } },
    { size: '12x4', billboard_level: 'A', customer_category: 'مسوق', one_month: 2000, duration_prices: { custom_45: 3000 } },
    { size: '8x3', billboard_level: 'B', customer_category: 'عادي', one_month: 800 },
    { size: '6x3', billboard_level: 'B', customer_category: 'عادي', one_month: 900 },
  ];
  const params = { customer: 'عادي', referenceCategory: 'مسوق', targetLevel: 'B', referenceLevel: 'A', records, periods: [{ key: 'month1', label: 'شهر', dbColumn: 'one_month' }], scope: 'level_all', month: 'month1', mode: 'discount' as const, rate: 10, valid: true };
  it('builds all sizes of the target level from the selected source category and level', () => {
    const result = computeRelativePricingPlan(params);
    expect(result.changes.find(row => row.size === '8x3')?.after).toBe(900);
    expect(result.changes.find(row => row.size === '12x4')?.after).toBe(1800);
    expect(result.skipped).toBe(1);
    expect(result.changes.every(row => row.level === 'B' && row.customer === 'عادي')).toBe(true);
    expect(records[2].one_month).toBe(800);
  });
  it('increases instead of discounts and supports the same level', () => {
    const result = computeRelativePricingPlan({ ...params, targetLevel: 'A', referenceLevel: '__SAME__', mode: 'increase', rate: 20 });
    expect(result.changes.find(row => row.size === '8x3')?.after).toBe(1200);
  });
  it('distinguishes one-size scope from the complete level even when launched from a size', () => {
    expect(computeRelativePricingPlan({ ...params, scope: 'single_current', targetSize: '8x3' }).plan).toHaveLength(1);
    expect(computeRelativePricingPlan({ ...params, targetSize: '8x3' }).plan).toHaveLength(3);
  });
});
