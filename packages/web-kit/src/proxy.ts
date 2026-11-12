/**
 * Backend-for-frontend proxy. The browser never sees the session token: responses that
 * carry `session.token` have it moved into an httpOnly cookie, and the cookie is turned
 * back into a bearer header on the way to the API.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { API_URL, SESSION_COOKIE } from './session';

const MAX_AGE = 30 * 24 * 3600;

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const upstream = await fetch(`${API_URL}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      'content-type': 'application/json',
      'user-agent': req.headers.get('user-agent') ?? '',
      'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ message: 'Klyr is unavailable. Try again in a moment.' }, { status: 503 });

  const data = await upstream.json().catch(() => null);
  const res = NextResponse.json(data, { status: upstream.status });
  const secure = process.env.NODE_ENV === 'production';

  if (data?.session?.token) {
    res.cookies.set(SESSION_COOKIE, data.session.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE });
    delete data.session.token;
    return NextResponse.json(data, { status: upstream.status, headers: res.headers });
  }
  if ((path.join('/') === 'auth/logout' && upstream.ok) || upstream.status === 401) {
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
  }
  return res;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
