'use server';

import { createAdminClient } from '@/lib/supabase/admin';

const FAKE_DOMAIN = 'smartrent.local';

function phoneToEmail(phone: string) {
  const clean = phone.replace(/[^a-zA-Z0-9]/g, '');
  return `${clean.toLowerCase()}@${FAKE_DOMAIN}`;
}

export async function signupWithInvite(input: {
  phone: string; password: string; full_name: string; invite_code: string;
}) {
  if (!input.phone || !input.password || !input.full_name || !input.invite_code) {
    throw new Error('All fields required');
  }
  if (input.password.length < 6) throw new Error('Password must be at least 6 characters');

  const admin = createAdminClient();

  // 1. Look up property by invite code
  const { data: lookup, error: lookupErr } = await admin
    .rpc('find_property_by_invite', { code: input.invite_code });
  if (lookupErr) throw lookupErr;
  const property = Array.isArray(lookup) ? lookup[0] : null;
  if (!property) throw new Error('Invite code not recognized. Check with your landlord.');

  const email = phoneToEmail(input.phone);

  // 2. Create the auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, phone: input.phone },
  });
  if (createErr) {
    if (createErr.message.toLowerCase().includes('already')) {
      throw new Error('This phone number is already registered. Sign in instead.');
    }
    throw createErr;
  }
  const userId = created.user?.id;
  if (!userId) throw new Error('Could not create account');

  // 3. Set profile fields (trigger already created the row with role=tenant)
  await admin.from('profiles')
    .update({ full_name: input.full_name, phone: input.phone, role: 'tenant' })
    .eq('id', userId);

  // 4. Create the tenant row linked to the property
  const { error: tenantErr } = await admin.from('tenants').insert({
    property_id: property.property_id,
    profile_id: userId,
    full_name: input.full_name,
    phone: input.phone,
    active: true,
  });
  if (tenantErr) {
    // Roll back the auth user so they can retry
    await admin.auth.admin.deleteUser(userId);
    throw tenantErr;
  }
}
