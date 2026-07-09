create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  unix_ts_ms bigint;
  ts_hex text;
  rand_hex text;
  variant_nibble text;
begin
  unix_ts_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  ts_hex := right(lpad(to_hex(unix_ts_ms), 12, '0'), 12);
  rand_hex := encode(extensions.gen_random_bytes(9), 'hex');
  variant_nibble := substr('89ab', (get_byte(extensions.gen_random_bytes(1), 0) % 4) + 1, 1);

  return (
    substr(ts_hex, 1, 8) || '-' ||
    substr(ts_hex, 9, 4) || '-' ||
    '7' || substr(rand_hex, 1, 3) || '-' ||
    variant_nibble || substr(rand_hex, 4, 3) || '-' ||
    substr(rand_hex, 7, 12)
  )::uuid;
end;
$$;

grant execute on function public.uuid_generate_v7() to anon, authenticated, service_role;
