import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import type { BuyingStatus, SellerDecision, SellProperty, Selling, SellTaskInput, SellTaskKey } from '@klyr/api-client';
import { COOP_CHOICES } from '@klyr/contracts';
import { calendarDate, money, sellerNet, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { serif, Button, Card, Check, Chip, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';
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
        : <Prep s={s} legalName={me?.legalName ?? ''} onDone={setS} />}
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
      <Text style={{ ...serif(600), fontSize: 38, letterSpacing: -0.6, color: '#fff' }}>{money(cur.net)}</Text>
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

function Prep({ s, legalName, onDone }: { s: Selling; legalName: string; onDone: (s: Selling) => void }) {
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
        <Text accessibilityRole="header" style={{ ...serif(600), fontSize: 34, letterSpacing: -0.6, color: '#fff' }}>{s.sale ? (s.sale.closedAt ? 'Sold' : s.sale.stage === 'conditional' ? 'Conditional sale' : 'Sold firm') : live ? 'You’re live' : 'Getting ready'}</Text>
        <Text style={{ ...sora(), fontSize: 13, color: '#C9DDD6' }}>{s.sale ? `Accepted at ${money(s.sale.price)} · closing ${s.sale.closingDate ? calendarDate(s.sale.closingDate) : 'to be set'} · you keep about ${money(s.sale.net)}` : live ? `Listed ${torontoWhen(s.publishedAt!)}. Showing requests and offers come here.` : `You keep about ${money(s.net.net)}.`}</Text>
      </View>
      {live && s.listingId && <Button title="See your listing" alt onPress={() => router.push(`/listing/${s.listingId}`)} />}
      {live && <Market s={s} legalName={legalName} onDone={onDone} />}
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

const STATUS: Record<string, string> = { registered: 'Waiting for your answer', signed_back: 'You signed back', accepted: 'Accepted', rejected: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn', void: 'Ended' };

/** Consents to sign and offers with what you'd keep at each price. */
function Market({ s, legalName, onDone }: { s: Selling; legalName: string; onDone: (s: Selling) => void }) {
  const [open, setOpen] = useState<{ id: string; action: 'consent' | 'accept' | 'sign_back' | 'decline' } | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(id: string, action: 'consent' | 'accept' | 'sign_back' | 'decline') {
    setBusy(true); setError('');
    const d: SellerDecision = action === 'accept' ? { result: 'accepted', typedName: name, readConfirmed: true }
      : action === 'sign_back' ? { result: 'signed_back', price, irrevocableAt: new Date(Date.now() + 6 * 3_600_000).toISOString(), typedName: name, readConfirmed: true }
      : { result: 'rejected' };
    const r = action === 'consent' ? await klyr.signSellerConsent(id, name) : await klyr.decideOffer(id, d);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setName(''); setRead(false); onDone(r.data);
  }
  const signBox = (title: string) => stepUp
    ? <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void run(open!.id, open!.action); }} />
    : (
      <>
        <Check on={read} onPress={() => setRead(!read)}>I’ve read this. Once signed, it’s binding.</Check>
        <Field label={`Type your full name to sign (${legalName})`} value={name} onChangeText={setName} autoComplete="name" />
        <ErrorText>{error}</ErrorText>
        <Button title={title} busy={busy} disabled={!read || name.trim().length < 2 || (open?.action === 'sign_back' && price <= 0)} onPress={() => run(open!.id, open!.action)} />
        <Button title="Back" alt onPress={() => setOpen(null)} />
      </>
    );

  return (
    <>
      {s.consents.filter(c => !c.sellerSignedAt).map(c => (
        <Card key={c.id}>
          <Text style={t.label}>● ACTION · OREA FORM 326</Text>
          <Text style={sora(700)}>A Klyr buyer wants to make an offer</Text>
          <Text style={t.note}>{c.buyer} is also a Klyr client. They can offer once you consent to Klyr representing both of you. Klyr won’t tell the buyer the least you’d take.</Text>
          {open?.id === c.id ? signBox('Sign consent') : <Button title="Review and sign" onPress={() => { setOpen({ id: c.id, action: 'consent' }); setRead(false); setName(''); }} />}
        </Card>
      ))}
      {s.offers.length > 0 && <Text style={t.label}>OFFERS · {s.offers.filter(o => o.status === 'registered').length} WAITING FOR YOU</Text>}
      {s.offers.map(o => (
        <Card key={o.id}>
          <Text style={{ ...serif(600), fontSize: 26, letterSpacing: -0.6 }}>{money(o.price)}</Text>
          <Text style={sora(700)}>You’d keep about {money(o.net)}</Text>
          <Text style={t.note}>{STATUS[o.status] ?? o.status} · deposit {money(o.deposit)} · {o.conditions.length ? o.conditions.join(' · ') : 'no conditions'} · closing {calendarDate(o.closingDate)}</Text>
          {o.signBack && <Text style={t.note}>Your sign-back: {money(o.signBack.price)} · {STATUS[o.signBack.status] ?? o.signBack.status}</Text>}
          {o.status === 'registered' && (open?.id === o.id ? (
            <>
              {open.action === 'sign_back' && <Field label="Your price" value={price ? price.toLocaleString('en-CA') : ''} onChangeText={v => setPrice(n(v))} keyboardType="number-pad" />}
              {open.action === 'sign_back' && price > 0 && <Text style={t.note}>You’d keep about {money(sellerNet({ price, plan: s.plan, coop: s.coop, mortgageBalance: s.mortgageBalance }).net)}. The buyer has 6 hours to answer.</Text>}
              {open.action === 'decline'
                ? <><Button title="Decline this offer" busy={busy} onPress={() => run(o.id, 'decline')} /><Button title="Back" alt onPress={() => setOpen(null)} /></>
                : signBox(open.action === 'accept' ? `Accept ${money(o.price)}` : 'Sign back')}
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Chip flex label="Accept" on={false} onPress={() => { setOpen({ id: o.id, action: 'accept' }); setRead(false); setName(''); }} />
              <Chip flex label="Sign back" on={false} onPress={() => { setOpen({ id: o.id, action: 'sign_back' }); setPrice(Math.max(o.price, s.listPrice)); setRead(false); setName(''); }} />
              <Chip flex label="Decline" on={false} onPress={() => setOpen({ id: o.id, action: 'decline' })} />
            </View>
          ))}
        </Card>
      ))}
      {s.visits.length > 0 && (
        <Card>
          <Text style={t.label}>VISITS · {s.visits.filter(v => v.status === 'completed').length} DONE</Text>
          {s.visits.map(v => <Text key={v.id} style={t.note}>{torontoWhen(v.at)} · {v.status === 'completed' ? 'visited' : v.status}{v.feedback ? ` · ${v.feedback.interest === 'yes' ? 'would consider an offer' : v.feedback.interest === 'maybe' ? 'maybe' : 'not for them'}, priced ${v.feedback.price}` : ''}</Text>)}
        </Card>
      )}
    </>
  );
}
