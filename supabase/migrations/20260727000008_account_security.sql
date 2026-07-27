create table if not exists public.account_recent_auth_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  method text not null check (method in ('password', 'email_otp')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, session_id)
);

create table if not exists public.account_security_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists account_security_attempts_window_idx
  on public.account_security_attempts (user_id, action, attempted_at desc);

create table if not exists public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_session_id uuid,
  event_type text not null check (
    event_type in (
      'recent_auth_verified',
      'password_changed',
      'email_change_requested',
      'phone_change_requested',
      'session_revoked',
      'other_sessions_revoked',
      'mfa_enrolled',
      'mfa_removed',
      'mfa_recovery_requested',
      'mfa_recovered',
      'account_deleted'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.account_security_events is
  'Privacy-minimized account-security audit events. Retain for 90 days unless legal or abuse review requires longer.';
comment on column public.account_security_events.metadata is
  'Allow-listed non-secret context only. Never store tokens, credentials, email, phone, IP address, or MFA secrets.';

create index if not exists account_security_events_user_created_idx
  on public.account_security_events (user_id, created_at desc);

alter table public.account_recent_auth_grants enable row level security;
alter table public.account_security_attempts enable row level security;
alter table public.account_security_events enable row level security;

drop policy if exists "users read own security events" on public.account_security_events;
create policy "users read own security events"
  on public.account_security_events
  for select
  using (auth.uid() = user_id);

revoke all on public.account_recent_auth_grants from public, anon, authenticated;
revoke all on public.account_security_attempts from public, anon, authenticated;
revoke all on public.account_security_events from public, anon, authenticated;
grant select on public.account_security_events to authenticated;

create or replace function public.current_auth_session_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  raw_session_id text := auth.jwt() ->> 'session_id';
begin
  if raw_session_id is null or raw_session_id = '' then
    return null;
  end if;
  return raw_session_id::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function public.current_auth_session_id() from public, anon;
grant execute on function public.current_auth_session_id() to authenticated;

create or replace function public.has_recent_account_auth()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_recent_auth_grants grant_row
    where grant_row.user_id = auth.uid()
      and grant_row.session_id = public.current_auth_session_id()
      and grant_row.expires_at > now()
  );
$$;

revoke all on function public.has_recent_account_auth() from public, anon;
grant execute on function public.has_recent_account_auth() to authenticated;

create or replace function public.list_active_account_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_row.id,
    session_row.created_at,
    session_row.updated_at,
    nullif(left(coalesce(session_row.user_agent, ''), 240), '') as user_agent,
    session_row.id = public.current_auth_session_id() as is_current
  from auth.sessions session_row
  where session_row.user_id = auth.uid()
  order by session_row.updated_at desc;
$$;

revoke all on function public.list_active_account_sessions() from public, anon;
grant execute on function public.list_active_account_sessions() to authenticated;

create or replace function public.revoke_account_session(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_session uuid := public.current_auth_session_id();
  event_id uuid;
begin
  if owner_id is null or current_session is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.has_recent_account_auth() then
    raise exception 'Recent authentication required.' using errcode = '42501';
  end if;

  if (
    select count(*) >= 10
    from public.account_security_attempts attempt
    where attempt.user_id = owner_id
      and attempt.action = 'revoke_session'
      and attempt.attempted_at > now() - interval '10 minutes'
  ) then
    raise exception 'Too many security requests. Try again later.' using errcode = 'P0001';
  end if;

  insert into public.account_security_attempts (user_id, action, succeeded)
  values (owner_id, 'revoke_session', false);

  delete from auth.sessions
  where auth.sessions.id = target_session_id
    and auth.sessions.user_id = owner_id;

  if not found then
    return false;
  end if;

  update public.account_security_attempts
  set succeeded = true
  where id = currval(pg_get_serial_sequence('public.account_security_attempts', 'id'));

  insert into public.account_security_events (user_id, actor_session_id, event_type, metadata)
  values (
    owner_id,
    current_session,
    'session_revoked',
    jsonb_build_object('revoked_current_session', target_session_id = current_session)
  )
  returning id into event_id;

  insert into public.notifications (
    user_id,
    kind,
    title,
    body,
    entity_type,
    entity_id,
    data
  )
  values (
    owner_id,
    'security',
    'Session signed out',
    case
      when target_session_id = current_session then 'This device was signed out.'
      else 'A signed-in device was removed from your account.'
    end,
    'security_event',
    event_id,
    jsonb_build_object('eventType', 'session_revoked')
  );

  return true;
end;
$$;

revoke all on function public.revoke_account_session(uuid) from public, anon;
grant execute on function public.revoke_account_session(uuid) to authenticated;

create or replace function public.prune_account_security_records()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.account_recent_auth_grants where expires_at < now();
  delete from public.account_security_attempts where attempted_at < now() - interval '24 hours';
  delete from public.account_security_events where created_at < now() - interval '90 days';
end;
$$;

revoke all on function public.prune_account_security_records() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune-account-security-records',
      '17 3 * * *',
      'select public.prune_account_security_records()'
    );
  end if;
exception
  when unique_violation then null;
end
$$;
