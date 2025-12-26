// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Billboard } from '@/types';
import { useContractPricing } from '@/hooks/useContractPricing';
import { BillboardSelectionMap } from '@/components/Map/BillboardSelectionMap';
import { BillboardImage } from '@/components/BillboardImage';
import InteractiveMap from '@/components/InteractiveMap';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import ContractPDFDialog from './ContractPDFDialog';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { 
  DollarSign, List, Map as MapIcon, Printer, FileText, Calendar, Eye, Edit, Trash2, 
  Search, Filter, Plus, Copy, RefreshCw, Wrench, Settings, ArrowRight, CheckCircle2, 
  XCircle, AlertTriangle, Clock, TrendingUp, Building2, LayoutGrid, Table as TableIcon,
  FileOutput, Sparkles, Receipt, User2, Hash
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

// Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

interface Offer {
  id: string;
  offer_number: number;
  customer_name: string;
  customer_id?: string;
  start_date: string;
  end_date?: string;
  duration_months: number;
  total: number;
  discount: number;
  status: string;
  billboards_count: number;
  billboards_data: string;
  notes?: string;
  created_at: string;
  pricing_category?: string;
  currency?: string;
  exchange_rate?: number;
  ad_type?: string;
  installation_cost?: number;
  installation_enabled?: boolean;
  print_cost?: number;
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  installments_data?: any;
  billboard_prices?: any;
  operating_fee?: number;
  operating_fee_rate?: number;
  include_print_in_billboard_price?: boolean;
  include_installation_in_price?: boolean;
  installation_details?: any;
  print_details?: any;
}

export default function OffersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list');
  
  // List state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [listViewMode, setListViewMode] = useState<'table' | 'cards'>('cards');
  
  // Create state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  
  // Edit mode
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [removedBillboards, setRemovedBillboards] = useState<any[]>([]);
  const [showRemovedDialog, setShowRemovedDialog] = useState(false);
  
  // Form state
  const [selected, setSelected] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [adType, setAdType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  
  // Installation and Print costs
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<any[]>([]);
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(true);
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [printCost, setPrintCost] = useState<number>(0);
  const [operatingFee, setOperatingFee] = useState<number>(0);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);
  const [defaultInstallmentCount, setDefaultInstallmentCount] = useState<number>(2);
  
  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);
  
  // Customer selector
  const [customers, setCustomers] = useState<{ id: string; name: string; company?: string; phone?: string }[]>([]);
  const [selectedCustomerCompany, setSelectedCustomerCompany] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  // Filters for billboards
  const [bbSearchQuery, setBbSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Create from contract dialog
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractSearchQuery, setContractSearchQuery] = useState('');
  const [contractAdTypeFilter, setContractAdTypeFilter] = useState<string>('all');
  const [includePrintInBillboardPrice, setIncludePrintInBillboardPrice] = useState<boolean>(false);
  
  // Print dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedOfferForPrint, setSelectedOfferForPrint] = useState<any>(null);

  // Convert to contract dialog
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertingOffer, setConvertingOffer] = useState<Offer | null>(null);
  const [offerBillboardsStatus, setOfferBillboardsStatus] = useState<{
    available: any[];
    unavailable: any[];
  }>({ available: [], unavailable: [] });
  const [loadingBillboardStatus, setLoadingBillboardStatus] = useState(false);

  // Pricing hook
  const pricing = useContractPricing();

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, company, phone')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers(data);
        }
      } catch (e) {
        console.error('Failed to load customers');
      }
    })();
  }, []);

  // Load offers list
  const loadOffers = async () => {
    try {
      setLoadingOffers(true);
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOffers(data || []);
    } catch (e: any) {
      console.error('Error loading offers:', e);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Load billboards
  const loadBillboardsData = async () => {
    try {
      setLoading(true);
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
          "Municipality",
          "District",
          "Image_URL",
          "image_name",
          "Faces_Count",
          "GPS_Coordinates",
          "size_id"
        `)
        .order('Billboard_Name');
      
      if (error) throw error;
      setBillboards(data || []);
    } catch (e: any) {
      console.error('Error loading billboards:', e);
      toast.error('فشل تحميل اللوحات');
    } finally {
      setLoading(false);
    }
  };

  // Load contracts for "create from contract" feature
  const loadContracts = async () => {
    try {
      setLoadingContracts(true);
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, customer_id, customer_category')
        .order('Contract_Number', { ascending: false });
      
      if (error) throw error;
      setContracts(data || []);
    } catch (e) {
      console.error('Error loading contracts:', e);
    } finally {
      setLoadingContracts(false);
    }
  };

  // Get unique ad types from contracts
  const contractAdTypes = useMemo(() => {
    const adTypes = contracts.map(c => c['Ad Type']).filter(Boolean);
    return Array.from(new Set(adTypes));
  }, [contracts]);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('id, name, created_at')
          .order('name');

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          const allCategories = Array.from(new Set([...staticCategories, ...categories]));
          setPricingCategories(allCategories);
        }
      } catch (e) {
        console.error('Failed to load pricing categories:', e);
        setPricingCategories(['عادي', 'مسوق', 'شركات']);
      }
    })();
  }, []);

  useEffect(() => {
    loadOffers();
    loadBillboardsData();
  }, []);

  // Calculate end date based on start date and duration
  useEffect(() => {
    if (!startDate || !durationMonths) return;
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    setEndDate(end.toISOString().split('T')[0]);
  }, [startDate, durationMonths]);

  // Selected billboards - must be defined before other memos that use it
  const selectedBillboards = useMemo(() => 
    billboards.filter((b: any) => selected.includes(String(b.ID))),
    [billboards, selected]
  );

  // Calculate installation cost when billboards change
  useEffect(() => {
    const calculateInstallation = async () => {
      if (!installationEnabled || selected.length === 0) {
        setInstallationCost(0);
        setInstallationDetails([]);
        return;
      }
      try {
        const result = await calculateInstallationCostFromIds(selected);
        setInstallationCost(result.totalInstallationCost || 0);
        setInstallationDetails(result.installationDetails || []);
      } catch (e) {
        console.error('Error calculating installation cost:', e);
      }
    };
    calculateInstallation();
  }, [selected, billboards, installationEnabled]);

  // Calculate print cost with details
  const { calculatedPrintCost, printDetails } = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return { calculatedPrintCost: 0, printDetails: [] };
    
    const details: Array<{
      billboardId: string;
      billboardName: string;
      size: string;
      width: number;
      height: number;
      faces: number;
      area: number;
      printCost: number;
    }> = [];
    
    let totalCost = 0;
    
    selectedBillboards.forEach((b: any) => {
      const size = String(b.Size || '');
      const match = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const width = parseFloat(match[1]);
        const height = parseFloat(match[2]);
        const faces = Number(b.Faces_Count) || 2;
        const area = width * height * faces;
        const cost = Math.round(area * printPricePerMeter);
        
        details.push({
          billboardId: String(b.ID),
          billboardName: b.Billboard_Name || '',
          size,
          width,
          height,
          faces,
          area,
          printCost: cost
        });
        
        totalCost += cost;
      }
    });
    
    return { calculatedPrintCost: totalCost, printDetails: details };
  }, [selectedBillboards, printCostEnabled, printPricePerMeter]);

  useEffect(() => {
    setPrintCost(calculatedPrintCost);
  }, [calculatedPrintCost]);

  // Calculate billboard price
  const calculateBillboardPrice = (billboard: any): number => {
    return pricing.calculateBillboardPrice(
      billboard,
      'months',
      durationMonths,
      0,
      pricingCategory,
      (price: number) => price * exchangeRate
    );
  };

  const totalBeforeDiscount = useMemo(() => 
    selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0),
    [selectedBillboards, durationMonths, pricingCategory, exchangeRate]
  );

  const totalAfterDiscount = totalBeforeDiscount - discount;

  // صافي الإيجار = بعد الخصم - التكاليف المجانية فقط (المضمنة في السعر)
  const netRental = useMemo(() => {
    // التركيب: يُخصم من الصافي فقط إذا كان مفعّل ومجاني (مضمن في السعر)
    const installCostDeduction = (installationEnabled && includeInstallationInPrice) ? installationCost : 0;
    // الطباعة: تُخصم من الصافي فقط إذا كانت مفعّلة ومجانية (مضمنة في السعر)
    const printCostDeduction = (printCostEnabled && includePrintInBillboardPrice) ? printCost : 0;
    return totalAfterDiscount - installCostDeduction - printCostDeduction;
  }, [totalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInBillboardPrice]);

  // Calculate operating fee from net rental
  const calculatedOperatingFee = useMemo(() => {
    return Math.round((netRental * operatingFeeRate) / 100);
  }, [netRental, operatingFeeRate]);

  useEffect(() => {
    setOperatingFee(calculatedOperatingFee);
  }, [calculatedOperatingFee]);

  // الإجمالي النهائي = بعد الخصم + التكاليف غير المجانية (التي يدفعها الزبون)
  const grandTotal = useMemo(() => {
    // التركيب: يُضاف للإجمالي فقط إذا كان مفعّل وغير مجاني
    const installCostToAdd = (installationEnabled && !includeInstallationInPrice) ? installationCost : 0;
    // الطباعة: تُضاف للإجمالي فقط إذا كانت مفعّلة وغير مجانية
    const printCostToAdd = (printCostEnabled && !includePrintInBillboardPrice) ? printCost : 0;
    return totalAfterDiscount + installCostToAdd + printCostToAdd;
  }, [totalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInBillboardPrice]);

  // للتوافق مع الكود القديم
  const finalTotal = totalAfterDiscount;

  // Filter billboards based on start date
  const filteredBillboards = useMemo(() => {
    return billboards.filter((b: any) => {
      const status = String(b.Status || '').toLowerCase();
      const rentEndDate = b.Rent_End_Date;
      
      if (status === 'متاح' || status === 'available') {
        return true;
      }
      
      if (startDate && rentEndDate) {
        const offerStart = new Date(startDate);
        const rentEnd = new Date(rentEndDate);
        return rentEnd < offerStart;
      }
      
      if (!startDate) {
        return true;
      }
      
      return false;
    });
  }, [billboards, startDate]);

  // Apply search and other filters
  const displayedBillboards = useMemo(() => {
    return filteredBillboards.filter((b: any) => {
      const name = String(b.Billboard_Name || '').toLowerCase();
      const landmark = String(b.Nearest_Landmark || '').toLowerCase();
      const city = String(b.City || '');
      const size = String(b.Size || '');
      
      const matchesSearch = !bbSearchQuery || 
        name.includes(bbSearchQuery.toLowerCase()) || 
        landmark.includes(bbSearchQuery.toLowerCase());
      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;
      
      return matchesSearch && matchesCity && matchesSize;
    });
  }, [filteredBillboards, bbSearchQuery, cityFilter, sizeFilter]);

  const cities = useMemo(() => 
    Array.from(new Set(billboards.map((b: any) => b.City).filter(Boolean))),
    [billboards]
  );
  
  const sizes = useMemo(() => 
    Array.from(new Set(billboards.map((b: any) => b.Size).filter(Boolean))),
    [billboards]
  );

  const toggleSelect = (billboard: any) => {
    const id = String(billboard.ID);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Handle customer selection
  const handleAddCustomer = async (name: string) => {
    if (!name.trim()) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      
      if (!error && newC && newC.id) {
        setCustomerName(name);
        setCustomerId(newC.id);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string; company?: string; phone?: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setSelectedCustomerCompany(customer.company || null);
    setSelectedCustomerPhone(customer.phone || null);
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  // Create offer from existing contract
  const handleCreateFromContract = (contract: any) => {
    setCustomerName(contract['Customer Name'] || '');
    setCustomerId(contract.customer_id || null);
    setAdType(contract['Ad Type'] || '');
    setPricingCategory(contract.customer_category || 'عادي');
    
    // Parse billboard IDs
    if (contract.billboard_ids) {
      const ids = typeof contract.billboard_ids === 'string'
        ? contract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
        : [];
      setSelected(ids);
    }
    
    // Set dates
    if (contract['Contract Date']) {
      setStartDate(contract['Contract Date']);
    }
    if (contract['End Date']) {
      setEndDate(contract['End Date']);
    }
    
    setShowContractDialog(false);
    setActiveTab('create');
    toast.success('تم تحميل بيانات العقد');
  };

  // Save offer
  const handleSaveOffer = async () => {
    try {
      if (!customerName || selected.length === 0 || !startDate) {
        toast.error('يرجى تعبئة البيانات المطلوبة واختيار لوحات');
        return;
      }

      setSaving(true);

      const billboardsData = selectedBillboards.map((b: any) => ({
        id: String(b.ID),
        ID: b.ID,
        Billboard_Name: b.Billboard_Name,
        name: b.Billboard_Name,
        size: b.Size,
        Size: b.Size,
        city: b.City,
        City: b.City,
        Municipality: b.Municipality,
        District: b.District,
        Nearest_Landmark: b.Nearest_Landmark,
        Image_URL: b.Image_URL,
        Faces_Count: b.Faces_Count,
        GPS_Coordinates: b.GPS_Coordinates,
        price: calculateBillboardPrice(b),
        Price: calculateBillboardPrice(b),
      }));

      const billboardPrices = selectedBillboards.map((b: any) => ({
        billboardId: String(b.ID),
        originalPrice: b.Price || 0,
        contractPrice: calculateBillboardPrice(b),
      }));

      const offerData = {
        customer_name: customerName,
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate,
        duration_months: durationMonths,
        total: grandTotal,
        discount,
        status: editingOffer?.status || 'pending',
        billboards_count: selected.length,
        billboards_data: JSON.stringify(billboardsData),
        notes,
        pricing_category: pricingCategory,
        currency: contractCurrency,
        exchange_rate: exchangeRate,
        ad_type: adType,
        installation_cost: installationCost,
        installation_enabled: installationEnabled,
        print_cost: printCost,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        installments_data: installments.length > 0 ? JSON.stringify(installments) : null,
        billboard_prices: JSON.stringify(billboardPrices),
        operating_fee: operatingFee,
        operating_fee_rate: operatingFeeRate,
        include_print_in_billboard_price: includePrintInBillboardPrice,
        include_installation_in_price: includeInstallationInPrice,
        installation_details: installationDetails.length > 0 ? JSON.stringify(installationDetails) : null,
        print_details: printDetails.length > 0 ? JSON.stringify(printDetails) : null,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('offers')
          .update(offerData)
          .eq('id', editingOffer.id);
        if (error) throw error;
        toast.success('تم تحديث العرض بنجاح');
      } else {
        const { error } = await supabase
          .from('offers')
          .insert([offerData])
          .select()
          .single();
        if (error) throw error;
        toast.success('تم حفظ العرض بنجاح');
      }

      resetForm();
      loadOffers();
      setActiveTab('list');
    } catch (e: any) {
      console.error('Error saving offer:', e);
      toast.error(e?.message || 'فشل حفظ العرض');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelected([]);
    setCustomerName('');
    setCustomerId(null);
    setAdType('');
    setStartDate('');
    setEndDate('');
    setDurationMonths(3);
    setDiscount(0);
    setNotes('');
    setPricingCategory('عادي');
    setContractCurrency('LYD');
    setExchangeRate(1);
    setEditingOffer(null);
    setInstallationEnabled(true);
    setInstallationCost(0);
    setInstallationDetails([]);
    setIncludeInstallationInPrice(true);
    setPrintCostEnabled(false);
    setPrintPricePerMeter(0);
    setPrintCost(0);
    setIncludePrintInBillboardPrice(false);
    setOperatingFee(0);
    setOperatingFeeRate(3);
    setInstallments([]);
    setRemovedBillboards([]);
  };

  // Check and update available billboards in offer
  const handleRefreshOfferBillboards = async () => {
    if (!editingOffer) return;
    
    try {
      const offerBillboards = JSON.parse(editingOffer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current billboard status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name", "Contract_Number", "Nearest_Landmark", "Municipality", "District"')
        .in('ID', billboardIds);
      
      const available: string[] = [];
      const removed: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        const offerStart = startDate ? new Date(startDate) : today;
        
        // Find original offer data for this billboard
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        if (status === 'متاح' || status === 'available') {
          available.push(String(b.ID));
        } else if (rentEndDate && rentEndDate < offerStart) {
          // Will be available before offer start
          available.push(String(b.ID));
        } else {
          removed.push({
            ...b,
            offerPrice: offerData?.price || offerData?.Price || 0,
            reason: `مؤجرة للزبون: ${b.Customer_Name || 'غير معروف'} - عقد رقم: ${b.Contract_Number || '-'} - حتى: ${b.Rent_End_Date || '-'}`
          });
        }
      });
      
      if (removed.length > 0) {
        setRemovedBillboards(removed);
        setShowRemovedDialog(true);
        setSelected(available);
        toast.warning(`تم إزالة ${removed.length} لوحة غير متاحة`);
      } else {
        toast.success('جميع اللوحات متاحة');
      }
    } catch (e) {
      console.error('Error refreshing billboards:', e);
      toast.error('فشل تحديث حالة اللوحات');
    }
  };

  // Remove unavailable billboards from offer in edit mode
  const handleRemoveUnavailableBillboards = async () => {
    if (!editingOffer) return;
    
    try {
      const offerBillboards = JSON.parse(editingOffer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name"')
        .in('ID', billboardIds);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const availableIds: string[] = [];
      const removedList: any[] = [];
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        if (status === 'متاح' || status === 'available') {
          availableIds.push(String(b.ID));
        } else if (rentEndDate && rentEndDate < today) {
          availableIds.push(String(b.ID));
        } else {
          removedList.push({
            ...b,
            offerPrice: offerData?.price || offerData?.Price || 0,
            reason: rentEndDate ? `مؤجرة حتى ${b.Rent_End_Date}` : 'غير متاحة حالياً',
          });
        }
      });
      
      if (removedList.length > 0) {
        setSelected(availableIds);
        setRemovedBillboards(removedList);
        setShowRemovedDialog(true);
        toast.warning(`تم إزالة ${removedList.length} لوحة غير متاحة`);
      } else {
        toast.success('جميع اللوحات في العرض متاحة');
      }
    } catch (e) {
      console.error('Error removing unavailable billboards:', e);
      toast.error('فشل التحقق من توفر اللوحات');
    }
  };

  // Edit offer
  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setCustomerName(offer.customer_name);
    setCustomerId(offer.customer_id || null);
    setAdType(offer.ad_type || '');
    setStartDate(offer.start_date);
    setEndDate(offer.end_date || '');
    setDurationMonths(offer.duration_months);
    setDiscount(offer.discount || 0);
    setNotes(offer.notes || '');
    setPricingCategory(offer.pricing_category || 'عادي');
    setContractCurrency(offer.currency || 'LYD');
    setExchangeRate(offer.exchange_rate || 1);
    setInstallationEnabled(offer.installation_enabled !== false);
    setInstallationCost(offer.installation_cost || 0);
    setPrintCostEnabled(offer.print_cost_enabled || false);
    setPrintPricePerMeter(offer.print_price_per_meter || 0);
    setPrintCost(offer.print_cost || 0);
    setOperatingFee(offer.operating_fee || 0);
    setOperatingFeeRate(offer.operating_fee_rate || 3);
    setIncludePrintInBillboardPrice(offer.include_print_in_billboard_price || false);
    setIncludeInstallationInPrice(offer.include_installation_in_price !== false);
    
    // Load installation details
    if (offer.installation_details) {
      try {
        const parsed = typeof offer.installation_details === 'string' 
          ? JSON.parse(offer.installation_details) 
          : offer.installation_details;
        setInstallationDetails(Array.isArray(parsed) ? parsed : []);
      } catch {
        setInstallationDetails([]);
      }
    }
    
    // Load installments
    if (offer.installments_data) {
      try {
        const parsed = typeof offer.installments_data === 'string' 
          ? JSON.parse(offer.installments_data) 
          : offer.installments_data;
        setInstallments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setInstallments([]);
      }
    } else {
      setInstallments([]);
    }
    
    try {
      const bbData = JSON.parse(offer.billboards_data || '[]');
      setSelected(bbData.map((b: any) => String(b.id || b.ID)));
    } catch {
      setSelected([]);
    }
    
    setActiveTab('create');
  };

  // Installments helper functions
  const handleDistributeInstallments = (count: number) => {
    if (count < 1 || !grandTotal) return;
    const amount = Math.round((grandTotal / count) * 100) / 100;
    const newInstallments = Array.from({ length: count }, (_, i) => ({
      amount,
      paymentType: 'شهري',
      description: `الدفعة ${i + 1}`,
      dueDate: startDate ? calculateDueDate('شهري', i, startDate) : '',
    }));
    setInstallments(newInstallments);
  };

  const handleDistributeWithInterval = (config: any) => {
    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate } = config;
    
    const actualFirstPayment = firstPaymentType === 'percent' 
      ? Math.round((grandTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100
      : firstPayment;
    
    const remaining = grandTotal - actualFirstPayment;
    const paymentCount = numPayments || 3;
    const recurringAmount = Math.round((remaining / paymentCount) * 100) / 100;
    
    const newInstallments: typeof installments = [];
    const firstDate = firstPaymentDate || startDate;
    
    if (actualFirstPayment > 0) {
      newInstallments.push({
        amount: actualFirstPayment,
        paymentType: 'مقدم',
        description: 'الدفعة الأولى (مقدم)',
        dueDate: firstDate,
      });
    }
    
    const intervalMonths = interval === 'month' ? 1 : interval === '2months' ? 2 : interval === '3months' ? 3 : 4;
    
    for (let i = 0; i < paymentCount; i++) {
      const date = new Date(firstDate);
      date.setMonth(date.getMonth() + (i + 1) * intervalMonths);
      const isLast = i === paymentCount - 1;
      const amount = isLast ? (remaining - recurringAmount * (paymentCount - 1)) : recurringAmount;
      
      newInstallments.push({
        amount,
        paymentType: 'شهري',
        description: `الدفعة ${actualFirstPayment > 0 ? i + 2 : i + 1}`,
        dueDate: date.toISOString().split('T')[0],
      });
    }
    
    setInstallments(newInstallments);
  };

  const calculateDueDate = (paymentType: string, index: number, baseDate: string) => {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + index);
    return date.toISOString().split('T')[0];
  };

  // Delete offer
  const handleDeleteOffer = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    
    try {
      const { error } = await supabase.from('offers').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف العرض');
      loadOffers();
    } catch (e: any) {
      toast.error('فشل حذف العرض');
    }
  };

  // Copy offer to create new one
  const handleCopyOffer = (offer: Offer) => {
    resetForm();
    
    // Set all values from the source offer
    setCustomerName(offer.customer_name);
    setCustomerId(offer.customer_id || null);
    setAdType(offer.ad_type || '');
    setStartDate(''); // Reset dates for new offer
    setEndDate('');
    setDurationMonths(offer.duration_months);
    setDiscount(offer.discount || 0);
    setNotes(offer.notes ? `نسخة من العرض #${offer.offer_number}\n${offer.notes}` : `نسخة من العرض #${offer.offer_number}`);
    setPricingCategory(offer.pricing_category || 'عادي');
    setContractCurrency(offer.currency || 'LYD');
    setExchangeRate(offer.exchange_rate || 1);
    setInstallationEnabled(offer.installation_enabled !== false);
    setPrintCostEnabled(offer.print_cost_enabled || false);
    setPrintPricePerMeter(offer.print_price_per_meter || 0);
    setOperatingFeeRate(offer.operating_fee_rate || 3);
    setIncludePrintInBillboardPrice(offer.include_print_in_billboard_price || false);
    setIncludeInstallationInPrice(offer.include_installation_in_price !== false);
    
    // Load billboards
    try {
      const bbData = JSON.parse(offer.billboards_data || '[]');
      setSelected(bbData.map((b: any) => String(b.id || b.ID)));
    } catch {
      setSelected([]);
    }
    
    // Load installments structure (without dates)
    if (offer.installments_data) {
      try {
        const parsed = typeof offer.installments_data === 'string' 
          ? JSON.parse(offer.installments_data) 
          : offer.installments_data;
        // Reset dates in installments
        const resetInstallments = (Array.isArray(parsed) ? parsed : []).map((inst: any, idx: number) => ({
          ...inst,
          dueDate: '',
          description: `الدفعة ${idx + 1}`,
        }));
        setInstallments(resetInstallments);
      } catch {
        setInstallments([]);
      }
    }
    
    setEditingOffer(null); // This is a new offer, not editing
    setActiveTab('create');
    toast.success(`تم نسخ بيانات العرض #${offer.offer_number}`);
  };

  // Check billboard availability for conversion
  const checkBillboardsAvailability = async (offer: Offer) => {
    setLoadingBillboardStatus(true);
    try {
      const offerBillboards = JSON.parse(offer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current billboard status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name"')
        .in('ID', billboardIds);
      
      const available: any[] = [];
      const unavailable: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        
        // Find original offer data for this billboard
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        const billboardInfo = {
          ...b,
          offerPrice: offerData?.price || offerData?.Price || 0,
        };
        
        if (status === 'متاح' || status === 'available') {
          available.push(billboardInfo);
        } else if (rentEndDate && rentEndDate < today) {
          // Expired rental - consider available
          available.push({ ...billboardInfo, wasRented: true, rentExpired: true });
        } else {
          unavailable.push({
            ...billboardInfo,
            rentEndDate: b.Rent_End_Date,
            currentCustomer: b.Customer_Name,
          });
        }
      });
      
      setOfferBillboardsStatus({ available, unavailable });
    } catch (e) {
      console.error('Error checking billboard availability:', e);
      toast.error('فشل التحقق من توفر اللوحات');
    } finally {
      setLoadingBillboardStatus(false);
    }
  };

  // Convert offer to contract - enhanced version
  const handleOpenConvertDialog = async (offer: Offer) => {
    setConvertingOffer(offer);
    setShowConvertDialog(true);
    await checkBillboardsAvailability(offer);
  };

  const handleConvertToContract = async (useOnlyAvailable: boolean = false) => {
    if (!convertingOffer) return;
    
    try {
      let billboardsToUse = offerBillboardsStatus.available;
      
      if (!useOnlyAvailable && offerBillboardsStatus.unavailable.length > 0) {
        // Include all billboards
        billboardsToUse = [...offerBillboardsStatus.available, ...offerBillboardsStatus.unavailable];
      }
      
      if (billboardsToUse.length === 0) {
        toast.error('لا توجد لوحات متاحة للتحويل');
        return;
      }
      
      const billboardIds = billboardsToUse.map((b: any) => String(b.ID));
      
      // Calculate rent cost from available billboards
      const rentCost = billboardsToUse.reduce((sum: number, b: any) => sum + (b.offerPrice || 0), 0);
      
      // Create contract in database
      const { data: newContract, error } = await supabase
        .from('Contract')
        .insert({
          'Customer Name': convertingOffer.customer_name,
          customer_id: convertingOffer.customer_id,
          'Contract Date': convertingOffer.start_date,
          'End Date': convertingOffer.end_date,
          'Ad Type': convertingOffer.ad_type || 'إعلان',
          'Total Rent': rentCost,
          Discount: convertingOffer.discount || 0,
          Total: convertingOffer.total,
          billboard_ids: billboardIds.join(','),
          billboards_count: billboardIds.length,
          customer_category: convertingOffer.pricing_category,
          contract_currency: convertingOffer.currency || 'LYD',
          exchange_rate: String(convertingOffer.exchange_rate || 1),
          installation_cost: convertingOffer.installation_cost || 0,
          installation_enabled: convertingOffer.installation_enabled !== false,
          print_cost: convertingOffer.print_cost || 0,
          print_cost_enabled: convertingOffer.print_cost_enabled ? 'true' : 'false',
          print_price_per_meter: String(convertingOffer.print_price_per_meter || 0),
          operating_fee_rate: convertingOffer.operating_fee_rate || 3,
          installments_data: typeof convertingOffer.installments_data === 'string' 
            ? convertingOffer.installments_data 
            : JSON.stringify(convertingOffer.installments_data || []),
          billboard_prices: typeof convertingOffer.billboard_prices === 'string'
            ? convertingOffer.billboard_prices
            : JSON.stringify(convertingOffer.billboard_prices || {}),
          payment_status: 'unpaid',
        })
        .select('Contract_Number')
        .single();
      
      if (error) throw error;
      
      // Update offer status to converted
      await supabase
        .from('offers')
        .update({ status: 'converted' })
        .eq('id', convertingOffer.id);
      
      setShowConvertDialog(false);
      setConvertingOffer(null);
      
      // Navigate to contract edit page
      if (newContract?.Contract_Number) {
        toast.success(`تم إنشاء العقد رقم ${newContract.Contract_Number}`);
        navigate(`/admin/contracts/edit?contract=${newContract.Contract_Number}`);
      } else {
        toast.success('تم تحويل العرض إلى عقد');
        loadOffers();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل تحويل العرض');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">موافق عليه</Badge>;
      case 'rejected':
        return <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0">مرفوض</Badge>;
      case 'converted':
        return <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">تم التحويل لعقد</Badge>;
      default:
        return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">قيد الانتظار</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'converted':
        return <FileOutput className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = !searchQuery || 
        offer.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(offer.offer_number).includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [offers, searchQuery, statusFilter]);

  // Helper to get customer info by customer_id
  const getCustomerInfo = (customerId?: string) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId) || null;
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const name = c['Customer Name'] || '';
      const num = String(c.Contract_Number || '');
      const adType = c['Ad Type'] || '';
      
      const matchesSearch = !contractSearchQuery || 
        name.toLowerCase().includes(contractSearchQuery.toLowerCase()) ||
        num.includes(contractSearchQuery) ||
        adType.toLowerCase().includes(contractSearchQuery.toLowerCase());
      
      const matchesAdType = contractAdTypeFilter === 'all' || adType === contractAdTypeFilter;
      
      return matchesSearch && matchesAdType;
    });
  }, [contracts, contractSearchQuery, contractAdTypeFilter]);

  const currentCurrency = CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];

  // Stats for offers
  const offersStats = useMemo(() => {
    const total = offers.length;
    const pending = offers.filter(o => o.status === 'pending').length;
    const approved = offers.filter(o => o.status === 'approved').length;
    const converted = offers.filter(o => o.status === 'converted').length;
    const totalValue = offers.reduce((sum, o) => sum + (o.total || 0), 0);
    
    return { total, pending, approved, converted, totalValue };
  }, [offers]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  إدارة العروض
                </h1>
                <p className="text-muted-foreground">إنشاء وإدارة عروض الأسعار وتحويلها لعقود</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {activeTab === 'create' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => { resetForm(); setActiveTab('list'); }}
                  className="gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  عودة للقائمة
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedOfferForPrint({
                      id: editingOffer?.offer_number || 0,
                      offer_number: editingOffer?.offer_number || 0,
                      Contract_Number: editingOffer?.offer_number || 0,
                      is_offer: true,
                      customer_name: customerName,
                      'Customer Name': customerName,
                      'Ad Type': adType || 'عرض سعر',
                      start_date: startDate,
                      'Contract Date': startDate,
                      end_date: endDate,
                      'End Date': endDate,
                      Total: grandTotal,
                      'Total Rent': grandTotal,
                      Discount: discount,
                      installation_cost: installationEnabled ? installationCost : 0,
                      installation_enabled: installationEnabled,
                      print_cost_enabled: printCostEnabled,
                      print_cost: printCost,
                      print_price_per_meter: printPricePerMeter,
                      billboard_ids: selected.join(','),
                      installments_data: JSON.stringify(installments),
                      customer_category: pricingCategory,
                      contract_currency: contractCurrency,
                      exchange_rate: String(exchangeRate),
                      operating_fee_rate: operatingFeeRate,
                      billboard_prices: JSON.stringify(selectedBillboards.map((b: any) => ({
                        billboardId: b.ID,
                        finalPrice: calculateBillboardPrice(b)
                      }))),
                    });
                    setPdfDialogOpen(true);
                  }}
                  className="gap-2 border-primary/30 hover:bg-primary/10"
                >
                  <Printer className="h-4 w-4" />
                  طباعة العرض
                </Button>
                <Button 
                  onClick={handleSaveOffer} 
                  disabled={saving}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Sparkles className="h-4 w-4" />
                  {saving ? 'جاري الحفظ...' : editingOffer ? 'تحديث العرض' : 'حفظ العرض'}
                </Button>
              </>
            )}
            {activeTab === 'list' && (
              <div className="flex gap-2">
                <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => { loadContracts(); setShowContractDialog(true); }}
                      className="gap-2 border-primary/30 hover:bg-primary/10"
                    >
                      <Copy className="h-4 w-4" />
                      إنشاء من عقد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        اختيار عقد لإنشاء عرض منه
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="بحث برقم العقد، اسم الزبون، أو نوع الإعلان..."
                            value={contractSearchQuery}
                            onChange={(e) => setContractSearchQuery(e.target.value)}
                            className="pr-10"
                          />
                        </div>
                        <Select value={contractAdTypeFilter} onValueChange={setContractAdTypeFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="نوع الإعلان" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الأنواع</SelectItem>
                            {contractAdTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <ScrollArea className="h-[400px]">
                        {loadingContracts ? (
                          <div className="text-center py-10">جاري التحميل...</div>
                        ) : filteredContracts.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">لا توجد عقود مطابقة</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>رقم العقد</TableHead>
                                <TableHead>الزبون</TableHead>
                                <TableHead>نوع الإعلان</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الإجراء</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredContracts.map((c) => (
                                <TableRow key={c.Contract_Number} className="hover:bg-muted/50">
                                  <TableCell className="font-medium">#{c.Contract_Number}</TableCell>
                                  <TableCell>{c['Customer Name']}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{c['Ad Type'] || '-'}</Badge>
                                  </TableCell>
                                  <TableCell>{c['Contract Date']}</TableCell>
                                  <TableCell>
                                    <Button size="sm" onClick={() => handleCreateFromContract(c)}>
                                      اختيار
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={() => { resetForm(); setActiveTab('create'); }}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Plus className="h-4 w-4" />
                  عرض جديد
                </Button>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 p-1">
            <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <List className="h-4 w-4" />
              قائمة العروض
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Plus className="h-4 w-4" />
              {editingOffer ? 'تعديل العرض' : 'إنشاء عرض'}
            </TabsTrigger>
          </TabsList>

          {/* Offers List Tab */}
          <TabsContent value="list" className="space-y-6 mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-background to-muted/30 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي العروض</p>
                      <p className="text-2xl font-bold">{offersStats.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-600">قيد الانتظار</p>
                      <p className="text-2xl font-bold text-amber-600">{offersStats.pending}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600">موافق عليها</p>
                      <p className="text-2xl font-bold text-green-600">{offersStats.approved}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600">تم التحويل</p>
                      <p className="text-2xl font-bold text-blue-600">{offersStats.converted}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileOutput className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary">إجمالي القيمة</p>
                      <p className="text-lg font-bold text-primary">{offersStats.totalValue.toLocaleString('ar-LY')} د.ل</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Card */}
            <Card className="border-border/50 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[250px] relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث برقم العرض أو اسم الزبون..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 bg-background/80"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-background/80">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="approved">موافق عليه</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                      <SelectItem value="converted">تم التحويل</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 border rounded-lg p-1 bg-background/80">
                    <Button
                      variant={listViewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setListViewMode('cards')}
                      className="gap-1"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={listViewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setListViewMode('table')}
                      className="gap-1"
                    >
                      <TableIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Offers Display */}
            {loadingOffers ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  جاري التحميل...
                </div>
              </div>
            ) : filteredOffers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-xl font-medium text-muted-foreground">لا توجد عروض</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">ابدأ بإنشاء عرض سعر جديد</p>
                  <Button 
                    className="mt-4 gap-2" 
                    onClick={() => { resetForm(); setActiveTab('create'); }}
                  >
                    <Plus className="h-4 w-4" />
                    إنشاء عرض جديد
                  </Button>
                </CardContent>
              </Card>
            ) : listViewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOffers.map((offer) => {
                  const customerInfo = getCustomerInfo(offer.customer_id);
                  return (
                  <Card 
                    key={offer.id} 
                    className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 group"
                  >
                    <div className={`h-1.5 ${
                      offer.status === 'approved' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                      offer.status === 'converted' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                      offer.status === 'rejected' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                      'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`} />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-primary" />
                            <CardTitle className="text-lg">عرض #{offer.offer_number}</CardTitle>
                          </div>
                          <CardDescription className="flex items-center gap-1">
                            <User2 className="h-3 w-3" />
                            {offer.customer_name}
                          </CardDescription>
                          {/* Customer Company & Phone */}
                          {customerInfo && (customerInfo.company || customerInfo.phone) && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {customerInfo.company && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {customerInfo.company}
                                </span>
                              )}
                              {customerInfo.phone && (
                                <span className="flex items-center gap-1" dir="ltr">
                                  📞 {customerInfo.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {getStatusBadge(offer.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{offer.start_date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{offer.duration_months} شهر</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>{offer.billboards_count} لوحة</span>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-primary">
                          <DollarSign className="h-4 w-4" />
                          <span>{offer.total?.toLocaleString('ar-LY')}</span>
                          <span className="text-xs">{CURRENCIES.find(c => c.code === offer.currency)?.symbol || 'د.ل'}</span>
                        </div>
                      </div>
                      
                      {/* Installation, Print costs & Operating fee info */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {offer.installation_cost !== undefined && offer.installation_cost > 0 && (
                          <Badge variant="outline" className={offer.installation_enabled ? 'border-orange-500/30 text-orange-600' : 'border-muted text-muted-foreground line-through'}>
                            <Wrench className="h-3 w-3 ml-1" />
                            تركيب: {offer.installation_cost.toLocaleString('ar-LY')}
                          </Badge>
                        )}
                        {offer.print_cost !== undefined && offer.print_cost > 0 && offer.print_cost_enabled && (
                          <Badge variant="outline" className="border-blue-500/30 text-blue-600">
                            <Printer className="h-3 w-3 ml-1" />
                            طباعة: {offer.print_cost.toLocaleString('ar-LY')}
                          </Badge>
                        )}
                        {offer.operating_fee_rate !== undefined && offer.operating_fee_rate > 0 && (
                          <Badge variant="outline" className="border-green-500/30 text-green-600">
                            <TrendingUp className="h-3 w-3 ml-1" />
                            تشغيل: {offer.operating_fee_rate}%
                            {offer.operating_fee ? ` (${offer.operating_fee.toLocaleString('ar-LY')})` : ''}
                          </Badge>
                        )}
                      </div>
                      
                      <Separator />
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditOffer(offer)}
                          className="flex-1 gap-1 hover:bg-primary/10 hover:border-primary/30"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          تعديل
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const billboards = (() => {
                              try {
                                return JSON.parse(offer.billboards_data || '[]');
                              } catch { return []; }
                            })();
                            setSelectedOfferForPrint({
                              id: offer.offer_number,
                              offer_number: offer.offer_number,
                              Contract_Number: offer.offer_number,
                              is_offer: true,
                              customer_name: offer.customer_name,
                              'Customer Name': offer.customer_name,
                              'Ad Type': offer.ad_type || 'عرض سعر',
                              start_date: offer.start_date,
                              'Contract Date': offer.start_date,
                              end_date: offer.end_date,
                              'End Date': offer.end_date,
                              Total: offer.total,
                              'Total Rent': offer.total,
                              Discount: offer.discount || 0,
                              installation_cost: offer.installation_cost || 0,
                              installation_enabled: offer.installation_enabled,
                              print_cost_enabled: offer.print_cost_enabled,
                              print_cost: offer.print_cost || 0,
                              print_price_per_meter: offer.print_price_per_meter,
                              billboard_ids: billboards.map((b: any) => b.ID || b.id).join(','),
                              billboard_prices: offer.billboard_prices,
                              installments_data: offer.installments_data,
                              contract_currency: offer.currency || 'LYD',
                              exchange_rate: String(offer.exchange_rate || 1),
                              operating_fee_rate: offer.operating_fee_rate || 3,
                            });
                            setPdfDialogOpen(true);
                          }}
                          className="gap-1 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyOffer(offer)}
                          className="gap-1 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-600"
                          title="نسخ العرض"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenConvertDialog(offer)}
                          disabled={offer.status === 'converted'}
                          className="gap-1 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-600"
                          title="تحويل لعقد"
                        >
                          <FileOutput className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-right">رقم العرض</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">تاريخ البداية</TableHead>
                      <TableHead className="text-right">المدة</TableHead>
                      <TableHead className="text-right">عدد اللوحات</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((offer) => (
                      <TableRow key={offer.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">#{offer.offer_number}</TableCell>
                        <TableCell>{offer.customer_name}</TableCell>
                        <TableCell>{offer.start_date}</TableCell>
                        <TableCell>{offer.duration_months} شهر</TableCell>
                        <TableCell>{offer.billboards_count}</TableCell>
                        <TableCell className="font-semibold">
                          {offer.total?.toLocaleString('ar-LY')} {CURRENCIES.find(c => c.code === offer.currency)?.symbol || 'د.ل'}
                        </TableCell>
                        <TableCell>{getStatusBadge(offer.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditOffer(offer)} title="تعديل">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyOffer(offer)} title="نسخ">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenConvertDialog(offer)} disabled={offer.status === 'converted'} title="تحويل لعقد">
                              <FileOutput className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteOffer(offer.id)} title="حذف">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Create/Edit Offer Tab - Enhanced Layout */}
          <TabsContent value="create" className="space-y-6 mt-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main Content */}
              <div className="flex-1 space-y-6">
                {/* Date and Duration Card */}
                <Card className="border-primary/30 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                      تاريخ ومدة العرض
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">تاريخ البداية</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">
                          اللوحات المؤجرة تظهر إذا انتهت قبل هذا التاريخ
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">المدة (شهور)</Label>
                        <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {m === 12 ? 'سنة كاملة' : `${m} شهر`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">تاريخ النهاية</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">العملة</Label>
                        <Select value={contractCurrency} onValueChange={setContractCurrency}>
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name} ({c.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {contractCurrency !== 'LYD' && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <Label className="text-sm">سعر الصرف</Label>
                        <Input
                          type="number"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(Number(e.target.value))}
                          className="w-40 mt-1 bg-background"
                          step="0.01"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Selected Billboards - Using SelectedBillboardsCard component */}
                <div className="space-y-3">
                  {/* زر إزالة اللوحات غير المتاحة - يظهر في إنشاء وتعديل العرض */}
                  {selected.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveUnavailableBillboards}
                        className="gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        فحص وإزالة اللوحات غير المتاحة
                      </Button>
                    </div>
                  )}
                  <SelectedBillboardsCard
                    selected={selected}
                    billboards={billboards}
                    onRemoveSelected={(id) => setSelected(prev => prev.filter(x => x !== id))}
                    calculateBillboardPrice={calculateBillboardPrice}
                    installationDetails={installationDetails}
                    pricingMode="months"
                    durationMonths={durationMonths}
                    durationDays={0}
                    currencySymbol={currentCurrency.symbol}
                    totalDiscount={discount}
                    discountType="amount"
                    discountValue={discount}
                    customerCategory={pricingCategory}
                  />
                </div>

                {/* Billboard Selection */}
                <Card className="border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Search className="h-5 w-5 text-primary" />
                        اللوحات المتاحة ({displayedBillboards.length})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'map' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('map')}
                        >
                          <MapIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="بحث عن لوحة..."
                          value={bbSearchQuery}
                          onChange={(e) => setBbSearchQuery(e.target.value)}
                          className="pr-10 bg-background"
                        />
                      </div>
                      <Select value={cityFilter} onValueChange={setCityFilter}>
                        <SelectTrigger className="w-[150px] bg-background">
                          <SelectValue placeholder="المدينة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المدن</SelectItem>
                          {cities.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={sizeFilter} onValueChange={setSizeFilter}>
                        <SelectTrigger className="w-[150px] bg-background">
                          <SelectValue placeholder="المقاس" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المقاسات</SelectItem>
                          {sizes.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {viewMode === 'map' ? (
                      <div className="h-[500px] rounded-lg overflow-hidden border">
                        <InteractiveMap
                          billboards={displayedBillboards}
                          onImageView={() => {}}
                          selectedBillboards={new Set(selected)}
                          onToggleSelection={(id) => {
                            const billboard = billboards.find((b: any) => String(b.ID) === id);
                            if (billboard) toggleSelect(billboard);
                          }}
                        />
                      </div>
                    ) : loading ? (
                      <div className="text-center py-10">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">جاري التحميل...</p>
                      </div>
                    ) : displayedBillboards.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto opacity-30 mb-2" />
                        لا توجد لوحات متاحة
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                          {displayedBillboards.map((b: any) => {
                            const isSelected = selected.includes(String(b.ID));
                            const isRented = b.Status !== 'متاح' && b.Status !== 'available';
                            
                            return (
                              <Card
                                key={b.ID}
                                className={`overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md ${
                                  isSelected ? 'ring-2 ring-primary shadow-primary/20' : ''
                                } ${isRented ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                                onClick={() => toggleSelect(b)}
                              >
                                <CardContent className="p-0">
                                  <div className="relative h-32 overflow-hidden">
                                    <BillboardImage 
                                      billboard={b} 
                                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                                      alt={b.Billboard_Name}
                                    />
                                    {isRented && (
                                      <Badge className="absolute top-2 right-2 bg-orange-500 text-white">
                                        متاحة من {b.Rent_End_Date}
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-lg" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div className="font-semibold truncate">{b.Billboard_Name}</div>
                                    <div className="text-xs text-muted-foreground">{b.City} • {b.Size}</div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">
                                        {calculateBillboardPrice(b).toLocaleString('ar-LY')} {currentCurrency.symbol}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant={isSelected ? 'destructive' : 'outline'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSelect(b);
                                        }}
                                      >
                                        {isSelected ? 'إزالة' : 'إضافة'}
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="w-full lg:w-[400px] space-y-4">
                {/* Customer Info */}
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
                  customerCompany={selectedCustomerCompany}
                  customerPhone={selectedCustomerPhone}
                />

                {/* Notes */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      ملاحظات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="ملاحظات إضافية على العرض..."
                      rows={3}
                      className="resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Installation & Print Costs */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      إعدادات التكاليف
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Installation Toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label htmlFor="installation-enabled" className="flex items-center gap-2 cursor-pointer">
                        <Wrench className="h-4 w-4 text-primary" />
                        تفعيل التركيب
                      </Label>
                      <Switch
                        id="installation-enabled"
                        checked={installationEnabled}
                        onCheckedChange={setInstallationEnabled}
                      />
                    </div>
                    {installationEnabled && (
                      <>
                        {/* Include installation in price toggle */}
                        <div className="flex items-center justify-between p-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                          <Label htmlFor="include-installation" className="text-xs cursor-pointer">
                            تضمين التركيب في سعر اللوحة (مجاني للزبون)
                          </Label>
                          <Switch
                            id="include-installation"
                            checked={includeInstallationInPrice}
                            onCheckedChange={setIncludeInstallationInPrice}
                          />
                        </div>
                        
                        {installationCost > 0 && (
                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                              <span>إجمالي تكلفة التركيب:</span>
                              <span className="text-primary">{installationCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                            </div>
                            {includeInstallationInPrice && (
                              <div className="text-xs text-green-600 bg-green-500/10 p-1 rounded text-center">
                                مضمنة في سعر اللوحة (مجانية للزبون)
                              </div>
                            )}
                            {/* Installation Details by Size with unit price */}
                            {installationDetails.length > 0 && (
                              <div className="space-y-1 border-t pt-2 mt-2">
                                <p className="text-xs text-muted-foreground mb-1">تفاصيل التركيب حسب المقاس:</p>
                                {Object.entries(
                                  installationDetails.reduce((acc: any, detail: any) => {
                                    const size = detail.size || 'غير محدد';
                                    if (!acc[size]) {
                                      acc[size] = { count: 0, totalCost: 0, unitCost: detail.installationPrice || 0 };
                                    }
                                    acc[size].count += 1;
                                    acc[size].totalCost += detail.installationPrice || 0;
                                    return acc;
                                  }, {})
                                ).map(([size, info]: [string, any]) => (
                                  <div key={size} className="flex justify-between text-xs bg-background/50 p-1.5 rounded">
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">{size}</span>
                                      <span className="text-muted-foreground">({info.count} لوحة × {(info.totalCost / info.count).toLocaleString('ar-LY')})</span>
                                    </span>
                                    <span className="text-primary font-medium">{info.totalCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Print Cost Toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label htmlFor="print-cost-enabled" className="flex items-center gap-2 cursor-pointer">
                        <Printer className="h-4 w-4 text-blue-500" />
                        تفعيل الطباعة
                      </Label>
                      <Switch
                        id="print-cost-enabled"
                        checked={printCostEnabled}
                        onCheckedChange={setPrintCostEnabled}
                      />
                    </div>
                    {printCostEnabled && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">سعر المتر:</Label>
                          <Input
                            type="number"
                            value={printPricePerMeter}
                            onChange={(e) => setPrintPricePerMeter(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">{currentCurrency.symbol}/م²</span>
                        </div>
                        
                        {/* Include print in billboard price toggle */}
                        <div className="flex items-center justify-between p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                          <Label htmlFor="include-print" className="text-xs cursor-pointer">
                            تضمين الطباعة في سعر اللوحة
                          </Label>
                          <Switch
                            id="include-print"
                            checked={includePrintInBillboardPrice}
                            onCheckedChange={setIncludePrintInBillboardPrice}
                          />
                        </div>
                        
                        {printCost > 0 && (
                          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                              <span>إجمالي تكلفة الطباعة:</span>
                              <span className="text-blue-600">{printCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                            </div>
                            {includePrintInBillboardPrice && (
                              <div className="text-xs text-green-600 bg-green-500/10 p-1 rounded text-center">
                                مضمنة في سعر اللوحة (مجانية للزبون)
                              </div>
                            )}
                            {/* Print Details by Size with unit price */}
                            {printDetails.length > 0 && (
                              <div className="space-y-1 border-t pt-2 mt-2">
                                <p className="text-xs text-muted-foreground mb-1">تفاصيل الطباعة حسب المقاس:</p>
                                {Object.entries(
                                  printDetails.reduce((acc: any, detail: any) => {
                                    const size = detail.size || 'غير محدد';
                                    if (!acc[size]) {
                                      acc[size] = { count: 0, totalArea: 0, totalCost: 0, unitArea: detail.area || 0 };
                                    }
                                    acc[size].count += 1;
                                    acc[size].totalArea += detail.area || 0;
                                    acc[size].totalCost += detail.printCost || 0;
                                    return acc;
                                  }, {})
                                ).map(([size, info]: [string, any]) => (
                                  <div key={size} className="flex justify-between text-xs bg-background/50 p-1.5 rounded">
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">{size}</span>
                                      <span className="text-muted-foreground">
                                        ({info.count} لوحة × {(info.totalArea / info.count).toFixed(1)} م² × {printPricePerMeter})
                                      </span>
                                    </span>
                                    <span className="text-blue-600 font-medium">{info.totalCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cost Summary */}
                <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/30 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      ملخص التكاليف
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">عدد اللوحات:</span>
                      <span className="font-medium">{selected.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المدة:</span>
                      <span className="font-medium">{durationMonths} شهر</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">إيجار اللوحات:</span>
                      <span className="font-medium">{totalBeforeDiscount.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">- الخصم:</span>
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className="w-32 text-left h-8"
                      />
                    </div>
                    
                    {/* التركيب */}
                    {installationEnabled && installationCost > 0 && (
                      <div className={`flex justify-between text-sm ${includeInstallationInPrice ? 'text-green-600' : 'text-orange-600'}`}>
                        <span>{includeInstallationInPrice ? '- التركيب (مجاني):' : '+ التركيب:'}</span>
                        <span className="font-medium">{installationCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                      </div>
                    )}
                    
                    {/* الطباعة */}
                    {printCostEnabled && printCost > 0 && (
                      <div className={`flex justify-between text-sm ${includePrintInBillboardPrice ? 'text-green-600' : 'text-blue-600'}`}>
                        <span>{includePrintInBillboardPrice ? '- الطباعة (مجانية):' : '+ الطباعة:'}</span>
                        <span className="font-medium">{printCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                      </div>
                    )}
                    
                    <Separator />
                    
                    {/* صافي الإيجار */}
                    <div className="flex justify-between text-sm bg-primary/10 rounded-lg px-3 py-2 -mx-1">
                      <span className="font-medium text-primary">صافي الإيجار:</span>
                      <span className="font-bold text-primary">{netRental.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                    </div>
                    
                    {/* Operating Fee - يحسب من صافي الإيجار */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        نسبة التشغيل (من صافي الإيجار):
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={operatingFeeRate}
                          onChange={(e) => setOperatingFeeRate(Number(e.target.value))}
                          className="w-16 text-center h-8"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs text-muted-foreground">% = {operatingFee.toLocaleString('ar-LY')}</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-bold">الإجمالي النهائي:</span>
                      <span className="text-xl font-bold text-primary">{grandTotal.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Installments Manager */}
                {selected.length > 0 && grandTotal > 0 && (
                  <InstallmentsManager
                    installments={installments}
                    finalTotal={grandTotal}
                    startDate={startDate}
                    onDistributeEvenly={handleDistributeInstallments}
                    onDistributeWithInterval={handleDistributeWithInterval}
                    onApplyUnequalDistribution={(payments) => {
                      const newInstallments = payments.map((p, i) => ({
                        amount: p.amount,
                        paymentType: p.paymentType || 'شهري',
                        description: p.description || `الدفعة ${i + 1}`,
                        dueDate: p.dueDate,
                      }));
                      setInstallments(newInstallments);
                    }}
                    onAddInstallment={() => setInstallments([...installments, { amount: 0, paymentType: 'شهري', description: '', dueDate: '' }])}
                    onRemoveInstallment={(index) => setInstallments(installments.filter((_, i) => i !== index))}
                    onUpdateInstallment={(index, field, value) => {
                      const updated = [...installments];
                      (updated[index] as any)[field] = value;
                      setInstallments(updated);
                    }}
                    onClearAll={() => setInstallments([])}
                  />
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 border-primary/30 hover:bg-primary/10" 
                    onClick={() => {
                      setSelectedOfferForPrint({
                        id: editingOffer?.offer_number || 0,
                        offer_number: editingOffer?.offer_number || 0,
                        Contract_Number: editingOffer?.offer_number || 0,
                        is_offer: true,
                        customer_name: customerName,
                        'Customer Name': customerName,
                        'Ad Type': adType || 'عرض سعر',
                        start_date: startDate,
                        'Contract Date': startDate,
                        end_date: endDate,
                        'End Date': endDate,
                        Total: grandTotal,
                        'Total Rent': grandTotal,
                        Discount: discount,
                        installation_cost: installationEnabled ? installationCost : 0,
                        installation_enabled: installationEnabled,
                        print_cost_enabled: printCostEnabled,
                        print_cost: printCost,
                        print_price_per_meter: printPricePerMeter,
                        billboard_ids: selected.join(','),
                        installments_data: JSON.stringify(installments),
                        customer_category: pricingCategory,
                        contract_currency: contractCurrency,
                        exchange_rate: String(exchangeRate),
                        operating_fee_rate: operatingFeeRate,
                        billboard_prices: JSON.stringify(selectedBillboards.map((b: any) => ({
                          billboardId: b.ID,
                          finalPrice: calculateBillboardPrice(b)
                        }))),
                      });
                      setPdfDialogOpen(true);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    طباعة العرض
                  </Button>
                  <Button 
                    onClick={handleSaveOffer} 
                    disabled={saving} 
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    <Sparkles className="h-4 w-4" />
                    {saving ? 'جاري الحفظ...' : editingOffer ? 'تحديث العرض' : 'حفظ العرض'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* PDF Dialog */}
        <ContractPDFDialog
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          contract={selectedOfferForPrint}
        />

        {/* Convert to Contract Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileOutput className="h-5 w-5 text-primary" />
                تحويل العرض إلى عقد
              </DialogTitle>
              <DialogDescription>
                تحقق من توفر اللوحات قبل التحويل - قد تكون بعض اللوحات قد تم تأجيرها منذ إنشاء العرض
              </DialogDescription>
            </DialogHeader>
            
            {loadingBillboardStatus ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="flex-1 px-1">
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                      <CardContent className="p-4 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-600">{offerBillboardsStatus.available.length}</p>
                        <p className="text-sm text-green-600/80">لوحات متاحة</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                      <CardContent className="p-4 text-center">
                        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-600">{offerBillboardsStatus.unavailable.length}</p>
                        <p className="text-sm text-red-600/80">لوحات غير متاحة</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-primary">{offerBillboardsStatus.available.length + offerBillboardsStatus.unavailable.length}</p>
                        <p className="text-sm text-primary/80">إجمالي اللوحات</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Available Billboards */}
                  {offerBillboardsStatus.available.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-green-600 flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4" />
                        اللوحات المتاحة للتحويل
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {offerBillboardsStatus.available.map((b: any) => (
                          <Card key={b.ID} className="overflow-hidden border-green-200 bg-green-50/50 dark:bg-green-950/20">
                            <CardContent className="p-3 flex items-center gap-3">
                              {b.Image_URL && (
                                <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{b.Billboard_Name}</p>
                                <p className="text-xs text-muted-foreground">{b.City} • {b.Size}</p>
                                <p className="text-sm font-semibold text-green-600">{b.offerPrice?.toLocaleString('ar-LY')} د.ل</p>
                              </div>
                              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unavailable Billboards */}
                  {offerBillboardsStatus.unavailable.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-600 flex items-center gap-2 mb-3">
                        <XCircle className="h-4 w-4" />
                        اللوحات غير المتاحة حالياً
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {offerBillboardsStatus.unavailable.map((b: any) => (
                          <Card key={b.ID} className="overflow-hidden border-red-200 bg-red-50/50 dark:bg-red-950/20">
                            <CardContent className="p-3 flex items-center gap-3">
                              {b.Image_URL && (
                                <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover opacity-60" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{b.Billboard_Name}</p>
                                <p className="text-xs text-muted-foreground">{b.City} • {b.Size}</p>
                                <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>مؤجرة حتى {b.rentEndDate}</span>
                                </div>
                                {b.currentCustomer && (
                                  <p className="text-xs text-muted-foreground">الزبون: {b.currentCustomer}</p>
                                )}
                              </div>
                              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            
            <DialogFooter className="gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
                إلغاء
              </Button>
              {offerBillboardsStatus.available.length > 0 && offerBillboardsStatus.unavailable.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => handleConvertToContract(true)}
                  className="gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تحويل المتاحة فقط ({offerBillboardsStatus.available.length})
                </Button>
              )}
              <Button
                onClick={() => handleConvertToContract(false)}
                disabled={offerBillboardsStatus.available.length === 0}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80"
              >
                <FileOutput className="h-4 w-4" />
                إنشاء عقد والانتقال للتعديل
              </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Removed Billboards Dialog */}
        <Dialog open={showRemovedDialog} onOpenChange={setShowRemovedDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                لوحات تم إزالتها من العرض
              </DialogTitle>
              <DialogDescription>
                تم إزالة اللوحات التالية لأنها أصبحت غير متاحة (تم تأجيرها)
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {removedBillboards.map((b: any) => (
                  <Card key={b.ID} className="overflow-hidden border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      {b.Image_URL && (
                        <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover opacity-60" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{b.Billboard_Name}</p>
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Hash className="h-3 w-3 ml-1" />
                            {b.ID}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[b.City, b.Municipality, b.District].filter(Boolean).join(' • ')} • {b.Size}
                        </p>
                        {b.Nearest_Landmark && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapIcon className="h-3 w-3" />
                            أقرب نقطة دالة: {b.Nearest_Landmark}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{b.reason}</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground line-through mt-1">
                          السعر في العرض: {b.offerPrice?.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button onClick={() => setShowRemovedDialog(false)}>
                حسناً، تم الفهم
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
