import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ArrowUpLeft, MessageSquare, MessageCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ContractDesignThumbnail } from '@/components/composite-tasks/list/ContractDesignThumbnail';
import { ChatModeSelect, openWhatsAppChat } from '@/components/shared/ManualWhatsAppQueue';
import { useExpiryContacts } from '@/hooks/useExpiryContacts';
import { normalizePhone } from '../../../extensions/alfares-whatsapp/queue.js';
import { expiryContracts, expiryLabel, expiryMessage, type ExpirySource, type ExpiryContract } from '@/lib/contractExpiry';

type Scope='all'|'soon'|'expired';
const ALL_TIME=100000;

function urgency(days:number){return days<0?'border-r-4 border-r-destructive/70':days<=7?'border-r-4 border-r-amber-500/80':'border-r-4 border-r-primary/40';}

export function ContractExpiryWorkspace({contracts,onMessage,compact=false,contacts}:{contracts:ExpirySource[];onMessage:(contracts:ExpiryContract[])=>void;compact?:boolean;contacts?:{phones:Map<string,string>;template:string}}) {
  const rows=useMemo(()=>expiryContracts(contracts),[contracts]);
  const own=useExpiryContacts(contracts,!contacts);
  const {phones,template}=contacts||own;
  const [view,setView]=useState<Scope>('all');
  const [days,setDays]=useState(30),[search,setSearch]=useState(''),[selected,setSelected]=useState<Set<number>>(new Set()),[detail,setDetail]=useState<number|null>(null),[limit,setLimit]=useState(12);
  const soon=rows.filter(row=>row.days>=0&&row.days<=days).sort((a,b)=>a.days-b.days);
  const expired=rows.filter(row=>row.days<0&&-row.days<=days).sort((a,b)=>b.days-a.days);
  const scoped=view==='soon'?soon:view==='expired'?expired:[...soon,...expired];
  const filtered=scoped.filter(row=>`${row.name} ${row.number} ${row.adType}`.includes(search.trim()));
  const chosen=rows.filter(row=>selected.has(row.number));
  const all=filtered.length>0&&filtered.every(row=>selected.has(row.number));
  const focused=filtered.find(row=>row.number===detail)||filtered[0];
  const shown=filtered.slice(0,limit);
  function scope(next:Scope){setView(next);setSelected(new Set());setLimit(12);setDetail(null);}
  function ChatLink({row,full=false}:{row:ExpiryContract;full?:boolean}){
    const phone=normalizePhone(phones.get(row.customerId)||row.phone);
    return phone?<Button variant="outline" size="sm" onClick={()=>openWhatsAppChat(phone,expiryMessage(row,template))} aria-label={`فتح محادثة واتساب مع ${row.name}`} className={`border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400 ${full?'w-full':''}`}><MessageCircle className="h-4 w-4"/>محادثة</Button>
      :<Button variant="outline" size="sm" disabled title="لا يوجد رقم هاتف صالح للزبون" className={full?'w-full':''}><MessageCircle className="h-4 w-4"/>بدون رقم</Button>;
  }
  const tile=(key:Scope,label:string,count:number,tone='')=><button onClick={()=>scope(key)} aria-pressed={view===key} className={`cursor-pointer rounded-xl border p-3 text-right transition-colors hover:border-primary/50 ${view===key?'border-primary/40 bg-primary/5':''}`}><span className="block text-xs text-muted-foreground">{label}</span><strong className={`mt-1 block text-xl ${tone}`}>{count}</strong></button>;
  const period=days===ALL_TIME?'كل الفترات':`${days} يوم`;
  return <section dir="rtl" className="overflow-hidden rounded-2xl border bg-card text-right">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5"><div><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5 text-primary"/>متابعة انتهاء العقود</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">العقود القريبة من الانتهاء والمنتهية خلال {period}، مع التواصل المباشر مع الزبون.</p></div>{compact&&<Button variant="outline" size="sm" asChild><Link to="/admin/contracts">إدارة العقود<ArrowUpLeft className="h-4 w-4"/></Link></Button>}</header>
    <div className="space-y-4 p-3 sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tile('all','الكل (قريبة + منتهية)',soon.length+expired.length)}{tile('soon',`تنتهي خلال ${period}`,soon.length,'text-amber-600')}{tile('expired','عقود منتهية',expired.length,'text-destructive')}<div className="rounded-xl border p-3"><span className="block text-xs text-muted-foreground">تنتهي اليوم</span><strong className="mt-1 block text-xl">{rows.filter(row=>row.days===0).length}</strong></div></div>
      <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="بحث عقود الانتهاء" className="pr-9" placeholder="اسم الزبون، رقم العقد أو نوع الإعلان" value={search} onChange={event=>{setSearch(event.target.value);setLimit(12);}}/></div><select aria-label="الفترة" value={days} onChange={event=>{setDays(Number(event.target.value));setSelected(new Set());setLimit(12);}} className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm">{[7,14,30,60,90,180,365].map(value=><option key={value} value={value}>± {value} يوم</option>)}<option value={ALL_TIME}>كل الفترات</option></select><ChatModeSelect className="h-10 max-w-full"/></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={!filtered.length} onClick={()=>setSelected(old=>{const next=new Set(old);filtered.forEach(row=>all?next.delete(row.number):next.add(row.number));return next;})}>{all?'إلغاء تحديد النتائج':'تحديد كل النتائج'}</Button><span className="text-xs text-muted-foreground">{filtered.length} عقد · {chosen.length} محدد</span>{chosen.length>0&&<Button size="sm" variant="ghost" onClick={()=>setSelected(new Set())}>مسح التحديد</Button>}</div><Button size="sm" disabled={!chosen.length} onClick={()=>onMessage(chosen)}><MessageSquare className="h-4 w-4"/>إرسال للمحدد ({chosen.length})</Button></div>
      <div className={`grid gap-4 ${!compact?'lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]':''}`}>
        <div className="min-w-0 space-y-2"><div className={`grid gap-2 ${compact?'sm:grid-cols-2':''}`}>{shown.map((row,i)=>{
          const heading=view==='all'&&(i===0||(shown[i-1].days<0)!==(row.days<0));
          return <Fragment key={row.number}>
          {heading&&<h3 className={`pt-2 text-sm font-bold ${compact?'sm:col-span-2':''} ${row.days<0?'text-destructive':'text-amber-600'}`}>{row.days<0?`منتهية (${expired.filter(r=>filtered.includes(r)).length})`:`تنتهي قريبًا (${soon.filter(r=>filtered.includes(r)).length})`}</h3>}
          <article className={`rounded-xl border p-3 transition-colors ${urgency(row.days)} ${selected.has(row.number)?'border-primary/40 bg-primary/5':'bg-muted/20'}`}>
          <div className="flex items-start gap-3"><input type="checkbox" aria-label={`تحديد عقد ${row.number}`} checked={selected.has(row.number)} onChange={()=>setSelected(old=>{const next=new Set(old);next.has(row.number)?next.delete(row.number):next.add(row.number);return next;})} className="mt-1 h-4 w-4 cursor-pointer accent-primary"/><button className="min-w-0 flex-1 cursor-pointer text-right transition-colors hover:text-primary" onClick={()=>setDetail(row.number)}><span className="block font-bold">{row.name}</span><span className="mt-1 block text-xs text-muted-foreground">عقد #{row.number} · {row.adType}</span></button><Badge variant={row.days<0?'destructive':'secondary'} className="shrink-0 text-[10px]">{expiryLabel(row.days)}</Badge></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-muted-foreground">{row.endDate} · {row.count} لوحة</span><div className="flex flex-wrap gap-1"><Button asChild variant="ghost" size="sm"><Link to={`/admin/contracts/view/${row.number}`}>فتح العقد<ArrowUpLeft className="h-3.5 w-3.5"/></Link></Button><Button variant="outline" size="sm" onClick={()=>onMessage([row])}>تذكير</Button><ChatLink row={row}/></div></div>
        </article></Fragment>;})}</div>{!filtered.length&&<p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد عقود مطابقة لهذه الفترة أو البحث.</p>}{filtered.length>limit&&<Button className="w-full" variant="outline" onClick={()=>setLimit(old=>old+12)}>عرض المزيد ({filtered.length-limit})</Button>}</div>
        {!compact&&focused&&<aside className="h-fit space-y-3 rounded-xl border p-4 lg:sticky lg:top-0"><div className="flex justify-between gap-2"><h3 className="font-bold">تفاصيل عقد #{focused.number}</h3><Badge variant={focused.days<0?'destructive':'outline'}>{expiryLabel(focused.days)}</Badge></div><ContractDesignThumbnail contractId={focused.number} className="h-52 w-full"/><p className="font-semibold">{focused.name}</p><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">نوع الإعلان</dt><dd className="mt-1">{focused.adType}</dd></div><div><dt className="text-muted-foreground">عدد اللوحات</dt><dd className="mt-1">{focused.count}</dd></div><div><dt className="text-muted-foreground">بداية العقد</dt><dd className="mt-1">{focused.startDate?.slice(0,10)||'غير محدد'}</dd></div><div><dt className="text-muted-foreground">نهاية العقد</dt><dd className="mt-1">{focused.endDate}</dd></div></dl><div className="grid grid-cols-2 gap-2"><Button onClick={()=>onMessage([focused])}>معاينة التنبيه</Button><ChatLink row={focused} full/></div></aside>}
      </div>
    </div>
  </section>;
}
