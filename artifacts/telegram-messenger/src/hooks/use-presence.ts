import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export type PresenceState = {
  connected: boolean;
  onlineCount: number;
  onlineUserIds: string[];
};

export function usePresence(accessToken?: string | null): PresenceState {
  const [state, setState] = useState<PresenceState>({
    connected: false,
    onlineCount: 0,
    onlineUserIds: [],
  });

  useEffect(() => {
    if (!accessToken) {
      setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
      return;
    }

    const socket = io(window.location.origin, {
      path: '/api/socket.io',
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 6000,
    });

    socket.on('connect', () => {
      setState((current) => ({ ...current, connected: true }));
    });
    socket.on('disconnect', () => {
      setState((current) => ({ ...current, connected: false }));
    });
    socket.on('connect_error', () => {
      setState((current) => ({ ...current, connected: false }));
    });
    socket.on('presence:update', (payload: { onlineCount?: number; onlineUserIds?: string[] }) => {
      setState((current) => ({
        ...current,
        onlineCount: Number.isFinite(payload.onlineCount) ? Number(payload.onlineCount) : current.onlineCount,
        onlineUserIds: Array.isArray(payload.onlineUserIds)
          ? payload.onlineUserIds.filter((id): id is string => typeof id === 'string')
          : current.onlineUserIds,
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [accessToken]);

  return state;
}
