/** Browser-side calls go through the same-origin proxy in app/api/[...path]. */
export async function call<T = unknown>(path: string, body?: unknown, method = 'POST'): Promise<{ ok: boolean; status: number; data: T & { message?: unknown; code?: string } }> {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/** Turns an API error body into one sentence for the user. */
export function errorText(data: { message?: unknown }): string {
  const m = data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && m[0]?.message) return String(m[0].message);
  return 'Something went wrong. Try again.';
}
