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
  facesCount: number; // عدد الأوجه المطلوب طباعتها
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutBillboards?: number[];
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
  Faces_Count?: number;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean;
  selected_design_id?: string | null;
  faces_to_install?: number; // عدد الأوجه المختارة للتركيب/الطباعة
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
  const [sizesMap, setSizesMap] = useState<Record<string, { width: number; height: number }>>({});
  
  // نظام التوزيع الذكي للمجسمات
  const [totalCutoutPrinterCost, setTotalCutoutPrinterCost] = useState<number>(0);
  const [totalCutoutCustomerCost, setTotalCutoutCustomerCost] = useState<number>(0);
  const [useDistribution, setUseDistribution] = useState(false);
  
  // أسعار التعديل الجماعي
  const [bulkPrinterCostPerMeter, setBulkPrinterCostPerMeter] = useState<number>(10);
  const [bulkCustomerCostPerMeter, setBulkCustomerCostPerMeter] = useState<number>(20);

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
      setBulkPrinterCostPerMeter(10);
      setBulkCustomerCostPerMeter(20);
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

      const [pricingResult, billboardsResult, designsResult, printersResult, sizesResult, facesResult] = await Promise.all([
        supabase.from('installation_print_pricing').select('print_price').limit(1).single(),
        billboardIds.length > 0 ? supabase.from('billboards').select('ID, Size, has_cutout, Faces_Count').in('ID', billboardIds) : null,
        designIds.length > 0 ? supabase.from('task_designs').select('id, design_face_a_url, design_face_b_url, cutout_image_url').in('id', designIds) : null,
        supabase.from('printers').select('id, name').eq('is_active', true),
        supabase.from('sizes').select('id, name, width, height'),
        // جلب faces_to_install من بنود مهمة التركيب
        billboardIds.length > 0 ? supabase.from('installation_task_items').select('billboard_id, faces_to_install').eq('task_id', installationTaskId) : null
      ]);

      // تخزين بيانات الأحجام
      if (sizesResult.data && !sizesResult.error) {
        const map: Record<string, { width: number; height: number }> = {};
        sizesResult.data.forEach((s: any) => {
          if (s.width && s.height) {
            map[s.name] = { width: s.width, height: s.height };
            map[s.name.toLowerCase()] = { width: s.width, height: s.height };
          }
        });
        setSizesMap(map);
      }

      // خريطة faces_to_install من بنود التركيب
      const facesToInstallMap: Record<number, number> = {};
      if (facesResult && !facesResult.error && facesResult.data) {
        facesResult.data.forEach((item: any) => {
          facesToInstallMap[item.billboard_id] = item.faces_to_install || 1;
        });
      }

      if (billboardsResult && !billboardsResult.error) {
        const map: Record<number, BillboardInfo> = {};
        billboardsResult.data?.forEach((b: any) => {
          const facesFromItem = facesToInstallMap[b.ID];
          map[b.ID] = {
            ID: b.ID,
            Size: b.Size || '3x4',
            has_cutout: b.has_cutout || false,
            Faces_Count: facesFromItem || b.Faces_Count || 1
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
      const facesCount = item.faces_to_install || billboard.Faces_Count || 1;
      
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
            facesCount,
            hasCutout,
            cutoutCount: 0,
            cutoutBillboards: [],
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 20,
            customerCutoutCostPerUnit: 0
          };
        }
        // كل لوحة = بند واحد لكل وجه (face_a / face_b منفصلين أصلاً)
        groups[key].quantity += 1;
        groups[key].billboards.push(item.billboard_id);
        // تحديث أعلى عدد أوجه في المجموعة
        if (facesCount > groups[key].facesCount) {
          groups[key].facesCount = facesCount;
        }
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutBillboards = [...(groups[key].cutoutBillboards || []), item.billboard_id];
          const cutoutKey = `${item.design_face_a}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }

      // ✅ لا تضف الوجه B إذا كان faces_to_install = 1
      if (item.design_face_b && facesCount >= 2) {
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
            facesCount,
            hasCutout,
            cutoutCount: 0,
            cutoutBillboards: [],
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 20,
            customerCutoutCostPerUnit: 0
          };
        }
        groups[key].quantity += 1;
        groups[key].billboards.push(item.billboard_id);
        if (facesCount > groups[key].facesCount) {
          groups[key].facesCount = facesCount;
        }
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutBillboards = [...(groups[key].cutoutBillboards || []), item.billboard_id];
          const cutoutKey = `${item.design_face_b}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }
    });

    if (!hasDesigns) {
      toast.error('لم يتم العثور على تصاميم! يرجى تعيين التصاميم للوحات أولاً.');
    }

    setDesignGroups(Object.values(groups));
  }, [enrichedTaskItems, billboardsMap, cutoutImageUrls, sizesMap]);

  // استخدام الأبعاد الفعلية من جدول sizes
  const parseSizeDimensions = (size: string): { width: number; height: number } => {
    // البحث في جدول الأحجام أولاً
    const sizeData = sizesMap[size] || sizesMap[size.toLowerCase()];
    if (sizeData) {
      return { width: sizeData.width, height: sizeData.height };
    }
    
    // إذا لم نجد في الجدول، نحلل الاسم
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

  // دالة تطبيق الأسعار الجماعية على جميع اللوحات
  const applyBulkPrices = (applyPrinter: boolean, applyCustomer: boolean) => {
    if (designGroups.length === 0) {
      toast.error('لا توجد لوحات للتعديل');
      return;
    }

    setDesignGroups(prev => {
      return prev.map(group => ({
        ...group,
        ...(applyPrinter && { printerCostPerMeter: bulkPrinterCostPerMeter }),
        ...(applyCustomer && { customerCostPerMeter: bulkCustomerCostPerMeter })
      }));
    });

    const message = applyPrinter && applyCustomer 
      ? `تم تطبيق الأسعار الجماعية (مطبعة: ${bulkPrinterCostPerMeter} - زبون: ${bulkCustomerCostPerMeter}) على ${designGroups.length} مجموعة`
      : applyPrinter 
        ? `تم تطبيق سعر المطبعة ${bulkPrinterCostPerMeter} على ${designGroups.length} مجموعة`
        : `تم تطبيق سعر الزبون ${bulkCustomerCostPerMeter} على ${designGroups.length} مجموعة`;
    
    toast.success(message);
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
        .select('contract_id, contract_ids, task_type')
        .eq('id', installationTaskId)
        .single();

      if (taskError) throw taskError;

      // تحديد نوع المهمة
      const isReinstallation = installationTask.task_type === 'reinstallation';

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
          price_per_meter: totalArea > 0 ? totals.printerPrintTotal / totalArea : 0,
          priority: 'normal',
          installation_task_id: installationTaskId,
          is_composite: true,
          notes: `مهمة طباعة من التركيب - الربح: ${totals.printProfit.toFixed(2)} د.ل`
        })
        .select()
        .single();

      if (printTaskError) throw printTaskError;

      // إنشاء بنود مهمة الطباعة - بند منفصل لكل لوحة مع مراعاة عدد الأوجه
      const printTaskItems = printGroups.flatMap(group => 
        group.billboards.map(billboardId => {
          const billboard = billboardsMap[billboardId];
          const _facesCount = billboard?.Faces_Count || 1;
          return {
            task_id: printTask.id,
            billboard_id: billboardId,
            description: `${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
            width: group.width,
            height: group.height,
            area: group.area,
            quantity: 1,
            faces_count: 1,
            unit_cost: group.printerCostPerMeter * group.area,
            printer_unit_cost: group.printerCostPerMeter * group.area,
            customer_unit_cost: group.customerCostPerMeter * group.area,
            total_cost: group.printerCostPerMeter * group.area,
            design_face_a: group.face === 'a' ? group.design : null,
            design_face_b: group.face === 'b' ? group.design : null,
            has_cutout: group.cutoutBillboards?.includes(billboardId) || false,
            cutout_quantity: group.cutoutBillboards?.includes(billboardId) ? 1 : 0,
            cutout_image_url: (group.cutoutBillboards?.includes(billboardId) && group.cutoutImageUrl) || null,
            model_link: (group.cutoutBillboards?.includes(billboardId) && group.cutoutImageUrl) || null,
            status: 'pending'
          };
        })
      );

      const { error: printItemsError } = await supabase
        .from('print_task_items')
        .insert(printTaskItems);

      if (printItemsError) throw printItemsError;

      // ملاحظة: لا نسجل في حساب الزبون هنا لأن الفاتورة الموحدة للمهمة المجمعة ستتكفل بذلك
      // هذا يمنع تكرار الديون في قائمة الفواتير

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

        const { data: createdCutoutTask, error: cutoutTaskError } = await supabase
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
            notes: `مهمة قص من التركيب - الربح: ${totals.cutoutProfit.toFixed(2)} د.ل`,
            is_composite: true
          })
          .select()
          .single();

        if (cutoutTaskError) throw cutoutTaskError;

        // إنشاء بنود مهمة القص لكل لوحة بها مجسم مع مراعاة عدد الأوجه
        const cutoutTaskItems = cutoutGroups.flatMap(group => 
          (group.cutoutBillboards || []).map(billboardId => {
            const billboard = billboardsMap[billboardId];
            const facesCount = billboard?.Faces_Count || 1;
            return {
              task_id: createdCutoutTask.id,
              billboard_id: billboardId,
              description: `مجسم ${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'} (${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'})`,
              quantity: facesCount,
              faces_count: facesCount,
              unit_cost: group.printerCutoutCostPerUnit,
              total_cost: group.printerCutoutCostPerUnit * facesCount,
              cutout_image_url: group.cutoutImageUrl || null,
              status: 'pending'
            };
          })
        );

        const { error: cutoutItemsError } = await supabase
          .from('cutout_task_items')
          .insert(cutoutTaskItems);

        if (cutoutItemsError) throw cutoutItemsError;

        // ملاحظة: لا نسجل في حساب الزبون هنا لأن الفاتورة الموحدة للمهمة المجمعة ستتكفل بذلك
        // هذا يمنع تكرار الديون في قائمة الفواتير
      }

      // === إنشاء أو تحديث المهمة المجمعة ===
      // Note: cutoutTask variable already exists from line 541-559 if cutout groups exist

      // جلب تكلفة التركيب للزبون من بنود مهمة التركيب
      const { data: taskItemsCostData } = await supabase
        .from('installation_task_items')
        .select('customer_installation_cost')
        .eq('task_id', installationTaskId);
      
      const customerInstallationCostFromItems = taskItemsCostData?.reduce(
        (sum, item) => sum + (item.customer_installation_cost || 0), 
        0
      ) || 0;

      // جلب تكلفة التركيب الفعلية للشركة من حساب فريق التركيب
      const { data: taskItemIds } = await supabase
        .from('installation_task_items')
        .select('id')
        .eq('task_id', installationTaskId);
      
      let companyInstallationCost = 0;
      if (taskItemIds && taskItemIds.length > 0) {
        const itemIds = taskItemIds.map(item => item.id);
        const { data: teamAccountData } = await supabase
          .from('installation_team_accounts')
          .select('amount')
          .in('task_item_id', itemIds);
        
        companyInstallationCost = teamAccountData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      }

      // البحث عن مهمة مجمعة موجودة أو إنشاء جديدة
      const { data: existingComposite } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('installation_task_id', installationTaskId)
        .maybeSingle();

      // استخدام المتغير الصحيح للـ cutout task إذا تم إنشاؤه
      let cutoutTaskId = null;
      if (cutoutGroups.length > 0 && totals.printerCutoutTotal > 0) {
        const { data: foundCutoutTask } = await supabase
          .from('cutout_tasks')
          .select('id')
          .eq('installation_task_id', installationTaskId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        cutoutTaskId = foundCutoutTask?.id || null;
      }

      // تكلفة التركيب للزبون: في حالة إعادة التركيب تحسب، في التركيب الجديد = 0
      const customerInstallationCost = isReinstallation ? customerInstallationCostFromItems : 0;
      
      const compositeData = {
        contract_id: installationTask.contract_id,
        customer_id: customerData.customer_id,
        customer_name: customerData.customer_name,
        task_type: isReinstallation ? 'reinstallation' : 'new_installation',
        installation_task_id: installationTaskId,
        print_task_id: printTask.id,
        cutout_task_id: cutoutTaskId,
        // تكاليف الزبون
        customer_installation_cost: customerInstallationCost, // التركيب شامل من العقد في التركيب الجديد فقط
        customer_print_cost: totals.customerPrintTotal,
        customer_cutout_cost: totals.customerCutoutTotal,
        // تكاليف الشركة
        company_installation_cost: companyInstallationCost,
        company_print_cost: totals.printerPrintTotal,
        company_cutout_cost: totals.printerCutoutTotal,
        // الإجماليات
        customer_total: customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal,
        company_total: companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal,
        net_profit: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal),
        profit_percentage: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) > 0 
          ? (((customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal)) / (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal)) * 100 
          : 0,
        status: 'pending',
        notes: `مهمة ${isReinstallation ? 'إعادة تركيب' : 'تركيب جديد'} - طباعة: ${totals.customerPrintTotal} د.ل${cutoutGroups.length > 0 ? ` - قص: ${totals.customerCutoutTotal} د.ل` : ''}`
      };

      if (existingComposite) {
        await supabase
          .from('composite_tasks')
          .update(compositeData)
          .eq('id', existingComposite.id);
      } else {
        await supabase
          .from('composite_tasks')
          .insert([compositeData]);
      }

      const successMessage = cutoutGroups.length > 0 
        ? `تم إنشاء مهمة الطباعة والقص والمهمة المجمعة بنجاح - الربح الإجمالي: ${totals.totalProfit.toFixed(2)} د.ل`
        : `تم إنشاء مهمة الطباعة والمهمة المجمعة بنجاح - الربح: ${totals.printProfit.toFixed(2)} د.ل`;

      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
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

          {/* مجموعات الطباعة والمجسمات */}
          {printGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                <h3 className="font-bold text-lg">تصاميم الطباعة ({printGroups.length})</h3>
              </div>
              
              {/* تعديل الأسعار الجماعية */}
              <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-lg text-blue-700 dark:text-blue-500">
                      تعديل الأسعار الجماعية لجميع اللوحات
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-orange-600 font-semibold">سعر المتر للمطبعة (د.ل)</Label>
                      <Input
                        type="number"
                        value={bulkPrinterCostPerMeter}
                        onChange={(e) => setBulkPrinterCostPerMeter(parseFloat(e.target.value) || 0)}
                        step="0.1"
                        min="0"
                        className="text-lg font-semibold border-orange-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-green-600 font-semibold">سعر المتر للزبون (د.ل)</Label>
                      <Input
                        type="number"
                        value={bulkCustomerCostPerMeter}
                        onChange={(e) => setBulkCustomerCostPerMeter(parseFloat(e.target.value) || 0)}
                        step="0.1"
                        min="0"
                        className="text-lg font-semibold border-green-300"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => applyBulkPrices(true, false)}
                      className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      تطبيق سعر المطبعة على الكل
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyBulkPrices(false, true)}
                      className="gap-2 border-green-300 text-green-600 hover:bg-green-50"
                    >
                      تطبيق سعر الزبون على الكل
                    </Button>
                    <Button
                      onClick={() => applyBulkPrices(true, true)}
                      className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      تطبيق الكل معاً
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    يمكنك تعديل الأسعار لكل لوحة على حدة من الحقول أدناه في حالة وجود استثناءات
                  </p>
                </CardContent>
              </Card>
              
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
                                  التكلفة الإجمالية: {((designGroups[idx]?.printerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل
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
                                  السعر الإجمالي: {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل
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
                                  {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل
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

              <div className="mt-4 pt-4 border-t-2 border-border space-y-3">
                <div className="flex justify-between text-base">
                  <span className="font-semibold">إجمالي التكاليف:</span>
                  <span className="font-bold text-orange-600">{totals.printerTotal.toFixed(2)} د.ل</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-semibold">إجمالي الزبون:</span>
                  <span className="font-bold text-blue-600">{totals.customerTotal.toFixed(2)} د.ل</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
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