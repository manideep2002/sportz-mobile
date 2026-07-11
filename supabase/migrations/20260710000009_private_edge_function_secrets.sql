create schema if not exists private;

create table if not exists private.edge_function_secrets (
  name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);

create or replace function private.set_edge_function_secret_updated_at()
returns trigger
language plpgsql
security definer
set search_path = private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists edge_function_secrets_set_updated_at on private.edge_function_secrets;
create trigger edge_function_secrets_set_updated_at
before update on private.edge_function_secrets
for each row execute function private.set_edge_function_secret_updated_at();

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to service_role;
grant select, insert, update, delete on private.edge_function_secrets to service_role;
