import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BrowserWhatsAppBatch } from '@/components/billing/BrowserWhatsAppBatch';
import { ManualWhatsAppQueue } from '@/components/shared/ManualWhatsAppQueue';
import type { BrowserRecipient } from '@/lib/whatsappBrowser';

type Mode='auto'|'manual';
const KEY='alfares-send-mode';

/** One place for bulk WhatsApp sending: automatic (extension) or manual chat-by-chat. Used by contract alerts and payment reminders. */
export function WhatsAppSendModes({recipients}:{recipients:BrowserRecipient[]}) {
  const [mode,setMode]=useState<Mode>(()=>{try{return localStorage.getItem(KEY)==='manual'?'manual':'auto';}catch{return 'auto';}});
  const pick=(next:Mode)=>{setMode(next);try{localStorage.setItem(KEY,next);}catch{}};
  const tab=(value:Mode,label:string)=><button type="button" role="tab" aria-selected={mode===value} onClick={()=>pick(value)} className={`cursor-pointer rounded-md px-4 py-1.5 text-sm transition-colors ${mode===value?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>{label}</button>;
  return <div dir="rtl" className="space-y-3">
    <div className="inline-flex rounded-lg border p-1" role="tablist" aria-label="طريقة الإرسال">{tab('auto','تلقائي (الإضافة)')}{tab('manual','يدوي (محادثة بمحادثة)')}</div>
    {mode==='auto'?<BrowserWhatsAppBatch recipients={recipients}/>:<ManualWhatsAppQueue recipients={recipients}/>}
  </div>;
}

export function WhatsAppSendModesDialog({recipients,label='إرسال جماعي عبر واتساب'}:{recipients:BrowserRecipient[];label?:string}) {
  return <Dialog><DialogTrigger asChild><Button><MessageSquare className="h-4 w-4"/>{label}</Button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>إرسال جماعي عبر واتساب</DialogTitle></DialogHeader><WhatsAppSendModes recipients={recipients}/></DialogContent></Dialog>;
}
