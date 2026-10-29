import { Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@klyr/tokens';
import { Icon, type IconName, sora } from './ui';

export const TABS: [string, string, IconName, IconName][] = [
  ['/home', 'Home', 'home', 'home-outline'],
  ['/searches', 'Saved', 'heart', 'heart-outline'],
  ['/offers', 'Offers', 'document-text', 'document-text-outline'],
  ['/visits', 'Visits', 'calendar', 'calendar-outline'],
  ['/security', 'Account', 'person-circle', 'person-circle-outline'],
];

/** The bottom bar on the five main screens, as in DoorDash and Uber. */
export function TabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (!TABS.some(([href]) => href === path)) return null;
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line, paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
      {TABS.map(([href, label, on, off]) => {
        const active = path === href;
        return (
          <Pressable key={href} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => !active && router.replace(href as '/home')}
            style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icon name={active ? on : off} size={24} tint={active ? color.text : '#8A8A8A'} />
            <Text style={{ ...sora(active ? 700 : 600), fontSize: 11, color: active ? color.text : '#6B6B6B' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
