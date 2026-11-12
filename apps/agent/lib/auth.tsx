import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ProMe } from '@klyr/api-client';
import { hasToken, klyr, onTokenChange } from './klyr';

/**
 * Staff only, and only with an authenticator app: an agent with no authenticator sets one up
 * before any screen with client data opens.
 */
type Status = 'loading' | 'signedOut' | 'mfa' | 'setup' | 'notAgent' | 'ready';
interface Auth { status: Status; agent: ProMe | null; refresh: () => Promise<void>; signOut: () => Promise<void> }

const Ctx = createContext<Auth>({ status: 'loading', agent: null, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [agent, setAgent] = useState<ProMe | null>(null);

  const refresh = useCallback(async () => {
    if (!(await hasToken())) { setAgent(null); return setStatus('signedOut'); }
    const me = await klyr.me();
    if (!me.ok) {
      if (me.error?.code === 'mfa_required') return setStatus('mfa');
      if (me.status === 401) { setAgent(null); return setStatus('signedOut'); }
      return setStatus(s => (s === 'loading' ? 'signedOut' : s));
    }
    if (!me.data.roles.includes('agent')) return setStatus('notAgent');
    if (!me.data.totpEnabled) return setStatus('setup');
    const pro = await klyr.pro.me();
    if (!pro.ok) return setStatus(pro.error?.code === 'staff_mfa_required' ? 'mfa' : 'notAgent');
    setAgent(pro.data);
    setStatus('ready');
  }, []);

  useEffect(() => { void refresh(); return onTokenChange(() => void refresh()); }, [refresh]);
  const signOut = useCallback(async () => { await klyr.logout(); }, []);
  return <Ctx.Provider value={{ status, agent, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
