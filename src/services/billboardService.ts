// @ts-nocheck
import * as XLSX from 'xlsx';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// Placeholder images for billboards when no image URL is provided
const PLACEHOLDER_IMAGES = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%236366f1" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard Highway</text></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%2308b981" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard City</text></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%230ea5e9" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard Coastal</text></svg>'
];

// تطبيع أحجام اللوحات لتكون متوافقة مع مفاتيح التسعير
const normalizeBillboardSize = (size: string): string => {
  if (!size) return '4x12';

  // تحويل النص إلى صغير وإ  الة المسافات
  let normalized = size.toString().trim().toLowerCase();

  // استبدال X بـ x
  normalized = normalized.replace(/[×xX]/g, 'x');

  // إز��لة أي مسافات أو رموز إضافية
  normalized = normalized.replace(/[^\dx]/g, '');

  // معالجة الأحجام الشائعة
  const sizeMap: Record<string, string> = {
    '12x4': '4x12',
    '13x5': '5x13',
    '10x4': '4x10',
    '8x3': '3x8',
    '6x3': '3x6',
    '4x3': '3x4',
    '18x6': '6x18',
    '15x5': '5x15'
  };

  // تطبيق الخريطة إذا وجدت
  if (sizeMap[normalized]) {
    return sizeMap[normalized];
  }

  // إذا لم توجد في الخر  طة، التأكد من التنسيق الصحيح
  const parts = normalized.split('x');
  if (parts.length === 2) {
    const [width, height] = parts.map(p => parseInt(p)).filter(n => !isNaN(n));
    if (width && height) {
      // ترتيب الأبعاد: العرض × الارتفاع (الأصغر أولاً عادة)
      if (width <= height) {
        return `${width}x${height}`;
      } else {
        return `${height}x${width}`;
      }
    }
  }

  // افتراضي
  return '4x12';
};

// الحصول على رابط Google Sheets من قاعدة البيانات
async function getGoogleSheetsUrl(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'google_sheets_url')
      .single();
    
    if (error || !data?.setting_value) {
      console.warn('[Service] لم يتم العثور على رابط Google Sheets في الإعدادات، استخدام الرابط الافتراضي');
      return "https://docs.google.com/spreadsheets/d/1fF9BUgBcW9OW3nWT97Uke_z2Pq3y_LC0/edit?gid=1118301152#gid=1118301152";
    }
    
    // تحويل رابط التحرير إلى رابط CSV
    let url = data.setting_value;
    // استخراج معرف الملف من الرابط
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      // استخراج gid إذا كان موجوداً
      const gidMatch = url.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&gid=${gid}&usp=sharing`;
    }
    
    return url;
  } catch (error) {
    console.error('[Service] خطأ في الحصول على رابط Google Sheets:', error);
    return "https://docs.google.com/spreadsheets/d/1fF9BUgBcW9OW3nWT97Uke_z2Pq3y_LC0/gviz/tq?tqx=out:csv&gid=0&usp=sharing";
  }
}

async function testUrlAccess(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    console.log(`[Service] اختبار الوصول للرابط: ${response.status} ${response.statusText}`);
    return response.ok;
  } catch (error: any) {
    console.log(`[Service] فشل اختبار الوصول للرابط: ${error.message}`);
    return false;
  }
}

function parseDateFlexible(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  // ISO like 2025-01-31
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    if (!Number.isNaN(d) && !Number.isNaN(mo) && !Number.isNaN(y)) {
      return new Date(y, mo, d);
    }
  }
  return null;
}

async function readCsvFromUrl(url: string, timeoutMs = 10000) {
  try {
    console.log(`[Service] محاولة تحميل ملف CSV من الرابط: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const cacheBuster = Date.now();
    const urlWithCacheBuster = `${url}&cachebuster=${cacheBuster}`;

    const response = await fetch(urlWithCacheBuster, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/csv,application/csv,text/plain',
        'Cache-Control': 'no-cache'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log(`[Service] تم تحميل ${csvText.length} حرف من البيانات`);

    // تحويل CSV إلى JSON باستخدام منطق أفضل
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('ملف CSV فارغ');
    }

    // تحليل العناوين
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    // تحليل البيانات مع مراعاة الفواصل داخل النصوص
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // تحليل أفضل للـ CSV مع مراعاة النصوص المقتب  ة
      const values = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // آخر قيمة
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  } catch (error: any) {
    console.error(`[Service] خطأ في تحميل CSV: ${error.message}`);
    throw error;
  }
}

