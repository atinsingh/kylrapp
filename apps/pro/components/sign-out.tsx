'use client';

import { klyr } from '@/lib/client';

export function SignOut({ to = '/signin' }: { to?: string }) {
  return <button className="p-link" style={{ padding: '0 4px', color: 'var(--muted)', fontSize: 13 }} onClick={async () => { await klyr.logout(); window.location.assign(to); }}>Sign out</button>;
}
