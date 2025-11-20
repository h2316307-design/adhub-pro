import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Image as ImageIcon, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PrintTaskInvoice } from './PrintTaskInvoice';

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
  const [pricePerMeter, setPricePerMeter] = useState<number>(10);
  const [cutoutPricePerUnit, setCutoutPricePerUnit] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [billboardsMap, setBillboardsMap] = useState<Record<number, BillboardInfo>>({});
  const [enrichedTaskItems, setEnrichedTaskItems] = useState<TaskItem[]>([]);
  const [printerId, setPrinterId] = useState<string>('');
  const [cutoutPrinterId, setCutoutPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [cutoutImageUrls, setCutoutImageUrls] = useState<Record<string, string>>({});
  const [pricePerMeterEditable, setPricePerMeterEditable] = useState<boolean>(true);

  // إعادة تعيين البيانات عند التبديل بين المهام أو الإغلاق
  useEffect(() => {
    if (!open) {
      setDesignGroups([]);
      setBillboardsMap({});
      setEnrichedTaskItems([]);
      setPricePerMeter(10);
      setCutoutPricePerUnit(0);
      setPrinterId('');
      setCutoutPrinterId('');
      setShowPrices(true);
      setCutoutImageUrls({});
    }
  }, [open, installationTaskId]);

  // جلب سعر المتر وبيانات اللوحات والتصاميم والمطابع من قاعدة البيانات
  useEffect(() => {
    const fetchData = async () => {
      console.log('🔍 Fetching data for print task...');
      console.log('📦 Task items received:', taskItems);
      
      // جلب جميع البيانات بشكل متوازي
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
      
      // معالجة سعر المتر
      if (pricingResult.data?.print_price) {
        console.log('💰 Print price per meter:', pricingResult.data.print_price);
        setPricePerMeter(pricingResult.data.print_price);
        setPricePerMeterEditable(false);
      } else {
        console.log('💰 No default price found, using 10');
        setPricePerMeter(10);
        setPricePerMeterEditable(true);
      }

      // معالجة بيانات اللوحات
      if (billboardsResult && !billboardsResult.error) {
        console.log('✅ Billboards fetched:', billboardsResult.data);
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

      // معالجة التصاميم
      if (designsResult && !designsResult.error && designsResult.data) {
        console.log('✅ Designs fetched:', designsResult.data);
        const updatedItems = taskItems.map(item => {
          if (item.selected_design_id) {
            const design = designsResult.data?.find(d => d.id === item.selected_design_id);
            if (design) {
              // تحديث حالة روابط صور المجسمات
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
        console.log('✅ Updated task items with designs:', updatedItems);
        setEnrichedTaskItems(updatedItems);
      } else {
        setEnrichedTaskItems(taskItems);
      }

      // معالجة المطابع
      if (printersResult.data && printersResult.data.length > 0) {
        console.log('✅ Printers fetched:', printersResult.data);
        setPrinters(printersResult.data.map(p => ({ id: p.id, name: p.name })));
      } else {
        console.log('⚠️ No printers found');
        setPrinters([]);
      }
    };
    
    if (open && taskItems.length > 0) {
      fetchData();
    }
  }, [open, taskItems, installationTaskId]);

  // تجميع التصاميم حسب المقاس والتصميم مع المجسمات
  useEffect(() => {
    console.log('🔄 Grouping designs...');
    console.log('📊 Billboards map:', billboardsMap);
    console.log('📦 Enriched task items:', enrichedTaskItems);
    console.log('📦 Enriched task items length:', enrichedTaskItems.length);
    
    if (Object.keys(billboardsMap).length === 0) {
      console.log('⏳ Waiting for billboards data...');
      return;
    }

    if (!enrichedTaskItems || enrichedTaskItems.length === 0) {
      console.log('⚠️ No enriched task items provided');
      setDesignGroups([]);
      return;
    }

    const groups: Record<string, DesignGroup> = {};
    let hasDesigns = false;

    enrichedTaskItems.forEach(item => {
      const billboard = billboardsMap[item.billboard_id];
      
      if (!billboard) {
        console.warn(`⚠️ Billboard ${item.billboard_id} not found in map`);
        return;
      }
      
      const size = billboard.Size || '3x4';
      const hasCutout = item.has_cutout || billboard.has_cutout || false;
      
      console.log(`📋 Processing item:`, {
        billboard_id: item.billboard_id,
        size,
        design_face_a: item.design_face_a,
        design_face_b: item.design_face_b,
        hasCutout
      });
      
      // معالجة الوجه الأمامي
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
            hasCutout: false,
            cutoutCount: 0
          };
        }
        groups[key].quantity++;
        groups[key].billboards.push(item.billboard_id);
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutImageUrl = cutoutImageUrls[key] || '';
        }
      }

      // معالجة الوجه الخلفي
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
            hasCutout: false,
            cutoutCount: 0
          };
        }
        groups[key].quantity++;
        groups[key].billboards.push(item.billboard_id);
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutImageUrl = cutoutImageUrls[key] || '';
        }
      }
    });

    if (!hasDesigns) {
      console.warn('⚠️ No designs found in task items. Please assign designs to billboards first.');
      toast.error('لم يتم العثور على تصاميم! يرجى تعيين التصاميم للوحات أولاً في مهمة التركيب.');
    }

    const groupsArray = Object.values(groups);
    console.log('✅ Design groups created:', groupsArray);
    console.log('📊 Has designs:', hasDesigns);
    setDesignGroups(groupsArray);
  }, [enrichedTaskItems, billboardsMap]);

  const parseSizeDimensions = (size: string): { width: number; height: number } => {
    const parts = size.split(/[x×*]/);
    if (parts.length === 2) {
      return {
        width: parseFloat(parts[0]),
        height: parseFloat(parts[1])
      };
    }
    return { width: 3, height: 4 }; // القيمة الافتراضية
  };

  const handleCreatePrintTask = async () => {
    try {
      setLoading(true);

      // جلب بيانات مهمة التركيب
      const { data: installationTask, error: taskError } = await supabase
        .from('installation_tasks')
        .select('contract_id, contract_ids')
        .eq('id', installationTaskId)
        .single();

      if (taskError) throw taskError;

      // جلب بيانات العقد
      const contractIds = installationTask.contract_ids || [installationTask.contract_id];
      const { data: contracts, error: contractError } = await supabase
        .from('Contract')
        .select('Contract_Number, customer_id, "Customer Name"')
        .in('Contract_Number', contractIds);

      if (contractError) throw contractError;

      const totalArea = designGroups.reduce((sum, group) => sum + (group.area * group.quantity), 0);
      const totalCutouts = designGroups.reduce((sum, group) => sum + (group.cutoutCount || 0), 0);
      const totalCost = (totalArea * pricePerMeter) + (totalCutouts * cutoutPricePerUnit);

      // إنشاء مهمة الطباعة
      const { data: printTask, error: printTaskError } = await supabase
        .from('print_tasks')
        .insert({
          contract_id: installationTask.contract_id,
          customer_id: contracts?.[0]?.customer_id,
          customer_name: contracts?.[0]?.['Customer Name'],
        printer_id: printerId || null,
        cutout_printer_id: cutoutPrinterId || null,
        status: 'pending',
          total_area: totalArea,
          total_cost: totalCost,
          price_per_meter: pricePerMeter,
          has_cutouts: totalCutouts > 0,
          cutout_quantity: totalCutouts,
          cutout_cost: totalCutouts * cutoutPricePerUnit,
          priority: 'normal',
          notes: `تم إنشاؤها تلقائياً من مهمة التركيب ${installationTaskId}${cutoutPrinterId ? `\nمطبعة المجسمات: ${selectedCutoutPrinterName}` : ''}`
        })
        .select()
        .single();

      if (printTaskError) throw printTaskError;

      // إنشاء عناصر مهمة الطباعة
      const printTaskItems = designGroups.map(group => {
        const cutoutKey = `${group.design}-${group.face}`;
        return {
          task_id: printTask.id,
          description: `${group.size} - الوجه ${group.face === 'a' ? 'الأمامي' : 'الخلفي'}${group.hasCutout ? ' (مجسم)' : ''}`,
          width: group.width,
          height: group.height,
          area: group.area,
          quantity: group.quantity,
          unit_cost: pricePerMeter,
          total_cost: group.area * group.quantity * pricePerMeter,
          design_face_a: group.face === 'a' ? group.design : null,
          design_face_b: group.face === 'b' ? group.design : null,
          cutout_image_url: group.hasCutout ? (cutoutImageUrls[cutoutKey] || null) : null,
          status: 'pending'
        };
      });

      const { error: itemsError } = await supabase
        .from('print_task_items')
        .insert(printTaskItems);

      if (itemsError) throw itemsError;

      toast.success('تم إنشاء مهمة الطباعة بنجاح');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating print task:', error);
      toast.error('فشل في إنشاء مهمة الطباعة');
    } finally {
      setLoading(false);
    }
  };

  const totalArea = designGroups.reduce((sum, group) => sum + (group.area * group.quantity), 0);
  const totalCutouts = designGroups.reduce((sum, group) => sum + (group.cutoutCount || 0), 0);
  const printCost = totalArea * pricePerMeter;
  const cutoutsCost = totalCutouts * cutoutPricePerUnit;
  const estimatedCost = printCost + cutoutsCost;

  const selectedPrinterName = printers.find(p => p.id === printerId)?.name;
  const selectedCutoutPrinterName = cutoutPrinterId 
    ? printers.find(p => p.id === cutoutPrinterId)?.name 
    : selectedPrinterName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            إنشاء مهمة طباعة من مهمة التركيب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ملخص التصاميم مع الصور */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">ملخص التصاميم المطلوبة:</h3>
            
            {designGroups.length === 0 && (
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="p-6 text-center">
                  <p className="text-destructive font-semibold text-lg mb-2">⚠️ لا توجد تصاميم محددة</p>
                  <p className="text-muted-foreground">يرجى تعيين التصاميم للوحات في مهمة التركيب أولاً قبل إنشاء مهمة الطباعة</p>
                </CardContent>
              </Card>
            )}
            
            {designGroups.map((group, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* صورة التصميم */}
                    <div className="flex items-center justify-center bg-muted rounded-lg p-2">
                      {group.design ? (
                        <img 
                          src={group.design} 
                          alt={`تصميم ${group.size}`}
                          className="max-h-32 w-auto object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={group.design ? 'hidden' : 'flex items-center justify-center text-muted-foreground'}>
                        <ImageIcon className="h-16 w-16" />
                      </div>
                    </div>

                    {/* التفاصيل */}
                    <div className="md:col-span-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg">
                          {group.size} - {group.face === 'a' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
                          {group.hasCutout && <span className="text-destructive mr-2">(مجسم)</span>}
                        </h4>
                        <span className="font-bold text-primary text-xl">×{group.quantity}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-muted p-2 rounded">
                          <div className="text-muted-foreground text-xs">العرض</div>
                          <div className="font-semibold">{group.width}م</div>
                        </div>
                        <div className="bg-muted p-2 rounded">
                          <div className="text-muted-foreground text-xs">الارتفاع</div>
                          <div className="font-semibold">{group.height}م</div>
                        </div>
                        <div className="bg-muted p-2 rounded">
                          <div className="text-muted-foreground text-xs">مساحة الوحدة</div>
                          <div className="font-semibold">{group.area.toFixed(2)}م²</div>
                        </div>
                        <div className="bg-primary/10 p-2 rounded">
                          <div className="text-muted-foreground text-xs">إجمالي المساحة</div>
                          <div className="font-bold text-primary">{(group.area * group.quantity).toFixed(2)}م²</div>
                        </div>
                      </div>

                      {group.hasCutout && (
                          <div className="space-y-2">
                            <div className="bg-destructive/10 p-2 rounded border border-destructive/20">
                              <div className="flex items-center gap-2 text-destructive font-semibold">
                                <Printer className="h-4 w-4" />
                                عدد المجسمات المطلوبة: {group.cutoutCount}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`cutout-url-${group.design}-${group.face}`}>
                                رابط صورة المجسم (اختياري)
                              </Label>
                              <Input
                                id={`cutout-url-${group.design}-${group.face}`}
                                type="url"
                                value={cutoutImageUrls[`${group.design}-${group.face}`] || ''}
                                onChange={(e) => {
                                  const key = `${group.design}-${group.face}`;
                                  setCutoutImageUrls(prev => ({
                                    ...prev,
                                    [key]: e.target.value
                                  }));
                                }}
                                placeholder="https://example.com/cutout-image.jpg"
                                className="text-sm"
                              />
                              {cutoutImageUrls[`${group.design}-${group.face}`] && (
                                <div className="mt-2 p-2 bg-muted rounded border">
                                  <img 
                                    src={cutoutImageUrls[`${group.design}-${group.face}`]}
                                    alt="معاينة صورة المجسم"
                                    className="max-h-24 w-auto object-contain mx-auto"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const parent = e.currentTarget.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '<p class="text-destructive text-xs text-center">فشل تحميل الصورة</p>';
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))}

            {/* الملخص الإجمالي */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">عدد التصاميم</div>
                    <div className="text-2xl font-bold">{designGroups.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">إجمالي الكمية</div>
                    <div className="text-2xl font-bold">{designGroups.reduce((sum, g) => sum + g.quantity, 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">إجمالي المساحة</div>
                    <div className="text-2xl font-bold text-primary">{totalArea.toFixed(2)} م²</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">عدد المجسمات</div>
                    <div className="text-2xl font-bold text-destructive">{totalCutouts}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* فاتورة الطباعة */}
          {designGroups.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  id="showPrices"
                  checked={showPrices}
                  onCheckedChange={(checked) => setShowPrices(checked === true)}
                />
                <Label htmlFor="showPrices" className="cursor-pointer">
                  عرض الأسعار في الفاتورة
                </Label>
              </div>
              <PrintTaskInvoice
                designGroups={designGroups}
                pricePerMeter={pricePerMeter}
                cutoutPricePerUnit={cutoutPricePerUnit}
                printerName={selectedPrinterName}
                cutoutPrinterName={selectedCutoutPrinterName}
                totalArea={totalArea}
                totalCutouts={totalCutouts}
                showPrices={showPrices}
              />
            </>
          )}

          {/* إعدادات التكلفة */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-lg">حساب التكاليف والتكليف:</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printer">تكليف المطبعة</Label>
                  <Select value={printerId} onValueChange={setPrinterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={printers.length > 0 ? "اختر المطبعة" : "لا توجد مطابع متاحة"} />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground">
                          لا توجد مطابع مضافة في النظام
                        </div>
                      ) : (
                        printers.map(printer => (
                          <SelectItem key={printer.id} value={printer.id}>
                            {printer.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {printers.length === 0 && (
                    <p className="text-xs text-destructive">
                      يرجى إضافة مطابع من صفحة إدارة المطابع أولاً
                    </p>
                  )}
                </div>

                {totalCutouts > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="cutoutPrinter">مطبعة المجسمات</Label>
                    <Select value={cutoutPrinterId || 'same'} onValueChange={(val) => setCutoutPrinterId(val === 'same' ? '' : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="نفس المطبعة أو اختر أخرى" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">نفس المطبعة الرئيسية</SelectItem>
                        {printers.map(printer => (
                          <SelectItem key={printer.id} value={printer.id}>
                            {printer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricePerMeter">سعر متر الطباعة (د.ل)</Label>
                  <Input
                    id="pricePerMeter"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerMeter}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPricePerMeter(0);
                      } else {
                        const newValue = parseFloat(val);
                        if (!isNaN(newValue) && newValue >= 0) {
                          setPricePerMeter(newValue);
                        }
                      }
                    }}
                    placeholder="10.00"
                  />
                  <div className="text-xs text-muted-foreground">
                    {designGroups.length > 0 ? (
                      <>التكلفة: {totalArea.toFixed(2)} م² × {pricePerMeter} = {printCost.toFixed(2)} د.ل</>
                    ) : (
                      <>القيمة الافتراضية: {pricePerMeter} د.ل (قابل للتعديل)</>
                    )}
                  </div>
                </div>

              {totalCutouts > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="cutoutPrice">سعر قص المجسم الواحد (د.ل)</Label>
                    <Input
                      id="cutoutPrice"
                      type="number"
                      step="0.01"
                      value={cutoutPricePerUnit}
                      onChange={(e) => setCutoutPricePerUnit(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                    <div className="text-xs text-muted-foreground">
                      التكلفة: {totalCutouts} مجسم × {cutoutPricePerUnit} = {cutoutsCost.toFixed(2)} د.ل
                    </div>
                  </div>
                )}
              </div>

              {/* ملخص التكلفة */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>تكلفة الطباعة:</span>
                  <span className="font-semibold">{printCost.toFixed(2)} د.ل</span>
                </div>
                {totalCutouts > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>تكلفة القص ({totalCutouts} مجسم):</span>
                    <span className="font-semibold">{cutoutsCost.toFixed(2)} د.ل</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>الإجمالي:</span>
                  <span className="text-primary">{estimatedCost.toFixed(2)} د.ل</span>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* الأزرار */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCreatePrintTask}
              disabled={loading || pricePerMeter === 0 || designGroups.length === 0 || !printerId}
              className="print:hidden"
            >
              {loading ? 'جاري الإنشاء...' : !printerId ? 'اختر المطبعة أولاً' : 'حفظ مهمة الطباعة'}
            </Button>
          </div>

          {/* ملاحظات للطباعة */}
          <div className="hidden print:block text-sm text-muted-foreground mt-4 border-t pt-4">
            <p>ملاحظات مهمة:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>يرجى التحقق من جودة التصاميم قبل البدء بالطباعة</li>
              <li>العناصر المجسمة تحتاج إلى قص دقيق حسب المواصفات</li>
              <li>التأكد من المقاسات النهائية قبل التسليم</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
