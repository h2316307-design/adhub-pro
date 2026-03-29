import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Camera, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Layers, Pencil, MapPin, Tag, Check, Square, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { Billboard } from '@/types';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';
import { Badge } from '@/components/ui/badge';

interface AvailableBillboardsGridProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  loading: boolean;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  allowAllSelection?: boolean;
  calculateBillboardPrice?: (billboard: Billboard) => number;
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  pricingCategory?: string;
}

const PAGE_SIZE = 12;

export function AvailableBillboardsGrid({
  billboards,
  selected,
  onToggleSelect,
  loading,
  onSelectAll,
  onClearSelection,
  allowAllSelection = false,
  calculateBillboardPrice,
  pricingMode,
  durationMonths,
  durationDays,
  pricingCategory
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

  // Get status colors
  const getStatusStyle = (isAvailable: boolean, isNearExpiring: boolean, daysUntilExpiry: number | null) => {
    if (isAvailable) {
      return {
        bg: 'bg-green-500',
        text: 'text-white',
        border: 'border-green-500/30',
        glow: 'shadow-green-500/20',
        label: 'متاح'
      };
    }
    if (isNearExpiring) {
      return {
        bg: 'bg-amber-500',
        text: 'text-white',
        border: 'border-amber-500/30',
        glow: 'shadow-amber-500/20',
        label: `${daysUntilExpiry} يوم`
      };
    }
    // Rented - show remaining days if available
    const rentedLabel = daysUntilExpiry !== null && daysUntilExpiry > 0 
      ? `مؤجر • ${daysUntilExpiry} يوم` 
      : 'مؤجر';
    return {
      bg: 'bg-red-500',
      text: 'text-white',
      border: 'border-red-500/30',
      glow: 'shadow-red-500/20',
      label: rentedLabel
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-xl p-4 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
            <Layers className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg">اللوحات المتاحة</h3>
            <p className="text-sm text-muted-foreground">
              {billboards.length} لوحة • {selected.length > 0 && (
                <span className="text-primary font-semibold">{selected.length} محددة</span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Multi-select controls */}
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="h-9 gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <CheckSquare className="h-4 w-4" />
              تحديد الكل
            </Button>
          )}
          {onClearSelection && selected.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="h-9 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Square className="h-4 w-4" />
              إلغاء ({selected.length})
            </Button>
          )}
          
          {totalPages > 1 && (
            <div className="text-sm font-medium bg-muted/50 px-4 py-2 rounded-lg border border-border">
              صفحة {currentPage} من {totalPages}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
              <Layers className="absolute inset-0 m-auto h-5 w-5 text-primary/50" />
            </div>
            <span className="text-lg text-muted-foreground font-medium">جاري تحميل اللوحات...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedBillboards.map((b) => {
              const billboardId = String((b as any).ID);
              const isSelected = selected.includes(billboardId);
              const isAvailable = isBillboardAvailable(b);
              const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
              const daysUntilExpiry = getDaysUntilExpiry(endDate);
              const isNearExpiring = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
              const canSelect = allowAllSelection || isAvailable || isNearExpiring || isSelected;
              const statusStyle = getStatusStyle(isAvailable, isNearExpiring, daysUntilExpiry);
              
              return (
                <Card 
                  key={(b as any).ID}
                  onClick={() => canSelect && onToggleSelect(b as any)}
                  className={cn(
                    "group relative overflow-hidden transition-all duration-300 cursor-pointer",
                    "hover:shadow-xl",
                    !canSelect && "opacity-50 cursor-not-allowed grayscale",
                    isSelected 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl shadow-primary/20 scale-[1.02]" 
                      : "hover:ring-1 hover:ring-primary/30 hover:shadow-lg"
                  )}
                >
                  {/* Image Section */}
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-muted to-muted/50">
                    <BillboardImage
                      billboard={b}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      alt={(b as any).name || (b as any).Billboard_Name}
                    />
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Status Badge */}
                    <Badge 
                      className={cn(
                        "absolute top-3 right-3 px-3 py-1.5 font-bold text-xs shadow-lg",
                        statusStyle.bg, statusStyle.text
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {isAvailable ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isNearExpiring ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {statusStyle.label}
                      </span>
                    </Badge>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="bg-primary rounded-full p-3 shadow-xl animate-in zoom-in duration-200">
                          <Check className="h-8 w-8 text-primary-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Action buttons - appear on hover */}
                    <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button 
                        size="icon" 
                        variant={(b as any).needs_rephotography ? "destructive" : "secondary"}
                        onClick={(e) => handleMarkForRephotography(b as any, e)}
                        className="h-8 w-8 shadow-lg"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => handleQuickEdit(b, e)}
                        className="h-8 w-8 shadow-lg"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Size badge */}
                    {(b as any).Size && (
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-3 left-3 bg-black/60 text-white backdrop-blur-sm border-0"
                      >
                        {(b as any).Size}
                      </Badge>
                    )}
                  </div>

                  {/* Content Section */}
                  <CardContent className="p-4 space-y-3">
                    {/* Billboard name */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-foreground line-clamp-1 flex-1">
                        {(b as any).name || (b as any).Billboard_Name}
                      </h4>
                      {(b as any).Level && (
                        <Badge variant="outline" className="shrink-0 text-xs font-bold border-primary/50 text-primary">
                          {(b as any).Level}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <p className="line-clamp-1">
                        {(b as any).location || (b as any).Nearest_Landmark || 'موقع غير محدد'}
                      </p>
                    </div>
                    
                    {/* City and info */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-medium">
                          {(b as any).city || (b as any).City}
                        </Badge>
                        {(b as any).Municipality && (
                          <Badge variant="outline" className="font-medium">
                            {(b as any).Municipality}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Price */}
                    {(() => {
                      const calculatedPrice = calculateBillboardPrice ? calculateBillboardPrice(b as Billboard) : null;
                      const displayPrice = calculatedPrice && calculatedPrice > 0 ? calculatedPrice : (b as any).Price;
                      const isCalculated = calculatedPrice && calculatedPrice > 0 && calculatedPrice !== (b as any).Price;
                      const durationLabel = pricingMode === 'days' 
                        ? `${durationDays || 0} يوم` 
                        : `${durationMonths || 0} شهر`;
                      
                      if (!displayPrice) return null;
                      return (
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              {isCalculated ? `السعر (${pricingCategory || 'عادي'} - ${durationLabel})` : 'السعر'}
                            </span>
                          </div>
                          <span className={cn("font-bold text-lg", isCalculated ? "text-green-600 dark:text-green-400" : "text-primary")}>
                            {Number(displayPrice).toLocaleString('ar-LY')} 
                            <span className="text-xs font-normal text-muted-foreground mr-1">د.ل</span>
                          </span>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-10 px-4 gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              
              <div className="flex items-center gap-1.5">
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
                      className={cn(
                        "h-10 w-10 p-0 font-bold",
                        currentPage === pageNum && "shadow-md"
                      )}
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
                className="h-10 px-4 gap-2"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
      
      {!loading && billboards.length === 0 && (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4 text-muted-foreground">
            <div className="p-6 rounded-full bg-muted/50">
              <Layers className="h-16 w-16 opacity-30" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-medium">لا توجد لوحات</p>
              <p className="text-sm">لا توجد لوحات تطابق معايير البحث المحددة</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              تعديل سريع - {editingBillboard?.Billboard_Name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>السعر (د.ل)</Label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="السعر"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger className="h-11">
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
            <Button onClick={handleQuickEditSave} className="w-full h-11">
              حفظ التغييرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
