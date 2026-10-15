/**
 * البحث العام — مبني من الصفر.
 * يبحث في: صفحات النظام (من نفس فهرس القائمة الجانبية وصلاحياتها) + الزبائن + العقود + اللوحات + فواتير الطباعة،
 * بحث عربي مرن (أ/إ/آ=ا، ة=ه، ى=ي، بلا تشكيل)، تنقل بالأسهم، وعمليات بحث أخيرة محفوظة.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Command } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Clock, CornerDownLeft, FileText, Loader2, MapPin, Plus, Printer, Search, User, X } from 'lucide-react';
import { NAV_SEARCH_INDEX } from './Sidebar';

interface CommandMenuProps { open: boolean; onOpenChange: (open: boolean) => void }

type Hit = { key: string; group: string; title: string; sub?: string; badge?: string; icon: React.ComponentType<any>; run: () => void };

const RECENT_KEY = 'global-search-recent';
const norm = (s: unknown) => String(s ?? '')
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .toLowerCase().trim();
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const pushRecent = (q: string) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter(x => x !== q)].slice(0, 6))); } catch { /* ignore */ }
};
const like = (q: string) => `%${q.replace(/[%,()]/g, ' ').trim()}%`;
const sb = supabase as any;

const QUICK_ACTIONS = [
  { id: 'contracts', label: 'إنشاء عقد جديد', path: '/admin/contracts/new' },
  { id: 'offers', label: 'إنشاء عرض جديد', path: '/admin/offers/create' },
  { id: 'correspondence', label: 'مراسلة رسمية جديدة', path: '/admin/correspondence' },
];

