-- Fix signup failures: align profiles columns, harden handle_new_user trigger, grant auth access.
-- Run in Supabase SQL editor if signup returns "Database error saving new user".

alter table public.profiles
  add column if not exists mobile_number text,
  add column if not exists date_of_birth date,
  add column if not exists gender text;

alter table public.profiles drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('Female', 'Male', 'Non-binary', 'Prefer not to say') or gender is null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  base_username text;
  final_username text;
  suffix int := 0;
  raw_gender text;
  raw_skill text;
  parsed_skill public.sportz_skill_level;
begin
  raw_username := coalesce(new.raw_user_meta_data->>'username', '');
  base_username := regexp_replace(replace(raw_username, '@', ''), '[^a-zA-Z0-9_]', '', 'g');

  if length(base_username) < 3 then
    base_username := 'athlete_' || substring(replace(new.id::text, '-', '_') from 1 for 8);
  end if;

  if length(base_username) > 30 then
    base_username := substring(base_username from 1 for 30);
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username :=
      substring(base_username from 1 for greatest(3, 30 - length(suffix::text) - 1)) || '_' || suffix::text;
  end loop;

  raw_gender := nullif(trim(new.raw_user_meta_data->>'gender'), '');
  if raw_gender not in ('Female', 'Male', 'Non-binary', 'Prefer not to say') then
    raw_gender := null;
  end if;

  raw_skill := coalesce(
    new.raw_user_meta_data->>'primary_sport_experience_level',
    new.raw_user_meta_data->>'skill_level',
    'Intermediate'
  );

  begin
    parsed_skill := raw_skill::public.sportz_skill_level;
  exception
    when others then
      parsed_skill := 'Intermediate'::public.sportz_skill_level;
  end;

  insert into public.profiles (
    id,
    username,
    display_name,
    mobile_number,
    date_of_birth,
    gender,
    city,
    primary_sport,
    sports,
    skill_level
  )
  values (
    new.id,
    final_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'SPORTZ Athlete'),
    nullif(trim(new.raw_user_meta_data->>'mobile_number'), ''),
    nullif(trim(new.raw_user_meta_data->>'date_of_birth'), '')::date,
    raw_gender,
    nullif(trim(new.raw_user_meta_data->>'city'), ''),
    nullif(trim(new.raw_user_meta_data->>'primary_sport'), ''),
    array_remove(
      array_cat(
        array[nullif(trim(new.raw_user_meta_data->>'primary_sport'), '')],
        array(
          select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'secondary_sports', '[]'::jsonb))
        )
      ),
      null
    ),
    parsed_skill
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

grant usage on schema public to postgres, supabase_auth_admin;
grant insert, select, update on table public.profiles to postgres, supabase_auth_admin;
