-- DOSSORA — outbox transactionnelle et tentatives WhatsApp Business.
-- La commande et son message durable sont créés dans la même transaction.
begin;

create table if not exists public.whatsapp_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  notification_type text not null default 'whatsapp_new_order' check (notification_type = 'whatsapp_new_order'),
  recipient_phone text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (order_id, notification_type)
);
create index if not exists idx_whatsapp_order_notifications_due
  on public.whatsapp_order_notifications(status, next_attempt_at, created_at);

create table if not exists public.whatsapp_order_notification_parts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.whatsapp_order_notifications(id) on delete cascade,
  part_number int not null check (part_number > 0),
  message text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  last_http_status int,
  whatsapp_message_id text,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (notification_id, part_number)
);
create index if not exists idx_whatsapp_order_notification_parts_due
  on public.whatsapp_order_notification_parts(notification_id, status, next_attempt_at, part_number);

create table if not exists public.whatsapp_order_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.whatsapp_order_notification_parts(id) on delete cascade,
  attempt_number int not null check (attempt_number > 0),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  http_status int,
  whatsapp_message_id text,
  error text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (part_id, attempt_number)
);
create index if not exists idx_whatsapp_notification_attempts_part
  on public.whatsapp_order_notification_attempts(part_id, attempt_number desc);

alter table public.whatsapp_order_notifications enable row level security;
alter table public.whatsapp_order_notification_parts enable row level security;
alter table public.whatsapp_order_notification_attempts enable row level security;
revoke all on public.whatsapp_order_notifications from anon, authenticated;
revoke all on public.whatsapp_order_notification_parts from anon, authenticated;
revoke all on public.whatsapp_order_notification_attempts from anon, authenticated;
grant select on public.whatsapp_order_notifications to authenticated;
drop policy if exists "whatsapp_order_notifications_admin_read" on public.whatsapp_order_notifications;
create policy "whatsapp_order_notifications_admin_read" on public.whatsapp_order_notifications
  for select to authenticated using (public.is_admin());

create or replace function public.enqueue_whatsapp_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_country text;
  v_payment text;
  v_items text;
  v_message text;
  v_status text;
begin
  select * into o from public.orders where id = new.id;
  if not found then return new; end if;
  select coalesce(c.name_fr, c.name_en, o.country_code) into v_country
    from public.shipping_countries c where c.code = o.country_code;
  select coalesce(pm.name_fr, pm.name_en, o.payment_method, '—') into v_payment
    from public.payment_methods pm where pm.code = o.payment_method;
  v_country := coalesce(v_country, o.country_code);
  v_payment := coalesce(v_payment, o.payment_method, '—');
  v_status := case o.status
    when 'pending_payment' then 'En attente de paiement'
    when 'payment_proof_received' then 'Preuve de paiement reçue'
    when 'paid' then 'Payée'
    when 'preparing' then 'En préparation'
    when 'delivering' then 'En livraison'
    when 'delivered' then 'Livrée'
    when 'cancelled' then 'Annulée'
    else o.status end;

  select string_agg(format(E'%s. %s\nRéférence : %s\nQuantité : %s\nPrix unitaire : %s %s\nSous-total : %s %s',
      x.row_number, x.name, coalesce(nullif(x.sku, ''), '—'), x.quantity,
      to_char(x.unit_price, 'FM9999999999990.00'), o.currency,
      to_char(x.line_total, 'FM9999999999990.00'), o.currency), E'\n\n' order by x.row_number)
    into v_items
  from (
    select row_number() over (order by oi.id) as row_number, oi.name, oi.sku, oi.quantity, oi.unit_price, oi.line_total
    from public.order_items oi where oi.order_id = o.id
  ) x;
  if v_items is null then raise exception 'ORDER_ITEMS_MISSING'; end if;

  v_message := format(E'🛍️ NOUVELLE COMMANDE DOSSORA\n\n📦 COMMANDE\nNuméro : #%s\nDate : %s UTC\nStatut : %s\n\n👤 CLIENT\nNom : %s\nTéléphone : %s\nEmail : %s\n\n📍 LIVRAISON\nPays : %s\nVille : %s\nAdresse : %s\nCode postal : %s\nInformations complémentaires : %s\n\n🛒 ARTICLES COMMANDÉS\n\n%s\n\n💰 RÉCAPITULATIF\nSous-total : %s %s\nLivraison : %s %s\nRéduction : %s %s\nTotal : %s %s\n\n💳 PAIEMENT\nMéthode : %s\nStatut : %s\n\n🌍 DOSSORA\nNouvelle commande à traiter.',
    o.order_number, to_char(o.created_at at time zone 'UTC', 'DD/MM/YYYY HH24:MI'), v_status,
    trim(o.first_name || ' ' || o.last_name), o.phone, o.email, v_country, o.city, o.address,
    coalesce(o.postal_code, '—'), coalesce(nullif(o.notes, ''), '—'), v_items,
    to_char(o.subtotal, 'FM9999999999990.00'), o.currency,
    to_char(o.shipping_fee, 'FM9999999999990.00'), o.currency,
    to_char(o.discount_amount, 'FM9999999999990.00'), o.currency,
    to_char(o.total, 'FM9999999999990.00'), o.currency, v_payment, v_status);
  insert into public.whatsapp_order_notifications (order_id, message)
  values (o.id, v_message) on conflict (order_id, notification_type) do nothing;
  return new;
