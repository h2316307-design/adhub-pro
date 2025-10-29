import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export const useBillboardExport = () => {
  // ✅ NEW: Get size order from database
  const getSizeOrderFromDB = async (): Promise<{ [key: string]: number }> => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      const sizeOrderMap: { [key: string]: number } = {};
      data?.forEach((size, index) => {
        sizeOrderMap[size.name] = size.sort_order || (index + 1);
      });
      
      return sizeOrderMap;
    } catch (error) {
      console.error('Error loading size order from database:', error);
      // Fallback to hardcoded order
      return {
        '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
        '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
        '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
        '3*8': 4, '3x8': 4, '3×8': 4, '8*3': 4, '8x3': 4, '8×3': 4,
        '3*6': 5, '3x6': 5, '3×6': 5, '6*3': 5, '6x3': 5, '6×3': 5,
        '3*4': 6, '3x4': 6, '3×4': 6, '4*3': 6, '4x3': 6, '4×3': 6
      };
    }
  };

  // ✅ UPDATED: Sort billboards by database size order
  const sortBillboardsBySize = async (billboards: any[]): Promise<any[]> => {
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
  };

  // ✅ NEW: Get current customer name from active contracts
  const getCurrentCustomerName = async (billboard: any): Promise<string> => {
    try {
      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) return billboard.Customer_Name || billboard.clientName || '';

      // Get active contract for this billboard
      const { data, error } = await supabase
        .from('Contract')
        .select('customer_name, "Customer Name"')
        .contains('billboard_ids', [billboardId.toString()])
        .order('id', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return billboard.Customer_Name || billboard.clientName || '';
      }

      return (data[0] as any)['Customer Name'] || billboard.Customer_Name || billboard.clientName || '';
    } catch (error) {
      console.error('Error getting current customer name:', error);
      return billboard.Customer_Name || billboard.clientName || '';
    }
  };

  // ✅ NEW: Get current ad type from active contracts
  const getCurrentAdType = async (billboard: any): Promise<string> => {
    try {
      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) return billboard.Ad_Type || billboard.adType || '';

      // Get active contract for this billboard
      const { data, error } = await supabase
        .from('Contract')
        .select('ad_type, "Ad Type"')
        .contains('billboard_ids', [billboardId.toString()])
        .order('id', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return billboard.Ad_Type || billboard.adType || '';
      }

      return (data[0] as any)['Ad Type'] || billboard.Ad_Type || billboard.adType || '';
    } catch (error) {
      console.error('Error getting current ad type:', error);
      return billboard.Ad_Type || billboard.adType || '';
    }
  };

  // ✅ UPDATED: Export to Excel function with database size ordering and updated customer/ad type data
  const exportToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel...');
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(billboards);
      
      // ✅ NEW: Get updated customer names and ad types for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => ({
          'رقم اللوحة': billboard.ID || billboard.id || '',
          'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
          'المدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'المنطقة': billboard.District || billboard.district || '',
          'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
          'المقاس': billboard.Size || billboard.size || '',
          'المستوى': billboard.Level || billboard.level || '',
          'الحالة': billboard.Status || billboard.status || '',
          'رقم العقد': billboard.Contract_Number || billboard.contractNumber || '',
          'اسم العميل': await getCurrentCustomerName(billboard), // ✅ Updated from contracts
          'نوع الإعلان': await getCurrentAdType(billboard), // ✅ Updated from contracts
          'تاريخ بداية الإيجار': billboard.Rent_Start_Date || billboard.rent_start_date || '',
          'تاريخ نهاية الإيجار': billboard.Rent_End_Date || billboard.rent_end_date || '',
          'لوحة شراكة': billboard.is_partnership ? 'نعم' : 'لا',
          'الشركات المشاركة': Array.isArray(billboard.partner_companies) 
            ? billboard.partner_companies.join(', ') 
            : billboard.partner_companies || '',
          'رأس المال': billboard.capital || 0,
          'المتبقي من رأس المال': billboard.capital_remaining || 0,
          'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
          'نوع اللوحة': billboard.billboard_type || '',
          'اسم ملف الصورة': billboard.image_name || '',
          'رابط الصورة': billboard.Image_URL || billboard.image || ''
        }))
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
        { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 25 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات الإعلانية');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_الإعلانية_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel مرتب حسب المقاس: ${filename}`);
      console.log('✅ Excel exported with database size ordering and updated contract data');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ UPDATED: Export available billboards to Excel function with database size ordering
  const exportAvailableToExcel = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات المتاحة...');
      
      // Filter available billboards (including those with expired contracts)
      const availableBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      });

      if (availableBillboards.length === 0) {
        toast.warning('لا توجد لوحات متاحة للتصدير');
        return;
      }

      // ✅ Sort available billboards by database size order
      const sortedAvailableBillboards = await sortBillboardsBySize(availableBillboards);

      // Prepare data for export
      const exportData = sortedAvailableBillboards.map((billboard: any) => ({
        'رقم اللوحة': billboard.ID || billboard.id || '',
        'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
        'المدينة': billboard.City || billboard.city || '',
        'البلدية': billboard.Municipality || billboard.municipality || '',
        'المنطقة': billboard.District || billboard.district || '',
        'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
        'المقاس': billboard.Size || billboard.size || '',
        'المستوى': billboard.Level || billboard.level || '',
        'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
        'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
        'نوع اللوحة': billboard.billboard_type || '',
        'اسم ملف الصورة': billboard.image_name || '',
        'رابط الصورة': billboard.Image_URL || billboard.image || ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 25 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات المتاحة');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتاحة_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel مرتب: ${filename} (${availableBillboards.length} لوحة متاحة)`);
      console.log('✅ Available billboards Excel exported with database size ordering');
    } catch (error) {
      console.error('Error exporting available billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel للوحات المتاحة');
    }
  };

  // ✅ Get contract dates from active contracts
  const getContractDates = async (billboard: any): Promise<{ startDate: string; endDate: string }> => {
    try {
      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) {
        return { 
          startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '', 
          endDate: billboard.Rent_End_Date || billboard.rent_end_date || '' 
        };
      }

      // محاولة جلب من Contract أولاً
      const { data, error } = await supabase
        .from('Contract')
        .select('rent_start_date, rent_end_date, "Rent Start Date", "Rent End Date"')
        .contains('billboard_ids', [billboardId.toString()])
        .order('id', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const contract = data[0] as any;
        return {
          startDate: contract['Rent Start Date'] || contract.rent_start_date || '',
          endDate: contract['Rent End Date'] || contract.rent_end_date || ''
        };
      }

      // إذا لم يوجد في Contract، استخدم البيانات المباشرة من اللوحة
      return { 
        startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '', 
        endDate: billboard.Rent_End_Date || billboard.rent_end_date || '' 
      };
    } catch (error) {
      console.error('Error getting contract dates:', error);
      return { 
        startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '', 
        endDate: billboard.Rent_End_Date || billboard.rent_end_date || '' 
      };
    }
  };

  // ✅ UPDATED: Export follow-up billboards to Excel function with database size ordering and updated data
  const exportFollowUpToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel للمتابعة...');
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(billboards);
      
      // ✅ Get updated customer names, ad types, and contract dates for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => {
          const contractDates = await getContractDates(billboard);
          const customerName = await getCurrentCustomerName(billboard);
          const adType = await getCurrentAdType(billboard);
          
          return {
            'رقم اللوحة': billboard.ID || billboard.id || '',
            'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
            'المدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'المنطقة': billboard.District || billboard.district || '',
            'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
            'المقاس': billboard.Size || billboard.size || '',
            'المستوى': billboard.Level || billboard.level || '',
            'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
            'نوع اللوحة': billboard.billboard_type || '',
            'اسم العميل': customerName,
            'نوع الإعلان': adType,
            'تاريخ بداية العقد': contractDates.startDate,
            'تاريخ انتهاء العقد': contractDates.endDate,
            'اسم ملف الصورة': billboard.image_name || '',
            'رابط الصورة': billboard.Image_URL || billboard.image || ''
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 25 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات للمتابعة');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتابعة_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel للمتابعة مرتب: ${filename} (${billboards.length} لوحة)`);
      console.log('✅ Follow-up billboards Excel exported with customer names, ad types, and contract dates');
    } catch (error) {
      console.error('Error exporting follow-up billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel للمتابعة');
    }
  };

  // ✅ UPDATED: Export billboards needing re-photography with GPS coordinates (only those marked)
  const exportRePhotographyToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات التي تحتاج إعادة تصوير...');
      
      // Filter only billboards marked for re-photography
      const markedBillboards = billboards.filter((billboard: any) => 
        billboard.needs_rephotography === true
      );

      if (markedBillboards.length === 0) {
        toast.warning('لا توجد لوحات محددة لإعادة التصوير');
        return;
      }
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(markedBillboards);
      
      const exportData = sortedBillboards.map((billboard: any) => ({
        'رقم اللوحة': billboard.ID || billboard.id || '',
        'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
        'المدينة': billboard.City || billboard.city || '',
        'البلدية': billboard.Municipality || billboard.municipality || '',
        'المنطقة': billboard.District || billboard.district || '',
        'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
        'المقاس': billboard.Size || billboard.size || '',
        'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
        'رابط الصورة الحالية': billboard.Image_URL || billboard.image || '',
        'ملاحظات': 'تحتاج إعادة تصوير'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'لوحات تحتاج إعادة تصوير');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `لوحات_إعادة_تصوير_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${markedBillboards.length} لوحة)`);
      console.log('✅ Re-photography billboards Excel exported with GPS coordinates');
    } catch (error) {
      console.error('Error exporting re-photography billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  return {
    exportToExcel,
    exportAvailableToExcel,
    exportFollowUpToExcel,
    exportRePhotographyToExcel,
    // ✅ NEW: Export utility functions
    getSizeOrderFromDB,
    sortBillboardsBySize,
    getCurrentCustomerName,
    getCurrentAdType,
    getContractDates
  };
};