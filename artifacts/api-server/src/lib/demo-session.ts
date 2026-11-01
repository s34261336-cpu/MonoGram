import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const CODE_TTL_MS = 5 * 60 * 1000;
const CODE_COOLDOWN_MS = 30 * 1000;
const MAX_CODE_ATTEMPTS = 5;

type DemoClaims = {
  sub: string;
  phone: string;
  exp: number;
};

type DemoCode = {
  digest: string;
  expiresAt: number;
  attempts: number;
  requestedAt: number;
};

export type DemoIdentity = {
  id: string;
  phone: string;
};

declare global {
  namespace Express {
    interface Request {
      demoIdentity?: DemoIdentity;
    }
  }
}

const codesByPhone = new Map<string, DemoCode>();

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required.');
  return secret;
}

function codeDigest(phone: string, code: string) {
  return createHmac('sha256', sessionSecret()).update(`${phone}:${code}`).digest('hex');
}

export function normalizeRuPhone(value: unknown): string {
  const input = typeof value === 'string' ? value : '';
  let digits = input.replace(/\D/g, '');
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.startsWith('8') && digits.length === 11) digits = `7${digits.slice(1)}`;
  if (!/^7\d{10}$/.test(digits)) {
    const error = new Error('Введите корректный номер телефона: +7 и 10 цифр.');
    Object.assign(error, { status: 400 });
    throw error;
  }
  return `+${digits}`;
}

export function issueDemoCode(phone: string) {
  const now = Date.now();
  const existing = codesByPhone.get(phone);
  if (existing && now < existing.requestedAt + CODE_COOLDOWN_MS) {
    const error = new Error('Код уже запрошен. Подождите полминуты и попробуйте снова.');
    Object.assign(error, { status: 429 });
    throw error;
  }

  for (const [candidate, entry] of codesByPhone) {
    if (entry.expiresAt <= now) codesByPhone.delete(candidate);
  }

  const code = randomInt(0, 100_000).toString().padStart(5, '0');
  codesByPhone.set(phone, {
    digest: codeDigest(phone, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    requestedAt: now,
  });
  return code;
}

export function consumeDemoCode(phone: string, submittedCode: unknown) {
  const entry = codesByPhone.get(phone);
  const code = typeof submittedCode === 'string' ? submittedCode : '';
  if (!entry || entry.expiresAt <= Date.now()) {
    codesByPhone.delete(phone);
    const error = new Error('Код истёк. Запросите новый.');
    Object.assign(error, { status: 400 });
    throw error;
  }

  const expected = Buffer.from(entry.digest, 'hex');
  const actual = Buffer.from(codeDigest(phone, code), 'hex');
  const validLength = code.length === 5 && /^\d{5}$/.test(code);
  const isValid = validLength && expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!isValid) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_CODE_ATTEMPTS) codesByPhone.delete(phone);
    const error = new Error(entry.attempts >= MAX_CODE_ATTEMPTS
      ? 'Слишком много неверных попыток. Запросите новый код.'
      : 'Неверный код. Проверьте пять цифр и попробуйте снова.');
    Object.assign(error, { status: 400 });
    throw error;
  }
  codesByPhone.delete(phone);
}

export function createDemoSession(identity: DemoIdentity) {
  const claims: DemoClaims = {
    sub: identity.id,
    phone: identity.phone,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyDemoSession(token: unknown): DemoIdentity | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra !== undefined) return null;
  try {
    const expected = createHmac('sha256', sessionSecret()).update(encoded).digest();
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<DemoClaims>;
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.phone !== 'string' ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return { id: claims.sub, phone: claims.phone };
  } catch {
    return null;
  }
}

export function requireDemoSession(req: Request, res: Response, next: NextFunction) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const identity = verifyDemoSession(token);
  if (!identity) {
    res.status(401).json({ error: 'Сессия завершена. Войдите снова.' });
    return;
  }
  req.demoIdentity = identity;
  next();
}
