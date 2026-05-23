'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const FAKE_DOMAIN = 'smartrent.local';

function phoneToEmail(phone: string) {
  // Strip spaces, dashes, plus sign — keep digits and letters
  const clean = phone.replace(/[^a-zA-Z0-9]/g, '');
  return `${clean.toLowerCase()}@${FAKE_DOMAIN}`;
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient();

  const property_id = String(formData.get('property_id'));
  const full_name = String(formData.get('full_name'));
  const phone = String(formData.get('phone') || '').trim();
  const password = String(formData.get('password') || '').trim();
  const move_in_date = String(formData.get('move_in_date') || '') || null;

  let profile_id: string | null = null;

  // If owner provided phone + password, create a login for the tenant
  if (phone && password) {
    const admin = createAdminClient();
    const email = phoneToEmail(phone);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (createErr) throw createErr;
    profile_id = created.user?.id ?? null;

    // The trigger created a profile row with role=tenant. Set name + phone.
    if (profile_id) {
      await admin.from('profiles')
        .update({ full_name, phone, role: 'tenant' })
        .eq('id', profile_id);
    }
  }

  const { error } = await supabase.from('tenants').insert({
    property_id,
    profile_id,
    full_name,
    phone: phone || null,
    email: null,
    move_in_date,
    active: true,
  });
  if (error) throw error;
  revalidatePath('/dashboard/tenants');
}

export async function deactivateTenant(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('tenants')
    .update({ active: false, move_out_date: new Date().toISOString().slice(0,10) })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/tenants');
}

export async function resetTenantPassword(profileId: string, formData: FormData) {
  const admin = createAdminClient();
  const newPassword = String(formData.get('password') || '').trim();
  if (!newPassword) throw new Error('Password required');
  const { error } = await admin.auth.admin.updateUserById(profileId, { password: newPassword });
  if (error) throw error;
  revalidatePath('/dashboard/tenants');
}
