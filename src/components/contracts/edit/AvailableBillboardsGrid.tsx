import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Camera, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Layers, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { Billboard } from '@/types';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';

interface AvailableBillboardsGridProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  loading: boolean;
}

const PAGE_SIZE = 12;

export function AvailableBillboardsGrid({
  billboards,
  selected,
  onToggleSelect,
  loading
}: AvailableBillboardsGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<any>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editLevel, setEditLevel] = useState<string>('');

  // جلب مستويات اللوحات
  const { data: levels = [] } = useQuery({
    queryKey: ['billboard-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('level_code, level_name')
        .order('level_code');
      if (error) throw error;
      return data || [];
    }
  });

  const handleQuickEdit = (billboard: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBillboard(billboard);
    setEditPrice(String(billboard.Price || ''));
    setEditLevel(billboard.Level || '');
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async () => {
    if (!editingBillboard) return;
    
    try {
      const { error } = await supabase
        .from('billboards')
        .update({
          Price: editPrice ? Number(editPrice) : null,
          Level: editLevel || null
        })
        .eq('ID', editingBillboard.ID);

      if (error) throw error;
      
      toast.success('تم تحديث اللوحة بنجاح');
      setQuickEditOpen(false);
      setEditingBillboard(null);
      window.location.reload();
    } catch (error) {
      console.error('Error updating billboard:', error);
      toast.error('فشل في التحديث');
    }
  };
  
  const handleMarkForRephotography = async (billboard: Billboard, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('billboards')
        .update({ needs_rephotography: newStatus })
        .eq('ID', (billboard as any).ID);

      if (error) throw error;

      toast.success(newStatus ? 'تمت الإضافة لقائمة إعادة التصوير' : 'تمت الإزالة من القائمة');
      (billboard as any).needs_rephotography = newStatus;
      window.location.reload();
    } catch (error) {
      console.error('Error updating rephotography status:', error);
      toast.error('فشل في التحديث');
    }
  };

  const totalPages = Math.ceil(billboards.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pagedBillboards = billboards.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">اللوحات المتاحة</h3>
            <p className="text-xs text-muted-foreground">{billboards.length} لوحة متاحة</p>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {currentPage} / {totalPages}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-flex items-center gap-3 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="text-lg">جاري التحميل...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedBillboards.map((b) => {
              const billboardId = String((b as any).ID);
              const isSelected = selected.includes(billboardId);
              const isAvailable = isBillboardAvailable(b);
              const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
              const daysUntilExpiry = getDaysUntilExpiry(endDate);
              const isNearExpiring = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
              const canSelect = isAvailable || isNearExpiring || isSelected;
              
              return (
                <div 
                  key={(b as any).ID}
                  onClick={() => canSelect && onToggleSelect(b as any)}
                  className={cn(
                    "group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer",
                    "border-2 bg-card",
                    !canSelect && "opacity-50 cursor-not-allowed",
                    isSelected 
                      ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                      : "border-border hover:border-primary/50 hover:shadow-md"
                  )}
                >
                  {/* Image */}
                  <div className="relative h-32 overflow-hidden">
                    <BillboardImage
                      billboard={b}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      alt={(b as any).name || (b as any).Billboard_Name}
                    />
                    
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      {isAvailable ? (
                        <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-full flex items-center gap-1 shadow-lg">
                          <CheckCircle2 className="h-3 w-3" />
                          متاح
                        </span>
                      ) : isNearExpiring ? (
                        <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-full flex items-center gap-1 shadow-lg">
                          <Clock className="h-3 w-3" />
                          {daysUntilExpiry} يوم
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full flex items-center gap-1 shadow-lg">
                          <XCircle className="h-3 w-3" />
                          مؤجر
                        </span>
                      )}
                    </div>

                    {/* Selected Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-lg" />
                      </div>
                    )}

                    {/* Rephotography Button */}
                    <Button 
                      size="sm" 
                      variant={(b as any).needs_rephotography ? "destructive" : "secondary"}
                      onClick={(e) => handleMarkForRephotography(b as any, e)}
                      className="absolute top-2 left-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-foreground truncate flex-1">
                        {(b as any).name || (b as any).Billboard_Name}
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleQuickEdit(b, e)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {(b as any).location || (b as any).Nearest_Landmark}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {(b as any).city || (b as any).City} • {(b as any).size || (b as any).Size}
                      </span>
                      {(b as any).Level && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                          {(b as any).Level}
                        </span>
                      )}
                    </div>
                    {(b as any).Price && (
                      <div className="text-xs font-semibold text-primary">
                        {Number((b as any).Price).toLocaleString('ar-LY')} د.ل
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
      
      {!loading && billboards.length === 0 && (
        <div className="py-16 text-center">
          <div className="inline-flex flex-col items-center gap-3 text-muted-foreground">
            <Layers className="h-12 w-12 opacity-30" />
            <p className="text-lg">لا توجد لوحات تطابق معايير البحث</p>
          </div>
        </div>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل سريع - {editingBillboard?.Billboard_Name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>السعر (د.ل)</Label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="السعر"
              />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level: any) => (
                    <SelectItem key={level.level_code} value={level.level_code}>
                      {level.level_code} - {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleQuickEditSave} className="w-full">
              حفظ التغييرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
