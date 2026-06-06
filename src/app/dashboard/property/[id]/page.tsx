import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { displayStatus, daysLate, STATUS_META } from '@/lib/payment-status';

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: property } = await supabase
    .from('properties').select('*').eq('id', id).maybeSingle();
  if (!property) notFound();

  const { data: tenant } = await supabase
    .from('tenants').select('id, full_name, phone, active')
    .eq('property_id', id).eq('active', true).maybeSingle();

  const { data: payments } = await supabase
    .from('payments').select('*').eq('property_id', id)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(24);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm text-blue-600">← Back to home</Link>

      <section className="rounded-2xl p-6 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow">
        <p className="text-xs uppercase tracking-wider text-blue-100">Property</p>
        <p className="text-xl font-bold mt-1">{property.name}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 bg-white/10 rounded-xl p-3">
          <div>
            <p className="text-[10px] uppercase text-blue-100">Monthly rent</p>
            <p className="text-lg font-semibold">RM {Number(property.rental_amount).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-blue-100">Due day</p>
            <p className="text-lg font-semibold">{property.due_day_of_month}</p>
          </div>
        </div>
        <p className="text-xs text-blue-100 mt-3">
          Tenant: {tenant ? `${tenant.full_name} (${tenant.phone})` : 'Vacant'}
        </p>
      </section>

      <h3 className="text-sm font-semibold text-slate-700 px-1">Payment history</h3>
      <div className="space-y-3">
        {payments?.map((p) => {
          const ds = displayStatus(p, today);
          const meta = STATUS_META[ds];
          const late = ds === 'paid_late' && p.paid_at ? daysLate(p.paid_at, p.due_date) : 0;
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">
                    {new Date(p.period_year, p.period_month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Due {p.due_date}</p>
                </div>
                {ds !== 'upcoming' && (
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meta.pill}`}>
                    {meta.label}{late ? ` · ${late}d` : ''}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div>
                  <p className="text-slate-500">Rental</p>
                  <p className="font-semibold text-sm">RM {Number(p.amount_due).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Paid</p>
                  <p className="font-semibold text-sm">RM {Number(p.amount_paid).toFixed(0)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {!payments?.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No payment records yet.
          </div>
        )}
      </div>
    </div>
  );
}
