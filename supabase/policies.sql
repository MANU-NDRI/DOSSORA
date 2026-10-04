-- =====================================================================
-- DOSSORA — policies.sql  (Row Level Security + Storage)
-- À exécuter APRÈS schema.sql.
-- Principe : refus par défaut ; le client ne peut ni écrire les prix, ni le stock,
-- ni les commandes, ni les codes promo. Tout passe par des fonctions SECURITY DEFINER.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','product_images','product_variants','shipping_countries',
    'shipping_cities','shipping_rates','payment_methods','discount_codes','discount_usages','orders','order_items',
    'inventory_movements','addresses','conversations','messages','notifications','return_requests',
    'homepage_banners','shop_settings','newsletter_subscribers']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tables où l'administrateur a tous les droits
do $$
declare t text;
begin
  foreach t in array array['categories','products','product_images','product_variants','shipping_countries',
    'shipping_cities','shipping_rates','payment_methods','discount_codes','discount_usages','orders','order_items',
    'inventory_movements','conversations','messages','notifications','return_requests','homepage_banners',
    'shop_settings','newsletter_subscribers','profiles']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format('create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Réduit l'UPDATE aux champs éditables dans l'espace compte et à la langue admin (protégée par trigger).
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, country_code, city, admin_language) on public.profiles to authenticated;

-- CATALOGUE (lecture publique du contenu publié)
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (is_published);
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select to anon, authenticated using (status = 'published');
drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));

-- LIVRAISON / CONTENU
drop policy if exists "ship_countries_read" on public.shipping_countries;
create policy "ship_countries_read" on public.shipping_countries for select to anon, authenticated using (is_active);
drop policy if exists "ship_cities_read" on public.shipping_cities;
create policy "ship_cities_read" on public.shipping_cities for select to anon, authenticated using (is_active);
drop policy if exists "ship_rates_read" on public.shipping_rates;
create policy "ship_rates_read" on public.shipping_rates for select to anon, authenticated using (true);
drop policy if exists "banners_read" on public.homepage_banners;
create policy "banners_read" on public.homepage_banners for select to anon, authenticated using (is_active);
drop policy if exists "settings_read" on public.shop_settings;
create policy "settings_read" on public.shop_settings for select to anon, authenticated using (key = 'general');
-- Moyens de paiement (contient les coordonnées de paiement) : visibles uniquement une fois connecté
drop policy if exists "payment_methods_read" on public.payment_methods;
create policy "payment_methods_read" on public.payment_methods for select to authenticated using (is_active);
drop policy if exists "newsletter_insert" on public.newsletter_subscribers;
create policy "newsletter_insert" on public.newsletter_subscribers for insert to anon, authenticated with check (true);

-- COMMANDES (lecture seule pour le client ; création/statut uniquement via fonctions)
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
drop policy if exists "discount_usages_select_own" on public.discount_usages;
create policy "discount_usages_select_own" on public.discount_usages for select to authenticated using (user_id = auth.uid());
drop policy if exists "returns_select_own" on public.return_requests;
create policy "returns_select_own" on public.return_requests for select to authenticated using (user_id = auth.uid());

-- ADRESSES
drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- MESSAGERIE
drop policy if exists "conv_select_own" on public.conversations;
create policy "conv_select_own" on public.conversations for select to authenticated using (user_id = auth.uid());
drop policy if exists "conv_insert_own" on public.conversations;
create policy "conv_insert_own" on public.conversations for insert to authenticated
  with check (user_id = auth.uid() and (order_id is null or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));
drop policy if exists "msg_select_own" on public.messages;
create policy "msg_select_own" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists "msg_insert_own" on public.messages;
create policy "msg_insert_own" on public.messages for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- NOTIFICATIONS
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select to authenticated using (audience = 'user' and user_id = auth.uid());
drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications for update to authenticated
  using (audience = 'user' and user_id = auth.uid()) with check (audience = 'user' and user_id = auth.uid());
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_delete_own" on public.notifications for delete to authenticated
  using (audience = 'user' and user_id = auth.uid());

-- Les clients peuvent uniquement marquer leurs notifications comme lues ou les supprimer.
-- Le rôle admin conserve ses opérations via admin_all_notifications + RLS.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant insert, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Vue clients : lecture réservée à l'admin (la vue est security_invoker)
grant select on public.customers to authenticated;

-- Toutes les modifications de commande passent par des RPC validées côté serveur.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke update (user_id, status, subtotal, shipping_fee, total, delivery_confirmed,
  delivery_confirmed_at, delivery_confirmed_by) on public.orders from anon, authenticated;

-- ---------- Droits d'exécution des fonctions ----------
revoke all on function public.compute_discount(text, numeric, uuid) from public, anon, authenticated;
revoke all on function public.create_order(jsonb) from public, anon;
revoke all on function public.validate_discount(text, numeric) from public, anon;
revoke all on function public.attach_payment_proof(uuid, text) from public, anon;
revoke all on function public.attach_order_location(uuid, double precision, double precision, double precision, timestamptz) from public, anon;
revoke all on function public.admin_set_order_status(uuid, text) from public, anon;
revoke all on function public.admin_adjust_stock(uuid, int, text, text) from public, anon;
revoke all on function public.create_return_request(uuid, text, text, text[]) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.confirm_order_delivery(uuid) from public, anon;
revoke all on function public.admin_dashboard() from public, anon;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
revoke all on function public.admin_send_promotion(uuid[], boolean, text, text, text) from public, anon;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.validate_discount(text, numeric) to authenticated;
grant execute on function public.attach_payment_proof(uuid, text) to authenticated;
grant execute on function public.attach_order_location(uuid, double precision, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, int, text, text) to authenticated;
grant execute on function public.create_return_request(uuid, text, text, text[]) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.confirm_order_delivery(uuid) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_send_promotion(uuid[], boolean, text, text, text) to authenticated;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('shop-assets', 'shop-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('payment-proofs', 'payment-proofs', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf','video/mp4'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Images de la boutique : lecture publique, écriture admin
drop policy if exists "shop_assets_read" on storage.objects;
create policy "shop_assets_read" on storage.objects for select to anon, authenticated using (bucket_id = 'shop-assets');
drop policy if exists "shop_assets_admin_write" on storage.objects;
create policy "shop_assets_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'shop-assets' and public.is_admin()) with check (bucket_id = 'shop-assets' and public.is_admin());

-- Preuves de paiement / médias de retour : dossier = uid du client
drop policy if exists "proofs_insert_own" on storage.objects;
create policy "proofs_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "proofs_read_own_or_admin" on storage.objects;
create policy "proofs_read_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
