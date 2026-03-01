// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { createContract } from '@/services/contractService';
import type { Billboard } from '@/types';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractForm } from '@/hooks/useContractForm';
import { useContractCalculations } from '@/hooks/useContractCalculations';
import { useContractInstallments } from '@/hooks/useContractInstallments';
import { useContractPricing } from '@/hooks/useContractPricing';
import { ContractFormSidebar } from '@/components/contracts/ContractFormSidebar';
import { ContractExpensesManager } from '@/components/contracts/ContractExpensesManager';
import { BillboardSelector } from '@/components/contracts/BillboardSelector';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { InstallationCostSummary } from '@/components/contracts/InstallationCostSummary';
import { DesignManager, type BillboardDesign } from '@/components/contracts/DesignManager';
import { DollarSign, Settings, PaintBucket, List, Map as MapIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractCreate() {
  const navigate = useNavigate();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nextContractNumber, setNextContractNumber] = useState<string>('');
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  // ✅ NEW: Installation enable/disable toggle
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);

  // ✅ NEW: Design management state
  const [designs, setDesigns] = useState<Array<{
    billboardId: string;
    billboardName: string;
    designFaceA: string;
    designFaceB: string;
    notes?: string;
  }>>([]);

  // ✅ NEW: Currency conversion state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // ✅ NEW: Operating fee rate state
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');

  // ✅ NEW: Use unified pricing hook
  const pricing = useContractPricing();

  // Contract form hook
  const {
    formData,
    updateFormData,
    selected,
    setSelected,
    installments,
    setInstallments,
    updateInstallment,
    userEditedRentCost,
    setUserEditedRentCost,
    installationCost,
    installationDetails,
    calculateDueDate
  } = useContractForm();

  // ✅ NEW: Get current currency info
  const getCurrentCurrency = () => {
    return CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];
  };

  // ✅ NEW: Apply currency conversion to price
  const convertPrice = (priceInLYD: number): number => {
    return Math.round((priceInLYD * exchangeRate) * 100) / 100;
  };

  // ✅ REMOVED: Now using unified pricing hook - pricing.getPriceFromDatabase & pricing.getDailyPriceFromDatabase

  // ✅ UPDATED: Calculate print cost only if enabled
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.Size || '') as string;
    const faces = Number(billboard.Faces_Count || 1);
    
    const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
    if (!sizeMatch) return 0;
    
    const width = parseFloat(sizeMatch[1].replace(',', '.'));
    const height = parseFloat(sizeMatch[2].replace(',', '.'));
    const area = width * height;
    
    const costInLYD = area * faces * printPricePerMeter;
    return convertPrice(costInLYD);
  };

  // ✅ NEW: Calculate print cost total
  const printCostTotal = React.useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String(b.ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  // ✅ UNIFIED: Contract calculations using unified pricing hook
  const estimatedTotalWithPrint = React.useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String(b.ID)));
    return sel.reduce((acc, b) => {
      const basePrice = pricing.calculateBillboardPrice(
        b,
        formData.pricingMode,
        formData.durationMonths,
        formData.durationDays,
        formData.pricingCategory,
        convertPrice
      );
      const printCost = calculatePrintCost(b);
      return acc + basePrice + printCost;
    }, 0);
  }, [billboards, selected, formData.durationMonths, formData.durationDays, formData.pricingMode, formData.pricingCategory, pricing.pricingData, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  const calculations = useContractCalculations({
    formData,
    selected,
    billboards,
    userEditedRentCost,
    installationCost,
    installationEnabled,
    pricingData: pricing.pricingData,
    getPriceFromDatabase: pricing.getPriceFromDatabase,
    getDailyPriceFromDatabase: pricing.getDailyPriceFromDatabase,
    onRentCostChange: (cost) => updateFormData({ rentCost: cost }),
    customEstimatedTotal: estimatedTotalWithPrint,
    convertPrice
  });

  // ✅ NEW: Calculate rental cost only
  const rentalCostOnly = React.useMemo(() => {
    const actualInstallationCost = installationEnabled ? convertPrice(installationCost) : 0;
    return Math.max(0, calculations.finalTotal - actualInstallationCost - printCostTotal);
  }, [calculations.finalTotal, installationCost, installationEnabled, printCostTotal, exchangeRate]);

  // ✅ FIXED: Calculate operating fee based on installationEnabled
  const operatingFee = React.useMemo(() => {
    // When installation is disabled, calculate from finalTotal - printCost
    // When installation is enabled, calculate from rentalCostOnly
    const baseForFee = !installationEnabled ? calculations.finalTotal - printCostTotal : rentalCostOnly;
    return Math.round(baseForFee * (operatingFeeRate / 100) * 100) / 100;
  }, [installationEnabled, calculations.finalTotal, printCostTotal, rentalCostOnly, operatingFeeRate]);

  // Installments management hook
  const installmentManager = useContractInstallments({
    installments,
    setInstallments,
    finalTotal: calculations.finalTotal,
    calculateDueDate
  });

  // Get next contract number
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('Contract')
          .select('Contract_Number')
          .order('Contract_Number', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const lastNumber = parseInt(data[0].Contract_Number) || 0;
          setNextContractNumber(String(lastNumber + 1));
        } else {
          setNextContractNumber('1');
        }
      } catch (e) {
        console.warn('Failed to get next contract number, using 1');
        setNextContractNumber('1');
      }
    })();
  }, []);

  // ✅ Load billboards with availability filter — cross-check active contracts
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // 1) Load billboards that look available based on their own fields
        const { data, error } = await supabase
          .from("billboards")
          .select(`
            "ID",
            "Billboard_Name",
            "Status",
            "Rent_End_Date",
            "Size",
            "Level",
            "Price",
            "Nearest_Landmark",
            "City",
            "Image_URL",
            "Faces_Count",
            "GPS_Coordinates",
            "size_id"
          `)
          .or(`"Rent_End_Date".is.null,"Rent_End_Date".lt.${today}`)
          .eq("Status", "متاح");

        if (error) {
          console.error("Supabase error:", error);
          toast.error('فشل تحميل اللوحات: ' + (error.message || 'تحقق من الشبكة'));
          setBillboards([]);
          setLoading(false);
          return;
        }

        // 2) Load active contracts to cross-check billboard_ids
        const { data: activeContracts } = await supabase
          .from('Contract')
          .select('"Contract_Number", billboard_ids, "End Date"')
          .gte('"End Date"', today);

        // Build a set of billboard IDs that are in active contracts
        const occupiedIds = new Set<number>();
        if (activeContracts) {
          for (const contract of activeContracts) {
            const ids = contract.billboard_ids;
            if (ids && typeof ids === 'string') {
              ids.split(',').forEach((id: string) => {
                const num = parseInt(id.trim(), 10);
                if (!isNaN(num)) occupiedIds.add(num);
              });
            }
          }
        }

        // 3) Filter out billboards that are actually in active contracts
        const availableBillboards = (data || []).filter(
          (b: any) => !occupiedIds.has(b.ID)
        );

        console.log('✅ تم تحميل', data?.length || 0, 'لوحة، منها', availableBillboards.length, 'متاحة فعلياً بعد التحقق من العقود النشطة');
        setBillboards(availableBillboards);
      } catch (e: any) {
        console.error("Unexpected error:", e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
        setBillboards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Load pricing categories ONLY from DB
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('name')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          setPricingCategories(categories);
        } else {
          setPricingCategories([]);
          toast.error('لم يتم العثور على فئات سعرية');
        }
      } catch (e) {
        console.error('Failed to load pricing categories:', e);
        setPricingCategories([]);
        toast.error('فشل تحميل فئات الأسعار');
      }
    })();
  }, []);

  // ✅ UNIFIED: Calculate billboard price using unified pricing hook
  const calculateBillboardPrice = (billboard: Billboard): number => {
    const basePrice = pricing.calculateBillboardPrice(
      billboard,
      formData.pricingMode,
      formData.durationMonths,
      formData.durationDays,
      formData.pricingCategory,
      convertPrice
    );
    const printCost = calculatePrintCost(billboard);
    return basePrice + printCost;
  };

  // Toggle billboard selection
  const toggleSelect = (billboard: Billboard) => {
    const id = String(billboard.ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Remove selected billboard
  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  // ✅ UNIFIED: Submit contract with better error handling
  const submit = async () => {
    try {
      console.log('🚀 Starting contract submission...');
      
      if (!formData.customerName || !formData.startDate || !formData.endDate || selected.length === 0) {
        toast.error('يرجى تعبئة بيانات الزبون والتواريخ واختيار لوحات');
        return;
      }

      const validation = installmentManager.validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }

      setSaving(true);
      console.log('✅ Validation passed, preparing payload...');

      const selectedBillboardsData = billboards
        .filter((b) => selected.includes(String(b.ID)))
        .map((b) => ({
          id: String(b.ID),
          name: b.Billboard_Name || '',
          location: b.Nearest_Landmark || '',
          city: b.City || '',
          size: b.Size || '',
          level: b.Level || '',
          price: Number(b.Price) || 0,
          image: b.Image_URL || '',
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: formData.pricingCategory,
          pricingMode: formData.pricingMode,
          duration: formData.pricingMode === 'months' ? formData.durationMonths : formData.durationDays
        }));

      const payload: any = {
        customer_name: formData.customerName,
        start_date: formData.startDate,
        end_date: formData.endDate,
        'Customer Name': formData.customerName,
        'Ad Type': formData.adType,
        'Contract Date': formData.startDate,
        'End Date': formData.endDate,
        'Total': calculations.finalTotal,
        'Total Rent': rentalCostOnly,
        'Discount': calculations.discountAmount,
        ad_type: formData.adType,
        billboard_ids: selected,
        customer_category: formData.pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        // ✅ Store billboard prices with discount details for history
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => {
          const billboardPrice = b.contractPrice; // السعر قبل الخصم
          const discountPerBillboard = selected.length > 0 
            ? calculations.discountAmount * (billboardPrice / estimatedTotalWithPrint) 
            : 0;
          
          return {
            billboardId: b.id,
            priceBeforeDiscount: billboardPrice,
            discountPerBillboard: discountPerBillboard,
            priceAfterDiscount: billboardPrice - discountPerBillboard,
            contractPrice: billboardPrice - discountPerBillboard,
            printCost: b.printCost,
            pricingCategory: b.pricingCategory,
            pricingMode: b.pricingMode,
            duration: b.duration
          };
        })),
        installments_data: installments,
        installation_cost: installationEnabled ? convertPrice(installationCost) : 0,
        installation_enabled: installationEnabled,
        print_cost: printCostTotal,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        fee: operatingFeeRate,
        'Total Paid': 0,
        'Remaining': calculations.finalTotal,
        rent_cost: calculations.finalTotal,
        discount: calculations.discountAmount,
        billboard_designs: JSON.stringify(designs),
      };
      
      if (formData.customerId) payload.customer_id = formData.customerId;
      
      console.log('📦 Payload prepared:', {
        customer: payload.customer_name,
        billboards: payload.billboard_ids?.length || 0,
        total: payload.Total,
        installments: payload.installments_data?.length || 0
      });
      
      console.log('💾 Calling createContract...');
      const result = await createContract(payload);
      console.log('✅ Contract created successfully:', result?.Contract_Number);
      
      toast.success(`تم إنشاء العقد بعملة ${getCurrentCurrency().name} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error('❌ Contract creation error:', e);
      console.error('Error details:', {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code
      });
      toast.error(e?.message || 'فشل إنشاء العقد');
    } finally {
      setSaving(false);
      console.log('🏁 Contract submission finished');
    }
  };

  const currentCurrency = getCurrentCurrency();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header">إنشاء عقد جديد {nextContractNumber && `#${nextContractNumber}`}</h1>
          <p className="page-subtitle">إنشاء عقد إيجار جديد مع نظام دفعات ديناميكي وتكلفة طباعة وعملات متعددة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>
            عودة
          </Button>
          <Button onClick={submit} className="btn-primary">
            إنشاء العقد
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Billboard Selection - Tabs for List and Map View */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label mb-4">اختيار اللوحات</h3>
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  عرض القائمة
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4" />
                  عرض الخريطة
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="list">
                <BillboardSelector
                  billboards={billboards}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onRemoveSelected={removeSelected}
                  loading={loading}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  sizeFilter={sizeFilter}
                  setSizeFilter={setSizeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  pricingCategory={formData.pricingCategory}
                  setPricingCategory={(category) => updateFormData({ pricingCategory: category })}
                  pricingCategories={pricingCategories}
                  calculateBillboardPrice={calculateBillboardPrice}
                  installationDetails={installationDetails}
                  pricingMode={formData.pricingMode}
                  durationMonths={formData.durationMonths}
                  durationDays={formData.durationDays}
                  currencySymbol={currentCurrency.symbol}
                />
              </TabsContent>
              
              <TabsContent value="map" className="mt-0">
                <div className="relative w-full" style={{ height: '700px' }}>
                  <SelectableGoogleHomeMap
                    billboards={billboards.map(b => ({
                      ...b,
                      id: String(b.ID || ''),
                      name: b.Billboard_Name || '',
                      location: b.Nearest_Landmark || '',
                      size: b.Size || '',
                      status: (b.Status === 'متاح' || b.Status === 'available') ? 'available' : 'rented',
                      coordinates: (b as any).GPS_Coordinates || '',
                      imageUrl: b.Image_URL || '',
                      expiryDate: (b as any).Rent_End_Date || null,
                      area: (b as any).District || '',
                      municipality: b.Municipality || '',
                      Customer_Name: (b as any).Customer_Name || '',
                      Ad_Type: (b as any).Ad_Type || '',
                      size_id: (b as any).size_id || null,
                    })) as Billboard[]}
                    selectedBillboards={new Set(selected)}
                    onToggleSelection={(id) => {
                      const billboard = billboards.find((b: any) => String(b.ID) === id);
                      if (billboard) toggleSelect(billboard);
                    }}
                    onSelectMultiple={(billboardIds) => {
                      billboardIds.forEach(id => {
                        const billboard = billboards.find((b: any) => String(b.ID) === id);
                        if (billboard && !selected.includes(String(billboard.ID))) {
                          toggleSelect(billboard);
                        }
                      });
                    }}
                    onSelectAll={() => {
                      const availableIds = billboards
                        .filter(b => b.Status === 'متاح')
                        .map(b => String(b.ID));
                      setSelected(availableIds);
                      toast.success(`تم تحديد ${availableIds.length} لوحة`);
                    }}
                    onClearAll={() => {
                      setSelected([]);
                      toast.info('تم إلغاء تحديد جميع اللوحات');
                    }}
                    pricingMode={formData.pricingMode}
                    durationMonths={formData.durationMonths}
                    durationDays={formData.durationDays}
                    pricingCategory={formData.pricingCategory}
                    calculateBillboardPrice={calculateBillboardPrice}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Currency Selection */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                إعدادات العملة
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="expenses-form-label block mb-2">عملة العقد</label>
                <Select value={contractCurrency} onValueChange={setContractCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر العملة" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">سعر الصرف (1 د.ل = ؟ {contractCurrency})</label>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                  placeholder="1"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">العملة المعروضة</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold flex items-center gap-2">
                  <span className="text-2xl">{currentCurrency.symbol}</span>
                  <span>{currentCurrency.name}</span>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">مثال على التحويل:</div>
              <div>1,000 د.ل × {exchangeRate} = {convertPrice(1000).toLocaleString()} {currentCurrency.symbol}</div>
            </div>
          </div>

          {/* Print Cost */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label">تكلفة الطباعة</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">تفعيل تكلفة الطباعة</label>
                <button
                  type="button"
                  onClick={() => setPrintCostEnabled(!printCostEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    printCostEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      printCostEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className={`text-sm p-2 rounded mb-3 ${
              printCostEnabled 
                ? 'text-green-700 bg-green-50 border border-green-200' 
                : 'text-gray-600 bg-gray-50 border border-gray-200'
            }`}>
              <strong>الحالة الحالية:</strong> تكلفة الطباعة {printCostEnabled ? 'مفعلة ✅' : 'غير مفعلة ❌'}
            </div>
            
            {printCostEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="expenses-form-label block mb-2">سعر المتر للطباعة ({currentCurrency.symbol})</label>
                    <input
                      type="number"
                      value={printPricePerMeter}
                      onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="expenses-form-label block mb-2">إجمالي تكلفة الطباعة</label>
                    <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                      {printCostTotal.toLocaleString('ar-LY')} {currentCurrency.symbol}
                    </div>
                  </div>
                </div>
                
                {printPricePerMeter > 0 && selected.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة الطباعة للوحات المختارة:</div>
                    <div className="space-y-1">
                      {billboards
                        .filter(b => selected.includes(String(b.ID)))
                        .map(b => {
                          const printCost = calculatePrintCost(b);
                          const size = (b.Size || '') as string;
                          const faces = Number(b.Faces_Count || 1);
                          const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
                          const area = sizeMatch ? parseFloat(sizeMatch[1]) * parseFloat(sizeMatch[2]) : 0;
                          
                          return (
                            <div key={b.ID} className="text-xs">
                              <strong>{b.Billboard_Name}:</strong> {area}م² × {faces} وجه × {printPricePerMeter} = {printCost.toLocaleString()} {currentCurrency.symbol}
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  💡 عند تفعيل تكلفة الطباعة، سيتم إضافة التكلفة تلقائياً إلى سعر كل لوحة وستظهر في العقد المطبوع كـ "شاملة تكاليف الطباعة"
                </div>
              </div>
            )}
            
            {!printCostEnabled && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                تكلفة الطباعة غير مفعلة. العقد سيظهر كـ "غير شاملة تكاليف الطباعة"
              </div>
            )}
          </div>

          {/* Design Manager - إدارة تصاميم اللوحات */}
          <DesignManager
            selectedBillboards={billboards
              .filter((b) => selected.includes(String(b.ID)))
              .map((b) => ({
                id: String(b.ID),
                name: b.Billboard_Name || '',
                Image_URL: (b as any).Image_URL,
                image: (b as any).image,
                Nearest_Landmark: (b as any).Nearest_Landmark,
                nearest_landmark: (b as any).nearest_landmark
              }))
            }
            designs={designs}
            onChange={setDesigns}
            contractId={nextContractNumber}
          />

          {/* Operating Fee Settings */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label flex items-center gap-2">
                <Settings className="h-5 w-5" />
                إعدادات رسوم التشغيل
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="expenses-form-label block mb-2">نسبة التشغيل (%)</label>
                <input
                  type="number"
                  value={operatingFeeRate}
                  onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                  className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                  placeholder="3"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">صافي الإيجار (أساس الحساب)</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                  {rentalCostOnly.toLocaleString('ar-LY')} {currentCurrency.symbol}
                </div>
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">رسوم التشغيل المحسوبة</label>
                <div className="px-4 py-3 rounded bg-primary/10 text-primary font-bold">
                  {operatingFee.toLocaleString('ar-LY')} {currentCurrency.symbol}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">طريقة الحساب:</div>
              <div>رسوم التشغيل = صافي الإيجار × {operatingFeeRate}% = {rentalCostOnly.toLocaleString()} × {operatingFeeRate}% = {operatingFee.toLocaleString()} {currentCurrency.symbol}</div>
              <div className="text-xs mt-2 text-blue-600">
                💡 صافي الإيجار = الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة - الخصم
              </div>
            </div>
          </div>

          
          {/* Installation Cost Summary */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-4">
              <h3 className="expenses-preview-label">ملخص تكلفة التركيب</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={installationEnabled}
                  onChange={(e) => setInstallationEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
                <span className="text-sm font-medium">تفعيل التركيب</span>
              </label>
            </div>
            
            {installationEnabled && installationCost > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="expenses-form-label block mb-2">إجمالي تكلفة التركيب</label>
                    <div className="px-4 py-3 rounded bg-orange/10 text-orange font-bold">
                      {convertPrice(installationCost).toLocaleString('ar-LY')} {currentCurrency.symbol}
                    </div>
                  </div>
                  
                  <div>
                    <label className="expenses-form-label block mb-2">عدد اللوحات</label>
                    <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                      {selected.length} لوحة
                    </div>
                  </div>
                </div>

                {installationDetails.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
                    <div className="space-y-1">
                      {Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values())
                        .map((detail, index) => {
                          const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
                          const totalForSize = detail.installationPrice * sizeCount;
                          const convertedPrice = convertPrice(totalForSize);
                          
                          return (
                            <div key={index} className="text-xs flex justify-between">
                              <span><strong>مقاس {detail.size}:</strong> {detail.installationPrice.toLocaleString()} د.ل × {sizeCount} لوحة</span>
                              <span className="font-bold">{convertedPrice.toLocaleString()} {currentCurrency.symbol}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!installationEnabled && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                <div className="font-medium">⚠️ التركيب غير مفعل</div>
                <div className="text-xs mt-2">
                  عند إلغاء التركيب، سيتم حساب نسبة التشغيل من الإجمالي الكلي (صافي الإيجار = الإجمالي الكلي)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <ContractFormSidebar
          formData={formData}
          updateFormData={updateFormData}
          pricingCategories={pricingCategories}
          installments={installments}
          setInstallments={setInstallments}
          updateInstallment={updateInstallment}
          estimatedTotal={estimatedTotalWithPrint}
          baseTotal={calculations.baseTotal}
          discountAmount={calculations.discountAmount}
          totalAfterDiscount={calculations.totalAfterDiscount}
          rentalCostOnly={rentalCostOnly}
          finalTotal={calculations.finalTotal}
          operatingFee={operatingFee}
          installationCost={convertPrice(installationCost)}
          userEditedRentCost={userEditedRentCost}
          setUserEditedRentCost={setUserEditedRentCost}
          onSubmit={submit}
          onCancel={() => navigate('/admin/contracts')}
          saving={saving}
          submitLabel="إنشاء العقد"
          distributeEvenly={installmentManager.distributeEvenly}
          addInstallment={installmentManager.addInstallment}
          removeInstallment={installmentManager.removeInstallment}
          clearAllInstallments={installmentManager.clearAllInstallments}
          calculateDueDate={calculateDueDate}
          currencySymbol={currentCurrency.symbol}
        />
      </div>
    </div>
  );
}