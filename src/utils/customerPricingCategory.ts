import { supabase } from '@/integrations/supabase/client';

/**
 * الفئة السعرية التي تُطبَّق تلقائياً عند اختيار زبون في العقد أو العرض:
 * آخر فئة استُخدمت له (الأحدث بين آخر عقد وآخر عرض)، ثم فئة بطاقة الزبون إن لم يكن له تاريخ.
 */
export async function fetchCustomerPricingCategory(customerId?: string | null, customerName?: string | null): Promise<string | null> {
  const name = (customerName || '').replace(/[,()"']/g, ' ').trim();
  if (!customerId && !name) return null;

  const lastContract = async () => {
    const base = () => supabase.from('Contract')
      .select('customer_category, "Contract Date", Contract_Number')
      .not('customer_category', 'is', null)
      .order('Contract_Number', { ascending: false })
      .limit(1);
    let row: any = null;
    if (customerId) row = (await base().eq('customer_id', customerId).maybeSingle()).data;
    if (!row && name) row = (await base().ilike('Customer Name', name).maybeSingle()).data;
    return row ? { category: String(row.customer_category), date: String(row['Contract Date'] || '') } : null;
  };

  const lastOffer = async () => {
    const base = () => supabase.from('offers')
      .select('pricing_category, created_at')
      .not('pricing_category', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    let row: any = null;
    if (customerId) row = (await base().eq('customer_id', customerId).maybeSingle()).data;
    if (!row && name) row = (await base().ilike('customer_name', name).maybeSingle()).data;
    return row ? { category: String(row.pricing_category), date: String(row.created_at || '').slice(0, 10) } : null;
  };

  const [contract, offer] = await Promise.all([lastContract(), lastOffer()]);
  const latest = contract && offer ? (offer.date > contract.date ? offer : contract) : contract || offer;
  if (latest?.category.trim()) return latest.category.trim();

  if (customerId) {
    const { data } = await supabase.from('customers').select('pricing_category').eq('id', customerId).maybeSingle();
    if (data?.pricing_category) return String(data.pricing_category).trim();
  }
  return null;
}
