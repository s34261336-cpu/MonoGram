import { Router, type IRouter } from 'express';
import {
  consumeDemoCode,
  createDemoSession,
  issueDemoCode,
  normalizeRuPhone,
  requireDemoSession,
} from '../lib/demo-session';
import { supabaseAdmin } from '../lib/supabase-admin';

const router: IRouter = Router();

router.post('/auth/demo/request-code', (req, res, next) => {
  try {
    const phone = normalizeRuPhone(req.body?.phone);
    const demoCode = issueDemoCode(phone);
    res.json({ demoCode, expiresInSeconds: 300 });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/demo/verify-code', async (req, res, next) => {
  try {
    const phone = normalizeRuPhone(req.body?.phone);
    consumeDemoCode(phone, req.body?.code);
    const { data, error } = await supabaseAdmin.rpc('get_or_create_demo_user', {
      p_phone: phone,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Не удалось создать профиль Mono.');
    const user = { id: data, phone };
    res.json({ user, sessionToken: createDemoSession(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/session', requireDemoSession, (req, res) => {
  res.json(req.demoIdentity);
});

export default router;
