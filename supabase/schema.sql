-- SPORTZ historical Supabase/Postgres schema snapshot.
-- The migration files in `supabase/migrations` are the source of truth.
-- Regenerate this file from the remote database before using it as a current reference.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

create type public.sportz_skill_level as enum ('Beginner', 'Intermediate', 'Advanced', 'Pro');
create type public.sportz_post_kind as enum ('post', 'thread', 'stats', 'highlight');
create type public.sportz_visibility as enum ('public', 'followers', 'group', 'invite');
create type public.sportz_event_status as enum ('open', 'full', 'live', 'cancelled', 'completed');
create type public.sportz_rsvp_status as enum ('going', 'interested', 'declined');
create type public.sportz_community_type as enum ('group', 'page');
create type public.sportz_notification_kind as enum ('like', 'comment', 'follow', 'follow_request', 'event', 'message', 'invite', 'achievement');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text not null,
  avatar_url text,
  cover_url text,
  bio text default '',
  mobile_number text,
  date_of_birth date,
  gender text check (gender in ('Female', 'Male', 'Non-binary', 'Prefer not to say') or gender is null),
  city text,
  country text default 'IN',
  primary_sport text,
  sports text[] not null default '{}',
  position text,
  skill_level public.sportz_skill_level default 'Intermediate',
  is_hireable boolean not null default false,
  is_private boolean not null default false,
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  base_username text;
  final_username text;
  suffix int := 0;
  raw_gender text;
  raw_skill text;
  parsed_skill public.sportz_skill_level;
begin
  raw_username := coalesce(new.raw_user_meta_data->>'username', '');
  base_username := regexp_replace(replace(raw_username, '@', ''), '[^a-zA-Z0-9_]', '', 'g');

  if length(base_username) < 3 then
    base_username := 'athlete_' || substring(replace(new.id::text, '-', '_') from 1 for 8);
  end if;

  if length(base_username) > 30 then
    base_username := substring(base_username from 1 for 30);
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username :=
      substring(base_username from 1 for greatest(3, 30 - length(suffix::text) - 1)) || '_' || suffix::text;
  end loop;

  raw_gender := nullif(trim(new.raw_user_meta_data->>'gender'), '');
  if raw_gender not in ('Female', 'Male', 'Non-binary', 'Prefer not to say') then
    raw_gender := null;
  end if;

  raw_skill := coalesce(
    new.raw_user_meta_data->>'primary_sport_experience_level',
    new.raw_user_meta_data->>'skill_level',
    'Intermediate'
  );

  begin
    parsed_skill := raw_skill::public.sportz_skill_level;
  exception
    when others then
      parsed_skill := 'Intermediate'::public.sportz_skill_level;
  end;

  insert into public.profiles (
    id,
    username,
    display_name,
    mobile_number,
    date_of_birth,
    gender,
    city,
    primary_sport,
    sports,
    skill_level
  )
  values (
    new.id,
    final_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'SPORTZ Athlete'),
    nullif(trim(new.raw_user_meta_data->>'mobile_number'), ''),
    nullif(trim(new.raw_user_meta_data->>'date_of_birth'), '')::date,
    raw_gender,
    nullif(trim(new.raw_user_meta_data->>'city'), ''),
    nullif(trim(new.raw_user_meta_data->>'primary_sport'), ''),
    array_remove(
      array_cat(
        array[nullif(trim(new.raw_user_meta_data->>'primary_sport'), '')],
        array(
          select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'secondary_sports', '[]'::jsonb))
        )
      ),
      null
    ),
    parsed_skill
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

grant usage on schema public to postgres, supabase_auth_admin;
grant insert, select, update on table public.profiles to postgres, supabase_auth_admin;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_no_self_follow check (follower_id <> following_id),
  constraint follows_unique unique (follower_id, following_id)
);

