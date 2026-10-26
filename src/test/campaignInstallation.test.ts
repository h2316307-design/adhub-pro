import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({ rows:{} as Record<string,any[]>, create:vi.fn() }));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
  const q:any={ select:()=>q,in:()=>q,or:()=>q,order:()=>q,range:()=>q,
    then:(resolve:any)=>Promise.resolve({data:state.rows[table] || [],error:null}).then(resolve) }; return q;
}}}));
vi.mock('@/services/installationOperationCreate',()=>({ createInstallationOperation:state.create }));
import { createCampaignInstallation } from '@/services/campaignInstallation';
beforeEach(()=>{
  state.create.mockReset().mockResolvedValue({taskIds:['created']});
  state.rows={
    Contract:[{Contract_Number:1,billboard_ids:'10',installation_enabled:true,print_cost_enabled:'true'}, {Contract_Number:2,billboard_ids:'20',installation_enabled:true,print_cost_enabled:'true'}],
    billboards:[{ID:10,Faces_Count:2},{ID:20,Faces_Count:2}],
    installation_tasks:[{id:'old',contract_id:1,status:'completed'}],
    installation_task_items:[{task_id:'old',billboard_id:10,status:'completed',selected_faces:[1]}],
  };
});
describe('campaign construction',()=>{
  it('creates two sections across contracts, with distinct face selections',async()=>{
    await createCampaignInstallation({contractIds:[1,2],billboardIds:[10,20],teamAssignments:[],taskType:'installation',taskName:'حملة أكتوبر'});
    const calls=state.create.mock.calls.map(c=>c[0]);
    expect(calls.slice(0,2).every(c=>c.validateOnly)).toBe(true);
    const actual=calls.filter(c=>!c.validateOnly);
    expect(actual).toHaveLength(2);
    expect(actual[0].contractIds).toEqual([1,2]);
    expect(actual[0].faceSelections).toEqual({10:[2],20:[1,2]});
    expect(actual[0].taskName).toContain('بدون تكلفة إضافية');
    expect(actual[1].faceSelections).toEqual({10:[1]});
    expect(actual[1].taskType).toBe('reinstallation');
  });
  it('rejects ambiguous board ownership before writing any task',async()=>{
    state.rows.Contract[1].billboard_ids='10,20';
    await expect(createCampaignInstallation({contractIds:[1,2],billboardIds:[10,20],teamAssignments:[],taskType:'installation'})).rejects.toThrow('تحديد عقد واحد');
    expect(state.create).not.toHaveBeenCalled();
  });
  it('validates every section before any write',async()=>{
    state.create.mockResolvedValueOnce({taskIds:[]}).mockRejectedValueOnce(new Error('لا توجد فرقة'));
    await expect(createCampaignInstallation({contractIds:[1,2],billboardIds:[10,20],teamAssignments:[],taskType:'installation'})).rejects.toThrow('لا توجد فرقة');
    expect(state.create.mock.calls.every(c=>c[0].validateOnly)).toBe(true);
  });
});
