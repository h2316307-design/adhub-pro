import { expect, it } from 'vitest';
import { sameInstallationOperation } from '../lib/installationTransferIdentity';
const source = { contract_id: 1209, contract_ids: [1209, 1256], task_type: 'reinstallation', reinstallation_number: 2 };
it('matches all contracts regardless of legacy primary contract or array order', () => {
  expect(sameInstallationOperation(source, { ...source, contract_id: 1256, contract_ids: [1256, 1209] })).toBe(true);
});
it('rejects other operations and single-contract tasks', () => {
  expect(sameInstallationOperation(source, { ...source, task_type: 'installation' })).toBe(false);
  expect(sameInstallationOperation(source, { ...source, reinstallation_number: 1 })).toBe(false);
  expect(sameInstallationOperation(source, { ...source, contract_ids: [1209] })).toBe(false);
});
import { sharesInstallationOperation } from '../lib/installationTransferIdentity';
it('excludes boards across team contract subsets of the same customer and operation', () => {
  expect(sharesInstallationOperation(source, { ...source, contract_ids: [1256] }, [1209, 1256, 1302])).toBe(true);
  expect(sharesInstallationOperation(source, { ...source, contract_ids: [1302] }, [1209, 1256, 1302])).toBe(true);
  expect(sharesInstallationOperation(source, { ...source, contract_ids: [999] }, [1209, 1256, 1302])).toBe(false);
  expect(sharesInstallationOperation(source, { ...source, reinstallation_number: 3 }, [1209, 1256])).toBe(false);
});
