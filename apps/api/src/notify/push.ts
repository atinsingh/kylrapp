import { Logger } from '@nestjs/common';
import { config } from '../config.js';

export interface PushMessage { to: string; title: string; body: string; data?: Record<string, string> }
/** One result per message, in order. `gone` means the app was uninstalled or the token expired. */
export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };
export interface Pusher { send(messages: PushMessage[]): Promise<PushResult[]> }
export const PUSH = Symbol('PUSH');

/** Expo's push service: one HTTPS call per 100 messages, relayed to APNs (iOS) and FCM (Android). */
export class ExpoPusher implements Pusher {
  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const out: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json', ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}) },
        body: JSON.stringify(batch.map(m => ({ ...m, sound: 'default', priority: 'high', channelId: 'visits' }))),
      }).catch(() => null);
      const tickets = res?.ok ? ((await res.json()) as { data: { status: string; message?: string; details?: { error?: string } }[] }).data : null;
      batch.forEach((_, j) => {
        const t = tickets?.[j];
        out.push(t?.status === 'ok' ? { ok: true } : { ok: false, gone: t?.details?.error === 'DeviceNotRegistered', error: t?.message ?? `push service ${res?.status ?? 'unreachable'}` });
      });
    }
    return out;
  }
}

/** Development: prints each push to the log. */
export class ConsolePusher implements Pusher {
  private readonly log = new Logger('Push');
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) this.log.log(`to ${m.to} · ${m.title} · ${m.body}`);
    return messages.map(() => ({ ok: true }));
  }
}

export function createPusher(): Pusher {
  if (config.pushProvider === 'expo') return new ExpoPusher(config.expoAccessToken);
  if (config.production) throw new Error('PUSH_PROVIDER is required in production');
  return new ConsolePusher();
}
