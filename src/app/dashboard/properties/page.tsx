import { createClient } from '@/lib/supabase/server';
import { createProperty, deleteProperty, setPropertyAgents } from './actions';

export default async function PropertiesPage() {
  const supabase = await createClient();

  const [{ data: properties }, { data: agents }, { data: assignments }, { data: { user } }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'agent'),
    supabase.from('property_agents').select('property_id, agent_id'),
    supabase.auth.getUser(),
  ]);
  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single();
  const isOwner = me?.role === 'owner';

  const assignedByProperty = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedByProperty.get(a.property_id) ?? [];
    list.push(a.agent_id);
    assignedByProperty.set(a.property_id, list);
  }

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
            <input name="name" required placeholder="Name (e.g. House A)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input name="address" placeholder="Address"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input name="rental_amount" type="number" step="0.01" required placeholder="Rent (RM)"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input name="due_day_of_month" type="number" min="1" max="28" required defaultValue="5"
                placeholder="Due day"
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
          const assigned = assignedByProperty.get(p.id) ?? [];
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.address && <p className="text-xs text-slate-500 mt-0.5">{p.address}</p>}
                </div>
                <span className="text-sm font-bold text-blue-600">
                  RM {Number(p.rental_amount).toFixed(0)}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                <span>📅 Due {p.due_day_of_month} every month</span>
              </div>

              {isOwner && (
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer">
                    Agents in charge ({assigned.length})
                  </summary>
                  <form action={setPropertyAgents.bind(null, p.id)} className="mt-2 space-y-1.5">
                    {agents?.length ? agents.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="agent_id" value={a.id}
                          defaultChecked={assigned.includes(a.id)} />
                        {a.full_name}
                      </label>
                    )) : <p className="text-xs text-slate-400">No agents yet</p>}
                    {agents?.length ? (
                      <button className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg mt-1">
                        Save
                      </button>
                    ) : null}
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
