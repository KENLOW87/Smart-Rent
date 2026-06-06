const TG_API = 'https://api.telegram.org';

export async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${body}`);
  }
  return res.json();
}

export function formatReminder(opts: {
  tenantName: string;
  propertyName: string;
  amount: number;
  dueDate: string;
  kind: 'pre_due' | 'on_due' | 'overdue';
  daysLate?: number;
}) {
  const amount = `RM ${opts.amount.toFixed(2)}`;
  switch (opts.kind) {
    case 'pre_due':
      return `Hi ${opts.tenantName}, just a friendly reminder that your rental for <b>${opts.propertyName}</b> (${amount}) is due on <b>${opts.dueDate}</b>. Thank you!`;
    case 'on_due':
      return `Hi ${opts.tenantName}, your rental for <b>${opts.propertyName}</b> (${amount}) is due <b>today</b>. Please make payment to avoid late charges.`;
    case 'overdue':
      return `Hi ${opts.tenantName}, your rental for <b>${opts.propertyName}</b> (${amount}) was due on <b>${opts.dueDate}</b> and is now <b>${opts.daysLate} day(s) late</b>. Please settle as soon as possible.`;
  }
}

// Monthly owner summary: who has paid and who hasn't, across ALL properties
// (both owners' tenants). Sent to every owner.
export function formatOwnerSummary(opts: {
  monthLabel: string;
  paid: { property: string; tenant: string; amount: number }[];
  unpaid: { property: string; tenant: string; outstanding: number; due: string }[];
}) {
  const lines: string[] = [];
  lines.push(`📊 <b>Rent summary — ${opts.monthLabel}</b>`);

  lines.push('');
  lines.push(`✅ <b>PAID (${opts.paid.length})</b>`);
  if (opts.paid.length) {
    for (const p of opts.paid) lines.push(`• ${p.property} — ${p.tenant} — RM ${p.amount.toFixed(0)}`);
  } else {
    lines.push('• None yet');
  }

  lines.push('');
  lines.push(`❌ <b>NOT PAID (${opts.unpaid.length})</b>`);
  if (opts.unpaid.length) {
    for (const u of opts.unpaid) lines.push(`• ${u.property} — ${u.tenant} — RM ${u.outstanding.toFixed(0)} (due ${u.due})`);
  } else {
    lines.push('• Everyone has paid 🎉');
  }

  const collected = opts.paid.reduce((s, p) => s + p.amount, 0);
  const outstanding = opts.unpaid.reduce((s, u) => s + u.outstanding, 0);
  lines.push('');
  lines.push(`💰 Collected: RM ${collected.toFixed(0)} · Outstanding: RM ${outstanding.toFixed(0)}`);
  return lines.join('\n');
}
