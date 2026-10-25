export function acceptsImageInput(input: HTMLInputElement): boolean {
  return input.type === 'file' && !input.hasAttribute('webkitdirectory') &&
    /(?:image\/|\.(?:png|jpe?g|webp|gif|bmp|svg|avif|heic|heif)\b)/i.test(input.accept);
}

export function clipboardImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files || []).filter(file => file.type.startsWith('image/'));
  return files.length ? files : Array.from(data.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter((file): file is File => !!file);
}

export async function readClipboardImages(): Promise<File[]> {
  if (!navigator.clipboard?.read) throw new Error('استخدم Ctrl+V داخل حقل الصورة للصق من الحافظة');
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find(type => type.startsWith('image/'));
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(new File([blob], `pasted-${Date.now()}-${files.length}.${type.split('/')[1].replace('jpeg', 'jpg')}`, { type }));
  }
  return files;
}

/** Reuse each field's existing validation, progress and upload behavior. */
export function pasteImagesIntoInput(input: HTMLInputElement, files: File[]): boolean {
  if (!input.isConnected || input.disabled || input.closest('fieldset[disabled]') || !acceptsImageInput(input)) return false;
  const accepted = input.accept.toLowerCase().split(',').map(value => value.trim());
  const matching = files.filter(file => accepted.some(type =>
    type === file.type.toLowerCase() || type === 'image/*' ||
    (type.startsWith('.') && file.name.toLowerCase().endsWith(type))));
  if (!matching.length) throw new Error('الصورة المنسوخة لا تطابق نوع الصور المسموح به في هذا الحقل');
  const transfer = new DataTransfer();
  (input.multiple ? matching : matching.slice(0, 1)).forEach(file => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
