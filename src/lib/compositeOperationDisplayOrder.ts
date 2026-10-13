export const OPERATION_ORDER_PREFIX = 'composite_operation_order:';

/** Presentation order only: stable operation keys and financial task data never change. */
export function applyOperationDisplayOrder<T extends { key: string; label: string; sequence?: number | null; isReinstall?: boolean }>(operations: T[], order: string[] = []): T[] {
  // Input is newest first. Number oldest-to-newest and keep operation 1 at the bottom.
  const chronological = [...operations].reverse().sort((a, b) => {
    if (a.isReinstall === false && b.isReinstall === true) return -1;
    if (a.isReinstall === true && b.isReinstall === false) return 1;
    return a.sequence != null && b.sequence != null ? a.sequence - b.sequence : 0;
  });
  const ranks = new Map(order.map((key, index) => [key, index]));
  const numbered = order.length ? chronological.sort((a, b) => (ranks.get(a.key) ?? order.length) - (ranks.get(b.key) ?? order.length)) : chronological;
  const initial = numbered.filter(operation => operation.isReinstall === false);
  const later = numbered.filter(operation => operation.isReinstall !== false);
  return [
    ...initial.map(operation => ({ ...operation, label: 'تركيب جديد' })),
    ...later.map((operation, index) => ({ ...operation, label: `تركيب ${index + 1}` })),
  ].reverse();
}
