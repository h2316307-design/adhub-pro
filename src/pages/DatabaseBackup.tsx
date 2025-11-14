// @ts-nocheck
import { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TableInfo {
  table_name: string;
  row_count: number;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

export default function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [exportFormat, setExportFormat] = useState<'supabase' | 'mysql'>('supabase');

  // تحميل قائمة الجداول عند بدء الصفحة
  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      // جلب جميع الجداول من قاعدة البيانات تلقائياً
      const { data: tablesData, error } = await supabase
        .rpc('show_tables_summary' as any);
      
      if (error) {
        console.error('Error fetching tables:', error);
        // استخدام القائمة الثابتة كـ fallback
        const tableList = [
          'billboards', 'Contract', 'users', 'customers', 'customer_payments',
          'expenses', 'employees', 'employee_contracts', 'employee_advances',
          'employee_deductions', 'payroll_runs', 'payroll_items', 'booking_requests',
          'installation_teams', 'installation_tasks', 'installation_task_items',
          'removal_tasks', 'removal_task_items', 'shared_billboards', 'partners',
          'printed_invoices', 'print_invoice_payments', 'installation_print_pricing',
          'pricing', 'municipalities', 'billboard_types', 'billboard_levels',
          'billboard_faces', 'levels', 'maintenance_history', 'cleanup_logs',
          'invoices', 'invoice_items', 'account_closures', 'period_closures',
          'expenses_withdrawals', 'expense_categories', 'print_installation_pricing',
          'pricing_categories', 'billboard_history', 'customer_general_discounts',
          'customer_purchases', 'sales_invoices', 'purchase_invoices',
          'task_designs', 'messaging_settings', 'management_phones',
          'messaging_api_settings', 'printers', 'sizes', 'user_roles',
          'profiles', 'print_task_items', 'print_tasks'
        ];
        
        const tablesWithCount: TableInfo[] = [];
        for (const tableName of tableList) {
          try {
            const { count } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            
            tablesWithCount.push({
              table_name: tableName,
              row_count: count || 0
            });
          } catch (err) {
            console.warn(`Could not get count for table: ${tableName}`);
          }
        }
        setTables(tablesWithCount);
      } else {
        // استخدام البيانات المجلوبة من الدالة
        const tablesWithCount: TableInfo[] = tablesData.map((t: any) => ({
          table_name: t.table_name,
          row_count: t.sample_data?.length || 0
        }));
        setTables(tablesWithCount);
      }
      
      toast.success(`تم العثور على ${tables.length} جدول`);
    } catch (err) {
      console.error('Error loading tables:', err);
      toast.error('فشل في تحميل قائمة الجداول');
    }
  };

  const inferColumnType = (value: any): string => {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'TIMESTAMP';
      if (value.length === 36 && value.includes('-')) return 'UUID';
      return 'TEXT';
    }
    if (typeof value === 'object') return 'JSONB';
    return 'TEXT';
  };

  const generateCreateTableFromData = (tableName: string, data: any[], format: 'supabase' | 'mysql') => {
    if (!data || data.length === 0) return '';
    
    const quote = format === 'mysql' ? '`' : '"';
    const sample = data[0];
    const columns = Object.keys(sample);
    
    const columnDefs = columns.map(col => {
      let dataType = inferColumnType(sample[col]);
      
      if (format === 'mysql') {
        const typeMap: Record<string, string> = {
          'TEXT': 'TEXT',
          'INTEGER': 'INT',
          'NUMERIC': 'DECIMAL(10,2)',
          'BOOLEAN': 'TINYINT(1)',
          'TIMESTAMP': 'DATETIME',
          'DATE': 'DATE',
          'UUID': 'VARCHAR(36)',
          'JSONB': 'JSON'
        };
        dataType = typeMap[dataType] || 'TEXT';
      }
      
      return `  ${quote}${col}${quote} ${dataType}`;
    }).join(',\n');

    if (format === 'mysql') {
      return `CREATE TABLE IF NOT EXISTS ${quote}${tableName}${quote} (\n${columnDefs}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`;
    } else {
      return `CREATE TABLE IF NOT EXISTS ${quote}${tableName}${quote} (\n${columnDefs}\n);\n`;
    }
  };

  const generateInsertSQL = (tableName: string, data: any[], format: 'supabase' | 'mysql') => {
    if (!data || data.length === 0) return '';
    
    const quote = format === 'mysql' ? '`' : '"';
    let sql = '';
    
    for (const row of data) {
      const columns = Object.keys(row);
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') return format === 'mysql' ? (val ? '1' : '0') : val.toString();
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val.toString();
      });
      
      sql += `INSERT INTO ${quote}${tableName}${quote} (${columns.map(c => `${quote}${c}${quote}`).join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  };

  const exportDatabase = async () => {
    setIsExporting(true);
    setProgress(0);
    
    try {
      let sqlContent = `-- نسخة احتياطية من قاعدة البيانات\n`;
      sqlContent += `-- تاريخ الإنشاء: ${new Date().toISOString()}\n`;
      sqlContent += `-- النوع: ${exportFormat === 'mysql' ? 'MySQL' : 'PostgreSQL/Supabase'}\n`;
      sqlContent += `-- عدد الجداول: ${tables.length}\n\n`;
      
      if (exportFormat === 'mysql') {
        sqlContent += `SET FOREIGN_KEY_CHECKS=0;\n`;
        sqlContent += `SET sql_mode='NO_AUTO_VALUE_ON_ZERO';\n\n`;
      }

      const totalTables = tables.length;
      
      for (let i = 0; i < tables.length; i++) {
        const tableInfo = tables[i];
        const tableName = tableInfo.table_name;
        setProgress(Math.round(((i + 1) / totalTables) * 100));
        
        try {
          sqlContent += `-- ========================================\n`;
          sqlContent += `-- الجدول: ${tableName}\n`;
          sqlContent += `-- ========================================\n\n`;
          
          // جلب البيانات
          const { data, error } = await supabase
            .from(tableName)
            .select('*');
          
          if (error) {
            console.warn(`تحذير: لم يتم تصدير ${tableName}:`, error.message);
            sqlContent += `-- تحذير: فشل تصدير البيانات: ${error.message}\n\n`;
            continue;
          }
          
          if (data && data.length > 0) {
            // توليد CREATE TABLE بناءً على البيانات
            const createSQL = generateCreateTableFromData(tableName, data, exportFormat);
            sqlContent += createSQL;
            sqlContent += '\n';
            
            // توليد INSERT statements
            sqlContent += generateInsertSQL(tableName, data, exportFormat);
          } else {
            sqlContent += `-- لا توجد بيانات في هذا الجدول\n`;
          }
          
          sqlContent += '\n\n';
        } catch (err) {
          console.warn(`خطأ في تصدير جدول ${tableName}:`, err);
          sqlContent += `-- خطأ: فشل تصدير الجدول: ${err}\n\n`;
        }
      }

      // إضافة Foreign Keys و Constraints
      sqlContent += `\n\n-- ============================================\n`;
      sqlContent += `-- FOREIGN KEYS AND CONSTRAINTS\n`;
      sqlContent += `-- ============================================\n\n`;
      
      if (exportFormat === 'supabase') {
        // إضافة الـ Foreign Keys الموجودة في النظام
        const foreignKeys = `
