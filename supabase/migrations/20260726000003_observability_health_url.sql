-- P1-12: The production project did not have one of the optional URL rows from
-- which 20260726000002 could derive this value. This project ref is already the
-- checked-in deployment target used by the existing media/social dispatchers.

insert into private.edge_function_secrets (name, secret_value)
values (
  'observability-health_url',
  'https://rvsfmfuooxhopmxdqbao.supabase.co/functions/v1/observability-health'
)
on conflict (name) do update
set secret_value = excluded.secret_value;
