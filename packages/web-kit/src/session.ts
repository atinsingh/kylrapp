import 'server-only';
import { cookies } from 'next/headers';

/** Each app sets its own name in next.config `env` (cookies on one host are shared across ports and apps). */
export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? 'klyr_session';
export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Server-side call to the Klyr API as the signed-in user. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const token = await sessionToken();
  try {
    const res = await fetch(API_URL + path, {
      ...init,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
  } catch {
    return { status: 503, data: null };
  }
}
