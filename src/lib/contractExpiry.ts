import { applyContractExpiryAlertTemplate } from '@/utils/messageTemplates';
import type { BrowserRecipient } from '@/lib/whatsappBrowser';

export type ExpirySource = Record<string, any>;
export interface ExpiryContract { number:number; customerId:string; name:string; phone:string; adType:string; endDate:string; startDate:string; days:number; count:number; total:number; source:ExpirySource }

export function tripoliDate(now=new Date()): string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tripoli',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=(type:string)=>parts.find(part=>part.type===type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function dateDay(value:unknown):number|null {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(value))return null;
  const date=value.slice(0,10),time=Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?time/86400000:null;
}
export function expiryContracts(contracts:ExpirySource[],today=tripoliDate()):ExpiryContract[] {
  const day=dateDay(today);if(day===null)return [];
  const seen=new Set<number>();
  return contracts.flatMap(source=>{
    const number=Number(source.Contract_Number??source.contract_number??source['Contract Number']??source.id);
    const endDate=source.end_date||source['End Date'];const end=dateDay(endDate);
    if(!number||end===null||seen.has(number))return [];seen.add(number);
    const ids=Array.isArray(source.billboard_ids)?source.billboard_ids:String(source.billboard_ids||'').split(',').filter(Boolean);
    return [{number,customerId:String(source.customer_id||''),name:source.customer_name||source['Customer Name']||'غير محدد',phone:source.Phone||source.phone||'',adType:source.ad_type||source['Ad Type']||'غير محدد',endDate:endDate.slice(0,10),startDate:source.start_date||source['Contract Date']||'',days:end-day,count:Number(source.billboards_count)||ids.length,total:Number(source.total_amount??source.Total??source['Total Rent']??0)||0,source}];
  });
}
export function expiryLabel(days:number){return days<0?`منتهي منذ ${Math.abs(days)} يوم`:days===0?'ينتهي اليوم':`متبقي ${days} يوم`;}
export function expiryMessage(contract:ExpiryContract,template:string):string {
  const start=dateDay(contract.startDate),end=dateDay(contract.endDate);
  return applyContractExpiryAlertTemplate(template,{customerName:contract.name,contractNumber:contract.number,adType:contract.adType,startDate:contract.startDate,endDate:contract.endDate,daysLeft:contract.days,duration:start!==null&&end!==null?`${end-start} يوم`:String(contract.source.Duration||contract.source.duration||'')});
}
// Group by customer identity, not phone: never combine unrelated customers' contract data.
export function expiryRecipients(contracts:ExpiryContract[],template:string,phones:Map<string,string>):BrowserRecipient[] {
  const groups=new Map<string,{contract:ExpiryContract;messages:string[]}>();
  for(const contract of contracts){const key=contract.customerId?`customer:${contract.customerId}`:`contract:${contract.number}`;const existing=groups.get(key);if(existing)existing.messages.push(expiryMessage(contract,template));else groups.set(key,{contract,messages:[expiryMessage(contract,template)]});}
  return [...groups.entries()].map(([id,{contract,messages}])=>({id,name:contract.name,phone:phones.get(contract.customerId)||contract.phone,message:messages.join('\n\n--------------------\n\n')}));
}
