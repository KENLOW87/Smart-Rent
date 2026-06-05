import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordPayment, sendReminderNow, approveProof, rejectProof } from './actions';
import { displayStatus, daysLate, STATUS_META } from '@/lib/payment-status';
import PeriodPicker from './PeriodPicker';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const year = Number(sp.y ?? curYear);
  const month = Number(sp.m ?? curMonth);
  const filter = sp.filter ?? 'all';
  const today = new Date().toISOString().slice(0, 10);
  const years = Array.from({ length: 5 }, (_, i) => curYear - 3 + i);

  const supabase = await createClient();

  // No Generate button — auto-create the current month's rows on load (idempotent).
  if (year === curYear && month === curMonth) {
    const admin = createAdminClient();
    const { data: activeTenants } = await admin
      .from('tenants')
      .select('id, property_id, properties(rental_amount, due_day_of_month)')
      .eq('active', true);
    if (activeTenants?.length) {
      type T = { id: string; property_id: string; properties: { rental_amount: number; due_day_of_month: number } | null };
      const rows = (activeTenants as unknown as T[]).map((t) => {
        const dueDay = t.properties?.due_day_of_month ?? 5;
        const due = new Date(Date.UTC(year, month - 1, dueDay)).toISOString().slice(0, 10);
        return {
          tenant_id: t.id, property_id: t.property_id,
          period_year: year, period_month: month,
          amount_due: t.properties?.rental_amount ?? 0,
          due_date: due, status: 'pending' as const,
        };
      });
      await admin.from('payments').upsert(rows, {
        onConflict: 'tenant_id,period_year,period_month', ignoreDuplicates: true,
      });
    }
  }

  const { data: rawPayments } = await supabase
    .from('payments')
    .select('*, tenants(full_name, profile_id), properties(name), payment_proofs(id, status, ai_amount, ai_date, ai_reference, ai_bank, uploaded_at)')
    .eq('period_year', year).eq('period_month', month)
    .order('due_date');

  const payments = (rawPayments ?? []).filter((p) => {
    if (filter === 'all') return true;
    return displayStatus(p, today) === filter;
  });

  const monthLabel = new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const chips: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'paid_late', label: 'Paid (Late)' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Payment History</h2>

      <PeriodPicker year={year} month={month} filter={filter} years={years} />

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {chips.map((c) => (
          <a key={c.key} href={`?y=${year}&m=${month}&filter=${c.key}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${
              filter === c.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}>
            {c.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {payments?.map((p: {
          id: string; due_date: string; amount_due: number; amount_paid: number; paid_at: string | null;
          status: string; tenants: { full_name: string; profile_id: string | null } | null;
          properties: { name: string } | null;
          payment_channel?: string | null; toyyibpay_ref_no?: string | null;
          payment_proofs?: Array<{ id: string; status: string; ai_amount: number | null; ai_date: string | null; ai_reference: string | null; ai_bank: string | null }>;
        }) => {
          const proof = p.payment_proofs?.[p.payment_proofs.length - 1];
          const dstatus = displayStatus(p, today);
          const meta = STATUS_META[dstatus];
          const lateDays = dstatus === 'paid_late' && p.paid_at ? daysLate(p.paid_at, p.due_date) : 0;
          const fullyPaid = dstatus === 'paid' || dstatus === 'paid_late';
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.tenants?.full_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{p.properties?.name}</p>
                </div>
                {dstatus !== 'upcoming' ? (
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meta.pill}`}>
                    {meta.label}{lateDays ? ` · ${lateDays}d` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Due {p.due_date}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div>
                  <p className="text-slate-500">Rental</p>
                  <p className="font-semibold text-base">RM {Number(p.amount_due).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due</p>
                  <p className="font-semibold text-base">{p.due_date}</p>
                </div>
              </div>

              {fullyPaid && p.payment_channel === 'toyyibpay' && (
                <div className="mt-3 rounded-xl p-3 border bg-emerald-50 border-emerald-200 text-xs">
                  <p className="font-semibold text-emerald-700">💳 Paid online via toyyibPay (FPX)</p>
                  {p.toyyibpay_ref_no && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Invoice ref: {p.toyyibpay_ref_no}</p>
                  )}
                </div>
              )}

              {proof && (
                <div className={`mt-3 rounded-xl p-3 border text-xs ${
                  proof.status === 'verified' ? 'bg-emerald-50 border-emerald-200' :
                  proof.status === 'mismatch' ? 'bg-red-50 border-red-200' :
                  proof.status === 'needs_review' ? 'bg-amber-50 border-amber-200' :
                  proof.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  <p className="font-semibold mb-1">
                    {proof.status === 'verified' && '✓ AI verified receipt'}
                    {proof.status === 'mismatch' && '⚠ Wrong recipient — possible fraud'}
                    {proof.status === 'needs_review' && '⏸ Needs your review'}
                    {proof.status === 'pending' && '⏳ Processing'}
                    {proof.status === 'error' && '✗ AI read error'}
                  </p>
                  {proof.ai_amount !== null && (
                    <p className="text-slate-600">
                      RM {Number(proof.ai_amount).toFixed(2)}
                      {proof.ai_date && ` · ${proof.ai_date}`}
                      {proof.ai_bank && ` · ${proof.ai_bank}`}
                    </p>
                  )}
                  {(proof.status === 'needs_review' || proof.status === 'mismatch') && (
                    <div className="flex gap-2 mt-2">
                      <form action={async () => { 'use server'; await approveProof(proof.id, p.id); }} className="flex-1">
                        <button className="w-full text-xs bg-emerald-600 text-white py-1.5 rounded-lg font-medium">
                          ✓ Approve
                        </button>
                      </form>
                      <form action={async () => { 'use server'; await rejectProof(proof.id); }} className="flex-1">
                        <button className="w-full text-xs bg-white border border-red-300 text-red-700 py-1.5 rounded-lg font-medium">
                          ✗ Reject
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <form action={recordPayment.bind(null, p.id)} className="space-y-2">
                  <div className="flex gap-2">
                    <input name="amount" type="number" step="0.01"
                      defaultValue={p.amount_paid || ''}
                      placeholder={`RM ${p.amount_due}`}
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    <input name="paid_date" type="date" defaultValue={today} title="Date paid"
                      className="w-36 px-2 py-2 border border-slate-300 rounded-lg text-xs" />
                  </div>
                  <button className="w-full text-sm bg-blue-600 text-white py-2 rounded-lg font-medium">
                    Save payment
                  </button>
                </form>
                {p.tenants?.profile_id && !fullyPaid && (
                  <form action={async () => { 'use server'; await sendReminderNow(p.id); }} className="mt-2">
                    <button className="w-full text-xs text-blue-600 border border-blue-200 py-1.5 rounded-lg hover:bg-blue-50">
                      🔔 Send reminder
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {!payments?.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No payments for {monthLabel}.<br />
            Tap <b>Generate</b> to create this month&apos;s rows.
          </div>
        )}
      </div>
    </div>
  );
}
