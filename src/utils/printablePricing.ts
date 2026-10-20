/** Keep only rows and periods with a positive price for the selected category. */
export function printablePricing<T, Row = string>(sizes: Row[], periods: T[], price: (size: Row, period: T) => number | null) {
  const rows = sizes.filter(size => periods.some(period => (price(size, period) ?? 0) > 0));
  const columns = periods.filter(period => rows.some(size => (price(size, period) ?? 0) > 0));
  return { rows, columns };
}
