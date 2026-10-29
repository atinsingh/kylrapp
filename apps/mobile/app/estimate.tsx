import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { HST } from '@klyr/core';
import type { Assumptions } from '@klyr/api-client';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Back } from '../components/back';
import { Button, Card, Chip, ErrorText, Screen, sora, t, Title } from '../components/ui';

const RATES = [0.0399, 0.0449, 0.0499];
const DOWNS = [0.05, 0.1, 0.15, 0.2, 0.25];
const LAWYERS: [string, number][] = [['Harbour Law', 1400], ['Ng & Patel LLP', 1650], ['Brightside Legal', 1850]];
const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-CA');

/** "How we estimate": the inputs behind every all-in this buyer sees. */
export default function Estimate() {
  const [saved, setSaved] = useState<(Assumptions & { custom: boolean }) | null>(null);
  const [a, setA] = useState<Assumptions | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { void klyr.assumptions().then(r => { if (r.ok) { setSaved(r.data); setA(r.data); } else setError(errorText(r.error)); }); }, []);
  if (!a || !saved) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const dirty = a.rate !== saved.rate || a.downPct !== saved.downPct || a.firstTime !== saved.firstTime || a.lawyerFee !== saved.lawyerFee;

  async function save() {
    const r = await klyr.setAssumptions(a!);
    if (!r.ok) return setError(errorText(r.error));
    setSaved(r.data); setNote('Saved. Every all-in now uses these inputs.');
  }
  async function reset() {
    const r = await klyr.resetAssumptions();
    if (!r.ok) return setError(errorText(r.error));
    setSaved(r.data); setA(r.data); setNote('Back to the standard inputs.');
  }

  return (
    <Screen>
      <Back />
      <Title sub="Every all-in and net figure in Klyr uses these inputs. Change them here and every figure updates.">How we estimate</Title>
      <Group label="MORTGAGE RATE · 5-YEAR FIXED" note="Lenders also test you at the higher of your rate + 2% or 5.25%.">
        {RATES.map(r => <Chip key={r} label={pct(r)} on={a.rate === r} onPress={() => setA({ ...a, rate: r })} />)}
      </Group>
      <Group label="DOWN PAYMENT" note="Under 20% adds CMHC insurance. Where your choice is below the legal minimum for a home, we use the minimum and say so on the listing.">
        {DOWNS.map(d => <Chip key={d} label={pct(d)} on={a.downPct === d} onPress={() => setA({ ...a, downPct: d })} />)}
      </Group>
      <Group label="FIRST-TIME BUYER" note="Refunds up to $4,000 Ontario and $4,475 Toronto land transfer tax.">
        <Chip label="Yes" on={a.firstTime} onPress={() => setA({ ...a, firstTime: true })} />
        <Chip label="No" on={!a.firstTime} onPress={() => setA({ ...a, firstTime: false })} />
      </Group>
      <Group label="LAWYER" note={`Quoted fee + 13% HST + $450 typical disbursements = ${money(a.lawyerFee * HST + 450)}`}>
        {LAWYERS.map(([n, f]) => <Chip key={n} label={`${n} · ${money(f)}`} on={a.lawyerFee === f} onPress={() => setA({ ...a, lawyerFee: f })} />)}
      </Group>
      <ErrorText>{error}</ErrorText>
      {note ? <Card style={{ backgroundColor: color.brandTint }}><Text accessibilityLiveRegion="polite" style={{ ...sora(600), color: color.brand }}>{note}</Text></Card> : null}
      <Button title="Save and update all-ins" disabled={!dirty} onPress={save} />
      {saved.custom && <Button title="Use the standard inputs" alt onPress={reset} />}
      <Text style={t.note}>Also in the all-in: land transfer tax, inspection $550 (houses), title insurance $350, status certificate $100 (condos) and prorated adjustments. Klyr charges buyers $0. Not included: down payment, moving costs, HST on a new build. Estimates as of Oct 27, 2026.</Text>
    </Screen>
  );
}

function Group({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return <Card><Text style={t.label}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View><Text style={t.note}>{note}</Text></Card>;
}

