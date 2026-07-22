-- P0-2: Reproducible feed-fanout scheduler, push-fanout scheduler,
--       process-social-events scheduler, and deployment health-check view.
--
-- Prerequisites already satisfied by earlier migrations:
--   pg_net       — 20260710000010_notification_webhook_pg_net.sql
--   pgmq         — 20260711000001_social_interactions_queue.sql
--   private.edge_function_secrets — 20260710000009_private_edge_function_secrets.sql
--
-- New dependency: pg_cron (enabled on all Supabase Pro/Team/Enterprise projects).
-- On the free tier, use external cron (see docs/SETUP.md §8).

-- ── pg_cron extension ────────────────────────────────────────────────────────
create extension if not exists pg_cron;
grant usage on schema cron to postgres;

-- ── Helper: invoke an Edge Function via pg_net ───────────────────────────────
-- Used by cron jobs so we don't hard-code HTTP calls inline in each schedule.
create or replace function private.invoke_edge_function(
  function_name  text,
  secret_name    text
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions, net
as $$
declare
  webhook_secret  text;
  function_url    text;
  url_secret_name text := function_name || '_url';
begin
  select secret_value
  into webhook_secret
  from private.edge_function_secrets
  where name = secret_name;

  if webhook_secret is null then
    raise warning 'invoke_edge_function: secret "%" is not configured — skipping %.', secret_name, function_name;
    return;
  end if;

  select secret_value
  into function_url
  from private.edge_function_secrets
  where name = url_secret_name;

  -- Fall back to the standard Supabase function URL pattern; callers may
  -- override by inserting a row named "<function>_url" into edge_function_secrets.
  if function_url is null then
    raise warning 'invoke_edge_function: URL secret "%" not set — function "%" will not be called. '
                  'Insert a row into private.edge_function_secrets with name = ''%'' '
                  'and secret_value = ''https://<project-ref>.supabase.co/functions/v1/%''.',
                  url_secret_name, function_name, url_secret_name, function_name;
    return;
  end if;

  perform net.http_post(
    url     := function_url,
    headers := jsonb_build_object(
      'Content-Type',              'application/json',
      'x-supabase-webhook-secret', webhook_secret
    ),
    body    := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.invoke_edge_function(text, text) from public, anon, authenticated;
grant execute on function private.invoke_edge_function(text, text) to service_role;

-- ── Scheduler wrappers ───────────────────────────────────────────────────────

-- feed-fanout: drain pending feed_fanout_jobs.
-- Called every minute; the function is idempotent and returns quickly when
-- the queue is empty.
create or replace function private.schedule_feed_fanout()
returns void
language sql
security definer
set search_path = private
as $$
  select private.invoke_edge_function('feed-fanout', 'feed_fanout_webhook');
$$;

revoke all on function private.schedule_feed_fanout() from public, anon, authenticated;
grant execute on function private.schedule_feed_fanout() to service_role;

-- process-social-events: drain PGMQ social_events queue + flush bundles.
-- Called every 30 s; the function is idempotent and exits when the queue is empty.
create or replace function private.schedule_process_social_events()
returns void
language sql
security definer
set search_path = private
as $$
  select private.invoke_edge_function('process-social-events', 'process_social_events_webhook');
$$;

revoke all on function private.schedule_process_social_events() from public, anon, authenticated;
grant execute on function private.schedule_process_social_events() to service_role;

-- push-fanout: sweep un-sent notifications and deliver via Expo Push API.
-- Called every 2 minutes.
create or replace function private.schedule_push_fanout()
returns void
language sql
security definer
set search_path = private
as $$
  select private.invoke_edge_function('push-fanout', 'push_fanout_webhook');
$$;

revoke all on function private.schedule_push_fanout() from public, anon, authenticated;
grant execute on function private.schedule_push_fanout() to service_role;

-- ── Register pg_cron jobs ────────────────────────────────────────────────────
-- Idempotent: unschedule first so re-running this migration is safe.

select cron.unschedule('sportz-feed-fanout')          where exists (select 1 from cron.job where jobname = 'sportz-feed-fanout');
select cron.unschedule('sportz-process-social-events') where exists (select 1 from cron.job where jobname = 'sportz-process-social-events');
select cron.unschedule('sportz-push-fanout')           where exists (select 1 from cron.job where jobname = 'sportz-push-fanout');

-- feed-fanout: every 1 minute
select cron.schedule(
  'sportz-feed-fanout',
  '* * * * *',
  $$select private.schedule_feed_fanout()$$
);

-- process-social-events: every 30 seconds (two per minute)
select cron.schedule(
  'sportz-process-social-events',
  '* * * * *',
  $$select private.schedule_process_social_events()$$
);

-- push-fanout: every 2 minutes
select cron.schedule(
  'sportz-push-fanout',
  '*/2 * * * *',
  $$select private.schedule_push_fanout()$$
);

-- ── Deployment health-check view ─────────────────────────────────────────────
-- Run:  SELECT * FROM public.deployment_health_check;
-- A healthy deployment shows check_ok = true for every row.
-- Any false row indicates a missing secret, missing URL, or unscheduled job.

drop view if exists public.deployment_health_check;
create view public.deployment_health_check as

-- Required secrets in private.edge_function_secrets
with required_secrets (name, description) as (
  values
    ('chat_webhook_secret',             'Secret sent by the DB trigger → chat-message-notifier. Must match CHAT_WEBHOOK_SECRET env var.'),
    ('notification_dispatcher_webhook', 'Secret sent by the DB trigger → notification-dispatcher. Must match NOTIFICATION_WEBHOOK_SECRET env var.'),
    ('process_social_events_webhook',   'Secret sent by the DB trigger → process-social-events. Must match SOCIAL_EVENTS_WEBHOOK_SECRET env var.'),
    ('finalize_media_upload_webhook',   'Secret sent by the DB trigger → finalize-media-upload. Must match MEDIA_UPLOAD_WEBHOOK_SECRET env var.'),
    ('feed_fanout_webhook',             'Secret sent by pg_cron → feed-fanout.'),
    ('push_fanout_webhook',             'Secret sent by pg_cron → push-fanout.'),
    -- Function URLs (resolved at trigger time; required for pg_cron-driven jobs)
    ('feed_fanout_url',                 'URL of the feed-fanout Edge Function, e.g. https://<ref>.supabase.co/functions/v1/feed-fanout'),
    ('process_social_events_url',       'URL of the process-social-events Edge Function.'),
    ('push_fanout_url',                 'URL of the push-fanout Edge Function.'),
    ('finalize_media_upload_url',       'URL of the finalize-media-upload Edge Function.'),
    ('notification_dispatcher_url',     'URL of the notification-dispatcher Edge Function (used by the DB trigger).'),
    ('chat_message_notifier_url',       'URL of chat-message-notifier (set via app.settings.chat_message_notifier_url).')
),

secret_check as (
  select
    rs.name,
    rs.description,
    case when efs.name is not null then true else false end as check_ok,
    case
      when efs.name is null then 'MISSING — insert into private.edge_function_secrets'
      else 'present'
    end as status
  from required_secrets rs
  left join private.edge_function_secrets efs on efs.name = rs.name
),

-- Required pg_cron jobs
required_jobs (jobname, description) as (
  values
    ('sportz-feed-fanout',           'Drains feed_fanout_jobs every minute.'),
    ('sportz-process-social-events', 'Processes PGMQ social_events queue every minute.'),
    ('sportz-push-fanout',           'Sweeps unsent notifications every 2 minutes.')
),

job_check as (
  select
    rj.jobname as name,
    rj.description,
    case when cj.jobname is not null then true else false end as check_ok,
    case
      when cj.jobname is null then 'MISSING — re-run migration or register manually with cron.schedule()'
      when cj.active = false  then 'INACTIVE — call SELECT cron.alter_job(jobid, active := true)'
      else 'scheduled'
    end as status
  from required_jobs rj
  left join cron.job cj on cj.jobname = rj.jobname
),

-- Required extensions
required_extensions (extname, description) as (
  values
    ('pg_net',  'Async HTTP from Postgres triggers.'),
    ('pg_cron', 'Scheduled jobs for feed-fanout, push-fanout, and social-events.'),
    ('pgmq',    'Durable FIFO queue for social interaction events.')
),

extension_check as (
  select
    re.extname as name,
    re.description,
    case when pe.extname is not null then true else false end as check_ok,
    case
      when pe.extname is null then 'MISSING — run: CREATE EXTENSION <name>;'
      else 'installed'
    end as status
  from required_extensions re
  left join pg_extension pe on pe.extname = re.extname
)

select 'secret'    as check_type, name, description, check_ok, status from secret_check
union all
select 'cron_job'  as check_type, name, description, check_ok, status from job_check
union all
select 'extension' as check_type, name, description, check_ok, status from extension_check
order by check_ok asc, check_type, name;

-- Only service_role can read this view (it joins private.edge_function_secrets).
revoke all on public.deployment_health_check from public, anon, authenticated;
grant select on public.deployment_health_check to service_role;

comment on view public.deployment_health_check is
  'Run SELECT * FROM public.deployment_health_check; to verify all required '
  'secrets, pg_cron jobs, and extensions are configured. Every row must show '
  'check_ok = true before going to production.';
