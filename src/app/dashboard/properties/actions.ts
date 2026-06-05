'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { phoneToEmail, phoneToPassword } from '@/lib/tenant-auth';

// Create a phone-based tenant login and link it to a property.
async function createTenantForProperty(propertyId: string, fullName: string, phone: string) {
  const admin = createAdminClient();
  const email = phoneToEmail(phone);
  const password = phoneToPassword(phone);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (createErr) {
    if (createErr.message.toLowerCase().includes('already')) {
      throw new Error(`Phone ${phone} is already registered to a tenant.`);
    }
    throw createErr;
  }
  const profileId = created.user?.id ?? null;
  if (profileId) {
    await admin.from('profiles')
      .update({ full_name: fullName, phone, role: 'tenant' })
      .eq('id', profileId);
  }
  await admin.from('tenants').insert({
    property_id: propertyId,
    profile_id: profileId,
    full_name: fullName,
    phone,
    email: null,
    active: true,
  });
}

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: property, error } = await supabase.from('properties').insert({
    owner_id: user.id,
    name: String(formData.get('name')),
    rental_amount: Number(formData.get('rental_amount')),
    due_day_of_month: Number(formData.get('due_day_of_month')),
    notes: String(formData.get('notes') || '') || null,
  }).select('id').single();
  if (error) throw error;

  const tenantName = String(formData.get('tenant_name') || '').trim();
  const tenantPhone = String(formData.get('tenant_phone') || '').trim();
  if (property && tenantName && tenantPhone) {
    await createTenantForProperty(property.id, tenantName, tenantPhone);
  }

  revalidatePath('/dashboard/properties');
  revalidatePath('/dashboard');
}

export async function addTenantToProperty(propertyId: string, formData: FormData) {
  const tenantName = String(formData.get('tenant_name') || '').trim();
  const tenantPhone = String(formData.get('tenant_phone') || '').trim();
  if (!tenantName || !tenantPhone) throw new Error('Tenant name and phone are required');
  await createTenantForProperty(propertyId, tenantName, tenantPhone);
  revalidatePath('/dashboard/properties');
  revalidatePath('/dashboard');
}

export async function moveOutTenant(tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('tenants')
    .update({ active: false, move_out_date: new Date().toISOString().slice(0, 10) })
    .eq('id', tenantId);
  if (error) throw error;
  revalidatePath('/dashboard/properties');
  revalidatePath('/dashboard');
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/properties');
  revalidatePath('/dashboard');
}

export async function setPropertyAgents(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const agentIds = formData.getAll('agent_id').map(String).filter(Boolean);

  await supabase.from('property_agents').delete().eq('property_id', propertyId);
  if (agentIds.length) {
    const rows = agentIds.map((agent_id) => ({ property_id: propertyId, agent_id }));
    const { error } = await supabase.from('property_agents').insert(rows);
    if (error) throw error;
  }
  revalidatePath('/dashboard/properties');
}