create table public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint follow_requests_no_self check (requester_id <> target_id),
  constraint follow_requests_unique unique (requester_id, target_id)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_no_self_block check (blocker_id <> blocked_id),
  constraint blocks_unique unique (blocker_id, blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('user', 'post', 'comment', 'event', 'community')),
  entity_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_kind text not null default 'image',
  body text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid,
  kind public.sportz_post_kind not null default 'post',
  sport text,
  body text not null check (char_length(body) <= 3000),
  media_url text,
  media_kind text default 'none',
  stats_line text,
  visibility public.sportz_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('post', 'comment', 'story')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint likes_unique unique (user_id, entity_type, entity_id)
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  city text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  geo geography(point, 4326) generated always as (st_makepoint(longitude, latitude)::geography) stored,
  surface text,
  rating numeric(3,2) default 0,
  hourly_price_cents integer default 0,
  currency text not null default 'INR',
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courts_geo_idx on public.courts using gist (geo);

create trigger courts_set_updated_at
before update on public.courts
for each row execute function public.set_updated_at();

create table public.court_bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint court_bookings_valid_time check (ends_at > starts_at)
);

create table public.sport_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid references public.courts(id) on delete set null,
  title text not null,
  event_type text not null default 'Pickup Game',
  sport text not null,
  description text default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_name text not null,
  city text,
  latitude double precision,
  longitude double precision,
  max_players integer not null default 2 check (max_players > 0),
  entry_fee_cents integer not null default 0,
  currency text not null default 'INR',
  visibility public.sportz_visibility not null default 'public',
  status public.sportz_event_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint sport_events_title_not_blank check (length(btrim(title)) > 0),
  constraint sport_events_location_not_blank check (length(btrim(location_name)) > 0),
  constraint sport_events_valid_time check (ends_at > starts_at),
  constraint sport_events_min_players check (max_players >= 2),
  constraint sport_events_nonnegative_entry_fee check (entry_fee_cents >= 0)
);

create trigger sport_events_set_updated_at
before update on public.sport_events
for each row execute function public.set_updated_at();

create table public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sport_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sportz_rsvp_status not null default 'going',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_attendees_unique unique (event_id, user_id)
);

create trigger event_attendees_set_updated_at
before update on public.event_attendees
for each row execute function public.set_updated_at();

create table public.event_waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sport_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_waitlist_unique unique (event_id, user_id)
);

create trigger event_waitlist_set_updated_at
before update on public.event_waitlist
for each row execute function public.set_updated_at();

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sport_events(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 1500),
  created_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  type public.sportz_community_type not null,
  name text not null,
  slug text not null unique,
  description text default '',
  sport text not null,
  city text,
  is_verified boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts
add constraint posts_community_fk foreign key (community_id) references public.communities(id) on delete cascade;

create trigger communities_set_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_invites_no_self check (inviter_id <> invitee_id),
  constraint community_invites_unique unique (community_id, invitee_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  last_message text,
  last_sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind public.sportz_notification_kind not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  push_sent_at timestamptz,
  push_error text,
  push_attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_posts_unique unique (user_id, post_id)
);

create table public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_shares_unique unique (post_id, user_id)
);

create table public.post_mentions (
  post_id uuid not null references public.posts(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, mentioned_user_id)
);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint story_reactions_unique unique (story_id, user_id, reaction)
);

