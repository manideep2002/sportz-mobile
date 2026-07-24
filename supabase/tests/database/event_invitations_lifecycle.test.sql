begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('15000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','event-owner@test','x',now(),'{}','{"username":"event_owner","display_name":"Event Owner"}',now(),now()),
  ('15000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','event-member@test','x',now(),'{}','{"username":"event_member","display_name":"Event Member"}',now(),now()),
  ('15000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','event-outsider@test','x',now(),'{}','{"username":"event_outsider","display_name":"Event Outsider"}',now(),now()),
  ('15000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','event-member-two@test','x',now(),'{}','{"username":"event_member_two","display_name":"Event Member Two"}',now(),now())
on conflict (id) do nothing;

insert into public.communities (id,type,name,slug,sport,is_private,created_by)
values ('25000000-0000-0000-0000-000000000001','group','Invitation test group','invitation-test-group','Basketball',true,'15000000-0000-0000-0000-000000000001');
insert into public.community_members (community_id,user_id,role) values
  ('25000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','owner'),
  ('25000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000002','member'),
  ('25000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000004','member');
insert into public.sport_events (id,organizer_id,community_id,title,event_type,sport,description,starts_at,ends_at,location_name,city,max_players,visibility,status)
values ('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','Invite-only group event','Pickup Game','Basketball','fixture',now()+interval '2 days',now()+interval '2 days 2 hours','Court','Bengaluru',2,'invite','open');
insert into public.event_attendees (event_id,user_id,status) values ('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','going');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='35000000-0000-0000-0000-000000000001'),0,'outsiders cannot discover invite-only group events');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$ select public.create_event_invitation('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000002') $$,'organizer can invite a group member');
select throws_ok($$ select public.create_event_invitation('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000002') $$,'P0001','This player already has an active invitation.','duplicate invitations are rejected');
select throws_ok($$ select public.create_event_invitation('35000000-0000-0000-0000-000001','15000000-0000-0000-0000-000000000003') $$,'P0001',null,'invalid event invitations are rejected');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='35000000-0000-0000-0000-000000000001'),1,'an invited member can discover the invite-only event');
select is(public.respond_to_event_invitation((select id from public.event_invitations where event_id='35000000-0000-0000-0000-000000000001'),'true'),'going','acceptance uses the capacity-safe attendance path');
reset role;
select is((select count(*)::integer from public.event_attendees where event_id='35000000-0000-0000-0000-000000000001' and status='going'),2,'acceptance fills but does not overfill capacity');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$ select public.create_event_invitation('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000004',now()+interval '1 second') $$,'organizer can create another pending invitation');
select lives_ok($$ select public.revoke_event_invitation((select id from public.event_invitations where event_id='35000000-0000-0000-0000-000000000001' and invitee_id='15000000-0000-0000-0000-000000000004')) $$,'organizer can revoke a pending invitation');
reset role;
select is((select status::text from public.event_invitations where event_id='35000000-0000-0000-0000-000000000001' and invitee_id='15000000-0000-0000-0000-000000000004'),'revoked','revocation persists');
select * from finish();
rollback;
