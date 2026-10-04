-- À exécuter après le déploiement de whatsapp-order-dispatcher et la création
-- des deux entrées Supabase Vault décrites dans supabase/README.md.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'dossora_project_url') then
    raise exception 'Créer d''abord le secret Vault dossora_project_url';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'dossora_whatsapp_dispatch_secret') then
    raise exception 'Créer d''abord le secret Vault dossora_whatsapp_dispatch_secret';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'dossora-whatsapp-order-dispatcher';
select cron.schedule(
  'dossora-whatsapp-order-dispatcher',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'dossora_project_url')
        || '/functions/v1/whatsapp-order-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dossora_whatsapp_dispatch_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
