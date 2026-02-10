import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintCustomizationSettings {
  id?: string;
  setting_key: string;
  
  // إعدادات صورة اللوحة الرئيسية
  main_image_top: string;
  main_image_left: string;
  main_image_width: string;
  main_image_height: string;
  
  // إعدادات صور التركيب (وجهين)
  installed_images_top: string;
  installed_images_left: string;
  installed_images_width: string;
  installed_images_gap: string;
  installed_image_height: string;
  
  // إعدادات التصاميم
  designs_top: string;
  designs_left: string;
  designs_width: string;
  designs_gap: string;
  design_image_height: string;
  
  // إعدادات النصوص - اسم اللوحة
  billboard_name_top: string;
  billboard_name_left: string;
  billboard_name_font_size: string;
  billboard_name_font_weight: string;
  billboard_name_color: string;
  billboard_name_alignment: string;
  billboard_name_offset_x: string;
  
  // المقاس
  size_top: string;
  size_left: string;
  size_font_size: string;
  size_font_weight: string;
  size_color: string;
  size_alignment: string;
  size_offset_x: string;
  
  // عدد الأوجه
  faces_count_top: string;
  faces_count_left: string;
  faces_count_font_size: string;
  faces_count_color: string;
  faces_count_alignment: string;
  faces_count_offset_x: string;
  
  // رقم العقد
  contract_number_top: string;
  contract_number_right: string;
  contract_number_font_size: string;
  contract_number_font_weight: string;
  contract_number_color: string;
  contract_number_alignment: string;
  contract_number_offset_x: string;
  
  // تاريخ التركيب
  installation_date_top: string;
  installation_date_right: string;
  installation_date_font_size: string;
  installation_date_font_weight: string;
  installation_date_color: string;
  installation_date_alignment: string;
  installation_date_offset_x: string;
  
  // فريق التركيب
  team_name_top: string;
  team_name_right: string;
  team_name_font_size: string;
  team_name_font_weight: string;
  team_name_color: string;
  team_name_alignment: string;
  team_name_offset_x: string;
  
  // الموقع
  location_info_top: string;
  location_info_left: string;
  location_info_width: string;
  location_info_font_size: string;
  location_info_color: string;
  location_info_alignment: string;
  location_info_offset_x: string;
  
  // أقرب معلم
  landmark_info_top: string;
  landmark_info_left: string;
  landmark_info_width: string;
  landmark_info_font_size: string;
  landmark_info_color: string;
  landmark_info_alignment: string;
  landmark_info_offset_x: string;
  
  // إعدادات QR Code
  qr_top: string;
  qr_left: string;
  qr_size: string;
  
  // إعدادات عامة
  primary_font: string;
  secondary_font: string;
  
  // إعدادات المعاينة
  preview_zoom: string;
  preview_background: string;
}

const defaultSettings: PrintCustomizationSettings = {
  setting_key: 'default',
  
  main_image_top: '90mm',
  main_image_left: '50%',
  main_image_width: '120mm',
  main_image_height: '140mm',
  
  installed_images_top: '88mm',
  installed_images_left: '50%',
  installed_images_width: '180mm',
  installed_images_gap: '5mm',
  installed_image_height: '80mm',
  
  designs_top: '178mm',
  designs_left: '16mm',
  designs_width: '178mm',
  designs_gap: '10mm',
  design_image_height: '42mm',
  
  billboard_name_top: '55.588mm',
  billboard_name_left: '15.5%',
  billboard_name_font_size: '20px',
  billboard_name_font_weight: '500',
  billboard_name_color: '#333',
  billboard_name_alignment: 'center',
  billboard_name_offset_x: '0mm',
  
  size_top: '51mm',
  size_left: '63%',
  size_font_size: '41px',
  size_font_weight: '500',
  size_color: '#000',
  size_alignment: 'center',
  size_offset_x: '0mm',
  
  faces_count_top: '63mm',
  faces_count_left: '64%',
  faces_count_font_size: '12px',
  faces_count_color: '#000',
  faces_count_alignment: 'center',
  faces_count_offset_x: '0mm',
  
  contract_number_top: '39.869mm',
  contract_number_right: '22mm',
  contract_number_font_size: '16px',
  contract_number_font_weight: '500',
  contract_number_color: '#333',
  contract_number_alignment: 'right',
  contract_number_offset_x: '0mm',
  
  installation_date_top: '42.869mm',
  installation_date_right: '116mm',
  installation_date_font_size: '11px',
  installation_date_font_weight: 'normal',
  installation_date_color: '#333',
  installation_date_alignment: 'right',
  installation_date_offset_x: '0mm',
  
  team_name_top: '81mm',
  team_name_right: '72mm',
  team_name_font_size: '14px',
  team_name_font_weight: 'bold',
  team_name_color: '#333',
  team_name_alignment: 'right',
  team_name_offset_x: '0mm',
  
  location_info_top: '233mm',
  location_info_left: '0',
  location_info_width: '150mm',
  location_info_font_size: '16px',
  location_info_color: '#333',
  location_info_alignment: 'left',
  location_info_offset_x: '0mm',
  
  landmark_info_top: '241mm',
  landmark_info_left: '0mm',
  landmark_info_width: '150mm',
  landmark_info_font_size: '16px',
  landmark_info_color: '#333',
  landmark_info_alignment: 'left',
  landmark_info_offset_x: '0mm',
  
  qr_top: '255mm',
  qr_left: '65mm',
  qr_size: '30mm',
  
  primary_font: 'Doran',
  secondary_font: 'Manrope',
  
  preview_zoom: '35%',
  preview_background: '#ffffff',
};

export function usePrintCustomization() {
  const [settings, setSettings] = useState<PrintCustomizationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // جلب الإعدادات من قاعدة البيانات
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboard_print_customization')
        .select('*')
        .eq('setting_key', 'default')
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        setLoading(false);
        return;
      }

      if (data) {
        // دمج البيانات مع الإعدادات الافتراضية للحقول الجديدة
        setSettings({ ...defaultSettings, ...data } as PrintCustomizationSettings);
      }
      // إذا لم توجد بيانات، نستخدم الإعدادات الافتراضية (تم تعيينها بالفعل)
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    }
    setLoading(false);
  }, []);

  // حفظ الإعدادات في قاعدة البيانات
  const saveSettings = useCallback(async (newSettings: Partial<PrintCustomizationSettings>) => {
    try {
      setSaving(true);
      const updatedSettings = { ...settings, ...newSettings };
      
      const { error } = await supabase
        .from('billboard_print_customization')
        .upsert({
          ...updatedSettings,
          setting_key: 'default',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error('Error saving settings:', error);
        toast.error('فشل حفظ الإعدادات');
        return false;
      }

      setSettings(updatedSettings);
      toast.success('تم حفظ الإعدادات بنجاح');
      return true;
    } catch (error) {
      console.error('Error in saveSettings:', error);
      toast.error('خطأ في حفظ الإعدادات');
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // تحديث إعداد واحد محلياً
  const updateSetting = useCallback((key: keyof PrintCustomizationSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // إعادة الإعدادات للوضع الافتراضي
  const resetToDefaults = useCallback(async () => {
    const confirmed = window.confirm('هل تريد إعادة جميع الإعدادات للوضع الافتراضي؟');
    if (confirmed) {
      await saveSettings(defaultSettings);
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

export { defaultSettings };
