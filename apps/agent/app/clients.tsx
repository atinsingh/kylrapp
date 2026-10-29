import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProClient } from '@klyr/api-client';
import { color } from '@klyr/tokens';
import { Nav } from '../components/nav';
import { Card, ErrorText, sora, t } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const ID: Record<ProClient['idStatus'], [string, boolean]> = {
  not_started: ['ID not started', false], verified: ['ID verified', true], needs_review: ['ID with compliance', false], rejected: ['ID failed', false],
};
const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

export default function Clients() {
  const [clients, setClients] = useState<ProClient[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const r = await klyr.pro.clients();
    if (r.ok) { setClients(r.data); setError(''); } else setError(errorText(r.error));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 56 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Nav current="clients" />
        <ErrorText>{error}</ErrorText>
        {clients?.length === 0 && <Card><Text style={sora(700)}>No clients yet</Text><Text style={t.note}>Buyers are assigned to you when they sign the Buyer Representation Agreement.</Text></Card>}
        {clients?.map(c => {
          const steps: [string, boolean][] = [[c.agreementSignedAt ? 'Form 300 signed' : 'Form 300 not signed', !!c.agreementSignedAt], ID[c.idStatus], [`${c.openVisits} open visit${c.openVisits === 1 ? '' : 's'}`, c.openVisits > 0]];
          return (
            <Card key={c.dealId}>
              <Text style={sora(700)}>{c.name ?? c.email}</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {c.phone && <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${c.phone}`)} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ ...sora(600), color: color.brand }}>Call {phone(c.phone)}</Text></Pressable>}
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${c.email}`)} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ ...sora(600), color: color.brand }}>Email</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {steps.map(([label, on]) => (
                  <Text key={label} style={{ ...sora(600), fontSize: 12, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden', backgroundColor: on ? '#E3F2E8' : '#F2F2F7', color: on ? '#2B7A4B' : '#5E5E63' }}>{on ? '✓ ' : ''}{label}</Text>
                ))}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
