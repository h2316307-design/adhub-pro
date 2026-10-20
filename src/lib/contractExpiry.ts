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
function arabicDate(value:string){const day=dateDay(value);return day===null?(value||'غير محدد'):new Date(day*86400000).toLocaleDateString('ar-LY',{timeZone:'UTC'});}
function contractDuration(contract:ExpiryContract){const start=dateDay(contract.startDate),end=dateDay(contract.endDate);return start!==null&&end!==null?`${end-start} يوم`:'';}
/** One message per customer: greeting and closing once, then a short block per contract (no repeated full letters). */
export function combinedExpiryMessage(name:string,contracts:ExpiryContract[]):string {
  const rows=[...contracts].sort((a,b)=>a.days-b.days);
  const expired=rows.some(row=>row.days<0),upcoming=rows.some(row=>row.days>=0);
  const intro=expired&&upcoming?'نود تذكيركم بأن لديكم عقودًا انتهت وأخرى قاربت على الانتهاء:':expired?'نود تذكيركم بأن العقود التالية قد انتهت:':'نود تذكيركم بأن العقود التالية قاربت على الانتهاء:';
  const blocks=rows.map((row,index)=>{const duration=contractDuration(row);return [`${index+1}) عقد رقم ${row.number} — ${row.adType}`,`   من ${arabicDate(row.startDate)} إلى ${arabicDate(row.endDate)}${duration?` (${duration})`:''}`,`   الحالة: ${expiryLabel(row.days)}`].join('\n');});
  return ['السلام عليكم ورحمة الله وبركاته','',`السيد/ ${name} المحترم،`,'',intro,'━━━━━━━━━━━━━━━━━',blocks.join('\n\n'),'━━━━━━━━━━━━━━━━━',`عدد العقود: ${rows.length}`,'','نأمل التواصل معنا لتجديد العقود.','','نشكر لكم حسن تعاونكم،','مع فائق التقدير والاحترام'].join('\n');
}
// Group by customer identity, not phone: never combine unrelated customers' contract data.
export function expiryRecipients(contracts:ExpiryContract[],template:string,phones:Map<string,string>):BrowserRecipient[] {
  const groups=new Map<string,ExpiryContract[]>();
  for(const contract of contracts){const key=contract.customerId?`customer:${contract.customerId}`:`contract:${contract.number}`;groups.set(key,[...(groups.get(key)||[]),contract]);}
  return [...groups.entries()].map(([id,rows])=>({id,name:rows[0].name,phone:phones.get(rows[0].customerId)||rows[0].phone,message:rows.length===1?expiryMessage(rows[0],template):combinedExpiryMessage(rows[0].name,rows)}));
}
