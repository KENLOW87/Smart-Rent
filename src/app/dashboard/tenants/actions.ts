'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { phoneToEmail, phoneToPassword } from '@/lib/tenant-auth';

export async function createTenant(formData: FormData) {
  const supabase = await createClient();

  const property_id = String(formData.get('property_id'));
  const full_name = String(formData.get('full_name'));
  const phone = String(formData.get('phone') || '').trim();
  const move_in_date = String(formData.get('move_in_date') || '') || null;

  let profile_id: string | null = null;

  // Phone is the tenant's login. Password is derived from the phone number,
  // so the tenant only needs to remember their own phone.
  if (phone) {
    const admin = createAdminClient();
    const email = phoneToEmail(phone);
    const password = phoneToPassword(phone);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (createErr) {
      if (createErr.message.toLowerCase().includes('already')) {
        throw new Error('This phone number is already registered.');
      }
      throw createErr;
    }
    profile_id = created.user?.id ?? null;

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
    .update({ active: false, move_out_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/tenants');
}
