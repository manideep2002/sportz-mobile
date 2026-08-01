import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260801000006_authorize_community_admin_member_removal.sql'),
  'utf8'
);

describe('community administrator member-removal migration', () => {
  it('authorizes owner/admin actors while protecting owner and peer-admin targets', () => {
    expect(migration).toContain("actor_role not in ('owner', 'admin')");
    expect(migration).toContain("existing_role = 'owner'");
    expect(migration).toContain("actor_role = 'admin' and existing_role = 'admin'");
    expect(migration).toContain('Only an owner can remove another administrator.');
  });

  it('keeps removal authenticated and audited with role metadata', () => {
    expect(migration).toContain("'member_removed'");
    expect(migration).toContain("jsonb_build_object('actorRole', actor_role, 'targetRole', existing_role)");
    expect(migration).toContain('revoke execute on function public.remove_community_member(uuid, uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.remove_community_member(uuid, uuid) to authenticated');
  });
});