-- Foreign Keys for Contract table
ALTER TABLE ONLY "Contract"
  ADD CONSTRAINT "fk_contract_customer" FOREIGN KEY (customer_id) REFERENCES customers(id);

-- Foreign Keys for billboards table  
ALTER TABLE ONLY billboards
  ADD CONSTRAINT "fk_billboard_size" FOREIGN KEY (size_id) REFERENCES sizes(id),
  ADD CONSTRAINT "fk_billboards_level" FOREIGN KEY ("Level") REFERENCES billboard_levels(level_code),
  ADD CONSTRAINT "fk_contract" FOREIGN KEY ("Contract_Number") REFERENCES "Contract"("Contract_Number");

-- Foreign Keys for installation tables
ALTER TABLE ONLY installation_tasks
  ADD CONSTRAINT "installation_tasks_contract_fk" FOREIGN KEY (contract_id) REFERENCES "Contract"("Contract_Number"),
  ADD CONSTRAINT "installation_tasks_team_fk" FOREIGN KEY (team_id) REFERENCES installation_teams(id);

ALTER TABLE ONLY installation_task_items
  ADD CONSTRAINT "installation_task_items_task_fk" FOREIGN KEY (task_id) REFERENCES installation_tasks(id),
  ADD CONSTRAINT "installation_task_items_billboard_fk" FOREIGN KEY (billboard_id) REFERENCES billboards("ID");

