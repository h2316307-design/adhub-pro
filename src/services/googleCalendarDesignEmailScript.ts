/** Included in the downloadable Apps Script; executed by Google, not the browser. */
export const DESIGN_EMAIL_SCRIPT = String.raw`
// Run once in the Apps Script editor and approve Calendar, Mail and URL Fetch access.
function enableDesignEmailReminders() {
  CalendarApp.getDefaultCalendar().getName();
  MailApp.getRemainingDailyQuota();
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === 'sendDesignEmailReminders';
  });
  if (!triggers.length) ScriptApp.newTrigger('sendDesignEmailReminders').timeBased().everyMinutes(5).create();
}

function disableDesignEmailReminders() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendDesignEmailReminders') ScriptApp.deleteTrigger(t);
  });
}

function registerDesignEmail(event, item, reminders, emails) {
  if (!event) return;
  try {
    // Split metadata across tags to stay within Calendar's per-value size limit.
    var fields = {
      image: item.designUrl || '', customer: item.customerName || '',
      reference: String(item.reference || ''), amount: item.amount == null ? '' : String(item.amount),
      offsets: JSON.stringify((reminders || []).filter(function(n) { return Number.isInteger(n) && n >= 0 && n <= 40320; })),
      recipients: JSON.stringify((emails || []).map(function(e) { return e.trim().toLowerCase(); }).filter(function(e, i, all) { return all.indexOf(e) === i; }))
    };
    Object.keys(fields).forEach(function(key) {
      if (fields[key].length <= 1000) {
        if (event.getTag('adhub_mail_' + key) !== fields[key]) event.setTag('adhub_mail_' + key, fields[key]);
      }
    });
    try {
      if (!event.getTag('adhub_mail_since')) event.setTag('adhub_mail_since', String(Date.now()));
      if (event.getTag('adhub_mail_enabled') !== '1') event.setTag('adhub_mail_enabled', '1');
    } catch (tagErr) { throw tagErr; }
  } catch (outerErr) { throw outerErr; }
}

function escapeDesignEmail(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function designEmailImage(url) {
  // Only public HTTPS image URLs; redirects are deliberately not followed.
  if (!/^https:\/\/[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?::443)?\//i.test(url)) return null;
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: false });
    if (response.getResponseCode() !== 200) return null;
    var blob = response.getBlob();
    if (!/^image\/(png|jpeg|gif|webp)$/i.test(blob.getContentType())) return null;
    if (blob.getBytes().length > 5 * 1024 * 1024) return null;
    return blob.setName('design');
  } catch (error) {
    console.warn('تعذر تحميل صورة التصميم: ' + error.message);
    return null;
  }
}

function buildDesignEmail(event, recipient, image) {
  var customer = event.getTag('adhub_mail_customer');
  var reference = event.getTag('adhub_mail_reference');
  var amount = event.getTag('adhub_mail_amount');
  var when = Utilities.formatDate(event.getStartTime(), 'Africa/Tripoli', 'yyyy-MM-dd HH:mm');
  var lines = [event.getTitle(), 'العميل: ' + customer, 'رقم العقد / الفاتورة: ' + reference,
    'الموعد (توقيت ليبيا): ' + when];
  if (amount !== '') lines.push('المبلغ: ' + amount + ' د.ل');
  var html = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #d6ac40;padding:24px;border-radius:12px;color:#202020;background:#fff">' +
    '<h2 style="color:#805e12">الفارس الذهبي للدعاية</h2>' +
    lines.map(function(line) { return '<p>' + escapeDesignEmail(line) + '</p>'; }).join('');
  html += image ? '<img src="cid:design" alt="صورة التصميم" style="display:block;width:100%;max-width:590px;height:auto;border-radius:8px" />'
    : '<p>صورة التصميم غير متاحة حاليًا. يمكنك مراجعتها داخل النظام.</p>';
  html += '</div>';
  var message = { to: recipient, subject: event.getTitle(), body: lines.join('\n'), htmlBody: html, name: 'الفارس الذهبي للدعاية' };
  if (image) message.inlineImages = { design: image };
  return message;
}

function sendDesignEmailReminders() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var now = Date.now();
    var calendar = CalendarApp.getDefaultCalendar();
    var events = calendar.getEvents(new Date(now - 86400000), new Date(now + 29 * 86400000), { search: 'ADHUB' });
    var quota = MailApp.getRemainingDailyQuota();
    for (var i = 0; i < events.length; i++) {
      if (Date.now() - now > 240000 || quota <= 0) break;
      var event = events[i];
      if (event.getTag('adhub_mail_enabled') !== '1') continue;
      try {
        var start = event.getStartTime().getTime();
        var since = Number(event.getTag('adhub_mail_since'));
        var offsets = JSON.parse(event.getTag('adhub_mail_offsets') || '[]');
        var recipients = JSON.parse(event.getTag('adhub_mail_recipients') || '[]');
        var image;
        for (var r = 0; r < offsets.length; r++) {
          var due = start - offsets[r] * 60000;
          // Catch up within a day, but never send reminders predating initial sync.
          if (due > now || due < since || now - due > 86400000) continue;
          for (var g = 0; g < recipients.length && quota > 0; g++) {
            var key = 'adhub_sent_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(
              Utilities.DigestAlgorithm.SHA_256, start + ':' + offsets[r] + ':' + recipients[g])).replace(/=+$/, '');
            if (event.getTag(key)) continue;
            if (image === undefined) image = designEmailImage(event.getTag('adhub_mail_image'));
            // Reserve before sending: an interrupted send is not automatically repeated.
            event.setTag(key, 'sending');
            MailApp.sendEmail(buildDesignEmail(event, recipients[g], image));
            event.setTag(key, 'sent');
            quota--;
          }
        }
      } catch (error) {
        console.error('تعذر إرسال تنبيه الموعد ' + event.getId() + ': ' + error.message);
        throw error; // Trigger failures remain visible in Apps Script executions.
      }
    }
  } finally { lock.releaseLock(); }
}
`;
