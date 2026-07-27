import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEdgeObservability,
  edgeJsonResponse
} from '../_shared/observability.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are required.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

type Action =
  | 'reauthenticate'
  | 'record_password_recovery'
  | 'update_password'
  | 'request_email_change'
  | 'request_phone_change'
  | 'request_mfa_recovery'
  | 'complete_mfa_recovery'
  | 'record_mfa_event'
  | 'delete_account';

interface RequestBody {
  action?: Action;
  password?: string;
  newPassword?: string;
  email?: string;
  phone?: string;
  nonce?: string;
  confirmation?: string;
  eventType?: 'mfa_enrolled' | 'mfa_removed';
  factorId?: string;
}

const limits: Record<Action, { maximum: number; minutes: number }> = {
  reauthenticate: { maximum: 5, minutes: 15 },
  record_password_recovery: { maximum: 3, minutes: 60 },
  update_password: { maximum: 3, minutes: 60 },
  request_email_change: { maximum: 3, minutes: 60 },
  request_phone_change: { maximum: 3, minutes: 60 },
  request_mfa_recovery: { maximum: 3, minutes: 60 },
  complete_mfa_recovery: { maximum: 3, minutes: 60 },
  record_mfa_event: { maximum: 10, minutes: 60 },
  delete_account: { maximum: 3, minutes: 60 }
};

function sessionIdFromJwt(token: string): string | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

async function authenticatedAuthRequest(
  token: string,
  path: string,
  method: 'GET' | 'PUT',
  body?: Record<string, unknown>
) {
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: anonKey!,
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.ok) return;
  const payload = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
  throw new Error(payload.msg ?? payload.message ?? payload.error_description ?? 'Authentication service rejected the request.');
}

