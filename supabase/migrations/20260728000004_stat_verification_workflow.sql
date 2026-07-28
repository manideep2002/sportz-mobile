-- MF-04: Athlete-stat verification workflow.
--
-- Builds on the verify_athlete_match RPC with:
--   1. evidence_url support on athlete_matches
--   2. Immutable verification audit log
--   3. stat_verified notification kind
--   4. Verifier queue + detail RPCs (security definer)
--   5. Trigger-based athlete notification on verification

-- 1. evidence_url column (for verifier review)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'athlete_matches' and column_name = 'evidence_url'
  ) then
    alter table public.athlete_matches add column evidence_url text;
  end if;
end $$;

-- 2. Immutable verification audit log.
create table if not exists public.stat_verification_audit (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.athlete_matches(id) on delete cascade,
  verifier_id uuid not null references public.profiles(id) on delete cascade,
  previous_status public.stat_verification_status not null,
  new_status public.stat_verification_status not null check (new_status in ('verified', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.stat_verification_audit enable row level security;

-- Verifiers (admins + team managers of the athlete's team) can read audit.
drop policy if exists "verifiers read stat verification audit" on public.stat_verification_audit;
create policy "verifiers read stat verification audit" on public.stat_verification_audit
  for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.athlete_matches m
      join public.team_roster tr on tr.athlete_id = m.athlete_id
      join public.team_managers tm on tm.team_id = tr.team_id and tm.user_id = auth.uid()
      where m.id = match_id
    )
  );

-- Athlete can read audit log for their own matches.
drop policy if exists "athlete read own stat verification audit" on public.stat_verification_audit;
create policy "athlete read own stat verification audit" on public.stat_verification_audit
  for select
  using (
    exists (
      select 1 from public.athlete_matches m
      where m.id = match_id and m.athlete_id = auth.uid()
    )
  );

-- 3. Notification kind for stat verification.
alter type public.sportz_notification_kind add value if not exists 'stat_verified';

-- 4. Helper: current user can verify (admin or team manager of at least one athlete).
create or replace function public.current_user_can_verify()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ) or exists (
    select 1 from public.team_managers where user_id = auth.uid()
  );
$$;

-- 5. Replace verify_athlete_match to add audit logging + athlete notification.
create or replace function public.verify_athlete_match(
  target_match_id uuid,
  target_status text,
  target_source text,
  target_reason text default null
)
returns public.athlete_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_match public.athlete_matches;
  previous_status text;
begin
  if target_status not in ('verified', 'rejected') then
    raise exception 'Verification status must be verified or rejected.';
  end if;

  select * into selected_match from public.athlete_matches where id = target_match_id;
  if selected_match.id is null then raise exception 'Match not found.'; end if;

  if not public.current_user_is_admin()
     and not exists (
       select 1
       from public.team_roster tr
       join public.team_managers tm on tm.team_id = tr.team_id
       where tr.athlete_id = selected_match.athlete_id
         and tm.user_id = current_user_id
     ) then
    raise exception 'Only an admin or the athlete''s team manager can verify this record.';
  end if;

  previous_status := selected_match.verification_status;

  update public.athlete_matches
  set verification_status = target_status,
      verification_source = nullif(trim(target_source), ''),
      verified_by = current_user_id,
      verified_at = now()
  where id = target_match_id
  returning * into selected_match;

  -- Audit log entry
  insert into public.stat_verification_audit (match_id, verifier_id, previous_status, new_status, reason)
  values (target_match_id, current_user_id, previous_status, target_status, target_reason);

  -- Notify the athlete
  insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
  values (
    selected_match.athlete_id,
    current_user_id,
    'stat_verified',
    case when target_status = 'verified' then 'Match verified' else 'Match rejected' end,
    case when target_status = 'verified'
      then 'Your match ' || selected_match.team_name || ' vs ' || selected_match.opponent_name || ' has been verified.'
      else 'Your match ' || selected_match.team_name || ' vs ' || selected_match.opponent_name || ' was rejected' || case when target_reason is not null then ': ' || target_reason else '.' end
    end,
    'athlete_match',
    target_match_id
  );

  return selected_match;
end;
$$;

-- 6. RPC: list pending/self-reported matches for verifiers.
create or replace function public.list_pending_verifications(
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.current_user_can_verify() then
    raise exception using errcode = '42501', message = 'Only verifiers can list pending verifications.';
  end if;

  select coalesce(jsonb_agg(row order by m.created_at desc), '[]'::jsonb) into v_result
  from (
    select
      m.id,
      m.athlete_id,
      m.season_id,
      m.sport,
      m.played_on,
      m.team_name,
      m.opponent_name,
      m.team_score,
      m.opponent_score,
      m.outcome,
      m.verification_status,
      m.verification_source,
      m.evidence_url,
      m.created_at,
      row_to_json(a.*) as athlete,
      row_to_json(s.*) as season
    from public.athlete_matches m
    join public.profiles a on a.id = m.athlete_id
    join public.athlete_seasons s on s.id = m.season_id
    where m.verification_status in ('self_reported', 'pending')
    order by m.created_at desc
    limit p_limit
    offset p_offset
  ) m;

  return v_result;
end;
$$;

-- 7. RPC: get full verification detail for a single match.
create or replace function public.get_verification_detail(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match jsonb;
  v_athlete jsonb;
  v_season jsonb;
  v_stats jsonb;
  v_audit jsonb;
begin
  if not public.current_user_can_verify() then
    raise exception using errcode = '42501', message = 'Only verifiers can view verification details.';
  end if;

  select to_jsonb(m.*) into v_match
  from public.athlete_matches m where m.id = p_match_id;
  if v_match is null then
    raise exception using errcode = 'P0001', message = 'Match not found.';
  end if;

  select to_jsonb(a.*) into v_athlete
  from public.profiles a where a.id = (v_match->>'athlete_id')::uuid;

  select to_jsonb(s.*) into v_season
  from public.athlete_seasons s where s.id = (v_match->>'season_id')::uuid;

  select coalesce(jsonb_agg(row order by d.display_order), '[]'::jsonb) into v_stats
  from (
    select
      ms.value,
      jsonb_build_object(
        'id', d.id,
        'stat_key', d.stat_key,
        'label', d.label,
        'unit', d.unit,
        'value_type', d.value_type,
        'aggregation', d.aggregation,
        'display_order', d.display_order
      ) as definition
    from public.athlete_match_stats ms
    join public.sport_stat_definitions d on d.id = ms.definition_id
    where ms.match_id = p_match_id
  ) row;

  select coalesce(jsonb_agg(a order by a.created_at desc), '[]'::jsonb) into v_audit
  from public.stat_verification_audit a
  where a.match_id = p_match_id;

  return jsonb_build_object(
    'match', v_match,
    'athlete', v_athlete,
    'season', v_season,
    'stats', v_stats,
    'auditLog', v_audit
  );
end;
$$;