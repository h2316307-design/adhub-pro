import { ImageViewer } from '@/components/shared/ImageViewer';

/** غلاف توافقي: كل الاستخدامات القديمة تمر عبر العارض الموحد */
export default function ImageLightbox({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return <ImageViewer images={[{ src: imageUrl }]} onClose={onClose} />;
}
