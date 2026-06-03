import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBillPaid } from '@/lib/toyyibpay';

// ToyyibPay server-to-server callback (POST, form-urlencoded).
// Params: refno, status (1=success,2=pending,3=fail), reason, billcode, order_id, amount, transaction_time
export async function POST(req: Request) {
  let billcode = '';
  let orderId = '';
  let status = '';
  try {
    const form = await req.formData();
    billcode = String(form.get('billcode') || '');
    orderId = String(form.get('order_id') || '');   // our payment id (billExternalReferenceNo)
    status = String(form.get('status') || '');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!billcode || !orderId) {
    return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm this payment exists AND that we created this exact bill for it.
  const { data: payment } = await admin
    .from('payments')
    .select('id, amount_due, toyyibpay_bill_code, status')
    .eq('id', orderId)
    .single();

  if (!payment || payment.toyyibpay_bill_code !== billcode) {
    return NextResponse.json({ ok: false, error: 'unknown bill' }, { status: 404 });
  }

  // Never trust the POST alone — re-query ToyyibPay to confirm real payment.
  if (status === '1') {
    const verified = await isBillPaid(billcode);
    if (verified.paid && payment.status !== 'paid') {
      await admin.from('payments').update({
        status: 'paid',
        amount_paid: payment.amount_due,
        paid_at: new Date().toISOString(),
        toyyibpay_ref_no: verified.invoiceNo,
        payment_channel: 'toyyibpay',
        notes: `Paid online via toyyibPay${verified.invoiceNo ? ' · inv ' + verified.invoiceNo : ''}`,
      }).eq('id', payment.id);
    }
  }

  // Always 200 so ToyyibPay stops retrying.
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
