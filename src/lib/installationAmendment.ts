type TaskIdentity = { contract_id: number; team_id?: string | null; task_type?: string | null; reinstallation_number?: number | null; amendment_number?: number | null };
export const installationGroupKey = (task: TaskIdentity) => `${task.contract_id}-${task.task_type || 'installation'}-${task.reinstallation_number ?? 'new'}-amendment-${task.amendment_number ?? 'original'}`;
export const installationTeamGroupKey = (task: TaskIdentity) => `${task.team_id ?? 'unassigned'}-${installationGroupKey(task)}`;
export const installationAmendmentLabel = (task: TaskIdentity) => task.amendment_number ? `تركيب ملحق رقم ${task.amendment_number} للعقد #${task.contract_id}` : '';
