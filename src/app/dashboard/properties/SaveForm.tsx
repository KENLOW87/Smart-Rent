'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';

type Result = { ok?: boolean; error?: string };

// Wraps an edit form so the owner gets clear "Saving…" / "✓ Saved" feedback.
// After a successful save it briefly shows "✓ Saved" then auto-collapses the
// surrounding <details> so the card shrinks back down.
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => {
      const details = formRef.current?.closest('details');
      if (details) details.open = false;
    }, 900);
    return () => clearTimeout(t);
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2 mt-2">
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
