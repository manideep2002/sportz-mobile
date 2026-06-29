alter table public.profiles
  add column if not exists is_private boolean not null default false;

drop policy if exists "visible posts readable" on public.posts;
drop policy if exists "public posts readable" on public.posts;

create policy "visible posts readable" on public.posts for select using (
  auth.uid() = author_id
  or (
    visibility = 'public'
    and not exists (
      select 1
      from public.profiles pr
      where pr.id = posts.author_id
        and pr.is_private
        and not exists (
          select 1
          from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = posts.author_id
        )
    )
  )
  or (
    visibility = 'followers'
    and exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = posts.author_id
    )
  )
);

