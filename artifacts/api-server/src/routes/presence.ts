import { Router, type IRouter } from 'express';
import { requireDemoSession } from '../lib/demo-session';
import { supabaseAdmin } from '../lib/supabase-admin';

const router: IRouter = Router();
const ONLINE_TTL_MS = 60_000;

router.use(requireDemoSession);

router.post('/presence/heartbeat', async (req, res, next) => {
  try {
    const userId = req.demoIdentity?.id;
    if (!userId) {
      res.status(401).json({ error: 'Сессия завершена. Войдите снова.' });
      return;
    }
    const lastSeen = req.body?.visible === false ? null : new Date().toISOString();
    const { error } = await supabaseAdmin.from('profiles')
      .update({ last_seen: lastSeen })
      .eq('id', userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/presence', async (_req, res, next) => {
  try {
    const threshold = new Date(Date.now() - ONLINE_TTL_MS).toISOString();
    const { data, error } = await supabaseAdmin.from('profiles')
      .select('id')
      .gt('last_seen', threshold);
    if (error) throw error;
    const onlineUserIds = (data ?? []).map(profile => profile.id);
    res.json({ connected: true, onlineCount: onlineUserIds.length, onlineUserIds });
  } catch (error) {
    next(error);
  }
});

export default router;
