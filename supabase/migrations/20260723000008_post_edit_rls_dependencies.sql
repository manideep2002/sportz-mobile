-- Posts RLS evaluates follower and community membership predicates while the
-- security-invoker edit RPC locks the target row. Grant read access only to
-- those policy dependency tables; their own RLS remains enabled.

grant select on table public.follows to authenticated;
grant select on table public.community_members to authenticated;
