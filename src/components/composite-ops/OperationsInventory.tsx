import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Boxes, Printer, Wrench } from 'lucide-react';
import { openMeasurementsPrintWindow, createMeasurementsConfigFromSettings, type PrintColumn } from '@/lib/printMeasurements';
import { usePrintTheme } from '@/hooks/usePrintTheme';
import { DOCUMENT_TYPES } from '@/types/document-types';


type InventoryPeriod = 'day' | 'week' | 'month';
const PERIOD_LABEL: Record<InventoryPeriod, string> = { day: 'يومي', week: 'أسبوعي', month: 'شهري' };
const PERIOD_COL: Record<InventoryPeriod, string> = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر' };
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const fmtDay = (day: string) => day.split('-').reverse().join('/');
const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
import {
  bucketize, breakdown, details, loadInstallRecords, loadPrintRecords, localDay, type InstallRecord, type PrintRecord,
} from '@/services/operationsInventory';


const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
};
const monthStart = (today: string) => `${today.slice(0, 8)}01`;

/** نطاقات سريعة */
function presets(today: string) {
  const weekShift = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
  return [
    { label: 'اليوم', from: today, to: today },
    { label: 'هذا الأسبوع', from: addDays(today, -weekShift), to: today },
    { label: 'هذا الشهر', from: monthStart(today), to: today },
    { label: 'آخر 3 أشهر', from: addDays(today, -90), to: today },
  ];
}

/** شريط نسبي صغير داخل الخلية */
function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', className)} style={{ width: `${pct}%` }} /></div>;
}

