// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useBillboardContract = () => {
  const navigate = useNavigate();
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [availableContracts, setAvailableContracts] = useState<any[]>([]);
  const [contractAction, setContractAction] = useState<'add' | 'remove'>('add');
  const [contractSearchQuery, setContractSearchQuery] = useState('');

  // Helper function to check if contract is expired
  const isContractExpired = (endDate: string | null) => {
    if (!endDate) return false;
    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      return endDateObj < today;
    } catch {
      return false;
    }
  };

  // Check if billboard has active contract
  const hasActiveContract = (billboard: any) => {
    const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
    const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
    return hasContract && !contractExpired;
  };

  // Load available contracts with search functionality
  const loadAvailableContracts = async (searchTerm: string = '') => {
    try {
      console.log('🔍 Loading available contracts, search term:', searchTerm);
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date"')
        .order('Contract_Number', { ascending: false });

      if (searchTerm.trim()) {
        // ✅ بحث في رقم العقد واسم العميل ونوع الإعلان
        const searchPattern = `%${searchTerm}%`;
        query = query.or(`Contract_Number.ilike.${searchPattern},"Customer Name".ilike.${searchPattern},"Ad Type".ilike.${searchPattern}`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error loading contracts:', error);
        throw error;
      }
      
      console.log('✅ Loaded contracts:', data?.length || 0);
      setAvailableContracts(data || []);
    } catch (error) {
      console.error('❌ Error loading contracts:', error);
      toast.error('فشل في تحميل العقود');
    }
  };

  // Open contract management dialog
  const openContractDialog = (billboard: any) => {
    setSelectedBillboard(billboard);
    const hasContract = hasActiveContract(billboard);
    setContractAction(hasContract ? 'remove' : 'add');
    setContractDialogOpen(true);
    setContractSearchQuery('');
    if (!hasContract) {
      loadAvailableContracts();
    }
  };

  // Add billboard to contract
  const addBillboardToContract = async (contractNumber: string, loadBillboards: () => Promise<void>) => {
    if (!selectedBillboard) {
      console.error('❌ No billboard selected');
      toast.error('لم يتم اختيار لوحة');
      return;
    }
    
    try {
      // ✅ استخرج ID اللوحة بطريقة محسنة
      const billboardId = selectedBillboard.ID || selectedBillboard.id;
      
      if (!billboardId) {
        console.error('❌ Billboard ID not found:', selectedBillboard);
        toast.error('معرف اللوحة غير صحيح');
        return;
      }
      
      console.log('🔗 Adding billboard to contract:', { billboardId, contractNumber });
      
      const { data: contractData, error: contractError } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', Number(contractNumber))
        .single();
      
      if (contractError) {
        console.error('❌ Contract fetch error:', contractError);
        throw contractError;
      }
      
      console.log('✅ Contract data:', contractData);
      
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Contract_Number: Number(contractNumber),
          Customer_Name: contractData['Customer Name'],
          Ad_Type: contractData['Ad Type'],
          Rent_Start_Date: contractData['Contract Date'],
          Rent_End_Date: contractData['End Date'],
          Status: 'rented'
        })
        .eq('ID', Number(billboardId));
      
      if (billboardError) {
        console.error('❌ Billboard update error:', billboardError);
        throw billboardError;
      }
      
      console.log('✅ Billboard added to contract successfully');
      toast.success(`تم إضافة اللوحة إلى العقد رقم ${contractNumber}`);
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('❌ Error adding billboard to contract:', error);
      toast.error(`فشل في إضافة اللوحة إلى العقد: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // Remove billboard from contract
  const removeBillboardFromContract = async (loadBillboards: () => Promise<void>) => {
    if (!selectedBillboard) {
      console.error('❌ No billboard selected');
      toast.error('لم يتم اختيار لوحة');
      return;
    }
    
    try {
      // ✅ استخرج ID اللوحة بطريقة محسنة
      const billboardId = selectedBillboard.ID || selectedBillboard.id;
      
      if (!billboardId) {
        console.error('❌ Billboard ID not found:', selectedBillboard);
        toast.error('معرف اللوحة غير صحيح');
        return;
      }
      
      console.log('🔗 Removing billboard from contract:', { billboardId });
      
      const { error } = await supabase
        .from('billboards')
        .update({
          Contract_Number: null,
          Customer_Name: null,
          Ad_Type: null,
          Rent_Start_Date: null,
          Rent_End_Date: null,
          Status: 'available'
        })
        .eq('ID', Number(billboardId));
      
      if (error) {
        console.error('❌ Billboard update error:', error);
        throw error;
      }
      
      console.log('✅ Billboard removed from contract successfully');
      toast.success('تم إزالة اللوحة من العقد');
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('❌ Error removing billboard from contract:', error);
      toast.error(`فشل في إزالة اللوحة من العقد: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // Create new contract for billboard
  const createNewContract = () => {
    if (!selectedBillboard) return;
    
    setContractDialogOpen(false);
    
    const possibleRoutes = [
      '/admin/contracts',
      '/contracts', 
      '/admin/contract',
      '/contract'
    ];
    
    const contractState = {
      preSelectedBillboards: [selectedBillboard.ID || selectedBillboard.id],
      billboardData: {
        id: selectedBillboard.ID || selectedBillboard.id,
        name: selectedBillboard.Billboard_Name || selectedBillboard.name,
        municipality: selectedBillboard.Municipality || selectedBillboard.municipality,
        size: selectedBillboard.Size || selectedBillboard.size,
        location: selectedBillboard.Nearest_Landmark || selectedBillboard.location
      },
      action: 'create',
      autoAddBillboard: true
    };
    
    let navigationSuccessful = false;
    
    for (const route of possibleRoutes) {
      try {
        navigate(route, { state: contractState });
        navigationSuccessful = true;
        toast.success('تم توجيهك لصفحة إنشاء عقد جديد مع اللوحة المحددة');
        break;
      } catch (error) {
        console.warn(`Failed to navigate to ${route}:`, error);
        continue;
      }
    }
    
    if (!navigationSuccessful) {
      toast.error('فشل في فتح صفحة العقود. يرجى الذهاب يدوياً لصفحة العقود وإنشاء عقد جديد');
      console.error('All navigation attempts failed for contract creation');
    }
  };

  // Filter contracts based on search query
  const filteredContracts = availableContracts.filter(contract => {
    if (!contractSearchQuery.trim()) return true;
    const searchLower = contractSearchQuery.toLowerCase();
    return (
      String(contract.Contract_Number).toLowerCase().includes(searchLower) ||
      String(contract['Customer Name']).toLowerCase().includes(searchLower) ||
      String(contract['Ad Type']).toLowerCase().includes(searchLower)
    );
  });

  return {
    contractDialogOpen,
    setContractDialogOpen,
    selectedBillboard,
    contractAction,
    contractSearchQuery,
    setContractSearchQuery,
    filteredContracts,
    isContractExpired,
    hasActiveContract,
    openContractDialog,
    addBillboardToContract,
    removeBillboardFromContract,
    createNewContract,
    loadAvailableContracts
  };
};