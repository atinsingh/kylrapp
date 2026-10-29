import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingCard, SearchQuery } from '@klyr/api-client';
import { DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Card, Chip, ErrorText, sora, t } from '../components/ui';
import { PhotoStrip } from '../components/photo-strip';
import { useCompare } from '../lib/compare';

const CITIES = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const MAX = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');
const viewed = (iso: string) => 'Viewed ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** Buyer home: every home with its all-in cost to close as the hero number. */
export default function Home() {
  const { me } = useAuth();
  const compare = useCompare();
  const params = useLocalSearchParams<{ maxPrice?: string }>();
  const [homes, setHomes] = useState<ListingCard[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  // "Search homes up to $X" from What you can afford.
  useEffect(() => { if (params.maxPrice) setMaxPrice(Number(params.maxPrice)); }, [params.maxPrice]);
  const [savedOnly, setSavedOnly] = useState(false);

  const load = useCallback(async () => {
    const q: SearchQuery = { city: cities.join(',') || undefined, maxPrice, saved: savedOnly || undefined };
    const r = await klyr.listings(q);
    if (r.ok) { setHomes(r.data.results); setError(''); } else setError(errorText(r.error));
  }, [cities, maxPrice, savedOnly]);
  useEffect(() => { void load(); }, [load]);
  // Coming back from a listing: refresh saved hearts and "Viewed" badges.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleSave(h: ListingCard) {
    const next = !h.saved;
    setHomes(hs => hs?.map(x => (x.id === h.id ? { ...x, saved: next } : x)) ?? null);
    const r = next ? await klyr.save(h.id) : await klyr.unsave(h.id);
    if (!r.ok) setHomes(hs => hs?.map(x => (x.id === h.id ? { ...x, saved: !next } : x)) ?? null);
  }

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
          <Text accessibilityRole="header" style={{ ...sora(800), fontSize: 28, letterSpacing: -0.5 }}>{savedOnly ? 'Saved homes' : 'Search'}</Text>
          <Text style={t.sub}>All-in cost to close after your cash back. Estimate as of {new Date(DEFAULT_ASSUMPTIONS.asOf + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}.</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {([['Visits and docs', '/visits'], ['What you can afford', '/afford'], ['How we estimate', '/estimate'], ...(compare.ids.length >= 2 ? [[`Compare ${compare.ids.length}`, '/compare']] : [])] as [string, '/visits' | '/afford' | '/estimate' | '/compare'][])
            .map(([label, href]) => (
              <Pressable key={href} accessibilityRole="link" onPress={() => router.push(href)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>{label} ›</Text>
              </Pressable>
            ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip label={savedOnly ? '♥ Saved' : '♡ Saved'} on={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
          {CITIES.map(c => <Chip key={c} label={c} on={cities.includes(c)} onPress={() => setCities(x => (x.includes(c) ? x.filter(y => y !== c) : [...x, c]))} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {maxPrice && !MAX.includes(maxPrice) ? <Chip label={`Up to ${short(maxPrice)}`} on onPress={() => setMaxPrice(undefined)} /> : null}
          {MAX.map(v => <Chip key={v} label={`Up to ${short(v)}`} on={maxPrice === v} onPress={() => setMaxPrice(maxPrice === v ? undefined : v)} />)}
        </ScrollView>

        <ErrorText>{error}</ErrorText>
        {!homes && !error && <ActivityIndicator color={color.brand} style={{ marginTop: 24 }} />}
        {homes && <Text accessibilityLiveRegion="polite" style={t.note}>{homes.length} {homes.length === 1 ? 'home' : 'homes'}</Text>}
        {homes?.length === 0 && (
          <Card>
            <Text style={sora(700)}>{savedOnly ? 'No saved homes yet' : 'No homes match'}</Text>
            <Text style={t.note}>{savedOnly ? 'Tap Save on any listing to track its price and all-in cost.' : 'Try a higher budget or another city.'}</Text>
          </Card>
        )}
        {homes?.map(h => (
          <Card key={h.id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
            <PhotoStrip photos={h.photos} address={h.address} sample={h.samplePhotos} onPress={() => router.push(`/listing/${h.id}`)} />
            <Pressable accessibilityRole="link" accessibilityLabel={`${h.address}, ${h.city}, all-in ${money(h.allIn)}`} onPress={() => router.push(`/listing/${h.id}`)} style={{ padding: 14, paddingBottom: 4, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={t.label}>{h.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN TO CLOSE'}</Text>
                {h.viewedAt ? <Text style={{ ...sora(600), fontSize: 12, color: color.textSecondary }}>{viewed(h.viewedAt)}</Text> : null}
              </View>
              <Text style={{ ...sora(800), fontSize: 28, color: color.brand }}>{money(Math.abs(h.allIn))}</Text>
              <Text style={{ ...sora(700), fontSize: 15 }}>{h.address}, {h.city}</Text>
              <Text style={t.sub}>{money(h.price)} · {h.beds} bed · {h.baths} bath · {h.type}</Text>
              <Text style={t.sub}>{money(h.cashBack)} cash back · {money(h.monthly)}/mo</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 14, paddingRight: 6 }}>
              <Text style={{ ...t.note, flex: 1 }}>Listing brokerage: {h.listingBrokerage}</Text>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: compare.has(h.id) }} accessibilityLabel={`${compare.has(h.id) ? 'Remove' : 'Add'} ${h.address} ${compare.has(h.id) ? 'from' : 'to'} compare`}
                onPress={() => compare.toggle(h.id)} style={{ minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...sora(700), fontSize: 13, color: compare.has(h.id) ? color.brand : color.textSecondary }}>{compare.has(h.id) ? '✓ Compare' : '+ Compare'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: h.saved }} accessibilityLabel={`${h.saved ? 'Saved' : 'Save'} ${h.address}`}
                onPress={() => toggleSave(h)} style={{ minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...sora(700), fontSize: 13, color: h.saved ? color.brand : color.textSecondary }}>{h.saved ? '♥ Saved' : '♡ Save'}</Text>
              </Pressable>
            </View>
          </Card>
        ))}
        <Text style={{ ...t.note, textAlign: 'center', marginTop: 12 }}>Klyr Realty Inc., Brokerage · Registered with RECO · Listing data © PropTx, used under VOW terms</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
