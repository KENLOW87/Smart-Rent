'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Create payment rows for the given month for every active tenant.
export async function generateMonth(year: number, month: number) {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, property_id, properties(rental_amount, due_day_of_month)')
    .eq('active', true);

  if (!tenants?.length) return { created: 0 };

  type TenantRow = {
    id: string;
    property_id: string;
    properties: { rental_amount: number; due_day_of_month: number } | null;
  };

  const rows = (tenants as unknown as TenantRow[]).map((t) => {
    const dueDay = t.properties?.due_day_of_month ?? 5;
    const due = new Date(Date.UTC(year, month - 1, dueDay)).toISOString().slice(0, 10);
    return {
      tenant_id: t.id,
      property_id: t.property_id,
      period_year: year,
      period_month: month,
      amount_due: t.properties?.rental_amount ?? 0,
      due_date: due,
      status: 'pending' as const,
    };
  });

  const { error, count } = await supabase
    .from('payments')
    .upsert(rows, { onConflict: 'tenant_id,period_year,period_month', ignoreDuplicates: true, count: 'exact' });
  if (error) throw error;
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard');
  return { created: count ?? 0 };
}

export async function recordPayment(paymentId: string, formData: FormData) {
  const supabase = await createClient();
  const amount = Number(formData.get('amount'));
  const { data: payment } = await supabase
    .from('payments').select('amount_due').eq('id', paymentId).single();
  if (!payment) throw new Error('Payment not found');

  const status =
    amount >= Number(payment.amount_due) ? 'paid' :
    amount > 0 ? 'partial' : 'pending';

  // Optional "date paid" (defaults to today). Stamped at noon UTC so the date
  // is unambiguous when compared to the due date (used for Paid vs Paid-Late).
  const paidDateInput = String(formData.get('paid_date') || '').trim();
  const paidAt = amount > 0
    ? (paidDateInput ? new Date(`${paidDateInput}T12:00:00Z`).toISOString() : new Date().toISOString())
    : null;

  const { error } = await supabase.from('payments').update({
    amount_paid: amount,
    paid_at: paidAt,
    status,
    notes: String(formData.get('notes') || '') || null,
    updated_at: new Date().toISOString(),
  }).eq('id', paymentId);
  if (error) throw error;
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard');
}

export async function approveProof(proofId: string, paymentId: string) {
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payments').select('amount_due').eq('id', paymentId).single();
  if (!payment) throw new Error('Payment not found');

  await supabase.from('payment_proofs').update({ status: 'verified' }).eq('id', proofId);
  await supabase.from('payments').update({
    status: 'paid',
    amount_paid: payment.amount_due,
    paid_at: new Date().toISOString(),
    notes: 'Manually approved by owner after AI review',
  }).eq('id', paymentId);

  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard');
}

export async function rejectProof(proofId: string) {
  const supabase = await createClient();
  await supabase.from('payment_proofs').update({ status: 'mismatch' }).eq('id', proofId);
  revalidatePath('/dashboard/payments');
}

export async function sendReminderNow(paymentId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/telegram/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET ?? '' },
      body: JSON.stringify({ payment_id: paymentId }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  revalidatePath('/dashboard/payments');
}

// Delete a single payment record (and any uploaded bank-in slip). Owner-only.
// Note: for the CURRENT month the row is re-created fresh/unpaid the next time the
// Payments page loads, so deleting effectively resets that month for re-testing.
export async function deletePayment(paymentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'owner') throw new Error('Owners only');

  const admin = createAdminClient();
  // Remove slip files + proof rows tied to this payment.
  const { data: proofs } = await admin
    .from('payment_proofs').select('file_path').eq('payment_id', paymentId);
  const paths = (proofs ?? []).map((p) => p.file_path).filter(Boolean);
  if (paths.length) await admin.storage.from('payment-proofs').remove(paths);
  await admin.from('payment_proofs').delete().eq('payment_id', paymentId);
  await admin.from('payments').delete().eq('id', paymentId);

  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard');
}
