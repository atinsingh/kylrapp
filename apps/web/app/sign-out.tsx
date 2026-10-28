'use client';

import { useRouter } from 'next/navigation';
import { call } from '@/lib/client';

export function SignOut() {
  const router = useRouter();
  return (
    <button onClick={async () => { await call('/auth/logout'); router.replace('/welcome'); }}
      style={{ border: 0, background: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 13, minHeight: 44 }}>
      Sign out
    </button>
  );
}
