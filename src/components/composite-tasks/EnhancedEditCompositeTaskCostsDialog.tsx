import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { Wrench, Printer, Scissors, DollarSign, Package, Calculator } from 'lucide-react';
import { CompositeProfitCard } from './CompositeProfitCard';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedEditCompositeTaskCostsDialogProps {
  task: CompositeTaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateCompositeTaskCostsInput) => void;
  isSaving?: boolean;
}

export const EnhancedEditCompositeTaskCostsDialog: React.FC<EnhancedEditCompositeTaskCostsDialogProps> = ({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving = false
}) => {
  // تكاليف الزبون
  const [customerInstallationCost, setCustomerInstallationCost] = useState(0);
  const [customerPrintCost, setCustomerPrintCost] = useState(0);
  const [customerCutoutCost, setCustomerCutoutCost] = useState(0);
  
  // تكاليف الشركة
  const [companyInstallationCost, setCompanyInstallationCost] = useState(0);
  const [companyPrintCost, setCompanyPrintCost] = useState(0);
  const [companyCutoutCost, setCompanyCutoutCost] = useState(0);
  
  // بيانات تفصيلية
  const [billboardsCount, setBillboardsCount] = useState(0);
  const [totalPrintArea, setTotalPrintArea] = useState(0);
  const [totalCutouts, setTotalCutouts] = useState(0);
  const [pricePerMeterCustomer, setPricePerMeterCustomer] = useState(0);
  const [pricePerMeterCompany, setPricePerMeterCompany] = useState(0);
  const [pricePerCutoutCustomer, setPricePerCutoutCustomer] = useState(0);
  const [pricePerCutoutCompany, setPricePerCutoutCompany] = useState(0);
  const [editMode, setEditMode] = useState<'total' | 'unit'>('total');
  
  // تكاليف التركيب الأساسية
  const [baseInstallationCosts, setBaseInstallationCosts] = useState<Array<{size: string; cost: number; count: number}>>([]);
  const [installationCostPerBillboard, setInstallationCostPerBillboard] = useState(0);
  
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && open) {
      loadTaskDetails();
    }
  }, [task, open]);

  const loadTaskDetails = async () => {
    if (!task) return;
    
    setLoading(true);
    try {
      // تحميل عدد اللوحات وأحجامها من مهمة التركيب
      let billboardSizes: string[] = [];
      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('billboard_id')
          .eq('task_id', task.installation_task_id);
        
        if (installItems && installItems.length > 0) {
          setBillboardsCount(installItems.length);
          
          // جلب أحجام اللوحات
          const billboardIds = installItems.map(i => i.billboard_id);
          const { data: billboards } = await supabase
            .from('billboards')
            .select('"ID", "Size"')
            .in('ID', billboardIds);
          
          billboardSizes = billboards?.map(b => b.Size).filter(Boolean) as string[] || [];
        }
      }

      // تحميل التكاليف الأساسية للتركيب
      const { data: pricingData } = await supabase
        .from('installation_print_pricing')
        .select('size, install_price');
      
      if (pricingData && billboardSizes.length > 0) {
        // حساب التكاليف الأساسية لكل حجم
        const sizeCounts: Record<string, {cost: number; count: number}> = {};
        billboardSizes.forEach(size => {
          const pricing = pricingData.find(p => p.size === size);
          const baseCost = pricing?.install_price || 0;
          if (!sizeCounts[size]) {
            sizeCounts[size] = { cost: baseCost, count: 0 };
          }
          sizeCounts[size].count++;
        });
        
        const baseCosts = Object.entries(sizeCounts).map(([size, data]) => ({
          size,
          cost: data.cost,
          count: data.count
        }));
        setBaseInstallationCosts(baseCosts);
        
        // حساب متوسط التكلفة لكل لوحة
        if (billboardSizes.length > 0 && task.company_installation_cost) {
          setInstallationCostPerBillboard(task.company_installation_cost / billboardSizes.length);
        }
      }

      // تحميل مساحة الطباعة
      if (task.print_task_id) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('*')
          .eq('task_id', task.print_task_id);
        
        if (printItems) {
          const area = printItems.reduce((sum, item) => sum + (item.area * item.quantity), 0);
          setTotalPrintArea(area);
          
          // حساب سعر المتر
          if (area > 0) {
            setPricePerMeterCustomer(task.customer_print_cost / area);
            setPricePerMeterCompany(task.company_print_cost / area);
          }
        }
      }

      // تحميل عدد المجسمات من cutout_task_items
      if (task.cutout_task_id) {
        const { data: cutoutItems } = await supabase
          .from('cutout_task_items')
          .select('*')
          .eq('task_id', task.cutout_task_id);
        
        if (cutoutItems) {
          const cutouts = cutoutItems.reduce((sum, item) => sum + item.quantity, 0);
          setTotalCutouts(cutouts);
          
          // حساب سعر المجسم
          if (cutouts > 0) {
            setPricePerCutoutCustomer(task.customer_cutout_cost / cutouts);
            setPricePerCutoutCompany(task.company_cutout_cost / cutouts);
          }
        }
      }

      setCustomerInstallationCost(task.customer_installation_cost || 0);
      setCustomerPrintCost(task.customer_print_cost || 0);
      setCustomerCutoutCost(task.customer_cutout_cost || 0);
      setCompanyInstallationCost(task.company_installation_cost || 0);
      setCompanyPrintCost(task.company_print_cost || 0);
      setCompanyCutoutCost(task.company_cutout_cost || 0);
      setDiscountAmount(task.discount_amount || 0);
      setDiscountReason(task.discount_reason || '');
      setNotes(task.notes || '');
    } catch (error) {
      console.error('Error loading task details:', error);
    } finally {
      setLoading(false);
    }
  };

  // تحديث الإجمالي عند تغيير سعر المتر
  const handlePricePerMeterChange = (value: number, isCustomer: boolean) => {
    const newTotal = value * totalPrintArea;
    if (isCustomer) {
      setPricePerMeterCustomer(value);
      setCustomerPrintCost(newTotal);
    } else {
      setPricePerMeterCompany(value);
      setCompanyPrintCost(newTotal);
    }
  };

  // تحديث تكلفة التركيب بناءً على سعر اللوحة
  const handleInstallationCostPerBillboardChange = (value: number, isCustomer: boolean) => {
    const newTotal = value * billboardsCount;
    if (isCustomer) {
      setCustomerInstallationCost(newTotal);
    } else {
      setInstallationCostPerBillboard(value);
      setCompanyInstallationCost(newTotal);
    }
  };

  // تحديث سعر اللوحة عند تغيير الإجمالي
  const handleTotalInstallationCostChange = (value: number, isCustomer: boolean) => {
    if (isCustomer) {
      setCustomerInstallationCost(value);
    } else {
      setCompanyInstallationCost(value);
      if (billboardsCount > 0) {
        setInstallationCostPerBillboard(value / billboardsCount);
      }
    }
  };

  // تحديث سعر المتر عند تغيير الإجمالي
  const handleTotalPrintCostChange = (value: number, isCustomer: boolean) => {
    if (totalPrintArea > 0) {
      const pricePerMeter = value / totalPrintArea;
      if (isCustomer) {
        setCustomerPrintCost(value);
        setPricePerMeterCustomer(pricePerMeter);
      } else {
        setCompanyPrintCost(value);
        setPricePerMeterCompany(pricePerMeter);
      }
    } else {
      if (isCustomer) {
        setCustomerPrintCost(value);
      } else {
        setCompanyPrintCost(value);
      }
    }
  };

  // تحديث الإجمالي عند تغيير سعر المجسم
  const handlePricePerCutoutChange = (value: number, isCustomer: boolean) => {
    const newTotal = value * totalCutouts;
    if (isCustomer) {
      setPricePerCutoutCustomer(value);
      setCustomerCutoutCost(newTotal);
    } else {
      setPricePerCutoutCompany(value);
      setCompanyCutoutCost(newTotal);
    }
  };

  // تحديث سعر المجسم عند تغيير الإجمالي
  const handleTotalCutoutCostChange = (value: number, isCustomer: boolean) => {
    if (totalCutouts > 0) {
      const pricePerCutout = value / totalCutouts;
      if (isCustomer) {
        setCustomerCutoutCost(value);
        setPricePerCutoutCustomer(pricePerCutout);
      } else {
        setCompanyCutoutCost(value);
        setPricePerCutoutCompany(pricePerCutout);
      }
    } else {
      if (isCustomer) {
        setCustomerCutoutCost(value);
      } else {
        setCompanyCutoutCost(value);
      }
    }
  };

  const handleSave = () => {
    if (!task) return;

    onSave({
      id: task.id,
      customer_installation_cost: customerInstallationCost,
      company_installation_cost: companyInstallationCost,
      customer_print_cost: customerPrintCost,
      company_print_cost: companyPrintCost,
      customer_cutout_cost: customerCutoutCost,
      company_cutout_cost: companyCutoutCost,
      discount_amount: discountAmount,
      discount_reason: discountReason.trim() || undefined,
      notes: notes.trim() || undefined
    });
  };

  // حساب الإجماليات والربح
  const customerSubtotal = customerInstallationCost + customerPrintCost + customerCutoutCost;
  const customerTotal = customerSubtotal - discountAmount;
  const companyTotal = companyInstallationCost + companyPrintCost + companyCutoutCost;
  const netProfit = customerTotal - companyTotal;
  const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

  if (!task) return null;

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            تعديل تكاليف المهمة المجمعة
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">جاري تحميل التفاصيل...</div>
        ) : (
          <div className="space-y-4 py-4">
            {/* عنوان المهمة */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">العميل</div>
                    <div className="font-semibold">{task.customer_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">رقم العقد</div>
                    <div className="font-semibold">#{task.contract_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">عدد اللوحات</div>
                    <div className="font-semibold flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {billboardsCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">نوع المهمة</div>
                    <div className="font-semibold text-xs">
                      {task.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}
                    </div>
                  </div>
                </div>
                
                {(totalPrintArea > 0 || totalCutouts > 0) && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    {totalPrintArea > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">إجمالي مساحة الطباعة</div>
                        <div className="font-semibold text-blue-600">{totalPrintArea.toFixed(2)} م²</div>
                      </div>
                    )}
                    {totalCutouts > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">عدد المجسمات</div>
                        <div className="font-semibold text-purple-600">{totalCutouts}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Toggle بين التعديل بالإجمالي أو بسعر الوحدة */}
            <div className="flex items-center justify-center gap-2 p-2 bg-muted rounded-lg">
              <Button
                variant={editMode === 'total' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEditMode('total')}
              >
                التعديل بالإجمالي
              </Button>
              <Button
                variant={editMode === 'unit' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEditMode('unit')}
              >
                التعديل بسعر الوحدة
              </Button>
            </div>

          <Tabs defaultValue="customer" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customer">تكاليف الزبون</TabsTrigger>
              <TabsTrigger value="company">تكاليف الشركة</TabsTrigger>
            </TabsList>

            {/* تكاليف الزبون */}
            <TabsContent value="customer" className="space-y-4">
              {/* تكلفة التركيب من الزبون */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Wrench className="h-5 w-5 text-orange-600" />
                    تكلفة التركيب - الزبون
                  </Label>
                  
                  {/* عرض التكلفة الأساسية */}
                  {baseInstallationCosts.length > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg space-y-1 text-sm">
                      <div className="font-semibold text-orange-700 dark:text-orange-400">التكلفة الأساسية (من قائمة الأسعار):</div>
                      {baseInstallationCosts.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>مقاس {item.size}: {item.cost.toLocaleString('ar-LY')} د.ل × {item.count}</span>
                          <span className="font-medium">{(item.cost * item.count).toLocaleString('ar-LY')} د.ل</span>
                        </div>
                      ))}
                      <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                        <span>إجمالي التكلفة الأساسية:</span>
                        <span>{baseInstallationCosts.reduce((sum, i) => sum + (i.cost * i.count), 0).toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </div>
                  )}
                  
                  {task.task_type === 'reinstallation' || customerInstallationCost > 0 ? (
                    <>
                      {editMode === 'unit' && billboardsCount > 0 ? (
                        <>
                          <div>
                            <Label className="text-xs text-muted-foreground">سعر اللوحة الواحدة (د.ل)</Label>
                            <Input
                              type="number"
                              value={billboardsCount > 0 ? (customerInstallationCost / billboardsCount).toFixed(2) : 0}
                              onChange={(e) => handleInstallationCostPerBillboardChange(Number(e.target.value) || 0, true)}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg space-y-1">
                            <div className="text-sm">عدد اللوحات: {billboardsCount}</div>
                            <div className="text-sm font-semibold text-orange-600">الإجمالي: {customerInstallationCost.toFixed(2)} د.ل</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Input
                            type="number"
                            value={customerInstallationCost}
                            onChange={(e) => setCustomerInstallationCost(Number(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                          <div className="text-xs text-muted-foreground">
                            عدد اللوحات: {billboardsCount} • متوسط التكلفة لكل لوحة: {billboardsCount > 0 ? (customerInstallationCost / billboardsCount).toFixed(2) : 0} د.ل
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        التركيب الجديد شامل من العقد (مجاني للزبون)
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* تكلفة الطباعة من الزبون */}
              {task.print_task_id && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <Printer className="h-5 w-5 text-blue-600" />
                      تكلفة الطباعة - الزبون
                    </Label>
                    
                    {editMode === 'unit' && totalPrintArea > 0 ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">سعر المتر المربع (د.ل)</Label>
                          <Input
                            type="number"
                            value={pricePerMeterCustomer.toFixed(2)}
                            onChange={(e) => handlePricePerMeterChange(Number(e.target.value) || 0, true)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg space-y-1">
                          <div className="text-sm">المساحة الإجمالية: {totalPrintArea.toFixed(2)} م²</div>
                          <div className="text-sm font-semibold text-blue-600">الإجمالي: {customerPrintCost.toFixed(2)} د.ل</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={customerPrintCost}
                          onChange={(e) => handleTotalPrintCostChange(Number(e.target.value) || 0, true)}
                          min="0"
                          step="0.01"
                        />
                        {totalPrintArea > 0 && (
                          <div className="text-xs text-muted-foreground">
                            المساحة: {totalPrintArea.toFixed(2)} م² • سعر المتر: {pricePerMeterCustomer.toFixed(2)} د.ل
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* تكلفة القص من الزبون */}
              {task.cutout_task_id && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <Scissors className="h-5 w-5 text-purple-600" />
                      تكلفة القص - الزبون
                    </Label>
                    
                    {editMode === 'unit' && totalCutouts > 0 ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">سعر المجسم الواحد (د.ل)</Label>
                          <Input
                            type="number"
                            value={pricePerCutoutCustomer.toFixed(2)}
                            onChange={(e) => handlePricePerCutoutChange(Number(e.target.value) || 0, true)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg space-y-1">
                          <div className="text-sm">عدد المجسمات: {totalCutouts}</div>
                          <div className="text-sm font-semibold text-purple-600">الإجمالي: {customerCutoutCost.toFixed(2)} د.ل</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={customerCutoutCost}
                          onChange={(e) => handleTotalCutoutCostChange(Number(e.target.value) || 0, true)}
                          min="0"
                          step="0.01"
                        />
                        {totalCutouts > 0 && (
                          <div className="text-xs text-muted-foreground">
                            عدد المجسمات: {totalCutouts} • سعر المجسم: {pricePerCutoutCustomer.toFixed(2)} د.ل
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* تكاليف الشركة */}
            <TabsContent value="company" className="space-y-4">
              {/* تكلفة التركيب الفعلية */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Wrench className="h-5 w-5 text-orange-600" />
                    تكلفة التركيب - الشركة
                  </Label>
                  
                  {/* عرض التكلفة الأساسية */}
                  {baseInstallationCosts.length > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg space-y-1 text-sm">
                      <div className="font-semibold text-orange-700 dark:text-orange-400">التكلفة الأساسية (من قائمة الأسعار):</div>
                      {baseInstallationCosts.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>مقاس {item.size}: {item.cost.toLocaleString('ar-LY')} د.ل × {item.count}</span>
                          <span className="font-medium">{(item.cost * item.count).toLocaleString('ar-LY')} د.ل</span>
                        </div>
                      ))}
                      <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                        <span>إجمالي التكلفة الأساسية:</span>
                        <span>{baseInstallationCosts.reduce((sum, i) => sum + (i.cost * i.count), 0).toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </div>
                  )}
                  
                  {editMode === 'unit' && billboardsCount > 0 ? (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">سعر اللوحة الواحدة (د.ل)</Label>
                        <Input
                          type="number"
                          value={installationCostPerBillboard.toFixed(2)}
                          onChange={(e) => handleInstallationCostPerBillboardChange(Number(e.target.value) || 0, false)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg space-y-1">
                        <div className="text-sm">عدد اللوحات: {billboardsCount}</div>
                        <div className="text-sm font-semibold text-orange-600">الإجمالي: {companyInstallationCost.toFixed(2)} د.ل</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={companyInstallationCost}
                        onChange={(e) => handleTotalInstallationCostChange(Number(e.target.value) || 0, false)}
                        min="0"
                        step="0.01"
                      />
                      <div className="text-xs text-muted-foreground">
                        التكلفة الفعلية التي دفعتها الشركة لفريق التركيب
                        {billboardsCount > 0 && ` • متوسط: ${(companyInstallationCost / billboardsCount).toFixed(2)} د.ل/لوحة`}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* تكلفة الطباعة الفعلية */}
              {task.print_task_id && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <Printer className="h-5 w-5 text-blue-600" />
                      تكلفة الطباعة - الشركة
                    </Label>
                    
                    {editMode === 'unit' && totalPrintArea > 0 ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">سعر المتر المربع (د.ل)</Label>
                          <Input
                            type="number"
                            value={pricePerMeterCompany.toFixed(2)}
                            onChange={(e) => handlePricePerMeterChange(Number(e.target.value) || 0, false)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg space-y-1">
                          <div className="text-sm">المساحة الإجمالية: {totalPrintArea.toFixed(2)} م²</div>
                          <div className="text-sm font-semibold text-blue-600">الإجمالي: {companyPrintCost.toFixed(2)} د.ل</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={companyPrintCost}
                          onChange={(e) => handleTotalPrintCostChange(Number(e.target.value) || 0, false)}
                          min="0"
                          step="0.01"
                        />
                        {totalPrintArea > 0 && (
                          <div className="text-xs text-muted-foreground">
                            المساحة: {totalPrintArea.toFixed(2)} م² • سعر المتر: {pricePerMeterCompany.toFixed(2)} د.ل
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      التكلفة التي دفعتها الشركة للمطبعة
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* تكلفة القص الفعلية */}
              {task.cutout_task_id && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <Scissors className="h-5 w-5 text-purple-600" />
                      تكلفة القص - الشركة
                    </Label>
                    
                    {editMode === 'unit' && totalCutouts > 0 ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">سعر المجسم الواحد (د.ل)</Label>
                          <Input
                            type="number"
                            value={pricePerCutoutCompany.toFixed(2)}
                            onChange={(e) => handlePricePerCutoutChange(Number(e.target.value) || 0, false)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg space-y-1">
                          <div className="text-sm">عدد المجسمات: {totalCutouts}</div>
                          <div className="text-sm font-semibold text-purple-600">الإجمالي: {companyCutoutCost.toFixed(2)} د.ل</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={companyCutoutCost}
                          onChange={(e) => handleTotalCutoutCostChange(Number(e.target.value) || 0, false)}
                          min="0"
                          step="0.01"
                        />
                        {totalCutouts > 0 && (
                          <div className="text-xs text-muted-foreground">
                            عدد المجسمات: {totalCutouts} • سعر المجسم: {pricePerCutoutCompany.toFixed(2)} د.ل
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      التكلفة الفعلية لعملية القص
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* تحليل الربحية */}
          <CompositeProfitCard
            customerTotal={customerTotal}
            companyTotal={companyTotal}
            netProfit={netProfit}
            profitPercentage={profitPercentage}
          />

          {/* الخصم */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-red-600" />
                خصم على الفاتورة
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">مبلغ الخصم (د.ل)</Label>
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">سبب الخصم</Label>
                  <Input
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="سبب الخصم (اختياري)..."
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="text-sm text-red-700 dark:text-red-400">
                    <strong>الخصم:</strong> {discountAmount.toLocaleString('ar-LY')} د.ل
                    {discountReason && <span className="text-xs"> ({discountReason})</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    الإجمالي قبل الخصم: {customerSubtotal.toLocaleString('ar-LY')} د.ل → 
                    الإجمالي بعد الخصم: {customerTotal.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات إضافية..."
              rows={3}
            />
          </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
