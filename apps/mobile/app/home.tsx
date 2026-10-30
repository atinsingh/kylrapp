import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingCard, SearchQuery } from '@klyr/api-client';
import { money, shortDate } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Card, Chip, ErrorText, Icon, type IconName, IconTile, sf, t, tile } from '../components/ui';
import { PhotoStrip } from '../components/photo-strip';
import { HomesMap } from '../components/homes-map';
import { useCompare } from '../lib/compare';

const CITIES = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const MAX = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');
const viewed = (iso: string) => 'Viewed ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** Everything else Klyr does, one tap from home, as category icons. */
type Section = '/sell' | '/rent' | '/lease' | '/quotes' | '/afford' | '/estimate' | '/compare';
const SECTIONS: [string, Section, IconName, string][] = [
  ['Sell', '/sell', 'pricetag', tile.orange], ['Rent', '/rent', 'key', tile.blue], ['Lease out', '/lease', 'business', tile.indigo], ['Quotes', '/quotes', 'calculator', tile.teal],
  ['Afford', '/afford', 'wallet', tile.green], ['Estimates', '/estimate', 'stats-chart', tile.purple], ['Compare', '/compare', 'git-compare', tile.pink],
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
  const [asOf, setAsOf] = useState('');
  const searchName = [cities.join(', ') || 'All areas', maxPrice && `up to ${short(maxPrice)}`].filter(Boolean).join(' · ');
  async function saveSearch() {
    setSavedNote('');
    const r = await klyr.saveSearch(searchName, { city: cities.join(',') || undefined, maxPrice }, 'instant');
    setSavedNote(r.ok ? `Saved “${searchName}”. We’ll tell you about new listings and price drops.` : errorText(r.error));
  }

  const load = useCallback(async () => {
    const q: SearchQuery = { city: cities.join(',') || undefined, maxPrice, saved: savedOnly || undefined };
    const r = await klyr.listings(q);
    if (r.ok) { setHomes(r.data.results); setAsOf(r.data.asOf); setError(''); } else setError(errorText(r.error));
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
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', minHeight: 44, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={view === 'list' ? 'Map' : 'List'} onPress={() => setView(view === 'list' ? 'map' : 'list')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={view === 'list' ? 'map-outline' : 'list-outline'} tint={color.brand} />
              <Text style={{ ...sf(), fontSize: 17, color: color.brand }}>{view === 'list' ? 'Map' : 'List'}</Text>
            </Pressable>
          </View>
          <View>
            <Text accessibilityRole="header" style={t.h1}>{savedOnly ? 'Saved Homes' : 'Homes'}</Text>
            <Text style={t.sub}>{me?.legalName ? `Hi ${me.legalName.split(' ')[0]}. ` : ''}Prices are the all-in cost to close, after your cash back.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(118,118,128,0.12)', borderRadius: 10, paddingHorizontal: 8, minHeight: 38 }}>
            <Icon name="search" size={18} tint={color.textTertiary} />
            <TextInput accessibilityLabel="Search by address or city" placeholder="Address or city" placeholderTextColor={color.textTertiary} value={query} onChangeText={setQuery}
              style={{ ...sf(), flex: 1, fontSize: 17, color: color.text, minHeight: 38 }} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Icon name="close-circle" size={18} tint={color.textTertiary} /></Pressable> : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 10, paddingVertical: 16 }}>
          {SECTIONS.filter(([, href]) => href !== '/compare' || compare.ids.length >= 2).map(([label, href, icon, bg]) => (
            <Pressable key={href} accessibilityRole="link" accessibilityLabel={label} onPress={() => router.push(href)} style={({ pressed }) => ({ width: 74, alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
              <IconTile name={icon} bg={bg} size={52} />
              <Text style={{ ...sf(500), fontSize: 12, color: color.text }}>{href === '/compare' ? `Compare ${compare.ids.length}` : label}</Text>
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

        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
          <ErrorText>{error}</ErrorText>
          {!homes && !error && <ActivityIndicator style={{ marginTop: 24 }} />}
          {shown && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <Text accessibilityLiveRegion="polite" style={{ ...t.label, flex: 1 }}>{shown.length} {shown.length === 1 ? 'home' : 'homes'}{asOf ? ` · estimate as of ${shortDate(asOf)}` : ''}</Text>
              {!savedOnly && (
                <Pressable accessibilityRole="button" accessibilityLabel="Save this search" onPress={saveSearch} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="notifications-outline" size={17} tint={color.brand} /><Text style={{ ...sf(), fontSize: 15, color: color.brand }}>Save Search</Text>
                </Pressable>
              )}
            </View>
          )}
          {savedNote ? <Text accessibilityLiveRegion="polite" style={{ ...sf(500), fontSize: 15, color: color.money }}>{savedNote}</Text> : null}
          {view === 'map' && shown && shown.length > 0 && <HomesMap homes={shown} onOpen={id => router.push(`/listing/${id}`)} />}
          {shown?.length === 0 && (
            <Card>
              <Text style={sf(600)}>{savedOnly ? 'No saved homes yet' : 'No homes match'}</Text>
              <Text style={t.note}>{savedOnly ? 'Tap the heart on any home to track its price and all-in cost.' : 'Try a higher budget or another city.'}</Text>
            </Card>
          )}
          {view === 'list' && shown?.map(h => (
            <View key={h.id} style={{ backgroundColor: color.surface, borderRadius: 14, overflow: 'hidden' }}>
              <View>
                <PhotoStrip photos={h.photos} address={h.address} sample={h.samplePhotos} onPress={() => router.push(`/listing/${h.id}`)} />
                <Pressable accessibilityRole="button" accessibilityState={{ selected: h.saved }} accessibilityLabel={`${h.saved ? 'Saved' : 'Save'} ${h.address}`} onPress={() => toggleSave(h)}
                  style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={h.saved ? 'heart' : 'heart-outline'} size={20} tint={h.saved ? tile.red : color.text} />
                </Pressable>
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={`${h.address}, ${h.city}, all-in ${money(h.allIn)}`} onPress={() => router.push(`/listing/${h.id}`)} style={{ paddingHorizontal: 14, paddingTop: 12, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ ...sf(600), fontSize: 17, color: color.text, flex: 1 }} numberOfLines={1}>{h.address}</Text>
                  {h.viewedAt ? <Text style={t.note}>{viewed(h.viewedAt)}</Text> : null}
                </View>
                <Text style={t.sub}>{h.city} · {h.beds} bd · {h.baths} ba · {h.type} · {money(h.price)}</Text>
                <Text style={{ ...sf(), fontSize: 15, lineHeight: 22, color: color.textSecondary }}>
                  <Text style={{ ...sf(700), color: color.money }}>{money(Math.abs(h.allIn))} {h.allIn < 0 ? 'back' : 'all-in'}</Text> · {money(h.cashBack)} cash back · {money(h.monthly)}/mo
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 }}>
                <Text style={{ ...t.note, flex: 1, fontSize: 12, color: color.textTertiary }}>Listing brokerage: {h.listingBrokerage}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: compare.has(h.id) }} accessibilityLabel={`${compare.has(h.id) ? 'Remove' : 'Add'} ${h.address} ${compare.has(h.id) ? 'from' : 'to'} compare`}
                  onPress={() => compare.toggle(h.id)} style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: compare.has(h.id) ? color.brand : color.brandTint }}>
                  <Icon name={compare.has(h.id) ? 'checkmark' : 'add'} size={15} tint={compare.has(h.id) ? '#fff' : color.brand} />
                  <Text style={{ ...sf(600), fontSize: 13, color: compare.has(h.id) ? '#fff' : color.brand }}>Compare</Text>
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
