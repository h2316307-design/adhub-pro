// @ts-nocheck
import type { Billboard, Contract } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { calculateInstallationCostFromIds, formatInstallationDataForContract } from './installationService';

interface ContractData {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  billboard_ids?: string[];
  ad_type?: string;
  // ✅ FIXED: Support both old and new installment formats
  installments?: Array<{ amount: number; months: number; paymentType: string; dueDate?: string }>;
  installments_data?: string | Array<{ amount: number; paymentType: string; description: string; dueDate: string }>;
  // ✅ NEW: Add print cost settings
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  // ✅ NEW: Add operating fee rate
  operating_fee_rate?: number;
}

interface ContractCreate {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  ad_type?: string;
  billboard_ids?: string[];
  installments?: Array<{ amount: number; months: number; paymentType: string; dueDate?: string }>;
  installments_data?: string | Array<{ amount: number; paymentType: string; description: string; dueDate: string }>;
  // ✅ NEW: Add print cost settings
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  // ✅ NEW: Add operating fee rate
  operating_fee_rate?: number;
}

// إنشاء عقد جديد مع معالجة محسنة للأخطاء وحفظ بيانات اللوحات والتركيب
export async function createContract(contractData: ContractData) {
  console.log('Creating contract with data:', contractData);
  
  // فصل معرفات اللوحات عن بيانات العقد
  const { billboard_ids, installments, installments_data, print_cost_enabled, print_price_per_meter, operating_fee_rate, ...contractPayload } = contractData;

  // Determine customer_id: prefer explicit, else find by name, else create new customer
  let customer_id: string | null = (contractData as any).customer_id || null;

  if (!customer_id && contractPayload.customer_name) {
    try {
      const nameTrim = String(contractPayload.customer_name).trim();
      const { data: existing, error: exErr } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', nameTrim)
        .limit(1)
        .maybeSingle();
      
      if (!exErr && existing && (existing as any).id) {
        customer_id = (existing as any).id;
      } else {
        // create new customer
        const { data: newC, error: newErr } = await supabase
          .from('customers')
          .insert({ name: nameTrim })
          .select()
          .single();
        if (!newErr && newC && (newC as any).id) customer_id = (newC as any).id;
      }
    } catch (e) {
      console.warn('Customer handling failed:', e);
      // ignore and proceed without customer_id
    }
  }

  // إعداد بيانات اللوحات للحفظ في العقد
  let billboardsData: any[] = [];
  let installationCost = 0;
  let printCost = 0;
  let operatingFee = 0;
  
  if (billboard_ids && billboard_ids.length > 0) {
    try {
      const { data: billboardsInfo, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboard_ids.map(id => Number(id)));

      if (!billboardsError && billboardsInfo) {
        billboardsData = billboardsInfo.map((b: any) => ({
          id: String(b.ID),
          name: b.name || b.Billboard_Name || '',
          location: b.location || b.Nearest_Landmark || '',
          city: b.city || b.City || '',
          size: b.size || b.Size || '',
          level: b.level || b.Level || '',
          price: Number(b.price) || 0,
          image: b.image || ''
        }));

        // حساب تكلفة التركيب
        const installationResult = await calculateInstallationCostFromIds(billboard_ids);
        installationCost = installationResult.totalInstallationCost;
        
        // ✅ NEW: حساب تكلفة الطباعة إذا كانت مفعلة
        if (print_cost_enabled && print_price_per_meter && print_price_per_meter > 0) {
          printCost = billboardsInfo.reduce((sum: number, b: any) => {
            const size = b.size || b.Size || '';
            const faces = Number(b.faces || b.Faces || b.faces_count || b.Faces_Count || 1);
            
            // Parse billboard area from size (e.g., "4x3" -> 12 square meters)
            const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
            if (!sizeMatch) return sum;
            
            const width = parseFloat(sizeMatch[1]);
            const height = parseFloat(sizeMatch[2]);
            const area = width * height;
            
            return sum + (area * faces * print_price_per_meter);
          }, 0);
        }
        
        console.log('Installation cost calculated:', installationResult);
        console.log('Total installation cost:', installationCost);
        console.log('Total print cost:', printCost);
      }
    } catch (e) {
      console.warn('Failed to fetch billboard details or calculate costs:', e);
    }
  }

  // ✅ CORRECTED: حساب سعر الإيجار الصحيح (الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة)
  const finalTotal = contractPayload.rent_cost; // هذا هو الإجمالي النهائي من الواجهة
  const rentalCostOnly = Math.max(0, finalTotal - installationCost - printCost); // سعر الإيجار = الإجمالي النهائي - التركيب - الطباعة
  
  // ✅ NEW: حساب رسوم التشغيل بالنسبة المحددة من صافي الإيجار
  const operatingFeeRate = operating_fee_rate || 3; // النسبة الافتراضية 3%
  operatingFee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
  
  console.log('Final total from UI:', finalTotal);
  console.log('Installation cost:', installationCost);
  console.log('Print cost:', printCost);
  console.log('Rental cost only (final - installation - print):', rentalCostOnly);
  console.log('Operating fee rate:', operatingFeeRate, '%');
  console.log('Operating fee calculated:', operatingFee);

  // Get next contract number
  let nextContractNumber = 1;
  try {
    const { data, error } = await supabase
      .from('Contract')
      .select('Contract_Number')
      .order('Contract_Number', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      nextContractNumber = (parseInt(data[0].Contract_Number) || 0) + 1;
    }
  } catch (e) {
    console.warn('Failed to get next contract number, using 1');
  }

  // ✅ FIXED: Handle installments data properly
  let installmentsForSaving = null;
  
  // Check for new format first (installments_data)
  if (installments_data) {
    if (typeof installments_data === 'string') {
      installmentsForSaving = installments_data;
    } else if (Array.isArray(installments_data)) {
      installmentsForSaving = JSON.stringify(installments_data);
    }
    console.log('Using installments_data:', installmentsForSaving);
  }
  // Fallback to old format (installments)
  else if (installments && Array.isArray(installments)) {
    installmentsForSaving = JSON.stringify(installments);
    console.log('Using legacy installments format:', installmentsForSaving);
  }

  // إعداد بيانات العقد للإدراج - استخدام الأسماء الصحيحة للأعمدة من schema
  const insertPayload: any = {
    Contract_Number: nextContractNumber,
    'Customer Name': contractPayload.customer_name,
    customer_category: (contractData as any).customer_category || 'عادي',
    Phone: null,
    Company: null,
    'Contract Date': contractPayload.start_date,
    Duration: null,
    'End Date': contractPayload.end_date,
    'Ad Type': contractPayload.ad_type || '', // ✅ FIXED: العمود الموجود فقط
    'Total Rent': rentalCostOnly, // ✅ CORRECTED: حفظ سعر الإيجار فقط (بدون التركيب والطباعة)
    Discount: contractPayload.discount || 0,
    installation_cost: installationCost, // ✅ بأحرف صغيرة كما في 
    print_cost: printCost, // ✅ NEW: حفظ تكلفة الطباعة
    fee: operatingFeeRate, // ✅ حفظ نسبة رسوم التشغيل في عمود fee
    Total: finalTotal, // ✅ CORRECTED: الإجمالي النهائي الكامل
    'Print Status': null,
    'Renewal Status': null,
    'Total Paid': (contractData as any)['Total Paid'] || 0,
    'Payment 1': (contractData as any)['Payment 1'] || null,
    'Payment 2': (contractData as any)['Payment 2'] || null,
    'Payment 3': (contractData as any)['Payment 3'] || null,
    Remaining: (contractData as any)['Remaining'] || finalTotal,
    customer_id: customer_id,
    billboard_id: null,
    // ✅ FIXED: حفظ بيانات اللوحات و billboard_ids
    billboards_data: JSON.stringify(billboardsData),
    billboards_count: billboardsData.length,
    billboard_ids: billboard_ids ? billboard_ids.join(',') : null, // ✅ حفظ معرفات اللوحات كنص مفصول بفواصل
    // ✅ CRITICAL FIX: Save billboard_prices from ContractCreate
    billboard_prices: (contractData as any).billboard_prices || null,
    // ✅ FIXED: Save installments data properly
    installments_data: installmentsForSaving,
    // ✅ NEW: Save print cost settings
    print_cost_enabled: print_cost_enabled || false,
    print_price_per_meter: print_price_per_meter || 0
  };

  console.log('Insert payload with all cost settings:', {
    ...insertPayload,
    billboard_prices: insertPayload.billboard_prices ? 'Billboard prices data present' : 'null',
    installments_data: installmentsForSaving ? 'JSON data present' : 'null',
    print_cost_enabled: insertPayload.print_cost_enabled,
    print_price_per_meter: insertPayload.print_price_per_meter,
    print_cost: insertPayload.print_cost,
    operating_fee_rate: insertPayload.operating_fee_rate,
    fee: insertPayload.fee
  });

  let contract: any = null;
  let contractError: any = null;

  function formatSupabaseErr(err: any) {
    try {
      if (!err) return '';
      if (typeof err === 'string') return err;
      // Common Supabase error shape: { message, details, hint, code }
      const out: any = {};
      for (const k of ['message', 'details', 'hint', 'code', 'status']) {
        if (err[k]) out[k] = err[k];
      }
      // include any nested error
      if (err.error) out.nested = err.error;
      return JSON.stringify(out);
    } catch (e) {
      return String(err);
    }
  }

  // محاولة الإدراج في جدول Contract
  try {
    const { data, error } = await supabase
      .from('Contract')
      .insert(insertPayload)
      .select()
      .single();

    contract = data;
    contractError = error;

    if (error) {
      console.warn('Failed to insert into Contract table:', formatSupabaseErr(error));
      throw error;
    } else {
      console.log('Successfully inserted into Contract table:', contract);
    }
  } catch (e) {
    console.error('Contract table insertion failed:', formatSupabaseErr(e));
    throw new Error('فشل في حفظ العقد في قاعدة البيانات. تفاصيل الخطأ: ' + formatSupabaseErr(e));
  }

  if (!contract) {
    throw new Error('فشل في إنشاء العقد');
  }

  // تحديث اللوحات المرتبطة بالعقد
  if (billboard_ids && billboard_ids.length > 0) {
    console.log('Updating billboards with contract:', billboard_ids);
    
    const newContractNumber = contract?.Contract_Number ?? contract?.id ?? contract?.contract_number;
    
    if (!newContractNumber) {
      console.warn('No contract number found, skipping billboard updates');
    } else {
      for (const billboard_id of billboard_ids) {
        try {
          const { error: billboardError } = await supabase
            .from('billboards')
            .update({
              Contract_Number: newContractNumber,
              Rent_Start_Date: contractData.start_date,
              Rent_End_Date: contractData.end_date,
              Customer_Name: contractData.customer_name,
              Ad_Type: contractData.ad_type || '',
              Status: 'محجوز'
            })
            .eq('ID', Number(billboard_id));

          if (billboardError) {
            console.error(`Failed to update billboard ${billboard_id}:`, billboardError);
            // لا نوقف العملية بسبب فشل تحديث لوحة واحدة
          } else {
            console.log(`Successfully updated billboard ${billboard_id}`);
          }
        } catch (e) {
          console.error(`Error updating billboard ${billboard_id}:`, e);
        }
      }
    }
  }

  return contract;
}

