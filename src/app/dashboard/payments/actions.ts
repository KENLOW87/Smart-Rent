'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

  const { error } = await supabase.from('payments').update({
    amount_paid: amount,
    paid_at: amount > 0 ? new Date().toISOString() : null,
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
