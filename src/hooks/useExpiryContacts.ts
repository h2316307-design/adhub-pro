import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE } from '@/utils/messageTemplates';
import type { ExpirySource } from '@/lib/contractExpiry';

export interface ExpiryContacts { phones:Map<string,string>; template:string; loading:boolean; error:string }

// Customer phones + the saved expiry template, shared by the expiry list and the alerts dialog.
export function useExpiryContacts(contracts:ExpirySource[],enabled=true):ExpiryContacts {
  const [state,setState]=useState<ExpiryContacts>({phones:new Map(),template:DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE,loading:enabled,error:''});
  useEffect(()=>{
    if(!enabled)return;
    let cancelled=false;
    setState(old=>({...old,loading:true,error:''}));
    (async()=>{
      try{
        const ids=[...new Set(contracts.map(contract=>String(contract.customer_id||'')).filter(Boolean))];
        const phones=new Map<string,string>();
        for(let i=0;i<ids.length;i+=200){const result=await supabase.from('customers').select('id,phone').in('id',ids.slice(i,i+200));if(result.error)throw result.error;result.data?.forEach(customer=>{if(customer.phone)phones.set(customer.id,customer.phone);});}
        const settings=await supabase.from('system_settings').select('setting_value').eq('setting_key','contract_expiry_alert_template').maybeSingle();
        if(!cancelled)setState({phones,template:settings.data?.setting_value||DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE,loading:false,error:settings.error?'تعذر تحميل قالب التنبيه، تُستخدم الرسالة الافتراضية.':''});
      }catch{if(!cancelled)setState(old=>({...old,loading:false,error:'تعذر تحميل أرقام الزبائن. أعد المحاولة لاحقًا.'}));}
    })();
    return()=>{cancelled=true;};
  },[contracts,enabled]);
  return state;
}