// جلب جميع العقود مع معالجة محسنة
export async function getContracts() {
  let data: any[] = [];
  
  // محاولة جلب من جدول Contract أولاً
  try {
    const { data: contractData, error: contractError } = await supabase
      .from('Contract')
      .select('*')
      .order('Contract_Number', { ascending: false });

    if (!contractError && Array.isArray(contractData)) {
      data = contractData;
      console.log('Fetched contracts from Contract table:', data.length);
    } else {
      console.warn('Contract table query failed:', contractError);
    }
  } catch (e) {
    console.warn('Contract table access failed:', e);
  }

  return (data || []).map((c: any) => {
    const id = c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID;
    return {
      ...c,
      id,
      Contract_Number: c.Contract_Number ?? c['Contract Number'] ?? id,
      'Contract Number': c['Contract Number'] ?? c.Contract_Number ?? id,
      customer_id: c.customer_id ?? null,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? '', // ✅ FIXED: استخدام العمود الموجود فقط
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? c.end_date ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      // ✅ NEW: Add print_cost to getContracts
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      status: c.status ?? c['Print Status'] ?? '',
      // إضافة بيانات اللوحات المحفوظة
      billboards_data: c.billboards_data || c['billboards_data'],
      billboards_count: c.billboards_count || c['billboards_count'] || 0,
      billboard_ids: c.billboard_ids || '', // ✅ إضافة معرفات اللوحات
      // ✅ CRITICAL FIX: Add billboard_prices to getContracts
      billboard_prices: c.billboard_prices || null,
      // ✅ NEW: Add operating fee data to getContracts
      fee: typeof c.fee === 'number' ? c.fee : Number(c.fee ?? 0),
      operating_fee_rate: typeof c.operating_fee_rate === 'number' ? c.operating_fee_rate : Number(c.operating_fee_rate ?? 3),
      // ✅ إضافة بيانات الدفعات
      installments_data: c.installments_data || null,
      // ✅ NEW: Add print cost settings to getContracts
      print_cost_enabled: c.print_cost_enabled || false,
      print_price_per_meter: c.print_price_per_meter || 0,
    } as any;
  });
}

