import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { DocumentSummary, Showing } from '@klyr/api-client';
import { TORONTO } from '@klyr/core';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Back } from '../components/back';
import { Card, ErrorText, Screen, sora, t, Title } from '../components/ui';

const STATUS: Record<Showing['status'], [string, string, string]> = {
  requested: ['Waiting for your agent to confirm', '#FBEBDD', '#A54B00'],
  confirmed: ['Confirmed', '#E3F2E8', '#2B7A4B'],
  declined: ['Can’t go ahead', '#FDECEC', '#A11B1B'],
  cancelled: ['Cancelled', '#F2F2F7', '#5E5E63'],
  completed: ['Visited', '#F2F2F7', '#5E5E63'],
};
const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TORONTO });

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
      {visits?.length === 0 && <Card><Text style={sora(700)}>No visits yet</Text><Text style={t.note}>Open any home and tap “Book a visit”.</Text></Card>}
      {visits?.map(v => {
        const [label, bg, fg] = STATUS[v.status];
        const upcoming = (v.status === 'requested' || v.status === 'confirmed') && Date.parse(v.at) > Date.now();
        return (
          <Card key={v.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {v.photo && <Image source={{ uri: v.photo.url }} accessibilityLabel={v.photo.alt} style={{ width: 72, height: 54, borderRadius: 8 }} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/listing/${v.listingId}`)}><Text style={sora(700)}>{v.address}, {v.city}</Text></Pressable>
              <Text style={t.note}>{when(v.at)}</Text>
              {v.agentNote && <Text style={[t.note, { color: color.text }]}>Your agent: “{v.agentNote}”</Text>}
              <Text style={{ ...sora(600), fontSize: 12, alignSelf: 'flex-start', backgroundColor: bg, color: fg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>{label}</Text>
            </View>
            {upcoming && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Cancel the visit to ${v.address}`} onPress={() => cancel(v.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>Cancel</Text>
              </Pressable>
            )}
          </Card>
        );
      })}
      <Text style={[t.label, { marginTop: 12 }]}>DOCUMENTS</Text>
      {docs.length === 0 ? <Text style={t.note}>Your buyer agreement and offers appear here once signed.</Text> : docs.map(d => (
        <Card key={d.id}>
          <Text style={sora(700)}>{d.title}</Text>
          <Text style={t.note}>Signed {new Date(d.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} · fingerprint {d.sha256.slice(0, 12)}…</Text>
        </Card>
      ))}
    </Screen>
  );
}
