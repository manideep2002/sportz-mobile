-- P2-2: structured, sport-aware athlete statistics.

create table if not exists public.athlete_seasons (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null check (sport in ('basketball', 'football', 'cricket')),
  label text not null check (char_length(trim(label)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_seasons_date_order check (ends_on >= starts_on),
  constraint athlete_seasons_unique unique (athlete_id, sport, label)
);

create trigger athlete_seasons_set_updated_at
before update on public.athlete_seasons
for each row execute function public.set_updated_at();

create table if not exists public.sport_stat_definitions (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('basketball', 'football', 'cricket')),
  stat_key text not null check (stat_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  value_type text not null check (value_type in ('integer', 'decimal')),
  unit text,
  aggregation text not null check (aggregation in ('sum', 'average', 'maximum', 'minimum')),
  higher_is_better boolean not null default true,
  is_required boolean not null default false,
  minimum_value numeric,
  maximum_value numeric,
  display_order integer not null default 0,
  is_active boolean not null default true,
  unique (sport, stat_key)
);

insert into public.sport_stat_definitions
  (sport, stat_key, label, value_type, unit, aggregation, is_required, minimum_value, maximum_value, display_order)
values
  ('basketball', 'points', 'Points', 'integer', 'PTS', 'average', true, 0, 200, 10),
  ('basketball', 'rebounds', 'Rebounds', 'integer', 'REB', 'average', true, 0, 100, 20),
  ('basketball', 'assists', 'Assists', 'integer', 'AST', 'average', true, 0, 100, 30),
  ('basketball', 'steals', 'Steals', 'integer', 'STL', 'average', false, 0, 30, 40),
  ('basketball', 'blocks', 'Blocks', 'integer', 'BLK', 'average', false, 0, 30, 50),
  ('basketball', 'minutes', 'Minutes', 'decimal', 'MIN', 'average', false, 0, 100, 60),
  ('football', 'goals', 'Goals', 'integer', 'G', 'sum', true, 0, 30, 10),
  ('football', 'assists', 'Assists', 'integer', 'A', 'sum', true, 0, 30, 20),
  ('football', 'minutes', 'Minutes', 'integer', 'MIN', 'sum', true, 0, 180, 30),
  ('football', 'shots_on_target', 'Shots on target', 'integer', 'SOT', 'sum', false, 0, 50, 40),
  ('football', 'tackles', 'Tackles', 'integer', 'TCK', 'average', false, 0, 100, 50),
  ('football', 'saves', 'Saves', 'integer', 'SV', 'sum', false, 0, 50, 60),
  ('cricket', 'runs', 'Runs', 'integer', 'RUNS', 'average', true, 0, 1000, 10),
  ('cricket', 'wickets', 'Wickets', 'integer', 'WKTS', 'sum', true, 0, 20, 20),
  ('cricket', 'balls_faced', 'Balls faced', 'integer', 'BF', 'sum', true, 0, 1000, 30),
  ('cricket', 'overs_bowled', 'Overs bowled', 'decimal', 'OV', 'sum', false, 0, 100, 40),
  ('cricket', 'runs_conceded', 'Runs conceded', 'integer', 'RC', 'sum', false, 0, 1000, 50),
  ('cricket', 'catches', 'Catches', 'integer', 'CT', 'sum', false, 0, 20, 60)
on conflict (sport, stat_key) do update
set label = excluded.label,
    value_type = excluded.value_type,
    unit = excluded.unit,
    aggregation = excluded.aggregation,
    is_required = excluded.is_required,
    minimum_value = excluded.minimum_value,
    maximum_value = excluded.maximum_value,
    display_order = excluded.display_order,
    is_active = true;

create table if not exists public.athlete_matches (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.athlete_seasons(id) on delete cascade,
  sport text not null check (sport in ('basketball', 'football', 'cricket')),
  played_on date not null,
  team_name text not null check (char_length(trim(team_name)) between 1 and 120),
  opponent_name text not null check (char_length(trim(opponent_name)) between 1 and 120),
  team_score integer check (team_score is null or team_score >= 0),
  opponent_score integer check (opponent_score is null or opponent_score >= 0),
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'no_result')),
  verification_status text not null default 'self_reported'
    check (verification_status in ('self_reported', 'pending', 'verified', 'rejected')),
  verification_source text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athlete_matches_profile_season_idx
  on public.athlete_matches(athlete_id, season_id, played_on desc);

create trigger athlete_matches_set_updated_at
before update on public.athlete_matches
for each row execute function public.set_updated_at();

create or replace function public.validate_athlete_match_season()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_season public.athlete_seasons;
begin
  select * into selected_season
  from public.athlete_seasons
  where id = new.season_id;
  if selected_season.id is null
     or selected_season.athlete_id <> new.athlete_id
     or selected_season.sport <> new.sport then
    raise exception 'Match athlete and sport must match the selected season.';
  end if;
  if new.played_on < selected_season.starts_on or new.played_on > selected_season.ends_on then
    raise exception 'Match date must fall within the selected season.';
  end if;
  return new;
end;
$$;

drop trigger if exists athlete_matches_validate_season on public.athlete_matches;
create trigger athlete_matches_validate_season
before insert or update of athlete_id, season_id, sport, played_on on public.athlete_matches
for each row execute function public.validate_athlete_match_season();

create table if not exists public.athlete_match_stats (
  match_id uuid not null references public.athlete_matches(id) on delete cascade,
  definition_id uuid not null references public.sport_stat_definitions(id) on delete restrict,
  value numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, definition_id)
);

