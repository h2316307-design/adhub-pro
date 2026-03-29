import * as XLSX from 'xlsx';

interface BillboardExportData {
  billboardName: string;
  nearestLandmark: string;
  municipality: string;
  size: string;
  facesCount: string | number;
  billboardType: string;
  imageUrl: string;
  coordinates: string;
  customerName: string;
  adType: string;
  price?: string | number;
}

export interface ExportBillboardsOptions {
  contractNumber: string | number;
  billboards: any[];
  customerName?: string;
  includePrices?: boolean;
}

export function exportBillboardsToExcel({
  contractNumber,
  billboards,
  customerName = '',
  includePrices = false
}: ExportBillboardsOptions) {
  if (!billboards || billboards.length === 0) {
    throw new Error('لا توجد لوحات للتصدير');
  }

  const exportData: BillboardExportData[] = billboards.map((billboard) => {
    const data: BillboardExportData = {
      billboardName: billboard.Billboard_Name || billboard.name || billboard.ID || billboard.id || '',
      nearestLandmark: billboard.Nearest_Landmark || billboard.nearest_landmark || billboard.location || '',
      municipality: billboard.Municipality || billboard.municipality || billboard.City || '',
      size: billboard.Size || billboard.size || '',
      facesCount: billboard.Faces_Count || billboard.faces_count || billboard.Faces || billboard.faces || '',
      billboardType: billboard.billboard_type || billboard.Ad_Type || billboard.ad_type || billboard.type || '',
      imageUrl: billboard.Image_URL || billboard.image_url || billboard.image || '',
      coordinates: billboard.GPS_Coordinates || billboard.coordinates || billboard.coords || '',
      customerName: customerName,
      adType: billboard.Ad_Type || billboard.ad_type || ''
    };

    if (includePrices && billboard.Price != null) {
      data.price = billboard.Price;
    }

    return data;
  });

  // إنشاء الأعمدة
  const headers: Record<string, string> = {
    billboardName: 'اسم اللوحة',
    nearestLandmark: 'أقرب نقطة دالة',
    municipality: 'البلدية',
    size: 'المقاس',
    facesCount: 'عدد الأوجه',
    billboardType: 'نوع اللوحة',
    imageUrl: 'رابط الصورة',
    coordinates: 'إحداثيات اللوحة',
    customerName: 'اسم الزبون',
    adType: 'نوع الإعلان'
  };

  if (includePrices) {
    headers.price = 'السعر';
  }

  // تحويل البيانات إلى صفوف
  const wsData = [
    Object.values(headers),
    ...exportData.map(row => Object.keys(headers).map(key => row[key as keyof BillboardExportData] || ''))
  ];

  // إنشاء ورقة العمل
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ضبط عرض الأعمدة
  const colWidths = [
    { wch: 20 }, // اسم اللوحة
    { wch: 25 }, // أقرب نقطة
    { wch: 15 }, // البلدية
    { wch: 12 }, // المقاس
    { wch: 12 }, // عدد الأوجه
    { wch: 15 }, // نوع اللوحة
    { wch: 35 }, // رابط الصورة
    { wch: 20 }, // الإحداثيات
    { wch: 20 }, // اسم الزبون
    { wch: 15 }  // نوع الإعلان
  ];

  if (includePrices) {
    colWidths.push({ wch: 12 }); // السعر
  }

  ws['!cols'] = colWidths;

  // إنشاء كتاب العمل
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'اللوحات');

  // تحديد اسم الملف
  const fileName = `لوحات_العقد_${contractNumber}${includePrices ? '_مع_الأسعار' : ''}.xlsx`;

  // حفظ الملف
  XLSX.writeFile(wb, fileName);
}
