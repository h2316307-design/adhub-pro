import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PricingRulesEditor } from '../components/pricing/PricingRulesEditor';
import { defaultPricingRules } from '../utils/pricingRules';

it('keeps display saving separate from applying prices and reports unsaved edits', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const onSave = vi.fn(), onSaveDisplay = vi.fn(), onChange = vi.fn();
  const rules = { ...defaultPricingRules, hiddenPrintLevels: ['B'] };
  try {
    act(() => root.render(<PricingRulesEditor value={rules} savedValue={defaultPricingRules} onChange={onChange} levels={['A', 'B', 'C']} sizes={['large', 'small']} onSave={onSave} onSaveDisplay={onSaveDisplay} busy={false} />));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('لم تُحفظ');
    const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
    act(() => button('ظهور النسب بالطباعة').click());
    expect(host.textContent).toContain('مخفي من بيان النسب');
    act(() => button('حفظ ظهور النسب وموضعها').click());
    expect(onSaveDisplay).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    const hidden = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.closest('label')?.textContent?.includes('المستوى B'))!;
    act(() => hidden.click());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hiddenPrintLevels: [] }));
  } finally { act(() => root.unmount()); host.remove(); }
});
