import {describe,it,expect} from 'vitest';
import {expiryContracts,expiryRecipients,expiryMessage,tripoliDate} from '@/lib/contractExpiry';
const raw=(number:number,end:string,customer='a')=>({Contract_Number:number,'Customer Name':'زبون','End Date':end,'Contract Date':'2026-01-01',customer_id:customer,Phone:'0912345678',billboard_ids:'1,2'});
describe('contract expiry dates and recipients',()=>{
  it('uses Libya calendar day even before midnight UTC',()=>{expect(tripoliDate(new Date('2026-10-10T22:30:00Z'))).toBe('2026-10-11');});
  it('keeps today separate from expired and future contracts',()=>{
    const rows=expiryContracts([raw(1,'2026-10-10'),raw(2,'2026-10-11'),raw(3,'2026-10-12')],'2026-10-11');
    expect(rows.map(row=>row.days)).toEqual([-1,0,1]);expect(rows[0].count).toBe(2);
  });
  it('excludes missing or invalid dates and deduplicates contract numbers without truncating to ten',()=>{
    const rows=expiryContracts([...Array.from({length:15},(_,i)=>raw(i+1,'2026-10-20')),raw(1,'2026-10-20'),raw(20,''),raw(21,'2026-02-30')],'2026-10-11');expect(rows).toHaveLength(15);
  });
  it('groups contracts of the same customer and prefers the registered customer phone',()=>{
    const rows=expiryContracts([raw(1,'2026-10-10'),raw(2,'2026-10-20')],'2026-10-11');
    const recipients=expiryRecipients(rows,'عقد {رقم_العقد}: {حالة_العقد}',new Map([['a','0922345678']]));
    expect(recipients).toHaveLength(1);expect(recipients[0].phone).toBe('0922345678');expect(recipients[0].message).toContain('عقد 1');expect(recipients[0].message).toContain('عقد 2');
  });
  it('does not combine unrelated customer data just because they share a phone or name',()=>{
    const rows=expiryContracts([raw(1,'2026-10-10',''),raw(2,'2026-10-20','')],'2026-10-11');
    expect(expiryRecipients(rows,'{رقم_العقد}',new Map())).toHaveLength(2);
  });
  it('describes today as expiring today in the saved template',()=>{
    const [row]=expiryContracts([raw(1,'2026-10-11')],'2026-10-11');
    expect(expiryMessage(row,'{حالة_العقد}')).toBe('ينتهي اليوم');
  });
});
