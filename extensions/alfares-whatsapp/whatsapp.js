(() => {
  const send = payload => chrome.runtime.sendMessage({channel:'alfares',...payload});
  // Compare letters and digits only: WhatsApp renders *bold*, line breaks and emoji differently from the raw text.
  const norm = value => String(value || '').replace(/[^\p{L}\p{N}]/gu, '');
  const visible = element => element && element.getClientRects().length > 0;
  const delay = (ms = 750) => new Promise(resolve => setTimeout(resolve, ms));
  const outgoingIds = () => new Set([
    ...Array.from(document.querySelectorAll('#main .message-out')).map(el => el.closest('[data-id]')?.getAttribute('data-id')),
    ...Array.from(document.querySelectorAll('#main [data-id^="true_"]')).map(el => el.getAttribute('data-id')),
  ].filter(Boolean));
  const outgoing = () => Array.from(document.querySelectorAll('#main [data-id]')).filter(el => el.querySelector('.message-out') || el.classList.contains('message-out') || /^true_/.test(el.getAttribute('data-id') || ''));
  function sendButton(footer) {
    const icon = footer?.querySelector('[data-icon="send"],[data-icon*="send"]');
    return icon?.closest('button,[role="button"]') || footer?.querySelector('button[aria-label="Send"],button[aria-label="إرسال"],[role="button"][aria-label="Send"],[role="button"][aria-label="إرسال"]');
  }
  function invalidNumber() {
    const popup = document.querySelector('[data-animate-modal-popup="true"],[role="dialog"]');
    return visible(popup) && /invalid|غير صالح|isn.t on WhatsApp|ليس على واتساب|غير مسجل/i.test(popup.innerText || '');
  }
  async function run() {
    const work = await send({action:'WORK'});
    if (!work?.ok) return;
    const item = work.item, target = norm(item.message);
    let clicked = false;
    try {
      const deadline = Date.now() + 70000;
      while (Date.now() < deadline) {
        if (invalidNumber()) throw new Error('الرقم غير مسجل في واتساب أو غير صالح.');
        const footer = document.querySelector('#main footer');
        const composer = footer?.querySelector('[contenteditable="true"]');
        const button = sendButton(footer);
        if (visible(composer) && norm(composer.innerText) === target && (!button || (!button.disabled && button.getAttribute('aria-disabled') !== 'true'))) {
          const header = document.querySelector('#main header'), chatLabel = header?.innerText;
          // Snapshot existing outgoing messages so an old identical message cannot count as success.
          const existing = outgoingIds();
          const permission = await send({action:'PERMIT',token:item.token});
          if (!permission?.ok) return;
          if (!composer.isConnected || (header && header.innerText !== chatLabel) || norm(composer.innerText) !== target) throw new Error('تغيرت المحادثة قبل الإرسال.');
          clicked = true;
          if (button && visible(button)) button.click();
          else { composer.focus(); composer.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true})); }
          const ackDeadline = Date.now() + 20000;
          while (Date.now() < ackDeadline) {
            const message = outgoing().find(el => { const id = el.getAttribute('data-id'); return id && !existing.has(id) && [el, ...el.querySelectorAll('.selectable-text')].some(node => norm(node.innerText).includes(target)); });
            if (message && (message.querySelector('[data-icon*="check"]') || !message.querySelector('[data-icon*="clock"],[data-icon*="time"],[data-icon*="pending"]'))) { await send({action:'RESULT',token:item.token,result:'sent'}); return; }
            await delay();
          }
          throw new Error('تم الضغط على إرسال، لكن لم يظهر تأكيد واتساب. راجع المحادثة؛ لن تتكرر الرسالة تلقائيًا.');
        }
        await delay();
      }
      throw new Error('تعذر تجهيز المحادثة. تحقق من تسجيل الدخول في واتساب ويب والرقم.');
    } catch (error) { await send({action:'RESULT',token:item.token,result:clicked?'unknown':'error',error:error.message}); }
  }
  // Silent sending: relay the worker's request to wa-main.js in the page and return its answer.
  function relay(type, payload, timeoutMs) {
    return new Promise(resolve => {
      const id = crypto.randomUUID();
      const done = reply => { window.removeEventListener('message', listener); clearTimeout(timer); resolve(reply); };
      const listener = event => { if (event.source === window && event.data?.source === 'alfares-wa-reply' && event.data.id === id) { const { source, id: _, ...reply } = event.data; done(reply); } };
      const timer = setTimeout(() => done(type === 'SEND' ? { ok:false, unknown:true, error:'لم يرد واتساب في الوقت المحدد. راجع المحادثة قبل إعادة الإرسال.' } : { ok:false, fallback:true, error:'انتهت مهلة مكتبة الإرسال.' }), timeoutMs);
      window.addEventListener('message', listener);
      window.postMessage({ source:'alfares-wa-request', id, type, ...payload }, location.origin);
    });
  }
  if (!window.__alfaresTabListener) {
    window.__alfaresTabListener = true;
    chrome.runtime.onMessage?.addListener((message, sender, reply) => {
      if (message?.channel !== 'alfares-tab' || sender.id !== chrome.runtime.id || !['SEND','OPEN','PING'].includes(message.type)) return;
      relay(message.type, { phone: message.phone, message: message.message }, 80000).then(reply);
      return true;
    });
  }
  run().catch(() => {});
})();
