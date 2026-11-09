const SESSION_KEY = 'monogram.demo.session';

export type DemoUser = {
  id: string;
  phone: string;
};

export type StoredDemoSession = {
  sessionToken: string;
  user: DemoUser;
};

export function readStoredDemoSession(): StoredDemoSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StoredDemoSession>;
    if (
      typeof parsed.sessionToken !== 'string' ||
      typeof parsed.user?.id !== 'string' ||
      typeof parsed.user?.phone !== 'string'
    ) return null;
    return { sessionToken: parsed.sessionToken, user: parsed.user };
  } catch {
    return null;
  }
}

export function storeDemoSession(session: StoredDemoSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearDemoSession() {
  localStorage.removeItem(SESSION_KEY);
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authenticated) {
    const session = readStoredDemoSession();
    if (session) headers.set('Authorization', `Bearer ${session.sessionToken}`);
  }

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : response.status === 401 ? 'Сессия завершена. Войдите снова.' : 'Не удалось выполнить запрос.';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export async function apiBlobRequest(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers = new Headers();
  const session = readStoredDemoSession();
  if (session) headers.set('Authorization', `Bearer ${session.sessionToken}`);

  const response = await fetch(path, { headers, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof payload?.error === 'string'
      ? payload.error
      : response.status === 401 ? 'Сессия завершена. Войдите снова.' : 'Не удалось загрузить изображение.';
    throw new ApiError(message, response.status);
  }
  return response.blob();
}
