import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { RentalDetail, Renting, VisitFeedback } from '@klyr/api-client';
import { money, torontoInstant, torontoToday, torontoWhen } from '@klyr/core';
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
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(18);
  const [fb, setFb] = useState<Partial<VisitFeedback>>({});
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
  async function book() {
    setBusy(true); setError('');
    const [y, m, d] = torontoToday();
    const res = await klyr.bookViewing(id, torontoInstant(y, m, d + day, hour, 0).toISOString());
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    setR(res.data);
  }
  async function feedback(vid: string) {
    const res = await klyr.visitFeedback(vid, fb as VisitFeedback);
    if (!res.ok) return setError(errorText(res.error));
    setFb({}); load();
  }
  const upcoming = r.viewings.some(v => (v.status === 'requested' || v.status === 'confirmed') && Date.parse(v.at) > Date.now());
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
      {r.status === 'active' && (
        <Card>
          <Text style={t.label}>VIEWINGS</Text>
          {r.viewings.map(v => (
            <View key={v.id} style={{ gap: 6 }}>
              <Text style={sora(600)}>{torontoWhen(v.at)} · {v.status === 'completed' ? 'viewed' : v.status}</Text>
              {v.agentNote && <Text style={t.note}>Your agent: “{v.agentNote}”</Text>}
              {v.status === 'completed' && !v.feedback && (
                <>
                  <View style={{ flexDirection: 'row', gap: 6 }}>{(['yes', 'maybe', 'no'] as const).map(k => <Chip key={k} flex label={{ yes: 'I’d apply', maybe: 'Maybe', no: 'Not for me' }[k]} on={fb.interest === k} onPress={() => setFb(x => ({ ...x, interest: k }))} />)}</View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>{(['low', 'fair', 'high'] as const).map(k => <Chip key={k} flex label={{ low: 'Priced low', fair: 'Fair', high: 'Priced high' }[k]} on={fb.price === k} onPress={() => setFb(x => ({ ...x, price: k }))} />)}</View>
                  <Button title="Send feedback" alt disabled={!fb.interest || !fb.price} onPress={() => feedback(v.id)} />
                </>
              )}
              {v.feedback && <Text style={t.note}>Feedback sent. The landlord sees it without your name.</Text>}
            </View>
          ))}
          {mine.agreement && !upcoming && (
            <>
              <View style={{ flexDirection: 'row', gap: 6 }}>{[[1, 'Tomorrow'], [2, 'In 2 days'], [3, 'In 3 days']].map(([d, l]) => <Chip key={l} flex label={l as string} on={day === d} onPress={() => setDay(d as number)} />)}</View>
              <View style={{ flexDirection: 'row', gap: 6 }}>{[[10, '10 am'], [14, '2 pm'], [18, '6 pm']].map(([h, l]) => <Chip key={l} flex label={l as string} on={hour === h} onPress={() => setHour(h as number)} />)}</View>
              <ErrorText>{error}</ErrorText>
              <Button title="Book a viewing" alt busy={busy} onPress={book} />
            </>
          )}
        </Card>
      )}
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
