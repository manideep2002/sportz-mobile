/**
 * Edge Function webhook authentication tests (Jest/Node.js version).
 *
 * These tests replicate the authentication guard logic from each Edge Function
 * without requiring a live Supabase project or the Deno runtime.
 *
 * The corresponding Deno-native version lives in:
 *   supabase/functions/chat-message-notifier/webhook-auth.test.ts
 * Run it with: deno test --allow-env supabase/functions/chat-message-notifier/webhook-auth.test.ts
 */

// ── Shared constants ──────────────────────────────────────────────────────────
const VALID_SECRET = 'test-webhook-secret-32-chars-long!';

// ── chat-message-notifier auth guard ─────────────────────────────────────────
// Mirrors index.ts lines 74-86

type WebhookPayload = {
  type: string;
  schema: string;
  table: string;
  record: Record<string, unknown>;
  old_record: null;
};

function handleChatNotifier(
  webhookSecret: string | undefined,
  requestSecret: string | null,
  payload: WebhookPayload
): { status: number; body: Record<string, unknown> } {
  if (!webhookSecret) {
    return { status: 500, body: { ok: false, error: 'CHAT_WEBHOOK_SECRET is not configured.' } };
  }
  if (requestSecret !== webhookSecret) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  }
  if (payload.type !== 'INSERT' || payload.table !== 'chat_messages') {
    return { status: 200, body: { ok: true, sent: 0, skipped: 0 } };
  }
  return { status: 200, body: { ok: true, accepted: true } };
}

function makePayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    type: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    record: { id: 'msg-1', room_id: 'room-1', sender_id: 'user-1', message_type: 'text', body: 'Hello', media_url: null, created_at: new Date().toISOString() },
    old_record: null,
    ...overrides
  };
}

// ── notification-dispatcher auth guard ───────────────────────────────────────
// Mirrors index.ts lines 331-346

function handleNotificationDispatcher(
  webhookSecret: string | null,
  requestSecret: string | null
): { status: number; body: Record<string, unknown> } {
  if (webhookSecret === null) {
    return { status: 500, body: { ok: false, error: 'Webhook secret lookup failed.' } };
  }
  if (!webhookSecret || requestSecret !== webhookSecret) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  }
  return { status: 200, body: { ok: true, accepted: true } };
}

// ── process-social-events auth guard ─────────────────────────────────────────
// Mirrors the same pattern used in notification-dispatcher and process-social-events

function handleSocialEvents(
  webhookSecret: string | null,
  requestSecret: string | null
): { status: number; body: Record<string, unknown> } {
  if (webhookSecret === null) {
    return { status: 500, body: { ok: false, error: 'Webhook secret lookup failed.' } };
  }
  if (!webhookSecret || requestSecret !== webhookSecret) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  }
  return { status: 200, body: { ok: true, accepted: true } };
}

// ── feed-fanout result shape ──────────────────────────────────────────────────
type FeedFanoutResult = { ok: boolean; jobs: number; inserted: number; failed: number };

function makeFanoutResult(jobs: number, inserted: number, failed: number): FeedFanoutResult {
  return { ok: failed === 0, jobs, inserted, failed };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('chat-message-notifier webhook auth', () => {
  it('accepts a valid secret', () => {
    const res = handleChatNotifier(VALID_SECRET, VALID_SECRET, makePayload());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects a wrong secret with 401', () => {
    const res = handleChatNotifier(VALID_SECRET, 'wrong-secret', makePayload());
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('rejects a missing request secret with 401', () => {
    const res = handleChatNotifier(VALID_SECRET, null, makePayload());
    expect(res.status).toBe(401);
  });

  it('rejects an empty request secret with 401', () => {
    const res = handleChatNotifier(VALID_SECRET, '', makePayload());
    expect(res.status).toBe(401);
  });

  it('returns 500 when server-side secret is not configured', () => {
    const res = handleChatNotifier(undefined, VALID_SECRET, makePayload());
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('accepts non-INSERT payloads with sent=0 (no push needed)', () => {
    const res = handleChatNotifier(VALID_SECRET, VALID_SECRET, makePayload({ type: 'UPDATE' }));
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
  });

  it('accepts wrong-table payloads with sent=0', () => {
    const res = handleChatNotifier(VALID_SECRET, VALID_SECRET, makePayload({ table: 'notifications' }));
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
  });
});

describe('notification-dispatcher webhook auth', () => {
  it('accepts a valid secret', () => {
    const res = handleNotificationDispatcher(VALID_SECRET, VALID_SECRET);
    expect(res.status).toBe(200);
  });

  it('rejects a wrong secret with 401', () => {
    const res = handleNotificationDispatcher(VALID_SECRET, 'bad');
    expect(res.status).toBe(401);
  });

  it('returns 401 when server secret is empty string (unconfigured)', () => {
    const res = handleNotificationDispatcher('', VALID_SECRET);
    expect(res.status).toBe(401);
  });

  it('returns 500 when DB secret lookup failed (null)', () => {
    const res = handleNotificationDispatcher(null, VALID_SECRET);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/lookup failed/i);
  });
});

describe('process-social-events webhook auth', () => {
  it('accepts a valid secret', () => {
    const res = handleSocialEvents(VALID_SECRET, VALID_SECRET);
    expect(res.status).toBe(200);
  });

  it('rejects a wrong secret with 401', () => {
    const res = handleSocialEvents(VALID_SECRET, 'bad');
    expect(res.status).toBe(401);
  });

  it('returns 500 when secret lookup fails (null)', () => {
    const res = handleSocialEvents(null, VALID_SECRET);
    expect(res.status).toBe(500);
  });
});

describe('feed-fanout job result shape', () => {
  it('empty queue returns ok=true with zero counts', () => {
    const result = makeFanoutResult(0, 0, 0);
    expect(result.ok).toBe(true);
    expect(result.jobs).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('partial failure sets ok=false', () => {
    const result = makeFanoutResult(5, 40, 2);
    expect(result.ok).toBe(false);
    expect(result.failed).toBe(2);
  });

  it('all jobs succeed sets ok=true', () => {
    const result = makeFanoutResult(10, 850, 0);
    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
  });

  it('ok field is false when any job fails', () => {
    expect(makeFanoutResult(1, 0, 1).ok).toBe(false);
    expect(makeFanoutResult(1, 100, 0).ok).toBe(true);
  });
});

describe('missing secret fails safely and visibly', () => {
  it('chat-message-notifier returns 500 with descriptive error when secret is missing', () => {
    const res = handleChatNotifier(undefined, null, makePayload());
    expect(res.status).toBe(500);
    expect(typeof res.body.error).toBe('string');
    expect((res.body.error as string).length).toBeGreaterThan(0);
  });

  it('notification-dispatcher returns 500 with descriptive error when DB lookup fails', () => {
    const res = handleNotificationDispatcher(null, null);
    expect(res.status).toBe(500);
    expect(typeof res.body.error).toBe('string');
    expect((res.body.error as string).length).toBeGreaterThan(0);
  });
});
