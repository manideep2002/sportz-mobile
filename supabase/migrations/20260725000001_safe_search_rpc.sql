-- Safe, paginated, server-side search RPC.
--
-- Replaces the unsafe client-side .or() interpolation in searchService.search().
-- Changes:
--  * User input is passed as parameterised bind variables — no string interpolation.
--  * Type filter, pagination (limit/offset), and ordering are performed server-side.
--  * Blocked users are excluded from profile results.
--  * Private profiles are excluded unless the caller follows them.
--  * Non-public events are excluded.
--  * Results are ordered by a computed relevance score (title prefix > word start > substring).
--  * Deterministic tie-breaking by id prevents duplicate rows across pages.

create or replace function public.search_content(
  search_query    text,
  filter_type     text      default null,  -- 'player' | 'event' | 'group' | 'page' | 'court' | null (all)
  result_limit    integer   default 20,
  result_offset   integer   default 0
)
returns table (
  id        uuid,
  type      text,
  title     text,
  subtitle  text,
  skill_level text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
  like_pattern text;
begin
  -- Sanitise and normalise the query.
  normalized := lower(btrim(coalesce(search_query, '')));
  -- Build ILIKE pattern — escape PostgREST/SQL wildcard characters so that
  -- user input cannot break the pattern.
  like_pattern := '%' || replace(replace(replace(normalized, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with profiles_results as (
    select
      p.id,
      'player'::text                                       as result_type,
      p.display_name                                       as result_title,
      coalesce(p.primary_sport, 'Athlete') || ' - ' || coalesce(p.city, '') as result_subtitle,
      p.skill_level::text                                  as result_skill_level,
      case
        when lower(p.display_name) = normalized                  then 3
        when lower(p.display_name) like lower(normalized) || '%' then 2
        when lower(p.display_name) like like_pattern             then 1
        else 0
      end as relevance
    from public.profiles p
    where (filter_type is null or filter_type = 'player')
      and (
        normalized = ''
        or lower(p.display_name) like like_pattern escape '\'
        or lower(p.username)     like like_pattern escape '\'
        or lower(coalesce(p.primary_sport, '')) like like_pattern escape '\'
      )
      -- Exclude blocked users (either direction)
      and not public.users_blocked_each_other(auth.uid(), p.id)
      -- Exclude private profiles the caller does not follow
      and (
        not coalesce(p.is_private, false)
        or p.id = auth.uid()
        or exists (
          select 1 from public.user_follows f
          where f.follower_id = auth.uid()
            and f.following_id = p.id
        )
      )
  ),
  events_results as (
    select
      e.id,
      'event'::text                                                                  as result_type,
      e.title                                                                        as result_title,
      coalesce(e.event_type, 'Event') || ' - ' || e.sport || ' - ' || e.location_name as result_subtitle,
      null::text                                                                     as result_skill_level,
      case
        when lower(e.title) = normalized                  then 3
        when lower(e.title) like lower(normalized) || '%' then 2
        when lower(e.title) like like_pattern             then 1
        else 0
      end as relevance
    from public.sport_events e
    where (filter_type is null or filter_type = 'event')
      and e.status not in ('cancelled', 'completed')
      and (
        normalized = ''
        or lower(e.title)          like like_pattern escape '\'
        or lower(e.sport)          like like_pattern escape '\'
        or lower(e.location_name)  like like_pattern escape '\'
        or lower(coalesce(e.event_type, '')) like like_pattern escape '\'
      )
      -- Respect event visibility (reuse existing helper)
      and public.can_discover_sport_event(e.organizer_id, e.visibility)
  ),
  courts_results as (
    select
      c.id,
      'court'::text                                      as result_type,
      c.name                                             as result_title,
      c.sport || ' - ' || c.city                         as result_subtitle,
      null::text                                         as result_skill_level,
      case
        when lower(c.name) = normalized                  then 3
        when lower(c.name) like lower(normalized) || '%' then 2
        when lower(c.name) like like_pattern             then 1
        else 0
      end as relevance
    from public.courts c
    where (filter_type is null or filter_type = 'court')
      and (
        normalized = ''
        or lower(c.name)  like like_pattern escape '\'
        or lower(c.sport) like like_pattern escape '\'
        or lower(c.city)  like like_pattern escape '\'
      )
  ),
  communities_results as (
    select
      cm.id,
      cm.type::text                                      as result_type,
      cm.name                                            as result_title,
      cm.sport || ' - ' || coalesce(cm.city, '')         as result_subtitle,
      null::text                                         as result_skill_level,
      case
        when lower(cm.name) = normalized                  then 3
        when lower(cm.name) like lower(normalized) || '%' then 2
        when lower(cm.name) like like_pattern             then 1
        else 0
      end as relevance
    from public.communities cm
    where (filter_type is null or filter_type in ('group', 'page'))
      and (filter_type is null or cm.type::text = filter_type)
      and (
        normalized = ''
        or lower(cm.name)  like like_pattern escape '\'
        or lower(cm.sport) like like_pattern escape '\'
        or lower(coalesce(cm.city, '')) like like_pattern escape '\'
      )
  ),
  combined as (
    select id, result_type, result_title, result_subtitle, result_skill_level, relevance
    from profiles_results
    union all
    select id, result_type, result_title, result_subtitle, result_skill_level, relevance
    from events_results
    union all
    select id, result_type, result_title, result_subtitle, result_skill_level, relevance
    from courts_results
    union all
    select id, result_type, result_title, result_subtitle, result_skill_level, relevance
    from communities_results
  )
  select
    c.id,
    c.result_type,
    c.result_title,
    c.result_subtitle,
    c.result_skill_level
  from combined c
  order by c.relevance desc, c.result_type, c.id
  limit  least(greatest(coalesce(result_limit,  20), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

-- Only authenticated users can run searches.
revoke all on function public.search_content(text, text, integer, integer) from public, anon;
grant  execute on function public.search_content(text, text, integer, integer) to authenticated;

-- Index to make profile search faster.
create index if not exists profiles_display_name_lower_idx
  on public.profiles (lower(display_name));
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Index to make court search faster.
create index if not exists courts_name_lower_idx
  on public.courts (lower(name));

-- Index to make community search faster.
create index if not exists communities_name_lower_idx
  on public.communities (lower(name));

-- Index to make event search faster.
create index if not exists sport_events_title_lower_idx
  on public.sport_events (lower(title));
