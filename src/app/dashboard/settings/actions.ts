'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