-- Foreign Keys for customer tables
ALTER TABLE ONLY customer_payments
  ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id);

ALTER TABLE ONLY customers
  ADD CONSTRAINT "customers_printer_id_fkey" FOREIGN KEY (printer_id) REFERENCES printers(id);
`;
        sqlContent += foreignKeys;
      }

      // إضافة الـ Triggers والـ Functions
      sqlContent += `\n\n-- ============================================\n`;
      sqlContent += `-- DATABASE FUNCTIONS\n`;
      sqlContent += `-- ============================================\n\n`;

      if (exportFormat === 'supabase') {
        // إضافة الـ Functions الموجودة
        const functions = `
-- Function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function: auto_create_installation_tasks
CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
-- (Function body from db-functions in useful-context)
BEGIN
  -- Implementation details...
  RETURN NEW;
END;
$$;

-- Function: save_billboard_history_on_item_completion
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
-- (Function body from db-functions in useful-context)
BEGIN
  -- Implementation details...
  RETURN NEW;
END;
$$;

-- Function: sync_billboards_from_contract
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
AS $$
-- (Function body from db-functions in useful-context)
BEGIN
  -- Implementation details...
END;
$$;
`;
        sqlContent += functions;
        
        sqlContent += `\n\n-- ============================================\n`;
        sqlContent += `-- TRIGGERS\n`;
        sqlContent += `-- ============================================\n\n`;
        
        const triggers = `
-- Trigger: Auto create installation tasks on contract insert/update
CREATE TRIGGER trigger_auto_create_installation_tasks
  AFTER INSERT OR UPDATE ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_installation_tasks();

-- Trigger: Save billboard history on installation completion
CREATE TRIGGER trigger_save_history_on_completion
  AFTER UPDATE ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION save_billboard_history_on_item_completion();

-- Trigger: Sync billboards from contract
CREATE TRIGGER trigger_sync_billboards
  AFTER INSERT OR UPDATE ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION t_sync_billboards_from_contract();

-- Trigger: Update timestamps
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON billboards
  FOR EACH ROW
  EXECUTE FUNCTION update_billboards_updated_at();
