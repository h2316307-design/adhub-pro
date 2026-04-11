import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';

/**
 * Adds pricing, slides, companies, and cities sheets to an existing XLSX workbook.
 */
export async function addExtraSheets(wb: XLSX.WorkBook): Promise<void> {
  // Order: الأسعار → المدن → الشركات → السلايدات
  await addPricingSheet(wb);
  await addCitiesSheet(wb);
  await addCompaniesSheet(wb);
  await addSlidesSheet(wb);
}

async function addPricingSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_pricing')
      .select('*')
      .order('size', { ascending: true })
      .order('billboard_level', { ascending: true })
      .order('customer_category', { ascending: true });

    if (error || !data || data.length === 0) return;

    const headers = ['المقاس', 'المستوى', 'فئة العميل', 'شهر واحد', 'شهرين', '3 أشهر', '6 أشهر', 'سنة كاملة', 'يوم واحد'];
    const rows = data.map((r: any) => [
      r.size || '', r.billboard_level || '', r.customer_category || '',
      r.one_month ?? 0, r['2_months'] ?? 0, r['3_months'] ?? 0,
      r['6_months'] ?? 0, r.full_year ?? 0, r.one_day ?? 0,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');
  } catch (e) {
    console.error('Error adding pricing sheet:', e);
  }
}

async function addSlidesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_slides').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['الترتيب', 'العنوان', 'رابط الصورة'];
    const rows = data.map((s: any) => [s.sort_order, s.title || '', normalizeGoogleImageUrl(s.image_url) || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'السلايدات');
  } catch (e) {
    console.error('Error adding slides sheet:', e);
  }
}

async function addCompaniesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_company_images').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['الترتيب', 'اسم الشركة', 'رابط الصورة'];
    const rows = data.map((c: any) => [c.sort_order, c.company_name || '', normalizeGoogleImageUrl(c.image_url) || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'الشركات');
  } catch (e) {
    console.error('Error adding companies sheet:', e);
  }
}

async function addCitiesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_city_images').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['الترتيب', 'اسم المدينة', 'رابط الصورة'];
    const rows = data.map((c: any) => [c.sort_order, c.city_name || '', normalizeGoogleImageUrl(c.image_url) || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'المدن');
  } catch (e) {
    console.error('Error adding cities sheet:', e);
  }
}
