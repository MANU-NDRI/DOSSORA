-- =====================================================================
-- DOSSORA — schema.sql
-- À exécuter en premier dans Supabase → SQL Editor.
-- =====================================================================
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  country_code text,
  city text,
  role text not null default 'customer' check (role in ('customer','admin')),
  admin_language text check (admin_language in ('fr','en','ar')),  -- langue de l'administration (réservée aux admins)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Empêche un client de modifier son propre rôle (le SQL Editor, sans auth.uid(), reste autorisé).
create or replace function public.prevent_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger trg_profiles_role before update on public.profiles for each row execute function public.prevent_role_change();

-- Seul un admin peut définir admin_language (ignoré pour un client). Voir migrations/001_admin_language_and_hero.sql.
create or replace function public.protect_admin_language() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.admin_language is distinct from old.admin_language and auth.uid() is not null and not public.is_admin() then
    new.admin_language := old.admin_language;
  end if;
  return new;
end $$;
create trigger trg_profiles_admin_language before update on public.profiles for each row execute function public.protect_admin_language();

-- Création automatique du profil après inscription (Supabase Auth). Le rôle est TOUJOURS 'customer'.
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- CATALOGUE ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name_fr text not null, name_en text, name_ar text,
  description_fr text, description_en text, description_ar text,
  image_url text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_categories_parent on public.categories(parent_id);
create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  sku text unique,
  name_fr text not null, name_en text, name_ar text,
  description_fr text, description_en text, description_ar text,
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_featured boolean not null default false,
  is_popular boolean not null default false,
  is_new boolean not null default false,
  is_on_sale boolean not null default false,
  available_stock int not null default 0,   -- maintenu par trigger (stock - réservé)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_status_created on public.products(status, created_at desc);
create index if not exists idx_products_flags on public.products(is_new, is_popular, is_featured, is_on_sale);
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id, sort_order);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  color text, size text, shoe_size text,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  stock int not null default 0 check (stock >= 0),
  reserved int not null default 0 check (reserved >= 0),
  low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved <= stock)
);
create index if not exists idx_variants_product on public.product_variants(product_id);
create trigger trg_variants_updated before update on public.product_variants for each row execute function public.set_updated_at();

create or replace function public.sync_product_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set available_stock = coalesce((
    select sum(greatest(v.stock - v.reserved, 0)) from public.product_variants v where v.product_id = pid), 0)
  where p.id = pid;
  return null;
end $$;
create trigger trg_variants_sync after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock();

-- ---------- LIVRAISON ----------
create table if not exists public.shipping_countries (
  code text primary key check (char_length(code) = 2),
  name_fr text not null, name_en text, name_ar text,
  currency text not null default 'MAD',
  exchange_rate numeric(12,6) not null default 1 check (exchange_rate > 0), -- unités de la devise boutique pour 1 unité de "currency"
  fee numeric(12,2) not null default 0 check (fee >= 0),                     -- exprimé dans "currency"
  free_shipping_threshold numeric(12,2),                                     -- exprimé dans la devise boutique
  eta_min_days int, eta_max_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_shipcountries_updated before update on public.shipping_countries for each row execute function public.set_updated_at();

create table if not exists public.shipping_cities (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.shipping_countries(code) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  unique (country_code, name)
);
create index if not exists idx_shipping_cities_country on public.shipping_cities(country_code);

-- Tarif spécifique à une ville (optionnel, remplace le tarif du pays)
create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.shipping_countries(code) on delete cascade,
  city text not null,
  fee numeric(12,2) not null check (fee >= 0),
  unique (country_code, city)
);

-- ---------- PAIEMENTS ----------
create table if not exists public.payment_methods (
  code text primary key,
  name_fr text not null, name_en text, name_ar text,
  instructions_fr text, instructions_en text, instructions_ar text,
  account_details text,               -- RIB / numéro / bénéficiaire : à renseigner dans Admin → Paiements
  morocco_only boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- ---------- PROMOTIONS ----------
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent numeric(5,2) check (percent is null or (percent > 0 and percent <= 100)),
  fixed_amount numeric(12,2) check (fixed_amount is null or fixed_amount > 0),
  min_order numeric(12,2) not null default 0,
  max_uses int,
  uses_count int not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  target_user_ids uuid[],
  created_at timestamptz not null default now(),
  check (percent is not null or fixed_amount is not null)
);

