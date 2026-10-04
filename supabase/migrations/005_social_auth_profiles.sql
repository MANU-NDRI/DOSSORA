-- DOSSORA — migration 005 : compléter les profils créés par OAuth.
-- Additive : conserve les profils existants et ne modifie jamais leur rôle.
begin;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full jsonb;
  v_name text;
  v_first text;
  v_last text;
begin
  v_full := coalesce(v_meta->'full_name', v_meta->'name');
  if jsonb_typeof(v_full) = 'object' then
    v_first := coalesce(v_meta->>'first_name', v_meta->>'given_name', v_full->>'givenName', v_full->>'firstName');
    v_last := coalesce(v_meta->>'last_name', v_meta->>'family_name', v_full->>'familyName', v_full->>'lastName');
  else
    v_name := coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''));
    v_first := coalesce(v_meta->>'first_name', v_meta->>'given_name', split_part(trim(coalesce(v_name, '')), ' ', 1));
    v_last := coalesce(v_meta->>'last_name', v_meta->>'family_name', nullif(trim(substr(trim(coalesce(v_name, '')), length(split_part(trim(coalesce(v_name, '')), ' ', 1)) + 1)), ''));
  end if;

  insert into public.profiles (id, first_name, last_name, email, phone, country_code, city, role)
  values (new.id, coalesce(left(v_first, 80), ''), coalesce(left(v_last, 80), ''), new.email,
    left(v_meta->>'phone', 30), left(v_meta->>'country_code', 2), left(v_meta->>'city', 120), 'customer')
  on conflict (id) do nothing;

  insert into public.notifications (audience, type, params, link)
  values ('admin', 'new_customer', jsonb_build_object('email', new.email), '/admin/customers');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_meta jsonb;
  v_full jsonb;
  v_name text;
  v_first text;
  v_last text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return; end if;
  select * into v_user from auth.users where id = v_uid;
  if not found then raise exception 'AUTH_REQUIRED'; end if;

  v_meta := coalesce(v_user.raw_user_meta_data, '{}'::jsonb);
  v_full := coalesce(v_meta->'full_name', v_meta->'name');
  if jsonb_typeof(v_full) = 'object' then
    v_first := coalesce(v_meta->>'first_name', v_meta->>'given_name', v_full->>'givenName', v_full->>'firstName');
    v_last := coalesce(v_meta->>'last_name', v_meta->>'family_name', v_full->>'familyName', v_full->>'lastName');
  else
    v_name := coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''));
    v_first := coalesce(v_meta->>'first_name', v_meta->>'given_name', split_part(trim(coalesce(v_name, '')), ' ', 1));
    v_last := coalesce(v_meta->>'last_name', v_meta->>'family_name', nullif(trim(substr(trim(coalesce(v_name, '')), length(split_part(trim(coalesce(v_name, '')), ' ', 1)) + 1)), ''));
  end if;

  insert into public.profiles (id, first_name, last_name, email, phone, country_code, city, role)
  values (v_uid, coalesce(left(v_first, 80), ''), coalesce(left(v_last, 80), ''), v_user.email,
    left(v_meta->>'phone', 30), left(v_meta->>'country_code', 2), left(v_meta->>'city', 120), 'customer')
  on conflict (id) do nothing;
end $$;

revoke all on function public.ensure_profile() from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
notify pgrst, 'reload schema';
commit;
