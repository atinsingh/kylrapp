'use client';

import { klyr } from '@/lib/client';

export function SignOut({ to = '/signin' }: { to?: string }) {
  return <button className="p-link" style={{ padding: '0 12px', color: 'var(--muted)' }} onClick={async () => { await klyr.logout(); window.location.assign(to); }}>Sign out</button>;
}
