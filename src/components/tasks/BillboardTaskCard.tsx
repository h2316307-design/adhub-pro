import { useEffect, useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, PaintBucket, Printer, RotateCcw, Palette, Box, DollarSign, Trash2, Pencil, Plus, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';

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
  installationPrice?: number;
  onSelectionChange: (checked: boolean) => void;
  onEditDesign?: () => void;
  onPrint?: () => void;
  onUncomplete?: () => void;
  onDesignChange?: () => void;
  onRefresh?: () => void;
  onAddInstalledImage?: () => void;
  onDelete?: () => void;
}

export function BillboardTaskCard({
  item,
  billboard,
  isSelected,
  isCompleted,
  taskDesigns = [],
  installationPrice = 0,
  onSelectionChange,
  onEditDesign,
  onPrint,
  onUncomplete,
  onDesignChange,
  onRefresh,
  onAddInstalledImage,
  onDelete
}: BillboardTaskCardProps) {
  const [selectedDesignId, setSelectedDesignId] = useState<string>(item.selected_design_id || 'none');
  const [saving, setSaving] = useState(false);
  const [hasCutout, setHasCutout] = useState<boolean>(item.has_cutout || false);
  const [customerInstallationCost, setCustomerInstallationCost] = useState<number>(item.customer_installation_cost || 0);
  const [savingCost, setSavingCost] = useState(false);
  const [editDateDialogOpen, setEditDateDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(item.installation_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);

  // مزامنة اختيار التصميم مع بيانات العنصر (مهم عند التحديث الجماعي "توزيع التصاميم")
  useEffect(() => {
    setSelectedDesignId(item.selected_design_id || 'none');
  }, [item.selected_design_id]);

  const handleEditDate = async () => {
    if (!editingDate) {
      toast.error('الرجاء تحديد تاريخ');
      return;
    }
    setSavingDate(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ installation_date: editingDate })
        .eq('id', item.id);
      
      if (error) throw error;
      
      toast.success('تم تعديل تاريخ التركيب');
      setEditDateDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating installation date:', error);
      toast.error('فشل في تعديل تاريخ التركيب');
    } finally {
      setSavingDate(false);
    }
  };

  const handleDesignChange = async (designId: string) => {
    setSelectedDesignId(designId);
    setSaving(true);

    try {
      // إذا تم اختيار تصميم، نحتاج إلى جلب URLs التصاميم وحفظها
      let updateData: any = { selected_design_id: designId === 'none' ? null : designId };
      
      if (designId !== 'none') {
        const selectedDesign = taskDesigns.find(d => d.id === designId);
        if (selectedDesign) {
          updateData.design_face_a = selectedDesign.design_face_a_url;
          updateData.design_face_b = selectedDesign.design_face_b_url || null;
        }
      } else {
        // إذا تم إلغاء التصميم، نحذف URLs التصاميم أيضاً
        updateData.design_face_a = null;
        updateData.design_face_b = null;
      }

      const { error } = await supabase
        .from('installation_task_items')
        .update(updateData)
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

  const handleCutoutChange = async (checked: boolean) => {
    setHasCutout(checked);
    
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ has_cutout: checked })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success(checked ? 'تم تحديد اللوحة كمجسم' : 'تم إلغاء تحديد المجسم');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating cutout status:', error);
      toast.error('فشل في تحديث حالة المجسم');
      setHasCutout(!checked); // Revert on error
    }
  };

  const handleCustomerCostBlur = async () => {
    if (customerInstallationCost === item.customer_installation_cost) return;
    
    setSavingCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ customer_installation_cost: customerInstallationCost })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم تحديث تكلفة التركيب للزبون');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating customer installation cost:', error);
      toast.error('فشل في تحديث التكلفة');
      setCustomerInstallationCost(item.customer_installation_cost || 0);
    } finally {
      setSavingCost(false);
    }
  };

  const selectedDesign = taskDesigns.find(d => d.id === selectedDesignId);

  // حساب التأخير - أكثر من 15 يوم من تاريخ إنشاء المهمة بدون تركيب
  const isDelayed = !isCompleted && item.created_at && differenceInDays(new Date(), new Date(item.created_at)) > 15;
  const delayDays = item.created_at ? differenceInDays(new Date(), new Date(item.created_at)) : 0;

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
              {/* زر تمديد الإيجار */}
              {billboard?.Rent_End_Date && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExtendDialogOpen(true);
                  }}
                  className="h-6 w-6 rounded-full bg-emerald-600/90 backdrop-blur-sm hover:bg-emerald-700 flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="تمديد الإيجار"
                >
                  <Plus className="h-3 w-3 text-white" />
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
            <div className="flex items-center gap-1 flex-wrap">
              <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700">
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-medium border-green-300 dark:border-green-700 text-green-700 dark:text-green-300">
                  {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                </Badge>
              )}
              {hasCutout && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-bold bg-accent/20 text-accent border border-accent/30 flex items-center gap-0.5">
                  <Box className="h-2.5 w-2.5" />
                  مجسم
                </Badge>
              )}
            </div>
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
              <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 p-1 bg-green-100/50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="text-[9px] truncate">
                    {format(new Date(item.installation_date), "dd/MM/yyyy", { locale: ar })}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDate(item.installation_date);
                    setEditDateDialogOpen(true);
                  }}
                  className="h-4 w-4 rounded hover:bg-green-200 dark:hover:bg-green-800 flex items-center justify-center transition-colors"
                  title="تعديل تاريخ التركيب"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
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

          {/* عرض صور التركيب للوحات المكتملة */}
          {(item.installed_image_face_a_url || item.installed_image_face_b_url) && (
            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center gap-1 mb-1.5">
                <ImageIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-bold text-green-700 dark:text-green-300">
                  صور التركيب
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.installed_image_face_a_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الأمامي</div>
                    <div className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                      <img
                        src={item.installed_image_face_a_url}
                        alt="صورة التركيب - الوجه الأمامي"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  </div>
                )}
                {item.installed_image_face_b_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الخلفي</div>
                    <div className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700">
                      <img
                        src={item.installed_image_face_b_url}
                        alt="صورة التركيب - الوجه الخلفي"
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

          {/* عرض تكاليف التركيب - يظهر دائماً */}
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="font-bold text-green-700 dark:text-green-300">
                  تكلفة التركيب ({billboard?.Size || 'غير محدد'})
                  {billboard?.Faces_Count === 1 && <span className="text-[8px] text-amber-600 mr-1">(نصف السعر)</span>}
                  :
                </span>
              </div>
              {installationPrice > 0 ? (
                <span className="font-bold text-green-800 dark:text-green-200">
                  {installationPrice.toLocaleString('ar-LY')} د.ل
                </span>
              ) : (
                <span className="font-bold text-amber-600 dark:text-amber-400 text-[9px]">
                  لا يوجد سعر
                </span>
              )}
            </div>
            {customerInstallationCost > 0 && (
              <div className="flex items-center justify-between gap-2 text-[10px] mt-1">
                <span className="font-semibold text-green-700 dark:text-green-400">للزبون:</span>
                <span className="font-bold text-green-800 dark:text-green-200">
                  {customerInstallationCost.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dialog لتعديل تاريخ التركيب */}
        <Dialog open={editDateDialogOpen} onOpenChange={setEditDateDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                تعديل تاريخ التركيب
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>تاريخ التركيب</Label>
                <Input
                  type="date"
                  value={editingDate}
                  onChange={(e) => setEditingDate(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDateDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleEditDate} disabled={savingDate}>
                  {savingDate ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div
      className={`group min-w-0 w-full overflow-hidden relative rounded-xl border-2 transition-all duration-300 cursor-pointer ${
        isSelected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-xl ring-2 ring-primary/40"
          : "border-border/50 bg-card hover:border-primary/60 hover:shadow-lg"
      }`}
      onClick={() => onSelectionChange(!isSelected)}
    >
      {/* صورة اللوحة الرئيسية */}
      <div className="relative aspect-[4/3] overflow-hidden">
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
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* تدرج شفاف */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Checkbox */}
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
            className="h-5 w-5 border-2 shadow-lg bg-white/90 backdrop-blur-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        {/* أزرار العمليات */}
        <div className="absolute top-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('هل تريد حذف هذه اللوحة من المهمة؟')) {
                  onDelete();
                }
              }}
              className="h-7 w-7 rounded-lg bg-red-600/90 backdrop-blur-sm hover:bg-red-700 flex items-center justify-center shadow-lg transition-all hover:scale-110"
              title="حذف اللوحة"
            >
              <Trash2 className="h-3.5 w-3.5 text-white" />
            </button>
          )}
          {onEditDesign && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditDesign();
              }}
              className="h-7 w-7 rounded-lg bg-accent/90 backdrop-blur-sm hover:bg-accent flex items-center justify-center shadow-lg transition-all hover:scale-110"
              title="تخصيص التصاميم"
            >
              <PaintBucket className="h-3.5 w-3.5 text-white" />
            </button>
          )}
          {onPrint && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrint();
              }}
              className="h-7 w-7 rounded-lg bg-primary/90 backdrop-blur-sm hover:bg-primary flex items-center justify-center shadow-lg transition-all hover:scale-110"
              title="طباعة اللوحة"
            >
              <Printer className="h-3.5 w-3.5 text-white" />
            </button>
          )}
        </div>

        {/* مؤشر التأخير */}
        {isDelayed && (
          <div className="absolute top-2 left-10 bg-gradient-to-r from-red-600 to-red-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">متأخر {delayDays} يوم</span>
          </div>
        )}
        
        {/* رقم اللوحة والمقاس */}
        <div className="absolute bottom-2 right-2 left-2 flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            <Badge className="text-[11px] px-2.5 py-1 font-bold bg-primary text-primary-foreground border-0 shadow-lg">
              {billboard?.Size}
            </Badge>
            {billboard?.Faces_Count && (
              <Badge className="text-[10px] px-2 py-0.5 font-semibold bg-accent text-accent-foreground border-0 shadow-md">
                {billboard.Faces_Count === 1 ? 'وجه' : `${billboard.Faces_Count} أوجه`}
              </Badge>
            )}
          </div>
          <div className="bg-foreground/90 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg">
            <span className="font-bold text-xs text-background">#{billboard?.ID}</span>
          </div>
        </div>
      </div>

      {/* محتوى الكرت */}
      <div className="p-3 space-y-2.5">
        {/* اسم اللوحة */}
        <p className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
        </p>
        
        {/* الموقع */}
        <div className="flex items-center gap-2 text-xs p-2 bg-muted/50 rounded-lg">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block truncate">{billboard?.Municipality || 'غير محدد'}</span>
            {billboard?.District && (
              <span className="text-[10px] text-muted-foreground truncate block">{billboard.District}</span>
            )}
          </div>
        </div>
        
        {billboard?.Nearest_Landmark && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Navigation className="h-3 w-3 flex-shrink-0" />
            <span className="line-clamp-1">{billboard.Nearest_Landmark}</span>
          </div>
        )}
        
        {/* عرض صورة التصميم المحفوظة في العنصر - يظهر دائماً إذا كان هناك تصميم محفوظ */}
        {(item.design_face_a || item.design_face_b) && (
          <div className="mt-2 p-2 bg-accent/10 rounded-lg border border-accent/20">
            <p className="text-[10px] font-semibold text-accent mb-1.5 flex items-center gap-1">
              <PaintBucket className="h-3 w-3" />
              التصميم المحفوظ
            </p>
            <div className="grid grid-cols-2 gap-2">
              {item.design_face_a && (
                <div className="space-y-1">
                  <div className="text-[9px] text-center text-muted-foreground font-medium">الوجه الأمامي</div>
                  <div className="relative aspect-video rounded overflow-hidden bg-white dark:bg-gray-900 border-2 border-accent/30 shadow-sm">
                    <img
                      src={item.design_face_a}
                      alt="الوجه الأمامي"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </div>
              )}
              {item.design_face_b && (
                <div className="space-y-1">
                  <div className="text-[9px] text-center text-muted-foreground font-medium">الوجه الخلفي</div>
                  <div className="relative aspect-video rounded overflow-hidden bg-white dark:bg-gray-900 border-2 border-accent/30 shadow-sm">
                    <img
                      src={item.design_face_b}
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
        
        {/* قسم اختيار التصميم - يظهر فقط إذا كان هناك تصاميم */}
        {taskDesigns.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor={`design-${item.id}`} className="text-xs font-semibold flex items-center gap-1">
                <Palette className="h-3 w-3 text-primary" />
                اختر التصميم للوحة: ({taskDesigns.length} متاح)
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

        {/* قسم الإعدادات السريعة - مجسم وتكلفة */}
        <div className="mt-3 pt-2 border-t border-border space-y-2">
          {/* صف المجسم والتكلفة */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* خيار المجسم */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCutoutChange(!hasCutout);
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                hasCutout 
                  ? 'bg-accent/20 text-accent border border-accent/40' 
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:border-accent/30 hover:bg-accent/10'
              }`}
            >
              <Box className="h-3 w-3" />
              {hasCutout ? 'مجسم ✓' : 'مجسم'}
            </button>
            
            {/* تكلفة التركيب */}
            <div className="flex-1 flex items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">التكلفة:</span>
              {installationPrice > 0 ? (
                <span className="font-bold text-green-600">{installationPrice.toLocaleString('ar-LY')}</span>
              ) : (
                <span className="text-amber-500">-</span>
              )}
            </div>
          </div>
          
          {/* إدخال المبلغ للزبون */}
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <Input
              id={`customer-cost-${item.id}`}
              type="number"
              min="0"
              step="0.01"
              value={customerInstallationCost === 0 ? '' : customerInstallationCost}
              onChange={(e) => {
                const val = e.target.value;
                setCustomerInstallationCost(val === '' ? 0 : Number(val));
              }}
              onBlur={handleCustomerCostBlur}
              disabled={savingCost}
              className="h-7 text-xs font-medium pl-16 bg-primary/5 border-primary/20 focus:border-primary"
              placeholder="المبلغ للزبون"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              د.ل
            </div>
          </div>
          
          {/* الفرق */}
          {customerInstallationCost > 0 && installationPrice > 0 && (
            <div className={`text-[10px] text-center py-1 px-2 rounded font-medium ${
              (customerInstallationCost - installationPrice) > 0 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : (customerInstallationCost - installationPrice) < 0
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-muted text-muted-foreground'
            }`}>
              {(customerInstallationCost - installationPrice) > 0 ? '+' : ''}
              {(customerInstallationCost - installationPrice).toLocaleString('ar-LY')} د.ل
              {customerInstallationCost > installationPrice && ' ربح'}
              {customerInstallationCost < installationPrice && ' خسارة'}
            </div>
          )}
        </div>
      </div>

      {/* Dialog تمديد الإيجار */}
      <BillboardExtendRentalDialog
        open={extendDialogOpen}
        onOpenChange={setExtendDialogOpen}
        billboard={{
          ID: billboard?.ID,
          Billboard_Name: billboard?.Billboard_Name,
          Rent_End_Date: billboard?.Rent_End_Date,
          Contract_Number: billboard?.Contract_Number
        }}
        onSuccess={onRefresh}
      />
    </div>
  );
}