-- ---------- COMMANDES ----------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending_payment' check (status in
    ('pending_payment','payment_proof_received','paid','preparing','delivering','delivered','cancelled')),
  stock_state text not null default 'reserved' check (stock_state in ('reserved','deducted','released')),
  stock_reserved_until timestamptz,
  payment_method text references public.payment_methods(code),
  payment_proof_url text,
  country_code text not null, city text not null, address text not null, postal_code text,
  first_name text not null, last_name text not null, email text not null, phone text not null,
  notes text,
  location_lat double precision check (location_lat between -90 and 90),     -- position partagée par le client (avec son consentement)
  location_lng double precision check (location_lng between -180 and 180),
  location_accuracy double precision check (location_accuracy >= 0),          -- précision en mètres
  location_captured_at timestamptz,
  currency text not null default 'MAD',
  subtotal numeric(12,2) not null, shipping_fee numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0, total numeric(12,2) not null,
  discount_code text,
  paid_at timestamptz, delivered_at timestamptz,
  delivery_confirmed boolean not null default false,
  delivery_confirmed_at timestamptz,
  delivery_confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status, created_at desc);
create index if not exists idx_orders_reserved on public.orders(stock_state, stock_reserved_until);
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null, sku text, color text, size text, shoe_size text, image_url text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);
create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.discount_usages (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discount_codes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_discount_usages_discount on public.discount_usages(discount_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('initial','restock','removal','correction','sale','cancel_restock','return')),
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_movements_variant on public.inventory_movements(variant_id, created_at desc);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  country_code text not null, city text not null, address text not null, postal_code text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_addresses_user on public.addresses(user_id);

-- ---------- MESSAGERIE / NOTIFICATIONS ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_user on public.conversations(user_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null default 'customer' check (sender_role in ('customer','admin')),
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('user','admin')),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  params jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_admin on public.notifications(audience, created_at desc);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('defective','wrong_color')),
  description text,
  media_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','received','refunded','exchanged')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_returns_order on public.return_requests(order_id);
create trigger trg_returns_updated before update on public.return_requests for each row execute function public.set_updated_at();

-- ---------- CONTENU ----------
create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title_fr text not null, title_en text, title_ar text,
  subtitle_fr text, subtitle_en text, subtitle_ar text,
  button_label_fr text, button_label_en text, button_label_ar text,
  link_url text,
  text_fr text, text_en text, text_ar text,                                   -- texte libre sous le sous-titre
  button2_label_fr text, button2_label_en text, button2_label_ar text, link2_url text,  -- bouton secondaire
  image_desktop_url text, image_mobile_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Le compte associé vient de la session Supabase, jamais d'un uid fourni par le navigateur.
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

-- Envoi atomique d'une campagne : le serveur valide les destinataires et restreint le code promo.
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

