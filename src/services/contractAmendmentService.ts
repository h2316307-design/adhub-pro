import { supabase } from '@/integrations/supabase/client';
import type { AmendmentStatus, ContractAmendment } from '@/utils/contractAmendments';

type AmendmentClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function getContractAmendmentStatus(contractNumber: number): Promise<AmendmentStatus> {
  const { data, error } = await (supabase as unknown as AmendmentClient).rpc('contract_amendment_status', { p_contract_number: contractNumber });
  if (error) throw new Error(error.message);
  return data as AmendmentStatus;
}

export async function listContractAmendments(contractNumber: number): Promise<ContractAmendment[]> {
  const { data, error } = await supabase.from('contract_amendments' as never)
    .select('id,contract_number,amendment_number,created_at,changes,total_before,total_after,currency:snapshot->>contract_currency')
    .eq('contract_number', contractNumber).order('amendment_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as ContractAmendment[];
}

export async function loadContractAmendmentDocument(id: string, history: ContractAmendment[]): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('contract_amendments' as never).select('snapshot,amendment_number').eq('id', id).single();
  if (error) throw new Error(error.message);
  const row = data as unknown as { snapshot: Record<string, unknown>; amendment_number: number };
  return { ...row.snapshot, _amendment_number: row.amendment_number,
    _amendment_history: history.filter(item => item.amendment_number > 0 && (row.amendment_number === 0 || item.amendment_number <= row.amendment_number)) };
}
