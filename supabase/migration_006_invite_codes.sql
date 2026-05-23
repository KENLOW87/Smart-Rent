-- Migration 006: per-property invite codes for tenant self-signup

create or replace function gen_invite_code() returns text as $$
  select upper(substring(md5(random()::text), 1, 6));
$$ language sql volatile;

alter table properties add column if not exists invite_code text unique;

-- Backfill existing rows
update properties set invite_code = gen_invite_code() where invite_code is null;

alter table properties alter column invite_code set default gen_invite_code();
alter table properties alter column invite_code set not null;

-- Allow anonymous (anon role) to read just the property id by invite code.
-- Tenant signup is unauthenticated, so we need a function to look up by code.
create or replace function find_property_by_invite(code text)
returns table(property_id uuid, property_name text)
language sql security definer set search_path = public as $$
  select id, name from properties where invite_code = upper(code);
$$;

grant execute on function find_property_by_invite(text) to anon, authenticated;