// جلب عقد مع اللوحات المرتبطة به
export async function getContractWithBillboards(contractId: string): Promise<any> {
  try {
    let contractResult: any = null;
    let contractError: any = null;

    // محاولة جلب من جدول Contract
    try {
      const result = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', contractId)
        .single();
      
      contractResult = result;
      contractError = result.error;
    } catch (e) {
      contractError = e;
    }

    if (contractError || !contractResult?.data) {
      throw contractError || new Error('Contract not found');
    }

    // جلب اللوحات المرتبطة حالياً من جدول billboards
    const billboardResult = await supabase
      .from('billboards')
      .select('*')
      .eq('Contract_Number', contractId);

    const c = contractResult.data || {};

    // دمج تصاميم اللوحات من design_data إن وجدت
    let mergedBillboards = (billboardResult.data || []) as any[];
    try {
      const rawDesigns = c.design_data;
      const designsArray = rawDesigns
        ? (typeof rawDesigns === 'string' ? JSON.parse(rawDesigns) : rawDesigns)
        : [];
      if (Array.isArray(designsArray) && designsArray.length > 0) {
        const designMap = new Map<string, { a?: string; b?: string }>();
        designsArray.forEach((d: any) => {
          if (!d) return;
          const key = String(d.billboardId ?? d.billboard_id ?? '');
          if (!key) return;
          designMap.set(key, { a: d.designFaceA ?? d.design_face_a, b: d.designFaceB ?? d.design_face_b });
        });
        mergedBillboards = mergedBillboards.map((b: any) => {
          const key = String(b.ID ?? b.id ?? '');
          const match = designMap.get(key);
          if (match) {
            return { ...b, design_face_a: match.a || b.design_face_a, design_face_b: match.b || b.design_face_b };
          }
          return b;
        });
      }
    } catch (e) {
      console.warn('Failed to parse/merge design_data for contract:', e);
    }

    const normalized = {
      ...c,
      id: c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID,
      Contract_Number: c.Contract_Number ?? c['Contract Number'],
      'Contract Number': c['Contract Number'] ?? c.Contract_Number,
      customer_id: c.customer_id ?? null,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? '', // ✅ FIXED: استخدام العمود الموجود فقط
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? c.end_date ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      // ✅ NEW: Add print_cost to getContractWithBillboards
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      customer_category: c.customer_category ?? c['customer_category'] ?? 'عادي',
      // إضافة بيانات اللوحات المحفوظة
      saved_billboards_data: c.billboards_data || c['billboards_data'],
      saved_billboards_count: c.billboards_count || c['billboards_count'] || 0,
      billboard_ids: c.billboard_ids || '', // ✅ إضافة معرفات اللوحات
      // ✅ CRITICAL FIX: Add billboard_prices to getContractWithBillboards
      billboard_prices: c.billboard_prices || null,
      // ✅ NEW: Add operating fee data to getContractWithBillboards
      fee: typeof c.fee === 'number' ? c.fee : Number(c.fee ?? 0),
      operating_fee_rate: typeof c.operating_fee_rate === 'number' ? c.operating_fee_rate : Number(c.operating_fee_rate ?? 3),
      // ✅ إضافة بيانات الدفعات
      installments_data: c.installments_data || null,
      // ✅ NEW: Add print cost settings to getContractWithBillboards
      print_cost_enabled: c.print_cost_enabled || false,
      print_price_per_meter: c.print_price_per_meter || 0,
      // ✅ إضافة روابط التصاميم
      design_face_a_path: c.design_face_a_path || null,
      design_face_b_path: c.design_face_b_path || null,
      design_data: c.design_data || null,
    } as any;

    return {
      ...normalized,
      billboards: mergedBillboards,
    };
  } catch (error) {
    console.error('Error in getContractWithBillboards:', error);
    throw error;
  }
}

