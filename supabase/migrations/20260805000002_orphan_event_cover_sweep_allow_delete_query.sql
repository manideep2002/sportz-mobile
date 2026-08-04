-- Follow-up to 20260805000001_orphan_event_cover_sweep_protected_delete.sql:
-- the alter-table trigger toggle requires table ownership and fails on managed
-- Supabase (storage.objects is owned by supabase_storage_admin, not postgres).
-- The storage guard storage.protect_delete() instead permits sanctioned deletes
-- when the transaction-local GUC storage.allow_delete_query is 'true'.

create or replace function public.sweep_orphan_event_covers(max_age_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  -- The storage extension's protect_objects_delete guard (storage.protect_delete)
  -- allows direct deletes when storage.allow_delete_query is set to 'true'.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects as orphan
  where orphan.bucket_id = 'event-covers'
    and orphan.created_at < now() - make_interval(hours => max_age_hours)
    and orphan.name not in (
      select substring(e.cover_url from '/storage/v1/object/public/event-covers/([^?]+)')
      from public.sport_events as e
      where e.cover_url like '%/storage/v1/object/public/event-covers/%'
    );
  get diagnostics swept = row_count;
  return swept;
end;
$$;

revoke all on function public.sweep_orphan_event_covers(integer) from public, anon;
grant execute on function public.sweep_orphan_event_covers(integer) to service_role;

comment on function public.sweep_orphan_event_covers(integer) is
  'Deletes event-cover storage objects older than max_age_hours that no sport_event references. Returns the number of objects removed.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'sweep-orphan-event-covers';
    perform cron.schedule(
      'sweep-orphan-event-covers',
      '0 */6 * * *',
      'select public.sweep_orphan_event_covers();'
    );
  else
    raise notice 'pg_cron unavailable; call public.sweep_orphan_event_covers() from an external scheduler.';
  end if;
end
$$;
