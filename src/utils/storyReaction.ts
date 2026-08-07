/**
 * Story interaction messages are encoded as structured text so the chat UI
 * can render them with a story thumbnail rather than plain text.
 *
 * A pipe `|` is used as the field separator because it never appears in UUIDs,
 * emoji, or Supabase storage URLs, avoiding the colon-collision that broke
 * the previous encoding when URLs like `https://…` were embedded.
 *
 * ── Reaction format ──────────────────────────────────────────────────────────
 *   story_reaction|{emoji}|{storyId}|{storyMediaUrl}
 *
 * ── Reply format ─────────────────────────────────────────────────────────────
 *   story_reply|{storyId}|{storyMediaUrl}|{replyText}
 *
 * storyMediaUrl may be empty string when the story has no media.
 * replyText is last so arbitrary user text is captured in its entirety.
 */

const SEP = '|';

// ─── Reaction ────────────────────────────────────────────────────────────────

export interface StoryReactionPayload {
  emoji: string;
  storyId: string;
  storyMediaUrl: string | null;
}

const REACTION_PREFIX = 'story_reaction|';

export function encodeStoryReaction(
  emoji: string,
  storyId: string,
  storyMediaUrl: string | null | undefined
): string {
  return `${REACTION_PREFIX}${emoji}${SEP}${storyId}${SEP}${storyMediaUrl ?? ''}`;
}

export function isStoryReactionMessage(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(REACTION_PREFIX));
}

export function parseStoryReaction(body: string | null | undefined): StoryReactionPayload | null {
  if (!body?.startsWith(REACTION_PREFIX)) return null;
  // e.g. "story_reaction|🔥|uuid|https://..."
  const parts = body.slice(REACTION_PREFIX.length).split(SEP);
  if (parts.length < 3) return null;
  const [emoji, storyId, ...urlParts] = parts;
  if (!emoji || !storyId) return null;
  const rawUrl = urlParts.join(SEP); // rejoin in case URL ever contains |
  return { emoji, storyId, storyMediaUrl: rawUrl || null };
}

// ─── Reply ───────────────────────────────────────────────────────────────────

export interface StoryReplyPayload {
  storyId: string;
  storyMediaUrl: string | null;
  replyText: string;
}

const REPLY_PREFIX = 'story_reply|';

export function encodeStoryReply(
  replyText: string,
  storyId: string,
  storyMediaUrl: string | null | undefined
): string {
  return `${REPLY_PREFIX}${storyId}${SEP}${storyMediaUrl ?? ''}${SEP}${replyText}`;
}

export function isStoryReplyMessage(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(REPLY_PREFIX));
}

export function parseStoryReply(body: string | null | undefined): StoryReplyPayload | null {
  if (!body?.startsWith(REPLY_PREFIX)) return null;
  // e.g. "story_reply|uuid|https://...|Nice shot!"
  // Split into exactly 3 parts: storyId, storyMediaUrl, replyText
  // replyText may itself contain | so we cap at 3 splits.
  const rest = body.slice(REPLY_PREFIX.length);
  const first = rest.indexOf(SEP);
  if (first === -1) return null;
  const storyId = rest.slice(0, first);

  const afterStoryId = rest.slice(first + 1);
  const second = afterStoryId.indexOf(SEP);
  if (second === -1) return null;
  const rawUrl = afterStoryId.slice(0, second);
  const replyText = afterStoryId.slice(second + 1); // everything after; preserves | in text

  if (!storyId || !replyText) return null;
  return { storyId, storyMediaUrl: rawUrl || null, replyText };
}
