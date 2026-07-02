alter table public.conversation_members
  add column if not exists cleared_at timestamptz;

drop policy if exists "members update own conversation membership" on public.conversation_members;
create policy "members update own conversation membership" on public.conversation_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint follow_requests_no_self check (requester_id <> target_id),
  constraint follow_requests_unique unique (requester_id, target_id)
);

alter table public.follow_requests enable row level security;

drop policy if exists "follow request participants read" on public.follow_requests;
create policy "follow request participants read" on public.follow_requests
  for select using (auth.uid() in (requester_id, target_id));

drop policy if exists "requesters create follow requests" on public.follow_requests;
create policy "requesters create follow requests" on public.follow_requests
  for insert with check (auth.uid() = requester_id);

drop policy if exists "requesters cancel follow requests" on public.follow_requests;
create policy "requesters cancel follow requests" on public.follow_requests
  for update using (auth.uid() = requester_id and status = 'pending')
  with check (auth.uid() = requester_id and status = 'cancelled');

drop policy if exists "targets respond to follow requests" on public.follow_requests;
create policy "targets respond to follow requests" on public.follow_requests
  for update using (auth.uid() = target_id and status = 'pending')
  with check (auth.uid() = target_id and status in ('approved', 'declined'));

drop policy if exists "users manage own follows" on public.follows;
drop policy if exists "users insert public follows" on public.follows;
create policy "users insert public follows" on public.follows
  for insert with check (
    auth.uid() = follower_id
    and follower_id <> following_id
    and exists (
      select 1
      from public.profiles p
      where p.id = following_id
        and coalesce(p.is_private, false) = false
    )
  );

drop policy if exists "users delete own follows" on public.follows;
create policy "users delete own follows" on public.follows
  for delete using (auth.uid() in (follower_id, following_id));

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

  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = current_user_id and b.blocked_id = target_user_id)
       or (b.blocker_id = target_user_id and b.blocked_id = current_user_id)
  ) then
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
  end if;
end;
$$;

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

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id = auth.uid()
    )
    and not exists (
      select 1
      from public.conversation_members other_member
      join public.blocks b
        on (
          (b.blocker_id = auth.uid() and b.blocked_id = other_member.user_id)
          or (b.blocker_id = other_member.user_id and b.blocked_id = auth.uid())
        )
      where other_member.conversation_id = messages.conversation_id
        and other_member.user_id <> auth.uid()
    )
  );

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
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = c.id
        and cm.user_id = current_user_id
    )
    and exists (
      select 1
      from public.conversation_members om
      where om.conversation_id = c.id
        and om.user_id = other_user_id
    )
    and (
      select count(*)
      from public.conversation_members count_members
      where count_members.conversation_id = c.id
    ) = 2
  order by c.updated_at desc
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  select display_name
  into other_display_name
  from public.profiles
  where id = other_user_id;

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

create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_shares_unique unique (post_id, user_id)
);

create table if not exists public.post_mentions (
  post_id uuid not null references public.posts(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, mentioned_user_id)
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint story_reactions_unique unique (story_id, user_id, reaction)
);

create table if not exists public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.post_shares enable row level security;
alter table public.post_mentions enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;
alter table public.story_replies enable row level security;

drop policy if exists "post shares readable" on public.post_shares;
create policy "post shares readable" on public.post_shares for select using (true);
drop policy if exists "users create own post shares" on public.post_shares;
create policy "users create own post shares" on public.post_shares for insert with check (auth.uid() = user_id);

drop policy if exists "post mentions readable" on public.post_mentions;
create policy "post mentions readable" on public.post_mentions for select using (true);
drop policy if exists "authors create post mentions" on public.post_mentions;
create policy "authors create post mentions" on public.post_mentions
  for insert with check (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.author_id = auth.uid()
    )
  );

drop policy if exists "story viewers read own views or authors read views" on public.story_views;
create policy "story viewers read own views or authors read views" on public.story_views
  for select using (
    auth.uid() = viewer_id
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
drop policy if exists "users create own story views" on public.story_views;
create policy "users create own story views" on public.story_views for insert with check (auth.uid() = viewer_id);

drop policy if exists "story authors read reactions" on public.story_reactions;
create policy "story authors read reactions" on public.story_reactions
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
drop policy if exists "users create own story reactions" on public.story_reactions;
create policy "users create own story reactions" on public.story_reactions for insert with check (auth.uid() = user_id);

drop policy if exists "story authors read replies" on public.story_replies;
create policy "story authors read replies" on public.story_replies
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
drop policy if exists "users create own story replies" on public.story_replies;
create policy "users create own story replies" on public.story_replies for insert with check (auth.uid() = user_id);

create table if not exists public.notification_preferences (
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

create table if not exists public.conversation_mutes (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.notification_preferences enable row level security;
alter table public.conversation_mutes enable row level security;

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own conversation mutes" on public.conversation_mutes;
create policy "users manage own conversation mutes" on public.conversation_mutes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.join_sport_event(target_event_id uuid)
returns void
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

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status <> 'open' then
    raise exception 'This event is not open for joins.';
  end if;

  if event_row.visibility <> 'public' and event_row.organizer_id <> current_user_id then
    raise exception 'This event is invite-only.';
  end if;

  select count(*)
  into going_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going'
    and user_id <> current_user_id;

  if going_count >= event_row.max_players then
    update public.sport_events set status = 'full' where id = target_event_id;
    raise exception 'This event is full.';
  end if;

  insert into public.event_attendees (event_id, user_id, status)
  values (target_event_id, current_user_id, 'going')
  on conflict (event_id, user_id)
  do update set status = 'going';

  select count(*)
  into going_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going';

  if going_count >= event_row.max_players then
    update public.sport_events set status = 'full' where id = target_event_id;
  end if;
end;
$$;

create extension if not exists btree_gist;

alter table public.court_bookings
  drop constraint if exists court_bookings_no_overlap;

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

revoke all on function public.request_or_follow_profile(uuid) from public;
revoke all on function public.respond_to_follow_request(uuid, boolean) from public;
revoke all on function public.users_blocked_each_other(uuid, uuid) from public;
revoke all on function public.create_direct_conversation(uuid) from public;
revoke all on function public.join_sport_event(uuid) from public;
revoke all on function public.book_court_slot(uuid, timestamptz, timestamptz) from public;

grant execute on function public.request_or_follow_profile(uuid) to authenticated;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;
grant execute on function public.users_blocked_each_other(uuid, uuid) to authenticated;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.join_sport_event(uuid) to authenticated;
grant execute on function public.book_court_slot(uuid, timestamptz, timestamptz) to authenticated;

create index if not exists follow_requests_target_status_idx on public.follow_requests(target_id, status);
create index if not exists post_shares_post_idx on public.post_shares(post_id);
create index if not exists post_mentions_user_idx on public.post_mentions(mentioned_user_id);
create index if not exists story_views_viewer_idx on public.story_views(viewer_id);
create index if not exists story_reactions_story_idx on public.story_reactions(story_id);
create index if not exists story_replies_story_idx on public.story_replies(story_id);
