-- Keep post visibility enforcement symmetric with the social safety model.
-- RLS remains the authority for private group membership and blocked users,
-- including direct Post Detail and community pagination requests.

drop policy if exists "public posts readable" on public.posts;
create policy "public posts readable" on public.posts
for select using (
  auth.uid() = author_id
  or (
    not public.users_blocked_each_other(auth.uid(), author_id)
    and (
      visibility = 'public'
      or (
        visibility = 'followers'
        and exists (
          select 1
          from public.user_follows
          where follower_id = auth.uid()
            and following_id = posts.author_id
        )
      )
      or (
        visibility = 'group'
        and community_id is not null
        and public.is_community_member(community_id, auth.uid())
      )
    )
  )
);
