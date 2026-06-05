import { createClient } from '@/lib/supabase/server';
import { generateMonth, recordPayment, sendReminderNow, approveProof, rejectProof } from './actions';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y ?? now.getFullYear());
  const month = Number(sp.m ?? now.getMonth() + 1);
  const filter = sp.filter ?? 'all';

  const supabase = await createClient();
  const { data: rawPayments } = await supabase
    .from('payments')
    .select('*, tenants(full_name, profile_id), properties(name), payment_proofs(id, status, ai_amount, ai_date, ai_reference, ai_bank, uploaded_at)')
    .eq('period_year', year).eq('period_month', month)
    .order('due_date');

  const todayStr = new Date().toISOString().slice(0, 10);
  const payments = (rawPayments ?? []).filter((p) => {
    if (filter === 'all') return true;
    const overdue = p.status === 'pending' && p.due_date < todayStr;
    if (filter === 'paid') return p.status === 'paid';
    if (filter === 'overdue') return p.status === 'late' || overdue;
    if (filter === 'pending') return (p.status === 'pending' && !overdue) || p.status === 'partial';
    return true;
  });

  const monthLabel = new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Payments</h2>
        <form action={async () => { 'use server'; await generateMonth(year, month); }}>
          <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">
            Generate
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3">
        <a href={`?y=${month === 1 ? year - 1 : year}&m=${month === 1 ? 12 : month - 1}&filter=${filter}`}
           className="text-sm text-slate-600 px-2">← Prev</a>
        <p className="text-sm font-medium">{monthLabel}</p>
        <a href={`?y=${month === 12 ? year + 1 : year}&m=${month === 12 ? 1 : month + 1}&filter=${filter}`}
           className="text-sm text-slate-600 px-2">Next →</a>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {(['all', 'paid', 'pending', 'overdue'] as const).map((f) => (
          <a key={f} href={`?y=${year}&m=${month}&filter=${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap capitalize ${
              filter === f
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}>
            {f}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {payments?.map((p: {
          id: string; due_date: string; amount_due: number; amount_paid: number;
          status: string; tenants: { full_name: string; profile_id: string | null } | null;
          properties: { name: string } | null;
          payment_channel?: string | null; toyyibpay_ref_no?: string | null;
          payment_proofs?: Array<{ id: string; status: string; ai_amount: number | null; ai_date: string | null; ai_reference: string | null; ai_bank: string | null }>;
        }) => {
          const proof = p.payment_proofs?.[p.payment_proofs.length - 1];
          const overdue = p.status === 'pending' && p.due_date < today;
          const effectiveStatus = overdue ? 'late' : p.status;
          const statusColor = {
            paid: 'bg-emerald-100 text-emerald-700',
            partial: 'bg-amber-100 text-amber-700',
            pending: 'bg-slate-100 text-slate-700',
            late: 'bg-red-100 text-red-700',
          }[effectiveStatus] ?? '';
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.tenants?.full_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{p.properties?.name}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full capitalize ${statusColor}`}>
                  {effectiveStatus}
                </span>
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

              {p.status === 'paid' && p.payment_channel === 'toyyibpay' && (
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
                  {proof.ai_reference && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Ref: {proof.ai_reference}</p>
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
                <form action={recordPayment.bind(null, p.id)} className="flex gap-2">
                  <input name="amount" type="number" step="0.01"
                    defaultValue={p.amount_paid || ''}
                    placeholder={`RM ${p.amount_due}`}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <button className="text-sm bg-blue-600 text-white px-4 rounded-lg">Save</button>
                </form>
                {p.tenants?.profile_id && effectiveStatus !== 'paid' && (
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
