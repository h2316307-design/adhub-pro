/** A transfer stays within the same contract set and installation operation. */
export function sameInstallationOperation(source: any, target: any): boolean {
  const key = (task: any) => [...new Set<number>((task.contract_ids?.length ? task.contract_ids : [task.contract_id]).map(Number))].sort((a, b) => a - b).join(',');
  return key(source) === key(target)
    && (source.task_type || 'installation') === (target.task_type || 'installation')
    && (source.reinstallation_number ?? 0) === (target.reinstallation_number ?? 0);
}

/** Team tasks may contain different subsets of the customer's contracts. */
export function sharesInstallationOperation(source: any, target: any, customerContractIds: number[] = []): boolean {
  if ((source.task_type || 'installation') !== (target.task_type || 'installation')
    || (source.reinstallation_number ?? 0) !== (target.reinstallation_number ?? 0)) return false;
  const scope = new Set(customerContractIds.length ? customerContractIds : (source.contract_ids?.length ? source.contract_ids : [source.contract_id]));
  return (target.contract_ids?.length ? target.contract_ids : [target.contract_id]).some((id: number) => scope.has(Number(id)));
}
