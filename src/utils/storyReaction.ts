/**
 * Story interaction messages are encoded as structured text so the chat UI
 * can render them with a story thumbnail rather than plain text.
 *
 * ── Reaction format ──────────────────────────────────────────────────────────
 *   story_reaction:{emoji}:{storyId}:{storyMediaUrl}
 *
 * ── Reply format ─────────────────────────────────────────────────────────────
 *   story_reply:{storyId}:{storyMediaUrl}:{replyText}
 *
 * storyMediaUrl may be empty. replyText is last so arbitrary text (including
 * colons) is preserved intact after the third colon.
 */

// ─── Reaction ────────────────────────────────────────────────────────────────

export interface StoryReactionPayload {
  emoji: string;
  storyId: string;
  storyMediaUrl: string | null;
}

const REACTION_PREFIX = 'story_reaction:';

export function encodeStoryReaction(
  emoji: string,
  storyId: string,
  storyMediaUrl: string | null | undefined
): string {
  return `${REACTION_PREFIX}${emoji}:${storyId}:${storyMediaUrl ?? ''}`;
}

export function isStoryReactionMessage(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(REACTION_PREFIX));
}

export function parseStoryReaction(body: string | null | undefined): StoryReactionPayload | null {
  if (!body?.startsWith(REACTION_PREFIX)) return null;

  const rest = body.slice(REACTION_PREFIX.length);
  const firstColon = rest.indexOf(':');
  if (firstColon === -1) return null;

  const emoji = rest.slice(0, firstColon);
  const afterEmoji = rest.slice(firstColon + 1);
  const secondColon = afterEmoji.indexOf(':');
  if (secondColon === -1) return null;

  const storyId = afterEmoji.slice(0, secondColon);
  const rawUrl = afterEmoji.slice(secondColon + 1);

  return { emoji, storyId, storyMediaUrl: rawUrl || null };
}

// ─── Reply ───────────────────────────────────────────────────────────────────

export interface StoryReplyPayload {
  storyId: string;
  storyMediaUrl: string | null;
  replyText: string;
}

const REPLY_PREFIX = 'story_reply:';

export function encodeStoryReply(
  replyText: string,
  storyId: string,
  storyMediaUrl: string | null | undefined
): string {
  return `${REPLY_PREFIX}${storyId}:${storyMediaUrl ?? ''}:${replyText}`;
}

export function isStoryReplyMessage(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(REPLY_PREFIX));
}

export function parseStoryReply(body: string | null | undefined): StoryReplyPayload | null {
  if (!body?.startsWith(REPLY_PREFIX)) return null;

  const rest = body.slice(REPLY_PREFIX.length);

  // First segment: storyId (up to first colon)
  const firstColon = rest.indexOf(':');
  if (firstColon === -1) return null;
  const storyId = rest.slice(0, firstColon);

  const afterStoryId = rest.slice(firstColon + 1);

  // Second segment: storyMediaUrl (up to second colon)
  const secondColon = afterStoryId.indexOf(':');
  if (secondColon === -1) return null;
  const rawUrl = afterStoryId.slice(0, secondColon);

  // Remainder: replyText (everything after the second colon, colons included)
  const replyText = afterStoryId.slice(secondColon + 1);

  return { storyId, storyMediaUrl: rawUrl || null, replyText };
}