// جلب اللوحات المتاحة
export async function getAvailableBillboards() {
  const { data, error } = await supabase
    .from('billboards')
    .select('*')
    .eq('Status', 'available')
    .order('ID', { ascending: true });

  if (error) throw error;
  return data;
}

// تحديث عقد مع معالجة محسنة وحفظ بيانات اللوحات والتركيب
export async function updateContract(contractId: string, updates: any) {
  if (!contractId) throw new Error('Contract_Number مفقود');

  console.log('Updating contract:', contractId, 'with:', updates);

  const payload: any = { ...updates };
  
  // ✅ CORRECTED: التعامل مع القيم الصحيحة
  if (payload['Total Rent'] !== undefined) {
    // Total Rent يجب أن يكون سعر الإيجار فقط (بدون التركيب والطباعة)
    payload['Total Rent'] = Number(payload['Total Rent']) || 0;
  }
  if (payload['Total'] !== undefined) {
    // Total يجب أن يكون الإجمالي النهائي الكامل
    payload['Total'] = Number(payload['Total']) || 0;
  }
  if (payload['Total Paid'] !== undefined) payload['Total Paid'] = Number(payload['Total Paid']) || 0;

  // إضافة بيانات اللوحات إذا كانت متوفرة
  if (payload.billboards_data) {
    payload['billboards_data'] = payload.billboards_data;
  }
  if (payload.billboards_count !== undefined) {
    payload['billboards_count'] = payload.billboards_count;
  }

  // ✅ FIXED: حفظ billboard_ids إذا تم تمريرها
  if (payload.billboard_ids) {
    if (Array.isArray(payload.billboard_ids)) {
      payload['billboard_ids'] = payload.billboard_ids.join(',');
    } else if (typeof payload.billboard_ids === 'string') {
      payload['billboard_ids'] = payload.billboard_ids;
    }
  }

  // ✅ CRITICAL FIX: Save billboard_prices from updates
  if (payload.billboard_prices) {
    payload['billboard_prices'] = payload.billboard_prices;
  }

  // ✅ NEW: Save operating fee data from updates
  if (payload.fee !== undefined) {
    payload['fee'] = Number(payload.fee) || 0;
  }
  if (payload.operating_fee_rate !== undefined) {
    payload['operating_fee_rate'] = Number(payload.operating_fee_rate) || 3;
  }

  // ✅ NEW: Save print cost settings from updates
  if (payload.print_cost_enabled !== undefined) {
    payload['print_cost_enabled'] = Boolean(payload.print_cost_enabled);
  }
  if (payload.print_price_per_meter !== undefined) {
    payload['print_price_per_meter'] = Number(payload.print_price_per_meter) || 0;
  }
  if (payload.print_cost !== undefined) {
    payload['print_cost'] = Number(payload.print_cost) || 0;
  }

  // ✅ FIXED: Handle installments data properly in updates
  if (payload.installments_data !== undefined) {
    if (typeof payload.installments_data === 'object' && payload.installments_data !== null) {
      payload['installments_data'] = JSON.stringify(payload.installments_data);
    } else if (typeof payload.installments_data === 'string' || payload.installments_data === null) {
      payload['installments_data'] = payload.installments_data;
    }
  }

  // حساب تكلفة التركيب والطباعة إذا تم تحديث اللوحات
  if (payload.billboard_ids && Array.isArray(payload.billboard_ids)) {
    try {
      const installationResult = await calculateInstallationCostFromIds(payload.billboard_ids);
      const installationCost = installationResult.totalInstallationCost;
      
      // ✅ NEW: حساب تكلفة الطباعة إذا كانت مفعلة
      let printCost = 0;
      if (payload.print_cost_enabled && payload.print_price_per_meter && payload.print_price_per_meter > 0) {
        const { data: billboardsInfo } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', payload.billboard_ids.map((id: string) => Number(id)));
        
        if (billboardsInfo) {
          printCost = billboardsInfo.reduce((sum: number, b: any) => {
            const size = b.size || b.Size || '';
            const faces = Number(b.faces || b.Faces || b.faces_count || b.Faces_Count || 1);
            
            const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
            if (!sizeMatch) return sum;
            
            const width = parseFloat(sizeMatch[1]);
            const height = parseFloat(sizeMatch[2]);
            const area = width * height;
            
            return sum + (area * faces * payload.print_price_per_meter);
          }, 0);
        }
      }
      
      payload['installation_cost'] = installationCost; // ✅ بأحرف صغيرة
      payload['print_cost'] = printCost; // ✅ NEW: حفظ تكلفة الطباعة
      
      // ✅ CORRECTED: حساب القيم الصحيحة
      const finalTotal = payload['Total'] || payload.rent_cost || 0; // هذا هو الإجمالي النهائي
      const rentalCostOnly = Math.max(0, finalTotal - installationCost - printCost); // سعر الإيجار = الإجمالي النهائي - التركيب - الطباعة
      
      // ✅ NEW: حساب رسوم التشغيل من سعر الإيجار الصافي بالنسبة المحددة
      const operatingFeeRate = payload.operating_fee_rate || 3;
      const operatingFee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
      payload['fee'] = operatingFee;
      payload['operating_fee_rate'] = operatingFeeRate;
      
      // تحديث القيم في العقد
      payload['Total Rent'] = rentalCostOnly; // سعر الإيجار فقط
      payload['Total'] = finalTotal; // الإجمالي النهائي
      
      console.log('Updated calculations for contract:');
      console.log('- Final total:', finalTotal);
      console.log('- Installation cost:', installationCost);
      console.log('- Print cost:', printCost);
      console.log('- Rental cost only:', rentalCostOnly);
      console.log('- Operating fee rate:', operatingFeeRate, '%');
      console.log('- Operating fee:', operatingFee);
    } catch (e) {
      console.warn('Failed to calculate costs during update:', e);
    }
  }

  let success = false;
  let data: any = null;
  let error: any = null;

  // محاولة التحديث في جدول Contract
  try {
    const result = await supabase
      .from('Contract')
      .update(payload)
      .eq('Contract_Number', contractId)
      .select()
      .limit(1);
    
    data = result.data;
    error = result.error;
    
    if (!error && data && data.length > 0) {
      success = true;
      console.log('Successfully updated Contract table');
    }
  } catch (e) {
    console.warn('Contract table update failed:', e);
    error = e;
  }

  // محاولة أخيرة بمعرف رقمي
  if (!success) {
    const numericId = /^\d+$/.test(String(contractId)) ? Number(contractId) : null;
    if (numericId !== null) {
      try {
        const result = await supabase
          .from('Contract')
          .update(payload)
          .eq('Contract_Number', numericId)
          .select()
          .limit(1);
        
        data = result.data;
        error = result.error;
        
        if (!error && data && data.length > 0) {
          success = true;
          console.log('Successfully updated with numeric ID');
        }
      } catch (e) {
        console.warn('Numeric ID update failed:', e);
      }
    }
  }

  if (!success) {
    console.error('All update attempts failed. Last error:', error);
    throw error || new Error('لم يتم حفظ أي تغييرات (RLS أو رقم العقد غير صحيح)');
  }

  return Array.isArray(data) ? data[0] : data;
}

