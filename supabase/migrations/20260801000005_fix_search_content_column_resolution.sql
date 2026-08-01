-- search_content returns a column named id and also combines CTE columns named
-- id. Make its existing column-oriented intent explicit to PL/pgSQL.
do $$
declare
  search_definition text;
  body_marker constant text := E'AS $function$\n';
begin
  select pg_get_functiondef(
    'public.search_content(text,text,integer,integer)'::regprocedure
  ) into search_definition;

  if position('#variable_conflict use_column' in search_definition) > 0 then
    return;
  end if;
  if position(body_marker in search_definition) = 0 then
    raise exception 'search_content has an unexpected function-body delimiter.';
  end if;

  execute replace(
    search_definition,
    body_marker,
    body_marker || E'#variable_conflict use_column\n'
  );
end;
$$;