function normalizeStatus(input: string | null | undefined): Billboard['status'] {
  if (!input) return 'available';
  const s = String(input).trim().toLowerCase();
  if (['available', 'متاح'].includes(s)) return 'available';
  if (['rented', 'مؤجر', 'مؤجرة'].includes(s)) return 'rented';
  if (['maintenance', 'صيانة'].includes(s)) return 'maintenance';
  return 'available';
}

// معالجة بيانات اللوحة من Supabase
function processBillboardFromSupabase(row: any, index: number): Billboard {
  const id = row['ID'] ?? row['id'] ?? row['Id'] ?? `billboard-${index + 1}`;
  const name = row['Billboard_Name'] ?? row['name'] ?? row['لوحة'] ?? `لوحة ${index + 1}`;
  const location = row['Nearest_Landmark'] ?? row['District'] ?? row['Municipality'] ?? row['City'] ?? '';
  const municipality = row['Municipality'] ?? row['municipality'] ?? '';
  const district = row['District'] ?? row['district'] ?? '';
  const city = row['City'] ?? row['city'] ?? 'طرابلس';
  const rawSize = row['Size'] ?? row['المقاس مع الدغاية'] ?? row['Order_Size'] ?? '12X4';
  const size = normalizeBillboardSize(rawSize);
  const sizeId = row['size_id'] ?? row['Size_ID'] ?? null;
  const coordinates = row['GPS_Coordinates'] ?? row['GPS'] ?? '';
  const level = row['Level'] ?? row['Category_Level'] ?? 'A';
  const status = normalizeStatus(row['Status']);
  const contractNumber = row['Contract_Number'] ?? '';
  const clientName = row['Customer_Name'] ?? '';
  const expiryDate = row['Rent_End_Date'] ?? '';
  const adType = row['Ad_Type'] ?? '';
  const daysCount = row['Days_Count'];
  const friendCompanyId = row['friend_company_id'] ?? row['friend_company'] ?? null;
  const friendCompanies = row['friend_companies'] ?? null;
  
  // Partnership data
  const isPartnership = row['is_partnership'] === true;
  const partnerCompanies = row['partner_companies'] ?? [];
  const capital = Number(row['capital']) || 0;
  const capitalRemaining = Number(row['capital_remaining'] ?? row['capital']) || 0;

  let nearExpiry = false;
  let remainingDays: number | undefined = undefined;

  if (expiryDate) {
    const today = new Date();
    const expiry = parseDateFlexible(expiryDate) || new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    remainingDays = Number.isFinite(diffDays) ? diffDays : undefined;
    if (typeof remainingDays === 'number' && remainingDays <= 20 && remainingDays > 0) {
      nearExpiry = true;
    } else if (typeof remainingDays === 'number' && remainingDays <= 0) {
      // انته�� العقد
      if (status === 'rented') {
        // إذا كانت الحالة مؤجر لكن انتهى العقد، اعتب  ها متاحة الآن
        (row as any).Status = 'available';
      }
      remainingDays = 0;
    }
  } else if (typeof daysCount === 'number') {
    remainingDays = daysCount;
    if (remainingDays <= 20 && remainingDays > 0) nearExpiry = true;
  }

  let imageUrl = row['Image_URL'] ?? row['@IMAGE'] ?? '';
  if (!imageUrl) {
    imageUrl = PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
  }

  const gpsLink = row['GPS_Link'] ?? row['GPS_Link_Click'] ?? (coordinates ? `https://www.google.com/maps?q=${coordinates}` : undefined);

  const priceRaw = row['Price'] ?? row['price'];
  const price = typeof priceRaw === 'number' ? priceRaw : parseInt(String(priceRaw || '').replace(/[^\d]/g, ''), 10) || 3000;
  const installationPrice = Math.round(price * 0.2);

  return {
    // Legacy fields required by Billboard interface
    ID: Number(id),
    Billboard_Name: String(name),
    City: String(city),
    District: String(district || ''),
    Size: size,
    size_id: sizeId,
    Size_ID: sizeId,
    Status: normalizeStatus(row['Status']) || 'available',
    Price: String(price),
    Level: String(row['Level'] || 'standard'),
    Image_URL: String(row['Image_URL'] || row['@IMAGE'] || ''),
    GPS_Coordinates: String(coordinates || ''),
    GPS_Link: gpsLink || '',
    Nearest_Landmark: String(location),
    Faces_Count: String(row['Faces_Count'] || '1'),
    Municipality: String(municipality || ''),
    Contract_Number: contractNumber || null,
    Rent_Start_Date: row['Rent_Start_Date'] || null,
    Rent_End_Date: expiryDate || null,
    rent_end_date: expiryDate || null,
    Customer_Name: clientName || null,
    Ad_Type: adType || null,
    friend_company_id: friendCompanyId,
    friend_companies: friendCompanies,
    
    // App-level normalized fields
    id: String(id),
    name: String(name),
    location: String(location),
    size,
    price,
    installationPrice,
    status: normalizeStatus(row['Status']),
    city: String(city),
    district: String(district || ''),
    municipality: String(municipality || ''),
    coordinates: String(coordinates || ''),
    description: `لوحة إعلانية ${size} في ${municipality || location}`,
    image: imageUrl,
    contractNumber: contractNumber || undefined,
    clientName: clientName || undefined,
    expiryDate: expiryDate || undefined,
    rentEndDate: expiryDate || undefined,
    nearExpiry,
    remainingDays,
    adType: adType || undefined,
    level: String(level),
    friend_company_id: friendCompanyId,
    friend_companies: friendCompanies,
    // Partnership data
    is_partnership: isPartnership,
    partner_companies: partnerCompanies,
    capital: capital,
    capital_remaining: capitalRemaining,
  };
}

