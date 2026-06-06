'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function generateLinkCode() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const code = randomCode();
  const { error } = await supabase.from('profiles')
    .update({ telegram_link_code: code, telegram_chat_id: null })
    .eq('id', user.id);
  if (error) throw error;
  revalidatePath('/dashboard/settings');
  revalidatePath('/tenant');
}

export async function setUserRole(userId: string, formData: FormData) {
  const supabase = await createClient();
  const role = String(formData.get('role'));
  const { error } = await supabase.from('profiles')
    .update({ role }).eq('id', userId);
  if (error) throw error;
  revalidatePath('/dashboard/settings');
}

// Each owner saves their own ToyyibPay credentials + bank details.
export async function savePaymentSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({
    toyyibpay_secret_key: String(formData.get('toyyibpay_secret_key') || '').trim() || null,
    toyyibpay_category_code: String(formData.get('toyyibpay_category_code') || '').trim() || null,
    bank_name: String(formData.get('bank_name') || '').trim() || null,
    bank_account_no: String(formData.get('bank_account_no') || '').trim() || null,
    bank_account_name: String(formData.get('bank_account_name') || '').trim() || null,
  }).eq('id', user.id);
  if (error) throw error;
  revalidatePath('/dashboard/settings');
  revalidatePath('/tenant');
}
