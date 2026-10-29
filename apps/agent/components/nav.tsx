import { Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { Icon, type IconName, sf, t } from './ui';

const TABS: [string, string, IconName, IconName][] = [
  ['today', 'Today', 'calendar', 'calendar-outline'],
  ['offers', 'Offers', 'document-text', 'document-text-outline'],
  ['deals', 'Deals', 'briefcase', 'briefcase-outline'],
  ['activity', 'Activity', 'pulse', 'pulse-outline'],
  ['clients', 'Clients', 'people', 'people-outline'],
];
type Tab = 'today' | 'offers' | 'deals' | 'activity' | 'clients';

/** Top of each screen: the screen's name, a line under it, and who's signed in. */
export function Nav({ current, sub }: { current: Tab; sub?: string }) {
  const { agent, signOut } = useAuth();
  const initials = (agent?.name ?? 'K').split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ ...sf(700), fontSize: 13, color: color.brand }}>Klyr Pro</Text>
        <Text accessibilityRole="header" style={t.h1}>{TABS.find(x => x[0] === current)![1]}</Text>
        <Text style={t.sub}>{sub ?? `${agent?.name ?? ''}${agent?.title ? `, ${agent.title}` : ''}`}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#8E8E93', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...sf(700), fontSize: 14, color: '#fff' }}>{initials}</Text>
      </Pressable>
    </View>
  );
}

/** Bottom icon tabs, as in a driver or courier app. */
export function AgentTabs() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (!TABS.some(([k]) => path === `/${k}`)) return null;
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: 'rgba(249,249,249,0.96)', borderTopWidth: 0.5, borderTopColor: color.separator, paddingBottom: Math.max(insets.bottom, 4), paddingTop: 6 }}>
      {TABS.map(([key, label, on, off]) => {
        const active = path === `/${key}`;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => !active && router.replace(`/${key}` as '/today')}
            style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icon name={active ? on : off} size={25} tint={active ? color.brand : '#8E8E93'} />
            <Text style={{ ...sf(500), fontSize: 11, color: active ? color.brand : '#6C6C70' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
