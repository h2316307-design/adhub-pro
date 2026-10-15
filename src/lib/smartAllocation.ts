/** توزيع مبلغ دفعة على المستحقات — دوال صافية قابلة للاختبار */
export interface AllocTarget { key: string; remaining: number; date: string }

const m = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** الأقدم أولاً: يسدد كل مستحق بالكامل بالترتيب حتى ينفد المبلغ */
export function allocateOldestFirst(targets: AllocTarget[], amount: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = m(Math.max(0, amount));
  for (const t of [...targets].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))) {
    if (left <= 0) break;
    const v = m(Math.min(left, Math.max(0, t.remaining)));
    if (v > 0) { out.set(t.key, v); left = m(left - v); }
  }
  return out;
}

/** بالتناسب مع المتبقي على كل مستحق؛ المجموع يساوي المبلغ (أو كامل المستحقات إن كان أقل) */
export function allocateProportional(targets: AllocTarget[], amount: number): Map<string, number> {
  const out = new Map<string, number>();
  const live = targets.filter(t => t.remaining > 0);
  const totalDue = m(live.reduce((s, t) => s + t.remaining, 0));
  const pool = m(Math.min(Math.max(0, amount), totalDue));
  if (!live.length || pool <= 0) return out;
  let used = 0;
  live.forEach(t => { const v = m(Math.min(t.remaining, (pool * t.remaining) / totalDue)); out.set(t.key, v); used = m(used + v); });
  let diff = m(pool - used);
  for (const t of [...live].sort((a, b) => b.remaining - a.remaining)) {
    if (diff === 0) break;
    const cur = out.get(t.key) || 0;
    const room = m(t.remaining - cur);
    const step = diff > 0 ? Math.min(diff, room) : Math.max(diff, -cur);
    out.set(t.key, m(cur + step));
    diff = m(diff - step);
  }
  return out;
}
