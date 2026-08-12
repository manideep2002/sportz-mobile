-- The preceding timestamp was already present in the linked project's
-- migration history. Re-apply the event-chat inbox and notification schema
-- under a unique version.

create table if not exists public.event_chat_reads (
  event_id uuid not null references public.sport_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_chat_reads_user_event_idx
  on public.event_chat_reads (user_id, event_id);

alter table public.event_chat_reads enable row level security;

drop policy if exists "users read own event chat state" on public.event_chat_reads;
create policy "users read own event chat state" on public.event_chat_reads
  for select using (auth.uid() = user_id);
drop policy if exists "users insert own event chat state" on public.event_chat_reads;
create policy "users insert own event chat state" on public.event_chat_reads
  for insert with check (auth.uid() = user_id);
drop policy if exists "users update own event chat state" on public.event_chat_reads;
create policy "users update own event chat state" on public.event_chat_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.mark_event_chat_read(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  read_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to read event chat.';
  end if;
  if not exists (
    select 1 from public.event_attendees attendee
    where attendee.event_id = target_event_id
      and attendee.user_id = current_user_id
      and attendee.status = 'going'
  ) then
    raise exception 'You are not attending this event.';
  end if;
  insert into public.event_chat_reads (event_id, user_id, last_read_at)
  values (target_event_id, current_user_id, read_at)
  on conflict (event_id, user_id) do update
  set last_read_at = greatest(event_chat_reads.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_event_chat_read(uuid) from public, anon;
grant execute on function public.mark_event_chat_read(uuid) to authenticated;

create or replace function public.list_my_event_message_threads()
returns table (
  event_id uuid,
  title text,
  sport text,
  cover_url text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    event.id,
    event.title,
    event.sport,
    event.cover_url,
    latest.body,
    latest.created_at,
    count(unread.id)::integer
  from public.event_attendees attendee
  join public.sport_events event on event.id = attendee.event_id
  left join public.event_chat_reads read_state
    on read_state.event_id = attendee.event_id
   and read_state.user_id = attendee.user_id
  left join lateral (
    select message.body, message.created_at
    from public.event_messages message
    where message.event_id = attendee.event_id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join public.event_messages unread
    on unread.event_id = attendee.event_id
   and unread.sender_id <> attendee.user_id
   and unread.created_at > coalesce(read_state.last_read_at, attendee.created_at)
  where attendee.user_id = auth.uid()
    and attendee.status = 'going'
  group by event.id, event.title, event.sport, event.cover_url, latest.body, latest.created_at
  order by latest.created_at desc nulls last, event.id desc;
$$;

revoke all on function public.list_my_event_message_threads() from public, anon;
grant execute on function public.list_my_event_message_threads() to authenticated;

create or replace function public.notification_route_payload(
  notification_kind public.sportz_notification_kind,
  notification_entity_type text,
  notification_entity_id uuid
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'type', notification_kind::text,
      'kind', notification_kind::text,
      'screen', case
        when notification_entity_type = 'post' then '/post/[id]'
        when notification_entity_type = 'event' then '/event/[id]'
        when notification_entity_type = 'event_chat' then '/event-chat/[id]'
        when notification_entity_type = 'profile' then '/profile/[id]'
        when notification_entity_type in ('conversation', 'chat_room') then '/messages/[id]'
        when notification_entity_type = 'group' then '/group/[id]'
        when notification_entity_type = 'page' then '/page/[id]'
        else null
      end,
      'entityType', notification_entity_type,
      'entityId', notification_entity_id::text,
      'postId', case when notification_entity_type = 'post' then notification_entity_id::text end,
      'eventId', case when notification_entity_type in ('event', 'event_chat') then notification_entity_id::text end,
      'profileId', case when notification_entity_type = 'profile' then notification_entity_id::text end,
      'conversationId', case when notification_entity_type in ('conversation', 'chat_room') then notification_entity_id::text end,
      'communityId', case when notification_entity_type in ('group', 'page') then notification_entity_id::text end
    )
  );
$$;

create or replace function public.notify_event_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_title text;
  recipient_id uuid;
begin
  select title into event_title from public.sport_events where id = new.event_id;
  for recipient_id in
    select attendee.user_id from public.event_attendees attendee
    where attendee.event_id = new.event_id
      and attendee.status = 'going'
      and attendee.user_id <> new.sender_id
  loop
    perform public.upsert_notification_bundle(
      recipient_id,
      new.sender_id,
      'message',
      'New event chat message',
      'You have a new message in ' || coalesce(event_title, 'an event chat') || '.',
      'event_chat',
      new.event_id,
      jsonb_build_object('eventId', new.event_id::text, 'messageId', new.id::text),
      null,
      false
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists event_messages_notify_attendees on public.event_messages;
create trigger event_messages_notify_attendees
after insert on public.event_messages
for each row execute function public.notify_event_chat_message();

revoke all on function public.notify_event_chat_message() from public, anon, authenticated;
