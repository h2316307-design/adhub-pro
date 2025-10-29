import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractPricing } from '@/hooks/useContractPricing';
import { ContractPDFDialog } from '@/components/Contract';
import { Card, CardContent } from '@/components/ui/card';
import type { Billboard } from '@/types';

// Import modular components
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { InstallationCostSummary } from '@/components/contracts/InstallationCostSummary';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';

export default function ContractEditModular() {
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

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [adType, setAdType] = useState('');

  // ✅ UNIFIED: Use unified pricing hook
  const pricing = useContractPricing();
  
  // Pricing and categories
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');

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

  // ✅ REMOVED: Now using unified pricing hook

  // Load contract data
  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        setCurrentContract(c);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        
        const savedPricingCategory = c.customer_category || c['customer_category'] || 'عادي';
        setPricingCategory(savedPricingCategory);
        
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

        const existingFee = Number(c.fee || 0);
        if (existingFee > 0) {
          setOperatingFee(existingFee);
        }

        // ✅ Load installation enabled from contract (default true if not set)
        const savedInstallationEnabled = c.installation_enabled !== false && c.installation_enabled !== 0 && c.installation_enabled !== "false";
        setInstallationEnabled(savedInstallationEnabled);
        console.log('✅ MODULAR: Loading installation enabled:', savedInstallationEnabled);

        setSelected((c.billboards || []).map((b: any) => String(b.ID)));
        
        if (c.installments_data && Array.isArray(c.installments_data)) {
          setInstallments(c.installments_data);
        } else {
          // Calculate due date helper
          const calcDueDate = (type: string, index: number, start: string) => {
            const date = new Date(start);
            if (type === 'شهري') {
              date.setMonth(date.getMonth() + index);
            }
            return date.toISOString().split('T')[0];
          };

          const payments = [];
          if (c['Payment 1']) payments.push({ 
            amount: c['Payment 1'], 
            paymentType: 'شهري', 
            description: 'الدفعة الأولى',
            dueDate: calcDueDate('شهري', 0, s)
          });
          if (c['Payment 2']) payments.push({ 
            amount: c['Payment 2'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثانية',
            dueDate: calcDueDate('شهري', 1, s)
          });
          if (c['Payment 3']) payments.push({ 
            amount: c['Payment 3'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثالثة',
            dueDate: calcDueDate('شهري', 2, s)
          });
          setInstallments(payments);
        }
        
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  // Calculate installation cost when selected billboards change
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation cost:', e);
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

  // ✅ REMOVED: Now using unified pricing hook - pricing.getPriceFromDatabase & pricing.getDailyPriceFromDatabase

  // ✅ UNIFIED: Calculate billboard price using unified pricing hook
  const calculateBillboardPrice = (billboard: Billboard): number => {
    return pricing.calculateBillboardPrice(
      billboard,
      pricingMode,
      durationMonths,
      durationDays,
      pricingCategory
    );
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

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).size || (b as any).Size))).filter(Boolean) as string[], [billboards]);

  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        // ✅ FIXED: Get sizeId for accurate price lookup
        const sizeId = (b as any).size_id || (b as any).Size_ID || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // ✅ FIXED: Use sizeId instead of size name
        let price = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, months);
        if (price === null) {
          price = getPriceFor(size, level, pricingCategory as CustomerType, months);
        }
        if (price !== null) return acc + price;
        
        const monthly = Number((b as any).price) || 0;
        return acc + monthly * months;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        // ✅ FIXED: Get sizeId for accurate price lookup
        const sizeId = (b as any).size_id || (b as any).Size_ID || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // ✅ FIXED: Use sizeId instead of size name
        let daily = pricing.getDailyPriceFromDatabase(sizeId, level, pricingCategory);
        if (daily === null) {
          daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
        }
        if (daily === null) {
          // ✅ FIXED: Use sizeId instead of size name
          let monthlyPrice = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, 1);
          if (monthlyPrice === null) {
            monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
          }
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        
        return acc + (daily || 0) * days;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricing.pricingData]);

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

  const finalTotal = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);
  const actualInstallationCost = useMemo(() => installationEnabled ? installationCost : 0, [installationEnabled, installationCost]);
  const rentalCostOnly = useMemo(() => Math.max(0, finalTotal - actualInstallationCost), [finalTotal, actualInstallationCost]);

  useEffect(() => {
    // ✅ FIXED: Calculate operating fee from totalAfterDiscount when installation is disabled
    const baseForFee = !installationEnabled ? finalTotal : rentalCostOnly;
    const fee = Math.round(baseForFee * 0.03 * 100) / 100;
    setOperatingFee(fee);
    console.log(`✅ MODULAR: Operating fee calculated: installationEnabled=${installationEnabled}, baseForFee=${baseForFee}, fee=${fee}`);
  }, [installationEnabled, finalTotal, rentalCostOnly]);

  useEffect(() => {
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { 
          amount: half, 
          paymentType: 'عند التوقيع', 
          description: 'الدفعة الأولى',
          dueDate: calculateDueDate('عند ال��وقيع', 0)
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

  // Filter billboards
  const filtered = useMemo(() => {
    const today = new Date();
    const NEAR_DAYS = 30;

    const isNearExpiring = (b: any) => {
      const raw = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || b['End Date'];
      if (!raw) return false;
      const end = new Date(raw);
      if (isNaN(end.getTime())) return false;
      const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      return diff > 0 && diff <= NEAR_DAYS;
    };

    const list = billboards.filter((b: any) => {
      const text = b.name || b.Billboard_Name || '';
      const loc = b.location || b.Nearest_Landmark || '';
      const c = String(b.city || b.City || '');
      const s = String(b.size || b.Size || '');
      const st = String(b.status || b.Status || '').toLowerCase();

      const matchesQ = !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase()) || loc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesSize = sizeFilter === 'all' || s === sizeFilter;

      const hasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const isAvailable = st === 'available' || (!hasContract && st !== 'rented');
      const isNear = isNearExpiring(b);
      const isRented = hasContract || st === 'rented';
      const isInContract = selected.includes(String(b.ID));
      
      let shouldShow = false;
      if (statusFilter === 'all') {
        shouldShow = true;
      } else if (statusFilter === 'available') {
        shouldShow = (isAvailable && !isRented) || isInContract;
      } else if (statusFilter === 'rented') {
        shouldShow = isRented && !isNear;
      }

      return matchesQ && matchesCity && matchesSize && shouldShow;
    });

    return list.sort((a: any, b: any) => {
      const aHasContract = !!(a.contractNumber || a.Contract_Number || a.contract_number);
      const bHasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const aStatus = (a.status || a.Status || '').toLowerCase();
      const bStatus = (b.status || b.Status || '').toLowerCase();
      
      const aAvailable = aStatus === 'available' || (!aHasContract && aStatus !== 'rented');
      const bAvailable = bStatus === 'available' || (!bHasContract && bStatus !== 'rented');
      
      const aNear = isNearExpiring(a);
      const bNear = isNearExpiring(b);
      
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;
      
      return 0;
    }).slice(0, 20);
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter, selected]);

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

  const distributeWithInterval = (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months';
    lastPaymentDate: string;
  }) => {
    if (!startDate || finalTotal <= 0) {
      toast.error('يرجى تحديد تاريخ بداية العقد');
      return;
    }

    const { firstPayment, interval, lastPaymentDate } = config;

    if (firstPayment < 0 || firstPayment > finalTotal) {
      toast.error('قيمة الدفعة الأولى غير صحيحة');
      return;
    }

    const remaining = finalTotal - firstPayment;

    const intervalMonths = {
      'month': 1,
      '2months': 2,
      '3months': 3,
      '4months': 4
    }[interval];

    const intervalLabel = {
      'month': 'شهري',
      '2months': 'كل شهرين',
      '3months': 'كل 3 أشهر',
      '4months': 'كل 4 أشهر'
    }[interval];

    const newInstallments: Array<{
      amount: number;
      paymentType: string;
      description: string;
      dueDate: string;
    }> = [];

    newInstallments.push({
      amount: Math.round(firstPayment * 100) / 100,
      paymentType: 'عند التوقيع',
      description: 'الدفعة الأولى',
      dueDate: startDate
    });

    if (remaining > 0) {
      const start = new Date(startDate);
      let calculatedEndDate: Date;

      if (lastPaymentDate) {
        calculatedEndDate = new Date(lastPaymentDate);
      } else {
        calculatedEndDate = new Date(endDate || startDate);
      }

      const monthsDiff = Math.max(intervalMonths, Math.round(
        (calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)
      ));

      const numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      const recurringPayment = Math.round((remaining / numberOfPayments) * 100) / 100;
      const lastPayment = Math.round((remaining - (recurringPayment * (numberOfPayments - 1))) * 100) / 100;

      for (let i = 0; i < numberOfPayments; i++) {
        const paymentDate = new Date(start);
        paymentDate.setMonth(paymentDate.getMonth() + ((i + 1) * intervalMonths));

        newInstallments.push({
          amount: i === numberOfPayments - 1 ? lastPayment : recurringPayment,
          paymentType: intervalLabel,
          description: `الدفعة ${i + 2}`,
          dueDate: paymentDate.toISOString().split('T')[0]
        });
      }
    }

    setInstallments(newInstallments);

    const summary = generateInstallmentSummary(newInstallments);
    toast.success(summary);
  };

  const generateInstallmentSummary = (installmentList: typeof installments): string => {
    if (installmentList.length === 0) return '';

    if (installmentList.length === 1) {
      return `دفعة واحدة: ${installmentList[0].amount.toLocaleString('ar-LY')} د.ل بتاريخ ${installmentList[0].dueDate}`;
    }

    const first = installmentList[0];
    const recurring = installmentList.slice(1);

    if (recurring.length === 0) {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}`;
    }

    const recurringAmount = recurring[0].amount;
    const allSameAmount = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);
    const lastDate = recurring[recurring.length - 1].dueDate;
    const intervalType = recurring[0].paymentType;

    if (allSameAmount) {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها يتم السداد ${intervalType} بمقدار ${recurringAmount.toLocaleString('ar-LY')} د.ل حتى ${lastDate}\n(عدد الدفعات: ${recurring.length})`;
    } else {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها ${recurring.length} دفعات ${intervalType} بمبالغ متفاوتة حتى ${lastDate}`;
    }
  };

  const installmentSummary = React.useMemo(() => {
    return generateInstallmentSummary(installments);
  }, [installments]);

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
          image: (b as any).image || ''
        }));

      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        'Total Rent': finalTotal,
        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        installation_cost: installationEnabled ? installationCost : 0,
        installation_enabled: installationEnabled,
        fee: operatingFee,
        installments_data: JSON.stringify(installments),
      };
      
      if (installments.length > 0) updates['Payment 1'] = installments[0]?.amount || 0;
      if (installments.length > 1) updates['Payment 2'] = installments[1]?.amount || 0;
      if (installments.length > 2) updates['Payment 3'] = installments[2]?.amount || 0;
      
      updates['Total Paid'] = currentContract?.['Total Paid'] || 0;
      updates['Remaining'] = finalTotal - (currentContract?.['Total Paid'] || 0);
      if (customerId) updates.customer_id = customerId;
      
      await updateContract(contractNumber, updates);

      toast.success('تم حفظ التعديلات مع نظام الدفعات الديناميكي بنجاح');
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
            <SelectedBillboardsCard
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={installationDetails}
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              sizeNames={pricing.sizeNames}
            />


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
            />

            <AvailableBillboardsGrid
              billboards={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
              loading={loading}
            />
          </div>

          {/* Sidebar - Using the simplified sidebar component */}
          <div className="w-full lg:w-[360px] space-y-4">
            <div className="space-y-4">
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

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-card-foreground">تفعيل التركيب</h3>
                      <p className="text-sm text-muted-foreground">
                        {installationEnabled ? 'نسبة التشغيل محسوبة من صافي الإيجار' : 'نسبة التشغيل محسوبة من الإجمالي الكلي'}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={installationEnabled}
                        onChange={(e) => setInstallationEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-border"
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>

              {operatingFee > 0 && (
                <InstallationCostSummary
                  installationCost={installationEnabled ? installationCost : 0}
                  installationDetails={installationDetails}
                  operatingFee={operatingFee}
                  operatingFeeRate={3}
                  setOperatingFeeRate={() => {}}
                  rentalCostOnly={rentalCostOnly}
                  totalAfterDiscount={finalTotal}
                />
              )}

              <InstallmentsManager
                installments={installments}
                finalTotal={finalTotal}
                startDate={startDate}
                onDistributeEvenly={distributeEvenly}
                onDistributeWithInterval={distributeWithInterval}
                onAddInstallment={addInstallment}
                onRemoveInstallment={removeInstallment}
                onUpdateInstallment={updateInstallment}
                onClearAll={clearAllInstallments}
                installmentSummary={installmentSummary}
              />

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
                installationCost={installationCost}
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
