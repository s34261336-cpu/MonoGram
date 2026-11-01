import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type PresenceState = {
  connected: boolean;
  onlineCount: number;
  onlineUserIds: string[];
};

export function usePresence(userId?: string | null): PresenceState {
  const [state, setState] = useState<PresenceState>({
    connected: false,
    onlineCount: 0,
    onlineUserIds: [],
  });

  useEffect(() => {
    if (!userId || !supabase) {
      setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
      return;
    }

    const client = supabase;
    const channel = client.channel('monogram-presence', {
      config: { presence: { key: userId } },
    });

    const syncPresence = () => {
      const onlineUserIds = Object.keys(channel.presenceState());
      setState({
        connected: true,
        onlineCount: onlineUserIds.length,
        onlineUserIds,
      });
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userId,
              onlineAt: new Date().toISOString(),
            });
            syncPresence();
          } catch {
            setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState({ connected: false, onlineCount: 0, onlineUserIds: [] });
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [userId]);

  return state;
}
