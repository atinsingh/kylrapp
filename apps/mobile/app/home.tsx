import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingCard } from '@klyr/api-client';
import { DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Card, ErrorText, sora, t } from '../components/ui';
import { PhotoStrip } from '../components/photo-strip';

/** Buyer home: every home with its all-in cost to close as the hero number. */
export default function Home() {
  const { me } = useAuth();
  const [homes, setHomes] = useState<ListingCard[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await klyr.listings();
    if (r.ok) { setHomes(r.data.results); setError(''); } else setError(errorText(r.error));
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={require('../assets/klyr-mark.png')} style={{ width: 30, height: 30, borderRadius: 8 }} />
            <Text style={{ ...sora(800), fontSize: 20 }}>klyr</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/security')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>{me?.legalName?.split(' ')[0] ?? 'Account'} · Security</Text>
          </Pressable>
        </View>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ ...sora(800), fontSize: 28, letterSpacing: -0.5 }}>Search</Text>
          <Text style={t.sub}>All-in cost to close after your cash back. Estimate as of {new Date(DEFAULT_ASSUMPTIONS.asOf + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}.</Text>
        </View>
        <ErrorText>{error}</ErrorText>
        {!homes && !error && <ActivityIndicator color={color.brand} style={{ marginTop: 24 }} />}
        {homes?.map(h => (
          <Card key={h.id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
            <PhotoStrip photos={h.photos} address={h.address} sample={h.samplePhotos} />
            <View style={{ padding: 14, gap: 8 }}>
              <Text style={t.label}>{h.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN TO CLOSE'}</Text>
              <Text style={{ ...sora(800), fontSize: 28, color: color.brand }}>{money(Math.abs(h.allIn))}</Text>
              <Text style={{ ...sora(700), fontSize: 15 }}>{h.address}, {h.city}</Text>
              <Text style={t.sub}>{money(h.price)} · {h.beds} bed · {h.baths} bath · {h.type}</Text>
              <Text style={t.sub}>{money(h.cashBack)} cash back · {money(h.monthly)}/mo</Text>
              <Text style={t.note}>Listing brokerage: {h.listingBrokerage}</Text>
            </View>
          </Card>
        ))}
        <Text style={{ ...t.note, textAlign: 'center', marginTop: 12 }}>Klyr Realty Inc., Brokerage · Registered with RECO · Listing data © PropTx, used under VOW terms</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
