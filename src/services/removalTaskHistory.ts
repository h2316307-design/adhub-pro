type Task = { amendment_number?: number | null; id: string; contract_id?: number | string; contract_ids?: (number | string)[] | null; status: string };
type Item = { task_id: string; billboard_id: number | string; status: string };

/** Preserve completion history, but suppress duplicate pending work for the same contract. */
export function excludePreviouslyCompletedRemovals<T extends Item>(items: T[], tasks: Task[]): T[] {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const keys = (item: Item) => {
    const task = byId.get(item.task_id);
    const contracts = task?.contract_ids?.length ? task.contract_ids : [task?.contract_id];
    return contracts.filter(id => id != null).map(id => `${Number(id)}:${task?.amendment_number ?? "original"}:${Number(item.billboard_id)}`);
  };
  const completed = new Set(items.filter(item => item.status === 'completed' || byId.get(item.task_id)?.status === 'completed').flatMap(keys));
  return items.filter(item => item.status === 'completed' ||
    (byId.get(item.task_id)?.status !== 'completed' && !keys(item).some(key => completed.has(key))));
}
