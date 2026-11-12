'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { Me } from '@klyr/contracts';
import type { Device, Passkey, Result } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';
import { Field } from '../start/onboarding';

type Pending = { label: string; run: () => Promise<Result<unknown>> };

export function Security() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Step-up: an action the API refused until the user confirms it's them.
  const [pending, setPending] = useState<Pending | null>(null);
  const [stepCode, setStepCode] = useState('');
  // Authenticator set-up.
  const [totp, setTotp] = useState<{ secret: string; qr: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    const [m, k, d] = await Promise.all([klyr.me(), klyr.passkeys(), klyr.devices()]);
    if (m.status === 401) return router.replace('/welcome');
    if (m.ok) setMe(m.data);
    if (k.ok) setKeys(k.data);
    if (d.ok) setDevices(d.data);
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  /** Runs an action; if the API asks for a fresh check, holds it until the user confirms. */
  async function act(label: string, run: () => Promise<Result<unknown>>, done: string) {
    setError(''); setNote(''); setBusy(true);
    try {
      const r = await run();
      if (r.status === 403 && r.error?.code === 'step_up_required') return setPending({ label, run });
      if (!r.ok) return setError(errorText(r.error));
      setNote(done);
      await load();
    } finally { setBusy(false); }
  }

  async function confirmWithPasskey() {
    if (!pending) return;
    setError(''); setBusy(true);
    try {
      const o = await klyr.passkeyStepUpOptions<Parameters<typeof startAuthentication>[0]['optionsJSON']>();
      if (!o.ok) throw new Error(errorText(o.error));
      const v = await klyr.passkeyStepUpVerify(o.data.challengeId, await startAuthentication({ optionsJSON: o.data.options }));
      if (!v.ok) throw new Error(errorText(v.error));
      const p = pending; setPending(null);
      await act(p.label, p.run, 'Done.');
    } catch (e) {
      setError(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'No passkey was used.');
    } finally { setBusy(false); }
  }

  async function confirmWithCode() {
    if (!pending) return;
    const v = await klyr.totpVerify(stepCode);
    if (!v.ok) return setError(errorText(v.error));
    const p = pending; setPending(null); setStepCode('');
    await act(p.label, p.run, 'Done.');
  }

  async function addPasskey() {
    setError(''); setBusy(true);
    try {
      const o = await klyr.passkeyRegisterOptions<Parameters<typeof startRegistration>[0]['optionsJSON']>();
      if (!o.ok) throw new Error(errorText(o.error));
      const v = await klyr.passkeyRegisterVerify(o.data.challengeId, await startRegistration({ optionsJSON: o.data.options }), deviceName());
      if (!v.ok) throw new Error(errorText(v.error));
      setNote('Passkey added.'); await load();
    } catch (e) {
      setError(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'The passkey wasn’t saved.');
    } finally { setBusy(false); }
  }

  async function startTotp() {
    setError(''); setNote('');
    const r = await klyr.totpSetup();
    if (r.status === 403 && r.error?.code === 'step_up_required') return setPending({ label: 'Set up a new authenticator', run: async () => { await startTotp(); return { ok: true, status: 200, data: null }; } });
    if (!r.ok) return setError(errorText(r.error));
    setTotp({ secret: r.data.secret, qr: await QRCode.toDataURL(r.data.otpauthUrl, { margin: 1, width: 200, color: { dark: '#000000' } }) });
  }

  async function enableTotp() {
    const r = await klyr.totpEnable(totpCode);
    if (!r.ok) return setError(errorText(r.error));
    setTotp(null); setTotpCode(''); setNote('Two-step verification is on.'); await load();
  }

  if (!me) return <div className="k-card" aria-busy>Loading…</div>;

  return (
    <>
      {error && <div className="k-error" role="alert">{error}</div>}
      {note && <div className="k-card" role="status" style={{ background: 'var(--tint)', color: 'var(--brand)', fontWeight: 600 }}>{note}</div>}

      {pending && (
        <Section title="Confirm it’s you" sub={`${pending.label} needs a fresh check.`}>
          {me.passkeys > 0 && <button className="k-btn" disabled={busy} onClick={confirmWithPasskey}>Use my passkey</button>}
          {me.totpEnabled && (
            <>
              <Field label="Code from your authenticator app" value={stepCode} onChange={v => setStepCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
              <button className="k-btn k-alt" disabled={stepCode.length !== 6} onClick={confirmWithCode}>Confirm with code</button>
            </>
          )}
          {!me.passkeys && !me.totpEnabled && <p className="k-note">Add a passkey first, then try again.</p>}
          <button className="k-btn k-alt" onClick={() => setPending(null)}>Cancel</button>
        </Section>
      )}

      <Section title="Passkeys" sub="Sign in with your face, fingerprint or device PIN. They can’t be phished.">
        {keys.map(k => (
          <Row key={k.id} title={k.name ?? 'Passkey'} sub={`Added ${day(k.createdAt)}${k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : ''}${k.backedUp ? ' · synced' : ''}`}
            action={<LinkBtn onClick={() => act('Removing a passkey', () => klyr.removePasskey(k.id), 'Passkey removed.')}>Remove</LinkBtn>} />
        ))}
        {!keys.length && <p className="k-note">No passkeys yet.</p>}
        <button className="k-btn k-alt" disabled={busy} onClick={addPasskey}>Add a passkey</button>
      </Section>

      <Section title="Password" sub={me.hasPassword ? 'You can sign in with your password.' : 'No password set. You sign in with a passkey or email code.'}>
        <Field label={me.hasPassword ? 'New password' : 'Password'} type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <button className="k-btn k-alt" disabled={busy || newPassword.length < 12}
          onClick={() => act(me.hasPassword ? 'Changing your password' : 'Setting a password', () => klyr.setPassword(newPassword), me.hasPassword ? 'Password changed.' : 'Password set.').then(() => setNewPassword(''))}>
          {me.hasPassword ? 'Change password' : 'Set password'}
        </button>
      </Section>

      <Section title="Two-step verification" sub="A code from an authenticator app, asked for when you sign in with a password or email code.">
        {me.totpEnabled && !totp && (
          <>
            <Row title="Authenticator app" sub="On" />
            <button className="k-btn k-alt" onClick={() => act('Turning off two-step verification', klyr.totpDisable, 'Two-step verification is off.')}>Turn off</button>
          </>
        )}
        {!me.totpEnabled && !totp && <button className="k-btn k-alt" onClick={startTotp}>Set up an authenticator app</button>}
        {totp && (
          <>
            <p className="k-note">Scan this with your authenticator app, or type the key, then enter the 6-digit code it shows.</p>
            <img src={totp.qr} alt="QR code for your authenticator app" width={200} height={200} style={{ alignSelf: 'center', borderRadius: 12 }} />
            <code style={{ fontSize: 13, wordBreak: 'break-all', textAlign: 'center' }}>{totp.secret.match(/.{1,4}/g)?.join(' ')}</code>
            <Field label="Code" value={totpCode} onChange={v => setTotpCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
            <button className="k-btn" disabled={totpCode.length !== 6} onClick={enableTotp}>Turn on</button>
          </>
        )}
      </Section>

      <Section title="Devices" sub="Where you’re signed in now.">
        {devices.map(d => (
          <Row key={d.id} title={describe(d.userAgent)} sub={`${d.current ? 'This device · ' : ''}signed in ${day(d.createdAt)} with ${method(d.method)} · active ${day(d.lastSeenAt)}`}
            action={d.current ? undefined : <LinkBtn onClick={() => act('Signing out a device', () => klyr.signOutDevice(d.id), 'Device signed out.')}>Sign out</LinkBtn>} />
        ))}
        {devices.length > 1 && <button className="k-btn k-alt" onClick={() => act('Signing out other devices', klyr.signOutOthers, 'Other devices signed out.')}>Sign out all other devices</button>}
      </Section>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="k-card" aria-label={title}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h2>
      <p className="k-note" style={{ margin: 0 }}>{sub}</p>
      {children}
    </section>
  );
}

function Row({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '.5px solid var(--sep)' }}>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{title}</div><div className="k-note">{sub}</div></div>
      {action}
    </div>
  );
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ border: 0, background: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 13, minHeight: 44 }}>{children}</button>;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const method = (m: string) => ({ passkey: 'a passkey', password: 'a password', email_code: 'an email code' })[m] ?? m;

/** "Chrome on Mac" from a user agent; good enough for a device list. */
function describe(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /Expo|okhttp|CFNetwork/.test(ua) ? 'Klyr app' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

function deviceName() {
  const ua = navigator.userAgent;
  return /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android phone' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'This device';
}