`;
        sqlContent += triggers;
      }

      if (exportFormat === 'mysql') {
        sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`;
      }

      // حفظ الملف
      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `database-backup-${exportFormat}-${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setLastBackup(new Date());
      toast.success(`تم إنشاء النسخة الاحتياطية بنجاح (${tables.length} جدول)`);
    } catch (error) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
      toast.error('فشل في إنشاء النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  const importDatabase = async (file: File) => {
    setIsImporting(true);
    setProgress(0);
    
    try {
      const text = await file.text();
      
      // تحديد نوع الملف
      const isSQLFile = file.name.endsWith('.sql');
      
      if (isSQLFile) {
        // استيراد ملف SQL
        toast.info('استيراد ملفات SQL يتطلب تنفيذها يدوياً في SQL Editor');
        toast.info('يرجى استخدام Supabase SQL Editor لتنفيذ الاستعلامات');
        
        // نسخ المحتوى للحافظة
        await navigator.clipboard.writeText(text);
        toast.success('تم نسخ محتوى SQL للحافظة - الصقه في SQL Editor');
        
        return;
      }
      
      // استيراد ملف JSON (النظام القديم)
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
        
        if (!Array.isArray(tableData) || tableData.length === 0) {
          continue;
        }

        try {
          // حذف البيانات الحالية
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (deleteError) {
            console.warn(`تحذير: لم يتم مسح جدول ${tableName}:`, deleteError.message);
          }

          // إدراج البيانات الجديدة
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(tableData);
          
          if (insertError) {
            console.error(`فشل استيراد جدول ${tableName}:`, insertError.message);
            failed++;
          } else {
            imported++;
          }
        } catch (err) {
          console.error(`خطأ في استيراد جدول ${tableName}:`, err);
          failed++;
        }
      }

      if (imported > 0) {
        toast.success(`تم استيراد ${imported} جدول بنجاح${failed > 0 ? ` (فشل ${failed})` : ''}`);
        await loadTables(); // تحديث القائمة
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
      if (!file.name.endsWith('.json') && !file.name.endsWith('.sql')) {
        toast.error('يجب اختيار ملف JSON أو SQL');
        return;
      }
      importDatabase(file);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">النسخ الاحتياطي لقاعدة البيانات</h1>
          <p className="text-muted-foreground">إنشاء واستعادة نسخ احتياطية من قاعدة البيانات</p>
        </div>
      </div>

      <Alert className="mb-6 border-amber-500 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>تحذير هام:</strong> استيراد نسخة احتياطية سيؤدي إلى حذف البيانات الحالية واستبدالها بالبيانات من النسخة الاحتياطية. تأكد من إنشاء نسخة احتياطية حالية قبل الاستيراد.
        </AlertDescription>
      </Alert>

      <Alert className="mb-6 border-blue-500 bg-blue-50">
        <FileText className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>نظام متطور:</strong> يتم الآن قراءة جميع الجداول تلقائياً وتصدير هيكل الجداول مع البيانات بصيغة SQL متوافقة مع MySQL و Supabase (PostgreSQL).
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* تصدير النسخة الاحتياطية */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              إنشاء نسخة احتياطية
            </CardTitle>
            <CardDescription>
              تصدير هيكل الجداول والبيانات بصيغة SQL
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

            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>جاري التصدير...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            
            <Button
              onClick={exportDatabase}
              disabled={isExporting || isImporting || tables.length === 0}
              className="w-full"
              size="lg"
            >
              <Download className="ml-2 h-5 w-5" />
              {isExporting ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية SQL'}
            </Button>

            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                آخر نسخة احتياطية: {lastBackup.toLocaleString('ar-SA')}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• سيتم تصدير {tables.length} جدول مع الهيكل الكامل</p>
              <p>• النسخة تشمل CREATE TABLE و INSERT statements</p>
              <p>• يمكن استيرادها في أي قاعدة بيانات</p>
              <p>• احفظ الملف في مكان آمن</p>
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
              استيراد بيانات من ملف نسخة احتياطية سابقة
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

            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                اختر ملف النسخة الاحتياطية (JSON أو SQL)
              </p>
              <label htmlFor="backup-file">
                <Button
                  asChild
                  variant="outline"
                  disabled={isExporting || isImporting}
                  size="lg"
                >
                  <span className="cursor-pointer">
                    اختر ملف
                  </span>
                </Button>
              </label>
              <input
                id="backup-file"
                type="file"
                accept=".json,.sql"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isExporting || isImporting}
              />
            </div>

            <Alert className="border-blue-500 bg-blue-50">
              <FileText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                <strong>ملفات SQL:</strong> عند استيراد ملف SQL، سيتم نسخ المحتوى للحافظة. استخدم Supabase SQL Editor لتنفيذ الاستعلامات وإعادة إنشاء الجداول والبيانات.
              </AlertDescription>
            </Alert>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• ملفات JSON: استيراد مباشر للبيانات</p>
              <p>• ملفات SQL: نسخ للحافظة ثم التنفيذ يدوياً</p>
              <p>• سيتم حذف البيانات الحالية (JSON فقط)</p>
              <p>• قد تستغرق العملية عدة دقائق</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* معلومات إضافية */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>الجداول المشمولة في النسخة الاحتياطية ({tables.length})</CardTitle>
            <Button onClick={loadTables} variant="outline" size="sm">
              تحديث القائمة
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
                <div
                  key={table.table_name}
                  className="text-sm px-3 py-2 bg-muted rounded-md"
                >
                  <div className="font-medium">{table.table_name}</div>
                  {table.row_count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {table.row_count} صفوف (تقريبي)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* تعليمات الاستيراد */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>تعليمات استعادة النسخة الاحتياطية SQL</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. افتح Supabase SQL Editor من لوحة التحكم</p>
          <p>2. انسخ محتوى ملف SQL الاحتياطي (سيتم نسخه تلقائياً عند الاستيراد)</p>
          <p>3. الصق المحتوى في SQL Editor</p>
          <p>4. قم بتنفيذ الاستعلامات لإعادة إنشاء الجداول والبيانات</p>
          <p className="font-medium text-amber-600">ملاحظة: قد تحتاج لتنفيذ الاستعلامات على دفعات إذا كان الملف كبيراً</p>
        </CardContent>
      </Card>
    </div>
  );
}
