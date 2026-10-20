import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';

describe('WhatsApp extension worker safety and queue lifecycle',()=>{
  let state:any,listener:any,alarm:any,chromeMock:any;
  const app={tab:{id:1},frameId:0,url:'https://alfares.test/admin/overdue-payments'};
  const popup={url:'chrome-extension://test/popup.html'};
  const recipients=[{name:'أ',phone:'0912345678',message:'رسالة أولى'},{name:'ب',phone:'0922345678',message:'رسالة ثانية'}];
  const call=(action:string,sender:any=app,extra:any={})=>new Promise<any>(resolve=>listener({channel:'alfares',action,...extra},sender,resolve));
  const wa=()=>({tab:{id:2},frameId:0,documentId:'doc',url:`https://web.whatsapp.com/send?phone=${state.batch.items[0].phone}&text=${encodeURIComponent(state.batch.items[0].message)}`});
  beforeEach(async()=>{
    vi.resetModules();state={connection:{tabId:1,origin:'https://alfares.test'},batch:null};
    chromeMock={runtime:{getURL:(file:string)=>`chrome-extension://test/${file}`,onMessage:{addListener:(fn:any)=>{listener=fn;}}},storage:{session:{get:vi.fn(async()=>({state:structuredClone(state)})),set:vi.fn(async(value:any)=>{state=structuredClone(value.state);})}},windows:{create:vi.fn(async()=>({}))},tabs:{sendMessage:vi.fn(async()=>({ok:false,fallback:true})),query:vi.fn(async()=>[{id:2,url:'https://web.whatsapp.com/'}]),update:vi.fn(async()=>({})),get:vi.fn(async()=>({id:1,url:app.url}))},scripting:{executeScript:vi.fn(async()=>[])},alarms:{create:vi.fn(async()=>{}),clear:vi.fn(async()=>true),onAlarm:{addListener:(fn:any)=>{alarm=fn;}}}};
    vi.stubGlobal('chrome',chromeMock);await import('../../extensions/alfares-whatsapp/background.js');
  });
  afterEach(()=>vi.unstubAllGlobals());
  const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0));};
  async function start(){await call('PREPARE',app,{payload:recipients});await call('START',popup);await flush();}
  it('rejects other tabs and origins even when the payload is valid',async()=>{
    expect((await call('PREPARE',{...app,tab:{id:9}},{payload:recipients})).ok).toBe(false);
    expect((await call('PREPARE',{...app,url:'https://evil.test/'},{payload:recipients})).ok).toBe(false);
    expect(state.batch).toBeNull();
  });
  it('only prepares from the app; only the extension review can start sending',async()=>{
    expect((await call('PREPARE',app,{payload:recipients})).ok).toBe(true);
    expect(state.batch.state).toBe('review');expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    expect((await call('START')).ok).toBe(false);expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    await call('START',popup);await flush();expect(chromeMock.tabs.update.mock.calls.filter((c:any)=>c[1].url)).toHaveLength(1);
  });
  it('rejects a mismatched recipient or document and grants click permission only once',async()=>{
    await start();const token=state.batch.items[0].token;
    expect((await call('WORK',{...wa(),url:'https://evil.test/send'})).ok).toBe(false);
    expect((await call('WORK',wa())).ok).toBe(true);
    expect((await call('PERMIT',{...wa(),documentId:'other'},{token})).ok).toBe(false);
    expect((await call('PERMIT',wa(),{token})).ok).toBe(true);
    expect((await call('PERMIT',wa(),{token})).ok).toBe(false);
  });
  it('accepts WhatsApp after it rewrites /send to / (the cause of stalled batches)',async()=>{
    await start();expect((await call('WORK',{...wa(),url:'https://web.whatsapp.com/'})).ok).toBe(true);
  });
  it('marks an ambiguous send without replaying it and continues with the next recipient',async()=>{
    await start();await call('WORK',wa());const token=state.batch.items[0].token;
    await call('PERMIT',wa(),{token});await call('RESULT',wa(),{token,result:'unknown',error:'لا يوجد تأكيد'});
    expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.state).toBe('running');
    await alarm({name:'alfares-next'});await flush();expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.items[1].status).toBe('loading');
    expect(chromeMock.tabs.update.mock.calls.at(-1)[1].url).toContain('218922345678');
  });
  it('pauses after three consecutive failures',async()=>{
    await call('PREPARE',app,{payload:[...recipients,{name:'ج',phone:'0932345678',message:'ثالثة'},{name:'د',phone:'0942345678',message:'رابعة'}]});await call('START',popup);await flush();
    for(let i=0;i<3;i++){const item=state.batch.items.find((row:any)=>row.status==='loading');await call('WORK',{...wa(),documentId:`d${i}`});await call('RESULT',{...wa(),documentId:`d${i}`},{token:item.token,result:'error',error:'x'});if(i<2){await alarm({name:'alfares-next'});await flush();}}
    expect(state.batch.state).toBe('paused');expect(state.batch.items[3].status).toBe('pending');
  });
  it('trusts the system origin automatically and can start without the review window',async()=>{
    state.connection=null;const local={tab:{id:5},frameId:0,url:'http://localhost:8080/admin/contracts'};
    expect((await call('PREPARE',local,{payload:recipients,autoStart:true})).ok).toBe(true);await flush();
    expect(state.batch.state).toBe('running');expect(chromeMock.windows.create).not.toHaveBeenCalled();
    expect(chromeMock.tabs.update.mock.calls.at(-1)[1].url).toContain('218912345678');
  });
  it('sends silently inside the open WhatsApp page without reloading it',async()=>{
    chromeMock.tabs.sendMessage.mockResolvedValue({ok:true,id:'m1'});
    await start();expect(state.batch.items[0].status).toBe('sent');
    expect(chromeMock.tabs.sendMessage.mock.calls[0][1]).toMatchObject({channel:'alfares-tab',type:'SEND',phone:'218912345678'});
    await alarm({name:'alfares-next'});await flush();expect(state.batch.items[1].status).toBe('sent');
    expect(chromeMock.tabs.update.mock.calls.filter((c:any)=>c[1].url)).toHaveLength(0);
  });
  it('never retries a silent send whose outcome is unknown',async()=>{
    chromeMock.tabs.sendMessage.mockResolvedValue({ok:false,unknown:true,error:'لا رد'});
    await start();expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.mode).toBeUndefined();
    expect(chromeMock.tabs.update.mock.calls.filter((c:any)=>c[1].url)).toHaveLength(0);
  });
  it('revokes permission for an unclicked message on pause',async()=>{
    await start();await call('WORK',wa());const sender=wa(),token=state.batch.items[0].token;
    await call('PAUSE');expect((await call('PERMIT',sender,{token})).ok).toBe(false);
    expect(state.batch.items[0].status).toBe('pending');expect(state.batch.state).toBe('paused');
  });
  it('records an in-flight acknowledgement after cancellation without advancing',async()=>{
    await start();await call('WORK',wa());const sender=wa(),token=state.batch.items[0].token;
    await call('PERMIT',sender,{token});await call('CANCEL');
    expect((await call('PREPARE',app,{payload:recipients})).ok).toBe(false);
    await call('RESULT',sender,{token,result:'sent'});
    expect(state.batch.items[0].status).toBe('sent');expect(state.batch.items[1].status).toBe('cancelled');
    expect(state.batch.state).toBe('cancelled');expect(chromeMock.tabs.update.mock.calls.filter((c:any)=>c[1].url).length).toBe(1);
  });
  it('times out without replaying an uncertain click',async()=>{
    await start();await call('WORK',wa());await call('PERMIT',wa(),{token:state.batch.items[0].token});
    state.batch.items[0].deadline=Date.now()-1;await alarm({name:'alfares-timeout'});
    expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.state).toBe('running');
    expect(chromeMock.tabs.update.mock.calls.filter((c:any)=>c[1].url).length).toBe(1);
  });
});
