import { parseContractBillboardIds } from './compositeTaskContractIdentity';

export function installationContractIsActive(contract: any, date: string) {
  const start = String(contract['Contract Date'] || '').slice(0, 10);
  const end = String(contract['End Date'] || '').slice(0, 10);
  const cancelled = ['cancelled', 'canceled', 'ملغي', 'ملغى'].includes(String(contract['Renewal Status'] || '').trim().toLowerCase());
  return Boolean(start && end && start <= date && end >= date && contract.billboards_released !== true && !cancelled);
}

export function blockedInstallationBillboards(contracts: any[], selectedContractIds: number[], date: string) {
  const selected = new Set(selectedContractIds.map(Number));
  const blocked = new Map<number, number>();
  for (const contract of contracts) {
    if (selected.has(Number(contract.Contract_Number)) || !installationContractIsActive(contract, date)) continue;
    for (const id of parseContractBillboardIds(contract.billboard_ids)) blocked.set(id, Number(contract.Contract_Number));
  }
  return blocked;
}
