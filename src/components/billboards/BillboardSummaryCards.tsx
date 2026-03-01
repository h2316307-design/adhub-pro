import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, MapPin, PackageCheck } from 'lucide-react';

interface BillboardSummaryCardsProps {
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
}

export const BillboardSummaryCards: React.FC<BillboardSummaryCardsProps> = ({
  billboards,
  isContractExpired
}) => {
  // Calculate available billboards
  const availableBillboards = useMemo(() => {
    return billboards.filter((billboard: any) => {
      const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
      const maintenanceType = String(billboard.maintenance_type ?? '').trim();
      const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
      const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
      
      // Exclude removed billboards
      if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') {
        return false;
      }
      
      if (maintenanceStatus === 'removed' || 
          maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
          maintenanceStatus === 'تمت الإزالة' ||
          maintenanceStatus === 'لم يتم التركيب') {
        return false;
      }
      
      if (maintenanceType === 'تحتاج إزالة' || 
          maintenanceType === 'تمت الإزالة' ||
          maintenanceType === 'لم يتم التركيب' ||
          maintenanceType.includes('إزالة') || 
          maintenanceType.includes('ازالة')) {
        return false;
      }
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    });
  }, [billboards, isContractExpired]);

  // Calculate available by size
  const availableBySize = useMemo(() => {
    const sizeMap = new Map<string, number>();
    availableBillboards.forEach((billboard: any) => {
      const size = billboard.Size || billboard.size || 'غير محدد';
      sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    });
    
    // Sort by size order
    const sizeOrder: { [key: string]: number } = {
      '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
      '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
      '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
      '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
      '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
      '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
      '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
    };
    
    return Array.from(sizeMap.entries())
      .sort(([sizeA], [sizeB]) => {
        const orderA = sizeOrder[sizeA] || 999;
        const orderB = sizeOrder[sizeB] || 999;
        return orderA - orderB;
      });
  }, [availableBillboards]);

  // Calculate available by municipality with size breakdown
  const availableByMunicipality = useMemo(() => {
    const municipalityMap = new Map<string, Map<string, number>>();
    
    availableBillboards.forEach((billboard: any) => {
      const municipality = billboard.Municipality || billboard.municipality || 'غير محدد';
      const size = billboard.Size || billboard.size || 'غير محدد';
      
      if (!municipalityMap.has(municipality)) {
        municipalityMap.set(municipality, new Map());
      }
      
      const sizeMap = municipalityMap.get(municipality)!;
      sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    });
    
    return Array.from(municipalityMap.entries())
      .map(([municipality, sizeMap]) => ({
        municipality,
        total: Array.from(sizeMap.values()).reduce((sum, count) => sum + count, 0),
        sizes: Array.from(sizeMap.entries()).sort(([sizeA], [sizeB]) => {
          const sizeOrder: { [key: string]: number } = {
            '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
            '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
            '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
            '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
            '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
            '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
            '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
          };
          const orderA = sizeOrder[sizeA] || 999;
          const orderB = sizeOrder[sizeB] || 999;
          return orderA - orderB;
        })
      }))
      .sort((a, b) => b.total - a.total);
  }, [availableBillboards]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Available by Size Card */}
      <Card className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-background pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutGrid className="h-6 w-6 text-primary" />
            </div>
            <span>اللوحات المتاحة حسب المقاس</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {availableBySize.map(([size, count]) => (
              <div 
                key={size}
                className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-muted/70 hover:to-muted/50 transition-all duration-200 border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <PackageCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-base text-foreground">{size}</p>
                    <p className="text-xs text-muted-foreground">مقاس اللوحة</p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-lg font-bold px-4 py-2 bg-primary/10 text-primary border-primary/20"
                >
                  {count} لوحة
                </Badge>
              </div>
            ))}
            {availableBySize.length === 0 && (
              <p className="text-center text-muted-foreground py-8">لا توجد لوحات متاحة</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available by Municipality Card */}
      <Card className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-accent/10">
              <MapPin className="h-6 w-6 text-accent" />
            </div>
            <span>اللوحات المتاحة حسب البلدية</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            {availableByMunicipality.map(({ municipality, total, sizes }) => (
              <div 
                key={municipality}
                className="p-4 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border-2 border-border/50 hover:border-accent/30 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                      <MapPin className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-bold text-base text-foreground">{municipality}</p>
                      <p className="text-xs text-muted-foreground">البلدية</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="text-base font-bold px-3 py-1 bg-accent/10 text-accent border-accent/30"
                  >
                    {total} لوحة
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {sizes.map(([size, count]) => (
                    <div 
                      key={size}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/50 border border-border/30"
                    >
                      <span className="text-sm font-medium text-foreground">{size}</span>
                      <Badge 
                        variant="secondary" 
                        className="text-xs font-semibold bg-primary/10 text-primary"
                      >
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availableByMunicipality.length === 0 && (
              <p className="text-center text-muted-foreground py-8">لا توجد لوحات متاحة</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
