import { Router, type IRouter } from 'express';
import { requireDemoSession } from '../lib/demo-session';

const router: IRouter = Router();
const onlineUsers = new Map<string, number>();
const ONLINE_TTL_MS = 45_000;

function getOnlineIds() {
  const now = Date.now();
  for (const [id, lastSeen] of onlineUsers) {
    if (now - lastSeen > ONLINE_TTL_MS) onlineUsers.delete(id);
  }
  return [...onlineUsers.keys()];
}

router.use(requireDemoSession);

router.post('/presence/heartbeat', (req, res) => {
  if (req.demoIdentity) onlineUsers.set(req.demoIdentity.id, Date.now());
  res.json({ ok: true });
});

router.get('/presence', (req, res) => {
  if (req.demoIdentity) onlineUsers.set(req.demoIdentity.id, Date.now());
  const onlineUserIds = getOnlineIds();
  res.json({ connected: true, onlineCount: onlineUserIds.length, onlineUserIds });
});

export default router;
