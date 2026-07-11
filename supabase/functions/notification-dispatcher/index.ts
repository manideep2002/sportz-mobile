import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationKind =
  | 'like'
  | 'comment'
  | 'mention'
  | 'follow'
  | 'follow_request'
  | 'event'
  | 'message'
  | 'invite'
  | 'achievement';

type NotificationRecord = {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_ids?: string[] | null;
  actor_count?: number | null;
  kind: NotificationKind;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  aggregate_key?: string | null;
  data?: Record<string, unknown> | null;
  push_attempts?: number | null;
  push_sent_at?: string | null;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: NotificationRecord | null;
  old_record: NotificationRecord | null;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type NotificationPreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  likes: boolean;
  comments: boolean;
  mentions?: boolean;
  follows: boolean;
  messages: boolean;
  events: boolean;
  invites: boolean;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, string>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
};

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

type ExpoPushResponse = {
  data?: ExpoTicket[];
  errors?: Array<{ code?: string; message?: string }>;
};

type MessageEnvelope = {
  tokenId: string;
  token: string;
  message: ExpoPushMessage;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const configuredWebhookSecret = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
const maxExpoBatchSize = 100;
const maxConcurrentExpoRequests = 6;
let cachedDatabaseWebhookSecret: string | null | undefined = configuredWebhookSecret ?? undefined;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const isExpoPushToken = (token: string) =>
  /^ExpoPushToken\[[\w-]+]$/.test(token) || /^ExponentPushToken\[[\w-]+]$/.test(token);

const getWebhookSecret = async () => {
  if (configuredWebhookSecret) return configuredWebhookSecret;
  if (cachedDatabaseWebhookSecret !== undefined) return cachedDatabaseWebhookSecret;

  const { data, error } = await supabase.rpc('get_edge_function_secret', {
    secret_name: 'notification_dispatcher_webhook'
  });

  if (error) {
    throw error;
  }

  cachedDatabaseWebhookSecret = typeof data === 'string' ? data : null;
  return cachedDatabaseWebhookSecret;
};

const preferenceKeyForKind = (
  kind: NotificationKind
): keyof Omit<NotificationPreferenceRow, 'user_id'> | null => {
  if (kind === 'like') return 'likes';
  if (kind === 'comment') return 'comments';
  if (kind === 'mention') return 'mentions';
  if (kind === 'follow' || kind === 'follow_request') return 'follows';
  if (kind === 'message') return 'messages';
  if (kind === 'event') return 'events';
  if (kind === 'invite') return 'invites';
  return null;
};

const publicName = (profile?: ProfileRow | null) =>
  profile?.display_name?.trim() || profile?.username?.trim() || 'An athlete';

const routeScreenForEntity = (entityType?: string | null) => {
  if (entityType === 'post') return '/post/[id]';
  if (entityType === 'event') return '/event/[id]';
  if (entityType === 'profile') return '/profile/[id]';
  if (entityType === 'conversation' || entityType === 'chat_room') return '/messages/[id]';
  if (entityType === 'group') return '/group/[id]';
  if (entityType === 'page') return '/page/[id]';
  return '/notifications';
};

const scalarString = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const buildNotificationData = (notification: NotificationRecord): Record<string, string> => {
  const base: Record<string, string> = {
    notificationId: notification.id,
    type: notification.kind,
    kind: notification.kind,
    screen: routeScreenForEntity(notification.entity_type)
  };

  if (notification.aggregate_key) base.aggregateKey = notification.aggregate_key;
  if (notification.actor_id) base.actorId = notification.actor_id;
  if (notification.entity_type) base.entityType = notification.entity_type;
  if (notification.entity_id) base.entityId = notification.entity_id;

  if (notification.entity_type === 'post' && notification.entity_id) base.postId = notification.entity_id;
  if (notification.entity_type === 'event' && notification.entity_id) base.eventId = notification.entity_id;
  if (notification.entity_type === 'profile' && notification.entity_id) base.profileId = notification.entity_id;
  if (
    (notification.entity_type === 'conversation' || notification.entity_type === 'chat_room') &&
    notification.entity_id
  ) {
    base.conversationId = notification.entity_id;
  }
  if ((notification.entity_type === 'group' || notification.entity_type === 'page') && notification.entity_id) {
    base.communityId = notification.entity_id;
  }

  for (const [key, value] of Object.entries(notification.data ?? {})) {
    const scalar = scalarString(value);
    if (scalar !== undefined) {
      base[key] = scalar;
    }
  }

  return base;
};

const actionForKind = (kind: NotificationKind) => {
  if (kind === 'like') return 'liked your post';
  if (kind === 'comment') return 'commented on your post';
  if (kind === 'mention') return 'mentioned you in a post';
  if (kind === 'follow') return 'followed you';
  if (kind === 'follow_request') return 'requested to follow you';
  if (kind === 'event') return 'joined your event';
  if (kind === 'invite') return 'invited you';
  if (kind === 'message') return 'sent you a message';
  return 'sent you an update';
};

const formatPushTitle = (notification: NotificationRecord, actor?: ProfileRow | null) => {
  const actorCount = Math.max(notification.actor_count ?? 1, 1);
  const actorName = publicName(actor);

  if (actorCount <= 1) {
    return `${actorName} ${actionForKind(notification.kind)}`;
  }

  const others = actorCount - 1;
  return `${actorName} and ${others} other${others === 1 ? '' : 's'} ${actionForKind(notification.kind)}`;
};

const formatPushBody = (notification: NotificationRecord) => {
  if (notification.kind === 'like' && (notification.actor_count ?? 1) > 1) {
    return 'Your SPORTZ post is getting more activity.';
  }

  return notification.body?.trim() || 'Open SPORTZ to see what happened.';
};

const preferencesAllow = (
  notification: NotificationRecord,
  preferences?: NotificationPreferenceRow | null
) => {
  if (preferences?.push_enabled === false) return false;

  const preferenceKey = preferenceKeyForKind(notification.kind);
  if (!preferenceKey) return true;

  return preferences?.[preferenceKey] !== false;
};

const postExpoChunk = async (messages: MessageEnvelope[]) => {
  const response = await fetch(expoPushUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messages.map((item) => item.message))
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Expo push failed with ${response.status}: ${responseText.slice(0, 500)}`);
  }

  return JSON.parse(responseText) as ExpoPushResponse;
};

const sendExpoMessages = async (messages: MessageEnvelope[]) => {
  const ticketIds: string[] = [];
  const invalidTokenIds = new Set<string>();
  const errors: string[] = [];
  const batches = chunk(messages, maxExpoBatchSize);

  for (const batchGroup of chunk(batches, maxConcurrentExpoRequests)) {
    const results = await Promise.allSettled(batchGroup.map((batch) => postExpoChunk(batch)));

    results.forEach((result, resultIndex) => {
      const batch = batchGroup[resultIndex];
      if (!batch) return;

      if (result.status === 'rejected') {
        errors.push(result.reason instanceof Error ? result.reason.message : 'Expo push request failed.');
        return;
      }

      for (const apiError of result.value.errors ?? []) {
        errors.push(apiError.message ?? apiError.code ?? 'Expo returned an error.');
      }

      result.value.data?.forEach((ticket, ticketIndex) => {
        const envelope = batch[ticketIndex];
        if (!envelope) return;

        if (ticket.status === 'ok') {
          ticketIds.push(ticket.id);
          return;
        }

        errors.push(ticket.message);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokenIds.add(envelope.tokenId);
        }
      });
    });
  }

  return { ticketIds, invalidTokenIds: Array.from(invalidTokenIds), errors };
};

const markNotificationAttempt = async (
  notification: NotificationRecord,
  fields: {
    pushSentAt: string | null;
    pushError: string | null;
    pushTicketIds: string[];
  }
) => {
  await supabase
    .from('notifications')
    .update({
      push_sent_at: fields.pushSentAt,
      push_error: fields.pushError,
      push_attempts: (notification.push_attempts ?? 0) + 1,
      push_last_attempt_at: new Date().toISOString(),
      push_ticket_ids: fields.pushTicketIds
    })
    .eq('id', notification.id);
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

  const payload = (await request.json()) as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'notifications') {
    return Response.json({ ok: true, sent: 0, skipped: 0 });
  }

  const notification = payload.record;
  if (!notification || notification.push_sent_at) {
    return Response.json({ ok: true, sent: 0, skipped: 1 });
  }

  const [{ data: tokenRows, error: tokenError }, { data: profileRows }, { data: preferenceRow }] =
    await Promise.all([
      supabase
        .from('user_push_tokens')
        .select('id, user_id, expo_push_token')
        .eq('user_id', notification.user_id)
        .eq('is_active', true),
      notification.actor_id
        ? supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .eq('id', notification.actor_id)
            .limit(1)
        : Promise.resolve({ data: [] as ProfileRow[] }),
      supabase
        .from('notification_preferences')
        .select('user_id, push_enabled, likes, comments, mentions, follows, messages, events, invites')
        .eq('user_id', notification.user_id)
        .maybeSingle()
    ]);

  if (tokenError) {
    return Response.json({ ok: false, error: tokenError.message }, { status: 500 });
  }

  const preferences = preferenceRow as NotificationPreferenceRow | null;
  const activeTokens = ((tokenRows ?? []) as PushTokenRow[]).filter((row) =>
    isExpoPushToken(row.expo_push_token)
  );

  if (!preferencesAllow(notification, preferences) || activeTokens.length === 0) {
    await markNotificationAttempt(notification, {
      pushSentAt: new Date().toISOString(),
      pushError: null,
      pushTicketIds: []
    });

    return Response.json({
      ok: true,
      sent: 0,
      skipped: activeTokens.length === 0 ? 1 : activeTokens.length
    });
  }

  const actor = ((profileRows ?? []) as ProfileRow[])[0] ?? null;
  const title = formatPushTitle(notification, actor).slice(0, 120);
  const body = formatPushBody(notification).slice(0, 180);
  const data = buildNotificationData(notification);

  const messages: MessageEnvelope[] = activeTokens.map((tokenRow) => ({
    tokenId: tokenRow.id,
    token: tokenRow.expo_push_token,
    message: {
      to: tokenRow.expo_push_token,
      sound: 'default',
      title,
      body,
      data,
      channelId: 'default',
      priority: 'high',
      ttl: 60 * 60 * 24 * 14
    }
  }));

  const result = await sendExpoMessages(messages);
  const now = new Date().toISOString();

  if (result.invalidTokenIds.length) {
    await supabase
      .from('user_push_tokens')
      .update({
        is_active: false,
        revoked_at: now,
        updated_at: now
      })
      .in('id', result.invalidTokenIds);
  }

  const fatalError = result.ticketIds.length === 0 && result.errors.length > 0;
  await markNotificationAttempt(notification, {
    pushSentAt: fatalError ? null : now,
    pushError: result.errors.length ? result.errors.join('\n').slice(0, 2000) : null,
    pushTicketIds: result.ticketIds
  });

  return Response.json(
    {
      ok: !fatalError,
      sent: fatalError ? 0 : messages.length - result.invalidTokenIds.length,
      skipped: result.invalidTokenIds.length,
      tickets: result.ticketIds.length,
      error: result.errors[0] ?? null
    },
    { status: fatalError ? 502 : 200 }
  );
});
