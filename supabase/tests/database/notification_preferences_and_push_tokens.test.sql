begin;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000a01', 'authenticated', 'authenticated', 'push-a@test.invalid', 'x', now(), now()),
  ('00000000-0000-0000-0000-000000000a02', 'authenticated', 'authenticated', 'push-b@test.invalid', 'x', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-0000-0000-000000000a01', 'push_a', 'Push A'),
  ('00000000-0000-0000-0000-000000000a02', 'push_b', 'Push B');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', true);
insert into public.notification_preferences (user_id, push_enabled) values ('00000000-0000-0000-0000-000000000a01', false);
select results_eq('select push_enabled from public.notification_preferences where user_id = auth.uid()', array[false], 'users can read their own preference');
select is_empty($$select * from public.notification_preferences where user_id = '00000000-0000-0000-0000-000000000a02'$$, 'RLS hides another user preference');

insert into public.user_push_tokens (user_id, expo_push_token, platform, device_id)
values ('00000000-0000-0000-0000-000000000a01', 'ExponentPushToken[token-shared]', 'android', 'install-1');
select lives_ok($$select public.revoke_push_installation('install-1')$$, 'revocation is idempotent');
select results_eq('select is_active from public.user_push_tokens where user_id = auth.uid() and device_id = ''install-1''', array[false], 'revocation deactivates only current installation');
select lives_ok($$select public.revoke_push_installation('install-1')$$, 'repeat revocation succeeds');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a02', true);
insert into public.user_push_tokens (user_id, expo_push_token, platform, device_id)
values ('00000000-0000-0000-0000-000000000a02', 'ExponentPushToken[token-shared]', 'android', 'install-1');
select results_eq('select user_id from public.user_push_tokens where expo_push_token = ''ExponentPushToken[token-shared]'' and is_active', array['00000000-0000-0000-0000-000000000a02'::uuid], 'same physical token is reassigned to the new account');
select is((select count(*) from public.user_push_tokens where expo_push_token = 'ExponentPushToken[token-shared]' and is_active), 1::bigint, 'one active owner exists per token');
select throws($$select public.revoke_push_installation('')$$, 'P0001', 'A device id is required.', 'empty device id is rejected');

select * from finish();
rollback;
