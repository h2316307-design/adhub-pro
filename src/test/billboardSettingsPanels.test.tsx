import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { BillboardSettingsPanels } from '@/components/billboards/forms/BillboardSettingsPanels';
import { FaceDimensionsEditor } from '@/components/billboards/forms/FaceDimensionsEditor';

let cleanup = () => {};
afterEach(() => cleanup());

describe('billboard settings layout', () => {
  it('shows every settings section together and keeps face dimensions independent', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    cleanup = () => { act(() => root.unmount()); host.remove(); };
    function Form() {
      const [form, setForm] = useState({ Size: '8x3', Faces_Count: 2, face_dimensions: [] });
      return <BillboardSettingsPanels details={<div>بيانات اللوحة</div>} specifications={<FaceDimensionsEditor form={form} setForm={setForm} />} image={<div>صورة اللوحة</div>} ownership={<div>بيانات الملكية</div>} />;
    }
    await act(async () => root.render(<Form />));
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toContain('بيانات اللوحة');
    expect(host.textContent).toContain('بيانات الملكية');
    expect(host.textContent).toContain('صورة اللوحة');
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="مقاس مختلف للوجه 2"]')!;
    expect(toggle).not.toBeNull();
    await act(async () => toggle.click());
    expect(host.querySelector<HTMLInputElement>('[aria-label="عرض الوجه 2"]')?.value).toBe('8');
    expect(host.querySelector<HTMLInputElement>('[aria-label="ارتفاع الوجه 2"]')?.value).toBe('3');
    expect(host.querySelector('[aria-label="مقاس مختلف للوجه 1"]')?.getAttribute('data-state')).toBe('unchecked');
  });
});
