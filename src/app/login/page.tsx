'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { phoneToEmail, phoneToPassword, looksLikePhone } from '@/lib/tenant-auth';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();

    const isPhone = mode === 'login' && looksLikePhone(identifier);
    const email = isPhone ? phoneToEmail(identifier) : identifier.trim().toLowerCase();
    const pw = isPhone ? (password || phoneToPassword(identifier)) : password;

    if (!isPhone && !password) {
      setBusy(false);
      return setErr('Please enter your password.');
    }

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password: pw })
        : await supabase.auth.signUp({ email, password: pw });

    setBusy(false);
    if (error) return setErr(error.message);
    if (mode === 'signup') {
      setErr('Account created. Now sign in.');
      setMode('login');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
        <h1 className="text-2xl font-semibold mb-1">Smart Rent</h1>
        <p className="text-sm text-slate-500 mb-6">
          {mode === 'login'
            ? 'Tenants: enter your phone number. Owners/agents: email + password.'
            : 'Create an owner / agent account (email)'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text" required
            placeholder={mode === 'login' ? 'Phone number or email' : 'Email'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="password"
            placeholder={mode === 'login' ? 'Password (tenants: leave blank)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            disabled={busy}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {busy ? '...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        {mode === 'login' && (
          <p className="mt-3 text-[11px] text-slate-400 text-center">
            Tenant? Just type your phone number and tap Sign in.
          </p>
        )}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(null); }}
          className="w-full mt-4 text-xs text-slate-500 hover:text-slate-900"
        >
          {mode === 'login' ? 'Owner: create an account' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
