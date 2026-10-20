import { describe, expect, it } from 'vitest';
import { applyPricingRules, defaultPricingRules } from '../utils/pricingRules';

describe('pricing rules', () => {
  it('derives levels and linked sizes from the same base in each customer category', () => {
    const rows = ['شركات', 'عادي'].flatMap(customer_category => ['large', 'small'].flatMap(size => ['A', 'B'].map(billboard_level => ({ size, billboard_level, customer_category, one_month: customer_category === 'شركات' ? 100 : 200, duration_prices: { custom: 300 } }))));
    const result = applyPricingRules(rows, { ...defaultPricingRules, enabled: true, rates: { B: -20 }, sizeAliases: { small: 'large' } }, ['one_month', 'custom']);
    expect(result.find(row => row.size === 'small' && row.billboard_level === 'B' && row.customer_category === 'عادي')).toMatchObject({ one_month: 160, duration_prices: { custom: 240 } });
    expect(rows[0].duration_prices.custom).toBe(300);
  });
  it('preserves missing source prices and supports increases and zero discounts', () => {
    const rows = [{ size: 'large', billboard_level: 'A', customer_category: 'شركات', one_month: 100 }, { size: 'large', billboard_level: 'B', customer_category: 'شركات', one_month: 50 }, { size: 'missing', billboard_level: 'B', customer_category: 'شركات', one_month: 40 }];
    expect(applyPricingRules(rows, { ...defaultPricingRules, enabled: true, rates: { B: 10 } }, ['one_month']).map(row => row.one_month)).toEqual([100, 110, 40]);
    expect(applyPricingRules(rows, { ...defaultPricingRules, enabled: true, rates: { B: -100 } }, ['one_month'])[1].one_month).toBe(0);
  });
});
