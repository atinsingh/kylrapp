import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import type { Me } from '@klyr/contracts';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, ErrorText, Field, sf, t } from './ui';

/** "Confirm it’s you" on the phone: authenticator code, or an emailed code for email-only accounts. */
export function StepUp({ reason, onDone, onCancel }: { reason: string; onDone: () => void; onCancel: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void klyr.me().then(r => r.ok && setMe(r.data)); }, []);
  const emailOnly = !!me && !me.passkeys && !me.totpEnabled;
  const passkeyOnly = !!me && me.passkeys > 0 && !me.totpEnabled;

  async function confirm() {
    setError('');
    const r = emailOnly ? await klyr.stepUpEmailVerify(code) : await klyr.totpVerify(code);
    if (!r.ok) return setError(errorText(r.error));
    onDone();
  }

  return (
    <Card style={{ borderWidth: 2, borderColor: color.brand }}>
      <Text accessibilityRole="header" style={{ ...sf(700), fontSize: 17 }}>Confirm it’s you</Text>
      <Text style={t.note}>{reason}</Text>
      {passkeyOnly && <Text style={t.note}>Passkeys on the phone are coming. For now, sign this on the web with your passkey, or set up an authenticator app in Security.</Text>}
      {emailOnly && !sent && <Button title="Email me a code" onPress={async () => { const r = await klyr.stepUpEmailStart(); if (r.ok) setSent(true); else setError(errorText(r.error)); }} />}
      {(me?.totpEnabled || (emailOnly && sent)) && (
        <>
          {emailOnly && <Text style={t.note}>We sent a 6-digit code to {me!.email}.</Text>}
          <Field label={emailOnly ? 'Code from your email' : 'Code from your authenticator app'} value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" textContentType="oneTimeCode" autoFocus />
          <Button title="Confirm" disabled={code.length !== 6} onPress={confirm} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Cancel" alt onPress={onCancel} />
    </Card>
  );
}