// تحديث العقود المنتهية الصلاحية
export async function updateExpiredContracts() {
  const today = new Date().toISOString().split('T')[0];
  
  const { error } = await supabase
    .from('Contract')
    .update({ 'Print Status': 'expired' })
    .lt('End Date', today)
    .neq('Print Status', 'expired');

  if (error) throw error;
}

// إحصائيات العقود
export async function getContractsStats() {
  const contracts = await getContracts();
  
  const today = new Date();
  const stats = {
    total: contracts?.length || 0,
    active: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) > today).length || 0,
    expired: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) <= today).length || 0,
  };
  
  return stats;
}

// تحرير اللوحات المنتهية الصلاحية تلقائياً
export async function autoReleaseExpiredBillboards() {
  const today = new Date().toISOString().split('T')[0];
  
  const contracts = await getContracts();
  const expiredContracts = contracts.filter(c => c['End Date'] && c['End Date'] < today);

  for (const contract of expiredContracts) {
    await supabase
      .from('billboards')
      .update({
        Status: 'متاح',
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null
      })
      .eq('Contract_Number', contract.Contract_Number);
  }
}

// حذف عقد
export async function deleteContract(contractNumber: string) {
  await supabase
    .from('billboards')
    .update({
      Status: 'متاح',
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null
    })
    .eq('Contract_Number', contractNumber);

  // محاولة حذف من جدول Contract
  let result = await supabase
    .from('Contract')
    .delete()
    .eq('Contract_Number', contractNumber);

  if (result.error) throw result.error;
}

