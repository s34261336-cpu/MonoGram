import { useCallback, useEffect, useState } from 'react';
import type { Conversation } from '@/lib/messenger';

type ReadMarkers = Record<string, string>;

const readStateEvent = 'monogram:chat-read-state';

function storageKey(userId: string) {
  return `monogram:chat-read:${userId}`;
}

function readStoredMarkers(userId: string): ReadMarkers {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

export function useChatReadState(userId: string) {
  const [readAtByConversation, setReadAtByConversation] = useState<ReadMarkers>(() => readStoredMarkers(userId));

  useEffect(() => {
    const sync = () => setReadAtByConversation(readStoredMarkers(userId));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(readStateEvent, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(readStateEvent, sync);
    };
  }, [userId]);

  const markRead = useCallback((conversationId: string) => {
    if (!userId || !conversationId) return;
    const next = {
      ...readStoredMarkers(userId),
      [conversationId]: new Date().toISOString(),
    };
    setReadAtByConversation(next);
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Keep the current view usable when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(readStateEvent));
  }, [userId]);

  const unreadCountFor = useCallback((conversation: Conversation) => {
    if (typeof conversation.unreadCount === 'number' && Number.isFinite(conversation.unreadCount)) {
      return Math.max(0, conversation.unreadCount);
    }
    const message = conversation.lastMessage;
    if (!message || message.authorId === userId || message.isRead === true || message.readAt) return 0;
    const messageTime = Date.parse(message.createdAt);
    const readTime = Date.parse(readAtByConversation[conversation.id] || '');
    return Number.isFinite(messageTime) && messageTime > (Number.isFinite(readTime) ? readTime : 0) ? 1 : 0;
  }, [readAtByConversation, userId]);

  return { markRead, unreadCountFor };
}
