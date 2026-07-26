-- P1-12: Invoke the privacy-safe observability health probe every five minutes.
-- Secret values and deployment URLs are intentionally provisioned outside source
-- control in private.edge_function_secrets.

create or replace function private.schedule_observability_health()
returns void
language sql
security definer
set search_path = private
as $$
  select private.invoke_edge_function('observability-health', 'observability_health_webhook');
$$;

revoke all on function private.schedule_observability_health() from public, anon, authenticated;
grant execute on function private.schedule_observability_health() to service_role;

select cron.unschedule('sportz-observability-health')
where exists (
  select 1
  from cron.job
  where jobname = 'sportz-observability-health'
);

select cron.schedule(
  'sportz-observability-health',
  '*/5 * * * *',
  $$select private.schedule_observability_health()$$
);

comment on function private.schedule_observability_health() is
  'Runs the PII-safe queue, push-delivery, and media-processing health probe.';
