import { validateRecipients, publicBatch, normalizePhone } from './queue.js';

// Serialise every state transition, including alarms and document callbacks.
let chain = Promise.resolve();
function serial(fn) { const job = chain.then(fn); chain = job.catch(() => {}); return job; }
const read = async () => (await chrome.storage.session.get('state')).state || { connection: null, batch: null };
const save = state => chrome.storage.session.set({ state });
const DEFAULT_SETTINGS = { delaySec: 10 };
async function settings() { try { return { ...DEFAULT_SETTINGS, ...((await chrome.storage.local.get('settings')).settings || {}) }; } catch { return DEFAULT_SETTINGS; } }
const isPopup = sender => !sender.tab && sender.url === chrome.runtime.getURL('popup.html');
const current = batch => batch?.items.find(item => ['loading','clicking'].includes(item.status));
const MAX_FAILURES = 3;

// The system's own pages are trusted without manual linking (the bridge is declared in the manifest for them).
export function isAppOrigin(href) {
  try {
    const url = new URL(href);
    if (!['http:','https:'].includes(url.protocol)) return false;
    return ['localhost','127.0.0.1'].includes(url.hostname) || url.hostname === 'billboard-booking.com' || url.hostname.endsWith('.billboard-booking.com');
  } catch { return false; }
}

