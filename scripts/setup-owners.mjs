// One-off: create/update the owner accounts (email + phone-as-password, role=owner).
// Reads keys from .env.local (not committed). Run: node scripts/setup-owners.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function phoneToPassword(phone) {
  const d = phone.replace(/[^a-zA-Z0-9]/g, '');
  return d.length >= 6 ? d : (d + '000000').slice(0, 6);
}

const owners = [
  { email: 'ken.coades@gmail.com', phone: '0193652205', name: 'Ken' },
  { email: 'perry.perry.chan0@gmail.com', phone: '0163876888', name: 'Perry' },
  { email: 'limpohkeong1229@gmail.com', phone: '0166838038', name: 'Lim Poh Keong' },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

for (const o of owners) {
  const password = phoneToPassword(o.phone);
  let userId = null;

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: o.email, password, email_confirm: true,
    user_metadata: { full_name: o.name, phone: o.phone },
  });

  if (cErr) {
    const existing = await findUserByEmail(o.email);
    if (!existing) { console.log(`SKIP ${o.email}: ${cErr.message}`); continue; }
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    userId = created.user?.id ?? null;
  }

  if (userId) {
    await admin.from('profiles').update({ role: 'owner', phone: o.phone, full_name: o.name }).eq('id', userId);
    console.log(`OK  ${o.email}  -> owner, login password = ${password}`);
  }
}
console.log('done');
