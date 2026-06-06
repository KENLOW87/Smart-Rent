'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { phoneToEmail, phoneToPassword } from '@/lib/tenant-auth';

export default function LoginPage() {
  const router = useRouter();
  const [tPhone, setTPhone] = useState('');
  const [oEmail, setOEmail] = useState('');
  const [oPhone, setOPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'tenant' | 'owner' | null>(null);

  async function tenantSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy('tenant'); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(tPhone),
      password: phoneToPassword(tPhone),
    });
    setBusy(null);
    if (error) return setErr('Phone number not found. Please check with your landlord.');
    router.push('/'); router.refresh();
  }

  async function ownerSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy('owner'); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: oEmail.trim().toLowerCase(),
      password: phoneToPassword(oPhone),
    });
    setBusy(null);
    if (error) return setErr('Email or phone number is incorrect.');
    router.push('/'); router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-center">Smart Rent</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">Sign in to your account</p>
        {err && <p className="text-sm text-red-600 text-center mb-3">{err}</p>}

        <div className="flex flex-col md:flex-row gap-4">
          {/* Tenant */}
          <section className="flex-1 bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold flex items-center gap-2">🧑 Tenant</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">Sign in with your phone number</p>
            <form onSubmit={tenantSignIn} className="space-y-3">
              <input type="tel" required placeholder="Phone number" value={tPhone}
                onChange={(e) => setTPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <button disabled={busy !== null}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {busy === 'tenant' ? '…' : 'Sign in'}
              </button>
            </form>
          </section>

          {/* Owner / Agent */}
          <section className="flex-1 bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold flex items-center gap-2">🏠 Owner / Agent</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">Sign in with email + phone number</p>
            <form onSubmit={ownerSignIn} className="space-y-3">
              <input type="email" required placeholder="Email" value={oEmail}
                onChange={(e) => setOEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="tel" required placeholder="Phone number" value={oPhone}
                onChange={(e) => setOPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <button disabled={busy !== null}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {busy === 'owner' ? '…' : 'Sign in'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
