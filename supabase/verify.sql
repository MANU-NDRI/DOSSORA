-- DOSSORA — verify.sql : diagnostic de l'installation Supabase (lecture seule).
-- Exécutez-le dans SQL Editor. Les requêtes 1 à 5 doivent retourner 0 ligne ; la requête 6 renvoie toujours une ligne de statistiques.

-- 1) Tables / vues manquantes → exécuter schema.sql
select t as "table_ou_vue_manquante (schema.sql)" from unnest(array[
  'profiles','categories','products','product_images','product_variants','shipping_countries','shipping_cities','shipping_rates',
  'payment_methods','discount_codes','orders','order_items','discount_usages','inventory_movements','addresses','conversations',
  'messages','notifications','return_requests','homepage_banners','shop_settings','newsletter_subscribers','customers']) as t
where to_regclass('public.' || t) is null;

-- 2) Fonctions RPC manquantes → exécuter schema.sql
select f as "fonction_manquante (schema.sql)" from unnest(array[
  'validate_discount(text,numeric)','create_order(jsonb)','attach_payment_proof(uuid,text)','admin_set_order_status(uuid,text)',
  'admin_adjust_stock(uuid,integer,text,text)','attach_order_location(uuid,double precision,double precision,double precision,timestamptz)','create_return_request(uuid,text,text,text[])','mark_conversation_read(uuid)','admin_dashboard()','admin_send_promotion(uuid[],boolean,text,text,text)','notify_new_newsletter_subscriber()','set_newsletter_owner()']) as f
where to_regprocedure('public.' || f) is null;
-- La RPC de confirmation est ajoutée par la migration 004; ne pas relancer schema.sql pour la créer.
select 'confirm_order_delivery(uuid)' as "fonction_manquante (migration 004)"
where to_regprocedure('public.confirm_order_delivery(uuid)') is null;

-- 3) RLS désactivée → exécuter policies.sql
select c.relname as "rls_desactivee (policies.sql)" from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 4) Buckets Storage manquants ou mal configurés → exécuter policies.sql
select b as "bucket_manquant (policies.sql)" from unnest(array['shop-assets','payment-proofs']) as b
where not exists (select 1 from storage.buckets where id = b);
select id as "bucket_public_par_erreur" from storage.buckets where id = 'payment-proofs' and public;

-- 5) Colonnes ajoutées par les migrations → exécuter la migration indiquée par l'étiquette.
select v.label as "colonne_manquante (migration)"
from (values
  ('orders.location_lat (002)', 'orders', 'location_lat'),
  ('orders.location_lng (002)', 'orders', 'location_lng'),
  ('orders.location_accuracy (002)', 'orders', 'location_accuracy'),
  ('orders.location_captured_at (002)', 'orders', 'location_captured_at'),
  ('profiles.admin_language (001)', 'profiles', 'admin_language'),
  ('homepage_banners.text_fr (001)', 'homepage_banners', 'text_fr'),
  ('homepage_banners.text_en (001)', 'homepage_banners', 'text_en'),
  ('homepage_banners.text_ar (001)', 'homepage_banners', 'text_ar'),
  ('homepage_banners.button2_label_fr (001)', 'homepage_banners', 'button2_label_fr'),
  ('homepage_banners.button2_label_en (001)', 'homepage_banners', 'button2_label_en'),
  ('homepage_banners.button2_label_ar (001)', 'homepage_banners', 'button2_label_ar'),
  ('homepage_banners.link2_url (001)', 'homepage_banners', 'link2_url'),
  ('newsletter_subscribers.user_id (003)', 'newsletter_subscribers', 'user_id'),
  ('orders.delivery_confirmed (004)', 'orders', 'delivery_confirmed'),
  ('orders.delivery_confirmed_at (004)', 'orders', 'delivery_confirmed_at'),
  ('orders.delivery_confirmed_by (004)', 'orders', 'delivery_confirmed_by')
) as v(label, table_name, column_name)
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v.table_name and c.column_name = v.column_name
);

-- 6) Données minimales (informatif) : cette requête renvoie toujours exactement une ligne.
select (select count(*) from public.shop_settings) as reglages, (select count(*) from public.homepage_banners where is_active) as bannieres_actives,
       (select count(*) from public.shipping_countries where is_active) as pays_actifs, (select count(*) from public.payment_methods where is_active) as paiements_actifs,
       (select count(*) from public.profiles where role = 'admin') as admins;

-- 7) Catalogue de démonstration (informatif après seed.sql) : attendu 100 produits publiés.
select count(*) as produits_demo_publies from public.products
where status = 'published' and sku ~ '^DOS-(0[0-9]{2}|100)$';

-- 8) Catégories de démonstration (informatif après seed.sql) : attendu 37 catégories.
select count(*) as categories_demo from public.categories where slug in (
  'sacs','vetements','chaussures','beaute','accessoires','maison',
  'sacs-a-main','sacs-a-dos','sacs-bandouliere','sacs-soiree','sacs-professionnels','pochettes','mini-sacs','cabas',
  'robes','chemisiers','hauts','pantalons','jupes','vestes','ensembles','sport',
  'baskets','talons','sandales','mocassins','bottines','accessoires-chaussures',
  'savons','soins-visage','soins-corps','parfums','bijoux','mode-accessoires',
  'decoration','rangement','salle-de-bain'
);

