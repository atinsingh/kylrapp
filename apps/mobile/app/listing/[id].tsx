import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingDetail } from '@klyr/api-client';
import { money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../../lib/klyr';
import { Card, ErrorText, sora, t } from '../../components/ui';
import { PhotoStrip } from '../../components/photo-strip';

const EVENTS = { listed: 'Listed', price_change: 'Price change', sold: 'Sold', leased: 'Leased', terminated: 'Taken off the market', expired: 'Listing expired' } as const;
const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const month = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;

export default function Listing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<ListingDetail | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await klyr.listing(id);
    if (!r.ok) return setError(errorText(r.error));
    setL(r.data); setSaved(r.data.saved);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    const r = next ? await klyr.save(id) : await klyr.unsave(id);
    if (!r.ok) setSaved(!next);
  }

  if (!l) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped, padding: 16 }}>
        <Back />
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={color.brand} style={{ marginTop: 32 }} />}
      </SafeAreaView>
    );
  }
  const e = l.estimate, condo = l.type === 'Condo';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 16 }}><Back /></View>
        <PhotoStrip photos={l.photos} address={l.address} sample={l.samplePhotos} />
        <View style={{ padding: 16, gap: 12 }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ ...sora(800), fontSize: 26 }}>{money(l.price)}</Text>
              {l.daysOnMarket != null && <Text style={t.note}>{l.daysOnMarket} days on market</Text>}
            </View>
            <Text accessibilityRole="header" style={{ ...sora(700), fontSize: 17 }}>{l.address}, {l.city}</Text>
            <Text style={t.sub}>{l.beds} bed · {l.baths} bath{l.sqft ? ` · ${l.sqft.toLocaleString('en-CA')} sq ft` : ''} · {l.style ?? l.type}</Text>
            <Text style={t.note}>Listing brokerage: {l.listingBrokerage}</Text>
          </Card>

          <Card>
            <Text style={t.label}>{e.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN COST TO CLOSE'} · AT ASKING</Text>
            <Text style={{ ...sora(800), fontSize: 32, color: color.brand }}>{money(Math.abs(e.allIn))}</Text>
            <Text style={t.note}>after {money(e.cashBack)} cash back · {pct(l.coop)} offered to the buyer’s brokerage · estimate as of {day(e.asOf)}{e.customAssumptions ? ' · using your inputs' : ''}</Text>
            <Text accessibilityRole="link" onPress={() => router.push('/estimate')} style={{ ...sora(700), fontSize: 13, color: color.brand }}>How we estimate ›</Text>
            <Rows rows={[
              ['Ontario land transfer tax', money(e.ltt.on)],
              ...(e.ltt.onR ? [['First-time buyer refund', '−' + money(e.ltt.onR)] as Row] : []),
              ...(e.ltt.to ? [['Toronto land transfer tax', money(e.ltt.to)] as Row] : []),
              ...(e.ltt.toR ? [['Toronto first-time refund', '−' + money(e.ltt.toR)] as Row] : []),
              ['Lawyer · fee + HST + disbursements', money(e.lawyer)],
              condo ? ['Status certificate', money(e.statusCertificate)] : ['Inspection', money(e.inspection)],
              ['Title insurance', money(e.title)],
              ['Adjustments, estimated', money(e.adjustments)],
              ['Klyr cash back', '−' + money(e.cashBack)],
            ]} />
          </Card>

          <Section title="MONTHLY AND DOWN PAYMENT">
            <Rows rows={[
              [`Down payment · ${+(e.downPct * 100).toFixed(1)}%`, money(e.down)],
              ...(e.cmhc ? [['CMHC insurance, added to the mortgage', money(e.cmhc)] as Row] : []),
              [`Mortgage · ${pct(e.rate)}, 25 yr`, money(e.monthly) + '/mo'],
              ['Property tax', money(e.monthlyTax) + '/mo'],
              ...(l.condoFee ? [['Condo fee', money(l.condoFee) + '/mo'] as Row] : []),
            ]} />
            {e.downRaised && <Text style={{ ...t.note, color: '#A54B00' }}>Your usual down payment is below the minimum for this price, so this uses the minimum, {money(e.down)}.</Text>}
          </Section>

          {(l.openHouse || l.offerDate) && <Section title="OPEN HOUSE AND OFFERS"><Rows rows={[['Open house', l.openHouse ?? '—'], ['Offers', l.offerDate ?? '—']]} /></Section>}

          {l.history.length > 0 && (
            <Section title="PRICE HISTORY">
              <Rows rows={l.history.map(h => [`${EVENTS[h.event]} · ${day(h.at)}`, h.price != null ? money(h.price) : '—'] as Row)} />
            </Section>
          )}

          <Section title="SOLD NEARBY · LAST 6 MONTHS">
            {l.comparables.length
              ? <Rows rows={l.comparables.map(c => [`${c.address}\n${c.beds} bed${c.sqft ? ` · ${c.sqft.toLocaleString('en-CA')} sq ft` : ''} · ${month(c.soldAt)} · ${(c.distanceM / 1000).toFixed(1)} km`, money(c.soldPrice)] as Row)} />
              : <Text style={t.note}>No sales of similar homes within 2 km in the last 6 months.</Text>}
            <Text style={t.note}>Sold prices from the board, shown to registered users under MLS® VOW rules.</Text>
          </Section>

          {l.insights && (
            <>
              <Section title="NEIGHBOURHOOD AND SCHOOLS">
                <Rows rows={l.insights.schools.map(s => [`${s.name}\n${s.grades}`, s.distance] as Row)} />
                {l.insights.nearby ? <Text style={t.note}>{l.insights.nearby}. Check school boundaries with the board before you offer.</Text> : null}
              </Section>
              <Section title="COMMUTE"><Rows rows={l.insights.commute.map(c => [`${c.to}\n${c.how}`, c.time] as Row)} /></Section>
            </>
          )}

          <Section title="DETAILS">
            <Rows rows={[
              ['Type', [l.style, l.type].filter(Boolean).join(' · ')],
              ...(l.yearBuilt ? [['Built', String(l.yearBuilt)] as Row] : []),
              ...(l.lot ? [['Lot', l.lot] as Row] : []),
              ...(l.parking ? [['Parking', l.parking] as Row] : []),
              ...(l.heating ? [['Heating', l.heating] as Row] : []),
              ...(l.annualTax ? [['Taxes', money(l.annualTax) + '/yr'] as Row] : []),
              ['Buyer brokerage', pct(l.coop)],
              ['MLS® number', l.mlsNumber],
            ]} />
          </Section>
          <Text style={{ ...t.note, textAlign: 'center' }}>Klyr Realty Inc., Brokerage · Listing brokerage: {l.listingBrokerage} · Listing data © PropTx, used under VOW terms</Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(242,242,247,.96)', borderTopWidth: 0.5, borderTopColor: color.separator }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
          <View>
            <Text style={t.note}>{e.allIn < 0 ? 'You get back' : 'All-in to close'}</Text>
            <Text style={{ ...sora(800), fontSize: 18, color: color.brand }}>{money(Math.abs(e.allIn))}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} accessibilityLabel={`${saved ? 'Saved' : 'Save'} ${l.address}`} onPress={toggleSave}
            style={{ minHeight: 50, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: saved ? color.brand : color.brandTint }}>
            <Text style={{ ...sora(700), fontSize: 15, color: saved ? '#fff' : color.brand }}>{saved ? '♥ Saved' : '♡ Save'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/visit/${l.id}`)}
            style={{ minHeight: 50, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: color.brand }}>
            <Text style={{ ...sora(700), fontSize: 15, color: '#fff' }}>Book a visit</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

type Row = [string, string];

function Back() {
  return (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>‹ Back</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card><Text accessibilityRole="header" style={t.label}>{title}</Text>{children}</Card>;
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <View>
      {rows.map(([k, v], i) => {
        const [main, sub] = k.split('\n');
        return (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.body }}>{main}</Text>
              {sub ? <Text style={t.note}>{sub}</Text> : null}
            </View>
            <Text style={{ ...sora(600), fontSize: 14 }}>{v}</Text>
          </View>
        );
      })}
    </View>
  );
}
