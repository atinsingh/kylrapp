import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import type { BuyingStatus, SellProperty, Selling, SellTaskInput, SellTaskKey } from '@klyr/api-client';
import { COOP_CHOICES } from '@klyr/contracts';
import { money, sellerNet, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { Button, Card, Check, Chip, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const pct = (c: number) => `${(c * 100).toFixed(1)}%`;
const STEPS: Record<SellTaskKey, [string, [string, string, boolean?][]]> = {
  payout: ['Mortgage payout', [['lender', 'Lender'], ['balance', 'Balance owing']]],
  photos: ['Photos and floor plan', []],
  inspection: ['Pre-listing inspection (optional)', []],
  rules: ['Showings and offer date', [['showings', 'Showings (e.g. weekdays 5–8 pm)'], ['offerDate', 'Offer date (optional)']]],
  approve: ['Approve the listing', [['description', 'Description', true], ['inclusions', 'Included']]],
};

/** Selling on the phone: the same steps as the web — net and plan, Form 200, prep, live. */
export default function Sell() {
  const { me } = useAuth();
  const [s, setS] = useState<Selling | null | undefined>(undefined);
  const [b, setB] = useState<BuyingStatus | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [sr, br] = await Promise.all([klyr.selling(), klyr.buying()]);
    if (br.ok) setB(br.data);
    if (sr.ok) setS(sr.data); else if (sr.status === 404) setS(null); else setError(errorText(sr.error));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (s === undefined) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  return (
    <Screen>
      <Back />
      {!s ? <Start onDone={setS} /> : !s.agreement
        ? <PlanSign s={s} legalName={me?.legalName ?? ''} idVerified={b?.idCheck.status === 'verified'} onDone={setS} />
        : <Prep s={s} onDone={setS} />}
    </Screen>
  );
}

function Start({ onDone }: { onDone: (s: Selling) => void }) {
  const [p, setP] = useState<SellProperty & { listPrice: number; mortgageBalance: number }>({ address: '', city: '', type: 'House', beds: 3, baths: 2, listPrice: 0, mortgageBalance: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP(x => ({ ...x, [k]: v }));
  async function start() {
    setBusy(true); setError('');
    const r = await klyr.startSelling({ ...p, unit: p.unit || undefined });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  return (
    <>
      <Title sub="See what you keep. You choose the plan and what you offer the buyer’s brokerage.">Sell your home</Title>
      <Card>
        <Field label="Street address" value={p.address} onChangeText={v => set('address', v)} autoComplete="street-address" />
        <Field label="Unit (optional)" value={p.unit ?? ''} onChangeText={v => set('unit', v)} />
        <Field label="City" value={p.city} onChangeText={v => set('city', v)} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['House', 'Townhouse', 'Condo'] as const).map(x => <Chip key={x} flex label={x} on={p.type === x} onPress={() => set('type', x)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Bedrooms" value={String(p.beds)} onChangeText={v => set('beds', n(v))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Bathrooms" value={String(p.baths)} onChangeText={v => set('baths', n(v))} keyboardType="number-pad" /></View>
        </View>
        <Field label="Asking price" value={p.listPrice ? p.listPrice.toLocaleString('en-CA') : ''} onChangeText={v => set('listPrice', n(v))} keyboardType="number-pad" />
        <Field label="Mortgage balance (0 if none)" value={p.mortgageBalance.toLocaleString('en-CA')} onChangeText={v => set('mortgageBalance', n(v))} keyboardType="number-pad" />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title="See my net and plans" busy={busy} disabled={!p.address.trim() || !p.city.trim() || p.listPrice < 50_000} onPress={start} />
    </>
  );
}

function PlanSign({ s, legalName, idVerified, onDone }: { s: Selling; legalName: string; idVerified: boolean; onDone: (s: Selling) => void }) {
  const [plan, setPlan] = useState(s.plan);
  const [coop, setCoop] = useState(s.coop);
  const [step, setStep] = useState<'plan' | 'sign'>('plan');
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const net = (pl: Selling['plan']) => sellerNet({ price: s.listPrice, plan: pl, coop, mortgageBalance: s.mortgageBalance });
  const cur = net(plan);
  const agent = s.agent?.name ?? 'your agent';

  async function save() {
    setBusy(true); setError('');
    const r = await klyr.setSellPlan({ plan, coop, listPrice: s.listPrice, mortgageBalance: s.mortgageBalance });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setStep('sign');
  }
  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.signListing(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }

  const hero = (
    <View style={{ backgroundColor: color.brandInk, borderRadius: 20, padding: 18, gap: 6 }} accessibilityLabel={`You keep about ${money(cur.net)}`}>
      <Text style={{ ...t.label, color: '#8CC2B1' }}>{s.property.address.toUpperCase()} · YOU KEEP ABOUT</Text>
      <Text style={{ ...sora(800), fontSize: 34, color: '#fff' }}>{money(cur.net)}</Text>
      <Text style={{ ...sora(), fontSize: 13, color: '#C9DDD6' }}>Fee {money(cur.fee)} · buyer’s brokerage {money(cur.coop)} · about {money(cur.vsTraditional)} more than 2.5%</Text>
    </View>
  );

  if (step === 'sign') return (
    <>
      <Title sub={`${s.property.address} · OREA Form 200 summary`}>Your listing agreement</Title>
      {hero}
      <Card>
        {[['Term', '90 days, 60-day holdover.'], ['Klyr’s fee', plan === 'flat' ? `${money(s.fees.flat)} + HST, Self-directed.` : `${s.fees.percentPct}% + HST, Assisted.`],
          ['Buyer’s brokerage', `${pct(coop)} + HST. You chose this.`], ['Offers', 'You decide on every offer.']].map(([k, v], i) => (
          <View key={k} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator, gap: 2 }}><Text style={t.note}>{k}</Text><Text style={sora(600)}>{v}</Text></View>
        ))}
      </Card>
      {!idVerified ? (
        <Card>
          <Text style={t.label}>● RULE · BEFORE YOU SIGN</Text>
          <Text style={sora(700)}>Verify your ID first</Text>
          <Button title="Verify my ID" onPress={() => router.push('/id-check')} />
        </Card>
      ) : stepUp ? (
        <StepUp reason="Signing your listing agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />
      ) : (
        <Card>
          <Check on={read} onPress={() => setRead(!read)}>I’ve read the summary. The standard OREA terms apply in full.</Check>
          <Field label={`Type your full name to sign (${legalName})`} value={name} onChangeText={setName} autoComplete="name" />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign listing agreement" busy={busy} disabled={!read || name.trim().length < 2} onPress={sign} />
        </Card>
      )}
      <Button title="Change the plan" alt onPress={() => setStep('plan')} />
    </>
  );

  return (
    <>
      <Title sub={`${s.property.address}, ${s.property.city} · asking ${money(s.listPrice)}`}>Your plan</Title>
      {hero}
      <Card>
        <Text style={t.label}>YOUR PLAN</Text>
        <Check on={plan === 'flat'} onPress={() => setPlan('flat')}>{`Self-directed · ${money(s.fees.flat)} + HST · you keep ${money(net('flat').net)}`}</Check>
        <Check on={plan === 'percent'} onPress={() => setPlan('percent')}>{`Assisted · ${s.fees.percentPct}% + HST, ${agent} runs showings · you keep ${money(net('percent').net)}`}</Check>
      </Card>
      <Card>
        <Text style={t.label}>TO THE BUYER’S BROKERAGE · YOUR CHOICE</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {COOP_CHOICES.map(c => <Chip key={c} flex label={pct(c)} on={coop === c} onPress={() => setCoop(c)} />)}
        </View>
        <Text style={t.note}>Most Toronto-area listings offer 2–2.5%.</Text>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title="Continue to the listing agreement" busy={busy} onPress={save} />
    </>
  );
}

function Prep({ s, onDone }: { s: Selling; onDone: (s: Selling) => void }) {
  const [open, setOpen] = useState<SellTaskKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = s.stage !== 'preparing';
  async function save(key: SellTaskKey) {
    setBusy(true); setError('');
    const clean = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    const r = await klyr.sellTask({ key, ...clean, ...(key === 'payout' ? { balance: n(form.balance ?? '') } : {}) } as SellTaskInput);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setForm({}); onDone(r.data);
  }
  return (
    <>
      <View style={{ backgroundColor: color.brandInk, borderRadius: 20, padding: 18, gap: 6 }}>
        <Text style={{ ...t.label, color: '#8CC2B1' }}>{s.property.address.toUpperCase()} · {money(s.listPrice)}</Text>
        <Text accessibilityRole="header" style={{ ...sora(800), fontSize: 30, color: '#fff' }}>{live ? 'You’re live' : 'Getting ready'}</Text>
        <Text style={{ ...sora(), fontSize: 13, color: '#C9DDD6' }}>{live ? `Listed ${torontoWhen(s.publishedAt!)}. Showing requests and offers come here.` : `You keep about ${money(s.net.net)}.`}</Text>
      </View>
      {live && s.listingId && <Button title="See your listing" alt onPress={() => router.push(`/listing/${s.listingId}`)} />}
      <Card>
        <Text style={t.label}>{live ? 'PREP' : 'BEFORE YOU GO LIVE'} · {s.tasks.filter(x => x.doneAt).length} OF {s.tasks.length} DONE</Text>
        {s.tasks.map((x, i) => {
          const [title, fields] = STEPS[x.key];
          const agentStep = x.key === 'photos' || x.key === 'inspection';
          return (
            <View key={x.key} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator, gap: 6 }}>
              <Text style={sora(700)}>{x.doneAt ? '✓ ' : ''}{title}</Text>
              <Text style={t.note}>{x.doneAt ? `Done ${torontoWhen(x.doneAt)}` : agentStep ? `${s.agent?.name ?? 'Your agent'} books this.` : 'To do'}</Text>
              {!live && !agentStep && open !== x.key && <Button title={x.doneAt ? 'Change' : x.key === 'approve' ? 'Review and approve' : 'Add details'} alt onPress={() => { setOpen(x.key); setError(''); setForm(x.key === 'payout' ? { balance: String(s.mortgageBalance) } : {}); }} />}
              {open === x.key && (
                <>
                  {fields.map(([f, label, long]) => (
                    <Field key={f} label={label} multiline={long} value={f === 'balance' ? Number(form[f] || 0).toLocaleString('en-CA') : form[f] ?? ''}
                      keyboardType={f === 'balance' ? 'number-pad' : undefined} onChangeText={v => setForm(y => ({ ...y, [f]: f === 'balance' ? String(n(v)) : v }))} />
                  ))}
                  <ErrorText>{error}</ErrorText>
                  <Button title={x.key === 'approve' ? 'Approve' : 'Save'} busy={busy} onPress={() => save(x.key)} />
                  <Button title="Back" alt onPress={() => setOpen(null)} />
                </>
              )}
            </View>
          );
        })}
      </Card>
    </>
  );
}
