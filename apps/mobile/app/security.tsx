import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type { Device, Passkey, Result } from '@klyr/api-client';
import type { Me } from '@klyr/contracts';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Row as LinkRow, Button, Card, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';

type Pending = { label: string; run: () => Promise<Result<unknown>> };

/** Same settings as the web Security screen. Adding passkeys on the phone comes with native passkey support. */
export default function Security() {
  const auth = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [stepCode, setStepCode] = useState('');
  const [totp, setTotp] = useState<{ secret: string; url: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    const [m, k, d] = await Promise.all([klyr.me(), klyr.passkeys(), klyr.devices()]);
    if (m.ok) setMe(m.data);
    if (k.ok) setKeys(k.data);
    if (d.ok) setDevices(d.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(label: string, run: () => Promise<Result<unknown>>, done: string) {
    setError(''); setNote('');
    const r = await run();
    if (r.status === 403 && r.error?.code === 'step_up_required') return setPending({ label, run });
    if (!r.ok) return setError(errorText(r.error));
    setNote(done);
    await load();
  }

  async function confirmWithCode() {
    if (!pending) return;
    const v = await klyr.totpVerify(stepCode);
    if (!v.ok) return setError(errorText(v.error));
    const p = pending; setPending(null); setStepCode('');
    await act(p.label, p.run, 'Done.');
  }

  async function startTotp() {
    setError(''); setNote('');
    const r = await klyr.totpSetup();
    if (r.status === 403 && r.error?.code === 'step_up_required') {
      return setPending({ label: 'Setting up a new authenticator', run: async () => { await startTotp(); return { ok: true, status: 200, data: null }; } });
    }
    if (!r.ok) return setError(errorText(r.error));
    setTotp({ secret: r.data.secret, url: r.data.otpauthUrl });
  }

  async function enableTotp() {
    const r = await klyr.totpEnable(totpCode);
    if (!r.ok) return setError(errorText(r.error));
    setTotp(null); setTotpCode(''); setNote('Two-step verification is on.'); await load();
  }

  if (!me) return <Screen><Text style={t.sub}>Loading…</Text></Screen>;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color.brandInk, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...sora(800), fontSize: 20, color: '#fff' }}>{(me.legalName ?? me.email).split(' ').slice(0, 2).map(w => w[0]!.toUpperCase()).join('')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={t.h1}>{me.legalName ?? 'Account'}</Text>
          <Text style={t.note}>{me.email}</Text>
        </View>
      </View>
      <View>
        <LinkRow icon="pricetag-outline" title="Sell your home" sub="What you keep, your listing and offers" onPress={() => router.push('/sell')} />
        <LinkRow icon="key-outline" title="Rent a home" sub="No fee to you" onPress={() => router.push('/rent')} />
        <LinkRow icon="business-outline" title="Lease out a home" sub="Applicants on the same terms" onPress={() => router.push('/lease')} />
        <LinkRow icon="calculator-outline" title="Quotes" sub="Lenders, lawyers, inspectors, insurers" onPress={() => router.push('/quotes')} />
      </View>
      <Title sub="How you sign in, and the devices that are signed in now.">Security</Title>
      <ErrorText>{error}</ErrorText>
      {note ? <Card style={{ backgroundColor: color.brandTint }}><Text accessibilityLiveRegion="polite" style={{ ...sora(600), color: color.brand }}>{note}</Text></Card> : null}

      {pending && (
        <Section title="Confirm it’s you" sub={`${pending.label} needs a fresh check.`}>
          {me.totpEnabled ? (
            <>
              <Field label="Code from your authenticator app" value={stepCode} onChangeText={v => setStepCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" />
              <Button title="Confirm" disabled={stepCode.length !== 6} onPress={confirmWithCode} />
            </>
          ) : (
            <Text style={t.note}>On the phone you confirm with an authenticator code. Set one up below, or make this change on the web with your passkey.</Text>
          )}
          <Button title="Cancel" alt onPress={() => setPending(null)} />
        </Section>
      )}

      <Section title="Passkeys" sub="Sign in with your face, fingerprint or device PIN. Add one on the web for now.">
        {keys.map(k => (
          <Row key={k.id} title={k.name ?? 'Passkey'} sub={`Added ${day(k.createdAt)}${k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : ''}`}
            action={<LinkBtn onPress={() => act('Removing a passkey', () => klyr.removePasskey(k.id), 'Passkey removed.')}>Remove</LinkBtn>} />
        ))}
        {!keys.length && <Text style={t.note}>No passkeys yet.</Text>}
      </Section>

      <Section title="Password" sub={me.hasPassword ? 'You can sign in with your password.' : 'No password set. You sign in with an email code.'}>
        <Field label={me.hasPassword ? 'New password' : 'Password'} value={newPassword} onChangeText={setNewPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
        <Button title={me.hasPassword ? 'Change password' : 'Set password'} alt disabled={newPassword.length < 12}
          onPress={() => act(me.hasPassword ? 'Changing your password' : 'Setting a password', () => klyr.setPassword(newPassword), me.hasPassword ? 'Password changed.' : 'Password set.').then(() => setNewPassword(''))} />
      </Section>

      <Section title="Two-step verification" sub="A code from an authenticator app, asked for when you sign in with a password or email code.">
        {me.totpEnabled && !totp && (
          <>
            <Row title="Authenticator app" sub="On" />
            <Button title="Turn off" alt onPress={() => act('Turning off two-step verification', klyr.totpDisable, 'Two-step verification is off.')} />
          </>
        )}
        {!me.totpEnabled && !totp && <Button title="Set up an authenticator app" alt onPress={startTotp} />}
        {totp && (
          <>
            <Text style={t.note}>Open your authenticator app with the button, or copy the key into it. Then enter the 6-digit code it shows.</Text>
            <Button title="Open authenticator app" alt onPress={() => Linking.openURL(totp.url).catch(() => setError('No authenticator app found. Copy the key instead.'))} />
            <Pressable accessibilityRole="button" accessibilityLabel="Copy setup key" onPress={async () => { await Clipboard.setStringAsync(totp.secret); setNote('Key copied.'); }}>
              <Text style={{ ...sora(600), fontSize: 13, textAlign: 'center', letterSpacing: 1 }}>{totp.secret.match(/.{1,4}/g)?.join(' ')}  ·  Copy</Text>
            </Pressable>
            <Field label="Code" value={totpCode} onChangeText={v => setTotpCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" />
            <Button title="Turn on" disabled={totpCode.length !== 6} onPress={enableTotp} />
          </>
        )}
      </Section>

      <Section title="Devices" sub="Where you’re signed in now.">
        {devices.map(d => (
          <Row key={d.id} title={describe(d.userAgent)} sub={`${d.current ? 'This device · ' : ''}active ${day(d.lastSeenAt)}`}
            action={d.current ? undefined : <LinkBtn onPress={() => act('Signing out a device', () => klyr.signOutDevice(d.id), 'Device signed out.')}>Sign out</LinkBtn>} />
        ))}
        {devices.length > 1 && <Button title="Sign out all other devices" alt onPress={() => act('Signing out other devices', klyr.signOutOthers, 'Other devices signed out.')} />}
      </Section>

      <Button title="Sign out" alt onPress={auth.signOut} />
    </Screen>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return <Card><Text accessibilityRole="header" style={{ ...sora(700), fontSize: 17 }}>{title}</Text><Text style={t.note}>{sub}</Text>{children}</Card>;
}

function Row({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: color.separator }}>
      <View style={{ flex: 1 }}><Text style={sora(600)}>{title}</Text><Text style={t.note}>{sub}</Text></View>
      {action}
    </View>
  );
}

function LinkBtn({ onPress, children }: { onPress: () => void; children: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>{children}</Text></Pressable>;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

function describe(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/Expo|okhttp|CFNetwork|Darwin/.test(ua)) return /okhttp/.test(ua) ? 'Klyr app on Android' : 'Klyr app on iPhone';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '';
  return os ? `${browser} on ${os}` : browser;
}
