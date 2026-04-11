import { useState, useEffect, useMemo, lazy, Suspense, startTransition } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { BillboardFilters } from '@/components/BillboardFilters';
import { BillboardActions } from '@/components/BillboardActions';
import { BillboardAddDialog } from '@/components/billboards/BillboardAddDialog';
import { BillboardEditDialog } from '@/components/billboards/BillboardEditDialog';
import { BillboardSummaryCards } from '@/components/billboards/BillboardSummaryCards';
import { MaintenanceDialog } from '@/components/billboards/MaintenanceDialog';
import { BulkAddDialog, ExcelImportDialog, ExcelImageImportDialog } from '@/components/billboards/forms';
import { ContractManagementDialog } from '@/components/billboards/ContractManagementDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PrintFiltersDialog } from '@/components/billboards/PrintFiltersDialog';
import { BillboardPrintWithSelection } from '@/components/billboards/BillboardPrintWithSelection';
import { BillboardSelectionBar } from '@/components/billboards/BillboardSelectionBar';
import { useBillboardData } from '@/hooks/useBillboardData';
import { useBillboardForm } from '@/hooks/useBillboardForm';
import { useBillboardActions } from '@/hooks/useBillboardActions';
import { useBillboardExport } from '@/hooks/useBillboardExport';
import { useBillboardContract } from '@/hooks/useBillboardContract';
import { isBillboardAvailable } from '@/utils/contractUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapSkeleton } from '@/components/Map/MapSkeleton';

// ✅ تحميل كسول للخريطة لتحسين الأداء + دعم التبديل بين Google / OSM
const AdminBillboardsMap = lazy(() => import('@/components/Map/AdminBillboardsMap'));

