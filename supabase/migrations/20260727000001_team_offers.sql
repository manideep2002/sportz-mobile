-- P2-1: private athlete hiring and team-offer workflow.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  community_id uuid unique references public.communities(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  sport text not null,
  city text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create table if not exists public.team_managers (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'coach', 'recruiter')),
  can_send_offers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create trigger team_managers_set_updated_at
before update on public.team_managers
for each row execute function public.set_updated_at();

create table if not exists public.team_offers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  sport text not null,
  position text not null check (char_length(trim(position)) between 1 and 80),
  terms text not null check (char_length(trim(terms)) between 1 and 5000),
  compensation_amount numeric(14,2) check (compensation_amount is null or compensation_amount >= 0),
  compensation_currency text check (
    compensation_currency is null or compensation_currency ~ '^[A-Z]{3}$'
  ),
  compensation_period text check (
    compensation_period is null or compensation_period in ('one_time', 'match', 'week', 'month', 'season', 'year')
  ),
  start_date date,
  end_date date,
  expires_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')),
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_offers_not_self check (sender_id <> recipient_id),
  constraint team_offers_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists team_offers_recipient_status_idx
  on public.team_offers(recipient_id, status, created_at desc);
create index if not exists team_offers_sender_status_idx
  on public.team_offers(sender_id, status, created_at desc);
create index if not exists team_offers_team_status_idx
  on public.team_offers(team_id, status, created_at desc);
create index if not exists team_offers_expiry_idx
  on public.team_offers(expires_at) where status = 'sent';

create trigger team_offers_set_updated_at
before update on public.team_offers
for each row execute function public.set_updated_at();

create table if not exists public.team_offer_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.team_offers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text check (
    from_status is null or from_status in ('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')
  ),
  to_status text not null check (
    to_status in ('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')
  ),
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_offer_history_offer_idx
  on public.team_offer_history(offer_id, created_at);

create table if not exists public.team_roster (
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null,
  position text not null,
  roster_role text not null default 'player'
    check (roster_role in ('player', 'captain', 'reserve')),
  source_offer_id uuid unique references public.team_offers(id) on delete set null,
  start_date date,
  end_date date,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, athlete_id)
);

create trigger team_roster_set_updated_at
before update on public.team_roster
for each row execute function public.set_updated_at();

create or replace function public.is_team_manager(
  target_team_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_managers tm
    where tm.team_id = target_team_id
      and tm.user_id = target_user_id
      and tm.can_send_offers
  );
$$;

-- A page is the public identity of an organization; its private hiring identity
-- is kept in teams. Existing and future page owners/admins become managers.
insert into public.teams (community_id, name, sport, city, created_by)
select c.id, c.name, c.sport, c.city, c.created_by
from public.communities c
where c.type = 'page'
on conflict (community_id) do update
set name = excluded.name,
    sport = excluded.sport,
    city = excluded.city,
    updated_at = now();

insert into public.team_managers (team_id, user_id, role, can_send_offers)
select
  t.id,
  cm.user_id,
  case when cm.role = 'owner' then 'owner' else 'manager' end,
  true
from public.teams t
join public.community_members cm on cm.community_id = t.community_id
where cm.role in ('owner', 'admin')
on conflict (team_id, user_id) do update
set role = excluded.role,
    can_send_offers = true,
    updated_at = now();

create or replace function public.sync_page_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_team_id uuid;
begin
  if new.type <> 'page' then
    return new;
  end if;

  insert into public.teams (community_id, name, sport, city, created_by)
  values (new.id, new.name, new.sport, new.city, new.created_by)
  on conflict (community_id) do update
  set name = excluded.name,
      sport = excluded.sport,
      city = excluded.city,
      updated_at = now()
  returning id into synced_team_id;

  if new.created_by is not null then
    insert into public.team_managers (team_id, user_id, role, can_send_offers)
    values (synced_team_id, new.created_by, 'owner', true)
    on conflict (team_id, user_id) do update
    set role = 'owner', can_send_offers = true, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists communities_sync_page_team on public.communities;
create trigger communities_sync_page_team
after insert or update of name, sport, city, type on public.communities
for each row execute function public.sync_page_team();

create or replace function public.sync_page_team_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_community_id uuid := coalesce(new.community_id, old.community_id);
  source_user_id uuid := coalesce(new.user_id, old.user_id);
  source_role text := case when tg_op = 'DELETE' then null else new.role end;
  synced_team_id uuid;
