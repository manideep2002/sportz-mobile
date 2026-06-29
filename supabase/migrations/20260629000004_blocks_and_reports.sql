create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_no_self_block check (blocker_id <> blocked_id),
  constraint blocks_unique unique (blocker_id, blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('user', 'post', 'comment', 'event', 'community')),
  entity_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

drop policy if exists "users read own blocks" on public.blocks;
create policy "users read own blocks" on public.blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists "users manage own blocks" on public.blocks;
create policy "users manage own blocks" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "users create own reports" on public.reports;
create policy "users create own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "users read own reports" on public.reports;
create policy "users read own reports" on public.reports
  for select using (auth.uid() = reporter_id);

create index if not exists blocks_blocker_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
create index if not exists reports_reporter_idx on public.reports(reporter_id);

alter table public.community_members
  drop constraint if exists community_members_role_check;

alter table public.community_members
  add constraint community_members_role_check
  check (role in ('owner', 'admin', 'member', 'follower'));
