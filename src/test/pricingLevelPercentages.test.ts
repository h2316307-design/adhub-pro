import { expect, it } from 'vitest';
import { pricingLevelPercentages } from '../utils/pricingLevelPercentages';

it('compares matching sizes and durations within the selected category', () => {
  const rows = [
    { size: 'large', billboard_level: 'A', customer_category: 'شركات', one_month: 100, duration_prices: { custom: 200 } },
    { size: 'large', billboard_level: 'B', customer_category: 'شركات', one_month: 80, duration_prices: { custom: 160 } },
    { size: 'large', billboard_level: 'B', customer_category: 'عادي', one_month: 900 },
    { size: 'missing', billboard_level: 'B', customer_category: 'شركات', one_month: 900 },
  ];
  expect(pricingLevelPercentages(rows, 'شركات', 'A', ['A', 'B', 'C'], ['one_month', 'custom'])).toEqual({ B: [-20], C: [] });
});

it('preserves differing percentages instead of claiming one uniform discount', () => {
  const rows = [100, 200].flatMap((price, index) => [
    { size: String(index), billboard_level: 'A', customer_category: 'شركات', one_month: price },
    { size: String(index), billboard_level: 'B', customer_category: 'شركات', one_month: 100 },
  ]);
  expect(pricingLevelPercentages(rows, 'شركات', 'A', ['A', 'B'], ['one_month'])).toEqual({ B: [-50, 0] });
});
