create or replace function public.sync_profile_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
    set password_changed_at = now(), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_password_changed() from public, anon, authenticated;
grant execute on function public.sync_profile_password_changed() to postgres, service_role;