-- Vue clients (respecte la RLS de l'appelant)
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

-- =====================================================================
-- LOGIQUE MÉTIER (transactionnelle, exécutée côté base)
-- =====================================================================

-- Notification alerte stock faible (admin)
create or replace function public.notify_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  if (new.stock - new.reserved) <= new.low_stock_threshold
     and (old.stock - old.reserved) > old.low_stock_threshold then
    select name_fr into pname from public.products where id = new.product_id;
    insert into public.notifications (audience, type, params, link)
    values ('admin', 'low_stock', jsonb_build_object('product', pname, 'available', new.stock - new.reserved), '/admin/inventory');
  end if;
  return new;
end $$;
create trigger trg_variants_lowstock after update on public.product_variants
  for each row execute function public.notify_low_stock();

-- Libère les réservations expirées (24 h) — appelée à chaque commande et par l'admin.
create or replace function public.release_expired_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare o record; it record; n int := 0;
begin
  for o in select id, user_id, order_number from public.orders
           where stock_state = 'reserved' and status = 'pending_payment' and stock_reserved_until < now()
           for update skip locked
  loop
    for it in select variant_id, quantity from public.order_items where order_id = o.id and variant_id is not null loop
      update public.product_variants set reserved = greatest(reserved - it.quantity, 0) where id = it.variant_id;
    end loop;
    update public.orders set status = 'cancelled', stock_state = 'released' where id = o.id;
    insert into public.notifications (audience, user_id, type, params, link)
    values ('user', o.user_id, 'order_expired', jsonb_build_object('order_number', o.order_number), '/account/orders/' || o.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Calcul d'une réduction (interne).
create or replace function public.compute_discount(p_code text, p_subtotal numeric, p_uid uuid)
returns table (code_id uuid, amount numeric)
language plpgsql security definer set search_path = public as $$
declare d public.discount_codes%rowtype; a numeric;
begin
  select * into d from public.discount_codes where upper(code) = upper(trim(p_code));
  if not found or not d.is_active then raise exception 'PROMO_INVALID'; end if;
  if d.starts_at is not null and d.starts_at > now() then raise exception 'PROMO_NOT_STARTED'; end if;
  if d.expires_at is not null and d.expires_at < now() then raise exception 'PROMO_EXPIRED'; end if;
  if d.max_uses is not null and d.uses_count >= d.max_uses then raise exception 'PROMO_EXHAUSTED'; end if;
  if p_subtotal < d.min_order then raise exception 'PROMO_MIN_ORDER'; end if;
  if d.target_user_ids is not null and array_length(d.target_user_ids, 1) > 0
     and not (p_uid = any (d.target_user_ids)) then raise exception 'PROMO_INVALID'; end if;
  a := case when d.percent is not null then round(p_subtotal * d.percent / 100, 2) else d.fixed_amount end;
  code_id := d.id; amount := least(a, p_subtotal);
  return next;
end $$;

-- Aperçu d'une réduction pour le panier (le montant réel est toujours recalculé dans create_order).
create or replace function public.validate_discount(p_code text, p_subtotal numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.compute_discount(p_code, p_subtotal, auth.uid());
  return jsonb_build_object('amount', r.amount, 'code', upper(trim(p_code)));
end $$;

-- Création de commande : TOUS les prix, frais et réductions sont recalculés ici.
create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  item jsonb; v public.product_variants%rowtype; prod public.products%rowtype;
  qty int; unit numeric; img text;
  lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0; v_discount numeric := 0; v_code_id uuid;
  ctry public.shipping_countries%rowtype; meth public.payment_methods%rowtype;
  v_fee numeric; v_ship numeric; v_total numeric; v_number text;
  ord public.orders%rowtype; d record;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p->>'first_name'), '') = '' or coalesce(trim(p->>'last_name'), '') = ''
     or coalesce(trim(p->>'email'), '') = '' or coalesce(trim(p->>'phone'), '') = ''
     or char_length(coalesce(trim(p->>'address'), '')) < 5 then raise exception 'INVALID_INPUT'; end if;
  if p->'items' is null or jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'EMPTY_CART'; end if;

  perform public.release_expired_reservations();

  select * into ctry from public.shipping_countries where code = p->>'country_code' and is_active;
  if not found then raise exception 'COUNTRY_UNAVAILABLE'; end if;
  if not exists (select 1 from public.shipping_cities where country_code = ctry.code and name = p->>'city' and is_active) then
    raise exception 'CITY_UNAVAILABLE'; end if;

  select * into meth from public.payment_methods where code = p->>'payment_method' and is_active;
  if not found or (meth.morocco_only and ctry.code <> 'MA') then raise exception 'PAYMENT_UNAVAILABLE'; end if;

  -- Verrouillage des variantes dans un ordre stable (évite les deadlocks) + réservation
  for item in select value from jsonb_array_elements(p->'items') order by value->>'variant_id' loop
    qty := (item->>'quantity')::int;
    if qty is null or qty < 1 or qty > 50 then raise exception 'INVALID_INPUT'; end if;
    select * into v from public.product_variants where id = (item->>'variant_id')::uuid for update;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    select * into prod from public.products where id = v.product_id and status = 'published';
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v.stock - v.reserved < qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    unit := coalesce(v.price_override, case when prod.sale_price is not null and prod.sale_price < prod.price then prod.sale_price else prod.price end);
    select url into img from public.product_images where product_id = prod.id order by sort_order limit 1;
    update public.product_variants set reserved = reserved + qty where id = v.id;
    v_subtotal := v_subtotal + unit * qty;
    lines := lines || jsonb_build_object('product_id', prod.id, 'variant_id', v.id, 'name', prod.name_fr,
      'sku', coalesce(v.sku, prod.sku), 'color', v.color, 'size', v.size, 'shoe_size', v.shoe_size,
      'image_url', img, 'unit_price', unit, 'quantity', qty);
  end loop;

  if coalesce(trim(p->>'promo_code'), '') <> '' then
    select * into d from public.compute_discount(p->>'promo_code', v_subtotal, uid);
    update public.discount_codes set uses_count = uses_count + 1
      where id = d.code_id and (max_uses is null or uses_count < max_uses);
    if not found then raise exception 'PROMO_EXHAUSTED'; end if;
    v_discount := d.amount; v_code_id := d.code_id;
  end if;

  select coalesce((select fee from public.shipping_rates where country_code = ctry.code and city = p->>'city'), ctry.fee) into v_fee;
  v_ship := round(v_fee * ctry.exchange_rate, 2);
  if ctry.free_shipping_threshold is not null and (v_subtotal - v_discount) >= ctry.free_shipping_threshold then v_ship := 0; end if;
  v_total := v_subtotal - v_discount + v_ship;

  v_number := 'DOS-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0');

  insert into public.orders (order_number, user_id, payment_method, country_code, city, address, postal_code,
      first_name, last_name, email, phone, notes, subtotal, shipping_fee, discount_amount, total,
      discount_code, stock_reserved_until)
  values (v_number, uid, meth.code, ctry.code, p->>'city', left(trim(p->>'address'), 300), left(p->>'postal_code', 20),
      left(trim(p->>'first_name'), 80), left(trim(p->>'last_name'), 80), left(trim(p->>'email'), 200), left(trim(p->>'phone'), 30),
      left(p->>'notes', 500), v_subtotal, v_ship, v_discount, v_total,
      case when v_code_id is not null then upper(trim(p->>'promo_code')) end, now() + interval '24 hours')
  returning * into ord;

  insert into public.order_items (order_id, product_id, variant_id, name, sku, color, size, shoe_size, image_url, unit_price, quantity)
  select ord.id, x.product_id, x.variant_id, x.name, x.sku, x.color, x.size, x.shoe_size, x.image_url, x.unit_price, x.quantity
  from jsonb_to_recordset(lines) as x(product_id uuid, variant_id uuid, name text, sku text, color text, size text,
                                      shoe_size text, image_url text, unit_price numeric, quantity int);

  if v_code_id is not null then
    insert into public.discount_usages (discount_id, user_id, order_id, amount) values (v_code_id, uid, ord.id, v_discount);
  end if;

  insert into public.notifications (audience, type, params, link)
  values ('admin', 'new_order', jsonb_build_object('order_number', ord.order_number, 'total', ord.total), '/admin/orders');
  insert into public.notifications (audience, user_id, type, params, link)
  values ('user', uid, 'order_created', jsonb_build_object('order_number', ord.order_number), '/account/orders/' || ord.id);

  return to_jsonb(ord);