create table public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  follows boolean not null default true,
  messages boolean not null default true,
  events boolean not null default true,
  invites boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.conversation_mutes (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

create index posts_author_created_idx on public.posts(author_id, created_at desc);
create index saved_posts_user_idx on public.saved_posts(user_id);
create index saved_posts_post_idx on public.saved_posts(post_id);
create index follow_requests_target_status_idx on public.follow_requests(target_id, status);
create index court_bookings_court_time_idx on public.court_bookings(court_id, starts_at);
create index court_bookings_user_idx on public.court_bookings(user_id);
create index event_waitlist_event_status_idx on public.event_waitlist(event_id, status, created_at);
create index post_shares_post_idx on public.post_shares(post_id);
create index post_mentions_user_idx on public.post_mentions(mentioned_user_id);
create index story_views_viewer_idx on public.story_views(viewer_id);
create index story_reactions_story_idx on public.story_reactions(story_id);
create index story_replies_story_idx on public.story_replies(story_id);
create index comments_post_created_idx on public.comments(post_id, created_at);
create index likes_entity_idx on public.likes(entity_type, entity_id);
create index follows_follower_idx on public.follows(follower_id);
create index follows_following_idx on public.follows(following_id);
create index blocks_blocker_idx on public.blocks(blocker_id);
create index blocks_blocked_idx on public.blocks(blocked_id);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_status_created_idx on public.reports(status, created_at desc);
create index sport_events_starts_idx on public.sport_events(starts_at);
create index sport_events_visibility_starts_idx on public.sport_events(visibility, starts_at);
create index sport_events_organizer_visibility_idx on public.sport_events(organizer_id, visibility);
create index event_attendees_event_idx on public.event_attendees(event_id);
create index community_invites_invitee_status_idx on public.community_invites(invitee_id, status, created_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_push_pending_idx on public.notifications(created_at) where push_sent_at is null;

create or replace view public.feed_posts as
select
  p.*,
  pr.display_name,
  pr.username,
  pr.avatar_url,
  coalesce(like_counts.likes_count, 0) as likes_count,
  coalesce(comment_counts.comments_count, 0) as comments_count,
  coalesce(share_counts.shares_count, 0) as shares_count
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select entity_id, count(*)::int as likes_count
  from public.likes
  where entity_type = 'post'
  group by entity_id
) like_counts on like_counts.entity_id = p.id
left join (
  select post_id, count(*)::int as comments_count
  from public.comments
  group by post_id
) comment_counts on comment_counts.post_id = p.id
left join (
  select post_id, count(*)::int as shares_count
  from public.post_shares
  group by post_id
) share_counts on share_counts.post_id = p.id;

create or replace view public.event_player_counts as
select
  e.*,
  count(a.user_id)::int as player_count
from public.sport_events e
left join public.event_attendees a
  on a.event_id = e.id and a.status = 'going'
group by e.id;

create or replace function public.users_blocked_each_other(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = left_user_id and b.blocked_id = right_user_id)
       or (b.blocker_id = right_user_id and b.blocked_id = left_user_id)
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.request_or_follow_profile(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_is_private boolean;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to follow players.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot follow yourself.';
  end if;

  if public.users_blocked_each_other(current_user_id, target_user_id) then
    raise exception 'You cannot follow this player.';
  end if;

  select coalesce(is_private, false)
  into target_is_private
  from public.profiles
  where id = target_user_id;

  if target_is_private is null then
    raise exception 'Profile not found.';
  end if;

  if target_is_private then
    insert into public.follow_requests (requester_id, target_id, status)
    values (current_user_id, target_user_id, 'pending')
    on conflict (requester_id, target_id)
    do update set status = 'pending', responded_at = null, created_at = now()
    where public.follow_requests.status in ('declined', 'cancelled');

    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    select target_user_id, current_user_id, 'follow_request', 'New follow request', 'A player requested to follow you.', 'profile', current_user_id
    where not exists (
      select 1 from public.notifications n
      where n.user_id = target_user_id
        and n.actor_id = current_user_id
        and n.kind = 'follow_request'
        and n.entity_id = current_user_id
        and n.created_at > now() - interval '1 day'
    );
    return 'requested';
  end if;

  insert into public.follows (follower_id, following_id)
  values (current_user_id, target_user_id)
  on conflict (follower_id, following_id) do nothing;
  return 'following';
end;
$$;

create or replace function public.respond_to_follow_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.follow_requests%rowtype;
begin
  select *
  into request_row
  from public.follow_requests
  where id = request_id
    and target_id = auth.uid()
    and status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Follow request not found.';
  end if;

  update public.follow_requests
  set status = case when approve then 'approved' else 'declined' end,
      responded_at = now()
  where id = request_id;

  if approve then
    insert into public.follows (follower_id, following_id)
    values (request_row.requester_id, request_row.target_id)
    on conflict (follower_id, following_id) do nothing;

    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    values (request_row.requester_id, request_row.target_id, 'follow', 'Follow request approved', 'Your follow request was approved.', 'profile', request_row.target_id);
  end if;
end;
$$;

create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
  other_display_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to start a conversation.';
  end if;

  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'Choose another player to message.';
  end if;

  if public.users_blocked_each_other(current_user_id, other_user_id) then
    raise exception 'You cannot message this player.';
  end if;

  select c.id
  into existing_conversation_id
  from public.conversations c
  where c.is_group = false
    and exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = current_user_id)
    and exists (select 1 from public.conversation_members om where om.conversation_id = c.id and om.user_id = other_user_id)
    and (select count(*) from public.conversation_members count_members where count_members.conversation_id = c.id) = 2
  order by c.updated_at desc
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  select display_name into other_display_name from public.profiles where id = other_user_id;
  if other_display_name is null then
    raise exception 'Player profile not found.';
  end if;

  insert into public.conversations (is_group, created_by, title, last_message)
  values (false, current_user_id, other_display_name, '')
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return new_conversation_id;
end;
$$;

create or replace function public.create_group_conversation(group_title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_conversation_id uuid;
  cleaned_member_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a group chat.';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::uuid[])
  into cleaned_member_ids
  from unnest(coalesce(member_ids, array[]::uuid[])) as member_id
  where member_id is not null and member_id <> current_user_id;

  if array_length(cleaned_member_ids, 1) is null then
    raise exception 'Choose at least one other player.';
  end if;

  if array_length(cleaned_member_ids, 1) > 49 then
    raise exception 'Group chats are limited to 50 members.';
  end if;

  if exists (
    select 1
    from unnest(cleaned_member_ids) as member_id
    join public.blocks b on (
      (b.blocker_id = current_user_id and b.blocked_id = member_id)
      or (b.blocker_id = member_id and b.blocked_id = current_user_id)
    )
  ) then
    raise exception 'A blocked player cannot be added to this chat.';
  end if;

  insert into public.conversations (title, is_group, created_by, last_message)
  values (nullif(trim(group_title), ''), true, current_user_id, '')
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (new_conversation_id, current_user_id, 'owner');

  insert into public.conversation_members (conversation_id, user_id, role)
  select new_conversation_id, member_id, 'member'
  from unnest(cleaned_member_ids) as member_id
  on conflict (conversation_id, user_id) do nothing;

  return new_conversation_id;
end;
$$;

create or replace function public.add_group_conversation_members(target_conversation_id uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_member_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to add group members.';
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = target_conversation_id
      and c.is_group = true
      and cm.user_id = current_user_id
      and (c.created_by = current_user_id or cm.role in ('owner', 'admin'))
  ) then
    raise exception 'Only group owners can add members.';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::uuid[])
  into cleaned_member_ids
  from unnest(coalesce(member_ids, array[]::uuid[])) as member_id
  where member_id is not null and member_id <> current_user_id;

  if array_length(cleaned_member_ids, 1) is null then
    return;
  end if;

  if exists (
    select 1
    from unnest(cleaned_member_ids) as member_id
    join public.blocks b on (
      (b.blocker_id = current_user_id and b.blocked_id = member_id)
      or (b.blocker_id = member_id and b.blocked_id = current_user_id)
    )
  ) then
    raise exception 'A blocked player cannot be added to this chat.';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select target_conversation_id, member_id, 'member'
  from unnest(cleaned_member_ids) as member_id
  on conflict (conversation_id, user_id) do nothing;
end;
$$;

create or replace function public.remove_group_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave a group.';
  end if;

  if target_user_id = current_user_id then
    delete from public.conversation_members
    where conversation_id = target_conversation_id and user_id = current_user_id;
    return;
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = target_conversation_id
      and c.is_group = true
      and cm.user_id = current_user_id
      and (c.created_by = current_user_id or cm.role in ('owner', 'admin'))
  ) then
    raise exception 'Only group owners can remove members.';
  end if;

  delete from public.conversation_members
  where conversation_id = target_conversation_id and user_id = target_user_id;
