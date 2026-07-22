-- Keep profile data created by registration within the same limits enforced by
-- the mobile client. NOT VALID avoids blocking deployment on legacy rows while
-- still enforcing these constraints for new inserts and updates.
alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(display_name) <= 120)
  not valid;

alter table public.profiles
  add constraint profiles_city_length
  check (city is null or char_length(city) <= 100)
  not valid;

-- Invalid values from the previous permissive client were never verified and
-- cannot be used safely as contact data.
update public.profiles
set mobile_number = null
where mobile_number is not null
  and mobile_number !~ '^\+91[6-9][0-9]{9}$';

alter table public.profiles
  add constraint profiles_mobile_number_indian_format
  check (mobile_number is null or mobile_number ~ '^\+91[6-9][0-9]{9}$')
  not valid;
