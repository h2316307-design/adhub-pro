import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/hooks/useExpiryContacts',()=>({useExpiryContacts:()=>({phones:new Map([['c1','0912345678']]),template:'عقد {رقم_العقد}',loading:false,error:''})}));
import {ContractExpiryWorkspace} from '@/components/contracts/ContractExpiryWorkspace';
describe('expiry workspace',()=>{
  let host:HTMLDivElement,root:Root;
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
  afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
  it('selects every matching result, including those beyond the first page, without sending',()=>{
    const onMessage=vi.fn();const contracts=Array.from({length:15},(_,i)=>({Contract_Number:i+1,'Customer Name':`زبون ${i+1}`,'End Date':'2026-10-15'}));
    act(()=>root.render(<MemoryRouter><ContractExpiryWorkspace compact contracts={contracts} onMessage={onMessage}/></MemoryRouter>));
    const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(el=>el.textContent?.includes(text))!;
    expect(host.querySelectorAll('article')).toHaveLength(12);act(()=>button('تحديد كل النتائج').click());expect(onMessage).not.toHaveBeenCalled();
    act(()=>button('إرسال للمحدد').click());expect(onMessage.mock.calls[0][0]).toHaveLength(15);
    act(()=>button('عقود منتهية').click());expect(host.textContent).toContain('0 محدد');
  });
  it('lists expiring and expired contracts together with a direct chat link',()=>{
    const contracts=[{Contract_Number:1,customer_id:'c1','Customer Name':'أحمد','End Date':'2026-10-15'},{Contract_Number:2,'Customer Name':'سالم','End Date':'2026-10-01'},{Contract_Number:3,'Customer Name':'قديم','End Date':'2025-01-01'}];
    act(()=>root.render(<MemoryRouter><ContractExpiryWorkspace compact contracts={contracts} onMessage={vi.fn()}/></MemoryRouter>));
    expect(host.querySelectorAll('article')).toHaveLength(2);
    expect(host.textContent).toContain('تنتهي قريبًا');expect(host.textContent).toContain('منتهية (1)');
    expect(host.querySelector('button[aria-label="فتح محادثة واتساب مع أحمد"]')).not.toBeNull();
    expect(Array.from(host.querySelectorAll('button')).some(el=>el.textContent?.includes('بدون رقم'))).toBe(true);
  });
});
