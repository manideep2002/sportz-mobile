-- Athlete stat edits may change values, but never re-key or remove required
-- sport definitions. Match deletion still cascades through the FK.

revoke update, delete on public.athlete_match_stats from authenticated;
grant update (value) on public.athlete_match_stats to authenticated;

create or replace function public.validate_athlete_match_stat()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_sport text;
  definition public.sport_stat_definitions;
begin
  if tg_op = 'UPDATE' and new.definition_id <> old.definition_id then
    raise exception 'A recorded stat cannot change its definition.';
  end if;

  select sport into match_sport
  from public.athlete_matches
  where id = new.match_id;
  select * into definition
  from public.sport_stat_definitions
  where id = new.definition_id;

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

