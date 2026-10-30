import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Provider, Quote, QuoteKind, QuoteRequest, QuoteRequestInput } from '@klyr/api-client';
import { money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { Button, Card, Check, Chip, ErrorText, Field, Screen, sf, t, Title } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const KIND: Record<QuoteKind, string> = { lender: 'Mortgage', lawyer: 'Lawyer', inspector: 'Inspection', insurer: 'Insurance' };
const line = (k: QuoteKind, q: Quote) => {
  const d = q.details;
  return k === 'lender' ? `${(d.rate! * 100).toFixed(2)}% · ${money(d.monthly!)}/month · fees ${money(d.fees!)}`
    : k === 'lawyer' ? `Fee ${money(d.fee!)} + HST · disbursements ${money(d.disbursements!)}`
    : k === 'inspector' ? `${money(d.price!)} + HST · report in ${d.reportHours} h` : `Deductible ${money(d.deductible!)}`;
};

/** Quotes on the phone: ask, compare on what you pay, see what Klyr earns, choose. */
export default function Quotes() {
  const [reqs, setReqs] = useState<QuoteRequest[] | null>(null);
  const [kind, setKind] = useState<QuoteKind | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState(0);
  const [disclose, setDisclose] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => { void klyr.quotes().then(r => (r.ok ? setReqs(r.data) : setError(errorText(r.error)))); }, []);
  useFocusEffect(load);

  async function pick(k: QuoteKind) {
    setKind(k); setPicked([]); setError('');
    const r = await klyr.providers(k);
    if (r.ok) setProviders(r.data);
  }
  async function ask() {
    setBusy(true); setError('');
    const body = (kind === 'lender' ? { kind, providerIds: picked, loan: amount, amortYears: 25 } : kind === 'lawyer' ? { kind, providerIds: picked, price: amount }
      : kind === 'insurer' ? { kind, providerIds: picked, homeValue: amount } : { kind, providerIds: picked }) as QuoteRequestInput;
    const r = await klyr.requestQuotes(body);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setReqs(r.data); setKind(null); setAmount(0);
  }
  async function choose(q: Quote, acknowledged: boolean) {
    setBusy(true); setError('');
    const r = await klyr.chooseQuote(q.id, acknowledged);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setReqs(r.data); setDisclose(null); setAck(false);
  }

  return (
    <Screen>
      <Back />
      <Title sub="Ranked only by what you pay. Every quote shows what Klyr earns if you choose it.">Quotes</Title>
      <Card>
        <Text style={t.label}>ASK FOR QUOTES</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(KIND) as QuoteKind[]).map(k => <Chip key={k} label={KIND[k]} on={kind === k} onPress={() => void pick(k)} />)}
        </View>
        {kind && (
          <>
            {providers.map(p => (
              <Check key={p.id} on={picked.includes(p.id)} onPress={() => setPicked(x => (x.includes(p.id) ? x.filter(i => i !== p.id) : x.length < 4 ? [...x, p.id] : x))}>
                {`${p.name} · ${p.paysReferral ? 'may pay Klyr a referral fee' : 'pays Klyr nothing'}`}
              </Check>
            ))}
            {kind !== 'inspector' && <Field label={kind === 'lender' ? 'Mortgage amount' : kind === 'lawyer' ? 'Purchase price' : 'Home value to insure'} value={amount ? amount.toLocaleString('en-CA') : ''} onChangeText={v => setAmount(n(v))} keyboardType="number-pad" />}
            <ErrorText>{error}</ErrorText>
            <Button title="Ask for quotes" busy={busy} disabled={!picked.length || (kind !== 'inspector' && amount < 50_000)} onPress={ask} />
          </>
        )}
      </Card>
      {reqs?.filter(r => r.status !== 'cancelled').map(r => (
        <Card key={r.id}>
          <Text style={t.label}>{KIND[r.kind].toUpperCase()} · {r.quotes.length} OF {r.providers.length} QUOTED{r.status === 'chosen' ? ' · CHOSEN' : ''}</Text>
          {r.quotes.length === 0 && <Text style={t.note}>Your agent adds each quote as it arrives.</Text>}
          {r.quotes.map(q => (
            <View key={q.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: color.separator }}>
              <Text style={sf(700)}>{q.rank}. {q.provider.name} · {money(q.clientCost)}{r.kind === 'lender' ? ' over 5 years' : r.kind === 'insurer' ? '/year' : ''}</Text>
              <Text style={t.note}>{line(r.kind, q)}{q.vsBest ? ` · ${money(q.vsBest)} more than the lowest` : ' · lowest'}</Text>
              <Text style={{ ...sf(600), fontSize: 13, color: q.referralFee ? '#C93400' : color.textSecondary }}>{q.referralFee ? `Klyr earns ${money(q.referralFee)} if you choose this` : 'Klyr earns nothing from this quote'}</Text>
              {q.chosen && <Text style={{ ...sf(700), color: color.brand }}>✓ You chose this</Text>}
              {r.status === 'open' && !q.expired && (disclose === q.id ? (
                <View style={{ gap: 6, backgroundColor: '#FFF2E5', padding: 12, borderRadius: 12 }}>
                  <Text style={sf(700)}>Referral fee disclosure</Text>
                  <Text style={t.body}>{q.provider.name} pays Klyr {money(q.referralFee)} if you go ahead. It doesn’t change your price or how quotes were ranked.</Text>
                  <Check on={ack} onPress={() => setAck(!ack)}>I’ve read this disclosure.</Check>
                  <Button title={`Choose ${q.provider.name}`} busy={busy} disabled={!ack} onPress={() => choose(q, true)} />
                </View>
              ) : <Button title="Choose" alt onPress={() => (q.referralFee ? (setDisclose(q.id), setAck(false)) : void choose(q, false))} />)}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
