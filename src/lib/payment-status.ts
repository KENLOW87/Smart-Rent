// Single source of truth for how a payment's status is displayed.
// Computed from stored fields (amount_due, amount_paid, due_date, paid_at) — no DB column needed.

export type DisplayStatus = 'paid' | 'paid_late' | 'overdue' | 'upcoming' | 'vacant';

export interface PaymentLike {
  amount_due: number;
  amount_paid: number;
  due_date: string;        // 'YYYY-MM-DD'
  paid_at: string | null;  // ISO timestamp
}

export function displayStatus(p: PaymentLike, todayStr: string): DisplayStatus {
  const due = Number(p.amount_due);
  const paid = Number(p.amount_paid);
  if (due > 0 && paid >= due) {
    const paidDate = (p.paid_at ?? '').slice(0, 10);
    return paidDate && paidDate > p.due_date ? 'paid_late' : 'paid';
  }
  // not fully paid
  return p.due_date < todayStr ? 'overdue' : 'upcoming';
}

// Whole days between a payment/now date and the due date (never negative).
export function daysLate(whenISO: string, dueDate: string): number {
  return Math.max(0, Math.floor((Date.parse(whenISO.slice(0, 10)) - Date.parse(dueDate)) / 86400000));
}

export const STATUS_META: Record<DisplayStatus, { label: string; pill: string }> = {
  paid:      { label: 'Paid',        pill: 'bg-emerald-100 text-emerald-700' },
  paid_late: { label: 'Paid (Late)', pill: 'bg-amber-100 text-amber-700' },
  overdue:   { label: 'Overdue',     pill: 'bg-red-100 text-red-700' },
  upcoming:  { label: '',            pill: '' },
  vacant:    { label: 'Vacant',      pill: 'bg-slate-100 text-slate-500' },
};
