create extension if not exists pg_net;

create or replace function private.dispatch_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, net
as $$
declare
  webhook_secret text;
begin
  select secret_value
  into webhook_secret
  from private.edge_function_secrets
  where name = 'notification_dispatcher_webhook';

  if webhook_secret is null then
    raise warning 'notification_dispatcher_webhook secret is not configured.';
    return new;
  end if;

  perform net.http_post(
    url := 'https://rvsfmfuooxhopmxdqbao.functions.supabase.co/notification-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-supabase-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'schema', tg_table_schema,
      'table', tg_table_name,
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 1000
  );

  return new;
end;
$$;

drop trigger if exists notifications_dispatch_webhook on public.notifications;
create trigger notifications_dispatch_webhook
after insert on public.notifications
for each row execute function private.dispatch_notification_webhook();

revoke all on function private.dispatch_notification_webhook() from public, anon, authenticated;
