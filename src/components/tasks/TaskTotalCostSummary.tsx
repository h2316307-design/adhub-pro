import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DollarSign, Calculator, Ruler, Hash, ChevronDown, ChevronUp, Box } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SizeData {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  customer_installation_cost: number;
  has_cutout?: boolean;
  additional_cost?: number;
  additional_cost_notes?: string | null;
}

interface Billboard {
  ID: number;
  Size: string;
  Faces_Count?: number;
  Billboard_Name?: string;
}

interface TaskTotalCostSummaryProps {
  taskId: string;
  taskItems: TaskItem[];
  installationPrices: Record<number, number>;
  billboards?: Record<number, Billboard>;
  onRefresh: () => void;
}

function calculateAreaFromSizeData(sizeName: string, sizesMap: Record<string, SizeData>): number {
  if (!sizeName) return 0;
  
  const sizeData = sizesMap[sizeName] || sizesMap[sizeName.toLowerCase()];
  if (sizeData && sizeData.width && sizeData.height) {
    return sizeData.width * sizeData.height;
  }
  
  const parts = sizeName.toLowerCase().split(/[x×*]/);
  if (parts.length === 2) {
    const width = parseFloat(parts[0]) || 0;
    const height = parseFloat(parts[1]) || 0;
    return width * height;
  }
  return 0;
}

