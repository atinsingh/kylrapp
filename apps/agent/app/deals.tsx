import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProDeal } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Nav } from '../components/nav';
import { Button, Card, ErrorText, Field, sora, t } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const LABEL = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of buyer’s home', other: 'Other' } as const;

/** Accepted deals: deliver signed notices before their deadlines, confirm the trust account, the deposit, and a release. */
export default function Deals() {
  const [deals, setDeals] = useState<ProDeal[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await klyr.pro.deals(); if (r.ok) { setDeals(r.data); setError(''); } else setError(errorText(r.error)); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const open = (deals ?? []).filter(d => !(d.status === 'void' && d.deposit?.returnedAt));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Nav current="deals" />
        <ErrorText>{error}</ErrorText>
        {deals && !open.length && <Card><Text style={sora(700)}>No open deals</Text><Text style={t.note}>Accepted offers show up here.</Text></Card>}
        {open.map(d => <DealCard key={d.dealId} d={d} onChange={load} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function DealCard({ d, onChange }: { d: ProDeal; onChange: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setTrust(false); setNote('');
    await onChange();
  };
  const dep = d.deposit, isVoid = d.status === 'void';
  return (
    <Card>
      <Text style={sora(700)}>{d.address}, {d.city}</Text>
      <Text style={t.note}>{money(d.price)} · {d.clientName ?? d.clientEmail} · {isVoid ? 'void' : d.stage}</Text>
      {dep && (
        <Text style={{ ...sora(600), fontSize: 13, color: dep.receivedAt || isVoid ? color.text : '#A54B00' }}>
          Deposit {money(dep.amount)} · {dep.returnedAt ? 'returned' : dep.receivedAt ? 'received' : `due ${torontoWhen(dep.dueAt)}`}{dep.trustVerifiedAt ? ' · trust account confirmed' : ''}
        </Text>
      )}
      {dep && !dep.receivedAt && !isVoid && !dep.trustVerifiedAt && (trust ? (
        <View style={{ gap: 8 }}>
          <Field label="Who you spoke to and the number you called" value={note} onChangeText={setNote} placeholder="Jo in accounting, 905-555-0100 (their website)" />
          <Button title="Record the call" busy={busy} disabled={note.trim().length < 3} onPress={() => run(() => klyr.pro.trustVerified(d.dealId, note))} />
        </View>
      ) : <Button title="I confirmed the trust account by phone" alt onPress={() => setTrust(true)} />)}
      {dep && !dep.receivedAt && !isVoid && <Button title="Deposit receipt received" busy={busy} onPress={() => run(() => klyr.pro.depositReceived(d.dealId))} />}
      {d.conditions.map(c => {
        const signed = c.waivedAt ?? c.fulfilledAt;
        return (
          <View key={c.id} style={{ borderTopWidth: 0.5, borderTopColor: color.separator, paddingTop: 8, gap: 6 }}>
            <Text style={sora(700)}>{LABEL[c.kind]}</Text>
            <Text style={t.note}>{c.deliveredAt ? `✓ Delivered ${torontoWhen(c.deliveredAt)}` : c.lapsedAt ? '× Lapsed' : isVoid ? 'Ended with the agreement' : signed ? `Client signed · deliver before ${torontoWhen(c.dueAt)}` : `Open until ${torontoWhen(c.dueAt)}`}</Text>
            {signed && !c.deliveredAt && !c.lapsedAt && !isVoid && <Button title="Delivered to the listing brokerage" busy={busy} onPress={() => run(() => klyr.pro.delivered(c.id))} />}
          </View>
        );
      })}
      {isVoid && <Text style={t.note}>{d.release ? 'Client signed the mutual release.' : 'Waiting for the client’s mutual release (Form 122).'}</Text>}
      {isVoid && d.release && dep && !dep.returnedAt && <Button title="Deposit returned to client" busy={busy} onPress={() => run(() => klyr.pro.depositReturned(d.dealId))} />}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
