import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { buyerEstimate, DEFAULT_ASSUMPTIONS, money } from '@klyr/core';
import { color, font, layout, radius } from '@klyr/tokens';

/** Same engine as the web app and API, running on-device so the hero updates instantly. */
const SAMPLE = { price: 1_150_000, city: 'Mississauga', type: 'House', coop: 0.022, tax: 6960 } as const;
const PLANS = [60, 70, 80] as const;

export default function BuyerHome() {
  const [plan, setPlan] = useState<number>(DEFAULT_ASSUMPTIONS.plan);
  const e = buyerEstimate(SAMPLE, { plan });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Home' }} />
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: 16, gap: 4 }}>
        <Text style={{ fontSize: font.minSize, fontWeight: '700', color: color.textSecondary }}>ALL-IN TO CLOSE · 41 MAPLE CRES</Text>
        <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: '800', color: color.brand }}>{money(e.allIn)}</Text>
        <Text style={{ color: color.textSecondary }}>
          {money(e.costs)} closing costs − {money(e.cashBack)} cash back
        </Text>
        <Text style={{ fontSize: font.minSize, color: color.textSecondary }}>Estimate as of {DEFAULT_ASSUMPTIONS.asOf}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PLANS.map(p => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: plan === p }}
            onPress={() => setPlan(p)}
            style={{ minHeight: layout.touch, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.chip, backgroundColor: plan === p ? color.brand : color.surface }}
          >
            <Text style={{ fontWeight: '600', color: plan === p ? '#fff' : color.text }}>{p}% back</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
