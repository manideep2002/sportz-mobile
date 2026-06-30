create or replace function public.is_community_admin(target_community_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  );
$$;

drop policy if exists "community admins add members" on public.community_members;
create policy "community admins add members" on public.community_members
  for insert
  with check (
    public.is_community_admin(community_id)
    and role in ('admin', 'member', 'follower')
  );

drop policy if exists "community admins update members" on public.community_members;
create policy "community admins update members" on public.community_members
  for update
  using (
    public.is_community_admin(community_id)
    and role <> 'owner'
  )
  with check (
    public.is_community_admin(community_id)
    and role in ('admin', 'member', 'follower')
  );

drop policy if exists "community admins remove members" on public.community_members;
create policy "community admins remove members" on public.community_members
  for delete
  using (
    public.is_community_admin(community_id)
    and role <> 'owner'
  );
