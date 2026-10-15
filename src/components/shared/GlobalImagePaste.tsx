/**
 * لصق الصور من الحافظة (Ctrl+V) في أي مكان فيه رفع صورة.
 * يختار حقل رفع الصور المناسب: آخر حقل تفاعل معه المستخدم (أو منطقة قريبة منه)،
 * وإلا الحقل الوحيد في النافذة المفتوحة في الأعلى — ثم يمرّر الصورة إليه كأنها اختيرت يدوياً.
 * المكوّنات التي تعالج اللصق بنفسها (preventDefault) لا تتأثر.
 */
import { useEffect } from 'react';
import { toast } from 'sonner';

const SELECTOR = 'input[type="file"]';
const acceptsImage = (i: HTMLInputElement) => !i.disabled && (!i.accept || /image|\.png|\.jpe?g|\.webp|\.gif/i.test(i.accept));
const inDom = (el: Element | null) => !!el && document.contains(el);

function topLayer(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).filter(d => (d as HTMLElement).offsetParent !== null || getComputedStyle(d).position === 'fixed');
  return (dialogs[dialogs.length - 1] as ParentNode) || document;
}

function nearestInput(from: Element | null): HTMLInputElement | null {
  let el: Element | null = from;
  for (let depth = 0; el && depth < 7; depth++, el = el.parentElement) {
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>(SELECTOR)).filter(acceptsImage);
    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1) return null; // منطقة فيها أكثر من حقل — نترك الاختيار لآخر نقرة دقيقة
  }
  return null;
}

export function GlobalImagePaste() {
  useEffect(() => {
    let lastTarget: Element | null = null;
    let lastInput: HTMLInputElement | null = null;

    const remember = (e: Event) => {
      const t = e.target as Element | null;
      if (!t || !(t instanceof Element)) return;
      lastTarget = t;
      if (t instanceof HTMLInputElement && t.type === 'file') { lastInput = t; return; }
      const near = nearestInput(t);
      if (near) lastInput = near;
    };

    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const files = Array.from(e.clipboardData?.items || [])
        .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
        .map(it => it.getAsFile())
        .filter(Boolean) as File[];
      if (!files.length) return;

      const layer = topLayer();
      let input: HTMLInputElement | null = null;
      if (lastInput && inDom(lastInput) && (layer === document || (layer as Element).contains(lastInput)) && acceptsImage(lastInput)) input = lastInput;
      if (!input) {
        const candidates = Array.from(layer.querySelectorAll<HTMLInputElement>(SELECTOR)).filter(acceptsImage);
        if (candidates.length === 1) input = candidates[0];
        else if (candidates.length > 1 && lastTarget && inDom(lastTarget)) input = nearestInput(lastTarget);
        if (!input && candidates.length > 1) {
          toast.info('انقر على حقل الصورة المطلوب أولاً ثم الصق (Ctrl+V)');
          return;
        }
      }
      if (!input) return;

      e.preventDefault();
      const dt = new DataTransfer();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      (input.multiple ? files : files.slice(0, 1)).forEach((f, i) => {
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        dt.items.add(new File([f], f.name && f.name !== 'image.png' ? f.name : `pasted-${stamp}${i ? `-${i}` : ''}.${ext}`, { type: f.type }));
      });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      toast.success('تم لصق الصورة من الحافظة');
    };

    document.addEventListener('pointerdown', remember, true);
    document.addEventListener('focusin', remember, true);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('pointerdown', remember, true);
      document.removeEventListener('focusin', remember, true);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
  return null;
}

export default GlobalImagePaste;
