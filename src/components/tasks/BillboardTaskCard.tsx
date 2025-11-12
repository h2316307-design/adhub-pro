import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, PaintBucket } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface BillboardTaskCardProps {
  item: any;
  billboard: any;
  isSelected: boolean;
  isCompleted: boolean;
  onSelectionChange: (checked: boolean) => void;
  onEditDesign?: () => void; // ✅ NEW: callback لتحرير التصميم
}

export function BillboardTaskCard({
  item,
  billboard,
  isSelected,
  isCompleted,
  onSelectionChange,
  onEditDesign, // ✅ NEW
}: BillboardTaskCardProps) {
  if (isCompleted) {
    return (
      <div className="group min-w-0 w-full overflow-hidden p-2 bg-gradient-to-br from-green-50 via-green-50/80 to-green-50/50 dark:from-green-950/30 dark:via-green-950/20 dark:to-green-950/10 rounded-lg border-[2px] border-green-300 dark:border-green-800 shadow-md hover:shadow-lg transition-all duration-300">
        <div className="space-y-1.5">
          <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-2 ring-green-300 dark:ring-green-800 shadow-sm">
            {billboard?.Image_URL ? (
              <img
                src={billboard.Image_URL}
                alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                className="w-full h-full object-cover opacity-90"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://via.placeholder.com/400x300?text=No+Image";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-green-900/40 via-transparent to-transparent"></div>
            
            {/* ✅ NEW: زر تحرير التصميم للوحات المكتملة */}
            {onEditDesign && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditDesign();
                  }}
                  className="h-6 w-6 rounded-full bg-green-600/90 backdrop-blur-sm hover:bg-green-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="إضافة صورة بعد التركيب"
                >
                  <PaintBucket className="h-3 w-3 text-white" />
                </button>
              </div>
            )}
            
            <div className="absolute top-2 left-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-1 rounded-full flex items-center gap-1.5 shadow-lg ring-1 ring-white/30 animate-pulse">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-[10px] font-bold">مكتمل</span>
            </div>
            <div className="absolute bottom-2 right-2 bg-gradient-to-r from-primary to-accent backdrop-blur-md px-2 py-1 rounded-full shadow-lg ring-1 ring-white/20">
              <span className="font-extrabold text-xs text-white">#{billboard?.ID}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-bold text-sm line-clamp-1 text-green-800 dark:text-green-300">
              {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
            </p>
            <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700">
              {billboard?.Size}
            </Badge>
            <div className="flex items-start gap-1 text-[10px] p-1 bg-green-100/50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
              <MapPin className="h-3 w-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-semibold text-green-800 dark:text-green-300 truncate text-[10px]">
                  {billboard?.Municipality || 'غير محدد'}
                </span>
                {billboard?.District && (
                  <span className="text-[9px] text-green-700 dark:text-green-400 truncate">
                    {billboard.District}
                  </span>
                )}
              </div>
            </div>
            {billboard?.Nearest_Landmark && (
              <div className="flex items-start gap-1 text-[10px] p-1 bg-green-100/50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                <Navigation className="h-3 w-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1 text-green-700 dark:text-green-400">
                  {billboard.Nearest_Landmark}
                </span>
              </div>
            )}
            {item.installation_date && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 p-1 bg-green-100/50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                <span className="text-[9px] truncate">
                  {format(new Date(item.installation_date), "dd/MM/yyyy", { locale: ar })}
                </span>
              </div>
            )}
          </div>

          {/* ✅ عرض التصاميم */}
          {(item.design_face_a || item.design_face_b) && (
            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center gap-1 mb-1.5">
                <PaintBucket className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-bold text-green-700 dark:text-green-300">التصاميم:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.design_face_a && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الأمامي</div>
                    <div className="relative h-20 rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                      <img
                        src={item.design_face_a}
                        alt="الوجه الأمامي"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://via.placeholder.com/200x150?text=No+Design";
                        }}
                      />
                    </div>
                  </div>
                )}
                {item.design_face_b && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الخلفي</div>
                    <div className="relative h-20 rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                      <img
                        src={item.design_face_b}
                        alt="الوجه الخلفي"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://via.placeholder.com/200x150?text=No+Design";
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group min-w-0 w-full overflow-hidden relative p-2 rounded-lg border-[2px] transition-all duration-300 cursor-pointer ${
        isSelected
          ? "border-primary bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-lg ring-2 ring-primary/50"
          : "border-border bg-gradient-to-br from-card to-card/90 hover:border-primary/70 hover:shadow-md hover:ring-1 hover:ring-primary/30"
      }`}
      onClick={() => onSelectionChange(!isSelected)}
    >
      <div className="absolute top-1.5 left-1.5 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
          className="h-4 w-4 border-2 shadow-md bg-background/95 backdrop-blur-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>

      {/* ✅ NEW: زر تحرير التصميم */}
      {onEditDesign && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditDesign();
            }}
            className="h-6 w-6 rounded-full bg-accent/90 backdrop-blur-sm hover:bg-accent flex items-center justify-center shadow-md transition-all hover:scale-110"
            title="تخصيص التصميم"
          >
            <PaintBucket className="h-3 w-3 text-white" />
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-2 ring-border group-hover:ring-primary/50 transition-all duration-300 shadow-sm">
          {billboard?.Image_URL ? (
            <img
              src={billboard.Image_URL}
              alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://via.placeholder.com/400x300?text=No+Image";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute bottom-1.5 right-1.5 bg-gradient-to-r from-primary to-accent backdrop-blur-md px-2 py-0.5 rounded-full shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform duration-300">
            <span className="font-bold text-[10px] text-white">#{billboard?.ID}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors duration-300">
            {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
          </p>
          <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-secondary text-secondary-foreground border border-border hover:border-primary transition-colors">
            {billboard?.Size}
          </Badge>
          <div className="flex items-start gap-1 text-[10px] p-1 bg-muted/50 rounded-md hover:bg-muted transition-colors border border-border">
            <MapPin className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-semibold truncate text-[10px]">
                {billboard?.Municipality || 'غير محدد'}
              </span>
              {billboard?.District && (
                <span className="text-[9px] text-muted-foreground truncate">
                  {billboard.District}
                </span>
              )}
            </div>
          </div>
          {billboard?.Nearest_Landmark && (
            <div className="flex items-start gap-1 text-[10px] p-1 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors border border-border">
              <Navigation className="h-3 w-3 text-accent mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1 font-medium text-muted-foreground">
                {billboard.Nearest_Landmark}
              </span>
            </div>
          )}
          {billboard?.GPS_Coordinates && (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground p-1 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors border border-border">
              <Navigation className="h-2.5 w-2.5 text-accent flex-shrink-0" />
              <span className="truncate font-medium">{billboard.GPS_Coordinates}</span>
            </div>
          )}
        </div>

        {/* ✅ عرض التصاميم */}
        {(item.design_face_a || item.design_face_b) && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1 mb-1.5">
              <PaintBucket className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-bold text-accent">التصاميم:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {item.design_face_a && (
                <div className="space-y-1">
                  <div className="text-[9px] font-medium text-muted-foreground text-center">الوجه الأمامي</div>
                  <div className="relative h-20 rounded-md overflow-hidden bg-muted border border-border hover:border-primary transition-colors">
                    <img
                      src={item.design_face_a}
                      alt="الوجه الأمامي"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://via.placeholder.com/200x150?text=No+Design";
                      }}
                    />
                  </div>
                </div>
              )}
              {item.design_face_b && (
                <div className="space-y-1">
                  <div className="text-[9px] font-medium text-muted-foreground text-center">الوجه الخلفي</div>
                  <div className="relative h-20 rounded-md overflow-hidden bg-muted border border-border hover:border-primary transition-colors">
                    <img
                      src={item.design_face_b}
                      alt="الوجه الخلفي"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://via.placeholder.com/200x150?text=No+Design";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
