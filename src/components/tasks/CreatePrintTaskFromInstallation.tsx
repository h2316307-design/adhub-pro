import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Scissors, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { DesignDisplayCard } from '@/components/print-tasks/DesignDisplayCard';
import { PrintTaskInvoice } from './PrintTaskInvoice';
import { CutoutTaskInvoice } from './CutoutTaskInvoice';

interface DesignGroup {
  design: string;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  billboards: number[];
  width: number;
  height: number;
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutImageUrl?: string;
  printerCostPerMeter: number;
  printerCutoutCostPerUnit: number;
  customerCostPerMeter: number;
  customerCutoutCostPerUnit: number;
}

interface BillboardInfo {
  ID: number;
  Size: string;
  has_cutout?: boolean;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean;
  selected_design_id?: string | null;
}

interface CreatePrintTaskFromInstallationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installationTaskId: string;
  taskItems: TaskItem[];
  onSuccess?: () => void;
}

export function CreatePrintTaskFromInstallation({
  open,
  onOpenChange,
  installationTaskId,
  taskItems,
  onSuccess
}: CreatePrintTaskFromInstallationProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [billboardsMap, setBillboardsMap] = useState<Record<number, BillboardInfo>>({});
  const [enrichedTaskItems, setEnrichedTaskItems] = useState<TaskItem[]>([]);
  const [printerId, setPrinterId] = useState<string>('');
  const [cutoutPrinterId, setCutoutPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [cutoutImageUrls, setCutoutImageUrls] = useState<Record<string, string>>({});
  const hasFetchedRef = useRef(false);
  const [showPrintInvoice, setShowPrintInvoice] = useState(false);
  const [showCutoutInvoice, setShowCutoutInvoice] = useState(false);
  
  // نظام التوزيع الذكي للمجسمات
  const [totalCutoutPrinterCost, setTotalCutoutPrinterCost] = useState<number>(0);
  const [totalCutoutCustomerCost, setTotalCutoutCustomerCost] = useState<number>(0);
  const [useDistribution, setUseDistribution] = useState(false);

  useEffect(() => {
    if (!open) {
      setDesignGroups([]);
      setBillboardsMap({});
      setEnrichedTaskItems([]);
      setPrinterId('');
      setCutoutPrinterId('');
      setCutoutImageUrls({});
      setShowPrintInvoice(false);
      setShowCutoutInvoice(false);
      setTotalCutoutPrinterCost(0);
      setTotalCutoutCustomerCost(0);
      setUseDistribution(false);
      hasFetchedRef.current = false;
    }
  }, [open, installationTaskId]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data for print task...');
      
      const billboardIds = taskItems.map(item => item.billboard_id);
      const designIds = taskItems
        .map(item => item.selected_design_id)
        .filter(id => id != null);

      const [pricingResult, billboardsResult, designsResult, printersResult] = await Promise.all([
        supabase.from('installation_print_pricing').select('print_price').limit(1).single(),
        billboardIds.length > 0 ? supabase.from('billboards').select('ID, Size, has_cutout').in('ID', billboardIds) : null,
        designIds.length > 0 ? supabase.from('task_designs').select('id, design_face_a_url, design_face_b_url, cutout_image_url').in('id', designIds) : null,
        supabase.from('printers').select('id, name').eq('is_active', true)
      ]);

      if (billboardsResult && !billboardsResult.error) {
        const map: Record<number, BillboardInfo> = {};
        billboardsResult.data?.forEach((b: any) => {
          map[b.ID] = {
            ID: b.ID,
            Size: b.Size || '3x4',
            has_cutout: b.has_cutout || false
          };
        });
        setBillboardsMap(map);
      }

      if (designsResult && !designsResult.error && designsResult.data) {
        const updatedItems = taskItems.map(item => {
          if (item.selected_design_id) {
            const design = designsResult.data?.find(d => d.id === item.selected_design_id);
            if (design) {
              if (design.cutout_image_url && item.has_cutout) {
                const key = `${design.design_face_a_url || design.design_face_b_url}-${item.billboard_id}`;
                setCutoutImageUrls(prev => ({...prev, [key]: design.cutout_image_url || ''}));
              }
              return {
                ...item,
                design_face_a: design.design_face_a_url,
                design_face_b: design.design_face_b_url
              };
            }
          }
          return item;
        });
        setEnrichedTaskItems(updatedItems);
      } else {
        setEnrichedTaskItems(taskItems);
      }

      if (printersResult.data && printersResult.data.length > 0) {
        setPrinters(printersResult.data.map(p => ({ id: p.id, name: p.name })));
      } else {
        setPrinters([]);
      }
    };
    
    if (open && taskItems.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [open, taskItems, installationTaskId]);

  useEffect(() => {
    if (Object.keys(billboardsMap).length === 0) return;
    if (!enrichedTaskItems || enrichedTaskItems.length === 0) {
      setDesignGroups([]);
      return;
    }

    const groups: Record<string, DesignGroup> = {};
    let hasDesigns = false;

    enrichedTaskItems.forEach(item => {
      const billboard = billboardsMap[item.billboard_id];
      if (!billboard) return;
      
      const size = billboard.Size || '3x4';
      const hasCutout = item.has_cutout || billboard.has_cutout || false;
      
      if (item.design_face_a) {
        hasDesigns = true;
        const key = `${size}_${item.design_face_a}_a`;
        if (!groups[key]) {
          const { width, height } = parseSizeDimensions(size);
          groups[key] = {
            design: item.design_face_a,
            face: 'a',
            size,
            quantity: 0,
            area: width * height,
            billboards: [],
            width,
            height,
            hasCutout,
            cutoutCount: 0,
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 15,
            customerCutoutCostPerUnit: 0
          };
        }
        groups[key].quantity++;
        groups[key].billboards.push(item.billboard_id);
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          const cutoutKey = `${item.design_face_a}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }

      if (item.design_face_b) {
        hasDesigns = true;
        const key = `${size}_${item.design_face_b}_b`;
        if (!groups[key]) {
          const { width, height } = parseSizeDimensions(size);
          groups[key] = {
            design: item.design_face_b,
            face: 'b',
            size,
            quantity: 0,
            area: width * height,
            billboards: [],
            width,
            height,
            hasCutout,
            cutoutCount: 0,
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 15,
            customerCutoutCostPerUnit: 0
          };
        }
        groups[key].quantity++;
        groups[key].billboards.push(item.billboard_id);
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          const cutoutKey = `${item.design_face_b}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }
    });

    if (!hasDesigns) {
      toast.error('لم يتم العثور على تصاميم! يرجى تعيين التصاميم للوحات أولاً.');
    }

    setDesignGroups(Object.values(groups));
  }, [enrichedTaskItems, billboardsMap, cutoutImageUrls]);

  const parseSizeDimensions = (size: string): { width: number; height: number } => {
    const parts = size.split(/[x×*]/);
    if (parts.length === 2) {
      return {
        width: parseFloat(parts[0]),
        height: parseFloat(parts[1])
      };
    }
    return { width: 3, height: 4 };
  };

  const { printGroups, cutoutGroups } = useMemo(() => {
    const print: DesignGroup[] = [];
    const cutout: DesignGroup[] = [];
    
    designGroups.forEach(group => {
      print.push({
        ...group,
        printerCutoutCostPerUnit: 0,
        customerCutoutCostPerUnit: 0
      });
      
      if (group.hasCutout && group.cutoutCount && group.cutoutCount > 0) {
        cutout.push(group);
      }
    });
    
    return { printGroups: print, cutoutGroups: cutout };
  }, [designGroups]);

  const updateGroupPrice = (index: number, field: keyof DesignGroup, value: number) => {
    setDesignGroups(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // دالة التوزيع الذكي للتكاليف
  const distributeCutoutCosts = () => {
    if (cutoutGroups.length === 0) return;
    
    const totalQuantity = cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0);
    
    if (totalQuantity === 0) {
      toast.error('لا توجد مجسمات للتوزيع');
      return;
    }
    
    const printerCostPerUnit = totalCutoutPrinterCost / totalQuantity;
    const customerCostPerUnit = totalCutoutCustomerCost / totalQuantity;
    
    setDesignGroups(prev => {
      const updated = [...prev];
      cutoutGroups.forEach((group, idx) => {
        const originalIndex = prev.findIndex(g => 
          g.design === group.design && 
          g.face === group.face && 
          g.size === group.size
        );
        
        if (originalIndex !== -1) {
          updated[originalIndex] = {
            ...updated[originalIndex],
            printerCutoutCostPerUnit: printerCostPerUnit,
            customerCutoutCostPerUnit: customerCostPerUnit
          };
        }
      });
      return updated;
    });
    
    toast.success(`تم توزيع التكاليف بنجاح - ${totalQuantity} مجسم`);
  };

  const calculateTotals = () => {
    let printerPrintCost = 0;
    let printerCutoutCost = 0;
    let customerPrintCost = 0;
    let customerCutoutCost = 0;

    printGroups.forEach(group => {
      const printArea = group.area * group.quantity;
      printerPrintCost += printArea * group.printerCostPerMeter;
      customerPrintCost += printArea * group.customerCostPerMeter;
    });
    
    cutoutGroups.forEach(group => {
      if (group.cutoutCount) {
        printerCutoutCost += group.cutoutCount * group.printerCutoutCostPerUnit;
        customerCutoutCost += group.cutoutCount * group.customerCutoutCostPerUnit;
      }
    });

    return {
      printerPrintTotal: printerPrintCost,
      printerCutoutTotal: printerCutoutCost,
      printerTotal: printerPrintCost + printerCutoutCost,
      customerPrintTotal: customerPrintCost,
      customerCutoutTotal: customerCutoutCost,
      customerTotal: customerPrintCost + customerCutoutCost,
      printProfit: customerPrintCost - printerPrintCost,
      cutoutProfit: customerCutoutCost - printerCutoutCost,
      totalProfit: (customerPrintCost + customerCutoutCost) - (printerPrintCost + printerCutoutCost)
    };
  };

  const handleCreatePrintTask = async () => {
    try {
      setLoading(true);

      if (!printerId) {
        toast.error('يرجى اختيار المطبعة');
        return;
      }

      const { data: installationTask, error: taskError } = await supabase
        .from('installation_tasks')
        .select('contract_id, contract_ids')
        .eq('id', installationTaskId)
        .single();

      if (taskError) throw taskError;

      let contractIds = installationTask.contract_ids && installationTask.contract_ids.length > 0 
        ? installationTask.contract_ids 
        : [installationTask.contract_id];

      if (!contractIds || contractIds.length === 0 || !contractIds[0]) {
        throw new Error('لا يوجد رقم عقد مرتبط بمهمة التركيب');
      }

      const { data: contracts, error: contractError } = await supabase
        .from('Contract')
        .select('Contract_Number, customer_id, "Customer Name"')
        .in('Contract_Number', contractIds);

      if (contractError || !contracts || contracts.length === 0) {
        throw new Error('لم يتم العثور على بيانات العقد');
      }

      const customerData = {
        customer_id: contracts[0].customer_id,
        customer_name: contracts[0]['Customer Name']
      };

      if (!customerData.customer_id || !customerData.customer_name) {
        throw new Error('بيانات العميل غير مكتملة');
      }

      const totals = calculateTotals();
      const totalArea = printGroups.reduce((sum, g) => sum + (g.area * g.quantity), 0);

      // إنشاء فاتورة الطباعة
      const printInvoiceNumber = `PT-${Date.now()}`;
      const { data: printInvoice, error: printInvoiceError } = await supabase
        .from('printed_invoices')
        .insert({
          contract_number: installationTask.contract_id,
          invoice_number: printInvoiceNumber,
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          printer_id: printerId,
          printer_name: printers.find(p => p.id === printerId)?.name || 'غير محدد',
          invoice_date: new Date().toISOString().split('T')[0],
          total_amount: totals.customerPrintTotal,
          printer_cost: totals.printerPrintTotal,
          invoice_type: 'print',
          notes: `مهمة طباعة من التركيب ${installationTaskId}`
        })
        .select()
        .single();

      if (printInvoiceError) throw printInvoiceError;

      // إنشاء مهمة الطباعة
      const { data: printTask, error: printTaskError } = await supabase
        .from('print_tasks')
        .insert({
          invoice_id: printInvoice.id,
          contract_id: installationTask.contract_id,
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          customer_total_amount: totals.customerPrintTotal,
          printer_id: printerId,
          status: 'pending',
          total_area: totalArea,
          total_cost: totals.printerPrintTotal,
          printer_total_cost: totals.printerPrintTotal,
          priority: 'normal',
          notes: `مهمة طباعة من التركيب - الربح: ${totals.printProfit.toFixed(2)} د.ل`
        })
        .select()
        .single();

      if (printTaskError) throw printTaskError;

      // إنشاء بنود مهمة الطباعة
      const printTaskItems = printGroups.map(group => ({
        task_id: printTask.id,
        description: `${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
        width: group.width,
        height: group.height,
        area: group.area,
        quantity: group.quantity,
        unit_cost: group.printerCostPerMeter * group.area,
        printer_unit_cost: group.printerCostPerMeter * group.area,
        customer_unit_cost: group.customerCostPerMeter * group.area,
        total_cost: group.printerCostPerMeter * group.area * group.quantity,
        design_face_a: group.face === 'a' ? group.design : null,
        design_face_b: group.face === 'b' ? group.design : null,
        status: 'pending'
      }));

      const { error: printItemsError } = await supabase
        .from('print_task_items')
        .insert(printTaskItems);

      if (printItemsError) throw printItemsError;

      // تسجيل في حساب الزبون للطباعة
      await supabase.from('customer_payments').insert({
        customer_id: customerData.customer_id,
        customer_name: customerData.customer_name,
        printed_invoice_id: printInvoice.id,
        amount: -totals.customerPrintTotal,
        entry_type: 'invoice',
        paid_at: new Date().toISOString().split('T')[0],
        method: 'حساب',
        notes: `فاتورة طباعة ${printInvoiceNumber} - الربح: ${totals.printProfit.toFixed(2)} د.ل`
      });

      // إنشاء مهمة القص إذا كانت هناك مجسمات
      if (cutoutGroups.length > 0 && totals.printerCutoutTotal > 0) {
        const cutoutInvoiceNumber = `CT-${Date.now()}`;
        const { data: cutoutInvoice, error: cutoutInvoiceError } = await supabase
          .from('printed_invoices')
          .insert({
            contract_number: installationTask.contract_id,
            invoice_number: cutoutInvoiceNumber,
            customer_id: customerData.customer_id,
            customer_name: customerData.customer_name,
            printer_id: printerId,
            printer_name: printers.find(p => p.id === printerId)?.name || 'غير محدد',
            invoice_date: new Date().toISOString().split('T')[0],
            total_amount: totals.customerCutoutTotal,
            printer_cost: totals.printerCutoutTotal,
            invoice_type: 'cutout',
            notes: `مهمة قص من التركيب ${installationTaskId}`
          })
          .select()
          .single();

        if (cutoutInvoiceError) throw cutoutInvoiceError;

        const totalCutoutQuantity = cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0);

        const { data: cutoutTask, error: cutoutTaskError } = await supabase
          .from('cutout_tasks')
          .insert({
            invoice_id: cutoutInvoice.id,
            contract_id: installationTask.contract_id,
            customer_id: customerData.customer_id,
            customer_name: customerData.customer_name,
            customer_total_amount: totals.customerCutoutTotal,
            printer_id: cutoutPrinterId || printerId,
            status: 'pending',
            total_cost: totals.printerCutoutTotal,
            total_quantity: totalCutoutQuantity,
            unit_cost: totalCutoutQuantity > 0 ? totals.printerCutoutTotal / totalCutoutQuantity : 0,
            priority: 'normal',
            installation_task_id: installationTaskId,
            notes: `مهمة قص من التركيب - الربح: ${totals.cutoutProfit.toFixed(2)} د.ل`
          })
          .select()
          .single();

        if (cutoutTaskError) throw cutoutTaskError;

        // إنشاء بنود مهمة القص
        const cutoutTaskItems = cutoutGroups.map(group => ({
          task_id: cutoutTask.id,
          description: `مجسم ${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
          quantity: group.cutoutCount || 0,
          unit_cost: group.printerCutoutCostPerUnit,
          total_cost: (group.cutoutCount || 0) * group.printerCutoutCostPerUnit,
          cutout_image_url: group.cutoutImageUrl || null,
          status: 'pending'
        }));

        const { error: cutoutItemsError } = await supabase
          .from('cutout_task_items')
          .insert(cutoutTaskItems);

        if (cutoutItemsError) throw cutoutItemsError;

        // تسجيل في حساب الزبون للقص
        await supabase.from('customer_payments').insert({
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          printed_invoice_id: cutoutInvoice.id,
          amount: -totals.customerCutoutTotal,
          entry_type: 'invoice',
          paid_at: new Date().toISOString().split('T')[0],
          method: 'حساب',
          notes: `فاتورة قص ${cutoutInvoiceNumber} - الربح: ${totals.cutoutProfit.toFixed(2)} د.ل`
        });
      }

      const successMessage = cutoutGroups.length > 0 
        ? `تم إنشاء مهمة الطباعة والقص بنجاح - الربح الإجمالي: ${totals.totalProfit.toFixed(2)} د.ل`
        : `تم إنشاء مهمة الطباعة بنجاح - الربح: ${totals.printProfit.toFixed(2)} د.ل`;

      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'فشل في إنشاء المهام');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">إنشاء مهمة طباعة وقص</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* اختيار المطابع */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    <span>مطبعة الطباعة *</span>
                  </Label>
                  <Select value={printerId} onValueChange={setPrinterId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="اختر مطبعة الطباعة" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {cutoutGroups.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-destructive" />
                      <span>مصنع قص المجسمات *</span>
                    </Label>
                    <Select value={cutoutPrinterId} onValueChange={setCutoutPrinterId}>
                      <SelectTrigger className="bg-background border-destructive/30">
                        <SelectValue placeholder="اختر مصنع القص" />
                      </SelectTrigger>
                      <SelectContent>
                        {printers.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* مجموعات الطباعة والمجسمات */}
          {printGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                <h3 className="font-bold text-lg">تصاميم الطباعة ({printGroups.length})</h3>
              </div>
              
              {printGroups.map((group, idx) => (
                <div key={idx} className="space-y-4">
                  <DesignDisplayCard group={group} index={idx} />
                  
                  {/* حقول الطباعة */}
                  <Card className="border-2">
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h5 className="font-semibold text-orange-600">تكاليف المطبعة</h5>
                          <div>
                            <Label>سعر المتر للمطبعة (د.ل)</Label>
                            <Input
                              type="number"
                              value={designGroups[idx]?.printerCostPerMeter || 0}
                              onChange={(e) => updateGroupPrice(idx, 'printerCostPerMeter', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-semibold text-green-600">أسعار الزبون</h5>
                          <div>
                            <Label>سعر المتر للزبون (د.ل)</Label>
                            <Input
                              type="number"
                              value={designGroups[idx]?.customerCostPerMeter || 0}
                              onChange={(e) => updateGroupPrice(idx, 'customerCostPerMeter', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                   {/* حقول المجسمات - تظهر مباشرة إذا كان التصميم يحتوي على مجسم */}
                  {group.hasCutout && group.cutoutCount && group.cutoutCount > 0 && (
                    <Card className="border-2 border-destructive/30 bg-destructive/5">
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Scissors className="h-5 w-5 text-destructive" />
                          <h5 className="font-semibold text-destructive">مجسمات القص (عدد: {group.cutoutCount})</h5>
                        </div>
                        
                        {!useDistribution ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <h5 className="font-semibold text-orange-600">تكاليف شركة القص</h5>
                              <div>
                                <Label>سعر الوحدة لشركة القص (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={designGroups[idx]?.printerCutoutCostPerUnit || 0}
                                  onChange={(e) => updateGroupPrice(idx, 'printerCutoutCostPerUnit', parseFloat(e.target.value) || 0)}
                                  step="0.1"
                                  min="0"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  التكلفة الإجمالية: {((designGroups[idx]?.printerCutoutCostPerUnit || 0) * (group.cutoutCount || 0)).toFixed(2)} د.ل
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h5 className="font-semibold text-green-600">أسعار الزبون</h5>
                              <div>
                                <Label>سعر الوحدة للزبون (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={designGroups[idx]?.customerCutoutCostPerUnit || 0}
                                  onChange={(e) => updateGroupPrice(idx, 'customerCutoutCostPerUnit', parseFloat(e.target.value) || 0)}
                                  step="0.1"
                                  min="0"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  السعر الإجمالي: {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * (group.cutoutCount || 0)).toFixed(2)} د.ل
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-accent/50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">الكمية:</span>
                              <span className="font-semibold">{group.cutoutCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">تكلفة الوحدة (شركة القص):</span>
                              <span className="font-semibold text-orange-600">
                                {(designGroups[idx]?.printerCutoutCostPerUnit || 0).toFixed(2)} د.ل
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">سعر الوحدة (للزبون):</span>
                              <span className="font-semibold text-green-600">
                                {(designGroups[idx]?.customerCutoutCostPerUnit || 0).toFixed(2)} د.ل
                              </span>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="flex justify-between text-sm font-bold">
                                <span>الإجمالي:</span>
                                <span className="text-primary">
                                  {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * (group.cutoutCount || 0)).toFixed(2)} د.ل
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* نظام التوزيع الذكي للمجسمات */}
          {cutoutGroups.length > 0 && (
            <Card className="border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-lg text-amber-700 dark:text-amber-500">نظام التوزيع الذكي للمجسمات</h3>
                  </div>
                  <Button
                    variant={useDistribution ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseDistribution(!useDistribution)}
                    className="gap-2"
                  >
                    {useDistribution ? '✓ مُفعّل' : 'تفعيل التوزيع'}
                  </Button>
                </div>

                {useDistribution && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-orange-600 font-semibold">
                          إجمالي تكلفة القص من الشركة (د.ل)
                        </Label>
                        <Input
                          type="number"
                          value={totalCutoutPrinterCost}
                          onChange={(e) => setTotalCutoutPrinterCost(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="text-lg font-semibold border-orange-300"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-semibold">
                          إجمالي السعر للزبون (د.ل)
                        </Label>
                        <Input
                          type="number"
                          value={totalCutoutCustomerCost}
                          onChange={(e) => setTotalCutoutCustomerCost(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="text-lg font-semibold border-green-300"
                        />
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">إجمالي الكميات:</span>
                          <p className="font-bold text-lg">{cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">تكلفة الوحدة (شركة):</span>
                          <p className="font-bold text-lg text-orange-600">
                            {(totalCutoutPrinterCost / cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0) || 0).toFixed(2)} د.ل
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">سعر الوحدة (زبون):</span>
                          <p className="font-bold text-lg text-green-600">
                            {(totalCutoutCustomerCost / cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0) || 0).toFixed(2)} د.ل
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={distributeCutoutCosts}
                        disabled={totalCutoutPrinterCost === 0 || totalCutoutCustomerCost === 0}
                        className="w-full gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                        size="lg"
                      >
                        <Scissors className="h-4 w-4" />
                        توزيع التكاليف على المجسمات
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ملخص التكاليف */}
          <Card className="border-2 border-primary">
            <CardContent className="pt-6">
              <h3 className="font-bold text-lg mb-4">ملخص التكاليف والأرباح</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold">الطباعة</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>تكلفة المطبعة:</span>
                      <span className="font-bold">{totals.printerPrintTotal.toFixed(2)} د.ل</span>
                    </div>
                    <div className="flex justify-between">
                      <span>سعر الزبون:</span>
                      <span className="font-bold">{totals.customerPrintTotal.toFixed(2)} د.ل</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>الربح:</span>
                      <span className="font-bold">{totals.printProfit.toFixed(2)} د.ل</span>
                    </div>
                  </div>
                </div>

                {cutoutGroups.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">القص</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>تكلفة شركة القص:</span>
                        <span className="font-bold">{totals.printerCutoutTotal.toFixed(2)} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span>سعر الزبون:</span>
                        <span className="font-bold">{totals.customerCutoutTotal.toFixed(2)} د.ل</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>الربح:</span>
                        <span className="font-bold">{totals.cutoutProfit.toFixed(2)} د.ل</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-lg font-bold">
                  <span>الربح الإجمالي:</span>
                  <span className="text-green-600">{totals.totalProfit.toFixed(2)} د.ل</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* أزرار معاينة الفواتير */}
          {printGroups.length > 0 && (
            <Card className="bg-accent/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    معاينة الفواتير
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPrintInvoice(!showPrintInvoice)}
                      className="gap-2"
                      disabled={!printerId}
                    >
                      <Printer className="h-4 w-4" />
                      {showPrintInvoice ? 'إخفاء' : 'عرض'} فاتورة الطباعة
                    </Button>
                    {cutoutGroups.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setShowCutoutInvoice(!showCutoutInvoice)}
                        className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                        disabled={!cutoutPrinterId && !printerId}
                      >
                        <Scissors className="h-4 w-4" />
                        {showCutoutInvoice ? 'إخفاء' : 'عرض'} فاتورة القص
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* معاينة فاتورة الطباعة */}
          {showPrintInvoice && printGroups.length > 0 && (
            <PrintTaskInvoice
              designGroups={printGroups}
              pricePerMeter={printGroups[0]?.printerCostPerMeter || 0}
              cutoutPricePerUnit={0}
              printerName={printers.find(p => p.id === printerId)?.name}
              totalArea={totals.printerPrintTotal / (printGroups[0]?.printerCostPerMeter || 1)}
              totalCutouts={0}
              showPrices={true}
            />
          )}

          {/* معاينة فاتورة القص */}
          {showCutoutInvoice && cutoutGroups.length > 0 && (
            <CutoutTaskInvoice
              designGroups={cutoutGroups}
              cutoutPricePerUnit={cutoutGroups[0]?.printerCutoutCostPerUnit || 0}
              cutoutPrinterName={printers.find(p => p.id === (cutoutPrinterId || printerId))?.name}
              totalCutouts={cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0)}
              showPrices={true}
            />
          )}

          {/* أزرار الحفظ */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button 
              onClick={handleCreatePrintTask} 
              disabled={loading || !printerId || (cutoutGroups.length > 0 && !cutoutPrinterId && !printerId)}
              className="gap-2"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء المهام'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}