// معالجة بيانات اللوحة من CSV
function processBillboardFromCSV(row: any, index: number): Billboard {
  const id = row['ر.م'] || `billboard-${index + 1}`;
  const name = row['اسم لوحة'] || `لوحة ${index + 1}`;
  const location = row['اقرب نقطة دالة'] || '';
  const municipality = row['ال��لدية'] || '';
  const city = row['مدينة'] || 'طرابلس';
  const area = row['منطقة'] || row['الحي'] || row['District'] || municipality;
  const rawSize = row['حجم'] || '12X4';
  const size = normalizeBillboardSize(rawSize);
  const coordinates = row['احداثي - GPS'] || '32.8872,13.1913';
  const level = row['المستوى'] || row['تصنيف'] || row['level'] || 'A';
  
  // حالة اللوحة
  let status: Billboard['status'] = 'available';
  const contractNumber = row['رقم العقد'] || '';
  const clientName = row['اسم الزبون'] || '';
  const expiryDate = row['تاريخ انتهاء الايجار'] || '';
  const adType = row['نوع الاعلان'] || row['نوع الإعلان'] || row['ad_type'] || '';
  let nearExpiry = false;
  let remainingDays: number | undefined = undefined;

  // تحديد ا  حالة والمنتهية والقريبة من الانتهاء
  if (contractNumber && contractNumber.trim() !== '') {
    status = 'rented';
    if (expiryDate) {
      const today = new Date();
      const expiry = parseDateFlexible(expiryDate) || new Date(expiryDate);
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      remainingDays = Number.isFinite(diffDays) ? diffDays : undefined;
      if (typeof remainingDays === 'number' && remainingDays <= 20 && remainingDays > 0) {
        nearExpiry = true;
      } else if (typeof remainingDays === 'number' && remainingDays <= 0) {
        status = 'available';
        remainingDays = 0;
      }
    }
  }
  
  // معالجة الصورة
  let imageUrl = row['image_url'] || row['@IMAGE'] || '';
  if (imageUrl && imageUrl.includes('googleusercontent.com')) {
    // الصورة جاهزة من Google Drive
  } else {
    // استخدام صور افتراضية
    imageUrl = PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
  }
  
  // إحداثيات GPS
  const coords = coordinates.split(',').map(c => c.trim());
  const gpsLink = coords.length >= 2 
    ? `https://www.google.com/maps?q=${coords[0]},${coords[1]}`
    : 'https://www.google.com/maps?q=32.8872,13.1913';
    
  // تحديد السعر بناءً على الحجم والموقع
  const priceMap: Record<string, number> = {
    '3x4': 1500,
    '3x6': 2000,
    '3x8': 2500,
    '4x10': 3200,
    '4x12': 3500,
    '5x13': 4200,
    '5x15': 5000,
    '6x18': 6500
  };
  
  const price = priceMap[size] || 3000;
  const installationPrice = Math.round(price * 0.2); // 20% من سعر الإيجار

  return {
    // Legacy fields required by Billboard interface
    ID: Number(id),
    Billboard_Name: name.toString(),
    City: city.toString(),
    District: location.toString(), // Use location as district fallback
    Size: size,
    Status: status,
    Price: String(price),
    Level: (level || 'standard').toString(),
    Image_URL: '', // No image available for sample data
    GPS_Coordinates: (coordinates || '').toString(),
    GPS_Link: coordinates ? `https://www.google.com/maps?q=${coordinates}` : '',
    Nearest_Landmark: location.toString(),
    Faces_Count: '1',
    Municipality: (municipality || '').toString(),
    
    // App-level normalized fields
    id: id.toString(),
    name: name.toString(),
    location: location.toString(),
    size: size,
    price,
    installationPrice,
    status,
    city,
    district: area,
    municipality,
    coordinates,
    description: `لوحة إعلانية ${size} في ${location}`,
    image: imageUrl,
    contractNumber: contractNumber || undefined,
    clientName: clientName || undefined,
    expiryDate: expiryDate || undefined,
    nearExpiry,
    remainingDays,
    adType: adType || undefined,
    level,
  };
}

