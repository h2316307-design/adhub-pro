// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

interface InstallationPricing {
  size: string;
  installation_price: number | null;
  print_price: number | null;
  size_id?: number | null;
  size_name?: string | null;
}

interface Billboard {
  id: string;
  size: string;
  level?: string;
  name?: string;
  size_id?: number;
  faces?: number;
}

// ✅ FIXED: Get installation pricing from sizes table with installation_price column
export async function getInstallationPricing(): Promise<InstallationPricing[]> {
  try {
    console.log('🔄 Fetching installation pricing from sizes table...');
    
    // ✅ FIXED: Use sizes table with installation_price column
    const { data: sizesData, error: sizesError } = await supabase
      .from('sizes')
      .select('id, name, width, height, installation_price');

    if (!sizesError && sizesData && sizesData.length > 0) {
      console.log('✅ Found installation pricing in sizes table:', sizesData);
      
      // ✅ FIXED: Convert sizes data to InstallationPricing format
      return sizesData.map((item: any) => ({
        size: item.name, // Use size name as identifier
        installation_price: item.installation_price !== null ? Number(item.installation_price) : null,
        print_price: null, // Not available in sizes table
        size_id: item.id,
        size_name: item.name
      }));
    }

    // Fallback to old tables if sizes table doesn't have data
    console.log('⚠️ No data in sizes table, trying fallback tables...');
    
    // جرب الجدول الأول installation_print_pricing (يستخدم install_price)
    const { data: data1, error: error1 } = await supabase
      .from('installation_print_pricing')
      .select('size, install_price, print_price, size_id');

    if (!error1 && data1 && data1.length > 0) {
      console.log('Found installation pricing in installation_print_pricing table:', data1);
      // تحويل install_price إلى installation_price
      return data1.map((item: any) => ({
        size: item.size,
        installation_price: Number(item.install_price),
        print_price: item.print_price,
        size_id: item.size_id,
        size_name: null
      }));
    }

    // إذا فشل الجدول الأول، جرب الجدول الثاني print_installation_pricing
    const { data: data2, error: error2 } = await supabase
      .from('print_installation_pricing')
      .select('size, installation_price, print_price, billboard_level, customer_category');

    if (!error2 && data2 && data2.length > 0) {
      console.log('Found installation pricing in print_installation_pricing table:', data2);
      return data2.map((item: any) => ({
        size: item.size,
        installation_price: Number(item.installation_price),
        print_price: item.print_price,
        size_id: null,
        size_name: null
      }));
    }

    console.warn('❌ No installation pricing found in any table');
    console.warn('Error 1:', error1);
    console.warn('Error 2:', error2);
    return [];
  } catch (e) {
    console.error('💥 Error fetching installation pricing:', e);
    return [];
  }
}

// Function to normalize size format (handle multiple formats: 4x12, 12x4, 4*12, etc.)
function normalizeSizeFormat(size: string): string[] {
  if (!size) return [size];
  
  const cleanSize = size.toString().trim().toLowerCase();
  const separators = ['x', '*', '×', '-', ' '];
  let dimensions: string[] = [];
  
  // تجربة الفواصل المختلفة
  for (const sep of separators) {
    if (cleanSize.includes(sep)) {
      dimensions = cleanSize.split(sep).map(d => d.trim()).filter(d => d);
      break;
    }
  }
  
  if (dimensions.length === 2) {
    const [a, b] = dimensions;
    // إرجاع جميع التنسيقات الممكنة
    return [
      `${a}x${b}`,
      `${b}x${a}`,
      `${a}*${b}`,
      `${b}*${a}`,
      `${a}-${b}`,
      `${b}-${a}`,
      cleanSize // التنسيق الأصلي
    ];
  }
  
  return [cleanSize];
}

