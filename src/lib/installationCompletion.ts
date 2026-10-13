export function installationCompletionStatus(status: string, total: number, done: number, installationStatus?: string | null) {
  if (status === 'cancelled' || installationStatus === 'cancelled') return 'cancelled';
  if (status === 'completed' || installationStatus === 'completed' || (total > 0 && done >= total)) return 'completed';
  return done > 0 || status === 'in_progress' || installationStatus === 'in_progress' ? 'in_progress' : 'pending';
}
