begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('16000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','visibility-owner@test','x',now(),'{}','{"username":"visibility_owner","display_name":"Visibility Owner"}',now(),now()),
  ('16000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','visibility-member@test','x',now(),'{}','{"username":"visibility_member","display_name":"Visibility Member"}',now(),now()),
  ('16000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','visibility-outsider@test','x',now(),'{}','{"username":"visibility_outsider","display_name":"Visibility Outsider"}',now(),now()),
  ('16000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','visibility-invitee@test','x',now(),'{}','{"username":"visibility_invitee","display_name":"Visibility Invitee"}',now(),now())
on conflict (id) do nothing;

insert into public.communities (id,type,name,slug,sport,created_by)
values ('26000000-0000-0000-0000-000000000001','group','Visibility test group','visibility-test-group','Basketball','16000000-0000-0000-0000-000000000001');
insert into public.community_members (community_id,user_id,role) values
  ('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','owner'),
  ('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000002','member');

insert into public.sport_events (id,organizer_id,community_id,title,event_type,sport,description,starts_at,ends_at,location_name,city,max_players,visibility,status)
values
  ('36000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001',null,'Public visibility event','Pickup Game','Basketball','fixture',now()+interval '2 days',now()+interval '2 days 2 hours','Court','Bengaluru',8,'public','open'),
  ('36000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','Group visibility event','Pickup Game','Basketball','fixture',now()+interval '3 days',now()+interval '3 days 2 hours','Court','Bengaluru',8,'group','open'),
  ('36000000-0000-0000-0000-000000000003','16000000-0000-0000-0000-000000000001',null,'Invite visibility event','Pickup Game','Basketball','fixture',now()+interval '4 days',now()+interval '4 days 2 hours','Court','Bengaluru',8,'invite','open');

insert into public.event_invitations (event_id,invitee_id,inviter_id,status,expires_at,responded_at)
values ('36000000-0000-0000-0000-000000000003','16000000-0000-0000-0000-000000000004','16000000-0000-0000-0000-000000000001','accepted',now()+interval '2 days',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='36000000-0000-0000-0000-000000000001'),1,'public events are discoverable to signed-in users');
select is(public.join_sport_event('36000000-0000-0000-0000-000000000001'),'going','a signed-in user can join a public event');
select is(public.join_sport_event('36000000-0000-0000-0000-000000000001'),'going','duplicate public joins are idempotent under concurrent retry');
reset role;
select is((select count(*)::integer from public.event_attendees where event_id='36000000-0000-0000-0000-000000000001' and user_id='16000000-0000-0000-0000-000000000003'),1,'idempotent joins persist one attendee row');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='36000000-0000-0000-0000-000000000002'),0,'RLS hides group events from outsiders');
select is(public.can_participate_sport_event('36000000-0000-0000-0000-000000000002'),false,'outsiders cannot participate in group events');
select throws_ok($$ select public.join_sport_event('36000000-0000-0000-0000-000000000002') $$,'P0001','Only group members can join this event.','group join authorization is enforced inside the RPC');
select is((select count(*)::integer from public.sport_events where id='36000000-0000-0000-0000-000000000003'),0,'RLS hides invite-only events from outsiders');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='36000000-0000-0000-0000-000000000002'),1,'group members can discover group events');
select is(public.join_sport_event('36000000-0000-0000-0000-000000000002'),'going','group members can join group events');
select is((select count(*)::integer from public.search_content('Group visibility event','event',20,0) where id='36000000-0000-0000-0000-000000000002'),1,'group members can find group events in global search');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.sport_events where id='36000000-0000-0000-0000-000000000003'),1,'accepted invitees can discover invite-only events');
select is(public.join_sport_event('36000000-0000-0000-0000-000000000003'),'going','accepted invitees can join invite-only events');
select is((select count(*)::integer from public.search_content('Invite visibility event','event',20,0) where id='36000000-0000-0000-0000-000000000003'),1,'accepted invitees can find invite-only events in global search');
reset role;

select throws_ok(
  $$ insert into public.sport_events (organizer_id,community_id,title,event_type,sport,starts_at,ends_at,location_name,city,max_players,visibility,status) values ('16000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','Invalid public group event','Pickup Game','Basketball',now()+interval '5 days',now()+interval '5 days 2 hours','Court','Bengaluru',8,'public','open') $$,
  '23514',
  null,
  'database constraints reject public visibility on group-owned events'
);

select * from finish();
rollback;
