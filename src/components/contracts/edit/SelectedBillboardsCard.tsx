import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, X, Wrench } from 'lucide-react';
import type { Billboard } from '@/types';

interface SelectedBillboardsCardProps {
  selected: string[];
  billboards: Billboard[];
  onRemoveSelected: (id: string) => void;
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
  // ✅ NEW: Add currency symbol prop
  currencySymbol?: string;
  // ✅ NEW: Size names mapping (size_id -> name)
  sizeNames?: Map<number, string>;
}

export function SelectedBillboardsCard({
  selected,
  billboards,
  onRemoveSelected,
  calculateBillboardPrice,
  installationDetails,
  pricingMode,
  durationMonths,
  durationDays,
  currencySymbol = 'د.ل',
  sizeNames = new Map()
}: SelectedBillboardsCardProps) {
  
  // ✅ NEW: Helper to get display size name
  const getDisplaySize = (billboard: any): string => {
    const sizeId = billboard.size_id || billboard.Size_ID;
    if (sizeId && sizeNames.has(sizeId)) {
      return sizeNames.get(sizeId) || billboard.size || billboard.Size || 'غير محدد';
    }
    return billboard.size || billboard.Size || 'غير محدد';
  };
  const selectedBillboards = billboards.filter((b) => selected.includes(String((b as any).ID)));

  // ✅ NEW: Calculate installation cost summary with unique sizes display
  const installationCostSummary = React.useMemo(() => {
    if (installationDetails.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + detail.installationPrice, 0);
    
    // Group by size and show unique prices without repetition
    const uniqueSizes = Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values());
    
    return {
      totalInstallationCost,
      uniqueSizes: uniqueSizes.map(detail => {
        const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
        const totalForSize = detail.installationPrice * sizeCount;
        return {
          size: detail.size,
          pricePerUnit: detail.installationPrice,
          count: sizeCount,
          totalForSize
        };
      })
    };
  }, [installationDetails]);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المرتبطة ({selected.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selected.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد لوحات</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedBillboards.map((b) => {
                const totalForBoard = calculateBillboardPrice(b);
                const installDetail = installationDetails.find(
                  detail => detail.billboardId === String((b as any).ID)
                );
                const installPrice = installDetail?.installationPrice || 0;

                return (
                  <Card 
                    key={(b as any).ID} 
                    className="bg-card/80 border-border hover:border-primary/50 transition-all duration-300"
                  >
                    <CardContent className="p-0">
                      {(b as any).image && (
                        <img 
                          src={(b as any).image} 
                          alt={(b as any).name || (b as any).Billboard_Name} 
                          className="w-full h-36 object-cover rounded-t-lg" 
                        />
                      )}
                      <div className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-card-foreground mb-1">
                            {(b as any).name || (b as any).Billboard_Name}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {(b as any).location || (b as any).Nearest_Landmark}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            <div className="flex flex-col gap-0.5">
                              <div>الحجم: <strong>{getDisplaySize(b)}</strong></div>
                              <div>المدينة: {(b as any).city || (b as any).City}</div>
                              <div>المستوى: {(b as any).level || (b as any).Level || 'غير محدد'}</div>
                            </div>
                          </div>
                          <div className="text-xs font-medium space-y-1">
                            <div className="text-primary">
                              الإيجار: {totalForBoard.toLocaleString('ar-LY')} {currencySymbol} {' '}
                              {pricingMode === 'months' ? `/${durationMonths} شهر` : `/${durationDays} يوم`}
                            </div>
                            {installPrice > 0 && (
                              <div className="flex items-center gap-1 text-accent">
                                <Wrench className="h-3 w-3" />
                                التركيب: {installPrice.toLocaleString('ar-LY')} د.ل
                                {installDetail?.faces === 1 && (
                                  <span className="text-xs bg-accent/20 text-accent px-1 rounded">
                                    وجه واحد
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => onRemoveSelected(String((b as any).ID))}
                          className="shrink-0"
                        >
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

      {/* ✅ NEW: Installation Cost Summary with unique sizes display */}
      {installationCostSummary && installationCostSummary.totalInstallationCost > 0 && (
        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Wrench className="h-5 w-5 text-accent" />
              ملخص تكلفة التركيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">إجمالي تكلفة التركيب</label>
                <div className="px-4 py-3 rounded bg-accent/10 text-accent font-bold text-lg">
                  {installationCostSummary.totalInstallationCost.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">عدد اللوحات</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold text-lg">
                  {selected.length} لوحة
                </div>
              </div>
            </div>

            {/* ✅ NEW: Display unique installation costs by size without repetition */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
              <div className="space-y-1">
                {installationCostSummary.uniqueSizes.map((sizeInfo, index) => (
                  <div key={index} className="text-xs flex justify-between items-center">
                    <span>
                      <strong>مقاس {sizeInfo.size}:</strong> {sizeInfo.pricePerUnit.toLocaleString()} د.ل × {sizeInfo.count} لوحة
                    </span>
                    <span className="font-bold text-accent">
                      {sizeInfo.totalForSize.toLocaleString()} د.ل
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}