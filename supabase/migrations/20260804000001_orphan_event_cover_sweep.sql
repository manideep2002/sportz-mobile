-- ── Orphaned event-cover sweeper ─────────────────────────────────────────────
-- Covers uploaded to `event-covers` are normally removed by the client via
-- compensating deletion (see cleanupUnattachedCover in src/services/eventService.ts)
-- when event creation or update fails. If the process dies between upload and
-- attach — or cleanup itself fails — the object is never referenced. This
-- sweeper deletes event-cover objects older than max_age_hours that no
-- sport_events.cover_url references.

create or replace function public.sweep_orphan_event_covers(max_age_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  -- Storage guards direct SQL deletes via the protect_objects_delete trigger.
  -- Scope-disable it for this deliberate sweep and re-enable it afterwards.
  alter table storage.objects disable trigger protect_objects_delete;
  begin
    delete from storage.objects as orphan
    where orphan.bucket_id = 'event-covers'
      and orphan.created_at < now() - make_interval(hours => max_age_hours)
      and orphan.name not in (
        select substring(e.cover_url from '/storage/v1/object/public/event-covers/([^?]+)')
        from public.sport_events as e
        where e.cover_url like '%/storage/v1/object/public/event-covers/%'
      );
    get diagnostics swept = row_count;
  exception
    when others then
      alter table storage.objects enable trigger protect_objects_delete;
      raise;
  end;
  alter table storage.objects enable trigger protect_objects_delete;
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