// إضافة/إزالة لوحات من عقد مع تحديث بيانات اللوحات المحفوظة
export async function addBillboardsToContract(
  contractNumber: string,
  billboardIds: (string | number)[],
  meta: { start_date: string; end_date: string; customer_name: string }
) {
  for (const id of billboardIds) {
    const { error } = await supabase
      .from('billboards')
      .update({
        Status: 'محجوز',
        Contract_Number: contractNumber,
        Customer_Name: meta.customer_name,
        Rent_Start_Date: meta.start_date,
        Rent_End_Date: meta.end_date,
      })
      .eq('ID', Number(id));
    if (error) throw error;
  }

  // تحديث بيانات اللوحات المحفوظة في العقد
  await updateContractBillboardsData(contractNumber);
}

export async function removeBillboardFromContract(
  contractNumber: string,
  billboardId: string | number
) {
  const { error } = await supabase
    .from('billboards')
    .update({
      Status: 'متاح',
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
    })
    .eq('ID', Number(billboardId))
    .eq('Contract_Number', contractNumber);
  if (error) throw error;

  // تحديث بيانات اللوحات المحفوظة في العقد
  await updateContractBillboardsData(contractNumber);
}

// دالة مساعدة لتحديث بيانات اللوحات المحفوظة في العقد
async function updateContractBillboardsData(contractNumber: string) {
  try {
    // جلب اللوحات الحالية المرتبطة بالعقد
    const { data: billboards, error: billboardsError } = await supabase
      .from('billboards')
      .select('*')
      .eq('Contract_Number', contractNumber);

    if (billboardsError) {
      console.error('Failed to fetch billboards for contract:', billboardsError);
      return;
    }

    // إعداد بيانات اللوحات للحفظ
    const billboardsData = (billboards || []).map((b: any) => ({
      id: String(b.ID),
      name: b.name || b.Billboard_Name || '',
      location: b.location || b.Nearest_Landmark || '',
      city: b.city || b.City || '',
      size: b.size || b.Size || '',
      level: b.level || b.Level || '',
      price: Number(b.price) || 0,
      image: b.image || ''
    }));

    // حساب تكلفة التركيب الجديدة
    const billboardIds = billboardsData.map(b => b.id);
    const installationResult = await calculateInstallationCostFromIds(billboardIds);
    const installationCost = installationResult.totalInstallationCost;

    // تحديث العقد بالبيانات الجديدة
    await updateContract(contractNumber, {
      billboards_data: JSON.stringify(billboardsData),
      billboards_count: billboardsData.length,
      billboard_ids: billboardIds.join(','), // ✅ حفظ معرفات اللوحات
      installation_cost: installationCost // ✅ بأحرف صغيرة
    });

    console.log(`Updated billboard and installation data for contract ${contractNumber}`);
  } catch (error) {
    console.error('Failed to update contract billboard data:', error);
  }
}

