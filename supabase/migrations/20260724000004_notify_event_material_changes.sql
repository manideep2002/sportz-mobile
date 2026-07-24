-- Event organizers and authorized community admins can update an event. Keep
-- attendee notification enforcement in the database so every update path has
-- the same behaviour.
create or replace function public.notify_sport_event_material_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attendee_id uuid;
  change_body text;
  was_cancelled boolean;
begin
  was_cancelled := new.status = 'cancelled' and old.status is distinct from new.status;

  if not was_cancelled
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at
    and new.location_name is not distinct from old.location_name
    and new.city is not distinct from old.city
    and new.entry_fee_cents is not distinct from old.entry_fee_cents then
    return new;
  end if;

  change_body := case
    when was_cancelled then coalesce(new.title, 'This event') || ' has been cancelled.'
    when new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at then 'The event time has changed.'
    when new.location_name is distinct from old.location_name
      or new.city is distinct from old.city then 'The event location has changed.'
    when new.entry_fee_cents is distinct from old.entry_fee_cents then 'The entry fee has changed.'
    else 'Event details have changed.'
  end;

  for attendee_id in
    select ea.user_id
    from public.event_attendees ea
    where ea.event_id = new.id
      and ea.status = 'going'
      and ea.user_id <> new.organizer_id
  loop
    perform public.upsert_notification_bundle(
      attendee_id,
      new.organizer_id,
      'event',
      'Event updated',
      change_body,
      'event',
      new.id,
      jsonb_build_object(
        'eventId', new.id::text,
        'source', 'event_material_update'
      ),
      'event_update:event:' || new.id::text,
      false
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists sport_events_notify_material_change on public.sport_events;
create trigger sport_events_notify_material_change
after update of starts_at, ends_at, location_name, city, entry_fee_cents, status
on public.sport_events
for each row
execute function public.notify_sport_event_material_change();

revoke all on function public.notify_sport_event_material_change() from public, anon, authenticated;
