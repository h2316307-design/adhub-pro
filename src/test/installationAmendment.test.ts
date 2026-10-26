import { describe, it, expect } from 'vitest';
import { installationGroupKey, installationTeamGroupKey, installationAmendmentLabel } from '@/lib/installationAmendment';
const task = { contract_id: 1294, team_id: 'team', task_type: 'installation' };
describe('amendment installation grouping', () => {
  it('keeps original work, different amendments, and reinstallation cycles separate', () => {
    const scopes = [task, { ...task, amendment_number: 1 }, { ...task, amendment_number: 2 }, { ...task, task_type: 'reinstallation', reinstallation_number: 1 }];
    expect(new Set(scopes.map(installationGroupKey)).size).toBe(4);
    expect(new Set(scopes.map(installationTeamGroupKey)).size).toBe(4);
  });
  it('groups one amendment across teams visually while keeping team tasks separate', () => {
    const a = { ...task, amendment_number: 1 };
    const b = { ...a, team_id: 'other' };
    expect(installationGroupKey(a)).toBe(installationGroupKey(b));
    expect(installationTeamGroupKey(a)).not.toBe(installationTeamGroupKey(b));
    expect(installationAmendmentLabel(a)).toBe('تركيب ملحق رقم 1 للعقد #1294');
    expect(installationAmendmentLabel(task)).toBe('');
  });
});