// إنشاء نسخة جديدة من عقد موجود (تجديد) بنفس اللوحات ورقم عقد جديد
export async function renewContract(originalContractId: string, options?: { start_date?: string; end_date?: string; keep_cost?: boolean }) {
  if (!originalContractId) throw new Error('originalContractId مطلوب');

  // احضر العقد مع اللوحات
  const original = await getContractWithBillboards(String(originalContractId));

  // احسب التواريخ الجديدة
  const origStart = original.start_date || original['Contract Date'] || '';
  const origEnd = original.end_date || original['End Date'] || '';

  let newStart = options?.start_date;
  let newEnd = options?.end_date;

  if (!newStart || !newEnd) {
    const today = new Date();
    // المدة بالأشهر من العقد الأصلي
    let months = 1;
    try {
      if (origStart && origEnd) {
        const sd = new Date(origStart);
        const ed = new Date(origEnd);
        const diffDays = Math.max(1, Math.ceil(Math.abs(ed.getTime() - sd.getTime()) / 86400000));
        months = Math.max(1, Math.round(diffDays / 30));
      }
    } catch {}
    const s = today;
    const e = new Date(s);
    e.setMonth(e.getMonth() + months);
    newStart = newStart || s.toISOString().slice(0,10);
    newEnd = newEnd || e.toISOString().slice(0,10);
  }

  // جمع معرفات اللوحات المرتبطة حالياً
  const billboardIds: string[] = Array.isArray(original.billboards)
    ? original.billboards.map((b: any) => String(b.ID ?? b.id)).filter(Boolean)
    : [];

  // جهز بيانات العقد الجديد
  const payload: ContractCreate = {
    customer_name: original.customer_name || original['Customer Name'] || '',
    ad_type: original.ad_type || original['Ad Type'] || '',
    start_date: String(newStart),
    end_date: String(newEnd),
    rent_cost: options?.keep_cost === false ? 0 : (Number(original.total_cost ?? original['Total'] ?? 0) || 0), // ✅ استخدام الإجمالي النهائي
    billboard_ids: billboardIds,
    // ✅ NEW: Copy print cost settings from original contract
    print_cost_enabled: original.print_cost_enabled || false,
    print_price_per_meter: original.print_price_per_meter || 0,
    // ✅ NEW: Copy operating fee rate from original contract
    operating_fee_rate: original.operating_fee_rate || 3,
  };

  // حافظ على فئة التسعير إن وجدت
  if ((original as any).customer_category) (payload as any).customer_category = (original as any).customer_category;
  if ((original as any).customer_id) (payload as any).customer_id = (original as any).customer_id;

  // أنشئ العقد الجديد وسيتم تحديث اللوحات تلقائياً داخل createContract
  const created = await createContract(payload);
  return created;
}

// Export types
export type { ContractData, ContractCreate };
export type { Contract } from '@/types';