'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createBill, billPaymentUrl } from '@/lib/toyyibpay';

// Creates a ToyyibPay bill for a tenant's unpaid month.
// Returns { url } on success, or { error } with a readable message (server-action
// throws are hidden in production, so we return the message instead).
export async function startPayment(paymentId: string): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Please sign in again.' };

    const { data: payment } = await supabase
      .from('payments')
      .select('id, amount_due, amount_paid, status, period_year, period_month, tenants!inner(full_name, phone, email, profile_id), properties(name, owner_id)')
      .eq('id', paymentId)
      .single();

    type Row = {
      id: string; amount_due: number; amount_paid: number; status: string;
      period_year: number; period_month: number;
      tenants: { full_name: string; phone: string | null; email: string | null; profile_id: string | null } | null;
      properties: { name: string; owner_id: string } | null;
    };
    const p = payment as unknown as Row | null;
    if (!p || p.tenants?.profile_id !== user.id) return { error: 'This payment is not linked to your account.' };
    if (p.status === 'paid') return { error: 'This month is already paid.' };

    const remaining = Number(p.amount_due) - Number(p.amount_paid);
    if (remaining <= 0) return { error: 'Nothing left to pay.' };

    const monthLabel = new Date(p.period_year, p.period_month - 1)
      .toLocaleString('en', { month: 'short', year: 'numeric' });

    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const cleanPhone = (p.tenants?.phone || '').replace(/[^0-9]/g, '') || '0000000000';
    // Tenants have no real email — send the ToyyibPay receipt to the owner instead.
    const email = p.tenants?.email || process.env.OWNER_EMAIL || `${cleanPhone}@smartrent.local`;

    const admin = createAdminClient();
    const { data: ownerCfg } = await admin
      .from('profiles')
      .select('toyyibpay_secret_key, toyyibpay_category_code')
      .eq('id', p.properties?.owner_id ?? '')
      .maybeSingle();

    const billCode = await createBill({
      secretKey: ownerCfg?.toyyibpay_secret_key ?? undefined,
      categoryCode: ownerCfg?.toyyibpay_category_code ?? undefined,
      amountRM: remaining,
      billName: `${p.properties?.name ?? 'Rental'} ${monthLabel}`,
      billDescription: `Rent for ${p.properties?.name ?? 'rental'} (${monthLabel}) - ${p.tenants?.full_name ?? 'tenant'}`,
      externalRef: p.id,
      returnUrl: `${site}/pay/return`,
      callbackUrl: `${site}/api/toyyibpay/callback`,
      payorName: p.tenants?.full_name ?? 'Tenant',
      payorEmail: email,
      payorPhone: cleanPhone,
    });

    await admin.from('payments')
      .update({ toyyibpay_bill_code: billCode, payment_channel: 'toyyibpay' })
      .eq('id', p.id);

    return { url: billPaymentUrl(billCode) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not start payment';
    if (msg.toLowerCase().includes('toyyibpay')) {
      return { error: 'Online payment is not set up yet (ToyyibPay keys missing on the server).' };
    }
    return { error: msg };
  }
}

// Tenant uploads a bank-in slip for a month -> stores the file, attaches it as a
// payment proof, and marks the month paid (manual transfer). The owner reviews it.
export async function uploadSlip(paymentId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const file = formData.get('slip');
  if (!(file instanceof File) || file.size === 0) return { error: 'No file selected.' };
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10MB).' };

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('payments').select('id, amount_due, tenant_id').eq('id', paymentId).maybeSingle();
  if (!pay) return { error: 'Payment not found.' };

  const { data: t } = await admin
    .from('tenants').select('profile_id').eq('id', pay.tenant_id).maybeSingle();
  if (t?.profile_id !== user.id) return { error: 'This payment is not linked to your account.' };

  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    || (file.type.includes('pdf') ? 'pdf' : 'jpg');
  const path = `${paymentId}/slip-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from('payment-proofs')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) return { error: 'Upload failed: ' + upErr.message };

  await admin.from('payment_proofs').insert({
    payment_id: paymentId,
    uploaded_by: user.id,
    file_path: path,
    mime_type: file.type || 'application/octet-stream',
  });

  await admin.from('payments').update({
    amount_paid: pay.amount_due,
    paid_at: new Date().toISOString(),
    status: 'paid',
    payment_channel: 'manual',
  }).eq('id', paymentId);

  revalidatePath('/tenant');
  revalidatePath('/dashboard/payments');
  return {};
}
