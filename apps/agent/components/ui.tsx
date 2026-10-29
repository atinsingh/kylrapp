import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, layout, radius } from '@klyr/tokens';

/** Sora by weight, for everything but headlines; React Native picks a font file per weight. */
export const sora = (w: 400 | 600 | 700 | 800 = 400): TextStyle => ({
  fontFamily: { 400: 'Sora_400Regular', 600: 'Sora_600SemiBold', 700: 'Sora_700Bold', 800: 'Sora_800ExtraBold' }[w],
});
/** Fraunces, the editorial serif: page titles and the big numbers. */
export const serif = (w: 400 | 600 | 700 = 600): TextStyle => ({
  fontFamily: { 400: 'Fraunces_400Regular', 600: 'Fraunces_600SemiBold', 700: 'Fraunces_700Bold' }[w],
});

export const t = {
  h1: { ...serif(600), fontSize: 34, lineHeight: 38, letterSpacing: -0.6, color: color.text } as TextStyle,
  h2: { ...serif(600), fontSize: 22, lineHeight: 26, letterSpacing: -0.3, color: color.text } as TextStyle,
  body: { ...sora(), fontSize: 15, lineHeight: 22, color: color.text } as TextStyle,
  sub: { ...sora(), fontSize: 15, lineHeight: 22, color: color.textSecondary } as TextStyle,
  note: { ...sora(), fontSize: 13, lineHeight: 19, color: color.textSecondary } as TextStyle,
  label: { ...sora(600), fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: color.textSecondary } as TextStyle,
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const inner = <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 16, paddingBottom: 56 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: color.surface, borderRadius: radius.card, padding: 18, gap: 10, borderWidth: 1, borderColor: color.line }, style]}>{children}</View>;
}

/** Primary: solid ink pill. Alt: outlined pill. */
export function Button({ title, onPress, alt, disabled, busy }: { title: string; onPress: () => void; alt?: boolean; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22,
        backgroundColor: alt ? 'transparent' : color.brandInk, borderWidth: alt ? 1.5 : 0, borderColor: color.brandInk, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 })}>
      {busy ? <ActivityIndicator color={alt ? color.brandInk : '#fff'} /> : <Text style={{ ...sora(600), fontSize: 15, color: alt ? color.brandInk : '#fff' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...sora(600), fontSize: 13, color: color.textSecondary }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#8A8F8C"
        style={{ ...sora(), minHeight: 52, borderRadius: 14, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, fontSize: 16, color: color.text }}
        {...rest} />
    </View>
  );
}

export function Chip({ label, on, onPress, flex }: { label: string; on: boolean; onPress: () => void; flex?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: layout.touch, paddingHorizontal: 16, borderRadius: radius.chip, justifyContent: 'center', alignItems: 'center',
        backgroundColor: on ? color.brandInk : color.surface, borderWidth: 1, borderColor: on ? color.brandInk : color.line, ...(flex ? { flex: 1 } : {}) }}>
      <Text style={{ ...sora(600), fontSize: 13, color: on ? '#fff' : color.text }}>{label}</Text>
    </Pressable>
  );
}

export function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 1.5, borderColor: color.textSecondary, backgroundColor: on ? color.brand : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Text style={{ ...sora(800), color: '#fff', fontSize: 12 }}>✓</Text>}
      </View>
      <Text style={{ ...t.body, fontSize: 14, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? color.brandInk : color.line }} />)}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ ...sora(), backgroundColor: '#FBE9E7', color: '#9B1C12', borderRadius: 14, padding: 14, fontSize: 14 }}>{children}</Text>;
}

/** Editorial page title: a big serif headline, and a calmer line under it. */
export function Title({ children, sub }: { children: string; sub?: string }) {
  return <View style={{ gap: 8, marginTop: 4, marginBottom: 4 }}><Text accessibilityRole="header" style={t.h1}>{children}</Text>{sub ? <Text style={t.sub}>{sub}</Text> : null}</View>;
}

/** A dark feature block for the one number that matters on a screen (all-in, net, rent after fees). */
export function Hero({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'grey' }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ backgroundColor: tone === 'ink' ? color.brandInk : '#4E5552', borderRadius: 24, paddingHorizontal: 22, paddingVertical: 24, gap: 8 }}>
      <Text style={{ ...t.label, color: color.brandOnDark }}>{label}</Text>
      <Text style={{ ...serif(600), fontSize: 44, lineHeight: 48, letterSpacing: -1, color: '#fff' }}>{value}</Text>
      {sub ? <Text style={{ ...sora(), fontSize: 14, lineHeight: 20, color: '#D3E2DC' }}>{sub}</Text> : null}
    </View>
  );
}
