import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, ErrorText, Field, Screen, sora, t } from '../components/ui';

type Step = 'email' | 'code';

/** Email code, then the authenticator app (set up here the first time). */
export default function SignIn() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState('');
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); } finally { setBusy(false); } };

  // A staff member without an authenticator gets a key to add to their app.
  useEffect(() => {
    if (auth.status !== 'setup' || setup) return;
    void klyr.totpSetup().then(r => (r.ok ? setSetup({ secret: r.data.secret, url: r.data.otpauthUrl }) : setError(errorText(r.error))));
  }, [auth.status, setup]);

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  const header = <Text style={{ ...sora(800), fontSize: 18, color: color.brand }}>Klyr Pro</Text>;

  if (auth.status === 'notAgent') return (
    <Screen>
      {header}
      <Text style={t.h1}>This account can’t use Klyr Pro</Text>
      <Text style={t.sub}>Klyr Pro is for Klyr Realty agents. If you’re buying or selling, use the Klyr app.</Text>
      <Button title="Use another email" alt onPress={() => void auth.signOut()} />
    </Screen>
  );

  if (auth.status === 'mfa') return (
    <Screen>
      {header}
      <Text style={t.h1}>Two-step verification</Text>
      <Text style={t.sub}>Enter the code from your authenticator app.</Text>
      <Card><Field label="Authenticator code" value={totp} onChangeText={v => setTotp(digits(v))} keyboardType="number-pad" textContentType="oneTimeCode" autoFocus /></Card>
      <ErrorText>{error}</ErrorText>
      <Button title="Sign in" busy={busy} disabled={totp.length !== 6} onPress={() => run(async () => {
        const r = await klyr.totpVerify(totp);
        if (!r.ok) return setError(errorText(r.error));
        await auth.refresh();
      })} />
      <Button title="Cancel" alt onPress={() => void auth.signOut()} />
    </Screen>
  );

  if (auth.status === 'setup') return (
    <Screen>
      {header}
      <Text style={t.h1}>Set up two-step verification</Text>
      <Text style={t.sub}>Agents need an authenticator app (Google Authenticator, 1Password, Authy or similar) before client details open.</Text>
      {setup && (
        <Card>
          <Button title="Add to my authenticator app" alt onPress={() => Linking.openURL(setup.url).catch(() => setError('No authenticator app found. Copy the key instead.'))} />
          <Pressable accessibilityRole="button" accessibilityLabel="Copy setup key" onPress={async () => { await Clipboard.setStringAsync(setup.secret); setNote('Key copied.'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text testID="totp-secret" style={{ ...sora(600), fontSize: 13, textAlign: 'center', letterSpacing: 1 }}>{setup.secret.match(/.{1,4}/g)?.join(' ')}  ·  Copy</Text>
          </Pressable>
          <Field label="Code from the app" value={totp} onChangeText={v => setTotp(digits(v))} keyboardType="number-pad" textContentType="oneTimeCode" />
        </Card>
      )}
      {note ? <Text style={t.note}>{note}</Text> : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Turn on and continue" busy={busy} disabled={totp.length !== 6} onPress={() => run(async () => {
        const r = await klyr.totpEnable(totp);
        if (!r.ok) return setError(errorText(r.error));
        await auth.refresh();
      })} />
      <Button title="Cancel" alt onPress={() => void auth.signOut()} />
    </Screen>
  );

  return (
    <Screen>
      <View style={{ height: 24 }} />
      {header}
      {step === 'email' ? (
        <>
          <Text style={t.h1}>Sign in</Text>
          <Text style={t.sub}>For Klyr Realty agents. Use your work email.</Text>
          <Card><Field label="Work email" value={email} onChangeText={v => setEmail(v.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoFocus /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Email me a code" busy={busy} disabled={!email.includes('@')} onPress={() => run(async () => {
            const r = await klyr.emailStart(email);
            if (!r.ok) return setError(errorText(r.error));
            setStep('code');
          })} />
        </>
      ) : (
        <>
          <Text style={t.h1}>Check your email</Text>
          <Text style={t.sub}>We sent a 6-digit code to {email}.</Text>
          <Card><Field label="Code" value={code} onChangeText={v => setCode(digits(v))} keyboardType="number-pad" textContentType="oneTimeCode" autoFocus /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Continue" busy={busy} disabled={code.length !== 6} onPress={() => run(async () => {
            const r = await klyr.emailVerify(email, code);
            if (!r.ok) return setError(errorText(r.error));
            await auth.refresh();
          })} />
          <Button title="Back" alt onPress={() => { setStep('email'); setCode(''); }} />
        </>
      )}
    </Screen>
  );
}
