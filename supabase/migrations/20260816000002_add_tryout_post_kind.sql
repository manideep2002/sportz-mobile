-- Migration: add 'tryout' to the sportz_post_kind enum
--
-- The `kind` column on the `posts` table is typed as the
-- `public.sportz_post_kind` enum. We add the new value with
-- `IF NOT EXISTS` so the migration is safe to re-run.
--
-- NOTE: Postgres enum additions are a DDL operation and are
--       NOT transactional — the value is immediately visible
--       cluster-wide even if the surrounding transaction rolls
--       back. This is the standard Supabase pattern for enum
--       extensions; see existing migrations such as
--       20260812000001_community_role_change_notification.sql.

alter type public.sportz_post_kind add value if not exists 'tryout';
