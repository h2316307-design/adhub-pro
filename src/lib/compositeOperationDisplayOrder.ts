export const OPERATION_ORDER_PREFIX = 'composite_operation_order:';

/** Presentation order only: stable operation keys and financial task data never change. */
export function applyOperationDisplayOrder<T extends { key: string; label: string }>(operations: T[], order: string[] = []): T[] {
  if (!order.length) return operations;
  const ranks = new Map(order.map((key, index) => [key, index]));
  return [...operations].sort((a, b) => (ranks.get(a.key) ?? order.length) - (ranks.get(b.key) ?? order.length))
    .map((operation, index) => ({ ...operation, label: `تركيب ${index + 1}` }));
}
