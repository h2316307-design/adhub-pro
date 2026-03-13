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
      
      // Filter available billboards (including those with expired contracts) - exclude removed billboards
      const availableBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        const maintenanceType = String(billboard.maintenance_type ?? '').trim();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        // ✅ استبعاد لوحات الشركات الصديقة
        if (billboard.friend_company_id) {
          return false;
        }
        
        // ✅ استبعاد اللوحات المخفية من المتاح (العمود الجديد)
        const isVisibleInAvailable = billboard.is_visible_in_available !== false; // default true
        if (!isVisibleInAvailable) {
          return false;
        }
        
        // ✅ استبعاد اللوحات المُزالة بجميع أشكالها
        if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') {
          return false;
        }
        
        // ✅ استبعاد حالات الصيانة المتعلقة بالإزالة
        if (maintenanceStatus === 'removed' || 
            maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
            maintenanceStatus === 'تمت الإزالة' ||
            maintenanceStatus === 'لم يتم التركيب') {
          return false;
        }
        
        // ✅ استبعاد أنواع الصيانة المتعلقة بالإزالة
        if (maintenanceType === 'تحتاج إزالة' || 
            maintenanceType === 'تمت الإزالة' ||
            maintenanceType === 'لم يتم التركيب' ||
            maintenanceType.includes('إزالة') || 
            maintenanceType.includes('ازالة')) {
          return false;
        }
        
        // ✅ اللوحات المتاحة: متاح صراحة، أو لا يوجد عقد، أو العقد منتهي
        return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      });

      if (availableBillboards.length === 0) {
        toast.warning('لا توجد لوحات متاحة للتصدير');
        return;
      }

      // ✅ Sort available billboards by database size order
      const sortedAvailableBillboards = await sortBillboardsBySize(availableBillboards);

      // Helper function to convert face count to text
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      // Prepare data for export
      const exportData = sortedAvailableBillboards.map((billboard: any, index: number) => {
        // Generate image filename: Billboard_Name + .jpg
        const billboardName = billboard.Billboard_Name || billboard.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
        
        return {
          'ر.م': billboard.ID || billboard.id || '',
          'اسم لوحة': billboardName,
          'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
          'مدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'منطقة': billboard.District || billboard.district || '',
          'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
          'ID الحجم': billboard.size_id || '',
          'حجم': billboard.Size || billboard.size || '',
          'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'نوع اللوحة': billboard.billboard_type || 'غير محدد',
          'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces),
          'الترتيب مقاس': index + 1,
          '@IMAGE': imageFileName,
          'image_url': billboard.Image_URL || billboard.image || ''
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 8 },  // الفئة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // ID الحجم
        { wch: 10 }, // حجم
        { wch: 20 }, // احداثي - GPS
        { wch: 15 }, // نوع اللوحة
        { wch: 15 }, // عدد الاوجه
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
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
            'رابط الصورة': billboard.Image_URL || billboard.image || '',
            'تصميم الوجه الأمامي': billboard.design_face_a || '',
            'تصميم الوجه الخلفي': billboard.design_face_b || '',
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
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 25 },
        { wch: 40 }, { wch: 40 }
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

  // ✅ NEW: Export all billboards with rent end date only (without customer info or ad type)
  const exportAllWithEndDate = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel لجميع اللوحات مع تاريخ الانتهاء...');
      
      // Filter out removed billboards
      const activeBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        
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
        return true;
      });

      if (activeBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      // Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(activeBillboards);

      // Get contract dates for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const contractDates = await getContractDates(billboard);
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'حجم': billboard.Size || billboard.size || '',
            'مستوى': billboard.Level || billboard.level || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الاوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
            'تاريخ انتهاء الإيجار': contractDates.endDate || '',
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': billboard.Image_URL || billboard.image || ''
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // حجم
        { wch: 8 },  // مستوى
        { wch: 20 }, // احداثي - GPS
        { wch: 12 }, // عدد الاوجه
        { wch: 18 }, // تاريخ انتهاء الإيجار
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'جميع اللوحات');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `جميع_اللوحات_مع_تاريخ_الانتهاء_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${activeBillboards.length} لوحة)`);
      console.log('✅ All billboards with end date Excel exported');
    } catch (error) {
      console.error('Error exporting all billboards with end date:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available billboards + those becoming available in 3 months
  const exportAvailableAndUpcoming = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات المتاحة والقادمة...');
      
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      // Filter billboards: available now OR will become available within 3 months
      const filteredBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        const maintenanceType = String(billboard.maintenance_type ?? '').trim();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        // ✅ استبعاد لوحات الشركات الصديقة
        if (billboard.friend_company_id) {
          return false;
        }
        
        // ✅ استبعاد اللوحات المخفية من المتاح
        const isVisibleInAvailable = billboard.is_visible_in_available !== false;
        if (!isVisibleInAvailable) {
          return false;
        }
        
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
        if (maintenanceType === 'تحتاج إزالة' || 
            maintenanceType === 'تمت الإزالة' ||
            maintenanceType === 'لم يتم التركيب' ||
            maintenanceType.includes('إزالة') || 
            maintenanceType.includes('ازالة')) {
          return false;
        }
        
        // Available now
        if ((statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired) {
          return true;
        }
        
        // Check if contract ends within 3 months
        const endDate = billboard.Rent_End_Date || billboard.rent_end_date;
        if (endDate) {
          try {
            const endDateObj = new Date(endDate);
            if (endDateObj <= threeMonthsFromNow) {
              return true;
            }
          } catch {
            return false;
          }
        }
        
        return false;
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      // Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      // Helper function to convert face count to text
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      // Get contract dates for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const contractDates = await getContractDates(billboard);
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
          const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
          const statusValue = String(billboard.Status ?? billboard.status ?? '').trim().toLowerCase();
          const isAvailableNow = (statusValue === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'حجم': billboard.Size || billboard.size || '',
            'مستوى': billboard.Level || billboard.level || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'نوع اللوحة': billboard.billboard_type || 'غير محدد',
            'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces),
            'تاريخ انتهاء الإيجار': contractDates.endDate || '',
            'الحالة': isAvailableNow ? 'متاح الآن' : 'ستتاح قريباً',
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': billboard.Image_URL || billboard.image || ''
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // حجم
        { wch: 8 },  // مستوى
        { wch: 20 }, // احداثي - GPS
        { wch: 15 }, // نوع اللوحة
        { wch: 15 }, // عدد الاوجه
        { wch: 18 }, // تاريخ انتهاء الإيجار
        { wch: 15 }, // الحالة
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'المتاحة والقادمة');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتاحة_والقادمة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${filteredBillboards.length} لوحة)`);
      console.log('✅ Available and upcoming billboards Excel exported');
    } catch (error) {
      console.error('Error exporting available and upcoming billboards:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available billboards + billboards from selected contracts
  const exportAvailableWithContracts = async (
    billboards: any[], 
    isContractExpired: (endDate: string | null) => boolean,
    selectedContractIds: number[],
    hideEndDateContractIds: number[] = []
  ) => {
    try {
      toast.info('جاري تحضير ملف Excel...');

      // Get billboards from selected contracts with end dates
      let contractBillboardIds: string[] = [];
      let contractEndDates: { [contractNumber: number]: string } = {};
      
      if (selectedContractIds.length > 0) {
        const { data: contractsData, error } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date"')
          .in('Contract_Number', selectedContractIds);

        if (!error && contractsData) {
          contractsData.forEach((contract: any) => {
            if (contract.billboard_ids) {
              // billboard_ids is stored as comma-separated string (e.g., "6,137,108")
              const ids = String(contract.billboard_ids).split(',').map(id => id.trim()).filter(id => id);
              contractBillboardIds.push(...ids);
            }
            // Store end date for each contract
            if (contract['End Date']) {
              contractEndDates[contract.Contract_Number] = contract['End Date'];
            }
          });
        }
      }

      // Create mapping of billboard ID to contract number
      let billboardToContract: { [billboardId: string]: number } = {};
      if (selectedContractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids')
          .in('Contract_Number', selectedContractIds);

        if (contractsData) {
          contractsData.forEach((contract: any) => {
            if (contract.billboard_ids) {
              const ids = String(contract.billboard_ids).split(',').map(id => id.trim()).filter(id => id);
              ids.forEach(id => {
                billboardToContract[id] = contract.Contract_Number;
              });
            }
          });
        }
      }

      // Filter available billboards + billboards from selected contracts
      const filteredBillboards = billboards.filter((billboard: any) => {
        const billboardId = String(billboard.ID || billboard.id);
        
        // Include if billboard is from selected contracts
        if (contractBillboardIds.includes(billboardId)) {
          return true;
        }

        // Otherwise use standard available logic
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        // ✅ استبعاد لوحات الشركات الصديقة
        if (billboard.friend_company_id) return false;
        
        const isVisibleInAvailable = billboard.is_visible_in_available !== false;
        if (!isVisibleInAvailable) return false;
        
        if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') return false;
        if (maintenanceStatus === 'removed' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
            maintenanceStatus === 'تمت الإزالة' || maintenanceStatus === 'لم يتم التركيب') return false;
        
        return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = sortedBillboards.map((billboard: any, index: number) => {
        const billboardName = billboard.Billboard_Name || billboard.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
        const billboardId = String(billboard.ID || billboard.id);
        const isFromContract = contractBillboardIds.includes(billboardId);
        
        // Get end date for this billboard's contract
        let endDateDisplay = '';
        if (isFromContract) {
          const contractNumber = billboardToContract[billboardId];
          // Only show end date if contract is NOT in hideEndDateContractIds
          if (contractNumber && !hideEndDateContractIds.includes(contractNumber)) {
            const endDate = contractEndDates[contractNumber];
            if (endDate) {
              endDateDisplay = new Date(endDate).toLocaleDateString('ar-LY');
            }
          }
        }
        
        return {
          'ر.م': billboard.ID || billboard.id || '',
          'اسم لوحة': billboardName,
          'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
          'مدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'منطقة': billboard.District || billboard.district || '',
          'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
          'حجم': billboard.Size || billboard.size || '',
          'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'نوع اللوحة': billboard.billboard_type || 'غير محدد',
          'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count),
          'تاريخ الانتهاء': endDateDisplay,
          'المصدر': isFromContract ? 'عقد محدد' : 'متاح',
          'الترتيب مقاس': index + 1,
          '@IMAGE': imageFileName,
          'image_url': billboard.Image_URL || billboard.image || ''
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'المتاح مع العقود');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `المتاح_مع_عقود_محددة_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل: ${filename} (${filteredBillboards.length} لوحة)`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available + upcoming + selected contracts (billboards without end date)
  const exportAvailableAndUpcomingWithContracts = async (
    billboards: any[], 
    isContractExpired: (endDate: string | null) => boolean,
    selectedContractIds: number[],
    hideEndDateContractIds: number[] = []
  ) => {
    try {
      toast.info('جاري تحضير ملف Excel للمتاح والقادمة مع عقود محددة...');

      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      // Get billboards from selected contracts with end dates
      let contractBillboardIds: string[] = [];
      let contractEndDates: { [contractNumber: number]: string } = {};
      let billboardToContract: { [billboardId: string]: number } = {};
      
      if (selectedContractIds.length > 0) {
        const { data: contractsData, error } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date"')
          .in('Contract_Number', selectedContractIds);

        if (!error && contractsData) {
          contractsData.forEach((contract: any) => {
            if (contract.billboard_ids) {
              // billboard_ids is stored as comma-separated string (e.g., "6,137,108")
              const ids = String(contract.billboard_ids).split(',').map(id => id.trim()).filter(id => id);
              contractBillboardIds.push(...ids);
              // Map billboard ID to contract number
              ids.forEach(id => {
                billboardToContract[id] = contract.Contract_Number;
              });
            }
            // Store end date for each contract
            if (contract['End Date']) {
              contractEndDates[contract.Contract_Number] = contract['End Date'];
            }
          });
        }
      }

      // Filter: available + upcoming (3 months) + selected contracts
      const filteredBillboards = billboards.filter((billboard: any) => {
        const billboardId = String(billboard.ID || billboard.id);
        
        // Include if billboard is from selected contracts
        if (contractBillboardIds.includes(billboardId)) {
          return true;
        }

        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        const maintenanceType = String(billboard.maintenance_type ?? '').trim();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        // ✅ استبعاد لوحات الشركات الصديقة
        if (billboard.friend_company_id) return false;
        
        // ✅ استبعاد اللوحات المخفية من المتاح
        const isVisibleInAvailable = billboard.is_visible_in_available !== false;
        if (!isVisibleInAvailable) return false;
        
        // Exclude removed billboards
        if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') return false;
        if (maintenanceStatus === 'removed' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
            maintenanceStatus === 'تمت الإزالة' || maintenanceStatus === 'لم يتم التركيب') return false;
        if (maintenanceType === 'تحتاج إزالة' || maintenanceType === 'تمت الإزالة' ||
            maintenanceType === 'لم يتم التركيب' || maintenanceType.includes('إزالة') || 
            maintenanceType.includes('ازالة')) return false;

        // Available now
        if ((statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired) {
          return true;
        }
        
        // Check if contract ends within 3 months
        const endDate = billboard.Rent_End_Date || billboard.rent_end_date;
        if (endDate) {
          try {
            const endDateObj = new Date(endDate);
            if (endDateObj <= threeMonthsFromNow) {
              return true;
            }
          } catch {
            return false;
          }
        }
        
        return false;
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          const billboardId = String(billboard.ID || billboard.id);
          const isFromContract = contractBillboardIds.includes(billboardId);
          const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
          const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
          const statusValue = String(billboard.Status ?? billboard.status ?? '').trim().toLowerCase();
          const isAvailableNow = (statusValue === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
          
          // Get contract dates
          let endDateDisplay = '';
          if (isFromContract) {
            // For selected contracts, show end date only if NOT in hideEndDateContractIds
            const contractNumber = billboardToContract[billboardId];
            if (contractNumber && !hideEndDateContractIds.includes(contractNumber)) {
              const endDate = contractEndDates[contractNumber];
              if (endDate) {
                endDateDisplay = new Date(endDate).toLocaleDateString('ar-LY');
              }
            }
          } else if (!isAvailableNow) {
            // For upcoming billboards, get contract dates
            const contractDates = await getContractDates(billboard);
            endDateDisplay = contractDates.endDate || '';
          }
          
          // Determine source/status
          let source = 'متاح الآن';
          if (isFromContract) {
            source = 'عقد محدد';
          } else if (!isAvailableNow) {
            source = 'ستتاح قريباً';
          }
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'ID الحجم': billboard.size_id || '',
            'حجم': billboard.Size || billboard.size || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'نوع اللوحة': billboard.billboard_type || 'غير محدد',
            'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count),
            'تاريخ انتهاء الإيجار': endDateDisplay, // Empty for selected contracts
            'الحالة': source,
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': billboard.Image_URL || billboard.image || ''
          };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'المتاح والقادمة مع العقود');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `المتاح_والقادمة_مع_عقود_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل: ${filename} (${filteredBillboards.length} لوحة)`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ Helper: convert data rows to tab-separated clipboard text
  const copyDataToClipboard = async (headers: string[], rows: string[][], label: string) => {
    const text = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    await navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${rows.length} ${label} إلى الحافظة`);
  };

  // ✅ Helper: face count text
  const getFaceCountText = (facesCount: any): string => {
    switch (String(facesCount)) {
      case '1': return 'وجه واحد';
      case '2': return 'وجهين';
      case '3': return 'ثلاثة أوجه';
      case '4': return 'أربعة أوجه';
      default: return facesCount || 'غير محدد';
    }
  };

  // ✅ Helper: standard exclusion filter
  const isExcludedBillboard = (billboard: any): boolean => {
    const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
    const statusLower = statusValue.toLowerCase();
    const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
    const maintenanceType = String(billboard.maintenance_type ?? '').trim();
    
    if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') return true;
    if (maintenanceStatus === 'removed' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'تمت الإزالة' || maintenanceStatus === 'لم يتم التركيب') return true;
    if (maintenanceType === 'تحتاج إزالة' || maintenanceType === 'تمت الإزالة' || maintenanceType === 'لم يتم التركيب' || maintenanceType.includes('إزالة') || maintenanceType.includes('ازالة')) return true;
    return false;
  };

  // ✅ Helper: filter available billboards
  const filterAvailableBillboards = (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    return billboards.filter((billboard: any) => {
      const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
      const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
      
      if (billboard.friend_company_id) return false;
      if (billboard.is_visible_in_available === false) return false;
      if (isExcludedBillboard(billboard)) return false;
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    });
  };

  // ✅ Copy available billboards to clipboard (matches Excel export columns exactly)
  const copyAvailableToClipboard = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري نسخ بيانات اللوحات المتاحة...');
      const available = filterAvailableBillboards(billboards, isContractExpired);
      if (available.length === 0) { toast.warning('لا توجد لوحات متاحة للنسخ'); return; }
      const sorted = await sortBillboardsBySize(available);
      const headers = ['ر.م', 'اسم لوحة', 'الفئة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'ID الحجم', 'حجم', 'احداثي - GPS', 'نوع اللوحة', 'عدد الاوجه', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = sorted.map((b: any, index: number) => {
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        return [
          b.ID || b.id || '', billboardName, b.Level || b.level || b.Category_Level || '',
          b.City || b.city || '', b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.size_id || '', b.Size || b.size || '',
          b.GPS_Coordinates || b.gps_coordinates || '', b.billboard_type || 'غير محدد',
          getFaceCountText(b.Faces_Count || b.faces_count || b.faces || b.Number_of_Faces || b.Faces),
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      });
      await copyDataToClipboard(headers, rows, 'لوحة متاحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy all billboards to clipboard (matches Excel export)
  const copyAllToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ جميع اللوحات...');
      const sorted = await sortBillboardsBySize(billboards);
      const headers = ['رقم اللوحة', 'اسم اللوحة', 'المدينة', 'البلدية', 'المنطقة', 'أقرب معلم', 'المقاس', 'المستوى', 'الحالة', 'رقم العقد', 'اسم العميل', 'نوع الإعلان', 'تاريخ بداية الإيجار', 'تاريخ نهاية الإيجار', 'لوحة شراكة', 'الشركات المشاركة', 'رأس المال', 'المتبقي من رأس المال', 'إحداثيات GPS', 'عدد الأوجه', 'نوع اللوحة', 'اسم ملف الصورة', 'رابط الصورة'];
      const rows = await Promise.all(sorted.map(async (b: any) => [
        b.ID || b.id || '', b.Billboard_Name || b.name || '', b.City || b.city || '',
        b.Municipality || b.municipality || '', b.District || b.district || '',
        b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
        b.Status || b.status || '', b.Contract_Number || b.contractNumber || '',
        await getCurrentCustomerName(b), await getCurrentAdType(b),
        b.Rent_Start_Date || b.rent_start_date || '', b.Rent_End_Date || b.rent_end_date || '',
        b.is_partnership ? 'نعم' : 'لا',
        Array.isArray(b.partner_companies) ? b.partner_companies.join(', ') : b.partner_companies || '',
        b.capital || 0, b.capital_remaining || 0,
        b.GPS_Coordinates || b.gps_coordinates || '',
        b.Faces_Count || b.faces_count || b.faces || '', b.billboard_type || '',
        b.image_name || '', b.Image_URL || b.image || '',
      ]));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy available + upcoming (3 months) to clipboard (matches Excel export)
  const copyAvailableAndUpcomingToClipboard = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري نسخ اللوحات المتاحة والقادمة...');
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      const filtered = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        if (billboard.friend_company_id) return false;
        if (billboard.is_visible_in_available === false) return false;
        if (isExcludedBillboard(billboard)) return false;
        if ((statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired) return true;
        const endDate = billboard.Rent_End_Date || billboard.rent_end_date;
        if (endDate) { try { if (new Date(endDate) <= threeMonthsFromNow) return true; } catch { return false; } }
        return false;
      });

      if (filtered.length === 0) { toast.warning('لا توجد لوحات للنسخ'); return; }
      const sorted = await sortBillboardsBySize(filtered);
      const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'نوع اللوحة', 'عدد الاوجه', 'تاريخ انتهاء الإيجار', 'الحالة', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = await Promise.all(sorted.map(async (b: any, index: number) => {
        const contractDates = await getContractDates(b);
        const hasContract = !!(b.Contract_Number ?? b.contractNumber);
        const contractExpired = isContractExpired(b.Rent_End_Date ?? b.rent_end_date);
        const statusLower = String(b.Status ?? b.status ?? '').trim().toLowerCase();
        const isAvailableNow = (statusLower === 'available' || statusLower === 'متاح') || !hasContract || contractExpired;
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        return [
          b.ID || b.id || '', billboardName, b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '', b.billboard_type || 'غير محدد',
          getFaceCountText(b.Faces_Count || b.faces_count || b.faces || b.Number_of_Faces || b.Faces),
          contractDates.endDate || '', isAvailableNow ? 'متاح الآن' : 'ستتاح قريباً',
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy all with end date to clipboard (matches Excel export)
  const copyAllWithEndDateToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ اللوحات مع تاريخ الانتهاء...');
      const active = billboards.filter((b: any) => !isExcludedBillboard(b));
      if (active.length === 0) { toast.warning('لا توجد لوحات للنسخ'); return; }
      const sorted = await sortBillboardsBySize(active);
      const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'عدد الاوجه', 'تاريخ انتهاء الإيجار', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = await Promise.all(sorted.map(async (b: any, index: number) => {
        const contractDates = await getContractDates(b);
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        return [
          b.ID || b.id || '', billboardName, b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '',
          b.Faces_Count || b.faces_count || b.faces || '', contractDates.endDate || '',
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy follow-up billboards to clipboard (matches Excel export)
  const copyFollowUpToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ بيانات المتابعة...');
      const sorted = await sortBillboardsBySize(billboards);
      const headers = ['رقم اللوحة', 'اسم اللوحة', 'المدينة', 'البلدية', 'المنطقة', 'أقرب معلم', 'المقاس', 'المستوى', 'إحداثيات GPS', 'عدد الأوجه', 'نوع اللوحة', 'اسم العميل', 'نوع الإعلان', 'تاريخ بداية العقد', 'تاريخ انتهاء العقد', 'اسم ملف الصورة', 'رابط الصورة'];
      const rows = await Promise.all(sorted.map(async (b: any) => {
        const contractDates = await getContractDates(b);
        return [
          b.ID || b.id || '', b.Billboard_Name || b.name || '', b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '',
          b.Faces_Count || b.faces_count || b.faces || '', b.billboard_type || '',
          await getCurrentCustomerName(b), await getCurrentAdType(b),
          contractDates.startDate, contractDates.endDate,
          b.image_name || '', b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  return {
    exportToExcel,
    exportAvailableToExcel,
    copyAvailableToClipboard,
    copyAllToClipboard,
    copyAvailableAndUpcomingToClipboard,
    copyAllWithEndDateToClipboard,
    copyFollowUpToClipboard,
    exportAllWithEndDate,
    exportAvailableAndUpcoming,
    exportFollowUpToExcel,
    exportRePhotographyToExcel,
    exportAvailableWithContracts,
    exportAvailableAndUpcomingWithContracts,
    // ✅ Export utility functions
    getSizeOrderFromDB,
    sortBillboardsBySize,
    getCurrentCustomerName,
    getCurrentAdType,
    getContractDates
  };
};