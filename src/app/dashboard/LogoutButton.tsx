'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <button onClick={logout}
      className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1 rounded-full">
      Sign out
    </button>
  );
}
