// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { Billboard, Contract } from '@/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export interface BillboardWithContract extends Billboard {
  contract?: {
    id: string;
    customer_name: string;
    ad_type: string;
    start_date: string;
    end_date: string;
    rent_cost: number;
  };
}

// جلب اللوحات مع صور التصميم من مهام التركيب
export const fetchBillboardsWithContracts = async (): Promise<BillboardWithContract[]> => {
  console.log('🔍 fetchBillboardsWithContracts: Starting...');
  try {
    console.log('📡 Executing Supabase query with retry...');
    
    // استخدام fetchWithRetry للتعامل مع الشبكات البطيئة
    const result = await fetchWithRetry<any[]>(async () => {
      const res = await supabase
        .from('billboards')
        .select('*')
        .order('ID', { ascending: true });
      return res;
    }, { maxRetries: 3, timeout: 60000 }); // 60 ثانية timeout

    console.log('✅ Query executed. Error:', result.error, 'Data count:', result.data?.length || 0);

    if (result.error) {
      console.error('❌ Error fetching billboards:', result.error);
      return [];
    }

    const billboards = result.data as any[];

    if (!billboards || billboards.length === 0) {
      console.warn('⚠️ No billboards found in database');
      return [];
    }

    // جلب صور التصميم من مهام التركيب لكل اللوحات
    const billboardIds = billboards.map(b => b.ID);
    let designImagesMap: Record<number, { design_face_a?: string; design_face_b?: string; installed_image_face_a_url?: string; installed_image_face_b_url?: string }> = {};
    
    try {
      // جلب مهام التركيب المرتبطة باللوحات
      const { data: installationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url')
        .in('billboard_id', billboardIds);
      
      if (installationItems && installationItems.length > 0) {
        console.log('📸 Found installation items with designs:', installationItems.length);
        installationItems.forEach((item: any) => {
          if (item.billboard_id) {
            // الاحتفاظ بأحدث بيانات التصميم لكل لوحة
            designImagesMap[item.billboard_id] = {
              design_face_a: item.design_face_a || designImagesMap[item.billboard_id]?.design_face_a,
              design_face_b: item.design_face_b || designImagesMap[item.billboard_id]?.design_face_b,
              installed_image_face_a_url: item.installed_image_face_a_url || designImagesMap[item.billboard_id]?.installed_image_face_a_url,
              installed_image_face_b_url: item.installed_image_face_b_url || designImagesMap[item.billboard_id]?.installed_image_face_b_url,
            };
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch installation design images:', err);
    }

    // معالجة بسيطة للبيانات مع إضافة صور التصميم
    const processedBillboards: BillboardWithContract[] = billboards.map((billboard: any) => {
      const designData = designImagesMap[billboard.ID] || {};
      const endDateRaw = billboard.Rent_End_Date;
      const startDateRaw = billboard.Rent_Start_Date;
      
      let remainingDays: number | undefined = undefined;
      let nearExpiry = false;
      
      if (endDateRaw) {
        try {
          const endDate = new Date(endDateRaw);
          if (!isNaN(endDate.getTime())) {
            const today = new Date();
            const diffMs = endDate.getTime() - today.getTime();
            remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (remainingDays > 0 && remainingDays <= 20) nearExpiry = true;
          }
        } catch {}
      }

      const hasContract = Boolean(billboard.Contract_Number);
      let status: 'available' | 'rented' | 'maintenance';
      
      if (hasContract) {
        if (typeof remainingDays === 'number' && remainingDays <= 0) {
          status = 'available';
        } else {
          status = 'rented';
        }
      } else {
        status = billboard.Status || 'available';
      }

      return {
        ID: billboard.ID,
        Billboard_Name: billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`,
        City: billboard.City || '',
        District: billboard.District || '',
        Municipality: billboard.Municipality || '',
        Size: billboard.Size || '',
        Status: status,
        Price: billboard.Price || '',
        Level: billboard.Level || '',
        Image_URL: billboard.Image_URL || '',
        GPS_Coordinates: billboard.GPS_Coordinates || '',
        GPS_Link: billboard.GPS_Link || '',
        Nearest_Landmark: billboard.Nearest_Landmark || '',
        Faces_Count: billboard.Faces_Count || '1',
        Contract_Number: billboard.Contract_Number || '',
        Customer_Name: billboard.Customer_Name || '',
        Rent_Start_Date: startDateRaw || '',
        Rent_End_Date: endDateRaw || '',
        Days_Count: typeof remainingDays === 'number' ? String(remainingDays) : undefined,
        Ad_Type: billboard.Ad_Type || '',
        // إضافة صور التصميم من مهام التركيب
        design_face_a: designData.design_face_a || billboard.design_face_a || '',
        design_face_b: designData.design_face_b || billboard.design_face_b || '',
        installed_image_face_a_url: designData.installed_image_face_a_url || '',
        installed_image_face_b_url: designData.installed_image_face_b_url || '',
        id: String(billboard.ID),
        name: billboard.Billboard_Name,
        location: billboard.Nearest_Landmark,
        size: billboard.Size,
        price: Number(billboard.Price || 0),
        status: status as 'available' | 'rented' | 'maintenance',
        city: billboard.City,
        district: billboard.District,
        municipality: billboard.Municipality,
        coordinates: billboard.GPS_Coordinates,
        image: billboard.Image_URL,
        contractNumber: billboard.Contract_Number || '',
        clientName: billboard.Customer_Name || '',
        expiryDate: endDateRaw || '',
        adType: billboard.Ad_Type || '',
        level: billboard.Level || '',
        remainingDays,
        nearExpiry,
      };
    });

    console.log('Fetched billboards (simplified):', processedBillboards.length);
    return processedBillboards;
  } catch (error) {
    console.error('Error in fetchBillboardsWithContracts:', error);
    return [];
  }
};



// تحديث بيانات اللوحة مع العقد
export const updateBillboardContract = async (
  billboardId: number,
  contractData: {
    customer_name: string;
    ad_type: string;
    start_date: string;
    end_date: string;
    rent_cost: number;
  }
): Promise<void> => {
  try {
    // إنشاء عقد جديد
    const { data: contract, error: contractError } = await supabase
      .from('Contract')
      .insert(contractData)
      .select()
      .single();

    if (contractError) {
      throw contractError;
    }

    // ربط اللوحة بالعقد
    const { error: billboardError } = await supabase
      .from('billboards')
      .update({
        contract_id: contract.id,
        start_date: contractData.start_date,
        end_date: contractData.end_date,
        customer_name: contractData.customer_name,
        Status: 'rented'
      })
      .eq('ID', billboardId);

    if (billboardError) {
      throw billboardError;
    }

    console.log('Billboard contract updated successfully');
  } catch (error) {
    console.error('Error updating billboard contract:', (error as any)?.message || JSON.stringify(error));
    throw error;
  }
};

// تحرير اللوحة من العقد
export const releaseBillboardContract = async (billboardId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('billboards')
      .update({
        contract_id: null,
        start_date: null,
        end_date: null,
        customer_name: null,
        Status: 'available'
      })
      .eq('ID', billboardId);

    if (error) {
      throw error;
    }

    console.log('Billboard released from contract successfully');
  } catch (error) {
    console.error('Error releasing billboard contract:', (error as any)?.message || JSON.stringify(error));
    throw error;
  }
};
