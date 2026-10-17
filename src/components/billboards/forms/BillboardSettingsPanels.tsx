import type { ReactNode } from 'react';

/** A single scrolling form, with the image and ownership in a side column. */
export function BillboardSettingsPanels({ details, specifications, image, ownership }: {
  details: ReactNode; specifications: ReactNode; image: ReactNode; ownership: ReactNode;
}) {
  return <div dir="rtl" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">{details}{specifications}</div>
      <aside aria-label="صورة اللوحة والملكية" className="min-w-0 space-y-4">{image}{ownership}</aside>
    </div>
  </div>;
}
