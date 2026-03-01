import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, MapPin, Users, Layers } from 'lucide-react';

interface AddBillboardsToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  contractId: number;
  contractIds?: number[];
  existingBillboardIds: number[];
  onSuccess: () => void;
}

export function AddBillboardsToTaskDialog({
  open,
  onOpenChange,
  taskId,
  contractId,
  contractIds = [],
  existingBillboardIds,
  onSuccess
}: AddBillboardsToTaskDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // العقود المرتبطة بالمهمة
  const allContractIds = useMemo(() => {
    const ids = new Set<number>();
    if (contractId) ids.add(contractId);
    contractIds.forEach(id => ids.add(id));
    return Array.from(ids);
  }, [contractId, contractIds]);

  // جلب بيانات العقود لمعرفة اللوحات
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-add-billboards', allContractIds],
    enabled: open && allContractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids')
        .in('Contract_Number', allContractIds);
      
      if (error) throw error;
      return data;
    }
  });

  // استخراج IDs اللوحات من العقود
  const contractBillboardIds = useMemo(() => {
    const ids = new Set<number>();
    contracts.forEach(c => {
      if (c.billboard_ids) {
        c.billboard_ids.split(',').forEach((id: string) => {
          const num = parseInt(id.trim());
          if (num && !isNaN(num)) ids.add(num);
        });
      }
    });
    return Array.from(ids);
  }, [contracts]);

  // جلب بيانات اللوحات
  const { data: billboards = [], isLoading } = useQuery({
    queryKey: ['billboards-for-add-task', contractBillboardIds],
    enabled: open && contractBillboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, District, Nearest_Landmark')
        .in('ID', contractBillboardIds);
      
      if (error) throw error;
      return data || [];
    }
  });

  // اللوحات غير الموجودة في المهمة حالياً
  const availableBillboards = useMemo(() => {
    return billboards.filter(b => !existingBillboardIds.includes(b.ID));
  }, [billboards, existingBillboardIds]);

  // إضافة اللوحات للمهمة
  const addMutation = useMutation({
    mutationFn: async (billboardIds: number[]) => {
      // جلب عدد الأوجه الفعلي من بيانات اللوحات
      const facesMap: Record<number, number> = {};
      billboards.forEach(b => {
        facesMap[b.ID] = b.Faces_Count || 1;
      });

      const itemsToInsert = billboardIds.map(billboardId => ({
        task_id: taskId,
        billboard_id: billboardId,
        status: 'pending',
        customer_installation_cost: 0,
        faces_to_install: facesMap[billboardId] || 2
      }));

      const { error } = await supabase
        .from('installation_task_items')
        .insert(itemsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`تمت إضافة ${selectedIds.length} لوحة للمهمة`);
      queryClient.invalidateQueries({ queryKey: ['installation-task-items'] });
      setSelectedIds([]);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error adding billboards:', error);
      toast.error('فشل في إضافة اللوحات');
    }
  });

  const handleToggle = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === availableBillboards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableBillboards.map(b => b.ID));
    }
  };

  const handleAdd = () => {
    if (selectedIds.length === 0) {
      toast.error('يرجى اختيار لوحة واحدة على الأقل');
      return;
    }
    addMutation.mutate(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            إضافة لوحات للمهمة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* العقود المرتبطة */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">العقود:</span>
            {allContractIds.map(id => (
              <Badge key={id} variant="outline">#{id}</Badge>
            ))}
          </div>

          {/* إحصائيات */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span>{billboards.length} لوحة في العقد</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{existingBillboardIds.length} موجودة في المهمة</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Plus className="h-4 w-4" />
              <span>{availableBillboards.length} متاحة للإضافة</span>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              جاري التحميل...
            </div>
          ) : availableBillboards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              جميع لوحات العقد موجودة في المهمة بالفعل
            </div>
          ) : (
            <>
              {/* زر تحديد الكل */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.length === availableBillboards.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </Button>
                <Badge variant="secondary">
                  {selectedIds.length} محددة
                </Badge>
              </div>

              {/* قائمة اللوحات */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {availableBillboards.map(billboard => (
                    <div
                      key={billboard.ID}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedIds.includes(billboard.ID) 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggle(billboard.ID)}
                    >
                      <Checkbox
                        checked={selectedIds.includes(billboard.ID)}
                        onCheckedChange={() => handleToggle(billboard.ID)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {billboard.Billboard_Name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{billboard.Size}</span>
                          <span>•</span>
                          <span>{billboard.Faces_Count} وجه</span>
                          {billboard.District && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" />
                                {billboard.District}
                              </span>
                            </>
                          )}
                        </div>
                        {billboard.Nearest_Landmark && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {billboard.Nearest_Landmark}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || addMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
