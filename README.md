# Smart Rent

Rental property management for landlords. Track properties, tenants, monthly rent payments, and send automated late-payment reminders via Telegram.

## Features

- Add unlimited properties with rental amount + monthly due day
- Assign tenants to properties
- Monthly payment tracking (paid / partial / pending / late)
- Owner / agent / tenant roles (RLS-enforced)
- Tenant self-view (login → see own property and payment history)
- Telegram bot: tenants link account once, then receive auto reminders
- Daily cron: 3 days before due, on due date, every 3 days overdue

## Stack

Next.js 16 (App Router) · React 19 · Tailwind · Supabase (Postgres + Auth + RLS) · Vercel cron · Telegram Bot API.

---

## Setup

### 1. Supabase

1. Create a project at https://supabase.com
2. In **SQL Editor**, paste and run `supabase/schema.sql`
3. In **Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
4. In **Authentication → Providers**, enable Email (default).
5. For convenience while testing: **Authentication → Settings**, you may disable "Confirm email" so you can log in immediately after sign-up.

### 2. Telegram bot

1. Open Telegram, message **@BotFather**, send `/newbot`
2. Choose a name and username (e.g. `SmartRentBot`)
3. Copy the bot token → `TELEGRAM_BOT_TOKEN`
4. Copy the username (without `@`) → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
5. After deploy, set the webhook (replace placeholders):

   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://your-app.vercel.app/api/telegram/webhook" \
     -d "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>"
   ```

### 3. Local dev

```bash
cp .env.example .env.local
# fill in the values
npm run dev
```

Visit http://localhost:3000.

**First-time setup:**
1. Sign up — you become a `tenant` by default.
2. In Supabase **Table Editor → profiles**, change your row's `role` to `owner`.
3. Refresh — you now have the full dashboard.
4. Add properties, then tenants. Each tenant signs up themselves and links via Telegram.

### 4. Deploy to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in **Project Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_SITE_URL` to your deployed URL.
5. Deploy. The cron in `vercel.json` will run daily at 09:00 UTC.

> Vercel cron auto-attaches a Bearer token via the `Authorization` header. This app uses a simpler `x-cron-secret` header — for production you can either pass the secret via Vercel cron headers or rely on Vercel's source IPs.

---

## How tenants link Telegram

1. Tenant logs into the app and goes to their dashboard.
2. They click **Generate code** → gets e.g. `K7P2QXAB`.
3. They open Telegram, search for your bot, and send: `/start K7P2QXAB`.
4. The bot links their chat ID to their profile. From then on, reminders go to that chat.

## Roles

| Role   | Can do                                            |
|--------|---------------------------------------------------|
| owner  | Everything: properties, tenants, payments, users  |
| agent  | View all data; record payments; cannot delete     |
| tenant | View own property + payment history               |

Change roles in **Settings → Users & roles** (owner only).

## Reminder schedule

The daily cron (`/api/cron`) checks every unpaid payment and sends a Telegram message:
- **3 days before** due date — friendly pre-reminder
- **On the due date** — "due today"
- **Every 3 days after** the due date — overdue notice (with days-late counter)

Each `(payment, kind)` is logged in `reminder_log` so the same reminder won't fire twice in the same day.

## Files of interest

- `supabase/schema.sql` — DB schema + RLS
- `src/app/api/cron/route.ts` — daily reminder logic
- `src/app/api/telegram/webhook/route.ts` — handles `/start CODE` linking
- `src/lib/telegram.ts` — bot helper + message templates
