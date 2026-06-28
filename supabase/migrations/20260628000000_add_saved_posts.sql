-- Add saved_posts table for post bookmarking feature.
-- This table was referenced in postService but never created.

create table public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_posts_unique unique (user_id, post_id)
);

create index saved_posts_user_idx on public.saved_posts(user_id);
create index saved_posts_post_idx on public.saved_posts(post_id);

alter table public.saved_posts enable row level security;

create policy "users read own saved posts" on public.saved_posts
  for select using (auth.uid() = user_id);

create policy "users manage own saved posts" on public.saved_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