export function TaskTotalCostSummary({ 
  taskId, 
  taskItems, 
  installationPrices,
  billboards = {},
  onRefresh 
}: TaskTotalCostSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [totalCustomerCost, setTotalCustomerCost] = useState<number>(0);
  const [pricePerMeter, setPricePerMeter] = useState<number>(0);
  const [distributing, setDistributing] = useState(false);
  const [calculationMode, setCalculationMode] = useState<'total' | 'meter'>('meter');
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});

  // إضافة: إدخال سعر حسب المقاس والمجسم
  const [sizePricing, setSizePricing] = useState<Record<string, { withCutout: number; withoutCutout: number }>>({});

  useEffect(() => {
    const fetchSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, width, height');
      
      if (data && !error) {
        const map: Record<string, SizeData> = {};
        data.forEach((s: any) => {
          map[s.name] = s;
          map[s.name.toLowerCase()] = s;
        });
        setSizesMap(map);
      }
    };
    fetchSizes();
  }, []);

  const totalInstallationCost = taskItems.reduce((sum, item) => {
    return sum + (installationPrices[item.billboard_id] || 0);
  }, 0);

  const totalCustomerPaid = taskItems.reduce((sum, item) => {
    return sum + (item.customer_installation_cost || 0);
  }, 0);

  const totalAdditionalCost = taskItems.reduce((sum, item) => {
    return sum + (item.additional_cost || 0);
  }, 0);

  const difference = totalCustomerPaid - totalInstallationCost;

  const { totalArea, totalAreaWithFaces, sizeBreakdown } = useMemo(() => {
    let total = 0;
    let totalWithFaces = 0;
    const breakdown: Record<string, { 
      count: number; 
      area: number; 
      totalArea: number; 
      faces: number; 
      actualWidth?: number; 
      actualHeight?: number;
      withCutout: number;
      withoutCutout: number;
    }> = {};
    
    taskItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      const sizeName = billboard?.Size || '';
      const faces = billboard?.Faces_Count || 2;
      const area = calculateAreaFromSizeData(sizeName, sizesMap);
      const hasCutout = item.has_cutout || false;
      
      total += area;
      totalWithFaces += area * faces;
      
      if (sizeName) {
        const sizeData = sizesMap[sizeName] || sizesMap[sizeName.toLowerCase()];
        if (!breakdown[sizeName]) {
          breakdown[sizeName] = { 
            count: 0, 
            area, 
            totalArea: 0, 
            faces,
            actualWidth: sizeData?.width || undefined,
            actualHeight: sizeData?.height || undefined,
            withCutout: 0,
            withoutCutout: 0
          };
        }
        breakdown[sizeName].count++;
        breakdown[sizeName].totalArea += area;
        if (hasCutout) {
          breakdown[sizeName].withCutout++;
        } else {
          breakdown[sizeName].withoutCutout++;
        }
      }
    });
    
    return { totalArea: total, totalAreaWithFaces: totalWithFaces, sizeBreakdown: breakdown };
  }, [taskItems, billboards, sizesMap]);

  const calculatedFromMeter = useMemo(() => {
    return Math.round(pricePerMeter * totalAreaWithFaces * 100) / 100;
  }, [pricePerMeter, totalAreaWithFaces]);

  const handleDistributeByTotal = async () => {
    if (!totalCustomerCost || totalCustomerCost <= 0) {
      toast.error('يرجى إدخال المبلغ الكلي');
      return;
    }

    if (taskItems.length === 0 || totalInstallationCost === 0) {
      toast.error('لا توجد لوحات لتوزيع التكلفة عليها');
      return;
    }

    setDistributing(true);
    try {
      const updates = taskItems.map(item => {
        const itemCost = installationPrices[item.billboard_id] || 0;
        const percentage = itemCost / totalInstallationCost;
        const distributedCost = Math.round(totalCustomerCost * percentage * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ customer_installation_cost: distributedCost })
          .eq('id', item.id);
      });

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      
      if (hasError) {
        throw new Error('فشل في تحديث بعض اللوحات');
      }

      toast.success('تم توزيع المبلغ على اللوحات بنجاح');
      setTotalCustomerCost(0);
      onRefresh();
    } catch (error) {
      console.error('Error distributing cost:', error);
      toast.error('فشل في توزيع المبلغ');
    } finally {
      setDistributing(false);
    }
  };

  const handleDistributeByMeter = async () => {
    if (!pricePerMeter || pricePerMeter <= 0) {
      toast.error('يرجى إدخال سعر المتر');
      return;
    }

    if (taskItems.length === 0) {
      toast.error('لا توجد لوحات لتوزيع التكلفة عليها');
      return;
    }

    setDistributing(true);
    try {
      const updates = taskItems.map(item => {
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const area = calculateAreaFromSizeData(sizeName, sizesMap);
        const faces = billboard?.Faces_Count || 2;
        const cost = Math.round(pricePerMeter * area * faces * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ customer_installation_cost: cost })
          .eq('id', item.id);
      });

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      
      if (hasError) {
        throw new Error('فشل في تحديث بعض اللوحات');
      }

      toast.success(`تم توزيع المبلغ (${calculatedFromMeter.toLocaleString('ar-LY')} د.ل) على اللوحات`);
      setPricePerMeter(0);
      onRefresh();
    } catch (error) {
      console.error('Error distributing cost by meter:', error);
      toast.error('فشل في توزيع المبلغ');
    } finally {
      setDistributing(false);
    }
  };

  // توزيع حسب المقاس والمجسم
  const handleDistributeBySizeAndCutout = async () => {
    const hasAnyPricing = Object.values(sizePricing).some(p => p.withCutout > 0 || p.withoutCutout > 0);
    if (!hasAnyPricing) {
      toast.error('يرجى إدخال سعر واحد على الأقل');
      return;
    }

    setDistributing(true);
    try {
      const updates = taskItems.map(item => {
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const hasCutout = item.has_cutout || false;
        const pricing = sizePricing[sizeName];
        
        let cost = 0;
        if (pricing) {
          cost = hasCutout ? (pricing.withCutout || 0) : (pricing.withoutCutout || 0);
        }
        
        return supabase
          .from('installation_task_items')
          .update({ customer_installation_cost: cost })
          .eq('id', item.id);
      });

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      
      if (hasError) {
        throw new Error('فشل في تحديث بعض اللوحات');
      }

      toast.success('تم توزيع التكاليف حسب المقاس والمجسم');
      setSizePricing({});
      onRefresh();
    } catch (error) {
      console.error('Error distributing by size:', error);
      toast.error('فشل في توزيع التكاليف');
    } finally {
      setDistributing(false);
    }
  };

  if (taskItems.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                ملخص تكاليف التركيب
              </CardTitle>
              <div className="flex items-center gap-3">
                {/* ملخص سريع */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <Badge variant="outline" className="font-mono">
                    {taskItems.length} لوحة
                  </Badge>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-300">
                    الشركة: {totalInstallationCost.toLocaleString('ar-LY')} د.ل
                  </Badge>
                  {totalAdditionalCost > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
                      إضافية: +{totalAdditionalCost.toLocaleString('ar-LY')} د.ل
                    </Badge>
                  )}
                  {totalCustomerPaid === 0 ? (
                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 border-purple-300">
                      مجاني
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-300">
                      الزبون: {totalCustomerPaid.toLocaleString('ar-LY')} د.ل
                    </Badge>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* الإحصائيات */}
            <div className="grid grid-cols-5 gap-2">
              <div className="p-2 bg-muted/50 rounded-lg text-center">
                <Hash className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                <div className="font-bold text-lg">{taskItems.length}</div>
                <div className="text-[10px] text-muted-foreground">لوحة</div>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg text-center">
                <Ruler className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                <div className="font-bold text-lg">{totalArea.toFixed(0)}</div>
                <div className="text-[10px] text-muted-foreground">م²</div>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                <DollarSign className="h-3 w-3 mx-auto text-green-600 mb-1" />
                <div className="font-bold text-lg text-green-700 dark:text-green-300">
                  {totalInstallationCost.toLocaleString('ar-LY')}
                </div>
                <div className="text-[10px] text-green-600 dark:text-green-400">الشركة</div>
              </div>
              {totalAdditionalCost > 0 ? (
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-center">
                  <Box className="h-3 w-3 mx-auto text-amber-600 mb-1" />
                  <div className="font-bold text-lg text-amber-700 dark:text-amber-300">
                    +{totalAdditionalCost.toLocaleString('ar-LY')}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400">إضافية</div>
                </div>
              ) : (
                <div className="p-2 bg-muted/30 rounded-lg text-center">
                  <Box className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                  <div className="font-bold text-lg text-muted-foreground">0</div>
                  <div className="text-[10px] text-muted-foreground">إضافية</div>
                </div>
              )}
              <div className={`p-2 rounded-lg text-center ${
                totalCustomerPaid === 0 
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                <Calculator className={`h-3 w-3 mx-auto mb-1 ${
                  totalCustomerPaid === 0 ? 'text-purple-600' : 'text-blue-600'
                }`} />
                <div className={`font-bold text-lg ${
                  totalCustomerPaid === 0 
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {totalCustomerPaid === 0 ? 'مجاني' : totalCustomerPaid.toLocaleString('ar-LY')}
                </div>
                <div className={`text-[10px] ${
                  totalCustomerPaid === 0 
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>الزبون</div>
              </div>
            </div>

            {/* تفاصيل المقاسات مع إدخال السعر */}
            <div className="space-y-2">
              <Label className="text-xs font-bold flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-primary" />
                إدخال السعر حسب المقاس والمجسم
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(sizeBreakdown).map(([size, data]) => (
                  <div key={size} className="p-2 bg-muted/30 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-bold">{size}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {data.count} لوحة • {data.totalArea.toFixed(1)} م²
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {data.withoutCutout > 0 && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            عادي ({data.withoutCutout})
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-7 text-xs"
                            placeholder="السعر"
                            value={sizePricing[size]?.withoutCutout || ''}
                            onChange={(e) => setSizePricing(prev => ({
                              ...prev,
                              [size]: { 
                                ...prev[size], 
                                withoutCutout: Number(e.target.value) || 0,
                                withCutout: prev[size]?.withCutout || 0
                              }
                            }))}
                          />
                        </div>
                      )}
                      {data.withCutout > 0 && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-amber-600 flex items-center gap-1">
                            <Box className="h-3 w-3" />
                            مجسم ({data.withCutout})
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-7 text-xs border-amber-300"
                            placeholder="السعر"
                            value={sizePricing[size]?.withCutout || ''}
                            onChange={(e) => setSizePricing(prev => ({
                              ...prev,
                              [size]: { 
                                ...prev[size], 
                                withCutout: Number(e.target.value) || 0,
                                withoutCutout: prev[size]?.withoutCutout || 0
                              }
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleDistributeBySizeAndCutout}
                disabled={distributing || !Object.values(sizePricing).some(p => p.withCutout > 0 || p.withoutCutout > 0)}
                className="w-full"
              >
                {distributing ? 'جاري التوزيع...' : 'تطبيق الأسعار على اللوحات'}
              </Button>
            </div>

            {/* أو توزيع بطريقة أخرى */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground px-2">أو توزيع بسعر موحد</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* سعر المتر */}
                <div className="space-y-1.5">
                  <Label className="text-[10px]">سعر المتر المربع</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerMeter || ''}
                      onChange={(e) => setPricePerMeter(Number(e.target.value) || 0)}
                      placeholder="سعر المتر"
                      className="h-8 text-xs flex-1"
                      disabled={distributing}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDistributeByMeter}
                      disabled={!pricePerMeter || distributing}
                      className="h-8 text-xs px-3"
                    >
                      توزيع
                    </Button>
                  </div>
                  {pricePerMeter > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      = {calculatedFromMeter.toLocaleString('ar-LY')} د.ل
                    </div>
                  )}
                </div>

                {/* مبلغ كلي */}
                <div className="space-y-1.5">
                  <Label className="text-[10px]">مبلغ كلي للتوزيع</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalCustomerCost || ''}
                      onChange={(e) => setTotalCustomerCost(Number(e.target.value) || 0)}
                      placeholder="المبلغ الكلي"
                      className="h-8 text-xs flex-1"
                      disabled={distributing}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDistributeByTotal}
                      disabled={!totalCustomerCost || distributing}
                      className="h-8 text-xs px-3"
                    >
                      توزيع
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