begin
  select t.id into synced_team_id
  from public.teams t
  where t.community_id = source_community_id;

  if synced_team_id is null then
    return coalesce(new, old);
  end if;

  if source_role in ('owner', 'admin') then
    insert into public.team_managers (team_id, user_id, role, can_send_offers)
    values (
      synced_team_id,
      source_user_id,
      case when source_role = 'owner' then 'owner' else 'manager' end,
      true
    )
    on conflict (team_id, user_id) do update
    set role = excluded.role, can_send_offers = true, updated_at = now();
  else
    delete from public.team_managers
    where team_id = synced_team_id and user_id = source_user_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_members_sync_team_manager on public.community_members;
create trigger community_members_sync_team_manager
after insert or update of role or delete on public.community_members
for each row execute function public.sync_page_team_manager();

create or replace function public.create_team_offer(
  target_recipient_id uuid,
  target_team_id uuid,
  target_sport text,
  target_position text,
  target_terms text,
  target_compensation_amount numeric,
  target_compensation_currency text,
  target_compensation_period text,
  target_start_date date,
  target_end_date date,
  target_expires_at timestamptz,
  send_now boolean
)
returns public.team_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_offer public.team_offers;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create an offer.';
  end if;
  if not public.is_team_manager(target_team_id, current_user_id) then
    raise exception 'Only an authorized team manager can create offers.';
  end if;
  if current_user_id = target_recipient_id then
    raise exception 'You cannot send an offer to yourself.';
  end if;
  if public.users_blocked_each_other(current_user_id, target_recipient_id) then
    raise exception 'You cannot send an offer to this athlete.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_recipient_id and coalesce(p.is_hireable, false)
  ) then
    raise exception 'This athlete is not accepting offers.';
  end if;
  if target_expires_at <= now() then
    raise exception 'Offer expiry must be in the future.';
  end if;
  if target_end_date is not null and target_start_date is not null and target_end_date < target_start_date then
    raise exception 'End date cannot be before start date.';
  end if;

  insert into public.team_offers (
    sender_id, recipient_id, team_id, sport, position, terms,
    compensation_amount, compensation_currency, compensation_period,
    start_date, end_date, expires_at, status, sent_at
  )
  values (
    current_user_id, target_recipient_id, target_team_id, trim(target_sport),
    trim(target_position), trim(target_terms), target_compensation_amount,
    nullif(upper(trim(target_compensation_currency)), ''),
    nullif(target_compensation_period, ''), target_start_date, target_end_date,
    target_expires_at, case when send_now then 'sent' else 'draft' end,
    case when send_now then now() else null end
  )
  returning * into created_offer;

  insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
  values (
    created_offer.id, current_user_id, null, created_offer.status,
    case when send_now then 'offer_sent' else 'draft_created' end
  );

  if send_now then
    insert into public.notifications (
      user_id, actor_id, kind, title, body, entity_type, entity_id, data
    )
    select
      target_recipient_id,
      current_user_id,
      'invite',
      'New team offer',
      t.name || ' sent you an offer.',
      'team_offer',
      created_offer.id,
      jsonb_build_object(
        'offerId', created_offer.id,
        'teamId', t.id,
        'screen', 'OfferDetail'
      )
    from public.teams t
    where t.id = target_team_id;
  end if;

  return created_offer;
end;
$$;

create or replace function public.send_team_offer(target_offer_id uuid)
returns public.team_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  locked_offer public.team_offers;
begin
  select * into locked_offer
  from public.team_offers
  where id = target_offer_id
  for update;

  if locked_offer.id is null then raise exception 'Offer not found.'; end if;
  if locked_offer.sender_id <> current_user_id
     or not public.is_team_manager(locked_offer.team_id, current_user_id) then
    raise exception 'You are not authorized to send this offer.';
  end if;
  if locked_offer.status <> 'draft' then raise exception 'Only draft offers can be sent.'; end if;
  if locked_offer.expires_at <= now() then raise exception 'This offer has expired.'; end if;
  if public.users_blocked_each_other(current_user_id, locked_offer.recipient_id) then
    raise exception 'You cannot send an offer to this athlete.';
  end if;

  update public.team_offers
  set status = 'sent', sent_at = now()
  where id = target_offer_id
  returning * into locked_offer;

  insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
  values (locked_offer.id, current_user_id, 'draft', 'sent', 'offer_sent');

  insert into public.notifications (
    user_id, actor_id, kind, title, body, entity_type, entity_id, data
  )
  select
    locked_offer.recipient_id,
    current_user_id,
    'invite',
    'New team offer',
    t.name || ' sent you an offer.',
    'team_offer',
    locked_offer.id,
    jsonb_build_object('offerId', locked_offer.id, 'teamId', t.id, 'screen', 'OfferDetail')
  from public.teams t where t.id = locked_offer.team_id;

  return locked_offer;
