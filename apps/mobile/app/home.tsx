import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingCard, SearchQuery } from '@klyr/api-client';
import { DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Card, Chip, ErrorText, Icon, type IconName, sora, t } from '../components/ui';
import { PhotoStrip } from '../components/photo-strip';
import { HomesMap } from '../components/homes-map';
import { useCompare } from '../lib/compare';

const CITIES = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const MAX = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');
const viewed = (iso: string) => 'Viewed ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** Everything else Klyr does, one tap from home, as category icons. */
type Section = '/sell' | '/rent' | '/lease' | '/quotes' | '/afford' | '/estimate' | '/compare';
const SECTIONS: [string, Section, IconName][] = [
  ['Sell', '/sell', 'pricetag-outline'], ['Rent', '/rent', 'key-outline'], ['Lease out', '/lease', 'business-outline'], ['Quotes', '/quotes', 'calculator-outline'],
  ['Afford', '/afford', 'wallet-outline'], ['Estimates', '/estimate', 'stats-chart-outline'], ['Compare', '/compare', 'git-compare-outline'],
];

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
  const [query, setQuery] = useState('');
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

  const q = query.trim().toLowerCase();
  const shown = homes?.filter(h => !q || `${h.address} ${h.city}`.toLowerCase().includes(q)) ?? null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...sora(600), fontSize: 14, color: color.textSecondary }}>{me?.legalName ? `Hi, ${me.legalName.split(' ')[0]}` : 'Klyr'}</Text>
              <Text accessibilityRole="header" style={{ ...sora(800), fontSize: 28, letterSpacing: -0.8, color: color.text }}>{savedOnly ? 'Saved homes' : 'Find your home'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={view === 'list' ? 'Map' : 'List'} onPress={() => setView(view === 'list' ? 'map' : 'list')}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={view === 'list' ? 'map-outline' : 'list-outline'} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.canvas, borderRadius: 28, paddingHorizontal: 16, minHeight: 52 }}>
            <Icon name="search" size={20} />
            <TextInput accessibilityLabel="Search by address or city" placeholder="Address or city" placeholderTextColor="#6B6B6B" value={query} onChangeText={setQuery}
              style={{ ...sora(600), flex: 1, fontSize: 16, color: color.text, minHeight: 52 }} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Icon name="close-circle" size={20} tint="#8A8A8A" /></Pressable> : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 14 }}>
          {SECTIONS.filter(([, href]) => href !== '/compare' || compare.ids.length >= 2).map(([label, href, icon]) => (
            <Pressable key={href} accessibilityRole="link" accessibilityLabel={label} onPress={() => router.push(href)} style={({ pressed }) => ({ width: 78, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} /></View>
              <Text style={{ ...sora(600), fontSize: 12, color: color.text }}>{href === '/compare' ? `Compare ${compare.ids.length}` : label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            <Chip icon={savedOnly ? 'heart' : 'heart-outline'} label="Saved" on={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
            {CITIES.map(c => <Chip key={c} label={c} on={cities.includes(c)} onPress={() => setCities(x => (x.includes(c) ? x.filter(y => y !== c) : [...x, c]))} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {maxPrice && !MAX.includes(maxPrice) ? <Chip label={`Up to ${short(maxPrice)}`} on onPress={() => setMaxPrice(undefined)} /> : null}
            {MAX.map(v => <Chip key={v} label={`Up to ${short(v)}`} on={maxPrice === v} onPress={() => setMaxPrice(maxPrice === v ? undefined : v)} />)}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 18 }}>
          <ErrorText>{error}</ErrorText>
          {!homes && !error && <ActivityIndicator color={color.text} style={{ marginTop: 24 }} />}
          {shown && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={t.h2}>{savedOnly ? 'Your saved homes' : 'Homes for you'}</Text>
                <Text accessibilityLiveRegion="polite" style={t.note}>{shown.length} {shown.length === 1 ? 'home' : 'homes'} · all-in cost to close after cash back · estimate as of {new Date(DEFAULT_ASSUMPTIONS.asOf + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</Text>
              </View>
              {!savedOnly && (
                <Pressable accessibilityRole="button" accessibilityLabel="Save this search" onPress={saveSearch} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="notifications-outline" size={18} /><Text style={{ ...sora(700), fontSize: 14, color: color.text }}>Save search</Text>
                </Pressable>
              )}
            </View>
          )}
          {savedNote ? <Text accessibilityLiveRegion="polite" style={{ ...sora(600), fontSize: 13, color: color.brand }}>{savedNote}</Text> : null}
          {view === 'map' && shown && shown.length > 0 && <HomesMap homes={shown} onOpen={id => router.push(`/listing/${id}`)} />}
          {shown?.length === 0 && (
            <Card>
              <Text style={sora(700)}>{savedOnly ? 'No saved homes yet' : 'No homes match'}</Text>
              <Text style={t.note}>{savedOnly ? 'Tap the heart on any home to track its price and all-in cost.' : 'Try a higher budget or another city.'}</Text>
            </Card>
          )}
          {view === 'list' && shown?.map(h => (
            <View key={h.id} style={{ gap: 10 }}>
              <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                <PhotoStrip photos={h.photos} address={h.address} sample={h.samplePhotos} onPress={() => router.push(`/listing/${h.id}`)} />
                <Pressable accessibilityRole="button" accessibilityState={{ selected: h.saved }} accessibilityLabel={`${h.saved ? 'Saved' : 'Save'} ${h.address}`} onPress={() => toggleSave(h)}
                  style={{ position: 'absolute', top: 10, right: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={h.saved ? 'heart' : 'heart-outline'} size={22} tint={h.saved ? color.accent : color.text} />
                </Pressable>
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={`${h.address}, ${h.city}, all-in ${money(h.allIn)}`} onPress={() => router.push(`/listing/${h.id}`)} style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ ...sora(700), fontSize: 17, color: color.text, flex: 1 }} numberOfLines={1}>{h.address}</Text>
                  {h.viewedAt ? <Text style={{ ...sora(600), fontSize: 12, color: color.textSecondary }}>{viewed(h.viewedAt)}</Text> : null}
                </View>
                <Text style={t.note}>{h.city} · {h.beds} bd · {h.baths} ba · {h.type} · listed {money(h.price)}</Text>
                <Text style={{ ...sora(), fontSize: 14, color: color.textSecondary }}>
                  <Text style={{ ...sora(800), color: color.brand }}>{money(Math.abs(h.allIn))} {h.allIn < 0 ? 'back' : 'all-in'}</Text> · {money(h.cashBack)} cash back · {money(h.monthly)}/mo
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...t.note, flex: 1, fontSize: 12 }}>Listing brokerage: {h.listingBrokerage}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: compare.has(h.id) }} accessibilityLabel={`${compare.has(h.id) ? 'Remove' : 'Add'} ${h.address} ${compare.has(h.id) ? 'from' : 'to'} compare`}
                  onPress={() => compare.toggle(h.id)} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: compare.has(h.id) ? color.brandInk : color.canvas }}>
                  <Icon name={compare.has(h.id) ? 'checkmark' : 'add'} size={16} tint={compare.has(h.id) ? '#fff' : color.text} />
                  <Text style={{ ...sora(700), fontSize: 13, color: compare.has(h.id) ? '#fff' : color.text }}>Compare</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Text style={{ ...t.note, textAlign: 'center', marginTop: 8, fontSize: 12 }}>Klyr Realty Inc., Brokerage · Registered with RECO · Listing data © PropTx, used under VOW terms</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
