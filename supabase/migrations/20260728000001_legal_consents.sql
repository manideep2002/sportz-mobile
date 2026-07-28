-- Immutable, version-specific evidence of the legal documents accepted when an
-- account is created. Clients cannot insert, update, or delete these records.
create table public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  consent_source text not null,
  consented_at timestamptz not null default now(),
  constraint legal_consents_terms_version_present
    check (char_length(trim(terms_version)) between 1 and 40),
  constraint legal_consents_privacy_version_present
    check (char_length(trim(privacy_version)) between 1 and 40),
  constraint legal_consents_source_known
    check (consent_source in ('account_creation')),
  constraint legal_consents_version_pair_unique
    unique (user_id, terms_version, privacy_version)
);

alter table public.legal_consents enable row level security;

create policy "users read own legal consents"
  on public.legal_consents
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.legal_consents to authenticated;
revoke insert, update, delete on table public.legal_consents from anon, authenticated;

create or replace function public.record_signup_legal_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_terms_version constant text := '2026-07-28';
  accepted_privacy_version constant text := '2026-07-28';
begin
  -- Only the versions shipped with this release are accepted as evidence.
  -- A future document version must update both the app and this allow-list.
  if new.raw_user_meta_data->>'terms_version' = accepted_terms_version
    and new.raw_user_meta_data->>'privacy_version' = accepted_privacy_version
    and new.raw_user_meta_data->>'consent_source' = 'account_creation'
  then
    insert into public.legal_consents (
      user_id,
      terms_version,
      privacy_version,
      consent_source
    )
    values (
      new.id,
      accepted_terms_version,
      accepted_privacy_version,
      'account_creation'
    )
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;

  return new;
end;
$$;

alter function public.record_signup_legal_consent() owner to postgres;
revoke all on function public.record_signup_legal_consent() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_record_legal_consent on auth.users;
create trigger on_auth_user_created_record_legal_consent
after insert on auth.users
for each row execute function public.record_signup_legal_consent();
