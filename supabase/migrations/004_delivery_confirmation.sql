-- DOSSORA — Migration 004: confirmation de réception par le propriétaire de commande.
-- Additive et transactionnelle. Ne pas réexécuter schema.sql sur une base existante.
begin;

alter table public.orders
  add column if not exists delivery_confirmed boolean not null default false,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists delivery_confirmed_by uuid references public.profiles(id) on delete set null;

-- La confirmation client passe exclusivement par cette RPC; aucune mise à jour directe permise.
create or replace function public.confirm_order_delivery(p_order uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_number text;
  v_confirmed_at timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select o.order_number, coalesce(nullif(trim(o.first_name || ' ' || o.last_name), ''), 'Client')
    into v_number, v_name
    from public.orders o
    where o.id = p_order and o.user_id = v_user and o.status = 'delivered'
      and exists (select 1 from public.profiles p where p.id = v_user and p.role = 'customer')
      and o.delivery_confirmed = false
    for update;
  if not found then raise exception 'ORDER_NOT_CONFIRMABLE'; end if;

  v_confirmed_at := now();
  update public.orders
     set delivery_confirmed = true,
         delivery_confirmed_at = v_confirmed_at,
         delivery_confirmed_by = v_user
   where id = p_order and user_id = v_user and status = 'delivered'
     and delivery_confirmed = false;
  if not found then raise exception 'ORDER_NOT_CONFIRMABLE'; end if;

  insert into public.notifications (audience, type, params, link)
  values ('admin', 'delivery_confirmed',
          jsonb_build_object('client', v_name, 'order_number', v_number),
          '/admin/orders?order_id=' || p_order::text);
  return v_confirmed_at;
end $$;

revoke all on function public.confirm_order_delivery(uuid) from public, anon;
grant execute on function public.confirm_order_delivery(uuid) to authenticated;
revoke update on public.orders from anon, authenticated;
revoke update (user_id, status, subtotal, shipping_fee, total, delivery_confirmed,
  delivery_confirmed_at, delivery_confirmed_by) on public.orders from anon, authenticated;

commit;
