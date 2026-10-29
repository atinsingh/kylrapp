import { redirect } from 'next/navigation';
import type { IdReview } from '@klyr/api-client';
import { api, sessionToken } from '@klyr/web-kit/session';

/** The compliance queue doubles as the access check: it answers only officers who passed two-step verification. */
export async function requireOfficer(): Promise<IdReview[]> {
  if (!(await sessionToken())) redirect('/signin');
  const q = await api<IdReview[]>('/admin/id-reviews');
  if (!q.data) redirect('/signin');
  return q.data;
}
