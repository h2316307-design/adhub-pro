import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { upsert, from, errorToast } = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn(), errorToast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: errorToast } }));
import { OperationOrderDialog } from '@/components/composite-tasks/list/OperationOrderDialog';

describe('saving the operation presentation order', () => {
  let root: Root;
  let host: HTMLDivElement;
  const group = { key: 'contract-1293', contractId: 1293, operations: [
    { key: 'new', label: 'إعادة تركيب 1', createdAt: '2026-10-01', tasks: [{ id: 'new-task', teamName: 'الفرقة الجديدة', customer_total: 200 }] },
    { key: 'old', label: 'التركيب الأول', createdAt: '2026-09-01', tasks: [{ id: 'old-task', teamName: 'الفرقة الأولى', customer_total: 100 }] },
  ] };
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: null });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => root.render(<QueryClientProvider client={client}><OperationOrderDialog group={group} /></QueryClientProvider>));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  async function click(text: string) {
    const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === text);
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
  }
  it('puts the new operation first and writes only a display setting', async () => {
    await click('ترتيب العمليات');
    const first = document.querySelector('[aria-label="جعل العملية 2 الأولى"]') as HTMLButtonElement;
    await act(async () => first.click());
    await click('حفظ الترتيب');
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('system_settings');
    expect(upsert).toHaveBeenCalledWith({ setting_key: 'composite_operation_order:contract-1293', setting_value: '["new","old"]' }, { onConflict: 'setting_key' });
    expect(group.operations[0].tasks[0].customer_total).toBe(200);
    expect(group.operations[1].tasks[0].customer_total).toBe(100);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('keeps the dialog open and reports a rejected save', async () => {
    upsert.mockResolvedValue({ error: { message: 'تعذر الحفظ' } });
    await click('ترتيب العمليات');
    await click('حفظ الترتيب');
    expect(errorToast).toHaveBeenCalledWith('تعذر الحفظ');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
