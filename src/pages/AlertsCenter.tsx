import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronDown, Bell, CalendarClock, CalendarPlus, FileText, Loader2, MessageCircle, Receipt, RefreshCw, Search, Settings, Wallet, Check } from 'lucide-react';
import {
  buildContractDesignsMap, extractCalendarEvents, filterChangedCalendarEvents, getCalendarConfig, loadCalendarRecords,
  syncEventsToGoogleCalendar, type GoogleCalendarEvent,
} from '@/services/googleCalendarService';
import { whatsappBrowserRequest } from '@/lib/whatsappBrowser';

/**
 * مركز تنبيهات الزبائن: الدفعات (الأقساط)، العقود (بداية/نهاية)، الفواتير — في صفحة واحدة.
 * الإرسال يدوي دائماً: لا شيء يُرسل إلا بضغطة المستخدم، ويمكن الإرسال لكل نوع على حدة.
 */
type Kind = 'payments' | 'contracts' | 'invoices';
const KIND_OF = (e: GoogleCalendarEvent): Kind => e.type === 'installment' ? 'payments' : e.type === 'invoice' ? 'invoices' : 'contracts';
const KINDS: { key: Kind; label: string; icon: any }[] = [
  { key: 'payments', label: 'الدفعات المستحقة', icon: Wallet },
  { key: 'contracts', label: 'العقود', icon: FileText },
  { key: 'invoices', label: 'الفواتير', icon: Receipt },
];
const TYPE_LABEL: Record<GoogleCalendarEvent['type'], string> = {
  installment: 'قسط', contract_end: 'نهاية عقد', contract_start: 'بداية عقد', invoice: 'فاتورة',
};
const fmt = (n?: number) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} د.ل`;
const dmy = (s?: string) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');

/** رقم ليبي بصيغة دولية لواتساب */
export function whatsappNumber(raw?: string | null): string | null {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '218' + d.slice(1);
  if (d.length === 9 && d.startsWith('9')) d = '218' + d;
  return d.length >= 11 ? d : null;
}

const SIGN = '\nشاكرين تعاونكم 🌹\n*الفارس الذهبي للدعاية والإعلان*';
const greet = (name?: string) => `السلام عليكم ورحمة الله وبركاته،\nالسادة / *${name || 'عميلنا العزيز'}* المحترمين\n`;
const overdueText = (e: GoogleCalendarEvent) => e.isOverdue ? ` ⚠️ متأخر ${e.daysRemainingOrOverdue} يوم` : e.daysRemainingOrOverdue === 0 ? ' (اليوم)' : '';

/** وصف مختصر للتنبيه: الفاتورة تظهر بعنوانها إن وُجد */
export function alertLabel(e: GoogleCalendarEvent): string {
  const ad = e.adType ? ` — ${e.adType}` : '';
  switch (e.type) {
    case 'installment': return `دفعة عقد #${e.contractNumber}${ad}`;
    case 'contract_end': return `انتهاء عقد #${e.contractNumber}${ad}`;
    case 'contract_start': return `بدء عقد #${e.contractNumber}${ad}`;
    default: return e.invoiceName ? `فاتورة «${e.invoiceName}» رقم ${e.invoiceNumber || ''}`.trim() : `فاتورة رقم ${e.invoiceNumber || ''}`.trim();
  }
}

function messageFor(e: GoogleCalendarEvent): string {
  const head = greet(e.customerName);
  const date = `📅 ${e.type === 'contract_end' ? 'تاريخ الانتهاء' : e.type === 'contract_start' ? 'تاريخ البدء' : 'تاريخ الاستحقاق'}: ${dmy(e.startDate)}${overdueText(e)}`;
  const amount = e.amount ? `\n💰 المبلغ: *${fmt(e.amount)}*` : '';
  switch (e.type) {
    case 'installment':
    case 'invoice':
      return `${head}\nنود تذكيركم بالمستحق التالي:\n\n📄 ${alertLabel(e)}${amount}\n${date}\n\n${e.isOverdue ? 'نرجو التكرم بالسداد في أقرب وقت ممكن.' : 'نرجو التكرم بالسداد في موعده.'}${SIGN}`;
    case 'contract_end':
      return `${head}\nنحيطكم علماً بقرب انتهاء:\n\n📄 ${alertLabel(e)}\n${date}\n\nيسعدنا تجديد التعاقد أو الإجابة عن أي استفسار.${SIGN}`;
    default:
      return `${head}\nنؤكد لكم:\n\n📄 ${alertLabel(e)}\n${date}\n\nشكراً لثقتكم بنا.${SIGN}`;
  }
}

