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

function authError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function findDemoUserId(phone: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('demo_users')
    .select('user_id')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.user_id === 'string' ? data.user_id : null;
}

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
    const userId = await findDemoUserId(phone);
    if (!userId) {
      throw authError('Аккаунт не найден. Создайте аккаунт, чтобы зарегистрироваться.', 404);
    }
    const user = { id: userId, phone };
    res.json({ user, sessionToken: createDemoSession(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/demo/register', async (req, res, next) => {
  try {
    const phone = normalizeRuPhone(req.body?.phone);
    consumeDemoCode(phone, req.body?.code);

    if (await findDemoUserId(phone)) {
      throw authError('Этот номер уже зарегистрирован. Войдите в аккаунт.', 409);
    }

    const { data, error } = await supabaseAdmin.rpc('get_or_create_demo_user', {
      p_phone: phone,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Не удалось создать профиль Mono.');
    const user = { id: data, phone };
    res.status(201).json({ user, sessionToken: createDemoSession(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/session', requireDemoSession, (req, res) => {
  res.json(req.demoIdentity);
});

export default router;
