create table if not exists public.court_bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint court_bookings_valid_time check (ends_at > starts_at)
);

alter table public.court_bookings enable row level security;

drop policy if exists "users read own court bookings" on public.court_bookings;
create policy "users read own court bookings" on public.court_bookings
  for select using (auth.uid() = user_id);

drop policy if exists "users create own court bookings" on public.court_bookings;
create policy "users create own court bookings" on public.court_bookings
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own court bookings" on public.court_bookings;
create policy "users update own court bookings" on public.court_bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists court_bookings_court_time_idx on public.court_bookings(court_id, starts_at);
create index if not exists court_bookings_user_idx on public.court_bookings(user_id);

