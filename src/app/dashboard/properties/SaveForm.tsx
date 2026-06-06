'use client';

import { useActionState, type ReactNode } from 'react';

type Result = { ok?: boolean; error?: string };

// Wraps an edit form so the owner gets clear "Saving…" / "✓ Saved" feedback,
// instead of the form silently collapsing with no confirmation.
export default function SaveForm({
  action,
  children,
  label = 'Save changes',
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-2 mt-2">
      {children}
      <button
        disabled={pending}
        className="text-xs bg-slate-900 text-white py-2 rounded-lg font-medium disabled:opacity-60"
      >
        {pending ? 'Saving…' : label}
      </button>
      {state.ok && <p className="text-xs text-emerald-600 text-center font-medium">✓ Saved</p>}
      {state.error && <p className="text-xs text-red-600 text-center">{state.error}</p>}
    </form>
  );
}
