import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import type { IdCheckAnswers } from '@klyr/api-client';
import { errorText, klyr } from '../lib/klyr';
import { Back } from '../components/back';
import { Button, Card, Chip, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';

const SOURCES: [IdCheckAnswers['sourceOfFunds'][number], string][] = [
  ['savings', 'Savings'], ['employment', 'Employment income'], ['sale_of_property', 'Sale of a property'],
  ['gift', 'Gift from family'], ['investments', 'Investments'], ['other', 'Other'],
];

export default function IdCheck() {
  const [scanned, setScanned] = useState(false);
  const [a, setA] = useState<Omit<IdCheckAnswers, 'vendorRef'>>({ occupation: '', sourceOfFunds: [], actingForThirdParty: false, politicallyExposed: false, buyingAs: 'self' });
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  const toggle = (s: IdCheckAnswers['sourceOfFunds'][number]) => setA({ ...a, sourceOfFunds: a.sourceOfFunds.includes(s) ? a.sourceOfFunds.filter(x => x !== s) : [...a.sourceOfFunds, s] });

  async function submit() {
    setError('');
    const r = await klyr.submitIdCheck({ ...a, vendorRef: 'sandbox' });
    if (!r.ok) return setError(errorText(r.error));
    if (r.data.status === 'verified') router.back(); else setReview(true);
  }

  if (review) {
    return <Screen><Back /><Title sub="Your answers need a quick review before your first visit. We’ll let you know, usually within one business day.">With our compliance officer</Title></Screen>;
  }
  return (
    <Screen>
      <Back />
      <Title sub="Required once by FINTRAC before your first visit, listing or offer. About 4 minutes.">Verify your identity</Title>
      <Step title="1 · Photo ID">
        <Text style={t.note}>Driver’s licence or passport, plus a selfie. Handled by our ID verification partner.</Text>
        <Text style={{ ...t.note, backgroundColor: '#FBEBDD', color: '#A54B00', borderRadius: 10, padding: 8 }}>Test mode: the ID partner isn’t connected yet, so this step is simulated and no document is checked.</Text>
        {scanned ? <Text style={{ ...sora(700), color: '#2B7A4B' }}>✓ ID scanned (test)</Text> : <Button title="Scan my ID (test)" alt onPress={() => setScanned(true)} />}
      </Step>
      <Step title="2 · About you"><Field label="Occupation" value={a.occupation} onChangeText={v => setA({ ...a, occupation: v })} /></Step>
      <Step title="3 · Source of funds" note="Where will your deposit and down payment come from?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{SOURCES.map(([k, l]) => <Chip key={k} label={l} on={a.sourceOfFunds.includes(k)} onPress={() => toggle(k)} />)}</View>
      </Step>
      <Step title="4 · Third party" note="Are you acting for someone else? For example, buying for a relative or using someone else’s money.">
        <YesNo value={a.actingForThirdParty} set={v => setA({ ...a, actingForThirdParty: v })} />
      </Step>
      <Step title="5 · Politically exposed person" note="Have you, a family member or a close associate held senior public office or led an international organization?">
        <YesNo value={a.politicallyExposed} set={v => setA({ ...a, politicallyExposed: v })} />
      </Step>
      <Step title="6 · Buying as">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip flex label="Myself" on={a.buyingAs === 'self'} onPress={() => setA({ ...a, buyingAs: 'self' })} />
          <Chip flex label="A company or trust" on={a.buyingAs === 'company'} onPress={() => setA({ ...a, buyingAs: 'company' })} />
        </View>
      </Step>
      <Text style={t.note}>● Rule · FINTRAC. Klyr Realty Inc., Brokerage keeps this record for 5 years and uses it only to meet FINTRAC requirements.</Text>
      <ErrorText>{error}</ErrorText>
      <Button title="Submit" disabled={!scanned || a.occupation.trim().length < 2 || !a.sourceOfFunds.length} onPress={submit} />
    </Screen>
  );
}

function Step({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <Card><Text style={sora(700)}>{title}</Text>{note ? <Text style={t.note}>{note}</Text> : null}{children}</Card>;
}

function YesNo({ value, set }: { value: boolean; set: (v: boolean) => void }) {
  return <View style={{ flexDirection: 'row', gap: 6 }}><Chip flex label="No" on={!value} onPress={() => set(false)} /><Chip flex label="Yes" on={value} onPress={() => set(true)} /></View>;
}
