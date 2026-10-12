export const CALENDAR_INVITATIONS_SCRIPT = String.raw`
function invitationSignature(emails) {
  return emails.map(function(email) { return email.trim().toLowerCase(); }).sort().join(',');
}

// Old events may contain guests without ever having sent their invitations.
function sendExistingInvitations(calendar, event, emails) {
  if (!emails.length) return;
  var signature = invitationSignature(emails);
  if (event.getTag('adhubInvited') === signature) return;
  var base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendar.getId()) + '/events';
  var headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  function request(url, options) {
    var response = UrlFetchApp.fetch(url, options);
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error('تعذر إرسال دعوة التقويم (' + status + '). تحقق من تفعيل Google Calendar API وصلاحيات السكربت. ' + response.getContentText());
    }
    return JSON.parse(response.getContentText());
  }
  var found = request(base + '?iCalUID=' + encodeURIComponent(event.getId()), { headers: headers, muteHttpExceptions: true });
  var record = (found.items || []).filter(function(item) { return item.status !== 'cancelled'; })[0];
  if (!record) throw new Error('لم يتم العثور على الموعد لإرسال الدعوة.');
  var attendees = record.attendees || [];
  emails.forEach(function(email) {
    if (!attendees.some(function(guest) { return guest.email && guest.email.toLowerCase() === email.toLowerCase(); })) attendees.push({ email: email });
  });
  request(base + '/' + encodeURIComponent(record.id) + '?sendUpdates=all', {
    method: 'patch', headers: headers, contentType: 'application/json',
    payload: JSON.stringify({ attendees: attendees }), muteHttpExceptions: true
  });
  event.setTag('adhubInvited', signature);
}
`;
