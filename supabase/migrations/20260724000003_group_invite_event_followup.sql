-- Follow-up to the deployed invitation schema: group events may be invite-only
-- and invitation acceptance uses the same locked capacity/waitlist primitives.

create or replace function public.respond_to_event_invitation(target_invitation_id uuid, accept_invitation boolean)
returns text language plpgsql security definer set search_path = public
as $$
declare i public.event_invitations%rowtype; e public.sport_events%rowtype; going_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in to respond to invitations.'; end if;
  select * into i from public.event_invitations where id = target_invitation_id for update;
  if i.id is null or i.invitee_id <> auth.uid() then raise exception 'Invitation not found.'; end if;
  if i.status <> 'pending' then return i.status::text; end if;
  if i.expires_at <= now() then update public.event_invitations set status='expired', responded_at=now() where id=i.id; return 'expired'; end if;
  if not accept_invitation then update public.event_invitations set status='declined', responded_at=now() where id=i.id; return 'declined'; end if;
  select * into e from public.sport_events where id=i.event_id for update;
  if e.id is null or e.status not in ('open','full') then raise exception 'This event is not open for joins.'; end if;
  update public.event_invitations set status='accepted', responded_at=now() where id=i.id;
  select count(*) into going_count from public.event_attendees where event_id=e.id and status='going';
  if going_count >= e.max_players then
    insert into public.event_waitlist(event_id,user_id,status) values(e.id,auth.uid(),'waiting')
    on conflict(event_id,user_id) do update set status='waiting',created_at=now();
    perform public.set_sport_event_capacity_status(e.id); return 'waitlisted';
  end if;
  insert into public.event_attendees(event_id,user_id,status) values(e.id,auth.uid(),'going')
  on conflict(event_id,user_id) do update set status='going';
  update public.event_waitlist set status='cancelled' where event_id=e.id and user_id=auth.uid() and status='waiting';
  perform public.set_sport_event_capacity_status(e.id); return 'going';
end;
$$;

create or replace function public.create_sport_event(
  target_title text,target_event_type text,target_sport text,target_description text,target_cover_url text,
  target_starts_at timestamptz,target_ends_at timestamptz,target_location_name text,target_city text,
  target_latitude double precision default null,target_longitude double precision default null,target_max_players integer default 2,
  target_entry_fee_cents integer default 0,target_visibility public.sportz_visibility default 'public',target_community_id uuid default null
) returns uuid language plpgsql security definer set search_path=public
as $$
declare current_user_id uuid:=auth.uid(); new_event_id uuid;
begin
  if current_user_id is null then raise exception 'You must be signed in to create events.'; end if;
  if target_title is null or length(btrim(target_title))=0 or target_event_type is null or length(btrim(target_event_type))=0 or target_sport is null or length(btrim(target_sport))=0 or target_location_name is null or length(btrim(target_location_name))=0 or target_city is null or length(btrim(target_city))=0 then raise exception 'Please complete all required event fields.'; end if;
  if target_starts_at is null or target_ends_at is null or target_ends_at<=target_starts_at or target_starts_at<=now() then raise exception 'Enter a valid future event time.'; end if;
  if coalesce(target_max_players,0)<2 then raise exception 'Max players must be at least 2.'; end if;
  if coalesce(target_entry_fee_cents,0)<0 then raise exception 'Entry fee must be 0 or a positive amount.'; end if;
  if target_community_id is not null and not public.is_community_member(target_community_id,current_user_id) then raise exception 'Only group members can schedule group events.'; end if;
  if target_community_id is not null and target_visibility not in ('group','invite') then raise exception 'Group events must be visible to group members or invited members only.'; end if;
  if target_visibility='group' and target_community_id is null then raise exception 'Group events require a community.'; end if;
  insert into public.sport_events(organizer_id,community_id,title,event_type,sport,description,cover_url,starts_at,ends_at,location_name,city,latitude,longitude,max_players,entry_fee_cents,currency,visibility,status)
  values(current_user_id,target_community_id,btrim(target_title),btrim(target_event_type),btrim(target_sport),coalesce(target_description,''),target_cover_url,target_starts_at,target_ends_at,btrim(target_location_name),btrim(target_city),target_latitude,target_longitude,target_max_players,coalesce(target_entry_fee_cents,0),'INR',coalesce(target_visibility,'public'),'open') returning id into new_event_id;
  insert into public.event_attendees(event_id,user_id,status) values(new_event_id,current_user_id,'going'); return new_event_id;
end;
$$;

grant execute on function public.respond_to_event_invitation(uuid,boolean) to authenticated;
grant execute on function public.create_sport_event(text,text,text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,integer,integer,public.sportz_visibility,uuid) to authenticated;
