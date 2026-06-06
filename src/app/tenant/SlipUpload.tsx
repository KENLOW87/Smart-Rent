'use client';

import { useState, type ChangeEvent } from 'react';
import { uploadSlip } from './pay/actions';

// Tenant picks a photo/PDF of their bank-in slip; on success the server marks the
// month paid and revalidates, so the card re-renders into the paid state.
export default function SlipUpload({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append('slip', f);
    const res = await uploadSlip(paymentId, fd);
    if (res?.error) {
      setErr(res.error);
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={`flex items-center justify-center gap-1 text-sm py-2.5 rounded-lg font-medium cursor-pointer ${
          busy ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white'
        }`}
      >
        {busy ? 'Uploading…' : '📤 I’ve paid — upload bank-in slip'}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={onChange}
        />
      </label>
      <p className="text-[10px] text-slate-400 text-center mt-1">Photo or PDF of your transfer receipt</p>
      {err && <p className="text-xs text-red-600 mt-1 text-center">{err}</p>}
    </div>
  );
}