export default function Billboards() {
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const canEditBillboards = canEdit('billboards');
  const isMarketer = user?.role === 'marketer';
  const marketerCustomerId = user?.linkedCustomerId;
  const [currentPage, setCurrentPage] = useState(1);
  const [gridColumns, setGridColumns] = useState(260); // min card width in px
  const PAGE_SIZE = 24; // fixed page size

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([]);
  const [showSociet, setShowSociet] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedAdTypes, setSelectedAdTypes] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  const [selectedOwnerCompanies, setSelectedOwnerCompanies] = useState<string[]>([]);
  const [ownerCompanies, setOwnerCompanies] = useState<{id: string, name: string}[]>([]);

  // Load owner companies
  useEffect(() => {
    supabase.from('friend_companies').select('id, name').eq('company_type', 'own').order('name')
      .then(({ data }) => setOwnerCompanies(data || []));
  }, []);
  
  // ✅ Marketer: load billboard IDs from their customer's contracts
  const [marketerBillboardIds, setMarketerBillboardIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isMarketer || !marketerCustomerId) return;
    const loadMarketerBillboards = async () => {
      const { data } = await supabase
        .from('Contract')
        .select('billboard_ids')
        .eq('customer_id', marketerCustomerId);
      const ids = new Set<string>();
      data?.forEach((c: any) => {
        if (c.billboard_ids) {
          String(c.billboard_ids).split(',').forEach((id: string) => ids.add(id.trim()));
        }
      });
      setMarketerBillboardIds(ids);
    };
    loadMarketerBillboards();
  }, [isMarketer, marketerCustomerId]);

  // Collapsible states
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false); // ✅ مطوية افتراضياً لتحسين الأداء

  // Print filters
  const [printFiltersOpen, setPrintFiltersOpen] = useState(false);
  const [advancedPrintOpen, setAdvancedPrintOpen] = useState(false);
  
  // ✅ Bulk add and Excel import dialogs
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelImageImportOpen, setExcelImageImportOpen] = useState(false);
  // ✅ Billboard selection state
  // ✅ Billboard selection state
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const [printFilters, setPrintFilters] = useState({
    municipality: 'all',
    city: 'all',
    size: 'all',
    status: 'all',
    adType: 'all'
  });

  // Maintenance dialog state
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    status: '',
    type: '',
    description: '',
    priority: 'normal'
  });

  // Custom hooks
  const billboardData = useBillboardData();
  const billboardForm = useBillboardForm(billboardData.municipalities);
  const billboardActions = useBillboardActions();
  const billboardExport = useBillboardExport();
  const billboardContract = useBillboardContract();

  const { 
    billboards, 
    loading, 
    citiesList, 
    dbSizes, 
    dbMunicipalities, 
    dbAdTypes, 
    dbCustomers, 
    dbContractNumbers, 
    loadBillboards,
    updateBillboardVisibilityLocal,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    sortBillboardsBySize
  } = billboardData;

  const { isContractExpired, hasActiveContract } = billboardActions;
  // Listen for edit-billboard events from map popups (no page reload)
  useEffect(() => {
    const handler = (e: Event) => {
      const editId = (e as CustomEvent).detail;
      if (editId && billboards.length > 0) {
        const billboard = billboards.find((b: any) => String(b.ID) === String(editId));
        if (billboard) {
          billboardForm.setEditing(billboard);
        }
      }
    };
    
    const maintenanceHandler = (e: Event) => {
      const billboardId = (e as CustomEvent).detail;
      if (billboardId && billboards.length > 0) {
        const billboard = billboards.find((b: any) => String(b.ID) === String(billboardId));
        if (billboard) {
          setSelectedBillboard(billboard);
          setIsMaintenanceDialogOpen(true);
        }
      }
    };
    
    const visibilityHandler = async (e: Event) => {
      const billboardId = (e as CustomEvent).detail;
      if (billboardId && billboards.length > 0) {
        const billboard = billboards.find((b: any) => String(b.ID) === String(billboardId)) as any;
        if (billboard) {
          const previousValue = billboard.is_visible_in_available !== false;
          const newValue = !previousValue;

          // ✅ Optimistic update: update popup/card state instantly
          updateBillboardVisibilityLocal(billboard.ID, newValue);

          try {
            const { error } = await supabase
              .from('billboards')
              .update({ is_visible_in_available: newValue })
              .eq('ID', billboard.ID);
            if (error) throw error;

            toast.success(newValue ? 'تم إظهار اللوحة في المتاح' : 'تم إخفاء اللوحة من المتاح');
          } catch (error) {
            // ✅ Rollback optimistic update on failure
            updateBillboardVisibilityLocal(billboard.ID, previousValue);
            toast.error('حدث خطأ أثناء تحديث الحالة');
          }
        }
      }
    };
    
    const ownerChangeHandler = async (e: Event) => {
      const { billboardId, currentOwnCompanyId } = (e as CustomEvent).detail || {};
      if (!billboardId) return;
      // Open a simple prompt-like flow: fetch companies and show selection
      const { data: companies } = await supabase.from('friend_companies').select('id, name').eq('company_type', 'own').order('name');
      if (!companies || companies.length === 0) { toast.error('لا توجد شركات مالكة'); return; }
      
      const companyNames = companies.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      const choice = window.prompt(`اختر الشركة المالكة (أدخل الرقم):\n0. بدون شركة\n${companyNames}`);
      if (choice === null) return;
      
      const idx = parseInt(choice);
      const newCompanyId = idx === 0 ? null : companies[idx - 1]?.id;
      if (idx !== 0 && !newCompanyId) { toast.error('اختيار غير صحيح'); return; }
      
      const { error } = await supabase.from('billboards').update({ own_company_id: newCompanyId } as any).eq('ID', Number(billboardId));
      if (error) { toast.error('فشل التحديث'); return; }
      toast.success('تم تغيير الشركة المالكة');
      await loadBillboards({ silent: true });
    };
    
    window.addEventListener('edit-billboard', handler);
    window.addEventListener('billboard-maintenance', maintenanceHandler);
    window.addEventListener('billboard-toggle-visibility', visibilityHandler);
    window.addEventListener('changeOwnerCompany', ownerChangeHandler);
    return () => {
      window.removeEventListener('edit-billboard', handler);
      window.removeEventListener('billboard-maintenance', maintenanceHandler);
      window.removeEventListener('billboard-toggle-visibility', visibilityHandler);
      window.removeEventListener('changeOwnerCompany', ownerChangeHandler);
    };
  }, [billboards, loadBillboards, updateBillboardVisibilityLocal]);

  // ✅ ENHANCED: Better contract number extraction with multiple sources
  const getCurrentContractNumber = (billboard: any): string => {
    // Try multiple possible field names for contract numbers
    const contractNum = billboard.Contract_Number || 
                       billboard.contractNumber || 
                       billboard.contract_number ||
                       billboard.contract_id ||
                       (billboard.contracts && billboard.contracts[0]?.Contract_Number) ||
                       (billboard.contracts && billboard.contracts[0]?.contract_number) ||
                       (billboard.contracts && billboard.contracts[0]?.id) ||
                       '';
    
    const result = String(contractNum).trim();
    return result;
  };

  // Handle maintenance status update
  const handleMaintenanceSubmit = async () => {
    if (!selectedBillboard || !maintenanceForm.status) {
      toast.error('يرجى اختيار حالة الصيانة');
      return;
    }

    try {
      // تحديد القيم حسب حالة الصيانة
      const updateData: any = {
        maintenance_status: maintenanceForm.status,
        maintenance_date: new Date().toISOString(),
        maintenance_notes: maintenanceForm.description || null,
        maintenance_type: maintenanceForm.type || null,
        maintenance_priority: maintenanceForm.priority
      };

      // ✅ إذا كانت حالة الصيانة "تحتاج ازالة لغرض التطوير" أو "لم يتم التركيب" أو "تمت الإزالة"، تغيير Status إلى "إزالة"
      if (
        maintenanceForm.status === 'تحتاج ازالة لغرض التطوير' ||
        maintenanceForm.status === 'لم يتم التركيب' ||
        maintenanceForm.status === 'removed'
      ) {
        updateData.Status = 'إزالة';
      }

      const { error } = await supabase
        .from('billboards')
        .update(updateData)
        .eq('ID', selectedBillboard.ID);

      if (error) throw error;

      // Add maintenance history record if needed
      if (maintenanceForm.type && maintenanceForm.description) {
        await supabase
          .from('maintenance_history')
          .insert({
            billboard_id: selectedBillboard.ID,
            maintenance_type: maintenanceForm.type,
            description: maintenanceForm.description,
            priority: maintenanceForm.priority,
            maintenance_date: new Date().toISOString()
          });
      }

      toast.success(
        (maintenanceForm.status === 'تحتاج ازالة لغرض التطوير' || maintenanceForm.status === 'لم يتم التركيب')
          ? 'تم تغيير حالة اللوحة إلى "إزالة" ولن تظهر في اللوحات المتاحة'
          : 'تم تحديث حالة الصيانة بنجاح'
      );
      
      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({
        status: '',
        type: '',
        description: '',
        priority: 'normal'
      });
      loadBillboards();
    } catch (error) {
      console.error('Error updating maintenance status:', error);
      toast.error('فشل في تحديث حالة الصيانة');
    }
  };

  // حذف اللوحة باستخدام نافذة التأكيد من النظام
  const { confirm: systemConfirm } = useSystemDialog();

  const deleteBillboard = async (billboardId: number | string) => {
    try {
      const billboardName = billboards.find(b => (b.ID || b.id) == billboardId)?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      
      const confirmed = await systemConfirm({
        title: 'تأكيد حذف اللوحة',
        message: `هل تريد حذف "${billboardName}"?\n\nتحذير: هذا الإجراء لا يمكن التراجع عنه!`,
        variant: 'destructive',
        confirmText: 'حذف'
      });
      
      if (!confirmed) {
        return;
      }
      
      // ✅ ENHANCED: Better ID validation and conversion
      const id = Number(billboardId);
      if (!id || isNaN(id) || id <= 0) {
        toast.error('معرف اللوحة غير صحيح');
        console.error('❌ Invalid billboard ID:', billboardId);
        return;
      }

      // Deleting billboard
      
      // ✅ FINAL FIX: Use ONLY the correct field name "ID" (uppercase) from database
      const { error } = await supabase
        .from('billboards')
        .delete()
        .eq('ID', id);
        
      if (error) {
        console.error('❌ Delete error:', error);
        // ✅ ENHANCED: Better error handling with specific error messages
        if (error.code === '23503') {
          toast.error('لا يمكن حذف هذه اللوحة لأنها مرتبطة بعقود أو بيانات أخرى');
        } else if (error.code === '42703') {
          toast.error('خطأ في بنية قاعدة البيانات - يرجى الاتصال بالدعم الفني');
        } else if (error.code === 'PGRST116') {
          toast.error('لا توجد لوحة بهذا المعرف');
        } else {
          toast.error(`فشل في حذف اللوحة: ${error.message}`);
        }
        return;
      }
      
      // Deleted successfully
      toast.success(`تم حذف "${billboardName}" بنجاح`);
      await loadBillboards();
    } catch (error: any) {
      console.error('❌ Delete billboard error:', error);
      toast.error(error?.message || 'فشل في حذف اللوحة');
    }
  };

  // ✅ ENHANCED: Search function with support for billboard names and nearest landmark
  const enhancedSearchBillboards = (billboards: any[], query: string) => {
    if (!query.trim()) return billboards;
    
    const searchTerm = query.toLowerCase().trim();
    
    
    return billboards.filter((billboard) => {
      // ✅ Billboard name search with multiple field variations
      const billboardName = String(
        billboard.Billboard_Name || 
        billboard.billboardName || 
        billboard.billboard_name ||
        billboard.name ||
        ''
      ).toLowerCase();
      
      // ✅ ENHANCED: Nearest landmark search with multiple field variations
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
      
      // Municipality search
      const municipality = String(
        billboard.Municipality || 
        billboard.municipality || 
        billboard.Municipality_Name ||
        billboard.municipality_name ||
        ''
      ).toLowerCase();
      
      // City search
      const city = String(
        billboard.City || 
        billboard.city || 
        billboard.City_Name ||
        billboard.city_name ||
        ''
      ).toLowerCase();
      
      // Contract number search
      const contractNumber = String(getCurrentContractNumber(billboard)).toLowerCase();
      
      // Ad type search
      const adType = String(
        billboard.Ad_Type || 
        billboard.adType || 
        billboard.ad_type || 
        billboard.AdType || 
        (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || 
        ''
      ).toLowerCase();
      
      // Customer name search
      const customerName = String(
        billboard.Customer_Name || 
        billboard.clientName || 
        billboard.customer_name ||
        (billboard.contracts && billboard.contracts[0]?.['Customer Name']) || 
        ''
      ).toLowerCase();
      
      // Size search
      const size = String(
        billboard.Size || 
        billboard.size || 
        ''
      ).toLowerCase();
      
      // ✅ ENHANCED: Comprehensive search matching including nearest landmark
      const matches = billboardName.includes(searchTerm) ||
                     nearestLandmark.includes(searchTerm) ||
                     municipality.includes(searchTerm) ||
                     city.includes(searchTerm) ||
                     contractNumber.includes(searchTerm) ||
                     adType.includes(searchTerm) ||
                     customerName.includes(searchTerm) ||
                     size.includes(searchTerm);
      return matches;
    });
  };

  // ✅ ENHANCED: Enhanced filtering with "منتهي" status support
  const filteredBillboards = useMemo(() => {
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    const afterFilters = searched.filter((billboard) => {
      const statusValue = String(((billboard as any).Status ?? (billboard as any).status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintRaw = (billboard as any).maintenance_status ?? '';
      const maintenanceStatus = String(maintRaw).trim();
      
      // ✅ استبعاد اللوحات التي حالتها "إزالة" أو حالات صيانة خاصة فقط إذا لم يُختَر فلتر حالة
      const isRemoved = statusValue === 'إزالة' || statusLower === 'ازالة' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب';
      
      // إذا اختار المستخدم فلتر حالة معينة، لا نستبعد اللوحات - ندعهم يرونها حسب الفلتر
      if (isRemoved && selectedStatuses.length === 0) {
        return false;
      }

      // ✅ استبعاد اللوحات الصديقة المخفية من فلتر "متاحة" (إلا إذا اختار المستخدم فلتر "مخفية من المتاح")
      const isFriendHidden = !!(billboard as any).friend_company_id && (billboard as any).is_visible_in_available === false;
      if (isFriendHidden && selectedStatuses.length === 0) {
        return false;
      }
      
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date);
      
      const isAvailable = isBillboardAvailable(billboard as any);
      const isBooked = !isAvailable && (((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || hasContract) && !contractExpired);
      
      let isNearExpiry = false;
      const end = (billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date;
      if (end && !contractExpired) {
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          isNearExpiry = diffDays > 0 && diffDays <= 20;
        } catch {}
      }

      // ✅ NEW: Check if contract is expired (منتهي status)
      const isExpired = contractExpired && hasContract;
      
      // ✅ Check maintenance statuses
      const isNotInstalled = maintenanceStatus === 'لم يتم التركيب';
      const needsRemoval = maintenanceStatus === 'تحتاج ازالة لغرض التطوير';
      const isUnderMaintenance = maintenanceStatus === 'maintenance' || maintenanceStatus === 'repair_needed' || maintenanceStatus === 'out_of_service';
      const isDamaged = maintenanceStatus === 'متضررة اللوحة';
      const isRemovalStatus = isRemoved; // إزالة status
      
      // ✅ NEW: Check if hidden from available
      const isHiddenFromAvailable = (billboard as any).is_visible_in_available === false;
      
      // ✅ NEW: Check if friend billboard
      const isFriendBillboard = !!(billboard as any).friend_company_id;
      
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some(s => (
        (s === 'متاحة' && isAvailable) ||
        (s === 'محجوز' && isBooked) ||
        (s === 'قريبة الانتهاء' && isNearExpiry) ||
        (s === 'منتهي' && isExpired) ||
        (s === 'إزالة' && isRemovalStatus) ||
        (s === 'لم يتم التركيب' && isNotInstalled) ||
        (s === 'تحتاج ازالة لغرض التطوير' && needsRemoval) ||
        (s === 'قيد الصيانة' && isUnderMaintenance) ||
        (s === 'متضررة اللوحة' && isDamaged) ||
        (s === 'مخفية من المتاح' && isHiddenFromAvailable) ||
        (s === 'لوحات صديقة' && isFriendBillboard)
      ));
      
      const matchesCity = selectedCities.length === 0 || selectedCities.includes((billboard as any).City || billboard.city || '');
      const sizeVal = String((billboard as any).Size || billboard.size || '').trim();
      const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(sizeVal);
      const municipalityVal = String((billboard as any).Municipality || (billboard as any).municipality || '').trim();
      const matchesMunicipality = selectedMunicipalities.length === 0 || selectedMunicipalities.includes(municipalityVal);
      
      // ✅ NEW: District filter
      const districtVal = String((billboard as any).District || (billboard as any).district || '').trim();
      const matchesDistrict = selectedDistricts.length === 0 || selectedDistricts.includes(districtVal);
      
      // ✅ FIXED: Better ad type matching
      const adTypeVal = String(billboard.Ad_Type || billboard.adType || billboard.ad_type || billboard.AdType || 
                              (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || '').trim();
      const matchesAdType = selectedAdTypes.length === 0 || selectedAdTypes.includes(adTypeVal);
      
      const customerVal = String((billboard as any).Customer_Name ?? (billboard as any).clientName ?? '');
      const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(customerVal);
      
      // ✅ ENHANCED: Contract number filtering
      const contractNoVal = getCurrentContractNumber(billboard);
      let matchesContractNo = true;
      
      if (selectedContractNumbers.length > 0) {
        if (!contractNoVal || contractNoVal === '0') {
          matchesContractNo = false;
        } else {
          matchesContractNo = selectedContractNumbers.some(selectedContract => {
            const selected = String(selectedContract).trim();
            const current = String(contractNoVal).trim();
            
            // Exact match
            if (current === selected) return true;
            
            // Numeric comparison
            const selectedNum = parseInt(selected);
            const currentNum = parseInt(current);
            if (!isNaN(selectedNum) && !isNaN(currentNum) && selectedNum === currentNum) {
              return true;
            }
            
            return false;
          });
        }
      }
      
      const matchesOwnerCompany = selectedOwnerCompanies.length === 0 || selectedOwnerCompanies.includes((billboard as any).own_company_id || '');
      const result = matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesDistrict && matchesAdType && matchesCustomer && matchesContractNo && matchesOwnerCompany;
      
      return result;
    });

    // ✅ فلتر المسوّق: يرى فقط اللوحات المتاحة + اللوحات المحجوزة بعقوده (مع استبعاد الصديقة المخفية)
    if (isMarketer) {
      return afterFilters.filter((billboard: any) => {
        // استبعاد اللوحات الصديقة المخفية دائماً للمسوّق
        if (billboard.friend_company_id && billboard.is_visible_in_available === false) return false;

        const isAvailable = isBillboardAvailable(billboard);
        
        if (isAvailable) return true;
        
        if (marketerCustomerId) {
          const billboardId = String(billboard.ID || billboard.id);
          return marketerBillboardIds.has(billboardId);
        }
        
        return false;
      });
    }

    return afterFilters;
  }, [billboards, searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, selectedOwnerCompanies, isContractExpired, isMarketer, marketerCustomerId, marketerBillboardIds]);

  // ✅ FIXED: Use useMemo for sorted filtered billboards
  const sortedFilteredBillboards = useMemo(() => {
    if (filteredBillboards.length === 0) return [];
    
    const sizeOrder: { [key: string]: number } = {
      '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
      '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
      '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
      '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
      '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
      '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
      '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
    };
    
    return [...filteredBillboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';
      
      const orderA = sizeOrder[sizeA] || 999;
      const orderB = sizeOrder[sizeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  }, [filteredBillboards]);

  const totalPages = Math.max(1, Math.ceil(sortedFilteredBillboards.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBillboards = sortedFilteredBillboards.slice(startIndex, startIndex + PAGE_SIZE);

  // ✅ UPDATED: Calculate available billboards count (excluding friend company billboards and hidden ones)
  const availableBillboardsCount = useMemo(() => {
    return billboards.filter((billboard: any) => isBillboardAvailable(billboard)).length;
  }, [billboards]);

  // ✅ FIXED: Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, selectedOwnerCompanies]);

  // ✅ FIXED: Stable pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // ✅ Billboard selection handlers
  const toggleBillboardSelection = (billboardId: number) => {
    setSelectedBillboardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billboardId)) {
        newSet.delete(billboardId);
      } else {
        newSet.add(billboardId);
      }
      return newSet;
    });
  };

  const selectAllFilteredBillboards = () => {
    setSelectedBillboardIds(prev => {
      const next = new Set(prev);
      sortedFilteredBillboards.forEach((b: any) => next.add(b.ID || b.id));
      return next;
    });
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const selectedBillboards = useMemo(() => {
    return billboards.filter((b: any) => selectedBillboardIds.has(b.ID || b.id));
  }, [billboards, selectedBillboardIds]);

  const isAllSelected = sortedFilteredBillboards.length > 0 && sortedFilteredBillboards.every((b: any) => selectedBillboardIds.has(b.ID || b.id));

  // ✅ حذف اللوحات المحددة
  const deleteSelectedBillboards = async () => {
    if (selectedBillboards.length === 0) return;
    
    const confirmed = await systemConfirm({
      title: 'تأكيد حذف متعدد',
      message: `هل تريد حذف ${selectedBillboards.length} لوحة؟\n\nاللوحات المرتبطة بعقود سارية لن تُحذف.\nهذا الإجراء لا يمكن التراجع عنه!`,
      variant: 'destructive',
      confirmText: `حذف ${selectedBillboards.length} لوحة`
    });
    
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const billboard of selectedBillboards) {
      const id = Number(billboard.ID || billboard.id);
      if (!id || isNaN(id)) { failCount++; continue; }

      const { error } = await supabase.from('billboards').delete().eq('ID', id);
      if (error) {
        console.error(`❌ Failed to delete billboard ${id}:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`تم حذف ${successCount} لوحة بنجاح`);
      clearBillboardSelection();
      await loadBillboards();
    }
    if (failCount > 0) {
      toast.error(`فشل حذف ${failCount} لوحة (قد تكون مرتبطة بعقود)`);
    }
  };

  // ✅ تغيير حالة الإخفاء/الإظهار للوحات المحددة
  const toggleSelectedVisibility = async (billboardIds: number[], visible: boolean) => {
    if (billboardIds.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of billboardIds) {
      const { error } = await supabase
        .from('billboards')
        .update({ is_visible_in_available: visible })
        .eq('ID', id);
      if (error) {
        console.error(`❌ Failed to update billboard ${id}:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`تم ${visible ? 'إظهار' : 'إخفاء'} ${successCount} لوحة ${visible ? 'في' : 'من'} المتاح`);
      clearBillboardSelection();
      await loadBillboards();
    }
    if (failCount > 0) {
      toast.error(`فشل تحديث ${failCount} لوحة`);
    }
  };

  // ✅ FIXED: Simple pagination
  const PaginationControls = () => (
    <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1 backdrop-blur-sm border border-border/50">
      <button
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
        className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
      >
        السابق
      </button>
      
      {(() => {
        const windowSize = 5;
        let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, idx) => start + idx).map((p) => (
          <button
            key={p}
            onClick={() => handlePageChange(p)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 ${
              currentPage === p 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}
          >
            {p}
          </button>
        ));
      })()}

      <button
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
      >
        التالي
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <MapPin className="absolute inset-0 m-auto h-6 w-6 text-primary/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">جاري تحميل اللوحات</p>
            <p className="text-xs text-muted-foreground">يرجى الانتظار...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Editorial Header */}
      <div className="border-b border-border/40 mb-4 sm:mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                اللوحات الإعلانية
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-primary font-manrope">{billboards.length}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">لوحة مسجلة</span>
                <div className="h-4 w-px bg-border mx-1" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-manrope">{availableBillboardsCount}</span>
                <span className="text-xs text-muted-foreground">متاح</span>
              </div>
              <div className="h-0.5 w-12 bg-primary rounded-full mt-2" />
            </div>
            <div className="hidden sm:block">
              <BillboardActions
                exportToExcel={() => billboardExport.exportToExcel(billboards)}
                exportAvailableToExcel={() => billboardExport.exportAvailableToExcel(billboards, isContractExpired)}
                copyAvailableToClipboard={() => billboardExport.copyAvailableToClipboard(billboards, isContractExpired)}
                copyAllToClipboard={() => billboardExport.copyAllToClipboard(billboards)}
                copyAvailableAndUpcomingToClipboard={() => billboardExport.copyAvailableAndUpcomingToClipboard(billboards, isContractExpired)}
                copyAllWithEndDateToClipboard={() => billboardExport.copyAllWithEndDateToClipboard(billboards)}
                copyFollowUpToClipboard={() => billboardExport.copyFollowUpToClipboard(billboards)}
                exportAllWithEndDate={() => billboardExport.exportAllWithEndDate(billboards)}
                exportAvailableAndUpcoming={() => billboardExport.exportAvailableAndUpcoming(billboards, isContractExpired)}
                exportFollowUpToExcel={() => billboardExport.exportFollowUpToExcel(billboards)}
                exportRePhotographyToExcel={() => billboardExport.exportRePhotographyToExcel(billboards)}
                exportAvailableWithContracts={(contractIds, hideEndDateIds) => billboardExport.exportAvailableWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds)}
                exportAvailableAndUpcomingWithContracts={(contractIds, hideEndDateIds) => billboardExport.exportAvailableAndUpcomingWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds)}
                uploadAvailableToSite={() => billboardExport.uploadAvailableToSite(billboards, isContractExpired)}
                uploadAvailableAndUpcomingToSite={() => billboardExport.uploadAvailableAndUpcomingToSite(billboards, isContractExpired)}
                uploadFollowUpToSite={() => billboardExport.uploadFollowUpToSite(billboards)}
                uploadAllToSite={() => billboardExport.uploadAllToSite(billboards)}
                syncToGoogleSheets={async () => {
                  try {
                    const { syncAvailableBillboardsToGoogleSheets } = await import('@/services/billboardService');
                    await syncAvailableBillboardsToGoogleSheets(billboards, isContractExpired);
                    toast.success('تمت مزامنة اللوحات المتاحة بنجاح مع Google Sheets');
                  } catch (error: any) {
                    console.error('Sync error:', error);
                    toast.error(error.message || 'فشلت عملية المزامنة');
                  }
                }}
                setPrintFiltersOpen={setPrintFiltersOpen}
                setAdvancedPrintOpen={setAdvancedPrintOpen}
                availableBillboardsCount={availableBillboardsCount}
                initializeAddForm={billboardForm.initializeAddForm}
                setAddOpen={billboardForm.setAddOpen}
                setBulkAddOpen={setBulkAddOpen}
                setExcelImportOpen={setExcelImportOpen}
                setExcelImageImportOpen={setExcelImageImportOpen}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-4 sm:space-y-6">
        {/* Stats Strip */}
        <div className="flex items-center justify-between py-1 sm:py-2">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground font-manrope">{sortedFilteredBillboards.length}</span> نتيجة
            </span>
            {sortedFilteredBillboards.length !== billboards.length && (
              <span className="text-muted-foreground/60">
                من أصل <span className="font-manrope">{billboards.length}</span>
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-manrope">
            {currentPage} / {totalPages}
          </span>
        </div>

      {/* Filters */}
      <BillboardFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedCities={selectedCities}
        setSelectedCities={setSelectedCities}
        selectedSizes={selectedSizes}
        setSelectedSizes={setSelectedSizes}
        selectedMunicipalities={selectedMunicipalities}
        setSelectedMunicipalities={setSelectedMunicipalities}
        selectedDistricts={selectedDistricts}
        setSelectedDistricts={setSelectedDistricts}
        selectedAdTypes={selectedAdTypes}
        setSelectedAdTypes={setSelectedAdTypes}
        selectedCustomers={selectedCustomers}
        setSelectedCustomers={setSelectedCustomers}
        selectedContractNumbers={selectedContractNumbers}
        setSelectedContractNumbers={setSelectedContractNumbers}
        cities={citiesList}
        billboardSizes={dbSizes}
        billboardMunicipalities={dbMunicipalities}
        billboardDistricts={[...new Set(billboards.map((b: any) => b.District || b.district).filter(Boolean).map((d: string) => d.trim()).filter(Boolean))].sort()}
        uniqueAdTypes={dbAdTypes}
        uniqueCustomers={dbCustomers}
        uniqueContractNumbers={dbContractNumbers}
        selectedOwnerCompanies={selectedOwnerCompanies}
        setSelectedOwnerCompanies={setSelectedOwnerCompanies}
        ownerCompanies={ownerCompanies}
      />

      {/* Collapsible Summary Cards */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-4 sm:mb-6">
        <Card className="border shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  ملخص الإحصائيات
                </CardTitle>
                <Button variant="ghost" size="sm">
                  {summaryOpen ? (
                    <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <BillboardSummaryCards 
                billboards={billboards}
                isContractExpired={isContractExpired}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible Map */}
      <Collapsible open={mapOpen} onOpenChange={(open) => startTransition(() => setMapOpen(open))} className="mb-4 sm:mb-6">
        <Card className="border shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  خريطة اللوحات
                </CardTitle>
                <Button variant="ghost" size="sm">
                  {mapOpen ? (
                    <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Suspense fallback={<MapSkeleton className="h-[400px] sm:h-[600px]" />}>
              <AdminBillboardsMap
                billboards={sortedFilteredBillboards
                  .filter((b: any) => {
                    const coords = (b as any).GPS_Coordinates || '';
                    return !!coords;
                  })
                  .map(b => {
                    const statusRaw = String(b.Status ?? b.status ?? '').trim();
                    const contractNumRaw = String(b.Contract_Number ?? b.contractNumber ?? '').trim();
                    const hasContract = !!contractNumRaw && contractNumRaw !== '0';
                    const endDate = b.Rent_End_Date ?? b.rent_end_date ?? (b as any).expiryDate ?? null;
                    const isExpired = !!endDate && !isNaN(new Date(endDate).getTime()) && new Date(endDate) < new Date();
                    
                    let displayStatus: 'available' | 'maintenance' | 'rented' = 'available';
                    if (statusRaw === 'صيانة' || statusRaw.toLowerCase() === 'maintenance') {
                      displayStatus = 'maintenance';
                    } else if (hasContract && !isExpired) {
                      displayStatus = 'rented';
                    }
                    
                    const arabicStatus = displayStatus === 'rented' ? 'مؤجر' : displayStatus === 'maintenance' ? 'صيانة' : 'متاح';
                    
                    return {
                      ID: (b as any).ID || 0,
                      Billboard_Name: (b as any).Billboard_Name || '',
                      City: (b as any).City || '',
                      District: (b as any).District || '',
                      Size: (b as any).Size || '',
                      Status: arabicStatus,
                      Price: (b as any).Price || '0',
                      Level: (b as any).Level || '',
                      Image_URL: (b as any).Image_URL || '',
                      GPS_Coordinates: (b as any).GPS_Coordinates || '',
                      GPS_Link: (b as any).GPS_Link || '',
                      Nearest_Landmark: (b as any).Nearest_Landmark || '',
                      Faces_Count: (b as any).Faces_Count || '1',
                      Municipality: (b as any).Municipality || '',
                      Rent_End_Date: (b as any).Rent_End_Date || null,
                      Customer_Name: (b as any).Customer_Name || '',
                      Ad_Type: (b as any).Ad_Type || '',
                      Contract_Number: (b as any).Contract_Number || null,
                      is_visible_in_available: (b as any).is_visible_in_available,
                      design_face_a: (b as any).design_face_a || '',
                      design_face_b: (b as any).design_face_b || '',
                      installed_image_face_a_url: (b as any).installed_image_face_a_url || '',
                      installed_image_face_b_url: (b as any).installed_image_face_b_url || '',
                      id: String((b as any).ID || ''),
                      name: (b as any).Billboard_Name || '',
                      location: (b as any).Nearest_Landmark || '',
                      size: (b as any).Size || '',
                      status: displayStatus,
                      coordinates: (b as any).GPS_Coordinates || '',
                      imageUrl: (b as any).Image_URL || '',
                      expiryDate: (b as any).Rent_End_Date || null,
                      area: (b as any).District || '',
                      municipality: (b as any).Municipality || '',
                    };
                  }) as any}
                onImageView={() => {}}
                externalShowSociet={showSociet}
                onShowSocietChange={setShowSociet}
              />
            </Suspense>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Top Pagination with Grid Control */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1 bg-muted/40 rounded-full p-0.5 border border-border/40">
            {[
              { label: 'كبير', value: 320 },
              { label: 'متوسط', value: 260 },
              { label: 'صغير', value: 200 },
              { label: 'مصغر', value: 160 },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setGridColumns(opt.value);
                  setCurrentPage(1);
                }}
                className={`h-7 px-3 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  gridColumns === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <PaginationControls />
          <div className="hidden sm:block w-[100px]" />
        </div>
      )}

      {/* Billboard Grid - Dynamic responsive */}
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gridTemplateColumns: window.innerWidth >= 640 ? `repeat(auto-fill, minmax(${gridColumns}px, 1fr))` : '1fr' }}>
        {pagedBillboards.map((billboard, idx) => {
          const keyVal = String((billboard as any).id ?? (billboard as any).ID ?? `${(billboard as any).Billboard_Name ?? 'bb'}-${startIndex + idx}`);
          const hasContract = hasActiveContract(billboard);
          const billboardId = (billboard as any).ID || (billboard as any).id;
          const isSelected = selectedBillboardIds.has(billboardId);
          
          return (
            <div key={keyVal} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx * 40, 400)}ms`, animationFillMode: 'backwards' }}>
            <BillboardGridCard
              billboard={billboard as any} 
              showBookingActions={false} 
              onUpdate={loadBillboards}
              isSelectable={true}
              isSelected={isSelected}
              onToggleSelect={() => toggleBillboardSelection(billboardId)}
              canEditBillboards={canEditBillboards}
              onEdit={(b) => billboardForm.setEditing(b)}
              onContractAction={(b) => billboardContract.openContractDialog(b)}
              onDelete={(id) => deleteBillboard(id)}
              onMaintenance={(b: any) => {
                setSelectedBillboard(b);
                setMaintenanceForm({
                  status: b.maintenance_status || '',
                  type: b.maintenance_type || '',
                  description: b.maintenance_notes || '',
                  priority: b.maintenance_priority || 'normal'
                });
                setIsMaintenanceDialogOpen(true);
              }}
              hasActiveContractCheck={hasActiveContract}
            />
            </div>
          );
        })}
      </div>

      {/* Bottom Pagination */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex justify-center mt-6">
          <PaginationControls />
        </div>
      )}

      {/* No Results */}
      {sortedFilteredBillboards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <MapPin className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">لا توجد نتائج</h3>
          <p className="text-sm text-muted-foreground max-w-[300px]">حاول تغيير معايير البحث أو الفلاتر للعثور على اللوحات المطلوبة</p>
        </div>
      )}

      {/* Maintenance Dialog */}
      <MaintenanceDialog
        open={isMaintenanceDialogOpen}
        onOpenChange={setIsMaintenanceDialogOpen}
        selectedBillboard={selectedBillboard}
        setSelectedBillboard={setSelectedBillboard}
        maintenanceForm={maintenanceForm}
        setMaintenanceForm={setMaintenanceForm}
        onSubmit={handleMaintenanceSubmit}
        loadBillboards={loadBillboards}
      />

      {/* Dialogs */}
      <BillboardAddDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setSizes={setSizes}
        setLevels={setLevels}
        setBillboardTypes={setBillboardTypes}
        setDbMunicipalities={setDbMunicipalities}
        setDbSizes={setDbSizes}
        loadBillboards={loadBillboards}
      />
      
      <BillboardEditDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setDbMunicipalities={setDbMunicipalities}
        loadBillboards={loadBillboards}
      />
      
      <ContractManagementDialog 
        {...billboardContract}
        loadBillboards={loadBillboards}
      />
      
      <PrintFiltersDialog 
        open={printFiltersOpen}
        onOpenChange={setPrintFiltersOpen}
        filters={printFilters}
        setFilters={setPrintFilters}
        billboards={billboards}
        isContractExpired={isContractExpired}
        billboardMunicipalities={dbMunicipalities}
        cities={citiesList}
        billboardSizes={dbSizes}
        uniqueAdTypes={dbAdTypes}
      />
      
      <BillboardPrintWithSelection
        open={advancedPrintOpen}
        onOpenChange={setAdvancedPrintOpen}
        billboards={sortedFilteredBillboards}
        isContractExpired={isContractExpired}
      />


      {/* Bulk Add Dialog */}
      <BulkAddDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        onSuccess={loadBillboards}
        generateBillboardName={(municipality, level, size, existingNames, billboardId) => {
          const code = municipalities.find(m => m.name === municipality)?.code || 'XX';
          if (billboardId) {
            return `${code}0${billboardId}`;
          }
          let counter = 1;
          let name = `${code}${String(counter).padStart(4, '0')}`;
          while (existingNames.includes(name)) {
            counter++;
            name = `${code}${String(counter).padStart(4, '0')}`;
          }
          return name;
        }}
        getNextBillboardId={async () => {
          const { data } = await supabase.from('billboards').select('ID').order('ID', { ascending: false }).limit(1);
          return (data?.[0]?.ID || 0) + 1;
        }}
      />
      
      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        onSuccess={loadBillboards}
        generateBillboardName={(municipality, level, size, existingNames, billboardId) => {
          const code = municipalities.find(m => m.name === municipality)?.code || 'XX';
          if (billboardId) {
            return `${code}0${billboardId}`;
          }
          let counter = 1;
          let name = `${code}${String(counter).padStart(4, '0')}`;
          while (existingNames.includes(name)) {
            counter++;
            name = `${code}${String(counter).padStart(4, '0')}`;
          }
          return name;
        }}
        getNextBillboardId={async () => {
          const { data } = await supabase.from('billboards').select('ID').order('ID', { ascending: false }).limit(1);
          return (data?.[0]?.ID || 0) + 1;
        }}
      />

      {/* Excel Image Import Dialog */}
      <ExcelImageImportDialog
        open={excelImageImportOpen}
        onOpenChange={setExcelImageImportOpen}
        onSuccess={loadBillboards}
      />
      
      {/* شريط الاختيار العائم */}
      <BillboardSelectionBar
        selectedBillboards={selectedBillboards}
        filteredBillboards={sortedFilteredBillboards}
        onClearSelection={clearBillboardSelection}
        onSelectAll={selectAllFilteredBillboards}
        isAllSelected={isAllSelected}
        onDeleteSelected={canEditBillboards ? deleteSelectedBillboards : undefined}
        onToggleVisibility={canEditBillboards ? toggleSelectedVisibility : undefined}
      />
      </div>
    </div>
  );
}
