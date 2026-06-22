import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, 
  PaintBucket, Printer, RotateCcw, Palette, Box, DollarSign, Trash2, 
  Pencil, Plus, AlertTriangle, Lock, Unlock, Camera, Link2, RefreshCw, 
  Replace, ArrowLeftRight, History, Building2, PauseCircle, Repeat2, 
  ChevronDown, ChevronUp, MoreVertical, SlidersHorizontal, Settings, HelpCircle, TrendingUp, TrendingDown 
} from "lucide-react";
import { ReplaceBillboardDialog } from './ReplaceBillboardDialog';
import { EditReplacementDialog } from './EditReplacementDialog';
import { InstallationPhotoHistoryDialog } from './InstallationPhotoHistoryDialog';
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';
import ImageLightbox from '@/components/Map/ImageLightbox';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  allItems?: any[];
  onSelectionChange: (checked: boolean) => void;
  onEditDesign?: () => void;
  onPrint?: () => void;
  onUncomplete?: () => void;
  onDesignChange?: () => void;
  onRefresh?: () => void;
  onAddInstalledImage?: () => void;
  onDelete?: () => void;
  onApplyFacesToAll?: (faces: number) => void;
  pausedInfo?: { pauseDate?: string };
  replacementInfo?: { replacedName?: string; startDate?: string };
  isPrintActive?: boolean;
}

