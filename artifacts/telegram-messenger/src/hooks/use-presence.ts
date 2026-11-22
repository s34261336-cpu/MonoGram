import { useEffect } from 'react';
import { apiRequest } from '@/lib/api';

export function usePresence(userId?: string | null, enabled = true): void {
  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = () => {
      void apiRequest('/api/presence/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ visible: enabled }),
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(heartbeatTimer);
  }, [enabled, userId]);
}
