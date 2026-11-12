import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Me } from '@klyr/contracts';
import { hasToken, klyr, onTokenChange } from './klyr';

type Status = 'loading' | 'signedOut' | 'mfa' | 'signedIn';
interface Auth {
  status: Status; me: Me | null; refresh: () => Promise<void>; signOut: () => Promise<void>;
  /** Onboarding holds the signed-out screens open after the email code so it can offer a password. */
  hold: (on: boolean) => void;
}

const Ctx = createContext<Auth>({ status: 'loading', me: null, refresh: async () => {}, signOut: async () => {}, hold: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const held = useRef(false);

  const refresh = useCallback(async () => {
    if (held.current) return;
    if (!(await hasToken())) { setMe(null); return setStatus('signedOut'); }
    const r = await klyr.me();
    if (r.ok) { setMe(r.data); return setStatus('signedIn'); }
    if (r.error?.code === 'mfa_required') return setStatus('mfa');
    if (r.status === 401) { setMe(null); return setStatus('signedOut'); }
    // Offline or server error: keep the user signed in and let screens show the error.
    setStatus(s => (s === 'loading' ? 'signedIn' : s));
  }, []);

  useEffect(() => { void refresh(); return onTokenChange(() => void refresh()); }, [refresh]);

  const signOut = useCallback(async () => { await klyr.logout(); }, []);
  const hold = useCallback((on: boolean) => { held.current = on; }, []);
  return <Ctx.Provider value={{ status, me, refresh, signOut, hold }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