export async function loadBillboards(): Promise<Billboard[]> {
  try {
    // أولاً: جلب من Supabase إذا توفر جدول billboards
    console.log('[Service] محاولة تحميل اللوحات من Supabase...');
    const { data: rows, error: dbError } = await supabase
      .from('billboards')
      .select('*, friend_companies(*)');

    if (!dbError && Array.isArray(rows) && rows.length > 0) {
      console.log(`[Service] تم استلام ${rows.length} صف من Supabase`);
      const billboards = rows.map((row: any, index: number) => processBillboardFromSupabase(row, index));
      console.log(`[Service] إرجاع ${billboards.length} لوحة من Supabase`);
      return billboards;
    }

    if (dbError) {
      console.warn('[Service] تعذر جلب Supabase، سيتم استخدام Google Sheets. الخطأ:', dbError.message);
    } else {
      console.log('[Service] جدول billboards فارغ أو غير متاح، سيتم استخدام Google Sheets');
    }

    // ثانياً: محاولة تحميل البيانات من Google Sheets كاحتياطي
    console.log('[Service] بدء تحميل البيانات من Google Sheets...');
    const csvUrl = await getGoogleSheetsUrl();
    console.log('[Service] استخدام رابط CSV:', csvUrl);
    const data = await readCsvFromUrl(csvUrl);

    console.log(`[Service] تم استلام ${data.length} صف من البيانات`);
    if (data.length > 0) {
      console.log('[Service] أعمدة الملف:', Object.keys(data[0]));
    }

    const billboards: Billboard[] = data.map((row: any, index: number) =>
      processBillboardFromCSV(row, index)
    );

    console.log(`[Service] تم معالجة ${billboards.length} لوحة إعلانية`);

    console.log(`[Service] ��رجاع ${billboards.length} لوحة بعد المعالجة (بدون فلترة إضافية)`);
    return billboards;

  } catch (error) {
    console.error('[Service] خطأ في تحميل البيانات من Supabase/Google Sheets:', error);

    // البيانات الافتراضية في حالة فشل التحميل

    return [
      {
        id: '1',
        name: 'لوحة طريق المطار',
        location: 'شار   الزهراء، طرابلس',
        size: '4x10',
        price: 3500,
        installationPrice: 800,
        status: 'available',
        city: 'طرابلس',
        description: 'موقع مميز على طريق المطار الدولي',
        image: PLACEHOLDER_IMAGES[0],
        level: 'A'
      },
      {
        id: '2',
        name: 'لوحة شار   الجمهورية',
        location: 'شارع الجمهورية، طرابلس',
        size: '5x13',
        price: 2500,
        installationPrice: 600,
        status: 'available',
        city: 'طرابلس',
        description: 'في قلب العاصمة ا��تجاري',
        image: PLACEHOLDER_IMAGES[1],
        level: 'A'
      },
      {
        id: '3',
        name: 'لوحة الكورنيش',
        location: 'كورنيش طرابلس',
        size: '3x8',
        price: 4500,
        installationPrice: 700,
        status: 'available',
        city: 'طرابلس',
        description: 'إطلالة رائعة على البحر المتوسط',
        image: PLACEHOLDER_IMAGES[2],
        level: 'B'
      },
      {
        id: '4',
        name: 'لوحة شارع الفتح',
        location: 'شارع الفتح، طرابلس',
        size: '4x12',
        price: 2800,
        installationPrice: 650,
        status: 'available',
        city: 'طرابلس',
        description: 'شارع تجاري حيوي ومزدحم',
        image: PLACEHOLDER_IMAGES[0],
        level: 'A'
      },
      {
        id: '5',
        name: 'لوحة طريق السواني',
        location: 'طريق السواني، طرابلس',
        size: '6x18',
        price: 6000,
        installationPrice: 1200,
        status: 'available',
        city: 'طرابلس',
        description: 'أكبر لوحة متاحة، مرئية من مسافات بعيدة',
        image: PLACEHOLDER_IMAGES[1],
        level: 'A'
      }
  ] as any[];
  }
}

