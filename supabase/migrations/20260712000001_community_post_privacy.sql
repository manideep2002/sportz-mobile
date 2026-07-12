-- ============================================================
-- Community post privacy fix
--
-- Problems fixed:
--   1. The original "public posts readable" RLS only permitted
--      visibility = 'public', which means:
--        - 'followers' posts were already broken (non-authors
--          could never read them).
--        - 'group' posts could never be read by community
--          members other than the author.
--   2. Adds a covering index for community feed queries.
-- ============================================================

-- Drop the old, too-narrow policy.
drop policy if exists "public posts readable" on public.posts;

-- Recreate with correct membership checks for all three
-- visibility levels that can be set from the app.
create policy "public posts readable" on public.posts
  for select using (
    -- Always visible: the author can see their own posts.
    auth.uid() = author_id

    -- Public posts are readable by anyone (including anon).
    or visibility = 'public'

    -- Followers-only posts are readable by followers of the author.
    or (
      visibility = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = posts.author_id
      )
    )

    -- Group posts are readable only by members of the community.
    or (
      visibility = 'group'
      and community_id is not null
      and exists (
        select 1
        from public.community_members cm
        where cm.community_id = posts.community_id
          and cm.user_id = auth.uid()
      )
    )
  );

-- Index to speed up community feed queries
-- (used by postService.listCommunityPosts and the RLS check above).
create index if not exists posts_community_visibility_idx
  on public.posts(community_id, visibility)
  where community_id is not null;

-- Index to speed up the followers-visibility RLS check.
create index if not exists posts_author_visibility_idx
  on public.posts(author_id, visibility)
  where visibility in ('followers', 'group');
