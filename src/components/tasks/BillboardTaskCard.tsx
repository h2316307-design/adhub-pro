import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, PaintBucket, Printer, RotateCcw, Palette } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
}

interface BillboardTaskCardProps {
  item: any;
  billboard: any;
  isSelected: boolean;
  isCompleted: boolean;
  taskDesigns?: TaskDesign[];
  onSelectionChange: (checked: boolean) => void;
  onEditDesign?: () => void;
  onPrint?: () => void;
  onUncomplete?: () => void;
  onDesignChange?: () => void;
  onRefresh?: () => void;
  onAddInstalledImage?: () => void;
}

export function BillboardTaskCard({
  item,
  billboard,
  isSelected,
  isCompleted,
  taskDesigns = [],
  onSelectionChange,
  onEditDesign,
  onPrint,
  onUncomplete,
  onDesignChange,
  onRefresh,
  onAddInstalledImage
}: BillboardTaskCardProps) {
  const [selectedDesignId, setSelectedDesignId] = useState<string>(item.selected_design_id || 'none');
  const [saving, setSaving] = useState(false);

  const handleDesignChange = async (designId: string) => {
    setSelectedDesignId(designId);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ selected_design_id: designId === 'none' ? null : designId })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم تحديد التصميم بنجاح');
      onDesignChange?.();
      onRefresh?.();
    } catch (error) {
      console.error('Error updating design:', error);
      toast.error('فشل في تحديد التصميم');
    } finally {
      setSaving(false);
    }
  };

  const selectedDesign = taskDesigns.find(d => d.id === selectedDesignId);

  // عرض اللوحات المكتملة

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
            
            {/* أزرار العمليات للوحات المكتملة */}
            <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
              {onUncomplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('هل تريد التراجع عن إكمال هذه اللوحة؟')) {
                      onUncomplete();
                    }
                  }}
                  className="h-6 w-6 rounded-full bg-orange-600/90 backdrop-blur-sm hover:bg-orange-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="التراجع عن الإكمال"
                >
                  <RotateCcw className="h-3 w-3 text-white" />
                </button>
              )}
              {onAddInstalledImage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddInstalledImage();
                  }}
                  className="h-6 w-6 rounded-full bg-green-600/90 backdrop-blur-sm hover:bg-green-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="إضافة صورة بعد التركيب"
                >
                  <ImageIcon className="h-3 w-3 text-white" />
                </button>
              )}
              {onEditDesign && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditDesign();
                  }}
                  className="h-6 w-6 rounded-full bg-accent/90 backdrop-blur-sm hover:bg-accent flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="إدارة التصاميم"
                >
                  <PaintBucket className="h-3 w-3 text-white" />
                </button>
              )}
              {onPrint && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrint();
                  }}
                  className="h-6 w-6 rounded-full bg-blue-600/90 backdrop-blur-sm hover:bg-blue-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="طباعة اللوحة"
                >
                  <Printer className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
            
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

          {/* عرض التصميم المختار للوحات المكتملة */}
          {selectedDesign && (
            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center gap-1 mb-1.5">
                <Palette className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-bold text-green-700 dark:text-green-300">
                  التصميم: {selectedDesign.design_name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الأمامي</div>
                  <div className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                    <img
                      src={selectedDesign.design_face_a_url}
                      alt="الوجه الأمامي"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </div>
                {selectedDesign.design_face_b_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الخلفي</div>
                    <div className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                      <img
                        src={selectedDesign.design_face_b_url}
                        alt="الوجه الخلفي"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder.svg";
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

      {/* أزرار العمليات */}
      <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
        {onEditDesign && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditDesign();
            }}
            className="h-6 w-6 rounded-full bg-accent/90 backdrop-blur-sm hover:bg-accent flex items-center justify-center shadow-md transition-all hover:scale-110"
            title="تخصيص التصاميم"
          >
            <PaintBucket className="h-3 w-3 text-white" />
          </button>
        )}
        {onAddInstalledImage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddInstalledImage();
            }}
            className="h-6 w-6 rounded-full bg-green-600/90 backdrop-blur-sm hover:bg-green-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
            title="إضافة صورة التركيب"
          >
            <ImageIcon className="h-3 w-3 text-white" />
          </button>
        )}
        {onPrint && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
            className="h-6 w-6 rounded-full bg-primary/90 backdrop-blur-sm hover:bg-primary flex items-center justify-center shadow-md transition-all hover:scale-110"
            title="طباعة اللوحة"
          >
            <Printer className="h-3 w-3 text-white" />
          </button>
        )}
      </div>

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
              <span className="line-clamp-1 text-muted-foreground">
                {billboard.Nearest_Landmark}
              </span>
            </div>
          )}
        </div>

        {/* قسم اختيار التصميم - يظهر فقط للوحات المعلقة */}
        {taskDesigns.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor={`design-${item.id}`} className="text-xs font-semibold flex items-center gap-1">
                <Palette className="h-3 w-3 text-primary" />
                اختر التصميم للوحة: {taskDesigns.length > 0 && `(${taskDesigns.length} متاح)`}
              </Label>
              <Select 
                value={selectedDesignId} 
                onValueChange={handleDesignChange}
                disabled={saving}
              >
                <SelectTrigger 
                  id={`design-${item.id}`} 
                  className="h-8 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue>
                    {selectedDesign ? (
                      <div className="flex items-center gap-1.5">
                        <Palette className="h-3 w-3 text-primary" />
                        <span className="font-medium">{selectedDesign.design_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-- اختر التصميم --</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- بدون تصميم --</SelectItem>
                  {taskDesigns.map((design) => (
                    <SelectItem key={design.id} value={design.id}>
                      <div className="flex items-center gap-2">
                        <Palette className="h-3 w-3" />
                        <span className="font-medium">{design.design_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* عرض معاينة التصميم المختار */}
              {selectedDesign && (
                <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-[10px] font-semibold text-primary mb-1.5 flex items-center gap-1">
                    <PaintBucket className="h-3 w-3" />
                    {selectedDesign.design_name}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="text-[9px] text-center text-muted-foreground font-medium">الوجه الأمامي</div>
                      <div className="relative aspect-video rounded overflow-hidden bg-white dark:bg-gray-900 border-2 border-primary/30 shadow-sm">
                        <img
                          src={selectedDesign.design_face_a_url}
                          alt="الوجه الأمامي"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/placeholder.svg";
                          }}
                        />
                      </div>
                    </div>
                    {selectedDesign.design_face_b_url && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-center text-muted-foreground font-medium">الوجه الخلفي</div>
                        <div className="relative aspect-video rounded overflow-hidden bg-white dark:bg-gray-900 border-2 border-primary/30 shadow-sm">
                          <img
                            src={selectedDesign.design_face_b_url}
                            alt="الوجه الخلفي"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder.svg";
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
        )}
      </div>
    </div>
  );
}
