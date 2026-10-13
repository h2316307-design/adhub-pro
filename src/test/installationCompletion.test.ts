import { describe, expect, it } from 'vitest';
import { installationCompletionStatus } from '@/lib/installationCompletion';

describe('installation completion marker', () => {
  it('retains a saved completed parent when item details are not loaded', () => {
    expect(installationCompletionStatus('completed', 0, 0)).toBe('completed');
    expect(installationCompletionStatus('pending', 0, 0, 'completed')).toBe('completed');
  });
  it('recognizes completed items despite a stale composite status', () => {
    expect(installationCompletionStatus('pending', 12, 12)).toBe('completed');
    expect(installationCompletionStatus('pending', 12, 4)).toBe('in_progress');
    expect(installationCompletionStatus('pending', 0, 0)).toBe('pending');
  });
  it('does not revive cancelled tasks', () => {
    expect(installationCompletionStatus('cancelled', 12, 12)).toBe('cancelled');
  });
});
