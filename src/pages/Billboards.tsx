import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Edit, Link, Unlink, Wrench, ExternalLink, Camera } from 'lucide-react';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { BillboardFilters } from '@/components/BillboardFilters';
import { BillboardActions } from '@/components/BillboardActions';
import { BillboardAddDialog } from '@/components/billboards/BillboardAddDialog';
import { BillboardEditDialog } from '@/components/billboards/BillboardEditDialog';
import { BillboardSummaryCards } from '@/components/billboards/BillboardSummaryCards';
import { ContractManagementDialog } from '@/components/billboards/ContractManagementDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PrintFiltersDialog } from '@/components/billboards/PrintFiltersDialog';
import { BillboardPrintWithSelection } from '@/components/billboards/BillboardPrintWithSelection';
import { BillboardSelectionBar } from '@/components/billboards/BillboardSelectionBar';
import InteractiveMap from '@/components/InteractiveMap';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { searchBillboards } from '@/services/billboardService';
import { useBillboardData } from '@/hooks/useBillboardData';
import { useBillboardForm } from '@/hooks/useBillboardForm';
import { useBillboardActions } from '@/hooks/useBillboardActions';
import { useBillboardExport } from '@/hooks/useBillboardExport';
import { useBillboardContract } from '@/hooks/useBillboardContract';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Billboards() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 16;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedAdTypes, setSelectedAdTypes] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  
  // Collapsible states
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // Print filters
  const [printFiltersOpen, setPrintFiltersOpen] = useState(false);
  const [advancedPrintOpen, setAdvancedPrintOpen] = useState(false);
  
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

  // ✅ إنشاء نافذة تأكيد مخصصة بنمط النظام
  const showSystemConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // إنشاء عنصر النافذة المنبثقة
      const overlay = document.createElement('div');
      overlay.className = 'custom-confirm-overlay';
      
      const dialog = document.createElement('div');
      dialog.className = 'custom-confirm-dialog';
      
      dialog.innerHTML = `
        <div class="system-dialog-header">
          <h3 class="system-dialog-title">${title}</h3>
        </div>
        <div class="system-dialog-content">
          <p style="white-space: pre-line; line-height: 1.6; margin-bottom: 20px;">${message}</p>
          <div class="system-dialog-buttons">
            <button class="system-btn-secondary" id="cancel-btn">إلغاء</button>
            <button class="system-btn-primary" id="confirm-btn">حذف</button>
          </div>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      
      const cleanup = () => {
        document.body.removeChild(overlay);
        document.body.style.overflow = 'unset';
      };
      
      const confirmBtn = dialog.querySelector('#confirm-btn');
      const cancelBtn = dialog.querySelector('#cancel-btn');
      
      confirmBtn?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
      
      // إضافة دعم مفتاح Escape
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  };

  // ✅ COMPLETELY FIXED: Delete function with better error handling and system-style confirmation
  const deleteBillboard = async (billboardId: number | string) => {
    try {
      // ✅ ENHANCED: Better confirmation dialog
      const billboardName = billboards.find(b => (b.ID || b.id) == billboardId)?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      
      const confirmed = await showSystemConfirm(
        'تأكيد حذف اللوحة',
        `هل تريد حذف "${billboardName}"؟\n\nتحذير: هذا الإجراء لا يمكن التراجع عنه!`
      );
      
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

      console.log('🗑️ Attempting to delete billboard with ID:', id);
      
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
      
      console.log('✅ Billboard deleted successfully');
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
    console.log('🔍 البحث عن:', searchTerm);
    
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
      
      if (matches) {
        console.log('✅ تطابق:', {
          name: billboardName,
          nearestLandmark,
          municipality,
          city,
          searchTerm
        });
      }
      
      return matches;
    });
  };

  // ✅ ENHANCED: Enhanced filtering with "منتهي" status support
  const filteredBillboards = useMemo(() => {
    console.log('🔄 Filtering billboards...', {
      totalBillboards: billboards.length,
      searchQuery,
      selectedContractNumbers,
      selectedStatuses,
      selectedAdTypes,
      dbAdTypes: dbAdTypes.slice(0, 5),
      dbContractNumbers: dbContractNumbers.slice(0, 5)
    });
    
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    console.log('🔍 نتائج البحث:', searched.length, 'من أصل', billboards.length);
    
    return searched.filter((billboard) => {
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
      
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date);
      
      const isAvailable = (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      const isBooked = ((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || hasContract) && !contractExpired;
      
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
        (s === 'مخفية من المتاح' && isHiddenFromAvailable)
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
        if (!contractNoVal || contractNoVal === '0' || contractNoVal === '') {
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
      
      const result = matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesDistrict && matchesAdType && matchesCustomer && matchesContractNo;
      
      return result;
    });
  }, [billboards, searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, isContractExpired]);

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

  // ✅ UPDATED: Calculate available billboards count
  const availableBillboardsCount = useMemo(() => {
    return billboards.filter((billboard: any) => {
      const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    }).length;
  }, [billboards, isContractExpired]);

  // ✅ FIXED: Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers]);

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
    const allIds = sortedFilteredBillboards.map((b: any) => b.ID || b.id);
    setSelectedBillboardIds(new Set(allIds));
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const selectedBillboards = useMemo(() => {
    return sortedFilteredBillboards.filter((b: any) => selectedBillboardIds.has(b.ID || b.id));
  }, [sortedFilteredBillboards, selectedBillboardIds]);

  const isAllSelected = selectedBillboardIds.size > 0 && selectedBillboardIds.size === sortedFilteredBillboards.length;

  // ✅ FIXED: Simple pagination
  const PaginationControls = () => (
    <div className="flex items-center justify-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
        className="px-4 py-2 h-10 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-700 hover:from-primary/10 hover:to-primary/5 hover:border-primary/50 disabled:opacity-50 transition-all duration-200 font-medium"
      >
        السابق
      </Button>
      
      {(() => {
        const windowSize = 5;
        let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, idx) => start + idx).map((p) => (
          <Button
            key={p}
            variant={currentPage === p ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(p)}
            className={`w-10 h-10 p-0 font-bold transition-all duration-200 ${
              currentPage === p 
                ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 scale-105' 
                : 'bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-700 hover:from-primary/10 hover:to-primary/5 hover:border-primary/50'
            }`}
          >
            {p}
          </Button>
        ));
      })()}

      <Button
        variant="outline"
        size="sm"
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className="px-4 py-2 h-10 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-700 hover:from-primary/10 hover:to-primary/5 hover:border-primary/50 disabled:opacity-50 transition-all duration-200 font-medium"
      >
        التالي
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل اللوحات الإعلانية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Modern Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50 mb-6">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                  <MapPin className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    إدارة اللوحات الإعلانية
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    عرض وإدارة جميع اللوحات الإعلانية مع الفلاتر المتقدمة
                  </p>
                </div>
              </div>
            </div>
            <BillboardActions
              exportToExcel={() => billboardExport.exportToExcel(billboards)}
              exportAvailableToExcel={() => billboardExport.exportAvailableToExcel(billboards, isContractExpired)}
              exportAllWithEndDate={() => billboardExport.exportAllWithEndDate(billboards)}
              exportAvailableAndUpcoming={() => billboardExport.exportAvailableAndUpcoming(billboards, isContractExpired)}
              exportFollowUpToExcel={() => billboardExport.exportFollowUpToExcel(billboards)}
              exportRePhotographyToExcel={() => billboardExport.exportRePhotographyToExcel(billboards)}
              exportAvailableWithContracts={(contractIds, hideEndDateIds) => billboardExport.exportAvailableWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds)}
              exportAvailableAndUpcomingWithContracts={(contractIds, hideEndDateIds) => billboardExport.exportAvailableAndUpcomingWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds)}
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
            />
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Modern Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي اللوحات */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">إجمالي اللوحات</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{billboards.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* اللوحات المتاحة */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">اللوحات المتاحة</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{availableBillboardsCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* أسماء الزبائن */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">أسماء الزبائن</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{dbCustomers.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">من العقود النشطة</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* أنواع الإعلانات */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-600" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">أنواع الإعلانات</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{dbAdTypes.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">من العقود النشطة</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/20">
                  <MapPin className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Results Counter */}
        <Card className="border-0 bg-gradient-to-r from-muted/50 to-muted/30 shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">
                  نتائج البحث: <span className="text-primary font-bold">{sortedFilteredBillboards.length}</span> لوحة من أصل <span className="text-primary font-bold">{billboards.length}</span>
                </span>
              </div>
              <Badge variant="secondary" className="text-sm">
                الصفحة {currentPage} من {totalPages}
              </Badge>
            </div>
          </CardContent>
        </Card>

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
      />

      {/* ✅ Collapsible Summary Cards */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-6">
        <Card className="border-2 shadow-lg">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  ملخص الإحصائيات
                </CardTitle>
                <Button variant="ghost" size="sm">
                  {summaryOpen ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
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

      {/* ✅ Collapsible Map */}
      <Collapsible open={mapOpen} onOpenChange={setMapOpen} className="mb-6">
        <Card className="border-2 shadow-lg overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  خريطة اللوحات
                </CardTitle>
                <Button variant="ghost" size="sm">
                  {mapOpen ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <InteractiveMap 
              billboards={billboards
                .filter((b: any) => {
                  const statusRaw = String(b.Status ?? b.status ?? '').trim();
                  const statusLower = statusRaw.toLowerCase();

                  // Exclude only removed billboards
                  const isRemoved = statusRaw === 'إزالة' || statusRaw === 'ازالة' || statusLower === 'removed';
                  if (isRemoved) return false;

                  // Check if billboard has valid coordinates
                  const coords = (b as any).GPS_Coordinates || '';
                  if (!coords) return false;

                  return true;
                })
                .map(b => {
                  const statusRaw = String(b.Status ?? b.status ?? '').trim();
                  const contractNumRaw = String(b.Contract_Number ?? b.contractNumber ?? '').trim();
                  const hasContract = !!contractNumRaw && contractNumRaw !== '0';
                  const endDate = b.Rent_End_Date ?? b.rent_end_date ?? (b as any).expiryDate ?? null;
                  const isExpired = !!endDate && !isNaN(new Date(endDate).getTime()) && new Date(endDate) < new Date();
                  
                  // Determine display status
                  let displayStatus: 'available' | 'maintenance' | 'rented' = 'available';
                  if (statusRaw === 'صيانة' || statusRaw.toLowerCase() === 'maintenance') {
                    displayStatus = 'maintenance';
                  } else if (hasContract && !isExpired) {
                    displayStatus = 'rented';
                  } else {
                    displayStatus = 'available';
                  }
                  
                  // Arabic status for display
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
                    // Normalized fields for InteractiveMap
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
              onImageView={(url) => console.log('Image view:', url)}
            />
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Top Pagination */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex justify-center mb-4">
          <PaginationControls />
        </div>
      )}

      {/* Billboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pagedBillboards.map((billboard, idx) => {
          const keyVal = String((billboard as any).id ?? (billboard as any).ID ?? `${(billboard as any).Billboard_Name ?? 'bb'}-${startIndex + idx}`);
          const hasContract = hasActiveContract(billboard);
          const billboardId = (billboard as any).ID || (billboard as any).id;
          const isSelected = selectedBillboardIds.has(billboardId);
          
          return (
            <div key={keyVal} className="space-y-3">
              <BillboardGridCard 
                billboard={billboard as any} 
                showBookingActions={false} 
                onUpdate={loadBillboards}
                isSelectable={true}
                isSelected={isSelected}
                onToggleSelect={() => toggleBillboardSelection(billboardId)}
              />
              
              {/* أزرار الإجراءات المحسّنة */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-card to-muted/30 border border-border/50 shadow-sm">
                {/* الصف الأول - الأزرار الرئيسية */}
                <div className="flex gap-2 mb-2">
                  <Button 
                    size="sm" 
                    onClick={() => billboardForm.setEditing(billboard)}
                    className="flex-1 h-10 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/25 border-0 font-semibold"
                  >
                    <Edit className="h-4 w-4 ml-2" />
                    تعديل
                  </Button>
                  
                  <Button 
                    size="sm"
                    onClick={() => billboardContract.openContractDialog(billboard)}
                    className={`flex-1 h-10 shadow-md border-0 font-semibold ${
                      hasContract 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25' 
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/25'
                    }`}
                  >
                    {hasContract ? (
                      <>
                        <Unlink className="h-4 w-4 ml-2" />
                        إزالة من العقد
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 ml-2" />
                        إضافة لعقد
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    size="sm"
                    onClick={() => {
                      const billboardId = (billboard as any).ID || (billboard as any).id;
                      deleteBillboard(billboardId);
                    }}
                    className="h-10 px-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-500/25 border-0 font-semibold"
                  >
                    حذف
                  </Button>
                </div>

                {/* الصف الثاني - أزرار إضافية */}
                <div className="flex gap-2">
                  {/* زر موقع اللوحة */}
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="flex-1 h-9 bg-gradient-to-r from-sky-500/10 to-blue-500/5 hover:from-sky-500/20 hover:to-blue-500/10 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300"
                    onClick={() => {
                      const coords = 
                        billboard.GPS_Coordinates ||
                        (billboard as any).gps_coordinates ||
                        null;

                      if (!coords) {
                        toast.error('لا توجد إحداثيات جغرافية لهذه اللوحة');
                        return;
                      }

                      const coordStr = String(coords).trim().replace(/\s+/g, ' ');
                      const match = coordStr.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
                      
                      if (!match) {
                        toast.error('تنسيق الإحداثيات غير صحيح. مثال: 24.7136,46.6753');
                        return;
                      }

                      const url = `https://maps.google.com/?q=${match[1]},${match[3]}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    <span className="text-xs">الموقع</span>
                  </Button>

                  {/* زر إعادة التصوير */}
                  <Button 
                    variant="outline"
                    size="sm" 
                    className={`flex-1 h-9 ${
                      (billboard as any).needs_rephotography
                        ? 'bg-gradient-to-r from-rose-500/20 to-red-500/10 border-rose-400 dark:border-rose-600 text-rose-600 dark:text-rose-400'
                        : 'bg-gradient-to-r from-violet-500/10 to-purple-500/5 hover:from-violet-500/20 hover:to-purple-500/10 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                    }`}
                    onClick={async () => {
                      try {
                        const currentStatus = (billboard as any).needs_rephotography || false;
                        const newStatus = !currentStatus;
                        
                        const { error } = await supabase
                          .from('billboards')
                          // @ts-ignore - needs_rephotography field exists in database
                          .update({ needs_rephotography: newStatus })
                          .eq('ID', (billboard as any).ID);

                        if (error) throw error;

                        toast.success(newStatus ? 'تم إضافة اللوحة لقائمة إعادة التصوير' : 'تم إزالة اللوحة من قائمة إعادة التصوير');
                        
                        await loadBillboards();
                      } catch (error) {
                        console.error('Error updating rephotography status:', error);
                        toast.error('فشل في تحديث حالة إعادة التصوير');
                      }
                    }}
                    title={(billboard as any).needs_rephotography ? "إزالة من قائمة إعادة التصوير" : "إضافة لقائمة إعادة التصوير"}
                  >
                    <Camera className="h-3.5 w-3.5 ml-1" />
                    <span className="text-xs">{(billboard as any).needs_rephotography ? 'إلغاء التصوير' : 'تصوير'}</span>
                  </Button>

                  {/* زر صيانة اللوحة */}
                  <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="flex-1 h-9 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 hover:from-amber-500/20 hover:to-yellow-500/10 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                        onClick={() => {
                          setSelectedBillboard(billboard);
                          setMaintenanceForm({
                            status: billboard.maintenance_status || '',
                            type: billboard.maintenance_type || '',
                            description: billboard.maintenance_notes || '',
                            priority: billboard.maintenance_priority || 'normal'
                          });
                        }}
                      >
                        <Wrench className="h-3.5 w-3.5 ml-1" />
                        <span className="text-xs">صيانة</span>
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
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
        <Card className="card-elegant">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد لوحات</h3>
            <p className="text-muted-foreground">لم يتم العثور على لوحات تطابق معايير البحث المحددة</p>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إدارة صيانة اللوحة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBillboard && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maintenance-status">حالة الصيانة *</Label>
              <Select
                value={maintenanceForm.status}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر حالة الصيانة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">تعمل بشكل طبيعي</SelectItem>
                  <SelectItem value="maintenance">قيد الصيانة</SelectItem>
                  <SelectItem value="repair_needed">تحتاج إصلاح</SelectItem>
                  <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
                  <SelectItem value="لم يتم التركيب">لم يتم التركيب</SelectItem>
                  <SelectItem value="متضررة اللوحة">متضررة اللوحة</SelectItem>
                  <SelectItem value="تحتاج ازالة لغرض التطوير">تحتاج ازالة لغرض التطوير</SelectItem>
                  <SelectItem value="removed">تمت الإزالة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-type">نوع الصيانة</Label>
              <Select
                value={maintenanceForm.type}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الصيانة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="صيانة دورية">صيانة دورية</SelectItem>
                  <SelectItem value="إصلاح">إصلاح</SelectItem>
                  <SelectItem value="تنظيف">تنظيف</SelectItem>
                  <SelectItem value="استبدال اللوحة">استبدال اللوحة</SelectItem>
                  <SelectItem value="قص اللوحة">قص اللوحة</SelectItem>
                  <SelectItem value="لم يتم التركيب">لم يتم التركيب</SelectItem>
                  <SelectItem value="تحتاج إزالة">تحتاج إزالة</SelectItem>
                  <SelectItem value="إزالة للتطوير">إزالة للتطوير</SelectItem>
                  <SelectItem value="تمت الإزالة">تمت الإزالة</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">وصف المشكلة أو الصيانة</Label>
              <Textarea
                id="description"
                placeholder="اكتب وصف تفصيلي..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleMaintenanceSubmit} className="flex-1">
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
      
      {/* شريط الاختيار العائم */}
      <BillboardSelectionBar
        selectedBillboards={selectedBillboards}
        filteredBillboards={sortedFilteredBillboards}
        onClearSelection={clearBillboardSelection}
        onSelectAll={selectAllFilteredBillboards}
        isAllSelected={isAllSelected}
      />
      </div>
    </div>
  );
}
