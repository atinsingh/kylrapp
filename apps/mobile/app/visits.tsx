import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { DocumentSummary, Showing, VisitFeedback } from '@klyr/api-client';
import { TORONTO, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Back } from '../components/back';
import { Button, Card, Chip, ErrorText, Screen, sf, t, Title } from '../components/ui';

const STATUS: Record<Showing['status'], [string, string, string]> = {
  requested: ['Waiting for your agent to confirm', '#FFF2E5', '#C93400'],
  confirmed: ['Confirmed', '#E8F6EC', '#248A3D'],
  declined: ['Can’t go ahead', '#FFEBEC', '#D70015'],
  cancelled: ['Cancelled', '#F2F2F7', '#5E5E63'],
  completed: ['Visited', '#F2F2F7', '#5E5E63'],
};
const when = (iso: string) => torontoWhen(iso);
export const INTEREST = { yes: 'I’d consider it', maybe: 'Maybe', no: 'Not for me' } as const;
export const PRICE = { low: 'Priced low', fair: 'Fair', high: 'Priced high' } as const;

/** After a visit: a few taps. The seller sees it without your name. */
function Feedback({ v, onSent }: { v: Showing; onSent: () => void }) {
  const [f, setF] = useState<Partial<VisitFeedback>>({});
  const [error, setError] = useState('');
  if (v.feedback) return <Text style={t.note}>Your feedback: {INTEREST[v.feedback.interest]} · {PRICE[v.feedback.price]}</Text>;
  async function send() {
    const r = await klyr.visitFeedback(v.id, f as VisitFeedback);
    if (!r.ok) return setError(errorText(r.error));
    onSent();
  }
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Text style={t.label}>HOW WAS IT? THE SELLER SEES THIS WITHOUT YOUR NAME</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>{(Object.keys(INTEREST) as VisitFeedback['interest'][]).map(k => <Chip key={k} flex label={INTEREST[k]} on={f.interest === k} onPress={() => setF(x => ({ ...x, interest: k }))} />)}</View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{(Object.keys(PRICE) as VisitFeedback['price'][]).map(k => <Chip key={k} flex label={PRICE[k]} on={f.price === k} onPress={() => setF(x => ({ ...x, price: k }))} />)}</View>
      <ErrorText>{error}</ErrorText>
      <Button title="Send feedback" alt disabled={!f.interest || !f.price} onPress={send} />
    </View>
  );
}

/** Visits and signed documents. */
export default function Visits() {
  const [visits, setVisits] = useState<Showing[] | null>(null);
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    void Promise.all([klyr.showings(), klyr.documents()]).then(([v, d]) => {
      if (v.ok) setVisits(v.data); else setError(errorText(v.error));
      if (d.ok) setDocs(d.data);
    });
  }, []);
  useFocusEffect(load);

  async function cancel(id: string) {
    const r = await klyr.cancelShowing(id);
    if (!r.ok) return setError(errorText(r.error));
    load();
  }

  return (
    <Screen>
      <Back />
      <Title sub="Your agent arranges each visit with the listing brokerage and confirms it here. Tenant-occupied homes need 24 hours’ written notice to the tenant.">Your visits</Title>
      <ErrorText>{error}</ErrorText>
      {visits?.length === 0 && <Card><Text style={sf(700)}>No visits yet</Text><Text style={t.note}>Open any home and tap “Book a visit”.</Text></Card>}
      {visits?.map(v => {
        const [label, bg, fg] = STATUS[v.status];
        const upcoming = (v.status === 'requested' || v.status === 'confirmed') && Date.parse(v.at) > Date.now();
        return (
          <Card key={v.id}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {v.photo && <Image source={{ uri: v.photo.url }} accessibilityLabel={v.photo.alt} style={{ width: 72, height: 54, borderRadius: 8 }} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/listing/${v.listingId}`)}><Text style={sf(700)}>{v.address}, {v.city}</Text></Pressable>
              <Text style={t.note}>{when(v.at)}</Text>
              {v.agentNote && <Text style={[t.note, { color: color.text }]}>Your agent: “{v.agentNote}”</Text>}
              <Text style={{ ...sf(600), fontSize: 12, alignSelf: 'flex-start', backgroundColor: bg, color: fg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>{label}</Text>
            </View>
            {upcoming && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Cancel the visit to ${v.address}`} onPress={() => cancel(v.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...sf(700), fontSize: 13, color: color.brand }}>Cancel</Text>
              </Pressable>
            )}
          </View>
          {v.status === 'completed' && <Feedback v={v} onSent={load} />}
          </Card>
        );
      })}
      <Text style={[t.label, { marginTop: 12 }]}>DOCUMENTS</Text>
      {docs.length === 0 ? <Text style={t.note}>Your buyer agreement and offers appear here once signed.</Text> : docs.map(d => (
        <Card key={d.id}>
          <Text style={sf(700)}>{d.title}</Text>
          <Text style={t.note}>Signed {new Date(d.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} · fingerprint {d.sha256.slice(0, 12)}…</Text>
        </Card>
      ))}
    </Screen>
  );
}
