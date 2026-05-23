import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardHome() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [{ data: properties }, { data: tenants }, { data: payments }] = await Promise.all([
    supabase.from('properties').select('id, name, rental_amount, due_day_of_month'),
    supabase.from('tenants').select('id, property_id, full_name, profile_id, active').eq('active', true),
    supabase.from('payments')
      .select('*')
      .eq('period_year', year).eq('period_month', month),
  ]);

  const today = now.toISOString().slice(0, 10);

  const occupiedPropertyIds = new Set((tenants ?? []).map((t) => t.property_id));
  const totalUnits = properties?.length ?? 0;
  const occupied = occupiedPropertyIds.size;
  const vacant = totalUnits - occupied;

  const paidList = payments?.filter((p) => p.status === 'paid') ?? [];
  const overdueList = payments?.filter((p) =>
    p.status === 'late' || (p.status === 'pending' && p.due_date < today)
  ) ?? [];
  const pendingList = payments?.filter((p) =>
    (p.status === 'pending' && p.due_date >= today) || p.status === 'partial'
  ) ?? [];

  const sum = (arr: { amount_due: number; amount_paid: number }[], key: 'amount_due' | 'amount_paid') =>
    arr.reduce((s, p) => s + Number(p[key]), 0);

  const paidAmount = sum(paidList, 'amount_paid');
  const overdueAmount = sum(overdueList, 'amount_due') - sum(overdueList, 'amount_paid');
  const pendingAmount = sum(pendingList, 'amount_due') - sum(pendingList, 'amount_paid');

  const totalDue = payments?.reduce((s, p) => s + Number(p.amount_due), 0) ?? 0;
  const totalPaid = payments?.reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0;
  const outstanding = totalDue - totalPaid;

  const monthLabel = now.toLocaleString('en', { month: 'long', year: 'numeric' });

  // Build a unified per-property card list
  type Unit = {
    propertyId: string; propertyName: string; rental: number; dueDay: number;
    tenantName: string | null; tenantProfileId: string | null;
    payment: { id: string; status: string; amount_due: number; amount_paid: number; due_date: string } | null;
    effectiveStatus: 'paid' | 'pending' | 'late' | 'partial' | 'vacant';
  };

  const units: Unit[] = (properties ?? []).map((p) => {
    const tenant = (tenants ?? []).find((t) => t.property_id === p.id) ?? null;
    const payment = (payments ?? []).find((pay) => pay.property_id === p.id) ?? null;
    let status: Unit['effectiveStatus'] = 'vacant';
    if (tenant) {
      if (!payment) status = 'pending';
      else if (payment.status === 'paid') status = 'paid';
      else if (payment.status === 'partial') status = 'partial';
      else if (payment.due_date < today) status = 'late';
      else status = 'pending';
    }
    return {
      propertyId: p.id, propertyName: p.name, rental: Number(p.rental_amount), dueDay: p.due_day_of_month,
      tenantName: tenant?.full_name ?? null,
      tenantProfileId: tenant?.profile_id ?? null,
      payment, effectiveStatus: status,
    };
  });

  // Sort: late first, pending, partial, paid, vacant last
  const order = { late: 0, partial: 1, pending: 2, paid: 3, vacant: 4 };
  units.sort((a, b) => order[a.effectiveStatus] - order[b.effectiveStatus]);

  return (
    <div className="space-y-4">
      {/* Hero — outstanding */}
      <section className="rounded-2xl p-6 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow">
        <p className="text-xs uppercase tracking-wider text-blue-100">Total outstanding</p>
        <p className="text-4xl font-bold mt-1">RM {outstanding.toFixed(0).toLocaleString()}</p>
        <p className="text-xs text-blue-100 mt-1">{monthLabel} · {tenants?.length ?? 0} active tenants</p>

        <div className="grid grid-cols-3 gap-2 mt-5 bg-white/10 rounded-xl p-2">
          <Stat label="Units" value={totalUnits} />
          <Stat label="Occupied" value={occupied} />
          <Stat label="Vacant" value={vacant} />
        </div>
      </section>

      {/* Status buttons — tap to drill in */}
      <div className="grid grid-cols-3 gap-2">
        <StatusButton tone="emerald" label="Paid"
          count={paidList.length} amount={paidAmount}
          href="/dashboard/payments?filter=paid" />
        <StatusButton tone="amber" label="Pending"
          count={pendingList.length} amount={pendingAmount}
          href="/dashboard/payments?filter=pending" />
        <StatusButton tone="red" label="Overdue"
          count={overdueList.length} amount={overdueAmount}
          href="/dashboard/payments?filter=overdue" />
      </div>

      {/* Units list */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-semibold text-slate-700">Units</h3>
          <span className="text-xs text-slate-500">{units.length} of {totalUnits}</span>
        </div>
        <div className="space-y-3">
          {units.map((u) => <UnitCard key={u.propertyId} unit={u} />)}
          {!units.length && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
              No properties yet. Add one from <b>Properties</b>.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center py-1">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase text-blue-100">{label}</p>
    </div>
  );
}

function StatusButton({ tone, label, count, amount, href }: {
  tone: 'emerald' | 'amber' | 'red';
  label: string; count: number; amount: number; href: string;
}) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    red: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  };
  return (
    <Link href={href}
      className={`block border rounded-2xl p-3 text-center transition ${styles[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{count}</p>
      <p className="text-xs mt-0.5 opacity-80">RM {amount.toFixed(0)}</p>
    </Link>
  );
}

function UnitCard({ unit }: { unit: {
  propertyId: string; propertyName: string; rental: number; dueDay: number;
  tenantName: string | null; tenantProfileId: string | null;
  payment: { id: string; status: string; amount_due: number; amount_paid: number; due_date: string } | null;
  effectiveStatus: 'paid' | 'pending' | 'late' | 'partial' | 'vacant';
} }) {
  const pillStyle: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    late: 'bg-red-100 text-red-700',
    partial: 'bg-blue-100 text-blue-700',
    vacant: 'bg-slate-100 text-slate-500',
  };
  const pillLabel: Record<string, string> = {
    paid: 'Paid', pending: 'Pending', late: 'Overdue', partial: 'Partial', vacant: 'Vacant',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{unit.propertyName}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{unit.tenantName ?? 'No tenant'}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${pillStyle[unit.effectiveStatus]}`}>
          {pillLabel[unit.effectiveStatus]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 bg-slate-50 rounded-xl p-3 text-xs">
        <div>
          <p className="text-slate-500 uppercase text-[10px]">Rental</p>
          <p className="font-semibold text-sm mt-0.5">RM {unit.rental.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase text-[10px]">Due</p>
          <p className="font-semibold text-sm mt-0.5">
            {unit.payment?.due_date ?? `Day ${unit.dueDay}`}
          </p>
        </div>
      </div>

      <Link href={`/dashboard/payments`}
        className="block mt-3 text-sm text-center bg-blue-600 text-white py-2.5 rounded-lg font-medium">
        View detail
      </Link>
    </div>
  );
}
