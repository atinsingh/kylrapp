import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FieldDay } from '@klyr/api-client';
import { TORONTO } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Nav } from '../components/nav';
import { Card, Chip, ErrorText, sora, t } from '../components/ui';
import { describeFieldEvent as describe } from '@klyr/api-client';
import { errorText, klyr } from '../lib/klyr';

const ymd = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TORONTO });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TORONTO });
const DAYS = [0, 1, 2, 3, 4, 5, 6].map(i => {
  const ms = Date.now() - i * 86_400_000;
  return { day: ymd(ms), label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : new Date(ms).toLocaleDateString('en-CA', { weekday: 'short', timeZone: TORONTO }) };
});
const TONE = { ok: '#2B7A4B', warn: '#A11B1B', plain: color.textSecondary } as const;

/** The agent's field day, read from the brokerage's audit trail: what the broker of record also sees. */
export default function Activity() {
  const [day, setDay] = useState(DAYS[0]!.day);
  const [data, setData] = useState<FieldDay | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await klyr.pro.activity(day);
    if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r.error));
  }, [day]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const s = data?.summary;
  const tiles: [string, string][] = s ? [
    ['Visits done', String(s.visitsCompleted)],
    ['On site', `${s.minutesOnSite} min`],
    ['Check-ins', String(s.checkIns)],
    ['Refused', String(s.refused)],
  ] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Nav current="activity" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {DAYS.map(d => <Chip key={d.day} label={d.label} on={d.day === day} onPress={() => setDay(d.day)} />)}
        </ScrollView>
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tiles.map(([k, v]) => (
            <View key={k} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: color.surface, borderRadius: 14, padding: 12 }} accessibilityLabel={`${k}: ${v}`}>
              <Text style={t.note}>{k}</Text>
              <Text style={{ ...sora(800), fontSize: 22, color: k === 'Refused' && v !== '0' ? '#A11B1B' : color.text }}>{v}</Text>
            </View>
          ))}
        </View>
        <Card>
          <Text style={t.label}>TIMELINE</Text>
          {data?.events.length === 0 && <Text style={t.note}>Nothing recorded on this day.</Text>}
          {data?.events.map((e, i) => {
            const d = describe(e);
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator }}>
                <Text style={{ ...sora(600), fontSize: 13, width: 64, color: color.textSecondary }}>{time(e.at)}</Text>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: TONE[d.tone] }} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ ...sora(700), fontSize: 14, color: d.tone === 'warn' ? TONE.warn : color.text }}>{d.title}</Text>
                  <Text style={t.note}>{e.address}{e.clientName ? ` · ${e.clientName}` : ''}</Text>
                  {d.detail ? <Text style={t.note}>{d.detail}</Text> : null}
                </View>
              </View>
            );
          })}
        </Card>
        <Text style={t.note}>Every check-in, completion and refused attempt is kept for the broker of record. Nothing here can be edited.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