end $$;

drop trigger if exists trg_enqueue_whatsapp_new_order on public.orders;
create constraint trigger trg_enqueue_whatsapp_new_order after insert on public.orders
  deferrable initially deferred for each row execute function public.enqueue_whatsapp_new_order();

create or replace function public.claim_whatsapp_order_notifications(p_admin_phone text, p_limit int default 5)
returns table(notification_id uuid, order_id uuid, message text)
language plpgsql security definer set search_path = public as $$
declare n public.whatsapp_order_notifications%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_admin_phone is null or p_admin_phone !~ '^\+?[1-9][0-9]{7,14}$' then raise exception 'INVALID_ADMIN_PHONE'; end if;
  for n in
    select q.* from public.whatsapp_order_notifications q
    where (q.status = 'pending' and q.next_attempt_at <= now())
       or (q.status = 'processing' and q.locked_at < now() - interval '15 minutes')
    order by q.created_at for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 10))
  loop
    update public.whatsapp_order_notifications q
    set status = 'processing', recipient_phone = p_admin_phone, attempts = q.attempts + 1,
        last_attempt_at = now(), locked_at = now()
    where q.id = n.id;
    notification_id := n.id; order_id := n.order_id; message := n.message;
    return next;
  end loop;
end $$;

create or replace function public.register_whatsapp_order_parts(p_notification uuid, p_parts jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_parts) is distinct from 'array' then raise exception 'INVALID_MESSAGE_PARTS'; end if;
  if jsonb_array_length(p_parts) < 1 or jsonb_array_length(p_parts) > 1000 then raise exception 'INVALID_MESSAGE_PARTS'; end if;
  if not exists (select 1 from public.whatsapp_order_notifications where id = p_notification and status = 'processing') then
    raise exception 'NOTIFICATION_NOT_CLAIMED';
  end if;
  insert into public.whatsapp_order_notification_parts (notification_id, part_number, message)
  select p_notification, part.ordinality::int, part.value
  from jsonb_array_elements_text(p_parts) with ordinality as part(value, ordinality)
  where length(part.value) > 0
  on conflict (notification_id, part_number) do nothing;
end $$;

create or replace function public.claim_whatsapp_order_parts(p_notification uuid, p_limit int default 20)
returns table(part_id uuid, attempt_id uuid, part_number int, message text, attempt_number int)
language plpgsql security definer set search_path = public as $$
declare p public.whatsapp_order_notification_parts%rowtype; a uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  update public.whatsapp_order_notification_parts
  set status = 'failed', locked_at = null, next_attempt_at = null,
      last_error = coalesce(last_error, 'Attempt lease expired after final retry')
  where notification_id = p_notification and status = 'sending' and attempts >= 3
    and locked_at < now() - interval '15 minutes';
  for p in
    select x.* from public.whatsapp_order_notification_parts x
    where x.notification_id = p_notification and x.attempts < 3
      and ((x.status = 'pending' and x.next_attempt_at <= now())
        or (x.status = 'failed' and x.next_attempt_at <= now())
        or (x.status = 'sending' and x.locked_at < now() - interval '15 minutes'))
    order by x.part_number for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 20))
  loop
    update public.whatsapp_order_notification_parts x
    set status = 'sending', attempts = x.attempts + 1, last_attempt_at = now(), locked_at = now()
    where x.id = p.id returning x.attempts into attempt_number;
    insert into public.whatsapp_order_notification_attempts (part_id, attempt_number)
    values (p.id, attempt_number) returning id into a;
    part_id := p.id; attempt_id := a; part_number := p.part_number; message := p.message;
    return next;
  end loop;
end $$;

