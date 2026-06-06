import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import LogoutButton from '../dashboard/LogoutButton';
import PayButton from './PayButton';
import ReceiptActions from './ReceiptActions';
import { displayStatus, daysLate, STATUS_META } from '@/lib/payment-status';

export default async function TenantHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*, properties(name, address, rental_amount, due_day_of_month, owner_id)')
    .eq('profile_id', user.id).eq('active', true).maybeSingle();

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant?.id ?? '00000000-0000-0000-0000-000000000000')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(12);

  const today = new Date().toISOString().slice(0, 10);

  // Bank details come from the property OWNER's profile (each owner's tenants see
  // that owner's bank). Falls back to the global env defaults if not set.
  let bank = {
    name: process.env.BANK_NAME || '',
    holder: process.env.BANK_ACCOUNT_NAME || '',
    account: process.env.BANK_ACCOUNT_NO || '',
  };
  const ownerId = (tenant?.properties as { owner_id?: string } | null)?.owner_id;
  if (ownerId) {
    const admin = createAdminClient();
    const { data: ob } = await admin
      .from('profiles')
      .select('bank_name, bank_account_no, bank_account_name')
      .eq('id', ownerId)
      .maybeSingle();
    bank = {
      name: ob?.bank_name || bank.name,
      holder: ob?.bank_account_name || bank.holder,
      account: ob?.bank_account_no || bank.account,
    };
  }
  const hasBank = Boolean(bank.name && bank.account);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold">Hi {profile?.full_name ?? user.email}</h1>
          <p className="text-xs text-slate-500">Your rental</p>
        </div>
        <LogoutButton />
      </header>

      <div className="p-5 space-y-4">
        {!tenant ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm text-slate-600">
              Your account isn&apos;t linked to a property yet. Please contact your landlord.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl p-6 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow">
              <p className="text-xs uppercase tracking-wider text-blue-100">Your rental</p>
              <p className="text-xl font-bold mt-1">{tenant.properties?.name}</p>
              {tenant.properties?.address && (
                <p className="text-xs text-blue-100 mt-0.5">{tenant.properties.address}</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-5 bg-white/10 rounded-xl p-3">
                <div>
                  <p className="text-[10px] uppercase text-blue-100">Monthly rent</p>
                  <p className="text-lg font-semibold">RM {Number(tenant.properties?.rental_amount).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-blue-100">Due day</p>
                  <p className="text-lg font-semibold">{tenant.properties?.due_day_of_month}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 px-1">Payment history</h3>
              {payments?.map((p: PaymentRow) => {
                const dstatus = displayStatus(p, today);
                const meta = STATUS_META[dstatus];
                const lateDays = dstatus === 'paid_late' && p.paid_at ? daysLate(p.paid_at, p.due_date) : 0;
                const fullyPaid = dstatus === 'paid' || dstatus === 'paid_late';
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">
                          {new Date(p.period_year, p.period_month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">Due {p.due_date}</p>
                      </div>
                      {dstatus !== 'upcoming' ? (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meta.pill}`}>
                          {meta.label}{lateDays ? ` · ${lateDays}d late` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Not due yet</span>
                      )}
                    </div>

                    {!fullyPaid ? (
                      <div className="mt-3 space-y-3">
                        <PayButton paymentId={p.id} />

                        {hasBank && (
                          <>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex-1 border-t border-slate-200" />
                              or
                              <span className="flex-1 border-t border-slate-200" />
                            </div>
                            <details className="bg-slate-50 rounded-xl border border-slate-200">
                              <summary className="cursor-pointer text-xs font-medium text-slate-700 px-3 py-2.5">
                                🏦 View Bank Transfer Details
                              </summary>
                              <div className="px-3 pb-3 text-xs space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Bank</span>
                                  <span className="font-medium text-slate-800">{bank.name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Account Name</span>
                                  <span className="font-medium text-slate-800">{bank.holder}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Account No.</span>
                                  <span className="font-mono font-medium text-slate-800">{bank.account}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg p-2 mt-1">
                                  ℹ️ Please use your name as the payment reference.
                                </p>
                              </div>
                            </details>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {p.payment_channel === 'toyyibpay' && (
                          <p className="text-[11px] text-emerald-600 text-center">
                            ✓ Paid online via toyyibPay
                          </p>
                        )}
                        <ReceiptActions
                          amount={Number(p.amount_paid || p.amount_due).toFixed(2)}
                          tenant={tenant.full_name}
                          property={tenant.properties?.name ?? ''}
                          period={new Date(p.period_year, p.period_month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
                          datePaid={p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          method={p.payment_channel === 'toyyibpay' ? 'Online - FPX (toyyibPay)' : 'Recorded by owner'}
                          reference={p.toyyibpay_ref_no ?? ''}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {!payments?.length && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                  No payment records yet.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

type PaymentRow = {
  id: string;
  status: string;
  period_year: number; period_month: number;
  due_date: string; amount_due: number; amount_paid: number; paid_at: string | null;
  payment_channel?: string | null;
  toyyibpay_ref_no?: string | null;
};
