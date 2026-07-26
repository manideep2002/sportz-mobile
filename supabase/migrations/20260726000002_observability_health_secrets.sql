-- P1-12: Provision the health probe's scheduler-only credentials without
-- exposing generated values to clients, CLI output, or source control.

insert into private.edge_function_secrets (name, secret_value)
select
  'observability_health_webhook',
  encode(extensions.gen_random_bytes(32), 'hex')
where not exists (
  select 1
  from private.edge_function_secrets
  where name = 'observability_health_webhook'
);

insert into private.edge_function_secrets (name, secret_value)
select
  'observability-health_url',
  regexp_replace(existing.secret_value, '/[^/]+$', '/observability-health')
from private.edge_function_secrets existing
where existing.name in (
  'feed-fanout_url',
  'process-social-events_url',
  'push-fanout_url',
  'finalize-media-upload_url'
)
  and existing.secret_value ~ '^https://[^/]+/functions/v1/[^/]+$'
  and not exists (
    select 1
    from private.edge_function_secrets
    where name = 'observability-health_url'
  )
order by existing.name
limit 1;

do $$
begin
  if not exists (
    select 1
    from private.edge_function_secrets
    where name = 'observability-health_url'
  ) then
    raise warning
      'observability-health URL was not derived. Add observability-health_url to private.edge_function_secrets.';
  end if;
end;
$$;
