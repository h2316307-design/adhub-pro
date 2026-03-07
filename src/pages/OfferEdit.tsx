// @ts-nocheck
import { isBillboardAvailable } from '@/utils/contractUtils';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractPricing } from '@/hooks/useContractPricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Billboard } from '@/types';
import { ArrowLeft, Save, Map as MapIcon, Wrench, FileText, List, DollarSign, Printer } from 'lucide-react';

// Import modular components (shared with contract edit)
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { PrintCostSummary } from '@/components/contracts/edit/PrintCostSummary';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { ContractPDFDialog } from '@/components/Contract';

export default function OfferEdit() {
  const navigate = useNavigate();
  const { id: offerId } = useParams();
  const isEditing = Boolean(offerId);

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [singleFaceBillboards, setSingleFaceBillboards] = useState<Set<string>>(new Set());
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfContractData, setPdfContractData] = useState<any>(null);

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string; company?: string; phone?: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [adType, setAdType] = useState('');

  // Pricing
  const pricing = useContractPricing();
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string; billboardName: string; size: string;
    installationPrice: number; faces?: number; adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);

  // Filters - default to 'all' to show all billboards
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [sizeFilters, setSizeFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dates & pricing
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [savedBaseRent, setSavedBaseRent] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Installments
  const [installments, setInstallments] = useState<Array<{
    amount: number; paymentType: string; description: string; dueDate: string;
  }>>([]);

  // Friend company costs
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string; friendCompanyId: string; friendCompanyName: string; friendRentalCost: number;
  }>>([]);

  // Print cost
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [customPrintCosts, setCustomPrintCosts] = useState<Map<string, number>>(new Map());

  // Include in price toggles
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(true);
  const [includePrintInPrice, setIncludePrintInPrice] = useState<boolean>(false);

  // ========== LOAD DATA ==========

  // Load billboards - ALL billboards, no availability filter
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
        const { data, error } = await supabase.from('customers').select('id,name,company,phone').order('name', { ascending: true });
        if (!error && Array.isArray(data)) setCustomers(data);
      } catch (e) { console.warn('load customers failed'); }
    })();
  }, []);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('pricing_categories').select('name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          setPricingCategories(Array.from(new Set([...staticCategories, ...categories])));
        } else {
          setPricingCategories(['عادي', 'مسوق', 'شركات']);
        }
      } catch (e) {
        setPricingCategories(['عادي', 'مسوق', 'شركات']);
      }
    })();
  }, []);

  // Load offer data when editing
  useEffect(() => {
    if (!offerId) return;
    (async () => {
      try {
        const { data: offer, error } = await supabase
          .from('offers')
          .select('*')
          .eq('id', offerId)
          .single();
        if (error) throw error;
        if (!offer) return;

        setCurrentOffer(offer);
        setCustomerName(offer.customer_name || '');
        setCustomerId(offer.customer_id || null);
        setAdType(offer.ad_type || '');
        setPricingCategory(offer.pricing_category || 'عادي');

        const s = offer.start_date || '';
        const e = offer.end_date || '';
        setStartDate(s);
        setEndDate(e);

        if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffDays = Math.ceil(Math.abs(ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
            const diffMonths = Math.round(diffDays / 30);
            if (diffMonths >= 1) { setPricingMode('months'); setDurationMonths(diffMonths); }
            else { setPricingMode('days'); setDurationDays(diffDays); }
          }
        }

        // Total/discount
        const savedTotal = Number(offer.total || 0);
        setRentCost(savedTotal);
        setOriginalTotal(savedTotal);

        const disc = Number(offer.discount ?? 0);
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }

        // Installation
        setInstallationEnabled(offer.installation_enabled !== false);
        setInstallationCost(Number(offer.installation_cost || 0));
        setIncludeInstallationInPrice(offer.include_installation_in_price !== false);

        // Print
        setPrintCostEnabled(Boolean(offer.print_cost_enabled));
        setPrintPricePerMeter(Number(offer.print_price_per_meter || 0));
        setIncludePrintInPrice(Boolean(offer.include_print_in_billboard_price));

        // Operating
        setOperatingFee(Number(offer.operating_fee || 0));

        // Selected billboards
        if (offer.billboards_data) {
          try {
            const bbs = typeof offer.billboards_data === 'string' ? JSON.parse(offer.billboards_data) : offer.billboards_data;
            if (Array.isArray(bbs)) setSelected(bbs.map((b: any) => String(b.id || b.ID)));
          } catch (e) { console.warn('Failed to parse billboards_data'); }
        }

        // Installments
        if (offer.installments_data) {
          try {
            const inst = typeof offer.installments_data === 'string' ? JSON.parse(offer.installments_data) : offer.installments_data;
            if (Array.isArray(inst)) setInstallments(inst);
          } catch (e) { console.warn('Failed to parse installments_data'); }
        }

        // Single face billboards
        if (offer.single_face_billboards) {
          try {
            const ids = typeof offer.single_face_billboards === 'string' ? JSON.parse(offer.single_face_billboards) : offer.single_face_billboards;
            if (Array.isArray(ids)) setSingleFaceBillboards(new Set(ids.map(String)));
          } catch (e) { console.warn('Failed to parse single_face_billboards'); }
        }

        // Installation details
        if (offer.installation_details) {
          try {
            const details = typeof offer.installation_details === 'string' ? JSON.parse(offer.installation_details) : offer.installation_details;
            if (Array.isArray(details)) setInstallationDetails(details);
          } catch (e) { console.warn('Failed to parse installation_details'); }
        }

      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العرض');
      }
    })();
  }, [offerId]);

  // ========== CALCULATIONS ==========

  // Calculate installation cost
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
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
      end.setDate(end.getDate() + Math.max(0, Number(durationMonths || 0)) * 30);
    } else {
      end.setDate(end.getDate() + Math.max(0, Number(durationDays || 0)));
    }
    setEndDate(end.toISOString().split('T')[0]);
  }, [startDate, durationMonths, durationDays, pricingMode]);

  // Calculate billboard price
  const calculateBillboardPrice = (billboard: Billboard): number => {
    return pricing.calculateBillboardPrice(billboard, pricingMode, durationMonths, durationDays, pricingCategory);
  };

  // Estimated total
  const calculatedEstimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        const sizeId = (b as any).size_id || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        let price = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, months);
        if (price === null) price = getPriceFor(size, level, pricingCategory as CustomerType, months);
        if (price !== null) return acc + price;
        return acc + (Number((b as any).price) || 0) * months;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        const sizeId = (b as any).size_id || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        let daily = pricing.getDailyPriceFromDatabase(sizeId, level, pricingCategory);
        if (daily === null) daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
        if (daily === null) {
          let monthlyPrice = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, 1);
          if (monthlyPrice === null) monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        return acc + (daily || 0) * days;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricing.pricingData]);

  const estimatedTotal = useMemo(() => {
    if (savedBaseRent !== null && savedBaseRent > 0) return savedBaseRent;
    return calculatedEstimatedTotal;
  }, [savedBaseRent, calculatedEstimatedTotal]);

  const baseTotal = useMemo(() => {
    if (userEditedRentCost && rentCost > 0) return rentCost;
    return estimatedTotal;
  }, [rentCost, estimatedTotal, userEditedRentCost]);

  useEffect(() => {
    if (!userEditedRentCost && estimatedTotal > 0) setRentCost(estimatedTotal);
  }, [estimatedTotal, userEditedRentCost]);

  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent'
      ? (baseTotal * Math.max(0, Math.min(100, discountValue)) / 100)
      : Math.max(0, discountValue);
  }, [discountType, discountValue, baseTotal]);

  // Print cost details
  const printCostDetails = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    const detailsMap = new Map();
    sel.forEach((b) => {
      const size = ((b as any).Size || (b as any).size || '') as string;
      const faces = Number((b as any).Faces_Count || 1);
      const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (!sizeMatch) return;
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const areaPerBoard = width * height * faces;
      const customUnitCost = customPrintCosts.get(size);
      const unitCost = customUnitCost || (areaPerBoard * printPricePerMeter);
      if (detailsMap.has(size)) {
        const existing = detailsMap.get(size)!;
        existing.quantity += 1;
        existing.totalArea += areaPerBoard;
        existing.totalCost += unitCost;
      } else {
        detailsMap.set(size, { size, quantity: 1, areaPerBoard, totalArea: areaPerBoard, unitCost, totalCost: unitCost });
      }
    });
    return Array.from(detailsMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, customPrintCosts]);

  const totalPrintCost = useMemo(() => printCostDetails.reduce((sum, d) => sum + d.totalCost, 0), [printCostDetails]);

  // ✅ Per-billboard print cost details for SelectedBillboardsCard
  const perBillboardPrintCosts = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    return sel.map((b) => {
      const size = ((b as any).Size || (b as any).size || '') as string;
      const faces = Number((b as any).Faces_Count || 1);
      const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (!sizeMatch) return { billboardId: String((b as any).ID), printCost: 0 };
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const areaPerBoard = width * height * faces;
      const customUnitCost = customPrintCosts.get(size);
      const printCost = customUnitCost || (areaPerBoard * printPricePerMeter);
      return { billboardId: String((b as any).ID), printCost };
    });
  }, [billboards, selected, printCostEnabled, printPricePerMeter, customPrintCosts]);

  const handleUpdatePrintUnitCost = (size: string, newCost: number) => {
    setCustomPrintCosts(prev => { const m = new Map(prev); m.set(size, newCost); return m; });
  };

  const finalTotal = useMemo(() => {
    const baseAfterDiscount = Math.max(0, baseTotal - discountAmount);
    return printCostEnabled ? baseAfterDiscount + totalPrintCost : baseAfterDiscount;
  }, [baseTotal, discountAmount, printCostEnabled, totalPrintCost]);

  const actualInstallationCost = useMemo(() => installationEnabled ? installationCost : 0, [installationEnabled, installationCost]);
  const rentalCostOnly = useMemo(() => Math.max(0, finalTotal - actualInstallationCost), [finalTotal, actualInstallationCost]);

  // Grouped installation cost summary like ContractEdit
  const installationCostSummary = useMemo(() => {
    if (selected.length === 0) return null;
    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + (detail.installationPrice || 0), 0);
    const groupedDetails = installationDetails.reduce((groups: any, detail) => {
      const key = `${detail.size}`;
      if (!groups[key]) {
        groups[key] = { size: detail.size, pricePerUnit: detail.installationPrice || 0, count: 0, totalForSize: 0 };
      }
      groups[key].count += 1;
      groups[key].totalForSize += (detail.installationPrice || 0);
      return groups;
    }, {});
    return { totalInstallationCost, groupedSizes: Object.values(groupedDetails) };
  }, [selected.length, installationDetails]);

  // Operating fee
  useEffect(() => {
    const baseForFee = !installationEnabled ? finalTotal : rentalCostOnly;
    const fee = Math.round(baseForFee * 0.03 * 100) / 100;
    setOperatingFee(fee);
  }, [installationEnabled, finalTotal, rentalCostOnly]);

  // Auto-create installments
  useEffect(() => {
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { amount: half, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate || '' },
        { amount: finalTotal - half, paymentType: 'شهري', description: 'الدفعة الثانية', dueDate: calculateDueDate('شهري', 1) },
      ]);
    }
  }, [finalTotal]);

  // ========== FILTER BILLBOARDS - SHOW ALL ==========

  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean).sort() as string[], [billboards]);
  const municipalities = useMemo(() => {
    const base = Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    // Filter municipalities by selected city
    if (cityFilter !== 'all') {
      const cityBillboards = billboards.filter(b => ((b as any).city || (b as any).City) === cityFilter);
      return Array.from(new Set(cityBillboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    }
    return base;
  }, [billboards, cityFilter]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => String((b as any).Size || (b as any).size || '').trim()))).filter(Boolean).sort() as string[], [billboards]);

  // Helper: check if billboard is near expiry
  const isNearExpiring = (b: any): boolean => {
    const endDate = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || '';
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    if (isNaN(end.getTime())) return false;
    const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    return diff > 0 && diff <= 30;
  };

  // Helper: check if billboard is rented (not available)
  const isBillboardRented = (b: any): boolean => {
    const st = String(b.Status || b.status || '').toLowerCase();
    return st === 'مؤجر' || st === 'محجوز' || st === 'rented';
  };

  // ✅ Enhanced search - matches billboard name, ID, location, municipality, city, customer, size
  const enhancedSearchMatch = (b: any, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const fields = [
      b.name, b.Billboard_Name, b.billboard_name,
      b.location, b.Nearest_Landmark, b.nearest_landmark,
      b.municipality, b.Municipality,
      b.city, b.City,
      b.Customer_Name, b.clientName, b.customer_name,
      b.Size, b.size,
      b.Ad_Type, b.adType,
      String(b.Contract_Number || b.contractNumber || ''),
      String(b.ID || b.id || ''),
    ];
    return fields.some(f => f && String(f).toLowerCase().includes(q));
  };

  // Show rented + near-expiry billboards for offers
  const filtered = useMemo(() => {
    return billboards.filter((b: any) => {
      const c = String(b.city || b.City || '');
      const m = String(b.municipality || b.Municipality || '');
      const s = String(b.size || b.Size || '').trim();
      const isHidden = b.is_visible_in_available === false;

      const matchesQ = enhancedSearchMatch(b, searchQuery);
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesMunicipality = municipalityFilter === 'all' || m === municipalityFilter;
      const matchesSize = sizeFilters.length > 0 ? sizeFilters.includes(s) : (sizeFilter === 'all' || s === sizeFilter);

      const isAvail = isBillboardAvailable(b);
      const isNear = isNearExpiring(b);
      const isInSelection = selected.includes(String(b.ID));

      let shouldShow = false;
      if (statusFilter === 'all') {
        shouldShow = !isHidden;
      } else if (statusFilter === 'available') {
        shouldShow = (isAvail || isNear) && !isHidden;
      } else if (statusFilter === 'nearExpiry') {
        shouldShow = isNear && !isHidden;
      } else if (statusFilter === 'rented') {
        shouldShow = !isAvail && !isNear && !isHidden;
      } else if (statusFilter === 'hidden') {
        shouldShow = isHidden;
      }

      if (isInSelection) shouldShow = true;

      return matchesQ && matchesCity && matchesMunicipality && matchesSize && shouldShow;
    }).sort((a: any, b: any) => {
      const aAvail = isBillboardAvailable(a);
      const bAvail = isBillboardAvailable(b);
      const aNear = isNearExpiring(a);
      const bNear = isNearExpiring(b);
      
      if (aAvail && !bAvail) return -1;
      if (!aAvail && bAvail) return 1;
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;
      
      const aEnd = a.Rent_End_Date || '';
      const bEnd = b.Rent_End_Date || '';
      return aEnd.localeCompare(bEnd);
    });
  }, [billboards, searchQuery, cityFilter, municipalityFilter, sizeFilter, sizeFilters, statusFilter, selected]);

  // ========== HANDLERS ==========

  const toggleSelect = (b: Billboard) => {
    const id = String((b as any).ID);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeSelected = (id: string) => {
    setSelected(prev => prev.filter(x => x !== id));
    setFriendBillboardCosts(prev => prev.filter(f => f.billboardId !== id));
    setSingleFaceBillboards(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleSingleFace = (billboardId: string) => {
    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      if (next.has(billboardId)) next.delete(billboardId);
      else next.add(billboardId);
      return next;
    });
  };

  const handleUpdateFriendCost = (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => {
    setFriendBillboardCosts(prev => {
      const existing = prev.find(f => f.billboardId === billboardId);
      if (existing) return prev.map(f => f.billboardId === billboardId ? { ...f, friendRentalCost: cost, friendCompanyId, friendCompanyName } : f);
      return [...prev, { billboardId, friendCompanyId, friendCompanyName, friendRentalCost: cost }];
    });
  };

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase.from('customers').insert({ name }).select().single();
      if (!error && newC) { setCustomerId(newC.id); setCustomerName(name); setCustomers(prev => [{ id: newC.id, name }, ...prev]); }
    } catch (e) { console.warn(e); }
    setCustomerOpen(false); setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string; company?: string; phone?: string }) => {
    setCustomerName(customer.name); setCustomerId(customer.id);
    setCustomerCompany(customer.company || null); setCustomerPhone(customer.phone || null);
    setCustomerOpen(false); setCustomerQuery('');
  };

  const handleRefreshPricesFromTable = () => {
    setSavedBaseRent(null);
    setUserEditedRentCost(false);
    toast.success('تم تحديث الأسعار من جدول الأسعار الحالي');
  };

  // ========== INSTALLMENT HELPERS ==========

  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    const date = new Date(baseDate);
    if (paymentType === 'عند التوقيع') return baseDate;
    else if (paymentType === 'شهري') date.setMonth(date.getMonth() + (index + 1));
    else if (paymentType === 'شهرين') date.setMonth(date.getMonth() + (index + 1) * 2);
    else if (paymentType === 'ثلاثة أشهر') date.setMonth(date.getMonth() + (index + 1) * 3);
    else if (paymentType === 'عند التركيب') date.setDate(date.getDate() + 7);
    else if (paymentType === 'نهاية العقد') return endDate || '';
    return date.toISOString().split('T')[0];
  };

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
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => {
    if (!startDate || finalTotal <= 0) { toast.error('يرجى تحديد تاريخ البداية'); return; }
    const { firstPayment, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;
    if (firstPayment < 0 || firstPayment > finalTotal) { toast.error('قيمة الدفعة الأولى غير صحيحة'); return; }
    
    const remaining = finalTotal - firstPayment;
    const intervalMonthsMap: Record<string, number> = { 'month': 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalLabelMap: Record<string, string> = { 'month': 'شهري', '2months': 'كل شهرين', '3months': 'كل 3 أشهر', '4months': 'كل 4 أشهر', '5months': 'كل 5 أشهر', '6months': 'كل 6 أشهر', '7months': 'كل 7 أشهر' };
    const intervalMonths = intervalMonthsMap[interval] || 1;
    const intervalLabel = intervalLabelMap[interval] || 'شهري';
    
    const newInstallments: typeof installments = [];
    
    // Add first payment if different
    if (firstPayment > 0) {
      newInstallments.push({
        amount: Math.round(firstPayment * 100) / 100,
        paymentType: firstAtSigning ? 'عند التوقيع' : 'مقدم',
        description: 'الدفعة الأولى',
        dueDate: firstPaymentDate || startDate
      });
    }
    
    if (remaining > 0) {
      const start = new Date(firstPaymentDate || startDate);
      let numberOfPayments: number;
      
      if (numPayments) {
        numberOfPayments = numPayments;
      } else if (lastPaymentDate) {
        const calculatedEndDate = new Date(lastPaymentDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      } else {
        const calculatedEndDate = new Date(endDate || startDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      }
      
      const recurringPayment = Math.round((remaining / numberOfPayments) * 100) / 100;
      const lastPaymentAmount = Math.round((remaining - (recurringPayment * (numberOfPayments - 1))) * 100) / 100;
      
      for (let i = 0; i < numberOfPayments; i++) {
        const paymentDate = new Date(start);
        paymentDate.setMonth(paymentDate.getMonth() + ((i + 1) * intervalMonths));
        newInstallments.push({
          amount: i === numberOfPayments - 1 ? lastPaymentAmount : recurringPayment,
          paymentType: intervalLabel,
          description: `الدفعة ${newInstallments.length + 1}`,
          dueDate: paymentDate.toISOString().split('T')[0]
        });
      }
    }
    
    // If no installments created (firstPayment=0, remaining=0), create single payment
    if (newInstallments.length === 0) {
      newInstallments.push({ amount: finalTotal, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate });
    }
    
    setInstallments(newInstallments);
    toast.success(`تم التوزيع: ${newInstallments.length} دفعات`);
  };

  const addInstallment = () => setInstallments([...installments, { amount: 0, paymentType: 'شهري', description: `الدفعة ${installments.length + 1}`, dueDate: calculateDueDate('شهري', installments.length) }]);
  const removeInstallment = (index: number) => setInstallments(installments.filter((_, i) => i !== index));
  const updateInstallment = (index: number, field: string, value: any) => setInstallments(prev => prev.map((inst, i) => i === index ? { ...inst, [field]: value, ...(field === 'paymentType' ? { dueDate: calculateDueDate(value, i) } : {}) } : inst));
  const clearAllInstallments = () => setInstallments([]);

  const installmentSummary = React.useMemo(() => {
    if (installments.length === 0) return '';
    if (installments.length === 1) return `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل`;
    const first = installments[0];
    const recurring = installments.slice(1);
    return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل - ${recurring.length} دفعات أخرى`;
  }, [installments]);

  // ========== SAVE ==========

  const save = async () => {
    try {
      if (!customerName || selected.length === 0) { toast.error('يرجى تعبئة البيانات المطلوبة واختيار لوحات'); return; }
      setSaving(true);

      const selectedBillboardsData = billboards
        .filter(b => selected.includes(String((b as any).ID)))
        .map(b => ({
          id: String((b as any).ID), ID: (b as any).ID,
          name: (b as any).name || (b as any).Billboard_Name || '',
          Billboard_Name: (b as any).Billboard_Name || '',
          size: (b as any).size || (b as any).Size || '',
          Size: (b as any).Size || '',
          level: (b as any).level || (b as any).Level || '',
          Level: (b as any).Level || '',
          city: (b as any).city || (b as any).City || '',
          City: (b as any).City || '',
          Municipality: (b as any).Municipality || '',
          District: (b as any).District || '',
          Nearest_Landmark: (b as any).Nearest_Landmark || '',
          Image_URL: (b as any).Image_URL || '',
          Faces_Count: (b as any).Faces_Count || 1,
          GPS_Coordinates: (b as any).GPS_Coordinates || '',
          price: calculateBillboardPrice(b),
          Price: calculateBillboardPrice(b),
        }));

      const billboardPrices = selectedBillboardsData.map(b => {
        const billboardPrice = calculateBillboardPrice({ ID: b.id } as any);
        const billboardInstallCost = installationEnabled ? (installationDetails.find(d => d.billboardId === b.id)?.installationPrice || 0) : 0;
        const netRentalBeforeDiscount = billboardPrice - billboardInstallCost;
        const totalNetRental = estimatedTotal - (installationEnabled ? installationCost : 0);
        const discountPerBillboard = totalNetRental > 0 ? discountAmount * (netRentalBeforeDiscount / totalNetRental) : 0;
        const netRentalAfterDiscount = Math.max(0, netRentalBeforeDiscount - discountPerBillboard);
        return { billboardId: b.id, baseRental: billboardPrice, installationCost: billboardInstallCost, netRentalBeforeDiscount, discountPerBillboard, netRentalAfterDiscount, priceBeforeDiscount: billboardPrice, priceAfterDiscount: netRentalAfterDiscount + billboardInstallCost };
      });

      const offerData: any = {
        customer_name: customerName,
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate,
        duration_months: durationMonths,
        total: finalTotal,
        discount: discountAmount,
        discount_type: discountType === 'percent' ? 'percentage' : 'fixed',
        discount_percentage: discountType === 'percent' ? discountValue : 0,
        status: currentOffer?.status || 'pending',
        billboards_count: selected.length,
        billboards_data: JSON.stringify(selectedBillboardsData),
        notes: '',
        pricing_category: pricingCategory,
        ad_type: adType,
        installation_cost: installationEnabled ? installationCost : 0,
        installation_enabled: installationEnabled,
        print_cost: printCostEnabled ? totalPrintCost : 0,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printCostEnabled ? printPricePerMeter : 0,
        installments_data: installments.length > 0 ? JSON.stringify(installments) : null,
        billboard_prices: JSON.stringify(billboardPrices),
        operating_fee: operatingFee,
        operating_fee_rate: 3,
        include_print_in_billboard_price: includePrintInPrice,
        include_installation_in_price: includeInstallationInPrice,
        installation_details: installationDetails.length > 0 ? JSON.stringify(installationDetails) : null,
        single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
      };

      if (isEditing) {
        const { error } = await supabase.from('offers').update(offerData).eq('id', offerId);
        if (error) throw error;
        toast.success('تم تحديث العرض بنجاح');
      } else {
        const { error } = await supabase.from('offers').insert([offerData]);
        if (error) throw error;
        toast.success('تم إنشاء العرض بنجاح');
      }

      navigate('/admin/offers');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ العرض');
    } finally {
      setSaving(false);
    }
  };

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground p-4 md:p-6" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header - مثل ContractEditHeader */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              {isEditing ? `تعديل عرض #${currentOffer?.offer_number || ''}` : 'إنشاء عرض سعر جديد'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'تعديل عرض سعر موجود مع نظام دفعات ديناميكي' : 'إنشاء عرض سعر جديد - يمكنك إضافة جميع اللوحات'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/offers')}
              className="border-border hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              عودة
            </Button>
            {isEditing && currentOffer && (
              <Button 
                variant="outline"
                onClick={() => {
                  // ✅ Map offer data to contract-compatible fields for ContractPDFDialog
                  const selectedBBs = billboards.filter(b => selected.includes(String((b as any).ID)));
                  const mappedContract = {
                    id: currentOffer.offer_number || 0,
                    offer_number: currentOffer.offer_number || 0,
                    Contract_Number: currentOffer.offer_number || 0,
                    is_offer: true,
                    customer_name: customerName,
                    'Customer Name': customerName,
                    customer_id: customerId,
                    'Ad Type': adType || 'عرض سعر',
                    start_date: startDate,
                    'Contract Date': startDate,
                    end_date: endDate,
                    'End Date': endDate,
                    Total: finalTotal,
                    'Total Rent': finalTotal,
                    Discount: discountAmount,
                    installation_cost: installationEnabled ? installationCost : 0,
                    installation_enabled: installationEnabled,
                    include_installation_in_price: includeInstallationInPrice,
                    include_print_in_billboard_price: includePrintInPrice,
                    print_cost_enabled: printCostEnabled,
                    print_cost: printCostEnabled ? totalPrintCost : 0,
                    print_price_per_meter: printPricePerMeter,
                    billboard_ids: selected.join(','),
                    installments_data: JSON.stringify(installments),
                    customer_category: pricingCategory,
                    contract_currency: currentOffer.currency || 'LYD',
                    exchange_rate: String(currentOffer.exchange_rate || 1),
                    operating_fee_rate: 3,
                    single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
                    level_discounts: currentOffer.level_discounts || null,
                    billboard_prices: JSON.stringify(selectedBBs.map((b: any) => {
                      const billboardPrice = calculateBillboardPrice(b);
                      const billboardInstallCost = installationEnabled ? (installationDetails.find(d => d.billboardId === String(b.ID))?.installationPrice || 0) : 0;
                      const netRentalBeforeDiscount = billboardPrice - billboardInstallCost;
                      const totalNetRental = estimatedTotal - (installationEnabled ? installationCost : 0);
                      const discountPerBillboard = totalNetRental > 0 ? discountAmount * (netRentalBeforeDiscount / totalNetRental) : 0;
                      const netRentalAfterDiscount = Math.max(0, netRentalBeforeDiscount - discountPerBillboard);
                      return {
                        billboardId: b.ID,
                        finalPrice: netRentalAfterDiscount + billboardInstallCost,
                        baseRental: billboardPrice,
                        installationCost: billboardInstallCost,
                        netRentalBeforeDiscount,
                        discountPerBillboard,
                        netRentalAfterDiscount,
                        priceBeforeDiscount: billboardPrice,
                        priceAfterDiscount: netRentalAfterDiscount + billboardInstallCost,
                      };
                    })),
                    billboards_data: currentOffer.billboards_data,
                  };
                  setPdfContractData(mappedContract);
                  setPdfOpen(true);
                }}
                className="border-border hover:bg-accent"
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة العرض
              </Button>
            )}
            <Button 
              onClick={save} 
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-4 w-4 ml-2" />
              {saving ? 'جاري الحفظ...' : 'حفظ العرض'}
            </Button>
          </div>
        </div>

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
              sizeNames={pricing.sizeNames}
              totalDiscount={discountAmount}
              discountType={discountType}
              discountValue={discountValue}
              friendBillboardCosts={friendBillboardCosts}
              onUpdateFriendCost={handleUpdateFriendCost}
              customerCategory={pricingCategory}
              singleFaceBillboards={singleFaceBillboards}
              onToggleSingleFace={toggleSingleFace}
              printCostDetails={perBillboardPrintCosts}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              includePrintInPrice={includePrintInPrice}
              includeInstallationInPrice={includeInstallationInPrice}
              startDate={startDate}
              endDate={endDate}
            />

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
                            {selected.length} لوحة مرتبطة بالعرض
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
                      <SelectableGoogleHomeMap
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
                            Customer_Name: (b as any).Customer_Name || customerName || '',
                            Ad_Type: (b as any).Ad_Type || adType || '',
                            is_visible_in_available: (b as any).is_visible_in_available,
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
                        selectedBillboards={new Set(selected)}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* ✅ اختيار اللوحات مع الخريطة - Tabs مثل صفحة العقود */}
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
                      municipalityFilter={municipalityFilter}
                      setMunicipalityFilter={setMunicipalityFilter}
                      sizeFilter={sizeFilter}
                      setSizeFilter={setSizeFilter}
                      statusFilter={statusFilter}
                      setStatusFilter={setStatusFilter}
                      pricingCategory={pricingCategory}
                      setPricingCategory={setPricingCategory}
                      cities={cities}
                      municipalities={municipalities}
                      sizes={sizes}
                      pricingCategories={pricingCategories}
                      sizeFilters={sizeFilters}
                      setSizeFilters={setSizeFilters}
                      totalCount={billboards.length}
                      selectedCount={selected.length}
                    />

                    <AvailableBillboardsGrid
                      billboards={filtered}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      loading={loading}
                      allowAllSelection={true}
                      calculateBillboardPrice={calculateBillboardPrice}
                      pricingMode={pricingMode}
                      durationMonths={durationMonths}
                      durationDays={durationDays}
                      pricingCategory={pricingCategory}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="map" className="m-0 p-3 space-y-3">
                  <BillboardFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    cityFilter={cityFilter}
                    setCityFilter={setCityFilter}
                    municipalityFilter={municipalityFilter}
                    setMunicipalityFilter={setMunicipalityFilter}
                    sizeFilter={sizeFilter}
                    setSizeFilter={setSizeFilter}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    pricingCategory={pricingCategory}
                    setPricingCategory={setPricingCategory}
                    cities={cities}
                    municipalities={municipalities}
                    sizes={sizes}
                    pricingCategories={pricingCategories}
                    sizeFilters={sizeFilters}
                    setSizeFilters={setSizeFilters}
                    totalCount={billboards.length}
                    selectedCount={selected.length}
                  />

                  <div className="h-[500px]">
                    <SelectableGoogleHomeMap
                      billboards={filtered.map((b) => {
                        const endDate = (b as any).Rent_End_Date ?? (b as any).rent_end_date ?? null;
                        return {
                          ID: (b as any).ID || 0,
                          Billboard_Name: (b as any).Billboard_Name || '',
                          City: (b as any).City || '',
                          District: (b as any).District || '',
                          Size: (b as any).Size || '',
                          Status: isBillboardAvailable(b) ? 'متاح' : 'محجوز',
                          Price: (b as any).Price || '0',
                          Level: (b as any).Level || '',
                          Image_URL: (b as any).Image_URL || '',
                          GPS_Coordinates: (b as any).GPS_Coordinates || '',
                          GPS_Link: (b as any).GPS_Link || '',
                          Nearest_Landmark: (b as any).Nearest_Landmark || '',
                          Faces_Count: (b as any).Faces_Count || '1',
                          Municipality: (b as any).Municipality || '',
                          Rent_End_Date: endDate,
                          Customer_Name: (b as any).Customer_Name || '',
                          Ad_Type: (b as any).Ad_Type || '',
                          is_visible_in_available: (b as any).is_visible_in_available,
                          id: String((b as any).ID || ''),
                          name: (b as any).Billboard_Name || '',
                          location: (b as any).Nearest_Landmark || '',
                          size: (b as any).Size || '',
                          status: (isBillboardAvailable(b) ? 'available' : 'rented') as 'available' | 'rented',
                          coordinates: (b as any).GPS_Coordinates || '',
                          imageUrl: (b as any).Image_URL || '',
                          expiryDate: endDate,
                          area: (b as any).District || '',
                          municipality: (b as any).Municipality || '',
                          size_id: (b as any).size_id || null,
                        };
                      }) as Billboard[]}
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
                      pricingMode={pricingMode}
                      durationMonths={durationMonths}
                      durationDays={durationDays}
                      pricingCategory={pricingCategory}
                      calculateBillboardPrice={calculateBillboardPrice}
                    />
                  </div>
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
              customerCompany={customerCompany}
              customerPhone={customerPhone}
            />

            {/* التواريخ والمدة */}
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
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-700 dark:text-orange-300">إجمالي التركيب:</span>
                        <span className="text-xl font-bold text-orange-600">
                          {installationCostSummary.totalInstallationCost.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    {(installationCostSummary.groupedSizes as any[]).length > 0 && (
                      <div className="space-y-1.5">
                        {(installationCostSummary.groupedSizes as any[]).map((sizeInfo: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm px-2 py-1.5 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">{sizeInfo.size} ({sizeInfo.count} لوحة)</span>
                            <span className="font-medium">{sizeInfo.totalForSize.toLocaleString()} د.ل</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    {installationEnabled ? 'لا توجد لوحات مختارة' : 'العرض بدون تكلفة تركيب'}
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
                    
                    {printCostDetails.length > 0 ? (
                      <div className="space-y-3">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {printCostDetails.map((detail: any, index: number) => (
                            <div key={index} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-sm">{detail.size}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {detail.count} لوحة × {detail.faces} وجه
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>المساحة: {detail.area?.toFixed(1) || 0} م²</span>
                                <span className="font-medium text-cyan-600">{(detail.totalCost || 0).toFixed(0)} د.ل</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-cyan-700 dark:text-cyan-300">إجمالي الطباعة:</span>
                            <span className="text-xl font-bold text-cyan-600">
                              {totalPrintCost.toLocaleString('ar-LY')} د.ل
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
                    العرض بدون تكلفة طباعة
                  </div>
                )}
              </CardContent>
            </Card>

            {/* رسوم التشغيل */}
            {operatingFee > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    رسوم التشغيل (3%)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{installationCost > 0 ? 'صافي تكلفة الإيجار:' : 'الإجمالي بعد الخصم:'}</span>
                      <span className="font-medium">{(installationCost > 0 ? rentalCostOnly : finalTotal).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                      <div className="flex justify-between items-center font-bold">
                        <span>إجمالي رسوم التشغيل:</span>
                        <span className="text-blue-600">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* الأقساط */}
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

            {/* ملخص التكلفة */}
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
              installationCost={actualInstallationCost}
              rentalCostOnly={rentalCostOnly}
              operatingFee={operatingFee}
              currentContract={currentOffer}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/offers')}
              saving={saving}
              savedBaseRent={savedBaseRent}
              calculatedEstimatedTotal={calculatedEstimatedTotal}
              onRefreshPricesFromTable={handleRefreshPricesFromTable}
              printCost={totalPrintCost}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              includeInstallationInPrice={includeInstallationInPrice}
              setIncludeInstallationInPrice={setIncludeInstallationInPrice}
              includePrintInPrice={includePrintInPrice}
              setIncludePrintInPrice={setIncludePrintInPrice}
            />
          </div>
        </div>
      </div>

      {pdfOpen && pdfContractData && (
        <ContractPDFDialog
          contract={pdfContractData}
          open={pdfOpen}
          onOpenChange={setPdfOpen}
        />
      )}
    </div>
  );
}
