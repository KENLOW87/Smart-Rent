'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('properties').insert({
    owner_id: user.id,
    name: String(formData.get('name')),
    address: String(formData.get('address') || ''),
    rental_amount: Number(formData.get('rental_amount')),
    due_day_of_month: Number(formData.get('due_day_of_month')),
    bank_name: String(formData.get('bank_name') || '') || null,
    bank_account: String(formData.get('bank_account') || '') || null,
    account_holder: String(formData.get('account_holder') || '') || null,
    notes: String(formData.get('notes') || '') || null,
  });
  if (error) throw error;
  revalidatePath('/dashboard/properties');
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('properties').update({
    name: String(formData.get('name')),
    address: String(formData.get('address') || ''),
    rental_amount: Number(formData.get('rental_amount')),
    due_day_of_month: Number(formData.get('due_day_of_month')),
    bank_name: String(formData.get('bank_name') || '') || null,
    bank_account: String(formData.get('bank_account') || '') || null,
    account_holder: String(formData.get('account_holder') || '') || null,
    notes: String(formData.get('notes') || '') || null,
  }).eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/properties');
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/properties');
}

export async function setPropertyAgents(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const agentIds = formData.getAll('agent_id').map(String).filter(Boolean);

  // Wipe and replace assignments for this property
  await supabase.from('property_agents').delete().eq('property_id', propertyId);
  if (agentIds.length) {
    const rows = agentIds.map((agent_id) => ({ property_id: propertyId, agent_id }));
    const { error } = await supabase.from('property_agents').insert(rows);
    if (error) throw error;
  }
  revalidatePath('/dashboard/properties');
}
