'use client';

import { useState } from 'react';
import { startPayment } from './pay/actions';

export default function PayButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await startPayment(paymentId);
    if (res.url) {
      window.location.href = res.url;
    } else {
      setErr(res.error ?? 'Could not start payment');
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={go} disabled={busy}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">FPX</span>
        {busy ? 'Opening…' : 'Pay Rental Now'}
      </button>
      {err && <p className="text-xs text-red-600 mt-1 text-center">{err}</p>}
      <p className="text-[11px] text-slate-400 text-center mt-1.5">
        Secure payment via toyyibPay (FPX)
      </p>
    </div>
  );
}
