import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

export type PresenceState = {
  connected: boolean;
  onlineCount: number;
  onlineUserIds: string[];
};

export function usePresence(userId?: string | null, enabled = true): PresenceState {
  const [state, setState] = useState<PresenceState>({
    connected: false,
    onlineCount: 0,
    onlineUserIds: [],
  });

  useEffect(() => {
    if (!userId) {
      setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncPresence = async () => {
      try {
        await apiRequest('/api/presence/heartbeat', {
          method: 'POST',
          body: JSON.stringify({ visible: enabled }),
        });
        const next = await apiRequest<PresenceState>('/api/presence');
        if (alive) setState(next);
      } catch {
        if (alive) setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
      }
    };

    void syncPresence();
    timer = setInterval(() => { void syncPresence(); }, 15_000);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [enabled, userId]);

  return state;
}
