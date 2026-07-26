-- Keep profile summaries and achievements deterministic after edits,
-- verification changes, and deletions.

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
  changed_count integer;
begin
  delete from public.athlete_achievements awarded
  where awarded.athlete_id = target_athlete_id
    and awarded.season_id = target_season_id
    and not exists (
      select 1
      from public.athlete_stat_aggregates aggregate_row
      join public.achievement_definitions definition
        on definition.sport = aggregate_row.sport
       and definition.stat_key = aggregate_row.stat_key
       and definition.is_active
      where aggregate_row.athlete_id = target_athlete_id
        and aggregate_row.season_id = target_season_id
        and definition.id = awarded.definition_id
        and case definition.metric
          when 'maximum' then aggregate_row.maximum_value
          when 'sum' then aggregate_row.total_value
          else aggregate_row.average_value
        end >= definition.threshold
    );

  insert into public.athlete_achievements (
    athlete_id, season_id, definition_id, progress
  )
  select
    aggregate_row.athlete_id,
    aggregate_row.season_id,
    definition.id,
    case definition.metric
      when 'maximum' then aggregate_row.maximum_value
      when 'sum' then aggregate_row.total_value
      else aggregate_row.average_value
    end
  from public.athlete_stat_aggregates aggregate_row
  join public.achievement_definitions definition
    on definition.sport = aggregate_row.sport
   and definition.stat_key = aggregate_row.stat_key
   and definition.is_active
  where aggregate_row.athlete_id = target_athlete_id
    and aggregate_row.season_id = target_season_id
    and case definition.metric
      when 'maximum' then aggregate_row.maximum_value
      when 'sum' then aggregate_row.total_value
      else aggregate_row.average_value
    end >= definition.threshold
  on conflict (athlete_id, season_id, definition_id) do update
  set progress = excluded.progress;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.refresh_athlete_profile_summary(target_athlete_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  games_count integer;
  wins_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (where outcome = 'win')::integer
  into games_count, wins_count
  from public.athlete_matches
  where athlete_id = target_athlete_id
    and verification_status <> 'rejected';

  update public.profiles
  set games_played = games_count,
      win_rate = case
        when games_count = 0 then 0
        else round((wins_count::numeric / games_count) * 100, 2)
      end,
      updated_at = now()
  where id = target_athlete_id;
end;
$$;

create or replace function public.refresh_summary_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_athlete_profile_summary(new.athlete_id);
    perform public.recompute_athlete_achievements(new.athlete_id, new.season_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_athlete_profile_summary(old.athlete_id);
    perform public.recompute_athlete_achievements(old.athlete_id, old.season_id);
    return old;
  end if;

  if new.athlete_id <> old.athlete_id or new.season_id <> old.season_id then
    perform public.refresh_athlete_profile_summary(old.athlete_id);
    perform public.recompute_athlete_achievements(old.athlete_id, old.season_id);
  end if;

  perform public.refresh_athlete_profile_summary(new.athlete_id);
  perform public.recompute_athlete_achievements(new.athlete_id, new.season_id);
  return new;
end;
$$;

drop trigger if exists athlete_matches_refresh_summary on public.athlete_matches;
create trigger athlete_matches_refresh_summary
after insert or update or delete on public.athlete_matches
for each row execute function public.refresh_summary_after_match_change();

create or replace function public.refresh_achievements_after_stat_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_match public.athlete_matches;
begin
  select * into selected_match
  from public.athlete_matches
  where id = new.match_id;
  if selected_match.id is not null then
    perform public.recompute_athlete_achievements(
      selected_match.athlete_id,
      selected_match.season_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists athlete_match_stats_refresh_achievements on public.athlete_match_stats;
create trigger athlete_match_stats_refresh_achievements
after insert or update on public.athlete_match_stats
for each row execute function public.refresh_achievements_after_stat_change();

create or replace function public.protect_athlete_season_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.athlete_matches match_row
    where match_row.season_id = old.id
      and (
        new.athlete_id <> old.athlete_id
        or new.sport <> old.sport
        or match_row.played_on < new.starts_on
        or match_row.played_on > new.ends_on
      )
  ) then
    raise exception 'Season changes cannot invalidate existing matches.';
  end if;
  return new;
end;
$$;

drop trigger if exists athlete_seasons_protect_integrity on public.athlete_seasons;
create trigger athlete_seasons_protect_integrity
before update of athlete_id, sport, starts_on, ends_on on public.athlete_seasons
for each row execute function public.protect_athlete_season_integrity();

revoke all on function public.refresh_athlete_profile_summary(uuid) from public;
grant execute on function public.refresh_athlete_profile_summary(uuid) to service_role;
