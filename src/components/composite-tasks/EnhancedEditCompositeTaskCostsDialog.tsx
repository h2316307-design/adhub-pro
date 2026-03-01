import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { 
  Wrench, Printer, Scissors, DollarSign, Package, 
  TrendingUp, TrendingDown, Calculator, Ruler, ChevronDown, ChevronUp, 
  Box, Building2, Landmark, LayoutGrid, Check, Square, Zap, Gift, Pencil, X, Save
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CutoutCostSummary } from '@/components/cutout-tasks/CutoutCostSummary';
import { toast } from 'sonner';
import { CostAllocationSection, CostAllocationData, createDefaultCostAllocation } from './CostAllocationSection';

interface EnhancedEditCompositeTaskCostsDialogProps {
  task: CompositeTaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateCompositeTaskCostsInput) => void;
  isSaving?: boolean;
}

interface SizeData {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
  installation_price: number | null;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  customer_installation_cost: number;
  company_installation_cost: number | null;
  has_cutout?: boolean;
  additional_cost?: number;
  additional_cost_notes?: string | null;
  company_additional_cost?: number;
  company_additional_cost_notes?: string | null;
  pricing_type?: 'piece' | 'meter';
  price_per_meter?: number;
  faces_to_install?: number;
}

interface CutoutItem {
  id: string;
  billboard_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  description?: string | null;
  notes?: string | null;
}

interface Billboard {
  ID: number;
  Size: string;
  Faces_Count?: number;
  Billboard_Name?: string;
  billboard_type?: string;
  Nearest_Landmark?: string;
  Image_URL?: string;
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

// ════════════ Stat Card ════════════
const StatCard = ({ label, value, icon: Icon, color, suffix }: {
  label: string; value: string | number; icon: any; color: string; suffix?: string;
}) => (
  <div className={cn("flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card")}>
    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color)}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold leading-tight truncate">
        {typeof value === 'number' ? value.toLocaleString('ar-LY') : value}
        {suffix && <span className="text-xs font-normal text-muted-foreground mr-1">{suffix}</span>}
      </div>
    </div>
  </div>
);

