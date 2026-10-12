import { describe, it, expect, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import script from '../../public/downloads/GoogleDriveUploader.gs?raw';

function fixture(existing = false, status = 200) {
  const file = { getId: () => 'file-id', getMimeType: () => 'image/png', getUrl: () => 'https://drive.google.com/file/d/file-id/view',
    getSharingAccess: () => 'public', setSharing: vi.fn() };
  const folder = { getFilesByName: () => { let left = existing; return { hasNext: () => left, next: () => { left = false; return file; } }; }, createFile: vi.fn(() => file) };
  const releaseLock = vi.fn();
  const fetch = vi.fn((_url: string, _options: unknown) => ({ getResponseCode: () => status }));
  const context: any = { console,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock }) },
    DriveApp: { getFolderById: () => folder, Access: { ANYONE_WITH_LINK: 'public' }, Permission: { VIEW: 'view' } },
    Utilities: { base64Decode: () => [1, 2, 3], newBlob: () => ({}) },
    ScriptApp: { getOAuthToken: () => 'test-token' }, UrlFetchApp: { fetch },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (value: string) => ({ setMimeType: () => JSON.parse(value) }) },
  };
  runInNewContext(script, context);
  const upload = (data = { file: 'YWJj', name: 'design.png', type: 'image/png' }) => context.doPost({ postData: { contents: JSON.stringify(data) } });
  return { upload, fetch, file, folder, releaseLock };
}
describe('Drive upload script', () => {
  it('creates a file with ID-based URLs', () => {
    const f = fixture();
    expect(f.upload()).toMatchObject({ success: true, updated: false, fileId: 'file-id', url: 'https://lh3.googleusercontent.com/d/file-id' });
    expect(f.releaseLock).toHaveBeenCalledOnce();
  });
  it('updates existing content without creating a different file', () => {
    const f = fixture(true);
    expect(f.upload()).toMatchObject({ success: true, updated: true, fileId: 'file-id' });
    expect(f.folder.createFile).not.toHaveBeenCalled();
    expect(f.fetch.mock.calls[0][0]).toContain('/files/file-id?uploadType=media');
  });
  it('does not claim success when Drive rejects an update', () => {
    const f = fixture(true, 429);
    expect(f.upload()).toMatchObject({ success: false });
    expect(f.releaseLock).toHaveBeenCalledOnce();
  });
  it('reports that a file is saved but not publicly shared', () => {
    const f = fixture();
    f.file.getSharingAccess = () => 'private';
    f.file.setSharing.mockImplementation(() => { throw new Error('policy'); });
    expect(f.upload()).toMatchObject({ success: false, saved: true, fileId: 'file-id' });
  });
  it('rejects malformed input before creating a file', () => {
    const f = fixture();
    expect(f.upload({ file: '*', name: 'file.png', type: 'image/png' }).success).toBe(false);
    expect(f.folder.createFile).not.toHaveBeenCalled();
  });
});
