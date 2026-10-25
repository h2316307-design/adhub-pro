import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { acceptsImageInput, clipboardImageFiles, pasteImagesIntoInput, readClipboardImages } from '@/lib/imageClipboard';

const SELECTOR = 'input[type="file"]';
const isEnabled = (input: HTMLInputElement) => !input.disabled && !input.closest('fieldset[disabled]');
const imageInputs = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLInputElement>(SELECTOR)).filter(acceptsImageInput);

function topLayer(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]'))
    .filter(dialog => !dialog.hidden && dialog.getAttribute('data-state') !== 'closed' &&
      getComputedStyle(dialog).display !== 'none' && getComputedStyle(dialog).visibility !== 'hidden');
  return dialogs[dialogs.length - 1] || document;
}

function nearestInput(from: Element | null, layer: ParentNode): HTMLInputElement | null {
  let el = from;
  while (el && (layer === document || (layer as Element).contains(el))) {
    if (el instanceof HTMLInputElement && acceptsImageInput(el)) return el;
    const inputs = imageInputs(el);
    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1 || el === layer) return null;
    el = el.parentElement;
  }
  return null;
}

interface PasteTarget { input: HTMLInputElement; anchor: HTMLSpanElement; disabled: boolean; label: string }

function PasteButton({ input, disabled, label }: PasteTarget) {
  const [reading, setReading] = useState(false);
  return <button type="button" disabled={disabled || reading}
    aria-label={`لصق من الحافظة${label ? `: ${label}` : ''}`}
    title="لصق صورة من الحافظة، أو انقر قرب حقل الصورة واضغط Ctrl+V"
    className="my-1 inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    onClick={async event => {
      event.preventDefault(); event.stopPropagation();
      if (reading || !isEnabled(input)) return;
      setReading(true);
      try {
        const files = await readClipboardImages();
        if (!files.length) { toast.info('لا توجد صورة في الحافظة. انسخ صورة ثم أعد المحاولة'); return; }
        pasteImagesIntoInput(input, files);
      } catch (error) {
        toast.error(error instanceof Error && error.name !== 'NotAllowedError' ? error.message : 'تعذر الوصول للحافظة. انقر قرب حقل الصورة ثم استخدم Ctrl+V');
      } finally { setReading(false); }
    }}>
    {reading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <ClipboardPaste className="h-4 w-4 text-primary" />}
    لصق من الحافظة
  </button>;
}

/** Cover native and shared file inputs, including dynamically opened dialogs. */
export function GlobalImagePaste() {
  const [targets, setTargets] = useState<PasteTarget[]>([]);
  useEffect(() => {
    const anchors = new Map<HTMLInputElement, HTMLSpanElement>();
    let nextAnchorId = 0;
    let lastInput: HTMLInputElement | null = null;
    const sync = () => {
      const inputs = imageInputs(document);
      for (const [input, anchor] of anchors) {
        if (!inputs.includes(input)) { anchor.remove(); anchors.delete(input); }
      }
      const next = inputs.map(input => {
        let anchor = anchors.get(input);
        if (!anchor?.isConnected) {
          anchor = document.createElement('span');
          anchor.dataset.imagePasteControl = '';
          anchor.id = `image-paste-control-${nextAnchorId++}`;
          // A sibling of the label prevents opening the picker when pasting.
          (input.closest('label') || input).after(anchor);
          anchors.set(input, anchor);
        }
        const label = input.getAttribute('aria-label') || Array.from(input.labels || []).map(label => label.textContent?.trim()).join(' ') || '';
        return { input, anchor, disabled: !isEnabled(input), label };
      });
      setTargets(prev => prev.length === next.length && prev.every((target, index) =>
        target.input === next[index].input && target.anchor === next[index].anchor &&
        target.disabled === next[index].disabled && target.label === next[index].label) ? prev : next);
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => {
        if (record.target instanceof Element && record.target.closest('[data-image-paste-control]')) return false;
        if (record.type === 'attributes') return record.target instanceof HTMLInputElement ||
          record.target instanceof HTMLFieldSetElement;
        return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
          (node.matches(`${SELECTOR},[data-image-paste-control]`) || node.querySelector(SELECTOR)));
      })) sync();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'accept', 'type', 'aria-label'] });
    sync();
    const remember = (event: Event) => {
      if (event.target instanceof Element) lastInput = nearestInput(event.target, topLayer());
    };
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const files = clipboardImageFiles(event.clipboardData);
      if (!files.length) return;
      const layer = topLayer();
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('textarea,[contenteditable="true"],input:not([type="file"])')) return;
      let input = nearestInput(target, layer);
      if (!input && lastInput?.isConnected && (layer === document || (layer as Element).contains(lastInput))) input = lastInput;
      if (!input) {
        const candidates = imageInputs(layer).filter(isEnabled);
        if (candidates.length === 1) input = candidates[0];
        else if (candidates.length > 1) toast.info('اختر حقل الصورة المطلوب أو اضغط زر لصق من الحافظة بجواره');
      }
      if (!input || !isEnabled(input)) return;
      event.preventDefault();
      try { pasteImagesIntoInput(input, files); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر لصق الصورة'); }
    };
    document.addEventListener('pointerdown', remember, true);
    document.addEventListener('focusin', remember, true);
    document.addEventListener('paste', onPaste);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', remember, true);
      document.removeEventListener('focusin', remember, true);
      document.removeEventListener('paste', onPaste);
      anchors.forEach(anchor => anchor.remove());
    };
  }, []);
  return <>{targets.map(target => createPortal(<PasteButton {...target} />, target.anchor, target.anchor.id))}</>;
}

export default GlobalImagePaste;
