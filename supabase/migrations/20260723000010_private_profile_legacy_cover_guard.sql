create or replace function public.protect_private_profile_cover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.is_private, false)
    and new.cover_url ~* '^https?://'
  then
    new.cover_url := null;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_private_cover on public.profiles;
create trigger profiles_protect_private_cover
before insert or update of is_private, cover_url
on public.profiles
for each row
execute function public.protect_private_profile_cover();
