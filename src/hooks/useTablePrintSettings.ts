import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// تعريف العمود
export interface TableColumn {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  width?: string;
}

export interface TablePrintSettings {
  id?: string;
  setting_key: string;
  
  // ألوان الجدول
  header_bg_color: string;
  header_text_color: string;
  row_bg_color: string;
  row_alt_bg_color: string;
  row_text_color: string;
  border_color: string;
  
  // لون العمود الأول (الترقيم أو الأول)
  first_column_bg_color: string;
  first_column_text_color: string;
  
  // أحجام الخطوط
  header_font_size: string;
  row_font_size: string;
  title_font_size: string;
  
  // أحجام الصور - max dimension
  billboard_image_size: string;
  design_image_size: string;
  installed_image_size: string;
  qr_code_size: string;
  
  // خيارات العرض
  show_qr_code: boolean;
  auto_hide_empty_columns: boolean;
  
  // ترتيب الأعمدة
  columns_order: TableColumn[];
  
  // إعدادات الصفحة
  page_title: string;
  rows_per_page: number;
  page_orientation: 'portrait' | 'landscape';
  page_margin: string;
  
  // إعدادات الخطوط
  primary_font: string;
  
  // إعدادات موقع الجدول والخلفية
  table_top_margin: string;
  table_background_url: string;
  table_background_enabled: boolean;
  row_height: string;
}

// الأعمدة الافتراضية مع ترتيبها وعرضها
export const defaultColumns: TableColumn[] = [
  { id: 'row_number', label: '#', enabled: true, order: 0, width: '5%' },
  { id: 'billboard_image', label: 'صورة اللوحة', enabled: true, order: 1, width: '10%' },
  { id: 'billboard_name', label: 'اسم اللوحة', enabled: true, order: 2, width: '15%' },
  { id: 'size', label: 'المقاس', enabled: true, order: 3, width: '8%' },
  { id: 'faces_count', label: 'الأوجه', enabled: true, order: 4, width: '5%' },
  { id: 'location', label: 'الموقع', enabled: true, order: 5, width: '12%' },
  { id: 'landmark', label: 'أقرب معلم', enabled: true, order: 6, width: '12%' },
  { id: 'contract_number', label: 'العقد', enabled: true, order: 7, width: '6%' },
  { id: 'installation_date', label: 'تاريخ التركيب', enabled: true, order: 8, width: '8%' },
  { id: 'design_images', label: 'التصميم', enabled: true, order: 9, width: '8%' },
  { id: 'installed_images', label: 'صور التركيب', enabled: true, order: 10, width: '8%' },
  { id: 'qr_code', label: 'QR', enabled: true, order: 11, width: '5%' },
];

export const defaultTablePrintSettings: TablePrintSettings = {
  setting_key: 'table_print_default',
  
  // ألوان مطابقة لتصدير PDF من fares2
  header_bg_color: '#000000', // أسود
  header_text_color: '#E8CC64', // ذهبي
  row_bg_color: '#ffffff',
  row_alt_bg_color: '#ffffff',
  row_text_color: '#000000',
  border_color: '#000000',
  
  // العمود الأول ذهبي
  first_column_bg_color: '#E8CC64',
  first_column_text_color: '#000000',
  
  header_font_size: '9px',
  row_font_size: '8px',
  title_font_size: '14px',
  
  billboard_image_size: '55px',
  design_image_size: '50px',
  installed_image_size: '50px',
  qr_code_size: '50px',
  
  show_qr_code: true,
  auto_hide_empty_columns: true,
  
  columns_order: defaultColumns,
  
  page_title: 'جدول لوحات العقد',
  rows_per_page: 11, // أقصى عدد صفوف في الصفحة
  page_orientation: 'portrait',
  page_margin: '10mm',
  
  primary_font: 'Doran',
  
  // إعدادات موقع الجدول والخلفية
  table_top_margin: '10mm',
  table_background_url: '',
  table_background_enabled: false,
  row_height: '60px',
};

export function useTablePrintSettings() {
  const [settings, setSettings] = useState<TablePrintSettings>(defaultTablePrintSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', 'table_print_default')
        .maybeSingle();

      if (error) {
        console.error('Error fetching table print settings:', error);
        setLoading(false);
        return;
      }

      if (data && data.elements) {
        const savedSettings = typeof data.elements === 'string' 
          ? JSON.parse(data.elements) 
          : data.elements;
        setSettings({ ...defaultTablePrintSettings, ...savedSettings });
      }
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    }
    setLoading(false);
  }, []);

  const saveSettings = useCallback(async (newSettings: TablePrintSettings) => {
    console.log('💾 saveSettings called');
    setSaving(true);
    try {
      const payload = JSON.parse(JSON.stringify(newSettings));

      // استخدام upsert لتبسيط العملية
      const { error } = await supabase
        .from('billboard_print_settings')
        .upsert({
          setting_key: 'table_print_default',
          elements: payload,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error('❌ Error saving settings:', error);
        toast.error(`فشل حفظ الإعدادات: ${error.message}`);
        setSaving(false);
        return false;
      }

      console.log('✅ Settings saved successfully');
      setSettings(newSettings);
      toast.success('تم حفظ إعدادات الجدول بنجاح');
      setSaving(false);
      return true;
    } catch (error) {
      console.error('❌ Error in saveSettings:', error);
      toast.error('خطأ في حفظ الإعدادات');
      setSaving(false);
      return false;
    }
  }, []);

  const updateSetting = useCallback(<K extends keyof TablePrintSettings>(key: K, value: TablePrintSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(async () => {
    const confirmed = window.confirm('هل تريد إعادة جميع إعدادات الجدول للوضع الافتراضي؟');
    if (confirmed) {
      await saveSettings(defaultTablePrintSettings);
    }
  }, [saveSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    saving,
    updateSetting,
    saveSettings,
    resetToDefaults,
    refetch: fetchSettings
  };
}
