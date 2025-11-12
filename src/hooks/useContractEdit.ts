import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateInstallationCostFromIds } from '@/services/installationService';

interface EditFormData {
  customerName: string;
  customerId: string | null;
  adType: string;
  pricingCategory: string;
  startDate: string;
  endDate: string;
  pricingMode: 'months' | 'days';
  durationMonths: number;
  durationDays: number;
  rentCost: number;
  discountType: 'percent' | 'amount';
  discountValue: number;
  operatingFeeRate: number;
}

interface EditInstallment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

export function useContractEdit(contractId: string) {
  const [formData, setFormData] = useState<EditFormData>({
    customerName: '',
    customerId: null,
    adType: '',
    pricingCategory: 'عادي',
    startDate: '',
    endDate: '',
    pricingMode: 'months',
    durationMonths: 3,
    durationDays: 0,
    rentCost: 0,
    discountType: 'percent',
    discountValue: 0,
    operatingFeeRate: 3
  });

  const [selectedBillboards, setSelectedBillboards] = useState<string[]>([]);
  const [installments, setInstallments] = useState<EditInstallment[]>([]);
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [originalContract, setOriginalContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load contract data
  useEffect(() => {
    if (!contractId) return;

    const loadContractData = async () => {
      try {
        setIsLoading(true);
        
        // Load contract from database
        const { data: contract, error } = await supabase
          .from('Contract')
          .select('*')
          .eq('Contract_Number', Number(contractId))
          .single();

        if (error) {
          console.error('Error loading contract:', error);
          return;
        }

        if (!contract) {
          console.error('Contract not found');
          return;
        }

        setOriginalContract(contract as any);

        // Update form data
        const contractData = contract as any;
        setFormData({
          customerName: contractData['Customer Name'] || '',
          customerId: contractData.customer_id || null,
          adType: contractData['Ad Type'] || '',
          pricingCategory: contractData.customer_category || 'عادي',
          startDate: contractData['Contract Date'] || '',
          endDate: contractData['End Date'] || '',
          pricingMode: 'months',
          durationMonths: 3,
          durationDays: 0,
          rentCost: contractData['Total Rent'] || 0,
          discountType: 'percent',
          discountValue: contractData.Discount || 0,
          operatingFeeRate: contract.operating_fee_rate || 3
        });

        // Set selected billboards
        if (contract.billboard_ids && Array.isArray(contract.billboard_ids)) {
          setSelectedBillboards(contract.billboard_ids);
        }

        // Set installments
        if (contract.installments_data && Array.isArray(contract.installments_data)) {
          setInstallments(contract.installments_data);
        }

      } catch (error) {
        console.error('Error loading contract data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadContractData();
  }, [contractId]);

  // Load pricing data
  useEffect(() => {
    const loadPricingData = async () => {
      try {
        const { data, error } = await supabase
          .from('pricing')
          .select('*')
          .order('size', { ascending: true });

        if (!error && Array.isArray(data)) {
          setPricingData(data);
        }
      } catch (e) {
        console.warn('Failed to load pricing data');
      }
    };

    loadPricingData();
  }, []);

  // Calculate installation cost when selected billboards change
  useEffect(() => {
    if (selectedBillboards.length > 0) {
      const calculateCost = async () => {
        try {
          const result = await calculateInstallationCostFromIds(selectedBillboards);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation cost:', e);
          setInstallationCost(0);
          setInstallationDetails([]);
        }
      };

      calculateCost();
    } else {
      setInstallationCost(0);
      setInstallationDetails([]);
    }
  }, [selectedBillboards]);

  // Auto-calculate end date when start date or duration changes
  useEffect(() => {
    if (!formData.startDate) return;
    
    const startDate = new Date(formData.startDate);
    const endDate = new Date(startDate);
    
    if (formData.pricingMode === 'months') {
      const days = Math.max(0, Number(formData.durationMonths || 0)) * 30;
      endDate.setDate(endDate.getDate() + days);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      endDate.setDate(endDate.getDate() + days);
    }
    
    const isoDate = endDate.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, endDate: isoDate }));
  }, [formData.startDate, formData.durationMonths, formData.durationDays, formData.pricingMode]);

  const updateFormData = (updates: Partial<EditFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        // Recalculate due date if payment type changed
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, index);
        }
        return updated;
      }
      return inst;
    }));
  };

  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || formData.startDate;
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
      return formData.endDate || '';
    }
    
    return date.toISOString().split('T')[0];
  };

  // ✅ FIXED: Use size_id for accurate price matching
  const getPriceFromDatabase = (sizeId: number | null, level: any, customer: string, months: number): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      p.billboard_level === level && 
      p.customer_category === customer
    );
    
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
        return Number(dbRow[column]) || 0;
      }
    }
    
    return null;
  };

  const getDailyPriceFromDatabase = (sizeId: number | null, level: any, customer: string): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      p.billboard_level === level && 
      p.customer_category === customer
    );
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      return Number(dbRow.one_day) || 0;
    }
    
    return null;
  };

  return {
    formData,
    updateFormData,
    selectedBillboards,
    setSelectedBillboards,
    installments,
    setInstallments,
    updateInstallment,
    installationCost,
    installationDetails,
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateDueDate,
    originalContract,
    isLoading
  };
}