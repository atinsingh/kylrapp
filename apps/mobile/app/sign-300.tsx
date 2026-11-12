import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import type { AgreementTerms } from '@klyr/api-client';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { Button, Card, Check, ErrorText, Field, Screen, sf, t, Title } from '../components/ui';

export default function Sign300() {
  const [terms, setTerms] = useState<AgreementTerms | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void klyr.agreementTerms().then(r => (r.ok ? setTerms(r.data) : setError(errorText(r.error)))); }, []);

  async function sign() {
    setError('');
    const r = await klyr.signAgreement(name);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.back();
  }

  if (!terms) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  return (
    <Screen>
      <Back />
      <Title sub={`Between: ${terms.buyer} and ${terms.brokerage}. Plain-language summary of the terms you’re agreeing to.`}>{terms.title}</Title>
      <Card>
        {terms.clauses.map(([h, p], i) => (
          <View key={h} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator, gap: 2 }}>
            <Text style={sf(700)}>{h}</Text><Text style={t.body}>{p}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ ...sf(700), fontSize: 12, color: color.brand }}>● Rule · RECO requires a written buyer agreement before any visit or offer.</Text>
      <Text style={t.note}>The full OREA form will be attached once Klyr’s OREA forms licence is in place. Until then this summary is a draft for legal review.</Text>
      {stepUp ? (
        <StepUp reason="Signing a legal agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />
      ) : (
        <Card>
          <Check on={read} onPress={() => setRead(!read)}>I’ve read this agreement</Check>
          <Field label={`Type your full name to sign (${terms.buyer})`} value={name} onChangeText={setName} autoComplete="name" />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign" disabled={!read || name.trim().length < 2} onPress={sign} />
        </Card>
      )}
    </Screen>
  );
}
