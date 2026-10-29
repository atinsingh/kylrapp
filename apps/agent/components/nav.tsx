import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { serif, sora, t } from './ui';

const TABS = [['today', 'Today'], ['offers', 'Offers'], ['deals', 'Deals'], ['activity', 'Activity'], ['clients', 'Clients']] as const;

/** Wordmark, an underlined tab row, then the screen's title in the editorial serif. */
export function Nav({ current, sub }: { current: (typeof TABS)[number][0]; sub?: string }) {
  const { agent, signOut } = useAuth();
  const initials = (agent?.name ?? 'K').split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ ...serif(700), fontSize: 24, letterSpacing: -0.6, color: color.brandInk, flex: 1 }}>Klyr <Text style={{ ...serif(400), color: color.brand }}>Pro</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ ...sora(600), fontSize: 13, color: color.textSecondary }}>Sign out</Text>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.brandInk, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...sora(700), fontSize: 13, color: '#fff' }}>{initials}</Text>
          </View>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 18, borderBottomWidth: 1, borderBottomColor: color.line, flexGrow: 1 }}>
        {TABS.map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === current }} onPress={() => key !== current && router.replace(`/${key}`)}
            style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: key === current ? color.brandInk : 'transparent', marginBottom: -1 }}>
            <Text style={{ ...sora(key === current ? 700 : 600), fontSize: 14, color: key === current ? color.text : color.textSecondary }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ gap: 6, marginTop: 4 }}>
        <Text accessibilityRole="header" style={t.h1}>{TABS.find(x => x[0] === current)![1]}</Text>
        <Text style={t.sub}>{sub ?? `${agent?.name ?? ''}${agent?.title ? `, ${agent.title}` : ''}`}</Text>
      </View>
    </View>
  );
}
