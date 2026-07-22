-- Auth users normally receive a profile from handle_new_user. This narrowly scoped
-- insert policy lets the profile-completion recovery flow recreate a missing row.
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

grant select, insert, update on table public.profiles to authenticated;
