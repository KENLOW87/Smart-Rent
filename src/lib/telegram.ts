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
