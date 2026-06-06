'use client';

import { useState } from 'react';
import { deletePayment } from './actions';

// Small delete control on each payment card (owner testing aid).
export default function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm('Delete this payment record?\n\nFor the current month it will reappear fresh/unpaid the next time you open Payments.')) {
      return;
    }
    setBusy(true);
    try {
      await deletePayment(paymentId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : '🗑 Delete record'}
    </button>
  );
}
