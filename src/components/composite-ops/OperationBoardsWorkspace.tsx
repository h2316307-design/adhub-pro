import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { pickInstallationTeam } from '@/utils/smartTeamAssignment';
import { installationTeamCoversBillboard } from '@/utils/teamAssignment';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import {
  Calculator, Camera, CheckCircle2, Sparkles, Star, ShieldOff, ImageIcon, ImagePlus, Loader2, MoreHorizontal, Palette, Plus, Printer, RotateCcw, Search, Trash2, Undo2, Upload, Users, CalendarDays,
} from 'lucide-react';
import { AddBillboardsToTaskDialog } from '@/components/installation/AddBillboardsToTaskDialog';
import {
  completeBoards, loadOperationBoards, loadOperationDesigns, moveBoards, moveBoardsToTeam, removeBoards, saveInstalledPhotos, setBoardsDate, setBoardsDesign, uncompleteBoards, uploadInstalledPhoto, type BoardItem, type OpDesign,
} from '@/services/operationBoards';
import type { OperationRow } from '@/services/compositeOperations';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { tintStyle } from '@/components/composite-ops/OperationCard';
import { CARD_GRID, CardSizeControl, cardVars, useCardSize } from '@/components/composite-ops/CardSize';
import { ScrollTopButton } from '@/components/shared/ScrollTopButton';
import { extractDualPaletteFromImage } from '@/components/composite-tasks/list/shared';

const today = () => format(new Date(), 'yyyy-MM-dd');
const dmy = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

