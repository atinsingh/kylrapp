import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { LeaseProperty, Leasing } from '@klyr/api-client';
import { landlordNet, money, moneyCents, rentControlled, TENANT_SIDE_CHOICES, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { display, Button, Card, Check, Chip, ErrorText, Field, Screen, sf, t, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const SIDE: Record<number, string> = { 0: 'None', 0.5: '½ month', 1: '1 month' };
const ymd = /^\d{4}-\d{2}-\d{2}$/;

/** Leasing out on the phone: first year after fees, Form 210, then consents, applicants, viewings and deposit interest. */
export default function Lease() {
  const { me } = useAuth();
  const [l, setL] = useState<Leasing | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    void klyr.leasing().then(r => (r.ok ? setL(r.data) : r.status === 404 ? setL(null) : setError(errorText(r.error))));
  }, []);
  useFocusEffect(load);
  if (l === undefined) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const name = me?.legalName ?? '';
  return (
    <Screen>
      <Back />
      {!l ? <Start onDone={setL} /> : !l.agreement ? <PlanSign l={l} legalName={name} onDone={setL} /> : <Live l={l} legalName={name} onDone={setL} />}
    </Screen>
  );
}

function Start({ onDone }: { onDone: (l: Leasing) => void }) {
  const [p, setP] = useState<LeaseProperty & { rent: number; availableFrom: string }>({ address: '', city: '', type: 'Condo', beds: 1, baths: 1, firstOccupied: '', parking: '', utilities: '', furnished: false, description: '', rent: 0, availableFrom: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP(x => ({ ...x, [k]: v }));
  async function start() {
    setBusy(true); setError('');
    const r = await klyr.startLeasing({ ...p, unit: p.unit || undefined });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  return (
    <>
      <Title sub="See your first year’s rent after fees, then choose from applicants compared on the same terms.">Lease out your home</Title>
      <Card>
        <Field label="Street address" value={p.address} onChangeText={v => set('address', v)} />
        <Field label="Unit (optional)" value={p.unit ?? ''} onChangeText={v => set('unit', v)} />
        <Field label="City" value={p.city} onChangeText={v => set('city', v)} />
        <View style={{ flexDirection: 'row', gap: 6 }}>{(['House', 'Townhouse', 'Condo'] as const).map(x => <Chip key={x} flex label={x} on={p.type === x} onPress={() => set('type', x)} />)}</View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Bedrooms" value={String(p.beds)} onChangeText={v => set('beds', n(v))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Bathrooms" value={String(p.baths)} onChangeText={v => set('baths', n(v))} keyboardType="number-pad" /></View>
        </View>
        <Field label="First lived in (YYYY-MM-DD)" value={p.firstOccupied} onChangeText={v => set('firstOccupied', v)} />
        {ymd.test(p.firstOccupied) && <Text style={t.note}>{rentControlled(p.firstOccupied) ? 'Rent-controlled: increases capped at the yearly guideline.' : 'Not rent-controlled (first occupied after Nov 15, 2018).'}</Text>}
        <Field label="Description" value={p.description} onChangeText={v => set('description', v)} multiline />
        <Field label="Rent a month" value={p.rent ? p.rent.toLocaleString('en-CA') : ''} onChangeText={v => set('rent', n(v))} keyboardType="number-pad" />
        <Field label="Available from (YYYY-MM-DD)" value={p.availableFrom} onChangeText={v => set('availableFrom', v)} />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title="See my first-year rent" busy={busy} disabled={!p.address.trim() || !p.city.trim() || !ymd.test(p.firstOccupied) || !p.description.trim() || p.rent < 300 || !ymd.test(p.availableFrom)} onPress={start} />
    </>
  );
}

function PlanSign({ l, legalName, onDone }: { l: Leasing; legalName: string; onDone: (l: Leasing) => void }) {
  const [side, setSide] = useState(l.tenantSidePct as 0 | 0.5 | 1);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const net = landlordNet({ rent: l.rent, tenantSidePct: side });
  async function sign() {
    setBusy(true); setError('');
    const p = await klyr.setLeasePlan({ rent: l.rent, tenantSidePct: side, availableFrom: l.availableFrom });
    if (!p.ok) { setBusy(false); return setError(errorText(p.error)); }
    const r = await klyr.signLeaseListing(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  return (
    <>
      <View style={{ backgroundColor: color.panel, borderRadius: 20, padding: 18, gap: 6 }} accessibilityLabel={`First year after fees ${money(net.net)}`}>
        <Text style={{ ...t.label, color: '#98989D' }}>{l.property.address.toUpperCase()} · FIRST YEAR AFTER FEES</Text>
        <Text style={{ ...display(600), fontSize: 38, letterSpacing: -0.6, color: '#fff' }}>{money(net.net)}</Text>
        <Text style={{ ...sf(), fontSize: 13, color: '#AEAEB2' }}>12 × {money(l.rent)} · Klyr fee {money(net.fee)} · tenant’s brokerage {money(net.tenantSide)}</Text>
      </View>
      <Card>
        <Text style={t.label}>TO THE TENANT’S BROKERAGE · YOUR CHOICE</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>{TENANT_SIDE_CHOICES.map(c => <Chip key={c} flex label={SIDE[c]!} on={side === c} onPress={() => setSide(c)} />)}</View>
      </Card>
      {stepUp ? <StepUp reason="Signing your listing agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} /> : (
        <Card>
          <Text style={t.label}>OREA FORM 210 · SUMMARY</Text>
          <Text style={t.note}>60 days, 30-day holdover. Klyr’s fee {money(l.fee)} + HST once a lease is signed. Every applicant is compared on the same facts; choosing on Human Rights Code grounds is against the law.</Text>
          <Check on={read} onPress={() => setRead(!read)}>I’ve read the summary. The standard OREA terms apply in full.</Check>
          <Field label={`Type your full name to sign (${legalName})`} value={name} onChangeText={setName} autoComplete="name" />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign listing agreement" busy={busy} disabled={!read || name.trim().length < 2} onPress={sign} />
        </Card>
      )}
    </>
  );
}

function Live({ l, legalName, onDone }: { l: Leasing; legalName: string; onDone: (l: Leasing) => void }) {
  const [open, setOpen] = useState<{ id: string; kind: 'consent' | 'accept' | 'decline' } | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leased = l.applications.find(a => a.status === 'accepted');

  async function run(id: string, kind: 'consent' | 'accept' | 'decline') {
    setBusy(true); setError('');
    const r = kind === 'consent' ? await klyr.signLandlordConsent(id, name)
      : await klyr.decideApplication(id, kind === 'accept' ? { result: 'accepted', typedName: name, readConfirmed: true } : { result: 'declined' });
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setName(''); setRead(false); onDone(r.data);
  }
  async function interest(dueDate: string, method: 'paid' | 'topped_up') {
    const r = await klyr.recordDepositInterest(dueDate, method);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  const sign = (title: string) => stepUp
    ? <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void run(open!.id, open!.kind); }} />
    : (
      <>
        <Check on={read} onPress={() => setRead(!read)}>I’ve read this. Once signed, it’s binding.</Check>
        <Field label={`Type your full name to sign (${legalName})`} value={name} onChangeText={setName} autoComplete="name" />
        <ErrorText>{error}</ErrorText>
        <Button title={title} busy={busy} disabled={!read || name.trim().length < 2} onPress={() => run(open!.id, open!.kind)} />
        <Button title="Back" alt onPress={() => setOpen(null)} />
      </>
    );

  return (
    <>
      <View style={{ backgroundColor: color.panel, borderRadius: 20, padding: 18, gap: 6 }}>
        <Text style={{ ...t.label, color: '#98989D' }}>{l.property.address.toUpperCase()} · {money(l.rent)}/MONTH</Text>
        <Text accessibilityRole="header" style={{ ...display(600), fontSize: 34, letterSpacing: -0.6, color: '#fff' }}>{leased ? 'Leased' : l.publishedAt ? 'You’re live' : 'Getting listed'}</Text>
        <Text style={{ ...sf(), fontSize: 13, color: '#AEAEB2' }}>
          {leased ? `${leased.name} at ${money(leased.rent)}/month from ${leased.startDate}. Next: the Ontario Standard Lease.` : l.publishedAt ? `Listed ${torontoWhen(l.publishedAt)}.` : `${l.agent?.name ?? 'Your agent'} adds photos and publishes it.`}
        </Text>
      </View>
      {l.consents.filter(c => !c.sellerSignedAt).map(c => (
        <Card key={c.id}>
          <Text style={t.label}>● ACTION · OREA FORM 326</Text>
          <Text style={sf(700)}>A Klyr tenant wants to apply</Text>
          <Text style={t.note}>Klyr represents you both. Klyr won’t tell the tenant the least rent you’d take, or tell you the most they’d pay.</Text>
          {open?.id === c.id ? sign('Sign consent') : <Button title="Review and sign" onPress={() => { setOpen({ id: c.id, kind: 'consent' }); setRead(false); setName(''); }} />}
        </Card>
      ))}
      {l.applications.length > 0 && <Text style={t.label}>APPLICANTS · SAME FACTS FOR EVERYONE</Text>}
      {l.applications.map(a => (
        <Card key={a.id}>
          <Text style={sf(700)}>{a.name} · {money(a.rent)}/month</Text>
          <Text style={t.note}>{a.startDate} · {a.termMonths} months · income {money(a.screening.monthlyIncome)} ({a.screening.incomeToRent}× rent) · {a.screening.jobTitle}, {a.screening.employer}</Text>
          <Text style={t.note}>{a.screening.occupants} occupant(s) · pets: {a.screening.pets ?? 'none'} · {a.screening.references} reference(s) · credit check {a.screening.creditConsent ? 'allowed' : 'not allowed'} · {a.status}</Text>
          {!leased && a.status === 'submitted' && (open?.id === a.id ? (open.kind === 'decline'
            ? <><Button title={`Decline ${a.name}`} busy={busy} onPress={() => run(a.id, 'decline')} /><Button title="Back" alt onPress={() => setOpen(null)} /></>
            : sign(`Accept ${a.name}`)) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Chip flex label="Accept" on={false} onPress={() => { setOpen({ id: a.id, kind: 'accept' }); setRead(false); setName(''); }} />
              <Chip flex label="Decline" on={false} onPress={() => setOpen({ id: a.id, kind: 'decline' })} />
            </View>
          ))}
        </Card>
      ))}
      {l.viewings.length > 0 && (
        <Card>
          <Text style={t.label}>VIEWINGS · {l.viewings.filter(v => v.status === 'completed').length} DONE</Text>
          {l.viewings.map(v => <Text key={v.id} style={t.note}>{torontoWhen(v.at)} · {v.status === 'completed' ? 'viewed' : v.status}{v.feedback ? ` · ${v.feedback.interest === 'yes' ? 'would apply' : v.feedback.interest === 'maybe' ? 'maybe' : 'not for them'}, priced ${v.feedback.price}` : ''}</Text>)}
        </Card>
      )}
      {leased && l.interest.length > 0 && (
        <Card>
          <Text style={t.label}>INTEREST ON THE DEPOSIT</Text>
          {l.interest.map(i => (
            <View key={i.dueDate} style={{ gap: 6 }}>
              <Text style={sf(600)}>{moneyCents(i.amount)} ({i.pct}%) due {i.dueDate}{i.method ? ` · ${i.method === 'paid' ? 'paid' : 'kept to top up'}` : ''}</Text>
              {!i.method && Date.parse(i.dueDate) - Date.now() <= 30 * 86_400_000 && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Chip flex label="I paid it" on={false} onPress={() => void interest(i.dueDate, 'paid')} />
                  <Chip flex label="Kept to top up" on={false} onPress={() => void interest(i.dueDate, 'topped_up')} />
                </View>
              )}
            </View>
          ))}
          <ErrorText>{error}</ErrorText>
        </Card>
      )}
    </>
  );
}
