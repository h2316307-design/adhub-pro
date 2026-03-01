import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Layers, Grid3x3, Ruler, Shuffle, Check, Image as ImageIcon, Palette, CheckCircle2, Trash2 } from 'lucide-react';

interface TaskDesign {
  id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  billboards?: {
    ID: number;
    Billboard_Name: string;
    Size: string;
  };
}

interface BulkDesignAssignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskItems: TaskItem[];
  taskDesigns: TaskDesign[];
  onSuccess: () => void;
}

type AssignMode = 'all' | 'by_size' | 'distribute' | 'manual' | 'delete_all' | 'delete_by_size';

export function BulkDesignAssigner({
  open,
  onOpenChange,
  taskItems,
  taskDesigns,
  onSuccess
}: BulkDesignAssignerProps) {
  const [assignMode, setAssignMode] = useState<AssignMode>('all');
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // استخراج المقاسات الفريدة مع العدد
  const sizesWithCount = useMemo(() => {
    const sizeMap: Record<string, number> = {};
    taskItems.forEach(item => {
      if (item.billboards?.Size) {
        sizeMap[item.billboards.Size] = (sizeMap[item.billboards.Size] || 0) + 1;
      }
    });
    return Object.entries(sizeMap).sort((a, b) => b[1] - a[1]);
  }, [taskItems]);

  // حذف التصاميم من اللوحات
  const handleDeleteDesigns = async () => {
    setSaving(true);
    try {
      let itemsToUpdate: TaskItem[] = [];

      if (assignMode === 'delete_all') {
        itemsToUpdate = taskItems;
      } else if (assignMode === 'delete_by_size') {
        if (!selectedSize) {
          toast.error('يرجى اختيار المقاس');
          setSaving(false);
          return;
        }
        itemsToUpdate = taskItems.filter(
          item => item.billboards?.Size === selectedSize
        );
      }

      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لحذف التصميم منها');
        setSaving(false);
        return;
      }

      // حذف التصاميم
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('installation_task_items')
          .update({
            selected_design_id: null,
            design_face_a: null,
            design_face_b: null
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      toast.success(`تم حذف التصاميم من ${itemsToUpdate.length} لوحة بنجاح`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error deleting designs:', error);
      toast.error('فشل في حذف التصاميم');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    // إذا كان وضع الحذف
    if (assignMode === 'delete_all' || assignMode === 'delete_by_size') {
      await handleDeleteDesigns();
      return;
    }

    if (selectedDesignIds.length === 0) {
      toast.error('يرجى اختيار تصميم واحد على الأقل');
      return;
    }

    setSaving(true);
    try {
      let itemsToUpdate: TaskItem[] = [];

      switch (assignMode) {
        case 'all':
          itemsToUpdate = taskItems;
          break;

        case 'by_size':
          if (!selectedSize) {
            toast.error('يرجى اختيار المقاس');
            setSaving(false);
            return;
          }
          itemsToUpdate = taskItems.filter(
            item => item.billboards?.Size === selectedSize
          );
          break;

        case 'distribute':
          itemsToUpdate = taskItems;
          break;

        case 'manual':
          if (selectedBillboardIds.size === 0) {
            toast.error('يرجى اختيار لوحة واحدة على الأقل');
            setSaving(false);
            return;
          }
          itemsToUpdate = taskItems.filter(item =>
            selectedBillboardIds.has(item.id)
          );
          break;
      }

      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لتحديث التصميم لها');
        setSaving(false);
        return;
      }

      // جلب تفاصيل التصاميم للحفظ
      const { data: designsData, error: designsError } = await supabase
        .from('task_designs')
        .select('id, design_face_a_url, design_face_b_url')
        .in('id', selectedDesignIds);

      if (designsError) throw designsError;

      // تطبيق التصاميم
      if (assignMode === 'distribute' && selectedDesignIds.length > 1) {
        // توزيع متساوي لعدة تصاميم
        const itemsPerDesign = Math.ceil(itemsToUpdate.length / selectedDesignIds.length);
        
        for (let i = 0; i < itemsToUpdate.length; i++) {
          const designIndex = Math.floor(i / itemsPerDesign);
          const designId = selectedDesignIds[Math.min(designIndex, selectedDesignIds.length - 1)];
          const design = designsData?.find(d => d.id === designId);
          
          const updateData: any = { selected_design_id: designId };
          if (design) {
            updateData.design_face_a = design.design_face_a_url;
            updateData.design_face_b = design.design_face_b_url || null;
          }
          
          const { error } = await supabase
            .from('installation_task_items')
            .update(updateData)
            .eq('id', itemsToUpdate[i].id);

          if (error) throw error;
        }
      } else {
        // تعيين نفس التصميم لكل اللوحات المختارة
        const designId = selectedDesignIds[0];
        const design = designsData?.find(d => d.id === designId);
        
        const updateData: any = { selected_design_id: designId };
        if (design) {
          updateData.design_face_a = design.design_face_a_url;
          updateData.design_face_b = design.design_face_b_url || null;
        }
        
        for (const item of itemsToUpdate) {
          const { error } = await supabase
            .from('installation_task_items')
            .update(updateData)
            .eq('id', item.id);

          if (error) throw error;
        }
      }

      toast.success(`تم تعيين التصاميم لـ ${itemsToUpdate.length} لوحة بنجاح`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error assigning designs:', error);
      toast.error('فشل في تعيين التصاميم');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setAssignMode('all');
    setSelectedDesignIds([]);
    setSelectedSize('');
    setSelectedBillboardIds(new Set());
  };

  const toggleDesignSelection = (designId: string) => {
    setSelectedDesignIds(prev =>
      prev.includes(designId)
        ? prev.filter(id => id !== designId)
        : [...prev, designId]
    );
  };

  const toggleBillboardSelection = (itemId: string) => {
    setSelectedBillboardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAllBillboards = () => {
    setSelectedBillboardIds(new Set(taskItems.map(i => i.id)));
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const getAffectedCount = () => {
    switch (assignMode) {
      case 'all':
      case 'delete_all':
        return taskItems.length;
      case 'by_size':
      case 'delete_by_size':
        return taskItems.filter(i => i.billboards?.Size === selectedSize).length;
      case 'distribute':
        return taskItems.length;
      case 'manual':
        return selectedBillboardIds.size;
      default:
        return 0;
    }
  };

  const isDeleteMode = assignMode === 'delete_all' || assignMode === 'delete_by_size';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-primary/10 via-transparent to-transparent">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            توزيع التصاميم على اللوحات
            <Badge variant="secondary" className="mr-auto text-sm font-bold">
              {taskItems.length} لوحة
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* الجانب الأيسر - طرق التعيين */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-l bg-muted/30 p-4 flex flex-col gap-4">
            {/* طريقة التعيين */}
            <div className="space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                طريقة التعيين
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { mode: 'all' as AssignMode, icon: Grid3x3, label: 'كل اللوحات', desc: `${taskItems.length} لوحة` },
                  { mode: 'by_size' as AssignMode, icon: Ruler, label: 'حسب المقاس', desc: `${sizesWithCount.length} مقاس` },
                  { mode: 'distribute' as AssignMode, icon: Shuffle, label: 'توزيع متساوي', desc: 'عدة تصاميم' },
                  { mode: 'manual' as AssignMode, icon: Check, label: 'اختيار يدوي', desc: 'تحديد محدد' },
                ].map(({ mode, icon: Icon, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssignMode(mode)}
                    className={`relative p-3 rounded-xl border-2 text-right transition-all duration-200 ${
                      assignMode === mode
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    {assignMode === mode && (
                      <div className="absolute top-1.5 left-1.5">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <Icon className={`h-5 w-5 mb-1 ${assignMode === mode ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className={`text-xs font-bold ${assignMode === mode ? 'text-primary' : ''}`}>{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* خيارات حذف التصاميم */}
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-bold flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                حذف التصاميم
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { mode: 'delete_all' as AssignMode, icon: Grid3x3, label: 'حذف الكل', desc: `${taskItems.length} لوحة` },
                  { mode: 'delete_by_size' as AssignMode, icon: Ruler, label: 'حذف مقاس', desc: `${sizesWithCount.length} مقاس` },
                ].map(({ mode, icon: Icon, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssignMode(mode)}
                    className={`relative p-3 rounded-xl border-2 text-right transition-all duration-200 ${
                      assignMode === mode
                        ? 'border-destructive bg-destructive/10 shadow-md'
                        : 'border-border bg-card hover:border-destructive/50 hover:bg-destructive/5'
                    }`}
                  >
                    {assignMode === mode && (
                      <div className="absolute top-1.5 left-1.5">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </div>
                    )}
                    <Icon className={`h-5 w-5 mb-1 ${assignMode === mode ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <p className={`text-xs font-bold ${assignMode === mode ? 'text-destructive' : ''}`}>{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* اختيار المقاس */}
            {(assignMode === 'by_size' || assignMode === 'delete_by_size') && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-sm font-semibold">اختر المقاس</Label>
                <div className="flex flex-wrap gap-2">
                  {sizesWithCount.map(([size, count]) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                        selectedSize === size
                          ? assignMode === 'delete_by_size' 
                            ? 'border-destructive bg-destructive text-destructive-foreground'
                            : 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {size}
                      <Badge variant="secondary" className="mr-2 text-[10px]">{count}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* اختيار اللوحات يدوياً */}
            {assignMode === 'manual' && (
              <div className="space-y-2 flex-1 flex flex-col animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">اختر اللوحات</Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllBillboards}>
                      الكل
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearBillboardSelection}>
                      مسح
                    </Button>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit">{selectedBillboardIds.size} محددة</Badge>
                <ScrollArea className="flex-1 min-h-[120px] max-h-[200px] rounded-lg border bg-card">
                  <div className="p-2 space-y-1">
                    {taskItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleBillboardSelection(item.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-right transition-all ${
                          selectedBillboardIds.has(item.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={selectedBillboardIds.has(item.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {item.billboards?.Billboard_Name || `#${item.billboard_id}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{item.billboards?.Size}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* ملخص */}
            {(selectedDesignIds.length > 0 || isDeleteMode) && (
              <div className={`p-3 rounded-xl space-y-2 ${
                isDeleteMode 
                  ? 'bg-destructive/10 border border-destructive/30' 
                  : 'bg-primary/10 border border-primary/30'
              }`}>
                <p className={`text-xs font-bold flex items-center gap-1 ${isDeleteMode ? 'text-destructive' : 'text-primary'}`}>
                  {isDeleteMode ? <Trash2 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {isDeleteMode ? 'سيتم حذف التصاميم من' : 'سيتم التطبيق على'}
                </p>
                <p className={`text-lg font-black ${isDeleteMode ? 'text-destructive' : 'text-primary'}`}>
                  {getAffectedCount()} لوحة
                </p>
                {assignMode === 'distribute' && selectedDesignIds.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    ≈ {Math.ceil(getAffectedCount() / selectedDesignIds.length)} لوحة/تصميم
                  </p>
                )}
              </div>
            )}
          </div>

          {/* الجانب الأيمن - التصاميم */}
          {!isDeleteMode ? (
            <div className="flex-1 p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  اختر التصميم
                  {assignMode === 'distribute' && (
                    <span className="text-[10px] text-muted-foreground font-normal">(يمكن اختيار أكثر من واحد)</span>
                  )}
                </Label>
                <Badge variant="secondary">{selectedDesignIds.length} مختار</Badge>
              </div>
              
              <ScrollArea className="flex-1 min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                  {taskDesigns.map(design => {
                    const isSelected = selectedDesignIds.includes(design.id);
                    return (
                      <button
                        key={design.id}
                        type="button"
                        onClick={() => {
                          if (assignMode === 'distribute') {
                            toggleDesignSelection(design.id);
                          } else {
                            setSelectedDesignIds([design.id]);
                          }
                        }}
                        className={`relative p-3 rounded-xl border-2 text-right transition-all duration-200 group ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/30'
                            : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -left-2 z-10">
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Palette className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : ''}`}>
                            {design.design_name}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground text-center font-medium">الوجه الأمامي</p>
                            <div className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected ? 'border-primary/50' : 'border-border group-hover:border-primary/30'
                            }`}>
                              <img
                                src={design.design_face_a_url}
                                alt="الوجه الأمامي"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/placeholder.svg';
                                }}
                              />
                            </div>
                          </div>
                          {design.design_face_b_url ? (
                            <div className="space-y-1">
                              <p className="text-[9px] text-muted-foreground text-center font-medium">الوجه الخلفي</p>
                              <div className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                                isSelected ? 'border-primary/50' : 'border-border group-hover:border-primary/30'
                              }`}>
                                <img
                                  src={design.design_face_b_url}
                                  alt="الوجه الخلفي"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/placeholder.svg';
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-[9px] text-muted-foreground text-center font-medium">الوجه الخلفي</p>
                              <div className="aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                                <p className="text-[9px] text-muted-foreground">لا يوجد</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-0">
              <div className="text-center space-y-4">
                <div className="p-6 bg-destructive/10 rounded-full inline-block">
                  <Trash2 className="h-16 w-16 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-destructive">حذف التصاميم</h3>
                <p className="text-muted-foreground max-w-sm">
                  {assignMode === 'delete_all' 
                    ? `سيتم حذف التصاميم من جميع اللوحات (${taskItems.length} لوحة)`
                    : selectedSize 
                      ? `سيتم حذف التصاميم من لوحات المقاس ${selectedSize} (${getAffectedCount()} لوحة)`
                      : 'اختر المقاس لحذف التصاميم منه'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className="p-4 border-t bg-muted/30 flex items-center gap-3">
          <Button
            onClick={handleAssign}
            disabled={saving || (!isDeleteMode && selectedDesignIds.length === 0) || (assignMode === 'delete_by_size' && !selectedSize)}
            variant={isDeleteMode ? "destructive" : "default"}
            className="flex-1 h-11 text-base font-bold gap-2"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {isDeleteMode ? 'جاري الحذف...' : 'جاري التطبيق...'}
              </>
            ) : isDeleteMode ? (
              <>
                <Trash2 className="h-5 w-5" />
                حذف التصاميم من {getAffectedCount()} لوحة
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                تطبيق على {getAffectedCount()} لوحة
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={saving}
            className="h-11"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}