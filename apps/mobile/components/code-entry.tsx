import { useState } from 'react';
import { Text } from 'react-native';
import type { SignedIn } from '@klyr/api-client';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, ErrorText, Field, t, Title } from './ui';

/** "Enter the 6-digit code" — shared by sign-up and sign-in. */
export function CodeEntry({ email, purpose, onDone }: { email: string; purpose: 'signup' | 'signin'; onDone: (s: SignedIn) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function verify() {
    setBusy(true); setError('');
    const r = await klyr.emailVerify(email, code);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }

  async function resend() {
    setError(''); setNote('');
    const r = await klyr.emailStart(email);
    if (!r.ok) return setError(errorText(r.error));
    setNote('A new code is on its way.');
  }

  return (
    <>
      <Title sub={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}>{purpose === 'signup' ? 'Confirm your email' : 'Check your email'}</Title>
      <Card>
        <Field label="Code" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
          autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus placeholder="123456" style={{ letterSpacing: 6 }} />
      </Card>
      <ErrorText>{error}</ErrorText>
      {note ? <Text accessibilityLiveRegion="polite" style={t.note}>{note}</Text> : null}
      <Button title="Continue" busy={busy} disabled={code.length !== 6} onPress={verify} />
      <Button title="Send a new code" alt onPress={resend} />
    </>
  );
}
