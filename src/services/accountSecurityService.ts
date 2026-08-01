import type { Factor, UserIdentity } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';

export interface AccountSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent?: string;
  isCurrent: boolean;
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface TotpEnrollment {
  id: string;
  type: 'totp';
  friendly_name?: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

type SecurityActionBody =
  | { action: 'reauthenticate'; password: string }
  | { action: 'record_password_recovery'; password: string }
  | { action: 'update_password'; newPassword: string }
  | { action: 'request_email_change'; email: string }
  | { action: 'request_phone_change'; phone: string }
  | { action: 'request_mfa_recovery' }
  | { action: 'complete_mfa_recovery'; password: string; nonce: string; confirmation: 'RECOVER' }
  | { action: 'record_mfa_event'; eventType: 'mfa_enrolled' | 'mfa_removed'; factorId: string }
  | { action: 'delete_account'; email: string; confirmation: 'DELETE' };

async function edgeErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (context?.json) {
    try {
      const payload = await context.json() as { error?: unknown };
      if (typeof payload.error === 'string') return payload.error;
    } catch {
      // The response can only be consumed once; fall through to the generic message.
    }
  }
  return error instanceof Error ? error.message : 'The security operation could not be completed.';
}

async function invokeSecurity<T = { ok: true }>(body: SecurityActionBody): Promise<T> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke('account-security', {
    method: 'POST',
    body
  });
  if (error) throw new Error(await edgeErrorMessage(error));
  const payload = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!payload?.ok) throw new Error(payload?.error ?? 'The security operation could not be completed.');
  return payload;
}

export const accountSecurityService = {
  async listIdentities(): Promise<UserIdentity[]> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Your authenticated session expired. Sign in again.');
    return data.user.identities ?? [];
  },
  async hasRecentAuthentication(): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_recent_account_auth');
    if (error) throw error;
    return data === true;
  },

  reauthenticate(password: string) {
    return invokeSecurity<{ ok: true; expiresAt: string }>({ action: 'reauthenticate', password });
  },

  recordPasswordRecovery(password: string) {
    return invokeSecurity({ action: 'record_password_recovery', password });
  },

  updatePassword(newPassword: string) {
    return invokeSecurity({ action: 'update_password', newPassword });
  },

  requestEmailChange(email: string) {
    return invokeSecurity({ action: 'request_email_change', email });
  },

  requestPhoneChange(phone: string) {
    return invokeSecurity({ action: 'request_phone_change', phone });
  },

  async verifyPhoneChange(phone: string, token: string): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'phone_change'
    });
    if (error) throw error;
  },

  async listSessions(): Promise<AccountSession[]> {
    const { data, error } = await supabase.rpc('list_active_account_sessions');
    if (error) throw error;
    return ((data ?? []) as {
      id: string;
      created_at: string;
      updated_at: string;
      user_agent: string | null;
      is_current: boolean;
    }[]).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userAgent: row.user_agent ?? undefined,
      isCurrent: row.is_current
    }));
  },

  async revokeSession(session: AccountSession): Promise<void> {
    const { data, error } = await supabase.rpc('revoke_account_session', {
      target_session_id: session.id
    });
    if (error) throw error;
    if (!data) throw new Error('That session is no longer active.');
    if (session.isCurrent) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  },

  async listSecurityEvents(limit = 20): Promise<SecurityEvent[]> {
    const { data, error } = await supabase
      .from('account_security_events')
      .select('id,event_type,created_at,metadata')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      createdAt: row.created_at,
      metadata: row.metadata as Record<string, unknown>
    }));
  },

  listMfaFactors: async (): Promise<Factor[]> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp;
  },

  enrollTotp: async (friendlyName: string): Promise<TotpEnrollment> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName
    });
    if (error) throw error;
    return data as TotpEnrollment;
  },

  async verifyTotp(factorId: string, code: string): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
  },

  async unenrollTotp(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    await invokeSecurity({ action: 'record_mfa_event', eventType: 'mfa_removed', factorId });
  },

  recordMfaEnrollment(factorId: string) {
    return invokeSecurity({ action: 'record_mfa_event', eventType: 'mfa_enrolled', factorId });
  },

  requestMfaRecovery() {
    return invokeSecurity({ action: 'request_mfa_recovery' });
  },

  completeMfaRecovery(password: string, nonce: string) {
    return invokeSecurity({
      action: 'complete_mfa_recovery',
      password,
      nonce,
      confirmation: 'RECOVER'
    });
  },

  deleteAccount(email: string) {
    return invokeSecurity({ action: 'delete_account', email, confirmation: 'DELETE' });
  },

  async needsMfaChallenge(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
  }
};
