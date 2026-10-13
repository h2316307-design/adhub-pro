import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_PRICING_CATEGORY_KEY = 'default_pricing_category';
export function useDefaultPricingCategory() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [DEFAULT_PRICING_CATEGORY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('setting_value').eq('setting_key', DEFAULT_PRICING_CATEGORY_KEY).maybeSingle();
      if (error) throw error;
      return data?.setting_value?.trim() || 'عادي';
    },
  });
  const save = useMutation({
    mutationFn: async (category: string) => {
      if (!category.trim()) throw new Error('اختر الفئة الافتراضية');
      const { error } = await supabase.from('system_settings').upsert({ setting_key: DEFAULT_PRICING_CATEGORY_KEY, setting_value: category.trim() }, { onConflict: 'setting_key' });
      if (error) throw error;
      return category.trim();
    },
    onSuccess: category => client.setQueryData([DEFAULT_PRICING_CATEGORY_KEY], category),
  });
  return { category: query.data || 'عادي', loaded: query.isSuccess, error: query.error, save };
}