create trigger athlete_match_stats_set_updated_at
before update on public.athlete_match_stats
for each row execute function public.set_updated_at();

create or replace function public.validate_athlete_match_stat()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_sport text;
  definition public.sport_stat_definitions;
begin
  select sport into match_sport from public.athlete_matches where id = new.match_id;
  select * into definition from public.sport_stat_definitions where id = new.definition_id;
  if definition.id is null or match_sport <> definition.sport then
    raise exception 'Stat definition does not belong to the match sport.';
  end if;
  if definition.value_type = 'integer' and trunc(new.value) <> new.value then
    raise exception '% must be a whole number.', definition.label;
  end if;
  if definition.minimum_value is not null and new.value < definition.minimum_value then
    raise exception '% is below the allowed minimum.', definition.label;
  end if;
  if definition.maximum_value is not null and new.value > definition.maximum_value then
    raise exception '% exceeds the allowed maximum.', definition.label;
  end if;
  return new;
end;
$$;

drop trigger if exists athlete_match_stats_validate on public.athlete_match_stats;
create trigger athlete_match_stats_validate
before insert or update on public.athlete_match_stats
for each row execute function public.validate_athlete_match_stat();

create table if not exists public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('basketball', 'football', 'cricket')),
  achievement_key text not null,
  title text not null,
  description text not null,
  badge text not null,
  stat_key text not null,
  metric text not null check (metric in ('maximum', 'sum', 'average')),
  threshold numeric not null,
  is_active boolean not null default true,
  unique (sport, achievement_key)
);

insert into public.achievement_definitions
  (sport, achievement_key, title, description, badge, stat_key, metric, threshold)
values
  ('basketball', 'thirty_point_game', '30 Point Game', 'Score at least 30 points in one game.', '🏀', 'points', 'maximum', 30),
  ('basketball', 'double_digit_assists', 'Floor General', 'Record at least 10 assists in one game.', '🎯', 'assists', 'maximum', 10),
  ('football', 'hat_trick', 'Hat Trick', 'Score three goals in one match.', '⚽', 'goals', 'maximum', 3),
  ('football', 'ten_goals', 'Double Digits', 'Score ten goals in a season.', '🥅', 'goals', 'sum', 10),
  ('cricket', 'century', 'Century', 'Score at least 100 runs in one match.', '🏏', 'runs', 'maximum', 100),
  ('cricket', 'five_wickets', 'Five-Wicket Haul', 'Take at least five wickets in one match.', '🔥', 'wickets', 'maximum', 5)
on conflict (sport, achievement_key) do update
set title = excluded.title,
    description = excluded.description,
    badge = excluded.badge,
    stat_key = excluded.stat_key,
    metric = excluded.metric,
    threshold = excluded.threshold,
    is_active = true;

create table if not exists public.athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.athlete_seasons(id) on delete cascade,
  definition_id uuid not null references public.achievement_definitions(id) on delete restrict,
  progress numeric not null,
  awarded_at timestamptz not null default now(),
  unique (athlete_id, season_id, definition_id)
);

