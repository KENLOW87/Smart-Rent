import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram, formatReminder } from '@/lib/telegram';

// Daily cron — runs via Vercel cron (see vercel.json).
// 1. Auto-generate payment rows for the current month if missing.
// 2. For each unpaid payment: send reminder 3 days before due, on due, and every 3 days overdue.
// 3. Mark overdue rows as 'late'.
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

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

  return NextResponse.json({ ok: true, sent, scanned: unpaid?.length ?? 0 });
}