export function getAvailableBillboards(billboards: Billboard[]): Billboard[] {
  return billboards.filter(b => b.status === 'available');
}

export function getBillboardsByCity(billboards: Billboard[], city: string): Billboard[] {
  return billboards.filter(b => b.city === city);
}

import { normalizeArabic, queryTokens } from '@/lib/utils';

export function searchBillboards(billboards: Billboard[], query: string): Billboard[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return billboards;
  return billboards.filter((b) => {
    const parts = [
      (b as any).Billboard_Name,
      b.name,
      (b as any).Nearest_Landmark,
      b.location,
      (b as any).Municipality,
      b.municipality,
      (b as any).District,
      b.district,
      (b as any).City,
      b.city,
      b.size,
      b.level,
      b.id,
      b.contractNumber,
      b.clientName,
      b.adType,
    ].filter(Boolean) as Array<string | number>;
    const haystack = normalizeArabic(parts.join(' '));
    return tokens.every((t) => haystack.includes(t));
  });
}

// Sync available billboards to Google Sheets
export async function syncAvailableBillboardsToGoogleSheets(
  billboards: Billboard[],
  isContractExpired: (endDate: string | null) => boolean
): Promise<void> {
  try {
    // Get the Google Sheets URL from settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'google_sheets_url')
      .single();

    if (settingsError || !settings?.setting_value) {
      throw new Error('لم يتم تكوين رابط Google Sheets. يرجى تحديثه في إعدادات النظام.');
    }

    // Filter available billboards
    const availableBillboards = billboards.filter((billboard: Billboard) => {
      const statusValue = String((billboard as any).Status ?? billboard.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String((billboard as any).maintenance_status ?? '').trim();
      const hasContract = !!((billboard as any).Contract_Number ?? billboard.contractNumber);
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? billboard.rentEndDate ?? null);
      
      // Exclude removed billboards
      if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') {
        return false;
      }
      
      if (maintenanceStatus === 'removed' || 
          maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
          maintenanceStatus === 'تمت الإزالة' ||
          maintenanceStatus === 'لم يتم التركيب') {
        return false;
      }
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    });

    if (availableBillboards.length === 0) {
      throw new Error('لا توجد لوحات متاحة للمزامنة');
    }

    // Prepare data for Google Sheets in CSV format
    const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'عدد الاوجه', '@IMAGE', 'image_url'];
    
    const rows = availableBillboards.map((billboard: Billboard, index: number) => {
      const billboardName = (billboard as any).Billboard_Name || billboard.name || '';
      const imageFileName = billboardName ? `${billboardName}.jpg` : ((billboard as any).image_name || '');
      
      return [
        (billboard as any).ID || billboard.id || '',
        billboardName,
        (billboard as any).City || billboard.city || '',
        (billboard as any).Municipality || billboard.municipality || '',
        (billboard as any).District || billboard.district || '',
        (billboard as any).Nearest_Landmark || billboard.location || '',
        (billboard as any).Size || billboard.size || '',
        (billboard as any).Level || billboard.level || '',
        (billboard as any).GPS_Coordinates || billboard.coordinates || '',
        (billboard as any).Faces_Count || '1',
        imageFileName,
        (billboard as any).Image_URL || billboard.image || ''
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    console.log('CSV data prepared for sync:', csvContent.substring(0, 200) + '...');
    console.log(`Total billboards to sync: ${availableBillboards.length}`);
    
    // Note: Direct writing to Google Sheets requires Google Sheets API setup
    // This would need backend implementation with proper OAuth
    // For now, we just prepare the data and log success
    // In production, you would send this to an edge function that handles the Google Sheets API
    
    throw new Error('وظيفة المزامنة مع Google Sheets تتطلب إعداد Google Sheets API. يرجى استخدام زر "تصدير المتاح Excel" كبديل.');
  } catch (error: any) {
    console.error('Error syncing to Google Sheets:', error);
    throw error;
  }
}
