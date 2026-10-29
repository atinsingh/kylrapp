import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { ListingCard } from '@klyr/api-client';
import { money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { useCompare } from '../lib/compare';
import { errorText, klyr } from '../lib/klyr';
import { Card, ErrorText, Screen, sf, t, Title } from '../components/ui';
import { Back } from '../components/back';

const ROWS: [string, (h: ListingCard) => string, boolean?][] = [
  ['Price', h => money(h.price)],
  ['All-in to close', h => (h.allIn < 0 ? '−' : '') + money(Math.abs(h.allIn)), true],
  ['Cash back', h => money(h.cashBack)],
  ['Land transfer tax', h => money(h.landTransfer)],
  ['Monthly', h => money(h.monthlyTotal) + '/mo'],
  ['Beds · baths', h => `${h.beds} · ${h.baths}`],
  ['Size', h => (h.sqft ? `${h.sqft.toLocaleString('en-CA')} sq ft` : '—')],
  ['Built', h => (h.yearBuilt ? String(h.yearBuilt) : '—')],
  ['Offers', h => h.offerDate ?? '—'],
];
const COL = 168;

export default function Compare() {
  const c = useCompare();
  const [homes, setHomes] = useState<ListingCard[]>([]);
  const [error, setError] = useState('');
  const key = c.ids.join(',');

  useEffect(() => {
    if (c.ids.length < 2) { setHomes([]); return; }
    void klyr.listings({ ids: key }).then(r => {
      if (!r.ok) return setError(errorText(r.error));
      setHomes(c.ids.map(id => r.data.results.find(h => h.id === id)).filter((h): h is ListingCard => !!h));
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const lowest = (f: (h: ListingCard) => number) => (homes.length > 1 ? homes.reduce((b, h) => (f(h) < f(b) ? h : b)).id : null);
  const bestAllIn = lowest(h => h.allIn), bestMonthly = lowest(h => h.monthlyTotal);

  return (
    <Screen>
      <Back />
      <Title sub="Same lawyer, down payment and first-time status applied to each.">Compare homes</Title>
      <ErrorText>{error}</ErrorText>
      {c.ids.length < 2 ? (
        <Card><Text style={sf(700)}>Pick two or three homes</Text><Text style={t.note}>Tap “+ Compare” on any home in Search.</Text></Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ backgroundColor: color.surface, borderRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 104 }} />
              {homes.map(h => (
                <View key={h.id} style={{ width: COL, paddingHorizontal: 6, gap: 4 }}>
                  {h.photos[0] && <Image source={{ uri: h.photos[0].url }} accessibilityLabel={h.photos[0].alt} style={{ width: COL - 12, height: (COL - 12) * 2 / 3, borderRadius: 10 }} />}
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/listing/${h.id}`)}><Text style={{ ...sf(700), fontSize: 14 }}>{h.address}</Text></Pressable>
                  <Text style={t.note}>{h.city}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${h.address} from compare`} onPress={() => c.remove(h.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={{ ...sf(700), fontSize: 13, color: color.brand }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {ROWS.map(([label, f, hero]) => (
              <View key={label} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: color.separator }}>
                <Text style={{ ...sf(600), width: 104, fontSize: 13, color: color.textSecondary, paddingVertical: 10 }}>{label}</Text>
                {homes.map(h => {
                  const win = (label === 'All-in to close' && h.id === bestAllIn) || (label === 'Monthly' && h.id === bestMonthly);
                  return (
                    <View key={h.id} style={{ width: COL, paddingHorizontal: 6, paddingVertical: 10, backgroundColor: win ? color.brandTint : undefined }}>
                      <Text style={{ ...sf(hero ? 800 : 600), fontSize: hero ? 17 : 14, color: hero ? color.brand : color.text }}>{f(h)}</Text>
                      {win && <Text style={{ ...t.note, ...sf(600) }}>Lowest</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <Text style={t.note}>Monthly = mortgage over 25 years, plus property tax and condo fee.</Text>
    </Screen>
  );
}
