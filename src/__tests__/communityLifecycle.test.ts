import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000005_community_administration.sql'),
  'utf8'
);
const privacyMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260712000005_community_membership_lifecycle.sql'),
  'utf8'
);
const hardeningMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000006_community_privacy_hardening.sql'),
  'utf8'
);

describe('community administration lifecycle', () => {
  it('uses an explicit locked ownership transfer and protects the final owner', () => {
    expect(migration).toContain('create or replace function public.transfer_community_ownership');
    expect(migration).toMatch(/where id = target_community_id for update/i);
    expect(migration).toMatch(/where community_id = target_community_id for update/i);
    expect(migration).toContain('Transfer ownership before removing or demoting the final owner.');
    expect(migration).toContain('Transfer ownership before leaving this community.');

    const targetPromotion = migration.indexOf("set role = 'owner'");
    const previousOwnerDemotion = migration.indexOf("set role = 'admin'", targetPromotion);
    expect(targetPromotion).toBeGreaterThan(0);
    expect(previousOwnerDemotion).toBeGreaterThan(targetPromotion);
  });

  it('restricts role transitions and settings to owners', () => {
    expect(migration).toContain('Only an owner can promote or demote administrators.');
    expect(migration).toContain('Only an owner can change community settings.');
    expect(migration).toContain("if target_role not in ('admin', 'member', 'follower')");
    expect(migration).toContain("if existing_role = 'owner'");
  });

  it('archives activity at the database boundary and retains a controlled restore path', () => {
    expect(migration).toContain('create or replace function public.set_community_archived');
    expect(migration).toContain('Archived communities cannot receive new activity.');
    expect(migration).toContain('community_members_require_active');
    expect(migration).toContain('community_invites_require_active');
    expect(migration).toContain('community_join_requests_require_active');
    expect(migration).toContain('community_events_require_active');
    expect(migration).toContain('enforce_community_post_authorization_trigger');
  });

  it('keeps private community access behind membership-aware RLS', () => {
    expect(privacyMigration).toMatch(/coalesce\(is_private, false\) = false/i);
    expect(privacyMigration).toContain('public.is_community_member(id, auth.uid())');
    expect(hardeningMigration).not.toContain('or created_by = auth.uid()');
    expect(hardeningMigration).toContain('or public.is_community_member(id, auth.uid())');
    expect(migration).toContain('join_approval_required');
    expect(migration).toContain('then coalesce(require_join_approval, false) or coalesce(community_is_private, false)');
  });

  it('isolates lifecycle RPCs from anonymous callers and supports platform audit review', () => {
    expect(hardeningMigration).toContain('from public, anon');
    expect(hardeningMigration).toContain('to authenticated');
    expect(hardeningMigration).toContain('or public.current_user_is_admin()');
  });

  it('provides audited moderation, deletion, and branding policies', () => {
    expect(migration).toContain('create table if not exists public.community_admin_audit_log');
    expect(migration).toContain('create or replace function public.remove_community_post');
    expect(migration).toContain("'content_removed'");
    expect(migration).toContain('create or replace function public.delete_community');
    expect(migration).toContain("'community-media'");
    expect(migration).toContain('community owners upload branding');
    expect(migration).toContain('community owners delete branding');
  });

  it('uses the publishing user identity for page posts', () => {
    expect(migration).toContain('Page identity decision: page administrators publish as themselves.');
    expect(migration).toContain('if new.author_id <> auth.uid()');
    expect(migration).toContain('Only page administrators can publish to a page.');
  });
});
