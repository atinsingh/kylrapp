import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { SavedSearch } from '@klyr/api-client';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { Card, Chip, ErrorText, Screen, sora, t, Title } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const ALERTS: [SavedSearch['alert'], string][] = [['instant', 'Right away'], ['daily', 'Daily'], ['off', 'Off']];

/** Saved searches and their alerts for new listings and price drops. */
export default function Searches() {
  const [list, setList] = useState<SavedSearch[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { const r = await klyr.searches(); if (r.ok) setList(r.data); else setError(errorText(r.error)); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const act = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => { const r = await fn(); if (!r.ok) setError(errorText(r.error)); await load(); };
  return (
    <Screen>
      <Back />
      <Title sub="We tell you about new listings and price drops that match.">Saved searches</Title>
      <ErrorText>{error}</ErrorText>
      {list?.length === 0 && <Card><Text style={sora(700)}>No saved searches</Text><Text style={t.note}>Pick cities and a budget on Search, then “Save this search”.</Text></Card>}
      {list?.map(s => (
        <Card key={s.id}>
          <Text style={sora(700)}>{s.name}</Text>
          <Text style={t.note}>{s.matches} home{s.matches === 1 ? '' : 's'} now</Text>
          <Text style={t.label}>ALERTS</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ALERTS.map(([v, label]) => <Chip key={v} flex label={label} on={s.alert === v} onPress={() => act(() => klyr.setSearchAlert(s.id, v))} />)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${s.name}`} onPress={() => act(() => klyr.deleteSearch(s.id))} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...sora(700), fontSize: 13, color: '#A11B1B' }}>Delete</Text>
          </Pressable>
        </Card>
      ))}
      <Text style={{ ...t.note, color: color.textSecondary }}>Right away: within minutes. Daily: one email each morning when something changes.</Text>
    </Screen>
  );
}
