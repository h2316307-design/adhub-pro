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
import { BillboardSelectionMap } from '@/components/Map/BillboardSelectionMap';
import { cleanupOrphanedBillboards } from '@/services/contractCleanupService';

// Import modular components
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { BillboardManagementMap } from '@/components/Map/BillboardManagementMap';
import { DesignManager } from '@/components/contracts/DesignManager';

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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');

  // Contract form data
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
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
        const [pricingRes, sizesRes] = await Promise.all([
          supabase.from('pricing').select('*').order('size', { ascending: true }),
          supabase.from('sizes').select('id, name')
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
        
        // ✅ NEW: Load installation enabled from contract (default true if not set)
        const savedInstallationEnabled = c.installation_enabled !== false && c.installation_enabled !== 0 && c.installation_enabled !== "false";
        setInstallationEnabled(savedInstallationEnabled);
        
        console.log('✅ Loading print cost settings:');
        console.log('- Raw print_cost_enabled value:', c.print_cost_enabled, typeof c.print_cost_enabled);
        console.log('- Parsed print_cost_enabled:', savedPrintEnabled);
        console.log('- Print price per meter:', savedPrintPrice);
        console.log('- Installation enabled:', savedInstallationEnabled);

        // ✅ NEW: Load operating fee rate from contract
        const savedOperatingFeeRate = Number(c.operating_fee_rate || 3);
        setOperatingFeeRate(savedOperatingFeeRate);
        console.log('✅ Loading operating fee rate:', savedOperatingFeeRate, '%');
        
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
        
        // If we have valid installments data, use it
        if (loadedInstallments.length > 0) {
          setInstallments(loadedInstallments);
          console.log('Set installments from installments_data:', loadedInstallments);
        } else {
          // Fallback to old Payment 1, 2, 3 format
          console.log('No installments_data found, using old Payment format');
          const payments = [];
          if (c['Payment 1']) payments.push({ 
            amount: c['Payment 1'], 
            paymentType: 'شهري', 
            description: 'الدفعة الأولى',
            dueDate: calculateDueDate('شهري', 0, s)
          });
          if (c['Payment 2']) payments.push({ 
            amount: c['Payment 2'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثانية',
            dueDate: calculateDueDate('شهري', 1, s)
          });
          if (c['Payment 3']) payments.push({ 
            amount: c['Payment 3'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثالثة',
            dueDate: calculateDueDate('شهري', 2, s)
          });
          setInstallments(payments);
          console.log('Set installments from old Payment format:', payments);
        }
        
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
      const days = Math.max(0, Number(durationMonths || 0)) * 30;
      end.setDate(end.getDate() + days);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths, durationDays, pricingMode]);


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

  // ✅ FIXED: Calculate billboard price - always recalculate based on current size unless user specifically chose stored prices
  const calculateBillboardPrice = (billboard: Billboard): number => {
    const billboardId = String((billboard as any).ID);
    
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
    
    // ✅ Calculate fresh price based on CURRENT billboard data
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

    // ✅ Add print cost to base price only if enabled
    const printCost = calculatePrintCost(billboard);
    const finalPrice = basePrice + printCost;
    
    // ✅ Apply exchange rate
    const convertedPrice = applyExchangeRate(finalPrice);
    
    console.log(`✅ Final calculated price for billboard ${billboardId}: ${finalPrice} LYD -> ${convertedPrice} ${contractCurrency}`);
    return convertedPrice;
  };

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

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).size || (b as any).Size))).filter(Boolean) as string[], [billboards]);
  const municipalities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean) as string[], [billboards]);

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
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricingData, printCostEnabled, printPricePerMeter, useStoredPrices, contractCurrency, exchangeRate]);

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

  // ✅ CORRECTED: Fixed calculation formulas as requested
  const finalTotal = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);
  
  // ✅ NEW: Calculate print cost total
  const printCostTotal = useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String((b as any).ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter]);

  const rentalCostOnly = useMemo(() => {
    const installCost = installationEnabled ? applyExchangeRate(installationCost) : 0;
    return Math.max(0, baseTotal - discountAmount - installCost - applyExchangeRate(printCostTotal));
  }, [baseTotal, discountAmount, installationCost, installationEnabled, printCostTotal, exchangeRate]);

  // ✅ CORRECTED: Calculate operating fee based on rental cost only (Total Rent column) with custom rate
  useEffect(() => {
    const fee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
    setOperatingFee(fee);
    console.log(`✅ Operating fee calculated: ${rentalCostOnly} × ${operatingFeeRate}% = ${fee}`);
  }, [rentalCostOnly, operatingFeeRate]);

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
      const endDate = billboard.Rent_End_Date ?? billboard.rent_end_date;
      const contractExpired = isContractExpired(endDate);
      
      // Determine availability
      const isAvailable = (statusLower === 'available' || statusValue === 'متاح') || 
                         !hasContract || 
                         contractExpired;
      const isBooked = ((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || 
                       hasContract) && 
                       !contractExpired;
      
      // Check if near expiry (within 30 days)
      let isNearExpiry = false;
      if (endDate && !contractExpired) {
        try {
          const end = new Date(endDate);
          const diffDays = Math.ceil((end.getTime() - Date.now()) / 86400000);
          isNearExpiry = diffDays > 0 && diffDays <= 30;
        } catch {}
      }
      
      // Apply filters
      const municipality = String(billboard.Municipality || billboard.municipality || '');
      const city = String(billboard.City || billboard.city || '');
      const size = String(billboard.Size || billboard.size || '');
      
      const matchesMunicipality = municipalityFilter === 'all' || municipality === municipalityFilter;
      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;
      
      // Check if billboard is in current contract selection
      const isInContract = selected.includes(String(billboard.ID));
      
      // Status filter logic
      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'available') {
        matchesStatus = isAvailable || isInContract;
      } else if (statusFilter === 'nearExpiry') {
        matchesStatus = isNearExpiry || isInContract;
      } else if (statusFilter === 'rented') {
        matchesStatus = isBooked && !isNearExpiry;
      }
      
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
        .insert({ name })
        .select()
        .single();
      if (!error && newC) {
        setCustomerId(newC.id);
        setCustomerName(name);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
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
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
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
    interval: 'month' | '2months' | '3months' | '4months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
  }) => {
    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate } = config;
    
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment > finalTotal) {
      toast.warning('الدفعة الأولى أكبر من الإجمالي');
      return;
    }

    if (actualFirstPayment < 0) {
      toast.warning('قيمة الدفعة الأولى لا يمكن أن تكون سالبة');
      return;
    }

    const monthsMap = { month: 1, '2months': 2, '3months': 3, '4months': 4 };
    const intervalMonths = monthsMap[interval];
    const intervalLabel = interval === 'month' ? 'شهري' : interval === '2months' ? 'شهرين' : interval === '3months' ? 'ثلاثة أشهر' : '4 أشهر';
    
    const newInstallments: Array<{amount: number; paymentType: string; description: string; dueDate: string}> = [];
    const firstDate = firstPaymentDate || startDate || new Date().toISOString().split('T')[0];
    
    // ✅ FIX: إذا كانت الدفعة الأولى صفر، نبدأ مباشرة بالدفعات المتكررة
    const hasFirstPayment = actualFirstPayment > 0;
    
    if (hasFirstPayment) {
      newInstallments.push({
        amount: actualFirstPayment,
        paymentType: 'عند التوقيع',
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
      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        // ✅ CORRECTED: Total should store the base total (rental without installation and print)
        'Total': finalTotal,
        // ✅ CORRECTED: Total Rent should store rental cost only (after subtracting installation and print)
        'Total Rent': rentalCostOnly,
        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        billboard_ids: selected, // Pass as array, updateContract will handle conversion
        // ✅ NEW: Store billboard prices for historical reference
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => ({
          billboardId: b.id,
          contractPrice: b.contractPrice,
          printCost: b.printCost,
          pricingCategory: b.pricingCategory,
          pricingMode: b.pricingMode,
          duration: b.duration
        }))),
        // ✅ FIXED: Store installation_cost in correct field name
        'installation_cost': installationEnabled ? applyExchangeRate(installationCost) : 0,
        installation_enabled: installationEnabled,
        // ✅ NEW: Store print cost data
        print_cost: applyExchangeRate(printCostTotal),
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        // ✅ NEW: Store currency settings
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        // ✅ NEW: Store operating fee rate and calculated fee based on Total Rent
        fee: operatingFee, // This is calculated as rentalCostOnly * operatingFeeRate
        operating_fee_rate: operatingFeeRate, // Store the percentage rate
        // ✅ NEW: Store design data
        design_data: JSON.stringify(billboardDesigns),
        // ✅ CRITICAL FIX: Use exact same field name as ContractCreate
        installments_data: installments, // Pass as array, updateContract will stringify it
      };
      
      // Also save individual payments for backward compatibility
      if (installments.length > 0) updates['Payment 1'] = installments[0]?.amount || 0;
      if (installments.length > 1) updates['Payment 2'] = installments[1]?.amount || 0;
      if (installments.length > 2) updates['Payment 3'] = installments[2]?.amount || 0;
      
      updates['Total Paid'] = currentContract?.['Total Paid'] || 0;
      updates['Remaining'] = finalTotal - (currentContract?.['Total Paid'] || 0);
      if (customerId) updates.customer_id = customerId;
      
      console.log('✅ ContractEdit saving with currency:', contractCurrency, 'rate:', exchangeRate);
      console.log('- Print cost enabled:', printCostEnabled);
      console.log('- Print price per meter:', printPricePerMeter);
      console.log('- Print cost total:', applyExchangeRate(printCostTotal));
      console.log('- Total (with currency conversion):', finalTotal);
      console.log('- Total Rent (rental - installation - print):', rentalCostOnly);
      console.log('- Operating fee rate:', operatingFeeRate, '%');
      console.log('- Operating fee (Total Rent * rate):', operatingFee);
      console.log('- installation_cost (converted):', applyExchangeRate(installationCost));
      
      await updateContract(contractNumber, updates);

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
    <div className="min-h-screen bg-background text-foreground p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <ContractEditHeader
          contractNumber={contractNumber}
          onBack={() => navigate('/admin/contracts')}
          onPrint={handlePrintContract}
          onSave={save}
          saving={saving}
        />

        <div className="flex flex-col lg:flex-row gap-6">
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
            />

            {/* الخريطة التفاعلية للوحات المرتبطة */}
            {selected.length > 0 && (
              <Card className="bg-card border-border shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <MapIcon className="h-5 w-5 text-primary" />
                    خريطة اللوحات المرتبطة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BillboardManagementMap
                    billboards={billboards.filter((b) => selected.includes(String((b as any).ID)))}
                    onBillboardClick={(billboard) => {
                      toast.info(`تم النقر على: ${billboard.Billboard_Name}`);
                    }}
                  />
                </CardContent>
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
              </TabsContent>
              
              <TabsContent value="map">
                <BillboardSelectionMap
                  billboards={filtered}
                  selectedIds={selected}
                  onToggleSelect={(billboard) => {
                    toggleSelect(billboard);
                  }}
                  onSelectAll={() => {
                    const availableIds = filtered.map(b => String((b as any).ID));
                    setSelected(availableIds);
                    toast.success(`تم تحديد ${availableIds.length} لوحة`);
                  }}
                  onClearAll={() => {
                    setSelected([]);
                    toast.info('تم إلغاء تحديد جميع اللوحات');
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - القائمة الجانبية */}
          <div className="w-full lg:w-[400px] space-y-4">
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
            />

            {/* ✅ إعدادات العملة */}
            <Card className="bg-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <DollarSign className="h-5 w-5 text-primary" />
                  إعدادات العملة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">عملة العقد</label>
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
                  <label className="text-sm font-medium block mb-2">سعر الصرف (1 د.ل = ؟ {contractCurrency})</label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded bg-input border border-border text-card-foreground"
                    placeholder="1"
                    min="0"
                    step="0.01"
                  />
                </div>
              </CardContent>
            </Card>

            {/* ✅ إعدادات الأسعار */}
            <Card className="bg-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-card-foreground">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    إعدادات الأسعار
                  </div>
                  <Button
                    variant={useStoredPrices ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseStoredPrices(!useStoredPrices)}
                  >
                    {useStoredPrices ? 'أسعار حالية' : 'أسعار مخزنة'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {useStoredPrices ? (
                    <span className="text-amber-600">📦 يتم استخدام الأسعار المخزنة</span>
                  ) : (
                    <span className="text-green-600">✅ يتم حساب الأسعار من جدول التسعير الحالي</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ✅ ملخص تكلفة التركيب */}
            {installationCostSummary && (
              <Card className="bg-card border-border shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-card-foreground">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-accent" />
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
                <CardContent className="space-y-3">
                  {installationEnabled && (
                    <>
                      <div className="text-lg font-bold text-accent">
                        {applyExchangeRate(installationCostSummary.totalInstallationCost).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {installationCostSummary.groupedSizes.map((sizeInfo: any, index: number) => (
                          <div key={index} className="flex justify-between">
                            <span>{sizeInfo.size}: {sizeInfo.count} لوحة</span>
                            <span className="font-medium">{applyExchangeRate(sizeInfo.totalForSize).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!installationEnabled && (
                    <div className="text-sm text-muted-foreground">
                      العقد بدون تكلفة تركيب
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ✅ تكلفة الطباعة */}
            <Card className="bg-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-card-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    تكلفة الطباعة
                  </div>
                  <Switch
                    checked={printCostEnabled}
                    onCheckedChange={setPrintCostEnabled}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {printCostEnabled ? (
                  <>
                    <div>
                      <label className="text-sm font-medium block mb-2">سعر المتر</label>
                      <input
                        type="number"
                        value={printPricePerMeter}
                        onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded bg-input border border-border"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="text-lg font-bold text-primary">
                      الإجمالي: {applyExchangeRate(printCostTotal).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    العقد بدون تكلفة طباعة
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ✅ رسوم التشغيل */}
            <Card className="bg-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <Settings className="h-5 w-5 text-primary" />
                  رسوم التشغيل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-2">النسبة (%)</label>
                  <input
                    type="number"
                    value={operatingFeeRate}
                    onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                    className="w-full px-3 py-2 rounded bg-input border border-border"
                    placeholder="3"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div className="text-lg font-bold text-primary">
                  {operatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {rentalCostOnly.toLocaleString()} × {operatingFeeRate}%
                </div>
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
            />

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
              operatingFee={operatingFee}
              currentContract={currentContract}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/contracts')}
              saving={saving}
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
