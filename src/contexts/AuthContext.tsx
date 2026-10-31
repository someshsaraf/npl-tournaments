import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACCESS_REVOKED_EVENT, reconnectRealtime } from '../lib/realtime';
import { fetchSession, logout as logoutRequest } from '../utils/authClient';

type AuthContextValue = {
  /** This device may view the site (community code entered, or staff). */
  access: boolean;
  /** Random id of this device's community pass — used to delete its own uploads. */
  deviceId: string | null;
  /** Staff pass (admin code). */
  admin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchSession();
      setDeviceId(session.access?.deviceId ?? null);
      setAdmin(!!session.admin);
    } catch {
      setDeviceId(null);
      setAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The community code was changed while this page was open: re-check the
  // pass, so the access gate sends this screen to the code page.
  useEffect(() => {
    const onRevoked = () => void refresh();
    window.addEventListener(ACCESS_REVOKED_EVENT, onRevoked);
    return () => window.removeEventListener(ACCESS_REVOKED_EVENT, onRevoked);
  }, [refresh]);

  // The live-data socket carries the pass it was opened with; reopen it
  // whenever the device is unlocked/locked so reads and writes are authorised.
  const identity = loading ? null : `${deviceId ?? ''}|${admin}`;
  const lastIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (identity === null) return;
    if (lastIdentity.current !== null && lastIdentity.current !== identity) reconnectRealtime();
    lastIdentity.current = identity;
  }, [identity]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setDeviceId(null);
    setAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ access: admin || !!deviceId, deviceId, admin, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
