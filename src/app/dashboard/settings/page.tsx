import { createClient } from '@/lib/supabase/server';
import { generateLinkCode, setUserRole } from './actions';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single();

  const { data: allProfiles } = await supabase
    .from('profiles').select('id, full_name, role, telegram_chat_id');

  const botUser = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'YOUR_BOT';

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h3 className="font-medium mb-2">Link your Telegram</h3>
        <p className="text-sm text-slate-600 mb-3">
          To receive notifications via Telegram, generate a link code below and message
          our bot <code className="bg-slate-100 px-1 rounded">@{botUser}</code> with:
          {' '}<code className="bg-slate-100 px-1 rounded">/start YOUR_CODE</code>.
        </p>
        <div className="flex items-center gap-3">
          <form action={generateLinkCode}>
            <button className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg">
              {profile?.telegram_link_code ? 'Regenerate code' : 'Generate code'}
            </button>
          </form>
          {profile?.telegram_link_code && (
            <code className="bg-slate-100 px-3 py-2 rounded-lg text-sm">
              {profile.telegram_link_code}
            </code>
          )}
          {profile?.telegram_chat_id && (
            <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              Telegram linked ✓
            </span>
          )}
        </div>
      </section>

      {profile?.role === 'owner' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-medium mb-2">Users & roles</h3>
          <p className="text-sm text-slate-600 mb-4">
            Sign-ups default to <b>tenant</b>. Promote your agent to <b>agent</b>, and promote
            yourself to <b>owner</b> after first signup.
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">User</th><th className="py-2">Role</th><th></th></tr>
            </thead>
            <tbody>
              {allProfiles?.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2">{p.full_name}</td>
                  <td className="py-2 capitalize">{p.role}</td>
                  <td className="py-2 text-right">
                    <form action={setUserRole.bind(null, p.id)} className="inline-flex gap-2">
                      <select name="role" defaultValue={p.role}
                        className="px-2 py-1 border border-slate-300 rounded text-sm">
                        <option value="owner">owner</option>
                        <option value="agent">agent</option>
                        <option value="tenant">tenant</option>
                      </select>
                      <button className="text-xs bg-slate-900 text-white px-3 rounded">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