end;
$$;

create or replace function public.invite_community_member(target_community_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  community_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to invite members.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Choose another player to invite.';
  end if;

  if public.users_blocked_each_other(current_user_id, target_user_id) then
    raise exception 'You cannot invite this player.';
  end if;

  select c.name into community_name
  from public.communities c
  where c.id = target_community_id
    and exists (
      select 1 from public.community_members m
      where m.community_id = c.id
        and m.user_id = current_user_id
        and m.role in ('owner', 'admin')
    );

  if community_name is null then
    raise exception 'Only community admins can invite members.';
  end if;

  insert into public.community_invites (community_id, inviter_id, invitee_id, status)
  values (target_community_id, current_user_id, target_user_id, 'pending')
  on conflict (community_id, invitee_id)
  do update set inviter_id = current_user_id, status = 'pending', responded_at = null, created_at = now();

  insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
  values (target_user_id, current_user_id, 'invite', 'Community invite', 'You were invited to join ' || community_name || '.', 'group', target_community_id);
end;
$$;

create or replace function public.respond_community_invite(invite_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.community_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to respond to invites.';
  end if;

  select * into invite_row
  from public.community_invites
  where id = invite_id and invitee_id = current_user_id and status = 'pending'
  for update;

  if invite_row.id is null then
    raise exception 'Invite not found.';
  end if;

  update public.community_invites
  set status = case when approve then 'accepted' else 'declined' end,
      responded_at = now()
  where id = invite_id;

  if approve then
    insert into public.community_members (community_id, user_id, role)
    values (invite_row.community_id, current_user_id, 'member')
    on conflict (community_id, user_id) do update set role = excluded.role;
  end if;
end;
$$;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient_id uuid;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;

  for recipient_id in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    values (
      recipient_id,
      new.sender_id,
      'message',
      coalesce(sender_name, 'A player') || ' sent you a message',
      left(new.body, 140),
      'conversation',
      new.conversation_id
    );
  end loop;

  return new;
end;
$$;

create trigger messages_notify_conversation_members
after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.create_sport_event(
  target_title text,
  target_event_type text,
  target_sport text,
  target_description text,
  target_cover_url text,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_location_name text,
  target_city text,
  target_latitude double precision default null,
  target_longitude double precision default null,
  target_max_players integer default 2,
  target_entry_fee_cents integer default 0,
  target_visibility public.sportz_visibility default 'public'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_event_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create events.';
  end if;

  if target_title is null or length(btrim(target_title)) = 0 then
    raise exception 'Please enter an event title.';
  end if;

  if target_event_type is null or length(btrim(target_event_type)) = 0 then
    raise exception 'Please choose an event type.';
  end if;

  if target_sport is null or length(btrim(target_sport)) = 0 then
    raise exception 'Please choose a sport.';
  end if;

  if target_location_name is null or length(btrim(target_location_name)) = 0 then
    raise exception 'Please enter a location.';
  end if;

  if target_city is null or length(btrim(target_city)) = 0 then
    raise exception 'Please enter a city.';
  end if;

  if target_starts_at is null or target_ends_at is null or target_ends_at <= target_starts_at then
    raise exception 'Event end time must be after the start time.';
  end if;

  if target_starts_at <= now() then
    raise exception 'Event start time must be in the future.';
  end if;

  if coalesce(target_max_players, 0) < 2 then
    raise exception 'Max players must be at least 2.';
  end if;

  if coalesce(target_entry_fee_cents, 0) < 0 then
    raise exception 'Entry fee must be 0 or a positive amount.';
  end if;

  if target_visibility = 'group' then
    raise exception 'Group event visibility is not available yet.';
  end if;

  insert into public.sport_events (
    organizer_id,
    title,
    event_type,
    sport,
    description,
    cover_url,
    starts_at,
    ends_at,
    location_name,
    city,
    latitude,
    longitude,
    max_players,
    entry_fee_cents,
    currency,
    visibility,
    status
  )
  values (
    current_user_id,
    btrim(target_title),
    btrim(target_event_type),
    btrim(target_sport),
    coalesce(target_description, ''),
    target_cover_url,
    target_starts_at,
    target_ends_at,
    btrim(target_location_name),
    btrim(target_city),
    target_latitude,
    target_longitude,
    target_max_players,
    coalesce(target_entry_fee_cents, 0),
    'INR',
    coalesce(target_visibility, 'public'::public.sportz_visibility),
    'open'
  )
  returning id into new_event_id;

  insert into public.event_attendees (event_id, user_id, status)
  values (new_event_id, current_user_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going';

  return new_event_id;
end;
$$;

create or replace function public.can_discover_sport_event(
  event_organizer_id uuid,
  event_visibility public.sportz_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    event_visibility = 'public'
    or auth.uid() = event_organizer_id
    or public.current_user_is_admin()
    or (
      event_visibility = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = event_organizer_id
      )
    );
$$;

create or replace function public.can_view_sport_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      public.can_discover_sport_event(e.organizer_id, e.visibility)
      or exists (
        select 1
        from public.event_attendees a
        where a.event_id = e.id
          and a.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.event_waitlist w
        where w.event_id = e.id
          and w.user_id = auth.uid()
          and w.status in ('waiting', 'promoted')
      )
    from public.sport_events e
    where e.id = target_event_id
  ), false);
$$;

create or replace function public.join_sport_event(target_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  going_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join events.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status = 'cancelled' then
    raise exception 'This event has been cancelled.';
  end if;

  if event_row.status in ('live', 'completed') then
    raise exception 'This event is not open for joins.';
  end if;

  if event_row.status not in ('open', 'full') then
    raise exception 'This event is not open for joins.';
  end if;

  if exists (
    select 1 from public.event_attendees
    where event_id = target_event_id and user_id = current_user_id and status = 'going'
  ) then
    return 'joined';
  end if;

  if not public.can_discover_sport_event(event_row.organizer_id, event_row.visibility) then
    if event_row.visibility = 'followers' then
      raise exception 'Only the organizer''s followers can join this event.';
    end if;

    raise exception 'This private event is not open for joins.';
  end if;

  select count(*) into going_count
  from public.event_attendees
  where event_id = target_event_id and status = 'going';

  if going_count >= event_row.max_players then
    update public.sport_events set status = 'full' where id = target_event_id;
    insert into public.event_waitlist (event_id, user_id, status)
    values (target_event_id, current_user_id, 'waiting')
    on conflict (event_id, user_id) do update set status = 'waiting';
    return 'waitlisted';
  end if;

  insert into public.event_attendees (event_id, user_id, status)
  values (target_event_id, current_user_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going';

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';

  update public.sport_events
  set status = case
    when going_count + 1 >= event_row.max_players then 'full'::public.sportz_event_status
    else 'open'::public.sportz_event_status
  end
  where id = target_event_id;

  return 'joined';
end;
$$;

create or replace function public.leave_sport_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  promoted_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave events.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id and user_id = current_user_id;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';

  select user_id into promoted_user_id
  from public.event_waitlist
  where event_id = target_event_id and status = 'waiting'
  order by created_at
  limit 1
  for update skip locked;

  if promoted_user_id is not null then
    insert into public.event_attendees (event_id, user_id, status)
    values (target_event_id, promoted_user_id, 'going')
    on conflict (event_id, user_id) do update set status = 'going';

    update public.event_waitlist
    set status = 'promoted'
    where event_id = target_event_id and user_id = promoted_user_id;
  end if;

  update public.sport_events
  set status = 'open'
  where id = target_event_id and status = 'full';
end;
$$;

create or replace function public.remove_event_attendee(target_event_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  promoted_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage attendees.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.organizer_id <> current_user_id and not public.current_user_is_admin() then
    raise exception 'Only the organizer can manage attendees.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id and user_id = target_user_id;

  select user_id into promoted_user_id
  from public.event_waitlist
  where event_id = target_event_id and status = 'waiting'
  order by created_at
  limit 1
  for update skip locked;

  if promoted_user_id is not null then
    insert into public.event_attendees (event_id, user_id, status)
    values (target_event_id, promoted_user_id, 'going')
    on conflict (event_id, user_id) do update set status = 'going';

    update public.event_waitlist
    set status = 'promoted'
    where event_id = target_event_id and user_id = promoted_user_id;
  end if;

  update public.sport_events
  set status = 'open'
  where id = target_event_id and status = 'full';
end;
$$;

create extension if not exists btree_gist;

alter table public.court_bookings
  add constraint court_bookings_no_overlap
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

create or replace function public.book_court_slot(target_court_id uuid, target_starts_at timestamptz, target_ends_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to book a court.';
  end if;

  if target_ends_at <= target_starts_at then
    raise exception 'Booking end time must be after the start time.';
  end if;

  insert into public.court_bookings (court_id, user_id, starts_at, ends_at, status)
  values (target_court_id, auth.uid(), target_starts_at, target_ends_at, 'pending');
exception
  when exclusion_violation then
    raise exception 'That time slot is already requested. Choose another time.';
end;
$$;

create or replace function public.update_court_booking_status(target_booking_id uuid, target_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Only admins can manage court bookings.';
  end if;

  if target_status not in ('pending', 'confirmed', 'cancelled') then
    raise exception 'Invalid booking status.';
  end if;

  update public.court_bookings
  set status = target_status
  where id = target_booking_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.stories enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follow_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.post_shares enable row level security;
alter table public.post_mentions enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;
alter table public.story_replies enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.conversation_mutes enable row level security;
alter table public.courts enable row level security;
alter table public.court_bookings enable row level security;
alter table public.sport_events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.event_waitlist enable row level security;
alter table public.event_messages enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_invites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "follows are readable" on public.follows for select using (true);
create policy "users insert public follows" on public.follows for insert with check (
  auth.uid() = follower_id
  and follower_id <> following_id
  and exists (
    select 1 from public.profiles p
    where p.id = following_id and coalesce(p.is_private, false) = false
  )
);
create policy "users delete own follows" on public.follows for delete using (auth.uid() in (follower_id, following_id));

create policy "follow request participants read" on public.follow_requests for select using (auth.uid() in (requester_id, target_id));
create policy "requesters create follow requests" on public.follow_requests for insert with check (auth.uid() = requester_id);
create policy "requesters cancel follow requests" on public.follow_requests
  for update using (auth.uid() = requester_id and status = 'pending')
  with check (auth.uid() = requester_id and status = 'cancelled');
create policy "targets respond to follow requests" on public.follow_requests
  for update using (auth.uid() = target_id and status = 'pending')
  with check (auth.uid() = target_id and status in ('approved', 'declined'));
create policy "users read own blocks" on public.blocks for select using (auth.uid() = blocker_id);
create policy "users read blocks involving them" on public.blocks for select using (auth.uid() in (blocker_id, blocked_id));
create policy "users manage own blocks" on public.blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "users create own reports" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "users read own reports" on public.reports for select using (auth.uid() = reporter_id);
create policy "admins read reports" on public.reports for select using (public.current_user_is_admin());
create policy "admins update reports" on public.reports
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "public stories readable" on public.stories for select using (expires_at > now());
create policy "users manage own stories" on public.stories for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "visible posts readable" on public.posts for select using (
  visibility = 'public'
  or auth.uid() = author_id
  or (
    visibility = 'followers'
    and exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid() and f.following_id = author_id
    )
  )
);
create policy "users insert own posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "users update own posts" on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "users delete own posts" on public.posts for delete using (auth.uid() = author_id);

create policy "comments readable" on public.comments for select using (true);
create policy "users insert own comments" on public.comments for insert with check (auth.uid() = author_id);
create policy "users update own comments" on public.comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "users delete own comments" on public.comments for delete using (auth.uid() = author_id);

create policy "likes readable" on public.likes for select using (true);
create policy "users manage own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read own saved posts" on public.saved_posts
  for select using (auth.uid() = user_id);
create policy "users manage own saved posts" on public.saved_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "post shares readable" on public.post_shares for select using (true);
create policy "users create own post shares" on public.post_shares for insert with check (auth.uid() = user_id);
create policy "post mentions readable" on public.post_mentions for select using (true);
create policy "authors create post mentions" on public.post_mentions for insert with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);

create policy "story viewers read own views or authors read views" on public.story_views for select using (
  auth.uid() = viewer_id or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);
create policy "users create own story views" on public.story_views for insert with check (auth.uid() = viewer_id);
create policy "story authors read reactions" on public.story_reactions for select using (
  auth.uid() = user_id or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);
create policy "users create own story reactions" on public.story_reactions for insert with check (auth.uid() = user_id);
create policy "story authors read replies" on public.story_replies for select using (
  auth.uid() = user_id or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);
create policy "users create own story replies" on public.story_replies for insert with check (auth.uid() = user_id);

create policy "users manage own notification preferences" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own conversation mutes" on public.conversation_mutes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "courts readable" on public.courts for select using (true);
create policy "admins manage courts" on public.courts for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "users read own court bookings" on public.court_bookings for select using (auth.uid() = user_id);
create policy "users create own court bookings" on public.court_bookings for insert with check (auth.uid() = user_id);
create policy "users update own court bookings" on public.court_bookings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins read all court bookings" on public.court_bookings for select using (public.current_user_is_admin());
create policy "admins update all court bookings" on public.court_bookings
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "visible events readable" on public.sport_events for select using (public.can_view_sport_event(id));
create policy "users create own events" on public.sport_events for insert with check (auth.uid() = organizer_id);
create policy "organizers update own events" on public.sport_events for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

create policy "visible event attendees readable" on public.event_attendees for select using (
  auth.uid() = user_id
  or public.can_view_sport_event(event_id)
);
create policy "users manage own rsvp" on public.event_attendees for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "event waitlist readable by participants and organizers" on public.event_waitlist for select using (
  auth.uid() = user_id
  or exists (select 1 from public.sport_events e where e.id = event_id and e.organizer_id = auth.uid())
  or public.current_user_is_admin()
);
create policy "users manage own event waitlist rows" on public.event_waitlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "event chat readable by attendees" on public.event_messages for select using (
  exists (select 1 from public.event_attendees a where a.event_id = event_messages.event_id and a.user_id = auth.uid())
);
create policy "event attendees write chat" on public.event_messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.event_attendees a where a.event_id = event_messages.event_id and a.user_id = auth.uid())
);

create policy "communities readable" on public.communities for select using (true);
create policy "authenticated users create communities" on public.communities for insert with check (auth.uid() = created_by);
create policy "owners update communities" on public.communities for update using (
  exists (select 1 from public.community_members m where m.community_id = id and m.user_id = auth.uid() and m.role in ('owner', 'admin'))
);

create policy "community members readable" on public.community_members for select using (true);
create policy "users join communities" on public.community_members for insert with check (auth.uid() = user_id);
create policy "users leave communities" on public.community_members for delete using (auth.uid() = user_id);

create policy "community invite participants read" on public.community_invites for select using (
  auth.uid() in (inviter_id, invitee_id)
  or exists (
    select 1 from public.community_members m
    where m.community_id = public.community_invites.community_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);
create policy "community admins create invites" on public.community_invites for insert with check (
  auth.uid() = inviter_id
  and exists (
    select 1 from public.community_members m
    where m.community_id = public.community_invites.community_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);
create policy "invitees update own community invites" on public.community_invites
  for update using (auth.uid() = invitee_id and status = 'pending')
  with check (auth.uid() = invitee_id and status in ('accepted', 'declined'));

create policy "conversation members read own rows" on public.conversation_members for select using (auth.uid() = user_id);
create policy "conversation creators add members" on public.conversation_members for insert with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  or auth.uid() = user_id
);
create policy "members update own conversation membership" on public.conversation_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "members read conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);
create policy "authenticated create conversations" on public.conversations for insert with check (auth.uid() = created_by);

create policy "members read messages" on public.messages for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);
create policy "members send messages" on public.messages for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  and not exists (
    select 1
    from public.conversation_members other_member
    join public.blocks b on (
      (b.blocker_id = auth.uid() and b.blocked_id = other_member.user_id)
      or (b.blocker_id = other_member.user_id and b.blocked_id = auth.uid())
    )
    where other_member.conversation_id = messages.conversation_id
      and other_member.user_id <> auth.uid()
  )
);

create policy "users read own receipts" on public.message_receipts for select using (auth.uid() = user_id);
create policy "users write own receipts" on public.message_receipts for insert with check (auth.uid() = user_id);

create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own push tokens" on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant execute on function public.request_or_follow_profile(uuid) to authenticated;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.add_group_conversation_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.invite_community_member(uuid, uuid) to authenticated;
grant execute on function public.respond_community_invite(uuid, boolean) to authenticated;
grant execute on function public.create_sport_event(text, text, text, text, text, timestamptz, timestamptz, text, text, double precision, double precision, integer, integer, public.sportz_visibility) to authenticated;
grant execute on function public.can_discover_sport_event(uuid, public.sportz_visibility) to anon, authenticated;
grant execute on function public.can_view_sport_event(uuid) to anon, authenticated;
grant execute on function public.join_sport_event(uuid) to authenticated;
grant execute on function public.leave_sport_event(uuid) to authenticated;
grant execute on function public.remove_event_attendee(uuid, uuid) to authenticated;
grant execute on function public.book_court_slot(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.update_court_booking_status(uuid, text) to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.event_attendees;
alter publication supabase_realtime add table public.event_waitlist;
alter publication supabase_realtime add table public.event_messages;
