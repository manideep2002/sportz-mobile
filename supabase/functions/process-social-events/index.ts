import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SocialEventType = 'like' | 'comment' | 'follow';

type SocialEventPayload = {
  eventId?: string;
  type: SocialEventType;
  actorId: string;
  recipientUserId: string;
  entityType: 'post' | 'profile';
  entityId: string;
  postId?: string;
  commentId?: string;
  parentCommentId?: string;
  profileId?: string;
  aggregateKey: string;
  screen: '/post/[id]' | '/profile/[id]';
  body?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
};

type QueueMessage = {
  msg_id: number | string;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: unknown;
};

type ClaimedBundle = {
  id: string;
  recipient_user_id: string;
  kind: SocialEventType;
  aggregate_key: string;
  actor_count: number;
  event_count: number;
  next_flush_at: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const configuredWebhookSecret = Deno.env.get('SOCIAL_EVENTS_WEBHOOK_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const batchSize = Number(Deno.env.get('SOCIAL_EVENTS_BATCH_SIZE') ?? 75);
const visibilityTimeoutSeconds = Number(Deno.env.get('SOCIAL_EVENTS_VISIBILITY_TIMEOUT_SECONDS') ?? 120);
const maxDrainPasses = Number(Deno.env.get('SOCIAL_EVENTS_DRAIN_PASSES') ?? 4);
const maxQueueAttempts = Number(Deno.env.get('SOCIAL_EVENTS_MAX_QUEUE_ATTEMPTS') ?? 6);
const bundleClaimLimit = Number(Deno.env.get('SOCIAL_BUNDLE_CLAIM_LIMIT') ?? 30);
const maxInlineFlushWaitMs = Number(Deno.env.get('SOCIAL_BUNDLE_INLINE_WAIT_MS') ?? 300_000);

let cachedDatabaseWebhookSecret: string | null | undefined = configuredWebhookSecret ?? undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scalarString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const isSocialEventType = (value: unknown): value is SocialEventType =>
  value === 'like' || value === 'comment' || value === 'follow';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toMessageId = (message: QueueMessage) => Number(message.msg_id);

const normalizeEvent = (message: QueueMessage): SocialEventPayload | null => {
  if (!isRecord(message.message)) return null;

  const type = message.message.type;
  const actorId = scalarString(message.message.actorId);
  const recipientUserId = scalarString(message.message.recipientUserId);
  const entityType = scalarString(message.message.entityType);
  const entityId = scalarString(message.message.entityId);
  const aggregateKey = scalarString(message.message.aggregateKey);
  const screen = scalarString(message.message.screen);

  if (!isSocialEventType(type) || !actorId || !recipientUserId || !entityId || !aggregateKey) {
    return null;
  }

  const normalizedEntityType = entityType === 'profile' ? 'profile' : 'post';
  const normalizedScreen = screen === '/profile/[id]' ? '/profile/[id]' : '/post/[id]';

  return {
    eventId: scalarString(message.message.eventId),
    type,
    actorId,
    recipientUserId,
    entityType: normalizedEntityType,
    entityId,
    postId: scalarString(message.message.postId),
    commentId: scalarString(message.message.commentId),
    parentCommentId: scalarString(message.message.parentCommentId),
    profileId: scalarString(message.message.profileId),
    aggregateKey,
    screen: normalizedScreen,
    body: scalarString(message.message.body),
    occurredAt: scalarString(message.message.occurredAt) ?? message.enqueued_at,
    data: isRecord(message.message.data) ? message.message.data : undefined
  };
};

const groupKey = (event: SocialEventPayload) =>
  `${event.recipientUserId}:${event.aggregateKey}:${event.type}:${event.entityId}`;

const orderEventsForBundling = (events: SocialEventPayload[]) => {
  const groups = new Map<string, SocialEventPayload[]>();

  for (const event of events) {
    const key = groupKey(event);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.values()).flatMap((group) =>
    group.sort((left, right) => {
      const leftTime = Date.parse(left.occurredAt ?? '') || 0;
      const rightTime = Date.parse(right.occurredAt ?? '') || 0;
      return leftTime - rightTime;
    })
  );
};

const getWebhookSecret = async () => {
  if (configuredWebhookSecret) return configuredWebhookSecret;
  if (cachedDatabaseWebhookSecret !== undefined) return cachedDatabaseWebhookSecret;

  const { data, error } = await supabase.rpc('get_edge_function_secret', {
    secret_name: 'process_social_events_webhook'
  });

  if (error) throw error;

  cachedDatabaseWebhookSecret = typeof data === 'string' ? data : null;
  return cachedDatabaseWebhookSecret;
};

const readQueue = async () => {
  const { data, error } = await supabase.rpc('read_social_events_queue', {
    batch_size: batchSize,
    visibility_timeout: visibilityTimeoutSeconds
  });

  if (error) throw error;
  return (data ?? []) as QueueMessage[];
};

const archiveMessages = async (messageIds: number[]) => {
  if (!messageIds.length) return 0;

  const { data, error } = await supabase.rpc('archive_social_events_queue', {
    message_ids: messageIds
  });

  if (error) throw error;
  return Number(data ?? 0);
};

const recordFailure = async (message: QueueMessage, reason: string) => {
  await supabase.rpc('record_social_event_failure', {
    message_id: toMessageId(message),
    message_payload: message.message,
    failure_reason: reason
  });
};

const recordEvents = async (events: SocialEventPayload[]) => {
  if (!events.length) return 0;

  const orderedEvents = orderEventsForBundling(events);
  const { data, error } = await supabase.rpc('record_social_notification_events', {
    event_payloads: orderedEvents
  });

  if (error) throw error;
  return Number(data ?? 0);
};

const claimDueBundles = async () => {
  const { data, error } = await supabase.rpc('claim_due_social_notification_bundles', {
    bundle_limit: bundleClaimLimit
  });

  if (error) throw error;
  return (data ?? []) as ClaimedBundle[];
};

const completeBundle = async (bundleId: string) => {
  const { error } = await supabase.rpc('complete_social_notification_bundle', {
    bundle_id: bundleId
  });

  if (error) throw error;
};

const failBundle = async (bundleId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Social bundle delivery failed.';
  await supabase.rpc('fail_social_notification_bundle', {
    bundle_id: bundleId,
    bundle_error: message
  });
};

const flushDueBundles = async () => {
  let delivered = 0;
  let failed = 0;

  while (true) {
    const bundles = await claimDueBundles();
    if (!bundles.length) break;

    for (const bundle of bundles) {
      try {
        await completeBundle(bundle.id);
        delivered += 1;
      } catch (error) {
        failed += 1;
        await failBundle(bundle.id, error);
      }
    }

    if (bundles.length < bundleClaimLimit) break;
  }

  return { delivered, failed };
};

const waitForNearestShortFlush = async () => {
  const { data, error } = await supabase.rpc('next_social_notification_flush_at');
  if (error || !data) return false;

  const delayMs = Date.parse(data as string) - Date.now();
  if (delayMs <= 0 || delayMs > maxInlineFlushWaitMs) return false;

  await sleep(delayMs);
  return true;
};

const drainQueueOnce = async () => {
  const messages = await readQueue();
  if (!messages.length) {
    return { read: 0, recorded: 0, archived: 0, poisoned: 0 };
  }

  const validEvents: SocialEventPayload[] = [];
  const archiveIds: number[] = [];
  let poisoned = 0;

  for (const message of messages) {
    const messageId = toMessageId(message);
    const event = normalizeEvent(message);

    if (!event) {
      poisoned += 1;
      archiveIds.push(messageId);
      await recordFailure(message, 'Invalid social event payload.');
      continue;
    }

    if (message.read_ct > maxQueueAttempts) {
      poisoned += 1;
      archiveIds.push(messageId);
      await recordFailure(message, `Exceeded ${maxQueueAttempts} queue attempts.`);
      continue;
    }

    validEvents.push(event);
    archiveIds.push(messageId);
  }

  const recorded = await recordEvents(validEvents);
  const archived = await archiveMessages(archiveIds);

  return {
    read: messages.length,
    recorded,
    archived,
    poisoned
  };
};

const runQueueConsumer = async () => {
  let read = 0;
  let recorded = 0;
  let archived = 0;
  let poisoned = 0;

  for (let pass = 0; pass < maxDrainPasses; pass += 1) {
    const result = await drainQueueOnce();
    read += result.read;
    recorded += result.recorded;
    archived += result.archived;
    poisoned += result.poisoned;

    if (result.read === 0 || result.read < batchSize) break;
  }

  const firstFlush = await flushDueBundles();
  let secondFlush = { delivered: 0, failed: 0 };

  if (await waitForNearestShortFlush()) {
    secondFlush = await flushDueBundles();
  }

  console.log(
    JSON.stringify({
      stage: 'process-social-events',
      read,
      recorded,
      archived,
      poisoned,
      delivered: firstFlush.delivered + secondFlush.delivered,
      failed: firstFlush.failed + secondFlush.failed
    })
  );
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  let webhookSecret: string | null;
  try {
    webhookSecret = await getWebhookSecret();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook secret lookup failed.'
      },
      { status: 500 }
    );
  }

  if (!webhookSecret || request.headers.get('x-supabase-webhook-secret') !== webhookSecret) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  EdgeRuntime.waitUntil(
    runQueueConsumer().catch((error) => {
      console.error('process-social-events background failure', error);
    })
  );

  return Response.json({ ok: true, accepted: true });
});
