import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  apiRequest,
  clearDemoSession,
  readStoredDemoSession,
  storeDemoSession,
  type DemoUser,
} from '@/lib/api';

type AuthContextValue = {
  user: DemoUser | null;
  loading: boolean;
  requestDemoCode: (phone: string) => Promise<string>;
  verifyDemoCode: (phone: string, code: string) => Promise<void>;
  registerDemoAccount: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = readStoredDemoSession();
    if (!saved) {
      setLoading(false);
      return;
    }

    let alive = true;
    apiRequest<DemoUser>('/api/auth/session')
      .then((restoredUser) => {
        if (alive) setUser(restoredUser);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) {
          clearDemoSession();
          setUser(null);
        } else {
          setUser(saved.user);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async requestDemoCode(phone) {
      const result = await apiRequest<{ demoCode: string }>('/api/auth/demo/request-code', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }, false);
      return result.demoCode;
    },
    async verifyDemoCode(phone, code) {
      const result = await apiRequest<{ user: DemoUser; sessionToken: string }>('/api/auth/demo/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }, false);
      storeDemoSession({ sessionToken: result.sessionToken, user: result.user });
      setUser(result.user);
    },
    async registerDemoAccount(phone, code) {
      const result = await apiRequest<{ user: DemoUser; sessionToken: string }>('/api/auth/demo/register', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }, false);
      storeDemoSession({ sessionToken: result.sessionToken, user: result.user });
      setUser(result.user);
    },
    async signOut() {
      clearDemoSession();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
