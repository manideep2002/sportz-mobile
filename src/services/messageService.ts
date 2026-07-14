import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { threadFirstChatService } from '@/services/threadFirstChatService';
import type { Conversation, Message } from '@/types/domain';
import type { ThreadChatMessage } from '@/types/threadFirstChat';

const appError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return new Error(message);
  }
  return new Error(fallback);
};

/**
 * Compatibility facade for the app's existing messaging call sites.
 *
 * The active chat backend is now the thread-first schema:
 * `chat_rooms`, `chat_participants`, and `chat_messages`.
 */
export const messageService = {
  async getConversation(roomId: string): Promise<Conversation | null> {
    assertSupabaseConfigured();
    return threadFirstChatService.getConversation(roomId);
  },

  async listConversations(readRoomIds: Set<string> = new Set()): Promise<Conversation[]> {
    assertSupabaseConfigured();
    return threadFirstChatService.listConversations(readRoomIds);
  },

  async listMessages(roomId: string): Promise<Message[]> {
    assertSupabaseConfigured();
    return threadFirstChatService.listDomainMessages(roomId);
  },

  async markConversationRead(roomId: string): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.markRoomRead(roomId);
  },

  async sendMessage(roomId: string, body: string): Promise<Message> {
    assertSupabaseConfigured();

    try {
      return await threadFirstChatService.sendTextMessage(roomId, body);
    } catch (error) {
      throw appError(error, 'Could not send your message.');
    }
  },

  async clearConversation(roomId: string): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.markRoomRead(roomId);
  },

  async setConversationMuted(roomId: string, muted: boolean): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.setRoomMuted(roomId, muted);
  },

  async setConversationPinned(roomId: string, pinned: boolean): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.setRoomPinned(roomId, pinned);
  },

  async createDirectConversation(otherUserId: string): Promise<string> {
    assertSupabaseConfigured();

    try {
      return await threadFirstChatService.createDirectRoom(otherUserId);
    } catch (error) {
      throw appError(error, 'Could not start a chat.');
    }
  },

  async createGroupConversation(title: string, memberIds: string[]): Promise<string> {
    assertSupabaseConfigured();

    try {
      return await threadFirstChatService.createGroupRoom(title, memberIds);
    } catch (error) {
      throw appError(error, 'Could not create the group chat.');
    }
  },

  async addGroupMembers(roomId: string, memberIds: string[]): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.addRoomMembers(roomId, memberIds);
  },

  async removeGroupMember(roomId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.removeRoomMember(roomId, userId);
  },

  async leaveConversation(roomId: string): Promise<void> {
    assertSupabaseConfigured();
    await threadFirstChatService.leaveRoom(roomId);
  },

  async updateMessage(messageId: string, body: string): Promise<ThreadChatMessage> {
    assertSupabaseConfigured();
    try {
      return await threadFirstChatService.updateMessage(messageId, body);
    } catch (error) {
      throw appError(error, 'Could not update your message.');
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    assertSupabaseConfigured();
    try {
      await threadFirstChatService.deleteMessage(messageId);
    } catch (error) {
      throw appError(error, 'Could not delete your message.');
    }
  }
};
