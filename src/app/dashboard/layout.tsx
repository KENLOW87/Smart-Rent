import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BottomNav from './BottomNav';
import LogoutButton from './LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single();

  if (profile?.role === 'tenant') redirect('/tenant');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-sm">
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold">Smart Rent</h1>
          <p className="text-xs text-slate-500">
            Hi, {profile?.full_name ?? user.email} · <span className="capitalize">{profile?.role}</span>
          </p>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 p-5 pb-24 overflow-y-auto">{children}</main>

      <BottomNav role={profile?.role ?? 'tenant'} />
    </div>
  );
}
