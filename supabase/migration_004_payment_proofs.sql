-- Migration 004: payment proofs + AI verification
-- Run AFTER schema.sql, 002, 003.

create type proof_status as enum ('pending', 'verified', 'mismatch', 'error');

create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_path text not null,            -- storage path within payment-proofs bucket
  mime_type text not null,
  status proof_status not null default 'pending',
  ai_amount numeric(10,2),
  ai_date date,
  ai_reference text,
  ai_bank text,
  ai_notes text,
  ai_raw jsonb,
  uploaded_at timestamptz default now()
);

alter table payment_proofs enable row level security;

-- owner full access
create policy "owner full access proofs" on payment_proofs
  for all using (app_user_role() = 'owner');

-- agent: read proofs for their assigned properties
create policy "agent read assigned proofs" on payment_proofs
  for select using (
    app_user_role() = 'agent'
    and payment_id in (
      select id from payments
      where property_id in (select my_assigned_property_ids())
    )
  );

-- tenant: read & insert own proofs
create policy "tenant read own proofs" on payment_proofs
  for select using (
    payment_id in (
      select p.id from payments p
      join tenants t on t.id = p.tenant_id
      where t.profile_id = auth.uid()
    )
  );
create policy "tenant insert own proofs" on payment_proofs
  for insert with check (
    uploaded_by = auth.uid()
    and payment_id in (
      select p.id from payments p
      join tenants t on t.id = p.tenant_id
      where t.profile_id = auth.uid()
    )
  );

-- =========================================================
-- Storage bucket for the actual PDF files
-- =========================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Storage policies
create policy "owner read all proofs" on storage.objects
  for select using (
    bucket_id = 'payment-proofs' and app_user_role() = 'owner'
  );

create policy "agent read assigned proofs in storage" on storage.objects
  for select using (
    bucket_id = 'payment-proofs' and app_user_role() = 'agent'
  );

create policy "tenant upload own proofs" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tenant read own files" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
