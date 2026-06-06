import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram, formatReminder, formatOwnerSummary } from '@/lib/telegram';

// Daily cron — runs via Vercel cron (see vercel.json).
// 1. Auto-generate payment rows for the current month if missing.
// 2. For each unpaid payment: send reminder 3 days before due, on due, and every 3 days overdue.
// 3. Mark overdue rows as 'late'.
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Vercel cron sends the secret as "Authorization: Bearer <CRON_SECRET>".
  // Also accept x-cron-secret header or ?secret= for manual testing.
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret') ?? bearer;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const forceSummary = url.searchParams.get('summary') === '1';

  const supabase = createAdminClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.toISOString().slice(0, 10);

  // 1) Ensure payment rows exist for this month
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, property_id, properties(rental_amount, due_day_of_month)')
    .eq('active', true);

  type TenantRow = {
    id: string; property_id: string;
    properties: { rental_amount: number; due_day_of_month: number } | null;
  };

  if (tenants?.length) {
    const rows = (tenants as unknown as TenantRow[]).map((t) => {
      const dueDay = t.properties?.due_day_of_month ?? 5;
      const due = new Date(Date.UTC(year, month - 1, dueDay)).toISOString().slice(0, 10);
      return {
        tenant_id: t.id,
        property_id: t.property_id,
        period_year: year,
        period_month: month,
        amount_due: t.properties?.rental_amount ?? 0,
        due_date: due,
        status: 'pending' as const,
      };
    });
    await supabase.from('payments').upsert(rows, {
      onConflict: 'tenant_id,period_year,period_month',
      ignoreDuplicates: true,
    });
  }

  // 2) Fetch unpaid payments and decide reminders
  const { data: unpaid } = await supabase
    .from('payments')
    .select('*, tenants(full_name, profiles:profile_id(telegram_chat_id)), properties(name)')
    .in('status', ['pending', 'partial', 'late'])
    .eq('hidden', false);

  let sent = 0;

  type Row = {
    id: string; due_date: string; amount_due: number; status: string;
    tenants: { full_name: string; profiles: { telegram_chat_id: string | null } | null } | null;
    properties: { name: string } | null;
  };

  for (const p of (unpaid ?? []) as Row[]) {
    const chatId = p.tenants?.profiles?.telegram_chat_id;
    if (!chatId) continue;

    const daysToDue = Math.floor((Date.parse(p.due_date) - Date.parse(today)) / 86400000);

    let kind: 'pre_due' | 'on_due' | 'overdue' | null = null;
    if (daysToDue === 3) kind = 'pre_due';
    else if (daysToDue === 0) kind = 'on_due';
    else if (daysToDue < 0 && (-daysToDue) % 3 === 0) kind = 'overdue';

    if (!kind) continue;

    // de-dup: don't send same kind twice in one day
    const { data: existing } = await supabase
      .from('reminder_log').select('id')
      .eq('payment_id', p.id).eq('kind', kind)
      .gte('sent_at', `${today}T00:00:00Z`)
      .limit(1);
    if (existing?.length) continue;

    try {
      await sendTelegram(chatId, formatReminder({
        tenantName: p.tenants?.full_name ?? 'tenant',
        propertyName: p.properties?.name ?? '',
        amount: Number(p.amount_due),
        dueDate: p.due_date,
        kind,
        daysLate: -daysToDue,
      }));
      await supabase.from('reminder_log').insert({ payment_id: p.id, kind });
      sent++;
    } catch (e) {
      console.error('Telegram send error', e);
    }

    // mark overdue
    if (daysToDue < 0 && p.status === 'pending') {
      await supabase.from('payments').update({ status: 'late' }).eq('id', p.id);
    }
  }

  // 3) Monthly owner summary — on the 15th, send the full paid/unpaid list
  //    (all properties, both owners' tenants) to every owner with Telegram linked.
  let summarySent = 0;
  if (now.getDate() === 15 || forceSummary) {
    const { data: monthPayments } = await supabase
      .from('payments')
      .select('amount_due, amount_paid, due_date, tenants(full_name), properties(name)')
      .eq('period_year', year).eq('period_month', month).eq('hidden', false);

    type SumRow = {
      amount_due: number; amount_paid: number; due_date: string;
      tenants: { full_name: string } | null; properties: { name: string } | null;
    };
    const paidList: { property: string; tenant: string; amount: number }[] = [];
    const unpaidList: { property: string; tenant: string; outstanding: number; due: string }[] = [];
    for (const p of (monthPayments ?? []) as unknown as SumRow[]) {
      const property = p.properties?.name ?? '—';
      const tenant = p.tenants?.full_name ?? '—';
      const due = Number(p.amount_due);
      const paidAmt = Number(p.amount_paid);
      if (due > 0 && paidAmt >= due) paidList.push({ property, tenant, amount: paidAmt });
      else unpaidList.push({ property, tenant, outstanding: due - paidAmt, due: p.due_date });
    }

    const monthLabel = new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
    const summary = formatOwnerSummary({ monthLabel, paid: paidList, unpaid: unpaidList });

    const { data: owners } = await supabase
      .from('profiles').select('telegram_chat_id')
      .eq('role', 'owner').not('telegram_chat_id', 'is', null);

    for (const o of (owners ?? []) as { telegram_chat_id: string | null }[]) {
      if (!o.telegram_chat_id) continue;
      try {
        await sendTelegram(o.telegram_chat_id, summary);
        summarySent++;
      } catch (e) {
        console.error('Summary send error', e);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, scanned: unpaid?.length ?? 0, summarySent });
}
