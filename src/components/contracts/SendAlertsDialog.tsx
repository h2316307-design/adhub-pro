import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BrowserWhatsAppBatch } from '@/components/billing/BrowserWhatsAppBatch';
import { InlinePhoneEditor } from '@/components/shared/InlinePhoneEditor';
import { ContractExpiryWorkspace } from './ContractExpiryWorkspace';
import { expiryContracts, expiryLabel, expiryRecipients, tripoliDate, type ExpiryContract, type ExpirySource } from '@/lib/contractExpiry';
import { DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE } from '@/utils/messageTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { useSendTextly } from '@/hooks/useSendTextly';
import { normalizePhone } from '../../../extensions/alfares-whatsapp/queue.js';
import { toast } from 'sonner';

interface Props { open:boolean; onOpenChange:(open:boolean)=>void; contracts:ExpirySource[]; initialSelection?:number[] }
export function SendAlertsDialog({open,onOpenChange,contracts,initialSelection}:Props) {
  const [view,setView]=useState<'contracts'|'customers'|'management'|'other'>('contracts');
  const [chosen,setChosen]=useState<ExpiryContract[]>([]);
  const [phones,setPhones]=useState<Map<string,string>>(new Map());
  const [management,setManagement]=useState<{id:string;phone_number:string;label?:string}[]>([]);
  const [template,setTemplate]=useState(DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const [individual,setIndividual]=useState(''),[draft,setDraft]=useState('');
  const [service,setService]=useState('whatsapp');
  const whatsapp=useSendWhatsApp(),textly=useSendTextly();
  const recipients=useMemo(()=>expiryRecipients(chosen,template,phones),[chosen,template,phones]);
  const report=['تقرير متابعة انتهاء العقود',`التاريخ: ${tripoliDate()}`,...chosen.map(row=>`عقد #${row.number} — ${row.name} — ${row.adType} — ${row.endDate} — ${expiryLabel(row.days)}`),`إجمالي العقود: ${chosen.length}`].join('\n');
  async function loadManagement(){const result=await supabase.from('management_phones').select('id,phone_number,label').eq('is_active',true);if(!result.error)setManagement(result.data||[]);}
  useEffect(()=>{
    if(!open)return;
    setChosen(initialSelection?.length?expiryContracts(contracts).filter(row=>initialSelection.includes(row.number)):[]);
    setView(initialSelection?.length?'customers':'contracts');setError('');setLoading(true);
    let cancelled=false;
    async function load(){
      try{
        const ids=[...new Set(contracts.map(contract=>String(contract.customer_id||'')).filter(Boolean))];
        const phoneMap=new Map<string,string>();
        for(let i=0;i<ids.length;i+=200){const result=await supabase.from('customers').select('id,phone').in('id',ids.slice(i,i+200));if(result.error)throw result.error;result.data?.forEach(customer=>{if(customer.phone)phoneMap.set(customer.id,customer.phone);});}
        const [settings,managementResult]=await Promise.all([supabase.from('system_settings').select('setting_value').eq('setting_key','contract_expiry_alert_template').maybeSingle(),supabase.from('management_phones').select('id,phone_number,label').eq('is_active',true)]);
        if(cancelled)return;
        setPhones(phoneMap);setTemplate(settings.data?.setting_value||DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE);setManagement(managementResult.data||[]);
        if(settings.error||managementResult.error)setError('تعذر تحميل بعض إعدادات التنبيه. يمكنك استخدام رسالة الزبون الافتراضية.');
      }catch{if(!cancelled)setError('تعذر تحميل أرقام الزبائن. أغلق النافذة وأعد فتحها للمحاولة مجددًا.');}
      finally{if(!cancelled)setLoading(false);}
    }
    load();return()=>{cancelled=true;};
  },[open,contracts,initialSelection]);
  function message(rows:ExpiryContract[]){setChosen(rows);setView('customers');setIndividual('');setDraft('');}
  const current=recipients.find(row=>row.id===individual);
  async function sendService(){if(!current?.phone||!draft.trim())return;await(service==='textly'?textly.sendMessage:whatsapp.sendMessage)({phone:current.phone,message:draft});}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="flex max-h-[94dvh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
    <DialogHeader className="shrink-0 border-b p-5 pl-12"><DialogTitle>العقود المنتهية والقريبة من الانتهاء</DialogTitle><p className="text-sm text-muted-foreground">اختر العقود، ثم راجع المستلمين ورسائل التجديد قبل الإرسال.</p></DialogHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      {view==='contracts'?<ContractExpiryWorkspace contracts={contracts} onMessage={message}/>:<div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={()=>setView('contracts')}><ArrowRight className="h-4 w-4"/>العودة للعقود</Button><span className="text-sm text-muted-foreground">{chosen.length} عقد · {recipients.length} زبون</span></div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="جهة الإرسال"><Button role="tab" aria-selected={view==='customers'} variant={view==='customers'?'default':'outline'} onClick={()=>setView('customers')}>تنبيه الزبائن</Button><Button role="tab" aria-selected={view==='management'} variant={view==='management'?'default':'outline'} onClick={()=>setView('management')}>تقرير الإدارة</Button><Button role="tab" aria-selected={view==='other'} variant={view==='other'?'default':'outline'} onClick={()=>setView('other')}>طرق الإرسال الأخرى</Button></div>
        {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        {loading?<p className="p-8 text-center text-muted-foreground">جاري تحميل أرقام التواصل...</p>:<>
          {view==='customers'&&<BrowserWhatsAppBatch key="customers" recipients={recipients}/>}
          {view==='management'&&<><InlinePhoneEditor phones={management} onPhonesUpdated={loadManagement}/><BrowserWhatsAppBatch key="management" recipients={management.map(row=>({id:row.id,name:row.label||'الإدارة',phone:row.phone_number,message:report}))}/></>}
          {view==='other'&&<div className="space-y-3 rounded-xl border p-4"><p className="text-sm text-muted-foreground">إرسال فردي عبر الخدمة المرتبطة أو فتح رسالة جاهزة في واتساب.</p><select className="w-full cursor-pointer rounded-lg border bg-background p-3" aria-label="مستلم التنبيه الفردي" value={individual} onChange={event=>{setIndividual(event.target.value);setDraft(recipients.find(row=>row.id===event.target.value)?.message||'');}}><option value="">اختر الزبون</option>{recipients.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select><Textarea aria-label="رسالة التنبيه الفردي" value={draft} onChange={event=>setDraft(event.target.value)} className="min-h-60"/><div className="flex flex-wrap gap-2"><select aria-label="خدمة الإرسال" value={service} onChange={event=>setService(event.target.value)} className="cursor-pointer rounded-lg border bg-background px-3"><option value="whatsapp">خدمة واتساب المرتبطة</option><option value="textly">Textly</option></select><Button disabled={!normalizePhone(current?.phone)||!draft.trim()||whatsapp.loading||textly.loading} onClick={sendService}>إرسال للزبون المختار</Button><Button variant="outline" disabled={!normalizePhone(current?.phone)||!draft.trim()} onClick={()=>window.open(`https://web.whatsapp.com/send?phone=${normalizePhone(current?.phone)}&text=${encodeURIComponent(draft)}`,'_blank','noopener,noreferrer')}>فتح واتساب يدويًا</Button><Button variant="ghost" disabled={!draft} onClick={()=>navigator.clipboard.writeText(draft).then(()=>toast.success('تم نسخ الرسالة'))}>نسخ الرسالة</Button></div></div>}
        </>}
      </div>}
    </div>
  </DialogContent></Dialog>;
}

export function ContractExpiryPanel({contracts}:{contracts:ExpirySource[]}) {
  const [open,setOpen]=useState(false),[selection,setSelection]=useState<number[]>([]);
  return <><ContractExpiryWorkspace compact contracts={contracts} onMessage={rows=>{setSelection(rows.map(row=>row.number));setOpen(true);}}/><SendAlertsDialog open={open} onOpenChange={setOpen} contracts={contracts} initialSelection={selection}/></>;
}
