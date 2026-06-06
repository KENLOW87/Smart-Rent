'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { phoneToEmail, phoneToPassword } from '@/lib/tenant-auth';

// Create a phone-based tenant login and link it to a property.
// Idempotent: if the phone was already registered (e.g. a half-finished earlier
// attempt), reuse that login instead of crashing.
async function createTenantForProperty(propertyId: string, fullName: string, phone: string) {
  const admin = createAdminClient();
  const email = phoneToEmail(phone);
  const password = phoneToPassword(phone);

  let profileId: string | null = null;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });

  if (createErr) {
    // Most likely "already registered" — find the existing profile by phone and reuse it.
    const { data: existing } = await admin
      .from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (existing?.id) {
      profileId = existing.id;
    } else {
      throw new Error(`Could not create tenant login: ${createErr.message}`);
    }
  } else {
    profileId = created.user?.id ?? null;
  }
  if (!profileId) throw new Error('Could not determine the tenant login.');

  // Ensure the profile reflects this tenant.
  await admin.from('profiles')
    .update({ full_name: fullName, phone, role: 'tenant' })
    .eq('id', profileId);

  // Avoid a duplicate active tenant for the same property.
  const { data: existingTenant } = await admin
    .from('tenants').select('id')
    .eq('profile_id', profileId).eq('property_id', propertyId).eq('active', true)
    .maybeSingle();
  if (existingTenant) return;

  const { error: insErr } = await admin.from('tenants').insert({
    property_id: propertyId,
    profile_id: profileId,
    full_name: fullName,
    phone,
    email: null,
    active: true,
  });
  if (insErr) throw new Error(`Could not save tenant: ${insErr.message}`);
}

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: property, error } = await supabase.from('properties').insert({
    owner_id: String(formData.get('owner_id') || '') || user.id,
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

export async function setPropertyOwner(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const owner_id = String(formData.get('owner_id') || '');
  if (!owner_id) throw new Error('Owner required');
  const { error } = await supabase.from('properties').update({ owner_id }).eq('id', propertyId);
  if (error) throw error;
  revalidatePath('/dashboard/properties');
  revalidatePath('/dashboard');
}

export async function editProperty(
  propertyId: string,
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const name = String(formData.get('name') || '').trim();
    const rent = Number(formData.get('rental_amount'));
    const dueDay = Number(formData.get('due_day_of_month'));
    if (!name) return { error: 'Property name is required.' };

    const { error } = await supabase.from('properties')
      .update({ name, rental_amount: rent, due_day_of_month: dueDay })
      .eq('id', propertyId);
    if (error) return { error: error.message };

    // Keep unpaid bills in sync with the new rent (paid months are left as-is).
    const admin = createAdminClient();
    await admin.from('payments')
      .update({ amount_due: rent })
      .eq('property_id', propertyId)
      .neq('status', 'paid');

    revalidatePath('/dashboard/properties');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/payments');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save changes.' };
  }
}

// Edit a tenant's name / phone. Changing the phone also updates their login.
export async function editTenant(
  tenantId: string,
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const fullName = String(formData.get('tenant_name') || '').trim();
    const phone = String(formData.get('tenant_phone') || '').trim();
    if (!fullName || !phone) return { error: 'Tenant name and phone are required.' };

    const { data: t } = await admin.from('tenants')
      .select('id, profile_id, phone').eq('id', tenantId).single();
    if (!t) return { error: 'Tenant not found.' };

    await admin.from('tenants').update({ full_name: fullName, phone }).eq('id', tenantId);

    if (t.profile_id) {
      await admin.from('profiles').update({ full_name: fullName, phone }).eq('id', t.profile_id);
      if (phone !== t.phone) {
        await admin.auth.admin.updateUserById(t.profile_id, {
          email: phoneToEmail(phone),
          password: phoneToPassword(phone),
          email_confirm: true,
        });
      }
    }
    revalidatePath('/dashboard/properties');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save tenant.' };
  }
}
