import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { ContractPDFDialog } from '@/components/Contract';
import type { Billboard } from '@/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, Settings, Wrench, FileText, List, Map as MapIcon, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import InteractiveMap from '@/components/InteractiveMap';
import { cleanupOrphanedBillboards } from '@/services/contractCleanupService';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';

// Import modular components
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { DesignManager } from '@/components/contracts/DesignManager';
import { PartnershipBillboardsInfo } from '@/components/contracts/PartnershipBillboardsInfo';
import { FriendBillboardsBulkRental } from '@/components/contracts/edit/FriendBillboardsBulkRental';
import { LevelDiscountsCard } from '@/components/contracts/edit/LevelDiscountsCard';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractNumber, setContractNumber] = useState<string>('');
  const [currentContract, setCurrentContract] = useState<any>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // ✅ NEW: Price update state - DEFAULT to recalculating prices
  const [useStoredPrices, setUseStoredPrices] = useState<boolean>(false); // ✅ CHANGED: Default to false
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  
  // ✅ NEW: Proportional distribution overrides
  const [billboardPriceOverrides, setBillboardPriceOverrides] = useState<Record<string, number>>({});
  
  // ✅ NEW: Factors pricing system state
  const [useFactorsPricing, setUseFactorsPricing] = useState<boolean>(false);
  const [municipalityFactors, setMunicipalityFactors] = useState<any[]>([]);
  const [categoryFactors, setCategoryFactors] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<any[]>([]);

  // ✅ NEW: Currency state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [adType, setAdType] = useState('');

  // Pricing and categories
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [pricingData, setPricingData] = useState<any[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  // ✅ NEW: Installation enable/disable toggle
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);

  // ✅ NEW: Include costs in price toggles
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(false);
  const [includePrintInPrice, setIncludePrintInPrice] = useState<boolean>(false);

  // ✅ NEW: Include operating fee in costs toggles
  const [includeOperatingInPrint, setIncludeOperatingInPrint] = useState<boolean>(false);
  const [includeOperatingInInstallation, setIncludeOperatingInInstallation] = useState<boolean>(false);

  // ✅ NEW: Level-based discounts
  const [levelDiscounts, setLevelDiscounts] = useState<Record<string, number>>({});

  // ✅ NEW: Design management state
  const [billboardDesigns, setBillboardDesigns] = useState<any[]>([]);
  
  // Map view state
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);
  const [partnershipOperatingFeeRate, setPartnershipOperatingFeeRate] = useState<number>(3);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available'); // Default to available only
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');

  // Contract form data
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
  const [use30DayMonth, setUse30DayMonth] = useState<boolean>(true); // حساب الشهر = 30 يوم
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);
  
  // ✅ NEW: Installment distribution settings (saved to DB)
  const [installmentDistributionType, setInstallmentDistributionType] = useState<'single' | 'multiple'>('multiple');
  const [installmentFirstPaymentAmount, setInstallmentFirstPaymentAmount] = useState<number>(0);
  const [installmentFirstPaymentType, setInstallmentFirstPaymentType] = useState<'amount' | 'percent'>('amount');
  const [installmentInterval, setInstallmentInterval] = useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>('month');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentAutoCalculate, setInstallmentAutoCalculate] = useState<boolean>(false);
  const [installmentFirstAtSigning, setInstallmentFirstAtSigning] = useState<boolean>(true);
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = useState<boolean>(false);

  // ✅ NEW: Friend billboard costs
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string;
    friendCompanyId: string;
    friendCompanyName: string;
    friendRentalCost: number;
  }>>([]);

  // ✅ NEW: Friend rental includes installation toggle
  const [friendRentalIncludesInstallation, setFriendRentalIncludesInstallation] = useState<boolean>(false);

  // ✅ NEW: Friend rental operating fee settings
  const [friendRentalOperatingFeeEnabled, setFriendRentalOperatingFeeEnabled] = useState<boolean>(false);
  const [friendRentalOperatingFeeRate, setFriendRentalOperatingFeeRate] = useState<number>(3); // افتراضي 3%

  // Helper functions for friend costs
  const updateFriendBillboardCost = (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => {
    setFriendBillboardCosts(prev => {
      const existing = prev.find(f => f.billboardId === billboardId);
      if (existing) {
        return prev.map(f => 
          f.billboardId === billboardId 
            ? { ...f, friendCompanyId, friendCompanyName, friendRentalCost: cost }
            : f
        );
      } else {
        return [...prev, { billboardId, friendCompanyId, friendCompanyName, friendRentalCost: cost }];
      }
    });
  };

  const totalFriendCosts = React.useMemo(() => 
    friendBillboardCosts.reduce((sum, f) => sum + f.friendRentalCost, 0),
    [friendBillboardCosts]
  );

  // ✅ NEW: Calculate friend rental operating fee (percentage of friend costs)
  const friendOperatingFeeAmount = React.useMemo(() => {
    if (!friendRentalOperatingFeeEnabled || friendBillboardCosts.length === 0) return 0;
    return Math.round(totalFriendCosts * (friendRentalOperatingFeeRate / 100));
  }, [friendRentalOperatingFeeEnabled, totalFriendCosts, friendRentalOperatingFeeRate]);

  // ✅ NEW: Get currency symbol
  const getCurrencySymbol = (currencyCode: string): string => {
    return CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  // ✅ NEW: Apply exchange rate to amount
  const applyExchangeRate = (amount: number): number => {
    return Math.round((amount * exchangeRate) * 100) / 100;
  };

  // Load contract number from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  // Load billboards
  useEffect(() => {
    (async () => {
      try {
        const data = await loadBillboards();
        setBillboards(data);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers(data || []);
        }
      } catch (e) {
        console.warn('load customers failed');
      }
    })();
  }, []);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('name')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          const allCategories = Array.from(new Set([...staticCategories, ...categories]));
          setPricingCategories(allCategories);
        } else {
          setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
        }
      } catch (e) {
        console.warn('Failed to load pricing categories, using defaults');
        setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
      }
    })();
  }, []);

  // ✅ NEW: Size names mapping (size_id -> name)
  const [sizeNames, setSizeNames] = useState(() => new Map<number, string>());

  // Load pricing data and size names
  useEffect(() => {
    (async () => {
      try {
        const [pricingRes, sizesRes, municipalitiesRes, categoriesRes, basePricesRes] = await Promise.all([
          supabase.from('pricing').select('*').order('size', { ascending: true }),
          supabase.from('sizes').select('id, name'),
          supabase.from('municipality_factors').select('*').eq('is_active', true),
          supabase.from('category_factors').select('*').eq('is_active', true),
          supabase.from('base_prices').select('*')
        ]);

        if (!pricingRes.error && Array.isArray(pricingRes.data)) {
          setPricingData(pricingRes.data);
          console.log('✅ Loaded pricing data from database:', pricingRes.data.length, 'rows');
        } else {
          console.error('❌ Failed to load pricing data:', pricingRes.error);
        }

        if (!sizesRes.error && Array.isArray(sizesRes.data)) {
          const sizeMap = new Map(sizesRes.data.map((s: any) => [s.id, s.name]));
          setSizeNames(sizeMap);
          console.log('✅ Loaded size names:', sizeMap.size, 'sizes');
        } else {
          console.error('❌ Failed to load size names:', sizesRes.error);
        }

        // ✅ Load factors pricing data
        if (!municipalitiesRes.error && Array.isArray(municipalitiesRes.data)) {
          setMunicipalityFactors(municipalitiesRes.data);
          console.log('✅ Loaded municipality factors:', municipalitiesRes.data.length);
        }
        if (!categoriesRes.error && Array.isArray(categoriesRes.data)) {
          setCategoryFactors(categoriesRes.data);
          console.log('✅ Loaded category factors:', categoriesRes.data.length);
        }
        if (!basePricesRes.error && Array.isArray(basePricesRes.data)) {
          setBasePrices(basePricesRes.data);
          console.log('✅ Loaded base prices:', basePricesRes.data.length);
        }
      } catch (e) {
        console.warn('Failed to load pricing/size data:', e);
      }
    })();
  }, []);

  // Load contract data
  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        console.log('Loaded contract data:', c);
        console.log('installments_data from contract:', c.installments_data);
        
        setCurrentContract(c);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        
        const savedPricingCategory = c.customer_category || c['customer_category'] || 'عادي';
        setPricingCategory(savedPricingCategory);

        // ✅ NEW: Load currency settings from contract
        const savedCurrency = c.contract_currency || 'LYD';
        const savedExchangeRate = Number(c.exchange_rate || 1);
        setContractCurrency(savedCurrency);
        setExchangeRate(savedExchangeRate);

        // ✅ FIXED: Proper boolean check for print cost enabled
        const savedPrintEnabled = c.print_cost_enabled === true || c.print_cost_enabled === 1 || c.print_cost_enabled === "true";
        const savedPrintPrice = Number(c.print_price_per_meter || 0);
        setPrintCostEnabled(savedPrintEnabled);
        setPrintPricePerMeter(savedPrintPrice);
        
        // ✅ Load installation enabled from contract (default true if not set)
        const savedInstallationEnabled = c.installation_enabled !== false && c.installation_enabled !== 0 && c.installation_enabled !== "false";
        setInstallationEnabled(savedInstallationEnabled);

        // ✅ NEW: Load "include in price" toggles (persisted in DB)
        const savedIncludeInstallation = c.include_installation_in_price === true || c.include_installation_in_price === 1 || c.include_installation_in_price === 'true' || c.include_installation_in_price === '1';
        const savedIncludePrint = c.include_print_in_billboard_price === true || c.include_print_in_billboard_price === 1 || c.include_print_in_billboard_price === 'true' || c.include_print_in_billboard_price === '1';
        setIncludeInstallationInPrice(savedIncludeInstallation);
        setIncludePrintInPrice(savedIncludePrint);

        // ✅ NEW: Load operating fee inclusion in costs
        const savedIncludeOperatingInPrint = c.include_operating_in_print === true;
        const savedIncludeOperatingInInstallation = c.include_operating_in_installation === true;
        setIncludeOperatingInPrint(savedIncludeOperatingInPrint);
        setIncludeOperatingInInstallation(savedIncludeOperatingInInstallation);

        // ✅ NEW: Load level discounts
        const savedLevelDiscounts = c.level_discounts;
        if (savedLevelDiscounts && typeof savedLevelDiscounts === 'object') {
          setLevelDiscounts(savedLevelDiscounts as Record<string, number>);
        }

        // ✅ NEW: Load friend rental includes installation
        const savedFriendRentalIncludesInstallation = c.friend_rental_includes_installation === true;
        setFriendRentalIncludesInstallation(savedFriendRentalIncludesInstallation);
        
        console.log('✅ Loading cost inclusion settings:');
        console.log('- Print cost enabled:', savedPrintEnabled);
        console.log('- Print price per meter:', savedPrintPrice);
        console.log('- Installation enabled:', savedInstallationEnabled);
        console.log('- Include installation in price:', savedIncludeInstallation);
        console.log('- Include print in price:', savedIncludePrint);
        console.log('- Include operating in print:', savedIncludeOperatingInPrint);
        console.log('- Include operating in installation:', savedIncludeOperatingInInstallation);

        // ✅ NEW: Load operating fee rate from contract
        const savedOperatingFeeRate = Number(c.operating_fee_rate || 3);
        setOperatingFeeRate(savedOperatingFeeRate);
        console.log('✅ Loading operating fee rate:', savedOperatingFeeRate, '%');
        
        // ✅ NEW: Load partnership operating fee rate from contract
        const savedPartnershipOperatingFeeRate = Number(c.partnership_operating_fee_rate || 3);
        setPartnershipOperatingFeeRate(savedPartnershipOperatingFeeRate);
        console.log('✅ Loading partnership operating fee rate:', savedPartnershipOperatingFeeRate, '%');
        
        // ✅ NEW: Load design data from contract
        const savedDesigns = c.design_data;
        if (savedDesigns) {
          try {
            const parsed = typeof savedDesigns === 'string' ? JSON.parse(savedDesigns) : savedDesigns;
            setBillboardDesigns(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Failed to parse design data:', e);
            setBillboardDesigns([]);
          }
        }
        
        const s = c.start_date || c['Contract Date'] || '';
        const e = c.end_date || c['End Date'] || '';
        setStartDate(s);
        setEndDate(e);
        
        if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffTime = Math.abs(ed.getTime() - sd.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.round(diffDays / 30);
            
            if (diffMonths >= 1) {
              setPricingMode('months');
              setDurationMonths(diffMonths);
            } else {
              setPricingMode('days');
              setDurationDays(diffDays);
            }
          }
        }
        
        const savedTotal = typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] || 0);
        setRentCost(savedTotal);
        setOriginalTotal(savedTotal || 0);
        const disc = Number(c.Discount ?? 0);
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }

        // ✅ NEW: Load existing operating fee from contract
        const existingFee = Number(c.fee || 0);
        if (existingFee > 0) {
          setOperatingFee(existingFee);
        }

        // ✅ FIXED: Load selected billboards from billboard_ids column
        if (c.billboard_ids) {
          try {
            // Parse billboard_ids if it's a string
            const idsArray = typeof c.billboard_ids === 'string' 
              ? c.billboard_ids.split(',').map(id => id.trim()).filter(Boolean)
              : Array.isArray(c.billboard_ids) ? c.billboard_ids : [];
            setSelected(idsArray);
            console.log('Loaded selected billboards from billboard_ids:', idsArray);
          } catch (e) {
            console.warn('Failed to parse billboard_ids:', e);
            // Fallback to old method
            setSelected((c.billboards || []).map((b: any) => String(b.ID)));
          }
        } else {
          // Fallback to old method
          setSelected((c.billboards || []).map((b: any) => String(b.ID)));
        }
        
        // ✅ FIXED: Properly handle installments_data from database
        let loadedInstallments: any[] = [];

        if (c.installments_data) {
          console.log('installments_data exists:', typeof c.installments_data, c.installments_data);

          // Handle JSON string format (from database)
          if (typeof c.installments_data === 'string') {
            try {
              const parsed = JSON.parse(c.installments_data);
              if (Array.isArray(parsed)) {
                loadedInstallments = parsed;
                console.log('Successfully parsed installments from string:', loadedInstallments);
              }
            } catch (e) {
              console.warn('Failed to parse installments_data string:', e);
            }
          }
          // Handle array format (already parsed)
          else if (Array.isArray(c.installments_data)) {
            loadedInstallments = c.installments_data;
            console.log('Using installments array directly:', loadedInstallments);
          }
        }

        const normalizeInstallment = (inst: any, idx: number) => {
          const amount = Number(inst?.amount ?? 0) || 0;
          const paymentType = String(inst?.paymentType ?? inst?.type ?? inst?.payment_type ?? '').trim() || (idx === 0 ? 'عند التوقيع' : 'شهري');
          const description = String(inst?.description ?? inst?.desc ?? '').trim() || `الدفعة ${idx + 1}`;
          const dueDate = String(inst?.dueDate ?? inst?.due_date ?? '').trim() || calculateDueDate(paymentType, idx, s);
          return { amount, paymentType, description, dueDate };
        };

        // If we have valid installments data, use it
        if (loadedInstallments.length > 0) {
          const normalized = loadedInstallments.map(normalizeInstallment);
          setInstallments(normalized);
          console.log('Set installments from installments_data (normalized):', normalized);
        } else {
          // Fallback to old Payment 1, 2, 3 format
          console.log('No installments_data found, using old Payment format');
          const payments = [];
          if (c['Payment 1'])
            payments.push({
              amount: typeof c['Payment 1'] === 'object' ? Number((c['Payment 1'] as any).amount || 0) : Number(c['Payment 1'] || 0),
              paymentType:
                typeof c['Payment 1'] === 'object'
                  ? String((c['Payment 1'] as any).type || (c['Payment 1'] as any).paymentType || 'شهري')
                  : 'شهري',
              description: 'الدفعة الأولى',
              dueDate: calculateDueDate('شهري', 0, s)
            });
          if (c['Payment 2'])
            payments.push({
              amount: Number(c['Payment 2'] || 0),
              paymentType: 'شهري',
              description: 'الدفعة الثانية',
              dueDate: calculateDueDate('شهري', 1, s)
            });
          if (c['Payment 3'])
            payments.push({
              amount: Number(c['Payment 3'] || 0),
              paymentType: 'شهري',
              description: 'الدفعة الثالثة',
              dueDate: calculateDueDate('شهري', 2, s)
            });
          setInstallments(payments);
          console.log('Set installments from old Payment format:', payments);
        }

        // ✅ NEW: Load installment distribution settings from DB
        const savedDistributionType = c.installment_distribution_type || 'multiple';
        const savedFirstPaymentAmount = Number(c.installment_first_payment_amount || 0);
        const savedFirstPaymentType = c.installment_first_payment_type || 'amount';
        const savedInterval = c.installment_interval || 'month';
        const savedCount = Number(c.installment_count || 2);
        const savedAutoCalculate = c.installment_auto_calculate === true;
        const savedFirstAtSigning = c.installment_first_at_signing !== false; // default true
        
        setInstallmentDistributionType(savedDistributionType as 'single' | 'multiple');
        setInstallmentFirstPaymentAmount(savedFirstPaymentAmount);
        setInstallmentFirstPaymentType(savedFirstPaymentType as 'amount' | 'percent');
        setInstallmentInterval(savedInterval as 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months');
        setInstallmentCount(savedCount);
        setInstallmentAutoCalculate(savedAutoCalculate);
        setInstallmentFirstAtSigning(savedFirstAtSigning);
        setHasDifferentFirstPayment(savedFirstPaymentAmount > 0);
        
        console.log('✅ Loaded installment distribution settings:', {
          distributionType: savedDistributionType,
          firstPaymentAmount: savedFirstPaymentAmount,
          firstPaymentType: savedFirstPaymentType,
          interval: savedInterval,
          count: savedCount,
          autoCalculate: savedAutoCalculate
        });

        // ✅ Load friend billboard rentals for this contract
        const { data: friendRentals } = await supabase
          .from('friend_billboard_rentals')
          .select(`
            billboard_id,
            friend_company_id,
            friend_rental_cost,
            friend_companies!inner(name)
          `)
          .eq('contract_number', Number(contractNumber));

        if (friendRentals && friendRentals.length > 0) {
          const friendCosts = friendRentals.map((rental: any) => ({
            billboardId: String(rental.billboard_id),
            friendCompanyId: rental.friend_company_id,
            friendCompanyName: rental.friend_companies?.name || 'غير محدد',
            friendRentalCost: rental.friend_rental_cost || 0
          }));
          setFriendBillboardCosts(friendCosts);
          console.log('✅ Loaded friend billboard costs:', friendCosts);
        }

        // ✅ NEW: Load friend rental operating fee settings
        const friendFeeEnabled = c.friend_rental_operating_fee_enabled === true;
        const friendFeeRate = Number(c.friend_rental_operating_fee_rate || 3);
        setFriendRentalOperatingFeeEnabled(friendFeeEnabled);
        setFriendRentalOperatingFeeRate(friendFeeRate);
        console.log('✅ Loaded friend rental operating fee settings:', { enabled: friendFeeEnabled, rate: friendFeeRate });
        
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  // Calculate installation_cost when selected billboards change
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
          console.log('✅ installation_cost calculated:', result.totalInstallationCost);
          console.log('✅ Installation details:', result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation_cost:', e);
          setInstallationCost(0);
          setInstallationDetails([]);
        }
      })();
    } else {
      setInstallationCost(0);
      setInstallationDetails([]);
    }
  }, [selected]);

  // Auto-calculate end date
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    const end = new Date(d);
    if (pricingMode === 'months') {
      if (use30DayMonth) {
        // حساب الشهر = 30 يوم ثابت
        const days = Math.max(0, Number(durationMonths || 0)) * 30;
        end.setDate(end.getDate() + days);
      } else {
        // حساب الأيام الفعلية للشهر
        end.setMonth(end.getMonth() + durationMonths);
      }
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths, durationDays, pricingMode, use30DayMonth]);


  // ✅ FIXED: Normalize size format (e.g., "5x13" -> "13x5", always larger dimension first)
  const normalizeSizeFormat = (size: string): string => {
    const match = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (!match) return size;
    
    const width = parseFloat(match[1]);
    const height = parseFloat(match[2]);
    
    // Always return larger dimension first
    if (width >= height) {
      return `${width}x${height}`;
    } else {
      return `${height}x${width}`;
    }
  };

  // ✅ FIXED: Enhanced price lookup with fallback to size name matching
  const getPriceFromDatabase = (sizeId: number | null, level: any, customer: string, months: number, sizeName?: string): number | null => {
    console.log(`\n🔍 ===== PRICE LOOKUP START =====`);
    console.log(`🔍 Looking for price: size_id=${sizeId} (type: ${typeof sizeId}), sizeName="${sizeName}", level="${level}", customer="${customer}", months=${months}`);
    
    let dbRow = null;
    
    // Try by size_id first if available
    if (sizeId !== null && sizeId !== undefined) {
      console.log(`🔎 Step 1: Searching by size_id=${sizeId} (type: ${typeof sizeId})...`);
      console.log(`📊 First 3 pricing rows for comparison:`, 
        pricingData.slice(0, 3).map(p => ({ 
          size: p.size, 
          size_id: p.size_id, 
          size_id_type: typeof p.size_id,
          level: p.billboard_level, 
          category: p.customer_category 
        }))
      );
      
      dbRow = pricingData.find(p => {
        // ✅ CRITICAL: Ensure both sides are numbers before comparison
        const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
        const match = pSizeId === sizeId && 
                     p.billboard_level === level && 
                     p.customer_category === customer;
        if (pSizeId === sizeId || p.size_id === sizeId) {
          console.log(`🔍 Comparing: p.size_id=${p.size_id} (${typeof p.size_id}) -> pSizeId=${pSizeId} === sizeId=${sizeId} (${typeof sizeId}), level match: ${p.billboard_level === level}, customer match: ${p.customer_category === customer}, FINAL MATCH: ${match}`);
        }
        return match;
      });
      
      if (dbRow) {
        console.log('✅ Found matching row by size_id:', {
          size: dbRow.size,
          size_id: dbRow.size_id,
          level: dbRow.billboard_level,
          category: dbRow.customer_category
        });
      } else {
        console.warn(`❌ No match by size_id. Checking available pricing data for size_id=${sizeId}:`);
        const sameSizeId = pricingData.filter(p => {
          const pSizeId = Number(p.size_id);
          return pSizeId === sizeId;
        });
        console.log(`  Found ${sameSizeId.length} rows with size_id=${sizeId}:`, 
          sameSizeId.map(p => ({ size: p.size, size_id: p.size_id, level: p.billboard_level, category: p.customer_category }))
        );
        
        // Show what levels and customers exist for this size_id
        if (sameSizeId.length > 0) {
          console.log(`  Available levels for size_id=${sizeId}:`, [...new Set(sameSizeId.map(p => p.billboard_level))]);
          console.log(`  Available customers for size_id=${sizeId}:`, [...new Set(sameSizeId.map(p => p.customer_category))]);
          console.log(`  🚨 MISMATCH DETAILS: Looking for level="${level}" and customer="${customer}"`);
        }
      }
    } else {
      console.warn('⚠️ No size_id provided, will try size name matching');
    }
    
    // ✅ FALLBACK: If no size_id or not found, try by size name with normalization
    if (!dbRow && sizeName) {
      console.log(`\n🔎 Step 2: Fallback to size name matching...`);
      const normalizedInputSize = normalizeSizeFormat(sizeName);
      console.log(`  Input size: "${sizeName}" -> Normalized: "${normalizedInputSize}"`);
      
      // Show all available sizes for this level and customer
      const matchingLevelCustomer = pricingData.filter(p => 
        p.billboard_level === level && p.customer_category === customer
      );
      console.log(`  Available sizes for level="${level}" & customer="${customer}":`, 
        matchingLevelCustomer.map(p => ({ size: p.size, size_id: p.size_id, normalized: normalizeSizeFormat(String(p.size || '')) }))
      );
      
      dbRow = pricingData.find(p => {
        const dbSize = normalizeSizeFormat(String(p.size || ''));
        const matches = dbSize === normalizedInputSize && 
                       p.billboard_level === level && 
                       p.customer_category === customer;
        
        if (matches) {
          console.log(`  ✅ MATCH: db size "${p.size}" (normalized: "${dbSize}") = input "${sizeName}" (normalized: "${normalizedInputSize}")`);
        }
        
        return matches;
      });
      
      if (dbRow) {
        console.log('✅ Found matching row by size name:', {
          size: dbRow.size,
          size_id: dbRow.size_id,
          level: dbRow.billboard_level,
          category: dbRow.customer_category
        });
      } else {
        console.error(`❌ NO MATCH FOUND for size name "${sizeName}" (normalized: "${normalizedInputSize}")`);
      }
    }
    
    if (dbRow) {
      const monthColumnMap: { [key: number]: string } = {
        1: 'one_month',
        2: '2_months', 
        3: '3_months',
        6: '6_months',
        12: 'full_year'
      };
      
      const column = monthColumnMap[months];
      if (column && dbRow[column] !== null && dbRow[column] !== undefined) {
        const price = Number(dbRow[column]) || 0;
        console.log(`✅ SUCCESS: Found price ${price} in column "${column}"`);
        console.log(`===== PRICE LOOKUP END =====\n`);
        return price;
      } else {
        console.error(`❌ Column "${column}" is null/undefined in matched row:`, dbRow);
      }
    }
    
    console.error(`\n❌ FINAL RESULT: No price found!`);
    console.error(`   Parameters: size_id=${sizeId}, sizeName="${sizeName}", level="${level}", customer="${customer}", months=${months}`);
    console.log(`===== PRICE LOOKUP END =====\n`);
    return null;
  };

  const getDailyPriceFromDatabase = (sizeId: number | null, level: any, customer: string, sizeName?: string): number | null => {
    console.log(`🔍 Looking for daily price: size_id=${sizeId}, sizeName=${sizeName}, level=${level}, customer=${customer}`);
    
    let dbRow = null;
    
    // Try by size_id first if available
    if (sizeId) {
      dbRow = pricingData.find(p => 
        p.size_id === sizeId && 
        p.billboard_level === level && 
        p.customer_category === customer
      );
      
      if (dbRow) {
        console.log('✅ Found matching row by size_id for daily price');
      }
    }
    
    // ✅ FALLBACK: If no size_id or not found, try by size name with normalization
    if (!dbRow && sizeName) {
      console.log('🔄 Trying fallback: matching by size name for daily price');
      const normalizedInputSize = normalizeSizeFormat(sizeName);
      
      dbRow = pricingData.find(p => {
        const dbSize = normalizeSizeFormat(String(p.size || ''));
        return dbSize === normalizedInputSize && 
               p.billboard_level === level && 
               p.customer_category === customer;
      });
      
      if (dbRow) {
        console.log('✅ Found matching row by size name for daily price');
      }
    }
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      const dailyPrice = Number(dbRow.one_day) || 0;
      console.log('✅ Found daily price:', dailyPrice);
      return dailyPrice;
    }
    
    console.warn(`❌ No daily price found for size_id=${sizeId}, sizeName=${sizeName}`);
    return null;
  };

  // ✅ NEW: Get stored price from contract's billboard_prices data
  const getStoredPriceFromContract = (billboardId: string): number | null => {
    if (!currentContract?.billboard_prices) return null;
    
    try {
      const billboardPrices = typeof currentContract.billboard_prices === 'string' 
        ? JSON.parse(currentContract.billboard_prices)
        : currentContract.billboard_prices;
      
      const storedPrice = billboardPrices.find((bp: any) => bp.billboardId === billboardId);
      return storedPrice ? Number(storedPrice.contractPrice || 0) : null;
    } catch (e) {
      console.warn('Failed to parse stored billboard prices:', e);
      return null;
    }
  };

  // ✅ UPDATED: Calculate print cost only if enabled and consider faces count
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
    
    // Parse billboard area from size (e.g., "4x3" -> 12 square meters)
    const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (!sizeMatch) return 0;
    
    const width = parseFloat(sizeMatch[1]);
    const height = parseFloat(sizeMatch[2]);
    const area = width * height;
    
    return area * faces * printPricePerMeter;
  };

  // ✅ NEW: Calculate price using factors system
  const calculateFactorsPrice = (billboard: Billboard): number => {
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const level = ((billboard as any).level || (billboard as any).Level || 'A') as string;
    const municipality = ((billboard as any).municipality || (billboard as any).Municipality || '') as string;

    // Find base price for this size and level
    const basePrice = basePrices.find(bp => 
      bp.size_name === size && bp.billboard_level === level
    );

    if (!basePrice) {
      console.warn(`⚠️ No base price found for size=${size}, level=${level}`);
      return 0;
    }

    // Get the price based on duration
    let priceValue = 0;
    if (pricingMode === 'months') {
      const months = Math.max(1, Number(durationMonths || 1));
      if (months === 1) priceValue = basePrice.one_month || 0;
      else if (months === 2) priceValue = basePrice.two_months || 0;
      else if (months === 3) priceValue = basePrice.three_months || 0;
      else if (months >= 6 && months < 12) priceValue = basePrice.six_months || 0;
      else if (months >= 12) priceValue = basePrice.full_year || 0;
      else priceValue = (basePrice.one_month || 0) * months;
    } else {
      const days = Math.max(1, Number(durationDays || 1));
      priceValue = (basePrice.one_day || 0) * days;
    }

    // Find municipality factor
    const muniFactor = municipalityFactors.find(mf => mf.municipality_name === municipality);
    const municipalityMultiplier = muniFactor?.factor || 1;

    // Find category factor
    const catFactor = categoryFactors.find(cf => cf.category_name === pricingCategory);
    const categoryMultiplier = catFactor?.factor || 1;

    // Final price = base price × municipality factor × category factor
    const finalPrice = priceValue * municipalityMultiplier * categoryMultiplier;
    
    console.log(`🔢 Factors pricing for billboard:`, {
      size, level, municipality,
      basePrice: priceValue,
      municipalityFactor: municipalityMultiplier,
      categoryFactor: categoryMultiplier,
      finalPrice
    });

    return finalPrice;
  };

  // ✅ FIXED: Calculate billboard price - returns BASE RENTAL PRICE ONLY (no print/installation costs)
  // Print and installation costs are handled separately based on "include in price" flags
  // Using useCallback to ensure re-renders when dependencies change
  const calculateBillboardPrice = React.useCallback((billboard: Billboard): number => {
    const billboardId = String((billboard as any).ID);
    
    // ✅ NEW: Check for proportional distribution overrides first
    if (billboardPriceOverrides[billboardId] !== undefined) {
      console.log(`📊 Using proportional override for billboard ${billboardId}:`, billboardPriceOverrides[billboardId]);
      return billboardPriceOverrides[billboardId];
    }
    
    let basePrice = 0;
    
    // ✅ ONLY use stored prices if user explicitly chose to
    if (useStoredPrices) {
      const storedPrice = getStoredPriceFromContract(billboardId);
      if (storedPrice !== null) {
        console.log(`📦 Using stored price from contract for billboard ${billboardId}:`, storedPrice);
        basePrice = storedPrice;
        return applyExchangeRate(basePrice);
      }
    }

    // ✅ NEW: Use factors pricing if enabled
    if (useFactorsPricing) {
      basePrice = calculateFactorsPrice(billboard);
      console.log(`🔢 Using factors pricing for billboard ${billboardId}:`, basePrice);
      // ✅ FIXED: Don't add print cost here - it's handled separately
      return applyExchangeRate(basePrice);
    }
    
    // ✅ Calculate fresh price based on CURRENT billboard data (original pricing table)
    console.log(`🔄 Calculating fresh price based on current billboard data for ${billboardId}`);
    
    // ✅ Get both size_id and size name for fallback - ENSURE IT'S A NUMBER!
    const rawSizeId = (billboard as any).size_id || (billboard as any).Size_ID || null;
    const sizeId = rawSizeId !== null ? Number(rawSizeId) : null;
    const level = ((billboard as any).level || (billboard as any).Level) as any;
    const size = (billboard.size || (billboard as any).Size || '') as string;
    
    console.log(`🔍 Billboard details:`, {
      billboardId,
      rawSizeId,
      sizeId,
      sizeIdType: typeof sizeId,
      size,
      level,
      category: pricingCategory,
      mode: pricingMode,
      duration: pricingMode === 'months' ? durationMonths : durationDays,
      fullBillboard: billboard
    });
    
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      // ✅ Get price from database (with size name fallback)
      let price = getPriceFromDatabase(sizeId, level, pricingCategory, months, size);
      if (price === null) {
        console.log('⚠️ No price from database, using fallback pricing system');
        price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      }
      basePrice = price !== null ? price : 0;
      console.log(`✅ Monthly price (${months} months):`, basePrice);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      // ✅ Get daily price from database (with size name fallback)
      let daily = getDailyPriceFromDatabase(sizeId, level, pricingCategory, size);
      if (daily === null) {
        console.log('⚠️ No daily price from database, using fallback pricing system');
        daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = getPriceFromDatabase(sizeId, level, pricingCategory, 1, size);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      basePrice = (daily || 0) * days;
      console.log(`✅ Daily price (${days} days):`, basePrice);
    }

    // ✅ FIXED: Return BASE price only - print/installation costs handled separately
    const convertedPrice = applyExchangeRate(basePrice);
    
    console.log(`✅ Base rental price for billboard ${billboardId}: ${basePrice} LYD -> ${convertedPrice} ${contractCurrency}`);
    return convertedPrice;
  }, [useStoredPrices, useFactorsPricing, pricingMode, durationMonths, durationDays, pricingCategory, pricingData, contractCurrency, exchangeRate, basePrices, municipalityFactors, categoryFactors, currentContract, billboardPriceOverrides]);

  // ✅ NEW: Refresh prices from current pricing system
  const refreshPricesFromSystem = async () => {
    try {
      setRefreshingPrices(true);
      
      // Switch to using fresh prices
      setUseStoredPrices(false);
      
      // Force recalculation by updating a dependency
      setUserEditedRentCost(false);
      
      toast.success('تم تحديث الأسعار من المنظومة الحالية');
      console.log('✅ Switched to fresh pricing system');
      
    } catch (e: any) {
      console.error('Failed to refresh prices:', e);
      toast.error('فشل تحديث الأسعار');
    } finally {
      setRefreshingPrices(false);
    }
  };


  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    
    const date = new Date(baseDate);
    
    if (paymentType === 'عند التوقيع') {
      return baseDate;
    } else if (paymentType === 'شهري') {
      date.setMonth(date.getMonth() + (index + 1));
    } else if (paymentType === 'شهرين') {
      date.setMonth(date.getMonth() + (index + 1) * 2);
    } else if (paymentType === 'ثلاثة أشهر') {
      date.setMonth(date.getMonth() + (index + 1) * 3);
    } else if (paymentType === 'عند التركيب') {
      date.setDate(date.getDate() + 7);
    } else if (paymentType === 'نهاية العقد') {
      return endDate || '';
    }
    
    return date.toISOString().split('T')[0];
  };

  // ✅ FIXED: Calculate installation_cost summary - show always when billboards are selected
  const installationCostSummary = useMemo(() => {
    // ✅ CHANGED: Show when there are selected billboards, regardless of cost
    if (selected.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + (detail.installationPrice || 0), 0);
    
    // Group by size and show unique prices without repetition
    const groupedDetails = installationDetails.reduce((groups: any, detail) => {
      const key = `${detail.size}`;
      if (!groups[key]) {
        groups[key] = {
          size: detail.size,
          pricePerUnit: detail.installationPrice || 0,
          count: 0,
          totalForSize: 0,
          hasPrice: detail.installationPrice !== null && detail.installationPrice > 0
        };
      }
      groups[key].count += 1;
      groups[key].totalForSize += (detail.installationPrice || 0);
      return groups;
    }, {});
    
    return {
      totalInstallationCost,
      groupedSizes: Object.values(groupedDetails),
      hasAnyInstallationCost: totalInstallationCost > 0
    };
  }, [selected.length, installationDetails]);

  // ✅ NEW: Calculate print cost summary with grouped sizes and faces
  const printCostSummary = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0 || selected.length === 0) return null;

    const selectedBillboards = billboards.filter(b => selected.includes(String((b as any).ID)));
    
    // Group by size and faces to avoid repetition
    const groupedDetails = selectedBillboards.reduce((groups: any, billboard) => {
      const size = (billboard.size || (billboard as any).Size || '') as string;
      const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
      const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      
      if (!sizeMatch) return groups;
      
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const area = width * height;
      
      const key = `${size}_${faces}faces`;
      
      if (!groups[key]) {
        groups[key] = {
          size,
          faces,
          area,
          count: 0,
          totalArea: 0,
          costPerUnit: area * faces * printPricePerMeter,
          totalCost: 0
        };
      }
      
      groups[key].count += 1;
      groups[key].totalArea += area * faces;
      groups[key].totalCost += area * faces * printPricePerMeter;
      
      return groups;
    }, {});

    const totalPrintCost = Object.values(groupedDetails).reduce((sum: number, group: any) => sum + group.totalCost, 0);
    
    return {
      totalPrintCost,
      groupedDetails: Object.values(groupedDetails)
    };
  }, [billboards, selected, printCostEnabled, printPricePerMeter]);

  // Convenience alias (used across calculations + saving)
  const printCostTotal = useMemo(() => Number(printCostSummary?.totalPrintCost || 0), [printCostSummary]);

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).size || (b as any).Size))).filter(Boolean) as string[], [billboards]);
  const municipalities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean) as string[], [billboards]);

  // ✅ FIXED: estimatedTotal is BASE RENTAL ONLY - print/installation costs handled separately in finalTotal
  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        const billboardPrice = calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        const billboardPrice = calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricingData, useStoredPrices, contractCurrency, exchangeRate, useFactorsPricing, basePrices, municipalityFactors, categoryFactors]);

  const baseTotal = useMemo(() => (rentCost && rentCost > 0 ? rentCost : estimatedTotal), [rentCost, estimatedTotal]);

  useEffect(() => {
    if (!userEditedRentCost) {
      setRentCost(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost]);

  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent'
      ? (baseTotal * Math.max(0, Math.min(100, discountValue)) / 100)
      : Math.max(0, discountValue);
  }, [discountType, discountValue, baseTotal]);

  // ✅ CORRECTED: Totals must respect "include installation/print in price" flags
  // - finalTotal: what the CUSTOMER pays
  // - rentalCostOnly: net rental for the COMPANY (base after discount minus included service costs)
  const rentalAfterDiscount = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);

  const includedInstallationCost = useMemo(() => {
    if (!installationEnabled) return 0;
    return includeInstallationInPrice ? applyExchangeRate(installationCost) : 0;
  }, [installationEnabled, includeInstallationInPrice, installationCost, exchangeRate]);

  const includedPrintCost = useMemo(() => {
    if (!printCostEnabled) return 0;
    return includePrintInPrice ? applyExchangeRate(printCostTotal) : 0;
  }, [printCostEnabled, includePrintInPrice, printCostTotal, exchangeRate]);

  const netRentalForCompany = useMemo(() => {
    // Net rental = rental after discount - included service costs - friend rentals
    return Math.max(0, rentalAfterDiscount - includedInstallationCost - includedPrintCost - totalFriendCosts);
  }, [rentalAfterDiscount, includedInstallationCost, includedPrintCost, totalFriendCosts]);

  const extraInstallationChargedToCustomer = useMemo(() => {
    if (!installationEnabled) return 0;
    return includeInstallationInPrice ? 0 : applyExchangeRate(installationCost);
  }, [installationEnabled, includeInstallationInPrice, installationCost, exchangeRate]);

  const extraPrintChargedToCustomer = useMemo(() => {
    if (!printCostEnabled) return 0;
    return includePrintInPrice ? 0 : applyExchangeRate(printCostTotal);
  }, [printCostEnabled, includePrintInPrice, printCostTotal, exchangeRate]);

  const finalTotal = useMemo(() => {
    // Customer total = rental after discount + service costs not included
    return Math.max(0, rentalAfterDiscount + extraInstallationChargedToCustomer + extraPrintChargedToCustomer);
  }, [rentalAfterDiscount, extraInstallationChargedToCustomer, extraPrintChargedToCustomer]);

  const rentalCostOnly = useMemo(() => netRentalForCompany, [netRentalForCompany]);

  // ✅ NEW: Handle proportional distribution of new total across billboards
  const handleProportionalDistribution = React.useCallback((newTotal: number) => {
    if (estimatedTotal <= 0 || newTotal <= 0) {
      toast.error('لا يمكن التوزيع - الإجمالي الحالي أو الجديد غير صالح');
      return;
    }
    
    const ratio = newTotal / estimatedTotal;
    const selectedBillboardsData = billboards.filter(b => selected.includes(String((b as any).ID)));
    
    const newOverrides: Record<string, number> = {};
    
    selectedBillboardsData.forEach(billboard => {
      const billboardId = String((billboard as any).ID);
      const currentPrice = calculateBillboardPrice(billboard);
      const newPrice = Math.round(currentPrice * ratio);
      newOverrides[billboardId] = newPrice;
    });
    
    setBillboardPriceOverrides(newOverrides);
    
    // Update the rent cost to reflect the new total
    setRentCost(newTotal);
    setUserEditedRentCost(true);
    
    const changePercent = ((ratio - 1) * 100).toFixed(1);
    toast.success(`تم توزيع ${newTotal.toLocaleString('ar-LY')} بنسبة ${changePercent}% على ${selectedBillboardsData.length} لوحة`);
    
    console.log('✅ Proportional distribution applied:', {
      oldTotal: estimatedTotal,
      newTotal,
      ratio,
      billboardCount: selectedBillboardsData.length,
      overrides: newOverrides
    });
  }, [estimatedTotal, billboards, selected, calculateBillboardPrice]);

  // ✅ NEW: Calculate rental cost for regular (non-partnership) billboards only
  const regularBillboardsRentalCost = useMemo(() => {
    const regularBillboards = billboards.filter(b => 
      selected.includes(String((b as any).ID)) && !(b as any).is_partnership
    );
    
    if (regularBillboards.length === 0) return 0;
    
    const regularTotal = regularBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    const regularPercentage = estimatedTotal > 0 ? regularTotal / estimatedTotal : 0;
    const regularDiscount = discountAmount * regularPercentage;
    
    return Math.max(0, regularTotal - regularDiscount);
  }, [billboards, selected, estimatedTotal, discountAmount]);

  // ✅ NEW: Calculate rental cost for partnership billboards only
  const partnershipBillboardsRentalCost = useMemo(() => {
    const partnershipBillboards = billboards.filter(b => 
      selected.includes(String((b as any).ID)) && (b as any).is_partnership
    );
    
    if (partnershipBillboards.length === 0) return 0;
    
    const partnershipTotal = partnershipBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    const partnershipPercentage = estimatedTotal > 0 ? partnershipTotal / estimatedTotal : 0;
    const partnershipDiscount = discountAmount * partnershipPercentage;
    
    return Math.max(0, partnershipTotal - partnershipDiscount);
  }, [billboards, selected, estimatedTotal, discountAmount]);

  // ✅ CORRECTED: Calculate operating fee from NET RENTAL (صافي الإيجار للشركة)
  useEffect(() => {
    const fee = Math.round(netRentalForCompany * (operatingFeeRate / 100) * 100) / 100;
    setOperatingFee(fee);
    console.log(`✅ Operating fee calculated (from net rental): ${netRentalForCompany} × ${operatingFeeRate}% = ${fee}`);
  }, [netRentalForCompany, operatingFeeRate]);
  
  // ✅ NEW: Calculate partnership operating fee
  const partnershipOperatingFee = useMemo(() => {
    return Math.round(partnershipBillboardsRentalCost * (partnershipOperatingFeeRate / 100) * 100) / 100;
  }, [partnershipBillboardsRentalCost, partnershipOperatingFeeRate]);

  useEffect(() => {
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { 
          amount: half, 
          paymentType: 'عند التوقيع', 
          description: 'الدفعة الأولى',
          dueDate: calculateDueDate('عند التوقيع', 0)
        },
        { 
          amount: finalTotal - half, 
          paymentType: 'شهري', 
          description: 'الدفعة الثانية',
          dueDate: calculateDueDate('شهري', 1)
        },
      ]);
    }
  }, [finalTotal]);

  // ✅ REBUILT: Helper function to check if contract is expired (same as Billboards page)
  const isContractExpired = (endDate: any): boolean => {
    if (!endDate) return false;
    try {
      const end = new Date(endDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return end < now;
    } catch {
      return false;
    }
  };

  // ✅ REBUILT: Get contract number from billboard (same as Billboards page)
  const getCurrentContractNumber = (billboard: any): string => {
    const contractNum = billboard.Contract_Number || 
                       billboard.contractNumber || 
                       billboard.contract_number ||
                       billboard.contract_id ||
                       (billboard.contracts && billboard.contracts[0]?.Contract_Number) ||
                       (billboard.contracts && billboard.contracts[0]?.contract_number) ||
                       (billboard.contracts && billboard.contracts[0]?.id) ||
                       '';
    return String(contractNum).trim();
  };

  // ✅ REBUILT: Enhanced search function (same as Billboards page)
  const enhancedSearchBillboards = (billboards: any[], query: string) => {
    if (!query.trim()) return billboards;
    
    const searchTerm = query.toLowerCase().trim();
    
    return billboards.filter((billboard) => {
      const billboardName = String(
        billboard.Billboard_Name || 
        billboard.billboardName || 
        billboard.billboard_name ||
        billboard.name ||
        ''
      ).toLowerCase();
      
      const nearestLandmark = String(
        billboard['Nearest Landmark'] ||
        billboard.nearestLandmark ||
        billboard.nearest_landmark ||
        billboard.Nearest_Landmark ||
        billboard['أقرب نقطة دالة'] ||
        billboard.landmark ||
        billboard.Location ||
        billboard.location ||
        billboard.Address ||
        billboard.address ||
        ''
      ).toLowerCase();
      
      const municipality = String(
        billboard.Municipality || 
        billboard.municipality || 
        billboard.Municipality_Name ||
        billboard.municipality_name ||
        ''
      ).toLowerCase();
      
      const city = String(
        billboard.City || 
        billboard.city || 
        billboard.City_Name ||
        billboard.city_name ||
        ''
      ).toLowerCase();
      
      const contractNumber = String(getCurrentContractNumber(billboard)).toLowerCase();
      
      const adType = String(
        billboard.Ad_Type || 
        billboard.adType || 
        billboard.ad_type || 
        billboard.AdType || 
        (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || 
        ''
      ).toLowerCase();
      
      const customerName = String(
        billboard.Customer_Name || 
        billboard.clientName || 
        billboard.customer_name ||
        (billboard.contracts && billboard.contracts[0]?.['Customer Name']) || 
        ''
      ).toLowerCase();
      
      const size = String(
        billboard.Size || 
        billboard.size || 
        ''
      ).toLowerCase();
      
      return billboardName.includes(searchTerm) ||
             nearestLandmark.includes(searchTerm) ||
             municipality.includes(searchTerm) ||
             city.includes(searchTerm) ||
             contractNumber.includes(searchTerm) ||
             adType.includes(searchTerm) ||
             customerName.includes(searchTerm) ||
             size.includes(searchTerm);
    });
  };

  // ✅ REBUILT: Enhanced filtering with proper availability logic (same as Billboards page)
  const filtered = useMemo(() => {
    console.log('🔄 Filtering billboards for contract edit...', {
      totalBillboards: billboards.length,
      searchQuery,
      statusFilter,
      cityFilter,
      sizeFilter,
      municipalityFilter
    });
    
    // First apply search
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    console.log('🔍 After search:', searched.length, 'billboards');
    
    const filtered = searched.filter((billboard) => {
      const statusValue = String((billboard.Status ?? billboard.status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
      
      // ✅ Exclude removed billboards (same as Billboards page)
      const isRemoved = statusValue === 'إزالة' || 
                       statusLower === 'ازالة' || 
                       maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
                       maintenanceStatus === 'لم يتم التركيب';
      
      if (isRemoved) {
        return false;
      }
      
      // Check contract status
      const contractNum = getCurrentContractNumber(billboard);
      const hasContract = !!(contractNum && contractNum !== '0');
      const endDate = billboard.Rent_End_Date ?? (billboard as any).rent_end_date ?? null;
      const contractExpired = isContractExpired(endDate);

      // ✅ Availability must respect contract dates (Status value can be misleading)
      const isAvailable = isBillboardAvailable(billboard);
      const isBooked = hasContract && !contractExpired;

      // Check if near expiry (within 30 days)
      const daysUntilExpiry = getDaysUntilExpiry(endDate);
      const isNearExpiry = typeof daysUntilExpiry === 'number' && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

      // Apply filters
      const municipality = String(billboard.Municipality || billboard.municipality || '');
      const city = String(billboard.City || billboard.city || '');
      const size = String(billboard.Size || billboard.size || '');

      const matchesMunicipality = municipalityFilter === 'all' || municipality === municipalityFilter;
      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;

      // Check if billboard is in current contract selection
      const isInContract = selected.includes(String((billboard as any).ID ?? (billboard as any).id));

      // Status filter logic
      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'available') {
        matchesStatus = isAvailable;
      } else if (statusFilter === 'nearExpiry') {
        matchesStatus = isNearExpiry;
      } else if (statusFilter === 'rented') {
        matchesStatus = isBooked && !isNearExpiry;
      }

      // Always keep selected billboards visible
      if (isInContract) matchesStatus = true;
      
      return matchesMunicipality && matchesCity && matchesSize && matchesStatus;
    });
    
    console.log('✅ After filtering:', filtered.length, 'billboards');
    
    // Sort: available first, then near expiry, then others
    return filtered.sort((a: any, b: any) => {
      const aContractNum = getCurrentContractNumber(a);
      const bContractNum = getCurrentContractNumber(b);
      const aHasContract = !!(aContractNum && aContractNum !== '0');
      const bHasContract = !!(bContractNum && bContractNum !== '0');
      const aExpired = isContractExpired(a.Rent_End_Date ?? a.rent_end_date);
      const bExpired = isContractExpired(b.Rent_End_Date ?? b.rent_end_date);
      
      const aAvailable = !aHasContract || aExpired;
      const bAvailable = !bHasContract || bExpired;
      
      // Check near expiry
      const aNearExpiry = (() => {
        const end = a.Rent_End_Date ?? a.rent_end_date;
        if (!end || aExpired) return false;
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          return diffDays > 0 && diffDays <= 30;
        } catch {
          return false;
        }
      })();
      
      const bNearExpiry = (() => {
        const end = b.Rent_End_Date ?? b.rent_end_date;
        if (!end || bExpired) return false;
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          return diffDays > 0 && diffDays <= 30;
        } catch {
          return false;
        }
      })();
      
      // Sort priority: available > near expiry > rented
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      if (aNearExpiry && !bNearExpiry) return -1;
      if (!aNearExpiry && bNearExpiry) return 1;
      
      return 0;
    });
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter, municipalityFilter, selected]);

  // Event handlers
  const toggleSelect = (b: Billboard) => {
    const id = String((b as any).ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ 
          name,
          is_customer: true,
          is_supplier: false
        })
        .select()
        .single();
      if (!error && newC) {
        setCustomerId(newC.id);
        setCustomerName(name);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
        toast.success('تم إضافة العميل بنجاح');
      } else {
        console.error('Error adding customer:', error);
        toast.error('فشل في إضافة العميل');
      }
    } catch (e) {
      console.warn(e);
      toast.error('حدث خطأ أثناء إضافة العميل');
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  // Installment management
  const distributeEvenly = (count: number) => {
    count = Math.max(1, Math.min(6, Math.floor(count)));
    const even = Math.floor((finalTotal / count) * 100) / 100;
    const list = Array.from({ length: count }).map((_, i) => ({
      amount: i === count - 1 ? Math.round((finalTotal - even * (count - 1)) * 100) / 100 : even,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    setInstallments(list);
  };

  const addInstallment = () => {
    const newInstallment = {
      amount: 0,
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    setInstallments([...installments, newInstallment]);
  };

  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, i);
        }
        return updated;
      }
      return inst;
    }));
  };

  const clearAllInstallments = () => {
    setInstallments([]);
  };

  // ✅ NEW: Create manual/uneven installments
  const createManualInstallments = (count: number) => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    // إنشاء دفعات فارغة ليقوم المستخدم بملئها يدوياً
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    
    setInstallments(newInstallments);
    toast.info(`تم إنشاء ${count} دفعات فارغة - يرجى إدخال المبالغ يدوياً`);
  };

  // ✅ UPDATED: Smart distribution with config object - Fixed for zero first payment
  const distributeWithInterval = React.useCallback((config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => {
    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;
    
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment > finalTotal) {
      toast.info('الدفعة الأولى أكبر من الإجمالي');
      return;
    }

    if (actualFirstPayment < 0) {
      toast.info('قيمة الدفعة الأولى لا يمكن أن تكون سالبة');
      return;
    }

    const monthsMap: Record<string, number> = { month: 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalMonths = monthsMap[interval] || 1;
    const intervalLabels: Record<string, string> = { month: 'شهري', '2months': 'شهرين', '3months': 'ثلاثة أشهر', '4months': '4 أشهر', '5months': '5 أشهر', '6months': '6 أشهر', '7months': '7 أشهر' };
    const intervalLabel = intervalLabels[interval] || 'شهري';
    
    const newInstallments: Array<{amount: number; paymentType: string; description: string; dueDate: string}> = [];
    const firstDate = firstPaymentDate || startDate || new Date().toISOString().split('T')[0];
    
    // ✅ FIX: إذا كانت الدفعة الأولى صفر، نبدأ مباشرة بالدفعات المتكررة
    const hasFirstPayment = actualFirstPayment > 0;
    
    if (hasFirstPayment) {
      newInstallments.push({
        amount: actualFirstPayment,
        paymentType: firstAtSigning ? 'عند التوقيع' : '',
        description: 'الدفعة الأولى',
        dueDate: firstDate
      });
    }

    const remaining = finalTotal - actualFirstPayment;

    if (remaining <= 0) {
      setInstallments(newInstallments);
      toast.success('تم إنشاء الدفعة الأولى فقط');
      return;
    }

    let numberOfRecurringPayments: number;
    if (numPayments && numPayments > 0) {
      numberOfRecurringPayments = Math.min(12, Math.max(1, numPayments));
    } else if (lastPaymentDate) {
      const start = new Date(firstDate);
      const end = new Date(lastPaymentDate);
      const monthsDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      numberOfRecurringPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
    } else {
      numberOfRecurringPayments = Math.max(1, Math.floor(6 / intervalMonths));
    }

    const recurringAmount = Math.round((remaining / numberOfRecurringPayments) * 100) / 100;
    
    let runningTotal = actualFirstPayment;
    for (let i = 0; i < numberOfRecurringPayments; i++) {
      const isLast = i === numberOfRecurringPayments - 1;
      const amount = isLast ? (finalTotal - runningTotal) : recurringAmount;
      
      // ✅ FIX: بدء التواريخ من أول شهر (الشهر 1) وليس من الشهر الثاني
      const monthOffset = hasFirstPayment ? (i + 1) : i;
      const dueDate = new Date(firstDate);
      dueDate.setMonth(dueDate.getMonth() + monthOffset * intervalMonths);
      
      const installmentNumber = hasFirstPayment ? i + 2 : i + 1;
      
      newInstallments.push({
        amount: Math.round(amount * 100) / 100,
        paymentType: intervalLabel,
        description: `الدفعة ${installmentNumber}`,
        dueDate: dueDate.toISOString().split('T')[0]
      });
      
      runningTotal += amount;
    }

    setInstallments(newInstallments);
    
    if (hasFirstPayment) {
      toast.success(`تم توزيع الدفعات: دفعة أولى (${actualFirstPayment.toLocaleString('ar-LY')} د.ل) + ${numberOfRecurringPayments} دفعات متكررة`);
    } else {
      toast.success(`تم توزيع المبلغ على ${numberOfRecurringPayments} دفعات متساوية`);
    }
  }, [finalTotal, startDate, calculateDueDate]);

  // ✅ NEW: Get installment summary for display
  const getInstallmentSummary = () => {
    if (installments.length === 0) return null;
    if (installments.length === 1) {
      return `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل بتاريخ ${installments[0].dueDate}`;
    }

    const first = installments[0];
    const recurring = installments.slice(1);
    const lastDate = installments[installments.length - 1].dueDate;

    // Check if all recurring payments are the same
    const recurringAmount = recurring[0]?.amount || 0;
    const allSame = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);

    if (allSame && recurring.length > 1) {
      const interval = recurring[0].paymentType;
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها يتم السداد ${interval} بمقدار ${recurringAmount.toLocaleString('ar-LY')} د.ل حتى ${lastDate}`;
    }

    return `${installments.length} دفعات من ${first.dueDate} إلى ${lastDate}`;
  };

  // ✅ NEW: Handle unequal distribution
  const handleApplyUnequalDistribution = React.useCallback((payments: any[]) => {
    const newInstallments = payments.map(p => ({
      amount: p.amount,
      paymentType: p.paymentType,
      description: p.description,
      dueDate: p.dueDate
    }));
    setInstallments(newInstallments);
    toast.success(`تم تطبيق التوزيع غير المتساوي: ${payments.length} دفعات`);
  }, []);

  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يجب إضافة دفعة واحدة على الأقل' };
    }

    const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const difference = Math.abs(totalInstallments - finalTotal);
    
    if (difference > 1) {
      return { 
        isValid: false, 
        message: `مجموع الدفعات (${totalInstallments.toLocaleString()}) لا يساوي إجمالي العقد (${finalTotal.toLocaleString()})` 
      };
    }

    return { isValid: true, message: '' };
  };

  const save = async () => {
    try {
      if (!contractNumber) return;
      
      const validation = validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
      
      setSaving(true);
      
      const c = await getContractWithBillboards(contractNumber);
      const current: string[] = (c.billboards || []).map((b: any) => String(b.ID));
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      for (const id of toRemove) {
        // removeBillboardFromContract يحذف تلقائياً:
        // - shared_transactions
        // - shared_billboards  
        // - friend_billboard_rentals
        await removeBillboardFromContract(contractNumber, id);
      }

      // ✅ NEW: Generate billboard prices data for historical reference
      const selectedBillboardsData = billboards
        .filter((b) => selected.includes(String((b as any).ID)))
        .map((b) => ({
          id: String((b as any).ID),
          name: (b as any).name || (b as any).Billboard_Name || '',
          location: (b as any).location || (b as any).Nearest_Landmark || '',
          city: (b as any).city || (b as any).City || '',
          size: (b as any).size || (b as any).Size || '',
          level: (b as any).level || (b as any).Level || '',
          price: Number((b as any).price) || 0,
          image: (b as any).image || '',
          // ✅ NEW: Store calculated price for this contract (including print cost)
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: pricingCategory,
          pricingMode: pricingMode,
          duration: pricingMode === 'months' ? durationMonths : durationDays
        }));

      // ✅ CORRECTED: Fixed calculation structure for database storage
      // ✅ Installments: احفظ نوع/وصف/تاريخ كل دفعة لضمان ظهورها في الطباعة
      const installmentsForSaving = (installments || []).map((inst, idx) => {
        const paymentType = String(inst?.paymentType || '').trim() || (idx === 0 ? 'عند التوقيع' : 'شهري');
        return {
          amount: Number(inst?.amount ?? 0) || 0,
          paymentType,
          description: String(inst?.description || '').trim() || `الدفعة ${idx + 1}`,
          dueDate: String(inst?.dueDate || '').trim() || calculateDueDate(paymentType, idx)
        };
      });

      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,

        // ✅ Total = what the customer pays (after discount + any extra service costs)
        'Total': finalTotal,

        // ✅ Total Rent = net rental for the company (after discount minus included service costs)
        'Total Rent': rentalCostOnly,

        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        billboard_ids: selected, // Pass as array, updateContract will handle conversion

        // ✅ Store billboard prices with discount details for history
        // IMPORTANT: totalBillboardPrice includes print/installation when NOT included in base price
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => {
          const fullBillboard = billboards.find(bb => String((bb as any).ID) === b.id);
          if (!fullBillboard) {
            console.warn(`Billboard ${b.id} not found for price calculation`);
            return {
              billboardId: b.id,
              basePriceBeforeDiscount: 0,
              priceBeforeDiscount: 0,
              discountPerBillboard: 0,
              priceAfterDiscount: 0,
              contractPrice: 0,
              printCost: 0,
              installationCost: 0,
              totalBillboardPrice: 0,
              pricingCategory: pricingCategory,
              pricingMode: pricingMode,
              duration: pricingMode === 'months' ? durationMonths : durationDays
            };
          }

          const baseBillboardPrice = calculateBillboardPrice(fullBillboard);
          const printCostForBillboard = calculatePrintCost(fullBillboard);
          const installDetail = installationDetails.find(d => d.billboardId === b.id);
          const installCostForBillboard = installDetail?.installationPrice || 0;
          
          // Calculate what gets added to the customer's bill
          let additionalCosts = 0;
          if (printCostEnabled && !includePrintInPrice && printCostForBillboard > 0) {
            additionalCosts += applyExchangeRate(printCostForBillboard);
          }
          if (installationEnabled && !includeInstallationInPrice && installCostForBillboard > 0) {
            additionalCosts += applyExchangeRate(installCostForBillboard);
          }
          
          const totalPriceBeforeDiscount = baseBillboardPrice + additionalCosts;
          const discountPerBillboard = selected.length > 0 && estimatedTotal > 0
            ? discountAmount * (baseBillboardPrice / estimatedTotal)
            : 0;
          
          // إجمالي اللوحة = الإيجار الأساسي + التكاليف الإضافية - الخصم
          const totalBillboardPrice = totalPriceBeforeDiscount - discountPerBillboard;

          return {
            billboardId: b.id,
            basePriceBeforeDiscount: baseBillboardPrice,
            priceBeforeDiscount: totalPriceBeforeDiscount,
            discountPerBillboard: discountPerBillboard,
            priceAfterDiscount: totalBillboardPrice,
            contractPrice: totalBillboardPrice, // هذا هو السعر المخزن والمطبوع
            printCost: printCostEnabled && !includePrintInPrice ? applyExchangeRate(printCostForBillboard) : 0,
            installationCost: installationEnabled && !includeInstallationInPrice ? applyExchangeRate(installCostForBillboard) : 0,
            totalBillboardPrice: totalBillboardPrice,
            pricingCategory: pricingCategory,
            pricingMode: pricingMode,
            duration: pricingMode === 'months' ? durationMonths : durationDays
          };
        })),

        // ✅ Service costs
        installation_cost: installationEnabled ? applyExchangeRate(installationCost) : 0,
        installation_enabled: installationEnabled,
        print_cost: applyExchangeRate(printCostTotal),
        print_cost_enabled: String(printCostEnabled),
        print_price_per_meter: String(printPricePerMeter),

        // ✅ Persist "include in price" flags
        include_installation_in_price: includeInstallationInPrice,
        include_print_in_billboard_price: includePrintInPrice,

        // ✅ NEW: Persist operating fee inclusion flags
        include_operating_in_print: includeOperatingInPrint,
        include_operating_in_installation: includeOperatingInInstallation,

        // ✅ NEW: Persist level discounts
        level_discounts: Object.keys(levelDiscounts).length > 0 ? levelDiscounts : null,

        // ✅ NEW: Persist friend rental includes installation
        friend_rental_includes_installation: friendRentalIncludesInstallation,

        // ✅ Currency
        contract_currency: contractCurrency,
        exchange_rate: String(exchangeRate),

        // ✅ Operating fee - إجمالي جميع رسوم التشغيل (عادية + مشاركة + صديقة)
        fee: String(operatingFee + partnershipOperatingFee + friendOperatingFeeAmount),
        operating_fee_rate: operatingFeeRate,
        partnership_operating_fee_rate: partnershipOperatingFeeRate,
        friend_rental_operating_fee_rate: friendRentalOperatingFeeRate,
        friend_rental_operating_fee_enabled: friendRentalOperatingFeeEnabled,

        // ✅ Partnership operating details
        partnership_operating_data: billboards
          .filter(b => selected.includes(String((b as any).ID)) && (b as any).is_partnership)
          .map(b => {
            const billboardId = String((b as any).ID);
            const billboardPrice = calculateBillboardPrice(b);
            const billboardPricePercentage = estimatedTotal > 0 ? billboardPrice / estimatedTotal : 0;
            const discountPerBillboard = discountAmount * billboardPricePercentage;
            const priceAfterDiscount = Math.max(0, billboardPrice - discountPerBillboard);
            const operatingFeeAmount = priceAfterDiscount * (partnershipOperatingFeeRate / 100);

            return {
              billboard_id: Number(billboardId),
              billboard_name: (b as any).Billboard_Name || (b as any).name || '',
              price_after_discount: priceAfterDiscount,
              operating_fee_rate: partnershipOperatingFeeRate,
              operating_fee_amount: operatingFeeAmount
            };
          }),

        // ✅ Designs
        design_data: JSON.stringify(billboardDesigns),

        // ✅ Installments + distribution settings
        installments_data: installmentsForSaving,
        installment_distribution_type: installmentDistributionType,
        installment_first_payment_amount: hasDifferentFirstPayment ? installmentFirstPaymentAmount : 0,
        installment_first_payment_type: installmentFirstPaymentType,
        installment_interval: installmentInterval,
        installment_count: installmentCount,
        installment_auto_calculate: installmentAutoCalculate,
        installment_first_at_signing: installmentFirstAtSigning,
      };

      // ✅ Save friend rentals
      updates.friend_rental_data = friendBillboardCosts.length > 0 ? friendBillboardCosts : null;

      // ✅ Save friend rental operating fee settings
      (updates as any).friend_rental_operating_fee_enabled = friendRentalOperatingFeeEnabled;
      (updates as any).friend_rental_operating_fee_rate = friendRentalOperatingFeeRate;

      // Also save individual payments for backward compatibility
      if (installmentsForSaving.length > 0) updates['Payment 1'] = { amount: installmentsForSaving[0]?.amount || 0, type: installmentsForSaving[0]?.paymentType || 'عند التوقيع' };
      if (installmentsForSaving.length > 1) updates['Payment 2'] = String(installmentsForSaving[1]?.amount || 0);
      if (installmentsForSaving.length > 2) updates['Payment 3'] = String(installmentsForSaving[2]?.amount || 0);

      // ✅ Remaining should match what the customer pays
      const totalPaid = Number(currentContract?.['Total Paid']) || 0;
      updates['Total Paid'] = String(totalPaid);
      updates['Remaining'] = String(Math.max(0, finalTotal - totalPaid));
      if (customerId) updates.customer_id = customerId;

      console.log('✅ ContractEdit saving totals:');
      console.log('- Customer total (Total):', finalTotal);
      console.log('- Company net rental (Total Rent):', rentalCostOnly);
      console.log('- Include installation in price:', includeInstallationInPrice);
      console.log('- Include print in price:', includePrintInPrice);
      console.log('- Installation cost:', applyExchangeRate(installationCost));
      console.log('- Print cost:', applyExchangeRate(printCostTotal));

      await updateContract(contractNumber, updates);

      // ✅ NEW: Update capital_remaining for partnership billboards
      const partnershipBillboards = billboards.filter(b => 
        selected.includes(String((b as any).ID)) && (b as any).is_partnership
      );
      
      for (const bb of partnershipBillboards) {
        const billboardId = (bb as any).ID;
        const capital = Number((bb as any).capital || 0);
        const currentRemaining = Number((bb as any).capital_remaining ?? capital);
        
        // Calculate this billboard's price and discount
        const billboardPrice = calculateBillboardPrice(bb);
        const billboardPricePercentage = estimatedTotal > 0 ? billboardPrice / estimatedTotal : 0;
        const discountPerBillboard = discountAmount * billboardPricePercentage;
        const priceAfterDiscount = Math.max(0, billboardPrice - discountPerBillboard);
        
        // Get partnership terms for capital deduction percentage
        const { data: partnershipTerms } = await supabase
          .from('shared_billboards')
          .select('pre_capital_pct')
          .eq('billboard_id', billboardId)
          .limit(1);
        
        const capitalDeductionPct = Number(partnershipTerms?.[0]?.pre_capital_pct ?? 30) / 100;
        const capitalDeduction = priceAfterDiscount * capitalDeductionPct;
        
        // Calculate new remaining capital (limited to 0)
        const newCapitalRemaining = Math.max(0, currentRemaining - capitalDeduction);
        
        console.log(`✅ Partnership billboard ${billboardId}:`, {
          capital,
          currentRemaining,
          priceAfterDiscount,
          capitalDeductionPct,
          capitalDeduction,
          newCapitalRemaining
        });
        
        // Update billboard capital_remaining
        const { error: capitalError } = await supabase
          .from('billboards')
          .update({ capital_remaining: newCapitalRemaining })
          .eq('ID', billboardId);
        
        if (capitalError) {
          console.error(`Failed to update capital_remaining for billboard ${billboardId}:`, capitalError);
        }
      }

      // ✅ Save friend billboard rentals
      for (const friendCost of friendBillboardCosts) {
        // Calculate customer price for this billboard
        const billboard = billboards.find(b => String((b as any).ID) === friendCost.billboardId);
        if (billboard) {
          const billboardPrice = calculateBillboardPrice(billboard);
          const discountPerBillboard = selected.length > 0 
            ? discountAmount * (billboardPrice / estimatedTotal) 
            : 0;
          const customerPrice = billboardPrice - discountPerBillboard;

          // Upsert friend rental record
          const { error: rentalError } = await supabase
            .from('friend_billboard_rentals')
            .upsert({
              contract_number: Number(contractNumber),
              billboard_id: Number(friendCost.billboardId),
              friend_company_id: friendCost.friendCompanyId,
              start_date: startDate,
              end_date: endDate,
              customer_rental_price: customerPrice,
              friend_rental_cost: friendCost.friendRentalCost,
              profit: customerPrice - friendCost.friendRentalCost,
              notes: 'تحديث من تعديل العقد'
            }, {
              onConflict: 'contract_number,billboard_id'
            });

          if (rentalError) {
            console.error('Failed to save friend rental:', rentalError);
          }
        }
      }

      toast.success(`تم حفظ التعديلات مع العملة ${getCurrencySymbol(contractCurrency)} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintContract = () => {
    if (currentContract) {
      setPdfOpen(true);
    } else {
      toast.error('يجب حفظ العقد أولاً');
    }
  };

  // ✅ NEW: Cleanup orphaned billboards
  const handleCleanup = async () => {
    try {
      toast.info('جاري تنظيف اللوحات المحذوفة من العقود...');
      const result = await cleanupOrphanedBillboards();
      
      if (result.cleaned > 0) {
        toast.success(`تم تنظيف ${result.cleaned} لوحة من أصل ${result.total} لوحة`);
        // إعادة تحميل اللوحات
        const data = await loadBillboards();
        setBillboards(data);
      } else {
        toast.info('لا توجد لوحات بحاجة للتنظيف');
      }
    } catch (e: any) {
      console.error('Cleanup failed:', e);
      toast.error('فشل في تنظيف اللوحات');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground p-4 md:p-6" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <ContractEditHeader
          contractNumber={contractNumber}
          onBack={() => navigate('/admin/contracts')}
          onPrint={handlePrintContract}
          onSave={save}
          saving={saving}
        />

        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* اللوحات المرتبطة */}
            <SelectedBillboardsCard
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={installationDetails}
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              currencySymbol={getCurrencySymbol(contractCurrency)}
              sizeNames={sizeNames}
              totalDiscount={discountAmount}
              friendBillboardCosts={friendBillboardCosts}
              onUpdateFriendCost={updateFriendBillboardCost}
              partnershipOperatingFeeRate={partnershipOperatingFeeRate}
              customerCategory={pricingCategory}
              // ✅ NEW: Pass print cost details and include flags
              printCostDetails={selected.map(id => {
                const billboard = billboards.find(b => String((b as any).ID) === id);
                if (!billboard) return { billboardId: id, printCost: 0 };
                const size = (billboard as any).Size || (billboard as any).size || '';
                const dimensions = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
                const area = dimensions ? parseFloat(dimensions[1]) * parseFloat(dimensions[2]) : 0;
                const faces = Number((billboard as any).Faces_Count || (billboard as any).faces_count || 1);
                const printCost = area * faces * printPricePerMeter;
                return { billboardId: id, printCost: applyExchangeRate(printCost) };
              })}
              includePrintInPrice={includePrintInPrice}
              includeInstallationInPrice={includeInstallationInPrice}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
            />

            {/* ✅ NEW: إيجارات اللوحات الصديقة بالجملة */}
            {selected.length > 0 && billboards.filter(b => 
              selected.includes(String((b as any).ID)) && (b as any).friend_company_id
            ).length > 0 && (
              <FriendBillboardsBulkRental
                friendBillboards={billboards
                  .filter(b => selected.includes(String((b as any).ID)) && (b as any).friend_company_id)
                  .map(b => ({
                    id: String((b as any).ID),
                    size: (b as any).Size || (b as any).size || 'غير محدد',
                    friendCompanyId: (b as any).friend_company_id,
                    friendCompanyName: (b as any).friend_companies?.name || 'شركة صديقة'
                  }))
                }
                friendBillboardCosts={friendBillboardCosts}
                onUpdateFriendCost={updateFriendBillboardCost}
                includesInstallation={friendRentalIncludesInstallation}
                onIncludesInstallationChange={setFriendRentalIncludesInstallation}
                currencySymbol={getCurrencySymbol(contractCurrency)}
                operatingFeeEnabled={friendRentalOperatingFeeEnabled}
                operatingFeeRate={friendRentalOperatingFeeRate}
                onOperatingFeeEnabledChange={setFriendRentalOperatingFeeEnabled}
                onOperatingFeeRateChange={setFriendRentalOperatingFeeRate}
                operatingFeeAmount={friendOperatingFeeAmount}
              />
            )}

            {/* خريطة اللوحات المرتبطة - مطوية افتراضياً */}
            {selected.length > 0 && (
              <Card className="bg-card border-border shadow-card overflow-hidden">
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <MapIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-card-foreground">خريطة اللوحات المرتبطة</h3>
                          <p className="text-xs text-muted-foreground">
                            {selected.length} لوحة مرتبطة بالعقد
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {selected.length}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border">
                      <InteractiveMap
                        billboards={billboards
                          .filter((b) => selected.includes(String((b as any).ID)))
                          .map(b => ({
                            ID: (b as any).ID || 0,
                            Billboard_Name: (b as any).Billboard_Name || '',
                            City: (b as any).City || '',
                            District: (b as any).District || '',
                            Size: (b as any).Size || '',
                            Status: (b as any).Status || 'متاح',
                            Price: (b as any).Price || '0',
                            Level: (b as any).Level || '',
                            Image_URL: (b as any).Image_URL || '',
                            GPS_Coordinates: (b as any).GPS_Coordinates || '',
                            GPS_Link: (b as any).GPS_Link || '',
                            Nearest_Landmark: (b as any).Nearest_Landmark || '',
                            Faces_Count: (b as any).Faces_Count || '1',
                            Municipality: (b as any).Municipality || '',
                            Rent_End_Date: (b as any).Rent_End_Date || null,
                            id: String((b as any).ID || ''),
                            name: (b as any).Billboard_Name || '',
                            location: (b as any).Nearest_Landmark || '',
                            size: (b as any).Size || '',
                            status: (b as any).Status || 'متاح',
                            coordinates: (b as any).GPS_Coordinates || '',
                            imageUrl: (b as any).Image_URL || '',
                            expiryDate: (b as any).Rent_End_Date || null,
                            area: (b as any).District || '',
                            municipality: (b as any).Municipality || '',
                          })) as Billboard[]}
                        onImageView={(url) => console.log('Image view:', url)}
                        selectedBillboards={new Set(selected)}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* إدارة التصاميم */}
            {selected.length > 0 && (
              <DesignManager
                selectedBillboards={billboards
                  .filter((b) => selected.includes(String((b as any).ID)))
                  .map((b) => ({
                    id: String((b as any).ID),
                    name: (b as any).name || (b as any).Billboard_Name || '',
                    Image_URL: (b as any).Image_URL || (b as any).image,
                    image: (b as any).image,
                    Nearest_Landmark: (b as any).Nearest_Landmark || (b as any).nearest_landmark,
                    nearest_landmark: (b as any).nearest_landmark
                  }))
                }
                designs={billboardDesigns}
                onChange={setBillboardDesigns}
                contractId={contractNumber}
              />
            )}

            {/* ✅ اختيار اللوحات مع الخريطة */}
            <Card className="border-border shadow-lg overflow-hidden">
              <Tabs defaultValue="list" className="w-full">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 border-b border-border">
                  <TabsList className="grid w-full grid-cols-2 bg-background/50 h-10">
                    <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <List className="h-4 w-4" />
                      القائمة
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <MapIcon className="h-4 w-4" />
                      الخريطة
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="list" className="m-0">
                  <div className="p-3 space-y-3">
                    <BillboardFilters
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      cityFilter={cityFilter}
                      setCityFilter={setCityFilter}
                      sizeFilter={sizeFilter}
                      setSizeFilter={setSizeFilter}
                      statusFilter={statusFilter}
                      setStatusFilter={setStatusFilter}
                      pricingCategory={pricingCategory}
                      setPricingCategory={setPricingCategory}
                      cities={cities}
                      sizes={sizes}
                      pricingCategories={pricingCategories}
                      municipalities={municipalities}
                      municipalityFilter={municipalityFilter}
                      setMunicipalityFilter={setMunicipalityFilter}
                      onCleanup={handleCleanup}
                    />

                    <AvailableBillboardsGrid
                      billboards={filtered}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      loading={loading}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="map" className="m-0 p-3 space-y-3">
                  <BillboardFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    cityFilter={cityFilter}
                    setCityFilter={setCityFilter}
                    sizeFilter={sizeFilter}
                    setSizeFilter={setSizeFilter}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    pricingCategory={pricingCategory}
                    setPricingCategory={setPricingCategory}
                    cities={cities}
                    sizes={sizes}
                    pricingCategories={pricingCategories}
                    municipalities={municipalities}
                    municipalityFilter={municipalityFilter}
                    setMunicipalityFilter={setMunicipalityFilter}
                    onCleanup={handleCleanup}
                  />

                  <InteractiveMap
                    billboards={filtered.map((b) => {
                      const endDate = (b as any).Rent_End_Date ?? (b as any).rent_end_date ?? null;
                      const daysUntilExpiry = getDaysUntilExpiry(endDate);
                      const isNearExpiry = typeof daysUntilExpiry === 'number' && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                      const statusCode: 'available' | 'rented' | 'maintenance' = isBillboardAvailable(b) ? 'available' : 'rented';
                      const statusLabel = isBillboardAvailable(b) ? 'متاح' : isNearExpiry ? 'قريباً' : 'محجوز';

                      return {
                        ID: (b as any).ID || 0,
                        Billboard_Name: (b as any).Billboard_Name || '',
                        City: (b as any).City || '',
                        District: (b as any).District || '',
                        Size: (b as any).Size || '',
                        Status: statusLabel,
                        Price: (b as any).Price || '0',
                        Level: (b as any).Level || '',
                        Image_URL: (b as any).Image_URL || '',
                        GPS_Coordinates: (b as any).GPS_Coordinates || '',
                        GPS_Link: (b as any).GPS_Link || '',
                        Nearest_Landmark: (b as any).Nearest_Landmark || '',
                        Faces_Count: (b as any).Faces_Count || '1',
                        Municipality: (b as any).Municipality || '',
                        Rent_End_Date: endDate,
                        id: String((b as any).ID || ''),
                        name: (b as any).Billboard_Name || '',
                        location: (b as any).Nearest_Landmark || '',
                        size: (b as any).Size || '',
                        status: statusCode,
                        coordinates: (b as any).GPS_Coordinates || '',
                        imageUrl: (b as any).Image_URL || '',
                        expiryDate: endDate,
                        area: (b as any).District || '',
                        municipality: (b as any).Municipality || '',
                      };
                    })}
                    onImageView={(url) => console.log('Image view:', url)}
                    selectedBillboards={new Set(selected)}
                    onToggleSelection={(billboardId) => {
                      const billboard = billboards.find((b) => String((b as any).ID) === billboardId);
                      if (billboard) {
                        toggleSelect(billboard);
                      }
                    }}
                    onSelectMultiple={(billboardIds) => {
                      setSelected((prev) => {
                        const newSet = new Set(prev);
                        billboardIds.forEach((id) => newSet.add(id));
                        return Array.from(newSet);
                      });
                      toast.success(`تم تحديد ${billboardIds.length} لوحة`);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar - القائمة الجانبية */}
          <div className="w-full xl:w-[420px] space-y-3 xl:sticky xl:top-4 xl:self-start">
            {/* معلومات العميل */}
            <CustomerInfoForm
              customerName={customerName}
              setCustomerName={setCustomerName}
              adType={adType}
              setAdType={setAdType}
              pricingCategory={pricingCategory}
              setPricingCategory={setPricingCategory}
              pricingCategories={pricingCategories}
              customers={customers}
              customerOpen={customerOpen}
              setCustomerOpen={setCustomerOpen}
              customerQuery={customerQuery}
              setCustomerQuery={setCustomerQuery}
              onAddCustomer={handleAddCustomer}
              onSelectCustomer={handleSelectCustomer}
            />

            {/* تواريخ العقد */}
            <ContractDatesForm
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              pricingMode={pricingMode}
              setPricingMode={setPricingMode}
              durationMonths={durationMonths}
              setDurationMonths={setDurationMonths}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
              use30DayMonth={use30DayMonth}
              setUse30DayMonth={setUse30DayMonth}
            />

            {/* معلومات لوحات المشاركة */}
            {selected.length > 0 && startDate && endDate && (
              <PartnershipBillboardsInfo 
                billboardIds={selected.map(id => Number(id))}
                startDate={startDate}
                endDate={endDate}
              />
            )}

            {/* رسوم التشغيل للوحات المشاركة */}
            {selected.length > 0 && billboards.filter(b => selected.includes(String((b as any).ID)) && (b as any).is_partnership).length > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-purple-500/10">
                      <Settings className="h-4 w-4 text-purple-600" />
                    </div>
                    رسوم التشغيل (لوحات المشاركة)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap">النسبة:</Label>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={partnershipOperatingFeeRate}
                        onChange={(e) => setPartnershipOperatingFeeRate(Number(e.target.value) || 0)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-purple-500 transition-colors text-center font-medium"
                        placeholder="3"
                        min="0"
                        step="0.1"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">إيجار لوحات المشاركة:</span>
                      <span className="font-semibold">{partnershipBillboardsRentalCost.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">رسوم التشغيل:</span>
                      <span className="text-lg font-bold text-purple-600">{partnershipOperatingFee.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded-lg">
                    ⚠️ رسوم منفصلة عن اللوحات العادية
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* رسوم التشغيل العادية - ملخص */}
            {selected.length > 0 && regularBillboardsRentalCost > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    رسوم التشغيل (اللوحات العادية)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap">النسبة:</Label>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={operatingFeeRate}
                        onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-blue-500 transition-colors text-center font-medium"
                        placeholder="3"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">صافي الإيجار (للشركة):</span>
                      <span className="font-semibold">{netRentalForCompany.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-500/20">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">رسوم التشغيل:</span>
                      <span className="text-lg font-bold text-blue-600">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ✅ إجمالي رسوم التشغيل */}
            {(operatingFee > 0 || partnershipOperatingFee > 0 || friendOperatingFeeAmount > 0) && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    إجمالي رسوم التشغيل
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {operatingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رسوم اللوحات العادية ({operatingFeeRate}%):</span>
                      <span className="font-semibold text-blue-600">{operatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                    </div>
                  )}
                  {partnershipOperatingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رسوم لوحات المشاركة ({partnershipOperatingFeeRate}%):</span>
                      <span className="font-semibold text-purple-600">{partnershipOperatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                    </div>
                  )}
                  {friendOperatingFeeAmount > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">تكلفة اللوحات الصديقة:</span>
                        <span className="font-semibold text-amber-500">{totalFriendCosts.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">رسوم التشغيل ({friendRentalOperatingFeeRate}%):</span>
                        <span className="font-semibold text-amber-600">{friendOperatingFeeAmount.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-emerald-500/20">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">الإجمالي:</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {(operatingFee + partnershipOperatingFee + friendOperatingFeeAmount).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded-lg">
                    يتم حفظ هذا المبلغ في حقل "رسوم التشغيل" بالعقد
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                  </div>
                  إعدادات العملة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">عملة العقد</Label>
                    <Select value={contractCurrency} onValueChange={setContractCurrency}>
                      <SelectTrigger className="h-10 bg-background border-2 border-border focus:border-amber-500">
                        <SelectValue placeholder="اختر العملة" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-[10000]">
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">سعر الصرف</Label>
                    <div className="relative">
                      <input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-amber-500 transition-colors text-center font-medium"
                        placeholder="1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                
                {contractCurrency !== 'LYD' && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      1 د.ل = {exchangeRate} {getCurrencySymbol(contractCurrency)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* إعدادات التسعير */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-violet-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <RefreshCw className="h-4 w-4 text-violet-600" />
                  </div>
                  إعدادات التسعير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* نظام التسعير */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">نظام التسعير</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={!useFactorsPricing ? "default" : "outline"}
                      size="sm"
                      className={`h-9 text-xs ${!useFactorsPricing ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                      onClick={() => setUseFactorsPricing(false)}
                    >
                      📊 جدول الأسعار
                    </Button>
                    <Button
                      variant={useFactorsPricing ? "default" : "outline"}
                      size="sm"
                      className={`h-9 text-xs ${useFactorsPricing ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                      onClick={() => setUseFactorsPricing(true)}
                    >
                      🔢 نظام المعاملات
                    </Button>
                  </div>
                </div>

                {/* أسعار مخزنة أو حالية */}
                {!useFactorsPricing && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">مصدر الأسعار</Label>
                      <p className="text-xs text-muted-foreground">
                        {useStoredPrices ? 'من العقد المخزن' : 'من جدول التسعير'}
                      </p>
                    </div>
                    <Button
                      variant={useStoredPrices ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setUseStoredPrices(!useStoredPrices)}
                      className="h-8 text-xs gap-1.5"
                    >
                      {useStoredPrices ? '📦 مخزنة' : '🔄 حالية'}
                    </Button>
                  </div>
                )}
                
                {useFactorsPricing && (
                  <a 
                    href="/admin/pricing-factors" 
                    target="_blank" 
                    className="flex items-center justify-center gap-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs hover:bg-violet-500/20 transition-colors"
                  >
                    إدارة المعاملات والأسعار الأساسية ←
                  </a>
                )}
              </CardContent>
            </Card>

            {/* تكلفة التركيب */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-orange-500/5 to-transparent">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                      <Wrench className="h-4 w-4 text-orange-600" />
                    </div>
                    تكلفة التركيب
                  </div>
                  <Switch
                    checked={installationEnabled}
                    onCheckedChange={(checked) => {
                      setInstallationEnabled(checked);
                      toast.success(checked ? 'تم تفعيل التركيب' : 'تم إلغاء التركيب');
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {installationEnabled && installationCostSummary ? (
                  <div className="space-y-3">
                    {/* الإجمالي الرئيسي */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-700 dark:text-orange-300">إجمالي التركيب:</span>
                        <span className="text-xl font-bold text-orange-600">
                          {applyExchangeRate(installationCostSummary.totalInstallationCost).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                        </span>
                      </div>
                    </div>
                    
                    {/* تفاصيل المقاسات */}
                    {installationCostSummary.groupedSizes.length > 0 && (
                      <div className="space-y-1.5">
                        {installationCostSummary.groupedSizes.map((sizeInfo: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm px-2 py-1.5 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">{sizeInfo.size} ({sizeInfo.count} لوحة)</span>
                            <span className="font-medium">{applyExchangeRate(sizeInfo.totalForSize).toLocaleString()} {getCurrencySymbol(contractCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    {installationEnabled ? 'لا توجد لوحات مختارة' : 'العقد بدون تكلفة تركيب'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* تكلفة الطباعة */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-cyan-500/5 to-transparent">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10">
                      <FileText className="h-4 w-4 text-cyan-600" />
                    </div>
                    تكلفة الطباعة
                  </div>
                  <Switch
                    checked={printCostEnabled}
                    onCheckedChange={setPrintCostEnabled}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {printCostEnabled ? (
                  <div className="space-y-4">
                    {/* سعر المتر */}
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium whitespace-nowrap">سعر المتر²:</Label>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={printPricePerMeter}
                          onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-cyan-500 transition-colors text-center font-medium"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">د.ل</span>
                      </div>
                    </div>
                    
                    {printCostSummary && printCostSummary.groupedDetails.length > 0 ? (
                      <div className="space-y-3">
                        {/* تفاصيل المقاسات */}
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {printCostSummary.groupedDetails.map((detail: any, index: number) => (
                            <div key={index} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-sm">{detail.size}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {detail.count} لوحة × {detail.faces} وجه
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>المساحة: {detail.area.toFixed(1)} م²</span>
                                <span className="font-medium text-cyan-600">{detail.totalCost.toFixed(0)} د.ل</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* الإجمالي */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-cyan-700 dark:text-cyan-300">إجمالي الطباعة:</span>
                            <span className="text-xl font-bold text-cyan-600">
                              {applyExchangeRate(Number(printCostSummary.totalPrintCost || 0)).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-center py-4 text-muted-foreground bg-muted/20 rounded-lg">
                        {selected.length === 0 ? 'لا توجد لوحات مختارة' : 'أدخل سعر المتر لحساب التكلفة'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    العقد بدون تكلفة طباعة
                  </div>
                )}
              </CardContent>
            </Card>



            {/* إدارة الدفعات */}
            <InstallmentsManager
              installments={installments}
              finalTotal={finalTotal}
              startDate={startDate}
              onDistributeEvenly={distributeEvenly}
              onDistributeWithInterval={distributeWithInterval}
              onCreateManualInstallments={createManualInstallments}
              onApplyUnequalDistribution={handleApplyUnequalDistribution}
              onAddInstallment={addInstallment}
              onRemoveInstallment={removeInstallment}
              onUpdateInstallment={updateInstallment}
              onClearAll={clearAllInstallments}
              installmentSummary={getInstallmentSummary()}
              // ✅ NEW: Pass saved settings
              savedDistributionType={installmentDistributionType}
              savedFirstPaymentAmount={installmentFirstPaymentAmount}
              savedFirstPaymentType={installmentFirstPaymentType}
              savedInterval={installmentInterval}
              savedCount={installmentCount}
              savedHasDifferentFirstPayment={hasDifferentFirstPayment}
              savedFirstAtSigning={installmentFirstAtSigning}
              // ✅ NEW: Sync callbacks
              onDistributionTypeChange={setInstallmentDistributionType}
              onFirstPaymentAmountChange={setInstallmentFirstPaymentAmount}
              onFirstPaymentTypeChange={setInstallmentFirstPaymentType}
              onIntervalChange={setInstallmentInterval}
              onCountChange={setInstallmentCount}
              onHasDifferentFirstPaymentChange={setHasDifferentFirstPayment}
              onFirstAtSigningChange={setInstallmentFirstAtSigning}
            />

            {/* مكون تخفيض حسب المستوى */}
            {selected.length > 0 && (
              <LevelDiscountsCard
                selectedBillboards={billboards.filter(b => selected.includes(String((b as any).ID)))}
                levelDiscounts={levelDiscounts}
                setLevelDiscounts={setLevelDiscounts}
                currencySymbol={getCurrencySymbol(contractCurrency)}
                calculateBillboardPrice={calculateBillboardPrice}
                sizeNames={sizeNames}
              />
            )}

            {/* ملخص التكاليف */}
            <CostSummaryCard
              estimatedTotal={estimatedTotal}
              rentCost={rentCost}
              setRentCost={setRentCost}
              setUserEditedRentCost={setUserEditedRentCost}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              baseTotal={baseTotal}
              discountAmount={discountAmount}
              finalTotal={finalTotal}
              installationCost={installationEnabled ? applyExchangeRate(installationCost) : 0}
              rentalCostOnly={rentalCostOnly}
              operatingFee={operatingFee + partnershipOperatingFee}
              operatingFeeRate={operatingFeeRate}
              currentContract={currentContract}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/contracts')}
              saving={saving}
              totalFriendCosts={totalFriendCosts}
              // Print cost props
              printCost={printCostEnabled ? applyExchangeRate(printCostTotal) : 0}
              printCostEnabled={printCostEnabled}
              // Installation enabled
              installationEnabled={installationEnabled}
              // Include in price toggles
              includeInstallationInPrice={includeInstallationInPrice}
              setIncludeInstallationInPrice={setIncludeInstallationInPrice}
              includePrintInPrice={includePrintInPrice}
              setIncludePrintInPrice={setIncludePrintInPrice}
              // Operating fee inclusion toggles
              includeOperatingInPrint={includeOperatingInPrint}
              setIncludeOperatingInPrint={setIncludeOperatingInPrint}
              includeOperatingInInstallation={includeOperatingInInstallation}
              setIncludeOperatingInInstallation={setIncludeOperatingInInstallation}
              // Currency
              currencySymbol={getCurrencySymbol(contractCurrency)}
              // Proportional distribution
              onProportionalDistribution={handleProportionalDistribution}
            />
          </div>
        </div>

        <ContractPDFDialog
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          contract={currentContract}
        />
      </div>
    </div>
  );
}
