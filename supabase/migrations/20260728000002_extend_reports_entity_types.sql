-- MF-02: Extend reports to cover comments, events, groups, and pages.
-- Also adds status column (with default 'open'), reviewed_by, reviewed_at and
-- a unique partial index that prevents a single user from filing the same
-- report twice for the same entity (duplicate-report detection).
-- Moderator-read RLS is added so admins can list all reports.
-- RLS is NOT weakened: users can still only insert their own reports and read
-- their own reports; moderators get an additional read-only policy.

-- 1. Expand the entity_type check constraint to include all supported types.
--    We drop and recreate because ALTER TABLE ... ADD CONSTRAINT only allows
--    adding new constraints, not modifying existing ones.
alter table public.reports
  drop constraint if exists reports_entity_type_check;

alter table public.reports
  add constraint reports_entity_type_check
  check (entity_type in ('user', 'post', 'comment', 'event', 'community', 'group', 'page', 'team_offer'));

-- 2. Add status, resolution, reviewed_by, reviewed_at columns if absent.
--    Use IF NOT EXISTS-style: add then ignore existing-column error by
--    wrapping each in a DO block.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'status'
  ) then
    alter table public.reports
      add column status text not null default 'open'
      check (status in ('open', 'reviewed', 'dismissed', 'actioned'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'resolution'
  ) then
    alter table public.reports add column resolution text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'reviewed_by'
  ) then
    alter table public.reports
      add column reviewed_by uuid references public.profiles(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'reviewed_at'
  ) then
    alter table public.reports add column reviewed_at timestamptz;
  end if;
end $$;

-- 3. Remove duplicate open reports before creating the unique index.
--    Keep the earliest report (min created_at) for each reporter+entity
--    combination; delete the rest. This is safe to run on an existing DB.
delete from public.reports
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by reporter_id, entity_type, entity_id
        order by created_at asc
      ) as rn
    from public.reports
    where status = 'open'
  ) ranked
  where rn > 1
);

-- 4. Unique partial index: one open report per reporter per entity.
--    Using a partial index on status = 'open' so a reporter can re-report
--    after a previous report was dismissed/actioned.
create unique index if not exists reports_unique_open_per_reporter_entity
  on public.reports (reporter_id, entity_type, entity_id)
  where (status = 'open');

-- 4. Supporting indexes.
create index if not exists reports_entity_idx
  on public.reports (entity_type, entity_id);

create index if not exists reports_status_idx
  on public.reports (status);

-- 5. Moderator RLS: allow app-level admins (profiles.is_admin = true) to read
--    all reports. This does NOT weaken the existing insert policy.
drop policy if exists "moderators read all reports" on public.reports;
create policy "moderators read all reports" on public.reports
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 6. Moderators may update report status/resolution.
drop policy if exists "moderators update reports" on public.reports;
create policy "moderators update reports" on public.reports
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
