'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractFromPdf, fuzzyMatch } from '@/lib/ai/verify';

const ACCEPTED_DAYS_OLD = 30;

export async function uploadProof(paymentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) throw new Error('No file');
  if (file.type !== 'application/pdf') throw new Error('PDF only');
  if (file.size > 10 * 1024 * 1024) throw new Error('File too large (max 10 MB)');

  // Validate payment belongs to tenant, load property bank info
  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount_due, tenants!inner(profile_id), properties(bank_account, account_holder, bank_name)')
    .eq('id', paymentId)
    .single();
  type PaymentRow = {
    id: string; amount_due: number;
    tenants: { profile_id: string | null } | null;
    properties: { bank_account: string | null; account_holder: string | null; bank_name: string | null } | null;
  };
  const p = payment as unknown as PaymentRow | null;
  if (!p || p.tenants?.profile_id !== user.id) throw new Error('Not your payment');

  const ts = Date.now();
  const path = `${user.id}/${paymentId}/${ts}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('payment-proofs')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw upErr;

  const { data: proofRow, error: proofErr } = await supabase
    .from('payment_proofs')
    .insert({
      payment_id: paymentId, uploaded_by: user.id,
      file_path: path, mime_type: 'application/pdf', status: 'pending',
    })
    .select('id').single();
  if (proofErr) throw proofErr;

  const admin = createAdminClient();

  // AI extraction
  let extracted;
  try {
    extracted = await extractFromPdf(buffer.toString('base64'));
  } catch (e) {
    await admin.from('payment_proofs').update({
      status: 'error',
      ai_notes: e instanceof Error ? e.message : 'AI error',
    }).eq('id', proofRow.id);
    revalidatePath('/tenant');
    return;
  }

  // Decide status
  const expected = Number(p.amount_due);
  const amountOk = extracted.amount !== null && Math.abs(extracted.amount - expected) < 0.01;
  const dateOk = extracted.date
    ? (Date.now() - Date.parse(extracted.date)) < ACCEPTED_DAYS_OLD * 86400000
    : false;

  const expectedAccount = p.properties?.bank_account;
  const expectedHolder = p.properties?.account_holder;
  const accountOk =
    fuzzyMatch(extracted.recipient_account, expectedAccount) ||
    fuzzyMatch(extracted.recipient_name, expectedHolder);

  // Owner hasn't set up bank account on the property — require manual review
  const hasBankSetup = !!(expectedAccount || expectedHolder);

  let status: 'verified' | 'needs_review' | 'mismatch';
  const failedChecks: string[] = [];
  if (!amountOk) failedChecks.push('amount');
  if (!dateOk) failedChecks.push('date');
  if (hasBankSetup && !accountOk) failedChecks.push('recipient');

  if (!hasBankSetup) {
    status = 'needs_review';   // owner hasn't set bank info → can't auto-verify
    failedChecks.push('no bank account configured');
  } else if (failedChecks.length === 0) {
    status = 'verified';
  } else if (failedChecks.length === 1 && failedChecks[0] === 'recipient') {
    status = 'mismatch';       // wrong recipient → likely fraud
  } else {
    status = 'needs_review';   // borderline → owner reviews
  }

  await admin.from('payment_proofs').update({
    status,
    ai_amount: extracted.amount,
    ai_date: extracted.date,
    ai_reference: extracted.reference,
    ai_bank: extracted.bank,
    ai_notes: [extracted.notes, failedChecks.length ? `Failed: ${failedChecks.join(', ')}` : null]
      .filter(Boolean).join(' · ') || null,
    ai_raw: { ...(extracted.raw as object), recipient_name: extracted.recipient_name, recipient_account: extracted.recipient_account },
  }).eq('id', proofRow.id);

  if (status === 'verified') {
    await admin.from('payments').update({
      status: 'paid',
      amount_paid: expected,
      paid_at: new Date().toISOString(),
      notes: `Auto-verified · ref ${extracted.reference ?? '?'} · ${extracted.bank ?? ''} → ${extracted.recipient_name ?? ''}`,
    }).eq('id', paymentId);
  }

  revalidatePath('/tenant');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/payments');
}
