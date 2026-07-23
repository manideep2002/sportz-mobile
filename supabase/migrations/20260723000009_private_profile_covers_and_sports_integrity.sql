insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-covers',
  'profile-covers',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_view_profile_cover(owner_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id::text = owner_id
      and (
        profile.id = auth.uid()
        or not coalesce(profile.is_private, false)
        or exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = auth.uid()
            and follow.following_id = profile.id
        )
      )
      and not exists (
        select 1
        from public.blocks block
        where (
          block.blocker_id = auth.uid()
          and block.blocked_id = profile.id
        )
        or (
          block.blocker_id = profile.id
          and block.blocked_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_view_profile_cover(text) from public;
grant execute on function public.can_view_profile_cover(text) to anon, authenticated;

drop policy if exists "authorized profile covers readable" on storage.objects;
create policy "authorized profile covers readable"
on storage.objects for select
using (
  bucket_id = 'profile-covers'
  and public.can_view_profile_cover((storage.foldername(name))[1])
);

drop policy if exists "users upload own profile covers" on storage.objects;
create policy "users upload own profile covers"
on storage.objects for insert
with check (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users update own profile covers" on storage.objects;
create policy "users update own profile covers"
on storage.objects for update
using (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users delete own profile covers" on storage.objects;
create policy "users delete own profile covers"
on storage.objects for delete
using (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Legacy covers were stored in the public post-media bucket. Stop exposing
-- their URLs from private profile rows; the next cover selection uses the
-- private bucket and owner-scoped lifecycle above.
update public.profiles
set cover_url = null
where coalesce(is_private, false)
  and cover_url ~* '^https?://';

update public.profiles
set sports = array_prepend(
  primary_sport,
  array_remove(coalesce(sports, '{}'::text[]), primary_sport)
)
where primary_sport is not null
  and not (primary_sport = any(coalesce(sports, '{}'::text[])));

alter table public.profiles
  drop constraint if exists profiles_primary_sport_selected;

alter table public.profiles
  add constraint profiles_primary_sport_selected
  check (
    primary_sport is null
    or primary_sport = any(sports)
  );
