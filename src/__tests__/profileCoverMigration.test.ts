import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260723000009_private_profile_covers_and_sports_integrity.sql'
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const privacyGuardMigration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'supabase/migrations/20260723000010_private_profile_legacy_cover_guard.sql'
  ),
  'utf8'
);

describe('private profile covers migration', () => {
  it('creates a private, image-only profile cover bucket', () => {
    expect(migration).toContain("'profile-covers'");
    expect(migration).toMatch(/'profile-covers',\s*'profile-covers',\s*false/i);
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  });

  it('keeps cover authorization and ownership in storage RLS', () => {
    expect(migration).toContain('public.can_view_profile_cover');
    expect(migration).toContain('profile.is_private');
    expect(migration).toContain('public.user_follows');
    expect(migration).toContain('auth.uid()::text = (storage.foldername(name))[1]');
  });

  it('enforces that the primary sport remains selected', () => {
    expect(migration).toContain('profiles_primary_sport_selected');
    expect(migration).toContain('primary_sport = any(sports)');
  });

  it('prevents a later private-profile transition from retaining a legacy public cover', () => {
    expect(privacyGuardMigration).toContain('profiles_protect_private_cover');
    expect(privacyGuardMigration).toContain("new.cover_url ~* '^https?://'");
    expect(privacyGuardMigration).toContain('new.cover_url := null');
  });
});
