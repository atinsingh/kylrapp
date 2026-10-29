import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { sora, t } from './ui';

const TABS = [['today', 'Today'], ['offers', 'Offers'], ['deals', 'Deals'], ['activity', 'Activity'], ['clients', 'Clients']] as const;

export function Nav({ current }: { current: (typeof TABS)[number][0] }) {
  const { agent, signOut } = useAuth();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...sora(800), fontSize: 18, color: color.brand }}>Klyr Pro</Text>
          <Text style={t.note}>{agent?.name}, {agent?.title}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...sora(700), fontSize: 13, color: color.textSecondary }}>Sign out</Text>
        </Pressable>
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: 'rgba(118,118,128,.12)', borderRadius: 10, padding: 2 }}>
        {TABS.map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === current }} onPress={() => key !== current && router.replace(`/${key}`)}
            style={{ flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: key === current ? color.surface : 'transparent' }}>
            <Text style={{ ...sora(600), fontSize: 13, color: color.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
