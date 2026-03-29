import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Link, Unlink, Trash2, ExternalLink, Camera, Wrench } from 'lucide-react';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardCardActionsProps {
  billboard: Billboard;
  hasContract: boolean;
  canEdit: boolean;
  onEdit: (billboard: Billboard) => void;
  onContractAction: (billboard: Billboard) => void;
  onDelete: (id: number | string) => void;
  onMaintenance: (billboard: Billboard) => void;
  onUpdate: () => void;
}

export const BillboardCardActions: React.FC<BillboardCardActionsProps> = ({
  billboard,
  hasContract,
  canEdit,
  onEdit,
  onContractAction,
  onDelete,
  onMaintenance,
  onUpdate,
}) => {
  const billboardId = (billboard as any).ID || (billboard as any).id;

  const handleOpenLocation = () => {
    const coords = billboard.GPS_Coordinates || (billboard as any).gps_coordinates || null;
    if (!coords) {
      toast.error('لا توجد إحداثيات جغرافية لهذه اللوحة');
      return;
    }
    const coordStr = String(coords).trim().replace(/\s+/g, ' ');
    const match = coordStr.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (!match) {
      toast.error('تنسيق الإحداثيات غير صحيح');
      return;
    }
    window.open(`https://maps.google.com/?q=${match[1]},${match[3]}`, '_blank', 'noopener,noreferrer');
  };

  const handleToggleRephotography = async () => {
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('billboards')
        // @ts-ignore
        .update({ needs_rephotography: newStatus })
        .eq('ID', billboardId);
      if (error) throw error;
      toast.success(newStatus ? 'تم إضافة اللوحة لقائمة إعادة التصوير' : 'تم إزالة اللوحة من قائمة إعادة التصوير');
      onUpdate();
    } catch {
      toast.error('فشل في تحديث حالة إعادة التصوير');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canEdit && (
          <>
            <DropdownMenuItem onClick={() => onEdit(billboard)} className="cursor-pointer gap-2">
              <Edit className="h-4 w-4 text-blue-500" />
              تعديل
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onContractAction(billboard)} 
              className="cursor-pointer gap-2"
            >
              {hasContract ? (
                <>
                  <Unlink className="h-4 w-4 text-amber-500" />
                  إزالة من العقد
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 text-emerald-500" />
                  إضافة لعقد
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleOpenLocation} className="cursor-pointer gap-2">
          <ExternalLink className="h-4 w-4 text-sky-500" />
          فتح الموقع
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuItem onClick={handleToggleRephotography} className="cursor-pointer gap-2">
              <Camera className="h-4 w-4 text-violet-500" />
              {(billboard as any).needs_rephotography ? 'إلغاء التصوير' : 'إعادة تصوير'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMaintenance(billboard)} className="cursor-pointer gap-2">
              <Wrench className="h-4 w-4 text-amber-500" />
              صيانة
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(billboardId)} 
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              حذف
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