async function consumeRateLimit(userId: string, action: Action) {
  const limit = limits[action];
  const since = new Date(Date.now() - limit.minutes * 60_000).toISOString();
  const { count, error } = await admin
    .from('account_security_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('attempted_at', since);
  if (error) throw error;
  if ((count ?? 0) >= limit.maximum) {
    throw new Response('Too many security requests. Try again later.', { status: 429 });
  }
  const { data, error: insertError } = await admin
    .from('account_security_attempts')
    .insert({ user_id: userId, action, succeeded: false })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return data.id as number;
}

async function markSucceeded(attemptId: number) {
  const { error } = await admin
    .from('account_security_attempts')
    .update({ succeeded: true })
    .eq('id', attemptId);
  if (error) throw error;
}

async function requireRecentAuth(userId: string, sessionId: string) {
  const { data, error } = await admin
    .from('account_recent_auth_grants')
    .select('expires_at,method')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Response('Recent authentication required.', { status: 403 });
  return;
}

async function createSecurityEvent(
  userId: string,
  sessionId: string,
  eventType: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {},
  notify = true
) {
  const { data, error } = await admin
    .from('account_security_events')
    .insert({
      user_id: userId,
      actor_session_id: sessionId,
      event_type: eventType,
      metadata
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!notify) return data.id as string;

  const { error: notificationError } = await admin.from('notifications').insert({
    user_id: userId,
    kind: 'security',
    title,
    body,
    entity_type: 'security_event',
    entity_id: data.id,
    data: { eventType }
  });
  if (notificationError) throw notificationError;
  return data.id as string;
}

function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 12 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

Deno.serve(async (request) => {
  const observability = createEdgeObservability(request, 'account-security');
  if (request.method !== 'POST') {
    return edgeJsonResponse(observability, { ok: false, error: 'Method not allowed.' }, { status: 405 });
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return edgeJsonResponse(observability, { ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json() as RequestBody;
    if (!body.action || !(body.action in limits)) {
      return edgeJsonResponse(observability, { ok: false, error: 'Unsupported security action.' }, { status: 400 });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const sessionId = sessionIdFromJwt(token);
    if (userError || !userData.user || !sessionId) {
      return edgeJsonResponse(observability, { ok: false, error: 'Invalid session.' }, { status: 401 });
    }
    const user = userData.user;
    const attemptId = await consumeRateLimit(user.id, body.action);
    observability.log('info', 'account_security.requested', { action: body.action });

    if (body.action === 'reauthenticate') {
      if (!user.email || typeof body.password !== 'string') {
        return edgeJsonResponse(observability, { ok: false, error: 'Password authentication is unavailable for this account.' }, { status: 400 });
      }
      const verifier = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: verification, error: verificationError } = await verifier.auth.signInWithPassword({
        email: user.email,
        password: body.password
      });
      if (verificationError || verification.user?.id !== user.id) {
        observability.log('warn', 'account_security.reauthentication_failed');
        return edgeJsonResponse(observability, { ok: false, error: 'Password could not be verified.' }, { status: 401 });
      }
      if (verification.session) await verifier.auth.signOut({ scope: 'local' });
      const verifiedAt = new Date();
      const expiresAt = new Date(verifiedAt.getTime() + 10 * 60_000);
      const { error: grantError } = await admin.from('account_recent_auth_grants').upsert({
        user_id: user.id,
        session_id: sessionId,
        method: 'password',
        verified_at: verifiedAt.toISOString(),
        expires_at: expiresAt.toISOString()
      });
      if (grantError) throw grantError;
      await createSecurityEvent(
        user.id,
        sessionId,
        'recent_auth_verified',
        '',
        '',
        { method: 'password' },
        false
      );
      await markSucceeded(attemptId);
      return edgeJsonResponse(observability, { ok: true, expiresAt: expiresAt.toISOString() });
    }

    if (body.action === 'record_password_recovery') {
      if (!user.email || typeof body.password !== 'string') {
        return edgeJsonResponse(observability, { ok: false, error: 'Password verification is unavailable.' }, { status: 400 });
      }
      const verifier = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: verification, error: verificationError } = await verifier.auth.signInWithPassword({
        email: user.email,
        password: body.password
      });
      if (verificationError || verification.user?.id !== user.id) {
        return edgeJsonResponse(observability, { ok: false, error: 'Updated password could not be verified.' }, { status: 401 });
      }
      if (verification.session) await verifier.auth.signOut({ scope: 'local' });
      await admin.auth.admin.signOut(token, 'others');
      await createSecurityEvent(
        user.id,
        sessionId,
        'password_changed',
        'Password changed',
        'Your password was recovered and your other devices were signed out.',
        { method: 'recovery' }
      );
      await admin.from('account_recent_auth_grants').delete().eq('user_id', user.id);
      await markSucceeded(attemptId);
      return edgeJsonResponse(observability, { ok: true });
    }

    await requireRecentAuth(user.id, sessionId);

    if (body.action === 'update_password') {
      if (!validPassword(body.newPassword)) {
        return edgeJsonResponse(
          observability,
          { ok: false, error: 'Use 12–128 characters with uppercase, lowercase, and a number.' },
          { status: 400 }
        );
      }
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: body.newPassword });
      if (error) throw error;
      await admin.auth.admin.signOut(token, 'others');
      await createSecurityEvent(
        user.id,
        sessionId,
        'password_changed',
        'Password changed',
        'Your password was changed and your other devices were signed out.'
      );
      await admin.from('account_recent_auth_grants').delete().eq('user_id', user.id);
    } else if (body.action === 'request_email_change') {
      if (typeof body.email !== 'string' || body.email.length > 254 || !body.email.includes('@')) {
        return edgeJsonResponse(observability, { ok: false, error: 'Enter a valid email address.' }, { status: 400 });
      }
      await authenticatedAuthRequest(token, '/user', 'PUT', {
        email: body.email.trim().toLowerCase()
      });
      await createSecurityEvent(
        user.id,
        sessionId,
        'email_change_requested',
        'Email change requested',
        'Verification is required before your email address changes.'
      );
    } else if (body.action === 'request_phone_change') {
      if (typeof body.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(body.phone)) {
        return edgeJsonResponse(observability, { ok: false, error: 'Enter a phone number in international format.' }, { status: 400 });
      }
      await authenticatedAuthRequest(token, '/user', 'PUT', { phone: body.phone });
      await createSecurityEvent(
        user.id,
        sessionId,
        'phone_change_requested',
        'Phone change requested',
        'Verification is required before your phone number changes.'
      );
    } else if (body.action === 'request_mfa_recovery') {
      if (!user.email) {
        return edgeJsonResponse(observability, { ok: false, error: 'A verified email is required for MFA recovery.' }, { status: 400 });
      }
      await authenticatedAuthRequest(token, '/reauthenticate', 'GET');
      await createSecurityEvent(
        user.id,
        sessionId,
        'mfa_recovery_requested',
        'MFA recovery requested',
        'A one-time recovery code was requested for your account.'
      );
    } else if (body.action === 'complete_mfa_recovery') {
      if (body.confirmation !== 'RECOVER') {
        return edgeJsonResponse(observability, { ok: false, error: 'Recovery confirmation is invalid.' }, { status: 400 });
      }
      if (
        typeof body.nonce !== 'string' ||
        body.nonce.length < 6 ||
        typeof body.password !== 'string'
      ) {
        return edgeJsonResponse(observability, { ok: false, error: 'Recovery confirmation is invalid.' }, { status: 400 });
      }
      await authenticatedAuthRequest(token, '/user', 'PUT', {
        password: body.password,
        nonce: body.nonce
      });
      const { data: factors, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
      if (factorsError) throw factorsError;
      for (const factor of factors.factors) {
        const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
        if (error) throw error;
      }
      await admin.auth.admin.signOut(token, 'others');
      await createSecurityEvent(
        user.id,
        sessionId,
        'mfa_recovered',
        'MFA recovery completed',
        'Authenticator factors were removed and other devices were signed out.'
      );
      await admin.from('account_recent_auth_grants').delete().eq('user_id', user.id);
    } else if (body.action === 'record_mfa_event') {
      if (!body.eventType || !body.factorId) {
        return edgeJsonResponse(observability, { ok: false, error: 'MFA event details are required.' }, { status: 400 });
      }
      const { data: factors, error } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
      if (error) throw error;
      const factor = factors.factors.find((item) => item.id === body.factorId);
      if (body.eventType === 'mfa_enrolled' && (!factor || factor.status !== 'verified')) {
        return edgeJsonResponse(observability, { ok: false, error: 'Verified MFA factor not found.' }, { status: 409 });
      }
      if (body.eventType === 'mfa_removed' && factor) {
        return edgeJsonResponse(observability, { ok: false, error: 'MFA factor is still enrolled.' }, { status: 409 });
      }
      await createSecurityEvent(
        user.id,
        sessionId,
        body.eventType,
        body.eventType === 'mfa_enrolled' ? 'Authenticator added' : 'Authenticator removed',
        body.eventType === 'mfa_enrolled'
          ? 'An authenticator app was added to your account.'
          : 'An authenticator app was removed from your account.',
        { factorType: 'totp' }
      );
    } else if (body.action === 'delete_account') {
      const expectedIdentity = (user.email ?? user.phone ?? '').trim().toLowerCase();
      if (body.confirmation !== 'DELETE' || !expectedIdentity || body.email?.trim().toLowerCase() !== expectedIdentity) {
        return edgeJsonResponse(observability, { ok: false, error: 'Account deletion confirmation did not match.' }, { status: 400 });
      }
      const eventId = await createSecurityEvent(
        user.id,
        sessionId,
        'account_deleted',
        '',
        '',
        { confirmation: 'typed' },
        false
      );
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
      observability.log('info', 'account_security.account_deleted', { event_id: eventId });
      await markSucceeded(attemptId);
      return edgeJsonResponse(observability, { ok: true });
    }

    await markSucceeded(attemptId);
    observability.log('info', 'account_security.completed', { action: body.action });
    return edgeJsonResponse(observability, { ok: true });
  } catch (error) {
    if (error instanceof Response) {
      return edgeJsonResponse(
        observability,
        { ok: false, error: await error.text() },
        { status: error.status }
      );
    }
    observability.log('error', 'account_security.failed', {
      error_name: error instanceof Error ? error.name : 'UnknownError',
      error_message: error instanceof Error ? error.message : 'Unknown failure'
    });
    return edgeJsonResponse(observability, { ok: false, error: 'The security operation could not be completed.' }, { status: 500 });
  }
});
