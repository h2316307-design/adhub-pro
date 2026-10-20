import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, RotateCcw, Search, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { whatsappBrowserRequest, type BrowserRecipient } from '@/lib/whatsappBrowser';
import { normalizePhone } from '../../../extensions/alfares-whatsapp/queue.js';
import { toast } from 'sonner';

export function whatsappChatUrl(phone:string|undefined|null,message:string,web=false):string {
  const number=normalizePhone(phone);
  if(!number)return '';
  return web?`https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`:`https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type ChatMode='app'|'extension'|'web';
const MODE_KEY='alfares-whatsapp-open-mode';
export const CHAT_MODES:{value:ChatMode;label:string}[]=[
  {value:'app',label:'تطبيق واتساب على الجهاز (بدون تبويبات)'},
  {value:'extension',label:'واتساب ويب — نفس التبويب (عبر الإضافة)'},
  {value:'web',label:'واتساب ويب — تبويب جديد كل مرة'},
];
export function getChatMode():ChatMode{try{const value=localStorage.getItem(MODE_KEY);if(value==='app'||value==='extension'||value==='web')return value;}catch{}return 'app';}

/** Opens a chat with the message typed. WhatsApp Web cannot be reused from a page (its COOP header drops the window name), so 'app' and 'extension' avoid new tabs. */
export async function openWhatsAppChat(phone:string|undefined|null,message:string,mode=getChatMode()):Promise<boolean>{
  const number=normalizePhone(phone);
  if(!number){toast.error('رقم الهاتف غير صالح');return false;}
  if(mode==='app'){window.location.href=`whatsapp://send?phone=${number}&text=${encodeURIComponent(message)}`;return true;}
  if(mode==='extension'){
    try{await whatsappBrowserRequest('OPEN_CHAT',{phone:number,message});return true;}
    catch(error){toast.error(error instanceof Error?error.message:'تعذر الاتصال بالإضافة',{description:'حدّث الإضافة إلى الإصدار 1.1 واربط صفحة النظام، أو اختر طريقة فتح أخرى.'});return false;}
  }
  window.open(whatsappChatUrl(number,message,true),'_blank','noopener,noreferrer');return true;
}

export function ChatModeSelect({className=''}:{className?:string}){
  const [mode,setMode]=useState<ChatMode>(getChatMode);
  return <select aria-label="طريقة فتح المحادثة" title="طريقة فتح المحادثة" value={mode} onChange={event=>{const value=event.target.value as ChatMode;setMode(value);try{localStorage.setItem(MODE_KEY,value);}catch{}}} className={`h-9 cursor-pointer rounded-md border bg-background px-2 text-xs ${className}`}>{CHAT_MODES.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

type Status='opened'|'skipped';

/** Manual one-by-one sending: opens each chat with the message ready; the user presses send in WhatsApp. */
export function ManualWhatsAppQueue({recipients}:{recipients:BrowserRecipient[]}) {
  const rows=useMemo(()=>recipients.map(row=>({...row,phone:normalizePhone(row.phone)})),[recipients]);
  const [status,setStatus]=useState<Record<string,Status>>({});
  const [edits,setEdits]=useState<Record<string,string>>({});
  const [index,setIndex]=useState(0);
  const [search,setSearch]=useState('');
  const current=rows[Math.min(index,rows.length-1)];
  const done=rows.filter(row=>status[row.id]).length;
  const withPhone=rows.filter(row=>row.phone).length;
  const visible=rows.map((row,i)=>({row,i})).filter(({row})=>`${row.name} ${row.phone}`.includes(search.trim()));
  const text=(id:string,fallback:string)=>edits[id]??fallback;
  function nextPending(from:number){for(let i=from+1;i<rows.length;i++)if(!status[rows[i].id]&&rows[i].phone)return i;return Math.min(from+1,rows.length-1);}
  async function open(){
    if(!current?.phone)return;
    if(!await openWhatsAppChat(current.phone,text(current.id,current.message)))return;
    setStatus(old=>({...old,[current.id]:'opened'}));
    setIndex(nextPending(index));
  }
  function skip(){if(!current)return;setStatus(old=>({...old,[current.id]:'skipped'}));setIndex(nextPending(index));}
  if(!rows.length)return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">لا يوجد مستلمون.</p>;
  return <section dir="rtl" className="space-y-3 text-right">
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">الإرسال اليدوي: {done} من {rows.length}</span><span className="text-xs text-muted-foreground">{rows.length-withPhone} بدون رقم صالح</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{width:`${rows.length?done/rows.length*100:0}%`}}/></div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">اضغط «فتح المحادثة» فتُفتح محادثة الزبون والرسالة جاهزة، اضغط إرسال في واتساب ثم ارجع هنا للتالي. اختر «تطبيق واتساب» أو «نفس التبويب» لتجنب فتح تبويب جديد لكل زبون.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-2">
        <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="بحث المستلمين" placeholder="بحث بالاسم أو الرقم" value={search} onChange={event=>setSearch(event.target.value)} className="pr-9"/></div>
        <ol className="max-h-80 space-y-1 overflow-y-auto rounded-xl border p-1">{visible.map(({row,i})=><li key={row.id}><button type="button" onClick={()=>setIndex(i)} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-right text-sm transition-colors hover:bg-muted ${i===index?'bg-primary/10 ring-1 ring-primary/40':''}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${status[row.id]==='opened'?'bg-primary text-primary-foreground':status[row.id]==='skipped'?'bg-muted-foreground/30':'bg-muted'}`}>{status[row.id]==='opened'?<Check className="h-3.5 w-3.5"/>:i+1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{row.name}</span><span className="block text-[11px] text-muted-foreground" dir="ltr">{row.phone||'بدون رقم'}</span></span>
          {status[row.id]==='skipped'&&<span className="text-[10px] text-muted-foreground">تخطي</span>}
        </button></li>)}</ol>
        {done>0&&<Button variant="ghost" size="sm" onClick={()=>{setStatus({});setIndex(0);}}><RotateCcw className="h-4 w-4"/>إعادة تعيين التقدم</Button>}
      </div>
      {current&&<div className="space-y-2 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{current.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{current.phone||'بدون رقم صالح — عدّل رقم الزبون أولًا'}</p></div><span className="text-xs text-muted-foreground">{index+1} / {rows.length}</span></div>
        <Textarea aria-label={`رسالة ${current.name}`} value={text(current.id,current.message)} maxLength={20000} onChange={event=>setEdits(old=>({...old,[current.id]:event.target.value}))} className="min-h-56 leading-7"/>
        <div className="flex flex-wrap gap-2">
          <Button onClick={open} disabled={!current.phone||!text(current.id,current.message).trim()} className="flex-1"><ExternalLink className="h-4 w-4"/>فتح المحادثة</Button>
          <Button variant="outline" onClick={()=>navigator.clipboard.writeText(text(current.id,current.message)).then(()=>toast.success('تم نسخ الرسالة'))}><Copy className="h-4 w-4"/>نسخ</Button>
          <Button variant="ghost" onClick={skip}><SkipForward className="h-4 w-4"/>تخطي</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <ChatModeSelect className="min-w-0 flex-1"/>
          <div className="flex gap-1"><Button variant="outline" size="sm" aria-label="السابق" disabled={index<=0} onClick={()=>setIndex(i=>i-1)}><ChevronRight className="h-4 w-4"/></Button><Button variant="outline" size="sm" aria-label="التالي" disabled={index>=rows.length-1} onClick={()=>setIndex(i=>i+1)}><ChevronLeft className="h-4 w-4"/></Button></div>
        </div>
      </div>}
    </div>
  </section>;
}
