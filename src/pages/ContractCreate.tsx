// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { createContract } from '@/services/contractService';
import type { Billboard } from '@/types';
import { useContractForm } from '@/hooks/useContractForm';
import { useContractCalculations } from '@/hooks/useContractCalculations';
import { useContractPricing } from '@/hooks/useContractPricing';
import { BillboardSelectionMap } from '@/components/Map/BillboardSelectionMap';
import { DesignManager } from '@/components/contracts/DesignManager';
import { DollarSign, Settings, PaintBucket, List, Map as MapIcon, ArrowLeft } from 'lucide-react';

// ✅ Import shared components from ContractEdit
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';

// ✅ Currency options
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

  // ✅ Print & Installation toggles
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);

  // ✅ Design management
  const [designs, setDesigns] = useState<Array<{
    billboardId: string;
    billboardName: string;
    designFaceA: string;
    designFaceB: string;
    notes?: string;
  }>>([]);

  // ✅ Currency
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);

  // ✅ Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');

  // ✅ Use unified pricing hook
  const pricing = useContractPricing();

  // ✅ Contract form hook
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

  // ✅ Get current currency
  const getCurrentCurrency = () => {
    return CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];
  };

  // ✅ Convert price based on currency
  const convertPrice = (priceInLYD: number): number => {
    return Math.round((priceInLYD * exchangeRate) * 100) / 100;
  };

  // ✅ Calculate print cost
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.Size || '') as string;
    const faces = Number(billboard.Faces_Count || 1);
    
    const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (!sizeMatch) return 0;
    
    const width = parseFloat(sizeMatch[1]);
    const height = parseFloat(sizeMatch[2]);
    const area = width * height;
    
    const costInLYD = area * faces * printPricePerMeter;
    return convertPrice(costInLYD);
  };

  // ✅ Calculate total print cost
  const printCostTotal = React.useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String(b.ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  // ✅ Estimated total with print
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

  // ✅ Contract calculations
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

  // ✅ Rental cost only
  const rentalCostOnly = React.useMemo(() => {
    const actualInstallationCost = installationEnabled ? convertPrice(installationCost) : 0;
    return Math.max(0, calculations.finalTotal - actualInstallationCost - printCostTotal);
  }, [calculations.finalTotal, installationCost, installationEnabled, printCostTotal, exchangeRate]);

  // ✅ Operating fee
  const operatingFee = React.useMemo(() => {
    const baseForFee = !installationEnabled ? calculations.finalTotal - printCostTotal : rentalCostOnly;
    return Math.round(baseForFee * (operatingFeeRate / 100) * 100) / 100;
  }, [installationEnabled, calculations.finalTotal, printCostTotal, rentalCostOnly, operatingFeeRate]);

  // ✅ Get next contract number
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

  // ✅ Load available billboards
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

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
        } else {
          setBillboards(data || []);
        }
      } catch (e: any) {
        console.error("Unexpected error:", e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
        setBillboards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Calculate billboard price
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

  // ✅ Toggle billboard selection
  const toggleSelect = (billboard: Billboard) => {
    const id = String(billboard.ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ✅ Remove selected billboard
  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  // ✅ Submit contract
  const submit = async () => {
    try {
      if (!formData.customerName || !formData.startDate || !formData.endDate || selected.length === 0) {
        toast.error('يرجى تعبئة بيانات الزبون والتواريخ واختيار لوحات');
        return;
      }

      // Validate installments
      const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      if (Math.abs(totalInstallments - calculations.finalTotal) > 1) {
        toast.error(`إجمالي الدفعات (${totalInstallments}) يجب أن يساوي المبلغ الإجمالي (${calculations.finalTotal})`);
        return;
      }

      setSaving(true);

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
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => ({
          billboardId: b.id,
          contractPrice: b.contractPrice,
          printCost: b.printCost,
          pricingCategory: b.pricingCategory,
          pricingMode: b.pricingMode,
          duration: b.duration
        }))),
        installments_data: installments,
        installation_cost: installationEnabled ? convertPrice(installationCost) : 0,
        installation_enabled: installationEnabled,
        print_cost: printCostTotal,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        operating_fee_rate: operatingFeeRate,
        fee: operatingFee,
        'Total Paid': 0,
        'Remaining': calculations.finalTotal,
        rent_cost: calculations.finalTotal,
        discount: calculations.discountAmount,
        billboard_designs: JSON.stringify(designs),
      };
      
      if (formData.customerId) payload.customer_id = formData.customerId;
      
      await createContract(payload);
      toast.success(`تم إنشاء العقد بعملة ${getCurrentCurrency().name} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error('❌ Contract creation error:', e);
      toast.error(e?.message || 'فشل إنشاء العقد');
    } finally {
      setSaving(false);
    }
  };

  const currentCurrency = getCurrentCurrency();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            إنشاء عقد جديد {nextContractNumber && `#${nextContractNumber}`}
          </h1>
          <p className="text-muted-foreground mt-2">إنشاء عقد إيجار جديد مع نظام دفعات ديناميكي</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>
            <ArrowLeft className="h-4 w-4 ml-2" />
            عودة
          </Button>
          <Button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'جارِ الإنشاء...' : 'إنشاء العقد'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <CustomerInfoForm
            formData={formData}
            updateFormData={updateFormData}
          />

          {/* Contract Dates & Duration */}
          <ContractDatesForm
            formData={formData}
            updateFormData={updateFormData}
            calculateDueDate={calculateDueDate}
          />

          {/* Billboard Selection */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">اختيار اللوحات</h3>
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
              
              <TabsContent value="list" className="space-y-4">
                {/* Selected Billboards */}
                {selected.length > 0 && (
                  <SelectedBillboardsCard
                    billboards={billboards}
                    selected={selected}
                    onRemove={removeSelected}
                    calculateBillboardPrice={calculateBillboardPrice}
                    currencySymbol={currentCurrency.symbol}
                  />
                )}

                {/* Filters */}
                <BillboardFilters
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  sizeFilter={sizeFilter}
                  setSizeFilter={setSizeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  billboards={billboards}
                />

                {/* Available Billboards Grid */}
                <AvailableBillboardsGrid
                  billboards={billboards}
                  selected={selected}
                  searchQuery={searchQuery}
                  cityFilter={cityFilter}
                  sizeFilter={sizeFilter}
                  statusFilter={statusFilter}
                  onToggleSelect={toggleSelect}
                  calculateBillboardPrice={calculateBillboardPrice}
                  loading={loading}
                  currencySymbol={currentCurrency.symbol}
                />
              </TabsContent>
              
              <TabsContent value="map">
                <BillboardSelectionMap
                  billboards={billboards}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  calculateBillboardPrice={calculateBillboardPrice}
                />
              </TabsContent>
            </Tabs>
          </Card>

          {/* Design Manager */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <PaintBucket className="h-5 w-5" />
              <h3 className="text-xl font-bold">إدارة التصاميم</h3>
            </div>
            <DesignManager
              designs={designs}
              setDesigns={setDesigns}
              selectedBillboards={billboards.filter(b => selected.includes(String(b.ID)))}
            />
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Installments Manager */}
          <InstallmentsManager
            installments={installments}
            setInstallments={setInstallments}
            finalTotal={calculations.finalTotal}
            calculateDueDate={calculateDueDate}
            startDate={formData.startDate}
          />

          {/* Cost Summary */}
          <CostSummaryCard
            formData={formData}
            updateFormData={updateFormData}
            calculations={calculations}
            installationCost={installationEnabled ? convertPrice(installationCost) : 0}
            installationEnabled={installationEnabled}
            setInstallationEnabled={setInstallationEnabled}
            printCostTotal={printCostTotal}
            printCostEnabled={printCostEnabled}
            setPrintCostEnabled={setPrintCostEnabled}
            printPricePerMeter={printPricePerMeter}
            setPrintPricePerMeter={setPrintPricePerMeter}
            operatingFee={operatingFee}
            operatingFeeRate={operatingFeeRate}
            setOperatingFeeRate={setOperatingFeeRate}
            contractCurrency={contractCurrency}
            setContractCurrency={setContractCurrency}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            currencies={CURRENCIES}
            installments={installments}
          />
        </div>
      </div>
    </div>
  );
}
