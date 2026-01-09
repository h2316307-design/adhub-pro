import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// تعريف العمود
export interface TableColumn {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
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
}

// الأعمدة الافتراضية مع ترتيبها
export const defaultColumns: TableColumn[] = [
  { id: 'row_number', label: '#', enabled: true, order: 0 },
  { id: 'billboard_image', label: 'صورة اللوحة', enabled: true, order: 1 },
  { id: 'billboard_name', label: 'اسم اللوحة', enabled: true, order: 2 },
  { id: 'size', label: 'المقاس', enabled: true, order: 3 },
  { id: 'faces_count', label: 'الأوجه', enabled: true, order: 4 },
  { id: 'location', label: 'الموقع', enabled: true, order: 5 },
  { id: 'landmark', label: 'أقرب معلم', enabled: true, order: 6 },
  { id: 'contract_number', label: 'العقد', enabled: true, order: 7 },
  { id: 'installation_date', label: 'تاريخ التركيب', enabled: true, order: 8 },
  { id: 'design_images', label: 'التصميم', enabled: true, order: 9 },
  { id: 'installed_images', label: 'صور التركيب', enabled: true, order: 10 },
  { id: 'qr_code', label: 'QR', enabled: true, order: 11 },
];

export const defaultTablePrintSettings: TablePrintSettings = {
  setting_key: 'table_print_default',
  
  header_bg_color: '#1e3a5f',
  header_text_color: '#ffffff',
  row_bg_color: '#ffffff',
  row_alt_bg_color: '#f8fafc',
  row_text_color: '#1f2937',
  border_color: '#d1d5db',
  
  first_column_bg_color: '#1e3a5f',
  first_column_text_color: '#ffffff',
  
  header_font_size: '11px',
  row_font_size: '10px',
  title_font_size: '16px',
  
  billboard_image_size: '50px',
  design_image_size: '40px',
  installed_image_size: '40px',
  
  show_qr_code: true,
  auto_hide_empty_columns: true,
  
  columns_order: defaultColumns,
  
  page_title: 'جدول لوحات العقد',
  rows_per_page: 10,
  page_orientation: 'portrait',
  page_margin: '8mm',
  
  primary_font: 'Doran',
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

  const saveSettings = useCallback(async (newSettings: Partial<TablePrintSettings>) => {
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      const payload = JSON.parse(JSON.stringify(updatedSettings));

      // تحقق أولاً إذا كان السجل موجوداً
      const { data: existing, error: existingError } = await supabase
        .from('billboard_print_settings')
        .select('id')
        .eq('setting_key', 'table_print_default')
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing settings:', existingError);
        toast.error('تعذر التحقق من إعدادات الجدول');
        setSaving(false);
        return false;
      }

      if (existing) {
        const { error } = await supabase
          .from('billboard_print_settings')
          .update({
            elements: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'table_print_default');

        if (error) {
          console.error('Error saving settings (update):', error);
          toast.error('فشل حفظ الإعدادات');
          setSaving(false);
          return false;
        }
      } else {
        const { error } = await supabase
          .from('billboard_print_settings')
          .insert({
            setting_key: 'table_print_default',
            elements: payload,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error saving settings (insert):', error);
          toast.error('فشل حفظ الإعدادات');
          setSaving(false);
          return false;
        }
      }

      setSettings(updatedSettings);
      toast.success('تم حفظ إعدادات الجدول بنجاح');
      setSaving(false);
      return true;
    } catch (error) {
      console.error('Error in saveSettings:', error);
      toast.error('خطأ في حفظ الإعدادات');
      setSaving(false);
      return false;
    }
  }, [settings]);

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
