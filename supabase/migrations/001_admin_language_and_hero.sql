-- DOSSORA — Migration 001 : langue de l'administration + contenu du Hero
-- Idempotente : peut être exécutée plusieurs fois, sur une base existante ou neuve.
-- À exécuter dans Supabase → SQL Editor (après schema.sql et policies.sql).

-- 1) Langue de l'administration, rattachée au COMPTE admin (table profiles existante, pas de nouvelle table).
--    Indépendante de la langue des clients (qui reste dans le navigateur de chaque client).
alter table public.profiles
  add column if not exists admin_language text check (admin_language in ('fr', 'en', 'ar'));

-- Seul un administrateur peut définir/modifier admin_language : pour un client, la valeur est ignorée.
-- (Le SQL Editor, sans auth.uid(), reste autorisé.) La policy "profiles_update_own" limite déjà la modification à sa propre ligne.
create or replace function public.protect_admin_language() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.admin_language is distinct from old.admin_language and auth.uid() is not null and not public.is_admin() then
    new.admin_language := old.admin_language;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_admin_language on public.profiles;
create trigger trg_profiles_admin_language before update on public.profiles
  for each row execute function public.protect_admin_language();

-- 2) Hero de l'accueil : on réutilise homepage_banners (aucune nouvelle table) et on ajoute
--    le texte libre et le bouton secondaire, tous modifiables par l'admin.
alter table public.homepage_banners
  add column if not exists text_fr text, add column if not exists text_en text, add column if not exists text_ar text,
  add column if not exists button2_label_fr text, add column if not exists button2_label_en text, add column if not exists button2_label_ar text,
  add column if not exists link2_url text;

-- Recharge le cache de schéma PostgREST (évite un 404/PGRST205 juste après la migration).
notify pgrst, 'reload schema';
