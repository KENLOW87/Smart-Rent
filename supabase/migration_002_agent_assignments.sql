-- Migration 002: per-agent property assignments
-- Run this in Supabase SQL editor AFTER schema.sql

-- Join table: which agent handles which property
create table if not exists property_agents (
  property_id uuid references properties(id) on delete cascade,
  agent_id uuid references profiles(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (property_id, agent_id)
);

alter table property_agents enable row level security;

create policy "owner full access property_agents" on property_agents
  for all using (app_user_role() = 'owner');
create policy "agent read own assignments" on property_agents
  for select using (agent_id = auth.uid());

-- Helper: list of property_ids the current agent is assigned to
create or replace function my_assigned_property_ids() returns setof uuid as $$
  select property_id from property_agents where agent_id = auth.uid();
$$ language sql stable security definer;

-- Replace agent read policies on properties/tenants/payments
-- to scope by assignment.

drop policy if exists "agent read properties" on properties;
create policy "agent read assigned properties" on properties
  for select using (
    app_user_role() = 'agent'
    and id in (select my_assigned_property_ids())
  );

drop policy if exists "agent read tenants" on tenants;
create policy "agent read assigned tenants" on tenants
  for select using (
    app_user_role() = 'agent'
    and property_id in (select my_assigned_property_ids())
  );

drop policy if exists "agent read/update payments" on payments;
drop policy if exists "agent insert payments" on payments;
drop policy if exists "agent update payments" on payments;

create policy "agent read assigned payments" on payments
  for select using (
    app_user_role() = 'agent'
    and property_id in (select my_assigned_property_ids())
  );
create policy "agent insert assigned payments" on payments
  for insert with check (
    app_user_role() = 'agent'
    and property_id in (select my_assigned_property_ids())
  );
create policy "agent update assigned payments" on payments
  for update using (
    app_user_role() = 'agent'
    and property_id in (select my_assigned_property_ids())
  );