end;
$$;

create or replace function public.respond_team_offer(target_offer_id uuid, accept_offer boolean)
returns public.team_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  locked_offer public.team_offers;
  next_status text := case when accept_offer then 'accepted' else 'declined' end;
begin
  select * into locked_offer
  from public.team_offers
  where id = target_offer_id
  for update;

  if locked_offer.id is null then raise exception 'Offer not found.'; end if;
  if locked_offer.recipient_id <> current_user_id then
    raise exception 'Only the recipient can respond to this offer.';
  end if;
  if locked_offer.status <> 'sent' then
    raise exception 'This offer can no longer be accepted or declined.';
  end if;
  if locked_offer.expires_at <= now() then
    update public.team_offers
    set status = 'expired', expired_at = now()
    where id = locked_offer.id
    returning * into locked_offer;
    insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
    values (locked_offer.id, null, 'sent', 'expired', 'offer_expired');
    return locked_offer;
  end if;
  if public.users_blocked_each_other(locked_offer.sender_id, locked_offer.recipient_id) then
    raise exception 'This offer cannot be accepted.';
  end if;

  update public.team_offers
  set
    status = next_status,
    accepted_at = case when accept_offer then now() else accepted_at end,
    declined_at = case when accept_offer then declined_at else now() end
  where id = locked_offer.id
  returning * into locked_offer;

  if accept_offer then
    insert into public.team_roster (
      team_id, athlete_id, sport, position, roster_role, source_offer_id,
      start_date, end_date
    )
    values (
      locked_offer.team_id, locked_offer.recipient_id, locked_offer.sport,
      locked_offer.position, 'player', locked_offer.id,
      locked_offer.start_date, locked_offer.end_date
    )
    on conflict (team_id, athlete_id) do update
    set sport = excluded.sport,
        position = excluded.position,
        source_offer_id = excluded.source_offer_id,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = now();
  end if;

  insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
  values (
    locked_offer.id, current_user_id, 'sent', next_status,
    case when accept_offer then 'offer_accepted' else 'offer_declined' end
  );

  insert into public.notifications (
    user_id, actor_id, kind, title, body, entity_type, entity_id, data
  )
  select
    locked_offer.sender_id,
    current_user_id,
    'invite',
    case when accept_offer then 'Offer accepted' else 'Offer declined' end,
    p.display_name || case when accept_offer then ' accepted ' else ' declined ' end || t.name || '''s offer.',
    'team_offer',
    locked_offer.id,
    jsonb_build_object('offerId', locked_offer.id, 'teamId', t.id, 'screen', 'OfferDetail')
  from public.teams t
  join public.profiles p on p.id = current_user_id
  where t.id = locked_offer.team_id;

  return locked_offer;
end;
$$;

create or replace function public.withdraw_team_offer(target_offer_id uuid)
returns public.team_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  locked_offer public.team_offers;
  previous_status text;
begin
  select * into locked_offer
  from public.team_offers
  where id = target_offer_id
  for update;

  if locked_offer.id is null then raise exception 'Offer not found.'; end if;
  if locked_offer.sender_id <> current_user_id
     or not public.is_team_manager(locked_offer.team_id, current_user_id) then
    raise exception 'You are not authorized to withdraw this offer.';
  end if;
  if locked_offer.status not in ('draft', 'sent') then
    raise exception 'This offer can no longer be withdrawn.';
  end if;
  previous_status := locked_offer.status;

  update public.team_offers
  set status = 'withdrawn', withdrawn_at = now()
  where id = locked_offer.id
  returning * into locked_offer;

  insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
  values (locked_offer.id, current_user_id, previous_status, 'withdrawn', 'offer_withdrawn');

  if previous_status = 'sent' then
    insert into public.notifications (
      user_id, actor_id, kind, title, body, entity_type, entity_id, data
    )
    select
      locked_offer.recipient_id,
      current_user_id,
      'invite',
      'Offer withdrawn',
      t.name || ' withdrew its offer.',
      'team_offer',
      locked_offer.id,
      jsonb_build_object('offerId', locked_offer.id, 'teamId', t.id, 'screen', 'OfferDetail')
    from public.teams t where t.id = locked_offer.team_id;
  end if;

  return locked_offer;
end;
$$;

create or replace function public.expire_team_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  with expired as (
    update public.team_offers
    set status = 'expired', expired_at = now()
    where status = 'sent' and expires_at <= now()
    returning *
  ), history as (
    insert into public.team_offer_history (offer_id, actor_id, from_status, to_status, event)
    select id, null, 'sent', 'expired', 'offer_expired'
    from expired
  ), notices as (
    insert into public.notifications (
      user_id, actor_id, kind, title, body, entity_type, entity_id, data
    )
    select
      participant.user_id,
      null,
      'invite',
      'Offer expired',
      t.name || '''s offer expired.',
      'team_offer',
      e.id,
      jsonb_build_object('offerId', e.id, 'teamId', t.id, 'screen', 'OfferDetail')
    from expired e
    join public.teams t on t.id = e.team_id
    cross join lateral (values (e.sender_id), (e.recipient_id)) participant(user_id)
  )
  select count(*)::integer into expired_count from expired;
  return expired_count;
