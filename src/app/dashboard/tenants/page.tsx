import { createClient } from '@/lib/supabase/server';
import { createTenant, deactivateTenant, resetTenantPassword } from './actions';

export default async function TenantsPage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: properties }] = await Promise.all([
    supabase.from('tenants')
      .select('*, properties(name)')
      .order('created_at', { ascending: false }),
    supabase.from('properties').select('id, name').order('name'),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tenants</h2>
        <span className="text-xs text-slate-500">{tenants?.length ?? 0} total</span>
      </div>

      <details className="bg-white border border-slate-200 rounded-2xl p-4">
        <summary className="font-medium text-sm cursor-pointer text-blue-600">+ Add tenant</summary>
        <form action={createTenant} className="grid gap-3 mt-4">
          <select name="property_id" required
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">Select property...</option>
            {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="full_name" required placeholder="Tenant name"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input name="phone" required placeholder="Phone number"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input name="password" type="text" placeholder="Login password (give to tenant)"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            minLength={6} />
          <input name="move_in_date" type="date"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <p className="text-xs text-slate-500">
            Phone + password = tenant login. Leave password blank to track only.
          </p>
          <button className="bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">
            Add tenant
          </button>
        </form>
      </details>

      <div className="space-y-3">
        {tenants?.map((t: { id: string; full_name: string; phone: string | null; properties: { name: string } | null; profile_id: string | null; active: boolean }) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{t.full_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.properties?.name} {t.phone && `· ${t.phone}`}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full ${
                t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.active ? 'Active' : 'Moved out'}
              </span>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
              {t.profile_id ? (
                <form action={resetTenantPassword.bind(null, t.profile_id)} className="flex gap-1.5 flex-1">
                  <input name="password" type="text" placeholder="New password"
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs" />
                  <button className="text-xs bg-slate-100 px-3 rounded hover:bg-slate-200">Reset</button>
                </form>
              ) : (
                <span className="text-xs text-slate-400">No login</span>
              )}
              {t.active && (
                <form action={async () => { 'use server'; await deactivateTenant(t.id); }}>
                  <button className="text-xs text-red-600 hover:underline whitespace-nowrap">Move out</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {!tenants?.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No tenants yet.
          </div>
        )}
      </div>
    </div>
  );
}
