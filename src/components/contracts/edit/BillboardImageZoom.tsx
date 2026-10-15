import React, { useState } from 'react';
import type { Billboard } from '@/types';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { BillboardImage } from '@/components/BillboardImage';
import { ZoomIn } from 'lucide-react';

interface Props {
  billboard: Billboard;
  alt?: string;
  className?: string;
  containerClassName?: string;
  thumbnailObjectFit?: 'cover' | 'contain' | 'fill';
}

export const BillboardImageZoom: React.FC<Props> = ({
  billboard,
  alt = 'صورة اللوحة',
  className = 'w-full h-full object-cover',
  containerClassName = '',
  thumbnailObjectFit = 'cover',
}) => {
  const [open, setOpen] = useState(false);
  if (!billboard) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-muted-foreground text-xs ${containerClassName}`}>
        لا توجد صورة
      </div>
    );
  }
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`group/zoom relative w-full h-full block overflow-hidden cursor-pointer ${containerClassName}`}
        title="تكبير الصورة"
      >
        <BillboardImage billboard={billboard} alt={alt} className={className} objectFit={thumbnailObjectFit} />
        <div className="absolute top-3 left-3 rounded-lg border border-white/30 bg-black/60 p-2 text-white opacity-100 shadow-lg backdrop-blur-sm transition-all duration-200 pointer-events-none z-10 sm:opacity-0 sm:group-hover/zoom:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>
      {open && (
        <ImageViewer
          images={[{ src: String((billboard as any).Image_URL || (billboard as any).image || ''), label: alt }]}
          title={alt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default BillboardImageZoom;
