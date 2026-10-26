/**
 * تجميع أوامر الإزالة في «عمليات»: عملية واحدة لكل عقد، تضم كل فرقه ولوحاته
 * (نفس فكرة أوامر العمل في التركيب: بطاقة واحدة لكل عملية).
 */
import type { RemovalTask, RemovalTaskItem } from '@/hooks/useRemovalData';

export type RemovalStatus = 'pending' | 'in_progress' | 'completed';

export interface RemovalTeamPart { taskId: string; teamId: string; teamName: string; phone?: string | null; items: RemovalTaskItem[]; done: number }

export interface RemovalOperation {
  key: string;
  contractId: number;
  amendmentNumber?: number | null;
  customerName: string;
  adType: string;
  contractStart: string | null;
  contractEnd: string | null;
  tasks: RemovalTask[];
  parts: RemovalTeamPart[];
  items: RemovalTaskItem[];
  boards: number;
  boardsDone: number;
  status: RemovalStatus;
  teams: string[];
  createdAt: string;
  lastRemoval: string | null;
  cover: string | null;
  /** تصاميم اللوحات الموثّقة لهذا العقد فقط (بلا تصميم العقد العام) */
  designs: string[];
}

export function buildRemovalOperations(
  tasks: RemovalTask[], itemsByTask: Record<string, RemovalTaskItem[]>,
  contractByNumber: Record<string | number, any>, teamById: Record<string, any>, billboardById: Record<string | number, any>,
): RemovalOperation[] {
  const byContract = new Map<string, RemovalTask[]>();
  tasks.filter(t => t.status !== 'cancelled').forEach(t => {
    const cn = Number(t.contract_id) || 0;
    const key = `${cn}:${t.amendment_number ?? 'original'}`;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key)!.push(t);
  });

  const ops: RemovalOperation[] = [];
  byContract.forEach((list, scope) => {
    const contractId = Number(list[0].contract_id) || 0;
    const parts: RemovalTeamPart[] = list.map(t => {
      const items = itemsByTask[t.id] || [];
      const team = teamById[t.team_id] || teamById[String(t.team_id)];
      return { taskId: t.id, teamId: t.team_id, teamName: team?.team_name || 'فرقة غير محددة', phone: team?.phone || team?.phone_number || null, items, done: items.filter(i => i.status === 'completed').length };
    }).filter(p => p.items.length > 0);
    if (!parts.length) return;
    const items = parts.flatMap(p => p.items);
    const done = items.filter(i => i.status === 'completed').length;
    const c = contractByNumber[contractId] || contractByNumber[String(contractId)] || {};
    const firstBb = billboardById[items[0]?.billboard_id] || {};
    const dates = items.map(i => i.removal_date).filter(Boolean).sort() as string[];
    // التصاميم من لوحات الأمر نفسها فقط (مطابَقة للعقد واللوحة)؛ بلا تصميم لا تُعرض صورة تصميم
    const designs = [...new Set(items.flatMap(i => [i.design_face_a, i.design_face_b]).filter(Boolean) as string[])];
    const cover = designs[0] || null;
    ops.push({
      key: list[0].amendment_number ? `c:${scope}` : `c:${contractId}`,
      amendmentNumber: list[0].amendment_number,
      contractId,
      customerName: c['Customer Name'] || firstBb.Customer_Name || 'زبون غير محدد',
      adType: c['Ad Type'] || firstBb.Ad_Type || '',
      contractStart: c['Contract Date'] || null,
      contractEnd: c['End Date'] || null,
      tasks: list,
      parts,
      items,
      boards: items.length,
      boardsDone: done,
      status: done === items.length ? 'completed' : done > 0 ? 'in_progress' : 'pending',
      teams: [...new Set(parts.map(p => p.teamName))],
      createdAt: list.map(t => t.created_at).sort()[0],
      lastRemoval: dates[dates.length - 1] || null,
      cover,
      designs,
    });
  });
  return ops.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.contractId - a.contractId);
}

/** عناصر الطباعة للوحات المعلقة في عمليات محددة */
export function removalPrintItems(ops: RemovalOperation[], billboardById: Record<string | number, any>, onlyTeamId?: string) {
  return ops.flatMap(op => op.parts.filter(p => !onlyTeamId || p.teamId === onlyTeamId).flatMap(p => p.items
    .filter(i => i.status !== 'completed')
    .map(i => ({
      id: i.id,
      billboard_id: Number(i.billboard_id),
      design_face_a: i.design_face_a || null,
      design_face_b: i.design_face_b || null,
      installed_image_face_a_url: i.installed_image_face_a_url || i.installed_image_url || null,
      installed_image_face_b_url: i.installed_image_face_b_url || null,
      team_id: p.teamId,
      contract_number: op.contractId,
      ad_type: op.adType || billboardById[i.billboard_id]?.Ad_Type || null,
    }))));
}

/** رسالة واتساب للفرقة باللوحات المعلقة */
export function removalWhatsAppMessage(op: RemovalOperation, part: RemovalTeamPart, billboardById: Record<string | number, any>) {
  const pending = part.items.filter(i => i.status !== 'completed');
  const list = (pending.length ? pending : part.items).map(i => {
    const bb = billboardById[i.billboard_id] || {};
    const gps = bb.GPS_Coordinates ? `\n  إحداثيات: ${bb.GPS_Coordinates}` : '';
    return `• ${bb.Billboard_Name || `لوحة #${i.billboard_id}`} - ${bb.City || ''} ${bb.District || ''}${gps}`;
  }).join('\n');
  return `أمر إزالة\n\nالزبون: ${op.customerName}\nنوع الإعلان: ${op.adType}\nعقد رقم: #${op.contractId}\nعدد اللوحات: ${pending.length || part.items.length}\nالفرقة: ${part.teamName}\n\nاللوحات المطلوب إزالتها:\n${list}`;
}
