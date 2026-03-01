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
            // ✅ Also check size_id dimensions from the billboard data
            let width = 0, height = 0;
            if (b.actual_width && b.actual_height) {
              width = Number(b.actual_width);
              height = Number(b.actual_height);
            } else {
              const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
              if (!sizeMatch) return sum;
              width = parseFloat(sizeMatch[1].replace(',', '.'));
              height = parseFloat(sizeMatch[2].replace(',', '.'));
            }
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
  
  // ✅ حساب رسوم التشغيل مع نسب مستقلة للتركيب والطباعة
  const operatingFeeRate = operating_fee_rate || 3;
  const includeOpInInstall = (contractData as any).include_operating_in_installation === true;
  const includeOpInPrint = (contractData as any).include_operating_in_print === true;
  const opRateInstall = Number((contractData as any).operating_fee_rate_installation || operatingFeeRate);
  const opRatePrint = Number((contractData as any).operating_fee_rate_print || operatingFeeRate);
  operatingFee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
  if (includeOpInInstall) operatingFee += Math.round(installationCost * (opRateInstall / 100) * 100) / 100;
  if (includeOpInPrint) operatingFee += Math.round(printCost * (opRatePrint / 100) * 100) / 100;
  
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
    // ✅ FIX: fee is TEXT column
    fee: String(operatingFeeRate), // ✅ حفظ نسبة التشغيل في عمود fee
    Total: finalTotal, // ✅ CORRECTED: الإجمالي النهائي الكامل
    'Print Status': null,
    'Renewal Status': null,
    // ✅ FIX: Total Paid and Remaining are TEXT columns
    'Total Paid': String((contractData as any)['Total Paid'] || 0),
    'Payment 1': (contractData as any)['Payment 1'] || null,
    // ✅ FIX: Payment 2 and 3 are TEXT columns
    'Payment 2': (contractData as any)['Payment 2'] ? String((contractData as any)['Payment 2']) : null,
    'Payment 3': (contractData as any)['Payment 3'] ? String((contractData as any)['Payment 3']) : null,
    // ✅ FIX: Remaining is TEXT column
    Remaining: String((contractData as any)['Remaining'] || finalTotal),
    payment_status: 'unpaid', // ✅ FIX: إضافة حالة الدفع الافتراضية
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
    // ✅ FIX: print_cost_enabled and print_price_per_meter are TEXT columns
    print_cost_enabled: String(print_cost_enabled || false),
    print_price_per_meter: String(print_price_per_meter || 0)
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