-- 9) Protections indispensables de notifications/newsletter.
select 'notif_delete_own' as "policy_manquante (policies.sql / migration 003)"
where not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notif_delete_own');
select 'trg_newsletter_admin_notification' as "trigger_manquant (migration 003)"
where not exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'newsletter_subscribers'
    and t.tgname = 'trg_newsletter_admin_notification' and not t.tgisinternal
);
select 'admin_send_promotion(uuid[],boolean,text,text,text)' as "fonction_manquante (migration 003)"
where to_regprocedure('public.admin_send_promotion(uuid[],boolean,text,text,text)') is null;
select 'trg_newsletter_owner' as "trigger_manquant (migration 003)"
where not exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'newsletter_subscribers'
    and t.tgname = 'trg_newsletter_owner' and not t.tgisinternal
);
select 'release_expired_reservations accessible' as "privilege_dangereux (migration 003)"
where has_function_privilege('authenticated', 'public.release_expired_reservations()', 'EXECUTE');
select 'notifications: privilèges UPDATE trop larges' as "privilege_dangereux (migration 003)"
where has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
   or not has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE');
select 'profiles: UPDATE email/role accessible' as "privilege_dangereux (migration 003)"
where has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
   or has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
   or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
   or not has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE');
select 'orders: UPDATE direct accessible' as "privilege_dangereux (migration 004)"
where has_table_privilege('authenticated', 'public.orders', 'UPDATE')
   or has_column_privilege('authenticated', 'public.orders', 'user_id', 'UPDATE')
   or has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE')
   or has_column_privilege('authenticated', 'public.orders', 'total', 'UPDATE')
   or has_column_privilege('authenticated', 'public.orders', 'delivery_confirmed_by', 'UPDATE')
   or has_function_privilege('anon', 'public.confirm_order_delivery(uuid)', 'EXECUTE')
   or not has_function_privilege('authenticated', 'public.confirm_order_delivery(uuid)', 'EXECUTE');
select 'customers.last_activity' as "colonne_manquante (migration 003)"
where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'last_activity');

-- 11) Outbox WhatsApp des nouvelles commandes (migration 006).
select missing as "objet_manquant (migration 006)"
from (values
  ('whatsapp_order_notifications', to_regclass('public.whatsapp_order_notifications') is not null),
  ('whatsapp_order_notification_parts', to_regclass('public.whatsapp_order_notification_parts') is not null),
  ('whatsapp_order_notification_attempts', to_regclass('public.whatsapp_order_notification_attempts') is not null),
  ('claim_whatsapp_order_notifications', to_regprocedure('public.claim_whatsapp_order_notifications(text,integer)') is not null),
  ('register_whatsapp_order_parts', to_regprocedure('public.register_whatsapp_order_parts(uuid,jsonb)') is not null),
  ('claim_whatsapp_order_parts', to_regprocedure('public.claim_whatsapp_order_parts(uuid,integer)') is not null),
  ('finish_whatsapp_order_attempt', to_regprocedure('public.finish_whatsapp_order_attempt(uuid,boolean,text,integer,text,boolean)') is not null),
  ('finalize_whatsapp_order_notification', to_regprocedure('public.finalize_whatsapp_order_notification(uuid)') is not null),
  ('release_whatsapp_order_notification', to_regprocedure('public.release_whatsapp_order_notification(uuid,text)') is not null)
) as checks(missing, installed)
where not installed;
select 'trg_enqueue_whatsapp_new_order' as "trigger_manquant_ou_desactive (migration 006)"
where not exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'orders'
    and t.tgname = 'trg_enqueue_whatsapp_new_order' and not t.tgisinternal and t.tgenabled <> 'D'
);
select 'outbox WhatsApp RLS/permissions' as "protection_manquante (migration 006)"
where exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('whatsapp_order_notifications','whatsapp_order_notification_parts','whatsapp_order_notification_attempts')
    and not c.relrowsecurity
)
or has_table_privilege('authenticated', to_regclass('public.whatsapp_order_notifications'), 'INSERT')
or has_table_privilege('authenticated', to_regclass('public.whatsapp_order_notifications'), 'UPDATE')
or has_table_privilege('authenticated', to_regclass('public.whatsapp_order_notifications'), 'DELETE')
or has_function_privilege('authenticated', to_regprocedure('public.claim_whatsapp_order_notifications(text,integer)'), 'EXECUTE')
or has_function_privilege('anon', to_regprocedure('public.claim_whatsapp_order_notifications(text,integer)'), 'EXECUTE');

-- 10) Bootstrap du profil après OAuth : migration 005 (diagnostic en lecture seule).
select 'handle_new_user OAuth (migration 005)' as "fonction_manquante_ou_obsolete"
where not exists (
  select 1 from pg_proc p
  where p.oid = to_regprocedure('public.handle_new_user()')
    and p.prosrc ilike '%raw_user_meta_data%'
    and p.prosrc ilike '%on conflict (id) do nothing%'
);
select 'ensure_profile OAuth (migration 005)' as "fonction_manquante_ou_obsolete"
where not exists (
  select 1 from pg_proc p
  where p.oid = to_regprocedure('public.ensure_profile()')
    and p.prosecdef
    and p.prosrc ilike '%auth.uid()%'
    and p.prosrc ilike '%on conflict (id) do nothing%'
);
select 'on_auth_user_created (migration 005)' as "trigger_manquant_ou_desactive"
where not exists (
  select 1 from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relname = 'users'
    and t.tgname = 'on_auth_user_created' and not t.tgisinternal and t.tgenabled <> 'D'
);
select 'ensure_profile execute grant (migration 005)' as "permission_incorrecte"
where to_regprocedure('public.ensure_profile()') is not null
  and (not has_function_privilege('authenticated', 'public.ensure_profile()', 'EXECUTE')
    or has_function_privilege('anon', 'public.ensure_profile()', 'EXECUTE'));
