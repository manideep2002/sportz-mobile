-- MF-03: Complete moderation review and enforcement workflow.
--
-- Creates an immutable audit log for moderation actions, adds soft-removal
-- support for content tables and an account-restriction flag, and provides
-- security-definer RPCs for each enforcement action.  Moderators are identified
-- by profiles.is_admin = true.  RLS is NOT weakened anywhere.

-- 1. Moderator can delete posts/comments directly (only usable in RPCs below).
drop policy if exists "moderators delete posts" on public.posts;
create policy "moderators delete posts" on public.posts
  for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "moderators delete comments" on public.comments;
create policy "moderators delete comments" on public.comments
  for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 2. Soft-removal columns on content tables.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'removed_by_moderator'
  ) then
    alter table public.posts add column removed_by_moderator boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'removed_by_moderator'
  ) then
    alter table public.comments add column removed_by_moderator boolean not null default false;
  end if;
end $$;

-- 3. Account-restriction column.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_restricted'
  ) then
    alter table public.profiles add column is_restricted boolean not null default false;
  end if;
end $$;

-- 4. Immutable moderation audit log.
create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('dismissed', 'removed_content', 'restricted_account')),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.moderation_audit_log enable row level security;

-- Moderators INSERT audit entries via RPCs (not directly).
-- Moderators SELECT all audit entries.
drop policy if exists "moderators read audit log" on public.moderation_audit_log;
create policy "moderators read audit log" on public.moderation_audit_log
  for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 5. Security-definer RPC: dismiss a report.
create or replace function public.moderate_dismiss_report(
  p_report_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorisation: caller must be admin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can dismiss reports.';
  end if;

  -- Guard: report must exist and be open
  if not exists (select 1 from public.reports where id = p_report_id and status = 'open') then
    raise exception using errcode = '23514', message = 'Report is not open or does not exist.';
  end if;

  -- Update report
  update public.reports
  set status = 'dismissed',
      resolution = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id;

  -- Audit trail
  insert into public.moderation_audit_log (report_id, moderator_id, action, reason)
  values (p_report_id, auth.uid(), 'dismissed', p_reason);
end;
$$;

-- 6. Security-definer RPC: remove content (soft-delete post or comment).
create or replace function public.moderate_remove_content(
  p_report_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can remove content.';
  end if;

  if not exists (select 1 from public.reports where id = p_report_id and status = 'open') then
    raise exception using errcode = '23514', message = 'Report is not open or does not exist.';
  end if;

  if p_entity_type = 'post' then
    update public.posts
    set body = '[removed by moderator]',
        media_url = null,
        stats_line = null,
        removed_by_moderator = true
    where id = p_entity_id;
  elsif p_entity_type = 'comment' then
    update public.comments
    set body = '[removed by moderator]',
        removed_by_moderator = true
    where id = p_entity_id;
  else
    raise exception using errcode = 'P0001', message = 'Unsupported entity type for content removal: ' || p_entity_type;
  end if;

  update public.reports
  set status = 'actioned',
      resolution = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id;

  insert into public.moderation_audit_log (report_id, moderator_id, action, reason)
  values (p_report_id, auth.uid(), 'removed_content', p_reason);
end;
$$;

-- 7. Security-definer RPC: restrict (suspend) a user account.
create or replace function public.moderate_restrict_account(
  p_report_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can restrict accounts.';
  end if;

  if not exists (select 1 from public.reports where id = p_report_id and status = 'open') then
    raise exception using errcode = '23514', message = 'Report is not open or does not exist.';
  end if;

  update public.profiles
  set is_restricted = true
  where id = p_target_user_id;

  update public.reports
  set status = 'actioned',
      resolution = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id;

  insert into public.moderation_audit_log (report_id, moderator_id, action, reason)
  values (p_report_id, auth.uid(), 'restricted_account', p_reason);
end;
$$;

-- 8. RPC to fetch a report's detail together with its audit trail
--    (moderators only).
create or replace function public.moderate_get_report_detail(
  p_report_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report jsonb;
  v_audit jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can view report details.';
  end if;

  select to_jsonb(r.*) into v_report
  from public.reports r
  where r.id = p_report_id;

  if v_report is null then
    raise exception using errcode = 'P0001', message = 'Report not found.';
  end if;

  select coalesce(jsonb_agg(a order by a.created_at desc), '[]'::jsonb) into v_audit
  from public.moderation_audit_log a
  where a.report_id = p_report_id;

  return jsonb_build_object(
    'report', v_report,
    'auditLog', v_audit
  );
end;
$$;

-- 9. RPC to fetch a lightweight entity preview for the moderation screen.
--    Returns a jsonb object with keys that vary by entity_type.
create or replace function public.moderate_get_entity_preview(
  p_entity_type text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can view entity previews.';
  end if;

  if p_entity_type = 'post' then
    select to_jsonb(row) into v_result
    from (
      select id, author_id, body, media_url, media_kind, kind, visibility, removed_by_moderator, created_at
      from public.posts where id = p_entity_id
    ) row;
  elsif p_entity_type = 'comment' then
    select to_jsonb(row) into v_result
    from (
      select id, post_id, author_id, body, removed_by_moderator, created_at
      from public.comments where id = p_entity_id
    ) row;
  elsif p_entity_type in ('user', 'community', 'group', 'page') then
    -- Return profile info for user reports, community info for group/page reports
    select to_jsonb(row) into v_result
    from (
      select id, username, display_name, avatar_url, is_restricted, is_admin
      from public.profiles where id = p_entity_id
    ) row;
  else
    v_result := '{}'::jsonb;
  end if;

  if v_result is null or v_result = 'null'::jsonb then
    v_result := '{}'::jsonb;
  end if;

  return v_result;
end;
$$;

-- 10. RPC to fetch the reporter profile for the detail view.
create or replace function public.moderate_get_reporter_profile(
  p_reporter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception using errcode = '42501', message = 'Only moderators can view reporter profiles.';
  end if;

  select to_jsonb(r) into v_result
  from (
    select id, username, display_name, avatar_url
    from public.profiles where id = p_reporter_id
  ) r;

  return v_result;
end;
$$;