create or replace function public.finish_whatsapp_order_attempt(
  p_attempt uuid, p_success boolean, p_message_id text default null,
  p_http_status int default null, p_error text default null, p_retryable boolean default true
) returns void language plpgsql security definer set search_path = public as $$
declare
  a public.whatsapp_order_notification_attempts%rowtype;
  p public.whatsapp_order_notification_parts%rowtype;
  v_retry_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select * into a from public.whatsapp_order_notification_attempts where id = p_attempt for update;
  if not found or a.status <> 'pending' then return; end if;
  select * into p from public.whatsapp_order_notification_parts where id = a.part_id for update;
  if p_success then
    update public.whatsapp_order_notification_attempts set status = 'sent', http_status = p_http_status,
      whatsapp_message_id = p_message_id, completed_at = now() where id = a.id;
    update public.whatsapp_order_notification_parts set status = 'sent', whatsapp_message_id = p_message_id,
      last_http_status = p_http_status, last_error = null, sent_at = now(), locked_at = null, next_attempt_at = now()
      where id = p.id;
  else
    if p_retryable and p.attempts < 3 then
      v_retry_at := now() + case p.attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '20 minutes' end;
    end if;
    update public.whatsapp_order_notification_attempts set status = 'failed', http_status = p_http_status,
      error = left(coalesce(p_error, 'WHATSAPP_SEND_FAILED'), 2000), completed_at = now() where id = a.id;
    update public.whatsapp_order_notification_parts set status = 'failed', last_http_status = p_http_status,
      last_error = left(coalesce(p_error, 'WHATSAPP_SEND_FAILED'), 2000), next_attempt_at = v_retry_at, locked_at = null
      where id = p.id;
    update public.whatsapp_order_notifications set last_error = left(coalesce(p_error, 'WHATSAPP_SEND_FAILED'), 2000)
      where id = p.notification_id;
  end if;
end $$;

create or replace function public.finalize_whatsapp_order_notification(p_notification uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text; v_next timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.whatsapp_order_notification_parts where notification_id = p_notification) then
    raise exception 'NOTIFICATION_PARTS_MISSING';
  end if;
  if not exists (select 1 from public.whatsapp_order_notification_parts where notification_id = p_notification and status <> 'sent') then
    v_status := 'sent';
    update public.whatsapp_order_notifications set status = v_status, sent_at = now(), locked_at = null,
      next_attempt_at = now(), last_error = null where id = p_notification;
  elsif exists (select 1 from public.whatsapp_order_notification_parts where notification_id = p_notification and status = 'sending') then
    v_status := 'processing';
    update public.whatsapp_order_notifications set status = v_status, locked_at = now() where id = p_notification;
  elsif exists (select 1 from public.whatsapp_order_notification_parts where notification_id = p_notification
      and attempts < 3 and status in ('pending','failed') and next_attempt_at is not null) then
    v_status := 'pending';
    select min(next_attempt_at) into v_next from public.whatsapp_order_notification_parts
      where notification_id = p_notification and status in ('pending','failed') and next_attempt_at is not null;
    update public.whatsapp_order_notifications set status = v_status, next_attempt_at = coalesce(v_next, now()), locked_at = null
      where id = p_notification;
  else
    v_status := 'failed';
    update public.whatsapp_order_notifications set status = v_status, locked_at = null, next_attempt_at = now()
      where id = p_notification;
  end if;
  return v_status;
end $$;

create or replace function public.release_whatsapp_order_notification(p_notification uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare n public.whatsapp_order_notifications%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select * into n from public.whatsapp_order_notifications where id = p_notification for update;
  if not found or n.status = 'sent' then return; end if;
  update public.whatsapp_order_notifications set
    status = case when n.attempts >= 3 then 'failed' else 'pending' end,
    next_attempt_at = case when n.attempts >= 3 then now() else now() + interval '1 minute' end,
    locked_at = null, last_error = left(coalesce(p_error, 'WHATSAPP_DISPATCH_FAILED'), 2000)
  where id = p_notification;
end $$;

revoke all on function public.enqueue_whatsapp_new_order() from public, anon, authenticated;
revoke all on function public.claim_whatsapp_order_notifications(text, int) from public, anon, authenticated;
revoke all on function public.register_whatsapp_order_parts(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_order_parts(uuid, int) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_order_attempt(uuid, boolean, text, int, text, boolean) from public, anon, authenticated;
revoke all on function public.finalize_whatsapp_order_notification(uuid) from public, anon, authenticated;
revoke all on function public.release_whatsapp_order_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_order_notifications(text, int) to service_role;
grant execute on function public.register_whatsapp_order_parts(uuid, jsonb) to service_role;
grant execute on function public.claim_whatsapp_order_parts(uuid, int) to service_role;
grant execute on function public.finish_whatsapp_order_attempt(uuid, boolean, text, int, text, boolean) to service_role;
grant execute on function public.finalize_whatsapp_order_notification(uuid) to service_role;
grant execute on function public.release_whatsapp_order_notification(uuid, text) to service_role;

notify pgrst, 'reload schema';
commit;
