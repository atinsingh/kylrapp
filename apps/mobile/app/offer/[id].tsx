import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Assumptions, BuyingStatus, Consent, ListingDetail, OfferTermsInput } from '@klyr/api-client';
import { OFFER_RULES } from '@klyr/contracts';
import { buyerEstimate, money, nextBankingDate, type PropertyType, TORONTO, torontoInstant, torontoToday, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../../components/back';
import { StepUp } from '../../components/step-up';
import { display, Button, Card, Check, Chip, ErrorText, Field, Screen, sora, t, Title } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorText, klyr } from '../../lib/klyr';

type Cond = 'financingDays' | 'inspectionDays' | 'statusCertificateDays';
const when = (iso: string) => torontoWhen(iso);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** 11:59 pm Toronto, `days` from today. */
const tonightPlus = (days: number) => { const [y, m, d] = torontoToday(); return torontoInstant(y, m, d + days, 23, 59).toISOString(); };
const ymdPlus = (days: number) => { const [y, m, d] = torontoToday(); return nextBankingDate(new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)); };

/** Make an offer on the phone: the same rules and record as the web, in a shorter form. */
export default function MakeOffer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const [l, setL] = useState<ListingDetail | null>(null);
  const [a, setA] = useState<Assumptions | null>(null);
  const [b, setB] = useState<BuyingStatus | null>(null);
  const [o, setO] = useState<OfferTermsInput | null>(null);
  const [returned, setReturned] = useState<string | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [step, setStep] = useState<'build' | 'review'>('build');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const [lr, ar, br, sr] = await Promise.all([klyr.listing(id), klyr.assumptions(), klyr.buying(), klyr.offerStart(id)]);
      if (!lr.ok || !ar.ok || !br.ok || !sr.ok) return setError(errorText((lr.ok ? ar.ok ? br.ok ? sr : br : ar : lr).error));
      setL(lr.data); setA(ar.data); setB(br.data);
      const d = sr.data.draft;
      setO(d ? { listingId: id, price: d.price, deposit: d.deposit, irrevocableAt: d.irrevocableAt, ...d.terms } : sr.data.defaults);
      if (d?.status === 'returned') setReturned(d.agentNote);
      setConsent(sr.data.consent);
    })();
  }, [id]);

  const est = useMemo(() => (l && a && o ? buyerEstimate(
    { price: l.price, city: l.city, type: l.type as PropertyType, coop: l.coop, tax: l.annualTax ?? 0, fee: l.condoFee ?? undefined },
    { price: o.price, rate: a.rate, downPct: a.downPct, firstTime: a.firstTime, lawyer: a.lawyerFee }) : null), [l, a, o]);

  if (!l || !o || !b || !est) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const set = <K extends keyof OfferTermsInput>(k: K, v: OfferTermsInput[K]) => setO(x => (x ? { ...x, [k]: v } : x));
  const condo = l.type === 'Condo';
  const conds: [Cond, string][] = [['financingDays', 'Financing'], condo ? ['statusCertificateDays', 'Status certificate'] : ['inspectionDays', 'Inspection']];
  const firm = conds.every(([k]) => !o[k]);
  const agent = b.agent?.name ?? 'your agent';

  async function save() {
    setBusy(true); setError('');
    const r = await klyr.saveOffer(o!);
    setBusy(false);
    if (!r.ok) { setError(errorText(r.error)); return false; }
    setOfferId(r.data.id);
    return true;
  }
  async function signConsent() {
    setBusy(true); setError('');
    const r = await klyr.consentToOffer(id, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setConsent(r.data); setName(''); setRead(false);
  }
  async function sign() {
    if (!offerId) return;
    setBusy(true); setError('');
    const r = await klyr.signOffer(offerId, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.replace('/offers');
  }

  const hero = (
    <View style={{ backgroundColor: color.brandInk, borderRadius: 20, padding: 18, gap: 6 }} accessibilityLabel={`All-in at this offer: ${money(est.allIn)}`}>
      <Text style={{ ...t.label, color: '#8CC2B1' }}>ALL-IN AT THIS OFFER</Text>
      <Text style={{ ...display(600), fontSize: 38, letterSpacing: -0.6, color: '#fff' }}>{money(est.allIn)}</Text>
      <Text style={{ ...sora(), fontSize: 13, color: '#C9DDD6' }}>Cash back {money(est.cashBack)} · land transfer tax {money(est.ltt.total)}</Text>
    </View>
  );

  if (b.canBookVisits && consent && !(consent.buyerSignedAt && consent.sellerSignedAt)) {
    return (
      <Screen>
        <Back />
        <Title sub={`${l.address}, ${l.city} · OREA Form 326`}>{consent.buyerSignedAt ? 'Waiting for the seller' : 'Klyr represents this seller too'}</Title>
        {consent.buyerSignedAt ? (
          <Card><Text style={t.body}>You consented {when(consent.buyerSignedAt)}. You can make your offer as soon as the seller signs; we’ll let you know.</Text></Card>
        ) : stepUp ? (
          <StepUp reason="Signing a consent needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void signConsent(); }} />
        ) : (
          <Card>
            <Text style={t.body}>Before an offer, you and the seller both consent in writing to multiple representation. Klyr won’t tell the seller the most you’d pay, or tell you the least they’d take.</Text>
            <Check on={read} onPress={() => setRead(!read)}>I’ve read this. The standard OREA terms apply in full.</Check>
            <Field label={`Type your full name to consent (${me?.legalName ?? ''})`} value={name} onChangeText={setName} autoComplete="name" />
            <ErrorText>{error}</ErrorText>
            <Button title="Sign consent" busy={busy} disabled={!read || name.trim().length < 2} onPress={signConsent} />
          </Card>
        )}
      </Screen>
    );
  }

  if (step === 'review') {
    const rows: [string, string][] = [
      ['Price', money(o.price)],
      ['Deposit', o.deposit ? `${money(o.deposit)} to ${l.listingBrokerage} in trust, within 24 hours of acceptance` : 'None'],
      ['Open until', when(o.irrevocableAt)],
      ['Closing', longDate(o.closingDate)],
      ['Included', o.inclusions || 'Nothing beyond the property'],
      ...conds.filter(([k]) => o[k]).map(([k, label]) => [`${label}`, `${o[k]} banking days after acceptance`] as [string, string]),
      ...(firm ? [['Conditions', 'None: firm once accepted'] as [string, string]] : []),
    ];
    return (
      <Screen>
        <Back />
        <Title sub={`${l.address}, ${l.city} · OREA Form ${condo ? '101' : '100'}`}>Review your offer</Title>
        {hero}
        <Card>
          {rows.map(([k, v], i) => (
            <View key={k} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator, gap: 2 }}>
              <Text style={t.note}>{k}</Text><Text style={sora(600)}>{v}</Text>
            </View>
          ))}
        </Card>
        <Text style={t.note}>{agent} reviews your offer before it goes to {l.listingBrokerage}. You can withdraw it until the seller accepts.</Text>
        {stepUp ? (
          <StepUp reason="Signing an offer needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />
        ) : (
          <Card>
            <Check on={read} onPress={() => setRead(!read)}>I’ve read my offer. Once the seller accepts it, it’s a binding agreement.</Check>
            <Field label={`Type your full name to sign (${me?.legalName ?? ''})`} value={name} onChangeText={setName} autoComplete="name" />
            <ErrorText>{error}</ErrorText>
            <Button title={`Sign and send to ${agent}`} busy={busy} disabled={!read || name.trim().length < 2} onPress={sign} />
            <Button title="Change the offer" alt onPress={() => setStep('build')} />
          </Card>
        )}
      </Screen>
    );
  }

  const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
  return (
    <Screen>
      <Back />
      <Title sub={`${l.address}, ${l.city} · asking ${money(l.price)}`}>Make an offer</Title>
      {!b.canBookVisits && (
        <Card>
          <Text style={t.label}>● RULE · BEFORE AN OFFER</Text>
          <Text style={sora(700)}>{!b.agreement.signed ? 'Sign your buyer agreement first' : 'Verify your ID first'}</Text>
          <Button title={!b.agreement.signed ? 'Review and sign Form 300' : 'Verify my ID'} onPress={() => router.push(!b.agreement.signed ? '/sign-300' : '/id-check')} />
        </Card>
      )}
      {returned && <Card style={{ backgroundColor: '#FBEBDD' }}><Text style={{ ...sora(700), color: '#A54B00' }}>Your agent sent this back</Text><Text style={{ ...t.body, color: '#A54B00' }}>“{returned}”</Text></Card>}
      {hero}
      <Card>
        <Field label="Offer price" value={o.price.toLocaleString('en-CA')} onChangeText={v => set('price', n(v))} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[-10_000, -5_000, 5_000, 10_000].map(d => <Chip key={d} flex label={`${d > 0 ? '+' : '−'}${Math.abs(d) / 1000}K`} on={false} onPress={() => set('price', Math.max(0, o.price + d))} />)}
        </View>
        <Field label={`Deposit · usually ${OFFER_RULES.defaultDepositPct}%, within 24 hours of acceptance`} value={o.deposit.toLocaleString('en-CA')} onChangeText={v => set('deposit', n(v))} keyboardType="number-pad" />
      </Card>
      <Card>
        <Text style={t.label}>CONDITIONS · BANKING DAYS AFTER ACCEPTANCE</Text>
        {conds.map(([k, label]) => (
          <View key={k} style={{ gap: 6 }}>
            <Check on={!!o[k]} onPress={() => set(k, o[k] ? null : OFFER_RULES.defaultConditionDays)}>{label}</Check>
            {o[k] ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[3, 5, 7, 10].map(d => <Chip key={d} flex label={String(d)} on={o[k] === d} onPress={() => set(k, d)} />)}
              </View>
            ) : null}
          </View>
        ))}
        {firm && <Text style={{ ...sora(600), fontSize: 13, color: '#A54B00', backgroundColor: '#FBEBDD', padding: 10, borderRadius: 10 }}>No conditions: you’re firm the moment it’s accepted. Get your mortgage approval first.</Text>}
      </Card>
      <Card>
        <Text style={t.label}>OPEN UNTIL · {when(o.irrevocableAt).toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[['Tonight', 0], ['Tomorrow', 1], ['In 2 days', 2]].map(([label, d]) => (
            <Chip key={label as string} flex label={label as string} on={Date.parse(o.irrevocableAt) === Date.parse(tonightPlus(d as number))} onPress={() => set('irrevocableAt', tonightPlus(d as number))} />
          ))}
        </View>
        <Text style={t.label}>CLOSING · {longDate(o.closingDate).toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[30, 60, 90].map(d => <Chip key={d} flex label={`${d} days`} on={o.closingDate === ymdPlus(d)} onPress={() => set('closingDate', ymdPlus(d))} />)}
        </View>
        <Field label="Closing date (YYYY-MM-DD)" value={o.closingDate} onChangeText={v => set('closingDate', v)} />
        <Field label="Included" value={o.inclusions} onChangeText={v => set('inclusions', v)} />
        <Field label={`Note for ${agent} (optional)`} value={o.noteToAgent} onChangeText={v => set('noteToAgent', v)} />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title="Review and sign" busy={busy} disabled={!b.canBookVisits} onPress={async () => { if (await save()) setStep('review'); }} />
      <Button title="Save draft" alt disabled={!b.canBookVisits || busy} onPress={() => void save()} />
    </Screen>
  );
}
