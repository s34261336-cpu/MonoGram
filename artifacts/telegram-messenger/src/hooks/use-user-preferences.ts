import { useCallback, useEffect, useState } from 'react';

export type UserPreferences = {
  showUnreadBadge: boolean;
  showMessagePreviews: boolean;
  sendMessageOnEnter: boolean;
  showOnlineStatus: boolean;
  desktopNotifications: boolean;
  showNotificationText: boolean;
};

export type UserPreferenceKey = keyof UserPreferences;

const defaults: UserPreferences = {
  showUnreadBadge: true,
  showMessagePreviews: true,
  sendMessageOnEnter: true,
  showOnlineStatus: true,
  desktopNotifications: false,
  showNotificationText: true,
};

const eventName = 'monogram:user-preferences-changed';
const storageKey = (userId: string) => `monogram:user-preferences:${userId}`;

export function readUserPreferences(userId: string): UserPreferences {
  if (!userId || typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}') as Partial<UserPreferences>;
    return {
      showUnreadBadge: typeof parsed.showUnreadBadge === 'boolean' ? parsed.showUnreadBadge : defaults.showUnreadBadge,
      showMessagePreviews: typeof parsed.showMessagePreviews === 'boolean' ? parsed.showMessagePreviews : defaults.showMessagePreviews,
      sendMessageOnEnter: typeof parsed.sendMessageOnEnter === 'boolean' ? parsed.sendMessageOnEnter : defaults.sendMessageOnEnter,
      showOnlineStatus: typeof parsed.showOnlineStatus === 'boolean' ? parsed.showOnlineStatus : defaults.showOnlineStatus,
      desktopNotifications: typeof parsed.desktopNotifications === 'boolean' ? parsed.desktopNotifications : defaults.desktopNotifications,
      showNotificationText: typeof parsed.showNotificationText === 'boolean' ? parsed.showNotificationText : defaults.showNotificationText,
    };
  } catch {
    return defaults;
  }
}

export function useUserPreferences(userId: string) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => readUserPreferences(userId));

  useEffect(() => {
    setPreferences(readUserPreferences(userId));
    const refresh = (changedUserId?: string) => {
      if (!changedUserId || changedUserId === userId) setPreferences(readUserPreferences(userId));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(userId)) refresh(userId);
    };
    const onPreferencesChanged = (event: Event) => {
      const changedUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      refresh(changedUserId);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(eventName, onPreferencesChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(eventName, onPreferencesChanged);
    };
  }, [userId]);

  const updatePreference = useCallback((key: UserPreferenceKey, value: boolean) => {
    if (!userId || typeof window === 'undefined') return;
    const next = { ...readUserPreferences(userId), [key]: value };
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Keep the current session usable if browser storage is unavailable.
    }
    setPreferences(next);
    window.dispatchEvent(new CustomEvent(eventName, { detail: { userId } }));
  }, [userId]);

  return { preferences, updatePreference };
}
