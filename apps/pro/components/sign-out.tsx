'use client';

import { klyr } from '@/lib/client';

export function SignOut() {
  return <button className="p-link" style={{ padding: '0 12px', color: 'var(--muted)' }} onClick={async () => { await klyr.logout(); window.location.assign('/signin'); }}>Sign out</button>;
}
