create or replace function public.get_edge_function_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = private
as $$
  select secret_value
  from private.edge_function_secrets
  where name = secret_name;
$$;

revoke all on function public.get_edge_function_secret(text) from public, anon, authenticated;
grant execute on function public.get_edge_function_secret(text) to service_role;
