import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  FileDown,
  FileUp
} from 'lucide-react';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
  onSuccess: () => Promise<void>;
  generateBillboardName: (municipality: string, level: string, size: string, existingNames: string[], billboardId?: number) => string;
  getNextBillboardId: () => Promise<number>;
}

interface ImportRow {
  id: string;
  rowNumber: number;
  Municipality: string;
  Level: string;
  Size: string;
  City: string;
  District: string;
  Nearest_Landmark: string;
  GPS_Coordinates: string;
  Faces_Count: string;
  billboard_type: string;
  status: 'valid' | 'invalid' | 'success' | 'error';
  errors: string[];
  Billboard_Name?: string;
}

export const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({
  open,
  onOpenChange,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
  onSuccess,
  generateBillboardName,
  getNextBillboardId
}) => {
  const [importedRows, setImportedRows] = useState<ImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تنزيل قالب Excel
  const downloadTemplate = () => {
    const templateData = [
      {
        'البلدية': '',
        'المستوى': '',
        'المقاس': '',
        'المدينة': '',
        'المنطقة': '',
        'أقرب معلم': '',
        'الإحداثيات': '',
        'عدد الأوجه': '',
        'نوع اللوحة': ''
      }
    ];

    // إضافة صفوف أمثلة
    const exampleRows = [
      {
        'البلدية': municipalities[0]?.name || 'مثال: أبوسليم',
        'المستوى': levels[0] || 'A',
        'المقاس': sizes[0]?.name || '3x4',
        'المدينة': citiesList[0] || 'طرابلس',
        'المنطقة': 'منطقة المثال',
        'أقرب معلم': 'بالقرب من...',
        'الإحداثيات': '32.8872, 13.1913',
        'عدد الأوجه': '1',
        'نوع اللوحة': billboardTypes[0] || 'يوني بول'
      }
    ];

    // إنشاء ورقة العمل
    const ws = XLSX.utils.json_to_sheet([...templateData, ...exampleRows]);
    
    // تعيين عرض الأعمدة
    ws['!cols'] = [
      { wch: 15 }, // البلدية
      { wch: 10 }, // المستوى
      { wch: 10 }, // المقاس
      { wch: 12 }, // المدينة
      { wch: 15 }, // المنطقة
      { wch: 25 }, // أقرب معلم
      { wch: 20 }, // الإحداثيات
      { wch: 12 }, // عدد الأوجه
      { wch: 15 }, // نوع اللوحة
    ];

    // إنشاء ورقة المراجع
    const refData = [
      { 'البلديات المتاحة': municipalities.map(m => m.name).join(', ') },
      { 'المستويات المتاحة': levels.join(', ') },
      { 'المقاسات المتاحة': sizes.map(s => s.name).join(', ') },
      { 'المدن المتاحة': citiesList.join(', ') },
      { 'أنواع اللوحات': billboardTypes.join(', ') },
    ];
    const refWs = XLSX.utils.json_to_sheet(refData);
    refWs['!cols'] = [{ wch: 100 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللوحات');
    XLSX.utils.book_append_sheet(wb, refWs, 'المراجع');

    XLSX.writeFile(wb, 'قالب_استيراد_اللوحات.xlsx');
    toast.success('تم تنزيل القالب');
  };

  // قراءة ملف Excel
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      if (jsonData.length === 0) {
        toast.error('الملف فارغ');
        return;
      }

      const municipalityNames = municipalities.map(m => m.name?.toLowerCase());
      const levelNames = levels.map(l => l?.toLowerCase());
      const sizeNames = sizes.map(s => s.name?.toLowerCase());

      const rows: ImportRow[] = jsonData.map((row, index) => {
        const errors: string[] = [];
        
        const municipality = String(row['البلدية'] || '').trim();
        const level = String(row['المستوى'] || '').trim();
        const size = String(row['المقاس'] || '').trim();

        // التحقق من الحقول المطلوبة
        if (!municipality) errors.push('البلدية مطلوبة');
        if (!level) errors.push('المستوى مطلوب');
        if (!size) errors.push('المقاس مطلوب');

        // التحقق من صحة القيم
        if (municipality && !municipalityNames.includes(municipality.toLowerCase())) {
          errors.push('البلدية غير موجودة');
        }
        if (level && !levelNames.includes(level.toLowerCase())) {
          errors.push('المستوى غير موجود');
        }
        if (size && !sizeNames.includes(size.toLowerCase())) {
          errors.push('المقاس غير موجود');
        }

        return {
          id: crypto.randomUUID(),
          rowNumber: index + 2, // +2 للعنوان والفهرسة من 1
          Municipality: municipality,
          Level: level,
          Size: size,
          City: String(row['المدينة'] || '').trim(),
          District: String(row['المنطقة'] || '').trim(),
          Nearest_Landmark: String(row['أقرب معلم'] || '').trim(),
          GPS_Coordinates: String(row['الإحداثيات'] || '').trim(),
          Faces_Count: String(row['عدد الأوجه'] || '1').trim(),
          billboard_type: String(row['نوع اللوحة'] || '').trim(),
          status: errors.length > 0 ? 'invalid' : 'valid',
          errors
        };
      });

      setImportedRows(rows);
      
      const validCount = rows.filter(r => r.status === 'valid').length;
      const invalidCount = rows.filter(r => r.status === 'invalid').length;
      
      toast.success(`تم قراءة ${rows.length} صف (${validCount} صالح، ${invalidCount} يحتاج مراجعة)`);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast.error('فشل قراءة الملف');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // استيراد اللوحات
  const importBillboards = async () => {
    const validRows = importedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      toast.error('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    setIsImporting(true);

    try {
      let nextId = await getNextBillboardId();
      
      const { data: existingBillboards } = await supabase
        .from('billboards')
        .select('Billboard_Name');
      const existingNames = (existingBillboards || []).map(b => b.Billboard_Name || '');

      for (const row of validRows) {
        try {
          const billboardName = generateBillboardName(
            row.Municipality,
            row.Level,
            row.Size,
            existingNames,
            nextId
          );

          let sizeId: number | null = null;
          const matchedSize = sizes.find(s => s.name?.toLowerCase() === row.Size.toLowerCase());
          if (matchedSize) sizeId = matchedSize.id;

          const payload = {
            ID: nextId,
            Billboard_Name: billboardName,
            City: row.City || null,
            Municipality: row.Municipality,
            District: row.District || null,
            Nearest_Landmark: row.Nearest_Landmark || null,
            GPS_Coordinates: row.GPS_Coordinates || null,
            Faces_Count: row.Faces_Count ? parseInt(row.Faces_Count) : 1,
            Size: row.Size,
            size_id: sizeId,
            Level: row.Level,
            billboard_type: row.billboard_type || null,
            Status: 'متاح',
            is_partnership: false
          };

          const { error } = await supabase.from('billboards').insert(payload);
          
          if (error) throw error;

          existingNames.push(billboardName);
          
          setImportedRows(prev => prev.map(r => 
            r.id === row.id ? { ...r, status: 'success', Billboard_Name: billboardName } : r
          ));

          nextId++;
        } catch (error: any) {
          setImportedRows(prev => prev.map(r => 
            r.id === row.id ? { ...r, status: 'error', errors: [...r.errors, error.message] } : r
          ));
        }
      }

      const successCount = importedRows.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        // مزامنة الـ sequence مع آخر ID فعلي لمنع القفز في الترقيم
        await supabase.rpc('setval_billboards_seq' as any);
        toast.success(`تم استيراد ${successCount} لوحة بنجاح`);
        await onSuccess();
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = importedRows.filter(r => r.status === 'valid').length;
  const invalidCount = importedRows.filter(r => r.status === 'invalid').length;
  const successCount = importedRows.filter(r => r.status === 'success').length;
  const errorCount = importedRows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            استيراد من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* تنزيل القالب ورفع الملف */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-lg border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-950/20 text-center">
              <FileDown className="h-10 w-10 mx-auto mb-3 text-green-600" />
              <h4 className="font-medium mb-2">الخطوة 1: تنزيل القالب</h4>
              <p className="text-sm text-muted-foreground mb-4">
                قم بتنزيل قالب Excel وتعبئة بيانات اللوحات
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="gap-2 border-green-500 text-green-700 hover:bg-green-100">
                <Download className="h-4 w-4" />
                تنزيل القالب
              </Button>
            </div>

            <div className="p-6 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-center">
              <FileUp className="h-10 w-10 mx-auto mb-3 text-blue-600" />
              <h4 className="font-medium mb-2">الخطوة 2: رفع الملف</h4>
              <p className="text-sm text-muted-foreground mb-4">
                ارفع ملف Excel بعد تعبئة البيانات
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                className="gap-2 border-blue-500 text-blue-700 hover:bg-blue-100"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isProcessing ? 'جاري القراءة...' : 'رفع الملف'}
              </Button>
            </div>
          </div>

          {/* الإحصائيات */}
          {importedRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">إجمالي: {importedRows.length}</Badge>
              {validCount > 0 && <Badge className="bg-green-500">{validCount} صالح</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} غير صالح</Badge>}
              {successCount > 0 && <Badge className="bg-blue-500">{successCount} مكتمل</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} فشل</Badge>}
            </div>
          )}

          {/* جدول المعاينة */}
          {importedRows.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_100px] gap-2 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0">
                  <div>الصف</div>
                  <div>البلدية</div>
                  <div>المستوى</div>
                  <div>المقاس</div>
                  <div>المدينة</div>
                  <div>الحالة</div>
                </div>
                
                {importedRows.map((row) => (
                  <div 
                    key={row.id} 
                    className={`grid grid-cols-[50px_1fr_1fr_1fr_1fr_100px] gap-2 p-2 border-b items-center text-sm ${
                      row.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                      row.status === 'error' || row.status === 'invalid' ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{row.rowNumber}</div>
                    <div className={!row.Municipality ? 'text-destructive' : ''}>{row.Municipality || '-'}</div>
                    <div className={!row.Level ? 'text-destructive' : ''}>{row.Level || '-'}</div>
                    <div className={!row.Size ? 'text-destructive' : ''}>{row.Size || '-'}</div>
                    <div>{row.City || '-'}</div>
                    <div>
                      {row.status === 'valid' && (
                        <Badge variant="outline" className="text-[10px]">صالح</Badge>
                      )}
                      {row.status === 'invalid' && (
                        <Badge variant="destructive" className="text-[10px]" title={row.errors.join(', ')}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          خطأ
                        </Badge>
                      )}
                      {row.status === 'success' && (
                        <Badge className="bg-green-500 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          تم
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="h-3 w-3 mr-1" />
                          فشل
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* تحذير الصفوف غير الصالحة */}
          {invalidCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                يوجد {invalidCount} صف يحتوي على أخطاء. سيتم تجاهل هذه الصفوف عند الاستيراد.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={() => setImportedRows([])}>
            مسح البيانات
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
            <Button 
              onClick={importBillboards} 
              disabled={isImporting || validCount === 0}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  استيراد {validCount} لوحة
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
