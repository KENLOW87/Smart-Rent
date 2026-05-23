import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram, formatReminder } from '@/lib/telegram';

// Manual reminder trigger from the dashboard.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { payment_id } = await req.json();
  if (!payment_id) return NextResponse.json({ ok: false, error: 'payment_id required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('*, tenants(full_name, profile_id, profiles:profile_id(telegram_chat_id)), properties(name)')
    .eq('id', payment_id).single();

  if (!payment) return NextResponse.json({ ok: false, error: 'payment not found' }, { status: 404 });

  type Joined = {
    amount_due: number; due_date: string;
    tenants: { full_name: string; profiles: { telegram_chat_id: string | null } | null } | null;
    properties: { name: string } | null;
  };
  const p = payment as unknown as Joined;
  const chatId = p.tenants?.profiles?.telegram_chat_id;
  if (!chatId) return NextResponse.json({ ok: false, error: 'tenant has no Telegram linked' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const kind = p.due_date < today ? 'overdue' : p.due_date === today ? 'on_due' : 'pre_due';
  const daysLate = Math.max(0, Math.floor((Date.parse(today) - Date.parse(p.due_date)) / 86400000));

  const text = formatReminder({
    tenantName: p.tenants?.full_name ?? 'tenant',
    propertyName: p.properties?.name ?? '',
    amount: Number(p.amount_due),
    dueDate: p.due_date,
    kind,
    daysLate,
  });
  await sendTelegram(chatId, text);
  await supabase.from('reminder_log').insert({ payment_id, kind });

  return NextResponse.json({ ok: true });
}
