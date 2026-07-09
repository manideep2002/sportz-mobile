-- Thread-first realtime chat architecture for Supabase.
-- Apply with `supabase db push` after setting the two app settings near the
-- bottom of this file for the Edge Function webhook.

create extension if not exists "pgcrypto";
create extension if not exists pg_net with schema extensions;

do $$
begin
  create type public.chat_room_kind as enum ('direct', 'group');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_message_type as enum ('text', 'image', 'video');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  room_kind public.chat_room_kind not null default 'direct',
  title text,
  created_by uuid not null references auth.users(id) on delete cascade,
  last_message_id uuid,
  last_message_preview text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_participants (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  is_active boolean not null default true,
  last_read_at timestamptz,
  muted_until timestamptz,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id),
  constraint chat_participants_left_state check (
    (is_active and left_at is null)
    or (not is_active and left_at is not null)
  )
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message_type public.chat_message_type not null default 'text',
  body text,
  media_url text,
  media_path text,
  media_width integer check (media_width is null or media_width > 0),
  media_height integer check (media_height is null or media_height > 0),
  media_duration_ms integer check (media_duration_ms is null or media_duration_ms >= 0),
  media_mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_content_by_type check (
    (
      message_type = 'text'
      and nullif(btrim(coalesce(body, '')), '') is not null
      and media_url is null
    )
    or (
      message_type in ('image', 'video')
      and media_url is not null
    )
  ),
  constraint chat_messages_body_size check (body is null or char_length(body) <= 4000)
);

do $$
begin
  alter table public.chat_rooms
    add constraint chat_rooms_last_message_fk
    foreign key (last_message_id)
    references public.chat_messages(id)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists chat_rooms_updated_idx
  on public.chat_rooms (updated_at desc, id desc);

create index if not exists chat_participants_user_active_idx
  on public.chat_participants (user_id, room_id)
  where is_active;

create index if not exists chat_participants_room_active_idx
  on public.chat_participants (room_id, user_id)
  where is_active;

-- Hot path for scrolling up in a room:
-- where room_id = ? and created_at < cursor order by created_at desc, id desc limit 20
create index if not exists chat_messages_room_created_desc_idx
  on public.chat_messages (room_id, created_at desc, id desc)
  where deleted_at is null;

create index if not exists chat_messages_room_sender_created_idx
  on public.chat_messages (room_id, sender_id, created_at desc)
  where deleted_at is null;

create or replace function public.set_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at
before update on public.chat_rooms
for each row execute function public.set_chat_updated_at();

create or replace function public.is_active_chat_participant(
  check_room_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_room_id is not null
    and check_user_id is not null
    and exists (
      select 1
      from public.chat_participants cp
      where cp.room_id = check_room_id
        and cp.user_id = check_user_id
        and cp.is_active
    );
$$;

create or replace function public.created_chat_room(
  check_room_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_room_id is not null
    and check_user_id is not null
    and exists (
      select 1
      from public.chat_rooms cr
      where cr.id = check_room_id
        and cr.created_by = check_user_id
    );
$$;

revoke all on function public.is_active_chat_participant(uuid, uuid) from public;
grant execute on function public.is_active_chat_participant(uuid, uuid) to authenticated, service_role;
revoke all on function public.created_chat_room(uuid, uuid) from public;
grant execute on function public.created_chat_room(uuid, uuid) to authenticated, service_role;

alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

revoke all on public.chat_rooms from anon, authenticated;
revoke all on public.chat_participants from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;

grant all on public.chat_rooms to service_role;
grant all on public.chat_participants to service_role;
grant all on public.chat_messages to service_role;

grant select, insert on public.chat_rooms to authenticated;
grant update (title, metadata) on public.chat_rooms to authenticated;

grant select, insert on public.chat_participants to authenticated;
grant update (last_read_at, muted_until, is_active, left_at) on public.chat_participants to authenticated;

grant select, insert on public.chat_messages to authenticated;
grant update (body, edited_at, deleted_at) on public.chat_messages to authenticated;

drop policy if exists "active participants read chat rooms" on public.chat_rooms;
create policy "active participants read chat rooms"
  on public.chat_rooms
  for select
  to authenticated
  using (public.is_active_chat_participant(id));

drop policy if exists "authenticated users create chat rooms" on public.chat_rooms;
create policy "authenticated users create chat rooms"
  on public.chat_rooms
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "creators update chat rooms" on public.chat_rooms;
create policy "creators update chat rooms"
  on public.chat_rooms
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "active participants read room participants" on public.chat_participants;
create policy "active participants read room participants"
  on public.chat_participants
  for select
  to authenticated
  using (public.is_active_chat_participant(room_id));

drop policy if exists "room creators add participants" on public.chat_participants;
create policy "room creators add participants"
  on public.chat_participants
  for insert
  to authenticated
  with check (public.created_chat_room(room_id));

drop policy if exists "participants update own chat state" on public.chat_participants;
create policy "participants update own chat state"
  on public.chat_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "active participants read chat messages" on public.chat_messages;
create policy "active participants read chat messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    deleted_at is null
    and public.is_active_chat_participant(room_id)
  );

drop policy if exists "active participants insert chat messages" on public.chat_messages;
create policy "active participants insert chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and deleted_at is null
    and public.is_active_chat_participant(room_id)
  );

