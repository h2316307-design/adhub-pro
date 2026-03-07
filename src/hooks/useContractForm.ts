import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { calculateInstallationCostFromIds } from '@/services/installationService';

export interface ContractFormData {
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

export interface Installment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

export const useContractForm = (initialData?: Partial<ContractFormData>) => {
  // Form state
  const [formData, setFormData] = useState<ContractFormData>({
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
    operatingFeeRate: 3,
    ...initialData
  });

  // Selection and data
  const [selected, setSelected] = useState<string[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);

  // Installation cost
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);

  // Pricing data
  const [pricingData, setPricingData] = useState<any[]>([]);

  // Load pricing data
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

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
    if (!formData.startDate) return;
    const d = new Date(formData.startDate);
    const end = new Date(d);
    if (formData.pricingMode === 'months') {
      const days = Math.max(0, Number(formData.durationMonths || 0)) * 30;
      end.setDate(end.getDate() + days);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, endDate: iso }));
  }, [formData.startDate, formData.durationMonths, formData.durationDays, formData.pricingMode]);

  // ✅ FIXED: Price calculation functions using size_id
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

  // Calculate due date for installments
  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || formData.startDate;
    if (!baseDate) return '';
    const d = new Date(baseDate);
    
    if (paymentType === 'عند التوقيع') {
      return baseDate;
    } else if (paymentType === 'شهري') {
      d.setMonth(d.getMonth() + (index + 1));
    } else if (paymentType === 'شهرين') {
      d.setMonth(d.getMonth() + (index + 1) * 2);
    } else if (paymentType === 'ثلاثة أشهر') {
      d.setMonth(d.getMonth() + (index + 1) * 3);
    } else if (paymentType === 'عند التركيب') {
      d.setDate(d.getDate() + 7);
    } else if (paymentType === 'نهاية العقد') {
      return formData.endDate || '';
    }
    
    return d.toISOString().split('T')[0];
  };

  // Update form data
  const updateFormData = (updates: Partial<ContractFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Update installment
  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, index);
        }
        return updated;
      }
      return inst;
    }));
  };

  return {
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
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateDueDate
  };
};