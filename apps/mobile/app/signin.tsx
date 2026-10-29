import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import type { SignedIn } from '@klyr/api-client';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, ErrorText, Field, Screen, t, Title } from '../components/ui';
import { CodeEntry } from '../components/code-entry';

type Step = 'choose' | 'code' | 'password' | 'totp';

/** Email code or password; then the authenticator code when two-step is on. Passkeys on the phone come later. */
export default function SignIn() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>(auth.status === 'mfa' ? 'totp' : 'choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = /.+@.+\..+/.test(email);
  const finish = async (s: SignedIn) => { if (s.session.mfaRequired) setStep('totp'); else await auth.refresh(); };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } finally { setBusy(false); } };

  return (
    <Screen>
      {step === 'choose' && (
        <>
          <Title>Welcome back</Title>
          <Card><Field label="Email" value={email} onChangeText={v => setEmail(v.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Email me a code" busy={busy} disabled={!valid} onPress={() => run(async () => {
            const r = await klyr.emailStart(email);
            if (!r.ok) return setError(errorText(r.error));
            setStep('code');
          })} />
          <Button title="Use my password" alt disabled={!valid} onPress={() => { setError(''); setStep('password'); }} />
          <Text style={{ ...t.note, textAlign: 'center' }} onPress={() => router.replace('/start')}>New to Klyr? <Text style={{ textDecorationLine: 'underline' }}>Get started</Text></Text>
        </>
      )}

      {step === 'code' && <CodeEntry email={email} purpose="signin" onDone={finish} />}

      {step === 'password' && (
        <>
          <Title sub={email}>Enter your password</Title>
          <Card><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" autoFocus /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" busy={busy} disabled={!password} onPress={() => run(async () => {
            const r = await klyr.passwordLogin(email, password);
            if (!r.ok) return setError(errorText(r.error));
            await finish(r.data);
          })} />
          <Button title="Email me a code instead" alt onPress={() => run(async () => {
            const r = await klyr.emailStart(email);
            if (!r.ok) return setError(errorText(r.error));
            setStep('code');
          })} />
        </>
      )}

      {step === 'totp' && (
        <>
          <Title sub="Enter the 6-digit code from your authenticator app.">Two-step verification</Title>
          <Card><Field label="Code" value={totp} onChangeText={v => setTotp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Verify" busy={busy} disabled={totp.length !== 6} onPress={() => run(async () => {
            const r = await klyr.totpVerify(totp);
            if (!r.ok) return setError(errorText(r.error));
            await auth.refresh();
          })} />
          <Button title="Cancel" alt onPress={() => run(async () => { await auth.signOut(); setStep('choose'); })} />
        </>
      )}
    </Screen>
  );
}
