import { supabase } from '@/lib/supabase';
import { accountSecurityService } from '@/services/accountSecurityService';

jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      signOut: jest.fn(),
      verifyOtp: jest.fn(),
      mfa: {
        challengeAndVerify: jest.fn(),
        enroll: jest.fn(),
        unenroll: jest.fn(),
        listFactors: jest.fn(),
        getAuthenticatorAssuranceLevel: jest.fn()
      }
    }
  }
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockAuthSignOut = supabase.auth.signOut as jest.Mock;
const mockChallengeAndVerify = supabase.auth.mfa.challengeAndVerify as jest.Mock;

describe('account security client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('requires the server to issue recent-auth grants', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(accountSecurityService.hasRecentAuthentication()).resolves.toBe(false);

    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, expiresAt: '2026-07-27T10:10:00.000Z' },
      error: null
    });
    await accountSecurityService.reauthenticate('not-logged-or-returned');
    expect(mockInvoke).toHaveBeenCalledWith('account-security', expect.objectContaining({
      body: { action: 'reauthenticate', password: 'not-logged-or-returned' }
    }));
  });

  it('routes password updates through the protected Edge Function', async () => {
    await accountSecurityService.updatePassword('A-strong-password-123');
    expect(mockInvoke).toHaveBeenCalledWith('account-security', expect.objectContaining({
      body: { action: 'update_password', newPassword: 'A-strong-password-123' }
    }));
  });

  it('server-verifies completed password recovery before auditing it', async () => {
    await accountSecurityService.recordPasswordRecovery('Recovered-password-123');
    expect(mockInvoke).toHaveBeenCalledWith('account-security', expect.objectContaining({
      body: { action: 'record_password_recovery', password: 'Recovered-password-123' }
    }));
  });

  it('revokes a selected session and locally signs out only for the current device', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await accountSecurityService.revokeSession({
      id: 'session-1',
      createdAt: '2026-07-27T09:00:00Z',
      updatedAt: '2026-07-27T10:00:00Z',
      isCurrent: true
    });
    expect(mockRpc).toHaveBeenCalledWith('revoke_account_session', { target_session_id: 'session-1' });
    expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('uses Supabase challenge verification and server-audited MFA recovery', async () => {
    mockChallengeAndVerify.mockResolvedValue({ error: null });
    await accountSecurityService.verifyTotp('factor-1', '123456');
    expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });

    await accountSecurityService.requestMfaRecovery();
    await accountSecurityService.completeMfaRecovery('Current-password-123', '123456');
    expect(mockInvoke).toHaveBeenLastCalledWith('account-security', expect.objectContaining({
      body: {
        action: 'complete_mfa_recovery',
        password: 'Current-password-123',
        nonce: '123456',
        confirmation: 'RECOVER'
      }
    }));
  });

  it('requires typed destructive account deletion at the server endpoint', async () => {
    await accountSecurityService.deleteAccount('athlete@example.com');
    expect(mockInvoke).toHaveBeenCalledWith('account-security', expect.objectContaining({
      body: {
        action: 'delete_account',
        email: 'athlete@example.com',
        confirmation: 'DELETE'
      }
    }));
  });
});