/* سجل الإرسال اليدوي على هذا الجهاز (لمعرفة ما أُرسل) */
const SENT_KEY = 'alerts-center-sent';
const readSent = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}') || {}; } catch { return {}; } };
const markSent = (tags: string[]) => { try { const m = readSent(); const now = new Date().toISOString(); tags.forEach(t => { m[t] = now; }); localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

export default function AlertsCenter() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>('payments');
  const [range, setRange] = useState('30');
  const [q, setQ] = useState(params.get('customer') || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendInvites, setSendInvites] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState(readSent);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (k: string) => setOpenGroups(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const customerIdFilter = params.get('customerId');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alerts-center'],
    staleTime: 60_000,
    queryFn: async () => {
      const config = await getCalendarConfig();
      const r = await loadCalendarRecords();
      const designs = buildContractDesignsMap(r.compositeTasks, r.taskDesigns, r.directInstallationTasks);
      const events = extractCalendarEvents(r.contracts, r.payments, { ...config, activeAndUpcomingOnly: false }, r.invoices || [], r.installations || [], r.customers || [], designs);
      const phones = new Map<string, string>((r.customers || []).map((c: any) => [c.id, c.phone]));
      return { config, events, phones };
    },
  });

  const all = data?.events || [];
  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(e => {
      if (customerIdFilter && e.customerId !== customerIdFilter) return false;
      if (s && !String(e.customerName || '').toLowerCase().includes(s) && !String(e.contractNumber || '').includes(s) && !String(e.invoiceNumber || '').toLowerCase().includes(s)) return false;
      const d = e.daysRemainingOrOverdue; // موجب = متأخر، سالب = متبقٍ
      if (range === 'overdue') return e.isOverdue;
      if (range === 'all') return true;
      const days = Number(range);
      return e.isOverdue ? KIND_OF(e) !== 'contracts' : -d <= days;
    }).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [all, q, range, customerIdFilter]);
  const byKind = useMemo(() => {
    const m: Record<Kind, GoogleCalendarEvent[]> = { payments: [], contracts: [], invoices: [] };
    scoped.forEach(e => m[KIND_OF(e)].push(e));
    return m;
  }, [scoped]);
  const list = byKind[kind];
  const sel = list.filter(e => selected.has(e.tag || e.id));
  // تجميع حسب الزبون: الأكثر تأخراً أولاً
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; customerId?: string | null; items: GoogleCalendarEvent[] }>();
    list.forEach(e => {
      const k = e.customerId || e.customerName || '—';
      if (!m.has(k)) m.set(k, { key: k, name: e.customerName || '—', customerId: e.customerId, items: [] });
      m.get(k)!.items.push(e);
    });
    const score = (g: { items: GoogleCalendarEvent[] }) => g.items.filter(e => e.isOverdue).reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    return [...m.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'ar'));
  }, [list]);

  const toggleAll = (on: boolean) => setSelected(prev => {
    const n = new Set(prev);
    list.forEach(e => on ? n.add(e.tag || e.id) : n.delete(e.tag || e.id));
    return n;
  });

  const sendCalendar = async (events: GoogleCalendarEvent[]) => {
    if (!data?.config.scriptUrl) { toast.error('اربط تقويم Google أولاً من الإعدادات'); return; }
    const changed = filterChangedCalendarEvents(data.config, events);
    if (!changed.length) { toast.success('كل التنبيهات المحددة موجودة ومحدّثة في التقويم'); return; }
    setBusy('calendar');
    try {
      const res = await syncEventsToGoogleCalendar(data.config, changed, undefined, { sendInvites, batchSize: 5, delayMs: 2500 });
      if (res.rateLimited) toast.warning(`أُرسل ${res.totalProcessed} من ${changed.length}؛ توقف مؤقتاً بسبب حدود Google. أعد المحاولة بعد قليل وسيكمل الباقي فقط.`);
      else toast.success(`تمت مزامنة ${changed.length} تنبيه مع التقويم${sendInvites ? ' وإرسال دعوات للزبائن' : ''}`);
    } catch (e: any) { toast.error(e.message || 'فشل الإرسال للتقويم'); }
    finally { setBusy(null); }
  };

  const openWhatsApp = (e: GoogleCalendarEvent) => {
    const phone = whatsappNumber(data?.phones.get(String(e.customerId)));
    if (!phone) { toast.error(`لا يوجد رقم صالح للزبون ${e.customerName}`); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageFor(e))}`, '_blank', 'noopener');
    markSent([e.tag || e.id]); setSentMap(readSent());
  };

  /** رسالة واحدة للزبون تجمع كل تنبيهاته في التبويب الحالي */
  const groupMessage = (items: GoogleCalendarEvent[]) => {
    const lines = items.map((e, i) => `${i + 1}) ${alertLabel(e)}\n   ${e.amount ? `💰 ${fmt(e.amount)} — ` : ''}📅 ${dmy(e.startDate)}${overdueText(e)}`);
    const total = items.reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    const anyOverdue = items.some(e => e.isOverdue);
    return `${greet(items[0]?.customerName)}\nنود تذكيركم بما يلي:\n\n${lines.join('\n\n')}${total ? `\n\n*الإجمالي: ${fmt(total)}*` : ''}\n\n${anyOverdue ? 'نرجو التكرم بتسوية المستحقات المتأخرة في أقرب وقت ممكن.' : 'نرجو التكرم بالسداد في المواعيد المحددة.'}${SIGN}`;
  };
  const openWhatsAppGroup = (items: GoogleCalendarEvent[]) => {
    const phone = whatsappNumber(data?.phones.get(String(items[0]?.customerId)));
    if (!phone) { toast.error('لا يوجد رقم صالح لهذا الزبون'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(items.length === 1 ? messageFor(items[0]) : groupMessage(items))}`, '_blank', 'noopener');
    markSent(items.map(e => e.tag || e.id)); setSentMap(readSent());
  };

  const prepareWhatsAppBatch = async (events: GoogleCalendarEvent[]) => {
    const byCustomer = new Map<string, GoogleCalendarEvent[]>();
    events.forEach(e => { const k = String(e.customerId || e.customerName); byCustomer.set(k, [...(byCustomer.get(k) || []), e]); });
    const recipients = [...byCustomer.values()].map(items => ({
      id: items.map(e => e.tag || e.id).join(','), name: items[0].customerName,
      phone: whatsappNumber(data?.phones.get(String(items[0].customerId))) || undefined,
      message: items.length === 1 ? messageFor(items[0]) : groupMessage(items),
    })).filter(r => r.phone);
    if (!recipients.length) { toast.error('لا توجد أرقام صالحة ضمن التحديد'); return; }
    setBusy('whatsapp');
    try {
      const res = await whatsappBrowserRequest('PREPARE', recipients);
      if (!res.ok) throw new Error(res.error || 'إضافة واتساب غير متصلة');
      toast.success(`جُهّزت ${recipients.length} رسالة (رسالة لكل زبون) في إضافة واتساب — راجعها وأرسلها من هناك`);
      markSent(recipients.flatMap(r => r.id.split(','))); setSentMap(readSent());
    } catch (e: any) { toast.error(e.message || 'تعذر التجهيز؛ استخدم زر واتساب لكل تنبيه'); }
    finally { setBusy(null); }
  };

  const kpi = (k: Kind) => ({
    count: byKind[k].length,
    overdue: byKind[k].filter(e => e.isOverdue).length,
    amount: byKind[k].reduce((s, e) => s + (Number(e.amount) || 0), 0),
  });

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6" />تنبيهات الزبائن</h1>
          <p className="text-sm text-muted-foreground">الدفعات والعقود والفواتير في مكان واحد — الإرسال يدوي، لكل نوع أو لكل تنبيه</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/google-calendar')}><Settings className="h-4 w-4" />إعدادات التقويم</Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />تحديث</Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {KINDS.map(k => {
          const v = kpi(k.key);
          return (
            <button key={k.key} type="button" onClick={() => setKind(k.key)}
              className={cn('rounded-xl border-2 bg-card p-4 text-right transition-colors', kind === k.key ? 'border-primary' : 'border-border hover:border-primary/40')}>
              <div className="flex items-center gap-2 text-sm font-semibold"><k.icon className="h-4 w-4" />{k.label}</div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-2xl font-bold tabular-nums">{v.count}</div>
                {v.overdue > 0 && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{v.overdue} متأخر</span>}
              </div>
              {k.key !== 'contracts' && <div className="text-xs tabular-nums text-muted-foreground">{fmt(v.amount)}</div>}
            </button>
          );
        })}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="زبون، رقم عقد، رقم فاتورة" className="h-10 pr-9" />
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-10 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">خلال 7 أيام + المتأخر</SelectItem>
            <SelectItem value="30">خلال 30 يوماً + المتأخر</SelectItem>
            <SelectItem value="90">خلال 90 يوماً + المتأخر</SelectItem>
            <SelectItem value="overdue">المتأخر فقط</SelectItem>
            <SelectItem value="all">الكل</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={sendInvites} onCheckedChange={setSendInvites} />دعوة الزبون بالبريد مع التقويم</label>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <span className="text-sm font-semibold">{KINDS.find(k => k.key === kind)!.label}:</span>
        <span className="text-sm text-muted-foreground">{sel.length ? `${sel.length} محدد` : `${list.length} تنبيه`}</span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpenGroups(p => p.size ? new Set() : new Set(groups.map(g => g.key)))}>{openGroups.size ? 'طي الكل' : 'توسيع الكل'}</Button>
          <Button size="sm" disabled={!!busy || !(sel.length || list.length)} onClick={() => sendCalendar(sel.length ? sel : list)}>
            {busy === 'calendar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            إرسال {sel.length ? 'المحدد' : 'الكل'} للتقويم
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || !(sel.length || list.length)} onClick={() => prepareWhatsAppBatch(sel.length ? sel : list)}>
            {busy === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            تجهيز {sel.length ? 'المحدد' : 'الكل'} في واتساب
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-destructive/40 p-6 text-center text-destructive">{(error as Error).message}</div>
        : isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        : !list.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد تنبيهات في هذا النطاق</div>
        : (
          <div className="space-y-3">
            {groups.map(g => {
              const keys = g.items.map(e => e.tag || e.id);
              const allSel = keys.every(k => selected.has(k));
              const phone = whatsappNumber(data?.phones.get(String(g.customerId)));
              const overdueAmt = g.items.filter(e => e.isOverdue).reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
              const totalAmt = g.items.reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
              return (
                <article key={g.key} className="overflow-hidden rounded-xl border border-border bg-card">
                  <header className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                    <Checkbox aria-label={`تحديد تنبيهات ${g.name}`} checked={allSel} onCheckedChange={c => setSelected(p => { const n = new Set(p); keys.forEach(k => c ? n.add(k) : n.delete(k)); return n; })} />
                    <button type="button" aria-expanded={openGroups.has(g.key)} onClick={() => toggleGroup(g.key)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label={openGroups.has(g.key) ? 'طي' : 'توسيع'}>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', openGroups.has(g.key) && 'rotate-180')} />
                    </button>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleGroup(g.key)}>
                      <button type="button" className="text-base font-bold hover:underline" onClick={ev => { ev.stopPropagation(); g.customerId && navigate(`/admin/customer-account?id=${g.customerId}`); }}>{g.name}</button>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{g.items.length} تنبيه</span>
                        {kind !== 'contracts' && <span className="tabular-nums">الإجمالي {fmt(totalAmt)}</span>}
                        {overdueAmt > 0 && <span className="tabular-nums text-destructive">متأخر {fmt(overdueAmt)}</span>}
                        {!phone && <span>بدون رقم هاتف</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-8" disabled={!phone} onClick={() => openWhatsAppGroup(g.items)}><MessageCircle className="h-3.5 w-3.5" />رسالة واحدة بكل التنبيهات</Button>
                      <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => sendCalendar(g.items)} aria-label="إرسال للتقويم"><CalendarClock className="h-3.5 w-3.5" /></Button>
                    </div>
                  </header>
                  {openGroups.has(g.key) && <ul className="divide-y divide-border">
                    {g.items.map(e => {
                      const key = e.tag || e.id;
                      const days = e.daysRemainingOrOverdue;
                      const sentAt = sentMap[key];
                      return (
                        <li key={key} className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm', selected.has(key) && 'bg-primary/5')}>
                          <Checkbox aria-label="تحديد" checked={selected.has(key)} onCheckedChange={c => setSelected(p => { const n = new Set(p); c ? n.add(key) : n.delete(key); return n; })} />
                          <div className="w-28 tabular-nums">
                            <div className="font-semibold">{dmy(e.startDate)}</div>
                            <div className={cn('text-xs', e.isOverdue ? 'text-destructive' : days > -7 ? 'text-amber-600' : 'text-muted-foreground')}>{e.isOverdue ? `متأخر ${days} يوم` : days === 0 ? 'اليوم' : `بعد ${-days} يوم`}</div>
                          </div>
                          <div className="min-w-[160px] flex-1">
                            <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs">{TYPE_LABEL[e.type]}</span>
                            <b>{alertLabel(e).replace(/^(دفعة|انتهاء|بدء) /, '')}</b>
                          </div>
                          <div className="w-28 text-left font-semibold tabular-nums">{e.amount ? fmt(e.amount) : '—'}</div>
                          <div className="w-24 text-xs">{sentAt ? <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3.5 w-3.5" />{dmy(sentAt)}</span> : <span className="text-muted-foreground">لم يُرسل</span>}</div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-8" disabled={!phone} onClick={() => openWhatsApp(e)}><MessageCircle className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => sendCalendar([e])} aria-label="إرسال للتقويم"><CalendarClock className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>}
                </article>
              );
            })}
          </div>
        )}
    </div>
  );
}