function PhotoDialog({ item, op, onClose, onSaved }: { item: BoardItem; op: OperationRow; onClose: () => void; onSaved: () => void }) {
  const [a, setA] = useState(item.installedA || '');
  const [b, setB] = useState(item.installedB || '');
  const [busy, setBusy] = useState<'A' | 'B' | 'save' | null>(null);
  const fileA = useRef<HTMLInputElement>(null);
  const fileB = useRef<HTMLInputElement>(null);
  const upload = async (face: 'A' | 'B', file?: File) => {
    if (!file) return;
    setBusy(face);
    try {
      const url = await uploadInstalledPhoto(file, item, face, op);
      face === 'A' ? setA(url) : setB(url);
      toast.success('تم رفع الصورة');
    } catch (e: any) { toast.error(e.message || 'فشل الرفع'); } finally { setBusy(null); }
  };
  const save = async () => {
    setBusy('save');
    try { await saveInstalledPhotos(item, a.trim() || null, b.trim() || null); toast.success('تم حفظ صور التركيب'); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message || 'فشل الحفظ'); } finally { setBusy(null); }
  };
  const [showLinks, setShowLinks] = useState(false);
  const faces: ['A' | 'B', string, string, (v: string) => void, React.RefObject<HTMLInputElement>][] = [['A', 'الوجه الأمامي', a, setA, fileA]];
  if (item.faces > 1) faces.push(['B', 'الوجه الخلفي', b, setB, fileB]);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-2xl text-right">
        <DialogTitle>صور التركيب · {item.name}</DialogTitle>
        <DialogDescription>ارفع صورة، أو انقر على مربع الوجه ثم الصق صورة من الحافظة (Ctrl+V)</DialogDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          {faces.map(([face, label, val, set, ref]) => (
            <div key={face} className="space-y-2">
              <div className="text-sm font-semibold">{label}</div>
              <div tabIndex={0} title="انقر ثم الصق صورة (Ctrl+V)" className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
                {val ? <img src={val} alt={label} className="h-full w-full object-contain" /> : <><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">انقر هنا ثم Ctrl+V</span></>}
              </div>
              <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => upload(face, e.target.files?.[0])} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" disabled={!!busy} onClick={() => ref.current?.click()}>
                  {busy === face ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}رفع
                </Button>
                {val && <Button type="button" variant="ghost" size="sm" onClick={() => set('')}>مسح</Button>}
                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowLinks(v => !v)}>{showLinks ? 'إخفاء الرابط' : 'إظهار الرابط'}</Button>
              </div>
              {showLinks && <Input dir="ltr" placeholder="https://" value={val} onChange={e => set(e.target.value)} />}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={!!busy}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface MoveOption { id: string; name: string; inOperation: boolean; eligible: boolean; recommended: boolean; current: boolean }

/** قائمة نقل ذكية: الأنسب أولاً، ثم فرق العملية، ثم بقية الفرق؛ غير المناسبة معطّلة ما لم يُفعَّل «تجاوز أحكام الفرق» */
function MoveMenu({ options, override, onMove, trigger }: { options: MoveOption[]; override: boolean; onMove: (o: MoveOption) => void; trigger: React.ReactNode }) {
  const rec = options.find(o => o.recommended && !o.current);
  const section = (title: string, list: MoveOption[]) => list.length > 0 && (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">{title}</DropdownMenuLabel>
      {list.map(o => (
        <DropdownMenuItem key={o.id} disabled={o.current || (!o.eligible && !override)} onClick={() => onMove(o)} className="flex items-center gap-2">
          {o.recommended ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : <Users className="h-3.5 w-3.5 opacity-60" />}
          <span className="flex-1">{o.name}</span>
          {o.current && <span className="text-[10px] text-muted-foreground">الحالية</span>}
          {!o.eligible && !o.current && <span className="text-[10px] text-destructive">خارج نطاقها</span>}
          {!o.inOperation && !o.current && <span className="text-[10px] text-muted-foreground">مهمة جديدة</span>}
        </DropdownMenuItem>
      ))}
    </>
  );
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-64 overflow-y-auto text-right">
        {rec && (<><DropdownMenuItem onClick={() => onMove(rec)} className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" />الأنسب: {rec.name}</DropdownMenuItem><DropdownMenuSeparator /></>)}
        {section('فرق العملية', options.filter(o => o.inOperation))}
        {section('فرق أخرى', options.filter(o => !o.inOperation))}
        {!override && options.some(o => !o.eligible && !o.current) && <div className="px-2 py-1.5 text-[11px] text-muted-foreground">فعّل «تجاوز أحكام الفرق» لنقلها لفرقة خارج نطاقها</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** اختيار التصميم بصور مصغرة */
function DesignMenu({ designs, current, onPick, trigger }: { designs: OpDesign[]; current: string | null; onPick: (d: OpDesign) => void; trigger: React.ReactNode }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-80 overflow-y-auto p-1 text-right">
        {!designs.length && <div className="p-3 text-center text-xs text-muted-foreground">لا توجد تصاميم — أضفها من زر «التصاميم» أعلى النافذة</div>}
        {designs.map((d, k) => (
          <DropdownMenuItem key={`${d.id || 'u'}-${k}`} onClick={() => onPick(d)} className={cn('flex items-center gap-2 p-1.5', current && current === d.a && 'bg-primary/10')}>
            <span className="grid shrink-0 grid-cols-2 gap-1">
              {[d.a, d.b].map((src, j) => (
                <span key={j} className="flex h-12 w-16 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                  {src ? <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" /> : <span className="text-[9px] text-muted-foreground">{j ? 'بلا خلفي' : '—'}</span>}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs">{d.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardCard({ i, gallery, isDone, selected, busy, showTeam, showContract, moveOptions, override, designs, onToggle, onComplete, onUncomplete, onPhotos, onMove, onDesign, onRemove }: {
  i: BoardItem; gallery: { src: string; label?: string }[]; isDone: boolean; selected: boolean; busy: boolean; showTeam: boolean; showContract: boolean;
  moveOptions: MoveOption[]; override: boolean; designs: OpDesign[]; onToggle: (c: boolean) => void; onComplete: () => void; onUncomplete: () => void; onPhotos: () => void;
  onMove: (o: MoveOption) => void; onDesign: (d: OpDesign) => void; onRemove: () => void;
}) {
  const [colors, setColors] = useState<[string, string] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setColors(null);
    if (i.designA) extractDualPaletteFromImage(i.designA, c => { if (!cancelled) setColors(c); });
    return () => { cancelled = true; };
  }, [i.designA]);
  return (
    <article style={tintStyle(colors)} className={cn('flex flex-col overflow-hidden rounded-2xl border-2 bg-card', selected ? 'ring-2 ring-primary' : '', !colors && 'border-border')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2">
        <Checkbox className="h-5 w-5 border-2" checked={selected} onCheckedChange={c => onToggle(!!c)} aria-label={`تحديد ${i.name}`} />
        <b className="text-lg leading-tight">{i.name}</b>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-base font-bold tabular-nums text-primary">{i.size}</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-sm">{i.faces === 1 ? 'وجه واحد' : `${i.faces} أوجه`}</span>
        <span className={cn('ms-auto rounded-md px-2.5 py-0.5 text-sm font-semibold', isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>
          {isDone ? `مركبة ${dmy(i.installationDate)}` : 'غير مركبة'}
        </span>
      </header>
      <div className="flex flex-1 flex-col">
      <div className="relative shrink-0 border-b border-border/60" style={{ height: 'var(--img-h,200px)' }}>
        <ZoomImage src={i.photo} alt={i.name} title={i.name} gallery={gallery} className="h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        <div>
          {/* أقرب نقطة يميناً، واسم الفرقة دائماً على اليسار مقابلها */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm">{i.landmark || <span className="text-muted-foreground">—</span>}</div>
            <span className={cn('flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold', showTeam ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background/80')} title="الفرقة">
              <Users className="h-3.5 w-3.5" />{i.teamName}
            </span>
          </div>
          <div className="text-sm text-muted-foreground/80">{[i.area, i.municipality].filter(Boolean).join(' · ')}</div>
          {showContract && i.contractNumber && <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <span className="rounded bg-background/80 px-1.5 py-0.5 tabular-nums">عقد #{i.contractNumber}</span>
          </div>}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([['تصميم أ', i.designA], ['تصميم ب', i.faces > 1 ? i.designB : null], ['تركيب أ', i.installedA], ['تركيب ب', i.faces > 1 ? i.installedB : null]] as const).map(([label, src]) => (
            <div key={label} className="space-y-0.5">
              <ZoomImage src={src} alt={`${label} · ${i.name}`} title={i.name} gallery={gallery} className="aspect-square w-full rounded-md border border-border" imgClassName="object-contain" />
              <div className="text-center text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          {isDone
            ? <Button size="sm" variant="outline" className="h-10 bg-background/80" disabled={busy} onClick={onUncomplete}><Undo2 className="h-4 w-4" />إلغاء الإكمال</Button>
            : <Button size="sm" className="h-10" disabled={busy} onClick={onComplete}><CheckCircle2 className="h-4 w-4" />تم التركيب</Button>}
          <Button size="sm" variant="outline" className="h-10 bg-background/80" onClick={onPhotos}><Camera className="h-4 w-4" />صور التركيب</Button>
          <MoveMenu options={moveOptions} override={override} onMove={onMove}
            trigger={<Button size="sm" variant="outline" className="h-10 bg-background/80" disabled={busy}><Users className="h-4 w-4" />نقل لفرقة</Button>} />
          <DesignMenu designs={designs} current={i.designA} onPick={onDesign}
            trigger={<Button size="sm" variant="outline" className="h-10 bg-background/80" disabled={busy}><Palette className="h-4 w-4" />التصميم</Button>} />
          <Button size="sm" variant="ghost" className="h-10 text-destructive" disabled={busy || isDone} title={isDone ? 'ألغِ الإكمال أولاً' : undefined} onClick={onRemove}><Trash2 className="h-4 w-4" />إزالة</Button>
        </div>
      </div>
      </div>
    </article>
  );
}

export function OperationBoardsWorkspace({ op, onClose, onChanged, onEditCosts, onDesigns, onDistribute, onPrint }: {
  op: OperationRow;
  onClose: () => void;
  onChanged: () => void;
  onEditCosts: () => void;
  onDesigns: () => void;
  onDistribute: () => void;
  onPrint: () => void;
}) {
  const { confirm } = useSystemDialog();
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('all');
  const [contract, setContract] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [photoItem, setPhotoItem] = useState<BoardItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cardSize] = useCardSize();
  const [override, setOverride] = useState(false);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [opTeamIds, setOpTeamIds] = useState<Map<string, string>>(new Map()); // team_id -> installation task id
  const [designs, setDesigns] = useState<OpDesign[]>([]);
  useEffect(() => {
    supabase.from('installation_teams').select('*').then(({ data }) => setAllTeams((data || []).filter((t: any) => t.is_active !== false)));
  }, []);
  useEffect(() => {
    const ids = op.tasks.map(t => t.installation_task_id).filter(Boolean);
    if (!ids.length) return;
    supabase.from('installation_tasks').select('id, team_id').in('id', ids).then(({ data }) => setOpTeamIds(new Map((data || []).filter((t: any) => t.team_id).map((t: any) => [t.team_id, t.id]))));
  }, [op]);

  const reload = async () => {
    try { setItems(await loadOperationBoards(op)); setError(null); }
    catch (e: any) { setError(e.message || 'تعذر تحميل اللوحات'); }
  };
  useEffect(() => { setItems(null); setSelected(new Set()); reload(); }, [op.key, op.tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (items) loadOperationDesigns(op, items).then(setDesigns).catch(() => setDesigns([])); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const teams = useMemo(() => op.tasks.filter(t => t.installation_task_id).map(t => ({ taskId: t.installation_task_id as string, name: t.teamName as string })), [op]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (items || []).filter(i =>
      (team === 'all' || i.taskId === team)
      && (status === 'all' || (status === 'done' ? i.status === 'completed' : i.status !== 'completed'))
      && (contract === 'all' || String(i.contractNumber) === contract)
      && (!s || [i.name, i.size, i.landmark, i.area, i.municipality, String(i.billboardId)].some(v => String(v || '').toLowerCase().includes(s))));
    return sortBillboardsStandardSync(list.map(i => ({ ...i, Size: i.size, Billboard_Name: i.name, ID: i.billboardId })) as any) as unknown as BoardItem[];
  }, [items, q, team, status, contract]);

  const done = (items || []).filter(i => i.status === 'completed').length;
  const total = items?.length || 0;
  const sel = (items || []).filter(i => selected.has(i.id));

  const taskTeam = useMemo(() => new Map([...opTeamIds.entries()].map(([team, task]) => [task, team])), [opTeamIds]);
  const optionsFor = (boards: BoardItem[]): MoveOption[] => {
    const currentTeams = new Set(boards.map(b => taskTeam.get(b.taskId)).filter(Boolean));
    const best = boards.length === 1
      ? pickInstallationTeam(allTeams, { Size: boards[0].size, City: boards[0].city, friend_company_id: boards[0].friendCompanyId }, taskTeam.get(boards[0].taskId))
      : null;
    return allTeams.map(t => ({
      id: t.id,
      name: t.team_name || 'فرقة',
      inOperation: opTeamIds.has(t.id),
      eligible: boards.every(b => installationTeamCoversBillboard(t, b.size, b.city, b.friendCompanyId)),
      recommended: !!best && best.id === t.id,
      current: currentTeams.size === 1 && currentTeams.has(t.id),
    })).sort((a, b) => Number(b.recommended) - Number(a.recommended) || Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name, 'ar'));
  };
  const moveTo = (boards: BoardItem[], o: MoveOption) => run(async () => {
    const team = allTeams.find(t => t.id === o.id);
    if (!team) throw new Error('الفرقة غير متاحة');
    if (!o.eligible && !override) throw new Error('الفرقة خارج نطاق هذه اللوحات — فعّل «تجاوز أحكام الفرق»');
    await moveBoardsToTeam(boards, team, op);
  }, `نُقلت ${boards.length > 1 ? `${boards.length} لوحات` : ''} إلى ${o.name}${o.inOperation ? '' : ' (مهمة جديدة ضمن العملية)'}`, true);

  /** توزيع ذكي: كل لوحة محددة إلى أنسب فرقة لها */
  const smartDistribute = (boards: BoardItem[]) => run(async () => {
    const groups = new Map<string, BoardItem[]>();
    const missing: string[] = [];
    boards.forEach(b => {
      const best = pickInstallationTeam(allTeams, { Size: b.size, City: b.city, friend_company_id: b.friendCompanyId }, taskTeam.get(b.taskId));
      if (!best) { missing.push(b.name); return; }
      if (best.id === taskTeam.get(b.taskId)) return;
      groups.set(best.id, [...(groups.get(best.id) || []), b]);
    });
    for (const [teamId, list] of groups) await moveBoardsToTeam(list, allTeams.find(t => t.id === teamId), op);
    if (missing.length) toast.warning(`لا توجد فرقة مناسبة لـ: ${missing.slice(0, 5).join('، ')}`);
    if (!groups.size) toast.info('كل اللوحات المحددة لدى أنسب فرقة لها');
  }, 'تم التوزيع الذكي على الفرق', true);

  /** إعادة احتساب الفاتورة من الصفر بالأسعار المستخدمة في لوحات العملية */
  const reprice = async (newIds?: Set<string>) => {
    try {
      const { repriceOperation } = await import('@/services/compositeOperations');
      const r = await repriceOperation(op, newIds);
      const total = r.totals.customerTotal;
      toast.success(`أُعيد احتساب الفاتورة${r.added ? ` (سُعّرت ${r.added} لوحة جديدة بنفس أسعار العملية)` : ''}${typeof total === 'number' ? ` — الإجمالي ${Math.round(total).toLocaleString('ar-LY')} د.ل` : ''}`);
    } catch (e: any) { toast.error(`تعذّر إعادة احتساب الفاتورة: ${e.message || e}`); }
  };

  const run = async (fn: () => Promise<void>, msg: string, recalc = false) => {
    setBusy(true);
    try { await fn(); toast.success(msg); setSelected(new Set()); if (recalc) await reprice(); await reload(); onChanged(); }
    catch (e: any) { toast.error(e.message || 'فشلت العملية'); }
    finally { setBusy(false); }
  };

  const toggle = (id: string, on: boolean) => setSelected(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="flex h-[96vh] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="space-y-3 border-b border-border px-5 py-4 pl-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold">إدارة اللوحات · {op.label}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">{op.customerName}</span>
                {op.contracts.map(c => <span key={c.number} className="rounded-md border border-border px-2 py-0.5 tabular-nums">#{c.number}{c.adType ? ` · ${c.adType}` : ''}</span>)}
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{op.teams.join('، ')}</span>
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAddOpen(true)} disabled={!teams.length}><Plus className="h-4 w-4" />إضافة لوحات</Button>
              <Button size="sm" variant="outline" onClick={onDesigns}><ImagePlus className="h-4 w-4" />التصاميم</Button>
              <Button size="sm" variant="outline" onClick={onDistribute}><Palette className="h-4 w-4" />توزيع التصاميم</Button>
              <Button size="sm" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />طباعة التركيب</Button>
              <Button size="sm" variant="outline" onClick={onEditCosts}><Calculator className="h-4 w-4" />التكاليف</Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
            <span className="text-sm tabular-nums"><b>{done}</b> / {total} مركبة</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="اسم، مقاس، نقطة دالة، منطقة، بلدية" className="h-9 pr-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="pending">غير مركبة</SelectItem><SelectItem value="done">مركبة</SelectItem></SelectContent>
            </Select>
            {teams.length > 1 && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل الفرق</SelectItem>{teams.map(t => <SelectItem key={t.taskId} value={t.taskId}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {op.contractIds.length > 1 && (
              <Select value={contract} onValueChange={setContract}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل العقود</SelectItem>{op.contractIds.map(n => <SelectItem key={n} value={String(n)}>عقد #{n}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <label className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', override ? 'border-destructive/50 bg-destructive/5 text-destructive' : 'border-border text-muted-foreground')} title="يسمح بنقل اللوحة لأي فرقة حتى لو كانت خارج مدنها أو مقاساتها">
              <ShieldOff className="h-3.5 w-3.5" /><Switch checked={override} onCheckedChange={setOverride} />تجاوز أحكام الفرق
            </label>
            <CardSizeControl />
          </div>
          {/* أدوات التحديد: تعمل على اللوحات الظاهرة حسب البحث والفلاتر */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">التحديد:</span>
            <Button size="sm" variant="outline" className="h-8" disabled={!visible.length} onClick={() => setSelected(new Set(visible.map(i => i.id)))}>تحديد الكل ({visible.length})</Button>
            <Button size="sm" variant="outline" className="h-8" disabled={!visible.length} onClick={() => setSelected(p => { const n = new Set(p); visible.forEach(i => (n.has(i.id) ? n.delete(i.id) : n.add(i.id))); return n; })}>عكس التحديد</Button>
            {visible.some(i => i.status !== 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status !== 'completed').map(i => i.id)))}>غير المركبة ({visible.filter(i => i.status !== 'completed').length})</Button>}
            {visible.some(i => i.status === 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status === 'completed').map(i => i.id)))}>المركبة ({visible.filter(i => i.status === 'completed').length})</Button>}
            {selected.size > 0 && <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>إلغاء ({selected.size})</Button>}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ScrollTopButton className="absolute bottom-24 right-6" threshold={300} />
          {error ? <div className="p-8 text-center text-destructive">{error}</div>
            : !items ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
            : !visible.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد لوحات</div>
            : (
              <div className={cn(CARD_GRID[cardSize].grid, CARD_GRID[cardSize].text)} style={cardVars(cardSize)}>
                {visible.map(i => {
                  const isDone = i.status === 'completed';
                  const gallery = ([['صورة اللوحة', i.photo], ['تصميم أ', i.designA], ['تصميم ب', i.designB], ['تركيب أ', i.installedA], ['تركيب ب', i.installedB]] as const)
                    .filter(([, src]) => !!src).map(([label, src]) => ({ src: src as string, label }));
                  return (
                    <BoardCard key={i.id} i={i} gallery={gallery} isDone={isDone} selected={selected.has(i.id)} busy={busy}
                      showTeam={teams.length > 1} showContract={op.contractIds.length > 1}
                      moveOptions={optionsFor([i])} override={override} designs={designs}
                      onDesign={d => run(() => setBoardsDesign([i], d), 'تم تعيين التصميم')}
                      onToggle={c => toggle(i.id, c)}
                      onComplete={() => run(() => completeBoards([i], date), 'تم تسجيل التركيب')}
                      onUncomplete={() => run(() => uncompleteBoards([i]), 'تم إلغاء الإكمال')}
                      onPhotos={() => setPhotoItem(i)}
                      onMove={o => moveTo([i], o)}
                      onRemove={async () => { if (await confirm({ title: 'إزالة اللوحة', message: `إزالة ${i.name} من هذه العملية؟`, confirmText: 'إزالة', variant: 'destructive' } as any)) run(() => removeBoards([i]), 'تمت الإزالة', true); }} />
                  );
                })}
              </div>
            )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <label className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4" />تاريخ التركيب
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-[160px]" />
          </label>
          {sel.length > 0 ? (
            <>
              <span className="text-sm font-semibold">{sel.length} محددة</span>
              <Button size="sm" disabled={busy} onClick={() => run(() => completeBoards(sel.filter(i => i.status !== 'completed'), date), 'تم تسجيل التركيب')}><CheckCircle2 className="h-4 w-4" />تم التركيب</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setBoardsDate(sel, date), 'تم تحديث التاريخ')}><CalendarDays className="h-4 w-4" />تعيين التاريخ</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => uncompleteBoards(sel.filter(i => i.status === 'completed')), 'تم إلغاء الإكمال')}><RotateCcw className="h-4 w-4" />إلغاء الإكمال</Button>
              <MoveMenu options={optionsFor(sel)} override={override} onMove={o => moveTo(sel, o)}
                trigger={<Button size="sm" variant="outline" disabled={busy}><Users className="h-4 w-4" />نقل لفرقة</Button>} />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => smartDistribute(sel)} title="كل لوحة إلى أنسب فرقة حسب المدينة والمقاس والفرقة السابقة"><Sparkles className="h-4 w-4" />توزيع ذكي</Button>
              <DesignMenu designs={designs} current={null} onPick={d => run(() => setBoardsDesign(sel, d), `تم تعيين التصميم لـ ${sel.length} لوحة`)}
                trigger={<Button size="sm" variant="outline" disabled={busy}><Palette className="h-4 w-4" />تعيين تصميم</Button>} />
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy || sel.some(i => i.status === 'completed')} onClick={async () => {
                if (await confirm({ title: 'إزالة اللوحات', message: `إزالة ${sel.length} لوحة من العملية؟`, confirmText: 'إزالة', variant: 'destructive' } as any)) run(() => removeBoards(sel), 'تمت الإزالة', true);
              }}><Trash2 className="h-4 w-4" />إزالة</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
            </>
          ) : <span className="text-xs text-muted-foreground">حدد لوحات لتنفيذ إجراء جماعي</span>}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <Button variant="outline" className="ms-auto" onClick={onClose}>إغلاق</Button>
        </footer>

        {photoItem && <PhotoDialog item={photoItem} op={op} onClose={() => setPhotoItem(null)} onSaved={() => { reload(); onChanged(); }} />}
        {addOpen && teams.length > 0 && (
          <AddBillboardsToTaskDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            taskId={team !== 'all' ? team : teams[0].taskId}
            contractId={op.contractIds[0]}
            contractIds={op.contractIds}
            existingBillboardIds={(items || []).map(i => i.billboardId)}
            customerName={op.customerName}
            onSuccess={async () => {
              setAddOpen(false);
              setBusy(true);
              try {
                const before = new Set((items || []).map(i => i.id));
                const fresh = await loadOperationBoards(op);
                await reprice(new Set(fresh.filter(i => !before.has(i.id)).map(i => i.id)));
              } finally { setBusy(false); await reload(); onChanged(); }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
