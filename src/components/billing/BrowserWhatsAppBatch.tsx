import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, Link2, MessageSquare, Pause, Search, Send, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { whatsappBrowserRequest, type BrowserBatch, type BrowserRecipient } from '@/lib/whatsappBrowser';
import { normalizePhone } from '../../../extensions/alfares-whatsapp/queue.js';

const labels: Record<string,string> = {pending:'بالانتظار',loading:'تجهيز المحادثة',clicking:'جارٍ الإرسال',sent:'أُرسلت',error:'تعذرت',unknown:'غير مؤكدة',cancelled:'أُلغيت',review:'بانتظار البدء من الإضافة',running:'الإرسال التلقائي جارٍ',paused:'متوقفة مؤقتًا — استأنف من أيقونة الإضافة',complete:'اكتملت الدفعة'};
const tone: Record<string,string> = {sent:'text-emerald-600 dark:text-emerald-400',error:'text-destructive',unknown:'text-destructive',loading:'text-amber-600',clicking:'text-amber-600'};

export function BrowserWhatsAppBatch({recipients}: {recipients: BrowserRecipient[]}) {
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [edits,setEdits]=useState<Record<string,string>>({});
  const [preview,setPreview]=useState<string|null>(null);
  const [batch,setBatch]=useState<BrowserBatch|null>(null);
  const [connected,setConnected]=useState(false);
  const [whatsappOpen,setWhatsappOpen]=useState(true);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const rows=useMemo(()=>recipients.map(row=>({...row,phone:normalizePhone(row.phone)})),[recipients]);
  const visible=rows.filter(row=>`${row.name} ${row.phone}`.includes(search.trim()));
  const eligible=visible.filter(row=>row.phone);
  const chosen=rows.filter(row=>selected.has(row.id)&&row.phone);
  const active=!!batch&&['review','running','paused'].includes(batch.state);
  const allVisible=eligible.length>0&&eligible.every(row=>selected.has(row.id));
  const selectedPreview=rows.find(row=>row.id===preview);
  const duplicate=chosen.some((row,index)=>chosen.findIndex(other=>other.phone===row.phone)!==index);
  const payload=()=>chosen.map(row=>({...row,message:edits[row.id]??row.message}));
  const ready=connected&&!busy&&!active&&chosen.length>0&&chosen.length<=200&&!duplicate&&!chosen.some(row=>!(edits[row.id]??row.message).trim());
  const done=batch?batch.items.filter(row=>!['pending','loading','clicking'].includes(row.status)).length:0;
  async function request(action:Parameters<typeof whatsappBrowserRequest>[0],data?:BrowserRecipient[],autoStart?:boolean,quiet=false) {
    setBusy(true);if(!quiet)setError('');
    try {const result=await (autoStart?whatsappBrowserRequest(action,data,{autoStart:true}):data?whatsappBrowserRequest(action,data):whatsappBrowserRequest(action));setConnected(true);if('whatsappOpen'in result)setWhatsappOpen(!!result.whatsappOpen);if('batch'in result)setBatch(result.batch||null);}
    catch(err){if(!quiet)setError(err instanceof Error?err.message:'تعذر الاتصال');if(action==='STATUS')setConnected(false);}
    finally{setBusy(false);setChecked(true);}
  }
  // Detect the extension silently; the system pages are connected automatically from version 1.2.
  useEffect(()=>{request('STATUS',undefined,false,true);},[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!connected)return;
    let disposed=false;
    const timer=window.setInterval(()=>{whatsappBrowserRequest('STATUS').then(result=>{if(!disposed){setBatch(result.batch||null);if('whatsappOpen'in result)setWhatsappOpen(!!result.whatsappOpen);}}).catch(err=>{if(!disposed){setConnected(false);setError(err.message);}});},2000);
    return()=>{disposed=true;window.clearInterval(timer);};
  },[connected]);
  function toggleVisible(){setSelected(old=>{const next=new Set(old);eligible.forEach(row=>{if(allVisible)next.delete(row.id);else next.add(row.id);});return next;});}
  function autoSend(){
    if(!window.confirm(`سيتم إرسال ${chosen.length} رسالة تلقائيًا عبر واتساب ويب، رسالة بعد أخرى.\nاترك تبويب واتساب مفتوحًا حتى تنتهي. متابعة؟`))return;
    request('PREPARE',payload(),true);
  }
  return <section dir="rtl" className="space-y-4 text-right">
    <div className={`rounded-xl border p-4 ${connected?'border-emerald-500/30 bg-emerald-500/5':'border-primary/25 bg-primary/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="flex items-center gap-2 font-bold"><Zap className="h-4 w-4 text-primary"/>الإرسال التلقائي عبر واتساب ويب</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">تفتح الإضافة كل محادثة في نفس تبويب واتساب وتضغط إرسال تلقائيًا، ثم تنتقل للتالي.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {connected?<span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4"/>الإضافة متصلة</span>:checked&&<span className="text-xs text-muted-foreground">الإضافة غير متصلة</span>}
          <Button variant="outline" size="sm" onClick={()=>request('STATUS')} disabled={busy}><Link2 className="h-4 w-4"/>{connected?'تحديث':'فحص الاتصال'}</Button>
        </div>
      </div>
      {connected&&!whatsappOpen&&<p className="mt-2 text-xs text-amber-600">واتساب ويب غير مفتوح — سيُفتح تلقائيًا عند البدء، تأكد أنك مسجّل الدخول فيه.</p>}
      {checked&&!connected&&<details open className="mt-3 rounded-lg border bg-background p-3 text-sm leading-7"><summary className="cursor-pointer font-semibold">تثبيت الإضافة (مرة واحدة)</summary>
        <Button variant="outline" size="sm" className="my-2" asChild><a href="/downloads/alfares-whatsapp.zip" download><Download className="h-4 w-4"/>تنزيل الإضافة (ZIP)</a></Button>
        <ol className="list-inside list-decimal space-y-1"><li>فك ضغط الملف في مجلد ثابت (لا تحذفه بعد التثبيت).</li><li>افتح <code dir="ltr" className="select-all rounded bg-muted px-1">chrome://extensions</code> وفعّل «وضع المطوّر».</li><li>اضغط «تحميل إضافة غير مضغوطة» واختر المجلد. إن كانت مثبتة سابقًا اضغط زر التحديث ↻ عليها.</li><li>حدّث صفحة النظام ثم اضغط «فحص الاتصال». لا حاجة للربط اليدوي.</li></ol>
      </details>}
    </div>
    {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {batch&&<div className="space-y-3 rounded-xl border p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{labels[batch.state]||batch.state}</h3><span className="text-sm">{done} / {batch.items.length} · أُرسلت {batch.items.filter(row=>row.status==='sent').length}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{width:`${batch.items.length?done/batch.items.length*100:0}%`}}/></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>request('REVIEW')} disabled={busy}><Eye className="h-4 w-4"/>فتح نافذة الإضافة</Button><Button variant="outline" size="sm" onClick={()=>request('PAUSE')} disabled={busy||batch.state!=='running'}><Pause className="h-4 w-4"/>إيقاف مؤقت</Button><Button variant="outline" size="sm" onClick={()=>request('CANCEL')} disabled={busy||!active}><X className="h-4 w-4"/>إلغاء المتبقي</Button></div>
      <div className="max-h-48 space-y-1 overflow-y-auto">{batch.items.map(row=><div key={row.id} className="rounded-lg bg-muted/40 px-3 py-2 text-xs"><div className="flex justify-between gap-2"><span>{row.name}</span><span className={tone[row.status]||'text-muted-foreground'}>{labels[row.status]||row.status}</span></div>{row.error&&<p className="mt-1 text-destructive">{row.error}</p>}</div>)}</div>
    </div>}
    <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="بحث المستلمين" placeholder="ابحث بالاسم أو الرقم..." value={search} onChange={event=>setSearch(event.target.value)} className="pr-9"/></div><Button variant="outline" onClick={toggleVisible} disabled={active||!eligible.length}>{allVisible?'إلغاء تحديد النتائج':'تحديد كل النتائج'}</Button><Button variant="ghost" onClick={()=>setSelected(new Set())} disabled={active||!selected.size}>إلغاء التحديد</Button></div>
    <p className="text-xs text-muted-foreground">{chosen.length} محدد · {rows.filter(row=>!row.phone).length} بدون رقم صالح · الحد الأقصى 200 مستلم.</p>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border p-2">{visible.map(row=><div key={row.id} className={`flex items-center gap-3 rounded-lg border p-3 ${selected.has(row.id)?'border-primary/40 bg-primary/5':'border-transparent bg-muted/30'}`}>
        <input type="checkbox" aria-label={`تحديد ${row.name}`} className="h-4 w-4 cursor-pointer accent-primary" checked={selected.has(row.id)} disabled={active||!row.phone} onChange={()=>setSelected(old=>{const next=new Set(old);next.has(row.id)?next.delete(row.id):next.add(row.id);return next;})}/>
        <button type="button" className="min-w-0 flex-1 cursor-pointer text-right transition-colors hover:text-primary" onClick={()=>setPreview(row.id)}><span className="block font-semibold">{row.name}</span><span className="block text-xs text-muted-foreground" dir="ltr">{row.phone||'بدون رقم صالح'}</span></button><Button variant="ghost" size="sm" aria-label={`معاينة رسالة ${row.name}`} onClick={()=>setPreview(row.id)}>معاينة</Button>
      </div>)}{!visible.length&&<p className="p-4 text-sm text-muted-foreground">لا توجد نتائج.</p>}</div>
      <div className="rounded-xl border p-3">{selectedPreview?<><label className="mb-2 block text-sm font-semibold" htmlFor="batch-message">رسالة {selectedPreview.name}</label><Textarea id="batch-message" value={edits[selectedPreview.id]??selectedPreview.message} disabled={active} maxLength={20000} onChange={event=>setEdits(old=>({...old,[selectedPreview.id]:event.target.value}))} className="min-h-64 leading-7"/><Button variant="ghost" size="sm" disabled={active} onClick={()=>setEdits(old=>{const next={...old};delete next[selectedPreview.id];return next;})}>استعادة الرسالة الأصلية</Button></>:<p className="p-6 text-center text-sm text-muted-foreground">اختر «معاينة» لقراءة رسالة المستلم وتعديلها قبل الإرسال.</p>}</div>
    </div>
    {duplicate&&<p role="alert" className="text-sm text-destructive">رقم مشترك: {chosen.filter((row)=>chosen.some(other=>other.id!==row.id&&other.phone===row.phone)).map(row=>row.name).join('، ')}. اختر مستلمًا واحدًا لكل رقم.</p>}
    <div className="flex flex-wrap gap-2">
      <Button onClick={autoSend} disabled={!ready} className="bg-emerald-600 text-white hover:bg-emerald-700"><Send className="h-4 w-4"/>إرسال تلقائي الآن ({chosen.length})</Button>
      <Button variant="outline" onClick={()=>request('PREPARE',payload())} disabled={!ready}><Eye className="h-4 w-4"/>مراجعة وبدء دفعة من الإضافة</Button>
    </div>
  </section>;
}

export function BrowserWhatsAppBatchDialog({recipients}:{recipients:BrowserRecipient[]}) {
  return <Dialog><DialogTrigger asChild><Button><MessageSquare className="h-4 w-4"/>إرسال جماعي عبر المتصفح</Button></DialogTrigger><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>إرسال جماعي عبر واتساب</DialogTitle></DialogHeader><BrowserWhatsAppBatch recipients={recipients}/></DialogContent></Dialog>;
}
