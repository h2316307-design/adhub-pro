import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, X, Wrench, Camera } from 'lucide-react';
import type { Billboard } from '@/types';
import { BillboardImage } from '@/components/BillboardImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardSelectorProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  onRemoveSelected: (id: string) => void;
  loading: boolean;
  /** عند true يسمح بحجز أي لوحة (للعروض) */
  isForOffer?: boolean;
  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
  sizeFilter: string;
  setSizeFilter: (size: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  pricingCategory: string;
  setPricingCategory: (category: string) => void;
  pricingCategories: string[];
  // Pricing calculations
  calculateBillboardPrice: (billboard: Billboard) => number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
  pricingMode: 'months' | 'days';
  durationMonths: number;
  durationDays: number;
  currencySymbol?: string;
}

export const BillboardSelector: React.FC<BillboardSelectorProps> = ({
  billboards,
  selected,
  onToggleSelect,
  onRemoveSelected,
  loading,
  isForOffer = false,
  searchQuery,
  setSearchQuery,
  cityFilter,
  setCityFilter,
  sizeFilter,
  setSizeFilter,
  statusFilter,
  setStatusFilter,
  pricingCategory,
  setPricingCategory,
  pricingCategories,
  calculateBillboardPrice,
  installationDetails,
  pricingMode,
  durationMonths,
  durationDays,
  currencySymbol = 'د.ل'
}) => {
  const [allSizes, setAllSizes] = useState<string[]>([]);

  // جلب جميع المقاسات من قاعدة البيانات
  useEffect(() => {
    const loadSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order');
      
      if (!error && data) {
        setAllSizes(data.map(s => s.name).filter(Boolean));
      }
    };
    loadSizes();
  }, []);

  // دالة لوضع علامة على اللوحة أنها تحتاج إعادة تصوير
  const handleMarkForRephotography = async (billboard: Billboard, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('billboards')
        // @ts-ignore - needs_rephotography field exists in database
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

  // Derive cities from billboards
  const cities = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.city || (b as any).City))).filter(Boolean) as string[],
    [billboards]
  );
  
  // استخدام المقاسات من قاعدة البيانات مع إضافة أي مقاسات موجودة في اللوحات
  const sizes = useMemo(() => {
    const sizeSet = new Set<string>(allSizes);
    billboards.forEach(b => {
      const size = b.size || (b as any).Size;
      if (size) sizeSet.add(size);
    });
    return [...allSizes, ...Array.from(sizeSet).filter(s => !allSizes.includes(s))];
  }, [billboards, allSizes]);

  // Filter billboards
  const filtered = useMemo(() => {
    const today = new Date();
    const NEAR_DAYS = 3;

    const getRentDaysLeft = (b: any): number | null => {
      const raw = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || b['End Date'];
      if (!raw) return null;
      const end = new Date(raw);
      if (isNaN(end.getTime())) return null;
      return Math.ceil((end.getTime() - today.getTime()) / 86400000);
    };

    const isNearExpiring = (b: any) => {
      const diff = getRentDaysLeft(b);
      return diff !== null && diff > 0 && diff <= NEAR_DAYS;
    };

    /** اللوحة انتهى عقدها لكن لم تُحدَّث حالتها بعد */
    const isExpiredRental = (b: any) => {
      const diff = getRentDaysLeft(b);
      return diff !== null && diff <= 0;
    };

    const list = billboards.filter((b: any) => {
      const text = b.name || b.Billboard_Name || '';
      const loc = b.location || b.Nearest_Landmark || '';
      const c = String(b.city || b.City || '');
      const s = String(b.size || b.Size || '');
      const st = String(b.status || b.Status || '').toLowerCase();

      const matchesQ = !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase()) || loc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesSize = sizeFilter === 'all' || s === sizeFilter;

      // في العروض نعرض كل اللوحات
      if (isForOffer) return matchesQ && matchesCity && matchesSize;

      const hasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const isAvailable = st === 'available' || (!hasContract && st !== 'rented') || isExpiredRental(b);
      const isNear = isNearExpiring(b);
      const isRented = (hasContract || st === 'rented') && !isExpiredRental(b);
      const isInContract = selected.includes(String(b.ID));

      let shouldShow = false;
      if (statusFilter === 'all') {
        shouldShow = true;
      } else if (statusFilter === 'available') {
        shouldShow = (isAvailable && !isRented) || isNear || isInContract;
      } else if (statusFilter === 'rented') {
        shouldShow = isRented && !isNear;
      }

      return matchesQ && matchesCity && matchesSize && shouldShow;
    });

    return list.sort((a: any, b: any) => {
      const aHasContract = !!(a.contractNumber || a.Contract_Number || a.contract_number);
      const bHasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const aStatus = (a.status || a.Status || '').toLowerCase();
      const bStatus = (b.status || b.Status || '').toLowerCase();
      
      const aAvailable = aStatus === 'available' || (!aHasContract && aStatus !== 'rented');
      const bAvailable = bStatus === 'available' || (!bHasContract && bStatus !== 'rented');
      
      const aNear = isNearExpiring(a);
      const bNear = isNearExpiring(b);
      
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;
      
      return 0;
    }).slice(0, 20);
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter, selected]);

  return (
    <div className="flex-1 space-y-6">
      {/* Selected Billboards */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المرتبطة ({selected.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selected.length === 0 ? (
            <p className="text-primary">لا توجد لوحات</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {billboards.filter((b) => selected.includes(String((b as any).ID))).map((b) => {
                const totalForBoard = calculateBillboardPrice(b);
                const installDetail = installationDetails.find(detail => detail.billboardId === String((b as any).ID));
                const installPrice = installDetail?.installationPrice || 0;

                return (
                  <Card key={(b as any).ID} className="card-hover">
                    <CardContent className="p-0">
                      <BillboardImage
                        billboard={b}
                        className="w-full h-36 object-cover rounded-t-lg"
                        alt={(b as any).name || (b as any).Billboard_Name}
                      />
                      <div className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{(b as any).name || (b as any).Billboard_Name}</div>
                          <div className="text-xs text-muted-foreground mb-1">
                            📍 {(b as any).location || (b as any).Nearest_Landmark}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            الحجم: {(b as any).size || (b as any).Size} • {(b as any).city || (b as any).City}
                          </div>
                          <div className="text-xs font-medium mt-1 space-y-1">
                            <div className="price-text">الإيجار: {totalForBoard.toLocaleString('ar-LY')} {currencySymbol} {pricingMode === 'months' ? `/${durationMonths} شهر` : `/${durationDays} يوم`}</div>
                            {installPrice > 0 && (
                              <div className="flex items-center gap-1 installation-cost">
                                <Wrench className="h-3 w-3" />
                                التركيب: {installPrice.toLocaleString('ar-LY')} {currencySymbol}
                                {installDetail?.faces === 1 && (
                                  <span className="text-xs badge-orange">وجه واحد</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => onRemoveSelected(String((b as any).ID))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 relative min-w-[220px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <Input placeholder="بحث عن لوحة" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="المدينة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المدن</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="المقاس" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المقاسات</SelectItem>
                {sizes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="available">المتاحة فقط</SelectItem>
                <SelectItem value="rented">المؤجرة فقط</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pricingCategory} onValueChange={setPricingCategory}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="فئة السعر" /></SelectTrigger>
              <SelectContent>
                {pricingCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Available Billboards Grid */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المتاحة ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((b) => {
                const isSelected = selected.includes(String((b as any).ID));
                
                // في العروض يمكن اختيار أي لوحة
                if (isForOffer) {
                  const canSelect = true;
                  return (
                    <Card key={(b as any).ID} className={`card-hover ${isSelected ? 'card-selected' : ''}`}>
                      <CardContent className="p-0">
                        <BillboardImage billboard={b} className="w-full h-40 object-cover rounded-t-lg" alt={(b as any).name || (b as any).Billboard_Name} />
                        <div className="p-3 space-y-1">
                          <div className="font-semibold">{(b as any).name || (b as any).Billboard_Name}</div>
                          <div className="text-xs text-primary">{(b as any).location || (b as any).Nearest_Landmark}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                const st = ((b as any).status || (b as any).Status || '').toString().toLowerCase();
                const hasContract = !!(b as any).contractNumber || !!(b as any).Contract_Number || !!(b as any).contract_number;
                
                const today = new Date();
                const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
                const daysLeft = endDate ? (() => {
                  const end = new Date(endDate);
                  if (isNaN(end.getTime())) return null;
                  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
                })() : null;
                
                const isExpired = daysLeft !== null && daysLeft <= 0;
                const isNearExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
                const isAvailable = st === 'available' || (!hasContract && st !== 'rented') || isExpired;

                const canSelect = isAvailable || isNearExpiring || isSelected;
                
                return (
                  <Card key={(b as any).ID} className={`card-hover ${!canSelect ? 'opacity-60' : ''} ${isSelected ? 'card-selected' : ''}`}>
                    <CardContent className="p-0">
                      <BillboardImage
                        billboard={b}
                        className="w-full h-40 object-cover rounded-t-lg"
                        alt={(b as any).name || (b as any).Billboard_Name}
                      />
                      <div className="p-3 space-y-1">
                        <div className="font-semibold">{(b as any).name || (b as any).Billboard_Name}</div>
                        <div className="text-xs text-primary">{(b as any).location || (b as any).Nearest_Landmark}</div>
                        <div className="text-xs">{(b as any).city || (b as any).City} • {(b as any).size || (b as any).Size}</div>
                        <div className="text-sm price-text">{(Number((b as any).price || (b as any).Price) || 0).toLocaleString('ar-LY')} {currencySymbol} / شهر</div>
                        
                        <div className="flex items-center gap-2 text-xs">
                          {isAvailable && (
                            <span className="badge-green status-available">متاحة</span>
                          )}
                          {isNearExpiring && (
                            <span className="badge-yellow status-expiring">قريبة الانتهاء</span>
                          )}
                          {!isAvailable && !isNearExpiring && (
                            <span className="badge-red status-rented">مؤجرة</span>
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
          {!loading && filtered.length === 0 && (
            <div className="py-10 text-center text-primary">
              لا توجد لوحات تطابق معايير البحث
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};