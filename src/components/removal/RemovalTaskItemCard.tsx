import { useState } from 'react';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Layers, 
  X, 
  Camera,
  Image as ImageIcon,
  Palette,
  Maximize2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface RemovalTaskItemCardProps {
  item: any;
  billboard: any;
  contract?: any;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onComplete?: () => void;
}

export function RemovalTaskItemCard({ 
  item, 
  billboard, 
  contract,
  isSelected, 
  onSelectChange,
  onComplete
}: RemovalTaskItemCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFace, setSelectedFace] = useState<'a' | 'b'>('a');
  const isCompleted = item.status === 'completed';

  // استخراج جميع الصور المتاحة (التصميم مستقل تماماً عن صورة هيكل اللوحة)
  const billboardStreetUrl = (billboard?.Image_URL || '').trim();
  const sanitizeDesignCandidate = (url?: string | null) => {
    if (!url) return null;
    const norm = normalizeGoogleImageUrl(url);
    if (!norm) return null;
    if (billboardStreetUrl && (norm === billboardStreetUrl || url.trim() === billboardStreetUrl)) return null;
    return norm;
  };

  const designFaceA = sanitizeDesignCandidate(item.design_face_a);
  const designFaceB = sanitizeDesignCandidate(item.design_face_b);
  const installedImg = normalizeGoogleImageUrl(
    item.installed_image_face_a_url || item.installed_image_url || item.installed_image_face_b_url || billboard?.installed_image_url
  );
  const billboardImg = normalizeGoogleImageUrl(billboard?.Image_URL);

  const activeDesign = (selectedFace === 'b' && designFaceB) ? designFaceB : (designFaceA || designFaceB);
  const hasBothImages = Boolean(activeDesign && billboardImg);

  const handleOpenMap = () => {
    if (billboard?.GPS_Coordinates) {
      window.open(`https://www.google.com/maps?q=${billboard.GPS_Coordinates}`, '_blank');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="group"
      >
        <div className={`
          relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-200
          ${isCompleted 
            ? 'border-emerald-500/25 bg-emerald-500/[0.06] shadow-sm'
            : isSelected
              ? 'border-primary bg-primary/[0.07] shadow-md shadow-primary/10 ring-1 ring-primary/40'
              : 'border-border/45 bg-card/85 shadow-sm hover:border-primary/40 hover:shadow-md'
          }
        `}>
          <div className="space-y-3">
            {/* حاوية الصور الرئيسية: التصميم على اليمين واللوحة على اليسار في RTL */}
            <div className="relative overflow-hidden rounded-xl bg-muted ring-1 ring-border/30">
              {/* Checkbox للتحديد */}
              {!isCompleted && (
                <button
                  type="button"
                  className={`
                    absolute right-2 top-2 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border-2 shadow-md backdrop-blur-md transition-all duration-200 active:scale-95
                    ${isSelected 
                      ? 'scale-105 border-primary bg-primary text-primary-foreground'
                      : 'border-white/60 bg-black/50 text-white hover:border-primary/70 hover:bg-black/70'
                    }
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChange(!isSelected);
                  }}
                  aria-label={isSelected ? 'إلغاء تحديد اللوحة' : 'تحديد اللوحة'}
                >
                  <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
                </button>
              )}

              {/* شارة حالة الإزالة */}
              <div className={`
                absolute top-2 left-2 flex h-6 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold text-white shadow-sm backdrop-blur-md z-20
                ${isCompleted 
                  ? 'border-emerald-300/30 bg-emerald-600/90'
                  : 'border-amber-300/30 bg-amber-600/90'
                }
              `}>
                {isCompleted ? (
                  <><CheckCircle2 className="h-3 w-3" /> مكتمل</>
                ) : (
                  <><Clock className="h-3 w-3" /> معلق</>
                )}
              </div>

              {/* رقم اللوحة */}
              <div className="absolute bottom-2 left-2 rounded-lg border border-primary/30 bg-primary/95 px-2 py-0.5 shadow-sm backdrop-blur-md z-20">
                <span className="font-mono text-[10px] font-extrabold text-primary-foreground">
                  #{billboard?.ID || item.billboard_id}
                </span>
              </div>

              {hasBothImages ? (
                <div className="grid grid-cols-2 gap-1.5 aspect-[16/9] p-1">
                  {/* تصميم الإعلان (على اليمين) */}
                  <div className="relative rounded-lg overflow-hidden bg-muted group/img border border-amber-500/30">
                    <img
                      src={activeDesign!}
                      alt="تصميم الإعلان"
                      loading="lazy"
                      className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover/img:scale-105"
                      onClick={() => setPreviewImage(activeDesign!)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge className="absolute bottom-1.5 right-1.5 z-10 bg-amber-500/90 text-white gap-1 text-[9px] font-bold py-0 px-1.5 pointer-events-none">
                      <Palette className="h-2.5 w-2.5" />التصميم
                    </Badge>
                  </div>

                  {/* صورة اللوحة (على اليسار) */}
                  <div className="relative rounded-lg overflow-hidden bg-muted group/img">
                    <img
                      src={billboardImg!}
                      alt={billboard?.Billboard_Name || `لوحة #${billboard?.ID || item.billboard_id}`}
                      loading="lazy"
                      className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover/img:scale-105"
                      onClick={() => setPreviewImage(billboardImg!)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge className="absolute bottom-1.5 right-1.5 z-10 bg-slate-700/90 text-white gap-1 text-[9px] py-0 px-1.5 pointer-events-none">
                      <ImageIcon className="h-2.5 w-2.5" />اللوحة
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-[16/9]">
                  {activeDesign || billboardImg ? (
                    <>
                      <img
                        src={(activeDesign || billboardImg)!}
                        alt={billboard?.Billboard_Name || `لوحة #${billboard?.ID || item.billboard_id}`}
                        className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        onClick={() => setPreviewImage((activeDesign || billboardImg)!)}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
                      <Badge className={`absolute bottom-2 right-2 z-10 text-[9px] gap-1 ${activeDesign ? 'bg-amber-500/90 text-white font-bold' : 'bg-slate-700/90 text-white'}`}>
                        {activeDesign ? <><Palette className="h-2.5 w-2.5" />تصميم الإعلان</> : <><ImageIcon className="h-2.5 w-2.5" />صورة اللوحة</>}
                      </Badge>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50 p-2 text-center">
                      <Layers className="h-8 w-8 text-muted-foreground/40 mb-1" />
                      <span className="text-[10px] text-muted-foreground">صورة اللوحة والتصميم غير متوفرة</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* أزرار تبديل الوجهين الأمامي والخلفي إذا توفرا */}
            {designFaceA && designFaceB && (
              <div className="flex gap-1.5 rounded-lg border border-border/50 bg-muted/20 p-1" aria-label="أوجه التصميم">
                <button
                  type="button"
                  onClick={() => setSelectedFace('a')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    selectedFace === 'a' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  الوجه الأمامي
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFace('b')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    selectedFace === 'b' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  الوجه الخلفي
                </button>
              </div>
            )}
            {installedImg && <button type="button" onClick={() => setPreviewImage(installedImg)} className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer transition-all duration-200 hover:text-primary"><Camera className="h-3.5 w-3.5" />عرض صورة التركيب</button>}

            {/* تفاصيل اللوحة */}
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between gap-1">
                <p className={`line-clamp-1 text-sm font-black ${isCompleted ? 'text-emerald-400' : 'text-foreground'}`} dir="ltr">
                  {billboard?.Billboard_Name || `TR-${item.billboard_id}`}
                </p>
                {/* تنبيه إذا لم يتوفر تصميم */}
                {!designFaceA && !designFaceB && (
                  <Badge variant="outline" className="border-dashed text-[9px] text-muted-foreground px-1.5 py-0 h-5">
                    بدون تصميم
                  </Badge>
                )}
              </div>
              
              {/* الشارات: المقاس والبلدية */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={`h-6 rounded-lg px-2 text-[10px] font-bold ${isCompleted ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                  {billboard?.Size || 'غير محدد'}
                </Badge>
                {billboard?.Faces_Count && (
                  <Badge variant="outline" className={`h-6 rounded-lg px-2 text-[10px] font-medium ${isCompleted ? 'border-emerald-500/25 text-emerald-400' : 'border-border/50'}`}>
                    {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                  </Badge>
                )}
                {billboard?.Municipality && (
                  <Badge variant="secondary" className="h-6 rounded-lg px-2 text-[10px] font-normal text-muted-foreground">
                    {billboard.Municipality}
                  </Badge>
                )}
              </div>
              
              {/* الموقع والمعلم */}
              <div className={`flex min-h-10 items-start gap-1.5 rounded-xl border p-2 text-[10px] ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-border/40 bg-muted/30'}`}>
                <MapPin className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-primary'}`} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className={`truncate text-[10px] font-bold ${isCompleted ? 'text-emerald-300' : 'text-foreground'}`}>
                    {billboard?.City || 'طرابلس'} - {billboard?.District || billboard?.Municipality || 'غير محدد'}
                  </span>
                  {billboard?.Nearest_Landmark && (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {billboard.Nearest_Landmark}
                    </span>
                  )}
                </div>
              </div>

              {/* تاريخ الإزالة للمكتملة */}
              {isCompleted && item.removal_date && (
                <div className="flex min-h-8 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    تم الإزالة: {format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar })}
                  </span>
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="mt-2 flex items-center gap-2">
                {billboard?.GPS_Coordinates && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => { event.stopPropagation(); handleOpenMap(); }}
                    className={`h-9 flex-1 cursor-pointer gap-1 rounded-xl text-[10px] font-bold transition-all duration-200 active:scale-95 ${
                      isCompleted 
                        ? 'hover:border-emerald-500 hover:bg-emerald-500 hover:text-white' 
                        : 'border-border/50 hover:border-primary hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    الموقع على الخريطة
                  </Button>
                )}

                {!isCompleted && onComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onComplete(); }}
                    className="h-9 flex-1 cursor-pointer gap-1 rounded-xl border-emerald-500/35 bg-emerald-500/10 text-[10px] font-black text-emerald-500 transition-all duration-200 hover:bg-emerald-500/20 active:scale-95"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    توثيق الإزالة
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Preview Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 rounded-2xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative flex flex-col items-center justify-center p-2"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPreviewImage(null)}
                  className="absolute left-4 top-4 z-20 h-10 w-10 cursor-pointer rounded-xl bg-white/10 text-white transition-all duration-200 hover:bg-white/20 active:scale-95"
                  aria-label="إغلاق المعاينة"
                >
                  <X className="h-5 w-5" />
                </Button>
                <img
                  src={previewImage}
                  alt="معاينة عالية الدقة"
                  className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
