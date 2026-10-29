import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { RentalDetail, Renting } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { Back } from '../../components/back';
import { StepUp } from '../../components/step-up';
import { Button, Card, Check, Chip, ErrorText, Field, Screen, sora, t, Title } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorText, klyr } from '../../lib/klyr';
import { rentControl, STATUS } from '../rent';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;

/** A rental: move-in cost, rent control, Form 326 if needed, then Form 410 + 400. */
export default function RentalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const [r, setR] = useState<RentalDetail | null>(null);
  const [mine, setMine] = useState<Renting | null>(null);
  const [rent, setRent] = useState(0);
  const [start, setStart] = useState('');
  const [term, setTerm] = useState(12);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState<'consent' | 'apply' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    void Promise.all([klyr.rental(id), klyr.renting()]).then(([a, b]) => {
      if (a.ok) { setR(a.data); setRent(x => x || a.data.rent); setStart(x => x || (a.data.availableFrom ?? '')); } else setError(errorText(a.error));
      if (b.ok) setMine(b.data);
    });
  }, [id]);
  useFocusEffect(load);
  if (!r || !mine) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;

  async function go(kind: 'consent' | 'apply') {
    setBusy(true); setError('');
    const res = kind === 'consent' ? await klyr.consentToApply(id, name) : await klyr.applyForRental(id, { rent, startDate: start, termMonths: term, typedName: name });
    setBusy(false);
    if (res.status === 403 && res.error?.code === 'step_up_required') return setStepUp(kind);
    if (!res.ok) return setError(errorText(res.error));
    setR(res.data); setName(''); setRead(false);
  }
  const sign = (title: string, kind: 'consent' | 'apply') => stepUp
    ? <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(null)} onDone={() => { const k = stepUp; setStepUp(null); void go(k); }} />
    : (
      <>
        <Check on={read} onPress={() => setRead(!read)}>I’ve read this. The standard OREA terms apply in full.</Check>
        <Field label={`Type your full name to sign (${me?.legalName ?? ''})`} value={name} onChangeText={setName} autoComplete="name" />
        <ErrorText>{error}</ErrorText>
        <Button title={title} busy={busy} disabled={!read || name.trim().length < 2} onPress={() => go(kind)} />
      </>
    );
  const consentOpen = r.consent && !(r.consent.buyerSignedAt && r.consent.sellerSignedAt);

  return (
    <Screen>
      <Back />
      {r.photos[0] && <Image source={{ uri: r.photos[0].url }} accessibilityLabel={r.photos[0].alt} style={{ width: '100%', height: 200, borderRadius: 16 }} />}
      <Title sub={`${r.address}, ${r.city} · ${r.beds} bd · ${r.baths} ba`}>{`${money(r.rent)} /month`}</Title>
      <Card>
        <Text style={t.label}>TO MOVE IN · {money(r.moveIn.total)}</Text>
        <Text style={t.note}>First month {money(r.moveIn.firstMonth)} + last month’s rent deposit {money(r.moveIn.lastMonth)}. In Ontario that’s the only deposit allowed, and it earns interest.</Text>
        <Text style={{ ...sora(600), fontSize: 13, color: r.rentControlled ? '#2B7A4B' : '#A54B00' }}>{rentControl(r)}</Text>
        {r.description && <Text style={t.body}>{r.description}</Text>}
        <Text style={t.note}>Listing brokerage: {r.listingBrokerage}</Text>
      </Card>
      {r.application && r.application.status !== 'withdrawn' ? (
        <Card><Text style={t.label}>YOUR APPLICATION</Text><Text style={sora(700)}>{STATUS[r.application.status]}</Text><Text style={t.note}>{money(r.application.rent)}/month from {r.application.startDate} · sent {torontoWhen(r.application.createdAt)}</Text></Card>
      ) : !mine.agreement || !mine.profile ? (
        <Card><Text style={sora(700)}>{!mine.agreement ? 'Sign your tenant agreement ($0) first' : 'Fill in your rental profile first'}</Text><Text style={t.note}>Go back to Rent a home.</Text></Card>
      ) : consentOpen ? (
        <Card>
          <Text style={t.label}>● KLYR LISTING · OREA FORM 326</Text>
          <Text style={sora(700)}>{r.consent!.buyerSignedAt ? 'Waiting for the landlord' : 'Klyr represents this landlord too'}</Text>
          {r.consent!.buyerSignedAt ? <Text style={t.note}>You can apply once the landlord signs; we’ll let you know.</Text> : (
            <>
              <Text style={t.note}>Before you apply, you and the landlord both consent in writing. Klyr won’t tell the landlord the most rent you’d pay.</Text>
              {sign('Sign consent', 'consent')}
            </>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={t.label}>APPLY · FORM 410 + FORM 400</Text>
          <Field label="Rent a month" value={rent.toLocaleString('en-CA')} onChangeText={v => setRent(n(v))} keyboardType="number-pad" />
          <Field label="Start date (YYYY-MM-DD)" value={start} onChangeText={setStart} />
          <View style={{ flexDirection: 'row', gap: 6 }}>{[6, 12, 24].map(m => <Chip key={m} flex label={`${m} months`} on={term === m} onPress={() => setTerm(m)} />)}</View>
          <Text style={t.note}>You pay {money(rent * 2)} when the lease is signed. Your profile goes with the offer.</Text>
          {sign('Sign and apply', 'apply')}
        </Card>
      )}
    </Screen>
  );
}
