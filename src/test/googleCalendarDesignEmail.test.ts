import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { DESIGN_EMAIL_SCRIPT } from '@/services/googleCalendarDesignEmailScript';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { getAppsScriptSourceCode } from '@/services/googleCalendarService';

function fixture() {
  const tags: Record<string, string> = {};
  const start = Date.now() + 60_000;
  const event = {
    getTag: (key: string) => tags[key] || '',
    setTag: (key: string, value: string) => { tags[key] = value; },
    getTitle: () => '<عقد 25>', getId: () => 'event-25', getStartTime: () => new Date(start),
  };
  const blob = { getContentType: () => 'image/png', getBytes: () => [1, 2], setName: () => blob };
  const sendEmail = vi.fn();
  const releaseLock = vi.fn();
  const fetch = vi.fn(() => ({ getResponseCode: () => 200, getBlob: () => blob }));
  const context: any = {
    console, Date, CalendarApp: { getDefaultCalendar: () => ({ getEvents: () => [event], getName: () => 'Calendar' }) },
    MailApp: { sendEmail, getRemainingDailyQuota: () => 100 },
    UrlFetchApp: { fetch },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock }) },
    Utilities: {
      formatDate: () => '2026-10-11 12:00', DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_: string, value: string) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: (value: Buffer) => value.toString('base64url'),
    },
  };
  runInNewContext(DESIGN_EMAIL_SCRIPT, context);
  context.registerDesignEmail(event, { designUrl: 'https://example.com/design.png', customerName: '<script>x</script>', reference: 25, amount: 500 }, [2], ['one@example.com', 'two@example.com']);
  tags.adhub_mail_since = String(Date.now() - 120_000);
  return { context, event, tags, sendEmail, releaseLock, fetch, blob };
}

describe('scheduled design email script', () => {
  it('compiles the complete copyable Apps Script including email helpers', () => {
    expect(() => runInNewContext(getAppsScriptSourceCode(), {})).not.toThrow();
  });
  it('embeds the image and sends once per recipient across repeated runs', () => {
    const f = fixture();
    f.context.sendDesignEmailReminders();
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail).toHaveBeenCalledTimes(2);
    const first = f.sendEmail.mock.calls[0][0];
    expect(first.to).toBe('one@example.com');
    expect(first.htmlBody).toContain('cid:design');
    expect(first.inlineImages.design).toBe(f.blob);
    expect(first.htmlBody).toContain('&lt;script&gt;');
    expect(first.htmlBody).not.toContain('<script>');
    expect(first.htmlBody).toContain('500');
    expect(f.sendEmail.mock.calls[1][0].to).toBe('two@example.com');
    expect(f.releaseLock).toHaveBeenCalledTimes(2);
  });
  it('sends a clear fallback if image loading fails', () => {
    const f = fixture();
    f.fetch.mockImplementation(() => { throw new Error('offline'); });
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail.mock.calls[0][0].inlineImages).toBeUndefined();
    expect(f.sendEmail.mock.calls[0][0].htmlBody).toContain('صورة التصميم غير متاحة');
  });
  it('does not send before the reminder time or before initial registration', () => {
    const f = fixture();
    f.tags.adhub_mail_offsets = '[0]';
    f.context.sendDesignEmailReminders();
    f.tags.adhub_mail_offsets = '[2]';
    f.tags.adhub_mail_since = String(Date.now());
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail).not.toHaveBeenCalled();
  });
  it('does not resend an ambiguous failed send and releases the lock', () => {
    const f = fixture();
    f.sendEmail.mockImplementationOnce(() => { throw new Error('timeout'); });
    expect(() => f.context.sendDesignEmailReminders()).toThrow('timeout');
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail.mock.calls.map(args => args[0].to)).toEqual(['one@example.com', 'two@example.com']);
    expect(f.releaseLock).toHaveBeenCalledTimes(2);
  });
  it('skips delivery when quota is exhausted or a worker holds the lock', () => {
    const f = fixture();
    f.context.MailApp.getRemainingDailyQuota = () => 0;
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail).not.toHaveBeenCalled();
    f.context.LockService.getScriptLock = () => ({ tryLock: () => false });
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail).not.toHaveBeenCalled();
  });
  it('updates metadata without resetting delivery history', () => {
    const f = fixture();
    f.context.sendDesignEmailReminders();
    f.context.registerDesignEmail(f.event, { designUrl: 'https://example.com/new.png', customerName: 'Updated' }, [2], ['one@example.com', 'two@example.com']);
    f.context.sendDesignEmailReminders();
    expect(f.sendEmail).toHaveBeenCalledTimes(2);
    expect(f.tags.adhub_mail_image).toBe('https://example.com/new.png');
  });
  it('does not spend write operations registering unchanged email metadata', () => {
    const f = fixture();
    const write = vi.spyOn(f.event, 'setTag');
    f.context.registerDesignEmail(f.event, { designUrl: 'https://example.com/design.png', customerName: '<script>x</script>', reference: 25, amount: 500 }, [2], ['one@example.com', 'two@example.com']);
    expect(write).not.toHaveBeenCalled();
  });
  it('installs one trigger and removes only its own trigger when disabled', () => {
    const f = fixture();
    const triggers: any[] = [];
    const builder: any = { timeBased: () => builder, everyMinutes: () => builder,
      create: vi.fn(() => triggers.push({ getHandlerFunction: () => 'sendDesignEmailReminders' })) };
    f.context.ScriptApp = { getProjectTriggers: () => triggers, newTrigger: () => builder, deleteTrigger: vi.fn() };
    f.context.enableDesignEmailReminders();
    f.context.enableDesignEmailReminders();
    expect(builder.create).toHaveBeenCalledTimes(1);
    triggers.push({ getHandlerFunction: () => 'unrelated' });
    f.context.disableDesignEmailReminders();
    expect(f.context.ScriptApp.deleteTrigger).toHaveBeenCalledTimes(1);
  });
});