export const EnhancedEditCompositeTaskCostsDialog: React.FC<EnhancedEditCompositeTaskCostsDialogProps> = ({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving = false
}) => {
  // بيانات التركيب
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [billboards, setBillboards] = useState<Record<number, Billboard>>({});
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});
  const [installationPrices, setInstallationPrices] = useState<Record<number, number>>({});
  
  // نوع التسعير
  const [pricingType, setPricingType] = useState<'piece' | 'meter'>('piece');
  
  // أسعار التسعير السريع - بالقطعة
  const [quickPrices, setQuickPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر - لكل مقاس
  const [meterPrices, setMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر لكل نوع لوحة
  const [typeMeterPrices, setTypeMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  
  // حالة الطي
  const [collapsedSizes, setCollapsedSizes] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  
  // حالة تعديل العناصر الفردية
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    companyCost: number; customerCost: number; additionalCost: number;
    additionalNotes: string; companyAdditionalCost: number; companyAdditionalNotes: string;
  }>({ companyCost: 0, customerCost: 0, additionalCost: 0, additionalNotes: '', companyAdditionalCost: 0, companyAdditionalNotes: '' });
  
  // تخزين تكاليف الشركة المعدلة محلياً
  const [customCompanyCosts, setCustomCompanyCosts] = useState<Record<string, number>>({});
  
  // تكاليف الطباعة
  const [totalPrintArea, setTotalPrintArea] = useState(0);
  const [customerPrintPerMeter, setCustomerPrintPerMeter] = useState(0);
  const [companyPrintPerMeter, setCompanyPrintPerMeter] = useState(0);
  
  // تكاليف القص
  const [cutoutItems, setCutoutItems] = useState<CutoutItem[]>([]);
  const [cutoutBillboards, setCutoutBillboards] = useState<Record<number, Billboard>>({});
  const [collapsedCutoutSizes, setCollapsedCutoutSizes] = useState<Set<string>>(new Set());
  
  // الخصم والملاحظات
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // توزيع التكاليف
  const [costAllocation, setCostAllocation] = useState<CostAllocationData>(createDefaultCostAllocation());
  
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [activeTab, setActiveTab] = useState('installation');

  useEffect(() => {
    if (task && open) {
      loadAllData();
      // Pick smart default tab
      if (task.installation_task_id) setActiveTab('installation');
      else if (task.print_task_id) setActiveTab('print');
      else if (task.cutout_task_id) setActiveTab('cutout');
      else setActiveTab('summary');
    }
  }, [task, open]);

  // ═══════════════ DATA LOADING ═══════════════
  const loadAllData = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const { data: sizesData } = await supabase.from('sizes').select('id, name, width, height, installation_price');
      if (sizesData) {
        const map: Record<string, SizeData> = {};
        sizesData.forEach((s: any) => { map[s.name] = s; map[s.name.toLowerCase()] = s; });
        setSizesMap(map);
      }

      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('id, billboard_id, customer_installation_cost, company_installation_cost, has_cutout, additional_cost, additional_cost_notes, company_additional_cost, company_additional_cost_notes, pricing_type, price_per_meter, faces_to_install')
          .eq('task_id', task.installation_task_id);
        
        if (installItems?.length) {
          setTaskItems(installItems as TaskItem[]);
          const savedCompanyCosts: Record<string, number> = {};
          const billboardIds = installItems.map(i => i.billboard_id);
          const { data: billboardsDataForCosts } = await supabase
            .from('billboards').select('"ID", "Size", "Faces_Count"').in('ID', billboardIds);
          
          installItems.forEach(item => {
            if (item.company_installation_cost != null && item.company_installation_cost > 0) {
              savedCompanyCosts[item.id] = item.company_installation_cost;
            } else {
              const bb = billboardsDataForCosts?.find((b: any) => b.ID === item.billboard_id);
              if (bb) {
                const sizeInfo = sizesData?.find(s => s.name === bb.Size);
                const basePrice = sizeInfo?.installation_price || 0;
                const faces = item.faces_to_install || bb.Faces_Count || 2;
                const calculatedCost = faces === 1 ? basePrice / 2 : (basePrice * faces / 2);
                if (calculatedCost > 0) savedCompanyCosts[item.id] = calculatedCost;
              }
            }
          });
          setCustomCompanyCosts(savedCompanyCosts);
          
          const hasMeterPricing = installItems.some(item => item.pricing_type === 'meter');
          if (hasMeterPricing) setPricingType('meter');
          
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('"ID", "Size", "Faces_Count", "Billboard_Name", "billboard_type", "Nearest_Landmark", "Image_URL"')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            const billboardMap: Record<number, Billboard> = {};
            const pricesMap: Record<number, number> = {};
            billboardsData.forEach((b: any) => {
              billboardMap[b.ID] = b;
              const sizeInfo = sizesData?.find(s => s.name === b.Size);
              const basePrice = sizeInfo?.installation_price || 0;
              const itemForBillboard = installItems?.find(i => i.billboard_id === b.ID);
              const faces = itemForBillboard?.faces_to_install || b.Faces_Count || 2;
              pricesMap[b.ID] = faces === 1 ? basePrice / 2 : (basePrice * faces / 2);
            });
            setBillboards(billboardMap);
            setInstallationPrices(pricesMap);
          }
          
          const allSizeKeys = new Set<string>();
          installItems.forEach(item => {
            const billboard = billboardsData?.find(b => b.ID === item.billboard_id);
            const billboardType = billboard?.billboard_type || 'عادية';
            const sizeName = billboard?.Size || 'غير محدد';
            allSizeKeys.add(`${billboardType}-${sizeName}`);
          });
          setCollapsedSizes(allSizeKeys);
        }
      }

      if (task.print_task_id) {
        const { data: printTaskData } = await supabase
          .from('print_tasks').select('total_area, total_cost, price_per_meter')
          .eq('id', task.print_task_id).single();
        if (printTaskData) {
          const area = printTaskData.total_area || 0;
          setTotalPrintArea(area);
          if (area > 0) {
            setCustomerPrintPerMeter((task.customer_print_cost || 0) / area);
            const actualCompanyPerMeter = printTaskData.price_per_meter || (printTaskData.total_cost ? printTaskData.total_cost / area : 0);
            setCompanyPrintPerMeter(actualCompanyPerMeter);
          }
        }
      }

      if (task.cutout_task_id) {
        const { data: cutoutItemsData } = await supabase
          .from('cutout_task_items')
          .select('id, billboard_id, quantity, unit_cost, total_cost, description, notes')
          .eq('task_id', task.cutout_task_id);
        if (cutoutItemsData?.length) {
          setCutoutItems(cutoutItemsData as unknown as CutoutItem[]);
          const cutoutBillboardIds = (cutoutItemsData as any[]).map(i => i.billboard_id).filter(Boolean);
          if (cutoutBillboardIds.length > 0) {
            const { data: cutoutBillboardsDataResult } = await supabase
              .from('billboards')
              .select('"ID", "Size", "Faces_Count", "Billboard_Name", "billboard_type", "Nearest_Landmark", "Image_URL"')
              .in('ID', cutoutBillboardIds);
            if (cutoutBillboardsDataResult) {
              const cutoutBillboardMap: Record<number, Billboard> = {};
              cutoutBillboardsDataResult.forEach((b: any) => { cutoutBillboardMap[b.ID] = b; });
              setCutoutBillboards(cutoutBillboardMap);
              const allCutoutSizeKeys = new Set<string>();
              (cutoutItemsData as any[]).forEach(item => {
                const billboard = cutoutBillboardsDataResult?.find((b: any) => b.ID === item.billboard_id);
                allCutoutSizeKeys.add(billboard?.Size || 'غير محدد');
              });
              setCollapsedCutoutSizes(allCutoutSizeKeys);
            }
          }
        }
      }

      setDiscountAmount(task.discount_amount || 0);
      setDiscountReason(task.discount_reason || '');
      setNotes(task.notes || '');
      const savedAllocation = (task as any).cost_allocation;
      if (savedAllocation) {
        setCostAllocation({ ...createDefaultCostAllocation(), ...savedAllocation });
      } else {
        setCostAllocation(createDefaultCostAllocation());
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════ CALCULATIONS ═══════════════
  const { totals, groupedData } = useMemo(() => {
    let companyCost = 0, customerCost = 0, additionalCost = 0, totalArea = 0;
    const grouped: Record<string, {
      type: string;
      sizes: Record<string, {
        size: string;
        items: Array<TaskItem & { billboard: Billboard; area: number }>;
        normalCount: number; cutoutCount: number; totalArea: number;
        companyCost: number; customerCost: number; avgAreaPerItem: number;
      }>;
      totalItems: number; totalArea: number; companyCost: number; customerCost: number;
    }> = {};

    taskItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      const billboardType = billboard?.billboard_type || 'عادية';
      const sizeName = billboard?.Size || 'غير محدد';
      const area = calculateAreaFromSizeData(sizeName, sizesMap);
      const faces = item.faces_to_install || billboard?.Faces_Count || 2;
      const itemArea = area * faces;
      const itemCompanyCost = customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
      const itemCompanyAdditional = item.company_additional_cost || 0;
      const itemCustomerCost = item.customer_installation_cost || 0;

      companyCost += itemCompanyCost + itemCompanyAdditional;
      customerCost += itemCustomerCost;
      additionalCost += item.additional_cost || 0;
      totalArea += itemArea;

      if (!grouped[billboardType]) {
        grouped[billboardType] = { type: billboardType, sizes: {}, totalItems: 0, totalArea: 0, companyCost: 0, customerCost: 0 };
      }
      if (!grouped[billboardType].sizes[sizeName]) {
        grouped[billboardType].sizes[sizeName] = { size: sizeName, items: [], normalCount: 0, cutoutCount: 0, totalArea: 0, companyCost: 0, customerCost: 0, avgAreaPerItem: 0 };
      }

      grouped[billboardType].sizes[sizeName].items.push({ ...item, billboard: billboard || { ID: item.billboard_id, Size: sizeName }, area: itemArea });
      grouped[billboardType].sizes[sizeName].totalArea += itemArea;
      grouped[billboardType].sizes[sizeName].companyCost += itemCompanyCost + itemCompanyAdditional;
      grouped[billboardType].sizes[sizeName].customerCost += itemCustomerCost;
      if (item.has_cutout) grouped[billboardType].sizes[sizeName].cutoutCount++;
      else grouped[billboardType].sizes[sizeName].normalCount++;
      grouped[billboardType].totalItems++;
      grouped[billboardType].totalArea += itemArea;
      grouped[billboardType].companyCost += itemCompanyCost + itemCompanyAdditional;
      grouped[billboardType].customerCost += itemCustomerCost;
    });

    Object.values(grouped).forEach(typeData => {
      Object.values(typeData.sizes).forEach(sizeData => {
        sizeData.avgAreaPerItem = sizeData.items.length > 0 ? sizeData.totalArea / sizeData.items.length : 0;
      });
    });

    return { totals: { companyCost, customerCost, additionalCost, totalArea, profit: customerCost - companyCost }, groupedData: grouped };
  }, [taskItems, installationPrices, billboards, sizesMap, customCompanyCosts]);

  const { customerCutoutTotal, companyCutoutTotal, totalCutouts } = useMemo(() => {
    let customer = 0, company = 0, count = 0;
    cutoutItems.forEach(item => {
      const itemCustomerCost = (item.total_cost ?? (item.unit_cost * item.quantity)) || 0;
      const itemCompanyCost = (item.unit_cost * item.quantity) || 0;
      customer += itemCustomerCost;
      company += itemCompanyCost;
      count += item.quantity;
    });
    return { customerCutoutTotal: customer, companyCutoutTotal: company, totalCutouts: count };
  }, [cutoutItems, cutoutBillboards]);

  const customerInstallationTotal = totals.customerCost;
  const companyInstallationTotal = totals.companyCost;
  const customerPrintTotal = customerPrintPerMeter * totalPrintArea;
  const companyPrintTotal = companyPrintPerMeter * totalPrintArea;
  const customerSubtotal = customerInstallationTotal + customerPrintTotal + customerCutoutTotal;
  const customerTotal = customerSubtotal - discountAmount;
  const companyTotal = companyInstallationTotal + companyPrintTotal + companyCutoutTotal;
  const netProfit = customerTotal - companyTotal;
  const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

  // ═══════════════ HANDLERS ═══════════════
  const startEditingItem = (item: TaskItem & { billboard: Billboard; area: number }) => {
    setEditingItemId(item.id);
    const existingCompanyCost = customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
    setEditValues({
      companyCost: existingCompanyCost, customerCost: item.customer_installation_cost || 0,
      additionalCost: item.additional_cost || 0, additionalNotes: item.additional_cost_notes || '',
      companyAdditionalCost: item.company_additional_cost || 0, companyAdditionalNotes: item.company_additional_cost_notes || ''
    });
  };

  const updateCompositeTaskInstallationCosts = async (newCustomerTotal: number, newCompanyTotal: number) => {
    if (!task) return;
    try {
      const discountAmt = discountAmount || 0;
      const customerSubtotalCalc = newCustomerTotal + customerPrintTotal + customerCutoutTotal;
      const customerTotalCalc = customerSubtotalCalc - discountAmt;
      const companyTotalCalc = newCompanyTotal + companyPrintTotal + companyCutoutTotal;
      const netProfitCalc = customerTotalCalc - companyTotalCalc;
      const profitPercentageCalc = customerTotalCalc > 0 ? (netProfitCalc / customerTotalCalc) * 100 : 0;

      await supabase.from('composite_tasks').update({
        customer_installation_cost: newCustomerTotal, company_installation_cost: newCompanyTotal,
        customer_total: customerTotalCalc, company_total: companyTotalCalc,
        net_profit: netProfitCalc, profit_percentage: profitPercentageCalc, updated_at: new Date().toISOString()
      }).eq('id', task.id);

      if (task.combined_invoice_id) {
        await supabase.from('printed_invoices').update({ total_amount: customerTotalCalc, updated_at: new Date().toISOString() }).eq('id', task.combined_invoice_id);
        await supabase.from('customer_payments').update({ amount: -customerTotalCalc }).eq('printed_invoice_id', task.combined_invoice_id).eq('entry_type', 'invoice');
      }
    } catch (error) {
      console.error('Error updating composite task costs:', error);
    }
  };

  const handleSaveItemEdit = async () => {
    if (!editingItemId) return;
    setDistributing(true);
    try {
      setCustomCompanyCosts(prev => ({ ...prev, [editingItemId]: editValues.companyCost }));
      const { error } = await supabase.from('installation_task_items').update({
        customer_installation_cost: editValues.customerCost, company_installation_cost: editValues.companyCost,
        additional_cost: editValues.additionalCost || null, additional_cost_notes: editValues.additionalNotes || null,
        company_additional_cost: editValues.companyAdditionalCost || null, company_additional_cost_notes: editValues.companyAdditionalNotes || null
      }).eq('id', editingItemId);
      if (error) throw error;
      
      const newItems = taskItems.map(item => 
        item.id === editingItemId ? { ...item, customer_installation_cost: editValues.customerCost, company_installation_cost: editValues.companyCost,
          additional_cost: editValues.additionalCost, additional_cost_notes: editValues.additionalNotes,
          company_additional_cost: editValues.companyAdditionalCost, company_additional_cost_notes: editValues.companyAdditionalNotes } : item
      );
      setTaskItems(newItems);
      
      let newCustomerTotal = 0, newCompanyTotal = 0;
      newItems.forEach(item => {
        const companyPrice = item.id === editingItemId ? editValues.companyCost : (customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0);
        const companyExtra = item.id === editingItemId ? editValues.companyAdditionalCost : (item.company_additional_cost || 0);
        newCustomerTotal += item.customer_installation_cost || 0;
        newCompanyTotal += companyPrice + companyExtra;
      });
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم الحفظ');
      setEditingItemId(null);
    } catch (error) { toast.error('فشل الحفظ'); }
    finally { setDistributing(false); }
  };

  const handleSetFree = async (itemId: string) => {
    setDistributing(true);
    try {
      await supabase.from('installation_task_items').update({ customer_installation_cost: 0 }).eq('id', itemId);
      const newItems = taskItems.map(item => item.id === itemId ? { ...item, customer_installation_cost: 0 } : item);
      setTaskItems(newItems);
      let newCustomerTotal = 0, newCompanyTotal = 0;
      newItems.forEach(item => {
        newCustomerTotal += item.customer_installation_cost || 0;
        newCompanyTotal += customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
      });
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم التحويل لمجاني');
    } catch { toast.error('فشل التحويل'); }
    finally { setDistributing(false); }
  };

  const handleSetAllFree = async () => {
    if (taskItems.length === 0) return;
    setDistributing(true);
    try {
      await Promise.all(taskItems.map(item => supabase.from('installation_task_items').update({ customer_installation_cost: 0 }).eq('id', item.id)));
      setTaskItems(prev => prev.map(item => ({ ...item, customer_installation_cost: 0 })));
      let newCompanyTotal = 0;
      taskItems.forEach(item => { newCompanyTotal += customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0; });
      await updateCompositeTaskInstallationCosts(0, newCompanyTotal);
      toast.success(`تم تحويل ${taskItems.length} لوحة لمجانية`);
    } catch { toast.error('فشل التحويل'); }
    finally { setDistributing(false); }
  };

  const handleApplyQuickPricing = async () => {
    const hasAnyPrice = Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0);
    if (!hasAnyPrice) { toast.error('أدخل سعر واحد على الأقل'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const pricing = quickPrices[sizeName];
        if (pricing) {
          const newCost = item.has_cutout ? pricing.cutout : pricing.normal;
          if (newCost > 0) {
            newItems[idx] = { ...item, customer_installation_cost: newCost };
            await supabase.from('installation_task_items').update({ customer_installation_cost: newCost, pricing_type: 'piece', price_per_meter: 0 }).eq('id', item.id);
          }
        }
        newCustomerTotal += newItems[idx].customer_installation_cost || 0;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم تطبيق الأسعار');
      setQuickPrices({});
    } catch { toast.error('فشل في التطبيق'); }
    finally { setDistributing(false); }
  };

  const handleApplyMeterToSize = async (sizeName: string) => {
    const meterPrice = meterPrices[sizeName];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) { toast.error('أدخل سعر المتر أولاً'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        if (billboard?.Size === sizeName) {
          const area = calculateAreaFromSizeData(sizeName, sizesMap);
          const faces = item.faces_to_install || billboard?.Faces_Count || 2;
          const pricePerMeter = item.has_cutout ? meterPrice.cutout : meterPrice.normal;
          if (pricePerMeter > 0) {
            const cost = Math.round(pricePerMeter * area * faces * 100) / 100;
            newItems[idx] = { ...item, customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter };
            await supabase.from('installation_task_items').update({ customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter }).eq('id', item.id);
          }
        }
        newCustomerTotal += newItems[idx].customer_installation_cost || 0;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success(`تم تطبيق السعر على ${sizeName}`);
    } catch { toast.error('فشل في التطبيق'); }
    finally { setDistributing(false); }
  };

  const handleApplyMeterToType = async (billboardType: string) => {
    const meterPrice = typeMeterPrices[billboardType];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) { toast.error('أدخل سعر المتر أولاً'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        if (billboard?.billboard_type === billboardType) {
          const sizeName = billboard?.Size || '';
          const area = calculateAreaFromSizeData(sizeName, sizesMap);
          const faces = item.faces_to_install || billboard?.Faces_Count || 2;
          const pricePerMeter = item.has_cutout ? meterPrice.cutout : meterPrice.normal;
          if (pricePerMeter > 0) {
            const cost = Math.round(pricePerMeter * area * faces * 100) / 100;
            newItems[idx] = { ...item, customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter };
            await supabase.from('installation_task_items').update({ customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter }).eq('id', item.id);
          }
        }
        newCustomerTotal += newItems[idx].customer_installation_cost || 0;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success(`تم تطبيق السعر على ${billboardType}`);
      setTypeMeterPrices(prev => { const u = { ...prev }; delete u[billboardType]; return u; });
    } catch { toast.error('فشل في التطبيق'); }
    finally { setDistributing(false); }
  };

  const toggleSizeCollapse = (sizeKey: string) => {
    setCollapsedSizes(prev => { const u = new Set(prev); u.has(sizeKey) ? u.delete(sizeKey) : u.add(sizeKey); return u; });
  };
  const toggleTypeCollapse = (typeKey: string) => {
    setCollapsedTypes(prev => { const u = new Set(prev); u.has(typeKey) ? u.delete(typeKey) : u.add(typeKey); return u; });
  };

  const handleSave = () => {
    if (!task) return;
    const totalServiceDiscounts = 
      (costAllocation.print.enabled ? costAllocation.print.discount : 0) +
      (costAllocation.cutout.enabled ? costAllocation.cutout.discount : 0) +
      (costAllocation.installation.enabled ? costAllocation.installation.discount : 0);
    const hasAnyAllocation = costAllocation.print.enabled || costAllocation.cutout.enabled || costAllocation.installation.enabled;
    onSave({
      id: task.id,
      customer_installation_cost: customerInstallationTotal, company_installation_cost: companyInstallationTotal,
      customer_print_cost: customerPrintTotal, company_print_cost: companyPrintTotal,
      customer_cutout_cost: customerCutoutTotal, company_cutout_cost: companyCutoutTotal,
      discount_amount: discountAmount + totalServiceDiscounts, discount_reason: discountReason.trim() || undefined,
      notes: notes.trim() || undefined, cost_allocation: hasAnyAllocation ? costAllocation : undefined,
      print_discount: costAllocation.print.enabled ? costAllocation.print.discount : 0,
      print_discount_reason: costAllocation.print.enabled ? costAllocation.print.discount_reason : undefined,
      cutout_discount: costAllocation.cutout.enabled ? costAllocation.cutout.discount : 0,
      cutout_discount_reason: costAllocation.cutout.enabled ? costAllocation.cutout.discount_reason : undefined,
      installation_discount: costAllocation.installation.enabled ? costAllocation.installation.discount : 0,
      installation_discount_reason: costAllocation.installation.enabled ? costAllocation.installation.discount_reason : undefined,
    });
  };

  if (!task) return null;

  const billboardTypes = Object.keys(groupedData);

  // ═══════════════ TAB COUNTS ═══════════════
  const tabCounts = {
    installation: taskItems.length,
    print: totalPrintArea > 0 ? 1 : 0,
    cutout: cutoutItems.length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* ═══════ STICKY HEADER ═══════ */}
        <div className="shrink-0 border-b border-border/50 bg-card/95 backdrop-blur-sm">
          <SheetHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                تعديل التكاليف
              </SheetTitle>
              <Badge variant={task.task_type === 'new_installation' ? 'default' : 'secondary'} className="text-xs">
                {task.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}
              </Badge>
            </div>
            <SheetDescription className="flex items-center gap-2 text-sm mt-1">
              <span className="font-semibold text-foreground">{task.customer_name}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">عقد #{task.contract_id}</span>
            </SheetDescription>
          </SheetHeader>

          {/* Quick Stats */}
          <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/30">
              <DollarSign className="h-4 w-4 text-primary shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground">المستحق</div>
                <div className="text-sm font-bold text-primary">{customerTotal.toLocaleString('ar-LY')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/30">
              <Building2 className="h-4 w-4 text-orange-500 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground">التكلفة</div>
                <div className="text-sm font-bold text-orange-500">{companyTotal.toLocaleString('ar-LY')}</div>
              </div>
            </div>
            <div className={cn("flex items-center gap-2 p-2 rounded-lg border border-border/30", 
              netProfit >= 0 ? "bg-emerald-500/5" : "bg-destructive/5")}>
              {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" /> : <TrendingDown className="h-4 w-4 text-destructive shrink-0" />}
              <div>
                <div className="text-[10px] text-muted-foreground">الربح</div>
                <div className={cn("text-sm font-bold", netProfit >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {netProfit.toLocaleString('ar-LY')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/30">
              <Calculator className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground">النسبة</div>
                <div className={cn("text-sm font-bold", profitPercentage >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {profitPercentage.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ TABS CONTENT ═══════ */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 pt-2 border-b border-border/30">
              <TabsList className="w-full justify-start bg-transparent gap-1 h-auto p-0">
                {task.installation_task_id && (
                  <TabsTrigger value="installation" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-t-lg rounded-b-none border-b-2 data-[state=active]:border-primary border-transparent px-3 py-2 text-xs gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    التركيب
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 mr-1">{tabCounts.installation}</Badge>
                  </TabsTrigger>
                )}
                {task.print_task_id && totalPrintArea > 0 && (
                  <TabsTrigger value="print" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-t-lg rounded-b-none border-b-2 data-[state=active]:border-blue-500 border-transparent px-3 py-2 text-xs gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    الطباعة
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 mr-1">{totalPrintArea.toFixed(0)} م²</Badge>
                  </TabsTrigger>
                )}
                {task.cutout_task_id && (
                  <TabsTrigger value="cutout" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 rounded-t-lg rounded-b-none border-b-2 data-[state=active]:border-purple-500 border-transparent px-3 py-2 text-xs gap-1.5">
                    <Scissors className="h-3.5 w-3.5" />
                    المجسمات
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 mr-1">{totalCutouts}</Badge>
                  </TabsTrigger>
                )}
                <TabsTrigger value="summary" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-t-lg rounded-b-none border-b-2 data-[state=active]:border-emerald-500 border-transparent px-3 py-2 text-xs gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  الملخص
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              {/* ═══════ TAB: تركيب ═══════ */}
              <TabsContent value="installation" className="mt-0 p-4 space-y-4">
                {/* طريقة التسعير */}
                <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                  <Calculator className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-primary ml-2">طريقة الحساب:</span>
                  <div className="flex-1 grid grid-cols-2 gap-1.5">
                    <button onClick={() => setPricingType('piece')}
                      className={cn("py-1.5 px-3 rounded-lg text-xs font-medium transition-all", 
                        pricingType === 'piece' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border hover:border-primary/40')}>
                      <Square className="h-3 w-3 inline ml-1" /> بالقطعة
                    </button>
                    <button onClick={() => setPricingType('meter')}
                      className={cn("py-1.5 px-3 rounded-lg text-xs font-medium transition-all", 
                        pricingType === 'meter' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border hover:border-primary/40')}>
                      <Ruler className="h-3 w-3 inline ml-1" /> بالمتر المربع
                    </button>
                  </div>
                </div>

                {/* إحصائيات سريعة */}
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="م² إجمالي" value={totals.totalArea.toFixed(0)} icon={Ruler} color="bg-muted" />
                  <StatCard label="تكلفة الشركة" value={totals.companyCost} icon={Building2} color="bg-orange-500/10 text-orange-500" />
                  <StatCard label="تكلفة الزبون" value={totals.customerCost} icon={DollarSign} color="bg-primary/10 text-primary" />
                </div>

                {/* زر تحويل الكل لمجاني */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" /> تفاصيل اللوحات
                  </h3>
                  <Button size="sm" variant="outline" onClick={handleSetAllFree}
                    disabled={distributing || totals.customerCost === 0}
                    className="gap-1.5 text-xs h-7 text-purple-600 border-purple-300 hover:bg-purple-50">
                    <Gift className="h-3 w-3" /> تحويل الكل لمجاني
                  </Button>
                </div>

                {/* تفاصيل اللوحات حسب النوع */}
                {billboardTypes.map(type => {
                  const typeData = groupedData[type];
                  const Icon = BILLBOARD_TYPE_ICONS[type] || LayoutGrid;
                  const isTypeCollapsed = collapsedTypes.has(type);
                  
                  return (
                    <div key={type} className="border rounded-xl overflow-hidden bg-card">
                      <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleTypeCollapse(type)}>
                        <div className="flex items-center gap-2">
                          {isTypeCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                          <Icon className="h-4 w-4" />
                          <span className="font-semibold text-sm">{type}</span>
                          <Badge variant="outline" className="text-[10px]">{typeData.totalItems} لوحة</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{typeData.totalArea.toFixed(0)} م²</span>
                          <span className="font-medium">الشركة: {typeData.companyCost.toLocaleString('ar-LY')}</span>
                          <span className="font-bold text-primary">الزبون: {typeData.customerCost.toLocaleString('ar-LY')}</span>
                        </div>
                      </div>

                      {/* تسعير النوع بالمتر */}
                      {!isTypeCollapsed && pricingType === 'meter' && (
                        <div className="p-3 border-b bg-primary/5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-primary flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5" /> تسعير {type}:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">عادي/م²:</Label>
                            <Input type="number" min="0" step="0.1" placeholder="0" className="h-7 w-20 text-xs"
                              value={typeMeterPrices[type]?.normal || ''}
                              onChange={e => setTypeMeterPrices(prev => ({ ...prev, [type]: { ...prev[type], normal: Number(e.target.value) || 0, cutout: prev[type]?.cutout || 0 }}))} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[10px] text-amber-600 whitespace-nowrap">مجسم/م²:</Label>
                            <Input type="number" min="0" step="0.1" placeholder="0" className="h-7 w-20 text-xs border-amber-300"
                              value={typeMeterPrices[type]?.cutout || ''}
                              onChange={e => setTypeMeterPrices(prev => ({ ...prev, [type]: { ...prev[type], normal: prev[type]?.normal || 0, cutout: Number(e.target.value) || 0 }}))} />
                          </div>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApplyMeterToType(type)}
                            disabled={distributing || (!typeMeterPrices[type]?.normal && !typeMeterPrices[type]?.cutout)}>
                            <Check className="h-3 w-3" /> تطبيق
                          </Button>
                        </div>
                      )}

                      {!isTypeCollapsed && (
                        <div className="divide-y divide-border/30">
                          {Object.values(typeData.sizes).map(sizeData => {
                            const sizeKey = `${type}-${sizeData.size}`;
                            const isCollapsed = collapsedSizes.has(sizeKey);

                            return (
                              <div key={sizeKey}>
                                {/* رأس المقاس */}
                                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 cursor-pointer hover:bg-muted/30"
                                  onClick={() => toggleSizeCollapse(sizeKey)}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                                    <Badge variant="outline" className="text-xs font-mono">{sizeData.size}</Badge>
                                    <span className="text-[10px] text-muted-foreground">{sizeData.items.length} لوحة • {sizeData.totalArea.toFixed(1)} م²</span>
                                    {sizeData.cutoutCount > 0 && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-300">{sizeData.cutoutCount} مجسم</Badge>}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-muted-foreground">الشركة: {sizeData.companyCost.toLocaleString('ar-LY')}</span>
                                    <span className="font-semibold text-primary">الزبون: {sizeData.customerCost.toLocaleString('ar-LY')}</span>
                                  </div>
                                </div>

                                {/* تسعير المقاس */}
                                {!isCollapsed && pricingType === 'piece' && (
                                  <div className="px-3 py-2 border-b bg-muted/10 flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">سعر القطعة:</span>
                                    <div className="flex items-center gap-1">
                                      <Input type="number" min="0" placeholder="عادي" className="h-7 w-20 text-xs"
                                        value={quickPrices[sizeData.size]?.normal || ''}
                                        onChange={e => setQuickPrices(prev => ({ ...prev, [sizeData.size]: { ...prev[sizeData.size], normal: Number(e.target.value) || 0, cutout: prev[sizeData.size]?.cutout || 0 }}))} />
                                    </div>
                                    {sizeData.cutoutCount > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Box className="h-3 w-3 text-amber-600" />
                                        <Input type="number" min="0" placeholder="مجسم" className="h-7 w-20 text-xs border-amber-300"
                                          value={quickPrices[sizeData.size]?.cutout || ''}
                                          onChange={e => setQuickPrices(prev => ({ ...prev, [sizeData.size]: { ...prev[sizeData.size], normal: prev[sizeData.size]?.normal || 0, cutout: Number(e.target.value) || 0 }}))} />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!isCollapsed && pricingType === 'meter' && (
                                  <div className="px-3 py-2 border-b bg-muted/10 flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">سعر المتر:</span>
                                    <Input type="number" min="0" step="0.1" placeholder="عادي" className="h-7 w-20 text-xs"
                                      value={meterPrices[sizeData.size]?.normal || ''}
                                      onChange={e => setMeterPrices(prev => ({ ...prev, [sizeData.size]: { ...prev[sizeData.size], normal: Number(e.target.value) || 0, cutout: prev[sizeData.size]?.cutout || 0 }}))} />
                                    {sizeData.cutoutCount > 0 && (
                                      <Input type="number" min="0" step="0.1" placeholder="مجسم" className="h-7 w-20 text-xs border-amber-300"
                                        value={meterPrices[sizeData.size]?.cutout || ''}
                                        onChange={e => setMeterPrices(prev => ({ ...prev, [sizeData.size]: { ...prev[sizeData.size], normal: prev[sizeData.size]?.normal || 0, cutout: Number(e.target.value) || 0 }}))} />
                                    )}
                                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApplyMeterToSize(sizeData.size)}
                                      disabled={distributing || (!meterPrices[sizeData.size]?.normal && !meterPrices[sizeData.size]?.cutout)}>
                                      <Check className="h-3 w-3" /> تطبيق
                                    </Button>
                                  </div>
                                )}

                                {/* عناصر اللوحات - بطاقات محسنة */}
                                {!isCollapsed && (
                                  <div className="p-2 space-y-2">
                                    {sizeData.items.map((item, idx) => {
                                      const itemCompanyCost = (customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0) + (item.company_additional_cost || 0);
                                      const faces = item.faces_to_install || item.billboard.Faces_Count || 2;
                                      const itemArea = item.area;
                                      const itemPrintCostCustomer = customerPrintPerMeter * itemArea;
                                      const itemPrintCostCompany = companyPrintPerMeter * itemArea;
                                      
                                      if (editingItemId === item.id) {
                                        return (
                                          <div key={item.id} className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                {item.billboard.Image_URL ? (
                                                  <img src={item.billboard.Image_URL} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-primary/30 shadow-sm" />
                                                ) : (
                                                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center border">
                                                    <LayoutGrid className="h-6 w-6 text-muted-foreground" />
                                                  </div>
                                                )}
                                                <div>
                                                  <span className="font-bold text-sm">{item.billboard.Billboard_Name || `لوحة ${item.billboard_id}`}</span>
                                                  {item.billboard.Nearest_Landmark && (
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                      <Landmark className="h-3 w-3" /> {item.billboard.Nearest_Landmark}
                                                    </div>
                                                  )}
                                                  <div className="text-[10px] text-muted-foreground mt-0.5">{faces} أوجه • {itemArea.toFixed(1)} م²</div>
                                                </div>
                                              </div>
                                              <div className="flex gap-1.5">
                                                <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSaveItemEdit} disabled={distributing}>
                                                  <Save className="h-3.5 w-3.5" /> حفظ
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditingItemId(null)}>
                                                  <X className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-orange-500 font-medium">تكلفة الشركة (تركيب)</Label>
                                                <Input type="number" min="0" value={editValues.companyCost} onChange={e => setEditValues(prev => ({...prev, companyCost: Number(e.target.value) || 0}))} className="h-8 text-xs" />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-primary font-medium">تكلفة الزبون (تركيب)</Label>
                                                <div className="flex gap-1">
                                                  <Input type="number" min="0" value={editValues.customerCost} onChange={e => setEditValues(prev => ({...prev, customerCost: Number(e.target.value) || 0}))} className="h-8 text-xs" />
                                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0" onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0 }))} title="مجاني">
                                                    <Gift className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-amber-600">إضافية على الزبون</Label>
                                                <Input type="number" min="0" value={editValues.additionalCost || ''} onChange={e => setEditValues(prev => ({...prev, additionalCost: Number(e.target.value) || 0}))} placeholder="0" className="h-8 text-xs" />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-orange-600">إضافية على الشركة</Label>
                                                <Input type="number" min="0" value={editValues.companyAdditionalCost || ''} onChange={e => setEditValues(prev => ({...prev, companyAdditionalCost: Number(e.target.value) || 0}))} placeholder="0" className="h-8 text-xs" />
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">سبب إضافية الزبون</Label>
                                                <Input value={editValues.additionalNotes} onChange={e => setEditValues(prev => ({...prev, additionalNotes: e.target.value}))} placeholder="موقع صعب..." className="h-8 text-xs" />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">سبب إضافية الشركة</Label>
                                                <Input value={editValues.companyAdditionalNotes} onChange={e => setEditValues(prev => ({...prev, companyAdditionalNotes: e.target.value}))} placeholder="رافعة..." className="h-8 text-xs" />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div key={item.id} className="group rounded-xl border border-border/60 hover:border-primary/30 bg-card hover:bg-muted/20 transition-all duration-200 overflow-hidden">
                                          <div className="flex items-stretch">
                                            {/* صورة اللوحة */}
                                            <div className="w-20 sm:w-24 shrink-0 relative">
                                              {item.billboard.Image_URL ? (
                                                <img src={item.billboard.Image_URL} alt="" className="w-full h-full object-cover min-h-[80px]" />
                                              ) : (
                                                <div className="w-full h-full min-h-[80px] bg-muted/50 flex items-center justify-center">
                                                  <LayoutGrid className="h-6 w-6 text-muted-foreground/50" />
                                                </div>
                                              )}
                                              <div className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                                                #{idx + 1}
                                              </div>
                                              {item.has_cutout && (
                                                <div className="absolute bottom-1 right-1 bg-amber-500/90 text-white rounded-md px-1.5 py-0.5 text-[8px] font-bold">
                                                  مجسم
                                                </div>
                                              )}
                                            </div>

                                            {/* محتوى البطاقة */}
                                            <div className="flex-1 p-2.5 min-w-0">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                  <div className="font-bold text-sm truncate">{item.billboard.Billboard_Name || `TR-TC${String(item.billboard_id).padStart(4, '0')}`}</div>
                                                  {item.billboard.Nearest_Landmark && (
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                                      <Landmark className="h-3 w-3 shrink-0 text-primary/60" />
                                                      <span className="truncate">{item.billboard.Nearest_Landmark}</span>
                                                    </div>
                                                  )}
                                                </div>
                                                {/* أزرار الإجراءات */}
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditingItem(item)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                  </Button>
                                                  {item.customer_installation_cost > 0 && (
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-purple-600" onClick={() => handleSetFree(item.id)} disabled={distributing}>
                                                      <Gift className="h-3.5 w-3.5" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>

                                              {/* معلومات المساحة والأوجه */}
                                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 font-mono">{itemArea.toFixed(1)} م²</Badge>
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5">{faces} وجه</Badge>
                                                {item.pricing_type === 'meter' && (
                                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 bg-blue-500/10 text-blue-600 border-blue-300">بالمتر</Badge>
                                                )}
                                              </div>

                                              {/* التكاليف */}
                                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                                {/* تكاليف التركيب */}
                                                <div className="flex items-center justify-between text-[11px]">
                                                  <span className="text-muted-foreground flex items-center gap-1">
                                                    <Wrench className="h-2.5 w-2.5" /> تركيب:
                                                  </span>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-orange-500 font-medium">{itemCompanyCost.toLocaleString('ar-LY')}</span>
                                                    <span className="text-muted-foreground/40">/</span>
                                                    {item.customer_installation_cost === 0 ? (
                                                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 text-[9px] px-1 py-0 h-4">
                                                        <Gift className="h-2 w-2 ml-0.5" />مجاني
                                                      </Badge>
                                                    ) : (
                                                      <span className="font-bold text-primary">{item.customer_installation_cost.toLocaleString('ar-LY')}</span>
                                                    )}
                                                  </div>
                                                </div>
                                                {/* تكاليف الطباعة */}
                                                {(customerPrintPerMeter > 0 || companyPrintPerMeter > 0) && (
                                                  <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                      <Printer className="h-2.5 w-2.5 text-blue-500" /> طباعة:
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-blue-500 font-medium">{itemPrintCostCompany.toLocaleString('ar-LY', { maximumFractionDigits: 0 })}</span>
                                                      <span className="text-muted-foreground/40">/</span>
                                                      <span className="font-bold text-blue-600">{itemPrintCostCustomer.toLocaleString('ar-LY', { maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {/* ملخص المقاس */}
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 text-xs font-semibold border border-border/30">
                                      <span className="text-muted-foreground">{sizeData.items.length} لوحة • {sizeData.totalArea.toFixed(1)} م²</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-orange-500">الشركة: {sizeData.companyCost.toLocaleString('ar-LY')}</span>
                                        <span className="text-primary">الزبون: {sizeData.customerCost.toLocaleString('ar-LY')}</span>
                                      </div>
                                    </div>
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

                {/* زر تطبيق أسعار القطعة */}
                {pricingType === 'piece' && Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0) && (
                  <Button onClick={handleApplyQuickPricing} disabled={distributing} className="w-full gap-2">
                    <Check className="h-4 w-4" />
                    {distributing ? 'جاري التطبيق...' : 'تطبيق جميع الأسعار بالقطعة'}
                  </Button>
                )}
              </TabsContent>

              {/* ═══════ TAB: طباعة ═══════ */}
              <TabsContent value="print" className="mt-0 p-4 space-y-4">
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-500/10 mb-3">
                    <Printer className="h-7 w-7 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-lg">تكاليف الطباعة</h3>
                  <p className="text-sm text-muted-foreground mt-1">المساحة الإجمالية: {totalPrintArea.toFixed(1)} م²</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        سعر المتر (للزبون)
                      </Label>
                      <Input type="number" value={customerPrintPerMeter}
                        onChange={(e) => setCustomerPrintPerMeter(Number(e.target.value) || 0)}
                        className="text-lg font-bold" min="0" step="0.1" />
                      <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-emerald-500/5">
                        <span className="text-muted-foreground">الإجمالي:</span>
                        <span className="font-bold text-emerald-600 text-base">{customerPrintTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        سعر المتر (للشركة)
                      </Label>
                      <Input type="number" value={companyPrintPerMeter}
                        onChange={(e) => setCompanyPrintPerMeter(Number(e.target.value) || 0)}
                        className="text-lg font-bold" min="0" step="0.1" />
                      <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-blue-500/5">
                        <span className="text-muted-foreground">الإجمالي:</span>
                        <span className="font-bold text-blue-600 text-base">{companyPrintTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ربح الطباعة */}
                <div className={cn("p-4 rounded-xl border-2 text-center", 
                  customerPrintTotal - companyPrintTotal >= 0 ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20")}>
                  <div className="text-xs text-muted-foreground mb-1">ربح الطباعة</div>
                  <div className={cn("text-2xl font-bold", customerPrintTotal - companyPrintTotal >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {(customerPrintTotal - companyPrintTotal).toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              </TabsContent>

              {/* ═══════ TAB: مجسمات ═══════ */}
              <TabsContent value="cutout" className="mt-0 p-4 space-y-4">
                {task.cutout_task_id && (
                  <CutoutCostSummary
                    taskId={task.cutout_task_id}
                    items={cutoutItems.map(item => {
                      const billboard = cutoutBillboards[item.billboard_id];
                      const faceType = item.description?.includes('B') || item.description?.includes('خلفي') ? 'B' : 'A';
                      return {
                        id: item.id, description: item.description || null,
                        quantity: item.quantity, unit_cost: item.unit_cost, total_cost: item.total_cost,
                        cutout_image_url: null, status: 'pending',
                        billboard_name: billboard?.Billboard_Name || null, billboard_size: billboard?.Size || null,
                        nearest_landmark: billboard?.Nearest_Landmark || null, billboard_id: item.billboard_id || null,
                        face_type: faceType as 'A' | 'B'
                      };
                    })}
                    customerTotalAmount={customerCutoutTotal}
                    unitCost={cutoutItems[0]?.unit_cost || 0}
                    totalCost={companyCutoutTotal}
                    onRefresh={loadAllData}
                  />
                )}
              </TabsContent>

              {/* ═══════ TAB: ملخص ═══════ */}
              <TabsContent value="summary" className="mt-0 p-4 space-y-4">
                {/* جدول الملخص */}
                <Card className={cn("border-2", netProfit >= 0 ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900")}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">ملخص الربحية</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-hidden rounded-b-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-right p-3 font-medium">العنصر</th>
                            <th className="text-center p-3 font-medium text-emerald-700">الزبون</th>
                            <th className="text-center p-3 font-medium text-blue-700">الشركة</th>
                            <th className="text-center p-3 font-medium">الربح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(customerInstallationTotal > 0 || companyInstallationTotal > 0) && (
                            <tr className="border-t">
                              <td className="p-3 flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-600" /> التركيب</td>
                              <td className="p-3 text-center font-medium text-emerald-700">{customerInstallationTotal.toLocaleString('ar-LY')}</td>
                              <td className="p-3 text-center font-medium text-blue-700">{companyInstallationTotal.toLocaleString('ar-LY')}</td>
                              <td className={cn("p-3 text-center font-medium", customerInstallationTotal - companyInstallationTotal >= 0 ? "text-emerald-600" : "text-destructive")}>
                                {(customerInstallationTotal - companyInstallationTotal).toLocaleString('ar-LY')}
                              </td>
                            </tr>
                          )}
                          {(customerPrintTotal > 0 || companyPrintTotal > 0) && (
                            <tr className="border-t">
                              <td className="p-3 flex items-center gap-2"><Printer className="h-4 w-4 text-blue-600" /> الطباعة</td>
                              <td className="p-3 text-center font-medium text-emerald-700">{customerPrintTotal.toLocaleString('ar-LY')}</td>
                              <td className="p-3 text-center font-medium text-blue-700">{companyPrintTotal.toLocaleString('ar-LY')}</td>
                              <td className={cn("p-3 text-center font-medium", customerPrintTotal - companyPrintTotal >= 0 ? "text-emerald-600" : "text-destructive")}>
                                {(customerPrintTotal - companyPrintTotal).toLocaleString('ar-LY')}
                              </td>
                            </tr>
                          )}
                          {(customerCutoutTotal > 0 || companyCutoutTotal > 0) && (
                            <tr className="border-t">
                              <td className="p-3 flex items-center gap-2"><Scissors className="h-4 w-4 text-purple-600" /> القص</td>
                              <td className="p-3 text-center font-medium text-emerald-700">{customerCutoutTotal.toLocaleString('ar-LY')}</td>
                              <td className="p-3 text-center font-medium text-blue-700">{companyCutoutTotal.toLocaleString('ar-LY')}</td>
                              <td className={cn("p-3 text-center font-medium", customerCutoutTotal - companyCutoutTotal >= 0 ? "text-emerald-600" : "text-destructive")}>
                                {(customerCutoutTotal - companyCutoutTotal).toLocaleString('ar-LY')}
                              </td>
                            </tr>
                          )}
                          {discountAmount > 0 && (
                            <tr className="border-t bg-destructive/5">
                              <td className="p-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-destructive" /> الخصم</td>
                              <td className="p-3 text-center text-destructive font-medium">-{discountAmount.toLocaleString('ar-LY')}</td>
                              <td className="p-3 text-center">-</td>
                              <td className="p-3 text-center text-destructive font-medium">-{discountAmount.toLocaleString('ar-LY')}</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-muted/30 font-bold border-t-2">
                          <tr>
                            <td className="p-3">الإجمالي</td>
                            <td className="p-3 text-center text-emerald-700 text-base">{customerTotal.toLocaleString('ar-LY')}</td>
                            <td className="p-3 text-center text-blue-700 text-base">{companyTotal.toLocaleString('ar-LY')}</td>
                            <td className={cn("p-3 text-center text-base flex items-center justify-center gap-1",
                              netProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
                              {netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              {netProfit.toLocaleString('ar-LY')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="text-center py-3 border-t">
                      <span className="text-sm text-muted-foreground">نسبة الربح: </span>
                      <span className={cn("text-xl font-bold", profitPercentage >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {profitPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* توزيع التكاليف */}
                <CostAllocationSection
                  allocation={costAllocation}
                  onChange={setCostAllocation}
                  hasPrint={!!task.print_task_id && customerPrintTotal > 0}
                  hasCutout={!!task.cutout_task_id && customerCutoutTotal > 0}
                  hasInstallation={taskItems.length > 0 && customerInstallationTotal > 0}
                  originalCosts={{
                    customerPrint: customerPrintTotal, companyPrint: companyPrintTotal,
                    customerCutout: customerCutoutTotal, companyCutout: companyCutoutTotal,
                    customerInstallation: customerInstallationTotal, companyInstallation: companyInstallationTotal,
                  }}
                />

                {/* خصم وملاحظات */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-destructive" /> خصم عام
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={discountAmount}
                        onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                        placeholder="المبلغ" min="0" />
                      <Input value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="السبب" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">ملاحظات</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="ملاحظات إضافية..." rows={3} />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {/* ═══════ STICKY FOOTER ═══════ */}
        <div className="shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-sm p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">الإجمالي:</span>
            <span className="text-lg font-bold text-primary">{customerTotal.toLocaleString('ar-LY')} د.ل</span>
            {netProfit !== 0 && (
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                netProfit >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString('ar-LY')} ربح
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={isSaving || loading}>
              {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
