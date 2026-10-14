import { describe, expect, it } from 'vitest';
import { installationContractIsActive, blockedInstallationBillboards } from '@/lib/installationContractSelection';
import { getTaskContractGroupKey } from '@/lib/compositeTaskOperation';

describe('safe installation contract selection', () => {
  const date = '2026-10-13';
  const active = { Contract_Number: 1293, 'Contract Date': '2026-10-01', 'End Date': '2026-12-31', billboard_ids: '1,2' };
  it('identifies active contracts and excludes historical, future, released, and cancelled ones', () => {
    expect(installationContractIsActive(active, date)).toBe(true);
    expect(installationContractIsActive({ ...active, 'End Date': '2026-10-12' }, date)).toBe(false);
    expect(installationContractIsActive({ ...active, 'Contract Date': '2026-11-01' }, date)).toBe(false);
    expect(installationContractIsActive({ ...active, billboards_released: true }, date)).toBe(false);
    expect(installationContractIsActive({ ...active, 'Renewal Status': 'ملغي' }, date)).toBe(false);
    expect(installationContractIsActive({}, date)).toBe(false);
  });
  it('blocks historical boards currently in another active contract', () => {
    const blocked = blockedInstallationBillboards([active, { ...active, Contract_Number: 1294, billboard_ids: '3' }], [1200], date);
    expect(blocked.get(1)).toBe(1293);
    expect(blocked.get(3)).toBe(1294);
  });
  it('allows boards in explicitly selected active contracts and does not block an expired rental', () => {
    const blocked = blockedInstallationBillboards([active, { ...active, Contract_Number: 1200, 'End Date': '2026-09-01', billboard_ids: '3' }], [1293], date);
    expect(blocked.size).toBe(0);
  });
  it('keeps a multi-contract mission independent from each single contract and groups its teams together', () => {
    const teamOne = { id: 'one', contract_id: 1293, contract_ids: [1293, 1294], task_type: 'reinstallation', reinstallationNumber: 5 };
    const teamTwo = { ...teamOne, id: 'two', contract_id: 1294 };
    expect(getTaskContractGroupKey(teamOne)).toBe(getTaskContractGroupKey(teamTwo));
    expect(getTaskContractGroupKey(teamOne)).not.toBe(getTaskContractGroupKey({ contract_id: 1293 }));
    expect(getTaskContractGroupKey(teamOne)).not.toBe(getTaskContractGroupKey({ ...teamOne, reinstallationNumber: 6 }));
  });
});
