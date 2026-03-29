import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, Users, Package, MapPin } from 'lucide-react';

interface TransferBillboardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTaskId: string;
  sourceTeamId: string;
  sourceTeamName: string;
  taskItems: any[];
  billboards: Record<number, any>;
  teams: any[];
  contractId: number;
  onSuccess: () => void;
}

export function TransferBillboardsDialog({
  open,
  onOpenChange,
  sourceTaskId,
  sourceTeamId,
  sourceTeamName,
  taskItems,
  billboards,
  teams,
  contractId,
  onSuccess
}: TransferBillboardsDialogProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [transferring, setTransferring] = useState(false);

  // فقط اللوحات غير المكتملة يمكن نقلها
  const pendingItems = useMemo(() => 
    taskItems.filter(item => item.status !== 'completed'),
    [taskItems]
  );

  // الفرق الأخرى (باستثناء الفريق الحالي)
  const otherTeams = useMemo(() => 
    teams.filter(t => t.id !== sourceTeamId),
    [teams, sourceTeamId]
  );

  const handleSelectAll = () => {
    if (selectedItems.length === pendingItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(pendingItems.map(i => i.id));
    }
  };

  const handleTransfer = async () => {
    if (selectedItems.length === 0) {
      toast.error('يرجى تحديد لوحة واحدة على الأقل');
      return;
    }
    if (!targetTeamId) {
      toast.error('يرجى اختيار الفريق المستهدف');
      return;
    }

    setTransferring(true);
    try {
      // التحقق من وجود مهمة للفريق المستهدف لنفس العقد
      const { data: existingTask, error: fetchError } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('team_id', targetTeamId)
        .eq('contract_id', contractId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let targetTaskId: string;

      if (existingTask) {
        // إذا كانت موجودة، نستخدمها
        targetTaskId = existingTask.id;
      } else {
        // إنشاء مهمة جديدة للفريق المستهدف
        const { data: newTask, error: createError } = await supabase
          .from('installation_tasks')
          .insert({
            contract_id: contractId,
            team_id: targetTeamId,
            status: 'pending',
            task_type: 'installation'
          })
          .select('id')
          .single();

        if (createError) throw createError;
        targetTaskId = newTask.id;
      }

      // نقل العناصر المحددة إلى المهمة الجديدة
      const { error: updateError } = await supabase
        .from('installation_task_items')
        .update({ task_id: targetTaskId })
        .in('id', selectedItems);

      if (updateError) throw updateError;

      // التحقق إذا كانت المهمة الأصلية فارغة، نحذفها
      const remainingItems = pendingItems.filter(i => !selectedItems.includes(i.id));
      const completedItems = taskItems.filter(i => i.status === 'completed');
      
      if (remainingItems.length === 0 && completedItems.length === 0) {
        await supabase
          .from('installation_tasks')
          .delete()
          .eq('id', sourceTaskId);
      }

      const targetTeamName = teams.find(t => t.id === targetTeamId)?.team_name || 'الفريق الجديد';
      toast.success(`تم نقل ${selectedItems.length} لوحة إلى ${targetTeamName}`);
      
      setSelectedItems([]);
      setTargetTeamId('');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error transferring billboards:', error);
      toast.error('فشل في نقل اللوحات: ' + error.message);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            نقل لوحات إلى فريق آخر
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* معلومات الفريق الحالي */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">الفريق الحالي:</span>
              <Badge variant="outline">{sourceTeamName}</Badge>
              <span className="text-sm text-muted-foreground">
                · {pendingItems.length} لوحة متاحة للنقل
              </span>
            </div>
          </div>

          {/* اختيار الفريق المستهدف */}
          <div className="space-y-2">
            <Label>نقل إلى فريق</Label>
            <Select value={targetTeamId} onValueChange={setTargetTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفريق المستهدف..." />
              </SelectTrigger>
              <SelectContent>
                {otherTeams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* اختيار اللوحات */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>اختر اللوحات للنقل</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedItems.length === pendingItems.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </Button>
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>لا توجد لوحات متاحة للنقل</p>
                <p className="text-xs">جميع اللوحات مكتملة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-2 border rounded-lg">
                {pendingItems.map(item => {
                  const billboard = billboards[item.billboard_id];
                  const isSelected = selectedItems.includes(item.id);
                  
                  return (
                    <label
                      key={item.id}
                      className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems([...selectedItems, item.id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== item.id));
                          }
                        }}
                        className="mt-1"
                      />
                      
                      {/* صورة اللوحة */}
                      <div className="w-20 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {billboard?.Image_URL ? (
                          <img 
                            src={billboard.Image_URL} 
                            alt={billboard.Billboard_Name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      
                      {/* معلومات اللوحة */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {billboard?.Billboard_Name || `لوحة #${item.billboard_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {billboard?.Size || 'غير محدد'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">
                            {billboard?.Municipality || 'غير محدد'}
                            {billboard?.Nearest_Landmark && ` - ${billboard.Nearest_Landmark}`}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* الأزرار */}
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              محدد: {selectedItems.length} لوحة
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferring || selectedItems.length === 0 || !targetTeamId}
              >
                {transferring ? 'جاري النقل...' : `نقل ${selectedItems.length} لوحة`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