export function OperationsInventory({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const today = useMemo(() => localDay(new Date()), []);
  const [period, setPeriod] = useState<InventoryPeriod>('day');
  const [from, setFrom] = useState(() => monthStart(today));
  const [to, setTo] = useState(today);

  const { data, isLoading, error } = useQuery({
    queryKey: ['operations-inventory'],
    queryFn: async () => {
      const [installs, prints] = await Promise.all([loadInstallRecords(), loadPrintRecords()]);
      return { installs, prints };
    },
    enabled: open,
    staleTime: 60_000,
  });

  const range = useMemo(() => {
    if (!data) return null;
    const inRange = <T extends { date: string }>(rows: T[]) => rows.filter(r => r.date >= from && r.date <= to);
    const installs: InstallRecord[] = inRange(data.installs);
    const prints: PrintRecord[] = inRange(data.prints);
    return {
      installs, prints,
      area: prints.reduce((s, p) => s + p.area, 0),
      buckets: bucketize(installs, prints, period),
      ...breakdown(installs, prints, from, to),
    };
  }, [data, from, to, period]);

  const invalid = from > to;
  const det = useMemo(() => (data ? details(data.installs, data.prints, from, to) : null), [data, from, to]);

  const DetailTable = ({ head, body }: { head: string[]; body: ReactNode }) => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-[#d6ac40]/15 text-foreground">
          <tr>{head.map(h => <th key={h} className="px-3 py-2 text-right font-bold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{body}</tbody>
      </table>
    </div>
  );
  const maxInstalls = Math.max(0, ...(range?.teams.map(t => t.installs) ?? [0]));
  const maxArea = Math.max(0, ...(range?.printers.map(p => p.area) ?? [0]));
  const maxBucketArea = Math.max(0, ...(range?.buckets.map(b => b.area) ?? [0]));

  const { settings: printSettings } = usePrintTheme(DOCUMENT_TYPES.PRINT_TASK);

  /** الطباعة عبر نظام الطباعة الموحد (نفس قالب كشف طباعة الأمتار) */
  const print = () => {
    if (!range) return;
    const config = createMeasurementsConfigFromSettings(printSettings);
    config.header.title.text = "جرد الطباعة والتركيب";
    config.page.direction = "rtl";
    const columns: PrintColumn[] = [
      { key: "period", header: PERIOD_COL[period], width: "34%", align: "right" },
      { key: "area", header: "متر الطباعة (م²)", width: "33%", align: "center" },
      { key: "installs", header: "عدد التركيبات", width: "33%", align: "center" },
    ];
    const isoDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDay(v) : v;
    const rows = range.buckets.map(b => ({ period: isoDay(b.label), area: num(b.area), installs: b.installs }));
    const cell = "padding:7px 10px;border-bottom:1px solid #e3e3e3;";
    const head = "padding:7px 10px;border:1px solid #cfcfcf;background:#f3f3f3;font-weight:700;text-align:right;";
    const teamsHtml = range.teams.map(t => `<tr><td style="${cell}text-align:right">${escapeHtml(t.name)}</td><td style="${cell}text-align:center;width:120px">${t.installs}</td></tr>`).join("") || `<tr><td colspan="2" style="${cell}text-align:center">لا توجد تركيبات</td></tr>`;
    const printersHtml = range.printers.map(p => `<tr><td style="${cell}text-align:right">${escapeHtml(p.name)}</td><td style="${cell}text-align:center;width:120px">${num(p.area)}</td></tr>`).join("") || `<tr><td colspan="2" style="${cell}text-align:center">لا توجد طباعة</td></tr>`;

    const detRowsCell = "padding:6px 8px;border-bottom:1px solid #e3e3e3;";
    const detHead = (cols: string[]) => "<tr>" + cols.map(c => `<th style=\"padding:6px 8px;border:1px solid #cfcfcf;background:#f3f3f3;text-align:right\">${escapeHtml(c)}</th>`).join("") + "</tr>";
    const instDetailHtml = (det?.installs ?? []).map(r => `<tr><td style=\"${detRowsCell}\">${fmtDay(r.date)}</td><td style=\"${detRowsCell}\">${escapeHtml(r.teamName)}</td><td style=\"${detRowsCell}\">${r.contractId ? "#" + r.contractId : "—"}</td><td style=\"${detRowsCell}\">${escapeHtml(r.customerName || "—")}</td><td style=\"${detRowsCell}\">${escapeHtml(r.adType || "—")}</td><td style=\"${detRowsCell}text-align:center\">${r.installs}</td></tr>`).join("");
    const printDetailHtml = (det?.prints ?? []).map(r => `<tr><td style=\"${detRowsCell}\">${fmtDay(r.date)}</td><td style=\"${detRowsCell}\">${escapeHtml(r.printerName)}</td><td style=\"${detRowsCell}\">${r.contractId ? "#" + r.contractId : "—"}</td><td style=\"${detRowsCell}\">${escapeHtml(r.customerName || "—")}</td><td style=\"${detRowsCell}\">${escapeHtml(r.adType || "—")}</td><td style=\"${detRowsCell}text-align:center\">${num(r.area)} م²</td></tr>`).join("");
    const detailTablesHtml = `
      <div style="margin:14px 0 4px;font-size:13px;font-weight:700">تفاصيل التركيب</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px"><thead>${detHead(["التاريخ","الفرقة","العقد","الزبون","نوع الإعلان","التركيبات"])}</thead><tbody>${instDetailHtml || "<tr><td colspan=\"6\" style=\"padding:8px;text-align:center\">لا توجد تركيبات</td></tr>"}</tbody></table>
      <div style="margin:14px 0 4px;font-size:13px;font-weight:700">تفاصيل الطباعة</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px"><thead>${detHead(["التاريخ","المطبعة","العقد","الزبون","نوع الإعلان","متر الطباعة"])}</thead><tbody>${printDetailHtml || "<tr><td colspan=\"6\" style=\"padding:8px;text-align:center\">لا توجد طباعة</td></tr>"}</tbody></table>`;
    // بعد الجدول الرئيسي: الفرق والمطابع ثم التفاصيل
    const additionalHtml = `
      <div style="margin:14px 0 4px;font-size:13px;font-weight:700">التركيبات حسب الفرقة</div>
      <table style="width:60%;border-collapse:collapse;font-size:12px;margin-bottom:12px"><thead><tr><th style="${head}">الفرقة</th><th style="${head}text-align:center;width:110px">عدد التركيبات</th></tr></thead><tbody>${teamsHtml}</tbody></table>
      <div style="margin:14px 0 4px;font-size:13px;font-weight:700">الطباعة حسب المطبعة</div>
      <table style="width:60%;border-collapse:collapse;font-size:12px;margin-bottom:12px"><thead><tr><th style="${head}">المطبعة</th><th style="${head}text-align:center;width:110px">متر الطباعة (م²)</th></tr></thead><tbody>${printersHtml}</tbody></table>${detailTablesHtml}`;
    openMeasurementsPrintWindow({
      config,
      documentData: {
        title: "جرد الطباعة والتركيب",
        date: fmtDay(localDay(new Date())),
        additionalInfo: [
          { label: "الفترة", value: `${PERIOD_LABEL[period]} · من ${fmtDay(from)} إلى ${fmtDay(to)}` },
          { label: "إجمالي متر الطباعة", value: `${num(range.area)} م²` },
          { label: "إجمالي التركيبات", value: String(range.installs.length) },
        ],
      },
      columns,
      rows,
      statisticsCards: [
        { label: "متر الطباعة في الفترة", value: num(range.area), unit: "م²" },
        { label: "عدد التركيبات في الفترة", value: range.installs.length },
      ],
      additionalContent: additionalHtml,
    }, `جرد الطباعة والتركيب ${from} - ${to}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 text-right">
        <DialogHeader className="space-y-1 bg-[#1d1a14] px-6 py-4 pl-12 text-right text-white shadow-[inset_0_-3px_0_#d6ac40]">
          <DialogTitle className="flex items-center gap-2 text-lg text-white"><Boxes className="h-5 w-5 text-[#d6ac40]" />جرد الطباعة والتركيب</DialogTitle>
          <DialogDescription className="text-xs text-[#e9d7a4]">متر الطباعة وعدد التركيبات حسب الفرق والمطابع</DialogDescription>
        </DialogHeader>

        {/* عناصر التحكم: الفترة ثم النطاق ثم الاختصارات */}
        <div className="grid gap-3 border-b border-border bg-muted/20 px-6 py-3 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Tabs value={period} onValueChange={v => setPeriod(v as InventoryPeriod)}>
            <TabsList>
              {(Object.keys(PERIOD_LABEL) as InventoryPeriod[]).map(p => <TabsTrigger key={p} value={p} className="px-4 text-xs font-bold">{PERIOD_LABEL[p]}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">من</span>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-[150px] bg-background" />
            <span className="text-muted-foreground">إلى</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-[150px] bg-background" />
          </div>
          <div className="flex flex-wrap gap-1.5 md:justify-end">
            {presets(today).map(p => (
              <Button key={p.label} size="sm" variant="outline" className="h-8 bg-background text-xs" onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</Button>
            ))}
          </div>
        </div>
        {invalid && <div className="bg-destructive/10 px-6 py-2 text-xs text-destructive">تاريخ البداية بعد تاريخ النهاية</div>}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {error ? <div className="text-sm text-destructive">{(error as Error).message}</div>
            : isLoading || !range ? <Skeleton className="h-72 w-full rounded-xl" /> : (
              <div className="space-y-4">
                {/* ملخص الفترة */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-[#d6ac40]/40 bg-[#d6ac40]/10 p-4">
                    <div>
                      <div className="text-xs text-muted-foreground">متر الطباعة في الفترة</div>
                      <div className="mt-1 text-2xl font-extrabold tabular-nums">{num(range.area)} <span className="text-sm font-semibold">م²</span></div>
                    </div>
                    <Printer className="h-8 w-8 text-[#b8860b]/70" />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#d6ac40]/40 bg-[#d6ac40]/10 p-4">
                    <div>
                      <div className="text-xs text-muted-foreground">عدد التركيبات في الفترة</div>
                      <div className="mt-1 text-2xl font-extrabold tabular-nums">{range.installs.length}</div>
                    </div>
                    <Wrench className="h-8 w-8 text-[#b8860b]/70" />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                  {/* التفصيل حسب الفترة */}
                  <section className="overflow-hidden rounded-xl border border-border">
                    <header className="flex items-center justify-between border-b-2 border-[#d6ac40] bg-[#d6ac40]/10 px-4 py-2.5 text-sm font-bold">
                      <span>التفصيل حسب {PERIOD_COL[period]}</span>
                      <span className="text-xs font-normal text-muted-foreground">{range.buckets.length} فترة</span>
                    </header>
                    <div className="max-h-[360px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[#d6ac40]/15 text-xs font-bold text-foreground shadow-[inset_0_-1.5px_0_#c9a545]">
                          <tr>
                            <th className="px-4 py-2 text-right font-semibold">{PERIOD_COL[period]}</th>
                            <th className="w-[38%] px-4 py-2 text-right font-semibold">متر الطباعة</th>
                            <th className="w-[80px] px-3 py-2 text-center font-semibold">تركيب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {range.buckets.length === 0 ? (
                            <tr><td colSpan={3} className="py-10 text-center text-xs text-muted-foreground">لا توجد بيانات في هذه الفترة</td></tr>
                          ) : range.buckets.map(b => (
                            <tr key={b.key} className="hover:bg-muted/30">
                              <td className="px-4 py-2 font-semibold tabular-nums">{b.label}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-16 shrink-0 text-xs tabular-nums">{num(b.area)}</span>
                                  <Bar value={b.area} max={maxBucketArea} className="bg-[#d6ac40]" />
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center font-bold tabular-nums">{b.installs || <span className="text-muted-foreground">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* الفرق والمطابع */}
                  <div className="space-y-4">
                    <section className="overflow-hidden rounded-xl border border-border">
                      <header className="border-b-2 border-[#d6ac40] bg-[#d6ac40]/10 px-4 py-2.5 text-sm font-bold">التركيبات حسب الفرقة</header>
                      {range.teams.length === 0 ? <div className="py-6 text-center text-xs text-muted-foreground">لا توجد تركيبات</div> : (
                        <ul className="divide-y divide-border">
                          {range.teams.map(t => (
                            <li key={t.id} className="space-y-1.5 px-4 py-2.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">{t.name}</span>
                                <span className="font-extrabold tabular-nums">{t.installs}</span>
                              </div>
                              <Bar value={t.installs} max={maxInstalls} className="bg-[#2e7d5b]" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="overflow-hidden rounded-xl border border-border">
                      <header className="border-b-2 border-[#d6ac40] bg-[#d6ac40]/10 px-4 py-2.5 text-sm font-bold">الطباعة حسب المطبعة</header>
                      {range.printers.length === 0 ? <div className="py-6 text-center text-xs text-muted-foreground">لا توجد طباعة</div> : (
                        <ul className="divide-y divide-border">
                          {range.printers.map(p => (
                            <li key={p.id} className="space-y-1.5 px-4 py-2.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">{p.name}</span>
                                <span className="font-extrabold tabular-nums">{num(p.area)} م²</span>
                              </div>
                              <Bar value={p.area} max={maxArea} className="bg-[#3b6ea5]" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </div>
                {det && (
                  <div className="space-y-4">
                    <section className="space-y-2">
                      <div className="text-sm font-bold">تفاصيل التركيب ({det.installs.length} سجل)</div>
                      {det.installs.length === 0 ? <div className="text-xs text-muted-foreground">لا توجد تركيبات</div> : (
                        <DetailTable head={["التاريخ", "الفرقة", "العقد", "الزبون", "نوع الإعلان", "التركيبات"]} body={det.installs.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDay(r.date)}</td>
                            <td className="px-3 py-1.5">{r.teamName}</td>
                            <td className="px-3 py-1.5 tabular-nums">{r.contractId ? `#${r.contractId}` : "—"}</td>
                            <td className="px-3 py-1.5">{r.customerName || "—"}</td>
                            <td className="px-3 py-1.5">{r.adType || "—"}</td>
                            <td className="px-3 py-1.5 text-center font-bold tabular-nums">{r.installs}</td>
                          </tr>))} />
                      )}
                    </section>
                    <section className="space-y-2">
                      <div className="text-sm font-bold">تفاصيل الطباعة ({det.prints.length} سجل)</div>
                      {det.prints.length === 0 ? <div className="text-xs text-muted-foreground">لا توجد طباعة</div> : (
                        <DetailTable head={["التاريخ", "المطبعة", "العقد", "الزبون", "نوع الإعلان", "متر الطباعة"]} body={det.prints.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDay(r.date)}</td>
                            <td className="px-3 py-1.5">{r.printerName}</td>
                            <td className="px-3 py-1.5 tabular-nums">{r.contractId ? `#${r.contractId}` : "—"}</td>
                            <td className="px-3 py-1.5">{r.customerName || "—"}</td>
                            <td className="px-3 py-1.5">{r.adType || "—"}</td>
                            <td className="px-3 py-1.5 text-center font-bold tabular-nums">{num(r.area)} م²</td>
                          </tr>))} />
                      )}
                    </section>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">الطباعة تُحتسب بتاريخ إنشاء أمر الطباعة، والتركيب بتاريخ تنفيذ اللوحة.</p>
              </div>
            )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-3">
          <span className="text-xs text-muted-foreground">{range ? `${fmtDay(from)} ← ${fmtDay(to)}` : ''}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
            <Button onClick={print} disabled={!range || invalid} className="gap-2"><Printer className="h-4 w-4" />طباعة الجرد</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
