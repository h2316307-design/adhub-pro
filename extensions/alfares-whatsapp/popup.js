const $=id=>document.getElementById(id);
const labels={pending:'بالانتظار',loading:'تجهيز المحادثة',clicking:'جارٍ الإرسال',sent:'أُرسلت',error:'تعذرت',unknown:'غير مؤكدة',cancelled:'أُلغيت',review:'جاهزة للبدء',running:'الإرسال جارٍ…',paused:'متوقفة مؤقتًا',complete:'اكتملت الدفعة'};
const request=async(action,extra={})=>{const result=await chrome.runtime.sendMessage({channel:'alfares',action,...extra});if(!result?.ok)throw new Error(result?.error||'تعذر الاتصال');return result;};
const showError=message=>{$('error').hidden=!message;$('error').textContent=message||'';};
let lastRender='';
function pill(id,ok,text){$(id).className=`pill ${ok?'ok':'bad'}`;$(id).querySelector('span:last-child').textContent=text;}
async function refresh(){
  const result=await request('STATUS');
  pill('systemPill',true,result.origin?`مرتبط: ${new URL(result.origin).host}`:'النظام: ربط تلقائي');
  pill('waPill',result.whatsappOpen,result.whatsappOpen?'واتساب ويب مفتوح':'واتساب ويب غير مفتوح');$('openWa').hidden=!!result.whatsappOpen;
  $('connection').textContent=result.origin?`الصفحة المرتبطة يدويًا: ${result.origin}`:'';
  if(document.activeElement!==$('delay'))$('delay').value=String(result.settings?.delaySec||10);
  const batch=result.batch;$('batch').hidden=!batch;$('empty').hidden=!!batch;$('notice').hidden=!batch?.notice;$('notice').textContent=batch?.notice||'';
  if(!batch)return;
  const count=list=>batch.items.filter(item=>list.includes(item.status)).length;
  const sent=count(['sent']),failed=count(['error','unknown']),left=count(['pending','loading','clicking']),total=batch.items.length;
  $('stateText').textContent=batch.state==='cancelled'?'أُلغيت الدفعة':(labels[batch.state]||batch.state);
  $('countText').textContent=`${sent+failed} / ${total}`;$('barFill').style.width=`${total?(sent+failed)/total*100:0}%`;
  $('sentN').textContent=sent;$('failN').textContent=failed;$('leftN').textContent=left;
  const active=batch.items.some(item=>['loading','clicking'].includes(item.status));
  $('start').hidden=!['review','paused'].includes(batch.state);$('start').disabled=active;
  $('start').textContent=batch.state==='paused'?'استئناف الإرسال':`بدء الإرسال (${total})`;
  $('pause').hidden=batch.state!=='running';
  $('retry').hidden=!(count(['error'])&&batch.state!=='running');$('retry').disabled=active;
  $('cancel').hidden=!['review','running','paused'].includes(batch.state);
  $('clear').hidden=['running','review'].includes(batch.state);$('clear').disabled=active;
  $('tabsWrap').hidden=$('tabs').options.length<2||!['review','paused'].includes(batch.state);
  const fingerprint=JSON.stringify(batch.items.map(item=>[item.id,item.status,item.error]));
  if(fingerprint===lastRender)return;lastRender=fingerprint;
  $('recipients').replaceChildren(...batch.items.map(row=>{
    const card=document.createElement('article');card.className='item';
    const head=document.createElement('div');head.className='head';
    const who=document.createElement('div'),name=document.createElement('strong'),phone=document.createElement('div');
    name.textContent=row.name;phone.className='phone';phone.textContent=row.phone;who.append(name,phone);
    const tag=document.createElement('span');tag.className=`tag ${row.status}`;tag.textContent=labels[row.status]||row.status;head.append(who,tag);card.append(head);
    if(row.error){const err=document.createElement('p');err.className='err';err.textContent=row.error;card.append(err);}
    const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');
    summary.textContent='الرسالة';pre.textContent=row.message||'';details.append(summary,pre);card.append(details);
    return card;
  }));
}
async function perform(action,extra){try{showError('');await request(action,extra);await refresh();}catch(error){showError(error.message);}}
$('connect').onclick=async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await perform('CONNECT',{tabId:tab?.id});};
$('start').onclick=()=>perform('START',{tabId:Number($('tabs').value)||undefined});
$('pause').onclick=()=>perform('PAUSE');$('cancel').onclick=()=>perform('CANCEL');$('clear').onclick=()=>perform('CLEAR');$('retry').onclick=()=>perform('RETRY');
$('openWa').onclick=()=>chrome.tabs.create({url:'https://web.whatsapp.com/'});
$('delay').onchange=()=>perform('SETTINGS',{settings:{delaySec:Number($('delay').value)}});
request('TABS').then(({tabs})=>{for(const tab of tabs){const option=document.createElement('option');option.value=tab.id;option.textContent=`${tab.title} — ${tab.id}`;$('tabs').append(option);}}).catch(()=>{});
refresh().catch(error=>showError(error.message));setInterval(()=>refresh().catch(()=>{}),1500);
