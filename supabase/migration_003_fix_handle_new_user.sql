-- Migration 003: fix "Database error saving new user"
-- The handle_new_user trigger needs an explicit search_path.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'tenant'::public.user_role
  );
  return new;
end;
$$;
