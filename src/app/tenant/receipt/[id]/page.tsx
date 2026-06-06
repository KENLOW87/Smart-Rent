import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { displayStatus } from '@/lib/payment-status';
import ReceiptActions from '../../ReceiptActions';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: payment } = await supabase
    .from('payments')
    .select('*, tenants!inner(full_name, profile_id), properties(name, address)')
    .eq('id', id)
    .single();

  type Row = {
    id: string; amount_due: number; amount_paid: number; paid_at: string | null;
    due_date: string; period_year: number; period_month: number;
    payment_channel: string | null; toyyibpay_ref_no: string | null;
    tenants: { full_name: string; profile_id: string | null } | null;
    properties: { name: string; address: string | null } | null;
  };
  const p = payment as unknown as Row | null;
  if (!p || p.tenants?.profile_id !== user.id) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const status = displayStatus(p, today);
  const isPaid = status === 'paid' || status === 'paid_late';
  const monthLabel = new Date(p.period_year, p.period_month - 1)
    .toLocaleString('en', { month: 'long', year: 'numeric' });
  const paidDate = p.paid_at
    ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 flex flex-col items-center max-w-md mx-auto">
      <div className="w-full bg-white rounded-2xl shadow p-6">
        <div className="text-center border-b border-dashed border-slate-200 pb-4">
          <h1 className="text-lg font-bold text-blue-700">Smart Rent</h1>
          <p className="text-xs text-slate-500">Payment Receipt</p>
        </div>

        <div className="text-center my-4">
          <span className={`inline-block text-sm font-bold px-4 py-1 rounded-full ${
            isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isPaid ? 'PAID' : 'NOT PAID'}
          </span>
          <p className="text-3xl font-bold mt-3">RM {Number(p.amount_paid || p.amount_due).toFixed(2)}</p>
        </div>

        <div className="text-sm space-y-2">
          <Row label="Tenant" value={p.tenants?.full_name ?? '—'} />
          <Row label="Property" value={p.properties?.name ?? '—'} />
          <Row label="For" value={monthLabel} />
          <Row label="Date paid" value={paidDate} />
          <Row label="Method" value={p.payment_channel === 'toyyibpay' ? 'Online · FPX (toyyibPay)' : 'Recorded by owner'} />
          {p.toyyibpay_ref_no && <Row label="Reference" value={p.toyyibpay_ref_no} />}
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-5 border-t border-dashed border-slate-200 pt-3">
          Thank you for your payment.
        </p>
      </div>

      {isPaid && (
        <ReceiptActions
          amount={Number(p.amount_paid || p.amount_due).toFixed(2)}
          tenant={p.tenants?.full_name ?? ''}
          property={p.properties?.name ?? ''}
          period={monthLabel}
          datePaid={paidDate}
          method={p.payment_channel === 'toyyibpay' ? 'Online - FPX (toyyibPay)' : 'Recorded by owner'}
          reference={p.toyyibpay_ref_no ?? ''}
        />
      )}
      <p className="text-[11px] text-slate-400 text-center mt-3 max-w-sm">
        Tap <b>WhatsApp</b> to send this receipt to your landlord as proof of payment.
      </p>
      <a href="/tenant" className="mt-4 text-sm text-blue-600">← Back to my rental</a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}
