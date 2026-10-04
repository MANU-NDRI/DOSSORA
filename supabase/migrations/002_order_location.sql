-- DOSSORA — Migration 002 : position de livraison (géolocalisation consentie)
-- Idempotente. À exécuter après schema.sql / policies.sql si votre base existe déjà.

alter table public.orders
  add column if not exists location_lat double precision check (location_lat between -90 and 90),
  add column if not exists location_lng double precision check (location_lng between -180 and 180),
  add column if not exists location_accuracy double precision check (location_accuracy >= 0),
  add column if not exists location_captured_at timestamptz;

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

revoke all on function public.attach_order_location(uuid, double precision, double precision, double precision, timestamptz) from public, anon;
grant execute on function public.attach_order_location(uuid, double precision, double precision, double precision, timestamptz) to authenticated;

notify pgrst, 'reload schema';
