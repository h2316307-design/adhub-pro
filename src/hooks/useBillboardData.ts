import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { setSizeColorsFromData } from '@/hooks/useMapMarkers';

export const useBillboardData = () => {
  const retryCountRef = useRef(0);
  const maxAutoRetries = 3;
  const [billboards, setBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [billboardTypes, setBillboardTypes] = useState<string[]>([]);
  
  // Derived data for filters
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [dbMunicipalities, setDbMunicipalities] = useState<string[]>([]);
  const [dbAdTypes, setDbAdTypes] = useState<string[]>([]);
  const [dbCustomers, setDbCustomers] = useState<string[]>([]);
  const [dbContractNumbers, setDbContractNumbers] = useState<string[]>([]);

  // ✅ FIXED: Memoize getSizeOrderFromDB to prevent recreation
  const getSizeOrderFromDB = useCallback(async (): Promise<{ [key: string]: number }> => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      const sizeOrderMap: { [key: string]: number } = {};
      data?.forEach((size) => {
        sizeOrderMap[size.name] = size.sort_order || 999;
      });
      
      console.log('✅ Size order map from database:', sizeOrderMap);
      return sizeOrderMap;
    } catch (error) {
      console.error('Error loading size order from database:', error);
      // Fallback to hardcoded order
      return {
        '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
        '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
        '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
        '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
        '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
        '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
        '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
      };
    }
  }, []);

  // ✅ FIXED: Memoize sortBillboardsBySize to prevent recreation
  const sortBillboardsBySize = useCallback(async (billboards: any[]): Promise<any[]> => {
    const sizeOrderMap = await getSizeOrderFromDB();
    
    return [...billboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';
      
      const orderA = sizeOrderMap[sizeA] || 999;
      const orderB = sizeOrderMap[sizeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same size order, sort by billboard ID
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  }, [getSizeOrderFromDB]);

  // ✅ ENHANCED: Load contracts data with better field mapping
  const loadContractsData = useCallback(async () => {
    try {
      console.log('🔄 Loading contracts data...');
      
      const result = await fetchWithRetry<any[]>(async () => {
        const res = await supabase
          .from('Contract')
          .select('*')
          .order('id', { ascending: false });
        return res;
      }, { maxRetries: 3, timeout: 45000 });

      if (result.error) {
        console.log('❌ Error loading contracts:', result.error);
        return { customers: [], adTypes: [], contractNumbers: [] };
      }

      const contractsData = result.data as any[];

      console.log('✅ Contracts data loaded:', contractsData?.length || 0);
      
      if (!contractsData || contractsData.length === 0) {
        return { customers: [], adTypes: [], contractNumbers: [] };
      }

      // Extract unique values with enhanced field mapping
      const customerNames = new Set<string>();
      const adTypes = new Set<string>();
      const contractNumbers = new Set<string>();

      contractsData.forEach((contract: any) => {
        // ✅ ENHANCED: Customer names with more field variations
        const customerFields = [
          'customer_name', 'Customer Name', 'customerName', 'client_name', 
          'Client Name', 'clientName', 'Customer_Name', 'CLIENT_NAME'
        ];
        
        for (const field of customerFields) {
          const customerName = contract[field];
          if (customerName && String(customerName).trim()) {
            customerNames.add(String(customerName).trim());
            break;
          }
        }

        // ✅ ENHANCED: Ad types with comprehensive field mapping
        const adTypeFields = [
          'Ad Type', 'ad_type', 'adType', 'advertisement_type', 'type', 
          'Ad_Type', 'AD_TYPE', 'advertisementType', 'advType', 'category'
        ];
        
        for (const field of adTypeFields) {
          const adType = contract[field];
          if (adType && String(adType).trim() && String(adType).trim() !== 'null') {
            adTypes.add(String(adType).trim());
            break;
          }
        }

        // ✅ ENHANCED: Contract numbers with more variations
        const contractNumberFields = [
          'Contract_Number', 'contract_number', 'contractNumber', 'number', 
          'id', 'CONTRACT_NUMBER', 'contract_id', 'contractId'
        ];
        
        for (const field of contractNumberFields) {
          const contractNumber = contract[field];
          if (contractNumber && String(contractNumber).trim() && String(contractNumber).trim() !== '0') {
            contractNumbers.add(String(contractNumber).trim());
            break;
          }
        }
      });

      console.log('✅ Extracted contract data:');
      console.log('- Customers:', Array.from(customerNames).length);
      console.log('- Ad types:', Array.from(adTypes).length, Array.from(adTypes).slice(0, 10));
      console.log('- Contract numbers:', Array.from(contractNumbers).length);

      return {
        customers: Array.from(customerNames).sort(),
        adTypes: Array.from(adTypes).sort(),
        contractNumbers: Array.from(contractNumbers).sort((a, b) => {
          const numA = parseInt(a) || 0;
          const numB = parseInt(b) || 0;
          return numB - numA; // Descending order
        })
      };
    } catch (error) {
      console.error('Error loading contracts data:', error);
      return { customers: [], adTypes: [], contractNumbers: [] };
    }
  }, []);

  // ✅ ENHANCED: Load billboards with proper contract matching
  const loadBillboards = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      console.log('🔄 Loading billboards...');
      
      // Load billboards data with retry
      const billboardsResult = await fetchWithRetry<any[]>(async () => {
        const res = await supabase
          .from('billboards')
          .select(`
            *,
            friend_companies:friend_company_id(*)
          `)
          .order('ID', { ascending: true });
        return res;
      }, { maxRetries: 3, timeout: 45000 });
      
      if (billboardsResult.error) {
        console.error('❌ Error loading billboards:', billboardsResult.error);
        
        // Auto retry on network errors
        if (retryCountRef.current < maxAutoRetries) {
          retryCountRef.current++;
          console.log(`🔄 Auto retry ${retryCountRef.current}/${maxAutoRetries}...`);
          toast.info(`جاري إعادة المحاولة... (${retryCountRef.current}/${maxAutoRetries})`);
          setTimeout(() => loadBillboards(), 2000);
          return;
        }
        
        throw billboardsResult.error;
      }

      retryCountRef.current = 0; // Reset on success
      const billboardsData = billboardsResult.data as any[];

      console.log('✅ Billboards loaded:', billboardsData?.length || 0);
      
      if (!billboardsData) {
        setBillboards([]);
        return;
      }

      // ✅ NEW: Load all contracts to match with billboards (with retry)
      const contractsResult = await fetchWithRetry<any[]>(async () => {
        const res = await supabase
          .from('Contract')
          .select('*')
          .order('id', { ascending: false });
        return res;
      }, { maxRetries: 2, timeout: 30000 });

      const contractsData = contractsResult.data as any[] || [];
      console.log('✅ Contracts loaded for matching:', contractsData?.length || 0);

      // ✅ NEW: Load latest installation task items for design images
      const installationTasksResult = await fetchWithRetry<any[]>(async () => {
        const res = await supabase
          .from('installation_task_items')
          .select(`
            billboard_id,
            design_face_a,
            design_face_b,
            installed_image_face_a_url,
            installed_image_face_b_url,
            selected_design_id,
            task_designs:selected_design_id(
              design_face_a_url,
              design_face_b_url
            )
          `)
          .order('created_at', { ascending: false });
        return res;
      }, { maxRetries: 2, timeout: 30000 });

      const installationTasksData = installationTasksResult.data as any[] || [];
      console.log('✅ Installation tasks loaded for design images:', installationTasksData?.length || 0);

      // Create a map of billboard_id to latest installation task
      const latestTaskByBillboard = new Map<number, any>();
      installationTasksData.forEach((task: any) => {
        if (task.billboard_id && !latestTaskByBillboard.has(task.billboard_id)) {
          latestTaskByBillboard.set(task.billboard_id, task);
        }
      });

      // ✅ ENHANCED: Process billboards with contract matching
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const processedBillboards = billboardsData.map(billboard => {
        const billboardId = String(billboard.ID);
        
        // Find contracts that include this billboard ID
        let matchingContracts = contractsData?.filter((contract: any) => {
          // Check billboard_ids field (comma-separated string)
          const billboardIds = contract.billboard_ids;
          if (billboardIds) {
            const idsArray = String(billboardIds).split(',').map(id => id.trim());
            return idsArray.includes(billboardId);
          }
          
          // Also check billboard_id field (single ID)
          if (contract.billboard_id && String(contract.billboard_id) === billboardId) {
            return true;
          }
          
          return false;
        }) || [];

        // ✅ NEW: إذا لم نجد عقد عبر billboard_ids، نبحث باستخدام Contract_Number من اللوحة
        if (matchingContracts.length === 0 && billboard.Contract_Number) {
          const contractByNumber = contractsData?.find((contract: any) => 
            contract.Contract_Number === billboard.Contract_Number
          );
          if (contractByNumber) {
            matchingContracts = [contractByNumber];
          }
        }

        // ✅ FIXED: اختيار العقد النشط (غير المنتهي) أولاً، ثم العقد الأحدث
        // فلترة العقود النشطة (تاريخ الانتهاء >= اليوم)
        const activeContracts = matchingContracts.filter((contract: any) => {
          const endDate = contract['End Date'];
          if (!endDate) return false;
          try {
            const contractEndDate = new Date(endDate);
            contractEndDate.setHours(0, 0, 0, 0);
            return contractEndDate >= today;
          } catch {
            return false;
          }
        });
        
        // ترتيب العقود النشطة حسب تاريخ البداية (الأحدث أولاً)
        activeContracts.sort((a: any, b: any) => {
          const dateA = new Date(a['Contract Date'] || 0);
          const dateB = new Date(b['Contract Date'] || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        // اختيار العقد النشط الأحدث، أو أول عقد إذا لم يوجد نشط
        const activeContract = activeContracts.length > 0 ? activeContracts[0] : 
                              (matchingContracts.length > 0 ? matchingContracts[0] : null);

        // ✅ DEBUG: Log contract matching for specific billboard
        if (billboardId === '954' || billboardId === '216' || billboardId === '160' || billboardId === '162') {
          console.log(`🔍 Billboard ${billboardId} contract matching:`, {
            matchingContracts: matchingContracts.length,
            activeContract: activeContract ? {
              id: activeContract.id,
              Contract_Number: activeContract.Contract_Number,
              'Ad Type': activeContract['Ad Type'],
              'Customer Name': activeContract['Customer Name']
            } : null
          });
        }

        // ✅ حساب سعر الإيجار من billboard_prices إذا كان متوفراً
        let billboardRentPrice = billboard.Price || 0;
        if (activeContract?.billboard_prices) {
          try {
            const pricesData = typeof activeContract.billboard_prices === 'string' 
              ? JSON.parse(activeContract.billboard_prices) 
              : activeContract.billboard_prices;
            
            if (Array.isArray(pricesData)) {
              const priceEntry = pricesData.find((p: any) => 
                String(p.billboardId) === billboardId || String(p.billboard_id) === billboardId
              );
              if (priceEntry) {
                billboardRentPrice = priceEntry.contractPrice || priceEntry.priceAfterDiscount || priceEntry.price || billboard.Price || 0;
              }
            }
          } catch (e) {
            console.warn('Error parsing billboard_prices:', e);
          }
        }

        // ✅ NEW: Get design images from installation task
        const latestTask = latestTaskByBillboard.get(billboard.ID);
        const designFaceA = latestTask?.design_face_a || latestTask?.task_designs?.design_face_a_url || '';
        const designFaceB = latestTask?.design_face_b || latestTask?.task_designs?.design_face_b_url || '';
        const installedImageA = latestTask?.installed_image_face_a_url || '';
        const installedImageB = latestTask?.installed_image_face_b_url || '';

        return {
          ...billboard,
          // ✅ ENHANCED: Better contract field mapping
          Contract_Number: activeContract?.Contract_Number || billboard.Contract_Number || '',
          contractNumber: activeContract?.Contract_Number || billboard.Contract_Number || '',
          Customer_Name: activeContract?.['Customer Name'] || billboard.Customer_Name || '',
          clientName: activeContract?.['Customer Name'] || billboard.Customer_Name || '',
          Ad_Type: activeContract?.['Ad Type'] || billboard.Ad_Type || '',
          adType: activeContract?.['Ad Type'] || billboard.Ad_Type || '',
          Rent_Start_Date: activeContract?.['Contract Date'] || billboard.Rent_Start_Date || null,
          Rent_End_Date: activeContract?.['End Date'] || billboard.Rent_End_Date || null,
          ContractStatus: billboard.Status || null,
          // ✅ FIXED: Map faces count correctly from database column
          Faces: billboard.Faces_Count || 1,
          faces: billboard.Faces_Count || 1,
          Number_of_Faces: billboard.Faces_Count || 1,
          faces_count: billboard.Faces_Count || 1,
          // ✅ NEW: Add contract info for easier access
          contracts: matchingContracts.length > 0 ? matchingContracts : null,
          // ✅ NEW: سعر الإيجار من العقد
          rent_price: billboardRentPrice,
          // ✅ NEW: Design images from installation tasks
          design_face_a: designFaceA,
          design_face_b: designFaceB,
          installed_image_face_a_url: installedImageA,
          installed_image_face_b_url: installedImageB,
          installed_design_face_a: installedImageA || designFaceA,
          installed_design_face_b: installedImageB || designFaceB,
          contract: activeContract ? {
            id: activeContract.Contract_Number,
            customer_name: activeContract['Customer Name'],
            ad_type: activeContract['Ad Type'],
            start_date: activeContract['Contract Date'],
            end_date: activeContract['End Date'],
            rent_cost: billboardRentPrice
          } : null
        };
      });

      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(processedBillboards);
      setBillboards(sortedBillboards);
      
      // Load contracts data for filters
      const { adTypes, customers, contractNumbers } = await loadContractsData();
      setDbAdTypes(adTypes);
      setDbCustomers(customers);
      setDbContractNumbers(contractNumbers);
      
      // Extract unique values for filters from billboards
      const cities = [...new Set(processedBillboards
        .map((b: any) => b.City || b.city)
        .filter(Boolean)
        .map((c: string) => c.trim())
        .filter(Boolean)
      )].sort();

      const billboardSizes = [...new Set(processedBillboards
        .map((b: any) => b.Size || b.size)
        .filter(Boolean)
        .map((s: string) => s.trim())
        .filter(Boolean)
      )];

      const municipalities = [...new Set(processedBillboards
        .map((b: any) => b.Municipality || b.municipality)
        .filter(Boolean)
        .map((m: string) => m.trim())
        .filter(Boolean)
      )].sort();
      
      setCitiesList(cities);
      setDbMunicipalities(municipalities);
      
      // ✅ Sort sizes by database order AND sync pin colors
      const sizeOrderMap = await getSizeOrderFromDB();
      const sortedSizes = billboardSizes.sort((a, b) => {
        const orderA = sizeOrderMap[a] || 999;
        const orderB = sizeOrderMap[b] || 999;
        return orderA - orderB;
      });
      setDbSizes(sortedSizes);
      
      // ✅ Sync pin colors with DB order
      const sizeColorData = sortedSizes.map((name, i) => ({ name, sort_order: sizeOrderMap[name] || 999 }));
      setSizeColorsFromData(sizeColorData);
      
      console.log('✅ Billboards loaded successfully:');
      console.log('- Total billboards:', processedBillboards.length);
      console.log('- Cities:', cities.length);
      console.log('- Sizes (sorted):', sortedSizes.length, sortedSizes);
      console.log('- Municipalities:', municipalities.length);
      console.log('- Ad types (from contracts):', adTypes.length);
      console.log('- Customers (from contracts):', customers.length);
      console.log('- Contract numbers:', contractNumbers.length);
      
    } catch (error: any) {
      console.error('❌ Error loading billboards:', error);
      toast.error(`فشل في تحميل اللوحات: ${error.message || 'خطأ غير معروف'}`)
      setBillboards([]);
    } finally {
      setLoading(false);
    }
  }, [sortBillboardsBySize, loadContractsData, getSizeOrderFromDB]);

  // ✅ Optimistic local visibility update for instant UI feedback
  const updateBillboardVisibilityLocal = useCallback((billboardId: string | number, isVisibleInAvailable: boolean) => {
    setBillboards(prev => prev.map((b: any) => {
      const currentId = String(b.ID ?? b.id ?? '');
      return currentId === String(billboardId)
        ? { ...b, is_visible_in_available: isVisibleInAvailable }
        : b;
    }));
  }, []);

  // Load municipalities
  const loadMunicipalities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setMunicipalities(data || []);
      console.log('✅ Municipalities loaded:', data?.length || 0);
    } catch (error: any) {
      console.error('Error loading municipalities:', error);
    }
  }, []);

  // ✅ Load sizes with sort_order from database
  const loadSizes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setSizes(data || []);
      
      // ✅ Update dbSizes with sorted order from database
      const sortedSizeNames = data?.map(s => s.name) || [];
      setDbSizes(sortedSizeNames);
      
      console.log('✅ Sizes loaded with database sort order:', sortedSizeNames);
    } catch (error: any) {
      console.error('Error loading sizes:', error);
    }
  }, []);

  // Load levels - من جدول billboard_levels
  const loadLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('*')
        .order('level_code', { ascending: true });
      
      if (error) throw error;
      
      const levelCodes = data?.map(level => level.level_code).filter(Boolean) || [];
      setLevels(levelCodes);
      console.log('✅ Loaded levels from billboard_levels:', levelCodes);
    } catch (error: any) {
      console.error('Error loading levels:', error);
      setLevels(['A', 'B', 'S']); // القيم الافتراضية
    }
  }, []);

  // Load faces - من جدول billboard_faces
  const loadFaces = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_faces')
        .select('*')
        .order('count', { ascending: true });
      
      if (error) throw error;
      
      const facesData = data?.map(face => ({
        id: face.id,
        name: face.name,
        count: face.count
      })) || [];
      
      setFaces(facesData);
      console.log('✅ Loaded faces from billboard_faces:', facesData);
    } catch (error: any) {
      console.error('Error loading faces:', error);
      setFaces([
        { id: 1, name: 'وجه واحد', count: 1 },
        { id: 2, name: 'وجهين', count: 2 },
        { id: 4, name: 'أربعة أوجه', count: 4 }
      ]);
    }
  }, []);

  // Load billboard types - من جدول billboard_types
  const loadBillboardTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_types')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const typeNames = data?.map(type => type.name).filter(Boolean) || [];
      setBillboardTypes(typeNames);
      console.log('✅ Loaded billboard types from billboard_types:', typeNames);
    } catch (error: any) {
      console.error('Error loading billboard types:', error);
      setBillboardTypes(['تيبول', 'برجية', 'عادية']);
    }
  }, []);

  // ✅ FIXED: Initialize data on component mount with proper dependency array
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadMunicipalities(),
        loadSizes(),
        loadLevels(),
        loadFaces(),
        loadBillboardTypes()
      ]);
      // Load billboards last to ensure all form data is ready
      await loadBillboards();
    };
    
    initializeData();
  }, []); // ✅ Empty dependency array to prevent infinite loop

  return {
    billboards,
    loading,
    citiesList,
    dbSizes,
    dbMunicipalities,
    dbAdTypes,
    dbCustomers,
    dbContractNumbers,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    loadBillboards,
    updateBillboardVisibilityLocal,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    getSizeOrderFromDB,
    sortBillboardsBySize
  };
};