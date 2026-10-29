import { redirect } from 'next/navigation';
import type { ProMe } from '@klyr/api-client';
import { api, sessionToken } from '@klyr/web-kit/session';

export { api };

/** Every Pro page: a signed-in agent who has passed two-step verification, else back to sign-in. */
export async function requireAgent(): Promise<ProMe> {
  if (!(await sessionToken())) redirect('/signin');
  const me = await api<ProMe>('/pro/me');
  if (!me.data) redirect('/signin');
  return me.data;
}
