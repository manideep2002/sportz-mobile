-- Resolve the PL/pgSQL parameter/column ambiguity reported by remote db lint.
create or replace function public.cancel_court_booking(
  target_booking_id uuid,
  cancellation_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  selected_booking public.court_bookings%rowtype;
  notice_hours integer;
  is_admin boolean;
  provided_reason text := cancellation_reason;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to cancel a booking.';
  end if;

  is_admin := public.current_user_is_admin();

  select booking.*
  into selected_booking
  from public.court_bookings booking
  where booking.id = target_booking_id
  for update;

  if selected_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  select court.cancellation_notice_hours
  into notice_hours
  from public.courts court
  where court.id = selected_booking.court_id;

  if selected_booking.user_id <> current_user_id and not is_admin then
    raise exception 'You can only cancel your own bookings.';
  end if;
  if selected_booking.status not in ('pending', 'confirmed') then
    raise exception 'This booking cannot be cancelled.';
  end if;
  if not is_admin and now() > selected_booking.starts_at - make_interval(hours => notice_hours) then
    raise exception 'This booking is inside the % hour cancellation window. Contact the venue.', notice_hours;
  end if;

  update public.court_bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = current_user_id,
      cancellation_reason = nullif(left(trim(provided_reason), 240), '')
  where id = selected_booking.id;
end;
$$;

revoke all on function public.cancel_court_booking(uuid, text) from public, anon;
grant execute on function public.cancel_court_booking(uuid, text) to authenticated;

