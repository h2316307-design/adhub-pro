import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Layers,
  Ruler,
  Sparkles,
  X
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
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
}

export function RemovalTaskItemCard({ 
  item, 
  billboard, 
  isSelected, 
  onSelectChange 
}: RemovalTaskItemCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isCompleted = item.status === 'completed';

  // Get the best available image
  const heroImage = billboard.Image_URL || item.design_face_a || item.design_face_b;
  const designImage = item.design_face_a || item.design_face_b;

  const handleOpenMap = () => {
    if (billboard.GPS_Coordinates) {
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
          relative overflow-hidden rounded-2xl transition-all duration-500 ease-out
          ${isCompleted 
            ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' 
            : isSelected
              ? 'ring-2 ring-primary shadow-xl shadow-primary/10'
              : 'ring-1 ring-border hover:ring-primary/40 hover:shadow-xl hover:shadow-black/5'
          }
        `}>
          {/* خلفية مستوحاة من التصميم */}
          {heroImage && (
            <div 
              className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
              style={{ 
                backgroundImage: `url(${heroImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(30px) saturate(1.5)',
              }}
            />
          )}
          
          {/* التخطيط الرئيسي: المحتوى على اليسار + التصميم على اليمين */}
          <div className="relative flex min-h-[180px]">
            {/* قسم المحتوى على اليسار */}
            <div className="flex-1 p-4 space-y-3">
              {/* Header with ID and Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isCompleted && (
                    <div 
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all border-2
                        ${isSelected 
                          ? 'bg-primary border-primary text-primary-foreground scale-110' 
                          : 'border-muted-foreground/30 hover:border-primary/50'
                        }
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectChange(!isSelected);
                      }}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                  )}
                  <Badge variant="outline" className="font-bold text-xs bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
                    #{billboard.ID}
                  </Badge>
                </div>
                
                <Badge 
                  className={`
                    border-0 font-medium text-xs px-2.5 py-1
                    ${isCompleted 
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    }
                  `}
                >
                  {isCompleted ? (
                    <><CheckCircle2 className="h-3 w-3 ml-1" /> مكتمل</>
                  ) : (
                    <><Clock className="h-3 w-3 ml-1" /> معلق</>
                  )}
                </Badge>
              </div>

              {/* Billboard Name */}
              <h3 className="font-bold text-base leading-tight line-clamp-1">
                {billboard.Billboard_Name || `لوحة ${billboard.ID}`}
              </h3>

              {/* Location */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium truncate text-xs">
                    {billboard.City} - {billboard.Municipality}
                  </span>
                </div>
                
                {billboard.Nearest_Landmark && (
                  <p className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                    <Navigation className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{billboard.Nearest_Landmark}</span>
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/80 px-2 py-1 rounded-full">
                  <Ruler className="h-3 w-3 text-muted-foreground" />
                  {billboard.Size || 'غير محدد'}
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/80 px-2 py-1 rounded-full">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  {billboard.Faces_Count || 1} وجه
                </div>
              </div>

              {/* Completion Info */}
              {isCompleted && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">
                      {item.removal_date ? format(new Date(item.removal_date), 'dd MMMM yyyy', { locale: ar }) : 'تم الإزالة'}
                    </span>
                  </div>
                </div>
              )}

              {/* Map Button */}
              {billboard.GPS_Coordinates && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenMap}
                  className="w-full gap-2 h-8 rounded-lg text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  فتح الموقع
                </Button>
              )}
            </div>

            {/* قسم الصورة على اليمين */}
            {heroImage && (
              <div className="relative w-32 sm:w-40 flex-shrink-0 border-l border-border/30">
                {/* خلفية ضبابية */}
                <div 
                  className="absolute inset-0"
                  style={{ 
                    backgroundImage: `url(${heroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px) brightness(0.8)',
                    opacity: 0.6
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/80" />
                
                {/* الصورة الرئيسية */}
                <div 
                  className="relative h-full p-2 flex items-center justify-center cursor-pointer z-10"
                  onClick={() => setPreviewImage(heroImage)}
                >
                  <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/20 shadow-lg group">
                    <img 
                      src={heroImage}
                      alt={billboard.Billboard_Name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* صورة التصميم الإضافية */}
                {designImage && designImage !== heroImage && (
                  <div 
                    className="absolute bottom-2 right-2 w-12 h-12 rounded-lg overflow-hidden ring-2 ring-white/40 cursor-pointer hover:ring-white/70 transition-all shadow-xl z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(designImage);
                    }}
                  >
                    <img 
                      src={designImage} 
                      alt="التصميم" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Preview */}
      <AnimatePresence>
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-4 left-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white h-10 w-10"
                >
                  <X className="h-5 w-5" />
                </Button>
                <img
                  src={previewImage}
                  alt="معاينة"
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