create or replace view public.athlete_stat_aggregates
with (security_invoker = true)
as
select
  m.athlete_id,
  m.season_id,
  m.sport,
  d.id as definition_id,
  d.stat_key,
  d.label,
  d.unit,
  d.aggregation,
  count(distinct m.id)::integer as match_count,
  sum(s.value)::numeric as total_value,
  avg(s.value)::numeric as average_value,
  max(s.value)::numeric as maximum_value,
  min(s.value)::numeric as minimum_value
from public.athlete_matches m
join public.athlete_match_stats s on s.match_id = m.id
join public.sport_stat_definitions d on d.id = s.definition_id
where m.verification_status <> 'rejected'
group by m.athlete_id, m.season_id, m.sport, d.id, d.stat_key, d.label, d.unit, d.aggregation;

create or replace function public.recompute_athlete_achievements(
  target_athlete_id uuid,
  target_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.athlete_achievements (
    athlete_id, season_id, definition_id, progress
  )
  select
    a.athlete_id,
    a.season_id,
    ad.id,
    case ad.metric
      when 'maximum' then a.maximum_value
      when 'sum' then a.total_value
      else a.average_value
    end
  from public.athlete_stat_aggregates a
  join public.achievement_definitions ad
    on ad.sport = a.sport and ad.stat_key = a.stat_key and ad.is_active
  where a.athlete_id = target_athlete_id
    and a.season_id = target_season_id
    and case ad.metric
      when 'maximum' then a.maximum_value
      when 'sum' then a.total_value
      else a.average_value
    end >= ad.threshold
  on conflict (athlete_id, season_id, definition_id) do update
  set progress = greatest(public.athlete_achievements.progress, excluded.progress);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.record_athlete_match(
  target_season_id uuid,
  target_played_on date,
  target_team_name text,
  target_opponent_name text,
  target_team_score integer,
  target_opponent_score integer,
  target_outcome text,
  target_stats jsonb
)
returns public.athlete_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_season public.athlete_seasons;
  created_match public.athlete_matches;
  stat_pair record;
  selected_definition public.sport_stat_definitions;
  missing_required text;
  games_count integer;
  wins_count integer;
begin
  if current_user_id is null then raise exception 'You must be signed in to record statistics.'; end if;
  select * into selected_season
  from public.athlete_seasons
  where id = target_season_id and athlete_id = current_user_id;
  if selected_season.id is null then raise exception 'Season not found or not owned by you.'; end if;
  if target_played_on < selected_season.starts_on or target_played_on > selected_season.ends_on then
    raise exception 'Match date must fall within the selected season.';
  end if;
  if jsonb_typeof(target_stats) <> 'object' then raise exception 'Stats must be an object.'; end if;

  select string_agg(d.stat_key, ', ' order by d.display_order)
  into missing_required
  from public.sport_stat_definitions d
  where d.sport = selected_season.sport
    and d.is_required
    and d.is_active
    and not (target_stats ? d.stat_key);
  if missing_required is not null then
    raise exception 'Missing required stats: %', missing_required;
  end if;

  insert into public.athlete_matches (
    athlete_id, season_id, sport, played_on, team_name, opponent_name,
    team_score, opponent_score, outcome, verification_status
  )
  values (
    current_user_id, selected_season.id, selected_season.sport, target_played_on,
    trim(target_team_name), trim(target_opponent_name), target_team_score,
    target_opponent_score, target_outcome, 'self_reported'
  )
  returning * into created_match;

  for stat_pair in select key, value from jsonb_each_text(target_stats)
  loop
    select * into selected_definition
    from public.sport_stat_definitions d
    where d.sport = selected_season.sport
      and d.stat_key = stat_pair.key
      and d.is_active;
    if selected_definition.id is null then
      raise exception 'Stat "%" is not valid for %.', stat_pair.key, selected_season.sport;
    end if;
    insert into public.athlete_match_stats (match_id, definition_id, value)
    values (created_match.id, selected_definition.id, stat_pair.value::numeric);
  end loop;

  perform public.recompute_athlete_achievements(current_user_id, selected_season.id);

  select count(*)::integer, count(*) filter (where outcome = 'win')::integer
  into games_count, wins_count
  from public.athlete_matches
  where athlete_id = current_user_id and verification_status <> 'rejected';

  update public.profiles
  set games_played = games_count,
      win_rate = case when games_count = 0 then 0 else round((wins_count::numeric / games_count) * 100, 2) end,
      updated_at = now()
  where id = current_user_id;

  return created_match;
end;
$$;

create or replace function public.verify_athlete_match(
  target_match_id uuid,
  target_status text,
  target_source text
)
returns public.athlete_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_match public.athlete_matches;
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

  update public.athlete_matches
  set verification_status = target_status,
      verification_source = nullif(trim(target_source), ''),
      verified_by = current_user_id,
      verified_at = now()
  where id = target_match_id
  returning * into selected_match;
  return selected_match;
end;
$$;

alter table public.athlete_seasons enable row level security;
alter table public.sport_stat_definitions enable row level security;
alter table public.athlete_matches enable row level security;
alter table public.athlete_match_stats enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.athlete_achievements enable row level security;

create policy "seasons are readable unless blocked" on public.athlete_seasons
for select using (
  auth.uid() is null
  or auth.uid() = athlete_id
  or not public.users_blocked_each_other(auth.uid(), athlete_id)
);
create policy "athletes create own seasons" on public.athlete_seasons
for insert with check (auth.uid() = athlete_id);
create policy "athletes update own seasons" on public.athlete_seasons
for update using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);
create policy "athletes delete own seasons" on public.athlete_seasons
for delete using (auth.uid() = athlete_id);

