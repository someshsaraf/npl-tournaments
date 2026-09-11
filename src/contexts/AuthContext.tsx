import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchSession, logout as logoutRequest, type AdminUser, type AuthUser } from '../utils/authClient';

type AuthContextValue = {
  user: AuthUser | null;
  admin: AdminUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchSession();
      setUser(session.user);
      setAdmin(session.admin);
    } catch {
      setUser(null);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, admin, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
