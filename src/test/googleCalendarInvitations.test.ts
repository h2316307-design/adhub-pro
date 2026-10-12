import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { CALENDAR_INVITATIONS_SCRIPT } from '@/services/googleCalendarInvitationsScript';

function fixture(fail = false) {
  const tags: Record<string, string> = {};
  const event = { getId: () => 'ical-id@google.com', getTag: (key: string) => tags[key], setTag: (key: string, value: string) => { tags[key] = value; } };
  const fetch = vi.fn((url: string) => ({ getResponseCode: () => fail ? 403 : 200, getContentText: () => JSON.stringify(url.includes('?iCalUID') ? { items: [{ id: 'api-id', attendees: [{ email: 'existing@example.com', responseStatus: 'accepted' }] }] } : {}) }));
  const context: any = { UrlFetchApp: { fetch }, ScriptApp: { getOAuthToken: () => 'test-token' } };
  runInNewContext(CALENDAR_INVITATIONS_SCRIPT, context);
  return { context, fetch, event, tags, calendar: { getId: () => 'calendar-id' } };
}

describe('customer calendar invitations', () => {
  it('notifies existing silent events, preserves attendees, and avoids duplicate invitations', () => {
    const f = fixture();
    f.context.sendExistingInvitations(f.calendar, f.event, ['customer@example.com']);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = f.fetch.mock.calls[1] as unknown as [string, any];
    expect(url).toContain('/api-id?sendUpdates=all');
    expect(JSON.parse(options.payload).attendees).toEqual([{ email: 'existing@example.com', responseStatus: 'accepted' }, { email: 'customer@example.com' }]);
    f.context.sendExistingInvitations(f.calendar, f.event, ['customer@example.com']);
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it('reports API failures and does not mark an invitation sent', () => {
    const f = fixture(true);
    expect(() => f.context.sendExistingInvitations(f.calendar, f.event, ['customer@example.com'])).toThrow('403');
    expect(f.tags.adhubInvited).toBeUndefined();
  });
});
