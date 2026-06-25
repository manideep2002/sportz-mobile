-- SPORTZ production schema for Supabase/Postgres.
-- Apply in Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

create type public.sportz_skill_level as enum ('Beginner', 'Intermediate', 'Advanced', 'Pro');
create type public.sportz_post_kind as enum ('post', 'thread', 'stats', 'highlight');
create type public.sportz_visibility as enum ('public', 'followers', 'group', 'invite');
create type public.sportz_event_status as enum ('open', 'full', 'live', 'cancelled', 'completed');
create type public.sportz_rsvp_status as enum ('going', 'interested', 'declined');
create type public.sportz_community_type as enum ('group', 'page');
create type public.sportz_notification_kind as enum ('like', 'comment', 'follow', 'event', 'message', 'invite', 'achievement');

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

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_kind text not null default 'image',
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

create table public.sport_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  court_id uuid references public.courts(id) on delete set null,
  title text not null,
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
  updated_at timestamptz not null default now()
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

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  last_message text,
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
  created_at timestamptz not null default now()
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
create index comments_post_created_idx on public.comments(post_id, created_at);
create index likes_entity_idx on public.likes(entity_type, entity_id);
create index follows_follower_idx on public.follows(follower_id);
create index follows_following_idx on public.follows(following_id);
create index sport_events_starts_idx on public.sport_events(starts_at);
create index event_attendees_event_idx on public.event_attendees(event_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace view public.feed_posts as
select
  p.*,
  pr.display_name,
  pr.username,
  pr.avatar_url,
  coalesce(like_counts.likes_count, 0) as likes_count,
  coalesce(comment_counts.comments_count, 0) as comments_count
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
) comment_counts on comment_counts.post_id = p.id;

create or replace view public.event_player_counts as
select
  e.*,
  count(a.user_id)::int as player_count
from public.sport_events e
left join public.event_attendees a
  on a.event_id = e.id and a.status = 'going'
group by e.id;

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.stories enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.courts enable row level security;
alter table public.sport_events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.event_messages enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "follows are readable" on public.follows for select using (true);
create policy "users manage own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

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

create policy "courts readable" on public.courts for select using (true);
create policy "admins manage courts" on public.courts for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "public events readable" on public.sport_events for select using (visibility = 'public' or auth.uid() = organizer_id);
create policy "users create own events" on public.sport_events for insert with check (auth.uid() = organizer_id);
create policy "organizers update own events" on public.sport_events for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

create policy "event attendees readable" on public.event_attendees for select using (true);
create policy "users manage own rsvp" on public.event_attendees for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

create policy "conversation members read own rows" on public.conversation_members for select using (auth.uid() = user_id);
create policy "conversation creators add members" on public.conversation_members for insert with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  or auth.uid() = user_id
);

create policy "members read conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);
create policy "authenticated create conversations" on public.conversations for insert with check (auth.uid() = created_by);

create policy "members read messages" on public.messages for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);
create policy "members send messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);

create policy "users read own receipts" on public.message_receipts for select using (auth.uid() = user_id);
create policy "users write own receipts" on public.message_receipts for insert with check (auth.uid() = user_id);

create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own push tokens" on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.event_attendees;
alter publication supabase_realtime add table public.event_messages;