end;
$$;

alter table public.teams enable row level security;
alter table public.team_managers enable row level security;
alter table public.team_offers enable row level security;
alter table public.team_offer_history enable row level security;
alter table public.team_roster enable row level security;

create policy "teams are readable" on public.teams
for select using (true);

create policy "team managers are visible to team participants" on public.team_managers
for select using (
  auth.uid() = user_id
  or public.is_team_manager(team_id)
  or public.current_user_is_admin()
);

create policy "team offers are private to participants and managers" on public.team_offers
for select using (
  auth.uid() in (sender_id, recipient_id)
  or public.is_team_manager(team_id)
  or public.current_user_is_admin()
);

create policy "offer history follows offer privacy" on public.team_offer_history
for select using (
  exists (
    select 1 from public.team_offers o
    where o.id = offer_id
      and (
        auth.uid() in (o.sender_id, o.recipient_id)
        or public.is_team_manager(o.team_id)
        or public.current_user_is_admin()
      )
  )
);

create policy "team roster is readable" on public.team_roster
for select using (true);

alter table public.reports drop constraint if exists reports_entity_type_check;
alter table public.reports add constraint reports_entity_type_check
  check (entity_type in ('user', 'post', 'comment', 'event', 'community', 'team_offer'));

grant select on public.teams, public.team_managers, public.team_offers,
  public.team_offer_history, public.team_roster to authenticated;
grant select on public.teams, public.team_roster to anon;
revoke insert, update, delete on public.team_offers, public.team_offer_history, public.team_roster from anon, authenticated;

revoke all on function public.is_team_manager(uuid, uuid) from public;
revoke all on function public.create_team_offer(
  uuid, uuid, text, text, text, numeric, text, text, date, date, timestamptz, boolean
) from public;
revoke all on function public.send_team_offer(uuid) from public;
revoke all on function public.respond_team_offer(uuid, boolean) from public;
revoke all on function public.withdraw_team_offer(uuid) from public;
revoke all on function public.expire_team_offers() from public;

grant execute on function public.is_team_manager(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_team_offer(
  uuid, uuid, text, text, text, numeric, text, text, date, date, timestamptz, boolean
) to authenticated;
grant execute on function public.send_team_offer(uuid) to authenticated;
grant execute on function public.respond_team_offer(uuid, boolean) to authenticated;
grant execute on function public.withdraw_team_offer(uuid) to authenticated;
grant execute on function public.expire_team_offers() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'expire-team-offers';
    perform cron.schedule(
      'expire-team-offers',
      '*/5 * * * *',
      'select public.expire_team_offers();'
    );
  else
    raise notice 'pg_cron unavailable; call public.expire_team_offers() from an external scheduler.';
  end if;
end
$$;
