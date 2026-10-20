import { readDurationPrice } from './pricingDuration';

/** Compare matching sizes and durations within the printed customer category. */
export function pricingLevelPercentages(
  rows: { size: string; billboard_level: string; customer_category: string; [key: string]: any }[],
  category: string, baseLevel: string, levels: string[], columns: string[],
): Record<string, number[]> {
  return Object.fromEntries(levels.filter(level => level !== baseLevel).map(level => {
    const rates: number[] = [];
    for (const row of rows.filter(row => row.customer_category === category && row.billboard_level === level)) {
      const base = rows.find(other => other.customer_category === category && other.billboard_level === baseLevel && other.size.trim() === row.size.trim());
      for (const column of columns) {
        const price = readDurationPrice(row, column);
        const reference = readDurationPrice(base, column);
        if (price != null && price > 0 && reference != null && reference > 0) rates.push(Math.round((price / reference - 1) * 10000) / 100);
      }
    }
    return [level, [...new Set(rates)].sort((a, b) => a - b)];
  }));
}
