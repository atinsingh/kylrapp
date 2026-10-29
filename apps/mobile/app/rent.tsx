import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Rental, Renting, TenantProfile } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { Button, Card, Check, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
export const STATUS = { submitted: 'With the landlord', accepted: 'Approved', declined: 'Not chosen', withdrawn: 'Withdrawn' } as const;
export const rentControl = (r: Pick<Rental, 'rentControlled' | 'guideline'>) =>
  r.rentControlled == null ? '' : r.rentControlled ? `Rent-controlled · capped at ${r.guideline.pct}% in ${r.guideline.year}` : 'Not rent-controlled';

/** Renting on the phone: Form 346 ($0), the profile, and rentals with move-in cost and rent control. */
export default function Rent() {
  const { me } = useAuth();
  const [r, setR] = useState<Renting | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    void Promise.all([klyr.renting(), klyr.rentals()]).then(([a, b]) => {
      if (a.ok) setR(a.data); else setError(errorText(a.error));
      if (b.ok) setRentals(b.data);
    });
  }, []);
  useFocusEffect(load);
  if (!r) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const applied = new Map(r.applications.map(a => [a.listingId, a.status]));
  return (
    <Screen>
      <Back />
      <Title sub="No fee to you. Every rental shows the move-in cost and whether increases are capped.">Rent a home</Title>
      {!r.agreement ? <Agreement legalName={me?.legalName ?? ''} onDone={setR} /> : !r.profile ? <Profile onDone={setR} /> : (
        <Card>
          <Text style={t.label}>YOUR RENTAL PROFILE</Text>
          <Text style={t.note}>{money(r.profile.monthlyIncome)}/month · {r.profile.jobTitle}, {r.profile.employer} · {r.profile.occupants} occupant(s)</Text>
        </Card>
      )}
      {r.viewings.map(v => (
        <Card key={v.id}>
          <Text style={sora(700)}>Viewing · {v.address}</Text>
          <Text style={t.note}>{torontoWhen(v.at)} · {v.status === 'completed' ? (v.feedback ? 'viewed · feedback sent' : 'viewed · open it to tell us how it went') : v.status}</Text>
        </Card>
      ))}
      {r.applications.map(a => <Card key={a.id}><Text style={sora(700)}>{a.address}</Text><Text style={t.note}>{money(a.rent)}/month · {STATUS[a.status]}{a.status === 'accepted' ? ` · next: sign the Ontario Standard Lease and pay ${money(a.moveIn.total)} (first and last month)` : ''}</Text></Card>)}
      {rentals.map(x => (
        <Pressable key={x.id} accessibilityRole="link" accessibilityLabel={`${x.address}, ${money(x.rent)} a month`} onPress={() => router.push(`/rental/${x.id}`)}
          style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
          {x.photo && <Image source={{ uri: x.photo.url }} accessibilityLabel={x.photo.alt} style={{ width: '100%', height: 160 }} />}
          <View style={{ padding: 14, gap: 4 }}>
            <Text style={{ ...sora(800), fontSize: 20 }}>{money(x.rent)}<Text style={t.note}> /month</Text></Text>
            <Text style={sora(600)}>{x.address}, {x.city}</Text>
            <Text style={t.note}>{x.beds} bd · {x.baths} ba · move-in {money(x.moveIn.total)} (first and last month)</Text>
            <Text style={{ ...sora(600), fontSize: 12, color: x.rentControlled ? '#2B7A4B' : '#A54B00' }}>{rentControl(x)}</Text>
            {applied.has(x.id) && <Text style={{ ...sora(700), fontSize: 12, color: color.brand }}>You applied · {STATUS[applied.get(x.id)!]}</Text>}
            <Text style={t.note}>Listing brokerage: {x.listingBrokerage}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

function Agreement({ legalName, onDone }: { legalName: string; onDone: (r: Renting) => void }) {
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.signTenantAgreement(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  if (stepUp) return <StepUp reason="Signing your tenant agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;
  return (
    <Card>
      <Text style={t.label}>● RULE · OREA FORM 346</Text>
      <Text style={sora(700)}>Your tenant agreement · $0 to you</Text>
      <Text style={t.note}>60 days. Klyr is paid by the landlord. We find rentals, prepare your application and explain the Ontario Standard Lease.</Text>
      <Check on={read} onPress={() => setRead(!read)}>I’ve read the summary. The standard OREA terms apply in full.</Check>
      <Field label={`Type your full name to sign (${legalName})`} value={name} onChangeText={setName} autoComplete="name" />
      <ErrorText>{error}</ErrorText>
      <Button title="Sign tenant agreement" busy={busy} disabled={!read || name.trim().length < 2} onPress={sign} />
    </Card>
  );
}

function Profile({ onDone }: { onDone: (r: Renting) => void }) {
  const [p, setP] = useState<TenantProfile>({ monthlyIncome: 0, employer: '', jobTitle: '', occupants: 1, moveIn: '', references: [{ name: '', phone: '', relation: 'landlord' }], creditConsent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof TenantProfile>(k: K, v: TenantProfile[K]) => setP(x => ({ ...x, [k]: v }));
  const ref = (k: 'name' | 'phone', v: string) => setP(x => ({ ...x, references: [{ ...x.references[0]!, [k]: v }] }));
  async function save() {
    setBusy(true); setError('');
    const r = await klyr.saveTenantProfile({ ...p, pets: p.pets || undefined });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }
  return (
    <Card>
      <Text style={t.label}>YOUR RENTAL PROFILE · FILLS EVERY APPLICATION</Text>
      <Text style={t.note}>Only what Ontario landlords may ask: income, work, references and, with your consent, credit.</Text>
      <Field label="Monthly income before tax" value={p.monthlyIncome ? p.monthlyIncome.toLocaleString('en-CA') : ''} onChangeText={v => set('monthlyIncome', n(v))} keyboardType="number-pad" />
      <Field label="Employer" value={p.employer} onChangeText={v => set('employer', v)} />
      <Field label="Job title" value={p.jobTitle} onChangeText={v => set('jobTitle', v)} />
      <Field label="Occupants (including you)" value={String(p.occupants)} onChangeText={v => set('occupants', n(v) || 1)} keyboardType="number-pad" />
      <Field label="Move-in date (YYYY-MM-DD)" value={p.moveIn} onChangeText={v => set('moveIn', v)} />
      <Field label="Reference: name" value={p.references[0]!.name} onChangeText={v => ref('name', v)} />
      <Field label="Reference: phone" value={p.references[0]!.phone} onChangeText={v => ref('phone', v)} keyboardType="phone-pad" />
      <Check on={p.creditConsent} onPress={() => set('creditConsent', !p.creditConsent)}>Landlords I apply to may run a credit check.</Check>
      <ErrorText>{error}</ErrorText>
      <Button title="Save profile" busy={busy} disabled={!p.monthlyIncome || !p.employer.trim() || !p.jobTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.moveIn) || !p.references[0]!.name.trim()} onPress={save} />
    </Card>
  );
}
