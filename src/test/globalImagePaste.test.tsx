import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalImagePaste } from '@/components/shared/GlobalImagePaste';
import { acceptsImageInput, pasteImagesIntoInput } from '@/lib/imageClipboard';

const notifications = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: notifications }));

describe('clipboard images across upload fields', () => {
  let host: HTMLDivElement, root: Root;
  const image = () => new File(['image'], 'clipboard.png', { type: 'image/png' });
  const read = vi.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read } });
    read.mockReset(); notifications.info.mockReset(); notifications.error.mockReset();
    read.mockResolvedValue([{ types: ['image/png'], getType: async () => image() }]);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove();
    document.querySelectorAll('[data-test-upload]').forEach(node => node.remove());
  });
  async function render(children: React.ReactNode) {
    await act(async () => { root.render(<>{children}<GlobalImagePaste /></>); });
  }
  function paste(target: Element) {
    const transfer = new DataTransfer(); transfer.items.add(image());
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    target.dispatchEvent(event); return event;
  }
  it('adds controls to native image fields and excludes spreadsheets and folder selectors', async () => {
    await render(<><input type="file" accept="image/*" /><input type="file" accept=".xlsx,.csv" /><input type="file" accept="image/*" {...{ webkitdirectory: '' }} /></>);
    expect(host.querySelectorAll('[data-image-paste-control] button')).toHaveLength(1);
  });
  it('routes the paste button to the chosen face and runs its existing React handler once', async () => {
    const front = vi.fn(), back = vi.fn();
    await render(<><input type="file" accept="image/*" aria-label="أمامي" onChange={front} /><input type="file" accept="image/*" aria-label="خلفي" onChange={back} /></>);
    await act(async () => (host.querySelector('[aria-label="لصق من الحافظة: خلفي"]') as HTMLButtonElement).click());
    expect(front).not.toHaveBeenCalled(); expect(back).toHaveBeenCalledOnce();
  });
  it('keeps controls outside upload labels and does not open the picker', async () => {
    const clicked = vi.fn();
    await render(<label>رفع صورة<input type="file" accept="image/*" onClick={clicked} /></label>);
    expect(host.querySelector('label [data-image-paste-control]')).toBeNull();
    await act(async () => (host.querySelector('[data-image-paste-control] button') as HTMLButtonElement).click());
    expect(clicked).not.toHaveBeenCalled();
  });
  it('detects new fields in dialogs and removes controls when fields disappear', async () => {
    await render(null);
    const dialog = document.createElement('div'); dialog.dataset.testUpload = ''; dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<input type="file" accept="image/*">';
    await act(async () => { document.body.append(dialog); });
    expect(dialog.querySelector('[data-image-paste-control] button')).toBeTruthy();
    await act(async () => { dialog.querySelector('input')!.remove(); });
    expect(dialog.querySelector('[data-image-paste-control]')).toBeNull();
  });
  it('does not paste into a background field while a dialog is open', async () => {
    const background = vi.fn(), foreground = vi.fn();
    await render(<><input type="file" accept="image/*" onChange={background} /><div role="dialog"><input type="file" accept="image/*" onChange={foreground} /></div></>);
    await act(async () => { paste(document.body); });
    expect(background).not.toHaveBeenCalled(); expect(foreground).toHaveBeenCalledOnce();
  });
  it('does not guess a face when multiple fields are present', async () => {
    const change = vi.fn();
    await render(<><input type="file" accept="image/*" onChange={change} /><input type="file" accept="image/*" onChange={change} /></>);
    await act(async () => { paste(document.body); });
    expect(change).not.toHaveBeenCalled(); expect(notifications.info).toHaveBeenCalledOnce();
  });
  it('preserves paste inside text editors and handlers that already consumed the image', async () => {
    const upload = vi.fn();
    await render(<><textarea /><input type="file" accept="image/*" onChange={upload} /><div data-local-paste onPaste={event => event.preventDefault()} /></>);
    await act(async () => { expect(paste(host.querySelector('textarea')!).defaultPrevented).toBe(false); paste(host.querySelector('[data-local-paste]')!); });
    expect(upload).not.toHaveBeenCalled();
  });
  it('reflects disabled fields and rechecks after asynchronous clipboard access', async () => {
    const upload = vi.fn();
    await render(<input type="file" accept="image/*" onChange={upload} />);
    const input = host.querySelector('input')!;
    await act(async () => { input.disabled = true; });
    expect((host.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    expect(pasteImagesIntoInput(input, [image()])).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });
  it('supports multiple images only on fields accepting multiple files', async () => {
    await render(<><input type="file" accept="image/*" /><input type="file" accept="image/*" multiple /></>);
    const [single, multi] = host.querySelectorAll('input');
    pasteImagesIntoInput(single, [image(), image()]); pasteImagesIntoInput(multi, [image(), image()]);
    expect(single.files).toHaveLength(1); expect(multi.files).toHaveLength(2);
  });
  it('enforces accepted formats and excludes unspecified file upload fields', async () => {
    await render(<><input type="file" accept="image/jpeg" /><input type="file" /></>);
    const [jpeg, unspecified] = host.querySelectorAll('input');
    expect(() => pasteImagesIntoInput(jpeg, [image()])).toThrow('نوع الصور');
    expect(acceptsImageInput(unspecified)).toBe(false);
  });
  it('explains clipboard permission failures without triggering an upload', async () => {
    read.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const change = vi.fn(); await render(<input type="file" accept="image/*" onChange={change} />);
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(change).not.toHaveBeenCalled(); expect(notifications.error).toHaveBeenCalledWith(expect.stringContaining('Ctrl+V'));
  });
});
