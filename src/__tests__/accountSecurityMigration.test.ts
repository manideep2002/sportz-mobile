import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260727000008_account_security.sql'),
  'utf8'
);
const edgeFunction = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/account-security/index.ts'),
  'utf8'
);

describe('account security server boundary', () => {
  it('binds expiring recent authentication to the JWT session', () => {
    expect(migration).toContain("auth.jwt() ->> 'session_id'");
    expect(migration).toContain('grant_row.expires_at > now()');
    expect(edgeFunction).toContain('10 * 60_000');
  });

  it('enforces ownership and recent auth for selected-session revocation', () => {
    expect(migration).toContain('auth.sessions.user_id = owner_id');
    expect(migration).toContain('if not public.has_recent_account_auth()');
  });

  it('rate limits every protected Edge operation', () => {
    expect(edgeFunction).toContain('consumeRateLimit(user.id, body.action)');
    expect(edgeFunction).toContain('Too many security requests. Try again later.');
    expect(migration).toContain("attempt.action = 'revoke_session'");
  });

  it('uses authenticated Auth REST calls without requiring refresh tokens in the function', () => {
    expect(edgeFunction).toContain("authenticatedAuthRequest(token, '/user', 'PUT'");
    expect(edgeFunction).toContain("authenticatedAuthRequest(token, '/reauthenticate', 'GET')");
    expect(edgeFunction).not.toContain('refresh_token');
  });

  it('keeps tokens and identity data out of audit metadata', () => {
    expect(migration).toContain('Never store tokens, credentials, email, phone, IP address, or MFA secrets.');
    expect(edgeFunction).not.toContain('metadata: { email');
    expect(edgeFunction).not.toContain('metadata: { phone');
  });

  it('retires the unprotected deletion endpoint', () => {
    const retired = fs.readFileSync(
      path.join(process.cwd(), 'supabase/functions/delete-account/index.ts'),
      'utf8'
    );
    expect(retired).toContain('status: 410');
  });
});
