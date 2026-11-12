'use client';

import { useRouter } from 'next/navigation';
import { klyr } from '@/lib/client';

export function SignOut() {
  const router = useRouter();
  return (
    <button onClick={async () => { await klyr.logout(); router.replace('/welcome'); }}
      style={{ border: 0, background: 'none', color: 'var(--muted)', fontWeight: 500, fontSize: 13, minHeight: 44 }}>
      Sign out
    </button>
  );
}
