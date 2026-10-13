import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { from, upsert, maybeSingle } = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { useDefaultPricingCategory } from '@/hooks/useDefaultPricingCategory';

describe('default pricing category setting', () => {
  let root: Root, host: HTMLDivElement;
  let value: ReturnType<typeof useDefaultPricingCategory>;
  function Probe() { value = useDefaultPricingCategory(); return <span>{value.category}</span>; }
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { setting_value: 'مسوق' }, error: null });
    upsert.mockResolvedValue({ error: null });
    const query: any = { select: () => query, eq: () => query, maybeSingle, upsert };
    from.mockReturnValue(query);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  async function loaded() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
  it('loads the shared default and updates it only after a confirmed save', async () => {
    await loaded(); expect(value!.category).toBe('مسوق');
    await act(async () => { await value!.save.mutateAsync('شركات'); });
    await loaded();
    expect(upsert).toHaveBeenCalledWith({ setting_key: 'default_pricing_category', setting_value: 'شركات' }, { onConflict: 'setting_key' });
    expect(value!.category).toBe('شركات');
  });
  it('retains the old default when database saving fails', async () => {
    await loaded(); upsert.mockResolvedValue({ error: new Error('Save failed') });
    await act(async () => { await expect(value!.save.mutateAsync('شركات')).rejects.toThrow('Save failed'); });
    expect(value!.category).toBe('مسوق');
  });
});
