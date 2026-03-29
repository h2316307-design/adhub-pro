// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

/**
 * Helper to update billboard_ids in the Contract table.
 * Handles adding/removing a billboard ID from the comma-separated string.
 */

// Remove a billboard ID from a contract's billboard_ids
export const removeBillboardIdFromContract = async (contractNumber: number, billboardId: number) => {
  const { data, error } = await supabase
    .from('Contract')
    .select('billboard_ids')
    .eq('Contract_Number', contractNumber)
    .single();

  if (error || !data) {
    console.warn('⚠️ Could not fetch contract for billboard_ids sync:', error);
    return;
  }

  const currentIds = data.billboard_ids
    ? data.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  const updatedIds = currentIds.filter((id: string) => String(id) !== String(billboardId));

  const { error: updateError } = await supabase
    .from('Contract')
    .update({ billboard_ids: updatedIds.length > 0 ? updatedIds.join(',') : null })
    .eq('Contract_Number', contractNumber);

  if (updateError) {
    console.error('❌ Error removing billboard from contract billboard_ids:', updateError);
    throw updateError;
  }

  console.log(`✅ Removed billboard ${billboardId} from contract ${contractNumber} billboard_ids`);
};

// Add a billboard ID to a contract's billboard_ids
export const addBillboardIdToContract = async (contractNumber: number, billboardId: number) => {
  const { data, error } = await supabase
    .from('Contract')
    .select('billboard_ids')
    .eq('Contract_Number', contractNumber)
    .single();

  if (error || !data) {
    console.warn('⚠️ Could not fetch contract for billboard_ids sync:', error);
    return;
  }

  const currentIds = data.billboard_ids
    ? data.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  // Don't add duplicates
  if (!currentIds.includes(String(billboardId))) {
    currentIds.push(String(billboardId));
  }

  const { error: updateError } = await supabase
    .from('Contract')
    .update({ billboard_ids: currentIds.join(',') })
    .eq('Contract_Number', contractNumber);

  if (updateError) {
    console.error('❌ Error adding billboard to contract billboard_ids:', updateError);
    throw updateError;
  }

  console.log(`✅ Added billboard ${billboardId} to contract ${contractNumber} billboard_ids`);
};
