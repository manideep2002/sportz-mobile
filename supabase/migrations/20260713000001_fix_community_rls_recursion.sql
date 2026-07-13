-- Fix recursive RLS introduced by private community membership policies.
-- Policies must not directly scan community_members while Postgres is already
-- evaluating community_members access. Keep those lookups inside
-- security-definer helpers owned by the migration role/table owner.

create or replace function public.is_community_member(target_community_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.community_members member
      where member.community_id = target_community_id
        and member.user_id = target_user_id
    );
$$;

create or replace function public.is_community_admin(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.community_members member
      where member.community_id = target_community_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    );
$$;

create or replace function public.can_read_community_members(target_community_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and (
        coalesce(community.is_private, false) = false
        or public.is_community_member(target_community_id, target_user_id)
      )
  );
$$;

create or replace function public.can_join_community_directly(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and coalesce(community.is_private, false) = false
  );
$$;

create or replace function public.is_community_creator(target_community_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.communities community
      where community.id = target_community_id
        and community.created_by = target_user_id
    );
$$;

drop policy if exists "community members readable" on public.community_members;
create policy "community members readable" on public.community_members
  for select using (
    public.can_read_community_members(community_id, auth.uid())
  );

drop policy if exists "community creators add owner row" on public.community_members;
create policy "community creators add owner row" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and role = 'owner'
    and public.is_community_creator(community_id, auth.uid())
  );

drop policy if exists "users join communities" on public.community_members;
create policy "users join communities" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and role in ('member', 'follower')
    and public.can_join_community_directly(community_id)
  );

drop policy if exists "owners update communities" on public.communities;
create policy "owners update communities" on public.communities
  for update
  using (public.is_community_admin(id))
  with check (public.is_community_admin(id));

drop policy if exists "community invite participants read" on public.community_invites;
create policy "community invite participants read" on public.community_invites
  for select using (
    auth.uid() in (inviter_id, invitee_id)
    or public.is_community_admin(community_id)
  );

drop policy if exists "community admins create invites" on public.community_invites;
create policy "community admins create invites" on public.community_invites
  for insert with check (
    auth.uid() = inviter_id
    and public.is_community_admin(community_id)
  );

drop policy if exists "public posts readable" on public.posts;
create policy "public posts readable" on public.posts
  for select using (
    auth.uid() = author_id
    or visibility = 'public'
    or (
      visibility = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = posts.author_id
      )
    )
    or (
      visibility = 'group'
      and community_id is not null
      and public.is_community_member(posts.community_id, auth.uid())
    )
  );

grant execute on function public.is_community_member(uuid, uuid) to anon, authenticated;
grant execute on function public.is_community_admin(uuid) to anon, authenticated;
grant execute on function public.can_read_community_members(uuid, uuid) to anon, authenticated;
grant execute on function public.can_join_community_directly(uuid) to anon, authenticated;
grant execute on function public.is_community_creator(uuid, uuid) to anon, authenticated;
