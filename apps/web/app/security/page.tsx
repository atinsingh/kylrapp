import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { PrivacyRequests } from './privacy';
import { Security } from './security';

export const metadata = { title: 'Security and alerts · Klyr' };

export default async function SecurityPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const me = await api<Me>('/auth/me');
  if (me.status === 401) redirect('/welcome');
  return (
    <main className="k-page">
      <AppHeader me={me.data} current="security" />
      <h1 className="k-h1">Security</h1>
      <p className="k-sub">How you sign in, and the devices that are signed in now.</p>
      <Security />
      <PrivacyRequests />
    </main>
  );
}
