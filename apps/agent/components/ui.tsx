import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, layout, radius } from '@klyr/tokens';

/** Sora by weight; React Native picks a font file per weight. */
export const sora = (w: 400 | 600 | 700 | 800 = 400): TextStyle => ({
  fontFamily: { 400: 'Sora_400Regular', 600: 'Sora_600SemiBold', 700: 'Sora_700Bold', 800: 'Sora_800ExtraBold' }[w],
});
/** Headlines and big numbers: Sora at its heaviest, set tight. */
export const display = (w: 400 | 600 | 700 = 700): TextStyle => ({ ...sora(w === 700 ? 800 : 700), letterSpacing: -0.6 });

export const t = {
  h1: { ...sora(800), fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: color.text } as TextStyle,
  h2: { ...sora(700), fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: color.text } as TextStyle,
  body: { ...sora(), fontSize: 15, lineHeight: 22, color: color.text } as TextStyle,
  sub: { ...sora(), fontSize: 15, lineHeight: 21, color: color.textSecondary } as TextStyle,
  note: { ...sora(), fontSize: 13, lineHeight: 18, color: color.textSecondary } as TextStyle,
  label: { ...sora(700), fontSize: 13, letterSpacing: 0.2, color: color.textSecondary } as TextStyle,
};

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 22, tint = color.text }: { name: IconName; size?: number; tint?: string }) {
  return <Ionicons name={name} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const inner = <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 16, paddingBottom: 40 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }} edges={['top']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

/** A grouped block: grey fill, no border, like the panels in Uber and DoorDash. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: color.canvas, borderRadius: radius.card, padding: 16, gap: 10 }, style]}>{children}</View>;
}

/** Primary: black. Alt: grey. Both full width, 56 tall. */
export function Button({ title, onPress, alt, disabled, busy, icon }: { title: string; onPress: () => void; alt?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName }) {
  const fg = alt ? color.text : '#fff';
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20,
        backgroundColor: alt ? color.canvas : color.brandInk, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 })}>
      {busy ? <ActivityIndicator color={fg} /> : <>{icon && <Icon name={icon} size={20} tint={fg} />}<Text style={{ ...sora(700), fontSize: 16, color: fg }}>{title}</Text></>}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...sora(600), fontSize: 13, color: color.textSecondary }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#8A8A8A"
        style={{ ...sora(), minHeight: 54, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DCDCDC', paddingHorizontal: 16, fontSize: 16, color: color.text }}
        {...rest} />
    </View>
  );
}

export function Chip({ label, on, onPress, flex, icon }: { label: string; on: boolean; onPress: () => void; flex?: boolean; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: layout.touch, paddingHorizontal: 16, borderRadius: radius.chip, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6,
        backgroundColor: on ? color.brandInk : color.canvas, ...(flex ? { flex: 1 } : {}) }}>
      {icon && <Icon name={icon} size={16} tint={on ? '#fff' : color.text} />}
      <Text style={{ ...sora(600), fontSize: 14, color: on ? '#fff' : color.text }}>{label}</Text>
    </Pressable>
  );
}

export function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: on ? 0 : 2, borderColor: '#B5B5B5', backgroundColor: on ? color.brandInk : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Icon name="checkmark" size={16} tint="#fff" />}
      </View>
      <Text style={{ ...t.body, fontSize: 14, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.brandInk : color.line }} />)}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ ...sora(600), backgroundColor: color.accentTint, color: '#9B1C12', borderRadius: 12, padding: 14, fontSize: 14 }}>{children}</Text>;
}

export function Title({ children, sub }: { children: string; sub?: string }) {
  return <View style={{ gap: 6, marginTop: 4 }}><Text accessibilityRole="header" style={t.h1}>{children}</Text>{sub ? <Text style={t.sub}>{sub}</Text> : null}</View>;
}

/** The one number that matters on a screen (all-in, net, rent after fees), on black. */
export function Hero({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'grey' }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ backgroundColor: tone === 'ink' ? color.brandInk : '#545454', borderRadius: radius.card, paddingHorizontal: 20, paddingVertical: 20, gap: 6 }}>
      <Text style={{ ...sora(600), fontSize: 13, color: color.brandOnDark }}>{label}</Text>
      <Text style={{ ...sora(800), fontSize: 40, lineHeight: 46, letterSpacing: -1.2, color: '#fff' }}>{value}</Text>
      {sub ? <Text style={{ ...sora(), fontSize: 14, lineHeight: 20, color: '#C9C9C9' }}>{sub}</Text> : null}
    </View>
  );
}

/** A tappable row with an icon, as in settings and account screens. */
export function Row({ icon, title, sub, onPress }: { icon: IconName; title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></View>
      <View style={{ flex: 1, gap: 2 }}><Text style={{ ...sora(600), fontSize: 16, color: color.text }}>{title}</Text>{sub ? <Text style={t.note}>{sub}</Text> : null}</View>
      <Icon name="chevron-forward" size={18} tint={color.textSecondary} />
    </Pressable>
  );
}
