import { PageSectionSettings } from '@/hooks/useContractTemplateSettings';

type TableTermSettings = NonNullable<PageSectionSettings['tableTerm']>;

interface BuildTableTermOptions {
  tableTerm: TableTermSettings;
  title: string;
  content: string;
}

export interface BuiltTableTermResult {
  html: string;
  height: number;
}

export function buildTableTermHtml({ tableTerm, title, content }: BuildTableTermOptions): BuiltTableTermResult {
  const fontSize = tableTerm.fontSize || 14;
  const titleWeight = tableTerm.titleFontWeight || 'bold';
  const contentWeight = tableTerm.contentFontWeight || 'normal';
  const textColor = tableTerm.color || '#1a1a2e';
  const termWrapHeight = Math.max(fontSize * 2, 32);
  const goldHeightPct = tableTerm.goldLine?.heightPercent || 30;
  const goldColor = tableTerm.goldLine?.color || '#D4AF37';
  const showGold = tableTerm.goldLine?.visible !== false;
  const goldHeightPx = Math.round(fontSize * goldHeightPct / 100 * 1.5);
  const goldBottomOffsetPx = Math.max(Math.round(fontSize * 0.06), 1);

  const goldLineHtml = showGold
    ? `
      <span style="
        position: absolute;
        left: 0; right: 0;
        bottom: ${goldBottomOffsetPx}px;
        height: ${goldHeightPx}px;
        background: ${goldColor};
        border-radius: 2px;
        z-index: 0;
      "></span>
    `
    : '';

  return {
    height: termWrapHeight,
    html: `
      <div style="
        font-size: ${fontSize}px;
        color: ${textColor};
        margin: 0; padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: ${termWrapHeight}px;
        direction: rtl;
        white-space: nowrap;
        font-family: 'Doran', sans-serif;
      ">
        <span style="
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          height: ${termWrapHeight}px;
          line-height: ${termWrapHeight}px;
          font-weight: ${titleWeight};
          z-index: 0;
        ">
          ${goldLineHtml}
          <span style="position: relative; z-index: 1; display: inline-flex; align-items: center; height: 100%;">${title}</span>
        </span>
        <span style="
          font-weight: ${contentWeight};
          display: inline-flex;
          align-items: center;
          height: ${termWrapHeight}px;
          line-height: ${termWrapHeight}px;
        ">${content}</span>
      </div>
    `,
  };
}