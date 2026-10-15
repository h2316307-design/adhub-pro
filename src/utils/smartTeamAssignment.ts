import { supabase } from '@/integrations/supabase/client';
import { installationTeamCoversBillboard, matchesFriendCompany } from '@/utils/teamAssignment';

/**
 * اختيار فرقة التركيب للوحة بترتيب واضح:
 * 1) فرقة الشركة الصديقة المالكة للوحة.
 * 2) الفرقة التي ركّبت اللوحة آخر مرة (إن كانت ما زالت تغطيها).
 * 3) الفرقة الأكثر تخصصاً في مدينة اللوحة (أقل عدد مدن)، ثم الأولوية.
 * بهذا لا تُسحب لوحات منطقة (مثل الغربية) لفرقة عامة لمجرد أن أولويتها أعلى.
 */
export function pickInstallationTeam(teams: any[], board: { Size?: string | null; City?: string | null; friend_company_id?: string | null }, previousTeamId?: string | null) {
  const eligible = (teams || []).filter(t => installationTeamCoversBillboard(t, board.Size, board.City, board.friend_company_id));
  if (!eligible.length) return null;
  const byPriority = (a: any, b: any) => (Number(b.priority) || 0) - (Number(a.priority) || 0);
  if (board.friend_company_id) {
    const owners = eligible.filter(t => matchesFriendCompany(t, board.friend_company_id)).sort(byPriority);
    if (owners.length) return owners[0];
  }
  if (previousTeamId) {
    const prev = eligible.find(t => t.id === previousTeamId);
    if (prev) return prev;
  }
  const cityCount = (t: any) => (Array.isArray(t.cities) && t.cities.length ? t.cities.length : 999);
  return [...eligible].sort((a, b) => cityCount(a) - cityCount(b) || byPriority(a, b))[0];
}

/** آخر فرقة ركّبت كل لوحة */
export async function loadPreviousTeams(billboardIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const ids = [...new Set(billboardIds.map(Number).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data: items, error } = await supabase.from('installation_task_items')
      .select('billboard_id, task_id, created_at').in('billboard_id', ids.slice(i, i + 100)).order('created_at', { ascending: false });
    if (error) throw error;
    const taskIds = [...new Set((items || []).map((r: any) => r.task_id))];
    const teamOf = new Map<string, string>();
    for (let j = 0; j < taskIds.length; j += 100) {
      const { data: tasks, error: tErr } = await supabase.from('installation_tasks').select('id, team_id').in('id', taskIds.slice(j, j + 100));
      if (tErr) throw tErr;
      (tasks || []).forEach((t: any) => { if (t.team_id) teamOf.set(t.id, t.team_id); });
    }
    for (const r of items || []) {
      const team = teamOf.get((r as any).task_id);
      if (team && !result.has(Number((r as any).billboard_id))) result.set(Number((r as any).billboard_id), team);
    }
  }
  return result;
}
