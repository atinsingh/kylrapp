import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProOffer } from '@klyr/api-client';
import { money, TORONTO, torontoInstant, torontoToday, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Nav } from '../components/nav';
import { Button, Card, Chip, ErrorText, Field, sora, t } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const when = (iso: string) => torontoWhen(iso);
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const tonight = () => { const [y, m, d] = torontoToday(); return torontoInstant(y, m, d, 23, 59).toISOString(); };
const GROUPS: [string, (o: ProOffer) => boolean][] = [
  ['NEEDS YOUR REVIEW', o => o.status === 'sent'],
  ['WITH THE SELLER', o => o.status === 'registered'],
  ['SIGNED BACK · WAITING FOR YOUR CLIENT', o => o.signBack?.status === 'signed_back'],
  ['ACCEPTED', o => o.status === 'accepted' || o.signBack?.status === 'accepted'],
];

/** Offers on the go: review, register, record the seller's answer, confirm the deposit. */
export default function Offers() {
  const [list, setList] = useState<ProOffer[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const r = await klyr.pro.offers();
    if (r.ok) { setList(r.data); setError(''); } else setError(errorText(r.error));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const open = (list ?? []).filter(o => GROUPS.some(([, test]) => test(o)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Nav current="offers" />
        <ErrorText>{error}</ErrorText>
        {list && !open.length && <Card><Text style={sora(700)}>No open offers</Text><Text style={t.note}>When a client signs an offer, it appears here for your review.</Text></Card>}
        {GROUPS.map(([label, test]) => {
          const g = (list ?? []).filter(test);
          return g.length > 0 && (
            <View key={label} style={{ gap: 8 }}>
              <Text style={t.label}>{label} · {g.length}</Text>
              {g.map(o => <OfferCard key={o.id} o={o} onChange={load} />)}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

type Mode = null | 'register' | 'return' | 'accepted' | 'signed_back' | 'rejected';

function OfferCard({ o, onChange }: { o: ProOffer; onChange: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(o.price);
  const [until, setUntil] = useState(inHours(6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null); setNote('');
    await onChange();
  };
  const submit = () => {
    if (mode === 'register' || mode === 'return') return run(() => klyr.pro.reviewOffer(o.id, mode === 'return' ? { action: 'return', note } : { action: 'register', note: note || undefined }));
    if (mode === 'signed_back') return run(() => klyr.pro.offerResult(o.id, { result: 'signed_back', price, irrevocableAt: until, note: note || undefined }));
    if (mode) return run(() => klyr.pro.offerResult(o.id, { result: mode, note: note || undefined }));
  };
  const tm = o.terms;
  const conds = [tm.financingDays && `financing ${tm.financingDays}d`, tm.inspectionDays && `inspection ${tm.inspectionDays}d`, tm.statusCertificateDays && `status cert. ${tm.statusCertificateDays}d`].filter(Boolean);
  const dep = o.depositStatus;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ ...sora(800), fontSize: 20 }}>{money(o.price)}</Text>
        <Text style={t.note}>asking {money(o.askingPrice)}</Text>
      </View>
      <Text style={sora(700)}>{o.address}, {o.city}</Text>
      <Text style={t.note}>{o.clientName ?? o.clientEmail} · listed by {o.listingBrokerage}</Text>
      <Text style={t.body}>Deposit {money(o.deposit)} · {conds.length ? conds.join(', ') : 'no conditions'} · open until {when(o.irrevocableAt)}</Text>
      {tm.noteToAgent ? <Text style={[t.note, { color: color.text }]}>Client: “{tm.noteToAgent}”</Text> : null}
      {o.signBack && <Text style={{ ...t.note, color: '#2A4D8F' }}>Signed back at {money(o.signBack.price)} · {o.signBack.status === 'signed_back' ? `waiting for your client until ${when(o.signBack.irrevocableAt)}` : o.signBack.status}</Text>}
      {dep && <Text style={{ ...sora(600), fontSize: 13, color: dep.receivedAt ? '#2B7A4B' : '#A54B00' }}>{dep.receivedAt ? `Deposit received ${when(dep.receivedAt)}` : `Deposit ${money(dep.amount)} due ${when(dep.dueAt)}`}</Text>}

      {!mode && o.status === 'sent' && <>
        <Button title="Registered with listing brokerage" onPress={() => setMode('register')} />
        <Button title="Send back to client" alt onPress={() => setMode('return')} />
      </>}
      {!mode && o.status === 'registered' && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}><Button title="Accepted" onPress={() => setMode('accepted')} /></View>
          <View style={{ flex: 1 }}><Button title="Signed back" alt onPress={() => setMode('signed_back')} /></View>
          <View style={{ flex: 1 }}><Button title="Not accepted" alt onPress={() => setMode('rejected')} /></View>
        </View>
      )}
      {!mode && dep && !dep.receivedAt && <Button title="Deposit receipt received" busy={busy} onPress={() => run(() => klyr.pro.depositReceived(o.dealId))} />}
      {mode && (
        <View style={{ gap: 8 }}>
          {mode === 'register' && <Text style={t.note}>Confirm {o.listingBrokerage} received it and you have their Form 801.</Text>}
          {mode === 'accepted' && <Text style={t.note}>The deposit falls due in 24 hours and condition deadlines start counting.</Text>}
          {mode === 'signed_back' && <>
            <Field label="Seller’s price" value={price.toLocaleString('en-CA')} onChangeText={v => setPrice(Number(v.replace(/\D/g, '')) || 0)} keyboardType="number-pad" />
            <Text style={t.label}>OPEN FOR YOUR CLIENT UNTIL · {when(until).toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[['2 h', inHours(2)], ['6 h', inHours(6)], ['Tonight', tonight()]].map(([l, v]) => <Chip key={l} flex label={l!} on={until === v} onPress={() => setUntil(v!)} />)}
            </View>
          </>}
          <Field label={mode === 'return' ? 'What should your client change?' : 'Note for your client (optional)'} value={note} onChangeText={setNote} />
          <ErrorText>{error}</ErrorText>
          <Button busy={busy} disabled={mode === 'return' && note.trim().length < 3} onPress={submit}
            title={{ register: 'Mark registered', return: 'Send back', accepted: 'Record acceptance', signed_back: 'Send sign-back', rejected: 'Record not accepted' }[mode]} />
          <Button title="Back" alt onPress={() => { setMode(null); setError(''); }} />
        </View>
      )}
      {!mode && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