create policy "stat definitions are readable" on public.sport_stat_definitions
for select using (true);

create policy "matches are readable unless blocked" on public.athlete_matches
for select using (
  auth.uid() is null
  or auth.uid() = athlete_id
  or not public.users_blocked_each_other(auth.uid(), athlete_id)
);
create policy "athletes update own matches" on public.athlete_matches
for update using (
  auth.uid() = athlete_id
  and verification_status in ('self_reported', 'pending')
) with check (
  auth.uid() = athlete_id
  and verification_status in ('self_reported', 'pending')
);
create policy "athletes delete own unverified matches" on public.athlete_matches
for delete using (
  auth.uid() = athlete_id and verification_status in ('self_reported', 'pending')
);

create policy "match stats follow match visibility" on public.athlete_match_stats
for select using (
  exists (
    select 1 from public.athlete_matches m
    where m.id = match_id
      and (
        auth.uid() is null
        or auth.uid() = m.athlete_id
        or not public.users_blocked_each_other(auth.uid(), m.athlete_id)
      )
  )
);
create policy "athletes update own unverified stats" on public.athlete_match_stats
for update using (
  exists (
    select 1 from public.athlete_matches m
    where m.id = match_id
      and m.athlete_id = auth.uid()
      and m.verification_status in ('self_reported', 'pending')
  )
);

create policy "achievement definitions are readable" on public.achievement_definitions
for select using (true);
create policy "achievements are readable unless blocked" on public.athlete_achievements
for select using (
  auth.uid() is null
  or auth.uid() = athlete_id
  or not public.users_blocked_each_other(auth.uid(), athlete_id)
);

grant select on public.athlete_seasons, public.sport_stat_definitions,
  public.athlete_matches, public.athlete_match_stats,
  public.achievement_definitions, public.athlete_achievements,
  public.athlete_stat_aggregates to anon, authenticated;
grant insert, update, delete on public.athlete_seasons to authenticated;
grant update, delete on public.athlete_matches, public.athlete_match_stats to authenticated;
revoke insert on public.athlete_matches, public.athlete_match_stats from authenticated;
revoke insert, update, delete on public.athlete_achievements from anon, authenticated;

revoke all on function public.record_athlete_match(
  uuid, date, text, text, integer, integer, text, jsonb
) from public;
revoke all on function public.verify_athlete_match(uuid, text, text) from public;
revoke all on function public.recompute_athlete_achievements(uuid, uuid) from public;
grant execute on function public.record_athlete_match(
  uuid, date, text, text, integer, integer, text, jsonb
) to authenticated;
grant execute on function public.verify_athlete_match(uuid, text, text) to authenticated;
grant execute on function public.recompute_athlete_achievements(uuid, uuid) to service_role;
