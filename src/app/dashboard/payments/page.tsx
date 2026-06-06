import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayStatus, daysLate, STATUS_META } from '@/lib/payment-status';
import PeriodPicker from './PeriodPicker';
import { getSlipUrls } from '@/lib/slips';

// WhatsApp the tenant: a reminder if rent is outstanding, a thank-you if settled.
function waTenant(name: string, phone: string, property: string, month: string, outstanding: number) {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('60') ? digits : digits.startsWith('0') ? '60' + digits.slice(1) : '60' + digits;
  const msg = outstanding > 0
    ? `Hi ${name}, a reminder for your rent at ${property} (${month}).\n` +
      `Outstanding: RM ${outstanding.toFixed(0)}.\nKindly settle as soon as possible. Thank you. \u{1F64F}`
    : `Hi ${name}, we have received your rent for ${property} (${month}). Thank you! \u{1F64F}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

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
    .select('*, tenants(full_name, profile_id, phone), properties(name)')
    .eq('period_year', year).eq('period_month', month)
    .order('due_date');

  const payments = (rawPayments ?? []).filter((p) => filter === 'all' || displayStatus(p, today) === filter);
  const slipUrls = await getSlipUrls(payments.map((p) => p.id));

  const monthLabel = new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const chips = [
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
              filter === c.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            }`}>
            {c.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {payments?.map((p: {
          id: string; due_date: string; amount_due: number; amount_paid: number; paid_at: string | null;
          period_year: number; period_month: number; status: string;
          tenants: { full_name: string; profile_id: string | null; phone: string | null } | null;
          properties: { name: string } | null;
          payment_channel?: string | null; toyyibpay_ref_no?: string | null;
        }) => {
          const dstatus = displayStatus(p, today);
          const meta = STATUS_META[dstatus];
          const lateDays = dstatus === 'paid_late' && p.paid_at ? daysLate(p.paid_at, p.due_date) : 0;
          const fullyPaid = dstatus === 'paid' || dstatus === 'paid_late';
          const outstanding = Number(p.amount_due) - Number(p.amount_paid);
          const periodLabel = new Date(p.period_year, p.period_month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
          const slip = slipUrls.get(p.id);
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.properties?.name ?? '—'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{p.tenants?.full_name}</p>
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
                  <p className="text-slate-500">{fullyPaid ? 'Paid' : 'Outstanding'}</p>
                  <p className="font-semibold text-base">
                    RM {(fullyPaid ? Number(p.amount_paid) : outstanding).toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 flex gap-2">
                {slip ? (
                  <a href={slip} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-sm border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium">
                    📄 View slip
                  </a>
                ) : (
                  <span className="flex-1 text-center text-xs text-slate-400 self-center">No bank-in slip</span>
                )}
                {p.tenants?.phone && (
                  <a href={waTenant(p.tenants.full_name, p.tenants.phone, p.properties?.name ?? '', periodLabel, outstanding)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-sm bg-emerald-500 text-white py-2.5 rounded-lg font-medium">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {!payments?.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No payments recorded for {monthLabel}.
          </div>
        )}
      </div>
    </div>
  );
}
