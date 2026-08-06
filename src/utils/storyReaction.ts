/**
 * Story reaction messages are encoded as structured text so that the chat UI
 * can render them with a story thumbnail rather than as a bare emoji.
 *
 * Format: `story_reaction:{emoji}:{storyId}:{storyMediaUrl}`
 *
 * The storyMediaUrl segment may be empty if the story has no media.
 */

export interface StoryReactionPayload {
  emoji: string;
  storyId: string;
  storyMediaUrl: string | null;
}

const PREFIX = 'story_reaction:';

/**
 * Encodes a story reaction into the structured message body format.
 */
export function encodeStoryReaction(
  emoji: string,
  storyId: string,
  storyMediaUrl: string | null | undefined
): string {
  return `${PREFIX}${emoji}:${storyId}:${storyMediaUrl ?? ''}`;
}

/**
 * Returns `true` if the message body is a story reaction payload.
 */
export function isStoryReactionMessage(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(PREFIX));
}

/**
 * Parses a story reaction message body into its constituent parts.
 * Returns `null` if the body is not a valid story reaction payload.
 */
export function parseStoryReaction(body: string | null | undefined): StoryReactionPayload | null {
  if (!body?.startsWith(PREFIX)) return null;

  // Strip the prefix, then split on the first two colons only so that URLs
  // containing colons (e.g. https://…) are preserved intact.
  const rest = body.slice(PREFIX.length);
  const firstColon = rest.indexOf(':');
  if (firstColon === -1) return null;

  const emoji = rest.slice(0, firstColon);
  const afterEmoji = rest.slice(firstColon + 1);

  const secondColon = afterEmoji.indexOf(':');
  if (secondColon === -1) return null;

  const storyId = afterEmoji.slice(0, secondColon);
  const rawUrl = afterEmoji.slice(secondColon + 1);

  return {
    emoji,
    storyId,
    storyMediaUrl: rawUrl || null
  };
}
