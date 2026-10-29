import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { affordFromIncome, DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color } from '@klyr/tokens';
import { klyr } from '../lib/klyr';
import { display, Button, Card, Chip, Field, Screen, sora, t, Title } from '../components/ui';
import { Back } from '../components/back';

const DOWNS = [5, 10, 15, 20, 25];

/** "What you can afford": income and down payment in, maximum price out. */
export default function Afford() {
  const [rate, setRate] = useState<number>(DEFAULT_ASSUMPTIONS.rate);
  const [income, setIncome] = useState('150000');
  const [debts, setDebts] = useState('450');
  const [downPct, setDownPct] = useState(20);
  useEffect(() => { void klyr.assumptions().then(r => { if (r.ok) { setRate(r.data.rate); setDownPct(Math.round(r.data.downPct * 100)); } }); }, []);

  const r = affordFromIncome({ income: Number(income) || 0, debts: Number(debts) || 0, downPct: downPct / 100, rate });
  const rows: [string, string][] = [
    ['Down payment', money(r.down)],
    ['Minimum required at this price', money(r.minDown)],
    ...(r.cmhc ? [['CMHC insurance, added to the mortgage', money(r.cmhc)], ['Ontario PST on it, due at closing', money(r.cmhcPst)]] as [string, string][] : []),
    ['Mortgage payment', money(r.monthly) + '/mo'],
    ['Qualifying rate (stress test)', (r.qualifyingRate * 100).toFixed(2) + '%'],
  ];

  return (
    <Screen>
      <Back />
      <Title sub="An estimate from your income and down payment, using the federal stress test. Your lender decides.">What you can afford</Title>
      <Card>
        <Text style={t.label}>YOU COULD BUY UP TO</Text>
        <Text accessibilityLiveRegion="polite" style={{ ...display(600), fontSize: 38, letterSpacing: -0.6, color: color.brand }}>{money(r.maxPrice)}</Text>
        <Text style={t.note}>about {money(r.monthly)}/month · lenders test you at {(r.qualifyingRate * 100).toFixed(2)}%</Text>
      </Card>
      <Card>
        <Field label="Household income, per year" value={income} onChangeText={v => setIncome(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Field label="Monthly debt payments" value={debts} onChangeText={v => setDebts(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Text style={t.label}>DOWN PAYMENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DOWNS.map(d => <Chip key={d} label={`${d}%`} on={downPct === d} onPress={() => setDownPct(d)} />)}
        </View>
      </Card>
      <Card>
        {rows.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator }}>
            <Text style={{ ...t.body, flex: 1 }}>{k}</Text><Text style={sora(600)}>{v}</Text>
          </View>
        ))}
        {r.limitedByDown && <Text style={{ ...t.note, color: '#A54B00' }}>Your down payment, not your income, sets this limit: at this price you need at least {money(r.minDown)}.</Text>}
      </Card>
      <Text style={t.note}>Housing costs up to 39% of income, all debts up to 44%. Qualifying rate is the higher of your rate + 2% or 5.25%. Property tax estimated at $500/month and heating at $100/month. Estimate only.</Text>
      <Button title={`Search homes up to ${money(r.maxPrice)}`} onPress={() => router.replace(`/home?maxPrice=${r.maxPrice}`)} />
    </Screen>
  );
}