drop policy if exists "senders update own chat messages" on public.chat_messages;
create policy "senders update own chat messages"
  on public.chat_messages
  for update
  to authenticated
  using (
    sender_id = auth.uid()
    and public.is_active_chat_participant(room_id)
  )
  with check (
    sender_id = auth.uid()
    and public.is_active_chat_participant(room_id)
  );

create or replace function public.chat_message_preview(
  check_message_type public.chat_message_type,
  check_body text
)
returns text
language sql
immutable
as $$
  select case
    when check_message_type = 'image' then 'Photo'
    when check_message_type = 'video' then 'Video'
    else left(coalesce(check_body, ''), 180)
  end;
$$;

create or replace function public.update_chat_room_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_rooms
  set
    last_message_id = new.id,
    last_message_preview = public.chat_message_preview(new.message_type, new.body),
    last_message_at = new.created_at,
    updated_at = greatest(updated_at, new.created_at)
  where id = new.room_id;

  return new;
end;
$$;

drop trigger if exists chat_messages_update_room on public.chat_messages;
create trigger chat_messages_update_room
after insert on public.chat_messages
for each row execute function public.update_chat_room_from_message();

create or replace function public.mark_chat_room_read(
  target_room_id uuid,
  read_at timestamptz default now()
)
returns public.chat_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.chat_participants;
begin
  if not public.is_active_chat_participant(target_room_id, auth.uid()) then
    raise exception 'not an active participant in this chat room';
  end if;

  update public.chat_participants
  set last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), read_at)
  where room_id = target_room_id
    and user_id = auth.uid()
  returning * into updated_row;

  return updated_row;
end;
$$;

revoke all on function public.mark_chat_room_read(uuid, timestamptz) from public;
grant execute on function public.mark_chat_room_read(uuid, timestamptz) to authenticated;

create or replace function public.chat_room_id_from_realtime_topic(topic text)
returns uuid
language sql
immutable
as $$
  select case
    when topic ~* '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(topic, ':', 2)::uuid
    else null
  end;
$$;

revoke all on function public.chat_room_id_from_realtime_topic(text) from public;
grant execute on function public.chat_room_id_from_realtime_topic(text) to authenticated, service_role;

alter table realtime.messages enable row level security;

drop policy if exists "active chat participants receive realtime room events" on realtime.messages;
create policy "active chat participants receive realtime room events"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_active_chat_participant(
      public.chat_room_id_from_realtime_topic(realtime.topic())
    )
  );

drop policy if exists "active chat participants send realtime room events" on realtime.messages;
create policy "active chat participants send realtime room events"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_active_chat_participant(
      public.chat_room_id_from_realtime_topic(realtime.topic())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.chat_room_id_from_storage_path(object_name text)
returns uuid
language sql
immutable
as $$
  with object_path as (
    select storage.foldername(object_name) as segments
  )
  select case
    when segments[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then segments[1]::uuid
    else null
  end
  from object_path;
$$;

revoke all on function public.chat_room_id_from_storage_path(text) from public;
grant execute on function public.chat_room_id_from_storage_path(text) to authenticated, service_role;

drop policy if exists "chat media readable" on storage.objects;
create policy "chat media readable"
  on storage.objects
  for select
  using (bucket_id = 'chat-media');

drop policy if exists "chat participants upload own media" on storage.objects;
create policy "chat participants upload own media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_active_chat_participant(public.chat_room_id_from_storage_path(name))
  );

drop policy if exists "chat media owners update own media" on storage.objects;
create policy "chat media owners update own media"
  on storage.objects
  for update
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[2]
  )
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "chat media owners delete own media" on storage.objects;
create policy "chat media owners delete own media"
  on storage.objects
  for delete
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create or replace function public.invoke_chat_message_notifier()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  function_url text := current_setting('app.settings.chat_message_notifier_url', true);
  webhook_secret text := current_setting('app.settings.chat_webhook_secret', true);
begin
  if coalesce(function_url, '') = '' or coalesce(webhook_secret, '') = '' then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'public',
      'table', 'chat_messages',
      'record', to_jsonb(new),
      'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-supabase-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 2000
  );

  return new;
end;
$$;

drop trigger if exists chat_messages_notify_offline on public.chat_messages;
create trigger chat_messages_notify_offline
after insert on public.chat_messages
for each row execute function public.invoke_chat_message_notifier();

-- Configure these outside source control, replacing the project ref and secret:
-- alter database postgres set "app.settings.chat_message_notifier_url" =
--   'https://<project-ref>.supabase.co/functions/v1/chat-message-notifier';
-- alter database postgres set "app.settings.chat_webhook_secret" =
--   '<same strong random value as CHAT_WEBHOOK_SECRET>';
-- select pg_reload_conf();
