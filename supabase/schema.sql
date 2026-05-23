-- Smart Rent database schema
-- Run this in Supabase SQL editor after creating a new project.

-- =========================================================
-- profiles: extends auth.users with role
-- =========================================================
create type user_role as enum ('owner', 'agent', 'tenant');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'tenant',
  telegram_chat_id text,           -- set when user links Telegram bot
  telegram_link_code text,         -- short code used to link the bot
  phone text,
  created_at timestamptz default now()
);

-- Auto-create profile row when a new auth user signs up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'tenant');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- properties: each rental unit
-- =========================================================
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,             -- e.g. "House A - Jalan Bukit 12"
  address text,
  rental_amount numeric(10,2) not null,
  due_day_of_month int not null default 5 check (due_day_of_month between 1 and 28),
  notes text,
  created_at timestamptz default now()
);

-- =========================================================
-- tenants: tenant assigned to a property
-- =========================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,  -- nullable: tenant may not have login yet
  full_name text not null,
  phone text,
  email text,
  move_in_date date,
  move_out_date date,
  active boolean default true,
  created_at timestamptz default now()
);

-- =========================================================
-- payments: monthly rental payment records
-- =========================================================
create type payment_status as enum ('pending', 'paid', 'partial', 'late');

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  period_year int not null,        -- e.g. 2026
  period_month int not null check (period_month between 1 and 12),
  amount_due numeric(10,2) not null,
  amount_paid numeric(10,2) default 0,
  paid_at timestamptz,
  due_date date not null,
  status payment_status not null default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, period_year, period_month)
);

-- =========================================================
-- reminder_log: avoid double-sending the same reminder
-- =========================================================
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  kind text not null,              -- 'pre_due' | 'on_due' | 'overdue'
  sent_at timestamptz default now(),
  channel text default 'telegram'
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table profiles enable row level security;
alter table properties enable row level security;
alter table tenants enable row level security;
alter table payments enable row level security;
alter table reminder_log enable row level security;

-- Helper: get current role
create or replace function app_user_role() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- profiles policies
create policy "users can read own profile" on profiles
  for select using (id = auth.uid() or app_user_role() in ('owner','agent'));
create policy "users can update own profile" on profiles
  for update using (id = auth.uid() or app_user_role() = 'owner');

-- properties: owners full access, agents read/update, tenants read own
create policy "owner full access properties" on properties
  for all using (app_user_role() = 'owner');
create policy "agent read properties" on properties
  for select using (app_user_role() = 'agent');
create policy "tenant read own property" on properties
  for select using (
    id in (select property_id from tenants where profile_id = auth.uid())
  );

-- tenants
create policy "owner full access tenants" on tenants
  for all using (app_user_role() = 'owner');
create policy "agent read tenants" on tenants
  for select using (app_user_role() = 'agent');
create policy "tenant read self" on tenants
  for select using (profile_id = auth.uid());

-- payments
create policy "owner full access payments" on payments
  for all using (app_user_role() = 'owner');
create policy "agent read/update payments" on payments
  for select using (app_user_role() = 'agent');
create policy "agent insert payments" on payments
  for insert with check (app_user_role() = 'agent');
create policy "agent update payments" on payments
  for update using (app_user_role() = 'agent');
create policy "tenant read own payments" on payments
  for select using (
    tenant_id in (select id from tenants where profile_id = auth.uid())
  );

-- reminder_log: owner/service only
create policy "owner read reminders" on reminder_log
  for select using (app_user_role() = 'owner');
