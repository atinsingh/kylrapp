import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingCard, SearchQuery } from '@klyr/api-client';
import { DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { serif, Card, Chip, ErrorText, sora, t } from '../components/ui';
import { PhotoStrip } from '../components/photo-strip';
import { HomesMap } from '../components/homes-map';
import { useCompare } from '../lib/compare';

const CITIES = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const MAX = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');
const viewed = (iso: string) => 'Viewed ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** Buyer home: every home with its all-in cost to close as the hero number. */
type Section = '/visits' | '/offers' | '/searches' | '/sell' | '/rent' | '/lease' | '/quotes' | '/afford' | '/estimate' | '/compare';
const SECTIONS: [string, Section, string][] = [
  ['Offers', '/offers', 'Your offers and deal'], ['Visits', '/visits', 'Booked visits and docs'], ['Saved', '/searches', 'Searches and alerts'],
  ['Afford', '/afford', 'What you can spend'], ['Quotes', '/quotes', 'Lenders, lawyers'], ['Sell', '/sell', 'What you keep'],
  ['Rent', '/rent', 'No fee to you'], ['Lease out', '/lease', 'For landlords'], ['Estimates', '/estimate', 'How we estimate'], ['Compare', '/compare', 'Side by side'],
];
const initials = (n?: string | null) => (n ?? 'K').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
const greeting = () => { const h = Number(new Date().toLocaleString('en-CA', { hour: 'numeric', hour12: false, timeZone: 'America/Toronto' })); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

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
  const [view, setView] = useState<'list' | 'map'>('list');
  const [savedNote, setSavedNote] = useState('');
  const searchName = [cities.join(', ') || 'All areas', maxPrice && `up to ${short(maxPrice)}`].filter(Boolean).join(' · ');
  async function saveSearch() {
    setSavedNote('');
    const r = await klyr.saveSearch(searchName, { city: cities.join(',') || undefined, maxPrice }, 'instant');
    setSavedNote(r.ok ? `Saved “${searchName}”. We’ll tell you about new listings and price drops.` : errorText(r.error));
  }

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
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 56 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ ...serif(700), fontSize: 26, letterSpacing: -0.8, color: color.brandInk }}>klyr</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Account and security" onPress={() => router.push('/security')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.brandInk, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...sora(700), fontSize: 14, color: '#fff' }}>{initials(me?.legalName)}</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text accessibilityRole="header" style={{ ...serif(600), fontSize: 38, lineHeight: 42, letterSpacing: -1, color: color.text }}>
            {savedOnly ? 'Your saved homes.' : `${greeting()}${me?.legalName ? `, ${me.legalName.split(' ')[0]}` : ''}.`}
          </Text>
          <Text style={t.sub}>Every price here is the all-in cost to close, after your cash back. Estimate as of {new Date(DEFAULT_ASSUMPTIONS.asOf + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
          {SECTIONS.filter(([, href]) => href !== '/compare' || compare.ids.length >= 2).map(([label, href, note]) => (
            <Pressable key={href} accessibilityRole="link" accessibilityLabel={label} onPress={() => router.push(href)}
              style={({ pressed }) => ({ width: 132, minHeight: 92, borderRadius: 18, padding: 14, gap: 6, justifyContent: 'space-between',
                backgroundColor: href === '/offers' ? color.brandInk : color.surface, borderWidth: 1, borderColor: href === '/offers' ? color.brandInk : color.line, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ ...serif(600), fontSize: 19, letterSpacing: -0.3, color: href === '/offers' ? '#fff' : color.text }}>{href === '/compare' ? `Compare ${compare.ids.length}` : label}</Text>
              <Text style={{ ...sora(), fontSize: 12, color: href === '/offers' ? color.brandOnDark : color.textSecondary }}>{note}</Text>
            </Pressable>
          ))}
        </ScrollView>
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
        {homes && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text accessibilityLiveRegion="polite" style={[t.note, { flex: 1 }]}>{homes.length} {homes.length === 1 ? 'home' : 'homes'}</Text>
            {!savedOnly && <Chip label="Save this search" on={false} onPress={saveSearch} />}
            <Chip label={view === 'list' ? 'Map' : 'List'} on={false} onPress={() => setView(view === 'list' ? 'map' : 'list')} />
          </View>
        )}
        {savedNote ? <Text accessibilityLiveRegion="polite" style={{ ...sora(600), fontSize: 13, color: color.brand }}>{savedNote}</Text> : null}
        {view === 'map' && homes && homes.length > 0 && <HomesMap homes={homes} onOpen={id => router.push(`/listing/${id}`)} />}
        {homes?.length === 0 && (
          <Card>
            <Text style={sora(700)}>{savedOnly ? 'No saved homes yet' : 'No homes match'}</Text>
            <Text style={t.note}>{savedOnly ? 'Tap Save on any listing to track its price and all-in cost.' : 'Try a higher budget or another city.'}</Text>
          </Card>
        )}
        {view === 'list' && homes?.map(h => (
          <View key={h.id} style={{ gap: 0, marginBottom: 8 }}>
            <View style={{ borderRadius: 22, overflow: 'hidden' }}>
              <PhotoStrip photos={h.photos} address={h.address} sample={h.samplePhotos} onPress={() => router.push(`/listing/${h.id}`)} />
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel={`${h.address}, ${h.city}, all-in ${money(h.allIn)}`} onPress={() => router.push(`/listing/${h.id}`)} style={{ paddingTop: 14, paddingHorizontal: 2, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ ...serif(600), fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: color.text, flex: 1 }}>{h.address}</Text>
                {h.viewedAt ? <Text style={{ ...sora(600), fontSize: 12, color: color.textSecondary }}>{viewed(h.viewedAt)}</Text> : null}
              </View>
              <Text style={t.sub}>{h.city} · {h.beds} bed · {h.baths} bath · {h.type} · listed at {money(h.price)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <Text style={{ ...serif(600), fontSize: 30, letterSpacing: -0.8, color: color.brand }}>{money(Math.abs(h.allIn))}</Text>
                <Text style={{ ...sora(600), fontSize: 13, color: color.textSecondary }}>{h.allIn < 0 ? 'back to you at closing' : 'all-in to close'}</Text>
              </View>
              <Text style={t.note}>{money(h.cashBack)} cash back · {money(h.monthly)}/mo</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 2, borderBottomWidth: 1, borderBottomColor: color.line, paddingBottom: 8 }}>
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
          </View>
        ))}
        <Text style={{ ...t.note, textAlign: 'center', marginTop: 12 }}>Klyr Realty Inc., Brokerage · Registered with RECO · Listing data © PropTx, used under VOW terms</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
