'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createBill, billPaymentUrl } from '@/lib/toyyibpay';

// Creates a ToyyibPay bill for a tenant's unpaid month and returns the payment URL.
export async function startPayment(paymentId: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount_due, amount_paid, status, period_year, period_month, tenants!inner(full_name, phone, email, profile_id), properties(name)')
    .eq('id', paymentId)
    .single();

  type Row = {
    id: string; amount_due: number; amount_paid: number; status: string;
    period_year: number; period_month: number;
    tenants: { full_name: string; phone: string | null; email: string | null; profile_id: string | null } | null;
    properties: { name: string } | null;
  };
  const p = payment as unknown as Row | null;
  if (!p || p.tenants?.profile_id !== user.id) throw new Error('Not your payment');
  if (p.status === 'paid') throw new Error('This month is already paid');

  const remaining = Number(p.amount_due) - Number(p.amount_paid);
  if (remaining <= 0) throw new Error('Nothing left to pay');

  const monthLabel = new Date(p.period_year, p.period_month - 1)
    .toLocaleString('en', { month: 'short', year: 'numeric' });

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const cleanPhone = (p.tenants?.phone || '').replace(/[^0-9]/g, '') || '0000000000';
  const email = p.tenants?.email || `${cleanPhone}@smartrent.local`;

  const billCode = await createBill({
    amountRM: remaining,
    billName: `Rent ${monthLabel}`,
    billDescription: `Rent ${p.properties?.name ?? ''} ${monthLabel}`,
    externalRef: p.id,
    returnUrl: `${site}/pay/return`,
    callbackUrl: `${site}/api/toyyibpay/callback`,
    payorName: p.tenants?.full_name ?? 'Tenant',
    payorEmail: email,
    payorPhone: cleanPhone,
  });

  // Store the bill code so the webhook can match + verify this payment.
  const admin = createAdminClient();
  await admin.from('payments')
    .update({ toyyibpay_bill_code: billCode, payment_channel: 'toyyibpay' })
    .eq('id', p.id);

  return billPaymentUrl(billCode);
}