end $$;

-- Le client rattache sa preuve de paiement (fichier déjà envoyé dans le bucket privé).
create or replace function public.attach_payment_proof(p_order uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if o.status not in ('pending_payment','payment_proof_received') then raise exception 'INVALID_TRANSITION'; end if;
  if p_path not like auth.uid()::text || '/%' then raise exception 'FORBIDDEN'; end if;
  update public.orders set payment_proof_url = p_path, status = 'payment_proof_received' where id = o.id;
  insert into public.notifications (audience, type, params, link)
  values ('admin', 'payment_to_verify', jsonb_build_object('order_number', o.order_number), '/admin/orders');
end $$;

-- Changement de statut réservé à l'administrateur (gère le stock).
-- Position de livraison : enregistrée APRÈS la commande, uniquement par son propriétaire (ou jamais), dans les 2 h suivant sa création.
-- Lecture : couverte par RLS (orders_select_own = le client voit la sienne, l'admin voit tout). Aucun autre client n'y accède.
create or replace function public.attach_order_location(p_order uuid, p_lat double precision, p_lng double precision, p_accuracy double precision default null, p_captured_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or coalesce(p_accuracy, 0) < 0 then raise exception 'INVALID_INPUT'; end if;
  update public.orders
     set location_lat = p_lat, location_lng = p_lng, location_accuracy = p_accuracy, location_captured_at = coalesce(p_captured_at, now())
   where id = p_order and user_id = auth.uid() and created_at > now() - interval '2 hours';
  if not found then raise exception 'FORBIDDEN'; end if;
end $$;

create or replace function public.admin_set_order_status(p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; it record;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('pending_payment','payment_proof_received','paid','preparing','delivering','delivered','cancelled') then
    raise exception 'INVALID_INPUT'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status = p_status then return; end if;
  if o.status = 'cancelled' then raise exception 'INVALID_TRANSITION'; end if;

  if p_status in ('paid','preparing','delivering','delivered') and o.stock_state = 'reserved' then
    for it in select * from public.order_items where order_id = o.id and variant_id is not null loop
      update public.product_variants set stock = greatest(stock - it.quantity, 0), reserved = greatest(reserved - it.quantity, 0) where id = it.variant_id;
      insert into public.inventory_movements (variant_id, delta, reason, order_id, created_by) values (it.variant_id, -it.quantity, 'sale', o.id, auth.uid());
    end loop;
    update public.orders set stock_state = 'deducted' where id = o.id;
  elsif p_status = 'cancelled' then
    if o.stock_state = 'reserved' then
      for it in select * from public.order_items where order_id = o.id and variant_id is not null loop
        update public.product_variants set reserved = greatest(reserved - it.quantity, 0) where id = it.variant_id;
      end loop;
    elsif o.stock_state = 'deducted' then
      for it in select * from public.order_items where order_id = o.id and variant_id is not null loop
        update public.product_variants set stock = stock + it.quantity where id = it.variant_id;
        insert into public.inventory_movements (variant_id, delta, reason, order_id, created_by) values (it.variant_id, it.quantity, 'cancel_restock', o.id, auth.uid());
      end loop;
    end if;
    update public.orders set stock_state = 'released' where id = o.id;
  end if;

  update public.orders set status = p_status,
    paid_at = case when p_status = 'paid' then now() else paid_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = o.id;

  insert into public.notifications (audience, user_id, type, params, link)
  values ('user', o.user_id, 'order_status', jsonb_build_object('order_number', o.order_number, 'status', p_status), '/account/orders/' || o.id);
end $$;

-- Ajustement de stock (ajout / retrait / correction) avec historique.
create or replace function public.admin_adjust_stock(p_variant uuid, p_delta int, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v public.product_variants%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_reason not in ('initial','restock','removal','correction') then raise exception 'INVALID_INPUT'; end if;
  select * into v from public.product_variants where id = p_variant for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.stock + p_delta < v.reserved then raise exception 'INVALID_STOCK'; end if;
  update public.product_variants set stock = stock + p_delta where id = v.id;
  insert into public.inventory_movements (variant_id, delta, reason, note, created_by) values (v.id, p_delta, p_reason, p_note, auth.uid());
end $$;

-- Demande de retour : uniquement pour une commande livrée depuis moins de 48 h.
create or replace function public.create_return_request(p_order uuid, p_reason text, p_description text, p_media text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; rid uuid;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'delivered' or o.delivered_at is null or o.delivered_at < now() - interval '48 hours' then
    raise exception 'RETURN_WINDOW_CLOSED'; end if;
  if p_reason not in ('defective','wrong_color') then raise exception 'INVALID_INPUT'; end if;
  insert into public.return_requests (order_id, user_id, reason, description, media_urls)
  values (o.id, auth.uid(), p_reason, left(p_description, 2000), coalesce(p_media, '{}')) returning id into rid;
  insert into public.notifications (audience, type, params, link)
  values ('admin', 'return_request', jsonb_build_object('order_number', o.order_number), '/admin/orders');
  return rid;
end $$;

-- Messagerie : rôle forcé côté serveur, mise à jour de la conversation, notifications.
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.sender_role := case when public.is_admin() then 'admin' else 'customer' end;
  return new;
end $$;
create trigger trg_messages_before before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations%rowtype;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = now() where id = c.id;
  if new.sender_role = 'admin' then
    insert into public.notifications (audience, user_id, type, params, link)
    values ('user', c.user_id, 'new_reply', jsonb_build_object('subject', c.subject), '/account/messages?c=' || c.id);
  else
    insert into public.notifications (audience, type, params, link)
    values ('admin', 'new_message', jsonb_build_object('subject', c.subject), '/admin/messages?c=' || c.id);
  end if;
  return new;
end $$;
create trigger trg_messages_after after insert on public.messages for each row execute function public.messages_after_insert();

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.is_admin();
begin
  if not adm and not exists (select 1 from public.conversations where id = p_conv and user_id = auth.uid()) then
    raise exception 'FORBIDDEN'; end if;
  update public.messages set read_at = now()
  where conversation_id = p_conv and read_at is null
    and sender_role = case when adm then 'customer' else 'admin' end;
end $$;

create or replace function public.confirm_order_delivery(p_order uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_name text; v_number text; v_at timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select o.order_number, coalesce(nullif(trim(o.first_name || ' ' || o.last_name), ''), 'Client')
    into v_number, v_name from public.orders o
    where o.id = p_order and o.user_id = v_user and o.status = 'delivered' and not o.delivery_confirmed
      and exists (select 1 from public.profiles p where p.id = v_user and p.role = 'customer') for update;
  if not found then raise exception 'ORDER_NOT_CONFIRMABLE'; end if;
  v_at := now();
  update public.orders set delivery_confirmed = true, delivery_confirmed_at = v_at, delivery_confirmed_by = v_user
    where id = p_order and user_id = v_user and status = 'delivered' and not delivery_confirmed;
  if not found then raise exception 'ORDER_NOT_CONFIRMABLE'; end if;
  insert into public.notifications (audience, type, params, link)
    values ('admin', 'delivery_confirmed', jsonb_build_object('client', v_name, 'order_number', v_number),
      '/admin/orders?order_id=' || p_order::text);
  return v_at;
end $$;

-- Tableau de bord administrateur (un seul appel).
create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform public.release_expired_reservations();
  select jsonb_build_object(
    'orders_today', (select count(*) from public.orders where created_at::date = current_date),
    'revenue_today', coalesce((select sum(total) from public.orders where created_at::date = current_date and status in ('paid','preparing','delivering','delivered')), 0),
    'revenue_30d', coalesce((select sum(total) from public.orders where created_at >= now() - interval '30 days' and status in ('paid','preparing','delivering','delivered')), 0),
    'pending_orders', (select count(*) from public.orders where status = 'pending_payment'),
    'payments_to_verify', (select count(*) from public.orders where status = 'payment_proof_received'),
    'out_of_stock', (select count(*) from public.products where status = 'published' and available_stock = 0),
    'low_stock', (select count(*) from public.product_variants where stock - reserved > 0 and stock - reserved <= low_stock_threshold),
    'new_customers', (select count(*) from public.profiles where role = 'customer' and created_at >= now() - interval '7 days'),
    'unread_messages', (select count(*) from public.messages where sender_role = 'customer' and read_at is null),
    'pending_returns', (select count(*) from public.return_requests where status = 'pending'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(g.d, 'DD/MM'), 'revenue', coalesce(r.rev, 0)) order by g.d)
      from generate_series(current_date - 13, current_date, interval '1 day') as g(d)
      left join (select created_at::date as d, sum(total) as rev from public.orders
                 where status in ('paid','preparing','delivering','delivered') group by 1) r on r.d = g.d::date), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(t) from (
      select oi.name, sum(oi.quantity)::int as qty from public.order_items oi
      join public.orders o on o.id = oi.order_id and o.status in ('paid','preparing','delivering','delivered')
      group by oi.name order by qty desc limit 5) t), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.messages, public.notifications, public.conversations, public.orders;
exception when others then null; end $$;
