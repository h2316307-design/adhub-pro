import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, Calculator, Ruler, ChevronDown, ChevronUp, 
  Box, Building2, Landmark, LayoutGrid, Check, Pencil, X, Save, Gift, Square, Zap
} from 'lucide-react';
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
  pricing_type?: 'piece' | 'meter';
  price_per_meter?: number;
  faces_to_install?: number;
}

interface Billboard {
  ID: number;
  Size: string;
  Faces_Count?: number;
  Billboard_Name?: string;
  billboard_type?: string;
  Nearest_Landmark?: string;
}

interface TaskTotalCostSummaryProps {
  taskId: string;
  taskItems: TaskItem[];
  installationPrices: Record<number, number>;
  billboards?: Record<number, Billboard>;
  onRefresh: () => void;
}

const BILLBOARD_TYPE_ICONS: Record<string, any> = {
  'تيبول': Landmark,
  'برجية': Building2,
  'عادية': LayoutGrid,
};

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
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});
  const [distributing, setDistributing] = useState(false);
  
  // أسعار التسعير السريع - بالقطعة
  const [quickPrices, setQuickPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر - لكل مقاس
  const [meterPrices, setMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر لكل نوع لوحة
  const [typeMeterPrices, setTypeMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  const [pricingType, setPricingType] = useState<'piece' | 'meter'>('piece');
  const [pricingTypeInitialized, setPricingTypeInitialized] = useState(false);

  // حالة تعديل العناصر الفردية
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    companyCost: number;
    customerCost: number;
    additionalCost: number;
    additionalNotes: string;
  }>({ companyCost: 0, customerCost: 0, additionalCost: 0, additionalNotes: '' });
  
  // تخزين تكاليف الشركة المعدلة محلياً
  const [customCompanyCosts, setCustomCompanyCosts] = useState<Record<string, number>>({});

  // حالة طي المقاسات - مطوية دائماً افتراضياً
  const [collapsedSizes, setCollapsedSizes] = useState<Set<string>>(new Set());
  // حالة طي الأنواع
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  // تتبع ما إذا تم تهيئة الحالات
  const [initialized, setInitialized] = useState(false);

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

  // جعل جميع المقاسات مطوية افتراضياً عند تحميل البيانات
  useEffect(() => {
    if (!initialized && Object.keys(billboards).length > 0 && taskItems.length > 0) {
      const allSizeKeys = new Set<string>();
      taskItems.forEach(item => {
        const billboard = billboards[item.billboard_id];
        const billboardType = billboard?.billboard_type || 'عادية';
        const sizeName = billboard?.Size || 'غير محدد';
        allSizeKeys.add(`${billboardType}-${sizeName}`);
      });
      setCollapsedSizes(allSizeKeys);
      setInitialized(true);
    }
  }, [billboards, taskItems, initialized]);

  // تهيئة نوع التسعير من البيانات المحفوظة
  useEffect(() => {
    if (!pricingTypeInitialized && taskItems.length > 0) {
      // إذا كان أي عنصر محفوظ بنوع 'meter'، نستخدم meter
      const hasMeterPricing = taskItems.some(item => item.pricing_type === 'meter');
      if (hasMeterPricing) {
        setPricingType('meter');
      }
      setPricingTypeInitialized(true);
    }
  }, [taskItems, pricingTypeInitialized]);

  // حساب الإجماليات
  const { totals, groupedData } = useMemo(() => {
    let companyCost = 0;
    let customerCost = 0;
    let additionalCost = 0;
    let totalArea = 0;

    const grouped: Record<string, {
      type: string;
      sizes: Record<string, {
        size: string;
        items: Array<TaskItem & { billboard: Billboard; area: number }>;
        normalCount: number;
        cutoutCount: number;
        totalArea: number;
        companyCost: number;
        customerCost: number;
        avgAreaPerItem: number;
      }>;
      totalItems: number;
      totalArea: number;
      companyCost: number;
      customerCost: number;
    }> = {};

    taskItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      const billboardType = billboard?.billboard_type || 'عادية';
      const sizeName = billboard?.Size || 'غير محدد';
      const area = calculateAreaFromSizeData(sizeName, sizesMap);
      const totalFaces = billboard?.Faces_Count || 1;
      const facesToInstall = item.faces_to_install ?? totalFaces;
      // المساحة الفعلية = مساحة الوجه الواحد × عدد الأوجه المراد تركيبها
      const singleFaceArea = area; // المساحة لوجه واحد
      const itemArea = singleFaceArea * facesToInstall;
      // تكلفة الشركة: نصف السعر إذا وجه واحد من لوحة بوجهين
      const fullCompanyCost = installationPrices[item.billboard_id] || 0;
      const itemCompanyCost = (totalFaces > 1 && facesToInstall === 1)
        ? fullCompanyCost / 2
        : fullCompanyCost;
      const itemCustomerCost = item.customer_installation_cost || 0;

      companyCost += itemCompanyCost;
      customerCost += itemCustomerCost;
      additionalCost += item.additional_cost || 0;
      totalArea += itemArea;

      if (!grouped[billboardType]) {
        grouped[billboardType] = {
          type: billboardType,
          sizes: {},
          totalItems: 0,
          totalArea: 0,
          companyCost: 0,
          customerCost: 0
        };
      }

      if (!grouped[billboardType].sizes[sizeName]) {
        grouped[billboardType].sizes[sizeName] = {
          size: sizeName,
          items: [],
          normalCount: 0,
          cutoutCount: 0,
          totalArea: 0,
          companyCost: 0,
          customerCost: 0,
          avgAreaPerItem: 0
        };
      }

      grouped[billboardType].sizes[sizeName].items.push({
        ...item,
        billboard: billboard || { ID: item.billboard_id, Size: sizeName },
        area: itemArea
      });
      
      grouped[billboardType].sizes[sizeName].totalArea += itemArea;
      grouped[billboardType].sizes[sizeName].companyCost += itemCompanyCost;
      grouped[billboardType].sizes[sizeName].customerCost += itemCustomerCost;
      
      if (item.has_cutout) {
        grouped[billboardType].sizes[sizeName].cutoutCount++;
      } else {
        grouped[billboardType].sizes[sizeName].normalCount++;
      }

      grouped[billboardType].totalItems++;
      grouped[billboardType].totalArea += itemArea;
      grouped[billboardType].companyCost += itemCompanyCost;
      grouped[billboardType].customerCost += itemCustomerCost;
    });

    // حساب متوسط المساحة لكل عنصر
    Object.values(grouped).forEach(typeData => {
      Object.values(typeData.sizes).forEach(sizeData => {
        sizeData.avgAreaPerItem = sizeData.items.length > 0 
          ? sizeData.totalArea / sizeData.items.length 
          : 0;
      });
    });

    return {
      totals: { companyCost, customerCost, additionalCost, totalArea, profit: customerCost - companyCost },
      groupedData: grouped
    };
  }, [taskItems, installationPrices, billboards, sizesMap]);

  // حساب السعر المتوقع بناءً على سعر المتر (للعرض الفوري)
  const calculateExpectedPrice = useCallback((sizeName: string, hasCutout: boolean, pricePerMeter: number) => {
    const area = calculateAreaFromSizeData(sizeName, sizesMap);
    const billboard = Object.values(billboards).find(b => b.Size === sizeName);
    const faces = billboard?.Faces_Count || 2;
    return Math.round(pricePerMeter * area * faces * 100) / 100;
  }, [sizesMap, billboards]);

  // بدء تعديل عنصر
  const startEditingItem = (item: TaskItem & { billboard: Billboard; area: number }) => {
    setEditingItemId(item.id);
    const existingCompanyCost = customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
    setEditValues({
      companyCost: existingCompanyCost,
      customerCost: item.customer_installation_cost || 0,
      additionalCost: item.additional_cost || 0,
      additionalNotes: item.additional_cost_notes || ''
    });
  };

  // حفظ تعديل عنصر
  const handleSaveItemEdit = async () => {
    if (!editingItemId) return;
    
    setDistributing(true);
    try {
      // حفظ تكلفة الشركة محلياً
      setCustomCompanyCosts(prev => ({
        ...prev,
        [editingItemId]: editValues.companyCost
      }));
      
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          customer_installation_cost: editValues.customerCost,
          additional_cost: editValues.additionalCost || null,
          additional_cost_notes: editValues.additionalNotes || null
        })
        .eq('id', editingItemId);

      if (error) throw error;
      toast.success('تم الحفظ');
      setEditingItemId(null);
      onRefresh();
    } catch (error) {
      toast.error('فشل الحفظ');
    } finally {
      setDistributing(false);
    }
  };

  // تحويل لمجاني
  const handleSetFree = async (itemId: string) => {
    setDistributing(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ customer_installation_cost: 0 })
        .eq('id', itemId);

      if (error) throw error;
      toast.success('تم التحويل لمجاني');
      onRefresh();
    } catch (error) {
      toast.error('فشل التحويل');
    } finally {
      setDistributing(false);
    }
  };

  // تحويل جميع اللوحات لمجانية
  const handleSetAllFree = async () => {
    if (taskItems.length === 0) return;
    
    setDistributing(true);
    try {
      const updates = taskItems.map(item => 
        supabase
          .from('installation_task_items')
          .update({ customer_installation_cost: 0 })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      toast.success(`تم تحويل ${taskItems.length} لوحة لمجانية`);
      onRefresh();
    } catch (error) {
      toast.error('فشل التحويل');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق التسعير السريع بالقطعة
  const handleApplyQuickPricing = async () => {
    const hasAnyPrice = Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0);
    if (!hasAnyPrice) {
      toast.error('أدخل سعر واحد على الأقل');
      return;
    }

    setDistributing(true);
    try {
      const updates = taskItems.map(item => {
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const hasCutout = item.has_cutout || false;
        const pricing = quickPrices[sizeName];
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        let cost = item.customer_installation_cost || 0;
        if (pricing) {
          const fullCost = hasCutout ? pricing.cutout : pricing.normal;
          if (fullCost > 0) {
            // نصف السعر إذا وجه واحد من لوحة بوجهين
            cost = (totalFaces > 1 && facesToInstall === 1) ? fullCost / 2 : fullCost;
          }
        }
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'piece',
            price_per_meter: 0
          })
          .eq('id', item.id);
      });

      await Promise.all(updates);
      toast.success('تم تطبيق الأسعار');
      setQuickPrices({});
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق سعر المتر على مقاس معين فوراً
  const handleApplyMeterToSize = async (sizeName: string) => {
    const meterPrice = meterPrices[sizeName];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) {
      toast.error('أدخل سعر المتر أولاً');
      return;
    }

    setDistributing(true);
    try {
      const itemsToUpdate = taskItems.filter(item => {
        const billboard = billboards[item.billboard_id];
        return billboard?.Size === sizeName;
      });

      const updates = itemsToUpdate.map(item => {
        const billboard = billboards[item.billboard_id];
        const hasCutout = item.has_cutout || false;
        const area = calculateAreaFromSizeData(sizeName, sizesMap);
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        const pricePerMeter = hasCutout ? meterPrice.cutout : meterPrice.normal;
        if (!pricePerMeter || pricePerMeter <= 0) return null;
        
        // السعر = سعر المتر × المساحة × عدد الأوجه المراد تركيبها
        const cost = Math.round(pricePerMeter * area * facesToInstall * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'meter',
            price_per_meter: pricePerMeter
          })
          .eq('id', item.id);
      }).filter(Boolean);

      await Promise.all(updates);
      toast.success(`تم تطبيق السعر على ${itemsToUpdate.length} لوحة بمقاس ${sizeName}`);
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق سعر المتر على نوع كامل (مثل: برجية عادية)
  const handleApplyMeterToType = async (billboardType: string) => {
    const meterPrice = typeMeterPrices[billboardType];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) {
      toast.error('أدخل سعر المتر للنوع أولاً');
      return;
    }

    setDistributing(true);
    try {
      const itemsToUpdate = taskItems.filter(item => {
        const billboard = billboards[item.billboard_id];
        return (billboard?.billboard_type || 'عادية') === billboardType;
      });

      const updates = itemsToUpdate.map(item => {
        const billboard = billboards[item.billboard_id];
        const hasCutout = item.has_cutout || false;
        const sizeName = billboard?.Size || '';
        const area = calculateAreaFromSizeData(sizeName, sizesMap);
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        const pricePerMeter = hasCutout ? meterPrice.cutout : meterPrice.normal;
        if (!pricePerMeter || pricePerMeter <= 0) return null;
        
        // السعر = سعر المتر × المساحة × عدد الأوجه المراد تركيبها
        const cost = Math.round(pricePerMeter * area * facesToInstall * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'meter',
            price_per_meter: pricePerMeter
          })
          .eq('id', item.id);
      }).filter(Boolean);

      await Promise.all(updates);
      toast.success(`تم تطبيق السعر على ${itemsToUpdate.length} لوحة من نوع ${billboardType}`);
      setTypeMeterPrices(prev => {
        const updated = { ...prev };
        delete updated[billboardType];
        return updated;
      });
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تبديل طي المقاس
  const toggleSizeCollapse = (sizeKey: string) => {
    setCollapsedSizes(prev => {
      const updated = new Set(prev);
      if (updated.has(sizeKey)) {
        updated.delete(sizeKey);
      } else {
        updated.add(sizeKey);
      }
      return updated;
    });
  };

  // تبديل طي النوع
  const toggleTypeCollapse = (typeKey: string) => {
    setCollapsedTypes(prev => {
      const updated = new Set(prev);
      if (updated.has(typeKey)) {
        updated.delete(typeKey);
      } else {
        updated.add(typeKey);
      }
      return updated;
    });
  };

  if (taskItems.length === 0) return null;

  const billboardTypes = Object.keys(groupedData);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-border">
        {/* العنوان والملخص */}
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors bg-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">تكاليف التركيب</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {taskItems.length} لوحة
                </Badge>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                    <span className="text-muted-foreground">الشركة:</span>
                    <span className="font-bold">{totals.companyCost.toLocaleString('ar-LY')}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10">
                    <span className="text-muted-foreground">الزبون:</span>
                    <span className="font-bold text-primary">{totals.customerCost.toLocaleString('ar-LY')}</span>
                  </div>
                  {totals.additionalCost > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10">
                      <span className="text-muted-foreground">إضافية:</span>
                      <span className="font-bold text-amber-600">+{totals.additionalCost.toLocaleString('ar-LY')}</span>
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-5 bg-card">
            {/* اختيار نوع التسعير */}
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-primary">
                  <Calculator className="h-5 w-5" />
                  طريقة حساب التكلفة
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPricingType('piece')}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    pricingType === 'piece' 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : 'border-border bg-card hover:border-primary/50 text-foreground'
                  }`}
                >
                  <Square className="h-4 w-4" />
                  <span className="font-medium text-sm">بالقطعة</span>
                </button>
                <button
                  onClick={() => setPricingType('meter')}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    pricingType === 'meter' 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : 'border-border bg-card hover:border-primary/50 text-foreground'
                  }`}
                >
                  <Ruler className="h-4 w-4" />
                  <span className="font-medium text-sm">بالمتر المربع</span>
                </button>
              </div>
            </div>

            {/* الإحصائيات الرئيسية */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-2xl font-bold">{totals.totalArea.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">م² إجمالي</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-2xl font-bold">{totals.companyCost.toLocaleString('ar-LY')}</div>
                <div className="text-xs text-muted-foreground">تكلفة الشركة</div>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 text-center">
                <div className="text-2xl font-bold text-primary">{totals.customerCost.toLocaleString('ar-LY')}</div>
                <div className="text-xs text-muted-foreground">تكلفة الزبون</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <div className="text-2xl font-bold text-amber-600">{totals.additionalCost > 0 ? `+${totals.additionalCost.toLocaleString('ar-LY')}` : '0'}</div>
                <div className="text-xs text-muted-foreground">تكاليف إضافية</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${totals.profit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {totals.profit >= 0 ? '+' : ''}{totals.profit.toLocaleString('ar-LY')}
                </div>
                <div className="text-xs text-muted-foreground">الربح</div>
              </div>
            </div>

            <Separator />

            {/* فاتورة المقاسات حسب النوع */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  تفاصيل اللوحات
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSetAllFree}
                  disabled={distributing || totals.customerCost === 0}
                  className="gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <Gift className="h-4 w-4" />
                  تحويل الكل لمجاني
                </Button>
              </div>

              {billboardTypes.map(type => {
                const typeData = groupedData[type];
                const Icon = BILLBOARD_TYPE_ICONS[type] || LayoutGrid;
                const isTypeCollapsed = collapsedTypes.has(type);
                
                return (
                  <div key={type} className="border rounded-lg overflow-hidden bg-card">
                    {/* رأس النوع - قابل للنقر */}
                    <div 
                      className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => toggleTypeCollapse(type)}
                    >
                      <div className="flex items-center gap-2">
                        {isTypeCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        <Icon className="h-4 w-4" />
                        <span className="font-bold">{type}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeData.totalItems} لوحة
                        </Badge>
                        {/* عرض سعر المتر إذا كان التسعير بالمتر */}
                        {pricingType === 'meter' && (() => {
                          const allItems = Object.values(typeData.sizes).flatMap(s => s.items);
                          const meterItem = allItems.find(item => item.pricing_type === 'meter' && item.price_per_meter);
                          return meterItem ? (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              {meterItem.price_per_meter?.toFixed(1)} د.ل/م²
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{typeData.totalArea.toFixed(0)} م²</span>
                        <span className="text-muted-foreground">|</span>
                        <span>الشركة: {typeData.companyCost.toLocaleString('ar-LY')}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-primary font-bold">الزبون: {typeData.customerCost.toLocaleString('ar-LY')}</span>
                      </div>
                    </div>

                    {/* تسعير النوع بالكامل (بالمتر) */}
                    {!isTypeCollapsed && pricingType === 'meter' && (
                      <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-primary flex items-center gap-1">
                            <Zap className="h-4 w-4" />
                            تسعير {type} بالكامل:
                          </span>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">عادي/م²:</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="0"
                              className="h-8 w-24 text-sm"
                              value={typeMeterPrices[type]?.normal || ''}
                              onChange={e => setTypeMeterPrices(prev => ({
                                ...prev,
                                [type]: {
                                  ...prev[type],
                                  normal: Number(e.target.value) || 0,
                                  cutout: prev[type]?.cutout || 0
                                }
                              }))}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                              <Box className="h-3 w-3" />
                              مجسم/م²:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="0"
                              className="h-8 w-24 text-sm border-amber-300"
                              value={typeMeterPrices[type]?.cutout || ''}
                              onChange={e => setTypeMeterPrices(prev => ({
                                ...prev,
                                [type]: {
                                  ...prev[type],
                                  normal: prev[type]?.normal || 0,
                                  cutout: Number(e.target.value) || 0
                                }
                              }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApplyMeterToType(type)}
                            disabled={distributing || (!typeMeterPrices[type]?.normal && !typeMeterPrices[type]?.cutout)}
                            className="gap-1"
                          >
                            <Check className="h-3 w-3" />
                            تطبيق على {type}
                          </Button>
                          {(typeMeterPrices[type]?.normal || typeMeterPrices[type]?.cutout) && (
                            <span className="text-xs text-green-600 font-medium">
                              ≈ {Math.round((typeMeterPrices[type]?.normal || typeMeterPrices[type]?.cutout || 0) * typeData.totalArea).toLocaleString('ar-LY')} د.ل
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* المقاسات واللوحات */}
                    {!isTypeCollapsed && (
                      <div className="divide-y">
                        {Object.values(typeData.sizes).map(sizeData => {
                          const sizeKey = `${type}-${sizeData.size}`;
                          const isSizeCollapsed = collapsedSizes.has(sizeKey);
                          
                          return (
                            <div key={sizeData.size} className="bg-card">
                              {/* رأس المقاس - قابل للطي */}
                              <div 
                                className="flex flex-wrap items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/50"
                                onClick={() => toggleSizeCollapse(sizeKey)}
                              >
                                <div className="flex items-center gap-3">
                                  {isSizeCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                                  <Badge className="text-sm font-mono bg-primary/10 text-primary border-0">{sizeData.size}</Badge>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{sizeData.items.length} لوحة</span>
                                    <span>•</span>
                                    <span>{sizeData.totalArea.toFixed(1)} م²</span>
                                    {sizeData.cutoutCount > 0 && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                          <Box className="h-3 w-3 ml-1" />
                                          {sizeData.cutoutCount} مجسم
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* ملخص الأسعار */}
                                <div className="flex items-center gap-2 text-sm">
                                  <Badge variant="outline" className="bg-muted">
                                    الشركة: {sizeData.companyCost.toLocaleString('ar-LY')}
                                  </Badge>
                                  <Badge className="bg-primary/10 text-primary border-0">
                                    الزبون: {sizeData.customerCost.toLocaleString('ar-LY')}
                                  </Badge>
                                </div>
                              </div>

                              {/* حقول التسعير */}
                              {!isSizeCollapsed && (
                                <div className="p-3 bg-muted/20 border-b">
                                  {pricingType === 'piece' ? (
                                    // التسعير بالقطعة
                                    <div className="flex flex-wrap items-center gap-3">
                                      {sizeData.normalCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            سعر القطعة العادية:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm"
                                            value={quickPrices[sizeData.size]?.normal || ''}
                                            onChange={e => setQuickPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: Number(e.target.value) || 0,
                                                cutout: prev[sizeData.size]?.cutout || 0
                                              }
                                            }))}
                                          />
                                          <span className="text-xs text-muted-foreground">د.ل</span>
                                          <span className="text-xs text-muted-foreground">× {sizeData.normalCount}</span>
                                          {quickPrices[sizeData.size]?.normal > 0 && (
                                            <span className="text-xs text-green-600 font-medium">
                                              = {(quickPrices[sizeData.size].normal * sizeData.normalCount).toLocaleString('ar-LY')} د.ل
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {sizeData.cutoutCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                                            <Box className="h-3 w-3" />
                                            سعر القطعة المجسمة:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-amber-400"
                                            value={quickPrices[sizeData.size]?.cutout || ''}
                                            onChange={e => setQuickPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: prev[sizeData.size]?.normal || 0,
                                                cutout: Number(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                          <span className="text-xs text-muted-foreground">د.ل</span>
                                          <span className="text-xs text-muted-foreground">× {sizeData.cutoutCount}</span>
                                          {quickPrices[sizeData.size]?.cutout > 0 && (
                                            <span className="text-xs text-amber-600 font-medium">
                                              = {(quickPrices[sizeData.size].cutout * sizeData.cutoutCount).toLocaleString('ar-LY')} د.ل
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // التسعير بالمتر المربع
                                    <div className="flex flex-wrap items-center gap-3">
                                      {sizeData.normalCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                            <Ruler className="h-3 w-3" />
                                            عادي/م²:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-primary/30"
                                            value={meterPrices[sizeData.size]?.normal || ''}
                                            onChange={e => setMeterPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: Number(e.target.value) || 0,
                                                cutout: prev[sizeData.size]?.cutout || 0
                                              }
                                            }))}
                                          />
                                          <span className="text-xs text-primary font-medium">
                                            = {meterPrices[sizeData.size]?.normal 
                                              ? Math.round(meterPrices[sizeData.size].normal * sizeData.avgAreaPerItem * sizeData.normalCount).toLocaleString('ar-LY')
                                              : '0'} د.ل
                                          </span>
                                        </div>
                                      )}
                                      {sizeData.cutoutCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                                            <Box className="h-3 w-3" />
                                            مجسم/م²:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-amber-400"
                                            value={meterPrices[sizeData.size]?.cutout || ''}
                                            onChange={e => setMeterPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: prev[sizeData.size]?.normal || 0,
                                                cutout: Number(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                          <span className="text-xs text-amber-600 font-medium">
                                            = {meterPrices[sizeData.size]?.cutout 
                                              ? Math.round(meterPrices[sizeData.size].cutout * sizeData.avgAreaPerItem * sizeData.cutoutCount).toLocaleString('ar-LY')
                                              : '0'} د.ل
                                          </span>
                                        </div>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleApplyMeterToSize(sizeData.size);
                                        }}
                                        disabled={distributing || (!meterPrices[sizeData.size]?.normal && !meterPrices[sizeData.size]?.cutout)}
                                        className="gap-1 h-8"
                                      >
                                        <Check className="h-3 w-3" />
                                        تطبيق
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* قائمة اللوحات */}
                              {!isSizeCollapsed && (
                                <div className="divide-y divide-border/30">
                                  {sizeData.items.map(item => (
                                    <div 
                                      key={item.id} 
                                      className={`p-3 ${
                                        editingItemId === item.id ? 'bg-card' : 'bg-muted/10'
                                      }`}
                                    >
                                      {editingItemId === item.id ? (
                                        // وضع التعديل
                                        <div className="space-y-4">
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm text-foreground">
                                              {item.billboard.Billboard_Name || `لوحة ${item.billboard_id}`}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                                                onClick={handleSaveItemEdit}
                                                disabled={distributing}
                                              >
                                                <Save className="h-3.5 w-3.5 ml-1" />
                                                حفظ
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-3"
                                                onClick={() => setEditingItemId(null)}
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {/* تكلفة الشركة */}
                                            <div className="space-y-1.5">
                                              <Label className="text-xs font-medium text-foreground">تكلفة الشركة</Label>
                                              <Input
                                                type="number"
                                                min="0"
                                                value={editValues.companyCost}
                                                onChange={e => setEditValues(prev => ({
                                                  ...prev,
                                                  companyCost: Number(e.target.value) || 0
                                                }))}
                                                className="h-9 text-sm"
                                              />
                                            </div>

                                            {/* تكلفة الزبون */}
                                            <div className="space-y-1.5">
                                              <Label className="text-xs font-medium text-foreground">تكلفة الزبون</Label>
                                              <div className="flex gap-1.5">
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={editValues.customerCost}
                                                  onChange={e => setEditValues(prev => ({
                                                    ...prev,
                                                    customerCost: Number(e.target.value) || 0
                                                  }))}
                                                  className="h-9 text-sm"
                                                />
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-9 px-2.5"
                                                  onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0 }))}
                                                  title="تحويل لمجاني"
                                                >
                                                  <Gift className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>

                                            {/* تكلفة إضافية */}
                                            <div className="space-y-1.5">
                                              <Label className="text-xs font-medium text-foreground">تكلفة إضافية</Label>
                                              <Input
                                                type="number"
                                                min="0"
                                                value={editValues.additionalCost || ''}
                                                onChange={e => setEditValues(prev => ({
                                                  ...prev,
                                                  additionalCost: Number(e.target.value) || 0
                                                }))}
                                                placeholder="0"
                                                className="h-9 text-sm"
                                              />
                                            </div>

                                            {/* سبب التكلفة الإضافية */}
                                            <div className="space-y-1.5">
                                              <Label className="text-xs font-medium text-muted-foreground">سبب الإضافية</Label>
                                              <Input
                                                type="text"
                                                value={editValues.additionalNotes}
                                                onChange={e => setEditValues(prev => ({
                                                  ...prev,
                                                  additionalNotes: e.target.value
                                                }))}
                                                placeholder="موقع صعب..."
                                                className="h-9 text-sm"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        // وضع العرض
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium">
                                                {item.billboard.Billboard_Name || `لوحة ${item.billboard_id}`}
                                              </span>
                                              {item.has_cutout && (
                                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                                  <Box className="h-3 w-3 ml-1" />
                                                  مجسم
                                                </Badge>
                                              )}
                                              <span className="text-xs text-muted-foreground">
                                                {item.area.toFixed(1)} م²
                                              </span>
                                            </div>
                                            {item.billboard.Nearest_Landmark && (
                                              <span className="text-xs text-muted-foreground pr-1">
                                                📍 {item.billboard.Nearest_Landmark}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-3">
                                            {/* التكاليف */}
                                            <div className="flex items-center gap-2 text-sm flex-wrap">
                                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700">
                                                الشركة: {(customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0).toLocaleString('ar-LY')}
                                              </Badge>
                                              {item.customer_installation_cost === 0 ? (
                                                <Badge className="bg-purple-100 text-purple-700 border-0 dark:bg-purple-950/50 dark:text-purple-300">
                                                  <Gift className="h-3 w-3 ml-1" />
                                                  مجاني
                                                </Badge>
                                              ) : (
                                                <Badge className="bg-primary/10 text-primary border-0">
                                                  الزبون: {item.customer_installation_cost.toLocaleString('ar-LY')}
                                                </Badge>
                                              )}
                                              {item.additional_cost && item.additional_cost > 0 && (
                                                <Badge className="bg-orange-100 text-orange-700 border-0 dark:bg-orange-950/50 dark:text-orange-300">
                                                  +{item.additional_cost.toLocaleString('ar-LY')}
                                                  {item.additional_cost_notes && (
                                                    <span className="mr-1 text-[10px]">({item.additional_cost_notes})</span>
                                                  )}
                                                </Badge>
                                              )}
                                            </div>

                                            {/* أزرار التحكم */}
                                            <div className="flex items-center gap-1">
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => startEditingItem(item)}
                                                title="تعديل"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              {item.customer_installation_cost > 0 && (
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-7 w-7"
                                                  onClick={() => handleSetFree(item.id)}
                                                  disabled={distributing}
                                                  title="تحويل لمجاني"
                                                >
                                                  <Gift className="h-3 w-3 text-purple-600" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* زر تطبيق التسعير */}
              {pricingType === 'piece' && Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0) && (
                <Button
                  onClick={handleApplyQuickPricing}
                  disabled={distributing}
                  className="w-full gap-2"
                >
                  <Check className="h-4 w-4" />
                  {distributing ? 'جاري التطبيق...' : 'تطبيق جميع الأسعار بالقطعة'}
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
