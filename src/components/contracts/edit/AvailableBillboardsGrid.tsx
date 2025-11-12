import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Billboard } from '@/types';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';

interface AvailableBillboardsGridProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  loading: boolean;
}

export function AvailableBillboardsGrid({
  billboards,
  selected,
  onToggleSelect,
  loading
}: AvailableBillboardsGridProps) {
  // ✅ دالة لوضع علامة على اللوحة أنها تحتاج إعادة تصوير
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

      toast.success(newStatus ? 'تم إضافة اللوحة لقائمة إعادة التصوير' : 'تم إزالة اللوحة من قائمة إعادة التصوير');
      
      // تحديث الحالة المحلية
      (billboard as any).needs_rephotography = newStatus;
      
      // إعادة تحميل الصفحة لتحديث البيانات
      window.location.reload();
    } catch (error) {
      console.error('Error updating rephotography status:', error);
      toast.error('فشل في تحديث حالة إعادة التصوير');
    }
  };

  console.log(`📊 AvailableBillboardsGrid: Displaying ${billboards.length} billboards, ${selected.length} selected`);

  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-card-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المتاحة
          </div>
          <div className="px-4 py-1.5 bg-primary/10 text-primary rounded-full font-bold text-sm">
            {billboards.length} لوحة
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              جاري التحميل...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billboards.map((b) => {
              const billboardId = String((b as any).ID);
              const isSelected = selected.includes(billboardId);
              
              // ✅ استخدام دالة isBillboardAvailable من contractUtils للتحقق من التوفر
              const isAvailable = isBillboardAvailable(b);
              
              // ✅ تحديد ما إذا كانت اللوحة قريبة من الانتهاء (30 يوم)
              const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
              const daysUntilExpiry = getDaysUntilExpiry(endDate);
              const isNearExpiring = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

              // ✅ يمكن اختيار اللوحة إذا كانت متاحة، أو قريبة من الانتهاء، أو مختارة بالفعل
              const canSelect = isAvailable || isNearExpiring || isSelected;
              
              // ✅ Log for debugging
              if (billboardId === '489') {
                console.log(`🔍 Billboard 489 status:`, {
                  isAvailable,
                  isNearExpiring,
                  daysUntilExpiry,
                  canSelect,
                  isSelected,
                  endDate
                });
              }
              
              return (
                <Card 
                  key={(b as any).ID} 
                  className={`
                    bg-card/80 border-border transition-all duration-300
                    ${!canSelect ? 'opacity-60' : 'hover:border-primary/50'} 
                    ${isSelected ? 'border-primary bg-primary/10' : ''}
                  `}
                >
                  <CardContent className="p-0">
                    {((b as any).Image_URL || (b as any).image) && (
                      <img 
                        src={(b as any).Image_URL || (b as any).image} 
                        alt={(b as any).name || (b as any).Billboard_Name} 
                        className="w-full h-40 object-cover rounded-t-lg" 
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                          e.currentTarget.classList.add('opacity-50');
                        }}
                      />
                    )}
                    {!((b as any).Image_URL || (b as any).image) && (
                      <div className="w-full h-40 bg-muted flex items-center justify-center rounded-t-lg">
                        <span className="text-muted-foreground text-sm">لا توجد صورة</span>
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="font-semibold text-card-foreground">
                        {(b as any).name || (b as any).Billboard_Name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(b as any).location || (b as any).Nearest_Landmark}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(b as any).city || (b as any).City} • {(b as any).size || (b as any).Size}
                      </div>
                      <div className="text-sm text-primary font-medium">
                        {(Number((b as any).price) || 0).toLocaleString('ar-LY')} د.ل / شهر
                      </div>
                      
                      {/* عرض حالة اللوحة */}
                      <div className="flex items-center gap-2 text-xs">
                        {isAvailable && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                            متاحة
                          </span>
                        )}
                        {isNearExpiring && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                            قريبة الانتهاء
                          </span>
                        )}
                        {!isAvailable && !isNearExpiring && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                            مؤجرة
                          </span>
                        )}
                      </div>
                      
                      <div className="pt-2 flex gap-2">
                        <Button 
                          size="sm" 
                          variant={isSelected ? 'destructive' : 'outline'} 
                          onClick={() => onToggleSelect(b as any)} 
                          disabled={!canSelect}
                          className="flex-1"
                        >
                          {isSelected ? 'إزالة' : 'إضافة'}
                        </Button>
                        
                        {/* زر إعادة التصوير */}
                        <Button 
                          size="sm" 
                          variant={(b as any).needs_rephotography ? "destructive" : "outline"}
                          onClick={(e) => handleMarkForRephotography(b as any, e)}
                          title={(b as any).needs_rephotography ? "إزالة من قائمة إعادة التصوير" : "إضافة لقائمة إعادة التصوير"}
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {!loading && billboards.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            لا توجد لوحات تطابق معايير البحث
          </div>
        )}
      </CardContent>
    </Card>
  );
}