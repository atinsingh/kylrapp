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

/** Partner pages: a person linked to a provider firm who has passed two-step verification. */
export async function requirePartner(): Promise<import('@klyr/api-client').PartnerMe> {
  if (!(await sessionToken())) redirect('/partner/signin');
  const me = await api<import('@klyr/api-client').PartnerMe>('/partner/me');
  if (!me.data) redirect('/partner/signin');
  return me.data;
}
