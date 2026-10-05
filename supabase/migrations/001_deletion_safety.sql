-- =====================================================================
-- DOSSORA — Migration 001 : Deletion Safety
-- Ajout de fonctions RPC pour vérifier les dépendances avant suppression
-- Idempotente : utilise "create or replace" et "if not exists"
-- =====================================================================

-- =========== PRODUITS ===========
-- Vérifie si un produit est référencé dans des commandes
create or replace function public.check_product_order_dependencies(p_product_id uuid)
returns table (order_count bigint) as $$
begin
  return query
  select count(*) as order_count
  from public.order_items oi
  where oi.product_id = p_product_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.check_product_order_dependencies(uuid) from public, anon;
grant execute on function public.check_product_order_dependencies(uuid) to authenticated;

-- =========== CATÉGORIES ===========
-- Vérifie si une catégorie a des produits ou des sous-catégories
create or replace function public.check_category_dependencies(p_category_id uuid)
returns table (product_count bigint, subcategory_count bigint) as $$
begin
  return query
  select
    (select count(*) from public.products where category_id = p_category_id) as product_count,
    (select count(*) from public.categories where parent_id = p_category_id) as subcategory_count;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.check_category_dependencies(uuid) from public, anon;
grant execute on function public.check_category_dependencies(uuid) to authenticated;

-- =========== MOYENS DE PAIEMENT ===========
-- Vérifie si un moyen de paiement est référencé dans des commandes
create or replace function public.check_payment_method_dependencies(p_payment_code text)
returns table (order_count bigint) as $$
begin
  return query
  select count(*) as order_count
  from public.orders o
  where o.payment_method = p_payment_code;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.check_payment_method_dependencies(text) from public, anon;
grant execute on function public.check_payment_method_dependencies(text) to authenticated;

-- =========== PAYS ===========
-- Vérifie si un pays a des commandes ou des villes associées
create or replace function public.check_shipping_country_dependencies(p_country_code text)
returns table (order_count bigint, city_count bigint, rate_count bigint) as $$
begin
  return query
  select
    (select count(*) from public.orders where country_code = p_country_code) as order_count,
    (select count(*) from public.shipping_cities where country_code = p_country_code) as city_count,
    (select count(*) from public.shipping_rates where country_code = p_country_code) as rate_count;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.check_shipping_country_dependencies(text) from public, anon;
grant execute on function public.check_shipping_country_dependencies(text) to authenticated;

-- =========== VILLES ===========
-- Vérifie si une ville a des commandes associées
create or replace function public.check_shipping_city_dependencies(p_country_code text, p_city_name text)
returns table (order_count bigint, rate_count bigint) as $$
begin
  return query
  select
    (select count(*) from public.orders where country_code = p_country_code and city = p_city_name) as order_count,
    (select count(*) from public.shipping_rates where country_code = p_country_code and city = p_city_name) as rate_count;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.check_shipping_city_dependencies(text, text) from public, anon;
grant execute on function public.check_shipping_city_dependencies(text, text) to authenticated;

-- =========== FIN MIGRATION ===========
