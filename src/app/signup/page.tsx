'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signupWithInvite } from './actions';

export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await signupWithInvite({
        phone: phone.trim(),
        password: password.trim(),
        full_name: name.trim(),
        invite_code: code.trim().toUpperCase(),
      });
      router.push(`/login?phone=${encodeURIComponent(phone.trim())}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Signup failed');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
        <h1 className="text-2xl font-semibold mb-1">Tenant signup</h1>
        <p className="text-sm text-slate-500 mb-6">Use the invite code your landlord gave you.</p>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Your name" value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input required type="tel" placeholder="Phone number"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input required type="password" placeholder="Password (6+ chars)"
            minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input required placeholder="Invite code (e.g. ABC123)"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tracking-wider uppercase" />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? '...' : 'Create account'}
          </button>
        </form>
        <Link href="/login" className="block text-center mt-4 text-xs text-slate-500 hover:text-slate-900">
          Have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