async function review() { await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 460, height: 720 }); }
async function whatsappTab(preferred) {
  const tabs = await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
  return tabs.find(tab => tab.id === Number(preferred)) || tabs[0] || await chrome.tabs.create({ url: 'https://web.whatsapp.com/', active: false });
}
async function begin(state, preferred) {
  const tab = await whatsappTab(preferred);
  state.batch.tabId = tab.id; state.batch.state = 'running'; state.batch.failures = 0;
  await save(state);
  await next(state);
}
async function next(state) {
  const batch = state.batch;
  if (!batch || batch.state !== 'running' || current(batch)) return;
  const item = batch.items.find(item => item.status === 'pending');
  if (!item) { batch.state = 'complete'; await save(state); return; }
  item.token = crypto.randomUUID();
  if (batch.mode !== 'dom') {
    // Silent path: WA-JS sends inside the already-loaded WhatsApp page (no reload, tab may stay in the background).
    item.status = 'clicking'; item.deadline = Date.now() + 150000;
    await save(state);
    await chrome.alarms.create('alfares-timeout', { when: item.deadline });
    deliver(batch.id, item.id, item.token, batch.tabId, item.phone, item.message);
    return;
  }
  item.status = 'loading'; item.deadline = Date.now() + 90000;
  await save(state);
  try {
    await chrome.alarms.create('alfares-timeout', { when: item.deadline });
    await chrome.tabs.update(batch.tabId, { url: `https://web.whatsapp.com/send?phone=${item.phone}&text=${encodeURIComponent(item.message)}` });
  } catch { item.status = 'error'; item.error = 'تبويب واتساب غير متاح. افتحه ثم استأنف من الإضافة.'; batch.state = 'paused'; await save(state); }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function tabRequest(tabId, payload) {
  // The content script may still be loading in a freshly opened tab; nothing is sent until it answers.
  for (let attempt = 0; attempt < 10; attempt++) {
    try { const reply = await chrome.tabs.sendMessage(tabId, { channel: 'alfares-tab', ...payload }); if (reply) return reply; } catch {}
    await sleep(3000);
  }
  return { ok: false, fallback: true, error: 'تبويب واتساب ويب لم يكتمل تحميله.' };
}
// Runs outside the serial chain so pause/cancel stay responsive while WhatsApp sends.
async function deliver(batchId, itemId, token, tabId, phone, message) {
  const reply = await tabRequest(tabId, { type: 'SEND', phone, message });
  await serial(async () => {
    const state = await read(), batch = state.batch, item = batch?.items.find(row => row.id === itemId);
    if (!batch || batch.id !== batchId || !item || item.token !== token || item.status !== 'clicking') return;
    if (reply?.ok) { item.status = 'sent'; batch.failures = 0; }
    else if (reply?.fallback && !reply.unknown) {
      // Nothing was sent: switch this batch to the page-navigation method and retry the same recipient.
      batch.mode = 'dom'; item.status = 'pending'; delete item.token;
      await save(state); await chrome.alarms.clear('alfares-timeout');
      try { await chrome.tabs.update(tabId, { active: true }); } catch {}
      if (batch.state === 'running') await next(state);
      return;
    }
    else { item.status = reply?.unknown ? 'unknown' : 'error'; item.error = String(reply?.error || 'تعذر الإرسال.').slice(0, 250); batch.failures = (batch.failures || 0) + 1; }
    await save(state); await settle(state);
  });
}
// One failed recipient does not stop the batch; several in a row usually mean WhatsApp itself is not ready.
async function settle(state) {
  const batch = state.batch;
  await chrome.alarms.clear('alfares-timeout');
  if (batch.state !== 'running') return;
  if ((batch.failures || 0) >= MAX_FAILURES) { batch.state = 'paused'; batch.notice = `توقفت الدفعة بعد ${MAX_FAILURES} محاولات فاشلة متتالية. تأكد من تسجيل الدخول في واتساب ويب ثم استأنف.`; await save(state); return; }
  const { delaySec } = await settings();
  await chrome.alarms.create('alfares-next', {when:Date.now()+Math.max(5, Number(delaySec) || 10)*1000});
}

async function handle(message, sender) {
  if (message?.channel !== 'alfares') return {ok:false};
  const state = await read(), popup = isPopup(sender), action = message.action;
  if (action === 'CONNECT' && popup) {
    if (current(state.batch) || state.batch && ['running','paused','review'].includes(state.batch.state)) throw new Error('أنه الدفعة الحالية أو ألغها قبل تغيير الربط.');
    const tab = await chrome.tabs.get(message.tabId);
    const url = new URL(tab.url || '');
    if (!['http:','https:'].includes(url.protocol) || url.hostname === 'web.whatsapp.com') throw new Error('افتح صفحة نظام الفارس ثم اضغط ربط الصفحة.');
    await chrome.scripting.executeScript({ target: {tabId:tab.id}, files:['bridge.js'] });
    state.connection = {tabId:tab.id, origin:url.origin}; await save(state);
    return {ok:true};
  }
  if (['WORK','PERMIT','RESULT'].includes(action)) {
    const batch = state.batch, item = current(batch);
    if (!batch || !item || sender.tab?.id !== batch.tabId || sender.frameId !== 0) return {ok:false};
    // WhatsApp rewrites /send?phone=… to / after loading, so only the origin is checked; the token and document bind the rest.
    const url = new URL(sender.url || 'https://invalid');
    if (url.origin !== 'https://web.whatsapp.com') return {ok:false};
    if (action === 'WORK') {
      if (batch.state !== 'running' || item.status !== 'loading') return {ok:false};
      if (item.documentId && item.documentId !== sender.documentId) return {ok:false};
      item.documentId = sender.documentId; await save(state);
      return {ok:true, item:{token:item.token,message:item.message,phone:item.phone}};
    }
    if (item.token !== message.token || item.documentId !== sender.documentId) return {ok:false};
    if (action === 'PERMIT') {
      if (batch.state !== 'running' || item.status !== 'loading') return {ok:false};
      item.status = 'clicking'; await save(state); return {ok:true};
    }
    // A message is only marked sent when WhatsApp shows it as a new outgoing message.
    if (message.result === 'sent' && item.status === 'clicking') { item.status = 'sent'; batch.failures = 0; }
    else { item.status = item.status === 'clicking' ? 'unknown' : 'error'; item.error = String(message.error || 'تعذر التحقق من الرسالة.').slice(0,250); batch.failures = (batch.failures || 0) + 1; }
    await save(state); await settle(state);
    return {ok:true};
  }
  if (action === 'SETTINGS' && popup) {
    if (message.settings) await chrome.storage.local.set({ settings: { ...(await settings()), delaySec: Math.min(120, Math.max(5, Number(message.settings.delaySec) || 10)) } });
    return {ok:true, settings: await settings()};
  }
  const linked = state.connection && sender.tab?.id === state.connection.tabId && sender.frameId === 0 && new URL(sender.url || 'https://invalid').origin === state.connection.origin;
  const trusted = linked || (sender.tab && sender.frameId === 0 && isAppOrigin(sender.url));
  if (!popup && !trusted) throw new Error('افتح نظام الفارس من رابطه المعتاد، أو اربط هذه الصفحة من أيقونة الإضافة.');
  if (action === 'STATUS') {
    const tabs = await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
    return {ok:true, connected:true, origin:state.connection?.origin, whatsappOpen:tabs.length>0, settings:await settings(), batch:popup?state.batch:publicBatch(state.batch)};
  }
  if (action === 'PREPARE' && trusted) {
    if (current(state.batch) || state.batch && ['running','paused','review'].includes(state.batch.state)) throw new Error('أكمل الدفعة الحالية أو ألغها أولًا.');
    const items = validateRecipients(message.payload);
    state.batch = {id:crypto.randomUUID(),state:'review',items,failures:0}; await save(state);
    if (message.autoStart === true) await begin(state); else await review();
    return {ok:true,batch:publicBatch(state.batch)};
  }
  // Manual sending: open one chat in the existing WhatsApp Web tab instead of a new tab each time.
  if (action === 'OPEN_CHAT' && trusted) {
    if (current(state.batch) || state.batch?.state === 'running') throw new Error('تبويب واتساب مشغول بدفعة جارية. أوقفها أولًا.');
    const phone = normalizePhone(message.payload?.phone), text = String(message.payload?.message || '').slice(0, 20000);
    if (!phone) throw new Error('رقم الهاتف غير صالح.');
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    const [tab] = await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
    if (!tab) { await chrome.tabs.create({url}); return {ok:true}; }
    await chrome.tabs.update(tab.id, {active:true}); await chrome.windows.update(tab.windowId, {focused:true});
    // Open the chat inside the loaded page; reload via /send only if that is not possible.
    let opened = null;
    try { opened = await chrome.tabs.sendMessage(tab.id, { channel:'alfares-tab', type:'OPEN', phone, message:text }); } catch {}
    if (!opened?.ok) { if (opened && !opened.fallback) throw new Error(opened.error || 'تعذر فتح المحادثة.'); await chrome.tabs.update(tab.id, {url}); }
    return {ok:true};
  }
  if (action === 'REVIEW') { await review(); return {ok:true}; }
  if (action === 'START' && popup) {
    if (!state.batch || !['review','paused'].includes(state.batch.state)) throw new Error('لا توجد دفعة جاهزة.');
    if (current(state.batch)) throw new Error('انتظر انتهاء التحقق من الرسالة الحالية.');
    delete state.batch.notice;
    await begin(state, message.tabId); return {ok:true};
  }
  if (action === 'TABS' && popup) return {ok:true,tabs:(await chrome.tabs.query({url:'https://web.whatsapp.com/*'})).map(tab=>({id:tab.id,title:tab.title||'WhatsApp'}))};
  if (action === 'RETRY' && popup && state.batch && !current(state.batch) && state.batch.state !== 'running') {
    state.batch.items.forEach(row=>{if(row.status==='error'){row.status='pending';delete row.error;}}); state.batch.state='paused'; await save(state); return {ok:true};
  }
  if (['PAUSE','CANCEL'].includes(action) && state.batch) {
    const item = current(state.batch);
    state.batch.state = action === 'CANCEL' ? 'cancelled' : 'paused';
    if (item?.status === 'loading') { item.status = action === 'CANCEL' ? 'cancelled':'pending'; delete item.documentId; }
    if (action === 'CANCEL') state.batch.items.forEach(row=>{if(row.status==='pending')row.status='cancelled';});
    await save(state); await chrome.alarms.clear('alfares-next');
    // In-flight clicks may finish; the result still updates, without advancing the queue.
    return {ok:true};
  }
  if (action === 'CLEAR' && popup && !current(state.batch) && !['running','review'].includes(state.batch?.state)) {state.batch=null; await save(state); return {ok:true};}
  throw new Error('إجراء غير متاح.');
}

chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if(message?.channel!=='alfares') return;
  serial(()=>handle(message,sender)).then(reply,error=>reply({ok:false,error:error.message})); return true;
});
chrome.alarms.onAlarm.addListener(alarm=>serial(async()=>{
  const state=await read();
  if(alarm.name==='alfares-next') return next(state);
  if(alarm.name==='alfares-timeout') {
    const item=current(state.batch);
    if(item && Date.now()>=item.deadline) { item.status=item.status==='clicking'?'unknown':'error'; item.error='انتهت مهلة تجهيز المحادثة. راجعها قبل إعادة الإرسال.'; state.batch.failures=(state.batch.failures||0)+1; await save(state); await settle(state); }
  }
}));
