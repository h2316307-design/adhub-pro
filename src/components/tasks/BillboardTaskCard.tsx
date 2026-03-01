import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, PaintBucket, Printer, RotateCcw, Palette, Box, DollarSign, Trash2, Pencil, Plus, AlertTriangle, Lock, Unlock, Camera, Link2 } from "lucide-react";
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';
import ImageLightbox from '@/components/Map/ImageLightbox';

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
  onApplyFacesToAll?: (faces: number) => void;
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
  onDelete,
  onApplyFacesToAll,
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
  // faces_to_install: عدد الأوجه التي سيتم تركيبها (1 = وجه واحد، 2 = وجهين)
  const [facesToInstall, setFacesToInstall] = useState<number>(item.faces_to_install || (billboard?.Faces_Count || 1));
  const { confirm: systemConfirm } = useSystemDialog();
  const [isCustomerCostEditable, setIsCustomerCostEditable] = useState(false);
  const [additionalCost, setAdditionalCost] = useState<number>(item.additional_cost || 0);
  const [additionalCostNotes, setAdditionalCostNotes] = useState<string>(item.additional_cost_notes || '');
  const [isAdditionalCostEditable, setIsAdditionalCostEditable] = useState(false);
  const [savingAdditionalCost, setSavingAdditionalCost] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // حساب تكلفة الشركة بناءً على عدد الأوجه
  const effectiveInstallationPrice = (() => {
    if (installationPrice <= 0) return 0;
    const totalFaces = billboard?.Faces_Count || 1;
    if (totalFaces <= 1) return installationPrice; // لوحة وجه واحد - السعر الكامل
    // لوحة متعددة الأوجه: نصف السعر لوجه واحد، السعر كاملاً لوجهين
    return facesToInstall === 1 ? installationPrice / 2 : installationPrice;
  })();

  // مزامنة اختيار التصميم مع بيانات العنصر (مهم عند التحديث الجماعي "توزيع التصاميم")
  useEffect(() => {
    setSelectedDesignId(item.selected_design_id || 'none');
  }, [item.selected_design_id]);

  // مزامنة تكلفة الزبون عند تحديث البيانات
  useEffect(() => {
    setCustomerInstallationCost(item.customer_installation_cost || 0);
  }, [item.customer_installation_cost]);

  // مزامنة التكاليف الإضافية عند تحديث البيانات
  useEffect(() => {
    setAdditionalCost(item.additional_cost || 0);
    setAdditionalCostNotes(item.additional_cost_notes || '');
  }, [item.additional_cost, item.additional_cost_notes]);

  // مزامنة حالة المجسم
  useEffect(() => {
    setHasCutout(item.has_cutout || false);
  }, [item.has_cutout]);

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
      let updateData: any = { selected_design_id: designId === 'none' ? null : designId };
      
      if (designId !== 'none') {
        const selectedDesign = taskDesigns.find(d => d.id === designId);
        if (selectedDesign) {
          updateData.design_face_a = selectedDesign.design_face_a_url;
          updateData.design_face_b = selectedDesign.design_face_b_url || null;
        }
      } else {
        updateData.design_face_a = null;
        updateData.design_face_b = null;
      }

      const { error } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      // مزامنة التصميم مع مهام الطباعة والمجسمات المرتبطة بنفس العقد واللوحة
      try {
        const { data: installTask } = await supabase
          .from('installation_tasks')
          .select('contract_id')
          .eq('id', item.task_id)
          .single();

        if (installTask?.contract_id) {
          const contractId = installTask.contract_id;
          const billboardId = item.billboard_id;
          const designA = updateData.design_face_a ?? null;
          const designB = updateData.design_face_b ?? null;

          // تحديث مهام الطباعة
          const { data: printTasks } = await supabase
            .from('print_tasks')
            .select('id')
            .eq('contract_id', contractId);

          if (printTasks?.length) {
            await supabase
              .from('print_task_items')
              .update({ design_face_a: designA, design_face_b: designB })
              .in('task_id', printTasks.map(t => t.id))
              .eq('billboard_id', billboardId);
          }

          // تحديث اللوحة الأصلية أيضاً
          await supabase
            .from('billboards')
            .update({ design_face_a: designA, design_face_b: designB })
            .eq('ID', billboardId);
        }
      } catch (syncError) {
        console.error('Error syncing design to related tasks:', syncError);
      }
      
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

  const handleAdditionalCostSave = async () => {
    setSavingAdditionalCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ 
          additional_cost: additionalCost,
          additional_cost_notes: additionalCostNotes || null
        })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم حفظ التكلفة الإضافية');
      setIsAdditionalCostEditable(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving additional cost:', error);
      toast.error('فشل في حفظ التكلفة الإضافية');
    } finally {
      setSavingAdditionalCost(false);
    }
  };

  const handleFacesChange = async (faces: number) => {
    setFacesToInstall(faces);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ faces_to_install: faces } as any)
        .eq('id', item.id);
      if (error) throw error;
      toast.success(faces === 1 ? 'تم تحديد الوجه الأمامي فقط' : 'تم تحديد الوجهين');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating faces_to_install:', error);
      toast.error('فشل في تحديث الوجه');
      setFacesToInstall(item.faces_to_install || billboard?.Faces_Count || 1);
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
          <div 
            className="relative aspect-square rounded-md overflow-hidden bg-muted ring-2 ring-green-300 dark:ring-green-800 shadow-sm cursor-pointer"
            onClick={() => billboard?.Image_URL && setLightboxImage(billboard.Image_URL)}
          >
            {billboard?.Image_URL ? (
              <img
                src={billboard.Image_URL}
                alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                className="w-full h-full object-cover opacity-90"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-green-900/40 via-transparent to-transparent"></div>
            
            {/* أزرار العمليات للوحات المكتملة */}
            <div className="absolute top-1.5 right-1.5 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
              {onUncomplete && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await systemConfirm({ title: 'تراجع', message: 'هل تريد التراجع عن إكمال هذه اللوحة؟', confirmText: 'تراجع' })) {
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
            
            {/* المقاس وعدد الأوجه - على الصورة */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
              <Badge className="text-[11px] px-2 py-0.5 font-extrabold bg-black/70 backdrop-blur-sm text-white border-0 shadow-lg flex items-center gap-1">
                <Box className="h-3 w-3" />
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-black/70 backdrop-blur-sm text-white border-0 shadow-lg">
                  {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                </Badge>
              )}
              {hasCutout && (
                <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-accent/90 backdrop-blur-sm text-white border-0 shadow-lg flex items-center gap-0.5">
                  <Box className="h-2.5 w-2.5" />
                  مجسم
                </Badge>
              )}
            </div>

            <div className="absolute bottom-2 right-2 bg-gradient-to-r from-primary to-accent backdrop-blur-md px-2 py-1 rounded-full shadow-lg ring-1 ring-white/20">
              <span className="font-extrabold text-xs text-white">#{billboard?.ID}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="font-bold text-sm line-clamp-1 text-green-800 dark:text-green-300">
              {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
            </p>
            
            {/* حالة اللوحة */}
            <div className="flex items-center gap-1.5">
              <Badge className="text-[10px] px-2 py-0.5 font-bold bg-green-600 text-white border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                مكتمل
              </Badge>
            </div>

            {/* المقاس وعدد الأوجه - تحت الحالة */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="text-xs px-2 py-1 font-extrabold bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 border-2 border-green-400 dark:border-green-600 shadow-sm flex items-center gap-1">
                <Box className="h-3.5 w-3.5" />
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-semibold border-green-400 dark:border-green-600 text-green-800 dark:text-green-200">
                  {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                </Badge>
              )}
              {hasCutout && (
                <Badge className="text-[10px] px-1.5 py-0.5 font-bold bg-accent/20 text-accent border border-accent/30 flex items-center gap-0.5">
                  <Box className="h-2.5 w-2.5" />
                  مجسم
                </Badge>
              )}
            </div>
            <div className="p-1.5 bg-green-100/60 dark:bg-green-900/40 rounded-lg border border-green-300 dark:border-green-700 space-y-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="font-bold text-xs text-green-800 dark:text-green-200">
                  {billboard?.Municipality || 'غير محدد'}
                </span>
                {billboard?.District && (
                  <>
                    <span className="text-green-500">-</span>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300 truncate">
                      {billboard.District}
                    </span>
                  </>
                )}
              </div>
              {billboard?.Nearest_Landmark && (
                <div className="flex items-start gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 line-clamp-2">
                    {billboard.Nearest_Landmark}
                  </span>
                </div>
              )}
            </div>
            {item.installation_date && (
              <div className="flex items-center justify-between gap-1 text-xs font-semibold text-green-700 dark:text-green-400 p-1.5 bg-green-100/50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {format(new Date(item.installation_date), "dd/MM/yyyy", { locale: ar })}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDate(item.installation_date);
                    setEditDateDialogOpen(true);
                  }}
                  className="h-5 w-5 rounded hover:bg-green-200 dark:hover:bg-green-800 flex items-center justify-center transition-colors"
                  title="تعديل تاريخ التركيب"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* عرض وتعديل التصميم للوحات المكتملة */}
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            {taskDesigns.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <Palette className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-[10px] font-bold text-green-700 dark:text-green-300">التصميم</span>
                </div>
                <Select 
                  value={selectedDesignId} 
                  onValueChange={handleDesignChange}
                  disabled={saving}
                >
                  <SelectTrigger 
                    className="h-7 text-[10px] bg-white/80 dark:bg-green-950/50 border-green-300 dark:border-green-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectValue>
                      {selectedDesign ? (
                        <span className="font-medium">{selectedDesign.design_name}</span>
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
                          <span>{design.design_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedDesign && (
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <div className="space-y-1">
                  <div className="text-[9px] font-medium text-green-700 dark:text-green-400 text-center">الوجه الأمامي</div>
                  <div 
                    className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => setLightboxImage(selectedDesign.design_face_a_url)}
                  >
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
                    <div 
                      className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => setLightboxImage(selectedDesign.design_face_b_url!)}
                    >
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
            )}
          </div>

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
                    <div 
                      className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => setLightboxImage(item.installed_image_face_a_url)}
                    >
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
                    <div 
                      className="relative aspect-video rounded-md overflow-hidden bg-white/90 dark:bg-green-950/50 border-2 border-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => setLightboxImage(item.installed_image_face_b_url)}
                    >
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
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="font-bold text-green-700 dark:text-green-300">
                  تكلفة التركيب ({billboard?.Size || 'غير محدد'})
                  {(item.faces_to_install || 1) === 1 && (billboard?.Faces_Count || 1) > 1 && <span className="text-[8px] text-amber-600 mr-1">(نصف السعر)</span>}
                  :
                </span>
              </div>
              {installationPrice > 0 ? (
                <span className="font-bold text-green-800 dark:text-green-200">
                  {effectiveInstallationPrice.toLocaleString('ar-LY')} د.ل
                </span>
              ) : (
                <span className="font-bold text-amber-600 dark:text-amber-400 text-[9px]">
                  لا يوجد سعر
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-semibold text-green-700 dark:text-green-400">للزبون:</span>
              <span className={`font-bold ${customerInstallationCost > 0 ? 'text-green-800 dark:text-green-200' : 'text-amber-600 dark:text-amber-400'}`}>
                {customerInstallationCost > 0 ? `${customerInstallationCost.toLocaleString('ar-LY')} د.ل` : 'غير محدد'}
              </span>
            </div>
            {(additionalCost > 0 || isAdditionalCostEditable) && (
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-semibold text-amber-600 dark:text-amber-400">تكاليف إضافية:</span>
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  {additionalCost.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
            )}
            
            {/* زر التكاليف الإضافية للوحات المكتملة */}
            <div className="flex items-center gap-2">
              <Button
                variant={isAdditionalCostEditable ? "default" : "outline"}
                size="sm"
                className="h-7 text-[10px] flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdditionalCostEditable) {
                    handleAdditionalCostSave();
                  } else {
                    setIsAdditionalCostEditable(true);
                  }
                }}
                disabled={savingAdditionalCost}
              >
                {savingAdditionalCost ? (
                  'جاري الحفظ...'
                ) : isAdditionalCostEditable ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    حفظ
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 ml-1" />
                    تكاليف إضافية
                  </>
                )}
              </Button>
              {isAdditionalCostEditable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdditionalCostEditable(false);
                    setAdditionalCost(item.additional_cost || 0);
                    setAdditionalCostNotes(item.additional_cost_notes || '');
                  }}
                >
                  إلغاء
                </Button>
              )}
            </div>

            {isAdditionalCostEditable && (
              <div className="space-y-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-amber-700 dark:text-amber-300">المبلغ الإضافي</Label>
                  <Input
                    type="number"
                    value={additionalCost}
                    onChange={(e) => setAdditionalCost(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-amber-700 dark:text-amber-300">ملاحظات</Label>
                  <Input
                    type="text"
                    value={additionalCostNotes}
                    onChange={(e) => setAdditionalCostNotes(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                    placeholder="سبب التكلفة الإضافية..."
                  />
                </div>
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
                <CustomDatePicker
                  value={editingDate}
                  onChange={(val) => setEditingDate(val)}
                  placeholder="اختر تاريخ التركيب"
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

        {/* Lightbox لتكبير الصور */}
        {lightboxImage && (
          <ImageLightbox
            imageUrl={lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`group min-w-0 w-full overflow-hidden relative rounded-2xl border-2 transition-all duration-300 ${
        isSelected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-2xl ring-2 ring-primary/40"
          : "border-border/50 bg-card hover:border-primary/60 hover:shadow-xl"
      }`}
    >
      {/* صورة اللوحة الرئيسية - كبيرة وواضحة */}
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-xl">
        {billboard?.Image_URL ? (
          <img
            src={billboard.Image_URL}
            alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Checkbox - في الزاوية */}
        <div 
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
            className="h-6 w-6 border-2 shadow-lg bg-white/95 backdrop-blur-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer"
          />
        </div>

        {/* أزرار العمليات - صغيرة */}
        <div className="absolute top-2 left-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDelete && (
            <button
                onClick={async (e) => {
                e.stopPropagation();
                if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه اللوحة من المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                  onDelete();
                }
              }}
              className="h-6 w-6 rounded-md bg-red-600/90 hover:bg-red-700 flex items-center justify-center shadow transition-all"
              title="حذف"
            >
              <Trash2 className="h-3 w-3 text-white" />
            </button>
          )}
          {onEditDesign && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditDesign();
              }}
              className="h-6 w-6 rounded-md bg-accent/90 hover:bg-accent flex items-center justify-center shadow transition-all"
              title="تصميم"
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
              className="h-6 w-6 rounded-md bg-primary/90 hover:bg-primary flex items-center justify-center shadow transition-all"
              title="طباعة"
            >
              <Printer className="h-3 w-3 text-white" />
            </button>
          )}
        </div>

        {/* مؤشر التأخير */}
        {isDelayed && (
          <div className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded flex items-center gap-1 shadow text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-bold">متأخر {delayDays} يوم</span>
          </div>
        )}
        
        {/* رقم اللوحة فقط */}
        <div className="absolute bottom-2 right-2">
          <div className="bg-black/70 backdrop-blur-sm px-2 py-1 rounded shadow">
            <span className="font-bold text-xs text-white">#{billboard?.ID}</span>
          </div>
        </div>
      </div>

      {/* محتوى الكرت */}
      <div className="p-3 space-y-2">
        {/* اسم اللوحة والحجم */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm line-clamp-1 flex-1">
            {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge className="text-[10px] px-2 py-0.5 font-bold bg-primary text-primary-foreground">
              {billboard?.Size}
            </Badge>
            {billboard?.Faces_Count && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                {billboard.Faces_Count} وجه
              </Badge>
            )}
          </div>
        </div>
        
        {/* الموقع - مختصر */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="truncate">{billboard?.Municipality || 'غير محدد'}</span>
          {billboard?.District && (
            <>
              <span>-</span>
              <span className="truncate">{billboard.District}</span>
            </>
          )}
        </div>
        
        {/* GPS */}
        {billboard?.GPS_Link && (
          <a
            href={billboard.GPS_Link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Navigation className="h-3 w-3" />
            عرض الموقع
          </a>
        )}
        
        {/* أقرب نقطة دالة */}
        {billboard?.Nearest_Landmark && (
          <div className="flex items-start gap-1.5 text-xs p-2 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Navigation className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-amber-700 dark:text-amber-300">أقرب نقطة دالة: </span>
              <span className="text-amber-600 dark:text-amber-400">{billboard.Nearest_Landmark}</span>
            </div>
          </div>
        )}
        
        {/* تاريخ التركيب مع زر التعديل */}
        <div
          className="flex items-center justify-between gap-2 text-xs p-2 bg-muted/40 rounded-lg border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="font-medium">
              {item.installation_date
                ? format(new Date(item.installation_date), 'dd/MM/yyyy', { locale: ar })
                : 'لم يُحدد تاريخ التركيب'}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingDate(item.installation_date || '');
              setEditDateDialogOpen(true);
            }}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
            title="تعديل تاريخ التركيب"
          >
            <Pencil className="h-3 w-3" />
            تعديل
          </button>
        </div>

        {/* عرض صورة التصميم المحفوظة في العنصر */}
        {(item.design_face_a || item.design_face_b) && (
          <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1.5">
              <PaintBucket className="h-4 w-4" />
              التصميم المحفوظ
            </p>
            <div className="grid grid-cols-2 gap-3">
              {item.design_face_a && (
                <div className="space-y-1.5">
                  <div className="text-xs text-center text-muted-foreground font-medium">الوجه الأمامي</div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-white dark:bg-gray-900 border-2 border-accent/30 shadow-sm">
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
                <div className="space-y-1.5">
                  <div className="text-xs text-center text-muted-foreground font-medium">الوجه الخلفي</div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-white dark:bg-gray-900 border-2 border-accent/30 shadow-sm">
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
          <div className="pt-3 border-t border-border">
            <div className="space-y-3">
              <Label htmlFor={`design-${item.id}`} className="text-sm font-semibold flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-primary" />
                اختر التصميم للوحة: ({taskDesigns.length} متاح)
              </Label>
              <Select 
                value={selectedDesignId} 
                onValueChange={handleDesignChange}
                disabled={saving}
              >
                <SelectTrigger 
                  id={`design-${item.id}`} 
                  className="h-10 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue>
                    {selectedDesign ? (
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-primary" />
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
                        <Palette className="h-4 w-4" />
                        <span className="font-medium">{design.design_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* عرض معاينة التصميم المختار */}
              {selectedDesign && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                    <PaintBucket className="h-4 w-4" />
                    {selectedDesign.design_name}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-xs text-center text-muted-foreground font-medium">الوجه الأمامي</div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-white dark:bg-gray-900 border-2 border-primary/30 shadow-sm">
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
                      <div className="space-y-1.5">
                        <div className="text-xs text-center text-muted-foreground font-medium">الوجه الخلفي</div>
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-white dark:bg-gray-900 border-2 border-primary/30 shadow-sm">
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
        <div className="pt-3 border-t border-border space-y-3">
          
          {/* اختيار الوجه للتركيب - يظهر فقط إذا كانت اللوحة متعددة الأوجه */}
          {(billboard?.Faces_Count > 1) && (
            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">الوجه المراد تركيبه:</span>
                {onApplyFacesToAll && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyFacesToAll(facesToInstall);
                    }}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    title="تعميم على كل اللوحات في المهمة"
                  >
                    <Link2 className="h-3 w-3" />
                    تعميم على الكل
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleFacesChange(1); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    facesToInstall === 1
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  وجه واحد
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFacesChange(2); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    facesToInstall === 2
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  وجهان
                </button>
              </div>
            </div>
          )}
          
          {/* صف المجسم والتكلفة */}
          <div className="flex items-center justify-between gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* خيار المجسم */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCutoutChange(!hasCutout);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                hasCutout 
                  ? 'bg-accent/20 text-accent border border-accent/40' 
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:border-accent/30 hover:bg-accent/10'
              }`}
            >
              <Box className="h-4 w-4" />
              {hasCutout ? 'مجسم ✓' : 'مجسم'}
            </button>
            
            {/* تكلفة التركيب والزبون */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg">
                <span className="text-muted-foreground">الشركة:</span>
                {effectiveInstallationPrice > 0 ? (
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-green-600 dark:text-green-400">{effectiveInstallationPrice.toLocaleString('ar-LY')} د.ل</span>
                    {facesToInstall === 1 && (billboard?.Faces_Count || 1) > 1 && (
                      <span className="text-[9px] text-amber-500">(½)</span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-500">-</span>
                )}
              </div>
              {customerInstallationCost > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                  <span className="text-muted-foreground">الزبون:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{customerInstallationCost.toLocaleString('ar-LY')} د.ل</span>
                </div>
              )}
            </div>
          </div>
          
          {/* إدخال المبلغ للزبون مع زر القفل */}
          <div onClick={(e) => e.stopPropagation()} className="space-y-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={isCustomerCostEditable ? "default" : "outline"}
                size="sm"
                className={`h-9 px-3 text-xs gap-1.5 ${isCustomerCostEditable ? 'bg-primary' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCustomerCostEditable(!isCustomerCostEditable);
                }}
              >
                {isCustomerCostEditable ? (
                  <>
                    <Unlock className="h-4 w-4" />
                    مفتوح
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    تعديل السعر
                  </>
                )}
              </Button>
              <div className="flex-1 relative">
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
                  disabled={!isCustomerCostEditable || savingCost}
                  className={`h-9 text-sm font-medium pl-14 transition-all ${
                    isCustomerCostEditable 
                      ? 'bg-primary/10 border-primary focus:border-primary ring-1 ring-primary/20' 
                      : 'bg-muted/30 border-muted cursor-not-allowed'
                  }`}
                  placeholder="سعر الزبون"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  د.ل
                </div>
              </div>
            </div>
          </div>
          
          {/* الفرق */}
          {customerInstallationCost > 0 && effectiveInstallationPrice > 0 && (
            <div className={`text-sm text-center py-2 px-3 rounded-xl font-semibold ${
              (customerInstallationCost - effectiveInstallationPrice) > 0 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : (customerInstallationCost - effectiveInstallationPrice) < 0
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-muted text-muted-foreground'
            }`}>
              {(customerInstallationCost - effectiveInstallationPrice) > 0 ? '+' : ''}
              {(customerInstallationCost - effectiveInstallationPrice).toLocaleString('ar-LY')} د.ل
              {customerInstallationCost > effectiveInstallationPrice && ' ربح'}
              {customerInstallationCost < effectiveInstallationPrice && ' خسارة'}
            </div>
          )}

          {/* تكاليف إضافية */}
          <div className="pt-2 border-t border-dashed border-border/50">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isAdditionalCostEditable ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-2 text-[9px] gap-1 ${
                  isAdditionalCostEditable ? 'bg-amber-500 hover:bg-amber-600' : 'text-amber-600 hover:bg-amber-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdditionalCostEditable) {
                    handleAdditionalCostSave();
                  } else {
                    setIsAdditionalCostEditable(true);
                  }
                }}
                disabled={savingAdditionalCost}
              >
                {savingAdditionalCost ? (
                  'جاري الحفظ...'
                ) : isAdditionalCostEditable ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    حفظ
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    تكاليف إضافية
                  </>
                )}
              </Button>
              
              {additionalCost > 0 && !isAdditionalCostEditable && (
                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                  +{additionalCost.toLocaleString('ar-LY')} د.ل
                </Badge>
              )}
            </div>
            
            {isAdditionalCostEditable && (
              <div className="mt-2 space-y-2 p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalCost === 0 ? '' : additionalCost}
                    onChange={(e) => setAdditionalCost(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="h-7 text-xs pl-12 bg-white dark:bg-gray-900"
                    placeholder="المبلغ الإضافي"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
                    د.ل
                  </div>
                </div>
                <Input
                  type="text"
                  value={additionalCostNotes}
                  onChange={(e) => setAdditionalCostNotes(e.target.value)}
                  className="h-7 text-xs bg-white dark:bg-gray-900"
                  placeholder="سبب التكلفة الإضافية..."
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-[9px] text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdditionalCostEditable(false);
                    setAdditionalCost(item.additional_cost || 0);
                    setAdditionalCostNotes(item.additional_cost_notes || '');
                  }}
                >
                  إلغاء
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog تعديل تاريخ التركيب للوحات غير المكتملة */}
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
              <CustomDatePicker
                value={editingDate}
                onChange={(val) => setEditingDate(val)}
                placeholder="اختر تاريخ التركيب"
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

      {/* Lightbox لتكبير الصور */}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
