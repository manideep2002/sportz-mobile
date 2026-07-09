import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  push_attempts: number;
};

type PushTokenRow = {
  user_id: string;
  token: string;
};

type NotificationPreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  events: boolean;
  invites: boolean;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const preferenceKeyForKind = (kind: string): keyof Omit<NotificationPreferenceRow, 'user_id'> | null => {
  if (kind === 'like') return 'likes';
  if (kind === 'comment') return 'comments';
  if (kind === 'follow' || kind === 'follow_request') return 'follows';
  if (kind === 'message') return 'messages';
  if (kind === 'event') return 'events';
  if (kind === 'invite') return 'invites';
  return null;
};

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

Deno.serve(async () => {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, user_id, actor_id, kind, title, body, entity_type, entity_id, push_attempts')
    .is('push_sent_at', null)
    .lt('push_attempts', 5)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pending = (notifications ?? []) as NotificationRow[];
  if (!pending.length) {
    return Response.json({ ok: true, sent: 0, skipped: 0 });
  }

  const userIds = Array.from(new Set(pending.map((notification) => notification.user_id)));
  const [{ data: tokenRows }, { data: preferenceRows }, { data: muteRows }] = await Promise.all([
    supabase.from('push_tokens').select('user_id, token').in('user_id', userIds),
    supabase.from('notification_preferences').select('*').in('user_id', userIds),
    supabase
      .from('chat_participants')
      .select('user_id, room_id, muted_until')
      .in('user_id', userIds)
      .not('muted_until', 'is', null)
  ]);

  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as PushTokenRow[]) {
    const tokens = tokensByUser.get(row.user_id) ?? [];
    tokens.push(row.token);
    tokensByUser.set(row.user_id, tokens);
  }

  const preferencesByUser = new Map<string, NotificationPreferenceRow>();
  for (const row of (preferenceRows ?? []) as NotificationPreferenceRow[]) {
    preferencesByUser.set(row.user_id, row);
  }

  const mutedRoomKeys = new Set<string>();
  for (const row of (muteRows ?? []) as Array<{ user_id: string; room_id: string; muted_until: string | null }>) {
    if (!row.muted_until || new Date(row.muted_until).getTime() > Date.now()) {
      mutedRoomKeys.add(`${row.user_id}:${row.room_id}`);
    }
  }

  const expoMessages: Array<{ to: string; title: string; body: string; data: Record<string, string> }> = [];
  const deliveredNotificationIds = new Set<string>();
  const skippedNotificationIds = new Set<string>();

  for (const notification of pending) {
    const prefKey = preferenceKeyForKind(notification.kind);
    const preferences = preferencesByUser.get(notification.user_id);
    const pushEnabled = preferences?.push_enabled !== false;
    const preferenceAllows = !prefKey || preferences?.[prefKey] !== false;
    const muted =
      notification.kind === 'message' &&
      (notification.entity_type === 'conversation' || notification.entity_type === 'chat_room') &&
      notification.entity_id &&
      mutedRoomKeys.has(`${notification.user_id}:${notification.entity_id}`);
    const tokens = tokensByUser.get(notification.user_id) ?? [];

    if (!pushEnabled || !preferenceAllows || muted || !tokens.length) {
      skippedNotificationIds.add(notification.id);
      continue;
    }

    for (const token of tokens) {
      expoMessages.push({
        to: token,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          kind: notification.kind,
          entityType: notification.entity_type ?? '',
          entityId: notification.entity_id ?? ''
        }
      });
    }
    deliveredNotificationIds.add(notification.id);
  }

  let sendError: string | null = null;
  for (const messages of chunk(expoMessages, 100)) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(messages)
    });

    if (!response.ok) {
      sendError = await response.text();
      break;
    }
  }

  const now = new Date().toISOString();
  const updatePromises = pending.map((notification) => {
    const wasDelivered = deliveredNotificationIds.has(notification.id) && !sendError;
    const wasSkipped = skippedNotificationIds.has(notification.id);
    return supabase
      .from('notifications')
      .update({
        push_sent_at: wasDelivered || wasSkipped ? now : null,
        push_error: sendError,
        push_attempts: notification.push_attempts + 1
      })
      .eq('id', notification.id);
  });
  await Promise.all(updatePromises);

  return Response.json({
    ok: !sendError,
    sent: sendError ? 0 : deliveredNotificationIds.size,
    skipped: skippedNotificationIds.size,
    error: sendError
  }, { status: sendError ? 502 : 200 });
});
