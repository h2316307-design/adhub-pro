// @ts-nocheck
import { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertCircle, CheckCircle2, FileText, FolderArchive, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface TableInfo {
  table_name: string;
  row_count: number;
}

export default function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [exportFormat, setExportFormat] = useState<'supabase' | 'mysql'>('supabase');
  const [exportMode, setExportMode] = useState<'zip' | 'single'>('zip');
  const [includeSchema, setIncludeSchema] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    const allTables = [
      'Contract', 'account_closures', 'billboard_faces', 'billboard_history',
      'billboard_levels', 'billboard_types', 'billboards', 'booking_requests',
      'cleanup_logs', 'composite_tasks', 'custody_accounts', 'custody_expenses',
      'custody_transactions', 'customer_general_discounts', 'customer_payments',
      'customer_purchases', 'customers', 'cutout_task_items', 'cutout_tasks',
      'employee_advances', 'employee_contracts', 'employee_deductions',
      'employee_manual_tasks', 'employees', 'expense_categories', 'expenses',
      'expenses_flags', 'expenses_withdrawals', 'friend_billboard_rentals',
      'friend_companies', 'installation_print_pricing', 'installation_task_items',
      'installation_tasks', 'installation_team_accounts', 'installation_teams',
      'invoice_items', 'invoices', 'levels', 'maintenance_history',
      'management_phones', 'messaging_api_settings', 'messaging_settings',
      'municipalities', 'municipality_stickers_settings', 'offers', 'partners',
      'payments_salary', 'payroll_items', 'payroll_runs', 'period_closures',
      'pricing', 'pricing_categories', 'print_installation_pricing',
      'print_invoice_payments', 'print_task_items', 'print_tasks',
      'printed_invoices', 'printers', 'profiles', 'purchase_invoice_items',
      'purchase_invoice_payments', 'purchase_invoices', 'removal_task_items',
      'removal_tasks', 'report_items', 'reports', 'sales_invoice_payments',
      'sales_invoices', 'shared_billboards', 'shared_transactions', 'sizes',
      'system_settings', 'task_designs', 'tasks', 'template_settings',
      'timesheets', 'user_permissions', 'user_roles', 'users', 'withdrawals'
    ];
    
    const promises = allTables.map(async (tableName) => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          return { table_name: tableName, row_count: count || 0 };
        }
        return null;
      } catch (err) {
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const validTables = results.filter((t): t is TableInfo => t !== null);
    validTables.sort((a, b) => b.row_count - a.row_count);
    
    setTables(validTables);
    toast.success(`تم العثور على ${validTables.length} جدول`);
  };

  // خريطة أنواع البيانات الحقيقية من قاعدة البيانات
  const tableSchemaCache: Record<string, any[]> = {};

  const fetchTableSchema = async (tableName: string): Promise<any[]> => {
    if (tableSchemaCache[tableName]) {
      return tableSchemaCache[tableName];
    }

    try {
      const { data, error } = await supabase.rpc('get_table_schema', { p_table_name: tableName });
      if (error || !data) {
        console.warn(`Could not fetch schema for ${tableName}:`, error?.message);
        return [];
      }
      tableSchemaCache[tableName] = data;
      return data;
    } catch (err) {
      console.warn(`Error fetching schema for ${tableName}:`, err);
      return [];
    }
  };

  const inferColumnType = (value: any, columnName?: string, schemaInfo?: any[]): string => {
    // أولاً: استخدام معلومات الـ schema إذا كانت متوفرة
    if (schemaInfo && columnName) {
      const colSchema = schemaInfo.find(c => c.column_name === columnName);
      if (colSchema) {
        return colSchema.data_type.toUpperCase();
      }
    }
    
    // ثانياً: استنتاج النوع من القيمة
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'BIGINT' : 'NUMERIC';
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'TIMESTAMP WITH TIME ZONE';
      if (value.length === 36 && value.includes('-')) return 'UUID';
      return 'TEXT';
    }
    if (Array.isArray(value)) return 'JSONB';
    if (typeof value === 'object') return 'JSONB';
    return 'TEXT';
  };

  const generateCreateTableFromData = async (tableName: string, data: any[], format: 'supabase' | 'mysql'): Promise<string> => {
    if (!data || data.length === 0) return '';
    
    const quote = format === 'mysql' ? '`' : '"';
    const sample = data[0];
    const columns = Object.keys(sample);
    
    // جلب معلومات الـ schema الحقيقية من قاعدة البيانات
    const schemaInfo = await fetchTableSchema(tableName);
    
    // تحديد المفاتيح الأساسية
    const primaryKeys = schemaInfo.filter(c => c.is_primary).map(c => c.column_name);
    
    const columnDefs = columns.map(col => {
      const colSchema = schemaInfo.find(c => c.column_name === col);
      let dataType = colSchema ? colSchema.data_type.toUpperCase() : inferColumnType(sample[col], col, schemaInfo);
      
      // تحويل أنواع البيانات للقراءة الصحيحة
      if (dataType.includes('CHARACTER VARYING')) dataType = 'TEXT';
      if (dataType === 'DOUBLE PRECISION') dataType = 'DOUBLE PRECISION';
      if (dataType === 'TIMESTAMP WITH TIME ZONE') dataType = 'TIMESTAMP WITH TIME ZONE';
      if (dataType === 'ARRAY') dataType = 'JSONB'; // تحويل ARRAY إلى JSONB للتوافق
      
      if (format === 'mysql') {
        const typeMap: Record<string, string> = {
          'TEXT': 'TEXT',
          'BIGINT': 'BIGINT',
          'INTEGER': 'INT',
          'NUMERIC': 'DECIMAL(15,2)',
          'DOUBLE PRECISION': 'DOUBLE',
          'BOOLEAN': 'TINYINT(1)',
          'TIMESTAMP WITH TIME ZONE': 'DATETIME',
          'TIMESTAMP': 'DATETIME',
          'DATE': 'DATE',
          'UUID': 'VARCHAR(36)',
          'JSONB': 'JSON',
          'JSON': 'JSON'
        };
        dataType = typeMap[dataType] || 'TEXT';
      }
      
      // إضافة NOT NULL و PRIMARY KEY
      let constraints = '';
      if (colSchema) {
        if (colSchema.is_nullable === 'NO' && !primaryKeys.includes(col)) {
          constraints += ' NOT NULL';
        }
        if (colSchema.column_default && format === 'supabase') {
          // تبسيط القيم الافتراضية
          let defaultVal = colSchema.column_default;
          if (!defaultVal.includes('nextval')) {
            constraints += ` DEFAULT ${defaultVal}`;
          }
        }
      }
      
      return `  ${quote}${col}${quote} ${dataType}${constraints}`;
    }).join(',\n');

    let createStatement = '';
    if (format === 'mysql') {
      const pkDef = primaryKeys.length > 0 ? `,\n  PRIMARY KEY (${primaryKeys.map(pk => `${quote}${pk}${quote}`).join(', ')})` : '';
      createStatement = `CREATE TABLE IF NOT EXISTS ${quote}${tableName}${quote} (\n${columnDefs}${pkDef}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`;
    } else {
      const pkDef = primaryKeys.length > 0 ? `,\n  PRIMARY KEY (${primaryKeys.map(pk => `${quote}${pk}${quote}`).join(', ')})` : '';
      createStatement = `CREATE TABLE IF NOT EXISTS public.${quote}${tableName}${quote} (\n${columnDefs}${pkDef}\n);\n`;
    }
    
    return createStatement;
  };

  // تقسيم البيانات إلى دفعات
  const generateInsertBatches = async (tableName: string, data: any[], format: 'supabase' | 'mysql', batchSize = 100): Promise<string[]> => {
    if (!data || data.length === 0) return [];
    
    const quote = format === 'mysql' ? '`' : '"';
    const batches: string[] = [];
    
    // جلب معلومات الـ schema للتعامل مع الأنواع بشكل صحيح
    const schemaInfo = await fetchTableSchema(tableName);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      let sql = '';
      
      const columns = Object.keys(batch[0]);
      const columnList = columns.map(c => `${quote}${c}${quote}`).join(', ');
      
      const valuesList = batch.map(row => {
        const values = columns.map(col => {
          const val = row[col];
          const colSchema = schemaInfo.find(c => c.column_name === col);
          const dataType = colSchema?.data_type?.toLowerCase() || '';
          
          if (val === null || val === undefined) return 'NULL';
          
          // معالجة JSONB
          if (dataType === 'jsonb' || dataType === 'json' || dataType === 'array') {
            if (typeof val === 'object') {
              return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            }
            return `'${String(val).replace(/'/g, "''")}'::jsonb`;
          }
          
          // معالجة UUID
          if (dataType === 'uuid') {
            if (typeof val === 'string' && val.length === 36) {
              return `'${val}'::uuid`;
            }
            return 'NULL';
          }
          
          // معالجة النصوص
          if (typeof val === 'string') {
            return `'${val.replace(/'/g, "''")}'`;
          }
          
          // معالجة القيم المنطقية
          if (typeof val === 'boolean') {
            return format === 'mysql' ? (val ? '1' : '0') : val.toString();
          }
          
          // معالجة الكائنات (تحويلها إلى JSONB)
          if (typeof val === 'object') {
            return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          }
          
          return val.toString();
        });
        return `(${values.join(', ')})`;
      }).join(',\n');
      
      const tableRef = format === 'mysql' ? `${quote}${tableName}${quote}` : `public.${quote}${tableName}${quote}`;
      sql = `INSERT INTO ${tableRef} (${columnList}) VALUES\n${valuesList};\n`;
      batches.push(sql);
    }
    
    return batches;
  };

  const exportDatabaseAsZip = async () => {
    setIsExporting(true);
    setProgress(0);
    
    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().split('T')[0];
      
      // ملف README
      let readmeContent = `# نسخة احتياطية لقاعدة البيانات\n\n`;
      readmeContent += `- تاريخ الإنشاء: ${new Date().toISOString()}\n`;
      readmeContent += `- النوع: ${exportFormat === 'mysql' ? 'MySQL' : 'PostgreSQL/Supabase'}\n`;
      readmeContent += `- عدد الجداول: ${tables.length}\n\n`;
      readmeContent += `## ترتيب الاستيراد\n\n`;
      readmeContent += `يجب استيراد الملفات بالترتيب التالي:\n\n`;
      readmeContent += `1. 00_schema.sql (إذا كان موجوداً)\n`;
      readmeContent += `2. ملفات الجداول الأساسية (بدون علاقات)\n`;
      readmeContent += `3. ملفات الجداول ذات العلاقات\n\n`;
      readmeContent += `## الجداول المضمنة:\n\n`;
      
      const totalTables = tables.length;
      const dataFolder = zip.folder('data');
      
      // ترتيب الجداول حسب التبعيات - الجداول الأساسية أولاً
      const independentTables = ['profiles', 'user_roles', 'user_permissions', 'sizes', 
        'billboard_types', 'billboard_faces', 'billboard_levels', 
        'municipalities', 'expense_categories', 'customers', 'printers', 'friend_companies', 
        'partners', 'employees', 'installation_teams'];
      
      const sortedTables = [...tables].sort((a, b) => {
        const aIndex = independentTables.indexOf(a.table_name);
        const bIndex = independentTables.indexOf(b.table_name);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });
      
      for (let i = 0; i < sortedTables.length; i++) {
        const tableInfo = sortedTables[i];
        const tableName = tableInfo.table_name;
        setCurrentTable(tableName);
        setProgress(Math.round(((i + 1) / totalTables) * 100));
        
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          
          if (error) {
            console.warn(`تحذير: لم يتم تصدير ${tableName}:`, error.message);
            continue;
          }
          
          if (data && data.length > 0) {
            let tableContent = `-- الجدول: ${tableName}\n`;
            tableContent += `-- عدد السجلات: ${data.length}\n`;
            tableContent += `-- تاريخ التصدير: ${new Date().toISOString()}\n\n`;
            
            if (includeSchema) {
              tableContent += await generateCreateTableFromData(tableName, data, exportFormat);
              tableContent += '\n';
            }
            
            // تقسيم البيانات إلى دفعات
            const batches = await generateInsertBatches(tableName, data, exportFormat, 50);
            batches.forEach((batch, idx) => {
              tableContent += `-- دفعة ${idx + 1} من ${batches.length}\n`;
              tableContent += batch;
              tableContent += '\n';
            });
            
            const fileName = `${String(i + 1).padStart(2, '0')}_${tableName}.sql`;
            dataFolder?.file(fileName, tableContent);
            
            readmeContent += `- ${fileName} (${data.length} سجل)\n`;
          }
        } catch (err) {
          console.warn(`خطأ في تصدير جدول ${tableName}:`, err);
        }
      }
      
      zip.file('README.md', readmeContent);
      
      // إنشاء ملف تنفيذ شامل مقسم
      let masterSQL = `-- ملف التنفيذ الشامل\n`;
      masterSQL += `-- يمكنك تنفيذ هذا الملف أو تنفيذ كل جدول على حدة\n\n`;
      
      if (exportFormat === 'supabase') {
        masterSQL += `-- تعطيل التحقق من المفاتيح الخارجية مؤقتاً\n`;
        masterSQL += `SET session_replication_role = 'replica';\n\n`;
      } else {
        masterSQL += `SET FOREIGN_KEY_CHECKS=0;\n\n`;
      }
      
      zip.file('_EXECUTE_ORDER.txt', `
ترتيب تنفيذ الملفات:
========================

1. افتح SQL Editor في Supabase
2. نفذ كل ملف على حدة بالترتيب الرقمي
3. ابدأ بالملفات ذات الأرقام الأصغر (01_, 02_, ...)
4. إذا واجهت خطأ في ملف، انتقل للتالي وعد إليه لاحقاً

ملاحظات هامة:
- كل ملف يحتوي على جدول واحد فقط
- الملفات مقسمة إلى دفعات صغيرة (50 سجل لكل دفعة)
- هذا يحل مشكلة "Query is too large"
`);
      
      const content = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database-backup-${exportFormat}-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setLastBackup(new Date());
      toast.success(`تم إنشاء النسخة الاحتياطية بنجاح (${tables.length} جدول في ملفات منفصلة)`);
    } catch (error) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
      toast.error('فشل في إنشاء النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentTable('');
    }
  };

  const exportSingleTable = async (tableName: string) => {
    try {
      toast.info(`جاري تصدير ${tableName}...`);
      
      const { data, error } = await supabase.from(tableName).select('*');
      
      if (error) {
        toast.error(`فشل تصدير ${tableName}: ${error.message}`);
        return;
      }
      
      if (!data || data.length === 0) {
        toast.info(`الجدول ${tableName} فارغ`);
        return;
      }
      
      let content = `-- الجدول: ${tableName}\n`;
      content += `-- عدد السجلات: ${data.length}\n`;
      content += `-- تاريخ التصدير: ${new Date().toISOString()}\n\n`;
      
      if (includeSchema) {
        content += await generateCreateTableFromData(tableName, data, exportFormat);
        content += '\n';
      }
      
      const batches = await generateInsertBatches(tableName, data, exportFormat, 50);
      batches.forEach((batch, idx) => {
        content += `-- دفعة ${idx + 1} من ${batches.length}\n`;
        content += batch;
        content += '\n';
      });
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `${tableName}-${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`تم تصدير ${tableName} بنجاح (${data.length} سجل)`);
    } catch (error) {
      console.error(`خطأ في تصدير ${tableName}:`, error);
      toast.error(`فشل تصدير ${tableName}`);
    }
  };

  const importDatabase = async (file: File) => {
    setIsImporting(true);
    setProgress(0);
    
    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const sqlFiles = Object.keys(zip.files)
          .filter(name => name.endsWith('.sql') && name.includes('/'))
          .sort();
        
        toast.info(`تم العثور على ${sqlFiles.length} ملف SQL في الأرشيف`);
        
        let allContent = '';
        for (const fileName of sqlFiles) {
          const content = await zip.files[fileName].async('string');
          allContent += `\n-- ===== ${fileName} =====\n`;
          allContent += content;
          allContent += '\n';
        }
        
        await navigator.clipboard.writeText(allContent);
        toast.success('تم نسخ جميع ملفات SQL للحافظة - الصقها في SQL Editor');
        toast.info('ملاحظة: يُفضل تنفيذ كل ملف على حدة لتجنب حدود الحجم');
        
        return;
      }
      
      const text = await file.text();
      
      if (file.name.endsWith('.sql')) {
        await navigator.clipboard.writeText(text);
        toast.success('تم نسخ محتوى SQL للحافظة - الصقه في SQL Editor');
        return;
      }
      
      // استيراد JSON
      const backup = JSON.parse(text);
      
      if (!backup.tables || !backup.timestamp) {
        throw new Error('ملف النسخة الاحتياطية غير صالح');
      }

      const tableNames = Object.keys(backup.tables);
      const totalTables = tableNames.length;
      let imported = 0;
      let failed = 0;
      
      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        const tableData = backup.tables[tableName];
        
        setProgress(Math.round(((i + 1) / totalTables) * 100));
        
        if (!Array.isArray(tableData) || tableData.length === 0) continue;

        try {
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(tableData);
          
          if (insertError) {
            console.error(`فشل استيراد ${tableName}:`, insertError.message);
            failed++;
          } else {
            imported++;
          }
        } catch (err) {
          console.error(`خطأ في استيراد ${tableName}:`, err);
          failed++;
        }
      }

      if (imported > 0) {
        toast.success(`تم استيراد ${imported} جدول${failed > 0 ? ` (فشل ${failed})` : ''}`);
        await loadTables();
      } else {
        toast.error('فشل في استيراد البيانات');
      }
    } catch (error) {
      console.error('خطأ في استيراد النسخة الاحتياطية:', error);
      toast.error('فشل في استيراد النسخة الاحتياطية');
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.sql') && !file.name.endsWith('.zip')) {
        toast.error('يجب اختيار ملف JSON أو SQL أو ZIP');
        return;
      }
      importDatabase(file);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">النسخ الاحتياطي لقاعدة البيانات</h1>
          <p className="text-muted-foreground">إنشاء واستعادة نسخ احتياطية من قاعدة البيانات</p>
        </div>
      </div>

      <Alert className="mb-6 border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>تحسين جديد:</strong> يتم الآن تقسيم النسخة الاحتياطية إلى ملفات منفصلة لكل جدول، مما يحل مشكلة "Query is too large" في SQL Editor.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* تصدير النسخة الاحتياطية */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5" />
              إنشاء نسخة احتياطية
            </CardTitle>
            <CardDescription>
              تصدير كل جدول في ملف منفصل (ZIP)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">نوع قاعدة البيانات:</label>
              <Select value={exportFormat} onValueChange={(v: 'supabase' | 'mysql') => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supabase">Supabase (PostgreSQL)</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox 
                id="includeSchema" 
                checked={includeSchema}
                onCheckedChange={(checked) => setIncludeSchema(checked as boolean)}
              />
              <label htmlFor="includeSchema" className="text-sm">
                تضمين هيكل الجداول (CREATE TABLE)
              </label>
            </div>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>جاري التصدير: {currentTable}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            
            <Button
              onClick={exportDatabaseAsZip}
              disabled={isExporting || isImporting || tables.length === 0}
              className="w-full"
              size="lg"
            >
              <FolderArchive className="ml-2 h-5 w-5" />
              {isExporting ? 'جاري الإنشاء...' : 'تصدير كملفات ZIP'}
            </Button>

            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                آخر نسخة: {lastBackup.toLocaleString('ar-SA')}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
              <p className="font-medium">مميزات التصدير:</p>
              <p>• كل جدول في ملف SQL منفصل</p>
              <p>• البيانات مقسمة إلى دفعات (50 سجل/دفعة)</p>
              <p>• يحل مشكلة "Query is too large"</p>
              <p>• ملف README مع تعليمات الاستيراد</p>
            </div>
          </CardContent>
        </Card>

        {/* استيراد النسخة الاحتياطية */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              استعادة نسخة احتياطية
            </CardTitle>
            <CardDescription>
              استيراد من ملف ZIP أو SQL أو JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>جاري الاستيراد...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                اختر ملف النسخة الاحتياطية
              </p>
              <label htmlFor="backup-file">
                <Button asChild variant="outline" disabled={isExporting || isImporting}>
                  <span className="cursor-pointer">اختر ملف</span>
                </Button>
              </label>
              <input
                id="backup-file"
                type="file"
                accept=".json,.sql,.zip"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isExporting || isImporting}
              />
            </div>

            <Alert className="border-blue-500 bg-blue-50">
              <FileText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                <strong>طريقة الاستيراد:</strong> فك الضغط عن ملف ZIP، ثم نفذ كل ملف SQL على حدة في SQL Editor بالترتيب الرقمي.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* الجداول */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>الجداول ({tables.length}) - اضغط لتصدير جدول منفرد</CardTitle>
            <Button onClick={loadTables} variant="outline" size="sm">
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              جاري تحميل قائمة الجداول...
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {tables.map((table) => (
                <button
                  key={table.table_name}
                  onClick={() => exportSingleTable(table.table_name)}
                  className="text-sm px-3 py-2 bg-muted rounded-md text-right hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="font-medium flex items-center gap-1">
                    <FileDown className="h-3 w-3" />
                    {table.table_name}
                  </div>
                  {table.row_count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {table.row_count.toLocaleString()} سجل
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* تعليمات */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>تعليمات استعادة النسخة الاحتياطية</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="font-medium text-base">خطوات الاستيراد:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>فك الضغط عن ملف ZIP</li>
              <li>افتح مجلد "data" للوصول لملفات SQL</li>
              <li>افتح SQL Editor في Supabase</li>
              <li>نفذ كل ملف بالترتيب الرقمي (01_, 02_, ...)</li>
              <li>إذا واجهت خطأ، انتقل للملف التالي وعد لاحقاً</li>
            </ol>
          </div>
          
          <Alert className="border-amber-500 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>نصيحة:</strong> نفذ الجداول الأساسية أولاً (sizes, customers, employees) قبل الجداول ذات العلاقات (contracts, billboards).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