// ✅ FIXED: Enhanced billboard size matching with sizes table
async function findSizeInDatabase(billboardSize: string): Promise<{ id: number; name: string; installation_price: number | null } | null> {
  try {
    console.log(`🔍 Looking for size "${billboardSize}" in sizes table...`);
    
    // ✅ FIXED: Query sizes table for matching size - include null values
    const { data: sizesData, error } = await supabase
      .from('sizes')
      .select('id, name, installation_price');

    if (error || !sizesData) {
      console.warn('Failed to fetch sizes data:', error);
      return null;
    }

    console.log('📊 Available sizes in database:', sizesData.map(s => ({ name: s.name, price: s.installation_price })));

    // ✅ FIXED: Try exact match first
    let matchedSize = sizesData.find(s => 
      s.name.toLowerCase() === billboardSize.toLowerCase()
    );

    if (matchedSize) {
      console.log(`✅ Exact match found: ${matchedSize.name} -> ${matchedSize.installation_price} د.ل`);
      return matchedSize;
    }

    // ✅ FIXED: Try normalized format matching
    const possibleFormats = normalizeSizeFormat(billboardSize);
    console.log(`🔄 Trying normalized formats:`, possibleFormats);

    for (const format of possibleFormats) {
      matchedSize = sizesData.find(s => {
        const sizeFormats = normalizeSizeFormat(s.name);
        return sizeFormats.some(sf => sf === format);
      });

      if (matchedSize) {
        console.log(`✅ Format match found: ${format} -> ${matchedSize.name} -> ${matchedSize.installation_price} د.ل`);
        return matchedSize;
      }
    }

    console.warn(`❌ No size match found for "${billboardSize}"`);
    console.log('Available sizes:', sizesData.map(s => s.name));
    return null;

  } catch (e) {
    console.error('Error finding size in database:', e);
    return null;
  }
}

// ✅ FIXED: Calculate installation price based on faces - only show "وجه واحد" when faces = 1
function calculateInstallationPriceByFaces(basePrice: number | null, faces: number): number {
  if (basePrice === null || basePrice === 0) {
    return 0;
  }
  
  if (faces === 1) {
    // ✅ FIXED: Single face = half price
    return Math.round(basePrice / 2);
  }
  // Default (2 faces or more) = full price
  return basePrice;
}

// ✅ FIXED: حساب تكلفة التركيب لمجموعة من اللوحات مع دعم الوجوه
export async function calculateInstallationCost(billboards: Billboard[]): Promise<{
  totalInstallationCost: number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
}> {
  if (!billboards || billboards.length === 0) {
    console.log('No billboards provided for installation_cost calculation');
    return {
      totalInstallationCost: 0,
      installationDetails: []
    };
  }

  console.log('🔄 Calculating installation_cost for billboards:', billboards);

  let totalInstallationCost = 0;
  const installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }> = [];

  for (const billboard of billboards) {
    const size = billboard.size || '';
    const billboardName = billboard.name || `لوحة ${billboard.id}`;
    const faces = billboard.faces || 2; // ✅ FIXED: Default to 2 faces if not specified
    
    console.log(`🔄 Processing billboard ${billboard.id} with size: ${size}, faces: ${faces}`);
    
    let baseInstallationPrice: number | null = null;
    
    // ✅ FIXED: Use sizes table to find installation price
    const sizeMatch = await findSizeInDatabase(size);
    if (sizeMatch) {
      baseInstallationPrice = sizeMatch.installation_price;
      console.log(`✅ Found installation price from sizes table: ${baseInstallationPrice} د.ل for size ${size}`);
    } else {
      console.log('⚠️ No size match found in sizes table, trying fallback method...');
      // Fallback to old method
      const installationPricing = await getInstallationPricing();
      
      if (installationPricing.length > 0) {
        const possibleSizes = normalizeSizeFormat(size);
        console.log(`Trying possible sizes for ${size}:`, possibleSizes);
        
        for (const possibleSize of possibleSizes) {
          const pricing = installationPricing.find(p => {
            const pSizes = normalizeSizeFormat(p.size);
            return pSizes.includes(possibleSize);
          });
          
          if (pricing && pricing.installation_price !== null && pricing.installation_price > 0) {
            baseInstallationPrice = Number(pricing.installation_price);
            console.log(`Found base installation price for ${size}: ${baseInstallationPrice} (matched with ${pricing.size})`);
            break;
          }
        }
      }
    }

    // ✅ FIXED: Calculate adjusted price based on faces
    const adjustedPrice = calculateInstallationPriceByFaces(baseInstallationPrice, faces);
    
    if (baseInstallationPrice === null || baseInstallationPrice === 0) {
      console.warn(`❌ No installation price found for billboard ${billboard.id}, size: ${size}`);
    } else {
      console.log(`💰 Billboard ${billboard.id}: Base price: ${baseInstallationPrice} د.ل, Faces: ${faces}, Adjusted price: ${adjustedPrice} د.ل`);
    }

    // ✅ FIXED: إضافة تفاصيل التركيب - use adjustedPrice as installationPrice for display
    installationDetails.push({
      billboardId: billboard.id,
      billboardName,
      size,
      installationPrice: adjustedPrice, // ✅ FIXED: Use adjusted price for display
      faces: faces,
      adjustedPrice: adjustedPrice
    });

    totalInstallationCost += adjustedPrice;
  }

  console.log('✅ installation_cost calculation result:', {
    totalInstallationCost,
    installationDetails
  });

  return {
    totalInstallationCost,
    installationDetails
  };
}