// جلب جميع العقود مع معالجة محسنة - يستخدم contract_summary view للأداء
export async function getContracts() {
  let data: any[] = [];
  
  // استخدام الـ view الذي يجمع بيانات العملاء والمدفوعات والمصاريف
  try {
    const { data: contractData, error: contractError } = await supabase
      .from('contract_summary' as any)
      .select('*')
      .order('Contract_Number', { ascending: false });

    if (!contractError && Array.isArray(contractData)) {
      data = contractData;
    } else {
      console.warn('contract_summary view query failed, falling back to Contract table:', contractError);
      // Fallback to Contract table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });
      if (!fallbackError && Array.isArray(fallbackData)) {
        data = fallbackData;
      }
    }
  } catch (e) {
    console.warn('Contract access failed:', e);
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
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? '',
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      status: c.status ?? c['Print Status'] ?? '',
      billboards_data: c.billboards_data || c['billboards_data'],
      billboards_count: c.billboards_count ?? 0,
      billboard_ids: c.billboard_ids || '',
      billboard_prices: c.billboard_prices || null,
      fee: typeof c.fee === 'number' ? c.fee : Number(c.fee ?? 0),
      operating_fee_rate: typeof c.operating_fee_rate === 'number' ? c.operating_fee_rate : Number(c.operating_fee_rate ?? 3),
      installments_data: c.installments_data || null,
      print_cost_enabled: c.print_cost_enabled || false,
      print_price_per_meter: c.print_price_per_meter || 0,
      // بيانات من الـ view المجمّع
      customer_phone: c.customer_phone || null,
      customer_company: c.customer_company || null,
      actual_paid: c.actual_paid != null ? Number(c.actual_paid) : null,
      total_expenses_amount: c.total_expenses != null ? Number(c.total_expenses) : 0,
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

    // ✅ جلب مهام التركيب للعقد
    const { data: contractTasks } = await supabase
      .from('installation_tasks')
      .select('id')
      .eq('contract_id', contractId);
    
    // ✅ جلب عناصر مهام التركيب (صور التركيب والتصاميم)
    let installationItemsMap = new Map<number, any>();
    if (contractTasks && contractTasks.length > 0) {
      const taskIds = contractTasks.map(t => t.id);
      const { data: installationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_url, installed_image_face_a_url, installed_image_face_b_url, installation_date')
        .in('task_id', taskIds);
      
      if (installationItems) {
        installationItems.forEach((item: any) => {
          if (item.billboard_id) {
            // نحتفظ بآخر صور تركيب لكل لوحة
            installationItemsMap.set(item.billboard_id, item);
          }
        });
      }
    }

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

    // ✅ دمج صور التركيب من installation_task_items وضمان وجود Image_URL
    mergedBillboards = mergedBillboards.map((b: any) => {
      const billboardId = b.ID ?? b.id;
      const installationItem = installationItemsMap.get(billboardId);
      
      // ✅ ضمان وجود Image_URL (الصورة الافتراضية للوحة)
      const defaultImageUrl = b.Image_URL || b.image_url || b.image || b.billboard_image || '';
      
      if (installationItem) {
        return {
          ...b,
          // ✅ ضمان وجود الصورة الافتراضية
          Image_URL: defaultImageUrl,
          // صور التركيب
          installed_image_url: installationItem.installed_image_url || b.installed_image_url,
          installed_image_face_a_url: installationItem.installed_image_face_a_url || b.installed_image_face_a_url,
          installed_image_face_b_url: installationItem.installed_image_face_b_url || b.installed_image_face_b_url,
          // تصاميم من مهمة التركيب (لها أولوية إذا لم تكن موجودة من design_data)
          design_face_a: b.design_face_a || installationItem.design_face_a,
          design_face_b: b.design_face_b || installationItem.design_face_b,
          installation_date: installationItem.installation_date,
        };
      }
      return {
        ...b,
        // ✅ ضمان وجود الصورة الافتراضية
        Image_URL: defaultImageUrl,
      };
    });

    const normalized = {
      ...c,
      id: c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID,
      Contract_Number: c.Contract_Number ?? c['Contract Number'],
      'Contract Number': c['Contract Number'] ?? c.Contract_Number,
      customer_id: c.customer_id ?? null,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? '', // ✅ FIXED: استخدام العمود الموجود فقط
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      // ✅ NEW: Add print_cost to getContractWithBillboards
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      customer_category: c.customer_category ?? 'عادي',
      // إضافة بيانات اللوحات المحفوظة
      saved_billboards_data: c.billboards_data || c['billboards_data'],
      saved_billboards_count: c.billboards_count ?? 0,
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
  // ✅ FIX: fee column is TEXT type, convert to string
  if (payload.fee !== undefined) {
    payload['fee'] = String(Number(payload.fee) || 0);
  }
  if (payload.operating_fee_rate !== undefined) {
    payload['operating_fee_rate'] = Number(payload.operating_fee_rate) || 3;
  }

  // ✅ NEW: Save print cost settings from updates
  // ✅ FIX: print_cost_enabled and print_price_per_meter are TEXT columns
  if (payload.print_cost_enabled !== undefined) {
    payload['print_cost_enabled'] = String(payload.print_cost_enabled);
  }
  if (payload.print_price_per_meter !== undefined) {
    payload['print_price_per_meter'] = String(Number(payload.print_price_per_meter) || 0);
  }
  if (payload.print_cost !== undefined) {
    payload['print_cost'] = Number(payload.print_cost) || 0;
  }

  // ✅ FIX: exchange_rate is TEXT column
  if (payload.exchange_rate !== undefined) {
    payload['exchange_rate'] = String(payload.exchange_rate);
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
      // ✅ FIX: Convert print_price_per_meter to number since it might be a string
      const printPricePerMeter = Number(payload.print_price_per_meter) || 0;
      const printEnabled = payload.print_cost_enabled === true || payload.print_cost_enabled === 'true';
      let printCost = 0;
      if (printEnabled && printPricePerMeter > 0) {
        const { data: billboardsInfo } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', payload.billboard_ids.map((id: string) => Number(id)));
        
        if (billboardsInfo) {
          printCost = billboardsInfo.reduce((sum: number, b: any) => {
            const size = b.size || b.Size || '';
            const faces = Number(b.faces || b.Faces || b.faces_count || b.Faces_Count || 1);
            
            let width = 0, height = 0;
            if (b.actual_width && b.actual_height) {
              width = Number(b.actual_width);
              height = Number(b.actual_height);
            } else {
              const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
              if (!sizeMatch) return sum;
              width = parseFloat(sizeMatch[1].replace(',', '.'));
              height = parseFloat(sizeMatch[2].replace(',', '.'));
            }
            const area = width * height;
            
            return sum + (area * faces * printPricePerMeter);
          }, 0);
        }
      }
      
      payload['installation_cost'] = installationCost; // ✅ بأحرف صغيرة
      payload['print_cost'] = printCost; // ✅ NEW: حفظ تكلفة الطباعة
      
      // ✅ CORRECTED: حساب القيم الصحيحة
      const finalTotal = payload['Total'] || payload.rent_cost || 0; // هذا هو الإجمالي النهائي
      const rentalCostOnly = Math.max(0, finalTotal - installationCost - printCost); // سعر الإيجار = الإجمالي النهائي - التركيب - الطباعة
      
      // ✅ حساب رسوم التشغيل مع مراعاة إعدادات شمول التركيب والطباعة
      const operatingFeeRate = payload.operating_fee_rate || 3;
      const includeOpInInstall = payload.include_operating_in_installation === true;
      const includeOpInPrint = payload.include_operating_in_print === true;
      const opRateInstall = Number(payload.operating_fee_rate_installation || operatingFeeRate);
      const opRatePrint = Number(payload.operating_fee_rate_print || operatingFeeRate);
      let operatingFee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
      if (includeOpInInstall) operatingFee += Math.round(installationCost * (opRateInstall / 100) * 100) / 100;
      if (includeOpInPrint) operatingFee += Math.round(printCost * (opRatePrint / 100) * 100) / 100;
      // ✅ FIX: fee is TEXT column
      payload['fee'] = String(operatingFee);
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

  // ✅ IMPORTANT: Sync billboard Days_Count with contract duration after successful update
  // Contract duration is the SOURCE OF TRUTH for billboard days
  const startDate = payload['Contract Date'] || payload.start_date;
  const endDate = payload['End Date'] || payload.end_date;
  if (startDate && endDate) {
    try {
      await syncBillboardDaysWithContract(contractId, startDate, endDate);
    } catch (syncError) {
      console.warn('Failed to sync billboard Days_Count:', syncError);
      // Don't throw - contract update succeeded
    }
  }

  return Array.isArray(data) ? data[0] : data;
}

/**
 * Sync billboard Days_Count with contract duration.
 * CRITICAL: Contract duration is the SOURCE OF TRUTH for billboard days.
 * This function MUST be called whenever contract dates change.
 * 
 * billboard.Days_Count = contract.end_date - contract.start_date
 */
async function syncBillboardDaysWithContract(
  contractNumber: string,
  startDate: string,
  endDate: string
): Promise<void> {
  // Calculate days count from contract dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    console.warn('Invalid contract dates for Days_Count calculation');
    return;
  }
  
  const daysCountStr = String(diffDays);
  
  // Update all billboards linked to this contract
  const { error } = await supabase
    .from('billboards')
    .update({
      Days_Count: daysCountStr,
      Rent_Start_Date: startDate,
      Rent_End_Date: endDate
    })
    .eq('Contract_Number', Number(contractNumber));
  
  if (error) {
    console.error('Failed to sync billboard Days_Count:', error);
    throw error;
  }
  
  console.log(`✅ Synced Days_Count=${daysCountStr} for billboards of contract #${contractNumber}`);
}

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
  // تحويل رقم العقد إلى رقم للتوافق مع عمود bigint
  const numericContractNumber = Number(contractNumber);
  
  if (isNaN(numericContractNumber)) {
    throw new Error('رقم العقد غير صالح');
  }

  try {
    // 1. حذف المدفوعات المرتبطة بالعقد
    await supabase
      .from('customer_payments')
      .delete()
      .eq('contract_number', numericContractNumber);

    // 2. حذف إيجارات الشركات الصديقة المرتبطة بالعقد
    await supabase
      .from('friend_billboard_rentals')
      .delete()
      .eq('contract_number', numericContractNumber);

    // 3. حذف سجلات تاريخ اللوحات المرتبطة بالعقد
    await supabase
      .from('billboard_history')
      .delete()
      .eq('contract_number', numericContractNumber);

    // 4. حذف المهام المركبة المرتبطة بالعقد
    await supabase
      .from('composite_tasks')
      .delete()
      .eq('contract_id', numericContractNumber);

    // 5. تحرير اللوحات
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
      .eq('Contract_Number', numericContractNumber);

    // 6. حذف العقد
    const { error } = await supabase
      .from('Contract')
      .delete()
      .eq('Contract_Number', numericContractNumber);

    if (error) {
      console.error('خطأ في حذف العقد:', error);
      throw error;
    }
  } catch (error) {
    console.error('خطأ أثناء حذف العقد والبيانات المرتبطة:', error);
    throw error;
  }
}

/**
 * Add billboards to a contract and update their data.
 * IMPORTANT: Days_Count is calculated as the difference between end_date and start_date.
 * This ensures billboard days are always in sync with contract duration.
 */
export async function addBillboardsToContract(
  contractNumber: string,
  billboardIds: (string | number)[],
  meta: { start_date: string; end_date: string; customer_name: string }
) {
  // Calculate days count from contract dates (source of truth)
  let daysCount: string | null = null;
  if (meta.start_date && meta.end_date) {
    const start = new Date(meta.start_date);
    const end = new Date(meta.end_date);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      daysCount = String(diffDays);
    }
  }

  for (const id of billboardIds) {
    const updateData: Record<string, any> = {
      Status: 'محجوز',
      Contract_Number: contractNumber,
      Customer_Name: meta.customer_name,
      Rent_Start_Date: meta.start_date,
      Rent_End_Date: meta.end_date,
    };
    
    // Update Days_Count based on contract duration
    if (daysCount !== null) {
      updateData.Days_Count = daysCount;
    }

    const { error } = await supabase
      .from('billboards')
      .update(updateData)
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
  const numericBillboardId = Number(billboardId);
  const numericContractNumber = Number(contractNumber);

  // 1. حذف معاملات اللوحات المشتركة
  await supabase
    .from('shared_transactions')
    .delete()
    .eq('billboard_id', numericBillboardId);

  // 2. حذف بيانات الشراكة للوحة
  await supabase
    .from('shared_billboards')
    .delete()
    .eq('billboard_id', numericBillboardId);

  // 3. حذف إيجارات الشركات الصديقة
  await supabase
    .from('friend_billboard_rentals')
    .delete()
    .eq('contract_number', numericContractNumber)
    .eq('billboard_id', numericBillboardId);

  // 4. تحرير اللوحة
  const { error } = await supabase
    .from('billboards')
    .update({
      Status: 'متاح',
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
      is_partnership: false,
      partner_companies: null,
    })
    .eq('ID', numericBillboardId)
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