import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Copy, Edit, Link, Unlink, Trash2, ExternalLink, Camera, Wrench, Settings, AlertTriangle, Sparkles, CalendarPlus } from 'lucide-react';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardStatusDialog } from './BillboardStatusDialog';

interface BillboardCardActionsProps {
  billboard: Billboard;
  hasContract: boolean;
  canEdit: boolean;
  onEdit: (billboard: Billboard) => void;
  onContractAction: (billboard: Billboard) => void;
  onDelete: (id: number | string) => void;
  onMaintenance: (billboard: Billboard) => void;
  onUpdate: () => void;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
  onOpenOverlayEditor?: (billboard: Billboard) => void;
  onExtendRental?: (billboard: Billboard) => void;
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
  onLocalUpdate,
  onOpenOverlayEditor,
  onExtendRental,
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
      if (onLocalUpdate) {
        onLocalUpdate(billboardId, { needs_rephotography: newStatus });
      } else {
        onUpdate();
      }
    } catch {
      toast.error('فشل في تحديث حالة إعادة التصوير');
    }
  };

  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <>
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="خيارات اللوحة"
          title="خيارات اللوحة"
          onClick={event => event.stopPropagation()}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-background text-muted-foreground transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-72 max-w-[calc(100vw-24px)] max-h-[75vh] overflow-y-auto rounded-xl p-1.5 text-right [&_[role=menuitem]]:min-h-10 [&_[role=menuitem]]:rounded-md [&_[role=menuitem]]:text-xs [&_[role=menuitem]]:transition-all [&_[role=menuitem]]:duration-200">
        <DropdownMenuLabel className="px-2 py-2"><span className="block text-xs font-semibold">{billboard.Billboard_Name || `لوحة #${billboardId}`}</span><span className="mt-1 block text-[11px] font-normal text-muted-foreground">{hasContract ? 'مرتبطة بعقد' : 'بدون عقد'}</span></DropdownMenuLabel>
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(billboard.Billboard_Name || String(billboardId)); toast.success('تم نسخ اسم اللوحة'); }} className="cursor-pointer gap-2"><Copy className="h-4 w-4 text-primary" />نسخ اسم اللوحة</DropdownMenuItem>
        <DropdownMenuSeparator />
        {canEdit && (
          <>
            <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">بيانات اللوحة والعقد</DropdownMenuLabel>
            {onOpenOverlayEditor && (
              <DropdownMenuItem onClick={() => onOpenOverlayEditor(billboard)} className="cursor-pointer gap-2 text-foreground focus:bg-primary/10">
                <Sparkles className="h-4 w-4 text-amber-500" />
                تعديل صورة اللوحة والتراكب
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(billboard)} className="cursor-pointer gap-2">
              <Edit className="h-4 w-4 text-primary" />
              تعديل بيانات اللوحة
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
            {hasContract && onExtendRental && (
              <DropdownMenuItem onClick={() => onExtendRental(billboard)} className="cursor-pointer gap-2">
                <CalendarPlus className="h-4 w-4 text-emerald-600" />
                تمديد اللوحة
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">الموقع والمتابعة</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleOpenLocation} className="cursor-pointer gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          فتح الموقع
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuItem onClick={handleToggleRephotography} className="cursor-pointer gap-2">
              <Camera className="h-4 w-4 text-primary" />
              {(billboard as any).needs_rephotography ? 'إلغاء طلب إعادة التصوير' : 'إعادة تصوير'}
            </DropdownMenuItem>
            {hasContract && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  // أغلق القائمة المنسدلة أولاً ثم افتح الحوار في tick جديد
                  // لتفادي تجمّد pointer-events:none على body من Radix
                  setTimeout(() => setStatusOpen(true), 0);
                }}
                className="cursor-pointer gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-red-500" />
                تسجيل حالة اللوحة
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onMaintenance(billboard)} className="cursor-pointer gap-2">
              <Wrench className="h-4 w-4 text-amber-500" />
              إدارة صيانة اللوحة
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(billboardId)} 
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              حذف اللوحة
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <BillboardStatusDialog open={statusOpen} onOpenChange={setStatusOpen} billboard={billboard} onLocalUpdate={onLocalUpdate} />
    </>
  );
};
