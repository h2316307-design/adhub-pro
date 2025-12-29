import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SiteThemeSettings {
  id?: string;
  setting_key: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  border_color: string;
  accent_color: string;
  muted_color: string;
}

const defaultTheme: SiteThemeSettings = {
  setting_key: 'default',
  primary_color: '#8B5CF6',
  secondary_color: '#0EA5E9',
  background_color: '#FFFFFF',
  text_color: '#1A1F2C',
  border_color: '#E2E8F0',
  accent_color: '#D946EF',
  muted_color: '#F1F5F9',
};

// تحويل HEX إلى HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// تطبيق CSS Variables
function applyThemeVariables(theme: SiteThemeSettings) {
  const root = document.documentElement;
  
  const primary = hexToHsl(theme.primary_color);
  const secondary = hexToHsl(theme.secondary_color);
  const accent = hexToHsl(theme.accent_color);
  const muted = hexToHsl(theme.muted_color);
  const background = hexToHsl(theme.background_color);
  const text = hexToHsl(theme.text_color);
  const border = hexToHsl(theme.border_color);

  // تطبيق المتغيرات (يمكن توسيعها لاحقاً)
  root.style.setProperty('--theme-primary', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--theme-secondary', `${secondary.h} ${secondary.s}% ${secondary.l}%`);
  root.style.setProperty('--theme-accent', `${accent.h} ${accent.s}% ${accent.l}%`);
  root.style.setProperty('--theme-muted', `${muted.h} ${muted.s}% ${muted.l}%`);
  root.style.setProperty('--theme-background', `${background.h} ${background.s}% ${background.l}%`);
  root.style.setProperty('--theme-foreground', `${text.h} ${text.s}% ${text.l}%`);
  root.style.setProperty('--theme-border', `${border.h} ${border.s}% ${border.l}%`);
}

export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteThemeSettings>(defaultTheme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // جلب الإعدادات من قاعدة البيانات
  const fetchTheme = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_theme_settings')
        .select('*')
        .eq('setting_key', 'default')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No theme settings found, using defaults');
        } else {
          console.error('Error fetching theme:', error);
        }
        return;
      }

      if (data) {
        const loadedTheme = { ...defaultTheme, ...data } as SiteThemeSettings;
        setTheme(loadedTheme);
        applyThemeVariables(loadedTheme);
      }
    } catch (error) {
      console.error('Error in fetchTheme:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // حفظ الإعدادات في قاعدة البيانات
  const saveTheme = useCallback(async (newTheme: Partial<SiteThemeSettings>) => {
    try {
      setSaving(true);
      const updatedTheme = { ...theme, ...newTheme };
      
      const { error } = await supabase
        .from('site_theme_settings')
        .upsert({
          ...updatedTheme,
          setting_key: 'default',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error('Error saving theme:', error);
        toast.error('فشل حفظ إعدادات السمة');
        return false;
      }

      setTheme(updatedTheme);
      applyThemeVariables(updatedTheme);
      toast.success('تم حفظ إعدادات السمة بنجاح');
      return true;
    } catch (error) {
      console.error('Error in saveTheme:', error);
      toast.error('خطأ في حفظ إعدادات السمة');
      return false;
    } finally {
      setSaving(false);
    }
  }, [theme]);

  // تحديث إعداد واحد محلياً
  const updateThemeSetting = useCallback((key: keyof SiteThemeSettings, value: string) => {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
    applyThemeVariables(newTheme);
  }, [theme]);

  // إعادة الإعدادات للوضع الافتراضي
  const resetToDefaults = useCallback(async () => {
    const confirmed = window.confirm('هل تريد إعادة ألوان السمة للوضع الافتراضي؟');
    if (confirmed) {
      await saveTheme(defaultTheme);
    }
  }, [saveTheme]);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  return {
    theme,
    loading,
    saving,
    updateThemeSetting,
    saveTheme,
    resetToDefaults,
    refetch: fetchTheme
  };
}

export { defaultTheme };
