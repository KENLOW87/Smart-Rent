import { createAdminClient } from '@/lib/supabase/admin';

// Returns a map of paymentId -> signed URL (1h) for the latest uploaded bank-in slip.
// Uses the service-role client so owners can view their tenants' private slips.
export async function getSlipUrls(paymentIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = paymentIds.filter(Boolean);
  if (!ids.length) return map;

  const admin = createAdminClient();
  const { data: proofs } = await admin
    .from('payment_proofs')
    .select('payment_id, file_path, uploaded_at')
    .in('payment_id', ids)
    .order('uploaded_at', { ascending: false });

  // Keep only the most recent slip per payment.
  const latest = new Map<string, string>();
  for (const pr of proofs ?? []) {
    if (!latest.has(pr.payment_id)) latest.set(pr.payment_id, pr.file_path);
  }

  await Promise.all(
    [...latest.entries()].map(async ([pid, path]) => {
      const { data } = await admin.storage.from('payment-proofs').createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) map.set(pid, data.signedUrl);
    }),
  );

  return map;
}
