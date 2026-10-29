import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessionToken } from '@/lib/session';
import { Security } from './security';

export const metadata = { title: 'Security and alerts · Klyr' };

export default async function SecurityPage() {
  if (!(await sessionToken())) redirect('/welcome');
  return (
    <main className="k-page">
      <Link href="/" style={{ fontSize: 13, fontWeight: 700 }}>‹ Back</Link>
      <h1 className="k-h1">Security</h1>
      <p className="k-sub">How you sign in, and the devices that are signed in now.</p>
      <Security />
    </main>
  );
}
