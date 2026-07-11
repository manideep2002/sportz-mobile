import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ChatMessageType = 'text' | 'image' | 'video';

type ChatMessageRecord = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: ChatMessageType;
  body: string | null;
  media_url: string | null;
  created_at: string;
};

type WebhookPayload = {
  type: 'INSERT';
  schema: 'public';
  table: 'chat_messages';
  record: ChatMessageRecord;
  old_record: null;
};

type ChatParticipantRow = {
  user_id: string;
  muted_until: string | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  is_online?: boolean | null;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, string>;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('CHAT_WEBHOOK_SECRET');

if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CHAT_WEBHOOK_SECRET are required.');
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

const notificationBody = (message: ChatMessageRecord) => {
  if (message.message_type === 'image') return 'Sent a photo';
  if (message.message_type === 'video') return 'Sent a video';
  return (message.body ?? 'New message').slice(0, 180);
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  if (request.headers.get('x-supabase-webhook-secret') !== webhookSecret) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.table !== 'chat_messages') {
    return Response.json({ ok: true, sent: 0, skipped: 0 });
  }

  const message = payload.record;

  const { data: participants, error: participantsError } = await supabase
    .from('chat_participants')
    .select('user_id, muted_until')
    .eq('room_id', message.room_id)
    .eq('is_active', true)
    .neq('user_id', message.sender_id);

  if (participantsError) {
    return Response.json({ ok: false, error: participantsError.message }, { status: 500 });
  }

  const now = Date.now();
  const candidateParticipants = ((participants ?? []) as ChatParticipantRow[]).filter(
    (participant) => !participant.muted_until || new Date(participant.muted_until).getTime() <= now
  );
  const candidateUserIds = candidateParticipants.map((participant) => participant.user_id);

  if (!candidateUserIds.length) {
    return Response.json({ ok: true, sent: 0, skipped: 0 });
  }

  const [{ data: profileRows }, { data: senderRows }, { data: tokenRows, error: tokenError }] =
    await Promise.all([
      supabase.from('profiles').select('id, display_name, username, is_online').in('id', candidateUserIds),
      supabase.from('profiles').select('id, display_name, username').eq('id', message.sender_id).limit(1),
      supabase
        .from('user_push_tokens')
        .select('user_id, expo_push_token')
        .in('user_id', candidateUserIds)
        .eq('is_active', true)
    ]);

  if (tokenError) {
    return Response.json({ ok: false, error: tokenError.message }, { status: 500 });
  }

  const profilesByUser = new Map<string, ProfileRow>();
  for (const profile of (profileRows ?? []) as ProfileRow[]) {
    profilesByUser.set(profile.id, profile);
  }

  const offlineUserIds = candidateUserIds.filter((userId) => profilesByUser.get(userId)?.is_online !== true);
  const offlineUserSet = new Set(offlineUserIds);
  const sender = ((senderRows ?? []) as ProfileRow[])[0];
  const senderName = sender?.display_name ?? sender?.username ?? 'New message';

  const expoMessages: ExpoPushMessage[] = [];
  for (const tokenRow of (tokenRows ?? []) as PushTokenRow[]) {
    if (!offlineUserSet.has(tokenRow.user_id)) continue;
    expoMessages.push({
      to: tokenRow.expo_push_token,
      sound: 'default',
      title: senderName,
      body: notificationBody(message),
      data: {
        kind: 'chat_message',
        type: 'message',
        screen: '/messages/[id]',
        entityType: 'conversation',
        entityId: message.room_id,
        conversationId: message.room_id,
        roomId: message.room_id,
        messageId: message.id,
        senderId: message.sender_id
      }
    });
  }

  let sendError: string | null = null;
  for (const messages of chunk(expoMessages, 100)) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages)
    });

    if (!response.ok) {
      sendError = await response.text();
      break;
    }
  }

  return Response.json(
    {
      ok: !sendError,
      sent: sendError ? 0 : expoMessages.length,
      skipped: candidateUserIds.length - offlineUserIds.length,
      error: sendError
    },
    { status: sendError ? 502 : 200 }
  );
});