export const CommandMenu: React.FC<CommandMenuProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ customers: any[]; contracts: any[]; billboards: any[]; invoices: any[] }>({ customers: [], contracts: [], billboards: [], invoices: [] });
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(!open); }
      else if (e.key === '/' && !open && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '') && !(e.target as HTMLElement)?.isContentEditable) { e.preventDefault(); onOpenChange(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => { if (open) { setRecent(readRecent()); } else { setQ(''); setData({ customers: [], contracts: [], billboards: [], invoices: [] }); } }, [open]);

  const can = (p: { id: string; permission?: string; permissions?: string[] }) =>
    p.permissions?.length ? p.permissions.some(x => hasPermission(x)) : hasPermission(p.permission || p.id);

  // بحث البيانات (مؤجل 250ms)
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setData({ customers: [], contracts: [], billboards: [], invoices: [] }); setLoading(false); return; }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const n = /^\d+$/.test(term) ? Number(term) : null;
      const L = like(term);
      const safe = async (p: Promise<any>) => { try { const r = await p; return r.data || []; } catch { return []; } };
      const [customers, contracts, billboards, invoices] = await Promise.all([
        hasPermission('customers') || hasPermission('customer_billing')
          ? safe(sb.from('customers').select('id, name, phone, company').or(`name.ilike.${L},phone.ilike.${L},company.ilike.${L}`).limit(6)) : [],
        hasPermission('contracts')
          ? safe(n !== null
            ? sb.from('Contract').select('Contract_Number, "Customer Name", "Ad Type", "End Date", Total').eq('Contract_Number', n).limit(1)
            : sb.from('Contract').select('Contract_Number, "Customer Name", "Ad Type", "End Date", Total').or(`"Customer Name".ilike.${L},"Ad Type".ilike.${L}`).order('Contract_Number', { ascending: false }).limit(6)) : [],
        hasPermission('billboards')
          ? safe(n !== null
            ? sb.from('billboards').select('ID, Billboard_Name, Size, Nearest_Landmark, Municipality, Status').eq('ID', n).limit(1)
            : sb.from('billboards').select('ID, Billboard_Name, Size, Nearest_Landmark, Municipality, Status').or(`Billboard_Name.ilike.${L},Nearest_Landmark.ilike.${L}`).limit(6)) : [],
        hasPermission('printed_invoices_page')
          ? safe(sb.from('printed_invoices').select('id, invoice_number, customer_name, total_amount, paid_amount').or(`invoice_number.ilike.${L},customer_name.ilike.${L}`).order('created_at', { ascending: false }).limit(4)) : [],
      ]);
      if (id !== reqId.current) return;
      setData({ customers, contracts, billboards, invoices });
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, hasPermission]);

  const go = (path: string, remember = true) => {
    if (remember && q.trim()) pushRecent(q.trim());
    onOpenChange(false);
    navigate(path);
  };

  const hits = useMemo<Hit[]>(() => {
    const term = norm(q);
    const out: Hit[] = [];
    // الصفحات
    const pages = NAV_SEARCH_INDEX.filter(can).filter((p, i, arr) => arr.findIndex(x => x.path === p.path) === i);
    const matched = term
      ? pages.map(p => ({ p, score: norm(p.label).startsWith(term) ? 0 : norm(p.label).includes(term) ? 1 : norm(p.section).includes(term) ? 2 : 9 })).filter(x => x.score < 9).sort((a, b) => a.score - b.score).map(x => x.p)
      : [];
    matched.slice(0, 8).forEach(p => out.push({ key: `p:${p.path}`, group: 'الصفحات', title: p.label, sub: p.section, icon: p.icon, run: () => go(p.path) }));
    data.customers.forEach((c: any) => out.push({
      key: `cu:${c.id}`, group: 'الزبائن', title: c.name, sub: [c.company, c.phone].filter(Boolean).join(' · '), icon: User,
      run: () => go(`/admin/customer-account?id=${c.id}&name=${encodeURIComponent(c.name || '')}`),
    }));
    data.contracts.forEach((c: any) => out.push({
      key: `co:${c.Contract_Number}`, group: 'العقود', title: `عقد #${c.Contract_Number} — ${c['Customer Name'] || ''}`, sub: [c['Ad Type'], c['End Date'] ? `ينتهي ${String(c['End Date']).split('-').reverse().join('/')}` : ''].filter(Boolean).join(' · '),
      badge: c.Total ? `${Math.round(Number(c.Total)).toLocaleString('en-US')} د.ل` : undefined, icon: FileText,
      run: () => go(`/admin/contracts/view/${c.Contract_Number}`),
    }));
    data.billboards.forEach((b: any) => out.push({
      key: `bb:${b.ID}`, group: 'اللوحات', title: b.Billboard_Name || `لوحة ${b.ID}`, sub: [b.Size, b.Nearest_Landmark, b.Municipality].filter(Boolean).join(' · '), badge: b.Status || undefined, icon: MapPin,
      run: () => {
        try { sessionStorage.setItem('pstate_billboards.search', JSON.stringify(b.Billboard_Name || String(b.ID))); } catch { /* ignore */ }
        if (window.location.pathname === '/admin/billboards') { pushRecent(q.trim()); onOpenChange(false); window.location.reload(); }
        else go('/admin/billboards');
      },
    }));
    data.invoices.forEach((i: any) => out.push({
      key: `iv:${i.id}`, group: 'فواتير الطباعة', title: `فاتورة #${i.invoice_number} — ${i.customer_name || ''}`,
      badge: `${Math.round(Number(i.total_amount) || 0).toLocaleString('en-US')} د.ل`, sub: Number(i.paid_amount) >= Number(i.total_amount) ? 'مسددة' : 'غير مسددة', icon: Printer,
      run: () => go('/admin/printed-invoices-page'),
    }));
    return out;
  }, [q, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => [...new Set(hits.map(h => h.group))], [hits]);
  const actions = QUICK_ACTIONS.filter(a => hasPermission(a.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-2xl translate-y-0 overflow-hidden p-0 shadow-2xl sm:rounded-2xl" dir="rtl">
        <DialogTitle className="sr-only">البحث العام</DialogTitle>
        <DialogDescription className="sr-only">ابحث عن صفحة أو زبون أو عقد أو لوحة أو فاتورة</DialogDescription>
        <Command shouldFilter={false} loop className="rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4">
            {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /> : <Search className="h-5 w-5 shrink-0 text-muted-foreground" />}
            <CommandPrimitive.Input
              value={q}
              onValueChange={setQ}
              autoFocus
              placeholder="ابحث عن زبون، رقم عقد، لوحة، فاتورة أو صفحة…"
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {q && <button type="button" onClick={() => setQ('')} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="مسح"><X className="h-4 w-4" /></button>}
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>

          <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
            {!q.trim() && (
              <>
                {recent.length > 0 && (
                  <CommandPrimitive.Group heading="عمليات بحث أخيرة" className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                    {recent.map(r => (
                      <Row key={`r:${r}`} value={`r:${r}`} onSelect={() => setQ(r)} icon={Clock} title={r} />
                    ))}
                  </CommandPrimitive.Group>
                )}
                {actions.length > 0 && (
                  <CommandPrimitive.Group heading="إجراءات سريعة" className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                    {actions.map(a => <Row key={a.path} value={a.path} onSelect={() => go(a.path, false)} icon={Plus} title={a.label} accent />)}
                  </CommandPrimitive.Group>
                )}
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">اكتب حرفين على الأقل · رقم العقد أو رقم اللوحة يُبحث عنه مباشرة · اختصار الفتح Ctrl+K أو /</p>
              </>
            )}
            {q.trim() && !hits.length && !loading && (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد نتائج لـ «{q.trim()}»</div>
            )}
            {groups.map(g => (
              <CommandPrimitive.Group key={g} heading={g} className="px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                {hits.filter(h => h.group === g).map(h => <Row key={h.key} value={h.key} onSelect={h.run} icon={h.icon} title={h.title} sub={h.sub} badge={h.badge} />)}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>

          <div className="hidden items-center gap-4 border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-background px-1">↑</kbd><kbd className="rounded border border-border bg-background px-1">↓</kbd>تنقل</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" />فتح</span>
            <span className="ms-auto">Ctrl+K</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

function Row({ value, onSelect, icon: Icon, title, sub, badge, accent }: { value: string; onSelect: () => void; icon: React.ComponentType<any>; title: string; sub?: string; badge?: string; accent?: boolean }) {
  return (
    <CommandPrimitive.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-foreground"
    >
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-aria-selected:bg-primary group-aria-selected:text-primary-foreground', accent && 'text-primary')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {badge && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">{badge}</span>}
      <ArrowLeft className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-aria-selected:opacity-60" />
    </CommandPrimitive.Item>
  );
}

export default CommandMenu;