export function BillboardTaskCard({
  item,
  billboard,
  isSelected,
  isCompleted,
  isPrintActive = false,
  taskDesigns = [],
  installationPrice = 0,
  allItems = [],
  onSelectionChange,
  onEditDesign,
  onPrint,
  onUncomplete,
  onDesignChange,
  onRefresh,
  onAddInstalledImage,
  onDelete,
  onApplyFacesToAll,
  pausedInfo,
  replacementInfo,
}: BillboardTaskCardProps) {
  const [selectedDesignId, setSelectedDesignId] = useState<string>(item.selected_design_id || 'none');
  const [saving, setSaving] = useState(false);
  const [hasCutout, setHasCutout] = useState<boolean>(item.has_cutout || false);
  const [customerInstallationCost, setCustomerInstallationCost] = useState<number>(item.customer_installation_cost || 0);
  const [companyInstallationCost, setCompanyInstallationCost] = useState<number | null>(item.company_installation_cost);
  const [isCompanyCostEditable, setIsCompanyCostEditable] = useState(false);
  const [savingCompanyCost, setSavingCompanyCost] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [editDateDialogOpen, setEditDateDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(item.installation_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [facesToInstall, setFacesToInstall] = useState<number>(item.faces_to_install || (billboard?.Faces_Count || 1));
  const { confirm: systemConfirm } = useSystemDialog();
  const [isCustomerCostEditable, setIsCustomerCostEditable] = useState(false);
  const [additionalCost, setAdditionalCost] = useState<number>(item.additional_cost || 0);
  const [additionalCostNotes, setAdditionalCostNotes] = useState<string>(item.additional_cost_notes || '');
  const [isAdditionalCostEditable, setIsAdditionalCostEditable] = useState(false);
  const [savingAdditionalCost, setSavingAdditionalCost] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [editReplacementOpen, setEditReplacementOpen] = useState(false);
  const [photoHistoryOpen, setPhotoHistoryOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isFinancialsExpanded, setIsFinancialsExpanded] = useState(false);

  // Calculate company cost
  const totalReinstalledFaces = item.total_reinstalled_faces || 0;
  const effectiveInstallationPrice = (() => {
    if (installationPrice <= 0) return 0;
    if (totalReinstalledFaces > 0) {
      return installationPrice * (totalReinstalledFaces * 0.5);
    }
    return installationPrice;
  })();

  const hasCompanyCost = companyInstallationCost !== null && companyInstallationCost !== undefined;
  const displayCompanyCost = hasCompanyCost ? companyInstallationCost : effectiveInstallationPrice;
  
  useEffect(() => {
    setSelectedDesignId(item.selected_design_id || 'none');
  }, [item.selected_design_id]);

  useEffect(() => {
    setCustomerInstallationCost(item.customer_installation_cost || 0);
  }, [item.customer_installation_cost]);

  useEffect(() => {
    setCompanyInstallationCost(item.company_installation_cost);
  }, [item.company_installation_cost]);

  useEffect(() => {
    setAdditionalCost(item.additional_cost || 0);
    setAdditionalCostNotes(item.additional_cost_notes || '');
  }, [item.additional_cost, item.additional_cost_notes]);

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

      // Sync design to other print/cutout tasks
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
      setHasCutout(!checked);
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

  const handleCompanyCostSave = async () => {
    if (companyInstallationCost === item.company_installation_cost) {
      setIsCompanyCostEditable(false);
      return;
    }
    setSavingCompanyCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ company_installation_cost: companyInstallationCost })
        .eq('id', item.id);
      if (error) throw error;
      toast.success('تم تحديث تكلفة الشركة');
      setIsCompanyCostEditable(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating company installation cost:', error);
      toast.error('فشل في تحديث تكلفة الشركة');
      setCompanyInstallationCost(item.company_installation_cost);
    } finally {
      setSavingCompanyCost(false);
    }
  };

  const handleCustomerPaidAllCosts = async () => {
    setSavingCost(true);
    setSavingCompanyCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ 
          customer_installation_cost: 0,
          company_installation_cost: 0
        })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم تحديد: الزبون سدد التكاليف (المهمة بدون تكاليف)');
      setCustomerInstallationCost(0);
      setCompanyInstallationCost(0);
      onRefresh?.();
    } catch (error) {
      console.error('Error setting customer paid costs:', error);
      toast.error('فشل في حفظ التغييرات');
    } finally {
      setSavingCost(false);
      setSavingCompanyCost(false);
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
  const isDelayed = !isCompleted && item.created_at && differenceInDays(new Date(), new Date(item.created_at)) > 15;
  const delayDays = item.created_at ? differenceInDays(new Date(), new Date(item.created_at)) : 0;

  // Visual layout for Location Hub
  const renderLocationHub = () => (
    <div className="p-4 bg-muted/40 dark:bg-muted/10 rounded-2xl border border-border/60 space-y-2 text-[12px] shadow-inner relative group-hover:bg-muted/50 transition-all duration-300">
      <div className="absolute top-3 left-3 flex gap-1.5 opacity-80">
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      
      {billboard?.Nearest_Landmark && (
        <div className="flex items-start gap-2">
          <Navigation className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-extrabold text-foreground leading-tight">
            {billboard.Nearest_Landmark}
          </div>
        </div>
      )}

      {billboard?.District && (
        <div className={cn("flex items-start gap-2 pt-1.5", billboard?.Nearest_Landmark && "border-t border-border/40")}>
          <MapPin className="h-4 w-4 text-primary/80 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-bold text-foreground/80">
            {billboard.District}
          </div>
        </div>
      )}

      <div className={cn("flex items-start gap-2 pt-1.5", (billboard?.District || billboard?.Nearest_Landmark) && "border-t border-border/40")}>
        <MapPin className="h-4 w-4 text-primary/55 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 font-medium text-muted-foreground">
          {billboard?.Municipality || 'بلدية غير محددة'} • {billboard?.City || 'مدينة غير محددة'}
        </div>
      </div>

      {billboard?.GPS_Link && (
        <div className="pt-2.5 border-t border-border/40">
          <a
            href={billboard.GPS_Link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary-foreground font-black transition-all bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-xl border border-primary/20 hover:border-primary shadow-sm w-full"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>تتبع اللوحة على الخريطة (GPS)</span>
          </a>
        </div>
      )}
    </div>
  );

  // Financial comparative calculator cards
  const renderFinancialCalculator = () => (
    <div className="pt-2 border-t border-border/45 space-y-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsFinancialsExpanded(!isFinancialsExpanded)}
        className="w-full flex items-center justify-between text-xs py-2.5 px-3 bg-muted/40 hover:bg-muted/60 border border-border/40 rounded-xl transition-all"
      >
        <span className="font-extrabold text-muted-foreground flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary shrink-0" />
          التكاليف والأسعار
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] font-black">
            <span className="text-emerald-500">الشركة: {displayCompanyCost.toLocaleString('en-US')} د.ل</span>
            {customerInstallationCost > 0 && (
              <span className="text-blue-500">الزبون: {customerInstallationCost.toLocaleString('en-US')} د.ل</span>
            )}
          </div>
          {isFinancialsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isFinancialsExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-3 pt-1"
          >
            {/* Inline Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Company Cost */}
              <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">تكلفة فرقة التركيب</span>
                <div>
                  {isCompanyCostEditable ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        value={companyInstallationCost === null ? '' : companyInstallationCost}
                        onChange={(e) => setCompanyInstallationCost(e.target.value === '' ? null : Number(e.target.value))}
                        className="h-7 w-20 text-xs font-bold pl-1 bg-background border-border"
                        autoFocus
                      />
                      <Button size="sm" className="h-7 px-1.5 text-[9px] font-bold" onClick={handleCompanyCostSave} disabled={savingCompanyCost}>
                        حفظ
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setIsCompanyCostEditable(true); setCompanyInstallationCost(displayCompanyCost); }}
                      className="font-black text-sm text-foreground hover:underline flex items-center gap-1 leading-none animate-in fade-in duration-200"
                    >
                      <span>{displayCompanyCost.toLocaleString('en-US')} د.ل</span>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Cost */}
              <div className="bg-blue-500/[0.02] border border-blue-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-none">سعر الزبون</span>
                <div>
                  {isCustomerCostEditable ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        value={customerInstallationCost === 0 ? '' : customerInstallationCost}
                        onChange={(e) => setCustomerInstallationCost(e.target.value === '' ? 0 : Number(e.target.value))}
                        onBlur={handleCustomerCostBlur}
                        className="h-7 w-20 text-xs font-bold pl-1 bg-background border-border"
                        autoFocus
                      />
                      <Button size="sm" className="h-7 px-1.5 text-[9px] font-bold" onClick={() => { handleCustomerCostBlur(); setIsCustomerCostEditable(false); }} disabled={savingCost}>
                        حفظ
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCustomerCostEditable(true)}
                      className="font-black text-sm text-foreground hover:underline flex items-center gap-1 leading-none animate-in fade-in duration-200"
                    >
                      <span>{customerInstallationCost.toLocaleString('en-US')} د.ل</span>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action: Paid / Settled Costs */}
            <div className="flex items-center justify-between gap-2 bg-amber-500/[0.03] border border-amber-500/10 p-2.5 rounded-xl shadow-sm transition-all duration-200 hover:bg-amber-500/[0.06]">
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">حالة سداد التكاليف للزبون</span>
                <span className="text-[9px] text-muted-foreground mt-0.5">تصفير التكاليف للشركة والزبون معاً</span>
              </div>
              <Button
                variant={customerInstallationCost === 0 && companyInstallationCost === 0 ? "default" : "outline"}
                size="sm"
                onClick={handleCustomerPaidAllCosts}
                className={cn(
                  "h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                  customerInstallationCost === 0 && companyInstallationCost === 0
                    ? "bg-amber-500 hover:bg-amber-600 text-black border-0 shadow-sm"
                    : "border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                )}
                disabled={savingCost || savingCompanyCost}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{customerInstallationCost === 0 && companyInstallationCost === 0 ? "تم السداد والتصفير" : "سدد التكاليف / بدون تكاليف"}</span>
              </Button>
            </div>

            {/* Profit margin bar */}
            {customerInstallationCost > 0 && displayCompanyCost > 0 && (
              <div className={cn(
                "text-[11px] font-bold py-2 px-3 rounded-xl flex items-center justify-between border",
                (customerInstallationCost - displayCompanyCost) >= 0
                  ? "bg-emerald-500/[0.02] border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/[0.02] border-rose-500/20 text-rose-600 dark:text-rose-400"
              )}>
                <span>هامش الربح التقديري:</span>
                <div className="flex items-center gap-1.5 font-black text-xs">
                  {(customerInstallationCost - displayCompanyCost) >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <span>{(customerInstallationCost - displayCompanyCost).toLocaleString('en-US')} د.ل</span>
                </div>
              </div>
            )}

            {/* Repeat installation warning */}
            {(item.replacement_status === 'reinstalled' || item.reinstall_count > 0) && customerInstallationCost === 0 && item.replacement_cost_bearer !== 'company' && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[10px] text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>لوحة مكررة التركيب — يرجى تحديد تكلفة الزبون</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 w-full text-[9px] font-bold rounded-lg"
                  onClick={() => setIsCustomerCostEditable(true)}
                >
                  إدخال التكلفة الآن
                </Button>
              </div>
            )}

            {/* Extra costs block */}
            <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">رسوم وتكاليف إضافية:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={isAdditionalCostEditable ? "default" : "outline"}
                    size="sm"
                    className="h-6.5 text-[9px] font-bold px-2 rounded-lg"
                    onClick={async () => {
                      if (isAdditionalCostEditable) {
                        await handleAdditionalCostSave();
                      } else {
                        setIsAdditionalCostEditable(true);
                      }
                    }}
                    disabled={savingAdditionalCost}
                  >
                    {savingAdditionalCost ? 'جاري الحفظ...' : isAdditionalCostEditable ? 'حفظ الرسوم' : 'إضافة رسوم'}
                  </Button>
                  {additionalCost > 0 && !isAdditionalCostEditable && (
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold">
                      +{additionalCost.toLocaleString('en-US')} د.ل
                    </Badge>
                  )}
                </div>
              </div>

              {isAdditionalCostEditable && (
                <div className="space-y-2 p-2.5 bg-muted/40 rounded-xl border border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground">المبلغ الإضافي</Label>
                    <Input
                      type="number"
                      value={additionalCost}
                      onChange={(e) => setAdditionalCost(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="h-7.5 text-xs bg-background"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground">البيان/الملاحظات</Label>
                    <Input
                      type="text"
                      value={additionalCostNotes}
                      onChange={(e) => setAdditionalCostNotes(e.target.value)}
                      className="h-7.5 text-xs bg-background"
                      placeholder="سبب التكلفة الإضافية..."
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6.5 w-full text-[9px] font-bold"
                    onClick={() => {
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Completed State rendering override
  if (isCompleted) {
    return (
      <div className="group relative w-full overflow-hidden p-4 bg-card/60 backdrop-blur-md border border-green-200 dark:border-green-800/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[28px]">
        <div className="space-y-3">
          
          {/* Billboard Image Panel */}
          <div 
            className="relative aspect-[16/10] rounded-[18px] overflow-hidden bg-muted cursor-pointer shadow-sm"
            onClick={() => billboard?.Image_URL && setLightboxImage(billboard.Image_URL)}
          >
            {billboard?.Image_URL ? (
              <img
                src={billboard.Image_URL}
                alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            {/* Action Checkbox overlay */}
            <div 
              className="absolute top-2.5 right-2.5 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
                className="h-5 w-5 rounded-lg border-2 border-white/40 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-primary data-[state=checked]:!border-primary cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px]"
              />
            </div>
            

            
            {/* Badges Overlay */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 z-10">
              <Badge className="text-[9px] px-2 py-0.5 font-extrabold bg-black/60 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-0.5">
                <Box className="h-3 w-3" />
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-black/60 backdrop-blur-sm text-white border-0 shadow-sm">
                  {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                </Badge>
              )}
              {hasCutout && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-accent/90 backdrop-blur-sm text-white border-0 shadow-sm">
                  مجسم
                </Badge>
              )}
              {isPrintActive && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-blue-600/90 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-0.5">
                  <Printer className="h-3 w-3" />
                  طباعة ✓
                </Badge>
              )}
            </div>

            {/* ID Badge */}
            <div className="absolute bottom-2.5 right-2.5 z-10">
              <div className="bg-gradient-to-r from-primary to-accent backdrop-blur-md px-2.5 py-0.5 rounded-full shadow-md border border-white/10">
                <span className="font-extrabold text-[10px] text-white">#{billboard?.ID}</span>
              </div>
            </div>
          </div>

          {/* Details & Tags */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <Checkbox
                id={`select-completed-${item.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
                className="h-4.5 w-4.5 rounded border-border"
              />
              <label 
                htmlFor={`select-completed-${item.id}`}
                className="font-extrabold text-sm line-clamp-1 text-foreground leading-tight cursor-pointer flex-1"
              >
                {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
              </label>
            </div>
            
            {/* Status Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="text-[9px] px-2 py-0.5 font-bold bg-green-500 hover:bg-green-600 text-white border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                مكتملة بنجاح
              </Badge>
              {isPrintActive && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  تم احتساب الطباعة ✓
                </Badge>
              )}
              {onUncomplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await systemConfirm({ title: 'تراجع', message: 'هل تريد التراجع عن إكمال هذه اللوحة؟', confirmText: 'تراجع' })) {
                      onUncomplete();
                    }
                  }}
                  className="h-6.5 text-[9px] px-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 hover:text-orange-600 border-none font-bold rounded-lg flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  تراجع عن الإكمال
                </Button>
              )}
              {(item.replacement_status === 'reinstalled' || item.replacement_status === 'replaced') && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {item.replacement_status === 'reinstalled' ? 'معاد تركيبها' : 'مستبدلة'} ({item.reinstall_count || 1})
                </Badge>
              )}
              {pausedInfo && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-amber-500 text-white border-0">
                  موقوفة
                </Badge>
              )}
              {replacementInfo && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-600 text-white border-0">
                  بديلة
                </Badge>
              )}
            </div>

            {/* Quick Actions Row */}
            <div className="flex items-center gap-1.5 pt-1.5 pb-2 border-b border-border/30" onClick={e => e.stopPropagation()}>
              {/* Camera - Add Installed Image */}
              {onAddInstalledImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddInstalledImage}
                  className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30 border-green-500/20"
                >
                  <Camera className="h-3.5 w-3.5 text-green-500" />
                  <span>صور التركيب</span>
                </Button>
              )}

              {/* Manage Designs */}
              {onEditDesign && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditDesign}
                  className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-violet-500/10 hover:text-violet-500 hover:border-violet-500/30 border-violet-500/20"
                >
                  <PaintBucket className="h-3.5 w-3.5 text-violet-500" />
                  <span>التصاميم</span>
                </Button>
              )}

              {/* Print */}
              {onPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrint}
                  className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30 border-blue-500/20"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-500" />
                  <span>طباعة</span>
                </Button>
              )}

              {/* Replace */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplaceDialogOpen(true)}
                className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 border-amber-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                <span>استبدال</span>
              </Button>
              
              {/* More / Dropdown (like uncomplete, extend rental, etc.) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-xl border-border/80 hover:bg-muted text-muted-foreground shrink-0"
                    title="المزيد"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 bg-popover rounded-2xl shadow-xl border-border/60" align="start">
                  {onUncomplete && (
                    <DropdownMenuItem 
                      onClick={async () => {
                        if (await systemConfirm({ title: 'تراجع', message: 'هل تريد التراجع عن إكمال هذه اللوحة؟', confirmText: 'تراجع' })) {
                          onUncomplete();
                        }
                      }}
                      className="gap-2 text-orange-500 font-bold focus:text-orange-600 focus:bg-orange-500/5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      التراجع عن الإكمال
                    </DropdownMenuItem>
                  )}
                  {billboard?.Rent_End_Date && (
                    <DropdownMenuItem onClick={() => setExtendDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4 text-emerald-500" />
                      تمديد الإيجار
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Reinstall history button */}
            {(item.replacement_status === 'reinstalled' || item.replacement_status === 'replaced') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoHistoryOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors border border-amber-500/25 shadow-sm"
              >
                <History className="h-4 w-4" />
                عرض أرشيف الصور السابقة ({item.reinstall_count || 1})
              </button>
            )}

            {/* Location details */}
            {renderLocationHub()}

            {/* Completion Date */}
            {item.installation_date && (
              <div className="flex items-center justify-between text-xs p-2.5 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1.5 font-bold">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  <span>تاريخ التركيب المنفذ: {format(new Date(item.installation_date), "dd/MM/yyyy", { locale: ar })}</span>
                </div>
                <button
                  onClick={() => {
                    setEditingDate(item.installation_date || '');
                    setEditDateDialogOpen(true);
                  }}
                  className="h-6 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-colors text-primary font-bold text-[10px]"
                >
                  تعديل التاريخ
                </button>
              </div>
            )}
          </div>

          {/* Design Face Selector */}
          {taskDesigns.length > 0 && (
            <div className="pt-2.5 border-t border-border/40 space-y-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Palette className="h-3.5 w-3.5 text-primary" />
                التصميم المعتمد
              </label>
              <Select 
                value={selectedDesignId} 
                onValueChange={handleDesignChange}
                disabled={saving}
              >
                <SelectTrigger className="h-8.5 text-xs bg-muted/40 border-border/50 rounded-xl focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="-- اختر التصميم --" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="none">-- بدون تصميم --</SelectItem>
                  {taskDesigns.map((design) => (
                    <SelectItem key={design.id} value={design.id}>{design.design_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Design Face Previews */}
          {(() => {
            const displayDesign = selectedDesign || (item.design_face_a || item.design_face_b ? {
              design_name: 'التصميم المحفوظ',
              design_face_a_url: item.design_face_a,
              design_face_b_url: item.design_face_b
            } : null);

            if (!displayDesign) return null;

            return (
              <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-muted/20 border border-border/30 rounded-2xl" onClick={e => e.stopPropagation()}>
                {displayDesign.design_face_a_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الأمامي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                      onClick={() => setLightboxImage(displayDesign.design_face_a_url!)}
                    >
                      <img src={displayDesign.design_face_a_url} alt="الوجه الأمامي" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                {displayDesign.design_face_b_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الخلفي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                      onClick={() => setLightboxImage(displayDesign.design_face_b_url!)}
                    >
                      <img src={displayDesign.design_face_b_url} alt="الوجه الخلفي" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Installed photos display */}
          {(item.installed_image_face_a_url || item.installed_image_face_b_url) && (
            <div className="pt-2.5 border-t border-border/40 space-y-1.5" onClick={e => e.stopPropagation()}>
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-green-500" />
                إثبات صور التركيب المنفذ
              </span>
              <div className="grid grid-cols-2 gap-2">
                {item.installed_image_face_a_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">صورة الوجه الأمامي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-sm"
                      onClick={() => setLightboxImage(item.installed_image_face_a_url)}
                    >
                      <img src={item.installed_image_face_a_url} alt="إثبات أمامي" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                {item.installed_image_face_b_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">صورة الوجه الخلفي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-sm"
                      onClick={() => setLightboxImage(item.installed_image_face_b_url)}
                    >
                      <img src={item.installed_image_face_b_url} alt="إثبات خلفي" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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

        {/* Lightbox */}
        {lightboxImage && createPortal(
          <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />,
          document.body
        )}

        {/* Dialog تكرار/إعادة الاستبدال */}
        <ReplaceBillboardDialog
          open={replaceDialogOpen}
          onOpenChange={setReplaceDialogOpen}
          item={item}
          billboard={billboard}
          taskId={item.task_id}
          onSuccess={() => onRefresh?.()}
        />

        {/* Photo History */}
        <InstallationPhotoHistoryDialog
          open={photoHistoryOpen}
          onOpenChange={setPhotoHistoryOpen}
          taskItemId={item.id}
          billboardId={item.billboard_id}
        />
      </div>
    );
  }

  // Pending State Card View Override
  return (
    <div
      className={cn(
        "group relative min-w-0 w-full overflow-hidden bg-card border transition-all duration-300 rounded-[28px] p-3.5",
        isSelected 
          ? "border-2 border-primary shadow-2xl shadow-primary/10 ring-4 ring-primary/10 bg-primary/[0.02] scale-[1.01]" 
          : isDelayed
          ? "border-red-200 dark:border-red-950/60 hover:shadow-lg hover:-translate-y-1"
          : "border-border/60 hover:shadow-lg hover:-translate-y-1"
      )}
    >
      <div className="space-y-3.5">
        
        {/* Main image preview */}
        <div 
          className="relative aspect-[16/10] overflow-hidden rounded-[18px] cursor-pointer shadow-sm"
          onClick={() => billboard?.Image_URL && setLightboxImage(billboard.Image_URL)}
        >
          {billboard?.Image_URL ? (
            <img
              src={billboard.Image_URL}
              alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Action Checkbox overlay */}
          <div 
            className="absolute top-2.5 right-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
              className="h-5 w-5 rounded-lg border-2 border-white/40 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-primary data-[state=checked]:!border-primary cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px]"
            />
          </div>

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10">
            {isPrintActive && (
              <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-blue-600/90 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-0.5">
                <Printer className="h-3 w-3" />
                طباعة ✓
              </Badge>
            )}
            {hasCutout && (
              <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-accent/90 backdrop-blur-sm text-white border-0 shadow-sm">
                مجسم
              </Badge>
            )}
          </div>

          {/* Overdue delay badge */}
          {isDelayed && (
            <div className="absolute bottom-2.5 left-2.5 bg-red-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md text-[9px] animate-pulse font-bold">
              <AlertTriangle className="h-3 w-3" />
              <span>متأخر تركيبها {delayDays} يوم</span>
            </div>
          )}
          
          {/* ID Code overlay */}
          <div className="absolute bottom-2.5 right-2.5 z-10">
            <div className="bg-gradient-to-r from-primary to-accent backdrop-blur-md px-2.5 py-0.5 rounded-full shadow-md border border-white/10">
              <span className="font-extrabold text-[10px] text-white">#{billboard?.ID}</span>
            </div>
          </div>
        </div>

        {/* Details and tags */}
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2 mb-2">
                <Checkbox
                  id={`select-pending-${item.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
                  className="h-4.5 w-4.5 rounded border-border"
                />
                <label 
                  htmlFor={`select-pending-${item.id}`}
                  className="font-extrabold text-sm line-clamp-1 text-foreground leading-tight cursor-pointer flex-1"
                >
                  {billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}
                </label>
              </div>
              
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  قيد التركيب
                </span>
                {isPrintActive && (
                  <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1 rounded-full">
                    تم تفعيل الطباعة ✓
                  </Badge>
                )}
                {billboard?.friend_companies?.name && (
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-bold">
                    <Building2 className="h-3 w-3.5 shrink-0" />
                    <span className="truncate max-w-[100px]">{billboard.friend_companies.name}</span>
                  </div>
                )}
              </div>

              {/* Quick Actions Row */}
              <div className="flex items-center gap-1.5 pt-1.5 pb-2 border-b border-border/30" onClick={e => e.stopPropagation()}>
                {/* Manage Designs */}
                {onEditDesign && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEditDesign}
                    className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-violet-500/10 hover:text-violet-500 hover:border-violet-500/30 border-violet-500/20"
                  >
                    <PaintBucket className="h-3.5 w-3.5 text-violet-500" />
                    <span>التصاميم</span>
                  </Button>
                )}
                
                {/* Print */}
                {onPrint && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrint}
                    className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30 border-blue-500/20"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-500" />
                    <span>طباعة</span>
                  </Button>
                )}
                
                {/* Replace */}
                {item.replacement_status !== 'replaced' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReplaceDialogOpen(true)}
                    className="h-8 flex-1 rounded-xl text-[10px] font-bold gap-1 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 border-amber-500/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                    <span>استبدال</span>
                  </Button>
                )}

                {/* Delete */}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه اللوحة من المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                        onDelete();
                      }
                    }}
                    className="h-8 w-8 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 shrink-0"
                    title="إزالة اللوحة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Dimensions and faces badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className="text-[9px] px-2 py-0.5 font-bold bg-primary text-primary-foreground border-none">
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-border">
                  {billboard.Faces_Count} وجه
                </Badge>
              )}
            </div>
          </div>

          {/* Replacement banner info */}
          {item.replacement_status && (
            <div className={cn(
              "flex flex-col gap-1.5 text-xs p-2.5 rounded-xl border",
              item.replacement_status === 'replaced' 
                ? 'bg-red-500/5 border-red-500/20 text-red-600'
                : item.replacement_status === 'replacement'
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-600'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-600'
            )}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold">
                  {item.replacement_status === 'replaced' && 'مستبدلة'}
                  {item.replacement_status === 'replacement' && 'لوحة بديلة'}
                  {item.replacement_status === 'reinstalled' && 'أعيد تركيبها'}
                </span>
                {item.replacement_status === 'reinstalled' && (
                  <Badge className="text-[9px] font-extrabold bg-amber-600 text-white border-0 px-1.5 py-0.5 rounded-md shadow-sm">
                    {item.reinstall_count || 1} مرة
                  </Badge>
                )}
                {item.replacement_cost_bearer && (
                  <Badge variant="outline" className="text-[8px] bg-background">
                    التكلفة: {item.replacement_cost_bearer === 'customer' ? 'الزبون' : item.replacement_cost_bearer === 'company' ? 'الشركة' : `${item.replacement_cost_percentage || 50}% زبون`}
                  </Badge>
                )}
              </div>
              {item.replacement_reason && (
                <p className="text-[9px] text-muted-foreground/80 leading-normal">السبب: {item.replacement_reason}</p>
              )}

              {/* History index */}
              {(item.replacement_status === 'reinstalled' || item.replacement_status === 'replaced') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoHistoryOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg font-bold text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-all shadow-sm"
                >
                  <History className="h-3.5 w-3.5" />
                  عرض صور التركيب السابقة ({item.reinstall_count || 1})
                </button>
              )}

              {/* Link references */}
              {item.replacement_status === 'replaced' && item.replaced_by_item_id && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>البديلة: لوحة #{allItems?.find(i => i.id === item.replaced_by_item_id)?.billboard_id || '...'}</span>
                </div>
              )}
              {item.replacement_status === 'replacement' && item.replaces_item_id && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>بديلة عن: لوحة #{allItems?.find(i => i.id === item.replaces_item_id)?.billboard_id || '...'}</span>
                </div>
              )}

              {/* Actions row for replacements */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/20 mt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditReplacementOpen(true); }}
                  className="p-1.5 rounded-lg hover:bg-muted text-foreground/80 transition-colors"
                  title="تعديل بيانات الاستبدال"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!await systemConfirm({ title: 'إلغاء حالة الاستبدال', message: 'هل تريد إزالة علامة الاستبدال من هذه اللوحة؟', confirmText: 'إلغاء الاستبدال' })) return;
                    try {
                      if (item.replaced_by_item_id) {
                        await supabase.from('installation_task_items').update({
                          replacement_status: null, replaces_item_id: null, replacement_reason: null,
                          replacement_cost_bearer: null, replacement_cost_percentage: null,
                        } as any).eq('id', item.replaced_by_item_id);
                      }
                      if (item.replaces_item_id) {
                        await supabase.from('installation_task_items').update({
                          replacement_status: null, replaced_by_item_id: null, replacement_reason: null,
                          replacement_cost_bearer: null, replacement_cost_percentage: null,
                        } as any).eq('id', item.replaces_item_id);
                      }
                      await supabase.from('installation_task_items').update({
                        replacement_status: null, replaced_by_item_id: null, replaces_item_id: null,
                        replacement_reason: null, replacement_cost_bearer: null, replacement_cost_percentage: null,
                      } as any).eq('id', item.id);
                      toast.success('تم إلغاء حالة الاستبدال');
                      onRefresh?.();
                    } catch { toast.error('حدث خطأ'); }
                  }}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  title="إلغاء حالة الاستبدال"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Location hub */}
          {renderLocationHub()}

          {/* Installation Date Picker inline row */}
          <div
            className="flex items-center justify-between text-xs p-2.5 bg-blue-500/5 rounded-xl border border-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className={item.installation_date ? 'font-bold' : 'italic text-muted-foreground'}>
                {item.installation_date
                  ? format(new Date(item.installation_date), 'dd/MM/yyyy', { locale: ar })
                  : 'تاريخ التركيب غير محدد'}
              </span>
            </div>
            <button
              onClick={() => {
                setEditingDate(item.installation_date || '');
                setEditDateDialogOpen(true);
              }}
              className="h-6 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all text-primary font-extrabold text-[10px]"
            >
              تعديل التاريخ
            </button>
          </div>

          {/* Design Face Select Dropdown */}
          {taskDesigns.length > 0 && (
            <div className="pt-2.5 border-t border-border/40 space-y-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Palette className="h-3.5 w-3.5 text-primary" />
                تخصيص تصميم اللوحة
              </label>
              <Select 
                value={selectedDesignId} 
                onValueChange={handleDesignChange}
                disabled={saving}
              >
                <SelectTrigger className="h-8.5 text-xs bg-muted/40 border-border/50 rounded-xl focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="-- اختر التصميم --" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="none">-- بدون تصميم --</SelectItem>
                  {taskDesigns.map((design) => (
                    <SelectItem key={design.id} value={design.id}>{design.design_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active design face preview */}
          {(() => {
            const displayDesign = selectedDesign || (item.design_face_a || item.design_face_b ? {
              design_name: 'التصميم المحفوظ',
              design_face_a_url: item.design_face_a,
              design_face_b_url: item.design_face_b
            } : null);

            if (!displayDesign) return null;

            return (
              <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-muted/20 border border-border/30 rounded-2xl" onClick={e => e.stopPropagation()}>
                {displayDesign.design_face_a_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الأمامي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                      onClick={() => setLightboxImage(displayDesign.design_face_a_url!)}
                    >
                      <img src={displayDesign.design_face_a_url} alt="أمامية" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                {displayDesign.design_face_b_url && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الخلفي</div>
                    <div 
                      className="relative aspect-[16/10] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                      onClick={() => setLightboxImage(displayDesign.design_face_b_url!)}
                    >
                      <img src={displayDesign.design_face_b_url} alt="خلفية" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Faces to install selection */}
          {billboard?.Faces_Count > 1 && (
            <div className="pt-2 border-t border-border/40 space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">الوجه المطلوب تركيبه</span>
                {onApplyFacesToAll && (
                  <button
                    onClick={() => onApplyFacesToAll(facesToInstall)}
                    className="text-[9px] text-primary hover:underline font-bold flex items-center gap-0.5"
                  >
                    <Link2 className="h-3 w-3" />
                    تعميم الخيار للكل
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFacesChange(1)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    facesToInstall === 1
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                  }`}
                >
                  الوجه الأمامي فقط
                </button>
                <button
                  onClick={() => handleFacesChange(2)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    facesToInstall === 2
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                  }`}
                >
                  الوجهين بالكامل
                </button>
              </div>
            </div>
          )}

          {/* Cutout toggle button */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between flex-wrap gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleCutoutChange(!hasCutout)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                hasCutout 
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-sm' 
                  : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60'
              }`}
            >
              <Box className="h-4 w-4" />
              {hasCutout ? 'يحتوي مجسم ✓' : 'إضافة مجسم'}
            </button>
          </div>

          {/* Pricing hub calculator display */}
          {renderFinancialCalculator()}
        </div>

      </div>

      {/* Dialog تعديل تاريخ التركيب للوحات غير المكتملة */}
      <Dialog open={editDateDialogOpen} onOpenChange={setEditDateDialogOpen}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-sm font-bold">
              <CalendarIcon className="h-5 w-5 text-primary" />
              تعديل تاريخ تركيب اللوحة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">تاريخ التركيب المقترح</Label>
              <CustomDatePicker
                value={editingDate}
                onChange={(val) => setEditingDate(val)}
                placeholder="اختر تاريخ التركيب"
              />
            </div>
            <div className="flex justify-end gap-2 shrink-0 pt-2">
              <Button variant="outline" className="rounded-xl font-bold text-xs h-10" onClick={() => setEditDateDialogOpen(false)}>
                إلغاء
              </Button>
              <Button className="rounded-xl font-bold text-xs h-10" onClick={handleEditDate} disabled={savingDate}>
                {savingDate ? 'جاري الحفظ...' : 'حفظ التاريخ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Rental */}
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

      {/* Lightbox */}
      {lightboxImage && createPortal(
        <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />,
        document.body
      )}

      {/* Replace Billboard Dialog */}
      <ReplaceBillboardDialog
        open={replaceDialogOpen}
        onOpenChange={setReplaceDialogOpen}
        item={item}
        billboard={billboard}
        taskId={item.task_id}
        onSuccess={() => onRefresh?.()}
      />

      {/* Edit Replacement Dialog */}
      <EditReplacementDialog
        open={editReplacementOpen}
        onOpenChange={setEditReplacementOpen}
        item={item}
        allItems={allItems || []}
        onSaved={() => { onRefresh?.(); }}
      />

      {/* Photo History */}
      <InstallationPhotoHistoryDialog
        open={photoHistoryOpen}
        onOpenChange={setPhotoHistoryOpen}
        taskItemId={item.id}
        billboardId={item.billboard_id}
      />
    </div>
  );
}
