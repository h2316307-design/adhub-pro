import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MaintenanceForm {
  status: string;
  type: string;
  description: string;
  priority: string;
}

interface MaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBillboard: any;
  setSelectedBillboard: (b: any) => void;
  maintenanceForm: MaintenanceForm;
  setMaintenanceForm: React.Dispatch<React.SetStateAction<MaintenanceForm>>;
  onSubmit: () => Promise<void>;
  loadBillboards: (opts?: any) => Promise<void>;
}

export const MaintenanceDialog: React.FC<MaintenanceDialogProps> = ({
  open,
  onOpenChange,
  selectedBillboard,
  setSelectedBillboard,
  maintenanceForm,
  setMaintenanceForm,
  onSubmit,
  loadBillboards,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            إدارة صيانة اللوحة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {selectedBillboard && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                  <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {selectedBillboard.maintenance_status && selectedBillboard.maintenance_status !== 'operational' && (
                    <Badge variant="outline" className={
                      selectedBillboard.maintenance_status === 'maintenance' ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      selectedBillboard.maintenance_status === 'repair_needed' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' :
                      selectedBillboard.maintenance_status === 'out_of_service' ? 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400' :
                      selectedBillboard.maintenance_status === 'removed' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400' :
                      'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400'
                    }>
                      {selectedBillboard.maintenance_status === 'maintenance' ? 'قيد الصيانة' :
                       selectedBillboard.maintenance_status === 'repair_needed' ? 'تحتاج إصلاح' :
                       selectedBillboard.maintenance_status === 'out_of_service' ? 'خارج الخدمة' :
                       selectedBillboard.maintenance_status === 'removed' ? 'تمت الإزالة' :
                       selectedBillboard.maintenance_status}
                    </Badge>
                  )}
                  {selectedBillboard.maintenance_priority && selectedBillboard.maintenance_priority !== 'normal' && (
                    <Badge className={
                      selectedBillboard.maintenance_priority === 'low' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      selectedBillboard.maintenance_priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      selectedBillboard.maintenance_priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      ''
                    }>
                      {selectedBillboard.maintenance_priority === 'low' ? 'منخفضة' :
                       selectedBillboard.maintenance_priority === 'high' ? 'عالية' :
                       selectedBillboard.maintenance_priority === 'urgent' ? 'عاجلة' : ''}
                    </Badge>
                  )}
                </div>
              </div>
              {selectedBillboard.maintenance_type && (
                <p className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                  {selectedBillboard.maintenance_type}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maintenance-status">حالة الصيانة *</Label>
              <Select
                value={maintenanceForm.status}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">تعمل بشكل طبيعي</SelectItem>
                  <SelectItem value="maintenance">قيد الصيانة</SelectItem>
                  <SelectItem value="repair_needed">تحتاج إصلاح</SelectItem>
                  <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
                  <SelectItem value="لم يتم التركيب">لم يتم التركيب</SelectItem>
                  <SelectItem value="متضررة اللوحة">متضررة اللوحة</SelectItem>
                  <SelectItem value="تحتاج ازالة لغرض التطوير">تحتاج ازالة للتطوير</SelectItem>
                  <SelectItem value="removed">تمت الإزالة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-type">ملاحظات الصيانة</Label>
            <input
              id="maintenance-type"
              list="maintenance-suggestions"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="اكتب أو اختر من المتاح..."
              value={maintenanceForm.type}
              onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))}
            />
            <datalist id="maintenance-suggestions">
              <option value="صيانة دورية" />
              <option value="إصلاح" />
              <option value="تنظيف" />
              <option value="استبدال اللوحة" />
              <option value="قص اللوحة" />
              <option value="لم يتم التركيب" />
              <option value="تحتاج إزالة" />
              <option value="إزالة للتطوير" />
              <option value="تمت الإزالة" />
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف تفصيلي (اختياري)</Label>
            <Textarea
              id="description"
              className="min-h-[60px]"
              placeholder="اكتب وصف تفصيلي للمشكلة أو الصيانة..."
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* زر إخفاء من المتاح */}
          {selectedBillboard && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex flex-col">
                <span className="text-sm font-medium">إخفاء من اللوحات المتاحة</span>
                <span className="text-xs text-muted-foreground">
                  {selectedBillboard.is_visible_in_available === false 
                    ? 'اللوحة مخفية حالياً' 
                    : 'اللوحة ظاهرة في المتاح'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selectedBillboard.is_visible_in_available === false ? "default" : "destructive"}
                onClick={async () => {
                  const newValue = selectedBillboard.is_visible_in_available === false ? true : false;
                  try {
                    const { error } = await supabase
                      .from('billboards')
                      .update({ is_visible_in_available: newValue })
                      .eq('ID', selectedBillboard.ID);
                    
                    if (error) throw error;
                    
                    toast.success(newValue ? 'تم إظهار اللوحة في المتاح' : 'تم إخفاء اللوحة من المتاح');
                    setSelectedBillboard({ ...selectedBillboard, is_visible_in_available: newValue });
                    loadBillboards({ silent: true });
                  } catch (error) {
                    toast.error('فشل في تحديث حالة الإظهار');
                  }
                }}
              >
                {selectedBillboard.is_visible_in_available === false ? 'إظهار' : 'إخفاء'}
              </Button>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={onSubmit} className="flex-1">
              حفظ التغييرات
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
