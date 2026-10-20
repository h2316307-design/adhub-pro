// Runs in WhatsApp Web's own page (MAIN world) next to WA-JS (window.WPP).
// Sends directly through the logged-in session: no navigation, no reload, works while the tab is in the background.
(() => {
  if (window.__alfaresWaMain) return;
  window.__alfaresWaMain = true;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function ready(timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const wpp = window.WPP;
      if (wpp?.isReady && wpp.conn?.isAuthenticated?.()) return wpp;
      await wait(500);
    }
    const wpp = window.WPP;
    if (wpp?.isReady && !wpp.conn?.isAuthenticated?.()) throw Object.assign(new Error('واتساب ويب غير مسجّل الدخول. امسح رمز QR أولًا.'), { login: true });
    throw Object.assign(new Error('مكتبة الإرسال غير جاهزة في واتساب ويب.'), { fallback: true });
  }
  async function resolve(wpp, phone) {
    const found = await wpp.contact.queryWidExists(`${phone}@c.us`);
    if (!found?.wid) throw new Error('الرقم غير مسجل في واتساب.');
    return found.wid;
  }
  const actions = {
    async PING() { const wpp = await ready(15000); return { ready: true, authenticated: !!wpp.conn.isAuthenticated() }; },
    async SEND({ phone, message }) {
      const wpp = await ready();
      const wid = await resolve(wpp, phone);
      const result = await wpp.chat.sendTextMessage(wid, message, { createChat: true, waitForAck: true });
      if (!result?.id) throw new Error('لم يُرجع واتساب معرف الرسالة.');
      if (typeof result.ack === 'number' && result.ack < 0) throw new Error('رفض واتساب الرسالة.');
      return { id: String(result.id), ack: result.ack };
    },
    // Manual mode: open the chat inside the loaded page and type the message, without sending.
    async OPEN({ phone, message }) {
      const wpp = await ready();
      const wid = await resolve(wpp, phone);
      await wpp.chat.openChatBottom(wid);
      if (message) { await wait(400); await wpp.chat.setInputText(message, wid); }
      return { opened: true };
    },
  };
  window.addEventListener('message', async event => {
    const data = event.data;
    if (event.source !== window || data?.source !== 'alfares-wa-request' || !actions[data.type] || typeof data.id !== 'string') return;
    let reply;
    try { reply = { ok: true, ...(await actions[data.type](data)) }; }
    catch (error) { reply = { ok: false, error: String(error?.message || error).slice(0, 250), fallback: !!error?.fallback, login: !!error?.login }; }
    window.postMessage({ source: 'alfares-wa-reply', id: data.id, ...reply }, location.origin);
  });
})();
