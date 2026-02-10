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
  Image as ImageIcon,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileDown,
  FileUp
} from 'lucide-react';

interface ExcelImageImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

interface ImageRow {
  id: string;
  rowNumber: number;
  image_name: string;
  image_url: string;
  billboard_id: number | null;
  billboard_name: string | null;
  status: 'valid' | 'invalid' | 'success' | 'error';
  errors: string[];
}

export const ExcelImageImportDialog: React.FC<ExcelImageImportDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const templateData = [
      { 'اسم الصورة': 'مثال: T-A-3x4-001', 'رابط الصورة': 'https://example.com/image.jpg' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 30 }, { wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الصور');
    XLSX.writeFile(wb, 'قالب_استيراد_صور_اللوحات.xlsx');
    toast.success('تم تنزيل القالب');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

      if (jsonData.length === 0) {
        toast.error('الملف فارغ');
        return;
      }

      // Get first two column keys dynamically
      const firstRow = jsonData[0];
      const keys = Object.keys(firstRow);
      const nameKey = keys[0]; // first column = image_name
      const urlKey = keys[1];  // second column = image_url

      if (!nameKey || !urlKey) {
        toast.error('يجب أن يحتوي الملف على عمودين: اسم الصورة ورابط الصورة');
        return;
      }

      // Fetch all billboards to match by image_name or Billboard_Name
      const { data: billboards } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, image_name');

      const bbMap = new Map<string, { id: number; name: string }>();
      (billboards || []).forEach(b => {
        if (b.image_name) bbMap.set(b.image_name.trim().toLowerCase(), { id: b.ID, name: b.Billboard_Name || '' });
        if (b.Billboard_Name) bbMap.set(b.Billboard_Name.trim().toLowerCase(), { id: b.ID, name: b.Billboard_Name || '' });
        // Also map by ID as string
        bbMap.set(String(b.ID), { id: b.ID, name: b.Billboard_Name || '' });
      });

      const parsed: ImageRow[] = jsonData.map((row, index) => {
        const errors: string[] = [];
        const imageName = String(row[nameKey] || '').trim();
        const imageUrl = String(row[urlKey] || '').trim();

        if (!imageName) errors.push('اسم الصورة مطلوب');
        if (!imageUrl) errors.push('رابط الصورة مطلوب');

        const match = bbMap.get(imageName.toLowerCase());
        if (!match && imageName) errors.push('لم يتم العثور على لوحة مطابقة');

        return {
          id: crypto.randomUUID(),
          rowNumber: index + 2,
          image_name: imageName,
          image_url: imageUrl,
          billboard_id: match?.id ?? null,
          billboard_name: match?.name ?? null,
          status: errors.length > 0 ? 'invalid' : 'valid',
          errors,
        };
      });

      setRows(parsed);

      const validCount = parsed.filter(r => r.status === 'valid').length;
      const invalidCount = parsed.filter(r => r.status === 'invalid').length;
      toast.success(`تم قراءة ${parsed.length} صف (${validCount} صالح، ${invalidCount} يحتاج مراجعة)`);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast.error('فشل قراءة الملف');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importImages = async () => {
    const validRows = rows.filter(r => r.status === 'valid' && r.billboard_id);
    if (validRows.length === 0) {
      toast.error('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      for (const row of validRows) {
        try {
          const { error } = await supabase
            .from('billboards')
            .update({ Image_URL: row.image_url, image_name: row.image_name })
            .eq('ID', row.billboard_id!);

          if (error) throw error;

          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'success' } : r
          ));
          successCount++;
        } catch (error: any) {
          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'error', errors: [...r.errors, error.message] } : r
          ));
        }
      }

      if (successCount > 0) {
        toast.success(`تم تحديث صور ${successCount} لوحة بنجاح`);
        await onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = rows.filter(r => r.status === 'valid').length;
  const invalidCount = rows.filter(r => r.status === 'invalid').length;
  const successCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-purple-600" />
            استيراد صور اللوحات من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Template + Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 dark:bg-purple-950/20 text-center">
              <FileDown className="h-10 w-10 mx-auto mb-3 text-purple-600" />
              <h4 className="font-medium mb-2">الخطوة 1: تنزيل القالب</h4>
              <p className="text-sm text-muted-foreground mb-4">
                العمود الأول: اسم الصورة (أو اسم اللوحة أو رقمها) | العمود الثاني: رابط الصورة
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="gap-2 border-purple-500 text-purple-700 hover:bg-purple-100">
                <Download className="h-4 w-4" />
                تنزيل القالب
              </Button>
            </div>

            <div className="p-5 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-center">
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
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isProcessing ? 'جاري القراءة...' : 'رفع الملف'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">إجمالي: {rows.length}</Badge>
              {validCount > 0 && <Badge className="bg-green-500">{validCount} صالح</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} غير صالح</Badge>}
              {successCount > 0 && <Badge className="bg-blue-500">{successCount} مكتمل</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} فشل</Badge>}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_80px] gap-2 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0">
                  <div>الصف</div>
                  <div>اسم الصورة</div>
                  <div>اللوحة المطابقة</div>
                  <div>رابط الصورة</div>
                  <div>الحالة</div>
                </div>

                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-[50px_1fr_1fr_1fr_80px] gap-2 p-2 border-b items-center text-sm ${
                      row.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                      row.status === 'error' || row.status === 'invalid' ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{row.rowNumber}</div>
                    <div className="truncate">{row.image_name || '-'}</div>
                    <div className="truncate text-xs">
                      {row.billboard_name ? (
                        <span className="text-green-600">{row.billboard_name}</span>
                      ) : (
                        <span className="text-destructive">غير موجود</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" title={row.image_url}>{row.image_url || '-'}</div>
                    <div>
                      {row.status === 'valid' && <Badge variant="outline" className="text-[10px]">صالح</Badge>}
                      {row.status === 'invalid' && (
                        <Badge variant="destructive" className="text-[10px]" title={row.errors.join(', ')}>
                          <AlertTriangle className="h-3 w-3 mr-1" />خطأ
                        </Badge>
                      )}
                      {row.status === 'success' && (
                        <Badge className="bg-green-500 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />تم
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="h-3 w-3 mr-1" />فشل
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {invalidCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                يوجد {invalidCount} صف يحتوي على أخطاء (لوحة غير موجودة أو بيانات ناقصة). سيتم تجاهلها.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={() => setRows([])}>مسح البيانات</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
            <Button
              onClick={importImages}
              disabled={isImporting || validCount === 0}
              className="gap-2"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />جاري التحديث...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />تحديث صور {validCount} لوحة</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