// ✅ CRITICAL FIX: Remove problematic column and simplify billboard data fetching
export async function calculateInstallationCostFromIds(billboardIds: string[]): Promise<{
  totalInstallationCost: number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
}> {
  if (!billboardIds || billboardIds.length === 0) {
    console.log('No billboard IDs provided for installation_cost calculation');
    return {
      totalInstallationCost: 0,
      installationDetails: []
    };
  }

  console.log('🔄 Calculating installation_cost for billboard IDs:', billboardIds);

  try {
    // ✅ CRITICAL FIX: Remove the problematic "المقاس مع الدغاية" column
    const { data: billboardsData, error } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, Size, Faces_Count')
      .in('ID', billboardIds.map(id => Number(id)));

    if (error) {
      console.error('Error fetching billboards for installation_cost:', error);
      return {
        totalInstallationCost: 0,
        installationDetails: []
      };
    }

    if (!billboardsData || billboardsData.length === 0) {
      console.warn('No billboards found for IDs:', billboardIds);
      return {
        totalInstallationCost: 0,
        installationDetails: []
      };
    }

    console.log('✅ Raw billboard data from database:', billboardsData);

    // ✅ FIXED: تحويل البيانات إلى التنسيق المطلوب - use only Size column
    const billboards: Billboard[] = billboardsData.map((b: any) => {
      const size = b.Size || ''; // Use only Size column
      
      return {
        id: String(b.ID),
        name: b.Billboard_Name || '',
        size: size,
        size_id: null,
        faces: Number(b.Faces_Count) || 2 // ✅ FIXED: Use Faces_Count column, default to 2
      };
    });

    console.log('✅ Processed billboards for installation calculation:', billboards);

    return await calculateInstallationCost(billboards);
  } catch (e) {
    console.error('💥 Error calculating installation_cost from IDs:', e);
    return {
      totalInstallationCost: 0,
      installationDetails: []
    };
  }
}

// حفظ تفاصيل التركيب في العقد
export function formatInstallationDataForContract(installationDetails: Array<{
  billboardId: string;
  billboardName: string;
  size: string;
  installationPrice: number;
}>) {
  return {
    installation_details: JSON.stringify(installationDetails),
    total_installation_cost: installationDetails.reduce((sum, detail) => sum + detail.installationPrice, 0)
  };
}

// استخراج تفاصيل التركيب من بيانات العقد
export function parseInstallationDataFromContract(contractData: any): {
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
  }>;
  totalInstallationCost: number;
} {
  try {
    const installationDetails = contractData.installation_details 
      ? JSON.parse(contractData.installation_details)
      : [];
    
    const totalInstallationCost = contractData.total_installation_cost || 0;

    return {
      installationDetails: Array.isArray(installationDetails) ? installationDetails : [],
      totalInstallationCost: Number(totalInstallationCost) || 0
    };
  } catch (e) {
    console.warn('Failed to parse installation data from contract:', e);
    return {
      installationDetails: [],
      totalInstallationCost: 0
    };
  }
}

// تصدير الواجهة للاستخدام في ملفات أخرى
export type { InstallationCalculationResult } from './installationService';

// إضافة نوع للنتيجة
export interface InstallationCalculationResult {
  totalInstallationCost: number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
  }>;
}

// مسح الكاش (للاختبار)
export function clearInstallationPricingCache(): void {
  // يمكن إضافة منطق الكاش هنا إذا لزم الأمر
  console.log('Installation pricing cache cleared');
}