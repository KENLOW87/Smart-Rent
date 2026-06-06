import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createProperty, deleteProperty, addTenantToProperty, moveOutTenant,
  setPropertyOwner, editProperty, editTenant,
} from './actions';
import SaveForm from './SaveForm';

// WhatsApp click-to-chat link with a prefilled tenant invite message.
function waLink(name: string, phone: string, property: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://smart-rent-wheat.vercel.app';
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('60') ? digits : digits.startsWith('0') ? '60' + digits.slice(1) : '60' + digits;
  const msg =
    `Hi ${name} \u{1F44B} Here's your Smart Rent app for ${property} \u{2014} check & pay your rent:\n` +
    `\u{1F449} ${site}\n` +
    `Login: your phone no. ${phone} (no password)\n` +
    `Tap the link, then "Install" to add it to your phone \u{1F4F2}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

export default async function PropertiesPage() {
  const supabase = await createClient();

  const [{ data: properties }, { data: owners }, { data: tenants }, { data: { user } }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'owner'),
    supabase.from('tenants').select('id, property_id, full_name, phone, active').eq('active', true),
    supabase.auth.getUser(),
  ]);
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const isOwner = me?.role === 'owner';

  // Owner bank details (admin read — bank fields only, never the secret key).
  const admin = createAdminClient();
  const { data: ownerBanks } = await admin
    .from('profiles').select('id, bank_name, bank_account_no, bank_account_name').eq('role', 'owner');
  const bankByOwner = new Map((ownerBanks ?? []).map((o) => [o.id, o]));

  const tenantByProperty = new Map<string, { id: string; full_name: string; phone: string | null }>();
  for (const t of tenants ?? []) {
    if (!tenantByProperty.has(t.property_id)) {
      tenantByProperty.set(t.property_id, { id: t.id, full_name: t.full_name, phone: t.phone });
    }
  }
  const ownerName = (id: string | null | undefined) =>
    owners?.find((o) => o.id === id)?.full_name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Properties</h2>
        <span className="text-xs text-slate-500">{properties?.length ?? 0} total</span>
      </div>

      {isOwner && (
        <details className="bg-white border border-slate-200 rounded-2xl p-4">
          <summary className="font-medium text-sm cursor-pointer text-blue-600">+ Add property</summary>
          <form action={createProperty} className="grid gap-3 mt-4">
            <input name="name" required placeholder="Property name (e.g. House A)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input name="rental_amount" type="number" step="0.01" required placeholder="Rent (RM)"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input name="due_day_of_month" type="number" min="1" max="28" required defaultValue="5"
                placeholder="Due day"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <label className="text-xs text-slate-600">
              Belongs to (owner — rent goes to their account)
              <select name="owner_id" defaultValue={user?.id}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                {owners?.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </select>
            </label>
            <div className="border-t border-slate-100 pt-3 grid gap-3">
              <p className="text-xs font-medium text-slate-700">
                Tenant <span className="font-normal text-slate-400">(leave blank if vacant)</span>
              </p>
              <input name="tenant_name" placeholder="Tenant name"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input name="tenant_phone" placeholder="Tenant phone (their login)"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <textarea name="notes" placeholder="Notes (optional)" rows={2}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <button className="bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">
              Add property
            </button>
          </form>
        </details>
      )}

      <div className="space-y-3">
        {properties?.map((p) => {
          const tenant = tenantByProperty.get(p.id);
          const ob = bankByOwner.get(p.owner_id);
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">📅 Due day {p.due_day_of_month}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">🏠 Owner: {ownerName(p.owner_id)}</p>
                  {(ob?.bank_name || ob?.bank_account_no) && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      🏦 {ob?.bank_name} · {ob?.bank_account_no}
                      {ob?.bank_account_name ? ` · ${ob.bank_account_name}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600">
                  RM {Number(p.rental_amount).toFixed(0)}
                </span>
              </div>

              {/* Tenant */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3">
                {tenant ? (
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Tenant</p>
                    <p className="text-sm font-medium">{tenant.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      Login: <span className="font-mono text-slate-700">{tenant.phone}</span>
                    </p>
                    {isOwner && (
                      <div className="flex items-center gap-2 mt-3">
                        {tenant.phone && (
                          <a href={waLink(tenant.full_name, tenant.phone, p.name)}
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1 text-xs bg-emerald-500 text-white py-2 rounded-lg font-medium">
                            💬 WhatsApp app link
                          </a>
                        )}
                        <form action={async () => { 'use server'; await moveOutTenant(tenant.id); }}>
                          <button className="text-xs text-red-600 hover:underline px-2 py-2">Move out</button>
                        </form>
                      </div>
                    )}
                    {isOwner && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer">Edit tenant name / phone</summary>
                        <SaveForm action={editTenant.bind(null, tenant.id)} label="Save tenant">
                          <input name="tenant_name" defaultValue={tenant.full_name} required placeholder="Tenant name"
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                          <input name="tenant_phone" defaultValue={tenant.phone ?? ''} required placeholder="Tenant phone (login)"
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </SaveForm>
                      </details>
                    )}
                  </div>
                ) : isOwner ? (
                  <details>
                    <summary className="text-xs text-blue-600 cursor-pointer">Vacant — + Add tenant</summary>
                    <form action={addTenantToProperty.bind(null, p.id)} className="grid gap-2 mt-2">
                      <input name="tenant_name" required placeholder="Tenant name"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      <input name="tenant_phone" required placeholder="Tenant phone (login)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      <button className="text-xs bg-blue-600 text-white py-2 rounded-lg">Add tenant</button>
                    </form>
                  </details>
                ) : (
                  <p className="text-xs text-slate-400">Vacant</p>
                )}
              </div>

              {isOwner && (
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer">✏️ Edit property</summary>
                  <SaveForm action={editProperty.bind(null, p.id)} label="Save changes">
                    <input name="name" defaultValue={p.name} required placeholder="Property name"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input name="rental_amount" type="number" step="0.01" defaultValue={p.rental_amount} required placeholder="Rent (RM)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      <input name="due_day_of_month" type="number" min="1" max="28" defaultValue={p.due_day_of_month} required placeholder="Due day"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </SaveForm>
                </details>
              )}

              {isOwner && owners && owners.length > 1 && (
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer">Change owner</summary>
                  <form action={setPropertyOwner.bind(null, p.id)} className="flex gap-2 mt-2">
                    <select name="owner_id" defaultValue={p.owner_id}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm bg-white">
                      {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                    </select>
                    <button className="text-xs bg-slate-900 text-white px-3 rounded">Save</button>
                  </form>
                </details>
              )}

              {isOwner && (
                <form action={async () => { 'use server'; await deleteProperty(p.id); }}
                  className="mt-3 border-t border-slate-100 pt-3">
                  <button className="text-xs text-red-600 hover:underline">Delete property</button>
                </form>
              )}
            </div>
          );
        })}
        {!properties?.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No properties yet. {isOwner && 'Tap + Add property above.'}
          </div>
        )}
      </div>
    </div>
  );
}
