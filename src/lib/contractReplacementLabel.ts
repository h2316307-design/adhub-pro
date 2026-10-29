/** Shared by the preview and printed contract: keep both identities on separate lines. */
export function renderReplacementLabel(name: string, replacedName?: string): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const identity = (value: string) => `<bdi dir="auto" style="display:block;unicode-bidi:isolate;overflow-wrap:anywhere;word-break:normal;">${escape(value)}</bdi>`;
  return `<div class="contract-replacement-label" dir="rtl" style="display:block;text-align:center;line-height:1.4;padding:4px 2px;">
    <div style="font-weight:700;">${identity(name)}</div>
    <div style="margin-top:3px;padding-top:3px;border-top:1px solid #d6ac40;color:#62480b;font-weight:600;">${replacedName ? 'بديلة عن اللوحة' : 'لوحة بديلة'}</div>
    ${replacedName ? `<div style="color:#374151;">${identity(replacedName)}</div>` : ''}
  </div>`;
}
