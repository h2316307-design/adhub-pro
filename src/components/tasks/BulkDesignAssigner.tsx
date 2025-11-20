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
import { Layers, Grid3x3, Ruler, Shuffle } from 'lucide-react';

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

type AssignMode = 'all' | 'by_size' | 'distribute' | 'manual';

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

  // استخراج المقاسات الفريدة
  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    taskItems.forEach(item => {
      if (item.billboards?.Size) {
        sizes.add(item.billboards.Size);
      }
    });
    return Array.from(sizes).sort();
  }, [taskItems]);

  const handleAssign = async () => {
    if (selectedDesignIds.length === 0) {
      toast.error('يرجى اختيار تصميم واحد على الأقل');
      return;
    }

    setSaving(true);
    try {
      let itemsToUpdate: TaskItem[] = [];

      switch (assignMode) {
        case 'all':
          // تعيين التصميم الأول لكل اللوحات
          itemsToUpdate = taskItems;
          break;

        case 'by_size':
          // تعيين التصميم للوحات ذات مقاس معين
          if (!selectedSize) {
            toast.error('يرجى اختيار المقاس');
            return;
          }
          itemsToUpdate = taskItems.filter(
            item => item.billboards?.Size === selectedSize
          );
          break;

        case 'distribute':
          // توزيع التصاميم بالتساوي
          itemsToUpdate = taskItems;
          break;

        case 'manual':
          // تعيين يدوي للوحات المختارة
          if (selectedBillboardIds.size === 0) {
            toast.error('يرجى اختيار لوحة واحدة على الأقل');
            return;
          }
          itemsToUpdate = taskItems.filter(item =>
            selectedBillboardIds.has(item.id)
          );
          break;
      }

      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لتحديث التصميم لها');
        return;
      }

      // تطبيق التصاميم
      if (assignMode === 'distribute' && selectedDesignIds.length > 1) {
        // توزيع متساوي لعدة تصاميم
        const itemsPerDesign = Math.ceil(itemsToUpdate.length / selectedDesignIds.length);
        
        for (let i = 0; i < itemsToUpdate.length; i++) {
          const designIndex = Math.floor(i / itemsPerDesign);
          const designId = selectedDesignIds[Math.min(designIndex, selectedDesignIds.length - 1)];
          
          const { error } = await supabase
            .from('installation_task_items')
            .update({ selected_design_id: designId })
            .eq('id', itemsToUpdate[i].id);

          if (error) throw error;
        }
      } else {
        // تعيين نفس التصميم لكل اللوحات المختارة
        const designId = selectedDesignIds[0];
        
        for (const item of itemsToUpdate) {
          const { error } = await supabase
            .from('installation_task_items')
            .update({ selected_design_id: designId })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            توزيع التصاميم على اللوحات
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* طريقة التعيين */}
            <div className="space-y-3">
              <Label className="text-base font-bold">طريقة التعيين</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={assignMode === 'all' ? 'default' : 'outline'}
                  onClick={() => setAssignMode('all')}
                  className="justify-start gap-2"
                >
                  <Grid3x3 className="h-4 w-4" />
                  كل اللوحات
                </Button>
                <Button
                  type="button"
                  variant={assignMode === 'by_size' ? 'default' : 'outline'}
                  onClick={() => setAssignMode('by_size')}
                  className="justify-start gap-2"
                >
                  <Ruler className="h-4 w-4" />
                  حسب المقاس
                </Button>
                <Button
                  type="button"
                  variant={assignMode === 'distribute' ? 'default' : 'outline'}
                  onClick={() => setAssignMode('distribute')}
                  className="justify-start gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  توزيع متساوي
                </Button>
                <Button
                  type="button"
                  variant={assignMode === 'manual' ? 'default' : 'outline'}
                  onClick={() => setAssignMode('manual')}
                  className="justify-start gap-2"
                >
                  <Checkbox className="h-4 w-4" />
                  اختيار يدوي
                </Button>
              </div>
            </div>

            {/* اختيار المقاس (إذا كانت الطريقة حسب المقاس) */}
            {assignMode === 'by_size' && (
              <div className="space-y-2">
                <Label>اختر المقاس</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المقاس..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueSizes.map(size => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* اختيار اللوحات يدوياً */}
            {assignMode === 'manual' && (
              <div className="space-y-2">
                <Label>اختر اللوحات ({selectedBillboardIds.size} محددة)</Label>
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="space-y-2">
                    {taskItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => toggleBillboardSelection(item.id)}
                      >
                        <Checkbox
                          checked={selectedBillboardIds.has(item.id)}
                          onCheckedChange={() => toggleBillboardSelection(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.billboards?.Billboard_Name || `لوحة #${item.billboard_id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.billboards?.Size}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* اختيار التصاميم */}
            <div className="space-y-3">
              <Label className="text-base font-bold">
                اختر التصاميم ({selectedDesignIds.length} محددة)
                {assignMode === 'distribute' && selectedDesignIds.length > 1 && (
                  <span className="text-xs text-muted-foreground mr-2">
                    سيتم التوزيع بالتساوي
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {taskDesigns.map(design => (
                  <div
                    key={design.id}
                    onClick={() => {
                      if (assignMode === 'distribute') {
                        toggleDesignSelection(design.id);
                      } else {
                        setSelectedDesignIds([design.id]);
                      }
                    }}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDesignIds.includes(design.id)
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={selectedDesignIds.includes(design.id)}
                        onCheckedChange={() => {
                          if (assignMode === 'distribute') {
                            toggleDesignSelection(design.id);
                          } else {
                            setSelectedDesignIds([design.id]);
                          }
                        }}
                      />
                      <p className="font-semibold text-sm truncate flex-1">
                        {design.design_name}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground text-center">الوجه الأمامي</p>
                        <div className="aspect-video rounded-md overflow-hidden bg-muted border">
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
                      {design.design_face_b_url && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground text-center">الوجه الخلفي</p>
                          <div className="aspect-video rounded-md overflow-hidden bg-muted border">
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* معاينة النتيجة */}
            {selectedDesignIds.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border border-primary/20">
                <p className="text-sm font-medium mb-2">معاينة التطبيق:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {assignMode === 'all' && (
                    <p>✓ سيتم تعيين التصميم لكل اللوحات ({taskItems.length} لوحة)</p>
                  )}
                  {assignMode === 'by_size' && selectedSize && (
                    <p>
                      ✓ سيتم تعيين التصميم للوحات مقاس {selectedSize} (
                      {taskItems.filter(i => i.billboards?.Size === selectedSize).length} لوحة)
                    </p>
                  )}
                  {assignMode === 'distribute' && selectedDesignIds.length > 1 && (
                    <p>
                      ✓ سيتم توزيع {selectedDesignIds.length} تصاميم على {taskItems.length} لوحة بالتساوي
                      (تقريباً {Math.ceil(taskItems.length / selectedDesignIds.length)} لوحة لكل تصميم)
                    </p>
                  )}
                  {assignMode === 'manual' && (
                    <p>✓ سيتم تعيين التصميم لـ {selectedBillboardIds.size} لوحة محددة</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleAssign}
            disabled={saving || selectedDesignIds.length === 0}
            className="flex-1"
          >
            {saving ? 'جاري التطبيق...' : 'تطبيق التصاميم'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={saving}
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
