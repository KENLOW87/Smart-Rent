import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram } from '@/lib/telegram';

// Telegram webhook: handles /start <CODE> to link a user's chat_id.
// Set this URL with Telegram setWebhook after deploy.
export async function POST(req: Request) {
  // Optional secret check via Telegram's secret_token header
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET &&
      secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json();
  const msg = update?.message;
  if (!msg?.text || !msg?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(msg.chat.id);
  const text: string = msg.text.trim();
  const supabase = createAdminClient();

  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]?.toUpperCase();
    if (!code) {
      await sendTelegram(chatId,
        'Welcome! To link your account, generate a code in the Smart Rent app, then send: <code>/start YOUR_CODE</code>');
      return NextResponse.json({ ok: true });
    }
    const { data: profile } = await supabase
      .from('profiles').select('id, full_name')
      .eq('telegram_link_code', code).maybeSingle();
    if (!profile) {
      await sendTelegram(chatId, 'Code not recognized. Generate a fresh code in the app and try again.');
      return NextResponse.json({ ok: true });
    }
    await supabase.from('profiles')
      .update({ telegram_chat_id: chatId, telegram_link_code: null })
      .eq('id', profile.id);
    await sendTelegram(chatId, `Hi ${profile.full_name ?? ''}! Your account is linked. You'll get rent reminders here.`);
    return NextResponse.json({ ok: true });
  }

  if (text === '/help') {
    await sendTelegram(chatId, 'Smart Rent bot. Send <code>/start CODE</code> to link your account.');
  }

  return NextResponse.json({ ok: true });
}
