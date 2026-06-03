'use client';

import { useState } from 'react';
import { startPayment } from './pay/actions';

export default function PayButton({ paymentId, amount }: { paymentId: string; amount: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const url = await startPayment(paymentId);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start payment');
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button onClick={go} disabled={busy}
        className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {busy ? 'Opening payment…' : `Pay RM ${amount.toFixed(0)} online`}
      </button>
      {err && <p className="text-xs text-red-600 mt-1 text-center">{err}</p>}
      <p className="text-[10px] text-slate-400 text-center mt-1">
        Secured by toyyibPay · FPX online banking
      </p>
    </div>
  );
}
