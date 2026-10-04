-- DOSSORA — Migration 003: verrouillage des notifications et abonnements newsletter.
-- À exécuter après le schéma existant. Additive; aucune commande destructive.

begin;

alter table public.newsletter_subscribers
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

-- Les clients ne peuvent pas modifier eux-mêmes leur email Auth ni leur rôle dans public.profiles.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, country_code, city, admin_language) on public.profiles to authenticated;

-- La fiche admin expose une activité agrégée sans créer de nouvelle donnée personnelle.
create or replace view public.customers with (security_invoker = true) as
select p.id, p.first_name, p.last_name, p.email, p.phone, p.country_code, p.city, p.created_at,
  (select count(*) from public.orders o where o.user_id = p.id) as orders_count,
  coalesce((select sum(o.total) from public.orders o where o.user_id = p.id
            and o.status in ('paid','preparing','delivering','delivered')), 0) as total_spent,
  (select max(activity.at) from (
    select o.created_at as at from public.orders o where o.user_id = p.id
    union all
    select c.last_message_at as at from public.conversations c where c.user_id = p.id
  ) activity) as last_activity
from public.profiles p where p.role = 'customer';

-- Le profil est toujours créé comme customer, et l'inscription déclenche une notification admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, country_code, city)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data->>'first_name', 80), ''),
    coalesce(left(new.raw_user_meta_data->>'last_name', 80), ''),
    new.email,
    left(new.raw_user_meta_data->>'phone', 30),
    left(new.raw_user_meta_data->>'country_code', 2),
    left(new.raw_user_meta_data->>'city', 120)
  ) on conflict (id) do nothing;
  insert into public.notifications (audience, type, params, link)
  values ('admin', 'new_customer', jsonb_build_object('email', new.email), '/admin/customers');
  return new;
end $$;

create or replace function public.set_newsletter_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  new.user_id := auth.uid();
  return new;
end $$;
drop trigger if exists trg_newsletter_owner on public.newsletter_subscribers;
create trigger trg_newsletter_owner before insert on public.newsletter_subscribers
  for each row execute function public.set_newsletter_owner();

create or replace function public.notify_new_newsletter_subscriber() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (audience, type, params, link)
  values ('admin', 'newsletter_signup', jsonb_build_object('email', new.email), '/admin/newsletter');
  return new;
end $$;
drop trigger if exists trg_newsletter_admin_notification on public.newsletter_subscribers;
create trigger trg_newsletter_admin_notification after insert on public.newsletter_subscribers
  for each row execute function public.notify_new_newsletter_subscriber();

create or replace function public.admin_send_promotion(p_user_ids uuid[], p_all boolean, p_title text, p_message text, p_code text default null)
returns int language plpgsql security definer set search_path = public as $$
declare recipients uuid[]; requested int; sent int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120
     or char_length(trim(coalesce(p_message, ''))) not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
  if p_all then
    select coalesce(array_agg(id order by id), '{}') into recipients from public.profiles where role = 'customer';
  else
    select count(distinct input.user_id)::int into requested from unnest(coalesce(p_user_ids, '{}')) as input(user_id);
    select coalesce(array_agg(distinct p.id order by p.id), '{}') into recipients
      from unnest(coalesce(p_user_ids, '{}')) as input(user_id) join public.profiles p on p.id = input.user_id and p.role = 'customer';
    if cardinality(recipients) <> requested then raise exception 'INVALID_RECIPIENTS'; end if;
  end if;
  if cardinality(recipients) = 0 then raise exception 'NO_RECIPIENTS'; end if;
  if nullif(trim(p_code), '') is not null then
    update public.discount_codes set target_user_ids = case when p_all then null else recipients end
    where upper(code) = upper(trim(p_code)) and is_active;
    if not found then raise exception 'PROMO_INVALID'; end if;
  end if;
  insert into public.notifications (audience, user_id, type, params, link)
  select 'user', selected.user_id, 'promotion', jsonb_build_object('title', trim(p_title), 'message', trim(p_message), 'code', nullif(trim(p_code), '')), '/shop'
  from unnest(recipients) as selected(user_id);
  get diagnostics sent = row_count;
  insert into public.notifications (audience, type, params, link)
  values ('admin', 'promotion_sent', jsonb_build_object('title', trim(p_title), 'recipients', sent), '/admin/promotions');
  return sent;
end $$;
revoke all on function public.admin_send_promotion(uuid[], boolean, text, text, text) from public, anon;
grant execute on function public.admin_send_promotion(uuid[], boolean, text, text, text) to authenticated;

-- Les clients n'altèrent que read_at et ne peuvent supprimer que leurs propres notifications.
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_delete_own" on public.notifications for delete to authenticated
  using (audience = 'user' and user_id = auth.uid());
drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications for update to authenticated
  using (audience = 'user' and user_id = auth.uid())
  with check (audience = 'user' and user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
grant insert, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Les réglages non-publics ne sont plus lisibles avec la clé anon.
drop policy if exists "settings_read" on public.shop_settings;
create policy "settings_read" on public.shop_settings for select to anon, authenticated using (key = 'general');

-- Expiration appelée en interne par create_order/admin_dashboard, pas directement par un client.
revoke all on function public.release_expired_reservations() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
